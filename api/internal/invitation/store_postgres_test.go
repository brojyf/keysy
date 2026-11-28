package invitation

import (
	"context"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/pgtest"
)

func TestStoreListPostgres(t *testing.T) {
	db := pgtest.Open(t)
	const (
		owner     = "10000000-0000-0000-0000-000000000001"
		admin     = "10000000-0000-0000-0000-000000000002"
		developer = "10000000-0000-0000-0000-000000000003"
		outsider  = "10000000-0000-0000-0000-000000000004"
		gone      = "10000000-0000-0000-0000-000000000005"
		missing   = "10000000-0000-0000-0000-000000000009"
	)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	// Keep now() fixed for the exact seven-day expiry boundary and roll back all fixtures.
	tx := db.WithContext(ctx).Begin()
	if tx.Error != nil {
		t.Fatal(tx.Error)
	}
	defer tx.Rollback()
	if err := tx.Exec(`INSERT INTO auth.users (id, email) VALUES
			('10000000-0000-0000-0000-000000000001', 'owner@example.com'),
			('10000000-0000-0000-0000-000000000002', 'admin@example.com'),
			('10000000-0000-0000-0000-000000000003', 'developer@example.com'),
			('10000000-0000-0000-0000-000000000004', 'outsider@example.com'),
			('10000000-0000-0000-0000-000000000005', 'gone@example.com');
		UPDATE public.profiles SET deleted_at = now() WHERE id = '10000000-0000-0000-0000-000000000005';
		INSERT INTO public.orgs (id, name) VALUES
			('20000000-0000-0000-0000-000000000001', 'Acme'),
			('20000000-0000-0000-0000-000000000002', 'Other'),
			('20000000-0000-0000-0000-000000000003', 'Empty');
		INSERT INTO public.members (org_id, user_id, role) VALUES
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'admin'),
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'developer'),
			('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'admin'),
			('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'owner'),
			('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'owner');
		INSERT INTO public.invitations (id, org_id, email, role, started_at, invited_by_email) VALUES
			('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'pending@example.com', 'developer', now(), 'owner@example.com'),
			('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'expired@example.com', 'admin', now() - interval '8 days', 'owner@example.com'),
			('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'boundary@example.com', 'developer', now() - interval '7 days', 'owner@example.com'),
			('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'before@example.com', 'admin', now() - interval '7 days' + interval '1 second', 'owner@example.com'),
			('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'after@example.com', 'developer', now() - interval '7 days' - interval '1 second', 'owner@example.com'),
			('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'other@example.com', 'admin', now(), 'outsider@example.com')`).Error; err != nil {
		t.Fatal(err)
	}
	store := Store{DB: tx}
	byID := func(a, b Invitation) int { return strings.Compare(a.ID, b.ID) }
	want := []Invitation{
		{ID: "30000000-0000-0000-0000-000000000001", Email: "pending@example.com", Role: "developer", Status: "pending"},
		{ID: "30000000-0000-0000-0000-000000000002", Email: "expired@example.com", Role: "admin", Status: "expired"},
		{ID: "30000000-0000-0000-0000-000000000003", Email: "boundary@example.com", Role: "developer", Status: "expired"},
		{ID: "30000000-0000-0000-0000-000000000004", Email: "before@example.com", Role: "admin", Status: "pending"},
		{ID: "30000000-0000-0000-0000-000000000005", Email: "after@example.com", Role: "developer", Status: "expired"},
	}
	for _, userID := range []string{owner, admin, developer} {
		got, visible, err := store.List(ctx, userID, "20000000-0000-0000-0000-000000000001")
		slices.SortFunc(got, byID)
		if err != nil || !visible || !slices.Equal(got, want) {
			t.Fatalf("member %s: got=%v visible=%v err=%v", userID, got, visible, err)
		}
	}
	for _, tc := range []struct{ name, userID, orgID string }{
		{"not a member", outsider, "20000000-0000-0000-0000-000000000001"},
		{"deleted caller", gone, "20000000-0000-0000-0000-000000000001"},
		{"missing caller", missing, "20000000-0000-0000-0000-000000000001"},
		{"missing org", owner, "20000000-0000-0000-0000-000000000009"},
		{"empty org, not a member", outsider, "20000000-0000-0000-0000-000000000003"},
	} {
		got, visible, err := store.List(ctx, tc.userID, tc.orgID)
		if err != nil || visible || len(got) != 0 {
			t.Fatalf("%s: got=%v visible=%v err=%v", tc.name, got, visible, err)
		}
	}
	got, visible, err := store.List(ctx, owner, "20000000-0000-0000-0000-000000000003")
	if err != nil || !visible || got == nil || len(got) != 0 {
		t.Fatalf("empty org: got=%v visible=%v err=%v", got, visible, err)
	}
	got, visible, err = store.List(ctx, outsider, "20000000-0000-0000-0000-000000000002")
	if err != nil || !visible || !slices.Equal(got, []Invitation{{ID: "30000000-0000-0000-0000-000000000006", Email: "other@example.com", Role: "admin", Status: "pending"}}) {
		t.Fatalf("other org: got=%v visible=%v err=%v", got, visible, err)
	}
	if err := tx.Exec(`DELETE FROM public.orgs WHERE id = '20000000-0000-0000-0000-000000000001'`).Error; err != nil {
		t.Fatal(err)
	}
	got, visible, err = store.List(ctx, owner, "20000000-0000-0000-0000-000000000001")
	if err != nil || visible || len(got) != 0 {
		t.Fatalf("deleted org: got=%v visible=%v err=%v", got, visible, err)
	}
}
