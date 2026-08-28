function cliScript(baseUrl: string) {
  return `#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="\${CHORIFY_HOME:-$HOME/.chorify}"
BIN_DIR="\${CHORIFY_BIN_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR" "$BIN_DIR"
chmod 700 "$INSTALL_DIR" 2>/dev/null || true

cat > "$BIN_DIR/chorify" <<'CHORIFY_CLI'
#!/usr/bin/env bash
set -euo pipefail
CONFIG_FILE="\${CHORIFY_CONFIG:-$HOME/.chorify/config}"
DEFAULT_BASE_URL="${baseUrl}"

read_config() {
  BASE_URL="$DEFAULT_BASE_URL"
  API_KEY="\${CHORIFY_API_KEY:-}"
  if [ -f "$CONFIG_FILE" ]; then
    # shellcheck disable=SC1090
    . "$CONFIG_FILE"
  fi
  BASE_URL="\${CHORIFY_BASE_URL:-$BASE_URL}"
}

save_config() {
  mkdir -p "$(dirname "$CONFIG_FILE")"
  umask 077
  printf 'BASE_URL=%q\\nAPI_KEY=%q\\n' "$1" "$2" > "$CONFIG_FILE"
}

need_auth() {
  [ -n "$API_KEY" ] || { echo "Not authenticated. Run: chorify auth login --api-key <key>" >&2; exit 2; }
}

request() {
  method="$1"; path="$2"; data="\${3:-}"; idem="\${4:-}"
  need_auth
  args=(-fsSL -X "$method" -H "Authorization: Bearer $API_KEY" -H 'Accept: application/json')
  if [ -n "$data" ]; then args+=(-H 'Content-Type: application/json' --data-binary "$data"); fi
  if [ -n "$idem" ]; then args+=(-H "Idempotency-Key: $idem"); fi
  curl "\${args[@]}" "$BASE_URL$path"
  echo
}

resource_path() {
  resource="$1"; project_id="\${2:-}"
  case "$resource" in
    projects) echo "/api/v1/projects" ;;
    requirements|tasks|bugs|versions|releases|members|milestones)
      [ -n "$project_id" ] || { echo "project id is required" >&2; exit 2; }
      echo "/api/v1/projects/$project_id/$resource" ;;
    files|folders|teams|notifications|audit-logs) echo "/api/v1/$resource" ;;
    *) echo "unsupported resource: $resource" >&2; exit 2 ;;
  esac
}

read_config
cmd="\${1:-help}"; shift || true
case "$cmd" in
  auth)
    sub="\${1:-}"; shift || true
    case "$sub" in
      login)
        base="$DEFAULT_BASE_URL"; key=""
        while [ "$#" -gt 0 ]; do
          case "$1" in --api-key) key="$2"; shift 2;; --base-url) base="\${2%/}"; shift 2;; *) shift;; esac
        done
        [ -n "$key" ] || { echo "--api-key is required" >&2; exit 2; }
        save_config "$base" "$key"; BASE_URL="$base"; API_KEY="$key"
        request GET /api/v1/me >/dev/null
        echo "Authenticated with $base"
        ;;
      logout) rm -f "$CONFIG_FILE"; echo "Local credentials removed" ;;
      status) request GET /api/v1/me ;;
      *) echo "Usage: chorify auth login --api-key <key> [--base-url URL] | logout | status" >&2; exit 2 ;;
    esac
    ;;
  doctor) request GET /api/v1/me ;;
  context) request GET /api/v1/me/work-context ;;
  list)
    resource="\${1:?resource required}"; project="\${2:-}"; path="$(resource_path "$resource" "$project")"
    request GET "$path"
    ;;
  get)
    resource="\${1:?resource required}"; project="\${2:-}"; id="\${3:-}"
    base="$(resource_path "$resource" "$project")"; [ -n "$id" ] && base="$base/$id"
    request GET "$base"
    ;;
  create)
    resource="\${1:?resource required}"; project="\${2:-}"; json="\${3:?JSON body required}"
    request POST "$(resource_path "$resource" "$project")" "$json" "chorify-$(date +%s)-$RANDOM"
    ;;
  update)
    resource="\${1:?resource required}"; project="\${2:-}"; id="\${3:?id required}"; json="\${4:?JSON body required}"
    request PATCH "$(resource_path "$resource" "$project")/$id" "$json" "chorify-$(date +%s)-$RANDOM"
    ;;
  delete)
    resource="\${1:?resource required}"; project="\${2:-}"; id="\${3:?id required}"
    request DELETE "$(resource_path "$resource" "$project")/$id" "" "chorify-$(date +%s)-$RANDOM"
    ;;
  task-context) request GET "/api/v1/tasks/\${1:?task id required}/context" ;;
  task-report) request POST "/api/v1/tasks/\${1:?task id required}/reports" "\${2:?JSON body required}" "chorify-$(date +%s)-$RANDOM" ;;
  task-accept) request POST "/api/v1/tasks/\${1:?task id required}/acceptances" "\${2:?JSON body required}" "chorify-$(date +%s)-$RANDOM" ;;
  raw)
    method="\${1:?method required}"; path="\${2:?path required}"; data="\${3:-}"
    request "$method" "$path" "$data" "chorify-$(date +%s)-$RANDOM"
    ;;
  help|--help|-h)
    cat <<'HELP'
Chorify CLI
  chorify auth login --api-key <key> [--base-url URL]
  chorify doctor | context
  chorify list projects
  chorify list tasks <project-id>
  chorify get tasks <project-id> <task-id>
  chorify create tasks <project-id> '{"title":"..."}'
  chorify update tasks <project-id> <task-id> '{"status":"IN_PROGRESS"}'
  chorify delete tasks <project-id> <task-id>
  chorify task-context <task-id>
  chorify task-report <task-id> '{"summary":"..."}'
  chorify raw GET /api/v1/...

Resources: projects, requirements, tasks, bugs, versions, releases,
members, milestones, files, folders, teams, notifications, audit-logs.
Guide: ${baseUrl}/cli/guide
HELP
    ;;
  *) echo "Unknown command: $cmd. Run chorify help." >&2; exit 2 ;;
esac
CHORIFY_CLI

chmod +x "$BIN_DIR/chorify"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) echo "Add to PATH: export PATH=\"$BIN_DIR:\$PATH\"";; esac
echo "Chorify CLI installed: $BIN_DIR/chorify"
echo "Next: chorify auth login --api-key <your-key>"
echo "Guide: ${baseUrl}/cli/guide"
`;
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return new Response(cliScript(origin), {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": "inline; filename=install-chorify.sh",
    },
  });
}
