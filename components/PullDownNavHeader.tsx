import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MastheadLink } from "./KindredMasthead";
import {
  PULL_DOWN_NAV_BAR_HEIGHT,
} from "../lib/navigation/usePullDownNav";
import { paper, shadow, type } from "../lib/edition/newspaperTheme";

type Props = {
  title: string;
  translateY: Animated.Value;
  visible: boolean;
  onBack: () => void;
  backAccessibilityLabel?: string;
};

/**
 * Compact navigation revealed by a gentle downward pull on long pages.
 * Slides from above the viewport; never stays permanently visible.
 */
export function PullDownNavHeader({
  title,
  translateY,
  visible,
  onBack,
  backAccessibilityLabel = "Back",
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.wrap,
        {
          transform: [{ translateY }],
        },
      ]}
      accessibilityElementsHidden={!visible}
    >
      <View
        style={[
          styles.panel,
          { paddingTop: insets.top },
          shadow.page,
        ]}
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
