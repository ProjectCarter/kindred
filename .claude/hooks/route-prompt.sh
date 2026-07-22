#!/usr/bin/env bash
# UserPromptSubmit: route user prompts to Skills and Subagents by intent.
# Fast exit for unrelated prompts — avoids JSON parser on most turns.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib/kindred-hook-lib.sh
source "$SCRIPT_DIR/_lib/kindred-hook-lib.sh"

INPUT=$(read_hook_input)

# Cheap prefilter on raw JSON — skip JSON parser when no routing keywords present.
if ! printf '%s' "$INPUT" | grep -qiE \
  'release|ready to ship|ready to release|release readiness|prepare (a )?release|production[- ]ready|v1 launch|\bship\b|performance|\bslow\b|slower|\bhang\b|hanging|ttfmc|cold launch|warm launch|cache miss|over budget|perf audit|speed up|security|secret|api key|service[- ]role|credential|CRON_SECRET|\.env|leaked'; then
  exit 0
fi

require_json_tool

PROMPT=$(json_get "$INPUT" ".prompt")

[[ -z "$PROMPT" ]] && exit 0

CONTEXT=""

if prompt_matches "$PROMPT" '(release|ship|ready to (ship|release)|release readiness|prepare (a )?release|production[- ]ready|v1 launch)'; then
  CONTEXT="$(load_context before-release)"
elif prompt_matches "$PROMPT" '(performance|slow|slower|hang|hanging|ttfmc|cold launch|warm launch|cache miss|over budget|perf audit|speed up)'; then
  CONTEXT="$(load_context before-performance-investigation)"
elif prompt_matches "$PROMPT" '(security|secret|api key|service.role|credential|CRON_SECRET|\.env|leaked)'; then
  CONTEXT="$(load_context before-security-work)"
fi

[[ -z "$CONTEXT" ]] && exit 0

emit_user_prompt_context "$CONTEXT"
