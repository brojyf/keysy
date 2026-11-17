# TODO

## Account deletion

This is a design for #193. Do not merge this file.

**Before implementing each endpoint, review its API design with the user first** (path, request, responses and error codes, transaction steps, and checks). Implement it only after the user approves. This applies to every endpoint below, one at a time.

### Rules

- Only Account › General has **Delete account**. An Owner must first transfer the Owner role or delete each org they own. Until then, `DELETE /v0/me` returns 409 `ORG_OWNER`, and the dialog lists those orgs from the 409 response body.
- Deleting an account starts a 30-day grace period. `profiles.deleted_at` is set, and every session of the user is deleted, so every device is signed out. Memberships stay.
- During the grace period, the member stays in each org's member list with a **Deleting** badge. The Owner and Admins can remove them as usual. Inviting their email fails with the existing-member error.
- A member in the grace period can only be removed. They cannot be the target of any other change, such as an Owner role transfer, a role change, or a service or permission set assignment. Pickers do not list them. Each write endpoint checks `deleted_at` of the target in its own transaction.
- A caller in the grace period cannot use org data. Every query that checks the caller's org membership also joins the caller's profile with `deleted_at IS NULL`, so the caller gets the existing not-a-member response (404 or 403). The check is part of the existing SQL in the api stores: no extra query, no middleware, and no JWT claim.
  - The condition applies only to the caller. A join that shows other members must not filter them, because the member list shows them with the **Deleting** badge.
  - `GET /v0/orgs` has no profile join yet, so it gets one and returns an empty list.
  - Owner-only endpoints (rename and delete an org) need no condition: a user in the grace period cannot be an Owner.
  - Endpoints about the caller's own account have no check: `GET /v0/me`, `PATCH /v0/me`, `POST /v0/me/cancel-deletion`, `/v0/me/sessions`, and `POST /v0/auth/logout`.
  - Two endpoints add the caller to an org without an existing membership, so the membership check does not cover them. Each starts its transaction with the `profiles` lock statement below and returns 403 `ACCOUNT_DELETING`:
    - `POST /v0/orgs`: an org created in the grace period would lose its Owner at the purge.
    - Accepting an invitation: the user would join an org while their account is being deleted. Pending invitations stay as they are, so the user can still accept them after cancelling the deletion, or as a new user after the purge.
- Signing in during the grace period does not restore the account. The dashboard opens the **Cancel deletion** page, where the user can cancel the deletion or sign out. Only **Cancel deletion** restores the account. The user gets back only the memberships that still exist, with the roles and scopes they have at that time, so no permission can increase while they are away.
- After 30 days, a daily `pg_cron` job permanently deletes the user: their membership rows first, then the `auth.users` row. The profile is deleted by cascade.
- The user gets an email when the deletion starts, when they cancel it, and when the purge is done.
- After the purge, the same Google account can sign in again. It becomes a new user with a new user ID and no orgs.
- There is no email cooldown after deletion. Keysy has no public usernames, free tier, or bans to protect, and a cooldown would keep the email with no clear benefit.

### API: `DELETE /v0/me`

- The endpoint is on api, next to `GET` and `PATCH /v0/me`. It accepts no query string and no body. Only the dashboard checks the confirmation text.
- The api runs one transaction with plain SQL. Only step 4 calls a function, because the api role cannot access schema `auth`:
  1. Lock the user's `profiles` row with `SELECT … FOR UPDATE`. Org creation locks the same row first (see below), so the two operations run one after the other. The Owner check in step 2 is a separate statement after the lock, so it sees an org that a concurrent creation just committed.
  2. If the user owns an org, stop and return `ORG_OWNER`.
  3. Set `profiles.deleted_at`.
  4. Call `public.revoke_all_user_sessions(user_id)`, a small SECURITY DEFINER function that only deletes the user's `auth.sessions` rows, like the existing `revoke_user_session` without the session ID. Their refresh tokens are deleted by cascade.
- The function call is a statement inside the api transaction, so a rollback (for example on `ORG_OWNER`) also undoes the session deletion. The Go code must run every step on the transaction handle, not on the shared `DB`.
- Business logic stays in the api: the lock, the Owner check, and the response codes are in Go and tested there. The function only bridges the permission gap. This costs about 5 database round trips from `sjc` to `ca-central-1` instead of 1, which is acceptable for a rare operation.
- Responses: 204 on success, 409 `ORG_OWNER`, and 400, 401, 403, 500, and 503 as on other endpoints.
- An access token already issued stays valid until it expires (5 minutes), as after a session revoke. The api rejects a caller in the grace period on org data, so that token cannot change anything in an org. This matters most for org creation: an org created in that window would lose its Owner at the purge, so org creation also checks `deleted_at` in its transaction.
- Org creation starts its transaction with `SELECT 1 FROM profiles WHERE id = $1 AND deleted_at IS NULL FOR SHARE`. The check and the lock are one statement. No row means 403 `ACCOUNT_DELETING`. If a deletion holds the row, this statement waits, then rechecks the committed row and returns no row. Do not rely on the implicit foreign key lock on `auth.users`: a plain read before the insert would pass while a deletion is still running.
- A repeated request in that window returns 204 and keeps the first `deleted_at`.
- After 204, the dashboard calls `POST /v0/auth/logout` to clear the cookies, then opens the Account deleted page.

