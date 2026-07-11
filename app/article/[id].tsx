import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArticleReader } from "../../components/ArticleReader";
import { PaperLoading } from "../../components/PaperLoading";
import type { KindredArticle } from "../../lib/edition/article";
import { getStashedArticle } from "../../lib/edition/articleStore";
import { getArticleCompanion } from "../../lib/edition/articleCompanion";
import { paper } from "../../lib/edition/newspaperTheme";

/**
 * Shared article route for every Kindred section.
 * Open via stashArticle(article) then router.push(`/article/${article.id}`).
 */
export default function ArticleScreen() {
  const { id, editionId } = useLocalSearchParams<{
    id: string;
    editionId?: string;
  }>();
  const router = useRouter();
  const [article, setArticle] = useState<KindredArticle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const articleId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;
    if (!articleId) {
      setArticle(null);
      setReady(true);
      return;
    }
    setArticle(getStashedArticle(articleId));
    setReady(true);
  }, [id]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.flex}>
        <StatusBar style="dark" />
        <PaperLoading hint="Opening the story…" />
      </SafeAreaView>
    );
  }

  if (!article) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.missingTitle}>This story isn’t available</Text>
        <Text style={styles.missingBody}>
          Return to your edition and open it again from the front page.
        </Text>
        <Text
          style={styles.backLink}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          ← Back to the paper
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.flex}>
      <StatusBar style="dark" />
      <ArticleReader
        article={article}
        onBack={() => router.back()}
        editionId={typeof editionId === "string" ? editionId : null}
        companion={getArticleCompanion(article.id)}
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
