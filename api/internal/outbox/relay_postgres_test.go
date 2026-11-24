package outbox

import (
	"context"
	"errors"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type fakeProducer struct {
	err       error
	published []*kgo.Record
}

func (p *fakeProducer) ProduceSync(_ context.Context, records ...*kgo.Record) kgo.ProduceResults {
	results := make(kgo.ProduceResults, len(records))
	for i, record := range records {
		results[i] = kgo.ProduceResult{Record: record, Err: p.err}
	}
	if p.err == nil {
		p.published = append(p.published, records...)
	}
	return results
}

func remainingEventIDs(t *testing.T, db *gorm.DB) []string {
	t.Helper()
	var eventIDs []string
	if err := db.Raw(`SELECT event_id FROM public.outbox ORDER BY event_id`).Scan(&eventIDs).Error; err != nil {
		t.Fatal(err)
	}
	return eventIDs
}

func TestRelayPostgres(t *testing.T) {
	databaseURL := os.Getenv("KEYSY_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("KEYSY_TEST_DATABASE_URL must point to an empty, isolated PostgreSQL test database")
	}
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	connection, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	if err := db.Exec(`CREATE TABLE public.outbox (
		event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
		type text NOT NULL CHECK (type IN ('audit', 'email')),
		payload jsonb NOT NULL,
		created_at timestamptz NOT NULL DEFAULT now())`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP TABLE public.outbox`).Error; err != nil {
			t.Error(err)
		}
	})
	reset := func(t *testing.T) {
		t.Helper()
		if err := db.Exec(`TRUNCATE public.outbox;
			INSERT INTO public.outbox (event_id, type, payload, created_at) VALUES
			('30000000-0000-0000-0000-000000000001', 'audit', '{"action": "member_removed"}', '2026-11-24T10:00:00Z'),
			('30000000-0000-0000-0000-000000000002', 'email', '{"to": "ada@example.com"}', '2026-11-24T10:00:01Z')`).Error; err != nil {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	t.Run("publishes then deletes", func(t *testing.T) {
		reset(t)
		producer := &fakeProducer{}
		published, err := Relay{DB: db, Producer: producer}.publishBatch(ctx)
		if err != nil || published != 2 || len(producer.published) != 2 {
			t.Fatalf("published=%d records=%d err=%v", published, len(producer.published), err)
		}
		audit := producer.published[0]
		if audit.Topic != "keysy.audit" || string(audit.Value) != `{"action": "member_removed"}` || audit.Key != nil ||
			!audit.Timestamp.Equal(time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)) ||
			len(audit.Headers) != 1 || audit.Headers[0].Key != "id" || string(audit.Headers[0].Value) != "30000000-0000-0000-0000-000000000001" {
			t.Fatalf("unexpected audit record: %+v", audit)
		}
		if producer.published[1].Topic != "keysy.email" {
			t.Fatalf("unexpected email topic: %s", producer.published[1].Topic)
		}
		if remaining := remainingEventIDs(t, db); len(remaining) != 0 {
			t.Fatalf("rows left after publish: %v", remaining)
		}
	})

	t.Run("keeps rows when Kafka fails", func(t *testing.T) {
		reset(t)
		producer := &fakeProducer{err: errors.New("broker unavailable")}
		if _, err := (Relay{DB: db, Producer: producer}).publishBatch(ctx); err == nil {
			t.Fatal("publish failure not returned")
		}
		if remaining := remainingEventIDs(t, db); len(remaining) != 2 {
			t.Fatalf("rows deleted after failed publish: %v", remaining)
		}
	})

	t.Run("skips rows another relay holds", func(t *testing.T) {
		reset(t)
		other := db.WithContext(ctx).Begin()
		if err := other.Exec(`SELECT 1 FROM public.outbox WHERE event_id = '30000000-0000-0000-0000-000000000001' FOR UPDATE`).Error; err != nil {
			t.Fatal(err)
		}
		producer := &fakeProducer{}
		published, err := Relay{DB: db, Producer: producer}.publishBatch(ctx)
		other.Rollback()
		if err != nil || published != 1 || string(producer.published[0].Headers[0].Value) != "30000000-0000-0000-0000-000000000002" {
			t.Fatalf("published=%d err=%v", published, err)
		}
		if remaining := remainingEventIDs(t, db); !slices.Equal(remaining, []string{"30000000-0000-0000-0000-000000000001"}) {
			t.Fatalf("unexpected rows left: %v", remaining)
		}
	})

	t.Run("run drains and stops", func(t *testing.T) {
		reset(t)
		producer := &fakeProducer{}
		runCtx, stop := context.WithCancel(ctx)
		done := make(chan struct{})
		go func() {
			defer close(done)
			Relay{DB: db, Producer: producer}.Run(runCtx)
		}()
		for len(remainingEventIDs(t, db)) != 0 {
			if ctx.Err() != nil {
				t.Fatal("relay did not drain the outbox")
			}
			time.Sleep(10 * time.Millisecond)
		}
		stop()
		<-done
	})
}
