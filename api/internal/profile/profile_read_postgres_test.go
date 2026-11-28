package profile_test

import (
	"context"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/pgtest"
	"github.com/brojyf/keysy/api/internal/profile"
)

func TestProfileReadPostgres(t *testing.T) {
	db := pgtest.Open(t)
	deletedAt := time.Date(2026, 11, 16, 8, 30, 0, 0, time.UTC)
	if err := db.Exec(`INSERT INTO auth.users (id, email) VALUES (?, 'ada@example.com'), (?, 'grace@example.com')`,
		"10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000002").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`UPDATE public.profiles SET deleted_at = ? WHERE id = ?`, deletedAt, "10000000-0000-0000-0000-000000000002").Error; err != nil {
		t.Fatal(err)
	}
	store := profile.Store{DB: db}
	want := deletedAt.Add(30 * 24 * time.Hour)
	for _, tc := range []struct {
		id   string
		want *time.Time
	}{
		{"10000000-0000-0000-0000-000000000001", nil},
		{"10000000-0000-0000-0000-000000000002", &want},
	} {
		got, err := store.Profile(context.Background(), tc.id)
		if err != nil {
			t.Fatal(err)
		}
		if (got.PurgeAt == nil) != (tc.want == nil) || (tc.want != nil && !got.PurgeAt.Equal(*tc.want)) {
			t.Fatalf("id=%s purgeAt=%v want=%v", tc.id, got.PurgeAt, tc.want)
		}
	}
}
