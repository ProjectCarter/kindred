/**
 * Bandit's Pick hero imagery — card and article share one photograph.
 * Specific topics require specific photography; generic fallbacks only when honest.
 */

import type { ImageSourcePropType } from "react-native";
import type { BanditsPick } from "./bandit";
import type { ArticleHeroImage } from "./articleHero";
import { claimRemoteImage } from "./imageRegistry";
import { getHeroCatalog } from "./hero/catalog";
import { getSeason } from "./hero/selectHeroImage";

/** Verified topic photographs — shared by homepage card and article hero. */
const BANDIT_TOPIC_ASSETS: Record<string, ImageSourcePropType> = {
  blueberry_season: require("../../assets/bandits/blueberry-season.jpg"),
};

type PickStory = BanditsPick["story"] & {
  discoveryItem?: BanditsPick["story"]["discoveryItem"];
};

export type BanditHeroSubject = {
  momentId: string;
  genericOk: boolean;
  headlinePattern: RegExp;
  bundledAssetId?: string;
};

/** Client mirror of server heroSubject.ts — keep search titles in sync. */
export const BANDIT_HERO_SUBJECTS: Record<string, BanditHeroSubject> = {
  blueberry_season: {
    momentId: "blueberry_season",
    genericOk: false,
    headlinePattern: /blueberr/i,
    bundledAssetId: "blueberry-season",
  },
  strawberry_season: { momentId: "strawberry_season", genericOk: false, headlinePattern: /strawberr/i },
  peach_season: { momentId: "peach_season", genericOk: false, headlinePattern: /peach/i },
  firefly_season: { momentId: "firefly_season", genericOk: false, headlinePattern: /firefl/i },
  wildflower_bloom: {
    momentId: "wildflower_bloom",
    genericOk: false,
    headlinePattern: /wildflower|bloom/i,
    bundledAssetId: "spring-flowers",
  },
  cherry_blossoms: {
    momentId: "cherry_blossoms",
    genericOk: false,
    headlinePattern: /blossom|cherry/i,
    bundledAssetId: "spring-flowers",
  },
  lavender_bloom: { momentId: "lavender_bloom", genericOk: false, headlinePattern: /lavender/i },
  pumpkin_patches: { momentId: "pumpkin_patches", genericOk: false, headlinePattern: /pumpkin/i },
  meteor_showers: { momentId: "meteor_showers", genericOk: false, headlinePattern: /perseid|meteor/i },
  apple_picking: { momentId: "apple_picking", genericOk: false, headlinePattern: /apple pick/i },
  butterfly_season: { momentId: "butterfly_season", genericOk: false, headlinePattern: /butterfl/i },
  sunflower_bloom: { momentId: "sunflower_bloom", genericOk: false, headlinePattern: /sunflower/i },
  holiday_market: { momentId: "holiday_market", genericOk: false, headlinePattern: /holiday market/i },
  christmas_lights: { momentId: "christmas_lights", genericOk: false, headlinePattern: /holiday lights|lights begin/i },
  early_lights: { momentId: "early_lights", genericOk: false, headlinePattern: /lights going up|lights begin/i },
  farmers_markets_reopen: { momentId: "farmers_markets_reopen", genericOk: false, headlinePattern: /market/i },
  harvest_peak: { momentId: "harvest_peak", genericOk: false, headlinePattern: /harvest|market/i },
  tomato_season: { momentId: "tomato_season", genericOk: false, headlinePattern: /tomato/i },
  apple_cider_donuts: { momentId: "apple_cider_donuts", genericOk: false, headlinePattern: /cider donut/i },
  fall_foliage: {
    momentId: "fall_foliage",
    genericOk: false,
    headlinePattern: /fall color|peak color|foliage/i,
    bundledAssetId: "autumn-leaves",
  },
  cider_season: { momentId: "cider_season", genericOk: false, headlinePattern: /cider season/i },
  citrus_season: { momentId: "citrus_season", genericOk: false, headlinePattern: /citrus/i },
  fresh_start_january: { momentId: "fresh_start_january", genericOk: true, headlinePattern: /quietest week/i },
  quiet_year_end: { momentId: "quiet_year_end", genericOk: true, headlinePattern: /quiet stretch/i },
  longest_days: { momentId: "longest_days", genericOk: true, headlinePattern: /longest day/i, bundledAssetId: "summer-sunrise" },
  first_cool_morning: { momentId: "first_cool_morning", genericOk: true, headlinePattern: /cool morning/i, bundledAssetId: "autumn-leaves" },
  early_spring_thaw: { momentId: "early_spring_thaw", genericOk: true, headlinePattern: /thaw/i, bundledAssetId: "spring-flowers" },
};

const GENERIC_MONTH_ASSET: Record<number, string> = {
  0: "winter-snowfall",
  1: "winter-snowfall",
  2: "spring-flowers",
  3: "spring-flowers",
  4: "spring-flowers",
  5: "summer-sunrise",
  6: "summer-sunrise",
  7: "summer-sunrise",
  8: "autumn-leaves",
  9: "autumn-leaves",
  10: "autumn-leaves",
  11: "winter-snowfall",
};

export function momentIdFromBanditPickId(pickId: string): string | null {
  const match = pickId.match(/^bandit_seasonal_(.+)$/);
  return match?.[1] ?? null;
}

