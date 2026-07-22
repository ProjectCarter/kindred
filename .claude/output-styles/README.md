# Kindred Output Styles

Project-scoped response formats for Claude Code. Each file in this directory modifies the system prompt to enforce a **consistent report structure** for Kindred operational work.

## How to use

1. Run `/config` → **Output style** → select a style
2. Or set in `.claude/settings.local.json`:

```json
{
  "outputStyle": "bug-report"
}
```

3. Start a **new session** or `/clear` after changing styles (system prompt loads once at session start)

## When to use output styles vs skills vs subagents

| Layer | Role |
|-------|------|
| **Output style** | *How* Claude formats every response in the session |
| **Skill** | *What procedure* to run for a task (checklist, scripts) |
| **Subagent** | *Who* handles a focused domain in a separate context |

Use an output style when you want every reply in a session to follow the same report template. Invoke skills and subagents inside that session — do not duplicate their procedures in the style file.

## Foundation (read, do not duplicate)

- [`CLAUDE.md`](../../CLAUDE.md)
- [`docs/KINDRED_CONSTITUTION.md`](../../docs/KINDRED_CONSTITUTION.md)
- [`.claude/skills/`](../skills/)
- [`.claude/SUBAGENTS.md`](../SUBAGENTS.md)

## Style index

| File | Style name | Use when |
|------|------------|----------|
| `bug-report.md` | Bug Report | Diagnosing and documenting bugs before fix |
| `release-report.md` | Release Report | Pre-ship sign-off |
| `engineering-summary.md` | Engineering Summary | End-of-task handoff |
| `performance-report.md` | Performance Report | Perf audits and regressions |
| `security-report.md` | Security Report | Secret/logging review |
| `homepage-audit.md` | Homepage Audit | Homepage desk verification |
| `city-validation.md` | City Validation | Market/metro edition QA |
| `commit-summary.md` | Commit Summary | Pre-commit / PR description draft |
| `claude-prompt.md` | Claude Prompt | Generate copy-paste task prompts |
| `feature-proposal.md` | Feature Proposal | Scope new work before implementation |

## Conventions

- All Kindred engineering styles set `keep-coding-instructions: true`
- Verdicts use **PASS | WARNING | FAIL** or **SHIP | DO NOT SHIP** where applicable
- Reference skills by name; run them — do not restate editorial law
- Expected lengths are guidelines, not hard limits
- File paths use repo-relative paths (`lib/edition/...`, `components/...`)

## Directory structure

```
.claude/
├── output-styles/     ← this directory
├── skills/
├── agents/
└── SUBAGENTS.md
```
