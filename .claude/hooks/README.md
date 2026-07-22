# Kindred Claude Code Hooks

Project hooks in `.claude/hooks/` wire **Skills** and **Subagents** into Claude Code lifecycle events. Hooks inject routing context (read-only) or block unsafe commits (deterministic gates).

Configuration: [`.claude/settings.json`](../settings.json)  
Activation: [`.claude/HOOKS_ACTIVATION_GUIDE.md`](../HOOKS_ACTIVATION_GUIDE.md)  
Index: [`.claude/README.md`](../README.md)

**Requires:** `jq` (preferred) **or** `python3` (fallback), `git`, `bash`. Scripts must be executable (`chmod +x .claude/hooks/**/*.sh`).

**Important:** Hooks **inject context** and **block commits** only. They do **not** execute skills, run audit scripts, or spawn subagents.

---

## Hook index

| Hook | Event | Trigger | Action | Timeout |
|------|-------|---------|--------|---------|
| **Before Commit** | `PreToolUse` | `Bash(git commit*)` | Block secrets/blockers; inject skill checklist | 90s |
| **Before Editing News** | `PreToolUse` | `Edit\|Write` on news paths | Inject `@news-agent` + news skills | 5s |
| **Before Editing Homepage** | `PreToolUse` | `Edit\|Write` on homepage paths | Inject `@ui-agent`, `@performance-agent`, homepage-audit | 5s |
| **Before Edition Generation** | `PreToolUse` | `Edit\|Write` on build paths | Inject `@edition-agent`, edition-builder | 5s |
| **Before Performance Investigation** | `UserPromptSubmit` | perf keywords in prompt | Inject `@performance-agent` + diagnostics skills | 5s |
| **Before Security Work** | `UserPromptSubmit` + `PreToolUse` | security keywords or security paths | Inject `@security-agent`, security-review | 5s |
| **Before Release** | `UserPromptSubmit` | release/ship keywords | Inject full release skill suite + `@qa-agent` | 5s |

---

## Performance: grep prefilters

Most turns never parse JSON:

| Script | Prefilter | When JSON parser runs |
|--------|-----------|------------------------|
| `route-prompt.sh` | grep for release/perf/security keywords in raw stdin | Only after keyword match |
| `route-file-edit.sh` | `extract_file_path_grep` + `resolve_edit_context_name` | Only when path matches a hooked branch |

This avoids the chicken-and-egg where missing `jq` blocked all file edits. Unrelated edits exit 0 before `require_json_tool`.

---

## Shared library (`_lib/kindred-hook-lib.sh`)

| Function | Purpose |
|----------|---------|
| `require_json_tool` | Accept jq **or** python3; error only if both missing |
| `json_get` | Read dotted paths from hook JSON stdin |
| `extract_file_path_grep` | Extract `file_path` without JSON parser |
| `resolve_edit_context_name` | Map path → `before-editing-*` context stem |
| `write_release_blocker` | Write `state/release-blockers.json` |
| `emit_pretooluse_context` / `emit_pretooluse_deny` / `emit_user_prompt_context` | stdout hook JSON |
| `has_release_blockers` / `release_blocker_reason` | Commit gate state |
| `scan_staged_secrets` | Pre-commit secret patterns |

---

## 1. Before Commit

**Script:** `before-commit.sh`  
**Context:** `context/before-commit.txt`

### Purpose

Gate `git commit` with deterministic secret detection and release blocker state; remind Claude to run pre-commit skills.

### When it fires

Claude attempts `git commit` via Bash tool.

### Skills invoked (via injected context — Claude runs them)

- Run the `security-review` skill
- Run the `regression-guard` skill
- Run the `homepage-audit` skill
- Run the `performance-diagnostics` skill
- Run the `release-readiness` skill

### Subagents

None directly — QA/release workflows may delegate to domain agents after skill runs.

### Blocking behavior

| Condition | Result |
|-----------|--------|
| `.claude/hooks/state/release-blockers.json` with `"block": true` | **Deny** commit |
| Staged `.env` / `.env.local` | **Deny** commit |
| Staged diff matches secret patterns | **Deny** commit |
| Otherwise | **Allow** + inject skill checklist |

### Utilities

```bash
.claude/hooks/util/set-release-blocker.sh "release-readiness FAIL: typecheck"
.claude/hooks/util/clear-release-blocker.sh
```

### Output style

`commit-summary`, `release-report`

---

## 2. Before Editing News

**Script:** `route-file-edit.sh` (news path branch)  
**Context:** `context/before-editing-news.txt`

