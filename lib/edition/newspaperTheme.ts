/**
 * Kindred visual tokens — premium dark luxury (v2).
 *
 * The entire app shares this palette, so the dark theme is defined here once and
 * every screen inherits it. Token KEYS are preserved from the original light
 * "newspaper" palette (so no consumer imports change); only the VALUES are
 * remapped to a rich charcoal/black system. Names like `cream`/`creamDeep` are
 * kept for stability and now read as "elevated surface" / "recessed surface".
 *
 * Hierarchy: `sky`/`page` = darkest screen atmosphere · `cream`/`creamWash` =
 * elevated card surfaces · `creamDeep` = recessed/media · `ink…` = white→gray
 * text ramp · `border` = subtle hairline · `terracotta` = Kindred orange accent.
 */
export const paper = {
  /** Darkest app atmosphere — screen background behind everything. */
  sky: "#0C0D10",
  /** Navigation / sticky header wash — a hair above the page. */
  chrome: "#121419",
  /** Primary screen & reading background — unified dark stock. */
  page: "#0C0D10",
  newsprint: "#0C0D10",
  journal: "#0C0D10",
  /** Elevated card surface (brick rows, feature cards, raised panels). */
  cream: "#17191F",
  /** Recessed / media surface (photo frames, placeholders). */
  creamDeep: "#101217",
  /** Soft wash behind callouts and side notes. */
  creamWash: "#15171C",
  /** Primary text — near-white for a premium, non-glaring read. */
  ink: "#F4F5F7",
  inkBody: "#E3E4E9",
  /** Secondary text. */
  inkMuted: "#9A9CA6",
  inkFaint: "#75777F",
  /** Subtle hairline borders on dark surfaces. */
  inkRule: "#2A2C33",
  border: "#2A2C33",
  /** Kindred orange — primary accent, tuned brighter for dark. */
  terracotta: "#E98B45",
  terracottaSoft: "#E98B45E6",
  terracottaWash: "#E98B4522",
  /** Success / positive community signal. */
  success: "#7FB47A",
} as const;

/**
 * Official Kindred Gold — single accent for editorial highlights.
 * HEX #CC903E · RGB 204, 144, 62
 */
export const kindredGold = {
  primary: "#CC903E",
  /** Museum frame inner hairline only (~9% darker than primary). */
  frameInner: "#B98338",
  wash: "#CC903E18",
  rule: "#CC903E44",
} as const;

/** Today's Masterpiece — museum-thin rules, nearly full-bleed. */
export const masterpiece = {
  edgeMargin: 8,
  /** Paper-colored mat between outer and inner frame rules. */
  frameInset: 3,
  /** Horizontal chrome consumed by double hairline frame + mat. */
  frameChrome: 10,
  frameRadius: 1,
} as const;

/** Premium depth on dark — soft black elevation beneath floating surfaces. */
export const shadow = {
  photo: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 8,
  },
  /** Quiet lift for card surfaces on the charcoal background. */
  page: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 4,
  },
} as const;

/** Touch manners — acknowledge the hand, never celebrate the tap. */
export const press = {
  opacity: 0.55,
  scale: 0.985,
} as const;

/** Vertical rhythm — compact and intentional, more content per screen. */
export const space = {
  folioGutter: 28,
  sectionGap: 34,
  afterMasthead: 12,
  afterBandit: 28,
  afterLead: 40,
  endPadding: 40,
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
