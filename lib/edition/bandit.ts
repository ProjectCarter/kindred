import { banditDayLine } from "./morningRitual.ts";
import { isDisqualifiedBanditsPickStory } from "./banditPickQuality.ts";
import { isBanditsPicksEnabled } from "./banditsPicksFeature.ts";
import type { DiscoveryItem } from "./discovery.ts";

/**
 * Bandit — Kindred’s calm morning newspaper editor.
 * Warm, concise, optimistic, never overwhelming.
 *
 * Architecture is reusable across the app:
 * morning greetings, editorial notes, weekly recommendations,
 * seasonal messages, birthdays, travel awareness, special editions.
 *
 * Generation runs at edition build time; the client displays stored moments.
 */

export type BanditOccasion =
  | "morning"
  | "birthday"
  | "travel"
  | "seasonal"
  | "holiday"
  | "special_edition"
  | "weekly"
  | "editorial_note";

export type BanditMomentKind =
  | "morning_greeting"
  | "editorial_note"
  | "weekly_recommendation"
  | "seasonal_message"
  | "birthday"
  | "travel"
  | "special_edition";

export type BanditMoment = {
  kind: BanditMomentKind;
  occasion: BanditOccasion;
  line: string;
  notes?: string[];
  generatedAt: string;
};

/**
 * What kind of thing Bandit is pointing at today. What's Special Right Now
 * is never timeless filler — it's seasonal, limited, or happening this week.
 */
export type BanditsPickKind =
  | "article"
  | "event"
  | "activity"
  | "place"
  | "hidden_gem"
  | "seasonal";

export type BanditsPick = {
  kind: BanditsPickKind;
  intro: string;
  story: {
    id: string;
    headline: string;
    summary: string;
    body?: string[];
    modules?: Array<{ id: string; label: string; body: string }>;
    closingNote?: string | null;
    mapsQuery?: string | null;
    actionLabel?: string | null;
    nearby?: Array<{ name: string; description: string; glyph?: string }>;
    heroMomentId?: string | null;
    imageCaption?: string | null;
    source: string;
    url: string | null;
    publishedAt: string | null;
    imageUrl?: string | null;
    category?: string | null;
    why: string;
    /**
     * Present only when `kind !== "article"` — the full Discovery Engine
     * item, so the reader can open Kindred's purpose-built template for
     * it instead of a generic article shell.
     */
    discoveryItem?: DiscoveryItem | null;
  };
};

export type BanditPayload = {
  version: 1;
  morning: BanditMoment;
  weekly: BanditMoment | null;
  seasonal: BanditMoment | null;
  editorialNotes: string[];
  occasions: BanditOccasion[];
  /** Exactly one thoughtful recommendation near the end of the paper. */
  pick?: BanditsPick | null;
};

/** Context for optional client-side providers (preview / offline). */
export type BanditGreetingContext = {
  firstName?: string | null;
  weatherText?: string | null;
  hasLocalEvents?: boolean;
  editionDate?: string | null;
  birthdayMMDD?: string | null;
  traveling?: boolean;
  occasion?: BanditOccasion | null;
};

export type BanditGreetingProvider = (
  context: BanditGreetingContext
) => string | null | Promise<string | null>;

export const BANDIT_NAME = "Bandit";

/** Soft hold while Bandit’s line resolves — never technical. */
export const BANDIT_GREETING_PLACEHOLDER = "A moment…";

/** Tone examples — not shown in production. */
export const BANDIT_GREETING_EXAMPLES = [
  "A quiet start to the day. Your edition is ready when you are.",
  "Looks like a gentle day outside.",
  "I found a few things nearby you might enjoy.",
  "Sunday morning. I've set aside a few quiet recommendations for the week.",
  "I left the paper open for you.",
  "Sit with this for a minute. The day can wait.",
] as const;

export const BANDIT_VOICE = {
  warmth: "friendly without being familiar",
  pace: "unhurried",
  length: "one or two short sentences",
  optimism: "quiet hope, never cheerleading",
} as const;

let activeProvider: BanditGreetingProvider | null = null;

export function setBanditGreetingProvider(
  provider: BanditGreetingProvider | null
): void {
  activeProvider = provider;
}

export function getBanditGreetingProvider(): BanditGreetingProvider | null {
  return activeProvider;
}

/** Parse editions.bandit jsonb. */
export function parseBanditPayload(value: unknown): BanditPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<BanditPayload>;
  if (raw.version !== 1 || !raw.morning?.line) return null;
  return {
    version: 1,
    morning: raw.morning as BanditMoment,
    weekly: (raw.weekly as BanditMoment | null) ?? null,
    seasonal: (raw.seasonal as BanditMoment | null) ?? null,
    editorialNotes: Array.isArray(raw.editorialNotes)
      ? raw.editorialNotes
      : [],
    occasions: Array.isArray(raw.occasions) ? raw.occasions : [],
    pick: parseBanditsPick(raw.pick),
  };
}

const BANDITS_PICK_KINDS: readonly BanditsPickKind[] = [
  "article",
  "event",
  "activity",
  "place",
  "hidden_gem",
  "seasonal",
];

