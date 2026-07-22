---
name: release-report
description: Kindred pre-release sign-off report — features, risks, performance, security, QA, and ship recommendation.
keep-coding-instructions: true
---

You are producing **Kindred Release Reports**. Use this template for release readiness and ship/no-ship decisions. Run the `release-readiness` skill — do not duplicate its checklist here.

## Purpose

Single **executive release gate document** synthesizing QA, performance, security, and remaining risk before merge or deploy.

## When to use

- Before merge to main or production deploy
- User asks "are we ready to ship?"
- End of sprint / V1 milestone review
- After `qa-agent` coordinates cross-domain audits

## Required sections

1. **Release Status** — `SHIP | SHIP WITH MONITORING | DO NOT SHIP`
2. **Completed Features** — bullet list tied to commits or PRs
3. **Remaining Risks** — ranked table: risk, severity, mitigation
4. **Performance** — budget table + verdict (reference `performance-diagnostics`)
5. **Security** — verdict from `security-review` skill
6. **QA** — audits run, test results, market validation summary
7. **Recommendation** — clear next action with owner if blocked

## Optional sections

- **Scope** — branch, commit SHA, edition_date, target market
- **Rollback Plan** — if deploy risk warrants
- **Monitoring** — metrics/logs to watch post-ship
- **Known Limitations** — acceptable V1 gaps

## Formatting

- Title: `# Release Report — [version or branch] — [date]`
- Status banner on line 2: `**Release Status:** DO NOT SHIP`
- Use tables for Performance budget and Remaining Risks
- Link skills by name, not full procedure text
- No editorial constitution excerpts

## Example output

```markdown
# Release Report — safety/recovery-plan — 2026-07-22

**Release Status:** SHIP WITH MONITORING

## Completed Features
- News pipeline skills aligned to two-layer National News architecture
- Performance diagnostics skill + subagent library

## Remaining Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| Bandit's Picks hidden in V1 | Low | Documented; gate in tests |
| Cold launch not device-verified | Medium | Monitor BASELINE_REPORT in TestFlight |

## Performance
| Metric | Status |
|--------|--------|
| Cold launch ≤ 5s | WARNING — static pass, device pending |
| TTFMC ≤ 2s | PASS on repeat launch |
| Edge calls at launch | PASS |

## Security
**Verdict:** PASS — no secrets in diff; `security-review` complete.

## QA
- [x] `release-readiness` skill
- [x] `homepage-audit` Gilbert 2026-07-21
- [x] Typecheck pass
- [ ] Device cold launch confirmation

## Recommendation
Merge after one device cold-launch capture. Assign performance-agent follow-up for TestFlight metrics.
```

## Expected length

**Long:** 60–100 lines. Executive summary in Release Status ≤ 2 sentences if repeated at end.

## Related Skills

- `release-readiness` — **primary** procedural gate
- `homepage-audit`, `regression-guard`, `performance-audit`, `security-review`

## Related Subagents

- **Lead:** `qa-agent`
- **Support:** `security-agent`, `performance-agent`, `edition-agent`
