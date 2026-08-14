#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SOURCE_APP="${WEZTERM_APP:-/Applications/WezTerm.app}"
TARGET_APP="${MAESTRO_APP:-/Applications/Maestro.app}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Maestro app construction currently supports macOS only." >&2
  exit 1
fi
if [[ ! -d "$SOURCE_APP" ]]; then
  echo "WezTerm was not found at $SOURCE_APP." >&2
  exit 1
fi
if [[ ! -f "$ROOT/assets/Maestro.icns" ]]; then
  echo "Missing assets/Maestro.icns." >&2
  exit 1
fi

temp_root="$(mktemp -d "${TMPDIR:-/tmp}/maestro-app.XXXXXX")"
trap 'rm -rf "$temp_root"' EXIT
staged_app="$temp_root/Maestro.app"
ditto "$SOURCE_APP" "$staged_app"

mv "$staged_app/Contents/MacOS/wezterm-gui" \
  "$staged_app/Contents/MacOS/wezterm-gui-bin"
cat > "$staged_app/Contents/MacOS/wezterm-gui" <<'WRAPPER'
#!/bin/sh
set -eu
export WEZTERM_CONFIG_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/maestro/wezterm.lua"
exec "$(dirname "$0")/wezterm-gui-bin" "$@"
WRAPPER
chmod 755 "$staged_app/Contents/MacOS/wezterm-gui"

cp "$ROOT/assets/Maestro.icns" \
  "$staged_app/Contents/Resources/maestro.icns"
plist="$staged_app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c \
  'Set :CFBundleIdentifier com.jdylanmc.maestro' "$plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleName Maestro' "$plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName Maestro' "$plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleIconFile maestro.icns' "$plist"

xattr -cr "$staged_app"
codesign --force --deep --sign - \
  --identifier com.jdylanmc.maestro "$staged_app"
codesign --verify --deep --strict "$staged_app"

backup=""
if [[ -e "$TARGET_APP" ]]; then
  backup="${TARGET_APP}.backup.$(date +%Y%m%d%H%M%S)"
  mv "$TARGET_APP" "$backup"
fi
if ! mv "$staged_app" "$TARGET_APP"; then
  [[ -n "$backup" ]] && mv "$backup" "$TARGET_APP"
  exit 1
fi
[[ -n "$backup" ]] && rm -rf "$backup"

touch "$TARGET_APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$TARGET_APP"
echo "Installed $TARGET_APP"
