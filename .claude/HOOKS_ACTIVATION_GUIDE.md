# Kindred Hook Activation Guide

How Claude Code discovers, loads, and executes project hooks for Kindred.

---

## 1. Discovery

Claude Code loads hooks from **project settings** at startup (and on file watch):

| File | Role |
|------|------|
| [`.claude/settings.json`](settings.json) | Committed hook registry — **source of truth** |
| `.claude/settings.local.json` | Local overrides (gitignored); can set `disableAllHooks` |

Hook **scripts** live in [`.claude/hooks/`](hooks/). The `${CLAUDE_PROJECT_DIR}` variable resolves to the repository root when hooks run.

**First-time setup:** If `.claude/hooks/` was created mid-session, restart Claude Code once so the directory watcher picks up scripts.

**Verify configuration:** Run `/hooks` in Claude Code — shows event, matcher, command, timeout, and source (`Project`).

---

## 2. Registration (settings.json)

```json
{
  "hooks": {
    "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": ".../route-prompt.sh", "timeout": 5 } ] } ],
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "if": "Bash(git commit*)", "command": ".../before-commit.sh", "timeout": 90 } ] },
      { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": ".../route-file-edit.sh", "timeout": 5 } ] }
    ]
  }
}
```

| Event | When it fires | Kindred usage | Timeout |
|-------|---------------|---------------|---------|
| `UserPromptSubmit` | Every user prompt, before Claude processes | Route release / perf / security intent | **5s** |
| `PreToolUse` (Edit\|Write) | Before each edit/write tool call | Inject context by file path | **5s** |
| `PreToolUse` (Bash git commit) | Before `git commit` | Block secrets/blockers; inject checklist | **90s** |

---

## 3. Execution flow

### A. User prompt routing (`route-prompt.sh`)

```
User submits prompt
        │
        ▼
UserPromptSubmit fires (no matcher — always runs)
        │
        ▼
route-prompt.sh reads JSON stdin
        │
        ├─ grep prefilter: no release/perf/security keywords? ──► exit 0 (no JSON parse)
        │
        ▼
require_json_tool → json_get .prompt
        │
        ├─ release keywords? ──► load context/before-release.txt
        ├─ perf keywords?    ──► load context/before-performance-investigation.txt
        ├─ security keywords?──► load context/before-security-work.txt
        └─ no match ──► exit 0 (no output)
        │
        ▼
stdout: JSON { hookSpecificOutput: { additionalContext: "..." } }
        │
        ▼
Claude receives system reminder alongside prompt
        │
        ▼
Claude should invoke listed Skills (@subagent) — hooks do NOT auto-run them
```

Context files **reference** Skills and Subagents by name — they do not duplicate editorial law or skill procedures.

### B. File edit routing (`route-file-edit.sh`)

```
Claude calls Edit or Write
        │
        ▼
PreToolUse fires (matcher: Edit|Write)
        │
        ▼
route-file-edit.sh reads JSON stdin
        │
        ├─ extract_file_path_grep (no JSON parser)
        ├─ resolve_edit_context_name → no match? ──► exit 0
        │
        ▼
require_json_tool → json_get .tool_input.file_path (confirm path)
        │
        ├─ news path?     ──► before-editing-news.txt
        ├─ homepage path? ──► before-editing-homepage.txt
        ├─ build path?    ──► before-edition-generation.txt
        ├─ security path? ──► before-security-work.txt
        └─ no match ──► exit 0
        │
        ▼
additionalContext injected next to tool call
        │
        ▼
Edit proceeds (read-only hook — no block)
```

This grep-first design avoids requiring `jq` when the edited file is outside hooked paths — fixing the chicken-and-egg where missing `jq` blocked all edits.

### C. Before commit gate (`before-commit.sh`)

```
Claude calls Bash "git commit ..."
        │
        ▼
PreToolUse fires (matcher: Bash, if: Bash(git commit*))
        │
        ▼
before-commit.sh → require_json_tool
        │
        ├─ release-blockers.json block=true? ──► permissionDecision: deny
        ├─ staged secrets / .env?            ──► permissionDecision: deny
        └─ pass ──► additionalContext: before-commit.txt skill checklist
        │
        ▼
deny → commit blocked, reason shown to Claude
allow + context → Claude should run skills before retrying commit
```

