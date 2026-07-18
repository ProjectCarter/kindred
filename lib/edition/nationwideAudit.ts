/**
 * Nationwide editorial audit — national parity, local isolation, bleed detection.
 * Used by scripts/nationwide-editorial-audit.ts and unit tests.
 */

export type AuditCitySpec = {
  label: string;
  city: string;
  state: string;
  region: string;
  lat: number;
  lon: number;
  expectedMetroKey: string;
  /** City/region tokens that must not appear in this edition's local desks. */
  forbiddenBleed: string[];
};

export const NATIONWIDE_AUDIT_CITIES: AuditCitySpec[] = [
  {
    label: "Seattle",
    city: "Seattle",
    state: "WA",
    region: "Washington",
    lat: 47.6062,
    lon: -122.3321,
    expectedMetroKey: "seattle-wa",
    forbiddenBleed: ["Gilbert", "Chandler", "Mesa", "Scottsdale", "Phoenix, AZ", "San Diego"],
  },
  {
    label: "San Diego",
    city: "San Diego",
    state: "CA",
    region: "California",
    lat: 32.7157,
    lon: -117.1611,
    expectedMetroKey: "san-diego-ca",
    forbiddenBleed: ["Gilbert", "Seattle", "Space Needle", "Chicago, IL"],
  },
  {
    label: "Phoenix",
    city: "Phoenix",
    state: "AZ",
    region: "Arizona",
    lat: 33.4484,
    lon: -112.074,
    expectedMetroKey: "phoenix-az",
    forbiddenBleed: ["Seattle", "Space Needle", "San Diego", "Chicago, IL", "Miami, FL"],
  },
  {
    label: "Denver",
    city: "Denver",
    state: "CO",
    region: "Colorado",
    lat: 39.7392,
    lon: -104.9903,
    expectedMetroKey: "denver-co",
    forbiddenBleed: ["Gilbert", "Seattle", "Miami Beach", "Boston, MA"],
  },
  {
    label: "Chicago",
    city: "Chicago",
    state: "IL",
    region: "Illinois",
    lat: 41.8781,
    lon: -87.6298,
    expectedMetroKey: "chicago-il",
    forbiddenBleed: ["Gilbert", "Seattle", "Phoenix, AZ", "San Diego"],
  },
  {
    label: "Dallas",
    city: "Dallas",
    state: "TX",
    region: "Texas",
    lat: 32.7767,
    lon: -96.797,
    expectedMetroKey: "dallas-tx",
    forbiddenBleed: ["Seattle", "Boston, MA", "Miami Beach"],
  },
  {
    label: "Miami",
    city: "Miami",
    state: "FL",
    region: "Florida",
    lat: 25.7617,
    lon: -80.1918,
    expectedMetroKey: "miami-fl",
    forbiddenBleed: ["Gilbert", "Seattle", "Denver, CO", "Chicago, IL"],
  },
  {
    label: "New York City",
    city: "New York",
    state: "NY",
    region: "New York",
    lat: 40.7128,
    lon: -74.006,
    expectedMetroKey: "new-york-ny",
    forbiddenBleed: ["Gilbert", "Seattle", "Phoenix, AZ", "San Diego"],
  },
  {
    label: "Boston",
    city: "Boston",
    state: "MA",
    region: "Massachusetts",
    lat: 42.3601,
    lon: -71.0589,
    expectedMetroKey: "boston-ma",
    forbiddenBleed: ["Gilbert", "Seattle", "Miami Beach", "Dallas, TX"],
  },
  {
    label: "Nashville",
    city: "Nashville",
    state: "TN",
    region: "Tennessee",
    lat: 36.1627,
    lon: -86.7816,
    expectedMetroKey: "nashville-tn",
    forbiddenBleed: ["Gilbert", "Seattle", "San Diego", "Boston, MA"],
  },
];

export type EditionSectionRow = {
  section_type: string;
  headline?: string | null;
  body?: string | null;
};

export type NationalFingerprint = {
  usNationalDailyId: string | null;
  masterpieceArtworkId: string | null;
  historyHeadline: string | null;
  nationalNewsPackageId: string | null;
  nationalNewsStoryIds: string[];
};

