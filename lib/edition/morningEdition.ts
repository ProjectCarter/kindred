import type { MorningHeroExperience } from "./heroArtwork/types";
import { normalizeMorningHeroExperience } from "./heroArtwork/normalize";
import {
  masterpieceTraceBegin,
  masterpieceTraceEnd,
} from "./masterpieceDiagnostics";

/**
 * Client mirror — Morning Edition AI contracts.
 * Generation runs at edition build; every future channel reads this payload.
 * Audio, widgets, notifications, Watch, Auto, CarPlay, voice assistants
 * should all call requestMorningBriefing() — never invent a parallel intro.
 */

export type MorningBriefingLength =
  | "opening_20s"
  | "briefing_60s"
  | "overview_3m";

export type MorningEditionChannel =
  | "audio"
  | "widget"
  | "notification"
  | "lock_screen"
  | "watch"
  | "android_auto"
  | "carplay"
  | "voice_assistant"
  | "in_app";

export type MorningBriefing = {
  length: MorningBriefingLength;
  text: string;
  paragraphs: string[];
  estimatedSeconds: number;
  wordCount: number;
};

export type MorningEditionBeats = {
  welcome: string | null;
  leadWhy: string | null;
  overnight: string | null;
  continuing: string | null;
  balance: string | null;
  local: string | null;
  weather: string | null;
  seasonal: string | null;
  weekendTone: string | null;
  discoveries: string | null;
  knowledge: string | null;
  memory: string | null;
  bandit: string | null;
};

export type MorningEditionPayload = {
  version: 1;
  generatedAt: string;
  editionDate: string;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
  };
  banditLine: string | null;
  beats: MorningEditionBeats;
  briefings: Record<MorningBriefingLength, MorningBriefing>;
  defaultLength: MorningBriefingLength;
  channelHints: MorningEditionChannel[];
  editorBrief: string;
  selectionMeta: {
    usedEngines: string[];
    polishedWithAi: boolean;
    editorNotes: string[];
  };
  /** Frozen daily public-domain hero — artwork + editorial paragraph. */
  morningHero?: MorningHeroExperience | null;
};

/** Suggested length per delivery channel. */
export const CHANNEL_DEFAULT_LENGTH: Record<
  MorningEditionChannel,
  MorningBriefingLength
> = {
  notification: "opening_20s",
  lock_screen: "opening_20s",
  watch: "opening_20s",
  widget: "opening_20s",
  voice_assistant: "briefing_60s",
  android_auto: "briefing_60s",
  carplay: "briefing_60s",
  audio: "overview_3m",
  in_app: "briefing_60s",
};

export function parseMorningHeroExperience(
  value: unknown
): MorningHeroExperience | null {
  if (!value || typeof value !== "object") return null;
  masterpieceTraceBegin("parser/morningHero");
  const started = Date.now();
  try {
    const parsed = normalizeMorningHeroExperience(
      value as Partial<MorningHeroExperience> & { attributionText?: string | null }
    );
    masterpieceTraceEnd("parser/morningHero", {
      ms: Date.now() - started,
      ok: Boolean(parsed),
    });
    return parsed;
  } catch (error) {
    masterpieceTraceEnd("parser/morningHero", {
      ms: Date.now() - started,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    if (__DEV__) {
      console.warn("[morningHero:parser] normalize failed — dropping hero", error);
    }
    return null;
  }
}

function morningHeroFromRawMorningEdition(
  value: unknown
): MorningHeroExperience | null {
  if (!value || typeof value !== "object") return null;

  const payload = parseMorningEditionPayload(value);
  if (payload?.morningHero) {
    return parseMorningHeroExperience(payload.morningHero);
  }

  // Staged city builds persist a compact { morningHero, heroArtworkId } snapshot
  // without the full MorningEditionPayload (version + briefings).
  if ("morningHero" in value) {
    return parseMorningHeroExperience(
      (value as { morningHero?: unknown }).morningHero
    );
  }

  return null;
}

export function morningHeroFromEdition(
  edition: { morning_edition?: unknown; morningEdition?: unknown } | null | undefined
): MorningHeroExperience | null {
  return morningHeroFromRawMorningEdition(
    edition?.morning_edition ?? edition?.morningEdition
  );
}

export function parseMorningEditionPayload(
  value: unknown
): MorningEditionPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<MorningEditionPayload>;
  if (raw.version !== 1 || !raw.briefings) return null;
  return raw as MorningEditionPayload;
}

/**
 * Primary API — request a briefing length for any future surface.
 */
export function requestMorningBriefing(
  edition: { morning_edition?: unknown; morningEdition?: unknown } | null | undefined,
  length?: MorningBriefingLength | null,
  channel?: MorningEditionChannel | null
): MorningBriefing | null {
  const payload = parseMorningEditionPayload(
    edition?.morning_edition ?? edition?.morningEdition
  );
  if (!payload) return null;

  const resolved =
    length ??
    (channel ? CHANNEL_DEFAULT_LENGTH[channel] : null) ??
    payload.defaultLength ??
    "briefing_60s";

  return payload.briefings[resolved] ?? null;
}

export function morningEditionBeats(
  edition: { morning_edition?: unknown; morningEdition?: unknown } | null | undefined
): MorningEditionBeats | null {
  return parseMorningEditionPayload(
    edition?.morning_edition ?? edition?.morningEdition
  )?.beats ?? null;
}

export function morningEditionText(
  edition: { morning_edition?: unknown } | null | undefined,
  length?: MorningBriefingLength,
  channel?: MorningEditionChannel
): string | null {
  return requestMorningBriefing(edition, length, channel)?.text ?? null;
}

export const MorningEditionService = {
  parseMorningEditionPayload,
  requestMorningBriefing,
  morningEditionBeats,
  morningEditionText,
  CHANNEL_DEFAULT_LENGTH,
};

export default MorningEditionService;
