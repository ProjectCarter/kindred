import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Image,
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
import {
  resolveClipTarget,
  checkClipped,
  saveClipping,
  removeClipping,
} from "../lib/edition/clippings";
import { checkLiked, saveLike, removeLike } from "../lib/edition/likes";
import { supabase } from "../lib/supabase";
import { paper, press, reader } from "../lib/edition/newspaperTheme";
import { KindredDetailBackButton } from "./KindredDetailBackButton";
import { PullDownNavHeader } from "./PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { articleBackRowInsets } from "../lib/navigation/articleBackLayout";
import { ArticleActionList } from "./ArticleActionList";
import { ArticleEditorialClosing } from "./ArticleEditorialClosing";
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
  const [clipped, setClipped] = useState(false);
  const [liked, setLiked] = useState(false);
  const [clipPending, setClipPending] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);

  const snapshot = useMemo(
    () => normalizeHistoryPlaceSnapshot(place),
    [place]
  );

  const clipTarget = useMemo(() => resolveClipTarget(article), [article]);
  const canClip = Boolean(clipTarget);
  const practicalActions = useMemo(
    () => resolveArticleContextActions(article),
    [article]
  );
  const uniqueFacts = useMemo(() => filterUniqueFacts(snapshot), [snapshot]);
  const visitorRows = useMemo(() => visitorInfoRows(snapshot), [snapshot]);
  const region = cityRegionLine(snapshot);
  const stateAtAGlance = article.stateAtAGlance ?? null;

  const pullDownNavScreen = usePullDownNavScreen({
    onBack,
    title: snapshot.placeName,
    backAccessibilityLabel: backLabel,
  });

  useEffect(() => {
    if (!clipTarget) {
      setClipped(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setClipped(await checkClipped(user.id, clipTarget.clipKey));
    })();
    return () => {
      cancelled = true;
    };
  }, [clipTarget]);

  useEffect(() => {
    if (!clipTarget) {
      setLiked(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setLiked(await checkLiked(user.id, clipTarget.clipKey));
    })();
    return () => {
      cancelled = true;
    };
  }, [clipTarget]);

  const toggleClip = useCallback(async () => {
    if (!clipTarget || clipPending) return;
    setClipPending(true);
    setClipError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setClipError("Sign in to pin stories to Today's Board.");
        return;
      }
      if (clipped) {
        await removeClipping(user.id, clipTarget.clipKey);
        setClipped(false);
      } else {
        const result = await saveClipping(user.id, clipTarget, article);
        if (!result.ok) {
          setClipError(result.error ?? "Could not save to Today's Board.");
          return;
        }
        setClipped(true);
      }
    } finally {
      setClipPending(false);
    }
  }, [article, clipPending, clipTarget, clipped]);

  const toggleLike = useCallback(async () => {
    if (!clipTarget || likePending) return;
    setLikePending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (liked) {
        await removeLike(user.id, clipTarget.clipKey);
        setLiked(false);
      } else {
        await saveLike(user.id, clipTarget, article);
        setLiked(true);
      }
    } finally {
      setLikePending(false);
    }
  }, [article, clipTarget, likePending, liked]);

  const handleShare = useCallback(async () => {
    const lines = [
      snapshot.placeName,
      snapshot.teaser,
      snapshot.officialWebsite,
    ].filter(Boolean);
    await Share.share({ message: lines.join("\n\n") }).catch(() => {});
  }, [snapshot]);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <StatusBar style="dark" />
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

          <View style={styles.heroActions}>
            {canClip ? (
              <Pressable
                onPress={() => void toggleClip()}
                disabled={clipPending}
                style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={clipped ? "Unpin from Today's Board" : "Pin to Today's Board"}
              >
                <Text style={styles.heroActionText}>
                  {clipped ? "📌 Pinned" : "📌 Pin"}
                </Text>
              </Pressable>
            ) : null}
            {canClip ? (
              <Pressable
                onPress={() => void toggleLike()}
                disabled={likePending}
                style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={liked ? "Unlike" : "Save"}
              >
                <Text style={styles.heroActionText}>
                  {liked ? "❤️ Saved" : "🤍 Save"}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void handleShare()}
              style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Share"
            >
              <Text style={styles.heroActionText}>📤 Share</Text>
            </Pressable>
          </View>

          {clipError ? (
            <Text style={styles.clipError} accessibilityRole="alert">
              {clipError}
            </Text>
          ) : null}

          {practicalActions.length > 0 ? (
            <ArticleActionList actions={practicalActions} />
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

          <ArticleEditorialClosing
            source={article.source}
            onReturn={onBack}
          />
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
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  heroAction: {
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  heroActionText: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.ink,
  },
  pressed: {
    opacity: press.opacity,
  },
  clipError: {
    color: paper.terracotta,
    fontSize: 13,
    marginBottom: 12,
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
    fontSize: 20,
    lineHeight: 34,
  },
  paragraph: {
    ...reader.body,
    marginBottom: 18,
  },
  observation: {
    ...reader.body,
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
});
