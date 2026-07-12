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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
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
  sectionGap: 38,
  afterMasthead: 32,
  afterBandit: 26,
} as const;

export const type = {
  masthead: {
    fontFamily: "Georgia",
    fontSize: 12,
    letterSpacing: 4.2,
    fontWeight: "600" as const,
  },
  display: {
    fontFamily: "Georgia",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  leadHeadline: {
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "600" as const,
    letterSpacing: -0.15,
  },
  sectionHeadline: {
    fontFamily: "Georgia",
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "600" as const,
    letterSpacing: -0.1,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2.1,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
  },
  dek: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 27,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 27,
  },
  meta: {
    fontSize: 11,
    letterSpacing: 0.35,
  },
  bandit: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 28,
    fontStyle: "italic" as const,
  },
} as const;

/** Soft motion timings — ink settling on paper, not a feed. */
export const motion = {
  enterMs: 640,
  staggerMs: 88,
  risePx: 8,
  photoMs: 880,
  fadeEasing: "cubic" as const,
} as const;

/**
 * Shared Article Reader tokens — inherited by every section’s reading page.
 * Tuned for a calm Sunday-paper / magazine measure (NYT / Economist / Monocle).
 */
export const reader = {
  /** Comfortable measure — roughly 62–68 characters. */
  measure: 540,
  headline: {
    fontFamily: "Georgia",
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "600" as const,
    letterSpacing: -0.35,
  },
  dek: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 32,
    letterSpacing: 0.05,
  },
  byline: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 23,
    fontStyle: "italic" as const,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 36,
    letterSpacing: 0.15,
  },
  dropCap: {
    fontFamily: "Georgia",
    fontSize: 58,
    lineHeight: 50,
    fontWeight: "600" as const,
  },
  pullQuote: {
    fontFamily: "Georgia",
    fontSize: 26,
    lineHeight: 38,
    fontStyle: "italic" as const,
    letterSpacing: -0.1,
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
    lineHeight: 27,
    fontStyle: "italic" as const,
  },
} as const;
