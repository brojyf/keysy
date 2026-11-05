package org

import (
	"context"
	"errors"
	"reflect"
	"testing"

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

func TestStoreCreate(t *testing.T) {
	for _, scenario := range []string{"success", "org failure", "membership failure", "commit failure", "begin failure"} {
		t.Run(scenario, func(t *testing.T) {
			store, mock := testStore(t)
			failure := errors.New("database unavailable")
			begin := mock.ExpectBegin()
			if scenario == "begin failure" {
				begin.WillReturnError(failure)
			} else {
				insert := mock.ExpectQuery(`INSERT INTO "public"."orgs" ("name") VALUES ($1) RETURNING "id"`).WithArgs("Platform")
				if scenario == "org failure" {
					insert.WillReturnError(failure)
					mock.ExpectRollback()
				} else {
					insert.WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("org-123"))
					membership := mock.ExpectExec(`INSERT INTO "public"."members" ("org_id","user_id","role") VALUES ($1,$2,$3)`).WithArgs("org-123", "user-123", "owner")
					if scenario == "membership failure" {
						membership.WillReturnError(failure)
						mock.ExpectRollback()
					} else {
						membership.WillReturnResult(sqlmock.NewResult(0, 1))
						commit := mock.ExpectCommit()
						if scenario == "commit failure" {
							commit.WillReturnError(failure)
						}
					}
				}
			}
			organization, err := store.Create(context.Background(), "user-123", "Platform")
			if scenario == "success" {
				if err != nil || organization != (Organization{ID: "org-123", Name: "Platform"}) {
					t.Fatalf("organization=%+v err=%v", organization, err)
				}
			} else if !errors.Is(err, failure) || organization != (Organization{}) {
				t.Fatalf("organization=%+v err=%v", organization, err)
			}
		})
	}
}

func TestStoreList(t *testing.T) {
	for _, scenario := range []string{"memberships", "empty", "database error"} {
		t.Run(scenario, func(t *testing.T) {
			store, mock := testStore(t)
			// The user filter enforces isolation. A second order key stabilizes duplicate names.
			query := mock.ExpectQuery(`SELECT orgs.id, orgs.name, members.role FROM public.orgs AS orgs JOIN public.members AS members ON members.org_id = orgs.id WHERE members.user_id = $1 ORDER BY orgs.name ASC,orgs.id ASC`).WithArgs("user-123")
			want := []Membership{}
			failure := errors.New("database unavailable")
			if scenario == "database error" {
				query.WillReturnError(failure)
			} else {
				rows := sqlmock.NewRows([]string{"id", "name", "role"})
				if scenario == "memberships" {
					rows.AddRow("org-1", "Platform", "owner").AddRow("org-2", "Platform", "developer").AddRow("org-3", "Services", "admin")
					want = []Membership{{ID: "org-1", Name: "Platform", Role: "owner"}, {ID: "org-2", Name: "Platform", Role: "developer"}, {ID: "org-3", Name: "Services", Role: "admin"}}
				}
				query.WillReturnRows(rows)
			}
			memberships, err := store.List(context.Background(), "user-123")
			if scenario == "database error" {
				if !errors.Is(err, failure) {
					t.Fatal(err)
				}
			} else if err != nil || !reflect.DeepEqual(memberships, want) {
				t.Fatalf("memberships=%+v err=%v", memberships, err)
			}
		})
	}
}

func TestStoreCanceledContext(t *testing.T) {
	for _, operation := range []string{"create", "list"} {
		t.Run(operation, func(t *testing.T) {
			store, _ := testStore(t)
			ctx, cancel := context.WithCancel(context.Background())
			cancel()
			var err error
			if operation == "create" {
				_, err = store.Create(ctx, "user-123", "Platform")
			} else {
				_, err = store.List(ctx, "user-123")
			}
			if !errors.Is(err, context.Canceled) {
				t.Fatalf("canceled request did not reach database context: %v", err)
			}
		})
	}
}
