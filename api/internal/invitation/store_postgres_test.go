package invitation

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
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	// Keep now() fixed for the exact seven-day expiry boundary and roll back all fixtures.
	tx := db.WithContext(ctx).Begin()
	if tx.Error != nil {
		t.Fatal(tx.Error)
	}
	defer tx.Rollback()
	if err := tx.Exec(`CREATE TABLE public.orgs (id uuid PRIMARY KEY);
		CREATE TABLE public.members (org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE, user_id text, role text, PRIMARY KEY (org_id, user_id));
		CREATE TABLE public.profiles (id text PRIMARY KEY, deleted_at timestamptz);
		CREATE TABLE public.invitations (id uuid PRIMARY KEY, org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE, email text, role text, started_at timestamptz);
		INSERT INTO public.orgs VALUES
			('20000000-0000-0000-0000-000000000001'),
			('20000000-0000-0000-0000-000000000002'),
			('20000000-0000-0000-0000-000000000003');
		INSERT INTO public.profiles VALUES
			('owner', NULL), ('admin', NULL), ('developer', NULL), ('outsider', NULL), ('gone', now());
		INSERT INTO public.members VALUES
			('20000000-0000-0000-0000-000000000001', 'owner', 'owner'),
			('20000000-0000-0000-0000-000000000001', 'admin', 'admin'),
			('20000000-0000-0000-0000-000000000001', 'developer', 'developer'),
			('20000000-0000-0000-0000-000000000001', 'gone', 'admin'),
			('20000000-0000-0000-0000-000000000002', 'outsider', 'owner'),
			('20000000-0000-0000-0000-000000000003', 'owner', 'owner');
		INSERT INTO public.invitations VALUES
			('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'pending@example.com', 'developer', now()),
			('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'expired@example.com', 'admin', now() - interval '8 days'),
			('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'boundary@example.com', 'developer', now() - interval '7 days'),
			('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'before@example.com', 'admin', now() - interval '7 days' + interval '1 second'),
			('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'after@example.com', 'developer', now() - interval '7 days' - interval '1 second'),
			('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 'other@example.com', 'admin', now())`).Error; err != nil {
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
	for _, userID := range []string{"owner", "admin", "developer"} {
		got, visible, err := store.List(ctx, userID, "20000000-0000-0000-0000-000000000001")
		slices.SortFunc(got, byID)
		if err != nil || !visible || !slices.Equal(got, want) {
			t.Fatalf("member %s: got=%v visible=%v err=%v", userID, got, visible, err)
		}
	}
	for _, tc := range []struct{ name, userID, orgID string }{
		{"not a member", "outsider", "20000000-0000-0000-0000-000000000001"},
		{"deleted caller", "gone", "20000000-0000-0000-0000-000000000001"},
		{"missing caller", "missing", "20000000-0000-0000-0000-000000000001"},
		{"missing org", "owner", "20000000-0000-0000-0000-000000000009"},
		{"empty org, not a member", "outsider", "20000000-0000-0000-0000-000000000003"},
	} {
		got, visible, err := store.List(ctx, tc.userID, tc.orgID)
		if err != nil || visible || len(got) != 0 {
			t.Fatalf("%s: got=%v visible=%v err=%v", tc.name, got, visible, err)
		}
	}
	got, visible, err := store.List(ctx, "owner", "20000000-0000-0000-0000-000000000003")
	if err != nil || !visible || got == nil || len(got) != 0 {
		t.Fatalf("empty org: got=%v visible=%v err=%v", got, visible, err)
	}
	got, visible, err = store.List(ctx, "outsider", "20000000-0000-0000-0000-000000000002")
	if err != nil || !visible || !slices.Equal(got, []Invitation{{ID: "30000000-0000-0000-0000-000000000006", Email: "other@example.com", Role: "admin", Status: "pending"}}) {
		t.Fatalf("other org: got=%v visible=%v err=%v", got, visible, err)
	}
	if err := tx.Exec(`DELETE FROM public.orgs WHERE id = '20000000-0000-0000-0000-000000000001'`).Error; err != nil {
		t.Fatal(err)
	}
	got, visible, err = store.List(ctx, "owner", "20000000-0000-0000-0000-000000000001")
	if err != nil || visible || len(got) != 0 {
		t.Fatalf("deleted org: got=%v visible=%v err=%v", got, visible, err)
	}
}
