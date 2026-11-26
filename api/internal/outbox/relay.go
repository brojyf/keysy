// Package outbox publishes rows of public.outbox to Kafka.
package outbox

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
	"gorm.io/gorm"
)

const (
	batchSize      = 100
	pollInterval   = time.Second
	publishTimeout = 10 * time.Second
)

// producer is the part of *kgo.Client the relay uses.
type producer interface {
	ProduceSync(ctx context.Context, records ...*kgo.Record) kgo.ProduceResults
}

// Relay locks a batch of rows, publishes them, and deletes them in one transaction.
// A row is deleted only after Kafka acknowledges its record; rows whose records fail stay.
// If api stops after the acknowledgment and before the commit, the rows are published
// again with the same event_id, and consumers deduplicate by event_id.
type Relay struct {
	DB       *gorm.DB
	Producer producer
}

// Run publishes until ctx is canceled. A full batch starts the next one at once;
// otherwise the relay waits pollInterval.
func (r Relay) Run(ctx context.Context) {
	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}
		published, err := r.publishBatch(ctx)
		if err != nil && ctx.Err() == nil {
			// Never log payloads: they contain email addresses.
			slog.ErrorContext(ctx, "outbox relay failed", "error", err)
		}
		if err == nil && published == batchSize {
			timer.Reset(0)
		} else {
			timer.Reset(pollInterval)
		}
	}
}

type outboxRow struct {
	EventID   string
	Type      string
	Payload   []byte
	CreatedAt time.Time
}

func (r Relay) publishBatch(ctx context.Context) (int, error) {
	published := 0
	var publishErr error
	err := r.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		rows, err := lockBatch(tx)
		if err != nil || len(rows) == 0 {
			return err
		}
		var acknowledged []string
		acknowledged, publishErr = r.publish(ctx, rows)
		if len(acknowledged) == 0 {
			return nil
		}
		if err := tx.Exec(`DELETE FROM public.outbox WHERE event_id IN ?`, acknowledged).Error; err != nil {
			return err
		}
		published = len(acknowledged)
		return nil
	})
	return published, errors.Join(err, publishErr)
}

// lockBatch locks the oldest rows. SKIP LOCKED lets more than one api machine relay
// without publishing the same row twice.
func lockBatch(tx *gorm.DB) ([]outboxRow, error) {
	var rows []outboxRow
	err := tx.Raw(`SELECT event_id, type, payload, created_at FROM public.outbox
		ORDER BY created_at LIMIT ? FOR UPDATE SKIP LOCKED`, batchSize).Scan(&rows).Error
	return rows, err
}

// publish sends rows to Kafka. It returns the event IDs Kafka acknowledged and the first error.
func (r Relay) publish(ctx context.Context, rows []outboxRow) ([]string, error) {
	records := make([]*kgo.Record, len(rows))
	eventIDs := make(map[*kgo.Record]string, len(rows))
	for i, row := range rows {
		records[i] = kafkaRecord(row)
		eventIDs[records[i]] = row.EventID
	}
	ctx, cancel := context.WithTimeout(ctx, publishTimeout)
	defer cancel()
	// Results come in completion order, so match them to rows by record.
	var acknowledged []string
	var firstErr error
	for _, result := range r.Producer.ProduceSync(ctx, records...) {
		if result.Err == nil {
			acknowledged = append(acknowledged, eventIDs[result.Record])
		} else if firstErr == nil {
			firstErr = result.Err
		}
	}
	return acknowledged, firstErr
}

// kafkaRecord follows the Debezium outbox mapping: the payload is the value and the
// event ID is the "id" header. The record has no key because no consumer needs ordering.
func kafkaRecord(row outboxRow) *kgo.Record {
	return &kgo.Record{
		Topic:     "keysy." + row.Type,
		Value:     row.Payload,
		Timestamp: row.CreatedAt,
		Headers:   []kgo.RecordHeader{{Key: "id", Value: []byte(row.EventID)}},
	}
}
