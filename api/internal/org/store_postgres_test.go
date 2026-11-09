package org

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestStoreDeletePostgres(t *testing.T) {
	databaseURL := os.Getenv("KEYSY_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("KEYSY_TEST_DATABASE_URL must point to an empty, isolated PostgreSQL test database")
	}
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	connection, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	connection.SetMaxOpenConns(8)
	if err := db.Exec(`CREATE TABLE public.orgs (id uuid PRIMARY KEY, deleted_at timestamptz);
		CREATE TABLE public.members (org_id uuid REFERENCES public.orgs(id), user_id text, role text, PRIMARY KEY (org_id, user_id));
		CREATE TABLE public.org_deletion_writes (org_id uuid);
		CREATE FUNCTION public.record_org_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN INSERT INTO public.org_deletion_writes VALUES (NEW.id); RETURN NEW; END $$;
		CREATE TRIGGER record_org_deletion AFTER UPDATE ON public.orgs FOR EACH ROW EXECUTE FUNCTION public.record_org_deletion()`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP TABLE public.members, public.org_deletion_writes, public.orgs; DROP FUNCTION public.record_org_deletion()`).Error; err != nil {
			t.Error(err)
		}
	})
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	for _, tc := range []struct {
		name, orgID string
		requests    int
	}{
		{"sequential retries", "20000000-0000-0000-0000-000000000001", 1},
		{"concurrent retries", "20000000-0000-0000-0000-000000000002", 8},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := db.Exec(`INSERT INTO public.orgs (id) VALUES (?)`, tc.orgID).Error; err != nil {
				t.Fatal(err)
			}
			if err := db.Exec(`INSERT INTO public.members (org_id, user_id, role) VALUES (?, 'owner', 'owner'), (?, 'admin', 'admin'), (?, 'developer', 'developer')`, tc.orgID, tc.orgID, tc.orgID).Error; err != nil {
				t.Fatal(err)
			}
			for _, userID := range []string{"admin", "developer", "stranger"} {
				if completed, err := store.Delete(ctx, userID, tc.orgID); err != nil || completed {
					t.Fatalf("unauthorized active deletion: user=%s completed=%v err=%v", userID, completed, err)
				}
			}
			var unauthorizedDeletions int64
			if err := db.Table("public.orgs").Where("id = ? AND deleted_at IS NOT NULL", tc.orgID).Count(&unauthorizedDeletions).Error; err != nil || unauthorizedDeletions != 0 {
				t.Fatalf("unauthorized deletion changed the org: deleted=%d err=%v", unauthorizedDeletions, err)
			}
			start := make(chan struct{})
			var requests sync.WaitGroup
			for range tc.requests {
				requests.Go(func() {
					<-start
					if completed, err := store.Delete(ctx, "owner", tc.orgID); err != nil || !completed {
						t.Errorf("deletion: completed=%v err=%v", completed, err)
					}
				})
			}
			close(start)
			requests.Wait()
			var deletedAt time.Time
			if err := db.Raw(`SELECT deleted_at FROM public.orgs WHERE id = ?`, tc.orgID).Scan(&deletedAt).Error; err != nil || deletedAt.IsZero() {
				t.Fatalf("deleted_at=%v err=%v", deletedAt, err)
			}
			if completed, err := store.Delete(ctx, "owner", tc.orgID); err != nil || !completed {
				t.Fatalf("retry: completed=%v err=%v", completed, err)
			}
			var afterRetry time.Time
			if err := db.Raw(`SELECT deleted_at FROM public.orgs WHERE id = ?`, tc.orgID).Scan(&afterRetry).Error; err != nil || !afterRetry.Equal(deletedAt) {
				t.Fatalf("retry changed deleted_at: before=%v after=%v err=%v", deletedAt, afterRetry, err)
			}
			var writes, memberships int64
			if err := db.Table("public.org_deletion_writes").Where("org_id = ?", tc.orgID).Count(&writes).Error; err != nil || writes != 1 {
				t.Fatalf("deletion writes=%d err=%v", writes, err)
			}
			if err := db.Table("public.members").Where("org_id = ?", tc.orgID).Count(&memberships).Error; err != nil || memberships != 3 {
				t.Fatalf("memberships=%d err=%v", memberships, err)
			}
			for _, userID := range []string{"admin", "developer", "stranger"} {
				if completed, err := store.Delete(ctx, userID, tc.orgID); err != nil || completed {
					t.Fatalf("unauthorized deleted target: user=%s completed=%v err=%v", userID, completed, err)
				}
			}
		})
	}
	if completed, err := store.Delete(ctx, "owner", "20000000-0000-0000-0000-000000000003"); err != nil || completed {
		t.Fatalf("missing target: completed=%v err=%v", completed, err)
	}
}
