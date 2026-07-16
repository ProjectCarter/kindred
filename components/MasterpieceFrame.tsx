import { Image, StyleSheet, View, type ImageProps, type ViewStyle } from "react-native";
import { kindredGold, masterpiece, paper, shadow } from "../lib/edition/newspaperTheme";

export type MasterpieceFrameProps = {
  imageUri: string;
  width: number;
  height: number;
  imageOpacity?: number;
  onImageError?: ImageProps["onError"];
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/**
 * Kindred Gold mat + frame — museum-quality signature presentation.
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
  const innerWidth = width - masterpiece.matPadding * 2;
  const innerHeight = height;

  return (
    <View style={[styles.mat, { width }, style]}>
      <View style={styles.frame}>
        <Image
          source={{ uri: imageUri }}
          style={{
            width: innerWidth,
            height: innerHeight,
            opacity: imageOpacity,
          }}
          resizeMode="cover"
          accessibilityLabel={accessibilityLabel}
          onError={onImageError}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mat: {
    backgroundColor: masterpiece.matColor,
    padding: masterpiece.matPadding,
    ...shadow.photo,
  },
  frame: {
    overflow: "hidden",
    borderWidth: masterpiece.frameBorderWidth,
    borderColor: kindredGold.primary,
    borderRadius: masterpiece.frameRadius,
    backgroundColor: paper.creamDeep,
  },
});
