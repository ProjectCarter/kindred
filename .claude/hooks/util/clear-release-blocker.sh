#!/usr/bin/env bash
# Clear release blocker — allows git commit via before-commit hook.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKERS_FILE="$SCRIPT_DIR/../state/release-blockers.json"

if [[ -f "$BLOCKERS_FILE" ]]; then
  rm -f "$BLOCKERS_FILE"
  echo "Release blocker cleared."
else
  echo "No release blocker present."
fi
