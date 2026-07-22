---
name: homepage-audit
description: Kindred homepage desk audit report — section order, completeness, images, performance, editorial quality, final grade.
keep-coding-instructions: true
---

You are producing **Kindred Homepage Audit Reports**. Run the `homepage-audit` skill for steps — this style defines deliverable format.

## Purpose

Verify the homepage is a **complete, honest newspaper** with correct desk order and text-first policy.

## When to use

- Daily market sanity check
- After edition build, cache sync, or `EditionReader` changes
- Pre-release homepage verification
- User reports blank or wrong section

## Required sections

1. **Final Grade** — `PASS | WARNING | FAIL`
2. **Section Order** — expected vs actual (source: `EditionReader.tsx`)
3. **Missing Sections** — desks absent or empty with reason
4. **Images** — homepage text-first compliance; feature-story exceptions noted
5. **Performance** — TTFMC / completeness if measured (brief)
6. **Empty States** — honest fallbacks vs placeholder filler
7. **Editorial Quality** — placeholder copy, wrong headlines, desk-specific notes

## Optional sections

- **Edition metadata** — date, metro_key, edition_id, cache vs network
- **Local vs National News** — order and presence
- **Scripts run** — audit command outputs
- **Skills checklist** — from `homepage-audit` skill

## Formatting

- Title: `# Homepage Audit — [city/metro] — [edition_date]`
- Section order as numbered list matching production render
- Missing sections table: Desk | Status | Count | Notes
- Images: confirm **no listing thumbnails** on standard desks
- FAIL on silent desk removal or Local News below National News

## Example output

```markdown
# Homepage Audit — Gilbert / phoenix-az — 2026-07-22

## Final Grade
PASS

## Section Order
Expected order confirmed in `EditionReader.tsx`. Local News above National News. ✓

## Missing Sections
| Desk | Status | Count | Notes |
|------|--------|-------|-------|
| Bandit's Picks | Hidden V1 | — | Expected |

## Images
Text-first listings on Events, Activities, Food & Drinks. Story of feature image present. ✓

## Performance
TTFMC 1100ms cache paint; completeness gate PASS.

## Empty States
None — all required desks populated.

## Editorial Quality
No template filler detected. Headlines use verified venue names.
```

## Expected length

**Medium:** 40–70 lines.

## Related Skills

- `homepage-audit` — **primary**
- `news-pipeline-audit` — if news desks fail
- `performance-diagnostics` — if slow or incomplete paint

## Related Subagents

- **Lead:** `qa-agent`
- **Support:** `edition-agent`, `news-agent`, `discovery-agent`, `ui-agent`
