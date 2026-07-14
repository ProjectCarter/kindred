import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type {
  HeroArtworkHoliday,
  HeroArtworkRecord,
  HeroArtworkSeason,
  HeroArtworkSelectionContext,
  ScoredHeroArtwork,
} from "./types.ts";
import {
  freezeHeroArtworkSelection,
  getFrozenHeroArtworkSelection,
  getHeroArtworkById,
  listApprovedHeroArtwork,
  markHeroArtworkUsed,
} from "./library.ts";
import { assertHeroArtworkSelectable, isHeroArtworkRecordSelectable } from "./licensing.ts";

const SCORE = {
  FEATURED: 1200,
  SEASON: 600,
  HOLIDAY: 500,
  EDITORIAL_PRIORITY: 4,
  RECENT_PENALTY: 300,
  NEVER_USED_BONUS: 80,
} as const;

export function parseEditionDate(date?: Date | string | null): Date {
  if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

export function getSeason(month: number): HeroArtworkSeason {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function daySeed(date: Date): number {
  return date.getFullYear() * 1000 + (date.getMonth() + 1) * 50 + date.getDate();
}

function scoreHeroArtwork(
  artwork: HeroArtworkRecord,
  ctx: {
    season: HeroArtworkSeason;
    holiday: HeroArtworkHoliday | null;
    recentArtworkIds: string[];
  }
): ScoredHeroArtwork {
  const reasons: string[] = [];
  let score = 0;

  if (artwork.featured) {
    score += SCORE.FEATURED;
    reasons.push("featured");
  }

  if (artwork.seasons.includes(ctx.season)) {
    score += SCORE.SEASON;
    reasons.push("season");
  }

  if (ctx.holiday && artwork.holidays.includes(ctx.holiday)) {
    score += SCORE.HOLIDAY;
    reasons.push("holiday");
  }

  score += artwork.editorialPriority * SCORE.EDITORIAL_PRIORITY;
  reasons.push("editorial-priority");

  if (!artwork.lastUsedAt) {
    score += SCORE.NEVER_USED_BONUS;
    reasons.push("never-used");
  }

  const recentIndex = ctx.recentArtworkIds.indexOf(artwork.id);
  if (recentIndex !== -1) {
    score -= SCORE.RECENT_PENALTY * (ctx.recentArtworkIds.length - recentIndex);
    reasons.push("rotation-penalty");
  }

  return { artwork, score, reasons };
}

export function scoreHeroArtworkCatalog(
  catalog: HeroArtworkRecord[],
  context: HeroArtworkSelectionContext = {}
): ScoredHeroArtwork[] {
  const date = parseEditionDate(context.date);
  const month = date.getMonth() + 1;
  const season = context.season ?? getSeason(month);
  const holiday = context.holiday ?? null;
  const recentArtworkIds = context.recentArtworkIds ?? [];

  return catalog
    .filter((artwork) => isHeroArtworkRecordSelectable(artwork))
    .map((artwork) => {
      assertHeroArtworkSelectable(artwork);
      return scoreHeroArtwork(artwork, { season, holiday, recentArtworkIds });
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.artwork.editorialPriority - a.artwork.editorialPriority ||
        a.artwork.internalId.localeCompare(b.artwork.internalId)
    );
}

function pickWithDailyRotation(
  scored: ScoredHeroArtwork[],
  date: Date
): HeroArtworkRecord | null {
  if (!scored.length) return null;
  const best = scored[0].score;
  const band = scored.filter((entry) => best - entry.score <= 100);
  const pool = band.length > 0 ? band : [scored[0]];
  const index = daySeed(date) % pool.length;
  return pool[index]?.artwork ?? scored[0].artwork;
}

/**
 * Choose one hero artwork for the morning masthead.
 * Prefers seasonal/holiday matches, avoids recent picks, rotates within top band.
 */
export function selectDailyHeroArtwork(
  catalog: HeroArtworkRecord[],
  context: HeroArtworkSelectionContext = {}
): HeroArtworkRecord | null {
  if (!catalog.length) return null;
  const date = parseEditionDate(context.date);
  const scored = scoreHeroArtworkCatalog(catalog, context);
  return pickWithDailyRotation(scored, date);
}

/**
 * Server path: return frozen selection for edition date, or select + freeze once.
 * Scrolling or refreshing must never change today's hero artwork.
 */
export async function resolveDailyHeroArtwork(
  admin: SupabaseClient,
  editionDate: string,
  context: HeroArtworkSelectionContext = {}
): Promise<HeroArtworkRecord | null> {
  const frozen = await getFrozenHeroArtworkSelection(admin, editionDate);
  if (frozen) {
    const artwork = await getHeroArtworkById(admin, frozen.artworkId);
    if (artwork) return artwork;
  }

  const catalog = await listApprovedHeroArtwork(admin);
  const selected = selectDailyHeroArtwork(catalog, {
    ...context,
    date: editionDate,
  });
  if (!selected) return null;

  await freezeHeroArtworkSelection(admin, editionDate, selected.id, {
    ...context,
    date: editionDate,
  });
  await markHeroArtworkUsed(admin, selected.id);
  return selected;
}