### Path patterns

`leadStory`, `localNews`, `nationalDaily`, `nationalNews`, `LeadStory`, `homepageNews`, `topStories`, `selectLeadStory`, `resolveNationalNews`, `localNewsDesk`, `localNewsBriefing`, `national-news`, `news-pipeline`

### Skills

- Run the `local-news-verification` skill
- Run the `national-news-verification` skill
- Run the `news-pipeline-audit` skill

### Subagent

- `@news-agent`

### Behavior

Read-only context injection on `Edit`/`Write`. Does not block edits.

---

## 3. Before Editing Homepage

**Script:** `route-file-edit.sh` (homepage path branch)  
**Context:** `context/before-editing-homepage.txt`

### Path patterns

`EditionReader`, `app/home.tsx`, `PaperLoading`, `homepageNewsHydration`, `nationalNewsHydration`, `editionCache`, `instantEdition`, `newspaperTheme`, `EditorialTitle`

### Skills

- Run the `homepage-audit` skill
- Run the `performance-diagnostics` skill (when perf-related)

### Subagents

- `@ui-agent` (lead layout)
- `@performance-agent` (paint/cache)

---

## 4. Before Edition Generation

**Script:** `route-file-edit.sh` (build path branch)  
**Context:** `context/before-edition-generation.txt`

### Path patterns

`buildEdition`, `process-edition-jobs`, `generationJobs`, `editionBuildStages`, `stagedBuild`, `run-staged-edition`

### Skills

- Run the `edition-builder` skill

### Subagents

- `@edition-agent`
- `@performance-agent`

---

## 5. Before Performance Investigation

**Script:** `route-prompt.sh` (perf keyword branch)  
**Context:** `context/before-performance-investigation.txt`

### Prompt keywords

`performance`, `slow`, `hang`, `ttfmc`, `cold launch`, `cache miss`, `over budget`, `speed up`, etc.

### Skills

- Run the `performance-diagnostics` skill
- Run the `performance-audit` skill

### Subagent

- `@performance-agent`

### Output style

`performance-report`

---

## 6. Before Security Work

**Scripts:** `route-prompt.sh` + `route-file-edit.sh` (security branch)  
**Context:** `context/before-security-work.txt`

### Prompt keywords

`security`, `secret`, `api key`, `service role`, `credential`, `.env`, `leaked`

### Path patterns

`.env`, `middleware`, `supabase/functions`, `loadDotEnvLocal`, `/auth/`

### Skills

- Run the `security-review` skill

### Subagent

- `@security-agent`

### Output style

`security-report`

---

## 7. Before Release

**Script:** `route-prompt.sh` (release keyword branch)  
**Context:** `context/before-release.txt`

### Prompt keywords

`release`, `ship`, `ready to release`, `release readiness`, `prepare release`, `production-ready`, `v1 launch`

### Skills (ordered)

1. Run the `homepage-audit` skill
2. Run the `performance-audit` skill
3. Run the `performance-diagnostics` skill
4. Run the `security-review` skill
5. Run the `release-readiness` skill
6. Run the `regression-guard` skill

### Output style

`city-validation`, `release-report`

### Subagents

- **Lead:** `@qa-agent`
- **Support:** `@security-agent`, `@performance-agent`, `@edition-agent`, `@news-agent`, `@discovery-agent`

On FAIL: use `set-release-blocker.sh` to block subsequent commits until cleared.

---

## Directory layout

```
.claude/
├── settings.json              # Hook registration (5s / 90s timeouts)
├── README.md                  # Infrastructure index
├── HOOKS_ACTIVATION_GUIDE.md
└── hooks/
    ├── README.md              # this file
    ├── before-commit.sh
    ├── route-prompt.sh
    ├── route-file-edit.sh
    ├── _lib/kindred-hook-lib.sh
    ├── context/*.txt          # Injected context (references skills)
    ├── util/
    │   ├── set-release-blocker.sh
    │   └── clear-release-blocker.sh
    └── state/
        ├── .gitignore
        └── release-blockers.example.json
```

---

## Protected files (hooks do not modify)

- `CLAUDE.md`
- `docs/KINDRED_CONSTITUTION.md`
- `.cursor/rules/*`

Hooks only inject reminders; they never auto-edit application code.

---

## Disable hooks

In `.claude/settings.local.json`:

```json
{ "disableAllHooks": true }
```

Or remove entries from `.claude/settings.json`.

Inspect configured hooks: `/hooks` in Claude Code.
