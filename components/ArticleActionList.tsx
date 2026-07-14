import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import type { ActionBarAction } from "../lib/edition/actionBar";
import { openGoogleMapsDestination } from "../lib/edition/googleMaps";
import type { MapsDestination } from "../lib/edition/googleMaps";

type Props = {
  actions: ActionBarAction[];
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
export function ArticleActionList({ actions }: Props) {
  if (!actions.length) return null;

  return (
    <View
      style={styles.block}
      accessibilityRole="menu"
      accessibilityLabel="Article actions"
    >
      {actions.map((action) => (
        <Pressable
          key={action.id}
          onPress={() => handlePress(action)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${action.icon} ${action.label}`}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.label} maxFontSizeMultiplier={1.15}>
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
  row: {
    alignSelf: "flex-start",
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: "center",
  },
  label: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.15,
  },
  pressed: {
    opacity: press.opacity,
  },
});
