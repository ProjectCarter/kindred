#!/usr/bin/env bash
# Shared helpers for Kindred Claude Code hooks.
# Requires: jq OR python3, bash 4+

set -euo pipefail

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$HOOKS_DIR/../.." && pwd)}"
CONTEXT_DIR="$HOOKS_DIR/context"
STATE_DIR="$HOOKS_DIR/state"
BLOCKERS_FILE="$STATE_DIR/release-blockers.json"

JSON_TOOL=""
if command -v jq >/dev/null 2>&1; then
  JSON_TOOL="jq"
elif command -v python3 >/dev/null 2>&1; then
  JSON_TOOL="python3"
fi

require_json_tool() {
  if [[ -z "$JSON_TOOL" ]]; then
    echo "Kindred hook error: jq or python3 is required but neither is installed. Install jq (preferred) or ensure python3 is on PATH. See .claude/README.md#prerequisites." >&2
    exit 2
  fi
}

read_hook_input() {
  cat
}

load_context() {
  local name="$1"
  local file="$CONTEXT_DIR/${name}.txt"
  if [[ -f "$file" ]]; then
    cat "$file"
  else
    echo "Kindred hook context missing: $name"
  fi
}

# Fast prefilter: extract tool_input.file_path from raw JSON without a JSON parser.
extract_file_path_grep() {
  local input="$1"
  printf '%s' "$input" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 \
    | sed -E 's/^"file_path"[[:space:]]*:[[:space:]]*"//; s/"$//' || true
}

# Resolve context file name from a file path (empty when no hook applies).
resolve_edit_context_name() {
  local path="$1"
  if file_matches_news "$path"; then
    echo "before-editing-news"
  elif file_matches_homepage "$path"; then
    echo "before-editing-homepage"
  elif file_matches_edition_build "$path"; then
    echo "before-edition-generation"
  elif file_matches_security "$path"; then
    echo "before-security-work"
  fi
}

# Read a jq-style dotted path from JSON stdin (e.g. .prompt, .tool_input.file_path).
json_get() {
  local json="$1"
  local path="$2"
  if [[ "$JSON_TOOL" == "jq" ]]; then
    printf '%s' "$json" | jq -r "${path} // empty"
  else
    printf '%s' "$json" | python3 -c '
import json, sys
path = sys.argv[1]
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)
keys = [k for k in path.strip(".").split(".") if k]
cur = data
for k in keys:
    if not isinstance(cur, dict):
        sys.exit(0)
    cur = cur.get(k)
    if cur is None:
        sys.exit(0)
if cur is None:
    sys.exit(0)
if isinstance(cur, (dict, list)):
    print(json.dumps(cur))
else:
    print(cur)
' "$path"
  fi
}

_emit_json() {
  local payload="$1"
  if [[ "$JSON_TOOL" == "jq" ]]; then
    printf '%s\n' "$payload"
  else
    printf '%s' "$payload" | python3 -m json.tool --compact 2>/dev/null || printf '%s\n' "$payload"
  fi
}

emit_pretooluse_context() {
  local context="$1"
  if [[ "$JSON_TOOL" == "jq" ]]; then
    jq -n \
      --arg ctx "$context" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $ctx}}'
  else
    _emit_json "$(python3 -c '
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": sys.argv[1]}}))
' "$context")"
  fi
}

emit_pretooluse_deny() {
  local reason="$1"
  if [[ "$JSON_TOOL" == "jq" ]]; then
    jq -n \
      --arg reason "$reason" \
      '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  else
    _emit_json "$(python3 -c '
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": sys.argv[1]}}))
' "$reason")"
  fi
}

emit_user_prompt_context() {
  local context="$1"
  if [[ "$JSON_TOOL" == "jq" ]]; then
    jq -n \
      --arg ctx "$context" \
      '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'
  else
    _emit_json "$(python3 -c '
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": sys.argv[1]}}))
' "$context")"
  fi
}

prompt_matches() {
  local prompt="$1"
  local pattern="$2"
  [[ "$prompt" =~ $pattern ]]
}

file_matches_news() {
  local path="$1"
  [[ "$path" =~ (leadStory|localNews|nationalDaily|nationalNews|LeadStory|homepageNews|topStories|selectLeadStory|resolveNationalNews|localNewsDesk|localNewsBriefing|national-news|news-pipeline) ]]
}

file_matches_homepage() {
  local path="$1"
  [[ "$path" =~ (EditionReader|app/home\.tsx|PaperLoading|homepageNewsHydration|nationalNewsHydration|editionCache|instantEdition|newspaperTheme|EditorialTitle) ]]
}

file_matches_edition_build() {
  local path="$1"
  [[ "$path" =~ (buildEdition|process-edition-jobs|generationJobs|editionBuildStages|stagedBuild|run-staged-edition) ]]
}

file_matches_security() {
  local path="$1"
  [[ "$path" =~ (\.env|middleware|supabase/functions|loadDotEnvLocal|/auth/|CRON_SECRET|service.role) ]]
}

has_release_blockers() {
  [[ -f "$BLOCKERS_FILE" ]] || return 1
  if [[ "$JSON_TOOL" == "jq" ]]; then
    jq -e '.block == true' "$BLOCKERS_FILE" >/dev/null 2>&1
  else
    python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
sys.exit(0 if data.get("block") is True else 1)
' "$BLOCKERS_FILE"
  fi
}

release_blocker_reason() {
  if [[ -f "$BLOCKERS_FILE" ]]; then
    if [[ "$JSON_TOOL" == "jq" ]]; then
      jq -r '.reason // "Release blockers active — see .claude/hooks/state/release-blockers.json"' "$BLOCKERS_FILE"
    else
      python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
print(data.get("reason") or "Release blockers active — see .claude/hooks/state/release-blockers.json")
' "$BLOCKERS_FILE"
    fi
  else
    echo "Release blockers active"
  fi
}

write_release_blocker() {
  local reason="$1"
  local updated
  updated="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  mkdir -p "$STATE_DIR"
  if [[ "$JSON_TOOL" == "jq" ]]; then
    jq -n \
      --arg reason "$reason" \
      --arg updated "$updated" \
      '{block: true, reason: $reason, updated_at: $updated, set_by: "set-release-blocker.sh"}' \
      > "$BLOCKERS_FILE"
  else
    python3 -c '
import json, sys
payload = {
    "block": True,
    "reason": sys.argv[1],
    "updated_at": sys.argv[2],
    "set_by": "set-release-blocker.sh",
}
with open(sys.argv[3], "w") as f:
    json.dump(payload, f)
    f.write("\n")
' "$reason" "$updated" "$BLOCKERS_FILE"
  fi
}

scan_staged_secrets() {
  local hits=""
  if ! git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    return 0
  fi
  if ! git -C "$PROJECT_DIR" diff --cached --quiet 2>/dev/null; then
    hits=$(git -C "$PROJECT_DIR" diff --cached -U0 2>/dev/null | grep -E '^\+' | grep -Ei \
      'SUPABASE_SERVICE_ROLE|service_role_key|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.|api[_-]?key\s*=\s*["\047][^"\047]{8,}|password\s*=\s*["\047][^"\047]+|CRON_SECRET\s*=\s*["\047]' \
      | head -5 || true)
  fi
  if [[ -n "$hits" ]]; then
    echo "$hits"
    return 1
  fi
  if git -C "$PROJECT_DIR" diff --cached --name-only 2>/dev/null | grep -E '^\.env(\.|$)|\.env\.local$' >/dev/null; then
    echo "Staged .env or .env.local file detected"
    return 1
  fi
  return 0
}
