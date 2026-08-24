#!/usr/bin/env bash
# Quiet Copilot's non-blocking push notifications (issue #64).
#
# THE NOISE IS NOT MAESTRO'S. cmux registers its own Copilot hooks in
# ~/.copilot/settings.json, independently of this plugin, and its `Notification`
# hook reduces to:
#
#     "$cmux_cli" hooks copilot stop
#
# run for EVERY Copilot notification with no reference to the type. Measured
# types in one session: permission_prompt (135), agent_idle (7),
# elicitation_dialog (2), shell_completed (1), shell_detached_completed (1). So
# a subagent going quiet is delivered to cmux as a "stop" and raises a push
# notification.
#
# This script replaces that one hook with a Maestro filter that forwards only
# the notifications which actually block the operator, and passes everything
# else through unchanged.
#
# IT EDITS A FILE THIS REPOSITORY DOES NOT OWN. Therefore:
#
#   - it is opt-in; `install.sh` never runs it
#   - it backs up settings.json before touching it
#   - it stores cmux's ORIGINAL hook verbatim so `restore` is exact rather
#     than reconstructed
#   - it is idempotent, and refuses to overwrite its own record of the original
#   - `restore` puts cmux's own hook back and removes every trace
#
# KNOWN LIMIT, stated rather than discovered later: if cmux rewrites its hook
# block on upgrade, this override is silently replaced and the noise returns.
# Run `status` to check, and `install` again to reapply. That is a real cost of
# overriding another product's configuration, and the reason this is not
# automatic.
#
# NOTE ON DISABLING: `CMUX_COPILOT_HOOKS_DISABLED=1` silences the noise too, but
# it also disables every Maestro hook - you would lose the subagent tree. This
# script exists so the two are not the same choice.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
FILTER="$ROOT/dist/notification-filter-main.js"
SETTINGS="$HOME/.copilot/settings.json"
BACKUP_DIR="$HOME/.copilot/_maestro-backups"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
ORIGINAL="$CONFIG_HOME/maestro/cmux-notification-hook.original.json"
MARKER="maestro-notification-filter"

usage() {
  cat <<'USAGE'
usage: ./quiet-notifications.sh <install|restore|status>

  install   filter cmux's Copilot Notification hook to blocking prompts only
  restore   put cmux's own hook back exactly as it was
  status    report which hook is currently installed
USAGE
}

require_filter() {
  if [ ! -f "$FILTER" ]; then
    echo "no $FILTER - run 'npm run build' first" >&2
    exit 1
  fi
}

# The replacement hook command.
#
# Fails OPEN, and "open" here means FORWARDING. Everywhere else in Maestro the
# safe direction is to do nothing; this hook stands between the runtime and a
# prompt the operator may be waiting on, so every uncertain path ends in cmux
# being called exactly as it would have been. A missing Node, a disabled
# plugin, or a crashed filter all restore today's behaviour rather than
# swallowing a permission prompt.
hook_command() {
  cat <<COMMAND
# $MARKER
cmux_cli="\${CMUX_BUNDLED_CLI_PATH:-}"; if [ -z "\$cmux_cli" ] || [ ! -x "\$cmux_cli" ]; then cmux_cli="\$(command -v cmux 2>/dev/null || true)"; fi
forward() { if [ -n "\${CMUX_SOCKET_PATH:-}" ]; then "\$cmux_cli" --socket "\$CMUX_SOCKET_PATH" hooks copilot stop; else "\$cmux_cli" hooks copilot stop; fi; }
if [ -z "\$CMUX_SURFACE_ID" ] || [ "\${CMUX_COPILOT_HOOKS_DISABLED:-}" = "1" ] || [ -z "\$cmux_cli" ]; then { cat >/dev/null 2>/dev/null || true; echo '{}'; }; exit 0; fi
if [ "\${MAESTRO_DISABLED:-}" = "1" ] || ! command -v node >/dev/null 2>&1 || [ ! -f '$FILTER' ]; then { forward || { cat >/dev/null 2>/dev/null || true; echo '{}'; }; }; exit 0; fi
node '$FILTER' 2>/dev/null || { forward || true; echo '{}'; }
exit 0
COMMAND
}

