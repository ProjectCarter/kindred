import { Image, StyleSheet, View, type ImageProps, type ViewStyle } from "react-native";
import { kindredGold, masterpiece, paper } from "../lib/edition/newspaperTheme";

export type MasterpieceFrameProps = {
  imageUri: string;
  width: number;
  height: number;
  imageOpacity?: number;
  onImageError?: ImageProps["onError"];
  accessibilityLabel?: string;
  style?: ViewStyle;
};

const HAIRLINE = StyleSheet.hairlineWidth;

/**
 * Museum double hairline — official Kindred Gold, paper mat, no effects.
 */
export function MasterpieceFrame({
  imageUri,
  width,
  height,
  imageOpacity = 1,
  onImageError,
  accessibilityLabel,
  style,
}: MasterpieceFrameProps) {
  return (
    <View style={[styles.outer, { width }, style]}>
      <View style={styles.inner}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: "100%", height, opacity: imageOpacity }}
          resizeMode="cover"
          accessibilityLabel={accessibilityLabel}
          onError={onImageError}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: HAIRLINE,
    borderColor: kindredGold.primary,
    borderRadius: masterpiece.frameRadius,
    padding: masterpiece.frameInset,
    backgroundColor: paper.page,
  },
  inner: {
    overflow: "hidden",
    borderWidth: HAIRLINE,
    borderColor: kindredGold.frameInner,
    borderRadius: Math.max(0, masterpiece.frameRadius - 1),
  },
});
