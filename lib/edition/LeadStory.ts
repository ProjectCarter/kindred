/**
 * Front Page Lead Story — client contract.
 * Selected at edition build time; stored on editions.lead_story.
 */

export type BanditsPickReservation = {
  reserved: true;
  isBanditsPick: false;
};

export type LeadStoryHeroImage = {
  uri: string | null;
  alt: string;
  source: "article" | "none";
};

export type LeadStoryRole = "local" | "national" | "world" | "breaking";

export type LeadStory = {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  role: LeadStoryRole;
  heroImage: LeadStoryHeroImage;
  banditsPick: BanditsPickReservation;
  selection: {
    score: number;
    reasons: Array<{ code: string; label: string; weight: number }>;
    belowFoldTitles: string[];
    strategy: "prefer_local" | "national_world" | "breaking" | "fallback";
  };
};

const ROLES = new Set<LeadStoryRole>([
  "local",
  "national",
  "world",
  "breaking",
]);

/**
 * Harden against malformed / partial lead_story jsonb.
 * Never throw; never return a shape that crashes the folio.
 */
export function parseLeadStory(value: unknown): LeadStory | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const headline = typeof raw.headline === "string" ? raw.headline.trim() : "";
  if (!id || !headline) return null;

  const summary =
    typeof raw.summary === "string"
      ? raw.summary
      : typeof raw.dek === "string"
        ? raw.dek
        : "";

  const source =
    typeof raw.source === "string" && raw.source.trim()
      ? raw.source.trim()
      : "Kindred";

  const roleRaw = typeof raw.role === "string" ? raw.role : "national";
  const role = ROLES.has(roleRaw as LeadStoryRole)
    ? (roleRaw as LeadStoryRole)
    : "national";

  const heroRaw =
    raw.heroImage && typeof raw.heroImage === "object"
      ? (raw.heroImage as Record<string, unknown>)
      : null;
  const heroUri =
    typeof heroRaw?.uri === "string" && heroRaw.uri.trim()
      ? heroRaw.uri.trim()
      : null;

  const selectionRaw =
    raw.selection && typeof raw.selection === "object"
      ? (raw.selection as Record<string, unknown>)
      : null;
  const reasons = Array.isArray(selectionRaw?.reasons)
    ? (selectionRaw!.reasons as LeadStory["selection"]["reasons"]).filter(
        (r) => r && typeof r.label === "string"
      )
    : [];

  return {
    id,
    headline,
    summary,
    source,
    url: typeof raw.url === "string" ? raw.url : null,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
    role,
    heroImage: {
      uri: heroUri,
      alt:
        typeof heroRaw?.alt === "string" && heroRaw.alt.trim()
          ? heroRaw.alt.trim()
          : headline,
      source: heroRaw?.source === "article" ? "article" : "none",
    },
    banditsPick: { reserved: true, isBanditsPick: false },
    selection: {
      score: typeof selectionRaw?.score === "number" ? selectionRaw.score : 0,
      reasons,
      belowFoldTitles: Array.isArray(selectionRaw?.belowFoldTitles)
        ? (selectionRaw!.belowFoldTitles as string[]).filter(
            (t) => typeof t === "string"
          )
        : [],
      strategy:
        selectionRaw?.strategy === "prefer_local" ||
        selectionRaw?.strategy === "breaking" ||
        selectionRaw?.strategy === "fallback" ||
        selectionRaw?.strategy === "national_world"
          ? selectionRaw.strategy
          : "fallback",
    },
  };
}

/** Future UI helper — Bandit's Pick marker is reserved but inactive. */
export function isBanditsPickReserved(lead: LeadStory): boolean {
  return (
    lead.banditsPick.reserved === true && lead.banditsPick.isBanditsPick === false
  );
}

export const LeadStoryService = {
  parseLeadStory,
  isBanditsPickReserved,
};

export default LeadStoryService;
