#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
source "$ROOT_DIR/.env.staging"
set +a

curl --fail --silent --show-error \
  --request POST \
  --header "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3308/api/internal/weekly-snapshots
