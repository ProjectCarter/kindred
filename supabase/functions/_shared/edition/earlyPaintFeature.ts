/** Server mirror — lib/edition/earlyPaintFeature.ts */
export {
  EDITION_EARLY_PAINT_DEFAULT,
  isEditionEarlyPaintEnabledClientDefault,
} from "../../../../lib/edition/earlyPaintFeature.ts";

/**
 * Production early-paint toggle — server env only, never client-exposed.
 * Default false: publish only after validate_technical + publish_edition.
 */
export function isEditionEarlyPaintEnabled(): boolean {
  const raw = Deno.env.get("EDITION_EARLY_PAINT_ENABLED");
  if (raw === "true") return true;
  if (raw === "false") return false;
  return EDITION_EARLY_PAINT_DEFAULT;
}
