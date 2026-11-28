package org

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/brojyf/keysy/api/internal/pgtest"
)

func TestStoreDeletePostgres(t *testing.T) {
	db := pgtest.Open(t)
	connection, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	connection.SetMaxOpenConns(8)
	const (
		owner     = "10000000-0000-0000-0000-000000000001"
		admin     = "10000000-0000-0000-0000-000000000002"
		developer = "10000000-0000-0000-0000-000000000003"
		stranger  = "10000000-0000-0000-0000-000000000004"
	)
	if err := db.Exec(`INSERT INTO auth.users (id, email) VALUES
 ('10000000-0000-0000-0000-000000000001', 'owner@example.com'),
 ('10000000-0000-0000-0000-000000000002', 'admin@example.com'),
 ('10000000-0000-0000-0000-000000000003', 'developer@example.com'),
 ('10000000-0000-0000-0000-000000000004', 'stranger@example.com');
 INSERT INTO public.orgs (id, name) VALUES ('20000000-0000-0000-0000-000000000001', 'Acme');
 INSERT INTO public.members (org_id, user_id, role) VALUES
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'admin'),
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'developer')`).Error; err != nil {
		t.Fatal(err)
	}
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	const orgID = "20000000-0000-0000-0000-000000000001"
	for _, userID := range []string{admin, developer, stranger} {
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
			ok, err := store.Delete(ctx, owner, orgID)
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
		if ok, err := store.Delete(ctx, owner, id); err != nil || ok {
			t.Fatalf("retry or missing: completed=%v err=%v", ok, err)
		}
	}
}

func TestStoreListPostgres(t *testing.T) {
	db := pgtest.Open(t)
	const (
		active        = "10000000-0000-0000-0000-000000000001"
		deleting      = "10000000-0000-0000-0000-000000000002"
		noMemberships = "10000000-0000-0000-0000-000000000009"
	)
	if err := db.Exec(`INSERT INTO auth.users (id, email) VALUES
 ('10000000-0000-0000-0000-000000000001', 'active@example.com'),
 ('10000000-0000-0000-0000-000000000002', 'deleting@example.com'),
 ('10000000-0000-0000-0000-000000000003', 'other@example.com');
 UPDATE public.profiles SET deleted_at = now() WHERE id = '10000000-0000-0000-0000-000000000002';
 INSERT INTO public.orgs (id, name) VALUES
 ('20000000-0000-0000-0000-000000000001', 'Zulu'),
 ('20000000-0000-0000-0000-000000000002', 'Alpha');
 INSERT INTO public.members (org_id, user_id, role) VALUES
 ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'owner'),
 ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'developer')`).Error; err != nil {
		t.Fatal(err)
	}
	store := Store{DB: db}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	got, err := store.List(ctx, active)
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
	got, err = store.List(ctx, deleting)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("deleting caller memberships=%v, want non-nil empty list", got)
	}
	got, err = store.List(ctx, noMemberships)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("no-membership caller memberships=%v, want non-nil empty list", got)
	}
}
