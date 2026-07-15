/**
 * Localize Bandit's Pick editorials — anchor stories in the reader's community.
 */

import type { DiscoveryRankingContext } from "../discovery/types.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import type { BanditSeasonalEditorial } from "./editorialContent.ts";

export type NearbyEditorialPick = {
  name: string;
  description: string;
  glyph: string;
};

type LocalPlace = NonNullable<DiscoveryRankingContext["localPlaces"]>[number];

const MOMENT_GLYPH: Record<string, string> = {
  blueberry_season: "🫐",
  peach_season: "🍑",
  strawberry_season: "🍓",
  firefly_season: "✨",
  wildflower_bloom: "🌸",
  cherry_blossoms: "🌸",
  lavender_bloom: "💜",
  pumpkin_patches: "🎃",
  apple_picking: "🍎",
  meteor_showers: "✨",
  butterfly_season: "🦋",
  sunflower_bloom: "🌻",
  holiday_market: "🎄",
  christmas_lights: "✨",
  farmers_markets_reopen: "🧺",
  harvest_peak: "🧺",
};

const MOMENT_PLACE_HINTS: Record<string, RegExp> = {
  blueberry_season:
    /\b(blueberr|berry|u-?pick|farm|orchard|agrit|produce|garden)\b/i,
  peach_season: /\b(peach|orchard|farm|stand|fruit)\b/i,
  strawberry_season: /\b(strawberr|berry|u-?pick|farm|orchard)\b/i,
  firefly_season: /\b(park|meadow|nature|trail|preserve|garden|arboretum)\b/i,
  wildflower_bloom: /\b(park|trail|meadow|preserve|botanical|garden|bloom)\b/i,
  cherry_blossoms: /\b(park|garden|botanical|blossom|arboretum|grove)\b/i,
  lavender_bloom: /\b(lavender|farm|garden|botanical)\b/i,
  pumpkin_patches: /\b(pumpkin|farm|patch|orchard|fall|harvest)\b/i,
  apple_picking: /\b(apple|orchard|cider|farm|u-?pick)\b/i,
  meteor_showers: /\b(park|observatory|dark|trail|lake|preserve)\b/i,
  butterfly_season: /\b(botanical|garden|butterfly|nature|preserve|park)\b/i,
  sunflower_bloom: /\b(sunflower|farm|field|garden)\b/i,
  holiday_market: /\b(market|holiday|christmas|winter|craft|fair)\b/i,
  christmas_lights: /\b(park|downtown|square|district|zoo|garden|lights)\b/i,
  farmers_markets_reopen: /\b(market|farm|produce|square|downtown)\b/i,
  harvest_peak: /\b(market|farm|produce|harvest|orchard)\b/i,
  citrus_season: /\b(citrus|farm|grove|orchard|market)\b/i,
  tomato_season: /\b(farm|market|produce|garden|tomato)\b/i,
  apple_cider_donuts: /\b(cider|farm|orchard|mill|bakery|donut)\b/i,
  fall_foliage: /\b(park|trail|scenic|drive|overlook|forest)\b/i,
  cider_season: /\b(cider|mill|orchard|farm)\b/i,
  early_lights: /\b(downtown|square|park|district|lights)\b/i,
};

const MOMENT_EVENT_HINTS: Record<string, RegExp> = {
  blueberry_season: /\b(blueberr|berry|farm|u-?pick|harvest)\b/i,
  peach_season: /\b(peach|orchard|farm|festival|harvest)\b/i,
  pumpkin_patches: /\b(pumpkin|fall|harvest|festival|fair)\b/i,
  apple_picking: /\b(apple|harvest|festival|orchard)\b/i,
  holiday_market: /\b(holiday|christmas|winter|market|fair)\b/i,
  farmers_markets_reopen: /\b(farmers? market|market|produce)\b/i,
  wildflower_bloom: /\b(wildflower|bloom|garden|festival)\b/i,
  firefly_season: /\b(firefly|evening|nature|park)\b/i,
};

