/**
 * Regional experience profiles — what is genuinely "a thing here, right now."
 * Experiences are not businesses. A monsoon sunset, Perseid peak, or wildflower
 * bloom can be authentic without a venue listing.
 */

import type { DiscoveryRankingContext } from "../discovery/types.ts";

export type ExperienceKind =
  | "phenomenon"
  | "wildlife"
  | "harvest"
  | "outdoor"
  | "cultural"
  | "tradition";

export type ExperienceProfile = {
  kind: ExperienceKind;
  /** U-pick, orchard, market — must have a verified venue anchor. */
  requiresVenue: boolean;
  /** When true, calendar window + regional pass is enough to verify the experience. */
  phenomenon: boolean;
  /** US state codes where locals would say "yep, that's happening." */
  authenticStates?: string[];
  /** States where a lifelong local would reject the story. */
  blockedStates?: string[];
  /** Months (1–12) when the experience is regionally real. Empty = any month in calendar window. */
  authenticMonths?: number[];
  experienceTitle: string;
  describeExperience: (area: string, ctx: DiscoveryRankingContext) => string;
};

function stateCode(ctx: DiscoveryRankingContext): string | null {
  const raw = ctx.state?.trim().toUpperCase() ?? ctx.region?.trim().toUpperCase() ?? null;
  if (!raw || raw.length !== 2) return null;
  return raw;
}

function monthFromCtx(ctx: DiscoveryRankingContext): number {
  const iso = ctx.editionDate?.match(/^(\d{4})-(\d{2})/);
  if (iso) return Number(iso[2]);
  return (ctx.now ?? new Date()).getMonth() + 1;
}

const SW_DESERT = ["AZ", "NM"];
const PNW_COAST = ["WA", "OR", "AK"];
const FIREFLY_REGION = [
  "WI", "MI", "MN", "IA", "IL", "IN", "OH", "PA", "NY", "NJ", "CT", "MA",
  "VT", "NH", "ME", "MD", "DE", "VA", "WV", "KY", "TN", "NC", "SC", "GA",
  "AL", "MS", "LA", "AR", "MO",
];
const FOLIAGE_REGION = [
  "ME", "NH", "VT", "MA", "CT", "RI", "NY", "NJ", "PA", "MD", "DE", "VA",
  "WV", "NC", "SC", "GA", "TN", "KY", "OH", "MI", "WI", "MN", "CO", "UT",
  "ID", "MT", "WY", "WA", "OR",
];

/** State-specific month windows — desert wildflowers peak in spring, not midsummer. */
const REGIONAL_MONTH_WINDOWS: Record<string, Partial<Record<string, number[]>>> = {
  wildflower_bloom: {
    AZ: [3, 4, 5],
    NM: [3, 4, 5, 6],
    CA: [3, 4, 5, 6, 7],
  },
};

