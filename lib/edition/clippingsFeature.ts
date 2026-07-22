/**
 * Personal Library — Version 2 surface gate.
 *
 * Product decision (V1): Kindred is a daily local newspaper. Readers open
 * today's edition, discover their city, read, explore, and return tomorrow.
 *
 * The following stay implemented but fully hidden and inert until Version 2:
 * - Save / Pin / Bookmarks / Clippings
 * - Likes / Favorites
 * - Personal article collections
 * - Personal-library analytics and storage reads/writes
 *
 * What stays on while this flag is false:
 * - All services, schema, migrations, models, and server infrastructure
 * - Buy Tickets, Google Maps, Official Website, and Share article actions
 * - General reading analytics (`article_opened`, external link taps)
 *
 * What stays off:
 * - Save / Pin / Like / Bookmark UI on articles and edition sections
 * - Clippings list screens and navigation entry points
 * - Client `clippings` and `likes` database reads and writes
 * - `article_saved` analytics and clip/like reading signals
 *
 * Re-enable for Version 2: set `CLIPPINGS_ENABLED` to `true` here.
 */

/** V1 hidden — not a permanent removal of personal library features. */
export const CLIPPINGS_ENABLED = false;

/** Canonical gate for all dormant personal-library features (V2). */
export function isPersonalLibraryEnabled(): boolean {
  return CLIPPINGS_ENABLED;
}

/** @deprecated Prefer `isPersonalLibraryEnabled` — kept for existing call sites. */
export function isClippingsEnabled(): boolean {
  return isPersonalLibraryEnabled();
}

/** Personal-library reading signals — suppressed while the gate is off. */
export const PERSONAL_LIBRARY_SIGNAL_TYPES = [
  "clip",
  "unclip",
  "like",
  "unlike",
] as const;

export type PersonalLibrarySignalType =
  (typeof PERSONAL_LIBRARY_SIGNAL_TYPES)[number];

export function isPersonalLibrarySignalType(
  signalType: string
): signalType is PersonalLibrarySignalType {
  return (PERSONAL_LIBRARY_SIGNAL_TYPES as readonly string[]).includes(
    signalType
  );
}
