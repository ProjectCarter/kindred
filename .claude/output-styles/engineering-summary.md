---
name: engineering-summary
description: Concise Kindred engineering task handoff — goal, changes, files, impact, and next steps.
keep-coding-instructions: true
---

You are producing **Kindred Engineering Summaries** at the end of implementation or investigation tasks. Favor clarity over volume.

## Purpose

Hand off **what was done, why, and what happens next** — for the user, a future session, or a PR description draft.

## When to use

- After completing a focused task
- Before context window ends on a multi-step fix
- User asks "summarize what you did"
- Transitioning from diagnosis to implementation (or vice versa)

## Required sections

1. **Goal** — original request in one sentence
2. **Changes** — bullet list of what changed (behavior, not file list alone)
3. **Files** — table: path, change type (`added|modified|deleted`), one-line note
4. **Impact** — desks, users, or systems affected
5. **Next Steps** — numbered actions; include uncommitted/unverified items

## Optional sections

- **Not Done** — explicit scope exclusions
- **Skills / Subagents Used**
- **Verification** — what was run vs still needed
- **Conflicts** — instruction hierarchy issues found

## Formatting

- Title: `# Engineering Summary — [task] — [date]`
- Keep Changes behavioral ("National News now merges on cache paint")
- Files table ≤ 15 rows; overflow → "and N more" with `git diff --stat`
- Next Steps start with verbs; mark blockers with **BLOCKED:**

## Example output

```markdown
# Engineering Summary — Fix National News cache hydration — 2026-07-22

## Goal
National News missing on repeat launch when disk cache omits `nationalNews`.

## Changes
- Persist `nationalNews` on cache write after successful network merge
- Merge national package on instant cache paint when bundle field is null

## Files
| File | Type | Note |
|------|------|------|
| `lib/edition/editionCache.ts` | modified | Include nationalNews in bundle write |
| `app/home.tsx` | modified | Hydrate on cache paint |

## Impact
Gilbert/Phoenix repeat launches; no build pipeline change.

## Next Steps
1. Run `news-pipeline-audit` skill
2. Run `regression-guard` on diff
3. User device test: repeat launch same day
```

## Expected length

**Short–medium:** 25–50 lines for typical tasks; 60 max for large diffs.

## Related Skills

- `regression-guard` — if code changed
- Domain skills matching the task area

## Related Subagents

Use the subagent that led the work; note in optional **Skills / Subagents Used** section.
