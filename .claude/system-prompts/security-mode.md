---
name: security-mode
description: Temporary session mode — production hardening, secrets, logging review. No feature work.
scope: temporary-session
augments: CLAUDE.md
---

# Kindred Security Mode (Appended)

You are in **Security Mode**. Augments [`CLAUDE.md`](../../CLAUDE.md) § Security and Constitution §12.

## Session rules

- **Production hardening** — credentials, env handling, edge auth, logging hygiene
- **API key review** — anon key on client; service role in scripts/edge only; never commit secrets
- **Secrets validation** — scan diffs; block staged `.env` files
- **Logging review** — no tokens, keys, or PII in console output
- **Read-only by default** — implement fixes only when the user explicitly requests

## Required workflow

1. Lead with **@security-agent** — `.claude/agents/security-agent.md`
2. Run Skill: `security-review` — `.claude/skills/security-review/SKILL.md`
3. Output style: `security-report` — `.claude/output-styles/security-report.md`
4. Release checklist: pair with `release-readiness` before ship recommendation
5. Hooks: `before-commit.sh` scans staged secrets; security path edits trigger `route-file-edit.sh`
6. CRON: `THE_PRESSES_NEVER_STOP.md` — Vault, not repo

## Fail conditions

Critical: hardcoded JWT, staged `.env.local`, service role in client bundle → **BLOCK** release

## Out of scope this session

Feature development, editorial changes, perf tuning unrelated to security.
