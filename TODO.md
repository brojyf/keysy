# TODO

## Account deletion

This is a design for #193. Do not merge this file.

### Rules

- Only Account › General has **Delete account**. An Owner must first transfer the Owner role or delete each org they own. Until then, `DELETE /v0/me` returns 409 `ORG_OWNER`, and the dialog lists those orgs from `GET /v0/orgs` (role `owner`).
- Deleting an account starts a 30-day grace period. `profiles.deleted_at` is set, and every session of the user is deleted, so every device is signed out. Memberships stay.
- During the grace period, the member stays in each org's member list with a **Deleting** badge. The Owner and Admins can remove them as usual. Inviting their email fails with the existing-member error.
- A member in the grace period can only be removed. They cannot be the target of any other change, such as an Owner role transfer, a role change, or a service or permission set assignment. Pickers do not list them. Each write endpoint checks `deleted_at` of the target in its own transaction.
- A caller in the grace period can use only `GET /v0/me`, `POST /v0/me/cancel-deletion`, and `POST /v0/auth/logout`. Every other api endpoint returns 403 `ACCOUNT_DELETING`.
- Signing in during the grace period does not restore the account. The dashboard opens the **Cancel deletion** page, where the user can cancel the deletion or sign out. Only **Cancel deletion** restores the account. The user gets back only the memberships that still exist, with the roles and scopes they have at that time, so no permission can increase while they are away.
- After 30 days, a daily `pg_cron` job permanently deletes the user: their membership rows first, then the `auth.users` row. The profile is deleted by cascade.
- The user gets an email when the deletion starts and another when the purge is done.
- After the purge, the same Google account can sign in again. It becomes a new user with a new user ID and no orgs.
- There is no email cooldown after deletion. Keysy has no public usernames, free tier, or bans to protect, and a cooldown would keep the email with no clear benefit.

### API: `DELETE /v0/me`

- The endpoint is on api, next to `GET` and `PATCH /v0/me`. It accepts no query string and no body. Only the dashboard checks the confirmation text.
- One transaction runs in a SECURITY DEFINER function, because the api role cannot access schema `auth`:
  1. Lock the user's `auth.users` row with `FOR UPDATE`. A concurrent org creation references this row, so the two operations run one after the other.
  2. If the user owns an org, stop and return `ORG_OWNER`.
  3. Set `profiles.deleted_at`.
  4. Delete the user's `auth.sessions` rows. Their refresh tokens are deleted by cascade.
- Responses: 204 on success, 409 `ORG_OWNER`, and 400, 401, 403, 500, and 503 as on other endpoints.
- An access token already issued stays valid until it expires (5 minutes), as after a session revoke. The api rejects a caller in the grace period, so that token cannot change anything. This matters most for org creation: an org created in that window would lose its Owner at the purge, so org creation also checks `deleted_at` in its transaction.
- A repeated request in that window returns 204 and keeps the first `deleted_at`.
- After 204, the dashboard calls `POST /v0/auth/logout` to clear the cookies, then opens the Account deleted page.

### Emails

- Two emails go through the planned outbox path: Supabase outbox, Outbox Relay, Kafka, `notify`, Cloudflare Queues, `email-worker`, Resend.
- **Deletion scheduled**: `DELETE /v0/me` writes the outbox event in its transaction. The email gives the purge date and says that the user can sign in before then to cancel the deletion. It also warns the user if someone else deleted the account with a stolen session.
- **Account deleted**: the purge function writes the outbox event in the same transaction as the delete. The payload carries the email and display name, because the profile and `auth.users` row are gone after the commit.
- Each send uses the outbox event ID as the Resend idempotency key.
- The purge event keeps a deleted user's email outside the database. Delete outbox rows after the relay publishes them, and keep a short retention on the Kafka topic.
- No reminder before the purge.
- The outbox path, `notify`, and `email-worker` do not exist yet. Tracked in #210.
- Account deletion ships first without emails. The emails follow when #210 is done.

### Cancel deletion

- Restoring is ordinary api logic. There is no trigger on `auth` tables and no Auth Hook, and auth does not check the deletion state at sign-in.
- `GET /v0/me` returns the purge date while a deletion is pending. The field name is set in the OpenAPI draft.
- When that field is set, SessionGate opens the **Cancel deletion** page. It is a standalone page with no rail and no avatar. It shows the purge date and two buttons: **Cancel deletion** and **Sign out**.
- **Cancel deletion** calls `POST /v0/me/cancel-deletion`. The api clears `profiles.deleted_at` with the `keysy_api` role. It accepts no body and returns 204, then the dashboard opens the app as usual.
- The endpoint also returns 204 when no deletion is pending, so a second tab or a retry does not fail.
- **Sign out** calls `POST /v0/auth/logout`. The deletion stays pending.
- The CLI and the browser extension cannot cancel a deletion. On 403 `ACCOUNT_DELETING`, they tell the user to sign in to the dashboard to cancel it.
- Large products also ask for an explicit choice after sign-in: Facebook (**Cancel deletion**), Discord (**Restore Account**), and Microsoft (sign in, then confirm with a code). X restores on sign-in and warns that third-party app sign-ins also restore the account, which is the risk this design avoids.

### Member list

- `GET /v0/orgs/{orgId}/members` returns members in the grace period with a status (`active` or `deleting`). The field name is set in the OpenAPI draft. Every member sees the badge, because every member can see the list.
- `memberCount` in `GET /v0/orgs` still counts these members.

### Tasks

- [ ] PRD: in `wiki/prd.mdx`, change "Signing in within 30 days restores the account" to say that signing in within 30 days lets the user cancel the deletion.
- [ ] OpenAPI: add `DELETE /v0/me` with `ORG_OWNER`, `POST /v0/me/cancel-deletion`, the purge date in `GET /v0/me`, `ACCOUNT_DELETING`, and the member status field.
- [ ] Database: in a migration, add the deletion function and the daily purge job. Grant `EXECUTE` on the function to `keysy_api` by hand. In production, verify that the `pg_cron` job can delete `auth.users` rows.
- [ ] api: add `DELETE /v0/me` and `POST /v0/me/cancel-deletion`, return the purge date and the member status, reject callers in the grace period with 403 `ACCOUNT_DELETING`, and check `deleted_at` in the org creation transaction.
- [ ] Email (after #210, not needed for the first release): write the two outbox events (deletion scheduled, account deleted) and add both templates to `email-worker/`.
- [ ] Future endpoints (invite, remove member, transfer the Owner role, change role, assign services): apply the target rule in the same transaction as the write.
- [ ] Figma: in a review section, draw the **Deleting** badge in the People · Members row and the **Cancel deletion** page, and change the copy on Account · Delete account › Account deleted to say that signing in within 30 days lets the user cancel the deletion.
- [ ] Dashboard: enable **Delete**, build the Delete account dialog (Delete account · Can delete, and the list of owned orgs), the Account deleted page, the **Cancel deletion** page and its SessionGate rule, and the **Deleting** badge.
- [ ] Tests (#193): delete an account; sign in within 30 days and see the Cancel deletion page; sign out from it and the deletion stays pending; cancel the deletion and get the remaining memberships back; other api calls get 403 `ACCOUNT_DELETING` until the user cancels; a membership removed during the grace period stays removed; the purge after 30 days; sign in after the purge as a new user and join an org; an Owner gets 409; a concurrent org creation; other users and orgs are unaffected.
