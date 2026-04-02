#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/api"

export APP_ENV="${APP_ENV:-development}"
export RELOAD="${RELOAD:-1}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8000}"

uv sync
uv run python run.py

