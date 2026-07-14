import type {
  HeroArtworkAsset,
  HeroArtworkContext,
  HeroArtworkHoliday,
  HeroArtworkSeason,
  ScoredHeroArtwork,
} from "./types";
import type { HeroArtworkCollectionId } from "./collections";
import { primaryCollection } from "./collections";
import { getHeroArtworkCatalog } from "./catalog";
import { isHeroArtworkAssetSelectable } from "./licensing";

const SCORE = {
  FEATURED: 1200,
  SEASON: 600,
  HOLIDAY: 500,
  COLLECTION_ROTATION_PENALTY: 400,
  EDITORIAL_PRIORITY: 4,
  RECENT_PENALTY: 300,
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

function collectionPenalty(
  asset: HeroArtworkAsset,
  recentCollectionIds: HeroArtworkCollectionId[]
): number {
  const primary = primaryCollection(asset.collections);
  if (!primary) return 0;
  const index = recentCollectionIds.indexOf(primary);
  if (index === -1) return 0;
  return SCORE.COLLECTION_ROTATION_PENALTY * (recentCollectionIds.length - index);
}

function scoreAsset(
  asset: HeroArtworkAsset,
  ctx: {
    season: HeroArtworkSeason;
    holiday: HeroArtworkHoliday | null;
    recentArtworkIds: string[];
    recentCollectionIds: HeroArtworkCollectionId[];
  }
): ScoredHeroArtwork {
  const reasons: string[] = [];
  let score = 0;

  if (asset.featured) {
    score += SCORE.FEATURED;
    reasons.push("featured");
  }
  if (asset.seasons.includes(ctx.season)) {
    score += SCORE.SEASON;
    reasons.push("season");
  }
  if (ctx.holiday && asset.holidays.includes(ctx.holiday)) {
    score += SCORE.HOLIDAY;
    reasons.push("holiday");
  }
  score += asset.editorialPriority * SCORE.EDITORIAL_PRIORITY;

  const recentIndex = ctx.recentArtworkIds.indexOf(asset.id);
  if (recentIndex !== -1) {
    score -= SCORE.RECENT_PENALTY * (ctx.recentArtworkIds.length - recentIndex);
    reasons.push("rotation-penalty");
  }

  score -= collectionPenalty(asset, ctx.recentCollectionIds);

  return { asset, score, reasons };
}

export function scoreHeroArtworkCatalog(
  context: HeroArtworkContext = {},
  catalog: HeroArtworkAsset[] = getHeroArtworkCatalog()
): ScoredHeroArtwork[] {
  const date = parseEditionDate(context.date);
  const month = date.getMonth() + 1;
  const season = context.season ?? getSeason(month);
  const holiday = context.holiday ?? null;
  const recentArtworkIds = context.recentArtworkIds ?? [];
  const recentCollectionIds = context.recentCollectionIds ?? [];

  return catalog
    .filter((asset) => isHeroArtworkAssetSelectable(asset))
    .map((asset) =>
      scoreAsset(asset, { season, holiday, recentArtworkIds, recentCollectionIds })
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.asset.editorialPriority - a.asset.editorialPriority ||
        a.asset.internalId.localeCompare(b.asset.internalId)
    );
}

function pickWithDailyRotation(
  scored: ScoredHeroArtwork[],
  date: Date
): HeroArtworkAsset | null {
  if (!scored.length) return null;
  const best = scored[0].score;
  const band = scored.filter((entry) => best - entry.score <= 100);
  const pool = band.length > 0 ? band : [scored[0]];
  const index = daySeed(date) % pool.length;
  return pool[index]?.asset ?? scored[0].asset;
}

export function selectHeroArtwork(
  context: HeroArtworkContext = {},
  catalog: HeroArtworkAsset[] = getHeroArtworkCatalog()
): HeroArtworkAsset | null {
  if (!catalog.length) return null;
  const date = parseEditionDate(context.date);
  const scored = scoreHeroArtworkCatalog(context, catalog);
  return pickWithDailyRotation(scored, date);
}
