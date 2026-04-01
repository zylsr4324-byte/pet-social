#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" 2>/dev/null || true
  fi
}

cd /app/api
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!

trap cleanup EXIT INT TERM

cd /app/web
HOSTNAME=0.0.0.0 PORT="${PORT:-3000}" node server.js &
WEB_PID=$!

wait -n "${API_PID}" "${WEB_PID}"
EXIT_CODE=$?

kill "${API_PID}" "${WEB_PID}" 2>/dev/null || true
wait "${API_PID}" "${WEB_PID}" 2>/dev/null || true

exit "${EXIT_CODE}"
