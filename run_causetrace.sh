#!/usr/bin/env bash
# Start, stop or inspect the CauseTrace backend (port 8000) and frontend (port 5173).
# Both bind to 127.0.0.1 only. Usage: ./run_causetrace.sh start|stop|status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN="$ROOT/.run"
BACKEND_PORT=8000
FRONTEND_PORT=5173
mkdir -p "$RUN"

is_running() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

load_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  command -v node >/dev/null || { echo "Node.js was not found. Install it first (see README_CAUSETRACE.md)."; exit 1; }
}

start() {
  if is_running "$RUN/backend.pid"; then
    echo "Backend already running (PID $(cat "$RUN/backend.pid"))."
  else
    port_busy "$BACKEND_PORT" && { echo "Port $BACKEND_PORT is already in use by another process. Stop it first."; exit 1; }
    echo "Starting backend (single worker)..."
    cd "$ROOT"
    nohup .venv/bin/python -m uvicorn api:app --host 127.0.0.1 --port "$BACKEND_PORT" \
      > "$RUN/backend.log" 2>&1 < /dev/null &
    echo $! > "$RUN/backend.pid"
  fi

  if is_running "$RUN/frontend.pid"; then
    echo "Frontend already running (PID $(cat "$RUN/frontend.pid"))."
  else
    port_busy "$FRONTEND_PORT" && { echo "Port $FRONTEND_PORT is already in use by another process. Stop it first."; exit 1; }
    load_node
    echo "Starting frontend..."
    cd "$ROOT/frontend"
    nohup ./node_modules/.bin/vite --host 127.0.0.1 --port "$FRONTEND_PORT" \
      > "$RUN/frontend.log" 2>&1 < /dev/null &
    echo $! > "$RUN/frontend.pid"
  fi

  echo -n "Waiting for the backend to load the data (this can take a while)"
  for _ in $(seq 1 90); do
    if curl -s -m 2 "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null; then
      echo; echo "Ready: open http://127.0.0.1:$FRONTEND_PORT  (API docs: http://127.0.0.1:$BACKEND_PORT/docs)"
      return
    fi
    is_running "$RUN/backend.pid" || { echo; echo "Backend exited. See $RUN/backend.log"; exit 1; }
    echo -n "."; sleep 2
  done
  echo; echo "Backend did not become ready in time. See $RUN/backend.log"; exit 1
}

stop() {
  for name in frontend backend; do
    if is_running "$RUN/$name.pid"; then
      kill "$(cat "$RUN/$name.pid")" && echo "Stopped $name."
    else
      echo "$name was not running (from this script)."
    fi
    rm -f "$RUN/$name.pid"
  done
}

status() {
  for name in backend frontend; do
    if is_running "$RUN/$name.pid"; then echo "$name: running (PID $(cat "$RUN/$name.pid"))"; else echo "$name: not running"; fi
  done
  curl -s -m 3 "http://127.0.0.1:$BACKEND_PORT/llm/status" || echo "(backend not answering)"; echo
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "Usage: $0 start|stop|status"; exit 2 ;;
esac
