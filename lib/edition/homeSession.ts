import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Homepage scroll persistence, keyed by edition + location so a new day's
 * paper (or a city change) never inherits yesterday's offset.
 *
 * The in-memory `memory` Map is a *module-level* singleton — it survives a
 * full remount of the Home screen component (React unmounting/remounting
 * the component tree does not reload this module), which is what makes
 * restoration reliable even if the navigator doesn't keep Home mounted in
 * the background across a push/pop. AsyncStorage is the second-tier,
 * slower fallback that survives an actual app relaunch.
 */

const PREFIX = "@kindred/home-scroll/";

const memory = new Map<string, number>();

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

export function homeScrollSessionKey(
  editionId: string,
  locationKey: string
): string {
  return `${editionId}:${locationKey}`;
}

export function updateHomeScroll(sessionKey: string, scrollY: number): void {
  if (!sessionKey || !Number.isFinite(scrollY) || scrollY < 0) return;
  const y = Math.round(scrollY);
  memory.set(sessionKey, y);
  void AsyncStorage.setItem(storageKey(sessionKey), String(y)).catch(() => {});
}

export function getHomeScrollSync(sessionKey: string): number {
  return memory.get(sessionKey) ?? 0;
}

export async function loadHomeScroll(sessionKey: string): Promise<number> {
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

export function clearHomeScroll(sessionKey: string): void {
  memory.delete(sessionKey);
  void AsyncStorage.removeItem(storageKey(sessionKey)).catch(() => {});
}
