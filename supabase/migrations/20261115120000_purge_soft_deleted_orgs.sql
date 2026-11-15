-- Org deletion becomes a hard delete. Remove orgs that were already soft-deleted;
-- the existing cascade removes their memberships. orgs.deleted_at is dropped later.
delete from public.orgs where deleted_at is not null;