function parseBanditsPick(value: unknown): BanditsPick | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<BanditsPick> & {
    story?: Partial<BanditsPick["story"]>;
  };
  const story = raw.story;
  const intro = typeof raw.intro === "string" ? raw.intro.trim() : "";
  const headline =
    typeof story?.headline === "string" ? story.headline.trim() : "";
  const id = typeof story?.id === "string" ? story.id.trim() : "";
  if (!intro || !headline || !id) return null;
  // Editions stored before this field existed have no `kind` — they were
  // always articles.
  const kind = BANDITS_PICK_KINDS.includes(raw.kind as BanditsPickKind)
    ? (raw.kind as BanditsPickKind)
    : "article";
  const discoveryItem =
    story?.discoveryItem && typeof story.discoveryItem === "object"
      ? (story.discoveryItem as DiscoveryItem)
      : null;
  const body = Array.isArray(story?.body)
    ? story.body.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : undefined;
  const modules = Array.isArray(story?.modules)
    ? story.modules
        .filter(
          (m): m is { id: string; label: string; body: string } =>
            Boolean(m) &&
            typeof m === "object" &&
            typeof (m as { label?: string }).label === "string" &&
            typeof (m as { body?: string }).body === "string"
        )
        .map((m) => ({
          id: typeof m.id === "string" ? m.id : "note",
          label: m.label.trim(),
          body: m.body.trim(),
        }))
        .filter((m) => m.body.length > 0)
    : undefined;
  return {
    kind,
    intro: intro.slice(0, 280),
    story: {
      id,
      headline,
      summary:
        typeof story?.summary === "string" ? story.summary.trim() : "",
      body,
      modules,
      closingNote:
        typeof story?.closingNote === "string" ? story.closingNote.trim() : null,
      mapsQuery:
        typeof story?.mapsQuery === "string" ? story.mapsQuery.trim() : null,
      actionLabel:
        typeof story?.actionLabel === "string" ? story.actionLabel.trim() : null,
      nearby: Array.isArray(story?.nearby)
        ? story.nearby
            .filter(
              (n): n is { name: string; description: string; glyph?: string } =>
                Boolean(n) &&
                typeof n === "object" &&
                typeof (n as { name?: string }).name === "string" &&
                typeof (n as { description?: string }).description === "string"
            )
            .map((n) => ({
              name: n.name.trim(),
              description: n.description.trim(),
              glyph: typeof n.glyph === "string" ? n.glyph : undefined,
            }))
            .filter((n) => n.name && n.description)
        : undefined,
      heroMomentId:
        typeof story?.heroMomentId === "string" ? story.heroMomentId.trim() : null,
      imageCaption:
        typeof story?.imageCaption === "string" ? story.imageCaption.trim() : null,
      source:
        typeof story?.source === "string" && story.source.trim()
          ? story.source.trim()
          : "Kindred",
      url: typeof story?.url === "string" ? story.url : null,
      publishedAt:
        typeof story?.publishedAt === "string" ? story.publishedAt : null,
      imageUrl:
        typeof story?.imageUrl === "string" ? story.imageUrl : null,
      category:
        typeof story?.category === "string" ? story.category : null,
      why: typeof story?.why === "string" ? story.why.trim() : "",
      discoveryItem,
    },
  };
}

/**
 * Bandit's Pick for the end of the edition — null when none stored,
 * malformed, or when the V1 surface is disabled (`banditsPicksFeature`).
 */
export function banditsPick(
  payload: BanditPayload | null | undefined
): BanditsPick | null {
  if (!isBanditsPicksEnabled()) return null;
  try {
    if (!payload || typeof payload !== "object") return null;
    const pick = payload.pick ?? null;
    if (!pick || typeof pick !== "object") return null;
    const story = pick.story;
    if (!story || typeof story !== "object") return null;
    if (
      isDisqualifiedBanditsPickStory({
        headline: typeof story.headline === "string" ? story.headline : "",
        summary: typeof story.summary === "string" ? story.summary : "",
      })
    ) {
      return null;
    }
    return pick;
  } catch {
    // Malformed pick must never throw into homepage load.
    return null;
  }
}

/** Morning line for MorningGreeting — from stored payload. */
export function banditMorningLine(
  payload: BanditPayload | null | undefined
): string | null {
  const line = payload?.morning?.line?.trim();
  return line || null;
}

/**
 * Resolve Bandit's line for the masthead.
 * Explicit / stored line wins; then provider; then a calm day line —
 * never a cold “coming soon” that breaks the ritual.
 */
export async function resolveBanditGreeting(
  explicit: string | null | undefined,
  context: BanditGreetingContext = {}
): Promise<string> {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;

  if (activeProvider) {
    try {
      const fromProvider = await activeProvider(context);
      if (fromProvider?.trim()) return fromProvider.trim();
    } catch {
      // Fall through to a warm day line.
    }
  }

  return banditDayLine(context.editionDate);
}

/** Future surface helpers — reserved, no new front-page sections. */
export function banditWeeklyLine(
  payload: BanditPayload | null | undefined
): string | null {
  return payload?.weekly?.line?.trim() || null;
}

export function banditSeasonalLine(
  payload: BanditPayload | null | undefined
): string | null {
  return payload?.seasonal?.line?.trim() || null;
}

export function banditHasOccasion(
  payload: BanditPayload | null | undefined,
  occasion: BanditOccasion
): boolean {
  return Boolean(payload?.occasions?.includes(occasion));
}

export const BanditService = {
  name: BANDIT_NAME,
  voice: BANDIT_VOICE,
  parseBanditPayload,
  banditMorningLine,
  banditWeeklyLine,
  banditSeasonalLine,
  banditHasOccasion,
  resolveBanditGreeting,
  setBanditGreetingProvider,
  getBanditGreetingProvider,
};

export default BanditService;
