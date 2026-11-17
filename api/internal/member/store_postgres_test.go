package member

import (
	"context"
	"errors"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestStoreListPostgres(t *testing.T) {
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
	if err := db.Exec(`CREATE TABLE public.orgs (id uuid PRIMARY KEY);
		CREATE TABLE public.members (org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE, user_id text, role text, PRIMARY KEY (org_id, user_id));
		CREATE TABLE public.profiles (id text PRIMARY KEY, display_name text, email text, deleted_at timestamptz);
		INSERT INTO public.orgs (id) VALUES
			('20000000-0000-0000-0000-000000000001'),
			('20000000-0000-0000-0000-000000000002');
		INSERT INTO public.profiles (id, display_name, email, deleted_at) VALUES
			('ada', 'Ada', 'ada@example.com', NULL),
			('grace', 'Grace', 'grace@example.com', NULL),
			('gone', 'Gone', 'gone@example.com', now()),
			('linus', 'Linus', 'linus@example.com', NULL);
		INSERT INTO public.members (org_id, user_id, role) VALUES
			('20000000-0000-0000-0000-000000000001', 'ada', 'owner'),
			('20000000-0000-0000-0000-000000000001', 'grace', 'developer'),
			('20000000-0000-0000-0000-000000000001', 'gone', 'admin'),
			('20000000-0000-0000-0000-000000000002', 'linus', 'owner')`).Error; err != nil {
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
		{UserID: "gone", Name: "Gone", Email: "gone@example.com", Role: "admin", Deleting: true},
		{UserID: "grace", Name: "Grace", Email: "grace@example.com", Role: "developer"},
	}
	for _, userID := range []string{"ada", "grace"} {
		got, err := store.List(ctx, userID, "20000000-0000-0000-0000-000000000001")
		slices.SortFunc(got, byUserID)
		if err != nil || !slices.Equal(got, want) {
			t.Fatalf("member %s: got=%v err=%v", userID, got, err)
		}
	}
	for _, tc := range []struct{ name, userID, orgID string }{
		{"not a member", "linus", "20000000-0000-0000-0000-000000000001"},
		{"deleted caller", "gone", "20000000-0000-0000-0000-000000000001"},
		{"missing org", "ada", "20000000-0000-0000-0000-000000000009"},
	} {
		got, err := store.List(ctx, tc.userID, tc.orgID)
		if err != nil || got == nil || len(got) != 0 {
			t.Fatalf("%s: got=%v err=%v", tc.name, got, err)
		}
	}
}

func TestStoreRemovePostgres(t *testing.T) {
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
	if err := db.Exec(`CREATE TABLE public.orgs (id text PRIMARY KEY);
		CREATE TABLE public.profiles (id text PRIMARY KEY, deleted_at timestamptz);
		CREATE TABLE public.members (org_id text REFERENCES public.orgs(id), user_id text REFERENCES public.profiles(id), role text, PRIMARY KEY (org_id, user_id));
		INSERT INTO public.orgs VALUES ('org'), ('other');
		INSERT INTO public.profiles VALUES ('owner', NULL), ('admin', NULL), ('admin2', NULL), ('dev', NULL), ('dev2', NULL), ('deleting', now()), ('other', NULL);
		INSERT INTO public.members VALUES ('other', 'other', 'owner'), ('other', 'dev', 'developer')`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP TABLE public.members, public.profiles, public.orgs`).Error; err != nil {
			t.Error(err)
		}
	})
	reset := func(t *testing.T) {
		t.Helper()
		if err := db.Exec(`DELETE FROM public.members WHERE org_id = 'org';
			INSERT INTO public.members VALUES ('org', 'owner', 'owner'), ('org', 'admin', 'admin'), ('org', 'admin2', 'admin'), ('org', 'dev', 'developer'), ('org', 'dev2', 'developer'), ('org', 'deleting', 'developer')`).Error; err != nil {
			t.Fatal(err)
		}
	}
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	for _, tc := range []struct {
		name, caller, org, target string
		want                      error
	}{
		{"owner removes admin", "owner", "org", "admin", nil},
		{"owner removes developer", "owner", "org", "dev", nil},
		{"owner removes deleting developer", "owner", "org", "deleting", nil},
		{"admin removes developer", "admin", "org", "dev", nil},
		{"admin cannot remove admin", "admin", "org", "admin2", ErrRemoveForbidden},
		{"admin cannot remove owner", "admin", "org", "owner", ErrRemoveForbidden},
		{"developer cannot remove developer", "dev", "org", "dev2", ErrRemoveForbidden},
		{"owner cannot remove self", "owner", "org", "owner", ErrRemoveForbidden},
		{"developer cannot remove self", "dev", "org", "dev", ErrRemoveForbidden},
		{"missing target", "owner", "org", "other", ErrMemberNotFound},
		{"nonmember caller", "other", "org", "dev", ErrOrgNotFound},
		{"deleting caller", "deleting", "org", "dev", ErrOrgNotFound},
		{"missing org", "owner", "missing", "dev", ErrOrgNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reset(t)
			if got := store.Remove(ctx, tc.caller, tc.org, tc.target); !errors.Is(got, tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
			if tc.want == nil {
				if got := store.Remove(ctx, tc.caller, tc.org, tc.target); !errors.Is(got, ErrMemberNotFound) {
					t.Fatalf("repeat: %v", got)
				}
			} else if errors.Is(tc.want, ErrRemoveForbidden) {
				var count int64
				if err := db.Table("public.members").Where("org_id = ? AND user_id = ?", tc.org, tc.target).Count(&count).Error; err != nil || count != 1 {
					t.Fatalf("forbidden target count=%d err=%v", count, err)
				}
			}
			var count int64
			if err := db.Table("public.members").Where("org_id = ?", "other").Count(&count).Error; err != nil || count != 2 {
				t.Fatalf("other org count=%d err=%v", count, err)
			}
		})
	}
	t.Run("concurrent removal", func(t *testing.T) {
		reset(t)
		start := make(chan struct{})
		results := make(chan error, 2)
		for i := 0; i < 2; i++ {
			go func() { <-start; results <- store.Remove(ctx, "owner", "org", "dev") }()
		}
		close(start)
		first, second := <-results, <-results
		if !((first == nil && errors.Is(second, ErrMemberNotFound)) || (second == nil && errors.Is(first, ErrMemberNotFound))) {
			t.Fatalf("results: %v, %v", first, second)
		}
	})
}
