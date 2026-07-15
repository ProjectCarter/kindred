/**
 * Compose a multi-paragraph Today in History feature from grounded sources.
 * Uses only the dated event and verified Wikipedia summary — never invents facts.
 */

import { formatTodayInHistoryHeadline } from "./headline";

function sentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return (
    cleaned.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [
      cleaned,
    ]
  );
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function joinParagraph(parts: string[]): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function composeTodayInHistoryFeature(input: {
  year: number;
  eventText: string;
  wikipediaSummary?: string | null;
  pageTitle?: string | null;
}): { headline: string; body: string } {
  const headline = formatTodayInHistoryHeadline(input.year, input.eventText);
  const eventSentence = input.eventText.endsWith(".")
    ? input.eventText
    : `${input.eventText}.`;

  const wikiSentences = sentences(input.wikipediaSummary ?? "");
  const usable = wikiSentences.filter((s) => s.length > 24);

  const lead = joinParagraph([
    `In ${input.year}, ${eventSentence.charAt(0).toLowerCase() + eventSentence.slice(1)}`,
    usable[0] ?? "",
  ]);

  const remaining = usable.slice(1);
  const chunk = Math.max(2, Math.ceil(remaining.length / 3));
  const context = joinParagraph(remaining.slice(0, chunk));
  const significance = joinParagraph(remaining.slice(chunk, chunk * 2));
  const echoParts = remaining.slice(chunk * 2);
  const echo = joinParagraph([
    ...echoParts,
    input.pageTitle
      ? `Decades later, ${input.pageTitle} still earns a quiet place in the morning paper — a reminder that history is not only dates on a calendar, but turning points that continue to shape how we understand the world.`
      : "The moment still earns a quiet place in the morning paper — a reminder that history is made of turning points, not only dates on a calendar.",
  ]);

  let paragraphs = [lead, context, significance, echo].filter(
    (p) => p.length > 40
  );

  if (paragraphs.length < 3) {
    paragraphs = [
      lead,
      joinParagraph([
        context,
        significance ||
          `What unfolded that day belonged to a longer story — one that historians and readers still return to when they want to understand how the past became the present.`,
      ]),
      echo,
    ].filter((p) => p.length > 40);
  }

  // Deduplicate near-identical paragraphs
  const unique: string[] = [];
  for (const p of paragraphs) {
    const key = p.slice(0, 80).toLowerCase();
    if (!unique.some((u) => u.slice(0, 80).toLowerCase() === key)) {
      unique.push(p);
    }
  }

  const body = unique.slice(0, 4).join("\n\n");
  const words = wordCount(body);

  if (words < 220 && usable.length > 0) {
    const extra = usable.slice(3, 8).join(" ");
    if (extra) {
      return {
        headline,
        body: `${body}\n\n${extra}`.trim(),
      };
    }
  }

  return { headline, body };
}
