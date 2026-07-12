/**
 * Kindred newspaper visual tokens — Front Page craft.
 * Cream paper, warm ink, terracotta accents. Original to Kindred.
 * Aligned with KINDRED_DESIGN_MANIFESTO.md
 */
export const paper = {
  cream: "#FAF6EF",
  creamDeep: "#F3EEE4",
  /** Soft wash behind magazine sidebars / discovery desk. */
  creamWash: "#F7F1E7",
  ink: "#2B2620",
  inkBody: "#2B2620E8",
  inkMuted: "#2B2620A6",
  inkFaint: "#2B262073",
  inkRule: "#2B26201F",
  terracotta: "#C1622D",
  terracottaSoft: "#C1622DE6",
  terracottaWash: "#C1622D14",
} as const;

/** Soft print-like elevation — photographs only, never chrome. */
export const shadow = {
  photo: {
    shadowColor: "#2B2620",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
} as const;

/** Touch manners — acknowledge the hand, never celebrate the tap. */
export const press = {
  opacity: 0.55,
  scale: 0.985,
} as const;

/** Vertical rhythm of the folio — breathing room, not density. */
export const space = {
  folioGutter: 24,
  sectionGap: 52,
  afterMasthead: 32,
  afterBandit: 40,
  afterLead: 48,
  endPadding: 48,
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
 * Tuned for a calm Sunday-paper / magazine measure (NYT / Economist / Monocle).
 */
export const reader = {
  /** Comfortable phone measure — roughly 58–65 characters. */
  measure: 512,
  /** Side inset from the screen edge for the reading column. */
  gutter: 22,
  headline: {
    fontFamily: "Georgia",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "600" as const,
    letterSpacing: -0.3,
  },
  dek: {
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 31,
    letterSpacing: 0.04,
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
    lineHeight: 36,
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
