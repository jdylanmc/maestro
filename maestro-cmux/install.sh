#!/usr/bin/env bash
# Install maestro-cmux into the GitHub Copilot CLI.
#
# This generates hooks.json rather than shipping it, because the hook command
# must carry an ABSOLUTE path.
#
# Copilot runs a hook with the SESSION's working directory, not the plugin's.
# Upstream shipped `node ./dist/hook-runner.js` with `"cwd": "."`, so Node
# looked for the module under whatever repository the session happened to be
# in, failed with MODULE_NOT_FOUND, and exited 1 - which Copilot treats as a
# DENIAL of the tool call. Every tool in every session was refused, and no
# amount of fixing the JavaScript helped, because the JavaScript never ran.
#
# The working reference is the herdr integration hook, which uses an absolute
# path and no cwd at all.
#
# The generated command is also fail-open in the shell itself:
#
#   if [ "$CMUX_COPILOT_HOOKS_DISABLED" = 1 ] ... - operator kill switches
#   if [ "$MAESTRO_DISABLED" = 1 ] ...
#   command -v node ... || exit 0     - no Node, no problem
#   node '<abs>' <hook> >/dev/null 2>&1 || exit 0
#
# so output is discarded and the exit status is zero no matter what happens
# inside. A bug in this plugin cannot deny a tool call even if the plugin is
# completely broken.
#
# `preToolUse` is not registered at all. It is the only hook Copilot treats as
# able to veto a tool call, and this plugin draws status pills.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
RUNNER="$ROOT/dist/hook-runner.js"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
MAESTRO_CONFIG_DIR="$CONFIG_HOME/maestro"
MAESTRO_CONFIG="$MAESTRO_CONFIG_DIR/config.json"
CMUX_SIDEBAR_DIR="$CONFIG_HOME/cmux/sidebars"

echo "building..."
npm install --silent
npm run build

[ -f "$RUNNER" ] || { echo "build produced no $RUNNER" >&2; exit 1; }
[ -f "$ROOT/dist/watcher-main.js" ] || { echo "build produced no dist/watcher-main.js" >&2; exit 1; }

echo "installing Maestro settings and sidebar..."
mkdir -p "$MAESTRO_CONFIG_DIR" "$CMUX_SIDEBAR_DIR"
if [ ! -e "$MAESTRO_CONFIG" ]; then
  install -m 0644 "$ROOT/config.example.json" "$MAESTRO_CONFIG"
  echo "  created $MAESTRO_CONFIG"
else
  echo "  preserved $MAESTRO_CONFIG"
fi
install -m 0644 "$ROOT/sidebars/maestro.swift" "$CMUX_SIDEBAR_DIR/maestro.swift"
echo "  installed $CMUX_SIDEBAR_DIR/maestro.swift"

echo "generating hooks.json with an absolute runner path..."
python3 - "$RUNNER" <<'PY'
import json, sys
from pathlib import Path

runner = sys.argv[1]
# This list is the SOURCE OF TRUTH for hooks.json, which is generated rather
# than shipped. Adding a hook to hooks.json by hand does nothing: the next
# install regenerates the file from this list and silently drops it.
hooks = [
    "sessionStart",
    "sessionEnd",
    # Start of work. This replaces `preToolUse`, which is DELIBERATELY not
    # registered: it is the only hook Copilot treats as able to veto a tool
    # call, and an observability plugin must not hold that authority. The
    # upstream copilot-cmux plugin took a live session down through exactly
    # this hook, refusing every tool call including `pwd`. Per-tool detail
    # still arrives through postToolUse, one tool later.
    "userPromptSubmitted",
    "postToolUse",
    "errorOccurred",
    # Attention. `notification` carries notificationType, which discriminates a
    # blocking permission_prompt or elicitation_dialog from noise; `agentStop`
    # reports end_turn. Both are required because a session that is BLOCKED on
    # the operator runs no tools, so no postToolUse hook fires while the state
    # that most needs reporting is true.
    "notification",
    "agentStop",
]


# The operator kill switches. Either one disables every Maestro hook in one
# step, without editing configuration or uninstalling the plugin.
# `CMUX_COPILOT_HOOKS_DISABLED` is cmux's own documented switch, already
# guarding its native Copilot hooks; `MAESTRO_DISABLED` silences only this
# plugin. Written as a full `if` rather than `[ ... ] && exit 0` so the guard
# itself always leaves a zero status when neither switch is set.
KILL_SWITCH = (
    'if [ "${CMUX_COPILOT_HOOKS_DISABLED:-}" = "1" ] '
    '|| [ "${MAESTRO_DISABLED:-}" = "1" ]; then exit 0; fi; '
)


def command(hook: str) -> str:
    return (
        KILL_SWITCH + "command -v node >/dev/null 2>&1 || exit 0; "
        f"node '{runner}' {hook} >/dev/null 2>&1 || exit 0"
    )


