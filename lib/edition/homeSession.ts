import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@kindred/home-scroll/";

/** In-memory cache — survives blur; AsyncStorage survives remount. */
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
