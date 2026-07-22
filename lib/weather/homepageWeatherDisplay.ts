import {
  homepageConditionFromCode,
  type HomepageWeatherCondition,
} from "./conditionDisplay.ts";
import {
  extractWeatherSnapshotFromEditorialContext,
  primaryWeatherAlertDisplay,
  snapshotConditionDisplay,
  type KindredWeatherSnapshot,
} from "./weatherSnapshot.ts";
import {
  isLiveWeatherFresh,
  liveWeatherConditionDisplay,
  liveWeatherToSnapshot,
  type LiveWeatherDisplaySource,
  type LiveWeatherResponse,
} from "./liveWeatherTypes.ts";
import { logWeatherConditionDiagnostics } from "./canonicalCondition.ts";
import type { WeatherAlertDisplay } from "./weatherEmojiGuide.ts";

export type WeatherFallbackReason =
  | "live_fresh"
  | "live_client_cache"
  | "live_server_cache"
  | "edition_snapshot_fresh"
  | "edition_snapshot_stale"
  | "no_weather_data";

export type HomepageWeatherDisplay = {
  current: string;
  highLow: string | null;
  condition: HomepageWeatherCondition;
  /** Compact NWS-style alert beneath the summary when active. */
  alert?: WeatherAlertDisplay | null;
  /** Forecast-based guidance — omitted when data is insufficient. */
  planningNote?: string | null;
  /** Internal — which layer supplied the display values. */
  dataSource?: LiveWeatherDisplaySource;
  /** Internal — edition fallback is not live observation. */
  isEditionFallback?: boolean;
  /** Internal — minimal placeholder when no data exists anywhere. */
  isUnavailable?: boolean;
  /** Internal — why this layer was chosen (dev diagnostics). */
  fallbackReason?: WeatherFallbackReason;
};

export type ResolveHomepageWeatherInput = {
  editorialContext?: unknown;
  weatherSectionHeadline?: string | null;
  weatherSectionBody?: string | null;
  morningWeatherBeat?: string | null;
  weatherSnapshot?: KindredWeatherSnapshot | null;
  /** Fresh live weather — always preferred over edition snapshot. */
  liveWeather?: LiveWeatherResponse | null;
  liveWeatherSource?: LiveWeatherDisplaySource | null;
};

/** Shown only when absolutely no weather data exists — never remove the block. */
export function createUnavailableWeatherDisplay(): HomepageWeatherDisplay {
  return {
    current: "",
    highLow: null,
    condition: {
      key: "partly_cloudy",
      emoji: "🌡️",
      label: "Weather unavailable",
    },
    alert: null,
    planningNote: null,
    isUnavailable: true,
    fallbackReason: "no_weather_data",
  };
}

function formatTempFromSnapshot(snapshot: KindredWeatherSnapshot): string {
  const c = snapshot.currentTempC;
  const value =
    snapshot.unit === "fahrenheit"
      ? Math.round((c * 9) / 5 + 32)
      : Math.round(c);
  return `${value}°`;
}

function formatHighLowFromSnapshot(
  snapshot: KindredWeatherSnapshot
): string | null {
  const toDisplay = (c: number) =>
    snapshot.unit === "fahrenheit"
      ? Math.round((c * 9) / 5 + 32)
      : Math.round(c);

  const high = snapshot.highTempC != null ? toDisplay(snapshot.highTempC) : null;
  const low = snapshot.lowTempC != null ? toDisplay(snapshot.lowTempC) : null;
  if (high != null && low != null) return `High ${high}° · Low ${low}°`;
  if (high != null) return `High ${high}°`;
  if (low != null) return `Low ${low}°`;
  return null;
}

function resolveEditionSnapshot(
  input: ResolveHomepageWeatherInput
): KindredWeatherSnapshot | null {
  return (
    input.weatherSnapshot ??
    extractWeatherSnapshotFromEditorialContext(input.editorialContext)
  );
}

function isStructurallyValidSnapshot(
  snapshot: KindredWeatherSnapshot
): boolean {
  return (
    Number.isFinite(snapshot.currentTempC) &&
    Number.isFinite(snapshot.conditionCode)
  );
}

