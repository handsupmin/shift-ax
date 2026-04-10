#!/usr/bin/env bash
set -euo pipefail

PACKAGE="${1:-shift-ax}"

if ! command -v node >/dev/null 2>&1; then
  echo "Shift AX install requires Node.js >= 20." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Shift AX install requires npm." >&2
  exit 1
fi

npm install -g "$PACKAGE"

cat <<'EOF'

Shift AX installed successfully.

Start with:
  shift-ax --codex
  shift-ax --claude-code

EOF
