#!/usr/bin/env bash
# Set release blocker — prevents git commit via before-commit hook.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../_lib/kindred-hook-lib.sh
source "$SCRIPT_DIR/../_lib/kindred-hook-lib.sh"

REASON="${1:-Release gate FAIL — commit blocked until cleared}"

require_json_tool
write_release_blocker "$REASON"

echo "Release blocker set: $BLOCKERS_FILE"
echo "$REASON"
