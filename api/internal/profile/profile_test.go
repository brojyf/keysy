package profile

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestScheduleDeletion(t *testing.T) {
	for _, scenario := range []string{"success", "owner", "missing", "lock error", "owner query error", "update error", "revoke error"} {
		t.Run(scenario, func(t *testing.T) {
			db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			gdb, err := gorm.Open(postgres.New(postgres.Config{Conn: db}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			if err != nil {
				t.Fatal(err)
			}
			failure := errors.New("database error")
			mock.ExpectBegin()
			lock := mock.ExpectQuery("SELECT 1 FROM public.profiles WHERE id = $1 FOR UPDATE").WithArgs("user")
			if scenario == "lock error" {
				lock.WillReturnError(failure)
			} else if scenario == "missing" {
				lock.WillReturnRows(sqlmock.NewRows([]string{"?column?"}))
			} else {
				lock.WillReturnRows(sqlmock.NewRows([]string{"?column?"}).AddRow(1))
				owner := mock.ExpectQuery("SELECT orgs.id, orgs.name FROM public.members AS members JOIN public.orgs AS orgs ON orgs.id = members.org_id WHERE members.user_id = $1 AND members.role = 'owner' ORDER BY orgs.name, orgs.id").WithArgs("user")
				if scenario == "owner query error" {
					owner.WillReturnError(failure)
				} else {
					rows := sqlmock.NewRows([]string{"id", "name"})
					if scenario == "owner" {
						rows.AddRow("org-1", "platform").AddRow("org-2", "web")
					}
					owner.WillReturnRows(rows)
					if scenario != "owner" {
						update := mock.ExpectExec(strings.Replace(scheduleDeletionSQL, "?", "$1", 1)).WithArgs("user")
						if scenario == "update error" {
							update.WillReturnError(failure)
						} else {
							update.WillReturnResult(sqlmock.NewResult(0, 0))
							revoke := mock.ExpectExec("SELECT public.revoke_all_user_sessions($1)").WithArgs("user")
							if scenario == "revoke error" {
								revoke.WillReturnError(failure)
							} else {
								revoke.WillReturnResult(sqlmock.NewResult(0, 1))
							}
						}
					}
				}
			}
			if scenario == "success" {
				mock.ExpectCommit()
			} else {
				mock.ExpectRollback()
			}
			got := (Store{DB: gdb}).ScheduleDeletion(context.Background(), "user")
			switch scenario {
			case "success":
				if got != nil {
					t.Fatal(got)
				}
			case "owner":
				var owner *OrgOwnerError
				if !errors.As(got, &owner) || !reflect.DeepEqual(owner.Orgs, []OwnedOrg{{ID: "org-1", Name: "platform"}, {ID: "org-2", Name: "web"}}) {
					t.Fatal(got)
				}
			case "missing":
				if !errors.Is(got, gorm.ErrRecordNotFound) {
					t.Fatal(got)
				}
			default:
				if !errors.Is(got, failure) {
					t.Fatal(got)
				}
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestCancelDeletion(t *testing.T) {
	for _, tc := range []struct {
		scenario  string
		rows      int64
		updateErr error
		exists    *bool
		existsErr error
		want      error
	}{
		// Only a pending deletion is written; the existence check never runs.
		{scenario: "pending", rows: 1},
		{scenario: "active", exists: new(true)},
		{scenario: "purged", exists: new(false), want: gorm.ErrRecordNotFound},
		{scenario: "update error", updateErr: errors.New("update error"), want: errors.New("update error")},
		{scenario: "exists error", existsErr: errors.New("exists error"), want: errors.New("exists error")},
	} {
		t.Run(tc.scenario, func(t *testing.T) {
			db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			gdb, err := gorm.Open(postgres.New(postgres.Config{Conn: db}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			if err != nil {
				t.Fatal(err)
			}
			update := mock.ExpectExec("UPDATE public.profiles SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL").WithArgs("user")
			if tc.updateErr != nil {
				update.WillReturnError(tc.updateErr)
			} else {
				update.WillReturnResult(sqlmock.NewResult(0, tc.rows))
			}
			if tc.exists != nil || tc.existsErr != nil {
				query := mock.ExpectQuery("SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = $1)").WithArgs("user")
				if tc.existsErr != nil {
					query.WillReturnError(tc.existsErr)
				} else {
					query.WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(*tc.exists))
				}
			}
			got := (Store{DB: gdb}).CancelDeletion(context.Background(), "user")
			if (got == nil) != (tc.want == nil) || (got != nil && got.Error() != tc.want.Error()) {
				t.Fatalf("error = %v, want %v", got, tc.want)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
