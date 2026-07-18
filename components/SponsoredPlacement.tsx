import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { paper, press, space, type } from "../lib/edition/newspaperTheme";
import {
  HOME_AFTER_ACTIVITIES_PLACEMENT_ID,
  resolveSponsoredPlacementContent,
  type SponsoredPlacementContent,
} from "../lib/features/sponsoredPlacement";

type Props = {
  /** Defaults to the homepage slot after Activities. */
  placementId?: string;
  /** Override resolved creative — useful for isolated previews/tests. */
  content?: SponsoredPlacementContent | null;
};

/**
 * Optional newspaper-style sponsored card — future-ready for AdMob Native,
 * direct sponsorships, and Kindred house announcements. Renders nothing when
 * disabled; makes no ad network requests.
 */
export function SponsoredPlacement({
  placementId = HOME_AFTER_ACTIVITIES_PLACEMENT_ID,
  content,
}: Props) {
  const resolved =
    content === undefined
      ? resolveSponsoredPlacementContent(placementId)
      : content;

  if (!resolved) return null;

  return (
    <SponsoredPlacementCard
      content={resolved}
      onPress={() => {
        if (!resolved.destinationUrl.trim()) return;
        void Linking.openURL(resolved.destinationUrl).catch(() => {});
      }}
    />
  );
}

type CardProps = {
  content: SponsoredPlacementContent;
  onPress?: () => void;
};

function SponsoredPlacementCard({ content, onPress }: CardProps) {
  const { width } = useWindowDimensions();
  const pageW = width - space.folioGutter * 2;
  const photoH = Math.round(pageW * 0.42);

  return (
    <View
      style={styles.section}
      accessibilityRole="summary"
      accessibilityLabel={`${content.sponsorLabel}. ${content.sponsorName}. ${content.headline}`}
    >
      <View style={styles.labelRow}>
        <Text style={styles.sponsorLabel}>{content.sponsorLabel}</Text>
        <View style={styles.labelRule} />
      </View>

      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "link" : "text"}
        accessibilityLabel={[
          content.sponsorName,
          content.headline,
          content.description,
        ]
          .filter(Boolean)
          .join(". ")}
        style={({ pressed }) => [
          styles.card,
          onPress && pressed && { opacity: press.opacity },
        ]}
      >
        <View style={styles.photoFrame}>
          <Image
            source={content.image}
            style={{ width: "100%", height: photoH }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.sponsorName} maxFontSizeMultiplier={1.2}>
            {content.sponsorName}
          </Text>
          <Text style={styles.headline} maxFontSizeMultiplier={1.25}>
            {content.headline}
          </Text>
          <Text style={styles.description} maxFontSizeMultiplier={1.25}>
            {content.description}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 48,
    paddingBottom: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  sponsorLabel: {
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkMuted,
  },
  labelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  card: {
    backgroundColor: paper.creamWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    borderRadius: 2,
    overflow: "hidden",
  },
  photoFrame: {
    backgroundColor: paper.creamDeep,
  },
  copy: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
  },
  sponsorName: {
    ...type.kicker,
    color: paper.inkMuted,
    letterSpacing: 1.4,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 28,
    color: paper.ink,
  },
  description: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkBody,
  },
});
