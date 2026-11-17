package org

import (
	"context"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestStoreDeletePostgres(t *testing.T) {
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
	connection.SetMaxOpenConns(8)
	if err := db.Exec(`CREATE TABLE public.orgs (id uuid PRIMARY KEY);
 CREATE TABLE public.members (org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE, user_id text, role text, PRIMARY KEY (org_id, user_id));
 INSERT INTO public.orgs VALUES ('20000000-0000-0000-0000-000000000001');
 INSERT INTO public.members VALUES ('20000000-0000-0000-0000-000000000001', 'owner', 'owner'), ('20000000-0000-0000-0000-000000000001', 'admin', 'admin'), ('20000000-0000-0000-0000-000000000001', 'developer', 'developer')`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP TABLE public.members, public.orgs`).Error; err != nil {
			t.Error(err)
		}
	})
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	const orgID = "20000000-0000-0000-0000-000000000001"
	for _, userID := range []string{"admin", "developer", "stranger"} {
		if completed, err := store.Delete(ctx, userID, orgID); err != nil || completed {
			t.Fatalf("unauthorized deletion: user=%s completed=%v err=%v", userID, completed, err)
		}
	}
	var count int64
	if err := db.Table("public.orgs").Where("id = ?", orgID).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("orgs=%d err=%v", count, err)
	}
	const n = 8
	var completed atomic.Int32
	var requests sync.WaitGroup
	start := make(chan struct{})
	for range n {
		requests.Go(func() {
			<-start
			ok, err := store.Delete(ctx, "owner", orgID)
			if err != nil {
				t.Errorf("deletion: %v", err)
			}
			if ok {
				completed.Add(1)
			}
		})
	}
	close(start)
	requests.Wait()
	if completed.Load() != 1 {
		t.Fatalf("completed=%d, want 1", completed.Load())
	}
	for _, table := range []string{"public.orgs", "public.members"} {
		column := "id"
		if table == "public.members" {
			column = "org_id"
		}
		if err := db.Table(table).Where(column+" = ?", orgID).Count(&count).Error; err != nil || count != 0 {
			t.Fatalf("%s rows=%d err=%v", table, count, err)
		}
	}
	for _, id := range []string{orgID, "20000000-0000-0000-0000-000000000003"} {
		if ok, err := store.Delete(ctx, "owner", id); err != nil || ok {
			t.Fatalf("retry or missing: completed=%v err=%v", ok, err)
		}
	}
}

func TestStoreListPostgres(t *testing.T) {
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
	if err := db.Exec(`CREATE TABLE public.orgs (id uuid PRIMARY KEY, name text);
 CREATE TABLE public.profiles (id text PRIMARY KEY, deleted_at timestamptz);
 CREATE TABLE public.members (org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE, user_id text, role text, PRIMARY KEY (org_id, user_id));
 INSERT INTO public.orgs VALUES
 ('20000000-0000-0000-0000-000000000001', 'Zulu'),
 ('20000000-0000-0000-0000-000000000002', 'Alpha');
 INSERT INTO public.profiles VALUES ('active', NULL), ('deleting', now()), ('other', NULL);
 INSERT INTO public.members VALUES
 ('20000000-0000-0000-0000-000000000001', 'active', 'admin'),
 ('20000000-0000-0000-0000-000000000002', 'active', 'owner'),
 ('20000000-0000-0000-0000-000000000002', 'deleting', 'developer')`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Exec(`DROP TABLE public.members, public.profiles, public.orgs`).Error; err != nil {
			t.Error(err)
		}
	})
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	got, err := store.List(ctx, "active")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("active memberships=%v, want 2", got)
	}
	if got[0].Name != "Alpha" || got[0].Role != "owner" || got[1].Name != "Zulu" || got[1].Role != "admin" {
		t.Fatalf("active memberships=%+v, want name order and roles", got)
	}
	if got[0].MemberCount != 2 {
		t.Fatalf("memberCount=%d, want 2 including deleting member", got[0].MemberCount)
	}
	got, err = store.List(ctx, "deleting")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("deleting caller memberships=%v, want non-nil empty list", got)
	}
	got, err = store.List(ctx, "no-memberships")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("no-membership caller memberships=%v, want non-nil empty list", got)
	}
}
