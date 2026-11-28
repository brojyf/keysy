-- The inviter's email, copied from their profile when an invitation is created
-- or an expired invitation is renewed. Resending does not change it. It is an
-- email, not a user ID, so it remains after the inviter's account is deleted.
-- No invitations exist yet, because the create endpoint ships with this column.
alter table public.invitations add column invited_by_email text not null;
