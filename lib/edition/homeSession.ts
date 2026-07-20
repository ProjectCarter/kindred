import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Homepage scroll persistence, keyed by edition + location so a new day's
 * paper (or a city change) never inherits yesterday's offset.
 *
 * Scroll offsets are **session-scoped only** — kept in the module-level
 * memory Map for the lifetime of the JS process. They survive Home screen
 * remounts within the same app session (navigation return) but are never
 * restored after a true cold launch.
 *
 * Legacy `@kindred/home-scroll/*` AsyncStorage keys are purged once per
 * process on app boot via `purgePersistedHomeScrollOffsets`.
 */

const PREFIX = "@kindred/home-scroll/";

const memory = new Map<string, number>();

let diskPurgedThisProcess = false;

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
}

export function getHomeScrollSync(sessionKey: string): number {
  return memory.get(sessionKey) ?? 0;
}

export async function loadHomeScroll(sessionKey: string): Promise<number> {
  return getHomeScrollSync(sessionKey);
}

export function clearHomeScroll(sessionKey: string): void {
  memory.delete(sessionKey);
}

/** TEMP(Phase One perf): wipe scroll memory for cold-launch simulation. */
export function clearAllHomeScrollSessions(): void {
  memory.clear();
}

/**
 * Remove legacy disk-persisted homepage scroll offsets.
 * Called once per process from root layout boot — a new JS process is a
 * fresh app session and must not inherit a prior session's scroll offset.
 */
export async function purgePersistedHomeScrollOffsets(): Promise<void> {
  if (diskPurgedThisProcess) return;
  diskPurgedThisProcess = true;
  try {
    const allKeys = (await AsyncStorage.getAllKeys()) ?? [];
    const stale = allKeys.filter((key) => key.startsWith(PREFIX));
    if (stale.length > 0) {
      await AsyncStorage.multiRemove(stale);
    }
  } catch {
    /* non-fatal — memory-only path still correct */
  }
}

/** @internal Test hook — whether this process already purged disk scroll keys. */
export function homeScrollDiskPurgedThisProcess(): boolean {
  return diskPurgedThisProcess;
}

/** @internal Test hook — reset module state between tests. */
export function resetHomeScrollSessionForTests(): void {
  memory.clear();
  diskPurgedThisProcess = false;
}
