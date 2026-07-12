/**
 * Knowledge Cards — Milestone 11
 *
 * Calm editorial glosses so readers need not leave the paper to understand
 * a person, place, company, law, event, organization, or historical note.
 *
 * Not a chatbot. Not Wikipedia. Optional desk notes after the story —
 * never interrupting the read.
 */

import type { KnowledgeFacet, KnowledgePacket } from "./knowledge";
import { hasSubstance, isPlaceholderCopy } from "./contentQuality";

export type KnowledgeCardKind =
  | "person"
  | "company"
  | "place"
  | "law"
  | "event"
  | "organization"
  | "history"
  | "term";

export type KnowledgeCard = {
  kind: KnowledgeCardKind;
  /** Small terracotta kicker — Person, Place, In brief, etc. */
  kicker: string;
  title: string;
  body: string;
  sourceName?: string | null;
};

const KICKER: Record<KnowledgeCardKind, string> = {
  person: "Person",
  company: "Company",
  place: "Place",
  law: "Law",
  event: "Event",
  organization: "Organization",
  history: "History",
  term: "In brief",
};

/** Prefer teaching cards; skip feed-like related coverage. */
const CARD_TYPES = new Set([
  "definition",
  "historical_background",
  "local_context",
  "trusted_explainer",
]);

const MAX_CARDS = 3;

function kindFromFacet(facet: KnowledgeFacet): KnowledgeCardKind | null {
  if (facet.type === "historical_background" || facet.type === "timeline") {
    return "history";
  }
  if (facet.type === "local_context") {
    if (facet.data?.placeLabel && facet.title === facet.data.placeLabel) {
      return "place";
    }
    // Local event listings read as events
    if (/\d/.test(facet.summary) && /·|—|-/.test(facet.summary)) {
      return "event";
    }
    return "place";
  }
  if (facet.type === "definition") {
    const ek = facet.data?.entityKind;
    if (
      ek === "person" ||
      ek === "company" ||
      ek === "place" ||
      ek === "law" ||
      ek === "event" ||
      ek === "organization" ||
      ek === "term"
    ) {
      return ek;
    }
    return "term";
  }
  if (facet.type === "trusted_explainer") {
    return "term";
  }
  return null;
}

function titleForCard(facet: KnowledgeFacet, kind: KnowledgeCardKind): string {
  if (facet.type === "definition") {
    return (facet.data?.term || facet.title).replace(/^What\s+[“"]|[”"].*$/g, "").trim() ||
      facet.title;
  }
  if (kind === "history") return facet.title;
  return facet.title.trim();
}

/**
 * Select up to three Knowledge Cards for the end of an article.
 * Empty when nothing substantive — silence is better than padding.
 */
export function knowledgeCardsFromPacket(
  packet: KnowledgePacket | null | undefined
): KnowledgeCard[] {
  if (!packet?.facets?.length) return [];

  const cards: KnowledgeCard[] = [];
  const seen = new Set<string>();

  const ordered = [...packet.facets].sort((a, b) => {
    const rank = (t: string) =>
      t === "definition"
        ? 0
        : t === "historical_background"
          ? 1
          : t === "local_context"
            ? 2
            : 3;
    return rank(a.type) - rank(b.type);
  });

  for (const facet of ordered) {
    if (cards.length >= MAX_CARDS) break;
    if (!CARD_TYPES.has(facet.type)) continue;
    if (!hasSubstance(facet.summary, 16)) continue;
    if (isPlaceholderCopy(facet.title) || isPlaceholderCopy(facet.summary)) {
      continue;
    }
    // Skip vague template explainers
    if (
      facet.type === "trusted_explainer" &&
      /calm explainer|plain language|without the noise/i.test(facet.summary)
    ) {
      continue;
    }

    const kind = kindFromFacet(facet);
    if (!kind) continue;
    const title = titleForCard(facet, kind);
    if (!title || title.length < 2) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    cards.push({
      kind,
      kicker: KICKER[kind],
      title,
      body: facet.summary.trim().slice(0, 280),
      sourceName: facet.source?.name ?? null,
    });
  }

  return cards;
}

export const KnowledgeCards = {
  fromPacket: knowledgeCardsFromPacket,
  kickers: KICKER,
};