export const EXPERIENCE_PROFILES: Record<string, ExperienceProfile> = {
  monsoon_evenings: {
    kind: "phenomenon",
    requiresVenue: false,
    phenomenon: true,
    authenticStates: SW_DESERT,
    authenticMonths: [7, 8, 9],
    experienceTitle: "Monsoon Evening Skies",
    describeExperience: (area) =>
      `Summer monsoon storms build over ${area} most evenings in July and August — dramatic clouds, golden light, and the kind of sunset locals actually pull over to watch.`,
  },
  meteor_showers: {
    kind: "phenomenon",
    requiresVenue: false,
    phenomenon: true,
    experienceTitle: "The Perseid Meteor Shower",
    describeExperience: (area) =>
      `The Perseids peak in mid-August — a short window when ${area} readers can step outside after dark and catch real shooting stars without a telescope.`,
  },
  wildflower_bloom: {
    kind: "phenomenon",
    requiresVenue: false,
    phenomenon: true,
    authenticStates: [...SW_DESERT, "CA", "CO", "UT", "TX", ...PNW_COAST, "OR", "WA"],
    authenticMonths: [3, 4, 5, 6, 7],
    experienceTitle: "Peak Wildflower Bloom",
    describeExperience: (area) =>
      `Wildflower color is at its best near ${area} right now — the kind of short-lived bloom locals notice on trails, preserves, and open hillsides.`,
  },
  firefly_season: {
    kind: "wildlife",
    requiresVenue: false,
    phenomenon: true,
    authenticStates: FIREFLY_REGION,
    blockedStates: [...SW_DESERT, "NV", "CA", "FL"],
    authenticMonths: [6, 7],
    experienceTitle: "Firefly Season",
    describeExperience: (area) =>
      `Fireflies are active near ${area} on warm summer evenings — a quiet, short-lived spectacle that locals know to catch at dusk.`,
  },
  longest_days: {
    kind: "outdoor",
    requiresVenue: false,
    phenomenon: true,
    experienceTitle: "The Longest Days of the Year",
    describeExperience: (area) =>
      `The year's longest daylight is here — ${area} evenings stay bright late enough for a spontaneous walk, patio dinner, or park visit after work.`,
  },
  first_cool_morning: {
    kind: "outdoor",
    requiresVenue: false,
    phenomenon: true,
    blockedStates: [...SW_DESERT, "FL", "TX", "LA"],
    authenticMonths: [9, 10, 11],
    experienceTitle: "The First Cool Morning Hike",
    describeExperience: (area) =>
      `The first genuinely cool mornings have arrived near ${area} — the week's best excuse for an early trail, park loop, or neighborhood walk before the day heats up.`,
  },
  fall_foliage: {
    kind: "phenomenon",
    requiresVenue: false,
    phenomenon: true,
    authenticStates: FOLIAGE_REGION,
    blockedStates: SW_DESERT,
    authenticMonths: [9, 10, 11],
    experienceTitle: "Peak Fall Color",
    describeExperience: (area) =>
      `Fall color is building near ${area} — the short window when overlooks, drives, and tree-lined trails actually look like autumn.`,
  },
  cherry_blossoms: {
    kind: "phenomenon",
    requiresVenue: false,
    phenomenon: true,
    authenticMonths: [3, 4],
    experienceTitle: "Cherry Blossom Season",
    describeExperience: (area) =>
      `Cherry blossoms are opening near ${area} — a brief, photogenic week when parks and garden paths feel worth a deliberate visit.`,
  },
  butterfly_season: {
    kind: "wildlife",
    requiresVenue: false,
    phenomenon: true,
    authenticMonths: [9, 10],
    experienceTitle: "Butterfly Migration Season",
    describeExperience: (area) =>
      `Butterflies are on the move near ${area} — gardens, preserves, and late-summer meadows are the places to catch them this week.`,
  },
  quiet_year_end: {
    kind: "tradition",
    requiresVenue: false,
    phenomenon: true,
    authenticMonths: [12],
    experienceTitle: "The Quiet Stretch of the Year",
    describeExperience: (area) =>
      `The last weeks of December slow down near ${area} — a good week for neighborhood lights, a calm museum morning, or an unhurried local tradition.`,
  },
  fresh_start_january: {
    kind: "outdoor",
    requiresVenue: false,
    phenomenon: true,
    authenticMonths: [1],
    experienceTitle: "The Year's Quietest Week",
    describeExperience: (area) =>
      `Early January is the calmest week near ${area} — fewer crowds, softer plans, and room for a simple local outing.`,
  },
  early_spring_thaw: {
    kind: "phenomenon",
    requiresVenue: false,
    phenomenon: true,
    blockedStates: SW_DESERT,
    authenticMonths: [3],
    experienceTitle: "Early Spring Thaw",
    describeExperience: (area) =>
      `The first thaw is showing near ${area} — gardens, river paths, and botanical walks are waking up for the season.`,
  },
  salmon_run: {
    kind: "wildlife",
    requiresVenue: false,
    phenomenon: true,
    authenticStates: [...PNW_COAST, "AK"],
    authenticMonths: [9, 10, 11],
    experienceTitle: "Salmon Run Season",
    describeExperience: (area) =>
      `Salmon are running near ${area} — a reliable autumn ritual at rivers, fish ladders, and coastal viewpoints locals watch for every year.`,
  },
  whale_migration: {
    kind: "wildlife",
    requiresVenue: false,
    phenomenon: true,
    authenticStates: [...PNW_COAST, "CA", "AK", "HI"],
    authenticMonths: [12, 1, 2, 3, 4, 5],
    experienceTitle: "Whale Migration Season",
    describeExperience: (area) =>
      `Whales are moving along the coast near ${area} — a seasonal spectacle worth catching from shore overlooks and harbor viewpoints this week.`,
  },
  blueberry_season: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    blockedStates: SW_DESERT,
    experienceTitle: "Blueberry Season",
    describeExperience: (area) =>
      `Blueberry season is open near ${area} — a short u-pick window when the rows fill early and the fruit does not wait.`,
  },
  strawberry_season: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Strawberry Season",
    describeExperience: (area) =>
      `Strawberry fields are at their best near ${area} — a brief harvest window locals watch every spring.`,
  },
  peach_season: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Peach Season",
    describeExperience: (area) =>
      `Tree-ripened peaches are arriving near ${area} — soft, fragrant, and gone within weeks.`,
  },
  tomato_season: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Tomato Season",
    describeExperience: (area) =>
      `Peak tomato season is here near ${area} — farm stands and markets are where locals grab the good ones.`,
  },
  citrus_season: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    authenticStates: ["AZ", "CA", "FL", "TX"],
    authenticMonths: [1, 2],
    experienceTitle: "Citrus Season",
    describeExperience: (area) =>
      `Citrus is at its sweetest near ${area} — groves and farm stands are the honest way to catch the season.`,
  },
  lavender_bloom: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Lavender Bloom",
    describeExperience: (area) =>
      `Lavender fields are in bloom near ${area} — a short purple window worth the drive.`,
  },
  sunflower_bloom: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Sunflower Bloom",
    describeExperience: (area) =>
      `Sunflower fields are at peak bloom near ${area} — wide rows, late-summer light, and a season that turns fast.`,
  },
  pumpkin_patches: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Pumpkin Patch Season",
    describeExperience: (area) =>
      `Pumpkin patches are opening near ${area} — the kind of autumn outing families actually make time for.`,
  },
  apple_picking: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Apple Picking Season",
    describeExperience: (area) =>
      `Apple orchards are open near ${area} — baskets, cider smells, and a harvest locals mark on the calendar.`,
  },
  apple_cider_donuts: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Cider Donut Season",
    describeExperience: (area) =>
      `Cider mills and farm stands near ${area} are frying the year's first cider donuts — a small ritual worth the detour.`,
  },
  cider_season: {
    kind: "harvest",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Cider Season",
    describeExperience: (area) =>
      `Fresh cider is flowing near ${area} — orchards and mills are the honest center of the season.`,
  },
  harvest_peak: {
    kind: "tradition",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Peak Harvest Season",
    describeExperience: (area) =>
      `Harvest season is at its peak near ${area} — markets, orchards, and farm stands are the week's real story.`,
  },
  farmers_markets_reopen: {
    kind: "tradition",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Farmers Market Season",
    describeExperience: (area) =>
      `Saturday markets are back in full swing near ${area} — the weekly rhythm locals actually build their morning around.`,
  },
  holiday_market: {
    kind: "cultural",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Holiday Market Season",
    describeExperience: (area) =>
      `Holiday markets are open near ${area} — a limited-run tradition that disappears when the season turns.`,
  },
  christmas_lights: {
    kind: "cultural",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Holiday Lights Season",
    describeExperience: (area) =>
      `Holiday light displays are up near ${area} — the kind of evening outing locals make once a year.`,
  },
  early_lights: {
    kind: "cultural",
    requiresVenue: true,
    phenomenon: false,
    experienceTitle: "Early Holiday Lights",
    describeExperience: (area) =>
      `The first holiday lights are going up near ${area} — worth a slow evening drive while the displays are still new.`,
  },
};

