-- Supabase Auth does not change auth.users.email on Google sign-in,
-- so profiles.email is written only at insert.
drop trigger sync_profile_email_after_user_update on auth.users;
drop function public.sync_profile_email();
