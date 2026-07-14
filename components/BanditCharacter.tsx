import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BANDIT_ASSETS, BANDIT_SIGNATURE_POSE, type BanditPose } from "../lib/bandit/character";

type Props = {
  /** Which established v1.0 pose to render. Defaults to Bandit's signature pose. */
  pose?: BanditPose;
  /** Rendered size — Bandit's illustrations are square-canvas, so width == height. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Overrides the default accessibility label for this placement. */
  accessibilityLabel?: string;
  /**
   * Set when a wrapping element already announces Bandit's presence and
   * message (e.g. an `accessible` parent View with its own label), so his
   * portrait doesn't get read out twice by screen readers.
   */
  decorative?: boolean;
};

/**
 * The single reusable surface for rendering Bandit anywhere in the app.
 *
 * Every screen should render Bandit through this component rather than
 * `require`-ing an asset directly, so future pose additions and any
 * corrections stay centralized in `lib/bandit/character.ts`.
 */
export function BanditCharacter({
  pose = BANDIT_SIGNATURE_POSE,
  size = 96,
  style,
  accessibilityLabel = "Bandit, Kindred's newspaper dog",
  decorative = false,
}: Props) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image
        source={BANDIT_ASSETS[pose]}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel={decorative ? undefined : accessibilityLabel}
        accessibilityElementsHidden={decorative}
        importantForAccessibility={decorative ? "no" : "auto"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
  },
});
