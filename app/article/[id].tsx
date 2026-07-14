import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArticleReader } from "../../components/ArticleReader";
import { PaperLoading } from "../../components/PaperLoading";
import type { KindredArticle } from "../../lib/edition/article";
import { articleFromSectionItem, articleFromBanditsPick } from "../../lib/edition/article";
import {
  getGoldRelatedArticle,
  getGoldStandardArticle,
  getGoldStandardCompanion,
  GOLD_STANDARD_ARTICLE_ID,
  isGoldStandardArticleId,
} from "../../lib/edition/goldStandard/algalBloomArticle";
import { getStashedArticle } from "../../lib/edition/articleStore";
import {
  getArticleCompanion,
  type ContinueReadingItem,
} from "../../lib/edition/articleCompanion";
import { terminalEditorialContinuation } from "../../lib/edition/editorialContinuation";
import {
  getArticleSessionSync,
  loadArticleSession,
  type ArticleSession,
} from "../../lib/edition/articleSession";
import { openKindredArticle } from "../../lib/edition/openArticle";
import { paper } from "../../lib/edition/newspaperTheme";

/**
 * Shared article route for every Kindred section.
 * Open via openKindredArticle — session persists across background / external browser.
 */
export default function ArticleScreen() {
  const { id, editionId, backLabel, clipSectionId } = useLocalSearchParams<{
    id: string;
    editionId?: string;
    backLabel?: string;
    clipSectionId?: string;
  }>();
  const router = useRouter();
  const [session, setSession] = useState<ArticleSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const articleId =
      typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;
    if (!articleId) {
      setSession(null);
      setReady(true);
      return;
    }

    let cancelled = false;

    async function hydrate() {
      const sync = getArticleSessionSync(articleId!);
      if (sync) {
        if (!cancelled) {
          setSession(sync);
          setReady(true);
        }
        return;
      }

      const memoryArticle = getStashedArticle(articleId!);
      if (memoryArticle) {
        const built: ArticleSession = {
          article: memoryArticle,
          companion:
            getArticleCompanion(articleId!) ??
            (isGoldStandardArticleId(articleId!)
              ? getGoldStandardCompanion()
              : null),
          editionId:
            typeof editionId === "string" && editionId ? editionId : null,
          backLabel:
            typeof backLabel === "string" && backLabel.trim()
              ? backLabel
              : "← Today’s paper",
          clipSectionId:
            typeof clipSectionId === "string" && clipSectionId
              ? clipSectionId
              : null,
          scrollY: 0,
          updatedAt: Date.now(),
        };
        if (!cancelled) {
          setSession(built);
          setReady(true);
        }
        return;
      }

      // Gold-standard blueprint + related pieces — openable without a prior stash.
      if (articleId === GOLD_STANDARD_ARTICLE_ID) {
        const built: ArticleSession = {
          article: getGoldStandardArticle(),
          companion: getGoldStandardCompanion(),
          editionId:
            typeof editionId === "string" && editionId ? editionId : null,
          backLabel:
            typeof backLabel === "string" && backLabel.trim()
              ? backLabel
              : "← Today’s paper",
          clipSectionId: null,
          scrollY: 0,
          updatedAt: Date.now(),
        };
        if (!cancelled) {
          setSession(built);
          setReady(true);
        }
        return;
      }

      const goldRelated = getGoldRelatedArticle(articleId!);
      if (goldRelated) {
        const built: ArticleSession = {
          article: goldRelated,
          companion: {
            whyThisMatters: null,
            whyChosen: null,
            banditNote: goldRelated.banditNote ?? null,
            knowledgeNotes: [],
            knowledgeCards: [],
            continueReading: terminalEditorialContinuation(),
          },
          editionId:
            typeof editionId === "string" && editionId ? editionId : null,
          backLabel:
            typeof backLabel === "string" && backLabel.trim()
              ? backLabel
              : "← Previous story",
          clipSectionId: null,
          scrollY: 0,
          updatedAt: Date.now(),
        };
        if (!cancelled) {
          setSession(built);
          setReady(true);
        }
        return;
      }

      const persisted = await loadArticleSession(articleId!);
      if (!cancelled) {
        setSession(persisted);
        setReady(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [id, editionId, backLabel, clipSectionId]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const eid =
      session?.editionId ??
      (typeof editionId === "string" ? editionId : null);
    if (eid) {
      router.replace(`/edition/${eid}`);
      return;
    }
    router.replace("/home");
  }

  if (!ready) {
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
  const resolvedBack =
    (typeof backLabel === "string" && backLabel.trim()) ||
    session.backLabel ||
    "← Today’s paper";
  const resolvedClip =
    (typeof clipSectionId === "string" && clipSectionId
      ? clipSectionId
      : null) ||
    session.clipSectionId ||
    null;
  const resolvedEdition =
    (typeof editionId === "string" && editionId ? editionId : null) ||
    session.editionId ||
    null;

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
      // Real destination article, pre-stashed from the homepage when this
      // reader opened — the actual piece the card names, not a stand-in.
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
      <ArticleReader
        article={article}
        onBack={goBack}
        editionId={resolvedEdition}
        companion={session.companion ?? getArticleCompanion(article.id)}
        backLabel={resolvedBack}
        clipSectionId={resolvedClip}
        initialScrollY={session.scrollY ?? 0}
        onOpenContinue={openContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: paper.sky },
  centered: {
    flex: 1,
    backgroundColor: paper.sky,
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
