#!/usr/bin/env bash
# Apply every migration to a disposable Supabase Postgres container, then run
# every supabase/tests/*.sql file. The same script runs locally and in CI.
set -euo pipefail

source "$(dirname "$0")/supabase-test-db.sh"
start_test_db

failed=0
for test_file in "$ROOT"/supabase/tests/*.sql; do
  if psql_in_container supabase_admin <"$test_file" >/dev/null; then
    echo "ok   $(basename "$test_file")"
  else
    echo "FAIL $(basename "$test_file")"
    failed=1
  fi
done
exit "$failed"
