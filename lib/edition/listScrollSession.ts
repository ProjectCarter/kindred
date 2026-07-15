import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Scroll persistence for list-style screens (See All, archive editions).
 * Same pattern as homeSession — memory first, AsyncStorage on relaunch.
 */

const PREFIX = "@kindred/list-scroll/";

const memory = new Map<string, number>();

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

export const LIST_SCROLL_KEYS = {
  activities: "activities",
  recommendations: "recommendations",
  events: "events",
  edition: (editionId: string) => `edition:${editionId}`,
} as const;

export function updateListScroll(sessionKey: string, scrollY: number): void {
  if (!sessionKey || !Number.isFinite(scrollY) || scrollY < 0) return;
  const y = Math.round(scrollY);
  memory.set(sessionKey, y);
  void AsyncStorage.setItem(storageKey(sessionKey), String(y)).catch(() => {});
}

export function getListScrollSync(sessionKey: string): number {
  return memory.get(sessionKey) ?? 0;
}

export async function loadListScroll(sessionKey: string): Promise<number> {
  const cached = memory.get(sessionKey);
  if (cached != null) return cached;
  try {
    const raw = await AsyncStorage.getItem(storageKey(sessionKey));
    if (!raw) return 0;
    const y = Number(raw);
    if (!Number.isFinite(y) || y < 0) return 0;
    memory.set(sessionKey, y);
    return y;
  } catch {
    return 0;
  }
}

/** TEMP(Phase One perf): wipe list scroll memory for cold-launch simulation. */
export function clearAllListScrollSessions(): void {
  memory.clear();
}
