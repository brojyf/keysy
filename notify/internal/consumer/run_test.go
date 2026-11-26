package consumer

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kfake"
	"github.com/twmb/franz-go/pkg/kgo"
)

func TestRunCommits(t *testing.T) {
	cluster, err := kfake.NewCluster(kfake.SeedTopics(1, "keysy.email"))
	if err != nil {
		t.Fatal(err)
	}
	defer cluster.Close()
	producer, err := kgo.NewClient(kgo.SeedBrokers(cluster.ListenAddrs()...))
	if err != nil {
		t.Fatal(err)
	}
	defer producer.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	for range 2 {
		err = producer.ProduceSync(ctx, &kgo.Record{Topic: "keysy.email", Headers: []kgo.RecordHeader{{Key: "id", Value: []byte("event")}}, Value: []byte(`{"to":"alice@example.com","template":{"id":"welcome"}}`)}).FirstErr()
		if err != nil {
			t.Fatal(err)
		}
	}
	client, err := kgo.NewClient(kgo.SeedBrokers(cluster.ListenAddrs()...), kgo.ConsumerGroup("notify"), kgo.ConsumeTopics("keysy.email"), kgo.DisableAutoCommit(), kgo.ConsumeResetOffset(kgo.NewOffset().AtStart()))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	signal := make(chan struct{}, 2)
	sender := &fakeSender{signal: signal}
	done := make(chan struct{})
	go func() {
		defer close(done)
		(Consumer{Client: client, Sender: sender, Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Now: time.Now}).Run(ctx)
	}()
	defer func() { cancel(); <-done }()
	for range 2 {
		select {
		case <-signal:
		case <-ctx.Done():
			t.Fatal("timed out waiting for sends")
		}
	}
	admin := kadm.NewClient(producer)
	for {
		offsets, e := admin.FetchOffsets(ctx, "notify")
		if e == nil {
			if offset, ok := offsets.Lookup("keysy.email", 0); ok && offset.Err == nil && offset.At == 2 {
				break
			}
		}
		select {
		case <-ctx.Done():
			t.Fatal("timed out waiting for committed offset")
		case <-time.After(50 * time.Millisecond):
		}
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not return")
	}
}
