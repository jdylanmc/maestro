#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
LOCK_FILE="$ROOT/config/herdr/plugins.lock"

command -v herdr >/dev/null 2>&1 || {
  echo "Herdr is required before plugins can be installed." >&2
  exit 1
}
command -v node >/dev/null 2>&1 || {
  echo "Node.js 18 or newer is required by Maestro's Herdr plugins." >&2
  exit 1
}
command -v cargo >/dev/null 2>&1 || {
  echo "Cargo is required to build Maestro's Rust-based Herdr plugins." >&2
  exit 1
}

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$node_major" -lt 18 ]]; then
  echo "Node.js 18 or newer is required; found $(node --version)." >&2
  exit 1
fi

while read -r source ref extra; do
  [[ -z "$source" || "$source" == \#* ]] && continue
  if [[ -z "$ref" || -n "${extra:-}" ]]; then
    echo "Invalid plugin lock entry: $source ${ref:-} ${extra:-}" >&2
    exit 1
  fi
  if [[ ! "$source" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$ ]]; then
    echo "Invalid plugin source: $source" >&2
    exit 1
  fi
  if [[ ! "$ref" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Plugin ref must be a full commit SHA: $source" >&2
    exit 1
  fi

  herdr plugin install "$source" --ref "$ref" --yes
done < "$LOCK_FILE"

herdr plugin action invoke copilot.session-tabs.sync >/dev/null
echo "Installed pinned Herdr plugins."
