import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import {
  isFirstRunPending,
  markFirstRunCompleted,
  setModeCurrent,
  type ActiveLocation,
} from "../lib/location/deviceLocation";

type Props = {
  visible: boolean;
  onComplete: (active: ActiveLocation | null) => void;
  onChooseHomeCity: () => void;
};

/**
 * Calm first-launch prompt — foreground location only, editorial tone.
 */
export function LocationFirstRun({
  visible,
  onComplete,
  onChooseHomeCity,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function useCurrent() {
    if (busy) return;
    setBusy(true);
    try {
      const active = await setModeCurrent({ forceRefresh: true });
      await markFirstRunCompleted();
      onComplete(active);
    } finally {
      setBusy(false);
    }
  }

  async function notNow() {
    if (busy) return;
    await markFirstRunCompleted();
    onComplete(null);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => void notNow()}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Your paper</Text>
          <Text style={styles.title}>
            Every morning paper starts with a place.
          </Text>
          <Text style={styles.body}>
            Use your current location, or choose a home city — local news,
            local events, weather, and recommendations all follow from there.
            Kindred only uses location while the app is open, never in the
            background.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primary,
              busy && styles.disabled,
              pressed && !busy && styles.pressed,
            ]}
            onPress={() => void useCurrent()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={
              busy ? "Finding your location" : "Use current location"
            }
          >
            <Text style={styles.primaryText}>
              {busy ? "Finding you…" : "Use Current Location"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondary,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              void markFirstRunCompleted();
              onChooseHomeCity();
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose my home city"
          >
            <Text style={styles.secondaryText}>Choose My Home City</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => pressed && styles.pressed}
            onPress={() => void notNow()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.tertiaryText}>Not Now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Hook: whether first-run prompt should show. */
export function useLocationFirstRun() {
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    const needs = await isFirstRunPending();
    setPending(needs);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { pending, refresh, dismiss: () => setPending(false) };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(43, 38, 32, 0.28)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: paper.sky,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: paper.inkMuted,
    fontWeight: "600",
    marginBottom: 12,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 30,
    color: paper.ink,
    marginBottom: 14,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 23,
    color: paper.inkMuted,
    marginBottom: 26,
  },
  primary: {
    backgroundColor: paper.ink,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: {
    fontFamily: "Georgia",
    fontSize: 16,
    color: paper.cream,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 16,
  },
  secondaryText: {
    fontFamily: "Georgia",
    fontSize: 16,
    color: paper.ink,
  },
  tertiaryText: {
    fontFamily: "Georgia",
    fontSize: 15,
    fontStyle: "italic",
    color: paper.terracotta,
    textAlign: "center",
    paddingVertical: 8,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: press.opacity,
  },
});
