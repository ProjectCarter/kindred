export type {
  EditorialNote,
  EditorialNoteCategory,
  SectionEditorialNotes,
  EditionEditorialContext,
  BuildEditorialContextInput,
} from "./types.ts";

export { buildEditionEditorialContext } from "./buildEditorialContext.ts";

/**
 * AI entry points — consume EditionEditorialContext without UI.
 * Bandit, Weekly Picks, why-this-story, and audio intros.
 */
export type EditorialAIUseCase =
  | "bandit_greeting"
  | "weekly_picks"
  | "why_this_story"
  | "personalized_recommendations"
  | "audio_introduction";

export function editorialContextForAI(
  context: import("./types.ts").EditionEditorialContext,
  useCase: EditorialAIUseCase
): {
  editorBrief: string;
  signals: import("./types.ts").EditionEditorialContext["signals"];
  sections: import("./types.ts").EditionEditorialContext["sections"];
  focus: string[];
} {
  const signals = context.signals;
  const sections = context.sections;

  switch (useCase) {
    case "bandit_greeting": {
      const focus = [
        "Keep Bandit to one or two calm sentences.",
        signals.hasLocalEvents ? "Local events available — mention softly if at all." : "",
        signals.weatherChange ? "Weather is shifting — a gentle nod is enough." : "",
        signals.holidayTomorrow
          ? `Holiday tomorrow: ${signals.holidayTomorrow}.`
          : "",
        signals.hasBreakingNews
          ? "Breaking news is in the paper — Bandit stays calm, not urgent."
          : "",
        sections.some((s) => s.sectionType === "memory")
          ? "Memory available — relationship continuity only; never mention streaks or scores."
          : "",
      ].filter(Boolean);
      return {
        editorBrief: context.editorBrief,
        signals,
        sections: sections.filter((s) =>
          ["greeting", "weather", "local_events", "looking_ahead", "memory"].includes(
            s.sectionType
          )
        ),
        focus,
      };
    }
    case "weekly_picks":
      return {
        editorBrief: context.editorBrief,
        signals,
        sections: sections.filter((s) =>
          ["top_stories", "local_events", "discovery"].includes(s.sectionType)
        ),
        focus: [
          "Weekly recommendations — curious, not loud.",
          "Use discovery picks and local events as editorial suggestions.",
          `Interests: ${signals.primaryInterests.join(", ") || "none"}`,
        ],
      };
    case "personalized_recommendations":
      return {
        editorBrief: context.editorBrief,
        signals,
        sections: sections.filter((s) =>
          ["discovery", "local_events", "top_stories"].includes(s.sectionType)
        ),
        focus: [
          "Personalized, never pushy — magazine desk voice.",
          `Primary interests: ${signals.primaryInterests.join(", ") || "none"}`,
        ],
      };
    case "why_this_story":
      return {
        editorBrief: context.editorBrief,
        signals,
        sections: sections.filter((s) =>
          ["top_stories", "knowledge", "memory"].includes(s.sectionType)
        ),
        focus: [
          "Explain selection calmly — never mention scores or algorithms.",
          "Use knowledge facets (why this matters, history, related coverage) when present.",
          "Use memory only for continuity (“continuing coverage”, unfinished reading) — never as a retention hook.",
        ],
      };
    case "audio_introduction":
      return {
        editorBrief: context.editorBrief,
        signals,
        sections: sections.filter((s) =>
          [
            "greeting",
            "morning_edition",
            "top_stories",
            "weather",
            "memory",
          ].includes(s.sectionType)
        ),
        focus: [
          "Spoken intro — short, warm, newspaper-like.",
          "Prefer Morning Edition beats when present — explain choices, do not list every headline.",
        ],
      };
    default:
      return {
        editorBrief: context.editorBrief,
        signals,
        sections,
        focus: [],
      };
  }
}
