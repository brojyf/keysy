# TODO

## Member invitations

This design replaces the current model, in which an added member is active immediately and the email is only a notice. Members now join only after they accept an invitation.

### Rules

- The Owner invites Admins and Developers by email and role. Admins invite only Developers and cannot change an invitation's role to Admin.
- Every invitee accepts, with or without an account: email link, Google sign-in, **Join {org}**, then **Join**. A new user creates an account inside this flow.
- The email link is the only entry for now. An in-app notification entry is tracked in #189.
- The invitee must sign in with a Google account whose email matches the invitation, ignoring case. Emails are stored in lowercase.
- If the signed-in email does not match a valid invitation, the page shows the signed-in email and a **Sign out** button, and asks the invitee to sign in with the email that received the invitation. It never shows the invited email; the API returns only whether the emails match.
- The **Join {org}** page has only **Join**. There is no **Decline**; an ignored invitation expires.
- A link to a cancelled, expired, or deleted invitation shows **Invalid invitation**.
- Every member sees pending and expired invitations, email only. The Owner and Admins can resend or cancel any invitation, and change the role of a pending or expired invitation (GitHub allows this too).
- An invitation expires 7 days after it is created. Resending a pending invitation does not extend it.
- Expired invitations stay in the list as **Expired**. Resending or re-inviting an expired invitation restarts its 7 days.
- Invitations store `invited_by_email`, copied from the inviter's profile email. Creating an invitation and re-inviting an expired invitation set it to the current inviter. Resending does not change it. It is an email, not a user ID, so it remains after the inviter's account is deleted.
- A daily job deletes invitations 37 days after their current 7-day period starts.
- Deleting an org deletes all its invitations through the foreign key cascade. Org deletion becomes a hard delete in a separate change.
- An email can have only one invitation per org. Inviting a member or an email with a pending invitation fails. Inviting an email with an expired invitation updates that invitation, including its role.
- A member whose account is scheduled for deletion is still a member, so inviting their email fails with the existing-member error (account deletion, #193).
- A user whose account is scheduled for deletion cannot accept an invitation, because they would join an org while their account is being deleted. The accept transaction starts with `SELECT 1 FROM profiles WHERE id = $1 AND deleted_at IS NULL FOR SHARE`, the same lock as org creation, and no row returns 403 `ACCOUNT_DELETING`. Pending invitations stay, so the user can accept after cancelling the deletion, or as a new user after the purge.
- Each invitation can be resent once every 24 hours, expired or not. The first resend is possible 24 hours after the first send.
- Each org can send at most 50 invitation emails per 24-hour window, which starts at the first send. New invitations and resends both count.
- Membership audit logs have only two actions: `member_joined` and `member_removed`.
- `member_joined` is written when an invitee accepts. It records the org, the new member's user ID and email, the role, and `invited_by_email` from the invitation.
- `member_removed` records the org, the member's user ID and email, and the actor's email when there is one. Its `reason` is `removed` when an Owner or Admin removes the member, `left` when the member leaves, or `account_deleted` when the account purge removes the member. The account purge has no actor.
- Inviting, cancelling an invitation, changing an invitation's role, resending, and expiry are not recorded. All emails in audit records are copies taken when the event happens. Audit records are append-only.
- Events use the transactional outbox in `public.outbox`, with columns `event_id`, `type`, `payload`, and `created_at`. The `type` is `audit` or `email`. The action or email template is in the JSONB `payload`. The Outbox Relay publishes rows to Kafka and deletes them. The Kafka topics are `keysy.audit` and `keysy.email`.
- The inviter does not get an email when the invitee joins.

### Why accept

- An accept step stops an unwanted add from showing the invitee's name to another org, putting unknown orgs in their switcher, or letting a wrong-org CLI pull inject environment variables.
- GitHub, Vercel, and Supabase require acceptance. GitHub also limits org invitations to 50 in 24 hours.

### Tasks

- [ ] API: draft the invitation endpoints, then add them to `openapi/api.yaml`. Keep `GET /v0/orgs/{orgId}/members` unchanged and list pending and expired invitations with a separate `GET /v0/orgs/{orgId}/invitations`, as GitHub, GitLab, Auth0, and Clerk do. The list endpoint is done (#199); invite, resend, cancel, change role, the invitee's view, and accept remain.
- [x] Database: in a migration, add the invitations table with one invitation per email per org, the two invitation-window columns on `orgs`, and a `pg_cron` job that deletes invitations 37 days after their current 7-day period starts (#196).
- [ ] Database: add `invited_by_email` to `invitations` in a migration and update the implemented schema diagram.
- [ ] Audit: write `member_joined` in the accept transaction and `member_removed` in the remove-member and leave transactions and in the account purge, as outbox rows with type `audit`.
- [ ] Auth: accept a relative `return_to` path on `/v0/auth/google`, keep it in the sealed OAuth transaction cookie, and redirect to it after the callback, so an invitee returns to the **Join {org}** page after Google sign-in. Reject absolute and protocol-relative URLs. Today the callback always redirects to the dashboard root.
- [ ] Figma: add the **Join {org}** page. The invitation list, menu, and dialogs are in the People · Invitations section.
- [ ] Tests (account deletion, #193): inviting the email of a member scheduled for deletion fails with the existing-member error; accepting during the grace period returns 403 `ACCOUNT_DELETING`; the same invitation can be accepted after cancelling the deletion; after the purge, the same Google account signs in as a new user and joins an org.
- [ ] Email: in the invite and resend transactions, write an outbox row with type `email` and template `invitation`; `notify` consumes the `keysy.email` topic and sends it through Resend (see `wiki/notify/overview.mdx`).
