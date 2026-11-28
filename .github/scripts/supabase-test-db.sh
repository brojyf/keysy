#!/usr/bin/env bash
# Sourced by test-supabase-sql.sh and test-api-postgres.sh. It starts a
# disposable Supabase Postgres container, applies every migration, and adds
# the auth.sessions stub. The container is removed when the caller exits.

IMAGE="supabase/postgres:17.11.0.017"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER="keysy-test-db-$$"

# Usage: psql_in_container <role> [psql args]. Production migrations run as postgres.
# Postgres options come from the caller's PGOPTIONS.
psql_in_container() {
  local role="$1"
  shift
  docker exec -i -e PGOPTIONS "$CONTAINER" \
    psql -U "$role" -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

# Usage: start_test_db [docker run options]
start_test_db() {
  docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres "$@" "$IMAGE" >/dev/null
  trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

  # The image restarts Postgres during initialization, so require two ready checks in a row.
  for _ in $(seq 1 60); do
    if psql_in_container supabase_admin -c 'select 1' >/dev/null 2>&1; then
      sleep 3
      psql_in_container supabase_admin -c 'select 1' >/dev/null 2>&1 && break
    fi
    sleep 1
  done
  psql_in_container supabase_admin -c 'select 1' >/dev/null

  # GoTrue is absent, so only migrations that mention auth.sessions skip the
  # function body check. The stub then creates a matching auth.sessions.
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    echo "migrate $(basename "$migration")"
    if grep -q 'auth\.sessions' "$migration"; then
      PGOPTIONS='-c check_function_bodies=off' psql_in_container postgres -o /dev/null <"$migration"
    else
      psql_in_container postgres -o /dev/null <"$migration"
    fi
  done
  psql_in_container supabase_admin -o /dev/null <"$ROOT/supabase/tests/stubs/auth_sessions.sql"
}
