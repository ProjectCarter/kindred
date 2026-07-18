/**
 * Today in History recovery — upgrades stale edition_sections copy and
 * patches the on-device cache. Tries the server refresh first; falls back to
 * a client-side curated feature so the homepage changes immediately.
 */

import { supabase } from "../supabase";
import type { EditionSection } from "./types";
import type { EditionIntelligence } from "./surfaceIntelligence";
import type { KnowledgePayload } from "./knowledge";
import type { HistoricalImageAsset } from "./knowledgeGrounding";
import type { KnowledgeLookupResult } from "./knowledge";
import { loadWithRetry } from "./loadWithRetry";
import {
  clearCachedEdition,
  saveCachedEdition,
  type CachedEditionBundle,
} from "./editionCache";
import { needsTodayInHistoryRecovery } from "./history/stale";
import { upgradeTodayInHistoryClient } from "./history/upgrade";
import type { UsNationalDailyRecord } from "./usNationalDaily";
import { fetchUsNationalDailyByDate } from "./fetchUsNationalDaily";
import {
  articleIdentityFromSection,
  buildPairedNationalDailySnapshot,
  buildTodayInHistoryDeskSync,
  imageIdentityFromAsset,
} from "./todayInHistorySync";

const RECOVERY_THROTTLE_MS = 45_000;
const lastRecoveryAt = new Map<string, number>();

export type TodayInHistoryRecoveryResult = {
  attempted: boolean;
  recovered: boolean;
  sections: EditionSection[];
  intelligence: EditionIntelligence | null;
  headline?: string | null;
  source?: "server" | "client" | null;
  /** Paired national snapshot — article + image from the same record. */
  pairedNationalDaily?: UsNationalDailyRecord | null;
  error?: string | null;
};

function recoveryKey(editionId: string, editionDate: string): string {
  return `${editionId}:${editionDate}`;
}

function canAttemptRecovery(editionId: string, editionDate: string): boolean {
  const key = recoveryKey(editionId, editionDate);
  const last = lastRecoveryAt.get(key) ?? 0;
  return Date.now() - last >= RECOVERY_THROTTLE_MS;
}

function markRecoveryAttempt(editionId: string, editionDate: string): void {
  lastRecoveryAt.set(recoveryKey(editionId, editionDate), Date.now());
}

function mergeHistorySection(
  sections: EditionSection[],
  updated: EditionSection
): EditionSection[] {
  return sections.map((s) =>
    s.section_type === "today_in_history" ? updated : s
  );
}

function mergeHistoryKnowledge(
  intelligence: EditionIntelligence | null,
  editionDate: string,
  image: HistoricalImageAsset,
  onThisDay?: KnowledgeLookupResult | null,
  sync?: import("./knowledgeGrounding").TodayInHistoryDeskSync | null
): EditionIntelligence | null {
  if (!intelligence) return intelligence;

  const existing = intelligence.knowledge;
  const knowledge: KnowledgePayload = existing ?? {
    version: 1,
    generatedAt: new Date().toISOString(),
    editionDate,
    location: { city: null, region: null, state: null },
    byStoryKey: {},
    highlights: [],
    editorBrief: "",
    selectionMeta: { storyCount: 0, facetCount: 0, editorNotes: [] },
  };

  return {
    ...intelligence,
    knowledge: {
      ...knowledge,
      providerGrounding: {
        ...knowledge.providerGrounding,
        onThisDayImage: image,
        onThisDay: onThisDay ?? knowledge.providerGrounding?.onThisDay ?? null,
        onThisDaySync: sync ?? knowledge.providerGrounding?.onThisDaySync ?? null,
        enrichedAt: new Date().toISOString(),
        providersUsed: ["wikipedia"],
      },
      selectionMeta: {
        ...knowledge.selectionMeta,
        editorNotes: [
          ...knowledge.selectionMeta.editorNotes,
          "Today in History upgraded from stale edition copy.",
        ],
      },
    },
  };
}

async function fetchHistorySection(
  editionId: string
): Promise<EditionSection | null> {
  const { data, error } = await supabase
    .from("edition_sections")
    .select("id, section_type, position, headline, body, source_note")
    .eq("edition_id", editionId)
    .eq("section_type", "today_in_history")
    .maybeSingle();

  if (error && __DEV__) {
    console.warn("[history:recovery] section fetch error", error.message);
    return null;
  }

  return (data as EditionSection | null) ?? null;
}

export { needsTodayInHistoryRecovery } from "./history/stale";

