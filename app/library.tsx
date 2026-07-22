import {
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { paper, press, type } from "../lib/edition/newspaperTheme";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";

export default function LibraryScreen() {
  const router = useRouter();
  const pullDownNavScreen = usePullDownNavScreen({
    onBack: () => router.back(),
    title: "Library",
    backAccessibilityLabel: "Back to today",
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to today"
        >
          <Text style={styles.backText}>← Today</Text>
        </Pressable>

        <Text style={styles.title}>Library</Text>

        <Pressable
          style={({ pressed }) => [
            styles.utilityLink,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/location")}
          accessibilityRole="button"
          accessibilityLabel="Open location settings"
        >
          <Text style={styles.utilityLinkText}>Location</Text>
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
  title: {
    ...type.display,
    fontSize: 32,
    lineHeight: 38,
    color: paper.ink,
    marginBottom: 32,
  },
  utilityLink: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.terracotta,
  },
  utilityLinkText: {
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
