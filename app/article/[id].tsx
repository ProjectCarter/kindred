import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArticleReader } from "../../components/ArticleReader";
import { PaperLoading } from "../../components/PaperLoading";
import type { KindredArticle } from "../../lib/edition/article";
import { articleFromSectionItem } from "../../lib/edition/article";
import { getStashedArticle } from "../../lib/edition/articleStore";
import {
  getArticleCompanion,
  type ContinueReadingItem,
} from "../../lib/edition/articleCompanion";
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
          companion: getArticleCompanion(articleId!) ?? null,
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
        <Text
          style={styles.backLink}
          onPress={goBack}
          accessibilityRole="button"
        >
          ← Today’s paper
        </Text>
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
    const dekByKind: Record<ContinueReadingItem["kind"], string> = {
      related: "A related page from today’s paper.",
      local: "How this looks from close to home.",
      background: "Context for the story you just read.",
      opposing: "Another careful view of the same ground.",
      bandit: "Set aside by the desk.",
    };
    const related = articleFromSectionItem({
      id: `continue:${item.kind}:${item.title}`.slice(0, 120),
      section: item.kind === "bandit" ? "discovery" : "knowledge",
      headline: item.title,
      body: item.summary,
      dek: dekByKind[item.kind],
      source: "Kindred",
      byline: item.label,
    });
    openKindredArticle(router, related, {
      editionId: resolvedEdition,
      backLabel: "← Previous story",
      companion: {
        whyThisMatters: null,
        whyChosen: null,
        knowledgeNotes: [],
        continueReading: [],
      },
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
  flex: { flex: 1, backgroundColor: paper.cream },
  centered: {
    flex: 1,
    backgroundColor: paper.cream,
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
