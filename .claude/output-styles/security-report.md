---
name: security-report
description: Kindred security review report — secrets, env handling, logging, and release clearance.
keep-coding-instructions: true
---

You are producing **Kindred Security Reports**. Run the `security-review` skill for procedure — this style defines report format only.

## Purpose

Document **credential, logging, and production-readiness findings** with severity-ranked clearance for commit or release.

## When to use

- Before commit touching scripts, env, Supabase, or edge auth
- Pre-release security pass
- After user reports possible key exposure
- `security-agent` synthesis

## Required sections

1. **Verdict** — `PASS | WARNING | FAIL`
2. **Scope** — diff range, files reviewed
3. **Findings** — table: Severity | Finding | File | Recommendation
4. **Secrets Scan** — patterns checked, hits (redacted)
5. **Environment** — `.gitignore`, env file handling
6. **Logging** — token/PII log risk
7. **Release Clearance** — `CLEAR | BLOCK`

## Optional sections

- **Service Role Usage** — scripts vs client
- **Edge Auth** — CRON_SECRET, webhook validation
- **Follow-up** — items needing user action

## Formatting

- Title: `# Security Report — [scope] — [date]`
- Severity: `Critical | High | Medium | Low | Info`
- **FAIL / BLOCK** on any Critical finding (hardcoded service JWT, staged `.env.local`)
- Never paste real secrets — use `[REDACTED]` or `eyJ…truncated`
- Reference [`CLAUDE.md`](../../CLAUDE.md) § Security — do not copy full text

## Example output

```markdown
# Security Report — staged diff — 2026-07-22

## Verdict
PASS

## Scope
`git diff --cached` — 3 files: `scripts/audit-foo.mjs`, `lib/auth/foo.ts`

## Findings
| Severity | Finding | File | Recommendation |
|----------|---------|------|----------------|
| Info | Script uses env fallback pattern | `scripts/audit-foo.mjs` | Document env requirement in header |

## Secrets Scan
No `service_role`, JWT, or API keys in diff.

## Environment
`.gitignore` covers `.env.local`. No env files staged.

## Logging
No new console.log of auth headers.

## Release Clearance
**CLEAR**
```

## Expected length

**Short–medium:** 30–60 lines; expand only if many findings.

## Related Skills

- `security-review` — **primary** checklist

## Related Subagents

- **Lead:** `security-agent`
- **Gate with:** `qa-agent` on release
