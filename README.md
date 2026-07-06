# Kindred

Kindred is an honest AI advisor that helps people better understand,
appreciate, maintain, and get more value from the things they already own.

It is not an inventory app or a marketplace.

This release completes **Milestone 1** (sign in, onboarding, home) and
**Milestone 2** (first AI-generated insight), plus a **production hardening**
pass (async insight jobs, rate limiting, validation, and tests).

---

## Prerequisites

- [Node.js](https://nodejs.org) 18 or later (LTS recommended)
- A free [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key (for AI insights)

---

## Installation

```bash
git clone <your-repo-url>
cd kindred
npm install
```

Copy the environment template:

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` (see [Environment variables](#environment-variables) below).

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key — server-only, never exposed to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Required only for Vercel cron backup processing |
| `CRON_SECRET` | No | Secures `/api/cron/process-insights` on Vercel |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-6` |
| `AI_PROVIDER` | No | Defaults to `anthropic` |
| `INSIGHT_RATE_LIMIT_PER_HOUR` | No | Defaults to `10` |
| `INSIGHT_MAX_JOB_ATTEMPTS` | No | Defaults to `3` |
| `INSIGHT_POLL_INTERVAL_MS` | No | Home refresh interval while insight is pending (default `3000`) |
| `INSIGHT_POLL_MAX_ATTEMPTS` | No | Max home refresh attempts (default `20`) |
| `INSIGHT_POLL_TIMEOUT_MS` | No | Stop polling after this many ms (default `60000`) |
| `ONBOARDING_SAVE_TIMEOUT_MS` | No | Show recovery link after this many ms (default `30000`) |
| `PHOTO_MAX_BYTES` | No | Max upload size in bytes (default `5242880` / 5 MB) |

\*Without `ANTHROPIC_API_KEY`, onboarding and item saving still work. The home
screen shows a calm fallback: *"Kindred is still thinking about this item."*

All `NEXT_PUBLIC_*` variables are embedded in the client bundle. Never put
secret keys in a `NEXT_PUBLIC_` variable.

---

## Supabase setup

### 1. Create a project

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, choose a name (e.g. `kindred`), set a database
   password, and pick a region.
3. Wait for provisioning to finish.

### 2. Run database migrations

In the Supabase **SQL Editor**, run each migration file **in order**:

1. `supabase/migrations/0001_init.sql` — profiles, items, photo storage, RLS
2. `supabase/migrations/0002_insights.sql` — insights table and RLS
3. `supabase/migrations/0003_hardening.sql` — async insight jobs and rate-limit log

You should see *"Success. No rows returned."* for each.

### 3. Get API keys

In **Project Settings → API**, copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Configure authentication URLs

In **Authentication → URL Configuration**:

**Local development**

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** `http://localhost:3000/auth/callback`

**Production** (after deploying — see [Production deployment](#production-deployment))

- **Site URL:** `https://your-domain.com`
- **Redirect URLs:** `https://your-domain.com/auth/callback`

---

## Anthropic API setup

1. Sign in at [console.anthropic.com](https://console.anthropic.com).
2. Create an API key under **API Keys**.
3. Add it to `.env.local`:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. Ensure your Anthropic account has billing enabled and sufficient credits.

Insight generation runs **asynchronously in the background** after an item is
saved. The home screen shows a calm fallback until the insight is ready, then
updates automatically. Prompts live in `lib/ai/prompts.ts` and are tuned for
Kindred's calm, honest voice.

---

## Local development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Verify the codebase

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run test        # Vitest unit tests
npm run build       # Production build
```

---

## Production deployment

Kindred is a standard Next.js 14 app. [Vercel](https://vercel.com) is the
simplest path, but any Node.js host that supports Next.js App Router works.

### Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in Vercel.
3. Add all environment variables from `.env.local.example` in **Project Settings → Environment Variables**.
4. Set `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` for optional cron backup processing.
5. Deploy — `vercel.json` runs `/api/cron/process-insights` every 5 minutes as a backup.

### Update Supabase for production

After your first deploy, note your production URL (e.g.
`https://kindred.vercel.app`) and update Supabase **Authentication → URL
Configuration**:

- **Site URL:** your production URL
- **Redirect URLs:** `https://your-domain.com/auth/callback`

Redeploy if you change environment variables.

### Run migrations on production Supabase

If your production Supabase project is separate from development, run all three
migration files in its SQL Editor before going live.

---

## Manual testing checklist

Use this checklist after setup, before calling a release production-ready.

### Authentication

- [ ] Enter email on `/login` → receive magic link
- [ ] Click link on the same device → land on `/` then `/onboarding` (new user) or `/home` (returning user)
- [ ] Visit `/login` while signed in → redirected away
- [ ] Visit `/home` while signed out → redirected to `/login`
- [ ] Open an expired or invalid magic link → login shows: *"That sign-in link didn't work…"*

### Onboarding

- [ ] New user is routed to `/onboarding` after sign-in
- [ ] Submit with empty description → inline error, stays on page
- [ ] Submit with description → see *"Saving what you told me…"*, then redirect to home quickly
- [ ] If save takes too long → recovery link to home appears without blocking forever
- [ ] Visit `/onboarding` after completing it → redirected to `/home`

### Photo upload

- [ ] Submit with a photo → photo appears on home screen
- [ ] Submit without a photo → item saves and home loads normally
- [ ] Invalid photo type or oversized file → inline error on onboarding, item not saved
- [ ] If upload fails after validation → calm warning on home, description still saved

### AI insight generation

- [ ] With valid `ANTHROPIC_API_KEY` → home shows fallback briefly, then a thoughtful reflection
- [ ] Without `ANTHROPIC_API_KEY` → home shows: *"Kindred is still thinking about this item."*
- [ ] Refresh home → same insight appears (no duplicate generation)
- [ ] AI failure never prevents item from being saved or reaching home
- [ ] Rate limit (optional stress test) → fallback message, no crash

### Home screen

- [ ] Header shows today's date and **Sign out**
- [ ] Top card shows Kindred's reflection or the fallback message
- [ ] *"What I know so far"* lists the item with its description
- [ ] Slow load shows *"Kindred is thinking…"* loading state

### Logout

- [ ] Click **Sign out** → returned to `/login`
- [ ] After logout, `/home` requires sign-in again

### Error handling

- [ ] Invalid auth callback → friendly login error, no crash
- [ ] Item save failure → error on onboarding form, user can retry
- [ ] AI/API failure → item visible on home with fallback message
- [ ] No raw API errors or stack traces shown to the user

---

## Project structure

```
app/                  Next.js App Router pages and server actions
  actions/            Shared server actions (e.g. sign out)
  components/         Shared UI components
  home/               Home screen
  login/              Magic-link sign in
  onboarding/         First-item onboarding
lib/
  ai/                 AI provider abstraction and prompts
  auth/               Auth helpers
  insights/           Insight persistence
  items/              Item helpers
  api/                Background insight processing routes
  supabase/           Supabase client factories (browser, server, service)
supabase/migrations/  SQL migrations (run manually in Supabase SQL Editor)
```

---

## What's intentionally not here yet

- Multiple-item management beyond the first onboarding item
- Insight refresh or scheduled re-generation
- Notifications
- Marketplace browsing
- Matching between users

These come in later milestones, in order, once each is proven.

---

## License

Private — all rights reserved.
