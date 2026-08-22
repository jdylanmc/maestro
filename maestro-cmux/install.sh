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
#   command -v node ... || exit 0     - no Node, no problem
#   node '<abs>' <hook> >/dev/null 2>&1 || exit 0
#
# so output is discarded and the exit status is zero no matter what happens
# inside. A bug in this plugin cannot deny a tool call even if the plugin is
# completely broken.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
RUNNER="$ROOT/dist/hook-runner.js"

echo "building..."
npm install --silent
npm run build

[ -f "$RUNNER" ] || { echo "build produced no $RUNNER" >&2; exit 1; }

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
    "userPromptSubmitted",
    "preToolUse",
    "postToolUse",
    "errorOccurred",
    # Attention. `notification` carries notificationType, which discriminates a
    # blocking permission_prompt or elicitation_dialog from noise; `agentStop`
    # reports end_turn. Both are required because a session that is BLOCKED on
    # the operator runs no tools, so no preToolUse/postToolUse hook fires while
    # the state that most needs reporting is true.
    "notification",
    "agentStop",
]


def command(hook: str) -> str:
    return (
        "command -v node >/dev/null 2>&1 || exit 0; "
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

echo "verifying the hook is silent and fails open from a foreign directory..."
fail=0
for hook in sessionStart sessionEnd userPromptSubmitted preToolUse postToolUse errorOccurred notification agentStop; do
  for payload in '{}' '{"garbage":true}' '' 'not json' '[]' 'null'; do
    out="$(cd / && printf '%s' "$payload" \
      | bash -c "command -v node >/dev/null 2>&1 || exit 0; node '$RUNNER' $hook >/dev/null 2>&1 || exit 0" 2>&1)"
    rc=$?
    if [ "$rc" -ne 0 ] || [ -n "$out" ]; then
      echo "  FAIL $hook exit=$rc output='$out'" >&2
      fail=$((fail + 1))
    fi
  done
done
if [ "$fail" -ne 0 ]; then
  echo "refusing to install: $fail combinations were not silent-and-zero" >&2
  exit 1
fi
echo "  $((8 * 6)) hook/payload combinations: exit 0, no output"

echo "installing into Copilot CLI..."
copilot plugin install "$ROOT" 2>&1 | grep -v '^Warning' || true
copilot plugin list | grep -i maestro || true

cat <<'EOF'

Installed. Copilot binds plugins at session start, so an already-running
session keeps whatever it loaded - restart it to pick this up.

Verify in a NEW session by running `pwd`. If it is denied, run:

    copilot plugin uninstall maestro-cmux

Diagnostics, when enabled with COPILOT_CMUX_DEBUG=1, are written to
$TMPDIR/maestro-cmux.log. They are never written to stdout or stderr, because
Copilot reports a hook that emits anything as errored and denies the call.
EOF