---

## 4. Skills vs Subagents vs Hooks

| Layer | Who executes | Kindred role |
|-------|--------------|--------------|
| **Hook** | Shell script (deterministic) | Detect event; inject context; block commits |
| **Skill** | Claude reads `SKILL.md` and follows checklist | Procedure + verification |
| **Subagent** | Separate context via `@name` or Agent tool | Domain specialist |

Hooks **do not** automatically spawn subagents or run skill scripts. They inject reminders so Claude invokes the correct Skill/Subagent in the same turn.

---

## 5. Release blocker lifecycle

```bash
# After release-readiness FAIL or user decision:
.claude/hooks/util/set-release-blocker.sh "DO NOT SHIP: typecheck failed"

# git commit attempts → before-commit.sh → deny

# After fixes and PASS:
.claude/hooks/util/clear-release-blocker.sh
```

State file: `.claude/hooks/state/release-blockers.json` (gitignored). Example schema: `state/release-blockers.example.json`.

`set-release-blocker.sh` sources `_lib/kindred-hook-lib.sh` and calls `write_release_blocker` (jq or python3).

---

## 6. Prerequisites

```bash
command -v jq    # preferred
command -v python3  # fallback when jq absent
command -v git   # required for before-commit
chmod +x .claude/hooks/*.sh .claude/hooks/util/*.sh
```

Hooks require **jq OR python3**. Error exit 2 only when **both** are missing. See [`.claude/README.md#prerequisites`](README.md#prerequisites).

Shared helpers in `_lib/kindred-hook-lib.sh`:

| Helper | Purpose |
|--------|---------|
| `require_json_tool` | Ensure jq or python3 available |
| `json_get` | Read `.prompt`, `.tool_input.file_path`, etc. |
| `extract_file_path_grep` | Fast path extract without JSON parser |
| `resolve_edit_context_name` | Map file path → context file stem |
| `write_release_blocker` | Write release-blockers.json |
| `emit_*` | Hook stdout JSON (jq or python3) |

---

## 7. Quick test matrix

| Action | Expected hook | Verify |
|--------|---------------|--------|
| Prompt: "prepare a release" | `route-prompt.sh` → before-release | `/hooks` + prompt; Claude mentions qa-agent |
| Edit `EditionReader.tsx` | `route-file-edit.sh` → homepage | additionalContext in debug log |
| Edit `selectLeadStory.ts` | `route-file-edit.sh` → news | news-agent referenced |
| Edit unrelated file (e.g. README) | grep prefilter → exit 0 | No jq required on path |
| `git commit` with blocker set | `before-commit.sh` | Commit denied |
| `git commit` clean | `before-commit.sh` | Context injected, commit allowed |

Debug: `claude --debug-file /tmp/cc-debug.log` and search for hook event names.

---

## 8. Related documentation

| Doc | Path |
|-----|------|
| Infrastructure index | [`.claude/README.md`](README.md) |
| Hook README | [`.claude/hooks/README.md`](hooks/README.md) |
| Subagents | [`.claude/SUBAGENTS.md`](SUBAGENTS.md) |
| Output styles | [`.claude/output-styles/README.md`](output-styles/README.md) |
| Skills | [`.claude/skills/*/SKILL.md`](skills/) |
| Operating guide | [`CLAUDE.md`](../CLAUDE.md) |

---

## 9. Session checklist

- [ ] `.claude/settings.json` present in repo
- [ ] Hook scripts executable
- [ ] `jq` installed **or** `python3` available
- [ ] `/hooks` shows 3 handlers (UserPromptSubmit + 2 PreToolUse groups)
- [ ] Timeouts: 5s (prompt + edit), 90s (commit)
- [ ] New session after first install
- [ ] Output style selected if structured report desired (`/config` → Output style)
