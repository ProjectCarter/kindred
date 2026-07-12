import { Text, View, StyleSheet, Pressable } from "react-native";
import { paper, press, reader, type } from "../lib/edition/newspaperTheme";

type Props = {
  kicker: string;
  title?: string | null;
  body: string;
  /** Larger opening callout (Why This Matters). */
  featured?: boolean;
  onPress?: () => void;
};

/**
 * Magazine editorial callout — used only in the Article Reader.
 * Print-inspired desk note: hairline frame, terracotta rule, italic voice.
 * Not a product card.
 */
export function MagazineCallout({
  kicker,
  title,
  body,
  featured,
  onPress,
}: Props) {
  if (!body.trim()) return null;

  const content = (
    <View style={[styles.inner, featured && styles.innerFeatured]}>
      <View style={styles.topRule} />
      <Text style={styles.kicker}>{kicker}</Text>
      {title?.trim() && title.trim() !== kicker ? (
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          {title.trim()}
        </Text>
      ) : null}
      <Text
        style={[styles.body, featured && styles.bodyFeatured]}
        maxFontSizeMultiplier={1.35}
      >
        {body.trim()}
      </Text>
      <View style={styles.bottomRule} />
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={`${kicker}. ${body}`}
        hitSlop={6}
        style={({ pressed }) => [
          styles.wrap,
          featured && styles.wrapFeatured,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.wrap, featured && styles.wrapFeatured]}
      accessible
      accessibilityLabel={`${kicker}. ${body}`}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 32,
  },
  wrapFeatured: {
    marginBottom: 38,
  },
  pressed: {
    opacity: press.opacity,
  },
  inner: {
    backgroundColor: paper.creamWash,
    paddingVertical: 24,
    paddingHorizontal: 22,
  },
  innerFeatured: {
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  topRule: {
    height: 2,
    width: 32,
    backgroundColor: paper.terracotta,
    marginBottom: 16,
    opacity: 0.85,
  },
  bottomRule: {
    marginTop: 20,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 10,
    letterSpacing: 2,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
    color: paper.ink,
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  body: {
    ...reader.calloutBody,
    color: paper.inkBody,
  },
  bodyFeatured: {
    fontSize: 17,
    lineHeight: 29,
  },
});
