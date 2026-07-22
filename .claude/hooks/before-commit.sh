#!/usr/bin/env bash
# PreToolUse: blocks git commit when release blockers or staged secrets exist;
# otherwise injects pre-commit skill checklist.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib/kindred-hook-lib.sh
source "$SCRIPT_DIR/_lib/kindred-hook-lib.sh"

require_json_tool

INPUT=$(read_hook_input)

if has_release_blockers; then
  emit_pretooluse_deny "$(release_blocker_reason)"
  exit 0
fi

if ! scan_staged_secrets >/dev/null 2>&1; then
  secret_detail=$(scan_staged_secrets 2>&1 || true)
  emit_pretooluse_deny "Commit blocked: possible secret in staged diff. $secret_detail Remove secrets or unstage before commit."
  exit 0
fi

CONTEXT="$(load_context before-commit)"
emit_pretooluse_context "$CONTEXT"
