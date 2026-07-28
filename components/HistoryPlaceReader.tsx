import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ShareIconButton } from "./ShareIconButton";
import type { KindredArticle } from "../lib/edition/article";
import type { HistoryPlaceSnapshot } from "../lib/edition/historyAroundTown/types";
import {
  cityRegionLine,
  filterUniqueFacts,
  normalizeHistoryPlaceSnapshot,
  visitorInfoRows,
} from "../lib/edition/historyAroundTown/types";
import {
  resolveArticleContextActions,
} from "../lib/edition/actionBar";
import { trackArticleShared } from "../lib/analytics";
import { paper, press, reader } from "../lib/edition/newspaperTheme";
import { KindredDetailBackButton } from "./KindredDetailBackButton";
import { PullDownNavHeader } from "./PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { articleBackRowInsets } from "../lib/navigation/articleBackLayout";
import {
  DetailActionButton,
  DetailActionStack,
} from "./DetailActionButton";
import {
  GOOGLE_MAPS_ACTION_LABEL,
  openGoogleMapsDestination,
} from "../lib/edition/googleMaps";
import { StateAtAGlanceSection } from "./StateAtAGlanceSection";

type Props = {
  article: KindredArticle;
  place: HistoryPlaceSnapshot;
  onBack: () => void;
  backLabel?: string;
};

function EditorialSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.1}>
        {heading}
      </Text>
      {children}
    </View>
  );
}

