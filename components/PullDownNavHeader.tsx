import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MastheadLink } from "./KindredMasthead";
import { PULL_DOWN_NAV_BAR_HEIGHT } from "../lib/navigation/usePullDownNav";
import { paper, type } from "../lib/edition/newspaperTheme";

type Props = {
  title: string;
  translateY: Animated.Value;
  onBack: () => void;
  backAccessibilityLabel?: string;
};

/**
 * Temporary back navigation — absolute overlay only.
 * Slides above scroll content; never resizes or obscures the page layout.
 */
export function PullDownNavHeader({
  title,
  translateY,
  onBack,
  backAccessibilityLabel = "Back",
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          transform: [{ translateY }],
        },
      ]}
      accessibilityElementsHidden
    >
      <View
        style={[styles.panel, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <View style={styles.bar}>
          <MastheadLink
            label="← Back"
            onPress={onBack}
            accessibilityLabel={backAccessibilityLabel}
          />
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  panel: {
    backgroundColor: paper.page,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
    shadowColor: "#2D2926",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  bar: {
    height: PULL_DOWN_NAV_BAR_HEIGHT,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  title: {
    ...type.kicker,
    flexShrink: 1,
    color: paper.inkMuted,
    letterSpacing: 1.6,
    textAlign: "right",
  },
});