export type LocalFingerprint = {
  weatherHeadline: string | null;
  weatherBody: string | null;
  storyOfHeadline: string | null;
  eventNames: string[];
  activityNames: string[];
  foodDrinkNames: string[];
  banditPickHeadline: string | null;
  localNewsHeadline: string | null;
  localTopStoryHeadlines: string[];
};

export type CityEditionSnapshot = {
  label: string;
  metroKey: string;
  editionId: string;
  national: NationalFingerprint;
  local: LocalFingerprint;
  localSerialized: string;
};

export type AuditIssue = {
  severity: "critical" | "high" | "medium";
  category: string;
  message: string;
};

export type CityTiming = {
  buildStartMs: number;
  enqueueMs: number;
  workerStartMs: number | null;
  firstPaintMs: number | null;
  readyMs: number | null;
  totalMs: number;
  nationalCacheLikely: boolean | null;
  /** Server pipeline duration when measured locally (audit builds). */
  pipelineMs?: number | null;
};

function parseEvents(body: string | null | undefined): Array<{ name?: string; city?: string }> {
  if (!body) return [];
  try {
    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) return parsed as Array<{ name?: string; city?: string }>;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events)) {
      return (parsed as { events: Array<{ name?: string; city?: string }> }).events;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function discoveryNames(
  discovery: unknown,
  desk: "activities" | "food_drinks"
): string[] {
  if (!discovery || typeof discovery !== "object") return [];
  const surfaces = (discovery as { surfaces?: Record<string, { items?: Array<{ name?: string; title?: string }> }> }).surfaces ?? {};
  const names: string[] = [];
  for (const [key, surface] of Object.entries(surfaces)) {
    if (!surface?.items?.length) continue;
    if (desk === "activities" && !/activities|museums|parks|beaches|hiking|hidden_gems/.test(key)) continue;
    if (desk === "food_drinks" && !/restaurants|coffee|bakeries/.test(key)) continue;
    for (const item of surface.items) {
      const n = item.name?.trim() || item.title?.trim();
      if (n) names.push(n);
    }
  }
  return names.slice(0, 12);
}

function topStoriesFromContext(editorialContext: unknown): Array<{ id?: string; title?: string; role?: string }> {
  if (!editorialContext || typeof editorialContext !== "object") return [];
  const sections = (editorialContext as { sections?: Array<{ sectionType?: string; items?: unknown[] }> }).sections;
  if (!Array.isArray(sections)) return [];
  const top = sections.find((s) => s.sectionType === "top_stories");
  if (!top?.items?.length) return [];
  return top.items as Array<{ id?: string; title?: string; role?: string }>;
}

export function extractNationalFingerprint(edition: {
  us_national_daily_id?: string | null;
  morning_edition?: { morningHero?: { artworkId?: string } } | null;
  national_news?: { packageId?: string; stories?: Array<{ id?: string }> } | null;
}, sections: EditionSectionRow[]): NationalFingerprint {
  const history = sections.find((s) => s.section_type === "today_in_history");
  const nationalNews = edition.national_news;
  const stories = Array.isArray(nationalNews?.stories) ? nationalNews.stories : [];

  return {
    usNationalDailyId: edition.us_national_daily_id?.trim() ?? null,
    masterpieceArtworkId:
      edition.morning_edition?.morningHero?.artworkId?.trim() ?? null,
    historyHeadline: history?.headline?.trim() ?? null,
    nationalNewsPackageId: nationalNews?.packageId?.trim() ?? null,
    nationalNewsStoryIds: stories.map((s) => s.id?.trim()).filter(Boolean) as string[],
  };
}

export function extractLocalFingerprint(
  edition: {
    lead_story?: { headline?: string; role?: string } | null;
    editorial_context?: unknown;
    bandit?: { pick?: { story?: { headline?: string; title?: string } } } | null;
    discovery?: unknown;
  },
  sections: EditionSectionRow[]
): LocalFingerprint {
  const weather = sections.find((s) => s.section_type === "weather");
  const storyOf =
    sections.find((s) => s.section_type === "story_of") ??
    sections.find((s) => s.section_type === "your_city");
  const eventsSection = sections.find((s) => s.section_type === "local_events");
  const events = parseEvents(eventsSection?.body);
  const topStories = topStoriesFromContext(edition.editorial_context);
  const localTop = topStories.filter((s) => /local/i.test(s.role ?? ""));

  const lead = edition.lead_story;
  const localNewsHeadline =
    lead && /local/i.test(lead.role ?? "") ? lead.headline?.trim() ?? null : null;

  return {
    weatherHeadline: weather?.headline?.trim() ?? null,
    weatherBody: weather?.body?.trim()?.slice(0, 200) ?? null,
    storyOfHeadline: storyOf?.headline?.trim() ?? null,
    eventNames: events.map((e) => e.name?.trim()).filter(Boolean) as string[],
    activityNames: discoveryNames(edition.discovery, "activities"),
    foodDrinkNames: discoveryNames(edition.discovery, "food_drinks"),
    banditPickHeadline:
      edition.bandit?.pick?.story?.headline?.trim() ??
      edition.bandit?.pick?.story?.title?.trim() ??
      null,
    localNewsHeadline,
    localTopStoryHeadlines: localTop.map((s) => s.title?.trim()).filter(Boolean) as string[],
  };
}

export function serializeLocalFingerprint(local: LocalFingerprint): string {
  return JSON.stringify(local);
}

export function verifyNationalParity(
  snapshots: CityEditionSnapshot[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (snapshots.length < 2) return issues;

  const ref = snapshots[0].national;
  for (const snap of snapshots.slice(1)) {
    const n = snap.national;
    if (ref.masterpieceArtworkId && n.masterpieceArtworkId !== ref.masterpieceArtworkId) {
      issues.push({
        severity: "critical",
        category: "national_masterpiece_mismatch",
        message: `${snap.label} masterpiece ${n.masterpieceArtworkId} ≠ ${ref.masterpieceArtworkId} (${snapshots[0].label})`,
      });
    }
    if (ref.historyHeadline && n.historyHeadline !== ref.historyHeadline) {
      issues.push({
        severity: "critical",
        category: "national_history_mismatch",
        message: `${snap.label} history headline differs from ${snapshots[0].label}`,
      });
    }
    if (ref.usNationalDailyId && n.usNationalDailyId !== ref.usNationalDailyId) {
      issues.push({
        severity: "critical",
        category: "national_daily_id_mismatch",
        message: `${snap.label} us_national_daily_id ${n.usNationalDailyId} ≠ ${ref.usNationalDailyId}`,
      });
    }
    if (ref.nationalNewsPackageId && n.nationalNewsPackageId !== ref.nationalNewsPackageId) {
      issues.push({
        severity: "critical",
        category: "national_news_mismatch",
        message: `${snap.label} national news package differs from ${snapshots[0].label}`,
      });
    }
    if (
      ref.nationalNewsStoryIds.length &&
      JSON.stringify(n.nationalNewsStoryIds) !== JSON.stringify(ref.nationalNewsStoryIds)
    ) {
      issues.push({
        severity: "critical",
        category: "national_news_order_mismatch",
        message: `${snap.label} national news story IDs/order differ from ${snapshots[0].label}`,
      });
    }
  }
  return issues;
}

export function verifyLocalDistinct(snapshots: CityEditionSnapshot[]): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const seen = new Map<string, string>();

  for (const snap of snapshots) {
    const key = snap.localSerialized;
    const prev = seen.get(key);
    if (prev && prev !== snap.label) {
      issues.push({
        severity: "critical",
        category: "local_desk_duplicate",
        message: `${snap.label} local fingerprint identical to ${prev}`,
      });
    }
    seen.set(key, snap.label);
  }

  for (let i = 0; i < snapshots.length; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      const a = snapshots[i];
      const b = snapshots[j];
      if (a.metroKey === b.metroKey) continue;
      if (
        a.local.weatherBody &&
        b.local.weatherBody &&
        a.local.weatherBody === b.local.weatherBody
      ) {
        issues.push({
          severity: "high",
          category: "weather_not_distinct",
          message: `${a.label} and ${b.label} share identical weather body`,
        });
      }
      if (
        a.local.storyOfHeadline &&
        b.local.storyOfHeadline &&
        a.local.storyOfHeadline === b.local.storyOfHeadline
      ) {
        issues.push({
          severity: "critical",
          category: "story_of_not_distinct",
          message: `${a.label} and ${b.label} share identical Story of headline`,
        });
      }
      if (
        a.local.banditPickHeadline &&
        b.local.banditPickHeadline &&
        a.local.banditPickHeadline === b.local.banditPickHeadline
      ) {
        issues.push({
          severity: "high",
          category: "bandit_pick_not_distinct",
          message: `${a.label} and ${b.label} share identical Bandit's Pick`,
        });
      }
    }
  }
  return issues;
}

