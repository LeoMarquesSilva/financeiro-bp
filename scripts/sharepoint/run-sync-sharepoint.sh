#!/usr/bin/env bash
# Wrapper para cron: sync SharePoint → Supabase (painel Eficiência).
# Uso: ./scripts/sharepoint/run-sync-sharepoint.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/sync-sharepoint.log"
NODE_BIN="$(command -v node || true)"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"

mkdir -p "$LOG_DIR"

{
  echo "==== $(date '+%Y-%m-%d %H:%M:%S %Z') sync:sharepoint start ===="
  cd "$ROOT"
  if [[ -z "${NODE_BIN}" ]]; then
    NODE_BIN="$(command -v node)"
  fi
  "$NODE_BIN" scripts/sharepoint/sync-sharepoint.mjs
  echo "==== $(date '+%Y-%m-%d %H:%M:%S %Z') sync:sharepoint ok ===="
} >>"$LOG_FILE" 2>&1
