# TODO

## Member invitations

This design replaces the current model, in which an added member is active immediately and the email is only a notice. Members now join only after they accept an invitation.

### Rules

- The Owner and Admins invite by email and role. Admins can invite Admins.
- Every invitee accepts, with or without an account: email link, Google sign-in, **Join {org}**, then **Join**. A new user creates an account inside this flow.
- The email link is the only entry for now. An in-app notification entry is tracked in #189.
- The invitee must sign in with a Google account whose email matches the invitation, ignoring case. Emails are stored in lowercase.
- If the signed-in email does not match a valid invitation, the page shows the signed-in email and a **Sign out** button, and asks the invitee to sign in with the email that received the invitation. It never shows the invited email; the API returns only whether the emails match.
- The **Join {org}** page has only **Join**. There is no **Decline**; an ignored invitation expires.
- A link to a cancelled, expired, or deleted invitation shows **Invalid invitation**.
- Every member sees pending and expired invitations, email only. The Owner and Admins can resend or cancel any invitation, and change the role of a pending or expired invitation (GitHub allows this too).
- An invitation expires 7 days after it is created. Resending a pending invitation does not extend it.
- Expired invitations stay in the list as **Expired**. Resending or re-inviting an expired invitation restarts its 7 days.
- A daily job deletes invitations 37 days after their current 7-day period starts.
- Deleting an org deletes all its invitations through the foreign key cascade. Org deletion becomes a hard delete in a separate change.
- An email can have only one invitation per org. Inviting a member or an email with a pending invitation fails. Inviting an email with an expired invitation updates that invitation, including its role.
- Each invitation can be resent once every 24 hours, expired or not. The first resend is possible 24 hours after the first send.
- Each org can send at most 50 invitation emails per 24-hour window, which starts at the first send. New invitations and resends both count.
- Audit logs record only these events: invited, invitation cancelled, invitation role changed (old and new role), and joined. Audit records are append-only: a role change adds a record and never updates the invited one. Resends and expiry are not recorded.
- The inviter does not get an email when the invitee joins.

### Why accept

- An accept step stops an unwanted add from showing the invitee's name to another org, putting unknown orgs in their switcher, or letting a wrong-org CLI pull inject environment variables.
- GitHub, Vercel, and Supabase require acceptance. GitHub also limits org invitations to 50 in 24 hours and records invites, cancellations, and joins as separate audit events.

### Tasks

- [ ] PRD: change "add Developers" to "invite Admins and Developers" in `wiki/prd.mdx`, and state that invitees join only after they accept an invitation that expires after 7 days.
- [ ] API: draft the invitation endpoints, then add them to `openapi/api.yaml`. Keep `GET /v0/orgs/{orgId}/members` unchanged and list pending and expired invitations with a separate `GET /v0/orgs/{orgId}/invitations`, as GitHub, GitLab, Auth0, and Clerk do.
- [ ] Database: in a migration, add the invitations table with one invitation per email per org, the two invitation-window columns on `orgs`, and a `pg_cron` job that deletes invitations 37 days after their current 7-day period starts (#196).
- [ ] Auth: accept a relative `return_to` path on `/v0/auth/google`, keep it in the sealed OAuth transaction cookie, and redirect to it after the callback, so an invitee returns to the **Join {org}** page after Google sign-in. Reject absolute and protocol-relative URLs. Today the callback always redirects to the dashboard root.
- [ ] Figma: add the **Join {org}** page. The invitation list, menu, and dialogs are in section 11 · People (11.10–11.16).
- [ ] Email: send the invitation email from `email-worker/` (Cloudflare Worker and Resend, see `wiki/tech-stack.mdx`).
