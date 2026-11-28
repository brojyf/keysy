#!/usr/bin/env bash
# Apply every migration to a disposable Supabase Postgres container, then run
# the api tests against it. The same script runs locally and in CI.
# Extra arguments go to go test.
set -euo pipefail

source "$(dirname "$0")/supabase-test-db.sh"
PORT=54329
start_test_db -p "127.0.0.1:$PORT:5432"

cd "$ROOT/api"
# Store tests in different packages share one database, so packages run one at a time.
KEYSY_TEST_DATABASE_URL="postgres://supabase_admin:postgres@127.0.0.1:$PORT/postgres?sslmode=disable" \
  go test -race -cover -p 1 "$@" ./...