function areaLabel(ctx: DiscoveryRankingContext): string {
  const city = ctx.city?.trim();
  if (city && city.toLowerCase() !== "your area") return city;
  const region = ctx.region?.trim();
  if (region) return region;
  return "the area";
}

function placeHay(place: LocalPlace): string {
  return [
    place.name,
    place.note,
    place.category,
    ...(place.providerCategories ?? []),
    place.address,
    place.city,
  ]
    .filter(Boolean)
    .join(" ");
}

function scorePlace(momentId: string, place: LocalPlace, ctx: DiscoveryRankingContext): number {
  const hint = MOMENT_PLACE_HINTS[momentId];
  if (!hint) return 0;
  const hay = placeHay(place);
  if (!hint.test(hay)) return 0;
  let score = 40;
  const city = ctx.city?.trim().toLowerCase();
  const placeCity = place.city?.trim().toLowerCase();
  if (city && placeCity && city === placeCity) score += 20;
  if (place.note?.trim()) score += 8;
  if (/\b(chain|starbucks|mcdonald|walmart)\b/i.test(place.name)) score -= 30;
  return score;
}

function scoreEvent(momentId: string, event: LocalEvent): number {
  const hint = MOMENT_EVENT_HINTS[momentId];
  if (!hint) return 0;
  const hay = `${event.name} ${event.venue} ${event.banditNote ?? ""}`;
  return hint.test(hay) ? 35 : 0;
}

function editorialDescription(
  name: string,
  note: string | null | undefined,
  momentId: string,
  area: string
): string {
  const trimmed = note?.trim();
  if (trimmed && trimmed.length >= 24 && trimmed.length <= 160) {
    const sentence = trimmed.split(/(?<=[.!?])\s+/)[0]?.trim();
    if (sentence && sentence.length >= 20) return sentence.endsWith(".") ? sentence : `${sentence}.`;
  }

  const templates: Record<string, string[]> = {
    blueberry_season: [
      `A trusted u-pick near ${area} where the rows fill early and the morning air stays cool.`,
      `Worth the short drive from ${area} when you want berries still warm from the bush.`,
    ],
    peach_season: [
      `An orchard stand near ${area} that sells fruit ripe enough to eat on the way home.`,
      `One of the better peach stops around ${area} when the bins actually smell like summer.`,
    ],
    default: [
      `A local stop near ${area} that fits this week better than it will next month.`,
      `Worth knowing about around ${area} while the season is at its peak.`,
    ],
  };

  const options = templates[momentId] ?? templates.default;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return options[Math.abs(hash) % options.length];
}