/** Premium History Around Town reader — frozen snapshot only. */
export function HistoryPlaceReader({
  article,
  place,
  onBack,
  backLabel = "← Today's paper",
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const readingWidth = Math.min(windowWidth - reader.gutter * 2, reader.measure);
  const [heroFailed, setHeroFailed] = useState(false);

  const snapshot = useMemo(
    () => normalizeHistoryPlaceSnapshot(place),
    [place]
  );

  const practicalActions = useMemo(
    () => resolveArticleContextActions(article),
    [article]
  );
  const mapsAction = useMemo(
    () => practicalActions.find((action) => action.id === "maps") ?? null,
    [practicalActions]
  );
  const learnMoreUrl = useMemo(() => {
    const site = practicalActions.find(
      (action) =>
        (action.id === "website" ||
          action.id === "learn_more" ||
          action.id === "official_event_page") &&
        action.url?.trim()
    );
    return site?.url?.trim() ?? snapshot.officialWebsite?.trim() ?? null;
  }, [practicalActions, snapshot.officialWebsite]);
  const uniqueFacts = useMemo(() => filterUniqueFacts(snapshot), [snapshot]);
  const visitorRows = useMemo(() => visitorInfoRows(snapshot), [snapshot]);
  const region = cityRegionLine(snapshot);
  const stateAtAGlance = article.stateAtAGlance ?? null;

  const pullDownNavScreen = usePullDownNavScreen({
    onBack,
    title: snapshot.placeName,
    backAccessibilityLabel: backLabel,
  });

  const handleShare = useCallback(async () => {
    const lines = [
      snapshot.placeName,
      snapshot.teaser,
      snapshot.officialWebsite,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join("\n\n") });
      trackArticleShared({
        contentId: article.id,
        contentTitle: snapshot.placeName,
        sectionType: article.section,
      });
    } catch {
      /* dismissed */
    }
  }, [snapshot, article.id, article.section]);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
      >
        <View
          style={[styles.backRow, articleBackRowInsets(insets.top)]}
        >
          <KindredDetailBackButton onPress={onBack} label={backLabel} />
        </View>

        {snapshot.heroImageUrl && !heroFailed ? (
          <View style={[styles.heroFrame, { width: readingWidth }]}>
            <Image
              source={{ uri: snapshot.heroImageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              accessibilityLabel={snapshot.placeName}
              onError={() => setHeroFailed(true)}
            />
            {snapshot.imageCredit ? (
              <Text style={styles.heroCredit} maxFontSizeMultiplier={1.1}>
                {snapshot.imageCredit}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.column, { width: readingWidth }]}>
          <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
            {snapshot.categoryLabel}
          </Text>
          <Text style={styles.headline} maxFontSizeMultiplier={1.2}>
            {snapshot.placeName}
          </Text>
          {region ? (
            <Text style={styles.region} maxFontSizeMultiplier={1.12}>
              {region}
            </Text>
          ) : null}
          {snapshot.historicalMetadataLine ? (
            <Text style={styles.metadataLine} maxFontSizeMultiplier={1.12}>
              {snapshot.historicalMetadataLine}
            </Text>
          ) : null}

          {snapshot.designations.length > 0 ? (
            <View style={styles.badgeRow}>
              {snapshot.designations.map((badge) => (
                <View key={badge} style={styles.badge}>
                  <Text style={styles.badgeText} maxFontSizeMultiplier={1.05}>
                    {badge}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Share — the standard interaction row used on every detail page. */}
          <View style={styles.iconRow}>
            <ShareIconButton
              onPress={() => void handleShare()}
              style={styles.iconButton}
            />
          </View>

          {/* Google Maps + Learn More — the standardized outlined detail buttons. */}
          {mapsAction || learnMoreUrl ? (
            <DetailActionStack style={styles.actions}>
              {mapsAction ? (
                <DetailActionButton
                  label={GOOGLE_MAPS_ACTION_LABEL}
                  variant="secondary"
                  accessibilityRole="link"
                  accessibilityLabel={GOOGLE_MAPS_ACTION_LABEL}
                  onPress={() => {
                    if (mapsAction.mapsDestination) {
                      void openGoogleMapsDestination(mapsAction.mapsDestination);
                    } else if (mapsAction.url) {
                      void Linking.openURL(mapsAction.url).catch(() => {});
                    }
                  }}
                />
              ) : null}
              {learnMoreUrl ? (
                <DetailActionButton
                  label="Learn More"
                  variant="secondary"
                  accessibilityRole="link"
                  accessibilityLabel="Learn More"
                  onPress={() =>
                    void Linking.openURL(learnMoreUrl).catch(() => {})
                  }
                />
              ) : null}
            </DetailActionStack>
          ) : null}

          {snapshot.editorialIntroduction ? (
            <EditorialSection heading="Introduction">
              <Text style={styles.leadParagraph} maxFontSizeMultiplier={1.2}>
                {snapshot.editorialIntroduction}
              </Text>
            </EditorialSection>
          ) : null}

          {visitorRows.length > 0 ? (
            <EditorialSection heading="Visitor Information">
              {visitorRows.map((row) => (
                <View key={row.label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue} maxFontSizeMultiplier={1.15}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </EditorialSection>
          ) : null}

          {snapshot.theStory.length > 0 ? (
            <EditorialSection heading="The Story">
              {snapshot.theStory.map((paragraph, index) => (
                <Text
                  key={`story-${index}`}
                  style={styles.paragraph}
                  maxFontSizeMultiplier={1.2}
                >
                  {paragraph}
                </Text>
              ))}
            </EditorialSection>
          ) : null}

          {snapshot.lookingCloser.length > 0 ? (
            <EditorialSection heading="Looking Closer">
              {snapshot.lookingCloser.map((item, index) => (
                <Text
                  key={`look-${index}`}
                  style={styles.observation}
                  maxFontSizeMultiplier={1.15}
                >
                  {item}
                </Text>
              ))}
            </EditorialSection>
          ) : null}

          {snapshot.timeline.length >= 2 ? (
            <EditorialSection heading="Timeline">
              {snapshot.timeline.map((entry, index) => (
                <View
                  key={`${entry.year}-${index}`}
                  style={[
                    styles.timelineRow,
                    index < snapshot.timeline.length - 1 && styles.timelineRowBorder,
                  ]}
                >
                  <Text style={styles.timelineYear}>{entry.year}</Text>
                  <Text style={styles.timelineEvent} maxFontSizeMultiplier={1.15}>
                    {entry.event}
                  </Text>
                </View>
              ))}
            </EditorialSection>
          ) : null}

          {snapshot.visitingToday ? (
            <EditorialSection heading="Visiting Today">
              <Text style={styles.paragraph} maxFontSizeMultiplier={1.2}>
                {snapshot.visitingToday}
              </Text>
            </EditorialSection>
          ) : null}

          {snapshot.beforeYouGo ? (
            <EditorialSection heading="Before You Go">
              <Text style={styles.paragraph} maxFontSizeMultiplier={1.2}>
                {snapshot.beforeYouGo}
              </Text>
            </EditorialSection>
          ) : null}

          {uniqueFacts.length > 0 ? (
            <EditorialSection heading="Did You Know?">
              {uniqueFacts.map((fact, index) => (
                <Text
                  key={`fact-${index}`}
                  style={styles.factItem}
                  maxFontSizeMultiplier={1.15}
                >
                  · {fact}
                </Text>
              ))}
            </EditorialSection>
          ) : null}

          {stateAtAGlance ? (
            <StateAtAGlanceSection
              glance={stateAtAGlance}
              contentWidth={readingWidth}
              layout="editorial"
            />
          ) : null}

          {snapshot.whyItMatters ? (
            <EditorialSection heading="Why We Remember">
              <Text style={styles.paragraph} maxFontSizeMultiplier={1.2}>
                {snapshot.whyItMatters}
              </Text>
            </EditorialSection>
          ) : null}

          {snapshot.closingNote ? (
            <View style={styles.closingBlock}>
              <Text style={styles.closingNote} maxFontSizeMultiplier={1.2}>
                {snapshot.closingNote}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back to Homepage"
            style={({ pressed }) => [
              styles.homeReturnRow,
              pressed && styles.homeReturnPressed,
            ]}
          >
            <Text style={styles.homeReturnLink} maxFontSizeMultiplier={1.15}>
              ← Back to Homepage
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <PullDownNavHeader {...pullDownNavScreen.headerProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.page,
  },
  content: {
    paddingHorizontal: reader.gutter,
  },
  backRow: {
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  heroFrame: {
    alignSelf: "center",
    marginBottom: 28,
    backgroundColor: paper.creamDeep,
    overflow: "hidden",
    borderRadius: 2,
  },
  heroImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  heroCredit: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
    color: paper.inkMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  column: {
    alignSelf: "center",
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 12,
  },
  headline: {
    ...reader.headline,
    color: paper.ink,
    marginBottom: 10,
  },
  region: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkMuted,
    marginBottom: 6,
  },
  metadataLine: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    color: paper.inkBody,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    backgroundColor: paper.creamWash,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.6,
    color: paper.inkMuted,
    fontWeight: "600",
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginBottom: 22,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  actions: {
    marginBottom: 4,
  },
  pressed: {
    opacity: press.opacity,
  },
  section: {
    marginTop: 28,
    paddingTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 2.2,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 14,
  },
  leadParagraph: {
    ...reader.body,
    color: paper.inkBody,
    fontSize: 20,
    lineHeight: 34,
  },
  paragraph: {
    ...reader.body,
    color: paper.inkBody,
    marginBottom: 18,
  },
  observation: {
    ...reader.body,
    color: paper.inkBody,
    fontSize: 17,
    lineHeight: 28,
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: paper.inkRule,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 12,
  },
  timelineRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  timelineYear: {
    width: 72,
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: paper.ink,
  },
  timelineEvent: {
    flex: 1,
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
  },
  factItem: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
    marginBottom: 10,
  },
  closingBlock: {
    marginTop: 28,
  },
  closingNote: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 30,
    fontStyle: "italic",
    color: paper.ink,
  },
  homeReturnRow: {
    marginTop: 36,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  homeReturnLink: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.15,
  },
  homeReturnPressed: {
    opacity: press.opacity,
  },
});
