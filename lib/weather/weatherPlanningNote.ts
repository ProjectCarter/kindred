/**
 * Weather planning note — one verified sentence beneath the homepage weather block.
 * Grounded in parsed forecast data and desks that exist in today's edition only.
 */

import type { HomepageWeatherCondition } from "./conditionDisplay.ts";
import {
  parseWeatherSummaryText,
  type ParsedWeatherSummary,
} from "./parseWeatherSummary.ts";
import {
  analyzeEditionDeskAvailability,
  type EditionDeskAvailability,
} from "./editionDeskAvailability.ts";

export type WeatherPlanningSignals = {
  highF: number | null;
  currentF: number | null;
  conditionPhrase: string | null;
  isRainy: boolean;
  isStormy: boolean;
  isHot: boolean;
  isClear: boolean;
  isCoolMorning: boolean;
  rainPossibleAfternoon: boolean;
};

export type ResolveWeatherPlanningNoteInput = {
  weatherSummary?: string | null;
  weatherSectionHeadline?: string | null;
  weatherSectionBody?: string | null;
  morningWeatherBeat?: string | null;
  condition?: HomepageWeatherCondition | null;
  editionDesks: EditionDeskAvailability;
};

function parseTempF(label: string | null | undefined): number | null {
  if (!label?.trim()) return null;
  const match = /^(\d+)°/.exec(label.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function selectedWeatherSummary(input: ResolveWeatherPlanningNoteInput): string | null {
  return (
    input.weatherSummary?.trim() ||
    input.weatherSectionBody?.trim() ||
    input.weatherSectionHeadline?.trim() ||
    input.morningWeatherBeat?.trim() ||
    null
  );
}

function deriveWeatherSignals(
  parsed: ParsedWeatherSummary | null,
  condition: HomepageWeatherCondition | null | undefined,
  rawSummary: string | null
): WeatherPlanningSignals {
  const highF = parseTempF(parsed?.highLabel ?? null);
  const currentF = parseTempF(parsed?.currentLabel ?? null);
  const hay = [
    parsed?.conditionPhrase,
    condition?.label,
    rawSummary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isRainy = /rain|shower|drizzle|storm|thunder/i.test(hay);
  const isStormy = /thunder|storm/i.test(hay);
  const rainPossibleAfternoon =
    /afternoon.*(rain|storm)|storms possible|storm possible/i.test(hay);
  const isClear =
    /clear|sunshine|sunny|mostly sunny|mostly clear/i.test(hay) && !isRainy;
  const isHot = highF != null && highF >= 95;
  const isCoolMorning =
    currentF != null &&
    highF != null &&
    currentF <= 65 &&
    highF - currentF >= 15 &&
    !isRainy;

  return {
    highF,
    currentF,
    conditionPhrase:
      parsed?.conditionPhrase?.trim() ||
      condition?.label?.trim() ||
      null,
    isRainy,
    isStormy,
    isHot,
    isClear,
    isCoolMorning,
    rainPossibleAfternoon,
  };
}

function formatDeskList(items: readonly string[]): string {
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function buildWeatherLead(signals: WeatherPlanningSignals): string | null {
  if (signals.isCoolMorning && signals.currentF != null) {
    return `Cool morning temperatures around ${signals.currentF}°`;
  }

  const parts: string[] = [];
  if (signals.highF != null) {
    parts.push(`High of ${signals.highF}° today`);
  }

  if (signals.rainPossibleAfternoon && !signals.isRainy) {
    parts.push("with afternoon storms possible");
  } else if (signals.isRainy || signals.isStormy) {
    parts.push("with rain in the forecast");
  } else if (signals.conditionPhrase) {
    parts.push(`with ${signals.conditionPhrase.toLowerCase()}`);
  }

  if (!parts.length && signals.conditionPhrase) {
    return `${
      signals.conditionPhrase.charAt(0).toUpperCase() +
      signals.conditionPhrase.slice(1)
    } today`;
  }

  return parts.length ? parts.join(" ") : null;
}

function pickEditionSuggestions(
  signals: WeatherPlanningSignals,
  desks: EditionDeskAvailability
): string[] {
  const picks: string[] = [];
  const push = (label: string) => {
    if (!picks.includes(label)) picks.push(label);
  };

  if (signals.isCoolMorning && desks.hiking) {
    return ["hiking before noon"];
  }

  if (signals.isRainy || signals.isStormy || signals.rainPossibleAfternoon) {
    if (desks.museums) push("museums");
    if (desks.coffeeShops) push("coffee shops");
    if (desks.indoorActivities) push("indoor activities");
    if (desks.localEvents) push("Local Events");
    return picks.slice(0, 3);
  }

  if (signals.isHot) {
    if (desks.coffeeShops) push("coffee shops");
    if (desks.indoorActivities) push("indoor activities");
    if (desks.museums) push("museums");
    if (desks.foodDrinks && picks.length < 3) push("Food & Drinks picks");
    return picks.slice(0, 3);
  }

  if (signals.isClear && !signals.isHot) {
    if (desks.parks) push("parks");
    if (desks.hiking) push("hiking");
    if (desks.localEvents) push("outdoor events");
    if (desks.outdoorActivities) push("outdoor activities");
    return picks.slice(0, 3);
  }

  if (desks.localEvents) push("Local Events");
  if (desks.outdoorActivities) push("Activities");
  if (desks.foodDrinks) push("Food & Drinks");
  return picks.slice(0, 3);
}

export function composeWeatherPlanningNote(input: {
  parsed: ParsedWeatherSummary | null;
  condition?: HomepageWeatherCondition | null;
  rawSummary: string | null;
  editionDesks: EditionDeskAvailability;
}): string | null {
  const signals = deriveWeatherSignals(
    input.parsed,
    input.condition ?? null,
    input.rawSummary
  );
  const lead = buildWeatherLead(signals);
  if (!lead) return null;

  const suggestions = pickEditionSuggestions(signals, input.editionDesks);
  if (!suggestions.length) {
    return lead.endsWith(".") ? lead : `${lead}.`;
  }

  const list = formatDeskList(suggestions);

  if (signals.isCoolMorning && input.editionDesks.hiking) {
    return `${lead} make this a great day for ${list} — see today's Activities desk.`;
  }

  if (signals.isRainy || signals.isStormy || signals.rainPossibleAfternoon) {
    return `${lead} — a great day for ${list} in today's edition.`;
  }

  if (signals.isHot) {
    return `${lead} — ${list} in today's edition suit the afternoon heat.`;
  }

  if (signals.isClear && !signals.isHot) {
    return `${lead} — clear skies make today ideal for ${list} in today's edition.`;
  }

  return `${lead} — ${list} in today's edition are worth a look today.`;
}

export function resolveWeatherPlanningNote(
  input: ResolveWeatherPlanningNoteInput
): string | null {
  const rawSummary = selectedWeatherSummary(input);
  const parsed = parseWeatherSummaryText(rawSummary);
  if (!parsed && !input.condition) return null;

  return composeWeatherPlanningNote({
    parsed,
    condition: input.condition ?? null,
    rawSummary,
    editionDesks: input.editionDesks,
  });
}

export { analyzeEditionDeskAvailability };
