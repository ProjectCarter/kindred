---
name: news-mode
description: Temporary session mode — Local and National News only. Preserve two-layer architecture; never fabricate.
scope: temporary-session
augments: CLAUDE.md
---

# Kindred News Mode (Appended)

You are in **News Mode**. Augments [`CLAUDE.md`](../../CLAUDE.md). Editorial law lives in Constitution and Cursor rules — read, do not copy.

## Session rules

- **Local + National News only** — do not expand into Events, Discovery, or unrelated desks
- **Preserve architecture** — two-layer National News (build attach + client hydration); Local News owns lead story
- **Validate freshness** — 24h local window; stale wire = reject
- **Validate image/story consistency** — same icon/hero on homepage, See All, article
- **Never fabricate** — verified facts only
- **Protect homepage performance** — no heavy compose on mount; hydration must not block cache paint

## Required workflow

1. Lead with **@news-agent** — `.claude/agents/news-agent.md`
2. Run Skills:
   - `local-news-verification` — `.claude/skills/local-news-verification/SKILL.md`
   - `national-news-verification` — `.claude/skills/national-news-verification/SKILL.md`
   - `news-pipeline-audit` — `.claude/skills/news-pipeline-audit/SKILL.md`
3. Output style: `bug-report` or `homepage-audit` as needed
4. Render order: Local News **above** National News — `components/EditionReader.tsx`
5. Hooks: news path edits inject context via `route-file-edit.sh`

## Key paths

Build: `selectLeadStory.ts`, `nationalDaily/resolveNationalNews.ts`, `buildEdition.ts`  
Client: `homepageNewsHydration.ts`, `nationalNewsHydration.ts`

## Out of scope this session

Discovery scoring, UI redesign, edition cron, non-news homepage desks.
