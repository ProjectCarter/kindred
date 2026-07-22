# Kindred Claude Infrastructure

Project-scoped Claude Code layer for Kindred — hooks, skills, subagents, output styles, and session profiles. This directory augments [`CLAUDE.md`](../CLAUDE.md); it does not replace the Constitution or `.cursor/rules/`.

**Critical:** Hooks **inject context** and **block unsafe commits** only. They do **not** execute skills, run audit scripts, or spawn subagents. Claude must read skills and invoke `@subagent` names explicitly when context reminds it to.

---

## Architecture (8 layers)

Kindred Claude tooling stacks in this order — outer layers augment, never override inner law:

| # | Layer | Location | Role |
|---|-------|----------|------|
| 1 | **User instruction** | Current prompt | Explicit task for this turn |
| 2 | **CLAUDE.md** | Repo root | Permanent operating guide, verification rules |
| 3 | **Cursor rules** | `.cursor/rules/*.mdc` | Editorial, design, and product law |
| 4 | **Appended system prompt** | `.claude/system-prompts/*.md` | Session focus mode (`--append-system-prompt-file`) |
| 5 | **Hooks** | `.claude/hooks/` + `settings.json` | Event-driven context injection + commit gates |
| 6 | **Skills** | `.claude/skills/*/SKILL.md` | Procedural checklists Claude runs when invoked |
| 7 | **Subagents** | `.claude/agents/*.md` | Domain specialists via `@name` or delegation |
| 8 | **Output styles** | `.claude/output-styles/*.md` | Response format (`/config` → Output style) |

**Flow:** Hooks detect *when* to remind Claude. Skills define *how* to audit or fix. Subagents own *domain verdicts*. Output styles shape *report format*. Profiles keep the whole session in one lane.

---

## Directory map

```
.claude/
├── README.md                      ← this index
├── settings.json                  ← hook registration (committed)
├── HOOKS_ACTIVATION_GUIDE.md      ← hook discovery and lifecycle
├── SUBAGENTS.md                   ← subagent roster and handoffs
├── hooks/
│   ├── README.md                  ← per-hook reference
│   ├── before-commit.sh           ← PreToolUse: git commit gate
│   ├── route-file-edit.sh         ← PreToolUse: Edit|Write routing
│   ├── route-prompt.sh            ← UserPromptSubmit routing
│   ├── _lib/kindred-hook-lib.sh   ← shared helpers (jq or python3)
│   ├── context/*.txt              ← injected reminder text
│   ├── util/
│   │   ├── set-release-blocker.sh
│   │   └── clear-release-blocker.sh
│   └── state/                     ← release-blockers.json (gitignored)
├── skills/                        ← 10 procedural skills
│   ├── homepage-audit/
│   ├── local-news-verification/
│   ├── national-news-verification/
│   ├── news-pipeline-audit/
│   ├── edition-builder/
│   ├── performance-audit/
│   ├── performance-diagnostics/
│   ├── regression-guard/
│   ├── release-readiness/
│   └── security-review/
├── agents/                        ← 7 domain subagents
├── system-prompts/                ← 7 session profiles + README
└── output-styles/                 ← 10 report templates + README
```

Foundation docs (read, do not duplicate in skills): [`CLAUDE.md`](../CLAUDE.md), [`docs/KINDRED_CONSTITUTION.md`](../docs/KINDRED_CONSTITUTION.md), [`.cursor/rules/`](../.cursor/rules/).

---

## Instruction hierarchy

When guidance conflicts, resolve in this order (matches [`CLAUDE.md`](../CLAUDE.md)):

1. **Explicit current user instruction**
2. **`CLAUDE.md`**
3. **Applicable `.cursor/rules/*.mdc`** — scoped rules win over general ones
4. **Committed editorial documentation** — `docs/editorial/`, `docs/KINDRED_CONSTITUTION.md`
5. **Existing code behavior and tests**
6. **Older or stale documentation** — e.g. `KINDRED_CONSTITUTION_v1.0.md`, `ROADMAP.md`

Do not silently ignore contradictions. Prefer committed code + active Cursor rules over stale docs.

---

## Common workflows

