---
name: feature-proposal
description: Kindred feature proposal — problem, value, technical impact, risks, dependencies, recommendation.
keep-coding-instructions: true
---

You are producing **Kindred Feature Proposals** before implementation. Align with V1 stabilization priorities in [`CLAUDE.md`](../../CLAUDE.md) — do not duplicate constitution text.

## Purpose

Scope **new work** with clear user value, technical impact, and ship/no-ship recommendation before code changes.

## When to use

- User describes a new feature or major enhancement
- Evaluating whether work fits V1 vs post-launch
- Architecture decision needing written tradeoffs
- Product/engineering alignment before sprint

## Required sections

1. **Problem** — what pain exists today (evidence if known)
2. **Goal** — one sentence success criteria
3. **User Value** — Kindred Effect: helps reader have a better day?
4. **Technical Impact** — files/systems touched; build vs client vs both
5. **Risks** — table: risk, severity, mitigation
6. **Dependencies** — editions, migrations, external APIs, other features
7. **Recommendation** — `BUILD NOW | DEFER | REJECT` with rationale

## Optional sections

- **Alternatives considered**
- **V1 phase fit** — matches CLAUDE.md priority order?
- **Editorial impact** — desks affected (reference rules by name only)
- **Performance budget impact**
- **Estimated scope** — S/M/L

## Formatting

- Title: `# Feature Proposal — [feature name] — [date]`
- Recommendation on line 2 if executive skim needed
- Risks table required when touching edition build, cache, or news
- DEFER if reliability/accuracy/security not stable per CLAUDE.md phase
- No implementation code in proposal unless illustrative pseudocode ≤ 10 lines

## Example output

```markdown
# Feature Proposal — Bandit's Picks V1 enable — 2026-07-22

**Recommendation:** DEFER

## Problem
Bandit's Pick is built but hidden; readers miss signature recommendation desk.

## Goal
Show one verified Bandit's Pick on homepage when editorial quality gate passes.

## User Value
High — personal recommendation fits Kindred voice; one pick, not a feed.

## Technical Impact
- `components/EditionReader.tsx` — unhide section
- `lib/edition/banditsPicksFeature.ts` — feature flag
- `buildEdition.ts` — pick already generated
- Cache bundle includes `bandit` payload

## Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| Pick quality inconsistent | Medium | Existing selectPick + confidence gates |
| Homepage perf | Low | Single card; no new fetch |

## Dependencies
- Edition completeness gate must include bandit when enabled
- `banditsPicksDisabled.test.ts` updates

## Recommendation
**DEFER** until Gilbert release gate PASS and homepage audit stable 5 consecutive days.
```

## Expected length

**Medium:** 40–70 lines.

## Related Skills

- `release-readiness` — if proposing near ship
- `homepage-audit` — if homepage-visible
- `regression-guard` — estimate test impact

## Related Subagents

| Feature area | Consult |
|--------------|---------|
| News | news-agent |
| Discovery desks | discovery-agent |
| Performance | performance-agent |
| UI | ui-agent |
| Scope/triage | qa-agent |
