package profile

import (
	"context"
	"errors"
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
				owner := mock.ExpectQuery("SELECT EXISTS (SELECT 1 FROM public.members WHERE user_id = $1 AND role = 'owner')").WithArgs("user")
				if scenario == "owner query error" {
					owner.WillReturnError(failure)
				} else {
					owner.WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(scenario == "owner"))
					if scenario != "owner" {
						update := mock.ExpectExec("UPDATE public.profiles SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL").WithArgs("user")
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
				if !errors.Is(got, ErrOrgOwner) {
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
	for _, scenario := range []string{"success", "database error"} {
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
			update := mock.ExpectExec("UPDATE public.profiles SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL").WithArgs("user")
			if scenario == "database error" {
				update.WillReturnError(errors.New("database error"))
			} else {
				update.WillReturnResult(sqlmock.NewResult(0, 0))
			}
			got := (Store{DB: gdb}).CancelDeletion(context.Background(), "user")
			if scenario == "database error" {
				if got == nil || got.Error() != "database error" {
					t.Fatalf("error = %v", got)
				}
			} else if got != nil {
				t.Fatal(got)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