function heroSubjectForHeadline(headline: string): BanditHeroSubject | null {
  for (const subject of Object.values(BANDIT_HERO_SUBJECTS)) {
    if (subject.headlinePattern.test(headline)) return subject;
  }
  return null;
}

function catalogAsset(id: string) {
  return getHeroCatalog().find((a) => a.id === id) ?? null;
}

function monthFromEditionDate(editionDate?: string | null): number {
  const m = editionDate?.match(/^\d{4}-(\d{2})/)?.[1];
  if (m) return Number(m) - 1;
  return new Date().getMonth();
}

function topicBundledHero(
  momentId: string | null,
  subject: BanditHeroSubject | null,
  caption: string
): ArticleHeroImage | null {
  if (momentId && BANDIT_TOPIC_ASSETS[momentId]) {
    return {
      uri: null,
      source: BANDIT_TOPIC_ASSETS[momentId],
      caption,
      credit: "Kindred editorial photograph",
      kind: "editorial",
    };
  }

  if (subject?.bundledAssetId && !subject.genericOk) {
    const asset = catalogAsset(subject.bundledAssetId);
    if (asset) {
      return {
        uri: null,
        source: asset.source,
        caption: asset.title,
        credit: "Kindred editorial archive",
        kind: "editorial",
      };
    }
  }

  return null;
}

export function resolveBanditsPickHero(input: {
  id: string;
  kind: BanditsPick["kind"];
  headline: string;
  imageUrl?: string | null;
  imageCaption?: string | null;
  heroMomentId?: string | null;
  discoveryItem?: PickStory["discoveryItem"];
  editionDate?: string | null;
}): ArticleHeroImage | null {
  const momentId =
    input.heroMomentId?.trim() ||
    momentIdFromBanditPickId(input.id) ||
    null;
  const subject =
    (momentId ? BANDIT_HERO_SUBJECTS[momentId] : null) ??
    heroSubjectForHeadline(input.headline);
  const caption = input.imageCaption?.trim() || input.headline;

  if (subject && !subject.genericOk) {
    const bundled = topicBundledHero(momentId, subject, caption);
    if (bundled) return bundled;

    const wire = input.imageUrl?.trim();
    if (wire) {
      return {
        uri: wire,
        source: null,
        caption,
        credit: "Kindred editorial archive",
        kind: "editorial",
      };
    }

    const editorialUrl = input.discoveryItem?.editorialImage?.url?.trim();
    if (editorialUrl) {
      const remote = claimRemoteImage(
        input.id,
        editorialUrl,
        input.discoveryItem?.editorialImage?.libraryId
      );
      if (remote) {
        const uri =
          typeof remote === "object" && remote !== null && "uri" in remote
            ? String((remote as { uri: string }).uri)
            : null;
        return {
          uri,
          source: typeof remote === "number" ? remote : null,
          caption,
          credit:
            input.discoveryItem?.editorialImage?.attributionText?.trim() ||
            "Kindred editorial archive",
          kind: "editorial",
        };
      }
    }

    return null;
  }

  const wire = input.imageUrl?.trim();
  if (wire) {
    return {
      uri: wire,
      source: null,
      caption,
      credit: "Kindred editorial archive",
      kind: "editorial",
    };
  }

  const editorialUrl = input.discoveryItem?.editorialImage?.url?.trim();
  if (editorialUrl) {
    const remote = claimRemoteImage(
      input.id,
      editorialUrl,
      input.discoveryItem?.editorialImage?.libraryId
    );
    if (remote) {
      const uri =
        typeof remote === "object" && remote !== null && "uri" in remote
          ? String((remote as { uri: string }).uri)
          : null;
      return {
        uri,
        source: typeof remote === "number" ? remote : null,
        caption,
        credit:
          input.discoveryItem?.editorialImage?.attributionText?.trim() ||
          "Kindred editorial archive",
        kind: "editorial",
      };
    }
  }

  if (subject?.bundledAssetId && !subject.genericOk) {
    const asset = catalogAsset(subject.bundledAssetId);
    if (asset) {
      return {
        uri: null,
        source: asset.source,
        caption: asset.title,
        credit: "Kindred editorial archive",
        kind: "editorial",
      };
    }
  }

  if (subject?.genericOk) {
    const assetId =
      subject.bundledAssetId ??
      GENERIC_MONTH_ASSET[monthFromEditionDate(input.editionDate)] ??
      "default-morning";
    const asset = catalogAsset(assetId);
    if (asset) {
      return {
        uri: null,
        source: asset.source,
        caption: asset.title,
        credit: "Kindred editorial archive",
        kind: "editorial",
      };
    }
  }

  // Specific topic with no matched photograph — honest no-image beats a misleading skyline.
  if (subject && !subject.genericOk) {
    return null;
  }

  if (input.kind === "seasonal") {
    return null;
  }

  return null;
}

/** Card image source — same priority as the article hero. */
export function resolveBanditsPickCardImage(
  pick: BanditsPick,
  editionDate?: string | null
): ImageSourcePropType | null {
  const hero = resolveBanditsPickHero({
    id: pick.story.id,
    kind: pick.kind,
    headline: pick.story.headline,
    imageUrl: pick.story.imageUrl,
    imageCaption: pick.story.imageCaption,
    heroMomentId: pick.story.heroMomentId,
    discoveryItem: pick.story.discoveryItem,
    editionDate,
  });
  if (!hero) return null;
  if (hero.uri) return { uri: hero.uri };
  if (hero.source) return hero.source;
  return null;
}
