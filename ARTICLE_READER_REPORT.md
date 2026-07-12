# Kindred Article Reader — Native-first report

**Date:** 2026-07-11  
**Goal:** Kindred first. Publisher source second. Seamless return to the newspaper.

---

## Story types that open natively

| Story type | Opens Kindred Article Reader | Notes |
| --- | --- | --- |
| Lead Story | Yes | Headline, image, summary, Read the story, knowledge notes |
| Top Stories | Yes | Headline, body, Read the story |
| Today in History | Yes | Headline, body, Read the story |
| Looking Ahead | Yes | Headline, body, Read the story |
| Discovery (Bandit’s Picks) | Yes | Title, dek, why, Read the story |
| Knowledge / explainer notes | Yes | Opens as a knowledge article in the same reader |
| Archived editions | Yes | Shared `EditionReader` + same reader |
| Clippings | Yes | Same native reader |
| Local Events | No (by design) | Opens event page / Maps — not the article reader |

---

## What content each reader receives

| Field | Source | Shown when |
| --- | --- | --- |
| Section / kicker | `article.section` | Always (or “Kindred briefing” when summary-only) |
| Headline | `article.headline` | Always |
| Dek | `article.dek` | When present |
| Byline / publication | `article.byline`, `article.source` | When present |
| Date / time | `article.publishedAt` | When parseable |
| Read estimate | derived word count | When enough text |
| Hero image + credit | `article.heroImage` | When URI loads |
| Body | `article.body[]` | Always (at least headline fallback) |
| Why this matters | companion / Knowledge | When stored |
| Why it’s in your paper | companion (lead) | When present |
| Further context | Knowledge facets (background, previous coverage, related, explainer, local, definition, timeline) | Up to 4 notes |
| Briefing frame | `isKindredBriefing()` | When only summary-length text is available |
| End actions | Save / View at source / Return | See below |

**End-of-article area (editorial links, not cards):**
1. Save for later / Saved to Clippings *(edition section UUIDs only)*  
2. View at the source ↗ *(when `sourceUrl` exists — secondary)*  
3. ← Today’s paper / ← The paper / ← Clippings  

Top bar back uses the same return label.

---

## How external-source return state is preserved

| Mechanism | Behavior |
| --- | --- |
| In-memory stash | Existing LRU article + companion maps |
| **AsyncStorage session** (`articleSession`) | Full article, companion, editionId, backLabel, clipSectionId, **scrollY** |
| Flush on “View at the source” | Session + scroll written before `Linking.openURL` |
| Flush on AppState background/inactive | Same persistence |
| Resume / remount `/article/[id]` | Hydrate: memory session → memory stash → AsyncStorage |
| Scroll restore | `initialScrollY` applied when content size is ready |
| Navigation stack | `router.back()` returns to the same paper screen when possible; else replace to edition or `/home` |

Leaving Kindred for the publisher does **not** require a WebView. Returning to the app restores the same article route and scroll when the session is still present.

---

## Stories that remain summary-only

Kindred does **not** scrape or copy full copyrighted publisher articles. These are framed as **Kindred briefings** (kicker + explicit note; never presented as the complete publisher piece):

| Type | Why summary-only |
| --- | --- |
| Lead Story | Stored lead summary / selection copy — not a licensed full text |
| Top Stories | Edition section prose generated/stored as a short newspaper summary |
| Today in History | Short historical note |
| Looking Ahead | Short forecast note |
| Discovery picks | Title + dek + editorial why |
| Knowledge / explainers | Facet summary text only |
| Any article with &lt; ~350 body words | Treated as briefing by `isKindredBriefing()` |

When a `sourceUrl` exists, the reader invites the reader to view the publisher’s full piece **after** Kindred’s briefing, then return to the paper.

**Clippable in-reader:** Top Stories, Today in History, Looking Ahead (and other future `edition_sections` UUIDs). Lead / Discovery / Knowledge ids are not clipping foreign keys.

---

## Files touched

- `components/ArticleReader.tsx` — briefing frame, knowledge block, end actions, soft source link, persistence hooks  
- `app/article/[id].tsx` — session hydrate + reliable back  
- `lib/edition/articleSession.ts` — durable session store  
- `lib/edition/openArticle.ts` — stash session on open  
- `lib/edition/article.ts` — `isKindredBriefing`, `isClippableSectionId`  
- `lib/edition/articleCompanion.ts` — `knowledgeNotes`  
- `lib/edition/surfaceIntelligence.ts` — richer companions + clip helper  
- `app/home.tsx`, `app/edition/[id].tsx`, `app/clippings.tsx` — back labels + companions  

No front-page redesign. No ranking changes. No WebView. No publisher scraping.
