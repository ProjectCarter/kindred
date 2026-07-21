import {
  homepageConditionFromCode,
  homepageConditionFromPhrase,
  type HomepageWeatherCondition,
} from "./conditionDisplay.ts";
import {
  extractWeatherSummaryFromEditorialContext,
  parseHeroWeatherTag,
  parseWeatherSummaryText,
  type ParsedWeatherSummary,
} from "./parseWeatherSummary.ts";
import {
  EDITION_WEATHER_MAX_AGE_MS,
  isWeatherStale,
} from "./weatherFreshness.ts";

export type HomepageWeatherDisplay = {
  current: string;
  highLow: string | null;
  condition: HomepageWeatherCondition;
  /** One verified planning sentence tied to today's edition desks. */
  planningNote?: string | null;
};

export type ResolveHomepageWeatherInput = {
  editorialContext?: unknown;
  weatherSectionHeadline?: string | null;
  weatherSectionBody?: string | null;
  morningWeatherBeat?: string | null;
  weatherConditionCode?: number | null;
  /** Fresh live observation — takes priority over edition snapshot. */
  liveWeatherSummary?: string | null;
  liveWeatherRetrievedAt?: string | null;
  /** When the edition snapshot was captured — used to reject stale embedded weather. */
  editionWeatherRetrievedAt?: string | null;
};

function mergeParsed(
  primary: ParsedWeatherSummary | null,
  fallback: ParsedWeatherSummary | null
): ParsedWeatherSummary | null {
  if (!primary && !fallback) return null;
  return {
    currentLabel: primary?.currentLabel ?? fallback?.currentLabel ?? null,
    highLabel: primary?.highLabel ?? fallback?.highLabel ?? null,
    lowLabel: primary?.lowLabel ?? fallback?.lowLabel ?? null,
    conditionPhrase:
      primary?.conditionPhrase ?? fallback?.conditionPhrase ?? null,
  };
}

function selectedWeatherSource(input: ResolveHomepageWeatherInput): {
  selectedSource: string;
  summary: string | null;
  retrievedAt: string | null;
} {
  const live = input.liveWeatherSummary?.trim();
  if (live) {
    return {
      selectedSource: "live_weather",
      summary: live,
      retrievedAt: input.liveWeatherRetrievedAt ?? null,
    };
  }

  const fromEditorial = extractWeatherSummaryFromEditorialContext(
    input.editorialContext
  );
  if (fromEditorial) {
    const retrievedAt = input.editionWeatherRetrievedAt ?? null;
    if (
      retrievedAt &&
      isWeatherStale(retrievedAt, EDITION_WEATHER_MAX_AGE_MS)
    ) {
      return { selectedSource: "editorial_context.weatherSummary_stale", summary: null, retrievedAt };
    }
    return {
      selectedSource: "editorial_context.weatherSummary",
      summary: fromEditorial,
      retrievedAt,
    };
  }
  if (input.weatherSectionBody?.trim()) {
    const retrievedAt = input.editionWeatherRetrievedAt ?? null;
    if (retrievedAt && isWeatherStale(retrievedAt, EDITION_WEATHER_MAX_AGE_MS)) {
      return { selectedSource: "weather_section.body_stale", summary: null, retrievedAt };
    }
    return {
      selectedSource: "weather_section.body",
      summary: input.weatherSectionBody.trim(),
      retrievedAt,
    };
  }
  if (input.weatherSectionHeadline?.trim()) {
    return {
      selectedSource: "weather_section.headline",
      summary: input.weatherSectionHeadline.trim(),
      retrievedAt: input.editionWeatherRetrievedAt ?? null,
    };
  }
  if (input.morningWeatherBeat?.trim()) {
    return {
      selectedSource: "morning_edition.beats.weather",
      summary: input.morningWeatherBeat.trim(),
      retrievedAt: input.editionWeatherRetrievedAt ?? null,
    };
  }
  return { selectedSource: "none", summary: null, retrievedAt: null };
}

function rejectionReason(input: {
  summary: string | null;
  parsed: ParsedWeatherSummary | null;
  current: string | null;
  condition: HomepageWeatherCondition | null;
}): string {
  if (!input.summary) return "no_weather_source";
  if (!input.parsed) return "parse_failed";
  if (!input.current) return "missing_current_temperature";
  if (!input.condition) return "missing_condition";
  return "none";
}

export function resolveHomepageWeatherDisplay(
  input: ResolveHomepageWeatherInput
): HomepageWeatherDisplay | null {
  const { selectedSource, summary, retrievedAt } = selectedWeatherSource(input);

  const fromSummary = parseWeatherSummaryText(summary);
  const fromBeat =
    selectedSource === "morning_edition.beats.weather"
      ? parseWeatherSummaryText(input.morningWeatherBeat)
      : null;
  const parsed = mergeParsed(fromSummary, fromBeat);
  const heroTag =
    selectedSource === "weather_section.headline" ||
    selectedSource === "weather_section.body"
      ? parseHeroWeatherTag(
          input.weatherSectionHeadline ?? input.weatherSectionBody
        )
      : null;
  const current = parsed?.currentLabel ?? null;

  const condition =
    homepageConditionFromPhrase(parsed?.conditionPhrase) ??
    homepageConditionFromCode(input.weatherConditionCode ?? null) ??
    (heroTag?.conditionPhrase
      ? homepageConditionFromPhrase(heroTag.conditionPhrase)
      : null);

  const reason = rejectionReason({ summary, parsed, current, condition });

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[home:weather:debug]", {
      raw: {
        editorialContext: input.editorialContext ?? null,
        weatherSectionHeadline: input.weatherSectionHeadline ?? null,
        weatherSectionBody: input.weatherSectionBody ?? null,
        morningWeatherBeat: input.morningWeatherBeat ?? null,
        weatherConditionCode: input.weatherConditionCode ?? null,
        liveWeatherSummary: input.liveWeatherSummary ?? null,
        liveWeatherRetrievedAt: input.liveWeatherRetrievedAt ?? null,
        editionWeatherRetrievedAt: input.editionWeatherRetrievedAt ?? null,
      },
      selectedSource,
      summary,
      retrievedAt,
      parserResult: parsed,
      resolved: {
        current,
        high: parsed?.highLabel ?? null,
        low: parsed?.lowLabel ?? null,
        conditionPhrase: parsed?.conditionPhrase ?? null,
        condition,
      },
      finalDisplayModel:
        current && condition
          ? {
              current,
              highLow:
                parsed?.highLabel && parsed?.lowLabel
                  ? `High ${parsed.highLabel} · Low ${parsed.lowLabel}`
                  : null,
              condition,
            }
          : null,
      rejectionReason: reason === "none" ? null : reason,
    });
  }

  if (!current) return null;
  if (!condition) return null;

  const highLow =
    parsed?.highLabel && parsed?.lowLabel
      ? `High ${parsed.highLabel} · Low ${parsed.lowLabel}`
      : null;

  return {
    current,
    highLow,
    condition,
  };
}
