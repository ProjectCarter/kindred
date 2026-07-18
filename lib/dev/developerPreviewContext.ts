import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KindredPlace } from "../location/types";
import { assertDeveloperMode } from "./developerMode";

const STORAGE_KEY = "@kindred/dev/preview-context-v1";

/** Authoritative identity for a Developer Tools preview session. */
export type DeveloperPreviewContext = {
  editionId: string | null;
  metroKey: string;
  city: string;
  state: string | null;
  region: string | null;
  lat: number;
  lon: number;
  editionDate: string;
  traceId?: string | null;
  isDeveloperPreview: true;
};

let memory: DeveloperPreviewContext | null = null;
let hydrated = false;

function normalize(raw: unknown): DeveloperPreviewContext | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<DeveloperPreviewContext>;
  const metroKey = typeof o.metroKey === "string" ? o.metroKey.trim() : "";
  const city = typeof o.city === "string" ? o.city.trim() : "";
  const editionDate = typeof o.editionDate === "string" ? o.editionDate.trim() : "";
  const lat = typeof o.lat === "number" ? o.lat : Number(o.lat);
  const lon = typeof o.lon === "number" ? o.lon : Number(o.lon);
  if (!metroKey || !city || !editionDate || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return {
    editionId: typeof o.editionId === "string" ? o.editionId.trim() || null : null,
    metroKey,
    city,
    state: typeof o.state === "string" ? o.state : null,
    region: typeof o.region === "string" ? o.region : null,
    lat,
    lon,
    editionDate,
    traceId: typeof o.traceId === "string" ? o.traceId : null,
    isDeveloperPreview: true,
  };
}

export async function hydrateDeveloperPreviewContext(): Promise<DeveloperPreviewContext | null> {
  if (!assertDeveloperMode("hydrateDeveloperPreviewContext")) {
    memory = null;
    hydrated = true;
    return null;
  }
  if (hydrated) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    memory = raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    memory = null;
  }
  hydrated = true;
  return memory;
}

export function getDeveloperPreviewContextSync(): DeveloperPreviewContext | null {
  return memory;
}

export function isDeveloperPreviewSessionActive(): boolean {
  return Boolean(memory?.metroKey && memory?.city);
}

export async function setDeveloperPreviewContext(
  input: Omit<DeveloperPreviewContext, "isDeveloperPreview">
): Promise<void> {
  if (!assertDeveloperMode("setDeveloperPreviewContext")) return;
  memory = { ...input, isDeveloperPreview: true };
  hydrated = true;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

export async function clearDeveloperPreviewContext(): Promise<void> {
  if (!assertDeveloperMode("clearDeveloperPreviewContext")) return;
  memory = null;
  hydrated = true;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function developerPreviewPlace(ctx: DeveloperPreviewContext): KindredPlace {
  return {
    city: ctx.city,
    state: ctx.state,
    region: ctx.region,
    lat: ctx.lat,
    lon: ctx.lon,
  };
}

export function displayCityForEdition(input: {
  preview: DeveloperPreviewContext | null;
  discoveryCity?: string | null;
  activeCity?: string | null;
}): string | undefined {
  return (
    input.preview?.city ??
    input.discoveryCity?.trim() ??
    input.activeCity?.trim() ??
    undefined
  );
}
