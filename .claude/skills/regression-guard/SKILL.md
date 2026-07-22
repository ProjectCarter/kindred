---
name: regression-guard
description: Guards against Kindred editorial and homepage regressions by running targeted tests, mirror sync, and diff-scoped checks after code changes. Use after fixing bugs, before merge, or when adding new publication gates.
---

# Regression Guard

## Law (read, do not duplicate)

- [`CLAUDE.md`](../../../CLAUDE.md) — preservation rules, smallest safe change
- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §13 Change Discipline
- [`lib/edition/kindredArticleProse.ts`](../../../lib/edition/kindredArticleProse.ts)
- [`lib/edition/banditsPicksDisabled.test.ts`](../../../lib/edition/banditsPicksDisabled.test.ts) — V1 pick gate
- [`components/EditionReader.tsx`](../../../components/EditionReader.tsx) — homepage order tests

## Purpose

After a change, run **the minimum test and audit set** that would have caught the bug — and recommend a durable prevention rule if missing.

## When to use

- Immediately after a bug fix
- Before committing editorial gate changes
- After homepage, cache, or news desk edits
- When bisect identified a regression commit

## Inputs

| Input | Required |
|-------|----------|
| Changed files (`git diff --name-only`) | Yes |
| Bug description / symptom | Recommended |
| Edition date for live check | If homepage-related |

## Investigation steps

```
Progress:
- [ ] 1. Map changed files → affected desks/systems
- [ ] 2. Select targeted tests from matrix below
- [ ] 3. Run mirror sync if shared editorial modules changed
- [ ] 4. Run static/homepage assertions
- [ ] 5. Optional live audit if data path changed
- [ ] 6. Recommend new test or rule if gap found
```

**Step 1 — Diff scope:**

```bash
git diff --name-only main...HEAD
# or
git diff --name-only
```

**Step 2 — Targeted test matrix:**

| Changed area | Run |
|--------------|-----|
| `EditionReader.tsx`, homepage components | `node --test lib/edition/homepageDeskOrder.test.ts lib/edition/homepageNewsHydration.test.ts lib/edition/banditsPicksDisabled.test.ts` |
| Local News | `node --test lib/edition/localNews*.test.ts` |
| Discovery / geography | `node --test lib/edition/discoveryGeography.test.ts` |
| Prose / editorial gates | `node --test lib/edition/kindredArticleProse.test.ts lib/edition/articleIntegrity.test.ts` |
| Food & Drinks | `node --test lib/edition/foodDrink*.test.ts lib/edition/foodDrinksSection.test.ts` |
| Events presentation | `node --test lib/edition/localEvent*.test.ts lib/edition/eventDisplayImage.test.ts` |
| Edition build | `npm run test:generation` |
| Story Editor | `node --test supabase/functions/_shared/storyEditor/validators.test.ts` |
| National desks | `npm run test:nationwide-audit` |
| Shared editorial mirrors | `npm run check:mirror-sync` |

**Step 3 — Full generation suite** when touching `buildEdition`, `sectionAllocator`, or staged build:

```bash
npm run test:generation
npm run typecheck
```

**Step 4 — Homepage static assertions:** Read `lib/edition/homepageDeskOrder.test.ts`, `components/ArticleReader.headline.test.ts` if news layout touched.

**Step 5 — Live audit** (if client cache or sync changed):

```bash
node scripts/audit-gilbert-homepage-today.mjs [date]
```

## Verification checklist

- [ ] All targeted tests pass
- [ ] `check-mirror-sync` passes if `lib/edition/*` + server mirror both changed
- [ ] No fix that hides a desk to make tests pass
- [ ] Local News still mounts after news-related fix
- [ ] Bandit's Picks still respects V1 disabled flag
- [ ] Prose gates still reject wrap-up endings (if editorial copy touched)
- [ ] New behavior covered by test OR documented prevention rule

## Common failure patterns

| Regression | Missing guard | Add |
|------------|---------------|-----|
| Local News section removed | EditionReader integration test | Assert `NewsArticleSection` + order |
| Warm cache drops discovery | homepage hydration test | Extend `homepageNewsHydration.test.ts` |
| AI wrap-ups published | prose gate bypass | Wire `validateKindredArticleProse` |
| Client/server digest drift | mirror sync | Update pair in `check-mirror-sync.mjs` |
| Bandit's Pick breaks V1 load | disabled test | `banditsPicksDisabled.test.ts` |
| Wrong homepage desk order | desk order test | `homepageDeskOrder.test.ts` |

## Output format

```markdown
# Regression Guard — [commit/branch]

## Change scope
Files changed: N
Areas: [homepage | local news | discovery | editorial gates | perf | other]

## Tests run
| Command | Result |

## Live audits
| Script | Result | (or SKIPPED — reason)

## Regression risk
LOW | MEDIUM | HIGH

## Gaps found
- [ ] No test covers X — recommend: ...

## Prevention recommendation
If this bug could recur, add:
- [ ] Unit test in ...
- [ ] Cursor rule note in ... (user approval required)
- [ ] Audit script check in ...

## Verdict
SAFE TO COMMIT | FIX TESTS FIRST | NEEDS LIVE VERIFICATION
```

## Rule for fixes

Never satisfy this skill by:
- Disabling a homepage section
- Skipping prose validation on hot paths without explicit product approval
- Removing tests to green the suite

Fix root cause; add the smallest test that fails without the fix.
