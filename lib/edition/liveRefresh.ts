import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";
import { locationPayload, type KindredPlace } from "../location/deviceLocation";

/**
 * Fires once, silently, after an already-ready edition has opened. Never
 * shows a loading state and never surfaces an error to the reader — this is
 * background upkeep (event times/cancellations/tickets, which cached places
 * still qualify), not generation. On-demand generation and the overnight job
 * remain the only paths that build the printed paper itself; this only ever
 * patches the structured, factual layer. See
 * supabase/functions/_shared/liveRefresh.ts for exactly what it touches.
 */

const THROTTLE_KEY_PREFIX = "@kindred/live-refresh/last-at:";
const MIN_INTERVAL_MS = 15 * 60 * 1000;

const memoryLastRefreshedAt = new Map<string, number>();

/** TEMP(Phase One perf): wipe live-refresh throttle memory for cold-launch simulation. */
export function clearLiveRefreshMemory(): void {
  memoryLastRefreshedAt.clear();
}

async function shouldRefresh(editionId: string): Promise<boolean> {
  const now = Date.now();
  const inMemory = memoryLastRefreshedAt.get(editionId);
  if (inMemory && now - inMemory < MIN_INTERVAL_MS) return false;

  try {
    const stored = await AsyncStorage.getItem(THROTTLE_KEY_PREFIX + editionId);
    if (stored) {
      const at = Number(stored);
      if (Number.isFinite(at) && now - at < MIN_INTERVAL_MS) {
        memoryLastRefreshedAt.set(editionId, at);
        return false;
      }
    }
  } catch {
    // Storage read failed — proceed; worst case is one extra refresh call.
  }
  return true;
}

function markRefreshed(editionId: string): void {
  const now = Date.now();
  memoryLastRefreshedAt.set(editionId, now);
  void AsyncStorage.setItem(THROTTLE_KEY_PREFIX + editionId, String(now)).catch(
    () => {}
  );
}

export type LiveRefreshPatch = {
  /** True when structured event facts changed (times, cancellations, etc.). */
  eventsChanged: boolean;
  /** Discovery may change server-side — callers must ignore for frozen editions. */
  discoveryChanged: boolean;
};

export async function maybeTriggerLiveRefresh(params: {
  editionId: string;
  editionDate: string;
  place: KindredPlace | null;
  /** Called only when event-specific facts changed — never for discovery alone. */
  onEventsChanged?: () => void;
}): Promise<LiveRefreshPatch> {
  const { editionId, editionDate, place, onEventsChanged } = params;
  const noop: LiveRefreshPatch = { eventsChanged: false, discoveryChanged: false };
  if (!editionId || !place) return noop;
  if (!(await shouldRefresh(editionId))) return noop;

  // Claim the slot before the network call resolves — a slow response
  // must never let a second trigger (e.g. a quick re-focus) fire again.
  markRefreshed(editionId);

  try {
    const { data, error } = await supabase.functions.invoke(
      "refresh-live-data",
      {
        body: {
          location: locationPayload(place),
          editionDate,
        },
      }
    );
    if (error) {
      if (__DEV__) console.warn("[liveRefresh] invoke error", error.message);
      return noop;
    }
    if (__DEV__) {
      console.log("[liveRefresh] result", data);
    }
    const body = data as {
      events?: { changed?: boolean };
      discovery?: { changed?: boolean };
      changed?: boolean;
    } | null;
    const eventsChanged = Boolean(
      body?.events?.changed ?? (body?.changed && !body?.discovery?.changed)
    );
    const discoveryChanged = Boolean(body?.discovery?.changed);
    if (eventsChanged) {
      onEventsChanged?.();
    }
    return { eventsChanged, discoveryChanged };
  } catch (err) {
    if (__DEV__) {
      console.warn(
        "[liveRefresh] threw",
        err instanceof Error ? err.message : String(err)
      );
    }
    return noop;
  }
}
