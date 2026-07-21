import {
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import type { ActionBarAction } from "../lib/edition/actionBar";
import { openGoogleMapsDestination } from "../lib/edition/googleMaps";
import type { MapsDestination } from "../lib/edition/googleMaps";
import { trackActionBarExternalAction, trackArticleShared } from "../lib/analytics";

type Props = {
  actions: ActionBarAction[];
  /** When omitted, save action is hidden even if present in `actions`. */
  onSave?: () => void | Promise<void>;
  onShare?: (action: ActionBarAction) => void | Promise<void>;
  clipped?: boolean;
  /** Card grids use a tighter row; articles use full measure. */
  variant?: "card" | "article";
  shareMessage?: string;
  shareTitle?: string;
  analyticsShare?: {
    contentId: string;
    contentTitle?: string | null;
    sectionType?: string | null;
  };
};

function openUrl(url: string) {
  void Linking.openURL(url).catch(() => {});
}

function openPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return;
  void Linking.openURL(`tel:${digits}`).catch(() => {});
}

export function ActionBar({
  actions,
  onSave,
  onShare,
  clipped = false,
  variant = "card",
  shareMessage,
  shareTitle,
  analyticsShare,
}: Props) {
  const visible = actions.filter((action) => {
    if (action.kind === "save" && !onSave) return false;
    if (action.kind === "share" && !onShare && !shareMessage) return false;
    if (action.kind === "url" && !action.url?.trim()) return false;
    if (action.kind === "phone" && !action.phone?.trim()) return false;
    if (
      action.kind === "maps" &&
      !action.mapsDestination &&
      !action.mapsQuery?.trim() &&
      !action.url?.trim()
    ) {
      return false;
    }
    return true;
  });

  if (visible.length === 0) return null;

  async function handlePress(action: ActionBarAction) {
    if (action.kind === "save") {
      await onSave?.();
      return;
    }
    if (action.kind === "share") {
      if (onShare) {
        await onShare(action);
        return;
      }
      if (shareMessage) {
        try {
          await Share.share({
            message: shareMessage,
            title: shareTitle ?? undefined,
          });
          if (analyticsShare) {
            trackArticleShared(analyticsShare);
          }
        } catch {
          /* dismissed */
        }
      }
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
      return;
    }
    if (action.kind === "url" && action.url) {
      trackActionBarExternalAction(action);
      openUrl(action.url);
    }
  }

  return (
    <View
      style={[styles.row, variant === "article" && styles.rowArticle]}
      accessibilityRole="toolbar"
      accessibilityLabel="Actions"
    >
      {visible.map((action, index) => {
        const label =
          action.kind === "save" && clipped
            ? "Saved to Today's Board"
            : action.label;

        return (
          <View key={`${action.id}-${index}`} style={styles.itemWrap}>
            {index > 0 ? (
              <Text style={styles.dot} accessibilityElementsHidden>
                ·
              </Text>
            ) : null}
            <Pressable
              onPress={() => void handlePress(action)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${action.icon} ${label}`}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text
                style={[
                  styles.actionText,
                  variant === "article" && styles.actionTextArticle,
                  action.kind === "save" && clipped && styles.actionSaved,
                ]}
                maxFontSizeMultiplier={1.15}
              >
                {action.icon} {label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 12,
    gap: 2,
  },
  rowArticle: {
    marginTop: 0,
    paddingTop: 4,
  },
  itemWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.inkFaint,
    marginHorizontal: 6,
  },
  actionText: {
    fontFamily: "Georgia",
    fontSize: 12,
    lineHeight: 18,
    fontStyle: "italic",
    color: paper.terracotta,
  },
  actionTextArticle: {
    fontSize: 14,
    lineHeight: 22,
  },
  actionSaved: {
    color: paper.inkMuted,
  },
  pressed: {
    opacity: press.opacity,
  },
});
