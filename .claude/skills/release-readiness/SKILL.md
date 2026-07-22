---
name: release-readiness
description: Runs the Kindred V1 release readiness checklist across edition completeness, homepage audit, tests, mirror sync, and editorial gates. Use before shipping a branch, tagging a release, or declaring an edition production-ready.
---

# Release Readiness

## Law (read, do not duplicate)

- [`CLAUDE.md`](../../../CLAUDE.md) — V1 priorities, verification rules, completion report
- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) — full product law
- [`package.json`](../../../package.json) — available npm scripts
- Engineering gates: `kindredEditorialStandards.ts`, `kindredArticleProse.ts`, `storyEditor/validators.ts`

## Purpose

Single **pre-release gate** — confirm reliability, accuracy, performance signals, and editorial quality before ship.

## When to use

- Before merge to main / production deploy
- Before declaring Gilbert (or target market) edition production-ready
- After large editorial or homepage commits
- User asks "are we ready to ship?"

## Inputs

| Input | Required | Default |
|-------|----------|---------|
| Target branch / commit | Yes | HEAD |
| `edition_date` | For live checks | Latest good date |
| Market | No | Gilbert / phoenix-az |
| Credentials | For live audits | `.env.local` |

## Investigation steps

```
Progress:
- [ ] 1. Git hygiene — status clean for release scope
- [ ] 2. Typecheck
- [ ] 3. Unit test suites
- [ ] 4. Mirror sync
- [ ] 5. Edition completeness (live)
- [ ] 6. Homepage audit (live)
- [ ] 7. Nationwide audit tests (if national desks touched)
- [ ] 8. Performance spot-check (static + logs if available)
- [ ] 9. Security scan on diff
- [ ] 10. Summarize verdict
```

**Commands (run what applies to the change):**

```bash
npm run typecheck
npm run test:generation
npm run test:markets
npm run test:nationwide-audit   # if national news / masterpiece touched
npm run check:mirror-sync
node scripts/verify-edition-completeness.mjs [date] [user_id]
node scripts/audit-gilbert-homepage-today.mjs [date]
npm run audit:nationwide          # full editorial audit (heavier)
```

**Invoke other skills as needed** (read `.claude/skills/<name>/SKILL.md`):

- Run the `homepage-audit` skill — section matrix
- Run the `performance-audit` skill — if perf-sensitive diff
- Run the `security-review` skill — on full branch diff
- Run the `regression-guard` skill — if editorial gates touched

## Verification checklist

### Reliability
- [ ] Edition builds to `ready` with sections
- [ ] Required homepage desks present (see constitution §5)
- [ ] Local News + National News both mount

### Accuracy
- [ ] No placeholder/filler copy in production headlines
- [ ] Discovery geography correct for target market
- [ ] Family-safe filtering active

### Code quality
- [ ] `npm run typecheck` passes
- [ ] Relevant test suites pass
- [ ] `npm run check:mirror-sync` passes

### V1 product gates
- [ ] Bandit's Picks hidden unless explicitly re-enabled
- [ ] Homepage listings text-first
- [ ] No secrets in diff

### Documentation
- [ ] Changes align with `CLAUDE.md` and constitution
- [ ] No silent contradiction with `.cursor/rules/`

## Common failure patterns

| Blocker | Detection |
|---------|-----------|
| Tests pass but edition empty | Live homepage audit FAIL |
| Mirror drift | `check-mirror-sync` exit 1 |
| Type errors deferred | Skipped typecheck |
| National/local news merged | EditionReader order wrong |
| Incomplete edition marked ready | completeness script FAIL |
| Stale ROADMAP assumed | Ignored constitution hierarchy |

## Output format

```markdown
# Release Readiness — [branch] @ [commit] — [date]

## Verdict
SHIP | DO NOT SHIP | SHIP WITH CAVEATS

## Gate summary
| Gate | Command | Result |
|------|---------|--------|
| Typecheck | npm run typecheck | PASS/FAIL/SKIP |
| Generation tests | npm run test:generation | |
| Mirror sync | npm run check:mirror-sync | |
| Edition completeness | verify-edition-completeness | |
| Homepage audit | audit-gilbert-homepage-today | |

## Blockers (must fix)
1. ...

## Caveats (ship with known limits)
1. ...

## Manual verification still required
- [ ] Device cold launch
- [ ] Tap through each homepage desk
- [ ] ...

## Sign-off recommendation
One paragraph.
```
