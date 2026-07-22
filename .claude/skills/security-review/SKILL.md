---
name: security-review
description: Reviews Kindred changes for credential exposure, secret logging, unsafe external data handling, and service-role misuse. Use before commit, after adding scripts, when touching env files, Supabase clients, or edge function auth.
---

# Security Review

## Law (read, do not duplicate)

- [`CLAUDE.md`](../../../CLAUDE.md) § Security
- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §12 Safety and Security
- [`.cursor/rules/kindred-editorial-constitution.mdc`](../../../.cursor/rules/kindred-editorial-constitution.mdc) — trust gates

## Purpose

Catch **credential leaks, secret logging, and unsafe data handling** before they reach git or production logs.

## When to use

- Before committing scripts that call Supabase
- After adding debug logging
- When reviewing audit/edge scripts
- PR touching `.env*`, `middleware.ts`, Supabase functions
- User reports possible key exposure

## Inputs

| Input | Required |
|-------|----------|
| `git diff` or changed file list | Yes |
| Scope | code / scripts / docs |

## Investigation steps

```
Progress:
- [ ] 1. Scan diff for secrets and credentials
- [ ] 2. Check script default fallbacks
- [ ] 3. Review Supabase client initialization
- [ ] 4. Review edge function auth (CRON_SECRET, service role)
- [ ] 5. Check .gitignore coverage
- [ ] 6. Report findings by severity
```

**Step 1 — Search patterns in changed files:**

```bash
git diff --name-only
# Ripgrep (conceptually): service_role, SUPABASE_SERVICE_ROLE, eyJ, api_key, secret, password, CRON_SECRET
```

**Step 2 — Script audit:** Many `scripts/*.mjs` embed fallback service keys when env unset — flag as **risk** if diff adds new hardcoded JWTs. Prefer `process.env` + `.env.local` only.

**Step 3 — Client vs server:**

- Client (`app/`, `components/`, `lib/` used in RN): **anon key only**
- Scripts / edge functions: service role acceptable locally — never commit real values

**Step 4 — Edge auth:** `THE_PRESSES_NEVER_STOP.md` — CRON_SECRET in Vault, not repo.

**Step 5 — `.gitignore`:** `.env`, `.env.local`, `.env*.local` must stay ignored.

## Verification checklist

- [ ] No real `.env` or `.env.local` in diff
- [ ] No new hardcoded JWTs, API keys, or passwords in committed files
- [ ] No `console.log` of tokens, keys, or full auth headers
- [ ] Service-role scripts document env requirement; use `loadDotEnvLocal.mjs` pattern where present
- [ ] External API responses validated before trust (editorial confidence stack)
- [ ] No user PII logged in production paths
- [ ] Supabase RLS assumptions not bypassed from client without intent
- [ ] Cron/webhook endpoints require secret validation

## Common failure patterns

| Finding | Severity | Example location |
|---------|----------|------------------|
| Hardcoded service-role JWT in script | Critical | `scripts/audit-*.mjs` fallbacks |
| Real `.env.local` staged | Critical | git add mistake |
| Debug log prints full Supabase response with keys | High | ad-hoc console.log |
| Service role in client bundle | Critical | wrong import in `app/` |
| CRON_SECRET in source | Critical | edge function caller |
| Audit script committed with live key in report | High | reports/ folder |

## Output format

```markdown
# Security Review — [scope]

## Verdict
CLEAR | ISSUES FOUND — DO NOT COMMIT

## Findings
| Severity | File | Issue | Recommendation |
|----------|------|-------|----------------|
| Critical | | | |

## Scanned
- Files: N
- Patterns: service_role, eyJ, API keys, secrets

## Safe practices observed
- ...

## Required before merge
1. ...
```

**Note:** Existing scripts may contain fallback keys — flag in report; do not "fix" application code during skill execution unless user requests.
