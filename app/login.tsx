import { useEffect, useRef, useState, useCallback } from "react";
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  View,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { isPlausibleEmail } from "../lib/edition/dates";
import { consumeAuthLinkError } from "../lib/auth/authLinkError";
import { motion, paper, press, type } from "../lib/edition/newspaperTheme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const linkError = consumeAuthLinkError();
      if (linkError) setError(linkError);
    }, [])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: motion.enterMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: motion.enterMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [enter, rise]);

  async function handleContinue() {
    if (pending) return;
    setError(null);

    if (!isSupabaseConfigured) {
      setError("Kindred isn’t configured for this build yet.");
      return;
    }

    const trimmedEmail = email.trim();
    if (!isPlausibleEmail(trimmedEmail)) {
      setError("That email doesn’t look quite right.");
      return;
    }

    setPending(true);

    try {
      const redirectTo = Linking.createURL("/");

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });

      if (!mountedRef.current) return;

      if (authError) {
        if (__DEV__) {
          console.error("[auth] signInWithOtp", authError.message);
        }
        setError("We couldn’t send that link. Please try again in a moment.");
        return;
      }

      setSent(true);
    } catch {
      if (mountedRef.current) {
        setError("We couldn’t send that link. Please try again in a moment.");
      }
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          style={{
            opacity: enter,
            transform: [{ translateY: rise }],
          }}
        >
          <Text style={styles.masthead} accessibilityRole="header">
            Kindred
          </Text>

          {sent ? (
            <View>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We sent a sign-in link to{" "}
                <Text style={styles.emailHighlight}>{email.trim()}</Text>. Open
                that email on this phone and tap the link to continue.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.textAction,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setSent(false);
                  setError(null);
                }}
                accessibilityRole="button"
                hitSlop={10}
              >
                <Text style={styles.textActionLabel}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.title}>Good morning.</Text>
              <Text style={styles.subtitle}>
                Enter your email and we’ll send a sign-in link. No password
                needed.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={paper.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Email address"
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (email.trim() && !pending) handleContinue();
                }}
              />
              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  (pending || !email.trim()) && styles.buttonDisabled,
                  pressed && !pending && email.trim() && styles.pressed,
                ]}
                onPress={handleContinue}
                disabled={pending || email.trim().length === 0}
                accessibilityRole="button"
                accessibilityLabel={
                  pending ? "Sending sign-in link" : "Email me a sign-in link"
                }
                hitSlop={8}
              >
                <Text style={styles.buttonText}>
                  {pending ? "Sending…" : "Email me a sign-in link"}
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.cream,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  masthead: {
    ...type.masthead,
    color: paper.ink,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 52,
  },
  title: {
    ...type.display,
    color: paper.ink,
    marginBottom: 14,
  },
  subtitle: {
    ...type.dek,
    color: paper.inkBody,
    marginBottom: 32,
    maxWidth: 360,
  },
  emailHighlight: {
    fontStyle: "italic",
    color: paper.ink,
  },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkMuted,
    paddingHorizontal: 2,
    paddingVertical: 16,
    fontFamily: "Georgia",
    fontSize: 18,
    backgroundColor: "transparent",
    marginBottom: 18,
    color: paper.ink,
  },
  error: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    color: paper.terracotta,
    marginBottom: 14,
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
    fontSize: 16,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  textAction: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 8,
  },
  textActionLabel: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
  },
  pressed: {
    opacity: press.opacity,
  },
});
