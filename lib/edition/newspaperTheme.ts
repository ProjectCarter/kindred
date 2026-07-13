/**
 * Kindred visual tokens — calm morning ritual.
 * Soft sky atmosphere, warm newspaper pages floating above it.
 * Arboretum air, not a news feed.
 */
export const paper = {
  /** Morning sky — app atmosphere behind everything. */
  sky: "#EEF6FB",
  /** Navigation / sticky header wash. */
  chrome: "#DCECF6",
  /** Physical newspaper page — cards and reading surfaces. */
  page: "#FAF8F3",
  /**
   * Paper surface alias (cards, reading column, raised panels).
   * Prefer `page` in new code; kept for existing call sites.
   */
  cream: "#FAF8F3",
  /** Slightly deeper paper for photographs / recessed panels. */
  creamDeep: "#F0EBE3",
  /** Soft wash behind callouts and side notes. */
  creamWash: "#F7F3EC",
  /** Primary text. */
  ink: "#2D2926",
  inkBody: "#2D2926E8",
  /** Secondary text. */
  inkMuted: "#7E776F",
  inkFaint: "#7E776FB8",
  /** Soft borders — never harsh. */
  inkRule: "#DDD5CA",
  border: "#DDD5CA",
  /** Warm accent — terracotta, quieter than before. */
  terracotta: "#B56A3A",
  terracottaSoft: "#B56A3AE6",
  terracottaWash: "#B56A3A14",
  /** Success / positive community signal. */
  success: "#6E8B6A",
} as const;

/** Soft print-like elevation — pages floating on morning air. */
export const shadow = {
  photo: {
    shadowColor: "#2D2926",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  /** Quiet lift for newspaper surfaces on the sky. */
  page: {
    shadowColor: "#2D2926",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
} as const;

/** Touch manners — acknowledge the hand, never celebrate the tap. */
export const press = {
  opacity: 0.55,
  scale: 0.985,
} as const;

/** Vertical rhythm — more air, less density. */
export const space = {
  folioGutter: 28,
  sectionGap: 64,
  afterMasthead: 32,
  afterBandit: 36,
  afterLead: 56,
  endPadding: 56,
} as const;

export const type = {
  /** Small brand mark (login, chrome). */
  masthead: {
    fontFamily: "Georgia",
    fontSize: 12,
    letterSpacing: 4.2,
    fontWeight: "600" as const,
  },
  /** Front-page nameplate — calm, print-like authority. */
  nameplate: {
    fontFamily: "Georgia",
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: 1.4,
    fontWeight: "600" as const,
  },
  nameplateMeta: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  display: {
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  leadHeadline: {
    fontFamily: "Georgia",
    fontSize: 29,
    lineHeight: 37,
    fontWeight: "600" as const,
    letterSpacing: -0.12,
  },
  sectionHeadline: {
    fontFamily: "Georgia",
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "600" as const,
    letterSpacing: -0.08,
  },
  sectionIntro: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic" as const,
  },
  /** Folio teaser — a few lines that invite the full story, not the full story itself. */
  folioDek: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
  },
  dek: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 28,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 29,
  },
  meta: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  bandit: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 28,
    fontStyle: "italic" as const,
  },
} as const;

/** Soft motion timings — ink settling on paper, not a feed. */
export const motion = {
  enterMs: 480,
  staggerMs: 52,
  risePx: 3,
  photoMs: 1100,
  fadeEasing: "cubic" as const,
} as const;

/**
 * Shared Article Reader tokens — inherited by every section’s reading page.
 * Tuned for a calm Sunday-paper / magazine measure.
 */
export const reader = {
  /** Comfortable phone measure — roughly 58–65 characters. */
  measure: 512,
  /** Side inset from the screen edge for the reading column. */
  gutter: 26,
  headline: {
    fontFamily: "Georgia",
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "600" as const,
    letterSpacing: -0.4,
  },
  dek: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: 0.02,
  },
  byline: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 23,
    fontStyle: "italic" as const,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 32,
    letterSpacing: 0.15,
  },
  dropCap: {
    fontFamily: "Georgia",
    fontSize: 54,
    lineHeight: 46,
    fontWeight: "600" as const,
  },
  pullQuote: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 36,
    fontStyle: "italic" as const,
    letterSpacing: -0.06,
  },
  caption: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic" as const,
  },
  credit: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.55,
  },
  meta: {
    fontSize: 12,
    letterSpacing: 0.4,
  },
  calloutBody: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 28,
    fontStyle: "italic" as const,
  },
} as const;
