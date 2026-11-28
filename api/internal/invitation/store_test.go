package invitation

import (
	"context"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestStoreListFailure(t *testing.T) {
	for _, canceled := range []bool{false, true} {
		t.Run(map[bool]string{false: "database error", true: "canceled context"}[canceled], func(t *testing.T) {
			connection, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			defer connection.Close()
			db, err := gorm.Open(postgres.New(postgres.Config{Conn: connection}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			if err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			failure := errors.New("database unavailable")
			if canceled {
				cancel()
				failure = context.Canceled
			} else {
				mock.ExpectQuery("SELECT").WithArgs(expiryDays, "org-123", "user-123").WillReturnError(failure)
			}
			got, visible, err := (Store{DB: db}).List(ctx, "user-123", "org-123")
			if !errors.Is(err, failure) || visible || len(got) != 0 {
				t.Fatalf("got=%v visible=%v err=%v", got, visible, err)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
