package invitation

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"sync"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/pgtest"
	"gorm.io/gorm"
)

const (
	acmeID   = "20000000-0000-0000-0000-000000000001"
	otherID  = "20000000-0000-0000-0000-000000000002"
	doomedID = "20000000-0000-0000-0000-000000000003"
	renewID  = "30000000-0000-0000-0000-000000000001"
	webApp   = "https://app.keysy.test/"

	ownerID    = "10000000-0000-0000-0000-000000000001"
	adminID    = "10000000-0000-0000-0000-000000000002"
	devID      = "10000000-0000-0000-0000-000000000003"
	goneID     = "10000000-0000-0000-0000-000000000004"
	mixedID    = "10000000-0000-0000-0000-000000000005"
	leavingID  = "10000000-0000-0000-0000-000000000006"
	newbieID   = "10000000-0000-0000-0000-000000000007"
	outsiderID = "10000000-0000-0000-0000-000000000008"
)

func TestStoreCreatePostgres(t *testing.T) {
	db := pgtest.Open(t)
	if err := db.Exec(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
			(?, 'alex@example.com', '{"full_name": "Alex Chen"}'),
			(?, 'jordan@example.com', '{"full_name": "Jordan Lee"}'),
			(?, 'riley@example.com', '{"full_name": "Riley Park"}'),
			(?, 'gone@example.com', NULL),
			(?, 'Mixed.Case@Example.com', NULL),
			(?, 'leaving@example.com', NULL),
			(?, 'newbie@example.com', NULL),
			(?, 'outsider@example.com', NULL)`,
		ownerID, adminID, devID, goneID, mixedID, leavingID, newbieID, outsiderID).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`UPDATE public.profiles SET deleted_at = now() WHERE id IN (?, ?)`, goneID, leavingID).Error; err != nil {
		t.Fatal(err)
	}
	reset := func(t *testing.T, setup string) {
		t.Helper()
		// Statements with parameters cannot share one Exec.
		for _, statement := range []struct {
			sql  string
			args []any
		}{
			{`DELETE FROM public.outbox; DELETE FROM public.invitations; DELETE FROM public.members; DELETE FROM public.orgs`, nil},
			{`INSERT INTO public.orgs (id, name) VALUES (?, 'Acme'), (?, 'Other'), (?, 'Doomed')`, []any{acmeID, otherID, doomedID}},
			{`INSERT INTO public.members (org_id, user_id, role) VALUES (?, ?, 'owner'), (?, ?, 'admin'), (?, ?, 'developer'), (?, ?, 'admin'),
				(?, ?, 'developer'), (?, ?, 'developer'), (?, ?, 'owner'), (?, ?, 'owner')`,
				[]any{acmeID, ownerID, acmeID, adminID, acmeID, devID, acmeID, goneID, acmeID, mixedID, acmeID, leavingID, otherID, outsiderID, doomedID, ownerID}},
		} {
			if err := db.Exec(statement.sql, statement.args...).Error; err != nil {
				t.Fatal(err)
			}
		}
		if setup != "" {
			if err := db.Exec(setup).Error; err != nil {
				t.Fatal(err)
			}
		}
	}
	type stored struct {
		ID, Role, InvitedByEmail string
		StartedAt, LastSentAt    time.Time
	}
	invitationFor := func(t *testing.T, email string) (stored, bool) {
		t.Helper()
		var rows []stored
		if err := db.Raw(`SELECT id, role, invited_by_email, started_at, last_sent_at FROM public.invitations WHERE org_id = ? AND email = ?`,
			acmeID, email).Scan(&rows).Error; err != nil {
			t.Fatal(err)
		}
		if len(rows) == 0 {
			return stored{}, false
		}
		return rows[0], true
	}
	count := func(t *testing.T, query string, args ...any) int {
		t.Helper()
		var n int
		if err := db.Raw(query, args...).Scan(&n).Error; err != nil {
			t.Fatal(err)
		}
		return n
	}
	window := func(t *testing.T) (sends int, started *time.Time) {
		t.Helper()
		var org struct {
			InvitationWindowSends     int
			InvitationWindowStartedAt *time.Time
		}
		if err := db.Raw(`SELECT invitation_window_sends, invitation_window_started_at FROM public.orgs WHERE id = ?`, acmeID).Scan(&org).Error; err != nil {
			t.Fatal(err)
		}
		return org.InvitationWindowSends, org.InvitationWindowStartedAt
	}
	unchanged := func(t *testing.T) {
		t.Helper()
		if n := count(t, `SELECT count(*) FROM public.outbox`); n != 0 {
			t.Fatalf("outbox rows = %d, want 0", n)
		}
	}
	store := Store{DB: db, WebAppURL: webApp}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	t.Run("owner invites an admin", func(t *testing.T) {
		reset(t, "")
		got, err := store.Create(ctx, ownerID, acmeID, "sam@example.com", "admin")
		if err != nil || got.ID == "" || got.Email != "sam@example.com" || got.Role != "admin" || got.Status != "pending" {
			t.Fatalf("got=%+v err=%v", got, err)
		}
		row, ok := invitationFor(t, "sam@example.com")
		if !ok || row.ID != got.ID || row.Role != "admin" || row.InvitedByEmail != "alex@example.com" || !row.StartedAt.Equal(row.LastSentAt) {
			t.Fatalf("row=%+v ok=%v", row, ok)
		}
		var outbox []struct{ Type, Payload string }
		if err := db.Raw(`SELECT type, payload::text AS payload FROM public.outbox`).Scan(&outbox).Error; err != nil || len(outbox) != 1 || outbox[0].Type != "email" {
			t.Fatalf("outbox=%v err=%v", outbox, err)
		}
		var payload invitationEmail
		if err := json.Unmarshal([]byte(outbox[0].Payload), &payload); err != nil {
			t.Fatal(err)
		}
		want := map[string]string{
			"ORG_NAME":       "Acme",
			"INVITER_NAME":   "Alex Chen",
			"INVITATION_URL": "https://app.keysy.test/invitations/" + got.ID,
			"EXPIRY_DATE":    row.StartedAt.Add(7 * 24 * time.Hour).UTC().Format("January 2, 2006"),
		}
		if payload.To != "sam@example.com" || payload.Template.ID != "invitation" || !maps.Equal(payload.Template.Variables, want) {
			t.Fatalf("payload=%s", outbox[0].Payload)
		}
		if sends, started := window(t); sends != 1 || started == nil {
			t.Fatalf("window sends=%d started=%v", sends, started)
		}
	})

	for _, tc := range []struct {
		name, setup, caller, org, email, role string
		want                                  error
	}{
		{name: "admin invites a developer", caller: adminID, org: acmeID, email: "sam@example.com", role: "developer"},
		{name: "admin cannot invite an admin", caller: adminID, org: acmeID, email: "sam@example.com", role: "admin", want: ErrForbidden},
		{name: "developer cannot invite", caller: devID, org: acmeID, email: "sam@example.com", role: "developer", want: ErrForbidden},
		{name: "nonmember", caller: outsiderID, org: acmeID, email: "sam@example.com", role: "developer", want: ErrOrgNotFound},
		{name: "caller scheduled for deletion", caller: goneID, org: acmeID, email: "sam@example.com", role: "developer", want: ErrOrgNotFound},
		{name: "missing org", caller: ownerID, org: "20000000-0000-0000-0000-000000000009", email: "sam@example.com", role: "developer", want: ErrOrgNotFound},
		{name: "member email in another case", caller: ownerID, org: acmeID, email: "mixed.case@example.com", role: "developer", want: ErrAlreadyMember},
		{name: "member scheduled for deletion", caller: ownerID, org: acmeID, email: "leaving@example.com", role: "developer", want: ErrAlreadyMember},
		{name: "own email", caller: ownerID, org: acmeID, email: "alex@example.com", role: "admin", want: ErrAlreadyMember},
		{name: "pending invitation", caller: ownerID, org: acmeID, email: "sam@example.com", role: "developer", want: ErrInvitationExists,
			setup: `INSERT INTO public.invitations (org_id, email, role, started_at, last_sent_at, invited_by_email)
				VALUES ('` + acmeID + `', 'sam@example.com', 'developer', now() - interval '7 days' + interval '1 minute', now() - interval '1 day', 'alex@example.com')`},
		{name: "admin and a pending admin invitation", caller: adminID, org: acmeID, email: "sam@example.com", role: "developer", want: ErrInvitationExists,
			setup: `INSERT INTO public.invitations (org_id, email, role, invited_by_email) VALUES ('` + acmeID + `', 'sam@example.com', 'admin', 'alex@example.com')`},
		{name: "admin cannot renew an expired admin invitation", caller: adminID, org: acmeID, email: "sam@example.com", role: "developer", want: ErrForbidden,
			setup: `INSERT INTO public.invitations (org_id, email, role, started_at, last_sent_at, invited_by_email)
				VALUES ('` + acmeID + `', 'sam@example.com', 'admin', now() - interval '8 days', now() - interval '8 days', 'alex@example.com')`},
		{name: "limit reached", caller: ownerID, org: acmeID, email: "sam@example.com", role: "developer", want: ErrLimitReached,
			setup: `UPDATE public.orgs SET invitation_window_started_at = now() - interval '23 hours', invitation_window_sends = 50 WHERE id = '` + acmeID + `'`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reset(t, tc.setup)
			var before []stored
			if err := db.Raw(`SELECT id, role, invited_by_email, started_at, last_sent_at FROM public.invitations ORDER BY id`).Scan(&before).Error; err != nil {
				t.Fatal(err)
			}
			sendsBefore, _ := window(t)
			got, err := store.Create(ctx, tc.caller, tc.org, tc.email, tc.role)
			if !errors.Is(err, tc.want) {
				t.Fatalf("got=%+v err=%v, want %v", got, err, tc.want)
			}
			if tc.want == nil {
				row, ok := invitationFor(t, tc.email)
				if !ok || row.ID != got.ID || row.Role != tc.role {
					t.Fatalf("row=%+v ok=%v", row, ok)
				}
				return
			}
			// Every rejection rolls back the invitation, the window, and the outbox row.
			var after []stored
			if err := db.Raw(`SELECT id, role, invited_by_email, started_at, last_sent_at FROM public.invitations ORDER BY id`).Scan(&after).Error; err != nil {
				t.Fatal(err)
			}
			if len(after) != len(before) || len(after) == 1 && after[0] != before[0] {
				t.Fatalf("invitations changed: before=%+v after=%+v", before, after)
			}
			if sendsAfter, _ := window(t); sendsAfter != sendsBefore {
				t.Fatalf("window sends %d -> %d", sendsBefore, sendsAfter)
			}
			unchanged(t)
		})
	}

	t.Run("expired invitation is renewed in place", func(t *testing.T) {
		reset(t, `INSERT INTO public.invitations (id, org_id, email, role, started_at, last_sent_at, invited_by_email)
			VALUES ('`+renewID+`', '`+acmeID+`', 'sam@example.com', 'admin', now() - interval '7 days', now() - interval '7 days', 'old@example.com')`)
		got, err := store.Create(ctx, ownerID, acmeID, "sam@example.com", "developer")
		if err != nil || got.ID != renewID || got.Role != "developer" {
			t.Fatalf("got=%+v err=%v", got, err)
		}
		row, _ := invitationFor(t, "sam@example.com")
		if row.Role != "developer" || row.InvitedByEmail != "alex@example.com" || time.Since(row.StartedAt) > time.Minute || !row.StartedAt.Equal(row.LastSentAt) {
			t.Fatalf("row=%+v", row)
		}
		if n := count(t, `SELECT count(*) FROM public.outbox WHERE payload #>> '{template,variables,INVITATION_URL}' = ?`, "https://app.keysy.test/invitations/"+renewID); n != 1 {
			t.Fatalf("renewal emails = %d", n)
		}
	})

	t.Run("admin renews an expired developer invitation", func(t *testing.T) {
		reset(t, `INSERT INTO public.invitations (id, org_id, email, role, started_at, last_sent_at, invited_by_email)
			VALUES ('`+renewID+`', '`+acmeID+`', 'sam@example.com', 'developer', now() - interval '8 days', now() - interval '8 days', 'alex@example.com')`)
		if got, err := store.Create(ctx, adminID, acmeID, "sam@example.com", "developer"); err != nil || got.ID != renewID {
			t.Fatalf("got=%+v err=%v", got, err)
		}
	})

	t.Run("window counts up, then restarts after 24 hours", func(t *testing.T) {
		reset(t, `UPDATE public.orgs SET invitation_window_started_at = now() - interval '1 hour', invitation_window_sends = 49 WHERE id = '`+acmeID+`'`)
		if _, err := store.Create(ctx, ownerID, acmeID, "a@example.com", "developer"); err != nil {
			t.Fatal(err)
		}
		if sends, _ := window(t); sends != 50 {
			t.Fatalf("sends = %d, want 50", sends)
		}
		if err := db.Exec(`UPDATE public.orgs SET invitation_window_started_at = now() - interval '24 hours' WHERE id = ?`, acmeID).Error; err != nil {
			t.Fatal(err)
		}
		if _, err := store.Create(ctx, ownerID, acmeID, "b@example.com", "developer"); err != nil {
			t.Fatal(err)
		}
		if sends, started := window(t); sends != 1 || started == nil || time.Since(*started) > time.Minute {
			t.Fatalf("sends=%d started=%v, want a new window", sends, started)
		}
	})

	waitForLockWaiters := func(t *testing.T, blocker *gorm.DB, want int) {
		t.Helper()
		for deadline := time.Now().Add(5 * time.Second); ; time.Sleep(10 * time.Millisecond) {
			waiting := count(t, `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`)
			if waiting >= want {
				return
			}
			if time.Now().After(deadline) {
				blocker.Rollback()
				t.Fatalf("only %d of %d requests waited for a lock", waiting, want)
			}
		}
	}
	// The blocker holds the org row so every request stops at the org lock, then releases them together.
	overlap := func(t *testing.T, requests ...func() error) []error {
		t.Helper()
		blocker := db.Begin()
		if err := blocker.Exec(`SELECT 1 FROM public.orgs WHERE id = ? FOR UPDATE`, acmeID).Error; err != nil {
			blocker.Rollback()
			t.Fatal(err)
		}
		results := make([]error, len(requests))
		var wg sync.WaitGroup
		for i, request := range requests {
			wg.Add(1)
			go func() { defer wg.Done(); results[i] = request() }()
		}
		waitForLockWaiters(t, blocker, len(requests))
		if err := blocker.Commit().Error; err != nil {
			t.Fatal(err)
		}
		wg.Wait()
		return results
	}

	t.Run("same email invited twice at the same time", func(t *testing.T) {
		reset(t, "")
		results := overlap(t,
			func() error { _, err := store.Create(ctx, ownerID, acmeID, "sam@example.com", "developer"); return err },
			func() error { _, err := store.Create(ctx, adminID, acmeID, "sam@example.com", "developer"); return err },
		)
		if !(results[0] == nil && errors.Is(results[1], ErrInvitationExists) || results[1] == nil && errors.Is(results[0], ErrInvitationExists)) {
			t.Fatalf("results: %v, %v", results[0], results[1])
		}
		if n := count(t, `SELECT count(*) FROM public.outbox`); n != 1 {
			t.Fatalf("outbox rows = %d, want 1", n)
		}
		if sends, _ := window(t); sends != 1 {
			t.Fatalf("sends = %d, want 1", sends)
		}
	})

	t.Run("the last send of a window at the same time", func(t *testing.T) {
		reset(t, `UPDATE public.orgs SET invitation_window_started_at = now() - interval '1 hour', invitation_window_sends = 49 WHERE id = '`+acmeID+`'`)
		results := overlap(t,
			func() error { _, err := store.Create(ctx, ownerID, acmeID, "a@example.com", "developer"); return err },
			func() error { _, err := store.Create(ctx, ownerID, acmeID, "b@example.com", "developer"); return err },
		)
		if !(results[0] == nil && errors.Is(results[1], ErrLimitReached) || results[1] == nil && errors.Is(results[0], ErrLimitReached)) {
			t.Fatalf("results: %v, %v", results[0], results[1])
		}
		if sends, _ := window(t); sends != 50 {
			t.Fatalf("sends = %d, want 50", sends)
		}
		if n := count(t, `SELECT count(*) FROM public.invitations`); n != 1 {
			t.Fatalf("invitations = %d, want 1", n)
		}
		if n := count(t, `SELECT count(*) FROM public.outbox`); n != 1 {
			t.Fatalf("outbox rows = %d, want 1", n)
		}
	})

	// The invitee accepts a pending invitation while an Admin invites the same email again.
	t.Run("invited while accepting", func(t *testing.T) {
		reset(t, `INSERT INTO public.invitations (org_id, email, role, invited_by_email) VALUES ('`+acmeID+`', 'newbie@example.com', 'developer', 'alex@example.com')`)
		accept := db.Begin()
		if err := accept.Exec(`DELETE FROM public.invitations WHERE org_id = ? AND email = 'newbie@example.com'`, acmeID).Error; err != nil {
			accept.Rollback()
			t.Fatal(err)
		}
		if err := accept.Exec(`INSERT INTO public.members (org_id, user_id, role) VALUES (?, ?, 'developer')`, acmeID, newbieID).Error; err != nil {
			accept.Rollback()
			t.Fatal(err)
		}
		var createErr error
		done := make(chan struct{})
		go func() {
			defer close(done)
			_, createErr = store.Create(ctx, adminID, acmeID, "newbie@example.com", "developer")
		}()
		waitForLockWaiters(t, accept, 1)
		if err := accept.Commit().Error; err != nil {
			t.Fatal(err)
		}
		<-done
		if !errors.Is(createErr, ErrAlreadyMember) {
			t.Fatalf("create: %v", createErr)
		}
		if _, ok := invitationFor(t, "newbie@example.com"); ok {
			t.Fatal("a member got a new invitation")
		}
		unchanged(t)
	})

	t.Run("org deleted during the invite", func(t *testing.T) {
		reset(t, "")
		deletion := db.Begin()
		if err := deletion.Exec(`DELETE FROM public.orgs WHERE id = ?`, doomedID).Error; err != nil {
			deletion.Rollback()
			t.Fatal(err)
		}
		var createErr error
		done := make(chan struct{})
		go func() {
			defer close(done)
			_, createErr = store.Create(ctx, ownerID, doomedID, "sam@example.com", "developer")
		}()
		waitForLockWaiters(t, deletion, 1)
		if err := deletion.Commit().Error; err != nil {
			t.Fatal(err)
		}
		<-done
		if !errors.Is(createErr, ErrOrgNotFound) {
			t.Fatalf("create: %v", createErr)
		}
		unchanged(t)
	})

	// The renewal holds the invitation row and needs the org row. The deletion holds the org row
	// and cascades to the invitation row. Neither may deadlock.
	t.Run("expired invitation renewed while the org is deleted", func(t *testing.T) {
		reset(t, `INSERT INTO public.invitations (id, org_id, email, role, started_at, last_sent_at, invited_by_email)
			VALUES ('`+renewID+`', '`+doomedID+`', 'sam@example.com', 'developer', now() - interval '8 days', now() - interval '8 days', 'alex@example.com')`)
		// The blocker holds the invitation row, so the renewal waits at the upsert until the deletion starts.
		blocker := db.Begin()
		if err := blocker.Exec(`SELECT 1 FROM public.invitations WHERE id = ? FOR UPDATE`, renewID).Error; err != nil {
			blocker.Rollback()
			t.Fatal(err)
		}
		var createErr, deleteErr error
		created, deleted := make(chan struct{}), make(chan struct{})
		go func() {
			defer close(created)
			_, createErr = store.Create(ctx, ownerID, doomedID, "sam@example.com", "developer")
		}()
		waitForLockWaiters(t, blocker, 1)
		go func() {
			defer close(deleted)
			deleteErr = db.WithContext(ctx).Exec(`DELETE FROM public.orgs WHERE id = ?`, doomedID).Error
		}()
		waitForLockWaiters(t, blocker, 2)
		if err := blocker.Commit().Error; err != nil {
			t.Fatal(err)
		}
		<-created
		<-deleted
		if createErr != nil || deleteErr != nil {
			t.Fatalf("create: %v, delete: %v", createErr, deleteErr)
		}
		if n := count(t, `SELECT count(*) FROM public.invitations WHERE org_id = ?`, doomedID); n != 0 {
			t.Fatalf("invitations of the deleted org = %d", n)
		}
	})
}
