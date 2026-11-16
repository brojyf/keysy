# TODO

## Account deletion

This is a design for #193. Do not merge this file.

### Rules

- Only Account › General has **Delete account**. An Owner must first transfer the Owner role or delete each org they own. Until then, `DELETE /v0/me` returns 409 `ORG_OWNER`, and the dialog lists those orgs from `GET /v0/orgs` (role `owner`).
- Deleting an account starts a 30-day grace period. `profiles.deleted_at` is set, and every session of the user is deleted, so every device is signed out. Memberships stay.
- During the grace period, the member stays in each org's member list with a **Deleting** badge. The Owner and Admins can remove them as usual. Inviting their email fails with the existing-member error.
- A member in the grace period can only be removed. They cannot be the target of any other change, such as an Owner role transfer, a role change, or a service or permission set assignment. Pickers do not list them. Each write endpoint checks `deleted_at` of the caller and of the target in its own transaction.
- Signing in during the grace period restores the account automatically. There is no restore page or dialog. The user gets back only the memberships that still exist, with the roles and scopes they have at that time, so no permission can increase while they are away.
- After 30 days, a daily `pg_cron` job permanently deletes the user: their membership rows first, then the `auth.users` row. The profile is deleted by cascade.
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
- An access token already issued stays valid until it expires (5 minutes), as after a session revoke. Write endpoints reject a caller in the grace period, so that token cannot change anything. This matters most for org creation: an org created in that window would lose its Owner at the purge.
- Proposed: a repeated request in that window returns 204 and keeps the first `deleted_at`.
- After 204, the dashboard calls `POST /v0/auth/logout` to clear the cookies, then opens the Account deleted page.

### Restore

- An `after insert` trigger on `auth.sessions` clears `profiles.deleted_at` for the user.
- Deletion removes every session, and a token refresh does not insert a session. So only a new sign-in restores the account, including future CLI and browser extension sign-ins.

### Member list

- `GET /v0/orgs/{orgId}/members` returns members in the grace period with a status (`active` or `deleting`). The field name is set in the OpenAPI draft. Every member sees the badge, because every member can see the list.
- `memberCount` in `GET /v0/orgs` still counts these members.

### Tasks

- [ ] PRD: in `wiki/prd.mdx`, change "Deleting an account removes the member from every org" to describe the 30-day grace period, the **Deleting** badge, the restore on sign-in, and the purge.
- [ ] OpenAPI: add `DELETE /v0/me` with `ORG_OWNER`, and the member status field.
- [ ] Database: in a migration, add the deletion function, the restore trigger, and the daily purge job. Grant `EXECUTE` on the function to `keysy_api` by hand. In production, verify that `postgres` can create a trigger on `auth.sessions` and that the `pg_cron` job can delete `auth.users` rows.
- [ ] api: add `DELETE /v0/me`, return the member status, and reject callers in the grace period on every write endpoint.
- [ ] Future endpoints (invite, remove member, transfer the Owner role, change role, assign services): apply the target rule in the same transaction as the write.
- [ ] Figma: in a review section, draw the **Deleting** badge in the People · Members row, and change the copy on Account · Delete account › Account deleted to say that signing in within 30 days restores the account.
- [ ] Dashboard: enable **Delete**, build the Delete account dialog (Delete account · Can delete, and the list of owned orgs), the Account deleted page, and the **Deleting** badge.
- [ ] Tests (#193): delete an account; sign in within 30 days and get the remaining memberships back; a membership removed during the grace period stays removed; the purge after 30 days; sign in after the purge as a new user and join an org; an Owner gets 409; a concurrent org creation; other users and orgs are unaffected.
