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

export async function maybeTriggerLiveRefresh(params: {
  editionId: string;
  editionDate: string;
  place: KindredPlace | null;
  onChanged?: () => void;
}): Promise<void> {
  const { editionId, editionDate, place, onChanged } = params;
  if (!editionId || !place) return;
  if (!(await shouldRefresh(editionId))) return;

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
      return;
    }
    if (__DEV__) {
      console.log("[liveRefresh] result", data);
    }
    if (data && typeof data === "object" && (data as { changed?: boolean }).changed) {
      onChanged?.();
    }
  } catch (err) {
    if (__DEV__) {
      console.warn(
        "[liveRefresh] threw",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}
