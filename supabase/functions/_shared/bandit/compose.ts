import { detectBanditOccasions } from "./occasions.ts";
import { composeBanditWeatherLine } from "./morningLineTemplates.ts";
import { moodFromTempC } from "../editorialTemplates.ts";
import type {
  BanditComposeInput,
  BanditMoment,
  BanditPayload,
} from "./types.ts";

function namePrefix(firstName?: string | null): string {
  const n = firstName?.trim();
  if (!n) return "";
  // First token only — keep it intimate, not formal.
  const first = n.split(/\s+/)[0];
  return first ? `${first}, ` : "";
}

/**
 * One short, deterministic weather-mood line — never a raw temperature,
 * never two sentences. See morningLineTemplates.ts for why this replaced
 * an AI polish pass that kept drifting into overly literary territory.
 */
function weatherHint(input: BanditComposeInput): string {
  const tempC = input.weather?.currentTempC ?? null;
  const mood = tempC != null ? moodFromTempC(tempC) : null;
  return composeBanditWeatherLine({
    editionDate: input.editionDate,
    userId: input.userId ?? "anonymous",
    mood,
    hasLocalEvents: input.signals?.hasLocalEvents,
  });
}

/**
 * Deterministic Bandit lines — the only path now (no AI polish; see
 * generate.ts for why).
 */
export function composeMorningLine(
  input: BanditComposeInput,
  occasions = detectBanditOccasions(input)
): string {
  const name = namePrefix(input.reader.firstName);
  const city = input.location.city;

  if (occasions.isBirthday) {
    if (name) {
      return `${name}happy birthday. I saved the front page for you.`;
    }
    return "Happy birthday. I saved the front page for you.";
  }

  if (occasions.isTraveling) {
    const where =
      input.reader.travel?.city?.trim() ||
      (city && city !== "your area" ? city : null);
    if (where) {
      return `${name}welcome to ${where}. Your paper found you.`.replace(
        /^,\s*/,
        ""
      );
    }
    return `${name}you're away — the paper still knows where to find you.`.replace(
      /^,\s*/,
      ""
    );
  }

  if (occasions.holidayName) {
    return `${name}a quiet ${occasions.holidayName}. The paper can wait with you.`.replace(
      /^,\s*/,
      ""
    );
  }

  if (occasions.isSeasonTurn) {
    const seasonLabel =
      occasions.season === "autumn" ? "fall" : occasions.season;
    return `${name}the first light of ${seasonLabel}. A morning worth reading slowly.`.replace(
      /^,\s*/,
      ""
    );
  }

  if (occasions.primary === "weekly") {
    return `${name}Sunday. I set aside a few quiet recommendations for the week ahead.`.replace(
      /^,\s*/,
      ""
    );
  }

  // One short sentence, deterministically rotated — weather-mood aware when
  // real data exists, a friendly generic line otherwise. Bandit never
  // stacks a weather clause and an events clause into two sentences.
  return `${name}${weatherHint(input)}`.replace(/^,\s*/, "");
}

export function composeWeeklyMoment(
  input: BanditComposeInput,
  generatedAt: string
): BanditMoment | null {
  const date = input.editionDate;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(
        Number(date.slice(0, 4)),
        Number(date.slice(5, 7)) - 1,
        Number(date.slice(8, 10))
      )
    : new Date();
  if (d.getDay() !== 0) return null;

  const interests = input.signals?.primaryInterests?.slice(0, 2) ?? [];
  const sources = input.personalization?.favoriteSources?.slice(0, 2) ?? [];
  const notes: string[] = [
    "Weekly recommendations reserved for Bandit — not a new front-page section.",
  ];
  if (interests.length) {
    notes.push(`Lean into interests: ${interests.join(", ")}`);
  }
  if (sources.length) {
    notes.push(`Favorite sources: ${sources.join(", ")}`);
  }
  for (const pick of (input.discoveryPicks ?? []).slice(0, 4)) {
    notes.push(`Pick: ${pick.title} (${pick.category}) — ${pick.why}`);
  }
  if (input.discoveryBrief) {
    notes.push(input.discoveryBrief.slice(0, 400));
  }

  const pickTitles = (input.discoveryPicks ?? [])
    .slice(0, 2)
    .map((p) => p.title);
  const line = pickTitles.length
    ? `This week I saved a few quiet picks — starting with ${pickTitles[0]}.`
    : "This week, follow what feels curious — not what feels loud.";

  return {
    kind: "weekly_recommendation",
    occasion: "weekly",
    line,
    notes,
    generatedAt,
  };
}

