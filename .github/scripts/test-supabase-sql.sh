#!/usr/bin/env bash
# Apply every migration to a disposable Supabase Postgres container, then run
# every supabase/tests/*.sql file. The same script runs locally and in CI.
# GoTrue is absent, so only migrations that mention auth.sessions skip the
# function body check. The session tests create a matching auth.sessions stub.
set -euo pipefail

IMAGE="supabase/postgres:17.11.0.017"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="keysy-sql-tests-$$"

docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

# Usage: psql_in_container <role> [psql args]. Production migrations run as postgres.
# Postgres options come from the caller's PGOPTIONS.
psql_in_container() {
  local role="$1"
  shift
  docker exec -i -e PGOPTIONS "$CONTAINER" \
    psql -U "$role" -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

# The image restarts Postgres during initialization, so require two ready checks in a row.
for _ in $(seq 1 60); do
  if psql_in_container supabase_admin -c 'select 1' >/dev/null 2>&1; then
    sleep 3
    psql_in_container supabase_admin -c 'select 1' >/dev/null 2>&1 && break
  fi
  sleep 1
done
psql_in_container supabase_admin -c 'select 1' >/dev/null

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate $(basename "$migration")"
  if grep -q 'auth\.sessions' "$migration"; then
    PGOPTIONS='-c check_function_bodies=off' psql_in_container postgres -o /dev/null <"$migration"
  else
    psql_in_container postgres -o /dev/null <"$migration"
  fi
done

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
