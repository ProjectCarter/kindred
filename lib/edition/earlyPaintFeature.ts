/**
 * Early paint — mark editions ready before all desks finish (beta only).
 * Server reads EDITION_EARLY_PAINT_ENABLED; client uses compile-time default.
 */

/** Safest V2 default: publish only after validate_technical + publish_edition. */
export const EDITION_EARLY_PAINT_DEFAULT = false;

/**
 * Client-side diagnostic default. Production workers override via env on server.
 */
export function isEditionEarlyPaintEnabledClientDefault(): boolean {
  return EDITION_EARLY_PAINT_DEFAULT;
}
