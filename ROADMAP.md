# Kindred — Living Roadmap

**Governed by:** [`KINDRED_CONSTITUTION_v1.0.md`](./KINDRED_CONSTITUTION_v1.0.md)  
**Last updated:** July 5, 2026  
**Current objective:** Launch invite-only beta, learn from real users, improve based on evidence.

---

## How to use this document

Every new idea is classified into one of four buckets:

| Bucket | Meaning |
|--------|---------|
| **Build Now** | Required for beta launch or blocking real users today |
| **Build After Beta Validation** | Hypothesis worth testing only after core loop is proven with real users |
| **Future Opportunities** | Ideas held in reserve — **no development without user evidence** |
| **Reject** | Conflicts with the Constitution |

Nothing moves from **Future Opportunities** into development without evidence from real users.

---

## Current Sprint

**Goal:** Ship invite-only beta to first 5 users.

| Item | Bucket | Status |
|------|--------|--------|
| Production Supabase setup (migrations 0001–0003) | Build Now | Not started |
| Production env vars + auth URL configuration | Build Now | Not started |
| Deploy to Vercel | Build Now | Not started |
| End-to-end smoke test (founder) | Build Now | Not started |
| Invite first beta user | Build Now | Blocked on deploy |
| Watch logs during first 3 signups | Build Now | Blocked on deploy |
| Manual insight quality scoring (spreadsheet) | Build Now | Blocked on first users |

**Not in sprint:** New features, monetization, growth mechanics, public launch.

---

## Beta Launch Checklist

### Required before first beta user

- [ ] Run `supabase/migrations/0001_init.sql` on production Supabase
- [ ] Run `supabase/migrations/0002_insights.sql` on production Supabase
- [ ] Run `supabase/migrations/0003_hardening.sql` on production Supabase
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL` in production
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in production
- [ ] Set `ANTHROPIC_API_KEY` in production
- [ ] Configure Supabase **Site URL** to production domain
- [ ] Configure Supabase **Redirect URL** to `https://<domain>/auth/callback`
- [ ] Deploy to Vercel; verify build succeeds
- [ ] Set `INSIGHT_PROCESSING_STALE_MS=120000` (or above serverless function timeout)
- [ ] Set Anthropic spend limit in Anthropic console
- [ ] Confirm Vercel function timeout tier (60s recommended for AI route)
- [ ] Run full manual smoke test per [README checklist](./README.md#manual-testing-checklist)
- [ ] Founder completes one full flow: sign in → onboard → insight → logout → sign in again

### Recommended before 5 users

- [ ] Set `CRON_SECRET` (strong random value)
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` for cron backup
- [ ] Verify `/api/cron/process-insights` runs on schedule (`vercel.json`)
- [ ] Monitor Vercel logs during first 3 signups
- [ ] Prepare beta invite list (max 5–10 people you trust)
- [ ] Prepare lightweight feedback questions (see below)

### Beta success criteria (Constitution)

Five real users who:

1. Successfully complete onboarding
2. Receive a meaningful insight (validated by conversation, not just delivery)
3. Voluntarily return within two weeks without a reminder from us

---

## User Feedback

*Empty until beta users exist.*

### Feedback questions (for 1:1 conversations)

1. What did you expect Kindred to do before you tried it?
2. How did the first insight feel — honest, calm, useful, or something else?
3. Would you describe Kindred as an inventory app? Why or why not?
4. What would make you open Kindred again?
5. Is there anything that felt stressful, confusing, or untrustworthy?

### Raw notes

| User | Date | Onboarding | Insight quality | Returned? | Notes |
|------|------|------------|-----------------|-----------|-------|
| — | — | — | — | — | — |

---

## Validated Learnings

*Pre-beta: engineering and internal validation only. User hypotheses until real users confirm.*

### Validated (engineering)

| Learning | Evidence |
|----------|----------|
| Async insight pipeline works without blocking onboarding | Hardening milestone + 17 unit tests + production build |
| Stale `processing` jobs recover automatically | Reliability patch + `jobUtils` tests |
| Duplicate insights prevented | `unique(item_id)` + idempotent `ensureInsightForItem` |
| AI failure never blocks item save | Onboarding redirects after save; insight enqueued separately |
| RLS isolates user data | Migration policies + code review |
| App is ready for 5–10 invite-only users | Engineering audit (82/100); no P0 code defects |

### Hypotheses (not yet validated with users)

| Hypothesis | How we will test |
|------------|------------------|
| People want a calm reflection on things they underuse | First 5 beta users complete onboarding and rate insight quality |
| One insight is enough to earn a second visit | Track voluntary return within 14 days |
| Kindred is not perceived as inventory/marketplace | Ask directly in beta conversations |
| Onboarding prompt (garage/closet/storage) resonates | Observe completion rate and user language |

---

## Future Opportunities

**Gate:** Nothing here moves to development without evidence from beta users.

*Intentionally empty. Ideas will be added only when user feedback suggests a direction — not from speculation.*

When adding an item here, document:

- User signal (quote or behavior)
- Constitution alignment (all five decision questions)
- Smallest experiment to validate

---

## Technical Debt

Prioritized by Constitution: trust and operational reliability first.

### Build After Beta Validation (P1 — before public beta)

| Item | Why | Complexity |
|------|-----|------------|
| CI pipeline (typecheck, lint, test, build) | Prevent regressions as team grows | Low |
| Error monitoring (Sentry or equivalent) | See production failures without manual log diving | Low |
| Upgrade `next`, `@supabase/ssr`, `@supabase/supabase-js` | npm audit findings | Medium |
| Staging environment | Safer deploys before wider release | Medium |
| `markJob()` error handling | Silent DB write failures | Low |
| Rate limit fail-open behavior | Abuse/cost risk at scale | Low |
| Photo `alt` text improvement | Accessibility | Low |
| API JSON 401 for expired session during polling | Cleaner client behavior | Low |

### Future Opportunities (P2 — only if user evidence supports)

| Item | Why deferred |
|------|--------------|
| Storage DELETE policy (orphaned photos) | No user pain signal yet |
| Items UPDATE/DELETE RLS | No edit flow in product |
| `insight_generation_log` retention | Irrelevant at 5–10 users |
| Favicon / viewport metadata | Polish, not trust-blocking |
| Structured logger in `getProvider.ts` | Consistency only |

---

## Idea Evaluation Template

Use this when evaluating any new proposal against the Constitution.

```
### [Idea name]

**Proposal:** [one sentence]

**Constitution check:**
- Strengthens mission? [yes/no + why]
- Improves ownership relationship? [yes/no + why]
- Increases or decreases complexity? [+/- and how]
- Evidence required: [what would justify building it]
- Recommendation: [Build Now | Build After Beta | Future | Reject]
```

---

## Reject list (Constitution boundaries)

Permanent unless Constitution is revised:

- Inventory tracking, categorization, or collection dashboards
- Marketplace, resale, pricing, or affiliate features
- Engagement mechanics (streaks, badges, feeds, notifications for retention)
- Monetization before consistent user value
- Scale optimizations before reliability is proven
- Features because "other apps have them"

---

*Optimize for the smallest product people genuinely love — not the most features shipped.*