Each workflow lists the recommended **profile**, **lead subagent**, **skills**, **output style**, **hook behavior**, and **activation**. Hooks only inject reminders — Claude must still run skills and delegate to subagents.

### Fix Local News

| Item | Value |
|------|-------|
| **Profile** | `news-mode.md` |
| **Subagent** | `@news-agent` (lead); `@edition-agent`, `@ui-agent` as needed |
| **Skills** | Run the `local-news-verification` skill → Run the `news-pipeline-audit` skill |
| **Output style** | `bug-report` or `engineering-summary` |
| **Hook behavior** | `route-file-edit.sh` injects `before-editing-news.txt` on news paths; no block |
| **Activation** | `claude --append-system-prompt-file .claude/system-prompts/news-mode.md` |

### Fix National News

| Item | Value |
|------|-------|
| **Profile** | `news-mode.md` |
| **Subagent** | `@news-agent` (lead); `@performance-agent` if hydration/cache |
| **Skills** | Run the `national-news-verification` skill → Run the `news-pipeline-audit` skill |
| **Output style** | `bug-report` |
| **Hook behavior** | Same news path hook as Local News |
| **Activation** | `claude --append-system-prompt-file .claude/system-prompts/news-mode.md` |

### Slow startup / performance

| Item | Value |
|------|-------|
| **Profile** | `performance-mode.md` |
| **Subagent** | `@performance-agent` (lead); `@edition-agent`, `@ui-agent` support |
| **Skills** | Run the `performance-diagnostics` skill (diagnose first); Run the `performance-audit` skill for TTFMC sign-off |
| **Output style** | `performance-report` |
| **Hook behavior** | `route-prompt.sh` injects `before-performance-investigation.txt` on perf keywords (grep prefilter, then JSON parse) |
| **Activation** | `claude --append-system-prompt-file .claude/system-prompts/performance-mode.md` |

### Homepage audit

| Item | Value |
|------|-------|
| **Profile** | `release-mode.md` or none |
| **Subagent** | `@qa-agent` or `@ui-agent` |
| **Skills** | Run the `homepage-audit` skill |
| **Output style** | `homepage-audit` or `city-validation` |
| **Hook behavior** | `route-file-edit.sh` injects `before-editing-homepage.txt` on homepage paths |
| **Activation** | Prompt: *Run the `homepage-audit` skill for today's Gilbert edition* |

### Edition build / missing sections

| Item | Value |
|------|-------|
| **Profile** | `edition-mode.md` |
| **Subagent** | `@edition-agent` (lead); `@discovery-agent`, `@news-agent` support |
| **Skills** | Run the `edition-builder` skill |
| **Output style** | `engineering-summary` |
| **Hook behavior** | `route-file-edit.sh` injects `before-edition-generation.txt` on build paths |
| **Activation** | `claude --append-system-prompt-file .claude/system-prompts/edition-mode.md` |

### Regression after a fix

| Item | Value |
|------|-------|
| **Profile** | `release-mode.md` |
| **Subagent** | `@qa-agent` |
| **Skills** | Run the `regression-guard` skill |
| **Output style** | `commit-summary` |
| **Hook behavior** | `before-commit.sh` injects `before-commit.txt` on `git commit` (includes regression-guard reminder) |
| **Activation** | After code change, before commit |

### Release readiness

| Item | Value |
|------|-------|
| **Profile** | `release-mode.md` |
| **Subagent** | `@qa-agent` (lead); `@security-agent`, `@performance-agent`, `@edition-agent`, `@news-agent`, `@discovery-agent` |
| **Skills** | Run `homepage-audit` → `performance-audit` → `performance-diagnostics` → `security-review` → `release-readiness` → `regression-guard` (in order per `before-release.txt`) |
| **Output style** | `release-report`, `city-validation` |
| **Hook behavior** | `route-prompt.sh` injects `before-release.txt` on release/ship keywords; FAIL → `.claude/hooks/util/set-release-blocker.sh` blocks commits |
| **Activation** | `claude --append-system-prompt-file .claude/system-prompts/release-mode.md` |

### Security review

