package session

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testStore(t *testing.T) (Store, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Error(err)
		}
		_ = db.Close()
	})
	gormDB, err := gorm.Open(postgres.New(postgres.Config{Conn: db}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	return Store{DB: gormDB}, mock
}

func TestStoreList(t *testing.T) {
	for _, scenario := range []string{"sessions", "empty", "database error"} {
		t.Run(scenario, func(t *testing.T) {
			store, mock := testStore(t)
			query := mock.ExpectQuery(`SELECT id, coalesce(user_agent, '') AS user_agent, last_used_at
		FROM public.list_user_sessions($1)`).WithArgs("user-123")
			lastUsed := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
			want := []Session{}
			failure := errors.New("database unavailable")
			if scenario == "database error" {
				query.WillReturnError(failure)
			} else {
				rows := sqlmock.NewRows([]string{"id", "user_agent", "last_used_at"})
				if scenario == "sessions" {
					rows.AddRow("session-1", "Chrome", lastUsed).AddRow("session-2", "", lastUsed)
					want = []Session{{ID: "session-1", UserAgent: "Chrome", LastUsedAt: lastUsed}, {ID: "session-2", LastUsedAt: lastUsed}}
				}
				query.WillReturnRows(rows)
			}
			sessions, err := store.List(context.Background(), "user-123")
			if scenario == "database error" {
				if !errors.Is(err, failure) {
					t.Fatal(err)
				}
			} else if err != nil || !reflect.DeepEqual(sessions, want) {
				t.Fatalf("sessions=%+v err=%v", sessions, err)
			}
		})
	}
}

func TestStoreRevoke(t *testing.T) {
	for _, scenario := range []string{"revoked", "not found", "database error"} {
		t.Run(scenario, func(t *testing.T) {
			store, mock := testStore(t)
			failure := errors.New("database unavailable")
			query := mock.ExpectQuery(`SELECT public.revoke_user_session($1, $2)`).WithArgs("user-123", "session-1")
			if scenario == "database error" {
				query.WillReturnError(failure)
			} else {
				query.WillReturnRows(sqlmock.NewRows([]string{"revoke_user_session"}).AddRow(scenario == "revoked"))
			}
			revoked, err := store.Revoke(context.Background(), "user-123", "session-1")
			if scenario == "database error" {
				if !errors.Is(err, failure) || revoked {
					t.Fatalf("revoked=%v err=%v", revoked, err)
				}
			} else if err != nil || revoked != (scenario == "revoked") {
				t.Fatalf("revoked=%v err=%v", revoked, err)
			}
		})
	}
}

func TestStoreCanceledContext(t *testing.T) {
	for _, operation := range []string{"list", "revoke"} {
		t.Run(operation, func(t *testing.T) {
			store, _ := testStore(t)
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			var err error
			if operation == "list" {
				_, err = store.List(ctx, "user-123")
			} else {
				_, err = store.Revoke(ctx, "user-123", "session-1")
			}
			if !errors.Is(err, context.Canceled) {
				t.Fatalf("canceled request did not reach database context: %v", err)
			}
		})
	}
}
