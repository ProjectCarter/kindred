import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { paper, press, type } from "../lib/edition/newspaperTheme";

const AVAILABLE_INTERESTS = [
  "Technology",
  "Business",
  "Science",
  "Culture & Arts",
  "Health & Wellbeing",
  "Politics & Policy",
  "Climate & Environment",
  "Sports",
];

export default function OnboardingScreen() {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  function toggle(interest: string) {
    setSelected((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
    setError(null);
  }

  async function handleContinue() {
    if (pending) return;

    if (selected.length === 0) {
      setError("Choose at least one subject — you can refine this later.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Your session slipped away. Please sign in again.");
        setPending(false);
        return;
      }

      // Prefer update; insert if the profile row does not exist yet.
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      const write = existing
        ? await supabase
            .from("profiles")
            .update({ interests: selected })
            .eq("id", user.id)
        : await supabase.from("profiles").insert({
            id: user.id,
            interests: selected,
          });

      if (write.error) {
        if (__DEV__) {
          console.error("[onboarding] profiles write failed", write.error.message);
        }
        setError("We couldn’t save that. Please try once more.");
        setPending(false);
        return;
      }

      router.replace("/home");
    } catch {
      setError("We couldn’t save that. Please try once more.");
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>Your paper</Text>
        <Text style={styles.title}>What should we keep up with?</Text>
        <Text style={styles.subtitle}>
          Choose a few subjects for your morning paper. You can change them
          later.
        </Text>

        <View style={styles.chipWrap}>
          {AVAILABLE_INTERESTS.map((interest) => {
            const isSelected = selected.includes(interest);
            return (
              <Pressable
                key={interest}
                onPress={() => toggle(interest)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={interest}
                style={({ pressed }) => [
                  styles.chip,
                  isSelected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  {interest}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : (
          <Text style={styles.hint}>
            {selected.length === 0
              ? "Pick at least one to continue."
              : selected.length === 1
                ? "One subject selected."
                : `${selected.length} subjects selected`}
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pending && styles.buttonDisabled,
            pressed && !pending && styles.pressed,
          ]}
          onPress={handleContinue}
          disabled={pending}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {pending ? "Saving…" : "Continue"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.cream,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 48,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 14,
  },
  title: {
    ...type.display,
    fontSize: 30,
    lineHeight: 36,
    color: paper.ink,
    marginBottom: 12,
  },
  subtitle: {
    ...type.dek,
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
    marginBottom: 32,
    maxWidth: 400,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  chipSelected: {
    backgroundColor: paper.terracottaWash,
    borderBottomColor: paper.terracotta,
  },
  chipText: {
    fontFamily: "Georgia",
    color: paper.ink,
    fontSize: 15,
  },
  chipTextSelected: {
    color: paper.ink,
  },
  hint: {
    fontFamily: "Georgia",
    fontSize: 13,
    fontStyle: "italic",
    color: paper.inkFaint,
    marginBottom: 20,
  },
  error: {
    fontFamily: "Georgia",
    color: paper.terracotta,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  button: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.terracotta,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: "Georgia",
    color: paper.terracotta,
    fontSize: 16,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: press.opacity,
  },
});
