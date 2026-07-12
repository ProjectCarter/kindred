/**
 * Profile interests gate — used by root navigation to enforce onboarding.
 */

export function interestsListFromProfile(
  interests: unknown
): unknown[] {
  if (Array.isArray(interests)) return interests;
  if (typeof interests === "string" && interests.trim()) {
    try {
      const parsed = JSON.parse(interests);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

export function profileHasInterests(interests: unknown): boolean {
  return interestsListFromProfile(interests).length > 0;
}
