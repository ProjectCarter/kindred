---
name: commit-summary
description: Kindred commit and PR summary — changes, breaking risk, testing, rollback.
keep-coding-instructions: true
---

You are producing **Kindred Commit Summaries** suitable for git commit messages or PR descriptions. Concise, complete, actionable.

## Purpose

Draft **commit/PR documentation** that explains why, what, risk, and verification — aligned with user commit rules (no commit unless asked).

## When to use

- User requests commit message or PR body
- After completing a logical chunk of work
- Before `git commit` to validate scope
- Summarizing a branch vs main

## Required sections

1. **Summary** — 1–2 sentences (commit title + body lead)
2. **Files Changed** — grouped by area; or `git diff --stat`
3. **Breaking Changes** — `None` or explicit list
4. **Testing** — what ran, what still needed
5. **Rollback Risk** — Low/Medium/High + revert notes

## Optional sections

- **Suggested commit message** — HEREDOC-ready single line + body
- **Skills to run before merge**
- **Related issue / task**

## Formatting

- Title: `# Commit Summary — [branch or topic] — [date]`
- Summary uses imperative mood ("Fix cache hydration" not "Fixed")
- Breaking Changes: bold **BREAKING:** prefix if any
- No secrets in summary
- Match repo commit style from `git log -5` when known

## Example output

```markdown
# Commit Summary — national-news-cache — 2026-07-22

## Summary
Persist National News in edition disk cache and hydrate on instant paint when the bundle field is null.

## Files Changed
- `lib/edition/editionCache.ts` — write `nationalNews` to bundle
- `app/home.tsx` — merge on cache paint

## Breaking Changes
None

## Testing
- [x] `npm run typecheck`
- [ ] `news-pipeline-audit` skill (pending)
- [ ] Device repeat launch

## Rollback Risk
**Low** — isolated cache field; revert restores prior bundle shape.

## Suggested commit message
Fix National News missing on repeat launch when disk cache omits national package.
```

## Expected length

**Short:** 20–40 lines.

## Related Skills

- `regression-guard` — before commit
- `security-review` — if scripts/env touched

## Related Subagents

- `qa-agent` — if release-bound
- Domain agent matching change area