| Item | Value |
|------|-------|
| **Profile** | `security-mode.md` |
| **Subagent** | `@security-agent` |
| **Skills** | Run the `security-review` skill |
| **Output style** | `security-report` |
| **Hook behavior** | Prompt keywords → `before-security-work.txt`; security file paths → same context on Edit/Write; `before-commit.sh` scans staged secrets |
| **Activation** | `claude --append-system-prompt-file .claude/system-prompts/security-mode.md` |

### UI polish

| Item | Value |
|------|-------|
| **Profile** | `ui-polish-mode.md` |
| **Subagent** | `@ui-agent` (lead); `@performance-agent` if slowness not layout |
| **Skills** | Run the `homepage-audit` skill; Run the `performance-diagnostics` skill if loading-related |
| **Output style** | `engineering-summary` |
| **Hook behavior** | Homepage path edits → `before-editing-homepage.txt` |
| **Activation** | `claude --append-system-prompt-file .claude/system-prompts/ui-polish-mode.md` |

---

## Activation

### Hooks (automatic)

Hooks load from [`.claude/settings.json`](settings.json) when Claude Code opens the repo. Restart Claude Code after first install or hook script changes.

Verify: run `/hooks` in Claude Code — expect UserPromptSubmit + two PreToolUse groups.

### Session profile (optional)

```bash
claude --append-system-prompt-file .claude/system-prompts/release-mode.md
```

See [`.claude/system-prompts/README.md`](system-prompts/README.md) for all profiles.

### Output style (optional)

Set in `.claude/settings.local.json`:

```json
{ "outputStyle": "performance-report" }
```

Or `/config` → Output style in Claude Code.

### Disable hooks locally

```json
{ "disableAllHooks": true }
```

in `.claude/settings.local.json` (gitignored).

---

## Prerequisites

| Tool | Required | Notes |
|------|----------|-------|
| **jq** | Preferred | Fast JSON for hook emit/read |
| **python3** | Fallback | Used when `jq` absent — stdlib `json` only |
| **git** | For before-commit | Staged diff secret scan |
| **bash** | 4+ | Hook scripts |

```bash
command -v jq || command -v python3   # at least one must succeed
command -v git
chmod +x .claude/hooks/*.sh .claude/hooks/util/*.sh
python3 -m json.tool .claude/settings.json > /dev/null
```

Hooks error with exit 2 only when **both** `jq` and `python3` are missing.

**Performance:** `route-file-edit.sh` and `route-prompt.sh` use **grep prefilters** before calling `require_json_tool`, so most turns skip JSON parsing entirely. Hook timeouts: **5s** for UserPromptSubmit and Edit|Write; **90s** for before-commit.

---

## Maintenance rules

1. **Hooks inject only** — never auto-run skills, scripts, or subagents from shell hooks.
2. **Context files reference** skills/subagents by name — do not duplicate `SKILL.md` procedures or Cursor rule text.
3. **Smallest safe change** — match patterns in `_lib/kindred-hook-lib.sh`; keep prefilters fast.
4. **Protected files** — hooks do not modify `CLAUDE.md`, `docs/KINDRED_CONSTITUTION.md`, or `.cursor/rules/*`.
5. **Release blockers** — use `set-release-blocker.sh` / `clear-release-blocker.sh`; state lives in `hooks/state/` (gitignored).
6. **New skill** — add `.claude/skills/<name>/SKILL.md`, wire into relevant `context/*.txt` and [`SUBAGENTS.md`](SUBAGENTS.md).
7. **New hook branch** — add matcher in lib, context file, document in [`hooks/README.md`](hooks/README.md) and this file.
8. **Cross-skill references** — use `Run the \`skill-name\` skill`, not markdown links to other `SKILL.md` files.
9. **Verify after edits** — `bash -n .claude/hooks/*.sh`, validate `settings.json`, run `/hooks`.

---

## Related documentation

| Doc | Path |
|-----|------|
| Operating guide | [`CLAUDE.md`](../CLAUDE.md) |
| Hook activation | [`HOOKS_ACTIVATION_GUIDE.md`](HOOKS_ACTIVATION_GUIDE.md) |
| Hook reference | [`hooks/README.md`](hooks/README.md) |
| Subagents | [`SUBAGENTS.md`](SUBAGENTS.md) |
| Session profiles | [`system-prompts/README.md`](system-prompts/README.md) |
| Output styles | [`output-styles/README.md`](output-styles/README.md) |
