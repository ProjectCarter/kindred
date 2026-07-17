import { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { formatEditionDate } from "../lib/edition/types";
import { paper, press, type } from "../lib/edition/newspaperTheme";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { PaperLoading } from "../components/PaperLoading";

type EditionRow = {
  id: string;
  edition_date: string;
  status: string;
};

export default function LibraryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editions, setEditions] = useState<EditionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);
  const pullDownNavScreen = usePullDownNavScreen({
    onBack: () => router.back(),
    title: "Library",
    backAccessibilityLabel: "Back to today",
  });

  const loadEditions = useCallback(async (isRefresh = false) => {
    const gen = ++loadGen.current;
    if (isRefresh) setRefreshing(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (gen === loadGen.current) {
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from("editions")
        .select("id, edition_date, status")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("edition_date", { ascending: false });

      if (gen !== loadGen.current) return;

      if (queryError) {
        setError("Your library couldn’t load. Try again in a moment.");
      } else {
        setEditions(data ?? []);
      }
    } catch {
      if (gen === loadGen.current) {
        setError("Your library couldn’t load. Try again in a moment.");
      }
    } finally {
      if (gen === loadGen.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadEditions();
  }, [loadEditions]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PaperLoading hint="Turning back the pages…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadEditions(true)}
            tintColor={paper.terracotta}
            colors={[paper.terracotta]}
          />
        }
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to today"
        >
          <Text style={styles.backText}>← Today</Text>
        </Pressable>

        <Text style={styles.kicker}>Past mornings</Text>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.subtitle}>
          Earlier editions of your paper, newest first.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {editions.length === 0 ? (
          <Text style={styles.empty}>
            Your earlier mornings will gather here. After the first edition
            arrives, you’ll find it on this shelf.
          </Text>
        ) : (
          editions.map((edition) => (
            <Pressable
              key={edition.id}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => router.push(`/edition/${edition.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open edition for ${formatEditionDate(edition.edition_date)}`}
            >
              <Text style={styles.rowDate}>
                {formatEditionDate(edition.edition_date)}
              </Text>
              <Text style={styles.rowHint}>Open</Text>
            </Pressable>
          ))
        )}

        <Pressable
          style={({ pressed }) => [
            styles.clippingsLink,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/location")}
          accessibilityRole="button"
          accessibilityLabel="Open location settings"
        >
          <Text style={styles.clippingsLinkText}>Location</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.clippingsLink,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/clippings")}
          accessibilityRole="button"
          accessibilityLabel="Open your clippings"
        >
          <Text style={styles.clippingsLinkText}>Your clippings</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.signOutLink,
            pressed && styles.pressed,
          ]}
          onPress={async () => {
            try {
              await supabase.auth.signOut();
            } catch {
              /* Still leave the session UI even if network sign-out fails. */
            }
            router.replace("/login");
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
      <PullDownNavHeader {...pullDownNavScreen.headerProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.page,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingHint: {
    marginTop: 16,
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.inkMuted,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 72,
  },
  backLink: {
    marginBottom: 24,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  backText: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.terracotta,
    fontStyle: "italic",
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 10,
  },
  title: {
    ...type.display,
    fontSize: 32,
    lineHeight: 38,
    color: paper.ink,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 25,
    color: paper.inkBody,
    marginBottom: 32,
    maxWidth: 400,
  },
  error: {
    fontFamily: "Georgia",
    color: paper.terracotta,
    marginBottom: 16,
    fontStyle: "italic",
  },
  empty: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 25,
    color: paper.inkMuted,
    fontStyle: "italic",
  },
  row: {
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowDate: {
    fontFamily: "Georgia",
    fontSize: 17,
    color: paper.ink,
    flex: 1,
    paddingRight: 12,
  },
  rowHint: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.terracotta,
    fontStyle: "italic",
  },
  clippingsLink: {
    marginTop: 40,
    alignSelf: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.terracotta,
  },
  clippingsLinkText: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
  },
  signOutLink: {
    marginTop: 36,
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  signOutText: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.inkFaint,
    fontStyle: "italic",
  },
  pressed: {
    opacity: press.opacity,
  },
});
