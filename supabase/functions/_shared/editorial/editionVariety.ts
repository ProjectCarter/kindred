/**
 * Phase 4 — Edition Variety Layer
 * Rotates editorial structure by edition + item seed while preserving facts.
 * Keep in sync with lib/edition/editionVariety.ts
 */

export type OpeningStyle =
  | "observation"
  | "surprising_detail"
  | "local_context"
  | "seasonal_context"
  | "historical_context"
  | "sensory"
  | "practical_question"
  | "recommendation"
  | "comparison"
  | "anecdotal_scene";

export type ClosingStyle =
  | "reflective"
  | "observational"
  | "seasonal"
  | "historical"
  | "practical"
  | "future_looking"
  | "local_tradition"
  | "quiet_emotional";

export type ParagraphLead =
  | "atmosphere_first"
  | "history_first"
  | "practical_first"
  | "unique_first";

const OPENING_STYLES: OpeningStyle[] = [
  "observation",
  "surprising_detail",
  "local_context",
  "seasonal_context",
  "historical_context",
  "sensory",
  "practical_question",
  "recommendation",
  "comparison",
  "anecdotal_scene",
];

const CLOSING_STYLES: ClosingStyle[] = [
  "reflective",
  "observational",
  "seasonal",
  "historical",
  "practical",
  "future_looking",
  "local_tradition",
  "quiet_emotional",
];

const PARAGRAPH_LEADS: ParagraphLead[] = [
  "atmosphere_first",
  "history_first",
  "practical_first",
  "unique_first",
];

const OPENING_GUIDANCE: Record<OpeningStyle, string> = {
  observation: "Open with a calm, specific observation — not the event title.",
  surprising_detail:
    "Open with one surprising verified detail that earns attention.",
  local_context: "Open with how this fits the neighborhood or city rhythm.",
  seasonal_context: "Open with season or timing only when the brief supports it.",
  historical_context:
    "Open with brief historical context only from verified brief facts.",
  sensory: "Open with a sensory detail inferable from category/venue — never invent smells or crowds.",
  practical_question:
    "Open with a practical reader question the piece will honestly answer.",
  recommendation: "Open as a quiet recommendation — never sales language.",
  comparison:
    "Open with a restrained comparison to the usual night out — no invented rivals.",
  anecdotal_scene:
    "Open with a short scene sketch grounded in verified format/venue — not a fictional visitor.",
};

const CLOSING_GUIDANCE: Record<ClosingStyle, string> = {
  reflective: "Close with a reflective line tied to this subject — not a recap.",
  observational: "Close with a quiet observation the reader can picture.",
  seasonal: "Close with seasonal timing only when verified or honestly inferable.",
  historical: "Close with a historical echo only from verified facts.",
  practical: "Close with one practical parting note — hours, timing, or listing reminder.",
  future_looking: "Close looking forward without inventing future attendance or hype.",
  local_tradition: "Close with a local-tradition tone only when category supports it.",
  quiet_emotional: "Close with a restrained emotional note — never sentimental cliché.",
};

const LEAD_ORDER: Record<
  ParagraphLead,
  Array<"atmosphere" | "history" | "practical" | "unique" | "context">
> = {
  atmosphere_first: ["atmosphere", "unique", "context", "practical", "history"],
  history_first: ["history", "context", "atmosphere", "unique", "practical"],
  practical_first: ["practical", "context", "unique", "atmosphere", "history"],
  unique_first: ["unique", "atmosphere", "context", "practical", "history"],
};

export const LAZY_ADJECTIVE_PROMPT =
  "Rotate descriptive vocabulary. Avoid repeating: beautiful, stunning, picturesque, perfect, wonderful, great, amazing, iconic. " +
  "Prefer precise, calm magazine language.";

export const CADENCE_PROMPT =
  "Vary cadence: mix short observations, medium explanation, and longer storytelling paragraphs. " +
  "Avoid opening every paragraph with \"The\", \"This\", or \"It\". " +
  "Use an occasional one-sentence paragraph for emphasis when it earns it.";

export function varietyHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function buildVarietySeed(
  editionDate: string | null | undefined,
  itemKey: string
): string {
  const date = editionDate?.trim() || "undated";
  const key = itemKey.trim() || "item";
  return `${date}:${key}`;
}

export function selectOpeningStyle(seed: string): OpeningStyle {
  return OPENING_STYLES[varietyHash(`${seed}:opening`) % OPENING_STYLES.length]!;
}

export function selectClosingStyle(seed: string): ClosingStyle {
  return CLOSING_STYLES[varietyHash(`${seed}:closing`) % CLOSING_STYLES.length]!;
}

export function selectParagraphLead(seed: string): ParagraphLead {
  return PARAGRAPH_LEADS[varietyHash(`${seed}:lead`) % PARAGRAPH_LEADS.length]!;
}

export function buildEditionVarietyPromptBlock(seed: string): string {
  const opening = selectOpeningStyle(seed);
  const closing = selectClosingStyle(seed);
  const lead = selectParagraphLead(seed);
  return (
    "EDITION VARIETY (same facts, fresh structure):\n" +
    `- Opening style: ${opening.replace(/_/g, " ")} — ${OPENING_GUIDANCE[opening]}\n` +
    `- Paragraph lead: ${lead.replace(/_/g, " ")} — lead with that angle when facts allow.\n` +
    `- Closing style: ${closing.replace(/_/g, " ")} — ${CLOSING_GUIDANCE[closing]}\n` +
    `${CADENCE_PROMPT}\n${LAZY_ADJECTIVE_PROMPT}\n` +
    "Never repeat yesterday's template rhythm. Same verified facts may appear on consecutive editions — write today's structure differently."
  );
}

