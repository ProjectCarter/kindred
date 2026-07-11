import { BRIEFING_WORD_TARGETS } from "./voice.ts";
import type {
  MorningBriefing,
  MorningBriefingLength,
  MorningEditionBeats,
  MorningEditionComposeInput,
} from "./types.ts";

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function paragraphsFrom(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function makeBriefing(
  length: MorningBriefingLength,
  text: string
): MorningBriefing {
  const cleaned = text
    .replace(/!+/g, ".")
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
  const paragraphs = paragraphsFrom(cleaned);
  const joined = paragraphs.join("\n\n");
  return {
    length,
    text: joined,
    paragraphs,
    estimatedSeconds: BRIEFING_WORD_TARGETS[length].seconds,
    wordCount: wordCount(joined),
  };
}

function pick(
  beats: MorningEditionBeats,
  keys: Array<keyof MorningEditionBeats>
): string[] {
  return keys.map((k) => beats[k]).filter((v): v is string => Boolean(v));
}

/**
 * Deterministic 20-second opening — ritual welcome + lead why.
 */
export function composeOpening20s(
  beats: MorningEditionBeats,
  _input: MorningEditionComposeInput
): MorningBriefing {
  const parts = pick(beats, [
    "welcome",
    "leadWhy",
    "weekendTone",
    "bandit",
  ]);
  // Prefer welcome + lead; fall back to bandit spirit without duplicating fully.
  let text: string;
  if (beats.welcome && beats.leadWhy) {
    text = `${beats.welcome} ${beats.leadWhy}`;
  } else if (beats.bandit && beats.leadWhy) {
    text = `${beats.bandit} ${beats.leadWhy}`;
  } else {
    text =
      parts.slice(0, 2).join(" ") ||
      "Your morning edition is ready — curated with care.";
  }
  if (beats.weather && wordCount(text) < 45) {
    text = `${text} ${beats.weather}`;
  }
  return makeBriefing("opening_20s", text);
}

/**
 * Deterministic 60-second briefing — explains the edition, not a headline dump.
 */
export function composeBriefing60s(
  beats: MorningEditionBeats,
  input: MorningEditionComposeInput
): MorningBriefing {
  const chunks = pick(beats, [
    "welcome",
    "leadWhy",
    "overnight",
    "continuing",
    "balance",
    "weather",
    "local",
    "discoveries",
  ]);

  let text = chunks.slice(0, 6).join(" ");
  if (!text) {
    text =
      "Today’s paper opens with a carefully chosen lead and a balanced slate. " +
      "Read slowly — the desk built this edition to teach as well as inform.";
  }

  const interests = input.personalization?.interests?.slice(0, 2) ?? [];
  if (interests.length && !/interest/i.test(text)) {
    text += ` Threads touching ${interests.join(" and ")} appear where they earned the page.`;
  }

  return makeBriefing("briefing_60s", text);
}

/**
 * Deterministic 3-minute overview — full editorial walkthrough for audio.
 */
export function composeOverview3m(
  beats: MorningEditionBeats,
  input: MorningEditionComposeInput
): MorningBriefing {
  const paras: string[] = [];

  const open =
    beats.welcome ||
    beats.bandit ||
    "Welcome to today’s Kindred edition — assembled the way a careful newspaper still does.";
  paras.push(open);

  if (beats.weekendTone || beats.seasonal) {
    paras.push(
      [beats.weekendTone, beats.seasonal].filter(Boolean).join(" ")
    );
  }

  if (beats.leadWhy) {
    paras.push(
      `${beats.leadWhy}` +
        (input.lead?.summary
          ? ` In short: ${input.lead.summary.slice(0, 220)}`
          : "")
    );
  }

  if (beats.overnight) paras.push(beats.overnight);
  if (beats.continuing || beats.memory) {
    paras.push(beats.continuing || beats.memory || "");
  }

  if (beats.balance) {
    paras.push(beats.balance);
  }

  const tops = (input.topStoryHeadlines ?? []).slice(0, 3);
  if (tops.length) {
    paras.push(
      `Below the lead, the slate includes ${tops
        .map((t) => `“${t.slice(0, 80)}”`)
        .join("; ")} — chosen for balance, not volume.`
    );
  }

  if (beats.knowledge) paras.push(beats.knowledge);
  if (beats.weather) paras.push(beats.weather);
  if (beats.local) paras.push(beats.local);
  if (beats.discoveries) {
    paras.push(
      `${beats.discoveries} These are editorial recommendations, not a feed.`
    );
  }

  if (input.onThisDay) {
    paras.push(
      `Today in history: in ${input.onThisDay.year}, ${input.onThisDay.text.slice(0, 180)}`
    );
  }

  paras.push(
    "That is the shape of this morning’s paper — calm, intentional, ready when you are."
  );

  return makeBriefing("overview_3m", paras.filter(Boolean).join("\n\n"));
}

export function composeAllBriefings(
  beats: MorningEditionBeats,
  input: MorningEditionComposeInput
): Record<MorningBriefingLength, MorningBriefing> {
  return {
    opening_20s: composeOpening20s(beats, input),
    briefing_60s: composeBriefing60s(beats, input),
    overview_3m: composeOverview3m(beats, input),
  };
}
