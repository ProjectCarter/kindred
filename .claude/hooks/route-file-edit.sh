#!/usr/bin/env bash
# PreToolUse Edit|Write: inject domain-specific Skill/Subagent routing by file path.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib/kindred-hook-lib.sh
source "$SCRIPT_DIR/_lib/kindred-hook-lib.sh"

INPUT=$(read_hook_input)

# Fast grep prefilter — skip JSON parser when path does not match any hook branch.
FILE_PATH=$(extract_file_path_grep "$INPUT")
[[ -z "$FILE_PATH" ]] && exit 0

CTX_NAME=$(resolve_edit_context_name "$FILE_PATH")
[[ -z "$CTX_NAME" ]] && exit 0

require_json_tool
FILE_PATH=$(json_get "$INPUT" ".tool_input.file_path")
[[ -z "$FILE_PATH" ]] && exit 0

CTX_NAME=$(resolve_edit_context_name "$FILE_PATH")
[[ -z "$CTX_NAME" ]] && exit 0

CONTEXT="$(load_context "$CTX_NAME")"
CONTEXT="Editing: $FILE_PATH

$CONTEXT"

emit_pretooluse_context "$CONTEXT"
