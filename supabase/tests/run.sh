#!/usr/bin/env bash
# Applies the migrations to a scratch Postgres database and runs the behaviour tests.
# Usage: PSQL="psql -h localhost -U postgres" supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}
$PSQL -q -c "drop database if exists crm_test" -c "create database crm_test"
$PSQL -q -d crm_test -v ON_ERROR_STOP=1 -f tests/supabase_stub.sql
for f in migrations/*.sql; do $PSQL -q -d crm_test -v ON_ERROR_STOP=1 -f "$f"; done
$PSQL -q -d crm_test -v ON_ERROR_STOP=1 -f tests/grants.sql
$PSQL -q -d crm_test -v ON_ERROR_STOP=1 -f tests/behaviour.sql 2>&1 | grep -E "NOTICE|ERROR|FAILED|PASSED"
