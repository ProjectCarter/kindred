import { composeAllBriefings } from "./compose.ts";
import {
  buildMorningEditionBeats,
  buildMorningEditionGrounding,
  usedEngines,
} from "./grounding.ts";
import { polishMorningBriefings } from "./polish.ts";
import type {
  MorningEditionComposeInput,
  MorningEditionPayload,
} from "./types.ts";

/**
 * Morning Edition AI entry point — reusable for every future channel.
 * Composes 20s / 60s / 3m briefings from all Kindred engines.
 * Never redesigns the newspaper or adds sections.
 */
export async function runMorningEditionDecisions(
  input: MorningEditionComposeInput,
  apiKey?: string | null
): Promise<MorningEditionPayload> {
  const now = input.now ?? new Date();
  const beats = buildMorningEditionBeats(input);
  const grounding = buildMorningEditionGrounding(input, beats);
  const engines = usedEngines(input);

  const { briefings, polishedWithAi } = apiKey
    ? await polishMorningBriefings(grounding, beats, input, apiKey)
    : {
        briefings: composeAllBriefings(beats, input),
        polishedWithAi: false,
      };

  const editorBrief = [
    `Morning Edition brief for ${input.editionDate}.`,
    `Engines: ${engines.join(", ")}.`,
    beats.leadWhy ?? "No lead story beat.",
    beats.balance ?? "",
    beats.continuing ?? "",
    `Default length: briefing_60s. Channels: audio, widget, notification, watch, auto.`,
  ]
    .filter(Boolean)
    .join("\n");

  const payload: MorningEditionPayload = {
    version: 1,
    generatedAt: now.toISOString(),
    editionDate: input.editionDate,
    location: {
      city: input.location.city,
      region: input.location.region ?? null,
      state: input.location.state ?? null,
    },
    banditLine: input.banditLine ?? null,
    beats,
    briefings,
    defaultLength: "briefing_60s",
    channelHints: [
      "audio",
      "widget",
      "notification",
      "lock_screen",
      "watch",
      "android_auto",
      "carplay",
      "voice_assistant",
      "in_app",
    ],
    editorBrief,
    selectionMeta: {
      usedEngines: engines,
      polishedWithAi,
      editorNotes: [
        "Calm editor voice — explains choices, does not dump headlines.",
        "Reusable for voice, audio, widgets, and assistants.",
        "No new newspaper sections; payload is invisible until a surface ships.",
      ],
    },
  };

  console.log("[morningEdition] decisions", {
    engines,
    polishedWithAi,
    openingWords: briefings.opening_20s.wordCount,
    briefingWords: briefings.briefing_60s.wordCount,
    overviewWords: briefings.overview_3m.wordCount,
    hasLead: Boolean(beats.leadWhy),
    hasMemory: Boolean(beats.continuing || beats.memory),
  });

  return payload;
}