export function detectCityBleed(
  spec: AuditCitySpec,
  localText: string
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const token of spec.forbiddenBleed) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(localText)) {
      issues.push({
        severity: "critical",
        category: "cross_city_bleed",
        message: `${spec.label} edition contains foreign market token "${token}"`,
      });
    }
  }
  return issues;
}

export function buildCitySnapshot(
  spec: AuditCitySpec,
  edition: Parameters<typeof extractNationalFingerprint>[0] &
    Parameters<typeof extractLocalFingerprint>[0] & { id: string; metro_key?: string },
  sections: EditionSectionRow[]
): CityEditionSnapshot {
  const local = extractLocalFingerprint(edition, sections);
  return {
    label: spec.label,
    metroKey: edition.metro_key ?? spec.expectedMetroKey,
    editionId: edition.id,
    national: extractNationalFingerprint(edition, sections),
    local,
    localSerialized: serializeLocalFingerprint(local),
  };
}

export function summarizePerformance(
  rows: Array<{ label: string; timing: CityTiming; passed: boolean; issues: AuditIssue[] }>
): {
  fastest: string | null;
  slowest: string | null;
  averageTotalMs: number;
  averageFirstPaintMs: number | null;
  bottlenecks: string[];
  recommendations: string[];
} {
  const withTotal = rows.filter((r) => r.timing.totalMs > 0);
  const sorted = [...withTotal].sort((a, b) => a.timing.totalMs - b.timing.totalMs);
  const firstPaints = rows
    .map((r) => r.timing.firstPaintMs)
    .filter((ms): ms is number => ms != null);

  const avgTotal =
    withTotal.length > 0
      ? Math.round(withTotal.reduce((s, r) => s + r.timing.totalMs, 0) / withTotal.length)
      : 0;
  const avgFirstPaint =
    firstPaints.length > 0
      ? Math.round(firstPaints.reduce((s, n) => s + n, 0) / firstPaints.length)
      : null;

  const bottlenecks: string[] = [];
  const recommendations: string[] = [];

  const slow = sorted[sorted.length - 1];
  if (slow && slow.timing.totalMs > avgTotal * 1.4) {
    bottlenecks.push(`${slow.label} total build ${slow.timing.totalMs}ms (>40% above average)`);
    recommendations.push(
      `Profile ${slow.label} Edge build logs for Local Events AI and Story Editor stalls.`
    );
  }

  const cacheHits = rows.filter((r) => r.timing.nationalCacheLikely === true);
  if (cacheHits.length > 0) {
    const avgCacheReady = Math.round(
      cacheHits.reduce((s, r) => s + (r.timing.readyMs ?? r.timing.totalMs), 0) /
        cacheHits.length
    );
    recommendations.push(
      `National daily cache hits averaged ${avgCacheReady}ms ready — keep national layer warm before multi-metro rollout.`
    );
  }

  const cold = rows.find((r) => r.timing.nationalCacheLikely === false);
  if (cold) {
    recommendations.push(
      `First city (${cold.label}) cold national path took ${cold.timing.totalMs}ms — schedule one national pre-build before batch city generation.`
    );
  }

  if (avgFirstPaint != null && avgFirstPaint > 60_000) {
    bottlenecks.push(`Average first paint ${avgFirstPaint}ms exceeds 60s watchdog`);
    recommendations.push("Ensure MVP checkpoint publishes weather + greeting before national AI completes.");
  }

  return {
    fastest: sorted[0]?.label ?? null,
    slowest: slow?.label ?? null,
    averageTotalMs: avgTotal,
    averageFirstPaintMs: avgFirstPaint,
    bottlenecks,
    recommendations,
  };
}