function isEditionSnapshotFresh(snapshot: KindredWeatherSnapshot): boolean {
  const ts = Date.parse(snapshot.retrievedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= 90 * 60 * 1000;
}

function isStructurallyValidLive(live: LiveWeatherResponse): boolean {
  return (
    Number.isFinite(live.currentTempC) && Number.isFinite(live.conditionCode)
  );
}

function defaultConditionFallback(): HomepageWeatherCondition {
  return { key: "partly_cloudy", emoji: "🌤️", label: "Partly Cloudy" };
}

function snapshotToDisplay(
  snapshot: KindredWeatherSnapshot,
  input: {
    dataSource: LiveWeatherDisplaySource;
    isEditionFallback: boolean;
    fallbackReason: WeatherFallbackReason;
    liveWeather?: LiveWeatherResponse | null;
  }
): HomepageWeatherDisplay | null {
  const current = formatTempFromSnapshot(snapshot);
  if (!current) return null;

  const condition =
    (!input.isEditionFallback && input.liveWeather
      ? liveWeatherConditionDisplay(input.liveWeather)
      : null) ??
    snapshotConditionDisplay(snapshot) ??
    homepageConditionFromCode(snapshot.conditionCode, snapshot.windSpeedMs) ??
    defaultConditionFallback();

  if (!input.isEditionFallback && input.liveWeather) {
    logWeatherConditionDiagnostics({
      provider: input.liveWeather.provider,
      providerConditionId: input.liveWeather.providerConditionId ?? null,
      providerMain: input.liveWeather.providerMain ?? null,
      providerDescription: input.liveWeather.providerDescription ?? null,
      cloudPercentage: input.liveWeather.cloudPercentage ?? null,
      rawInternalCode:
        input.liveWeather.rawInternalCode ?? input.liveWeather.conditionCode,
      canonicalCondition: input.liveWeather.canonicalCondition ?? null,
      emoji: condition.emoji,
      isDaytime: input.liveWeather.isDaytime ?? true,
      mappingSource: input.liveWeather.mappingSource ?? null,
    });
  }

  return {
    current,
    highLow: formatHighLowFromSnapshot(snapshot),
    condition,
    alert: primaryWeatherAlertDisplay(snapshot),
    dataSource: input.dataSource,
    isEditionFallback: input.isEditionFallback,
    fallbackReason: input.fallbackReason,
  };
}

function resolveActiveSnapshot(input: ResolveHomepageWeatherInput): {
  snapshot: KindredWeatherSnapshot | null;
  liveWeather: LiveWeatherResponse | null;
  dataSource: LiveWeatherDisplaySource | null;
  isEditionFallback: boolean;
  fallbackReason: WeatherFallbackReason | null;
} {
  const live = input.liveWeather ?? null;
  const editionSnapshot = resolveEditionSnapshot(input);
  const editionValid =
    editionSnapshot != null && isStructurallyValidSnapshot(editionSnapshot);

  if (live && isStructurallyValidLive(live) && isLiveWeatherFresh(live)) {
    const source =
      input.liveWeatherSource === "client-cache"
        ? "client-cache"
        : input.liveWeatherSource === "server-cache"
          ? "server-cache"
          : "live";
    return {
      snapshot: liveWeatherToSnapshot(live),
      liveWeather: live,
      dataSource: source,
      isEditionFallback: false,
      fallbackReason:
        source === "client-cache"
          ? "live_client_cache"
          : source === "server-cache"
            ? "live_server_cache"
            : "live_fresh",
    };
  }

  if (editionValid) {
    const fresh = isEditionSnapshotFresh(editionSnapshot);
    return {
      snapshot: editionSnapshot,
      liveWeather: null,
      dataSource: "edition-fallback",
      isEditionFallback: true,
      fallbackReason: fresh
        ? "edition_snapshot_fresh"
        : "edition_snapshot_stale",
    };
  }

  if (live && isStructurallyValidLive(live)) {
    const source =
      input.liveWeatherSource === "client-cache"
        ? "client-cache"
        : input.liveWeatherSource === "server-cache"
          ? "server-cache"
          : "live";
    return {
      snapshot: liveWeatherToSnapshot(live),
      liveWeather: live,
      dataSource: source,
      isEditionFallback: false,
      fallbackReason:
        source === "client-cache"
          ? "live_client_cache"
          : source === "server-cache"
            ? "live_server_cache"
            : "live_fresh",
    };
  }

  return {
    snapshot: null,
    liveWeather: null,
    dataSource: null,
    isEditionFallback: false,
    fallbackReason: null,
  };
}

export function resolveHomepageWeatherDisplay(
  input: ResolveHomepageWeatherInput
): HomepageWeatherDisplay {
  const { snapshot, liveWeather, dataSource, isEditionFallback, fallbackReason } =
    resolveActiveSnapshot(input);

  if (!snapshot) {
    return createUnavailableWeatherDisplay();
  }

  const display = snapshotToDisplay(snapshot, {
    dataSource: dataSource ?? "edition-fallback",
    isEditionFallback,
    fallbackReason: fallbackReason ?? "edition_snapshot_stale",
    liveWeather,
  });

  if (display) {
    return display;
  }

  const editionSnapshot = resolveEditionSnapshot(input);
  if (editionSnapshot && isStructurallyValidSnapshot(editionSnapshot)) {
    const editionDisplay = snapshotToDisplay(editionSnapshot, {
      dataSource: "edition-fallback",
      isEditionFallback: true,
      fallbackReason: isEditionSnapshotFresh(editionSnapshot)
        ? "edition_snapshot_fresh"
        : "edition_snapshot_stale",
      liveWeather: null,
    });
    if (editionDisplay) {
      return editionDisplay;
    }
  }

  return createUnavailableWeatherDisplay();
}

export function isHomepageWeatherVisible(
  display: HomepageWeatherDisplay | null | undefined
): boolean {
  return Boolean(display && !display.isUnavailable);
}
