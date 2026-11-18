package member

import (
	"context"
	"errors"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/brojyf/keysy/api/internal/org"
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
		CREATE TABLE public.members (org_id text REFERENCES public.orgs(id) ON DELETE CASCADE, user_id text REFERENCES public.profiles(id), role text, PRIMARY KEY (org_id, user_id));
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
	// overlap holds the lock on lockedUserID's row, which every removal locks first,
	// until all removals wait for it, so the removals always run at the same time.
	overlap := func(t *testing.T, lockedUserID string, removals ...func() error) []error {
		t.Helper()
		blocker := db.Begin()
		if err := blocker.Exec("SELECT 1 FROM public.members WHERE org_id = 'org' AND user_id = ? FOR UPDATE", lockedUserID).Error; err != nil {
			blocker.Rollback()
			t.Fatal(err)
		}
		results := make([]error, len(removals))
		var wg sync.WaitGroup
		for i, remove := range removals {
			wg.Add(1)
			go func() { defer wg.Done(); results[i] = remove() }()
		}
		for deadline := time.Now().Add(5 * time.Second); ; time.Sleep(10 * time.Millisecond) {
			var waiting int
			if err := db.Raw("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'").Scan(&waiting).Error; err != nil {
				blocker.Rollback()
				t.Fatal(err)
			}
			if waiting >= len(removals) {
				break
			}
			if time.Now().After(deadline) {
				blocker.Rollback()
				wg.Wait()
				t.Fatalf("only %d of %d removals waited for the lock", waiting, len(removals))
			}
		}
		if err := blocker.Commit().Error; err != nil {
			t.Fatal(err)
		}
		wg.Wait()
		return results
	}
	t.Run("concurrent removal", func(t *testing.T) {
		reset(t)
		remove := func() error { return store.Remove(ctx, "owner", "org", "dev") }
		results := overlap(t, "dev", remove, remove)
		if !((results[0] == nil && errors.Is(results[1], ErrMemberNotFound)) || (results[1] == nil && errors.Is(results[0], ErrMemberNotFound))) {
			t.Fatalf("results: %v, %v", results[0], results[1])
		}
	})
	// Each request locks its caller's row and the other's row. Without one lock order, they can deadlock.
	t.Run("owner and admin remove each other at the same time", func(t *testing.T) {
		reset(t)
		results := overlap(t, "admin",
			func() error { return store.Remove(ctx, "owner", "org", "admin") },
			func() error { return store.Remove(ctx, "admin", "org", "owner") },
		)
		if results[0] != nil {
			t.Fatalf("owner removes admin: %v", results[0])
		}
		// The admin's request is forbidden if it runs first, or finds no caller row if it runs second.
		if !errors.Is(results[1], ErrRemoveForbidden) && !errors.Is(results[1], ErrOrgNotFound) {
			t.Fatalf("admin removes owner: %v", results[1])
		}
		var remaining []string
		if err := db.Table("public.members").Where("org_id = 'org' AND user_id IN ('owner', 'admin')").Pluck("user_id", &remaining).Error; err != nil || !slices.Equal(remaining, []string{"owner"}) {
			t.Fatalf("remaining=%v err=%v", remaining, err)
		}
	})
	// Org deletion cascades to member rows in its own order. Removal locks member rows in user_id order.
	// The org deletion queues for "owner" first, then the removal locks "dev" and queues behind it.
	t.Run("org deletion and member removal at the same time", func(t *testing.T) {
		reset(t)
		blocker := db.Begin()
		if err := blocker.Exec("SELECT 1 FROM public.members WHERE org_id = 'org' AND user_id = 'owner' FOR UPDATE").Error; err != nil {
			blocker.Rollback()
			t.Fatal(err)
		}
		waitForLockWaiters := func(want int) {
			for deadline := time.Now().Add(5 * time.Second); ; time.Sleep(10 * time.Millisecond) {
				var waiting int
				if err := db.Raw("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'").Scan(&waiting).Error; err != nil {
					blocker.Rollback()
					t.Fatal(err)
				}
				if waiting >= want {
					return
				}
				if time.Now().After(deadline) {
					blocker.Rollback()
					t.Fatalf("only %d of %d requests waited for a lock", waiting, want)
				}
			}
		}
		var deleted bool
		var deleteErr, removeErr error
		var wg sync.WaitGroup
		wg.Add(2)
		go func() { defer wg.Done(); deleted, deleteErr = org.Store{DB: db}.Delete(ctx, "owner", "org") }()
		waitForLockWaiters(1)
		go func() { defer wg.Done(); removeErr = store.Remove(ctx, "owner", "org", "dev") }()
		waitForLockWaiters(2)
		if err := blocker.Commit().Error; err != nil {
			t.Fatal(err)
		}
		wg.Wait()
		if !deleted || deleteErr != nil {
			t.Fatalf("delete org: deleted=%v err=%v", deleted, deleteErr)
		}
		if !errors.Is(removeErr, ErrOrgNotFound) {
			t.Fatalf("remove member: %v", removeErr)
		}
		if err := db.Exec("INSERT INTO public.orgs VALUES ('org')").Error; err != nil {
			t.Fatal(err)
		}
	})
}

func TestStoreLeavePostgres(t *testing.T) {
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
		CREATE TABLE public.members (org_id text REFERENCES public.orgs(id) ON DELETE CASCADE, user_id text REFERENCES public.profiles(id), role text, PRIMARY KEY (org_id, user_id));
		INSERT INTO public.orgs VALUES ('org'), ('other');
		INSERT INTO public.profiles VALUES ('owner', NULL), ('admin', NULL), ('dev', NULL), ('deleting', now()), ('outsider', NULL);
		INSERT INTO public.members VALUES ('org', 'owner', 'owner'), ('org', 'admin', 'admin'), ('org', 'dev', 'developer'), ('org', 'deleting', 'developer'), ('other', 'outsider', 'owner')`).Error; err != nil {
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
	for _, tc := range []struct {
		name, caller, org string
		want              error
		remaining         int64
	}{
		{"developer", "dev", "org", nil, 0},
		{"repeat", "dev", "org", ErrOrgNotFound, 0},
		{"admin", "admin", "org", nil, 0},
		{"owner", "owner", "org", ErrOwnerCannotLeave, 1},
		{"nonmember", "outsider", "org", ErrOrgNotFound, 0},
		{"missing org", "owner", "missing", ErrOrgNotFound, 0},
		{"deleting caller", "deleting", "org", ErrOrgNotFound, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := store.Leave(ctx, tc.caller, tc.org); !errors.Is(got, tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
			var count int64
			if err := db.Table("public.members").Where("org_id = ? AND user_id = ?", tc.org, tc.caller).Count(&count).Error; err != nil || count != tc.remaining {
				t.Fatalf("membership count=%d err=%v", count, err)
			}
		})
	}
	var remaining []string
	if err := db.Table("public.members").Order("org_id, user_id").Pluck("user_id", &remaining).Error; err != nil || !slices.Equal(remaining, []string{"deleting", "owner", "outsider"}) {
		t.Fatalf("remaining=%v err=%v", remaining, err)
	}
}
