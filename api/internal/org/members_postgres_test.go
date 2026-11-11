package org

import (
	"context"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestStoreMembersPostgres(t *testing.T) {
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
	if err := db.Exec(`CREATE TABLE public.orgs (id uuid PRIMARY KEY, deleted_at timestamptz);
		CREATE TABLE public.members (org_id uuid REFERENCES public.orgs(id), user_id text, role text, PRIMARY KEY (org_id, user_id));
		CREATE TABLE public.profiles (id text PRIMARY KEY, display_name text, email text, deleted_at timestamptz);
		INSERT INTO public.orgs (id, deleted_at) VALUES
			('20000000-0000-0000-0000-000000000001', NULL),
			('20000000-0000-0000-0000-000000000002', NULL),
			('20000000-0000-0000-0000-000000000003', now());
		INSERT INTO public.profiles (id, display_name, email, deleted_at) VALUES
			('ada', 'Ada', 'ada@example.com', NULL),
			('grace', 'Grace', 'grace@example.com', NULL),
			('gone', 'Gone', 'gone@example.com', now()),
			('linus', 'Linus', 'linus@example.com', NULL);
		INSERT INTO public.members (org_id, user_id, role) VALUES
			('20000000-0000-0000-0000-000000000001', 'ada', 'owner'),
			('20000000-0000-0000-0000-000000000001', 'grace', 'developer'),
			('20000000-0000-0000-0000-000000000001', 'gone', 'admin'),
			('20000000-0000-0000-0000-000000000002', 'linus', 'owner'),
			('20000000-0000-0000-0000-000000000003', 'ada', 'owner')`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP TABLE public.members, public.profiles, public.orgs`).Error; err != nil {
			t.Error(err)
		}
	})
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	byUserID := func(a, b Member) int { return strings.Compare(a.UserID, b.UserID) }
	want := []Member{
		{UserID: "ada", Name: "Ada", Email: "ada@example.com", Role: "owner"},
		{UserID: "grace", Name: "Grace", Email: "grace@example.com", Role: "developer"},
	}
	for _, userID := range []string{"ada", "grace"} {
		got, err := store.Members(ctx, userID, "20000000-0000-0000-0000-000000000001")
		slices.SortFunc(got, byUserID)
		if err != nil || !slices.Equal(got, want) {
			t.Fatalf("member %s: got=%v err=%v", userID, got, err)
		}
	}
	for _, tc := range []struct{ name, userID, orgID string }{
		{"not a member", "linus", "20000000-0000-0000-0000-000000000001"},
		{"deleted org", "ada", "20000000-0000-0000-0000-000000000003"},
		{"missing org", "ada", "20000000-0000-0000-0000-000000000009"},
	} {
		got, err := store.Members(ctx, tc.userID, tc.orgID)
		if err != nil || got == nil || len(got) != 0 {
			t.Fatalf("%s: got=%v err=%v", tc.name, got, err)
		}
	}
}
