import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import type { ActionBarAction } from "../lib/edition/actionBar";
import { openGoogleMapsDestination } from "../lib/edition/googleMaps";
import type { MapsDestination } from "../lib/edition/googleMaps";
import { trackActionBarExternalAction } from "../lib/analytics";

type Props = {
  actions: ActionBarAction[];
  /** Tighter spacing for homepage / grid listings. */
  variant?: "article" | "listing";
};

function openUrl(url: string) {
  void Linking.openURL(url).catch(() => {});
}

function openPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return;
  void Linking.openURL(`tel:${digits}`).catch(() => {});
}

function handlePress(action: ActionBarAction) {
  if (action.kind === "url" && action.url) {
    trackActionBarExternalAction(action);
    openUrl(action.url);
    return;
  }
  if (action.kind === "phone" && action.phone) {
    openPhone(action.phone);
    return;
  }
  if (action.kind === "maps") {
    const dest: MapsDestination =
      action.mapsDestination ??
      (action.mapsQuery ? { address: action.mapsQuery } : {});
    void openGoogleMapsDestination(dest);
  }
}

/**
 * Newspaper-style contextual actions — editorial links beneath Pin / Save / Share.
 * Discovery lives on the homepage; decision-making lives in the article.
 */
export function ArticleActionList({ actions, variant = "article" }: Props) {
  if (!actions.length) return null;
  const compact = variant === "listing";

  return (
    <View
      style={[styles.block, compact && styles.blockCompact]}
      accessibilityRole="menu"
      accessibilityLabel="Listing actions"
    >
      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => handlePress(action)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${action.icon} ${action.label}`}
          style={({ pressed }) => [
            styles.row,
            compact && styles.rowCompact,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.label, compact && styles.labelCompact]}
            maxFontSizeMultiplier={1.15}
          >
            {action.icon} {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: "stretch",
    marginTop: 8,
    marginBottom: 28,
    paddingTop: 4,
  },
  blockCompact: {
    marginTop: 4,
    marginBottom: 0,
    paddingTop: 0,
  },
  row: {
    alignSelf: "flex-start",
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: "center",
  },
  rowCompact: {
    paddingVertical: 8,
    minHeight: 36,
  },
  label: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.15,
  },
  labelCompact: {
    fontSize: 13,
    lineHeight: 20,
  },
  pressed: {
    opacity: press.opacity,
  },
});