export function pickNearbyEditorial(
  momentId: string,
  ctx: DiscoveryRankingContext,
  localEvents?: LocalEvent[]
): NearbyEditorialPick[] {
  const glyph = MOMENT_GLYPH[momentId] ?? "📍";
  const area = areaLabel(ctx);
  const places = ctx.localPlaces ?? [];
  const rankedPlaces = places
    .map((place) => ({ place, score: scorePlace(momentId, place, ctx) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const rankedEvents = (localEvents ?? [])
    .map((event) => ({ event, score: scoreEvent(momentId, event) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const out: NearbyEditorialPick[] = [];
  const seen = new Set<string>();

  for (const { place } of rankedPlaces) {
    if (out.length >= 3) break;
    const key = place.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: place.name.trim(),
      glyph,
      description: editorialDescription(place.name, place.note, momentId, area),
    });
  }

  for (const { event } of rankedEvents) {
    if (out.length >= 3) break;
    const key = event.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: event.name.trim(),
      glyph,
      description: event.banditNote?.trim() ||
        `Happening near ${area} this week — the sort of local gathering that disappears when the season turns.`,
    });
  }

  return out.slice(0, 3);
}

function joinNames(names: string[]): string | null {
  const list = names.filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

/**
 * @deprecated Seasonal picks must use composeEvidenceBackedSeasonalEditorial.
 * Generic city-name localization is no longer permitted.
 */
export function localizeSeasonalEditorial(
  momentId: string,
  base: BanditSeasonalEditorial,
  ctx: DiscoveryRankingContext,
  localEvents?: LocalEvent[]
): BanditSeasonalEditorial & { nearby: NearbyEditorialPick[] } {
  const area = areaLabel(ctx);
  const nearby = pickNearbyEditorial(momentId, ctx, localEvents);
  const placeNames = nearby.map((n) => n.name);
  const namePhrase = joinNames(placeNames);

  const localizedBody = base.body.map((paragraph, index) => {
    let p = paragraph;

    if (index === 0) {
      p = p.replace(/\bMany local farms\b/i, `Around ${area}, farms`);
      p = p.replace(/\bmany local farms\b/i, `farms around ${area}`);
      if (namePhrase && !p.includes(namePhrase)) {
        p = `Around ${area}, ${namePhrase} ${placeNames.length === 1 ? "is" : "are"} among the stops locals watch when this season turns serious. ${p}`;
      } else if (!p.toLowerCase().includes(area.toLowerCase())) {
        p = `Around ${area}, ${p.charAt(0).toLowerCase()}${p.slice(1)}`;
      }
    }

    if (index === 1 && nearby.length) {
      const market = (localEvents ?? []).find((e) =>
        /\b(market|festival|fair)\b/i.test(`${e.name} ${e.venue}`)
      );
      if (market && !p.includes(market.name)) {
        p = `${p} This week, ${market.name}${market.venue ? ` at ${market.venue}` : ""} is also on the local calendar.`;
      }
    }

    if (index === 2 && placeNames.length) {
      p = p.replace(
        /\bIf you've never\b/i,
        `If you've never gone with ${placeNames[0]} on the short list,`
      );
    }

    return p;
  });

  const localizedExcerpt = base.cardExcerpt.includes(area)
    ? base.cardExcerpt
    : `Around ${area}, ${base.cardExcerpt.charAt(0).toLowerCase()}${base.cardExcerpt.slice(1)}`;

  return {
    ...base,
    cardExcerpt: localizedExcerpt,
    body: localizedBody,
    actionLabel: "Explore Nearby",
    mapsQuery: namePhrase
      ? `${base.mapsQuery} near ${area}`
      : `${base.mapsQuery} near ${area}`,
    nearby,
  };
}

export function localizeEventEditorial(
  base: BanditSeasonalEditorial,
  ctx: DiscoveryRankingContext,
  event: LocalEvent
): BanditSeasonalEditorial & { nearby: NearbyEditorialPick[] } {
  const area = areaLabel(ctx);
  const venue = event.venue?.trim();
  const nearby: NearbyEditorialPick[] = venue
    ? [
        {
          name: event.name.trim(),
          glyph: "📍",
          description:
            event.banditNote?.trim() ||
            `The main event near ${area} this week — worth confirming the hours before you head out.`,
        },
      ]
    : [];

  const extra = pickNearbyEditorial("harvest_peak", ctx, [event]).filter(
    (n) => n.name.toLowerCase() !== event.name.trim().toLowerCase()
  );
  for (const pick of extra) {
    if (nearby.length >= 3) break;
    nearby.push(pick);
  }

  return {
    ...base,
    cardExcerpt: venue
      ? `Near ${area}, ${event.name.trim()} at ${venue} is on the calendar for a limited run.`
      : `Near ${area}, ${event.name.trim()} is happening now — a short-lived local moment worth putting on this week's list.`,
    body: base.body.map((p, i) => {
      if (i === 0) return p.replace(/\bThis week's\b/i, `Near ${area}, this week's`);
      if (i === 1 && venue) return p.replace(/\bThe setting matters\b/i, `At ${venue}`);
      return p;
    }),
    actionLabel: "Explore Nearby",
    mapsQuery: venue ? `${event.name} ${venue} ${area}` : `${event.name} ${area}`,
    nearby: nearby.slice(0, 3),
  };
}
