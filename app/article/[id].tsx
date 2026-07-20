import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArticleReader } from "../../components/ArticleReader";
import { HistoryPlaceReader } from "../../components/HistoryPlaceReader";
import { PaperLoading } from "../../components/PaperLoading";
import type { KindredArticle } from "../../lib/edition/article";
import { articleFromSectionItem, articleFromBanditsPick } from "../../lib/edition/article";
import { getStashedArticle } from "../../lib/edition/articleStore";
import {
  getArticleCompanion,
  type ContinueReadingItem,
} from "../../lib/edition/articleCompanion";
import { terminalEditorialContinuation } from "../../lib/edition/editorialContinuation";
import {
  getGoldRelatedArticle,
} from "../../lib/edition/goldStandard/algalBloomArticle";
import {
  loadArticleSessionFromPersistence,
  resolveArticleSessionSync,
  type ResolveArticleSessionResult,
} from "../../lib/edition/resolveArticleSession";
import { articleMatchesRouteId } from "../../lib/edition/articleIntegrity";
import type { ArticleSession } from "../../lib/edition/articleSession";
import { openKindredArticle } from "../../lib/edition/openArticle";
import { paper } from "../../lib/edition/newspaperTheme";

function routeParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

/**
 * Shared article route for every Kindred section.
 * Open via openKindredArticle — session persists across background / external browser.
 */
export default function ArticleScreen() {
  const { id, editionId, backLabel } = useLocalSearchParams<{
    id: string;
    editionId?: string;
    backLabel?: string;
  }>();
  const router = useRouter();

  const routeArticleId = routeParam(id);
  const routeEditionId = routeParam(editionId);
  const routeBackLabel = routeParam(backLabel);

  const initial = useMemo<ResolveArticleSessionResult>(
    () =>
      resolveArticleSessionSync(routeArticleId, {
        editionId: routeEditionId,
        backLabel: routeBackLabel,
      }),
    [routeArticleId, routeEditionId, routeBackLabel]
  );

  const [session, setSession] = useState<ArticleSession | null>(
    initial.session
  );
  const [needsAsync, setNeedsAsync] = useState(initial.needsAsync);

  useEffect(() => {
    const resolved = resolveArticleSessionSync(routeArticleId, {
      editionId: routeEditionId,
      backLabel: routeBackLabel,
    });
    setSession(resolved.session);
    setNeedsAsync(resolved.needsAsync);
  }, [routeArticleId, routeEditionId, routeBackLabel]);

  useEffect(() => {
    if (!needsAsync || !routeArticleId) return;

    let cancelled = false;
    void loadArticleSessionFromPersistence(routeArticleId, {
      editionId: routeEditionId,
      backLabel: routeBackLabel,
    }).then((persisted) => {
      if (!cancelled) {
        setSession(persisted);
        setNeedsAsync(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [needsAsync, routeArticleId, routeEditionId, routeBackLabel]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const eid = session?.editionId ?? routeEditionId;
    if (eid) {
      router.replace(`/edition/${eid}`);
      return;
    }
    router.replace("/home");
  }

  if (needsAsync && !session?.article) {
    return (
      <SafeAreaView style={styles.flex}>
        <StatusBar style="dark" />
        <PaperLoading hint="Settling the page…" />
      </SafeAreaView>
    );
  }

  if (!session?.article) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.missingTitle}>This story isn’t available</Text>
        <Text style={styles.missingBody}>
          Return to your edition and open it again from the front page.
        </Text>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to today’s paper"
          hitSlop={12}
          style={({ pressed }) => pressed && { opacity: 0.55 }}
        >
          <Text style={styles.backLink}>← Today’s paper</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const article: KindredArticle = session.article;
  if (
    routeArticleId &&
    !articleMatchesRouteId(routeArticleId, article)
  ) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.missingTitle}>This story isn’t available</Text>
        <Text style={styles.missingBody}>
          The article reader could not verify this story. Return to your edition
          and open it again from the front page.
        </Text>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to today’s paper"
          hitSlop={12}
          style={({ pressed }) => pressed && { opacity: 0.55 }}
        >
          <Text style={styles.backLink}>← Today’s paper</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const resolvedBack =
    routeBackLabel?.trim() || session.backLabel || "← Today’s paper";
  const resolvedEdition = routeEditionId || session.editionId || null;

  function openContinue(item: ContinueReadingItem) {
    if (item.action === "return_to_edition") {
      goBack();
      return;
    }

    const terminalCompanion = {
      whyThisMatters: null as null,
      whyChosen: null as null,
      banditNote: null as null,
      knowledgeNotes: [] as [],
      knowledgeCards: [] as [],
      continueReading: terminalEditorialContinuation(),
    };

    if (item.targetArticleId && item.targetArticleId !== article.id) {
      const stashed = getStashedArticle(item.targetArticleId);
      if (stashed) {
        openKindredArticle(router, stashed, {
          editionId: resolvedEdition,
          backLabel: "← Previous story",
          companion: {
            ...terminalCompanion,
            banditNote: stashed.banditNote ?? null,
          },
        });
        return;
      }

      const goldRelated = getGoldRelatedArticle(item.targetArticleId);
      if (goldRelated) {
        openKindredArticle(router, goldRelated, {
          editionId: resolvedEdition,
          backLabel: "← Previous story",
          companion: {
            ...terminalCompanion,
            banditNote: goldRelated.banditNote ?? null,
          },
        });
        return;
      }
    }

    if (item.kind === "bandit") {
      const related = articleFromBanditsPick({
        id: item.targetArticleId || `bandit:${item.title}`.slice(0, 120),
        headline: item.title,
        summary: item.summary,
        source: "Kindred",
        url: null,
        publishedAt: null,
      });
      openKindredArticle(router, related, {
        editionId: resolvedEdition,
        backLabel: "← Previous story",
        companion: terminalCompanion,
      });
      return;
    }

    const related = articleFromSectionItem({
      id: `continue:${item.kind}:${item.title}`.slice(0, 120),
      section: "knowledge",
      headline: item.title,
      body: item.summary,
      dek:
        item.kind === "following"
          ? "Earlier coverage from the paper’s continuing thread."
          : item.kind === "local"
            ? "How this looks from close to home."
            : item.kind === "opposing"
              ? "Another careful view of the same ground."
              : "Context for the story you just read.",
      source: "Kindred",
      byline: item.label,
    });
    openKindredArticle(router, related, {
      editionId: resolvedEdition,
      backLabel: "← Previous story",
      companion: terminalCompanion,
    });
  }

  return (
    <View style={styles.flex}>
      <StatusBar style="dark" />
      {article.section === "history_around_town" &&
      article.historyPlaceSnapshot ? (
        <HistoryPlaceReader
          article={article}
          place={article.historyPlaceSnapshot}
          onBack={goBack}
          backLabel={resolvedBack}
        />
      ) : (
        <ArticleReader
          article={article}
          onBack={goBack}
          editionId={resolvedEdition}
          companion={session.companion ?? getArticleCompanion(article.id)}
          backLabel={resolvedBack}
          initialScrollY={session.scrollY ?? 0}
          onOpenContinue={openContinue}
          instantEnter
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: paper.page },
  centered: {
    flex: 1,
    backgroundColor: paper.page,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  missingTitle: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    color: paper.ink,
    marginBottom: 12,
    textAlign: "center",
  },
  missingBody: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 25,
    color: paper.inkMuted,
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 320,
  },
  backLink: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
  },
});
