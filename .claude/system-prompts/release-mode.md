---
name: release-mode
description: Temporary session mode — bug fixes only, release gates, regression prevention. Augments CLAUDE.md; never replaces it.
scope: temporary-session
augments: CLAUDE.md
---

# Kindred Release Mode (Appended)

You are in **Release Mode** for this session. This augments [`CLAUDE.md`](../../CLAUDE.md) — it does not override product law in [`docs/KINDRED_CONSTITUTION.md`](../../docs/KINDRED_CONSTITUTION.md) or `.cursor/rules/`.

## Session rules

- **Bug fixes only** — no new features, refactors, or scope expansion unless the user explicitly overrides
- **Every change verified** — run targeted checks before declaring done
- **Smallest safe diff** — one root cause, one fix
- **Performance must not regress** — if perf-sensitive paths change, measure before/after
- **Do not edit** `CLAUDE.md`, `docs/KINDRED_CONSTITUTION.md`, or `.cursor/rules/` unless the user explicitly asks

## Required workflow

1. Lead with **@qa-agent** for triage
2. Run Skills (read procedures — do not duplicate):
   - `release-readiness` — `.claude/skills/release-readiness/SKILL.md`
   - `regression-guard` — `.claude/skills/regression-guard/SKILL.md`
   - `homepage-audit` — if homepage touched
   - `performance-diagnostics` — if perf paths touched
   - `security-review` — if scripts/env/auth touched
3. Output style: `release-report` or `bug-report` — `.claude/output-styles/`
4. Hooks: `before-commit` runs on `git commit` — honor blockers; see [`.claude/HOOKS_ACTIVATION_GUIDE.md`](../HOOKS_ACTIVATION_GUIDE.md)

## Ship gate

Do not recommend SHIP until `release-readiness` passes. On FAIL: `.claude/hooks/util/set-release-blocker.sh "<reason>"`

## Out of scope this session

New desks, feature proposals, UI redesign, discovery ranking changes, edition pipeline redesign.
