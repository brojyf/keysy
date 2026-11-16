package profile_test

import (
	"context"
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

func TestDeletionAndOrgCreationPostgres(t *testing.T) {
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
	conn.SetMaxOpenConns(8)
	if err := db.Exec(`CREATE SCHEMA auth;
 CREATE TABLE auth.sessions (id uuid primary key, user_id uuid not null);
 CREATE TABLE public.profiles (id uuid primary key, deleted_at timestamptz);
 CREATE TABLE public.orgs (id uuid primary key default gen_random_uuid(), name text);
 CREATE TABLE public.members (org_id uuid references public.orgs(id), user_id uuid, role text);
 CREATE FUNCTION public.revoke_all_user_sessions(target_user_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ DELETE FROM auth.sessions AS sessions WHERE sessions.user_id = target_user_id; $$;
 INSERT INTO public.profiles (id) VALUES ('10000000-0000-0000-0000-000000000001'), ('10000000-0000-0000-0000-000000000002'), ('10000000-0000-0000-0000-000000000003'), ('10000000-0000-0000-0000-000000000004'), ('10000000-0000-0000-0000-000000000005');
 INSERT INTO public.orgs (id,name) VALUES ('20000000-0000-0000-0000-000000000001','Existing');
 INSERT INTO public.members VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','developer'), ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','owner');
 INSERT INTO auth.sessions VALUES ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'), ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP FUNCTION public.revoke_all_user_sessions(uuid); DROP TABLE public.members, public.orgs, public.profiles, auth.sessions; DROP SCHEMA auth`).Error; err != nil {
			t.Error(err)
		}
	})
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	deletion := profile.Store{DB: db}
	orgs := org.Store{DB: db}
	const user = "10000000-0000-0000-0000-000000000001"
	const owner = "10000000-0000-0000-0000-000000000002"
	if err := deletion.ScheduleDeletion(ctx, user); err != nil {
		t.Fatal(err)
	}
	var first time.Time
	if err := db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", user).Scan(&first).Error; err != nil || first.IsZero() {
		t.Fatalf("deleted_at=%v err=%v", first, err)
	}
	if err := db.Exec("INSERT INTO auth.sessions VALUES ('30000000-0000-0000-0000-000000000003', ?)", user).Error; err != nil {
		t.Fatal(err)
	}
	if err := deletion.ScheduleDeletion(ctx, user); err != nil {
		t.Fatal(err)
	}
	var second time.Time
	db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", user).Scan(&second)
	if !first.Equal(second) {
		t.Fatalf("deletion time changed: %v %v", first, second)
	}
	if err := deletion.ScheduleDeletion(ctx, owner); !errors.Is(err, profile.ErrOrgOwner) {
		t.Fatalf("owner: %v", err)
	}
	var n int64
	for _, q := range []struct {
		sql  string
		want int64
	}{
		{"SELECT count(*) FROM auth.sessions WHERE user_id = '" + user + "'", 0},
		{"SELECT count(*) FROM auth.sessions WHERE user_id = '" + owner + "'", 1},
		{"SELECT count(*) FROM public.profiles WHERE id = '" + owner + "' AND deleted_at IS NULL", 1},
		{"SELECT count(*) FROM public.members", 2},
	} {
		if err := db.Raw(q.sql).Scan(&n).Error; err != nil || n != q.want {
			t.Fatalf("%s: %d err=%v", q.sql, n, err)
		}
	}
	if _, err := orgs.Create(ctx, user, "Denied"); !errors.Is(err, org.ErrAccountDeleting) {
		t.Fatalf("deleting create: %v", err)
	}
	if err := db.Raw("SELECT count(*) FROM public.orgs").Scan(&n).Error; err != nil || n != 1 {
		t.Fatalf("org count=%d err=%v", n, err)
	}
	if err := db.Raw("SELECT count(*) FROM public.members").Scan(&n).Error; err != nil || n != 2 {
		t.Fatalf("member count=%d err=%v", n, err)
	}
	for _, tc := range []struct {
		name, id    string
		deleteFirst bool
	}{
		{"deletion first", "10000000-0000-0000-0000-000000000003", true},
		{"creation first", "10000000-0000-0000-0000-000000000004", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tx := db.WithContext(ctx).Begin()
			if tx.Error != nil {
				t.Fatal(tx.Error)
			}
			defer tx.Rollback()
			if tc.deleteFirst {
				if err := (profile.Store{DB: tx}).ScheduleDeletion(ctx, tc.id); err != nil {
					t.Fatal(err)
				}
			} else {
				if _, err := (org.Store{DB: tx}).Create(ctx, tc.id, "Concurrent"); err != nil {
					t.Fatal(err)
				}
			}
			result := make(chan error, 1)
			go func() {
				if tc.deleteFirst {
					_, err := orgs.Create(ctx, tc.id, "Concurrent")
					result <- err
				} else {
					result <- deletion.ScheduleDeletion(ctx, tc.id)
				}
			}()
			select {
			case err := <-result:
				t.Fatalf("operation did not block: %v", err)
			case <-time.After(200 * time.Millisecond):
			}
			if err := tx.Commit().Error; err != nil {
				t.Fatal(err)
			}
			select {
			case err := <-result:
				if tc.deleteFirst && !errors.Is(err, org.ErrAccountDeleting) {
					t.Fatalf("create: %v", err)
				}
				if !tc.deleteFirst && !errors.Is(err, profile.ErrOrgOwner) {
					t.Fatalf("delete: %v", err)
				}
			case <-ctx.Done():
				t.Fatal(ctx.Err())
			}
		})
	}
	if err := db.Raw("SELECT count(*) FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000005' AND deleted_at IS NULL").Scan(&n).Error; err != nil || n != 1 {
		t.Fatalf("other profile=%d err=%v", n, err)
	}
}
