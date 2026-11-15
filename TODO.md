# TODO

## Member invitations

This design replaces the current model, in which an added member is active immediately and the email is only a notice. Members now join only after they accept an invitation.

### Rules

- The Owner and Admins invite by email and role. Admins can invite Admins.
- Every invitee accepts, with or without an account: email link, Google sign-in, **Join {org}**, then **Join**. A new user creates an account inside this flow.
- The email link is the only entry. The app does not list pending invitations for the invitee.
- The invitee must sign in with a Google account whose email exactly matches the invitation.
- The **Join {org}** page has only **Join**. There is no **Decline**; an ignored invitation expires.
- Every member sees pending and expired invitations, email only. The Owner and Admins can resend or cancel any invitation.
- An invitation expires 7 days after it is created. Resending a pending invitation does not extend it.
- Expired invitations stay in the list as **Expired**. Resending an expired invitation restarts its 7 days.
- A daily job deletes invitations 37 days after they are created.
- An email can have only one pending invitation per org. Inviting a member or an email with a pending invitation fails.
- Each invitation can be resent once every 24 hours. The first send is not a resend.
- Each org can send at most 50 invitation emails per 24-hour window, which starts at the first send. New invitations and resends both count.
- Audit logs record only these events: invited, invitation cancelled, and joined. Resends and expiry are not recorded.
- The inviter does not get an email when the invitee joins.

### Why accept

- An accept step stops an unwanted add from showing the invitee's name to another org, putting unknown orgs in their switcher, or letting a wrong-org CLI pull inject environment variables.
- GitHub, Vercel, and Supabase require acceptance. GitHub also limits org invitations to 50 in 24 hours and records the same three audit events.

### Tasks

- [ ] PRD: change "add Developers" to "invite Admins and Developers" in `wiki/prd.mdx`, and state that invitees join only after they accept an invitation that expires after 7 days.
- [ ] API: draft the invitation endpoints, then add them to `openapi/api.yaml`.
- [ ] Database: in a migration, add the invitations table with one invitation per email per org, the two invitation-window columns on `orgs`, and a `pg_cron` job that deletes invitations 37 days after they are created.
- [ ] Auth: accept a relative `return_to` path on `/v0/auth/google`, keep it in the sealed OAuth transaction cookie, and redirect to it after the callback, so an invitee returns to the **Join {org}** page after Google sign-in. Reject absolute and protocol-relative URLs. Today the callback always redirects to the dashboard root.
- [ ] Figma: update review section 612:11265 for pending invitations and add the **Join {org}** page.
- [ ] Email: add the invitation email.
