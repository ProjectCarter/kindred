import type {
  MorningEditionBeats,
  MorningEditionComposeInput,
} from "./types.ts";

/**
 * "2026-07-13" -> "Monday, July 13" — the masthead's own date style, never a
 * spelled-out ordinal. Feeding the AI an already-natural date (instead of the
 * raw ISO string) removes any temptation to invent its own formatting.
 */
function naturalEditionDateLabel(editionDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(editionDate);
  if (!match) return editionDate;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return editionDate;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Rewrites our own deterministic weather summary ("Current 106°F in Phoenix;
 * high 106°F / low 78°F; plenty of sunshine.") into one flowing clause
 * instead of a data readout. Used both as AI grounding and as the no-AI
 * fallback sentence itself.
 */
function naturalizeWeatherBeat(summary: string, city?: string | null): string {
  const match =
    /^Current\s+([\d.]+°[CF])\s+in\s+([^;.]+?)(?:;\s*high\s+([\d.]+°[CF])\s*\/\s*low\s+([\d.]+°[CF]))?(?:;\s*([^;.]+?))?\.?$/.exec(
      summary.trim()
    );
  if (!match) return `Weather for the day: ${summary.slice(0, 140)}`;
  const [, current, place, high, low, condition] = match;
  const where = place?.trim() || city?.trim() || "your area";
  const conditionClause = condition ? `, with ${condition.trim()}` : "";
  if (high && low) {
    return `Expect a high near ${high} and a low near ${low} in ${where} today${conditionClause}.`;
  }
  return `Currently ${current} in ${where}${conditionClause}.`;
}

function nameAddress(firstName?: string | null): string | null {
  const n = firstName?.trim().split(/\s+/)[0];
  return n || null;
}

function leadWhyLine(input: MorningEditionComposeInput): string | null {
  const lead = input.lead;
  if (!lead?.headline) return null;

  const reason = lead.reasons
    ?.filter((r) => !r.code.startsWith("role_") && r.weight > 0)
    .sort((a, b) => b.weight - a.weight)[0];

  const role = lead.role ?? "national";
  const rolePhrase =
    role === "local"
      ? "because it matters close to home"
      : role === "breaking"
      ? "as a developing story the desk judged front-page worthy"
      : role === "feature"
      ? "for tonal balance — not only hard news"
      : role === "interest"
      ? "because it fits your long-term interests while still earning the page"
      : "as the day’s most significant story";

  const why = reason?.label
    ? reason.label.replace(/\.$/, "")
    : rolePhrase;

  return `We led with “${lead.headline.slice(0, 100)}” ${why}.`;
}

function balanceLine(input: MorningEditionComposeInput): string | null {
  const notes = input.editorialNotes?.slice(0, 3) ?? [];
  const signals = input.signals;
  const parts: string[] = [];

  if (input.modeLabel) {
    parts.push(input.modeLabel);
  }
  if (signals?.geoBalance) {
    parts.push("local and wider world in balance");
  }
  if (signals?.sourceDiversity) {
    parts.push("varied sources across the slate");
  }
  if (signals?.topicDiversity) {
    parts.push("topics kept from clustering");
  }
  if (notes.length) {
    parts.push(notes[0]);
  }
  if (!parts.length) return null;
  return `Today’s editorial balance: ${parts.slice(0, 3).join("; ")}.`;
}

function continuingLine(input: MorningEditionComposeInput): string | null {
  if (input.sinceYouLastRead?.summary) {
    return input.sinceYouLastRead.summary;
  }
  if ((input.continuityDays ?? 0) >= 3) {
    return "This morning continues a quiet reading rhythm across recent editions.";
  }
  const unfinished = input.unfinishedTitles?.[0];
  if (unfinished) {
    return `You left off mid-read on “${unfinished.slice(0, 80)}” — it’s still waiting if you want it.`;
  }
  return null;
}

function overnightLine(input: MorningEditionComposeInput): string | null {
  if (input.signals?.hasBreakingNews) {
    return "Overnight developments earned a careful place on the front — calm coverage, not alarm.";
  }
  if (input.lead?.strategy === "breaking") {
    return "The desk watched overnight wires and still chose a measured lead.";
  }
  if (input.onThisDay) {
    return `History’s quiet note: in ${input.onThisDay.year}, ${input.onThisDay.text.slice(0, 120)}`;
  }
  return null;
}

function localLine(input: MorningEditionComposeInput): string | null {
  const events = input.localEvents ?? [];
  if (!events.length && !input.signals?.hasLocalEvents) return null;
  if (events.length) {
    const names = events
      .slice(0, 2)
      .map((e) => e.name)
      .join("; ");
    return `Nearby: ${names}.`;
  }
  return "A few local notes are in today’s paper.";
}

function weatherLine(input: MorningEditionComposeInput): string | null {
  if (!input.weatherSummary) return null;
  const s = input.weatherSummary.toLowerCase();
  if (/rain|shower|storm|drizzle/.test(s)) {
    return "The weather invites a slower morning with the paper.";
  }
  if (input.signals?.weatherChange) {
    return "A shift in the weather ahead — worth a glance at Looking Ahead.";
  }
  return naturalizeWeatherBeat(input.weatherSummary, input.location.city);
}

function weekendLine(input: MorningEditionComposeInput): string | null {
  if (input.isSunday) {
    return "Sunday tone — unhurried, with room for curiosity beyond the hard news.";
  }
  if (input.isWeekend) {
    return "Weekend edition — a lighter editorial pace without losing substance.";
  }
  return "Weekday desk — clear priorities, measured pace.";
}

function seasonalLine(input: MorningEditionComposeInput): string | null {
  if (input.signals?.holidayTomorrow) {
    return `${input.signals.holidayTomorrow} is tomorrow — the paper keeps a quiet eye on the calendar.`;
  }
  if (input.seasonHint) {
    return input.seasonHint;
  }
  return null;
}

function discoveriesLine(input: MorningEditionComposeInput): string | null {
  const picks = input.discoveryPicks ?? [];
  if (!picks.length) return null;
  const top = picks.slice(0, 2).map((p) => p.title);
  return `Quiet discoveries today include ${top.join(" and ")}.`;
}

function knowledgeLine(input: MorningEditionComposeInput): string | null {
  const h = input.knowledgeHighlights?.[0];
  if (!h) return null;
  if (h.facetType === "why_this_matters") {
    return `Context on the lead: ${h.why.slice(0, 140)}`;
  }
  return `Background ready beside the reporting — ${h.facetType.replace(/_/g, " ")} for “${h.headline.slice(0, 60)}”.`;
}

function memoryLine(input: MorningEditionComposeInput): string | null {
  return continuingLine(input);
}

function welcomeLine(input: MorningEditionComposeInput): string | null {
  const name = nameAddress(input.reader?.firstName);
  const city =
    input.location.city && input.location.city !== "your area"
      ? input.location.city
      : null;
  if (name && city) {
    return `${name}, today’s Kindred edition for ${city} is ready.`;
  }
  if (name) {
    return `${name}, today’s edition is ready when you are.`;
  }
  if (city) {
    return `Today’s Kindred edition for ${city} is ready.`;
  }
  return "Today’s edition is ready when you are.";
}

/**
 * Assemble editorial beats from all Kindred engines.
 * Beats are the editor’s notes; prose composers speak from them.
 */
export function buildMorningEditionBeats(
  input: MorningEditionComposeInput
): MorningEditionBeats {
  return {
    welcome: welcomeLine(input),
    leadWhy: leadWhyLine(input),
    overnight: overnightLine(input),
    continuing: continuingLine(input),
    balance: balanceLine(input),
    local: localLine(input),
    weather: weatherLine(input),
    seasonal: seasonalLine(input),
    weekendTone: weekendLine(input),
    discoveries: discoveriesLine(input),
    knowledge: knowledgeLine(input),
    memory: memoryLine(input),
    bandit: input.banditLine?.trim() || null,
  };
}

/**
 * Compact grounding string for Claude polish / future audio writers.
 */
export function buildMorningEditionGrounding(
  input: MorningEditionComposeInput,
  beats: MorningEditionBeats
): string {
  const lines: string[] = [
    `Edition date: ${naturalEditionDateLabel(input.editionDate)}`,
    `Mode: ${input.modeLabel ?? input.editionMode ?? "weekday"}`,
    `City: ${input.location.city ?? "unknown"}`,
  ];

  if (input.reader?.firstName) {
    lines.push(`Reader first name: ${input.reader.firstName}`);
  }
  if (input.weatherSummary) {
    lines.push(`Weather: ${input.weatherSummary}`);
  }
  if (input.banditLine) {
    lines.push(`Bandit greeting: ${input.banditLine}`);
  }

  for (const [key, value] of Object.entries(beats)) {
    if (value) lines.push(`Beat.${key}: ${value}`);
  }

  if (input.topStoryHeadlines?.length) {
    lines.push(
      `Top stories (do not merely list): ${input.topStoryHeadlines
        .slice(0, 4)
        .join(" | ")}`
    );
  }
  if (input.editorBrief) {
    lines.push(`Editor brief: ${input.editorBrief.slice(0, 600)}`);
  }
  if (input.memoryBrief) {
    lines.push(`Memory: ${input.memoryBrief.slice(0, 400)}`);
  }
  if (input.knowledgeBrief) {
    lines.push(`Knowledge: ${input.knowledgeBrief.slice(0, 400)}`);
  }
  if (input.discoveryBrief) {
    lines.push(`Discovery: ${input.discoveryBrief.slice(0, 400)}`);
  }
  if (input.personalization?.interests?.length) {
    lines.push(
      `Interests: ${input.personalization.interests.slice(0, 4).join(", ")}`
    );
  }

  return lines.join("\n");
}

export function usedEngines(input: MorningEditionComposeInput): string[] {
  const engines = ["editorial"];
  if (input.personalization) engines.push("personalization");
  if (input.discoveryPicks?.length || input.discoveryBrief) {
    engines.push("discovery");
  }
  if (input.knowledgeHighlights?.length || input.knowledgeBrief) {
    engines.push("knowledge");
  }
  if (
    input.sinceYouLastRead ||
    input.memoryBrief ||
    (input.continuityDays ?? 0) > 0
  ) {
    engines.push("memory");
  }
  if (input.banditLine) engines.push("bandit");
  return engines;
}