export function composeSeasonalMoment(
  input: BanditComposeInput,
  occasions = detectBanditOccasions(input),
  generatedAt: string
): BanditMoment | null {
  if (!occasions.isSeasonTurn && !occasions.holidayName) return null;

  if (occasions.holidayName) {
    return {
      kind: "special_edition",
      occasion: "special_edition",
      line: `A special edition morning for ${occasions.holidayName}.`,
      notes: [`holiday:${occasions.holidayName}`],
      generatedAt,
    };
  }

  const seasonLabel =
    occasions.season === "autumn" ? "fall" : occasions.season;
  return {
    kind: "seasonal_message",
    occasion: "seasonal",
    line: `${seasonLabel.charAt(0).toUpperCase()}${seasonLabel.slice(1)} arrives quietly.`,
    notes: [`season:${occasions.season}`],
    generatedAt,
  };
}

export function composeEditorialNotes(
  input: BanditComposeInput,
  occasions = detectBanditOccasions(input)
): string[] {
  const notes: string[] = [];
  if (occasions.isBirthday) notes.push("Birthday special edition");
  if (occasions.isTraveling) notes.push("Travel-aware greeting");
  if (occasions.holidayName) {
    notes.push(`Holiday: ${occasions.holidayName}`);
  }
  if (input.signals?.hasBreakingNews) {
    notes.push("Breaking news present — keep Bandit calm, not urgent");
  }
  if (input.signals?.hasLocalEvents) {
    notes.push("Local events available to mention softly");
  }
  if ((input.personalization?.confidence ?? 0) > 0.4) {
    notes.push("Personalization confidence moderate — may reference tastes lightly");
  }
  return notes;
}

/**
 * Build the full BanditPayload without AI — always succeeds.
 */
export function composeBanditPayload(
  input: BanditComposeInput,
  morningLine?: string
): BanditPayload {
  const generatedAt = (input.now ?? new Date()).toISOString();
  const occasions = detectBanditOccasions(input);
  const line = (morningLine?.trim() || composeMorningLine(input, occasions))
    .replace(/!+/g, ".")
    .trim();

  const morningKind =
    occasions.primary === "birthday"
      ? "birthday"
      : occasions.primary === "travel"
      ? "travel"
      : occasions.primary === "special_edition"
      ? "special_edition"
      : occasions.primary === "seasonal"
      ? "seasonal_message"
      : "morning_greeting";

  return {
    version: 1,
    morning: {
      kind: morningKind,
      occasion: occasions.primary,
      line,
      notes: composeEditorialNotes(input, occasions),
      generatedAt,
    },
    weekly: composeWeeklyMoment(input, generatedAt),
    seasonal: composeSeasonalMoment(input, occasions, generatedAt),
    editorialNotes: composeEditorialNotes(input, occasions),
    occasions: occasions.all,
    pick: input.pick ?? null,
  };
}

export function buildBanditGrounding(input: BanditComposeInput): string {
  const occasions = detectBanditOccasions(input);
  const lines = [
    `Edition date: ${input.editionDate}`,
    `Primary occasion: ${occasions.primary}`,
    `Occasions: ${occasions.all.join(", ")}`,
    `Reader first name: ${input.reader.firstName?.trim() || "(none)"}`,
    `Birthday today: ${occasions.isBirthday ? "yes" : "no"}`,
    `Traveling: ${occasions.isTraveling ? "yes" : "no"}`,
    `City: ${input.location.city ?? "(unknown)"}`,
    `Holiday: ${occasions.holidayName ?? "none"}`,
    `Season: ${occasions.season}${occasions.isSeasonTurn ? " (turning today)" : ""}`,
    `Weather summary: ${input.weatherSummary?.trim() || "(none)"}`,
    `Has local events: ${input.signals?.hasLocalEvents ? "yes" : "no"}`,
    `Weather change ahead: ${input.signals?.weatherChange ? "yes" : "no"}`,
    `Holiday tomorrow: ${input.signals?.holidayTomorrow ?? "none"}`,
    `Interests: ${(input.signals?.primaryInterests ?? []).join(", ") || "none"}`,
  ];
  if (input.editorBrief) {
    lines.push(`Editor brief (excerpt):\n${input.editorBrief.slice(0, 600)}`);
  }
  return lines.join("\n");
}