# Maestro publishes into cmux, and cmux is macOS only. There is nothing for
# this plugin to do on Windows, so the PowerShell variant is an unconditional
# no-op rather than a copy of the runner invocation.
#
# It cannot simply be omitted, and it must not be a bare `node ...` call. A
# hook that exits non-zero DENIES the tool call, so a Windows session running
# `node '<mac path>' <hook>` would hit MODULE_NOT_FOUND, exit 1, and deny every
# tool call in the session - the exact failure that broke this machine three
# times before the bash guard was written.
POWERSHELL_NOOP = "exit 0"


doc = {
    "version": 1,
    "hooks": {
        hook: [
            {
                "type": "command",
                "bash": command(hook),
                "powershell": POWERSHELL_NOOP,
                "timeoutSec": 10,
            }
        ]
        for hook in hooks
    },
}
Path("hooks.json").write_text(json.dumps(doc, indent=2) + "\n")
print(f"  runner: {runner}")
PY

echo "verifying preToolUse is not registered..."
python3 - <<'PY'
import json, sys
from pathlib import Path

hooks = json.loads(Path("hooks.json").read_text())["hooks"]
if "preToolUse" in hooks:
    print("  FAIL hooks.json registers preToolUse", file=sys.stderr)
    sys.exit(1)
print("  preToolUse absent: this plugin cannot veto a tool call")
PY

echo "verifying every generated hook is silent and fails open from a foreign directory..."
HOOK_NAMES="$(python3 -c 'import json;print(" ".join(json.load(open("hooks.json"))["hooks"]))')"
fail=0
combinations=0
for hook in $HOOK_NAMES; do
  # Verify the command that was actually GENERATED, not a copy of it. A
  # verifier that rebuilds the string by hand passes happily while hooks.json
  # ships something else.
  cmd="$(python3 -c 'import json,sys;print(json.load(open("hooks.json"))["hooks"][sys.argv[1]][0]["bash"])' "$hook")"
  for payload in '{}' '{"garbage":true}' '' 'not json' '[]' 'null'; do
    rc=0
    out="$(cd / && printf '%s' "$payload" | bash -c "$cmd" 2>&1)" || rc=$?
    combinations=$((combinations + 1))
    if [ "$rc" -ne 0 ] || [ -n "$out" ]; then
      echo "  FAIL $hook exit=$rc output='$out'" >&2
      fail=$((fail + 1))
    fi

    # The same command with either operator kill switch set must also be
    # silent and zero, and must not have run the runner at all.
    for switch in CMUX_COPILOT_HOOKS_DISABLED MAESTRO_DISABLED; do
      rc=0
      out="$(cd / && printf '%s' "$payload" \
        | env "$switch=1" bash -c "$cmd" 2>&1)" || rc=$?
      combinations=$((combinations + 1))
      if [ "$rc" -ne 0 ] || [ -n "$out" ]; then
        echo "  FAIL $hook ($switch=1) exit=$rc output='$out'" >&2
        fail=$((fail + 1))
      fi
    done
  done
done
if [ "$fail" -ne 0 ]; then
  echo "refusing to install: $fail combinations were not silent-and-zero" >&2
  exit 1
fi
echo "  $combinations hook/payload combinations: exit 0, no output"

# Negative control. Everything above would pass trivially if the runner never
# executed - a wrong path, a missing build - because a process that cannot
# start also produces no output. Diagnostics go to a FILE, never to stderr.
echo "verifying the runner actually runs (negative control)..."
LOGFILE="${TMPDIR:-/tmp}/maestro-cmux.log"
before=0
[ -f "$LOGFILE" ] && before="$(wc -c <"$LOGFILE" | tr -d ' ')"
(cd / && printf '{}' | COPILOT_CMUX_DEBUG=1 node "$RUNNER" sessionStart >/dev/null 2>&1) || true
after=0
[ -f "$LOGFILE" ] && after="$(wc -c <"$LOGFILE" | tr -d ' ')"
if [ "$after" -le "$before" ]; then
  echo "  FAIL the runner produced no diagnostic, so every check above is vacuous" >&2
  exit 1
fi
echo "  runner executed and reported"

echo "installing into Copilot CLI..."
copilot plugin install "$ROOT" 2>&1 | grep -v '^Warning' || true
copilot plugin list | grep -i maestro || true

cat <<'EOF'

Installed. Copilot binds plugins at session start, so an already-running
session keeps whatever it loaded - restart it to pick this up.

Verify in a NEW session by running `pwd`. If it is denied, run:

    copilot plugin uninstall maestro-cmux

To disable every Maestro hook without uninstalling, export either switch:

    export CMUX_COPILOT_HOOKS_DISABLED=1   # also disables cmux's own hooks
    export MAESTRO_DISABLED=1              # disables only this plugin

Diagnostics, when enabled with COPILOT_CMUX_DEBUG=1, are written to
$TMPDIR/maestro-cmux.log. They are never written to stdout or stderr, because
Copilot reports a hook that emits anything as errored and denies the call.
EOF
