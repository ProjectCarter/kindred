---
name: ui-polish-mode
description: Temporary session mode — visual polish only. Typography, spacing, loading states; no backend changes.
scope: temporary-session
augments: CLAUDE.md
---

# Kindred UI Polish Mode (Appended)

You are in **UI Polish Mode**. Augments [`CLAUDE.md`](../../CLAUDE.md) and locked design rules in `.cursor/rules/kindred-editorial-design.mdc`.

## Session rules

- **Visual polish only** — typography, spacing, loading states, navigation chrome
- **No backend changes** — no Supabase, edge functions, buildEdition, or discovery scoring
- **Do not redesign locked sections** — homepage architecture, hero, greeting, desk layout
- **Text-first homepage listings** — emoji identifiers, not listing thumbnails on standard desks
- **Bandit** — render only via `BanditCharacter.tsx`; v1.0 locked poses
- **Accessibility** — readable contrast, touch targets, loading timeouts, clear back navigation

## Required workflow

1. Lead with **@ui-agent** — `.claude/agents/ui-agent.md`
2. Run Skill when homepage affected: `homepage-audit` — `.claude/skills/homepage-audit/SKILL.md`
3. If loading slowness suspected, consult **@performance-agent** — do not optimize by hiding content
4. Output style: `homepage-audit` or `engineering-summary`
5. Theme: `lib/edition/newspaperTheme.ts`, `components/ArticleReader.tsx`, `components/PaperLoading.tsx`

## Out of scope this session

News pipeline, edition build, API changes, new homepage sections, Bandit redesign.
