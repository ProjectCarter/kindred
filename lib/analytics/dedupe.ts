const emittedKeys = new Set<string>();
const MAX_KEYS = 600;

export function shouldEmitOnce(dedupeKey: string): boolean {
  if (emittedKeys.has(dedupeKey)) return false;
  emittedKeys.add(dedupeKey);
  if (emittedKeys.size > MAX_KEYS) {
    emittedKeys.clear();
  }
  return true;
}

export function resetAnalyticsDedupe(): void {
  emittedKeys.clear();
}
