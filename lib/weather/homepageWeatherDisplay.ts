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

export type HomepageWeatherDisplay = {
  current: string;
  highLow: string | null;
  condition: HomepageWeatherCondition;
};

export type ResolveHomepageWeatherInput = {
  editorialContext?: unknown;
  weatherSectionHeadline?: string | null;
  weatherSectionBody?: string | null;
  morningWeatherBeat?: string | null;
  weatherConditionCode?: number | null;
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
} {
  const fromEditorial = extractWeatherSummaryFromEditorialContext(
    input.editorialContext
  );
  if (fromEditorial) {
    return { selectedSource: "editorial_context.weatherSummary", summary: fromEditorial };
  }
  if (input.weatherSectionBody?.trim()) {
    return {
      selectedSource: "weather_section.body",
      summary: input.weatherSectionBody.trim(),
    };
  }
  if (input.weatherSectionHeadline?.trim()) {
    return {
      selectedSource: "weather_section.headline",
      summary: input.weatherSectionHeadline.trim(),
    };
  }
  if (input.morningWeatherBeat?.trim()) {
    return {
      selectedSource: "morning_edition.beats.weather",
      summary: input.morningWeatherBeat.trim(),
    };
  }
  return { selectedSource: "none", summary: null };
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
  const { selectedSource, summary } = selectedWeatherSource(input);

  const fromSummary = parseWeatherSummaryText(summary);
  const fromBeat = parseWeatherSummaryText(input.morningWeatherBeat);
  const fromTag = parseHeroWeatherTag(
    input.weatherSectionHeadline ?? input.weatherSectionBody
  );

  const parsed = mergeParsed(fromSummary, mergeParsed(fromBeat, fromTag));
  const current = parsed?.currentLabel ?? parsed?.highLabel ?? null;

  const condition =
    homepageConditionFromPhrase(parsed?.conditionPhrase) ??
    homepageConditionFromCode(input.weatherConditionCode ?? null);

  const reason = rejectionReason({ summary, parsed, current, condition });

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[home:weather:debug]", {
      raw: {
        editorialContext: input.editorialContext ?? null,
        weatherSectionHeadline: input.weatherSectionHeadline ?? null,
        weatherSectionBody: input.weatherSectionBody ?? null,
        morningWeatherBeat: input.morningWeatherBeat ?? null,
        weatherConditionCode: input.weatherConditionCode ?? null,
      },
      selectedSource,
      summary,
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
