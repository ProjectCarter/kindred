/**
 * Refresh Today in History for an existing edition — replaces stale
 * edition_sections copy and updates editions.knowledge with authentic imagery.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { fetchOnThisDayCandidates } from "./onThisDay.ts";
import { selectTodayInHistoryStory } from "./selectStory.ts";
import { writeTodayInHistorySection } from "./writeTodayInHistory.ts";
import { buildTodayInHistoryGrounding } from "../knowledge/providers/synthesize.ts";
import { enrichEditionKnowledge } from "../knowledge/providers/enrich.ts";
import type { KnowledgePayload } from "../knowledge/types.ts";

const BLOCKED_EVENTS = [/rus flight 9633/i, /chkalovsky/i];

export type RefreshTodayInHistoryInput = {
  editionId: string;
  editionDate: string;
  anthropicApiKey: string;
  location?: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  };
};

export type RefreshTodayInHistoryResult = {
  ok: boolean;
  changed: boolean;
  headline?: string;
  wordCount?: number;
  error?: string;
};

function defaultKnowledge(editionDate: string): KnowledgePayload {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    editionDate,
    location: { city: null, region: null, state: null },
    byStoryKey: {},
    highlights: [],
    editorBrief: "",
    selectionMeta: { storyCount: 0, facetCount: 0, editorNotes: [] },
  };
}

export async function refreshTodayInHistoryForEdition(
  admin: SupabaseClient,
  input: RefreshTodayInHistoryInput
): Promise<RefreshTodayInHistoryResult> {
  const candidates = (await fetchOnThisDayCandidates(input.editionDate)).filter(
    (c) => !BLOCKED_EVENTS.some((re) => re.test(c.text))
  );

  if (!candidates.length) {
    return { ok: false, changed: false, error: "no_candidates" };
  }

  const historySelection = await selectTodayInHistoryStory({
    candidates,
    nowYear: Number(input.editionDate.slice(0, 4)) || new Date().getFullYear(),
  });

  if (!historySelection?.image?.url || !historySelection.event) {
    return { ok: false, changed: false, error: "no_selection" };
  }

  const onThisDay = historySelection.event;

  const { data: editionRow, error: editionError } = await admin
    .from("editions")
    .select("knowledge")
    .eq("id", input.editionId)
    .maybeSingle();

  if (editionError || !editionRow) {
    return { ok: false, changed: false, error: editionError?.message ?? "edition_missing" };
  }

  const rawKnowledge = editionRow.knowledge;
  const existingKnowledge: KnowledgePayload =
    rawKnowledge &&
    typeof rawKnowledge === "object" &&
    (rawKnowledge as KnowledgePayload).version === 1 &&
    (rawKnowledge as KnowledgePayload).byStoryKey
      ? (rawKnowledge as KnowledgePayload)
      : defaultKnowledge(input.editionDate);

  const knowledgeWithGrounding = await enrichEditionKnowledge(admin, {
    knowledge: existingKnowledge,
    onThisDay,
    location: input.location,
  });

  if (knowledgeWithGrounding.providerGrounding) {
    knowledgeWithGrounding.providerGrounding.onThisDayImage = historySelection.image;
    knowledgeWithGrounding.providerGrounding.onThisDaySelection = {
      editorialScore: historySelection.editorialScore,
      imageScore: historySelection.imageScore,
      candidateCount: historySelection.candidateCount,
      selectedRank: historySelection.selectedRank,
      editorNotes: historySelection.editorNotes,
    };
  }

  const groundingData = buildTodayInHistoryGrounding(
    onThisDay,
    knowledgeWithGrounding.providerGrounding?.onThisDay,
    {
      image: historySelection.image,
      editorNotes: historySelection.editorNotes,
    }
  );

  const instruction =
    `Write Today in History as Kindred's signature morning feature — a calm Sunday newspaper ` +
    `story someone would read over coffee for two or three minutes. ` +
    `Write 300–700 words across 2–4 paragraphs (separated by blank lines). ` +
    `Cover: what happened, why it mattered, historical context, lasting impact, and one or two ` +
    `memorable details that make the story stick. ` +
    `Headline format: "${onThisDay.year} — Compelling editorial title" (never "Today in History" alone). ` +
    `Tone: thoughtful, timeless, curious — never encyclopedic, never copied verbatim. ` +
    `Ground ONLY in the dated event and verified background below. Synthesize original prose; ` +
    `do not invent facts.`;

  const written = await writeTodayInHistorySection({
    groundingData,
    instruction,
    year: onThisDay.year,
    eventText: onThisDay.text,
    anthropicApiKey: input.anthropicApiKey,
  });

  if (!written.headline?.trim() || !written.body?.trim()) {
    return { ok: false, changed: false, error: "empty_write" };
  }

  const wordCount = written.body.split(/\s+/).filter(Boolean).length;

  const { data: existingSection, error: sectionLookupError } = await admin
    .from("edition_sections")
    .select("id, headline, body")
    .eq("edition_id", input.editionId)
    .eq("section_type", "today_in_history")
    .maybeSingle();

  if (sectionLookupError) {
    return { ok: false, changed: false, error: sectionLookupError.message };
  }

  if (existingSection?.id) {
    const { error: updateSectionError } = await admin
      .from("edition_sections")
      .update({
        headline: written.headline,
        body: written.body,
        source_note: "Sourced from Wikipedia",
      })
      .eq("id", existingSection.id);

    if (updateSectionError) {
      return { ok: false, changed: false, error: updateSectionError.message };
    }
  } else {
    const { error: insertSectionError } = await admin
      .from("edition_sections")
      .insert({
        edition_id: input.editionId,
        section_type: "today_in_history",
        position: 4,
        headline: written.headline,
        body: written.body,
        source_note: "Sourced from Wikipedia",
      });

    if (insertSectionError) {
      return { ok: false, changed: false, error: insertSectionError.message };
    }
  }

  const { error: knowledgeUpdateError } = await admin
    .from("editions")
    .update({ knowledge: knowledgeWithGrounding })
    .eq("id", input.editionId);

  if (knowledgeUpdateError) {
    return { ok: false, changed: false, error: knowledgeUpdateError.message };
  }

  const changed =
    existingSection?.headline !== written.headline ||
    existingSection?.body !== written.body;

  console.log("[history:refresh] edition updated", {
    editionId: input.editionId,
    headline: written.headline,
    wordCount,
    changed,
    year: onThisDay.year,
  });

  return {
    ok: true,
    changed,
    headline: written.headline,
    wordCount,
  };
}
