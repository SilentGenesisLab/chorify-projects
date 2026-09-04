#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
set -a
source .env.staging
set +a
curl -fsS -X POST "${APP_URL:-https://aipms.sligenai.cn}/api/internal/deployment-health" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