### Emails

- Three emails go through the planned outbox path: Supabase outbox, Outbox Relay, Kafka, `notify`, Cloudflare Queues, `email-worker`, Resend.
- **Deletion scheduled**: `DELETE /v0/me` writes the outbox event in its transaction. The email gives the purge date and says that the user can sign in before then to cancel the deletion. It also warns the user if someone else deleted the account with a stolen session. A repeated request keeps the first `deleted_at` and writes no second event.
- **Deletion cancelled**: `POST /v0/me/cancel-deletion` writes the outbox event in its transaction, only when it clears `deleted_at`. A request with no pending deletion writes no event. The email says the account is active again, and tells the user to revoke sessions in Account › Sessions if they did not cancel it.
- **Account deleted**: the purge function writes the outbox event in the same transaction as the delete. The payload carries the email and display name, because the profile and `auth.users` row are gone after the commit.
- Each send uses the outbox event ID as the Resend idempotency key.
- The purge event keeps a deleted user's email outside the database. Delete outbox rows after the relay publishes them, and keep a short retention on the Kafka topic.
- No reminder before the purge.
- The outbox path, `notify`, and `email-worker` do not exist yet. Tracked in #189 (#210 was merged into it).
- Account deletion ships first without emails. The emails follow when #210 is done.

### Cancel deletion

- Restoring is ordinary api logic. There is no trigger on `auth` tables and no Auth Hook, and auth does not check the deletion state at sign-in.
- `GET /v0/me` returns the purge date as `purgeAt` while a deletion is pending.
- When that field is set, SessionGate opens the **Cancel deletion** page. It is a standalone page with no rail and no avatar. It shows the purge date and two buttons: **Cancel deletion** and **Sign out**.
- **Cancel deletion** calls `POST /v0/me/cancel-deletion`. The api clears `profiles.deleted_at` with the `keysy_api` role. It accepts no body and returns 204, then the dashboard opens the app as usual.
- The endpoint also returns 204 when no deletion is pending, so a second tab or a retry does not fail.
- **Sign out** calls `POST /v0/auth/logout`. The deletion stays pending.
- The CLI and the browser extension cannot cancel a deletion. On a 403 or 404, they call `GET /v0/me`. If a deletion is pending, they tell the user to sign in to the dashboard to cancel it.
- Large products also ask for an explicit choice after sign-in: Facebook (**Cancel deletion**), Discord (**Restore Account**), and Microsoft (sign in, then confirm with a code). X restores on sign-in and warns that third-party app sign-ins also restore the account, which is the risk this design avoids.

### Member list

- `GET /v0/orgs/{orgId}/members` returns members in the grace period with `deleting: true`. Every member sees the badge, because every member can see the list.
- `memberCount` in `GET /v0/orgs` still counts these members.

### Tasks

Status on 2026-11-17 (`main` at #235):

- [x] PRD: signing in within 30 days lets the user cancel the deletion (#211, #213).
- [x] OpenAPI: `DELETE /v0/me` with `ORG_OWNER` and the owned orgs, `POST /v0/me/cancel-deletion`, `purgeAt`, `ACCOUNT_DELETING` on `POST /v0/orgs`, and member `deleting` (shipped with each route: #215, #220, #221, #222, #225, #228).
- [x] Database: `revoke_all_user_sessions` (#215) and the daily purge job (#223, lock order fixed in #233). Production check on 2026-11-17: `keysy_api` has `EXECUTE` on the function, `purge-deleted-accounts` is active and succeeded on 2026-11-16 and 2026-11-17, and `postgres` can delete `auth.users` rows. No account has been purged yet.
- [x] api: `DELETE /v0/me` (#215, #225), `POST /v0/me/cancel-deletion` (#222), `purgeAt` (#221), member `deleting` (#228), the caller condition in every org membership check including `GET /v0/orgs` (#227) and invitation list, and the `profiles` lock in org creation (#215).
- [x] Figma: **Deleting** badge, **Cancel deletion** page with its error view, and the Account deleted copy (Account · Delete account, People · Members).
- [x] Dashboard: Delete account dialog, Account deleted page, **Cancel deletion** page and its SessionGate rule (#224), **Deleting** badge (#229), and Remove for deleting members (#231).
- [x] Remove member: allowed for a deleting target, rejected for a deleting caller (#230).
- [ ] Invite endpoint (#188): inviting the email of a deleting member fails with the existing-member error.
- [ ] Invitation accept endpoint (#188): lock and check the caller's `profiles` row first, and return 403 `ACCOUNT_DELETING` in the grace period.
- [ ] Future endpoints (transfer the Owner role, change role, assign services): apply the target rule in the same transaction as the write.
- [ ] Email (#189, not needed for the first release): write the three outbox events (deletion scheduled, deletion cancelled, account deleted) and add the three templates to `email-worker/`.
- [ ] Tests (#193): done for delete, the Owner 409, cancel, the Cancel deletion page and sign out, org creation 403, the concurrent org creation in both orders, member removal in the grace period, and the purge with other users unaffected. Still open, because they need invitation accept: accept gets 403 `ACCOUNT_DELETING`, the invitation can still be accepted after cancelling, and a new user after the purge joins an org.
