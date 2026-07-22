# Kindred Claude Code Subagents

Project-scoped subagents live in [`.claude/agents/`](agents/). Each is a markdown file with YAML frontmatter (`name`, `description`, optional `skills`, `model`) plus a focused system prompt.

**Foundation docs** (read, do not duplicate in subagent work):

- [`CLAUDE.md`](../CLAUDE.md) — operating guide
- [`docs/KINDRED_CONSTITUTION.md`](../docs/KINDRED_CONSTITUTION.md) — product law
- [`.claude/skills/`](skills/) — procedural checklists subagents invoke

Invoke via natural language (*"Use the news-agent to…"*) or `@news-agent` in Claude Code.

---

## Subagent roster

| Subagent | `name` | Primary domain |
|----------|--------|----------------|
| News Agent | `news-agent` | Local + National News |
| Edition Agent | `edition-agent` | Build, completeness, cache |
| Performance Agent | `performance-agent` | Startup, hydration, timing |
| QA Agent | `qa-agent` | Audits, release, regression |
| Security Agent | `security-agent` | Secrets, env, logging |
| Discovery Agent | `discovery-agent` | Events, Activities, Food, History |
| UI Agent | `ui-agent` | Layout, loading, navigation, visuals |

---

## Which subagent for which request

| You want to… | Lead subagent | Often also invoke |
|--------------|---------------|-------------------|
| Fix Local News | **news-agent** | edition-agent (if build), ui-agent (render) |
| Improve National News | **news-agent** | edition-agent, performance-agent |
| Speed up homepage | **performance-agent** | edition-agent, ui-agent |
| Build / regenerate edition | **edition-agent** | discovery-agent, news-agent |
| Prepare a release | **qa-agent** | security-agent, performance-agent, edition-agent |
| Investigate a regression | **qa-agent** | domain agent for affected desk |
| Audit security | **security-agent** | — |
| Polish the UI | **ui-agent** | performance-agent (if slow) |
| Empty Events / Activities | **discovery-agent** | edition-agent |
| Wrong-city listings | **discovery-agent** | edition-agent |
| Stuck loading spinner | **ui-agent** | performance-agent |
| Cache / incomplete edition | **edition-agent** | performance-agent |
| Secrets in diff | **security-agent** | qa-agent (block ship) |

When unsure, start with **qa-agent** for triage or **performance-agent** for "slow" symptoms without a known desk.

---

## Collaboration patterns

### Sequential (handoff)

1. **performance-agent** diagnoses → identifies National News hydration
2. **news-agent** fixes pipeline → re-runs news skills
3. **qa-agent** confirms no regression

### Parallel (independent)

- **security-agent** + **performance-agent** during release prep
- **discovery-agent** + **news-agent** after buildEdition changes (different desks)

### Lead + support

| Workflow | Lead | Support |
|----------|------|---------|
| Fix Local News | news-agent | edition-agent, ui-agent |
| Improve National News | news-agent | edition-agent |
| Speed up homepage | performance-agent | edition-agent, ui-agent |
| Build new edition | edition-agent | discovery-agent, news-agent |
| Prepare release | qa-agent | security-agent, performance-agent, edition-agent |
| Investigate regression | qa-agent | affected domain agent |
| Audit security | security-agent | qa-agent (gate) |
| Polish UI | ui-agent | performance-agent |

**Rule:** One subagent **leads** (owns verdict + next action). Others **support** with focused reports. Parent session synthesizes; avoid duplicate full audits.

---

## Skills map (reference, don't duplicate)

| Subagent | Preloaded / primary skills |
|----------|---------------------------|
| news-agent | local-news-verification, national-news-verification, news-pipeline-audit |
| edition-agent | edition-builder, homepage-audit |
| performance-agent | performance-diagnostics, performance-audit |
| qa-agent | homepage-audit, release-readiness, regression-guard |
| security-agent | security-review |
| discovery-agent | homepage-audit, edition-builder (as needed) |
| ui-agent | homepage-audit, performance-diagnostics (as needed) |

Skills live in `.claude/skills/<name>/SKILL.md`. Subagents with `skills:` in frontmatter preload full skill content at startup.

---

## Protected files (all subagents)

Unless the user **explicitly** requests edits:

- `CLAUDE.md`
- `docs/KINDRED_CONSTITUTION.md`
- `.cursor/rules/*`

Subagents should not expand scope into unrelated desks or drive-by refactors.

---

## Directory structure

```
.claude/
├── SUBAGENTS.md          ← this file
├── agents/
│   ├── news-agent.md
│   ├── edition-agent.md
│   ├── performance-agent.md
│   ├── qa-agent.md
│   ├── security-agent.md
│   ├── discovery-agent.md
│   └── ui-agent.md
└── skills/
    ├── homepage-audit/
    ├── edition-builder/
    ├── performance-diagnostics/
    ├── performance-audit/
    ├── local-news-verification/
    ├── national-news-verification/
    ├── news-pipeline-audit/
    ├── release-readiness/
    ├── regression-guard/
    └── security-review/
```

---

## Quick invoke examples

```text
Use news-agent to diagnose why National News is blank on today's Gilbert edition.

Use performance-agent — homepage hangs after cache sync. Diagnose before changing code.

Use qa-agent to run release readiness for this branch.

Use security-agent on my staged diff before commit.

Use discovery-agent — Activities shows six coffee shops, no variety.

Use ui-agent — PaperLoading never clears on cold start (coordinate with performance-agent).

Use edition-agent to regenerate today's edition for phoenix-az and validate completeness.
```

---

## Session note

If a new `.claude/agents/` directory was created mid-session, restart Claude Code once so definitions load. Edits to existing agent files are picked up automatically.