export type RegionalAuthenticity = {
  ok: boolean;
  reason: string;
};

/** Would a lifelong local say "yep, that's happening right now"? */
export function assessRegionalAuthenticity(
  momentId: string,
  ctx: DiscoveryRankingContext
): RegionalAuthenticity {
  const profile = EXPERIENCE_PROFILES[momentId];
  if (!profile) {
    return { ok: false, reason: "No experience profile." };
  }

  const state = stateCode(ctx);
  const month = monthFromCtx(ctx);

  if (state && profile.blockedStates?.includes(state)) {
    return {
      ok: false,
      reason: `${momentId} is not a genuine local experience in ${state}.`,
    };
  }

  if (profile.authenticStates?.length) {
    if (!state || !profile.authenticStates.includes(state)) {
      return {
        ok: false,
        reason: `${momentId} is not regionally authentic for ${state ?? "this area"}.`,
      };
    }
  }

  if (profile.authenticMonths?.length && !profile.authenticMonths.includes(month)) {
    return {
      ok: false,
      reason: `${momentId} is not in season for month ${month}.`,
    };
  }

  const regionalMonths = state
    ? REGIONAL_MONTH_WINDOWS[momentId]?.[state]
    : undefined;
  if (regionalMonths && !regionalMonths.includes(month)) {
    return {
      ok: false,
      reason: `${momentId} is not in season for ${state} in month ${month}.`,
    };
  }

  return { ok: true, reason: "Regionally authentic for this week." };
}

export function experienceProfile(momentId: string): ExperienceProfile | null {
  return EXPERIENCE_PROFILES[momentId] ?? null;
}
