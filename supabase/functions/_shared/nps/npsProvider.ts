import type {
  NpsAlertRecord,
  NpsEventRecord,
  NpsParkRecord,
  NpsSearchInput,
} from "./types.ts";

const NPS_API_BASE = "https://developer.nps.gov/api/v1";
const USER_AGENT = "Kindred/1.0 (https://kindred.app; nps-provider)";

type NpsImage = { url?: string; title?: string; altText?: string; credit?: string };
type NpsFee = { cost?: string; description?: string; title?: string };
type NpsHours = { standardHours?: { monday?: string }; exceptions?: unknown[] };
type NpsParkRaw = {
  id?: string;
  parkCode?: string;
  fullName?: string;
  designation?: string;
  description?: string;
  states?: string;
  latitude?: string;
  longitude?: string;
  url?: string;
  images?: NpsImage[];
  entranceFees?: NpsFee[];
  operatingHours?: NpsHours[];
};
type NpsListResponse<T> = { data?: T[]; total?: string };

function apiKey(): string | null {
  try {
    return Deno.env.get("NPS_API_KEY")?.trim() || null;
  } catch {
    return null;
  }
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function npsFetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;

  const search = new URLSearchParams(params);
  try {
    const res = await fetch(`${NPS_API_BASE}${path}?${search}`, {
      headers: {
        "User-Agent": USER_AGENT,
        "X-Api-Key": key,
      },
    });
    if (res.status === 429) {
      console.warn("[nps] rate limited", { path });
      return null;
    }
    if (!res.ok) {
      console.warn("[nps] fetch failed", { path, status: res.status });
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn("[nps] network error", { path, err });
    return null;
  }
}

function parsePark(raw: NpsParkRaw, origin?: { lat: number; lon: number }): NpsParkRecord | null {
  const parkCode = raw.parkCode?.trim();
  const fullName = raw.fullName?.trim();
  if (!parkCode || !fullName) return null;

  const lat = raw.latitude ? Number(raw.latitude) : null;
  const lon = raw.longitude ? Number(raw.longitude) : null;
  const image = raw.images?.[0];
  const fee = raw.entranceFees?.[0];
  const hours = raw.operatingHours?.[0]?.standardHours;
  const hoursSummary = hours
    ? Object.entries(hours)
        .slice(0, 2)
        .map(([day, time]) => `${day}: ${time}`)
        .join("; ")
    : null;

  const distanceKm =
    origin && lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
      ? haversineKm(origin.lat, origin.lon, lat, lon)
      : null;

  return {
    provider: "nps",
    parkCode,
    fullName,
    designation: raw.designation?.trim() || "National Park",
    description: (raw.description ?? "").replace(/\s+/g, " ").trim().slice(0, 600),
    states: raw.states?.trim() || "",
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    url: raw.url?.trim() || `https://www.nps.gov/${parkCode}/index.htm`,
    imageUrl: image?.url ?? null,
    imageAttribution: image?.credit ?? image?.title ?? null,
    entranceFeeSummary: fee
      ? [fee.title, fee.cost, fee.description].filter(Boolean).join(" — ").slice(0, 120)
      : null,
    operatingHoursSummary: hoursSummary,
    alerts: [],
    events: [],
    distanceKm,
    confidence: distanceKm != null && distanceKm <= 120 ? 0.92 : 0.75,
    sourceAttribution: `National Park Service — ${fullName}`,
    retrievedAt: new Date().toISOString(),
    weatherHint: null,
  };
}

async function fetchAlerts(parkCode: string): Promise<NpsAlertRecord[]> {
  const data = await npsFetch<NpsListResponse<{
    title?: string;
    description?: string;
    category?: string;
    url?: string;
    lastIndexedDate?: string;
  }>>("/alerts", { parkCode, limit: "5" });

  return (data?.data ?? []).map((a) => ({
    title: a.title?.trim() || "Park alert",
    description: (a.description ?? "").replace(/\s+/g, " ").trim().slice(0, 280),
    category: a.category?.trim() || "Information",
    url: a.url ?? null,
    lastIndexed: a.lastIndexedDate ?? null,
  }));
}

async function fetchEvents(parkCode: string): Promise<NpsEventRecord[]> {
  const data = await npsFetch<NpsListResponse<{
    title?: string;
    description?: string;
    datestart?: string;
    dateend?: string;
    isfree?: string;
    infourl?: string;
  }>>("/events", { parkCode, limit: "5" });

  return (data?.data ?? []).map((e) => ({
    title: e.title?.trim() || "Park event",
    description: (e.description ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    beginDate: e.datestart ?? null,
    endDate: e.dateend ?? null,
    isFree: e.isfree === "true",
    url: e.infourl ?? null,
  }));
}

async function fetchParksRaw(input: NpsSearchInput): Promise<NpsParkRaw[]> {
  const limit = String(input.limit ?? 20);
  const state = input.state?.trim().toUpperCase();

  if (state && state.length === 2) {
    const byState = await npsFetch<NpsListResponse<NpsParkRaw>>("/parks", {
      stateCode: state,
      limit,
    });
    if (byState?.data?.length) return byState.data;
  }

  const radius = String(input.radiusMiles ?? 100);
  const byGeo = await npsFetch<NpsListResponse<NpsParkRaw>>("/parks", {
    lat: String(input.lat),
    long: String(input.lon),
    radius,
    limit,
  });
  return byGeo?.data ?? [];
}

export async function fetchNpsParks(input: NpsSearchInput): Promise<NpsParkRecord[]> {
  if (!apiKey()) {
    console.log("[nps] skipped — NPS_API_KEY not set");
    return [];
  }

  const origin = { lat: input.lat, lon: input.lon };
  const rawParks = await fetchParksRaw(input);
  const parsed = rawParks
    .map((raw) => parsePark(raw, origin))
    .filter((p): p is NpsParkRecord => Boolean(p))
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
    .slice(0, input.limit ?? 12);

  const enriched = await Promise.all(
    parsed.slice(0, 6).map(async (park) => {
      const [alerts, events] = await Promise.all([
        fetchAlerts(park.parkCode),
        fetchEvents(park.parkCode),
      ]);
      return { ...park, alerts, events };
    })
  );

  const rest = parsed.slice(6);
  return [...enriched, ...rest];
}

export function isNpsConfigured(): boolean {
  return Boolean(apiKey());
}
