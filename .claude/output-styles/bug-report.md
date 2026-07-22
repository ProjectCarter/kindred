---
name: bug-report
description: Structured Kindred bug diagnosis report — root cause, evidence, fix, and regression risk before code changes.
keep-coding-instructions: true
---

You are producing **Kindred Bug Reports**. Every response that documents or investigates a bug must follow this template. Do not duplicate editorial law — reference [`CLAUDE.md`](../../CLAUDE.md) and applicable skills.

## Purpose

Capture a **complete, evidence-backed bug diagnosis** before implementing fixes — so regressions are preventable and handoffs are clear.

## When to use

- User reports incorrect behavior, missing content, or crashes
- After bisect identifies a regression commit
- Before proposing a fix for a non-trivial bug
- When delegating to a subagent and synthesizing their findings

## Required sections

1. **Summary** — one paragraph: symptom, surface, severity
2. **Root Cause** — primary failure point (one sentence + detail)
3. **Evidence** — logs, queries, repro steps, screenshots described
4. **Files** — table of implicated paths with role
5. **Fix Recommendation** — smallest safe change; no drive-by refactors
6. **Regression Risk** — what else could break; desks affected
7. **Verification Steps** — checklist + skills/tests to run after fix

## Optional sections

- **Timeline** — when introduced (commit, date)
- **Workaround** — temporary mitigation if any
- **Related Issues** — linked PRs, prior chats

## Formatting

- Title: `# Bug Report — [short title] — [date]`
- Severity: `Critical | High | Medium | Low`
- Verdict line: `CONFIRMED | LIKELY | INCONCLUSIVE`
- Use tables for Files and Verification Steps
- Code paths as `` `path/to/file.ts` `` — no line dumps unless essential
- Bullet evidence items with source (`Metro log`, `Supabase row`, `git bisect`)

## Example output

```markdown
# Bug Report — National News blank after cache sync — 2026-07-22

**Severity:** High · **Verdict:** CONFIRMED

## Summary
Repeat launch paints homepage from disk cache but National News desk is empty while Local News renders. Affects Gilbert users with warm cache.

## Root Cause
`mergeNationalNewsHydration` receives null from stale bundle; network merge skipped when `loadEdition` short-circuits on cache match.

## Evidence
- Metro: `[coldLaunch:trace] national_news present: false` at render_gate
- Disk bundle: `nationalNews: null`, edition row has `national_news` populated
- Repro: kill app → relaunch same day → National News missing

## Files
| File | Role |
|------|------|
| `app/home.tsx` | Cache paint short-circuit |
| `lib/edition/nationalNewsHydration.ts` | Runtime merge |
| `lib/edition/editionCache.ts` | Bundle shape |

## Fix Recommendation
Ensure cache write includes `nationalNews` after network fetch; merge on paint when bundle field null. Single-file preference: `editionCache.ts` persist path.

## Regression Risk
Local News hydration; cold launch path; metroKey cache collision.

## Verification Steps
- [ ] Run `news-pipeline-audit` skill
- [ ] Repeat launch National News present
- [ ] `regression-guard` for changed files
```

## Expected length

**Medium:** 40–80 lines for typical bugs; up to 120 for cross-desk issues. Summary ≤ 4 sentences.

## Related Skills

- `regression-guard` — post-fix verification
- `homepage-audit` — if homepage symptom
- `news-pipeline-audit`, `local-news-verification`, `national-news-verification` — news bugs
- `performance-diagnostics` — if perf symptom masquerading as bug
- `edition-builder` — if missing persisted data

## Related Subagents

| Symptom area | Subagent |
|--------------|----------|
| News desks | `news-agent` |
| Missing sections | `edition-agent` |
| Slow / hang | `performance-agent` |
| Discovery listings | `discovery-agent` |
| UI / spinner | `ui-agent` |
| Triage | `qa-agent` |
