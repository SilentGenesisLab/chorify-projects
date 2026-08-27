#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

git fetch origin uat
git pull --ff-only origin uat
sudo docker compose --env-file .env.staging -f deploy/docker-compose.staging.yml up -d --build
sudo docker compose --env-file .env.staging -f deploy/docker-compose.staging.yml ps