export async function recoverTodayInHistory(params: {
  userId: string;
  editionId: string;
  editionDate: string;
  currentSections: EditionSection[];
  intelligence: EditionIntelligence | null;
  cachedBundle?: CachedEditionBundle | null;
}): Promise<TodayInHistoryRecoveryResult> {
  const {
    userId,
    editionId,
    editionDate,
    currentSections,
    intelligence,
    cachedBundle,
  } = params;

  if (!needsTodayInHistoryRecovery(currentSections)) {
    return {
      attempted: false,
      recovered: false,
      sections: currentSections,
      intelligence,
    };
  }

  if (!canAttemptRecovery(editionId, editionDate)) {
    return {
      attempted: false,
      recovered: false,
      sections: currentSections,
      intelligence,
      error: "throttled",
    };
  }

  markRecoveryAttempt(editionId, editionDate);

  // Drop stale AsyncStorage copy so the upgraded feature cannot reappear.
  await clearCachedEdition(userId, editionDate);

  const existing =
    currentSections.find((s) => s.section_type === "today_in_history") ?? null;
  if (!existing) {
    return {
      attempted: true,
      recovered: false,
      sections: currentSections,
      intelligence,
      error: "missing_section",
    };
  }

  if (__DEV__) {
    console.log("[history:recovery] stale Today in History detected", {
      editionId,
      headline: existing.headline,
      preview: existing.body.slice(0, 120),
    });
  }

  // Server refresh — persists to edition_sections + editions.knowledge.
  const serverResult = await loadWithRetry(
    async () => {
      const { data, error } = await supabase.functions.invoke(
        "refresh-today-in-history",
        { body: { editionDate } }
      );
      if (error) throw new Error(error.message);
      return data as {
        ok?: boolean;
        headline?: string;
        changed?: boolean;
        error?: string;
      };
    },
    { label: "recoverTodayInHistory", maxAttempts: 2 }
  );

  if (serverResult.ok && serverResult.value?.ok && serverResult.value.changed) {
    const sectionRow = await fetchHistorySection(editionId);
    if (sectionRow && !needsTodayInHistoryRecovery([sectionRow])) {
      const merged = mergeHistorySection(currentSections, sectionRow);
      const pairedNationalDaily = await fetchUsNationalDailyByDate(editionDate);

      const { data: editionRow } = await supabase
        .from("editions")
        .select("knowledge")
        .eq("id", editionId)
        .maybeSingle();

      let nextIntel = intelligence;
      const knowledge = editionRow?.knowledge;
      if (knowledge && intelligence) {
        nextIntel = {
          ...intelligence,
          knowledge:
            typeof knowledge === "object"
              ? (knowledge as EditionIntelligence["knowledge"])
              : intelligence.knowledge,
        };
      }

      if (cachedBundle) {
        void saveCachedEdition({
          ...cachedBundle,
          sections: merged,
          intelligence: nextIntel,
          pairedNationalDaily,
          cachedAt: Date.now(),
        });
      }

      if (__DEV__) {
        console.log("[history:recovery] server refresh succeeded", {
          headline: sectionRow.headline,
          pairedNationalDailyId: pairedNationalDaily?.id ?? null,
        });
      }

      return {
        attempted: true,
        recovered: true,
        sections: merged,
        intelligence: nextIntel,
        headline: sectionRow.headline,
        source: "server",
        pairedNationalDaily,
      };
    }
  }

  // Client fallback — changes the rendered paper immediately.
  const clientUpgrade = await upgradeTodayInHistoryClient(editionDate, existing);
  if (!clientUpgrade.ok || !clientUpgrade.section) {
    return {
      attempted: true,
      recovered: false,
      sections: currentSections,
      intelligence,
      error:
        clientUpgrade.error ??
        (serverResult.ok ? null : serverResult.error.message) ??
        "upgrade_failed",
    };
  }

  const merged = mergeHistorySection(currentSections, clientUpgrade.section);
  const articleIdentity = articleIdentityFromSection(clientUpgrade.section);
  const imageIdentity = imageIdentityFromAsset(clientUpgrade.image, {
    source: "knowledge",
    year: clientUpgrade.year ?? articleIdentity.year,
  });
  const deskSync = buildTodayInHistoryDeskSync({
    year: clientUpgrade.year ?? articleIdentity.year ?? 0,
    eventText: clientUpgrade.eventText ?? "",
    articleFingerprint: articleIdentity.fingerprint,
    imageFingerprint: imageIdentity.fingerprint,
    source: "client_recovery",
  });
  const pairedNationalDaily = buildPairedNationalDailySnapshot({
    editionDate,
    section: clientUpgrade.section,
    image: clientUpgrade.image!,
    year: clientUpgrade.year ?? articleIdentity.year ?? 0,
    eventText: clientUpgrade.eventText ?? "",
    source: "client_recovery",
  });
  const nextIntel = clientUpgrade.image
    ? mergeHistoryKnowledge(
        intelligence,
        editionDate,
        clientUpgrade.image,
        clientUpgrade.onThisDay,
        deskSync
      )
    : intelligence;

  if (cachedBundle) {
    void saveCachedEdition({
      ...cachedBundle,
      sections: merged,
      intelligence: nextIntel,
      pairedNationalDaily,
      cachedAt: Date.now(),
    });
  }

  if (__DEV__) {
    console.log("[history:recovery] client upgrade applied", {
      headline: clientUpgrade.section.headline,
      words: clientUpgrade.section.body.split(/\s+/).filter(Boolean).length,
      pairedNationalDailyId: pairedNationalDaily.id,
      articleFingerprint: articleIdentity.fingerprint,
      imageFingerprint: imageIdentity.fingerprint,
    });
  }

  return {
    attempted: true,
    recovered: true,
    sections: merged,
    intelligence: nextIntel,
    headline: clientUpgrade.section.headline,
    source: "client",
    pairedNationalDaily,
  };
}
