package profile_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/org"
	"github.com/brojyf/keysy/api/internal/pgtest"
	"github.com/brojyf/keysy/api/internal/profile"
	"gorm.io/gorm"
)

func TestCancelDeletionPostgres(t *testing.T) {
	db := pgtest.Open(t)
	if err := db.Exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
		('10000000-0000-0000-0000-000000000001', 'alice@example.com', '{"full_name": "Alice"}'),
		('10000000-0000-0000-0000-000000000002', 'bob@example.com', NULL),
		('10000000-0000-0000-0000-000000000003', 'carol@example.com', NULL);
	UPDATE public.profiles SET deleted_at = '2026-01-02T03:04:05Z' WHERE id = '10000000-0000-0000-0000-000000000003'`).Error; err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	deletion := profile.Store{DB: db}
	orgs := org.Store{DB: db}
	const user = "10000000-0000-0000-0000-000000000001"
	const other = "10000000-0000-0000-0000-000000000003"
	if err := deletion.ScheduleDeletion(ctx, user); err != nil {
		t.Fatal(err)
	}
	if _, err := orgs.Create(ctx, user, "Before cancellation"); !errors.Is(err, org.ErrAccountDeleting) {
		t.Fatalf("create during deletion: %v", err)
	}
	if err := deletion.CancelDeletion(ctx, user); err != nil {
		t.Fatal(err)
	}
	var deletedAt sql.NullTime
	if err := db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", user).Scan(&deletedAt).Error; err != nil || deletedAt.Valid {
		t.Fatalf("deleted_at=%v err=%v", deletedAt, err)
	}
	if _, err := orgs.Create(ctx, user, "After cancellation"); err != nil {
		t.Fatalf("create after cancellation: %v", err)
	}
	var cancelled string
	if err := db.Raw("SELECT payload::text FROM public.outbox WHERE type = 'email' AND payload #>> '{template,id}' = 'deletion-cancelled'").Scan(&cancelled).Error; err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(cancelled), &payload); err != nil {
		t.Fatalf("cancelled payload %q: %v", cancelled, err)
	}
	wantPayload := map[string]any{
		"to": "alice@example.com",
		"template": map[string]any{
			"id":        "deletion-cancelled",
			"variables": map[string]any{"DISPLAY_NAME": "Alice"},
		},
	}
	if !reflect.DeepEqual(payload, wantPayload) {
		t.Fatalf("cancelled payload=%v", payload)
	}
	// A second cancel must not write the row, so a later cancellation event fires once.
	var xminBefore, xminAfter string
	if err := db.Raw("SELECT xmin::text FROM public.profiles WHERE id = ?", user).Scan(&xminBefore).Error; err != nil {
		t.Fatal(err)
	}
	if err := deletion.CancelDeletion(ctx, user); err != nil {
		t.Fatalf("cancel active profile: %v", err)
	}
	if err := db.Raw("SELECT xmin::text FROM public.profiles WHERE id = ?", user).Scan(&xminAfter).Error; err != nil || xminAfter != xminBefore {
		t.Fatalf("active profile rewritten: xmin %s -> %s err=%v", xminBefore, xminAfter, err)
	}
	var activeDeletedAt sql.NullTime
	if err := db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", user).Scan(&activeDeletedAt).Error; err != nil || activeDeletedAt.Valid {
		t.Fatalf("active deleted_at=%v err=%v", activeDeletedAt, err)
	}
	var outboxRows int64
	if err := db.Raw("SELECT count(*) FROM public.outbox").Scan(&outboxRows).Error; err != nil || outboxRows != 2 {
		t.Fatalf("outbox rows=%d err=%v", outboxRows, err)
	}
	var otherDeletedAt time.Time
	if err := db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", other).Scan(&otherDeletedAt).Error; err != nil || !otherDeletedAt.Equal(time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)) {
		t.Fatalf("other deleted_at=%v err=%v", otherDeletedAt, err)
	}
	// A purged account has no profile row; cancelling must not report success.
	if err := deletion.CancelDeletion(ctx, "10000000-0000-0000-0000-000000000009"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("cancel purged profile: %v", err)
	}
}
