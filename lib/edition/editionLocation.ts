/**
 * Resolve which city an edition was built for — used to refuse
 * silently reusing another city's paper.
 */

import { parseEditorialContext } from "./EditorialContext";
import { parseDiscoveryPayload } from "./discovery";
import { parseMorningEditionPayload } from "./morningEdition";
import type { EditionSection } from "./types";
import { normalizeCityKey } from "../location/locationKey";

export { shouldWithholdEditionForCityMismatch } from "./editionCityMismatch.ts";

export function cityFromEditionPayloads(row: {
  discovery?: unknown;
  editorial_context?: unknown;
  morning_edition?: unknown;
}): string | null {
  const discovery = parseDiscoveryPayload(row.discovery);
  if (discovery?.location?.city?.trim()) {
    return discovery.location.city.trim();
  }

  const editorial = parseEditorialContext(row.editorial_context);
  if (editorial?.location?.city?.trim()) {
    return editorial.location.city.trim();
  }

  const morning = parseMorningEditionPayload(row.morning_edition);
  if (morning?.location?.city?.trim()) {
    return morning.location.city.trim();
  }

  return null;
}

/** Scan local_events / weather section text for an embedded city. */
export function cityFromEditionSections(
  sections: EditionSection[]
): string | null {
  const events = sections.find((s) => s.section_type === "local_events");
  if (events?.body) {
    try {
      const parsed = JSON.parse(events.body) as {
        events?: Array<{ city?: string }>;
      };
      const cities = (parsed.events ?? [])
        .map((e) => e.city?.trim())
        .filter(Boolean) as string[];
      if (cities.length) {
        // Majority city among events
        const counts = new Map<string, { label: string; n: number }>();
        for (const c of cities) {
          const key = normalizeCityKey(c);
          const prev = counts.get(key);
          counts.set(key, { label: c, n: (prev?.n ?? 0) + 1 });
        }
        let best: { label: string; n: number } | null = null;
        for (const v of counts.values()) {
          if (!best || v.n > best.n) best = v;
        }
        if (best) return best.label;
      }
    } catch {
      /* not JSON */
    }
    // Plain text fallback
    const sf = events.body.match(/San Francisco/i);
    if (sf) return "San Francisco";
  }

  const weather = sections.find((s) => s.section_type === "weather");
  const blob = `${weather?.headline ?? ""} ${weather?.body ?? ""}`;
  const inCity = blob.match(/\bin\s+([A-Z][A-Za-z .'-]{1,40})/);
  if (inCity?.[1]) {
    return inCity[1].replace(/[.,;:].*$/, "").trim();
  }

  return null;
}

export function resolveEditionBuiltCity(
  row: {
    discovery?: unknown;
    editorial_context?: unknown;
    morning_edition?: unknown;
  },
  sections: EditionSection[]
): string | null {
  return (
    cityFromEditionPayloads(row) ?? cityFromEditionSections(sections) ?? null
  );
}
