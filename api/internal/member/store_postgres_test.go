package member

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/org"
	"github.com/brojyf/keysy/api/internal/pgtest"
)

// User IDs sort in the same order as their names, because removals lock member rows in user_id order.
const (
	orgID      = "20000000-0000-0000-0000-000000000001"
	otherOrgID = "20000000-0000-0000-0000-000000000002"
	missingOrg = "20000000-0000-0000-0000-000000000009"
	adminID    = "10000000-0000-0000-0000-000000000001"
	admin2ID   = "10000000-0000-0000-0000-000000000002"
	deletingID = "10000000-0000-0000-0000-000000000003"
	devID      = "10000000-0000-0000-0000-000000000004"
	dev2ID     = "10000000-0000-0000-0000-000000000005"
	otherID    = "10000000-0000-0000-0000-000000000006"
	ownerID    = "10000000-0000-0000-0000-000000000007"
	outsiderID = "10000000-0000-0000-0000-000000000008"
)

func TestStoreListPostgres(t *testing.T) {
	db := pgtest.Open(t)
	const (
		ada   = "10000000-0000-0000-0000-000000000001"
		gone  = "10000000-0000-0000-0000-000000000002"
		grace = "10000000-0000-0000-0000-000000000003"
		linus = "10000000-0000-0000-0000-000000000004"
	)
	if err := db.Exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
			('10000000-0000-0000-0000-000000000001', 'ada@example.com', '{"full_name": "Ada"}'),
			('10000000-0000-0000-0000-000000000002', 'gone@example.com', '{"full_name": "Gone"}'),
			('10000000-0000-0000-0000-000000000003', 'grace@example.com', '{"full_name": "Grace"}'),
			('10000000-0000-0000-0000-000000000004', 'linus@example.com', '{"full_name": "Linus"}');
		UPDATE public.profiles SET deleted_at = now() WHERE id = '10000000-0000-0000-0000-000000000002';
		INSERT INTO public.orgs (id, name) VALUES
			('20000000-0000-0000-0000-000000000001', 'Acme'),
			('20000000-0000-0000-0000-000000000002', 'Other');
		INSERT INTO public.members (org_id, user_id, role) VALUES
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'developer'),
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'admin'),
			('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'owner')`).Error; err != nil {
		t.Fatal(err)
	}
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	byUserID := func(a, b Member) int { return strings.Compare(a.UserID, b.UserID) }
	want := []Member{
		{UserID: ada, Name: "Ada", Email: "ada@example.com", Role: "owner"},
		{UserID: gone, Name: "Gone", Email: "gone@example.com", Role: "admin", Deleting: true},
		{UserID: grace, Name: "Grace", Email: "grace@example.com", Role: "developer"},
	}
	for _, userID := range []string{ada, grace} {
		got, err := store.List(ctx, userID, orgID)
		slices.SortFunc(got, byUserID)
		if err != nil || !slices.Equal(got, want) {
			t.Fatalf("member %s: got=%v err=%v", userID, got, err)
		}
	}
	for _, tc := range []struct{ name, userID, orgID string }{
		{"not a member", linus, orgID},
		{"deleted caller", gone, orgID},
		{"missing org", ada, missingOrg},
	} {
		got, err := store.List(ctx, tc.userID, tc.orgID)
		if err != nil || got == nil || len(got) != 0 {
			t.Fatalf("%s: got=%v err=%v", tc.name, got, err)
		}
	}
}

