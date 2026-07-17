/** True only in development builds — never in production/release. */
export function isDeveloperMode(): boolean {
  return __DEV__;
}

export function assertDeveloperMode(feature: string): boolean {
  if (!isDeveloperMode()) {
    if (__DEV__) {
      console.warn(`[dev] blocked ${feature} — not in developer mode`);
    }
    return false;
  }
  return true;
}
