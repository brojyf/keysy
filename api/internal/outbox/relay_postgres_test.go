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

const (
	auditEventID = "30000000-0000-0000-0000-000000000001"
	emailEventID = "30000000-0000-0000-0000-000000000002"
)

type fakeProducer struct {
	err error
	// failTopic fails only the records of this topic.
	failTopic string
	// failCalls fails every record of the first failCalls calls.
	failCalls int
	calls     int
	published []*kgo.Record
}

// ProduceSync returns results in reverse order because franz-go returns them in completion order.
func (p *fakeProducer) ProduceSync(_ context.Context, records ...*kgo.Record) kgo.ProduceResults {
	p.calls++
	results := make(kgo.ProduceResults, len(records))
	for i, record := range records {
		err := p.err
		if p.calls <= p.failCalls {
			err = errors.New("broker unavailable")
		}
		if record.Topic == p.failTopic {
			err = errors.New("topic authorization failed")
		}
		if err == nil {
			p.published = append(p.published, record)
		}
		results[len(records)-1-i] = kgo.ProduceResult{Record: record, Err: err}
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
		if err := db.Exec(`TRUNCATE public.outbox`).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Exec(`INSERT INTO public.outbox (event_id, type, payload, created_at) VALUES
			(?, 'audit', '{"action": "member_removed"}', '2026-11-24T10:00:00Z'),
			(?, 'email', '{"to": "ada@example.com"}', '2026-11-24T10:00:01Z')`, auditEventID, emailEventID).Error; err != nil {
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
			len(audit.Headers) != 1 || audit.Headers[0].Key != "id" || string(audit.Headers[0].Value) != auditEventID {
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

	t.Run("deletes only acknowledged rows", func(t *testing.T) {
		reset(t)
		producer := &fakeProducer{failTopic: "keysy.email"}
		if _, err := (Relay{DB: db, Producer: producer}).publishBatch(ctx); err == nil {
			t.Fatal("partial publish failure not returned")
		}
		if remaining := remainingEventIDs(t, db); !slices.Equal(remaining, []string{emailEventID}) {
			t.Fatalf("unexpected rows left: %v", remaining)
		}
	})

	t.Run("skips rows another relay holds", func(t *testing.T) {
		reset(t)
		other := db.WithContext(ctx).Begin()
		if err := other.Exec(`SELECT 1 FROM public.outbox WHERE event_id = ? FOR UPDATE`, auditEventID).Error; err != nil {
			t.Fatal(err)
		}
		producer := &fakeProducer{}
		published, err := Relay{DB: db, Producer: producer}.publishBatch(ctx)
		if err := other.Rollback().Error; err != nil {
			t.Fatal(err)
		}
		if err != nil || published != 1 || string(producer.published[0].Headers[0].Value) != emailEventID {
			t.Fatalf("published=%d err=%v", published, err)
		}
		if remaining := remainingEventIDs(t, db); !slices.Equal(remaining, []string{auditEventID}) {
			t.Fatalf("unexpected rows left: %v", remaining)
		}
	})

	// runUntilDrained runs the relay until the outbox is empty, then stops it.
	runUntilDrained := func(t *testing.T, producer *fakeProducer) {
		t.Helper()
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
	}

	t.Run("run drains and stops", func(t *testing.T) {
		reset(t)
		runUntilDrained(t, &fakeProducer{})
	})

	t.Run("run retries after a failed publish", func(t *testing.T) {
		reset(t)
		producer := &fakeProducer{failCalls: 1}
		runUntilDrained(t, producer)
		if producer.calls != 2 || len(producer.published) != 2 {
			t.Fatalf("calls=%d published=%d, want 2 calls and 2 records", producer.calls, len(producer.published))
		}
	})
}
