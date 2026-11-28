package profile_test

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/org"
	"github.com/brojyf/keysy/api/internal/pgtest"
	"github.com/brojyf/keysy/api/internal/profile"
)

func TestDeletionAndOrgCreationPostgres(t *testing.T) {
	db := pgtest.Open(t)
	conn, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	conn.SetMaxOpenConns(8)
	if err := db.Exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
		('10000000-0000-0000-0000-000000000001', 'alice@example.com', '{"full_name": "Alice"}'),
		('10000000-0000-0000-0000-000000000002', 'user2@example.com', NULL),
		('10000000-0000-0000-0000-000000000003', 'user3@example.com', NULL),
		('10000000-0000-0000-0000-000000000004', 'user4@example.com', NULL),
		('10000000-0000-0000-0000-000000000005', 'user5@example.com', NULL);
	INSERT INTO public.orgs (id, name) VALUES ('20000000-0000-0000-0000-000000000001', 'Existing');
	INSERT INTO public.members (org_id, user_id, role) VALUES
		('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'developer'),
		('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'owner');
	INSERT INTO auth.sessions (id, user_id) VALUES
		('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
		('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002')`).Error; err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	deletion := profile.Store{DB: db}
	orgs := org.Store{DB: db}
	const user = "10000000-0000-0000-0000-000000000001"
	const owner = "10000000-0000-0000-0000-000000000002"
	if err := deletion.ScheduleDeletion(ctx, user); err != nil {
		t.Fatal(err)
	}
	var first time.Time
	if err := db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", user).Scan(&first).Error; err != nil || first.IsZero() {
		t.Fatalf("deleted_at=%v err=%v", first, err)
	}
	var email struct {
		Type    string
		Payload string
	}
	if err := db.Raw("SELECT type, payload::text AS payload FROM public.outbox").Take(&email).Error; err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(email.Payload), &payload); err != nil {
		t.Fatal(err)
	}
	wantPayload := map[string]any{
		"to": "alice@example.com",
		"template": map[string]any{
			"id": "deletion-scheduled",
			"variables": map[string]any{
				"DISPLAY_NAME": "Alice",
				"PURGE_DATE":   first.UTC().AddDate(0, 0, 30).Format("January 2, 2006"),
			},
		},
	}
	if email.Type != "email" || !reflect.DeepEqual(payload, wantPayload) {
		t.Fatalf("outbox type=%q payload=%v", email.Type, payload)
	}
	if err := db.Exec("INSERT INTO auth.sessions (id, user_id) VALUES ('30000000-0000-0000-0000-000000000003', ?)", user).Error; err != nil {
		t.Fatal(err)
	}
	if err := deletion.ScheduleDeletion(ctx, user); err != nil {
		t.Fatal(err)
	}
	var second time.Time
	db.Raw("SELECT deleted_at FROM public.profiles WHERE id = ?", user).Scan(&second)
	if !first.Equal(second) {
		t.Fatalf("deletion time changed: %v %v", first, second)
	}
	var ownerErr *profile.OrgOwnerError
	if err := deletion.ScheduleDeletion(ctx, owner); !errors.As(err, &ownerErr) || len(ownerErr.Orgs) != 1 || ownerErr.Orgs[0] != (profile.OwnedOrg{ID: "20000000-0000-0000-0000-000000000001", Name: "Existing"}) {
		t.Fatalf("owner: %v", err)
	}
	var n int64
	for _, q := range []struct {
		sql  string
		want int64
	}{
		{"SELECT count(*) FROM auth.sessions WHERE user_id = '" + user + "'", 0},
		{"SELECT count(*) FROM auth.sessions WHERE user_id = '" + owner + "'", 1},
		{"SELECT count(*) FROM public.profiles WHERE id = '" + owner + "' AND deleted_at IS NULL", 1},
		{"SELECT count(*) FROM public.members", 2},
		{"SELECT count(*) FROM public.outbox", 1},
	} {
		if err := db.Raw(q.sql).Scan(&n).Error; err != nil || n != q.want {
			t.Fatalf("%s: %d err=%v", q.sql, n, err)
		}
	}
	if _, err := orgs.Create(ctx, user, "Denied"); !errors.Is(err, org.ErrAccountDeleting) {
		t.Fatalf("deleting create: %v", err)
	}
	if err := db.Raw("SELECT count(*) FROM public.orgs").Scan(&n).Error; err != nil || n != 1 {
		t.Fatalf("org count=%d err=%v", n, err)
	}
	if err := db.Raw("SELECT count(*) FROM public.members").Scan(&n).Error; err != nil || n != 2 {
		t.Fatalf("member count=%d err=%v", n, err)
	}
	for _, tc := range []struct {
		name, id    string
		deleteFirst bool
	}{
		{"deletion first", "10000000-0000-0000-0000-000000000003", true},
		{"creation first", "10000000-0000-0000-0000-000000000004", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tx := db.WithContext(ctx).Begin()
			if tx.Error != nil {
				t.Fatal(tx.Error)
			}
			defer tx.Rollback()
			if tc.deleteFirst {
				if err := (profile.Store{DB: tx}).ScheduleDeletion(ctx, tc.id); err != nil {
					t.Fatal(err)
				}
			} else {
				if _, err := (org.Store{DB: tx}).Create(ctx, tc.id, "Concurrent"); err != nil {
					t.Fatal(err)
				}
			}
			result := make(chan error, 1)
			go func() {
				if tc.deleteFirst {
					_, err := orgs.Create(ctx, tc.id, "Concurrent")
					result <- err
				} else {
					result <- deletion.ScheduleDeletion(ctx, tc.id)
				}
			}()
			select {
			case err := <-result:
				t.Fatalf("operation did not block: %v", err)
			case <-time.After(200 * time.Millisecond):
			}
			if err := tx.Commit().Error; err != nil {
				t.Fatal(err)
			}
			select {
			case err := <-result:
				if tc.deleteFirst && !errors.Is(err, org.ErrAccountDeleting) {
					t.Fatalf("create: %v", err)
				}
				if ownerErr := (*profile.OrgOwnerError)(nil); !tc.deleteFirst && !errors.As(err, &ownerErr) {
					t.Fatalf("delete: %v", err)
				}
			case <-ctx.Done():
				t.Fatal(ctx.Err())
			}
		})
	}
	if err := db.Raw("SELECT count(*) FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000005' AND deleted_at IS NULL").Scan(&n).Error; err != nil || n != 1 {
		t.Fatalf("other profile=%d err=%v", n, err)
	}
}