case "${1:-}" in
  status)
    python3 - "$SETTINGS" "$MARKER" "$ORIGINAL" <<'PY'
import json, sys
from pathlib import Path
settings, marker, original = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
if not settings.exists():
    print("no ~/.copilot/settings.json - nothing is installed"); raise SystemExit(0)
doc = json.loads(settings.read_text())
entries = doc.get("hooks", {}).get("Notification", [])
body = ""
for entry in entries:
    for hook in entry.get("hooks", []):
        body += hook.get("command", "") or hook.get("bash", "") or ""
if marker in body:
    print("INSTALLED  Maestro is filtering Copilot notifications")
    print(f"  original cmux hook saved at {original}" if original.exists()
          else "  WARNING no saved original; restore will remove the hook entirely")
elif body:
    print("not installed  cmux's own Notification hook is in place")
else:
    print("not installed  no Notification hook is registered at all")
PY
    ;;

  install)
    require_filter
    [ -f "$SETTINGS" ] || { echo "no $SETTINGS - is the Copilot CLI installed?" >&2; exit 1; }
    mkdir -p "$BACKUP_DIR" "$(dirname "$ORIGINAL")"
    stamp="$(date +%Y%m%d-%H%M%S)"
    cp "$SETTINGS" "$BACKUP_DIR/settings.json.pre-$MARKER.$stamp"
    echo "  backed up $SETTINGS -> $BACKUP_DIR/settings.json.pre-$MARKER.$stamp"

    hook_command > "$BACKUP_DIR/.command.$$"
    python3 - "$SETTINGS" "$MARKER" "$ORIGINAL" "$BACKUP_DIR/.command.$$" <<'PY'
import json, sys
from pathlib import Path

settings, marker, original, command_file = (
    Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]), Path(sys.argv[4])
)
doc = json.loads(settings.read_text())
hooks = doc.setdefault("hooks", {})
entries = hooks.get("Notification", [])

def body_of(entry):
    return "".join(
        (h.get("command") or h.get("bash") or "") for h in entry.get("hooks", [])
    )

already = any(marker in body_of(e) for e in entries)

# Save cmux's ORIGINAL verbatim, once. Overwriting it with our own replacement
# on a second run would destroy the only exact record of what to restore.
if not already and entries and not original.exists():
    original.write_text(json.dumps(entries, indent=2) + "\n")
    print(f"  saved cmux's original hook -> {original}")
elif already:
    print("  already installed; refreshing the command")

replacement = {
    "matcher": "*",
    "hooks": [{"type": "command", "command": command_file.read_text().strip()}],
}
hooks["Notification"] = [replacement]
settings.write_text(json.dumps(doc, indent=2) + "\n")
print("  Notification hook now filters to blocking prompts only")
PY
    rm -f "$BACKUP_DIR/.command.$$"
    echo
    echo "Done. Restart Copilot sessions to pick it up."
    echo "Subagents going idle no longer notify; permission prompts and questions still do."
    ;;

  restore)
    [ -f "$SETTINGS" ] || { echo "no $SETTINGS" >&2; exit 1; }
    python3 - "$SETTINGS" "$MARKER" "$ORIGINAL" <<'PY'
import json, sys
from pathlib import Path

settings, marker, original = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
doc = json.loads(settings.read_text())
hooks = doc.setdefault("hooks", {})

if original.exists():
    hooks["Notification"] = json.loads(original.read_text())
    print("  restored cmux's original Notification hook")
else:
    hooks.pop("Notification", None)
    print("  no saved original; removed the Notification hook entirely")
    print("  reinstall cmux's integration to get its own hook back")

settings.write_text(json.dumps(doc, indent=2) + "\n")
PY
    rm -f "$ORIGINAL"
    echo "Done. Restart Copilot sessions to pick it up."
    ;;

  *)
    usage
    exit 1
    ;;
esac