func TestStoreRemovePostgres(t *testing.T) {
	db := pgtest.Open(t)
	if err := db.Exec(`INSERT INTO auth.users (id, email) VALUES
			('10000000-0000-0000-0000-000000000001', 'admin@example.com'),
			('10000000-0000-0000-0000-000000000002', 'admin2@example.com'),
			('10000000-0000-0000-0000-000000000003', 'deleting@example.com'),
			('10000000-0000-0000-0000-000000000004', 'dev@example.com'),
			('10000000-0000-0000-0000-000000000005', 'dev2@example.com'),
			('10000000-0000-0000-0000-000000000006', 'other@example.com'),
			('10000000-0000-0000-0000-000000000007', 'owner@example.com'),
			('10000000-0000-0000-0000-000000000008', 'outsider@example.com');
		UPDATE public.profiles SET deleted_at = now() WHERE id = '10000000-0000-0000-0000-000000000003';
		INSERT INTO public.orgs (id, name) VALUES
			('20000000-0000-0000-0000-000000000001', 'Org'),
			('20000000-0000-0000-0000-000000000002', 'Other');
		INSERT INTO public.members (org_id, user_id, role) VALUES
			('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006', 'owner'),
			('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'developer')`).Error; err != nil {
		t.Fatal(err)
	}
	reset := func(t *testing.T) {
		t.Helper()
		if err := db.Exec(`DELETE FROM public.members WHERE org_id = '20000000-0000-0000-0000-000000000001';
			INSERT INTO public.members (org_id, user_id, role) VALUES
				('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'owner'),
				('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
				('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'admin'),
				('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'developer'),
				('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'developer'),
				('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'developer')`).Error; err != nil {
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
		{"owner removes admin", ownerID, orgID, adminID, nil},
		{"owner removes developer", ownerID, orgID, devID, nil},
		{"owner removes deleting developer", ownerID, orgID, deletingID, nil},
		{"admin removes developer", adminID, orgID, devID, nil},
		{"admin cannot remove admin", adminID, orgID, admin2ID, ErrRemoveForbidden},
		{"admin cannot remove owner", adminID, orgID, ownerID, ErrRemoveForbidden},
		{"developer cannot remove developer", devID, orgID, dev2ID, ErrRemoveForbidden},
		{"owner cannot remove self", ownerID, orgID, ownerID, ErrRemoveForbidden},
		{"developer cannot remove self", devID, orgID, devID, ErrRemoveForbidden},
		{"missing target", ownerID, orgID, otherID, ErrMemberNotFound},
		{"nonmember caller", otherID, orgID, devID, ErrOrgNotFound},
		{"deleting caller", deletingID, orgID, devID, ErrOrgNotFound},
		{"missing org", ownerID, missingOrg, devID, ErrOrgNotFound},
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
			if err := db.Table("public.members").Where("org_id = ?", otherOrgID).Count(&count).Error; err != nil || count != 2 {
				t.Fatalf("other org count=%d err=%v", count, err)
			}
		})
	}
	// overlap holds the lock on lockedUserID's row, which every removal locks first,
	// until all removals wait for it, so the removals always run at the same time.
	overlap := func(t *testing.T, lockedUserID string, removals ...func() error) []error {
		t.Helper()
		blocker := db.Begin()
		if err := blocker.Exec("SELECT 1 FROM public.members WHERE org_id = ? AND user_id = ? FOR UPDATE", orgID, lockedUserID).Error; err != nil {
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
		remove := func() error { return store.Remove(ctx, ownerID, orgID, devID) }
		results := overlap(t, devID, remove, remove)
		if !((results[0] == nil && errors.Is(results[1], ErrMemberNotFound)) || (results[1] == nil && errors.Is(results[0], ErrMemberNotFound))) {
			t.Fatalf("results: %v, %v", results[0], results[1])
		}
	})
	// Each request locks its caller's row and the other's row. Without one lock order, they can deadlock.
	t.Run("owner and admin remove each other at the same time", func(t *testing.T) {
		reset(t)
		results := overlap(t, adminID,
			func() error { return store.Remove(ctx, ownerID, orgID, adminID) },
			func() error { return store.Remove(ctx, adminID, orgID, ownerID) },
		)
		if results[0] != nil {
			t.Fatalf("owner removes admin: %v", results[0])
		}
		// The admin's request is forbidden if it runs first, or finds no caller row if it runs second.
		if !errors.Is(results[1], ErrRemoveForbidden) && !errors.Is(results[1], ErrOrgNotFound) {
			t.Fatalf("admin removes owner: %v", results[1])
		}
		var remaining []string
		if err := db.Table("public.members").Where("org_id = ? AND user_id IN ?", orgID, []string{ownerID, adminID}).Pluck("user_id", &remaining).Error; err != nil || !slices.Equal(remaining, []string{ownerID}) {
			t.Fatalf("remaining=%v err=%v", remaining, err)
		}
	})
	// Org deletion cascades to member rows in its own order. Removal locks member rows in user_id order.
	// The org deletion queues for the owner first, then the removal locks the developer and queues behind it.
	t.Run("org deletion and member removal at the same time", func(t *testing.T) {
		reset(t)
		blocker := db.Begin()
		if err := blocker.Exec("SELECT 1 FROM public.members WHERE org_id = ? AND user_id = ? FOR UPDATE", orgID, ownerID).Error; err != nil {
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
		go func() { defer wg.Done(); deleted, deleteErr = org.Store{DB: db}.Delete(ctx, ownerID, orgID) }()
		waitForLockWaiters(1)
		go func() { defer wg.Done(); removeErr = store.Remove(ctx, ownerID, orgID, devID) }()
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
		if err := db.Exec("INSERT INTO public.orgs (id, name) VALUES (?, 'Org')", orgID).Error; err != nil {
			t.Fatal(err)
		}
	})
}

func TestStoreLeavePostgres(t *testing.T) {
	db := pgtest.Open(t)
	if err := db.Exec(`INSERT INTO auth.users (id, email) VALUES
			('10000000-0000-0000-0000-000000000001', 'admin@example.com'),
			('10000000-0000-0000-0000-000000000002', 'admin2@example.com'),
			('10000000-0000-0000-0000-000000000003', 'deleting@example.com'),
			('10000000-0000-0000-0000-000000000004', 'dev@example.com'),
			('10000000-0000-0000-0000-000000000005', 'dev2@example.com'),
			('10000000-0000-0000-0000-000000000006', 'other@example.com'),
			('10000000-0000-0000-0000-000000000007', 'owner@example.com'),
			('10000000-0000-0000-0000-000000000008', 'outsider@example.com');
		UPDATE public.profiles SET deleted_at = now() WHERE id = '10000000-0000-0000-0000-000000000003';
		INSERT INTO public.orgs (id, name) VALUES
			('20000000-0000-0000-0000-000000000001', 'Org'),
			('20000000-0000-0000-0000-000000000002', 'Other');
		INSERT INTO public.members (org_id, user_id, role) VALUES
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'owner'),
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'developer'),
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'developer'),
			('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008', 'owner')`).Error; err != nil {
		t.Fatal(err)
	}
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	for _, tc := range []struct {
		name, caller, org string
		want              error
		remaining         int64
	}{
		{"developer", devID, orgID, nil, 0},
		{"repeat", devID, orgID, ErrOrgNotFound, 0},
		{"admin", adminID, orgID, nil, 0},
		{"owner", ownerID, orgID, ErrOwnerCannotLeave, 1},
		{"nonmember", outsiderID, orgID, ErrOrgNotFound, 0},
		{"missing org", ownerID, missingOrg, ErrOrgNotFound, 0},
		{"deleting caller", deletingID, orgID, ErrOrgNotFound, 1},
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
	if err := db.Table("public.members").Order("org_id, user_id").Pluck("user_id", &remaining).Error; err != nil || !slices.Equal(remaining, []string{deletingID, ownerID, outsiderID}) {
		t.Fatalf("remaining=%v err=%v", remaining, err)
	}
}
