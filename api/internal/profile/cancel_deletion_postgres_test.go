package profile_test

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/org"
	"github.com/brojyf/keysy/api/internal/profile"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestCancelDeletionPostgres(t *testing.T) {
	url := os.Getenv("KEYSY_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("KEYSY_TEST_DATABASE_URL must point to an empty, isolated PostgreSQL test database")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	conn, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if err := db.Exec(`CREATE SCHEMA auth;
 CREATE TABLE auth.sessions (id uuid primary key, user_id uuid not null);
 CREATE TABLE public.profiles (id uuid primary key, email text, display_name text, deleted_at timestamptz);
 CREATE TABLE public.orgs (id uuid primary key default gen_random_uuid(), name text);
 CREATE TABLE public.members (org_id uuid references public.orgs(id), user_id uuid, role text);
 CREATE TABLE public.outbox (event_id uuid primary key default gen_random_uuid(), type text not null, payload jsonb not null, created_at timestamptz not null default now());
 CREATE FUNCTION public.revoke_all_user_sessions(target_user_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ DELETE FROM auth.sessions AS sessions WHERE sessions.user_id = target_user_id; $$;
 INSERT INTO public.profiles (id) VALUES ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002');
 INSERT INTO public.profiles (id, deleted_at) VALUES ('10000000-0000-0000-0000-000000000003', '2026-01-02T03:04:05Z');`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP FUNCTION public.revoke_all_user_sessions(uuid); DROP TABLE public.outbox, public.members, public.orgs, public.profiles, auth.sessions; DROP SCHEMA auth`).Error; err != nil {
			t.Error(err)
		}
	})
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	deletion := profile.Store{DB: db}
	orgs := org.Store{DB: db}
	const user = "10000000-0000-0000-0000-000000000001"
	const other = "10000000-0000-0000-0000-000000000003"
	if err := deletion.ScheduleDeletion(ctx, user); err != nil {
		t.Fatal(err)
	}
	if _, err := orgs.Create(ctx, user, "Before cancellation"); !errors.Is(err, org.ErrAccountDeleting) {
		t.Fatalf("create during deletion: %v", err)
	}
	if err := deletion.CancelDeletion(ctx, user); err != nil {
		t.Fatal(err)
	}
	var deletedAt sql.NullTime
	if err := db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", user).Scan(&deletedAt).Error; err != nil || deletedAt.Valid {
		t.Fatalf("deleted_at=%v err=%v", deletedAt, err)
	}
	if _, err := orgs.Create(ctx, user, "After cancellation"); err != nil {
		t.Fatalf("create after cancellation: %v", err)
	}
	// A second cancel must not write the row, so a later cancellation event fires once.
	var xminBefore, xminAfter string
	if err := db.Raw("SELECT xmin::text FROM public.profiles WHERE id = ?", user).Scan(&xminBefore).Error; err != nil {
		t.Fatal(err)
	}
	if err := deletion.CancelDeletion(ctx, user); err != nil {
		t.Fatalf("cancel active profile: %v", err)
	}
	if err := db.Raw("SELECT xmin::text FROM public.profiles WHERE id = ?", user).Scan(&xminAfter).Error; err != nil || xminAfter != xminBefore {
		t.Fatalf("active profile rewritten: xmin %s -> %s err=%v", xminBefore, xminAfter, err)
	}
	var activeDeletedAt sql.NullTime
	if err := db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", user).Scan(&activeDeletedAt).Error; err != nil || activeDeletedAt.Valid {
		t.Fatalf("active deleted_at=%v err=%v", activeDeletedAt, err)
	}
	var otherDeletedAt time.Time
	if err := db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", other).Scan(&otherDeletedAt).Error; err != nil || !otherDeletedAt.Equal(time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)) {
		t.Fatalf("other deleted_at=%v err=%v", otherDeletedAt, err)
	}
	// A purged account has no profile row; cancelling must not report success.
	if err := deletion.CancelDeletion(ctx, "10000000-0000-0000-0000-000000000009"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("cancel purged profile: %v", err)
	}
}