/** Deterministic middle-paragraph shuffle — preserves first and last when requested. */
export function rotateParagraphOrder(
  paragraphs: string[],
  seed: string,
  options?: { preserveFirst?: boolean; preserveLast?: boolean }
): string[] {
  const cleaned = paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 12);
  if (cleaned.length <= 2) return cleaned;

  const preserveFirst = options?.preserveFirst ?? true;
  const preserveLast = options?.preserveLast ?? true;

  const first = preserveFirst ? cleaned[0]! : null;
  const last = preserveLast ? cleaned[cleaned.length - 1]! : null;
  const start = preserveFirst ? 1 : 0;
  const end = preserveLast ? cleaned.length - 1 : cleaned.length;
  const middle = cleaned.slice(start, end);
  if (middle.length <= 1) {
    return cleaned;
  }

  const shuffled =
    middle.length >= 3
      ? seededShuffle(middle, `${seed}:order`)
      : rotateArray(middle, varietyHash(`${seed}:order`) % middle.length);
  return [
    ...(first ? [first] : []),
    ...shuffled,
    ...(last ? [last] : []),
  ];
}

function rotateArray<T>(items: T[], offset: number): T[] {
  if (!items.length) return items;
  const shift = offset % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  if (out.length <= 1) return out;
  let state = varietyHash(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export type DiscoveryVarietySlot = {
  role: "opening" | "atmosphere" | "why" | "highlights" | "who" | "howLong" |
    "difficulty" | "equipment" | "season" | "tips" | "photo" | "history" | "closing";
  text: string;
};

export function orderDiscoverySlots(
  slots: DiscoveryVarietySlot[],
  seed: string
): string[] {
  const byRole = new Map(slots.map((s) => [s.role, s.text]));
  const opening = byRole.get("opening");
  const closing = byRole.get("closing");
  if (!opening || !closing) {
    return slots.map((s) => s.text);
  }

  const lead = selectParagraphLead(seed);
  const order = LEAD_ORDER[lead];
  const roleBuckets: Record<string, string[]> = {
    atmosphere: [],
    history: [],
    practical: [],
    unique: [],
    context: [],
  };

  const push = (bucket: keyof typeof roleBuckets, text: string | undefined) => {
    if (text?.trim()) roleBuckets[bucket].push(text.trim());
  };

  push("atmosphere", byRole.get("atmosphere"));
  push("unique", byRole.get("highlights"));
  push("unique", byRole.get("why"));
  push("context", byRole.get("who"));
  push("practical", byRole.get("howLong"));
  push("practical", byRole.get("tips"));
  push("practical", byRole.get("difficulty"));
  push("practical", byRole.get("equipment"));
  push("practical", byRole.get("photo"));
  push("history", byRole.get("history"));

  const middle: string[] = [];
  for (const bucket of order) {
    middle.push(...roleBuckets[bucket]);
  }
  const season = byRole.get("season")?.trim();
  if (season && !middle.includes(season)) {
    const insertAt = varietyHash(`${seed}:season`) % (middle.length + 1);
    middle.splice(insertAt, 0, season);
  }

  const deduped: string[] = [];
  for (const p of middle) {
    if (!deduped.some((prev) => prev === p || prev.includes(p) || p.includes(prev))) {
      deduped.push(p);
    }
  }

  return [opening, ...deduped, closing];
}

const PLACE_CLOSINGS: Record<ClosingStyle, string[]> = {
  reflective: [
    "This is the kind of place that quietly becomes part of someone's weekend routine.",
    "Long after you leave, it's often the small detail you noticed first that stays with you.",
  ],
  observational: [
    "The best discoveries are usually the ones you weren't planning to make.",
    "Morning is when this place quietly shines.",
  ],
  seasonal: [
    "The season shifts what people come for — worth noticing on each visit.",
    "Different months bring different reasons to stop; the listing is the honest starting point.",
  ],
  historical: [
    "Places like this often carry more local history than the storefront suggests.",
    "A little context goes a long way — the address is only the beginning.",
  ],
  practical: [
    "Confirm hours before you go; local spots can shift schedules without much notice.",
    "If you're looking for one peaceful stop this week, this is an easy place to begin.",
  ],
  future_looking: [
    "Worth keeping on the list for the next open morning you have.",
    "Most worthwhile local stops reward the visit that happens sooner rather than later.",
  ],
  local_tradition: [
    "Some neighborhoods treat stops like this as a quiet weekly habit.",
    "Regulars tend to find a preferred hour and protect it.",
  ],
  quiet_emotional: [
    "That alone can make the visit worthwhile.",
    "The view — or the room — is often earned, not handed to you.",
  ],
};

export function closingLineForVariety(
  title: string,
  seed: string,
  style?: ClosingStyle
): string {
  const resolved = style ?? selectClosingStyle(seed);
  const options = PLACE_CLOSINGS[resolved];
  const idx = varietyHash(`${seed}:${title}:${resolved}`) % options.length;
  return options[idx]!;
}

export function applyEditionVarietyToBody(
  paragraphs: string[],
  seed: string
): string[] {
  if (paragraphs.length <= 2) return paragraphs;
  return rotateParagraphOrder(paragraphs, seed, {
    preserveFirst: false,
    preserveLast: true,
  });
}
