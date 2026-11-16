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

func TestProfile(t *testing.T) {
	for _, missing := range []bool{false, true} {
		db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
		if err != nil {
			t.Fatal(err)
		}
		gdb, err := gorm.Open(postgres.New(postgres.Config{Conn: db}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
		if err != nil {
			t.Fatal(err)
		}
		rows := sqlmock.NewRows([]string{"display_name", "agent_auto_apply", "purge_at"})
		if !missing {
			rows.AddRow("Ada", true, nil)
		}
		mock.ExpectQuery("SELECT display_name, agent_auto_apply, deleted_at + interval '30 days' AS purge_at FROM public.profiles WHERE id = $1").WithArgs("user").WillReturnRows(rows)
		got, err := (Store{DB: gdb}).Profile(context.Background(), "user")
		if missing {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				t.Fatalf("missing: %v", err)
			}
		} else if err != nil || got.DisplayName != "Ada" || !got.AgentAutoApply || got.PurgeAt != nil {
			t.Fatalf("profile=%+v err=%v", got, err)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatal(err)
		}
		db.Close()
	}
}
