import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import { paper, press } from "../lib/edition/newspaperTheme";

/** Polished stand-in for the rare case a card truly has no photo. */
function PhotoFallback({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <View style={[styles.fallback, { width, height }]}>
      <SymbolView
        name="photo"
        size={18}
        weight="light"
        tintColor={paper.inkFaint}
        accessibilityElementsHidden
        importantForAccessibility="no"
        fallback={
          <Ionicons name="image-outline" size={18} color={paper.inkFaint} />
        }
      />
    </View>
  );
}

function CardPhoto({
  source,
  width,
  height,
  label,
}: {
  source: ImageSourcePropType;
  width: number;
  height: number;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <PhotoFallback width={width} height={Math.round(height * 0.4)} />;
  }
  return (
    <Image
      source={source}
      style={{ width, height }}
      resizeMode="cover"
      accessibilityLabel={label}
      onError={() => setFailed(true)}
    />
  );
}

export type TimeStoryCard = {
  id: string;
  kicker?: string | null;
  headline: string;
  dek?: string | null;
  byline?: string | null;
  image?: ImageSourcePropType | null;
  imageLabel?: string | null;
};

type Props = {
  sectionLabel: string;
  /** Center / primary story — TIME’s large middle column. */
  feature: TimeStoryCard;
  /** Flanking stories — TIME’s side columns (shown under feature on narrow screens). */
  sides?: TimeStoryCard[];
  onOpen?: (id: string) => void;
};

/**
 * TIME homepage package: one dominant story + compact supporting stories.
 * On phone width, stacks as feature then a 2-up row — preserving density & rhythm.
 */
export function TimeStylePackage({
  sectionLabel,
  feature,
  sides = [],
  onOpen,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const gutter = 14;
  const sideW = wide
    ? Math.floor((width - 40 - gutter * 2) * 0.25)
    : Math.floor((width - 40 - gutter) / 2);
  const featureW = wide
    ? Math.floor((width - 40 - gutter * 2) * 0.5)
    : width - 40;
  const featureH = Math.round(featureW * (wide ? 0.62 : 0.56));
  const sideH = Math.round(sideW * 1.2);

  const open = (id: string) => {
    if (onOpen) onOpen(id);
  };

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.kicker}>{sectionLabel}</Text>
        <View style={styles.rule} />
      </View>

      <View style={[styles.row, !wide && styles.rowStack]}>
        {wide && sides[0] ? (
          <SideCard
            story={sides[0]}
            width={sideW}
            photoH={sideH}
            onPress={() => open(sides[0].id)}
          />
        ) : null}

        <Pressable
          onPress={() => open(feature.id)}
          disabled={!onOpen}
          style={({ pressed }) => [
            { width: featureW },
            onOpen && pressed && { opacity: press.opacity },
          ]}
          accessibilityRole={onOpen ? "button" : "text"}
          accessibilityLabel={feature.headline}
        >
          {feature.image ? (
            <CardPhoto
              source={feature.image}
              width={featureW}
              height={featureH}
              label={feature.imageLabel || feature.headline}
            />
          ) : (
            <PhotoFallback
              width={featureW}
              height={Math.round(featureH * 0.4)}
            />
          )}
          {feature.kicker ? (
            <Text style={styles.cardKicker}>{feature.kicker}</Text>
          ) : null}
          <Text
            style={[styles.featureHeadline, wide && styles.featureHeadlineWide]}
            maxFontSizeMultiplier={1.2}
          >
            {feature.headline}
          </Text>
          {feature.dek ? (
            <Text style={styles.dek} numberOfLines={3} maxFontSizeMultiplier={1.15}>
              {feature.dek}
            </Text>
          ) : null}
          {feature.byline ? (
            <Text style={styles.byline}>{feature.byline}</Text>
          ) : null}
        </Pressable>

        {wide && sides[1] ? (
          <SideCard
            story={sides[1]}
            width={sideW}
            photoH={sideH}
            onPress={() => open(sides[1].id)}
          />
        ) : null}
      </View>

      {!wide && sides.length > 0 ? (
        <View style={styles.sideRow}>
          {sides.slice(0, 2).map((story) => (
            <SideCard
              key={story.id}
              story={story}
              width={sideW}
              photoH={sideH}
              onPress={() => open(story.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SideCard({
  story,
  width,
  photoH,
  onPress,
}: {
  story: TimeStoryCard;
  width: number;
  photoH: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { width },
        pressed && { opacity: press.opacity },
      ]}
      accessibilityRole="button"
      accessibilityLabel={story.headline}
    >
      {story.image ? (
        <Image
          source={story.image}
          style={{ width, height: photoH }}
          resizeMode="cover"
          accessibilityLabel={story.imageLabel || story.headline}
        />
      ) : (
        <PhotoFallback width={width} height={Math.round(photoH * 0.55)} />
      )}
      {story.kicker ? (
        <Text style={styles.cardKicker}>{story.kicker}</Text>
      ) : null}
      <Text style={styles.sideHeadline} numberOfLines={4} maxFontSizeMultiplier={1.2}>
        {story.headline}
      </Text>
      {story.byline ? (
        <Text style={styles.byline}>{story.byline}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 48,
    paddingBottom: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.4,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  rowStack: {
    flexDirection: "column",
  },
  sideRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 28,
  },
  fallback: {
    backgroundColor: paper.creamDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  cardKicker: {
    marginTop: 10,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  featureHeadline: {
    marginTop: 12,
    fontFamily: "Georgia",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "600",
    letterSpacing: -0.35,
    color: paper.ink,
  },
  featureHeadlineWide: {
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center",
  },
  dek: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: paper.inkMuted,
  },
  sideHeadline: {
    marginTop: 10,
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: -0.15,
    color: paper.ink,
  },
  byline: {
    marginTop: 8,
    fontSize: 11,
    letterSpacing: 0.2,
    color: paper.inkFaint,
  },
});
