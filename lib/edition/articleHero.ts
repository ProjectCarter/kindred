/**
 * Article hero imagery — required visual identity for every Kindred story.
 * Prefer the wire photograph; fall back to curated editorial assets that
 * match subject mood. Never leave a premium article blank when avoidable.
 */

import type { ImageSourcePropType } from "react-native";
import type { KindredArticle } from "./article";
import { getHeroCatalog } from "./hero/catalog";
import type { HeroImageAsset } from "./hero/types";
import { getSeason } from "./hero/selectHeroImage";

export type ArticleHeroImage = {
  /** Remote news / wire photograph. */
  uri?: string | null;
  /** Local curated editorial asset when no wire photo exists. */
  source?: ImageSourcePropType | null;
  caption?: string | null;
  credit?: string | null;
  /** Provenance for future Learning Engine / analytics. */
  kind?: "wire" | "editorial";
};

type Mood =
  | "civic"
  | "shore"
  | "mountain"
  | "desert"
  | "seasonal"
  | "quiet";

function inferMood(section: string, headline: string, body: string): Mood {
  const blob = `${section} ${headline} ${body.slice(0, 280)}`.toLowerCase();

  if (
    /\b(beach|ocean|coast|harbor|island|sea|surf|shore|gulf|marina)\b/.test(blob)
  ) {
    return "shore";
  }
  if (
    /\b(mountain|alps|himalaya|rockies|hiking|summit|glacier|forest|park|wildlife|nature|climate|earth|space|nasa|science)\b/.test(
      blob
    )
  ) {
    return "mountain";
  }
  if (/\b(desert|drought|sand|cactus|arid|phoenix|arizona|sahara)\b/.test(blob)) {
    return "desert";
  }
  if (
    /\b(garden|flower|bloom|cook|food|recipe|festival|museum|art|culture|travel)\b/.test(
      blob
    ) ||
    section === "discovery"
  ) {
    return "seasonal";
  }
  if (
    /\b(president|congress|election|government|court|policy|diplomacy|war|ukraine|gaza|nato|market|bank|stock|economy|business|company|tech|politics|white house)\b/.test(
      blob
    ) ||
    section === "lead" ||
    section === "top_stories" ||
    section === "bandits_pick"
  ) {
    return "civic";
  }
  return "quiet";
}

function catalogById(id: string): HeroImageAsset | null {
  return getHeroCatalog().find((a) => a.id === id) ?? null;
}

function pickEditorialAsset(mood: Mood, season: string): HeroImageAsset {
  const seasonalId =
    season === "spring"
      ? "spring-flowers"
      : season === "summer"
        ? "summer-sunrise"
        : season === "autumn"
          ? "autumn-leaves"
          : "winter-snowfall";

  const preferredIds: string[] =
    mood === "civic"
      ? ["city-sunrise-generic", seasonalId, "default-morning"]
      : mood === "shore"
        ? ["beach-morning", "beach-morning-gulf", seasonalId, "default-morning"]
        : mood === "mountain"
          ? [
              "mountain-morning-rockies",
              "mountain-morning-pnw",
              seasonalId,
              "default-morning",
            ]
          : mood === "desert"
            ? ["desert-warm-morning", seasonalId, "default-morning"]
            : mood === "seasonal"
              ? [seasonalId, "default-morning", "city-sunrise-generic"]
              : ["default-morning", seasonalId, "city-sunrise-generic"];

  for (const id of preferredIds) {
    const asset = catalogById(id);
    if (asset) return asset;
  }

  const catalog = getHeroCatalog();
  return catalog.find((a) => a.id === "default-morning") ?? catalog[0];
}

/**
 * Resolve the hero for an article.
 * Wire photo wins; curated editorial fallback otherwise.
 */
export function resolveArticleHero(input: {
  headline: string;
  section: string;
  body?: string[];
  source?: string | null;
  imageUrl?: string | null;
  imageCaption?: string | null;
  existing?: KindredArticle["heroImage"] | null;
}): ArticleHeroImage {
  const existingUri = input.existing?.uri?.trim() || null;
  const wireUri = input.imageUrl?.trim() || existingUri;
  const existingSource = input.existing?.source ?? null;

  if (wireUri) {
    const sourceName = input.source?.trim() || "Kindred";
    return {
      uri: wireUri,
      source: null,
      caption:
        input.imageCaption?.trim() ||
        input.existing?.caption?.trim() ||
        input.headline,
      credit:
        input.existing?.credit?.trim() || `Photograph via ${sourceName}`,
      kind: "wire",
    };
  }

  if (existingSource) {
    return {
      uri: null,
      source: existingSource,
      caption: input.existing?.caption?.trim() || input.headline,
      credit: input.existing?.credit?.trim() || "Kindred editorial archive",
      kind: "editorial",
    };
  }

  const month = new Date().getMonth() + 1;
  const seasonName = getSeason(month);
  const mood = inferMood(
    input.section,
    input.headline,
    (input.body ?? []).join(" ")
  );
  const asset = pickEditorialAsset(mood, seasonName);

  return {
    uri: null,
    source: asset.source,
    caption: asset.title,
    credit: "Kindred editorial archive",
    kind: "editorial",
  };
}

/** Ensure every article carries a hero before it reaches the reader. */
export function ensureArticleHero(article: KindredArticle): KindredArticle {
  const hasWire = Boolean(article.heroImage?.uri?.trim());
  const hasLocal = Boolean(article.heroImage?.source);

  if (hasWire || hasLocal) {
    if (hasWire && !article.heroImage?.credit) {
      return {
        ...article,
        heroImage: {
          ...article.heroImage!,
          credit: `Photograph via ${article.source}`,
          caption: article.heroImage?.caption || article.headline,
          kind: article.heroImage?.kind ?? "wire",
        },
      };
    }
    return article;
  }

  const hero = resolveArticleHero({
    headline: article.headline,
    section: article.section,
    body: article.body,
    source: article.source,
    existing: article.heroImage,
  });

  return {
    ...article,
    heroImage: {
      uri: hero.uri,
      source: hero.source,
      caption: hero.caption,
      credit: hero.credit,
      kind: hero.kind,
    },
  };
}
