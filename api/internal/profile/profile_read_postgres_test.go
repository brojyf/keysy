package profile_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/profile"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestProfileReadPostgres(t *testing.T) {
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
	if err := db.Exec(`CREATE TABLE public.profiles (id uuid primary key, display_name text, agent_auto_apply boolean, deleted_at timestamptz)`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP TABLE public.profiles`).Error; err != nil {
			t.Error(err)
		}
	})
	deletedAt := time.Date(2026, 11, 16, 8, 30, 0, 0, time.UTC)
	if err := db.Exec(`INSERT INTO public.profiles VALUES (?, ?, ?, NULL), (?, ?, ?, ?)`, "10000000-0000-0000-0000-000000000001", "Ada", true, "10000000-0000-0000-0000-000000000002", "Grace", false, deletedAt).Error; err != nil {
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
