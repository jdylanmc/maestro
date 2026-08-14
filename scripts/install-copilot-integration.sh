#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HOOK_DIR="$HOME/.copilot/hooks"
SCRIPT_PATH="$HOOK_DIR/maestro-herdr-fleet.py"
HOOK_PATH="$HOOK_DIR/maestro-herdr-fleet.json"

mkdir -p "$HOOK_DIR"
install -m 755 \
  "$ROOT/integrations/copilot/herdr-copilot-fleet.py" "$SCRIPT_PATH"
escaped_script="$(printf '%s' "$SCRIPT_PATH" | sed 's/[\/&]/\\&/g')"
sed "s/@FLEET_SCRIPT@/$escaped_script/g" \
  "$ROOT/integrations/copilot/hooks.json.in" > "$HOOK_PATH"
chmod 600 "$HOOK_PATH"
echo "Installed additive Copilot fleet hooks."
