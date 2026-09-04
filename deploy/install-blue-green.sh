#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_USER="${DEPLOY_USER:-donxu}"
PUBLIC_KEY_FILE="${1:?usage: install-blue-green.sh <deploy-public-key>}"
[[ -f "$PUBLIC_KEY_FILE" ]] || { echo "public key not found" >&2; exit 2; }

sudo install -m 0750 "$ROOT/deploy/chorify-deploy" /usr/local/sbin/chorify-deploy
sudo install -m 0755 "$ROOT/deploy/chorify-deploy-entry" /usr/local/bin/chorify-deploy-entry
echo "$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/sbin/chorify-deploy *" | sudo tee /etc/sudoers.d/chorify-deploy >/dev/null
sudo chmod 0440 /etc/sudoers.d/chorify-deploy
sudo visudo -cf /etc/sudoers.d/chorify-deploy
install -d -m 0700 "$HOME/.ssh"
KEY="$(<"$PUBLIC_KEY_FILE")"
LINE="restrict,command=\"/usr/local/bin/chorify-deploy-entry\" $KEY"
touch "$HOME/.ssh/authorized_keys"
grep -Fq "$KEY" "$HOME/.ssh/authorized_keys" || printf '%s\n' "$LINE" >> "$HOME/.ssh/authorized_keys"
chmod 0600 "$HOME/.ssh/authorized_keys"
sudo install -d -m 0755 /etc/nginx/snippets
if [[ ! -f /etc/nginx/snippets/aipms-upstream.conf ]]; then
  printf 'upstream aipms_app { server 127.0.0.1:3308; keepalive 32; }\n' | sudo tee /etc/nginx/snippets/aipms-upstream.conf >/dev/null
fi
mkdir -p "$ROOT/deploy/state"
printf 'blue\n' > "$ROOT/deploy/state/web.active"
sudo nginx -t
sudo systemctl reload nginx
