#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

git fetch origin uat
git pull --ff-only origin uat

STAGING_COMPOSE="$ROOT_DIR/deploy/docker-compose.staging.yml"
APP_COMPOSE="$ROOT_DIR/deploy/docker-compose.app.yml"
STATE_FILE="$ROOT_DIR/deploy/state/web.active"
NGINX_UPSTREAM="/etc/nginx/snippets/aipms-upstream.conf"

sudo docker compose --env-file .env.staging -f "$STAGING_COMPOSE" up -d postgres minio minio-init
sudo docker compose --env-file .env.staging -f "$STAGING_COMPOSE" build migrate app
sudo docker compose --env-file .env.staging -f "$STAGING_COMPOSE" run --rm migrate

ACTIVE="green"
[[ -f "$STATE_FILE" ]] && ACTIVE="$(tail -n 1 "$STATE_FILE" | tr -d '\r[:space:]')"
[[ "$ACTIVE" == "blue" || "$ACTIVE" == "green" ]] || ACTIVE="green"
if [[ "$ACTIVE" == "blue" ]]; then TARGET="green"; HOST_PORT="3309"; else TARGET="blue"; HOST_PORT="3308"; fi

sudo env IMAGE_REF=deploy-app:latest HOST_PORT="$HOST_PORT" docker compose -p "aipmf-web-$TARGET" --env-file .env.staging -f "$APP_COMPOSE" up -d --force-recreate app
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$HOST_PORT/api/health" >/dev/null; then break; fi
  sleep 2
done
curl -fsS --max-time 3 "http://127.0.0.1:$HOST_PORT/api/health" >/dev/null

UPSTREAM_BACKUP="$(mktemp /tmp/aipms-upstream.XXXXXX)"
sudo cp "$NGINX_UPSTREAM" "$UPSTREAM_BACKUP"
printf 'upstream aipms_app { server 127.0.0.1:%s; keepalive 32; }\n' "$HOST_PORT" | sudo tee "$NGINX_UPSTREAM.next" >/dev/null
sudo mv "$NGINX_UPSTREAM.next" "$NGINX_UPSTREAM"
if ! sudo nginx -t; then
  sudo cp "$UPSTREAM_BACKUP" "$NGINX_UPSTREAM"
  rm -f "$UPSTREAM_BACKUP"
  exit 1
fi
sudo systemctl reload nginx
rm -f "$UPSTREAM_BACKUP"
printf '%s\n' "$TARGET" > "$STATE_FILE"

sudo docker compose --env-file .env.staging -f "$STAGING_COMPOSE" ps
