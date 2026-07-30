/**
 * Offers hook — reads the published catalog once, then hands it to the
 * classification engine to produce the three-layer section model (Local /
 * Travel / Online). Both the homepage desk and the See All screen use this same
 * hook, so scope decisions and metro eligibility live entirely in
 * `offerClassification.ts` — never in a component.
 *
 * Fails soft: an unconfigured backend or a read error resolves to an empty
 * catalog so the Offers section simply hides.
 */
import { useEffect, useState } from "react";
import { fetchPublishedOffers } from "./dealsRepository";
import {
  buildOfferSections,
  type OfferScopeSection,
} from "./offerClassification";

export type OfferSectionsStatus = "loading" | "ready" | "empty" | "error";

export type OfferSectionsState = {
  status: OfferSectionsStatus;
  /** All three scopes, in order; each may have zero groups. */
  sections: OfferScopeSection[];
  /** Total eligible offers across every scope (for count labels). */
  totalCount: number;
};

const EMPTY_SECTIONS: OfferScopeSection[] = [];

/**
 * Build the Local / Travel / Online sections for the reader's metro.
 *
 * @param regionKey Reader's metro key (e.g. "gilbert-az"). When null/blank,
 * Local offers are withheld (metro unknown) while Travel + Online still surface.
 */
export function useOfferSections(
  regionKey?: string | null
): OfferSectionsState {
  const metro = regionKey?.trim() || null;

  const [state, setState] = useState<OfferSectionsState>({
    status: "loading",
    sections: EMPTY_SECTIONS,
    totalCount: 0,
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, status: "loading" }));

    (async () => {
      const { deals, error } = await fetchPublishedOffers();
      if (cancelled) return;

      if (error) {
        setState({ status: "error", sections: EMPTY_SECTIONS, totalCount: 0 });
        return;
      }

      const sections = buildOfferSections(deals, metro);
      const totalCount = sections.reduce((sum, s) => sum + s.total, 0);
      setState({
        status: totalCount > 0 ? "ready" : "empty",
        sections,
        totalCount,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [metro]);

  return state;
}
