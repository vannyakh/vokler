#!/bin/sh
# Run ARQ worker + FastAPI in one container (production / Railway single service).
# For dev, prefer api/docker-compose.yml with separate `worker` service instead.
PORT="${PORT:-8000}"

uv run arq app.workers.tasks.WorkerSettings &
WORKER_PID=$!

term_handler() {
  kill "$WORKER_PID" 2>/dev/null || true
  kill "$UVICORN_PID" 2>/dev/null || true
}
trap term_handler TERM INT

uv run uvicorn app.main:app --host 0.0.0.0 --port "$PORT" &
UVICORN_PID=$!
wait "$UVICORN_PID"
EXIT_CODE=$?

kill "$WORKER_PID" 2>/dev/null || true
wait "$WORKER_PID" 2>/dev/null || true
exit "$EXIT_CODE"
