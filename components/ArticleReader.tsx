import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Share,
  Animated,
  Easing,
  AppState,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { KindredArticle } from "../lib/edition/article";
import {
  formatArticlePublishedAt,
  isKindredBriefing,
} from "../lib/edition/article";
import {
  getArticleCompanion,
  type ArticleCompanion,
  type ContinueReadingItem,
} from "../lib/edition/articleCompanion";
import {
  stashArticleSession,
  updateArticleSessionScroll,
} from "../lib/edition/articleSession";
import {
  paper,
  type,
  reader,
  shadow,
  press,
  motion,
} from "../lib/edition/newspaperTheme";
import {
  useArticleReadingSession,
  inferTopicFromSection,
  trackReadingSignal,
} from "../lib/personalization";
import { supabase } from "../lib/supabase";
import { MagazineCallout } from "./MagazineCallout";

type Props = {
  article: KindredArticle;
  onBack: () => void;
  editionId?: string | null;
  companion?: ArticleCompanion | null;
  backLabel?: string;
  clipSectionId?: string | null;
  initialScrollY?: number;
  onOpenContinue?: (item: ContinueReadingItem) => void;
};

/**
 * Shared native article reader — premium print magazine craft.
 * Kindred first; publisher source second.
 */
export function ArticleReader({
  article,
  onBack,
  editionId,
  companion: companionProp,
  backLabel = "← Today’s paper",
  clipSectionId = null,
  initialScrollY = 0,
  onOpenContinue,
}: Props) {
  const companion =
    companionProp ?? getArticleCompanion(article.id) ?? null;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const readingWidth = Math.min(windowWidth - 48, reader.measure);
  const figureBleed = Math.min(
    18,
    Math.max(0, (windowWidth - readingWidth) / 2)
  );

  const [contentHeight, setContentHeight] = useState(1);
  const [viewportHeight, setViewportHeight] = useState(1);
  const [progress, setProgress] = useState(0);
  const [heroFailed, setHeroFailed] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [clipped, setClipped] = useState(false);
  const [clipPending, setClipPending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(initialScrollY);
  const restoredScroll = useRef(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterRise = useRef(new Animated.Value(motion.risePx + 4)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  const briefing = isKindredBriefing(article);
  const canClip = Boolean(clipSectionId);
  const continueItems = companion?.continueReading ?? [];
  const knowledgeNotes = companion?.knowledgeNotes ?? [];

  useArticleReadingSession(article, progress, { editionId });

  useEffect(() => {
    enterOpacity.setValue(0);
    enterRise.setValue(motion.risePx + 4);
    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: motion.enterMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterRise, {
        toValue: 0,
        duration: motion.enterMs + 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [article.id, enterOpacity, enterRise]);

  useEffect(() => {
    setHeroFailed(false);
    setHeroReady(false);
    heroOpacity.setValue(0);
  }, [article.id, article.heroImage?.uri, heroOpacity]);

  useEffect(() => {
    if (!heroReady) return;
    Animated.timing(heroOpacity, {
      toValue: 1,
      duration: motion.photoMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [heroReady, heroOpacity]);

  useEffect(() => {
    stashArticleSession({
      article,
      companion,
      editionId: editionId ?? null,
      backLabel,
      clipSectionId,
      scrollY: scrollYRef.current,
      updatedAt: Date.now(),
    });
  }, [article, companion, editionId, backLabel, clipSectionId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        updateArticleSessionScroll(article.id, scrollYRef.current);
        stashArticleSession({
          article,
          companion,
          editionId: editionId ?? null,
          backLabel,
          clipSectionId,
          scrollY: scrollYRef.current,
          updatedAt: Date.now(),
        });
      }
    });
    return () => sub.remove();
  }, [article, companion, editionId, backLabel, clipSectionId]);

  useEffect(() => {
    if (!clipSectionId) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("clippings")
        .select("id")
        .eq("user_id", user.id)
        .eq("section_id", clipSectionId)
        .maybeSingle();
      if (!cancelled) setClipped(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [clipSectionId]);

  const published = formatArticlePublishedAt(article.publishedAt);
  const readLabel = formatReadTime(article.estimatedReadMinutes);
  const metaParts = [published, readLabel].filter(Boolean) as string[];

  const pullQuote = article.pullQuote;
  const pullIndex = useMemo(() => {
    if (!pullQuote || article.body.length < 2) return -1;
    return Math.min(
      Math.max(1, Math.floor(article.body.length * 0.33)),
      article.body.length - 1
    );
  }, [pullQuote, article.body.length]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } =
        event.nativeEvent;
      scrollYRef.current = contentOffset.y;
      const scrollable = Math.max(
        contentSize.height - layoutMeasurement.height,
        1
      );
      const next = Math.min(1, Math.max(0, contentOffset.y / scrollable));
      progressAnim.setValue(next);
      setProgress(next);
      updateArticleSessionScroll(article.id, contentOffset.y);
    },
    [progressAnim, article.id]
  );

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      setContentHeight(Math.max(h, 1));
      if (!restoredScroll.current && initialScrollY > 0 && h > initialScrollY) {
        restoredScroll.current = true;
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: initialScrollY,
            animated: false,
          });
        });
      }
    },
    [initialScrollY]
  );

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(Math.max(event.nativeEvent.layout.height, 1));
  }, []);

  useEffect(() => {
    if (contentHeight <= viewportHeight + 8) {
      progressAnim.setValue(0);
    }
  }, [contentHeight, viewportHeight, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  async function handleToggleClip() {
    if (!clipSectionId || clipPending) return;
    setClipPending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const storyKey = `${article.section}:${article.headline}`.slice(0, 240);
      const topic = inferTopicFromSection(article.section, article.headline);

      if (clipped) {
        const { error } = await supabase
          .from("clippings")
          .delete()
          .eq("user_id", user.id)
          .eq("section_id", clipSectionId);
        if (!error) {
          setClipped(false);
          void trackReadingSignal({
            signalType: "unclip",
            storyKey,
            sectionType: article.section,
            editionId,
            sectionId: clipSectionId,
            source: article.source,
            topic,
          });
        }
      } else {
        let insertError = (
          await supabase.from("clippings").insert({
            user_id: user.id,
            section_id: clipSectionId,
            section_type: article.section,
            story_key: storyKey,
            source: article.source,
            headline: article.headline.slice(0, 240),
          })
        ).error;

        if (insertError && insertError.code !== "23505") {
          insertError = (
            await supabase.from("clippings").insert({
              user_id: user.id,
              section_id: clipSectionId,
            })
          ).error;
        }

        const duplicate =
          insertError?.code === "23505" ||
          /duplicate|unique/i.test(insertError?.message ?? "");

        if (!insertError || duplicate) {
          setClipped(true);
          if (!duplicate) {
            void trackReadingSignal({
              signalType: "clip",
              storyKey,
              sectionType: article.section,
              editionId,
              sectionId: clipSectionId,
              source: article.source,
              topic,
              payload: { headline: article.headline.slice(0, 160) },
            });
          }
        }
      }
    } finally {
      setClipPending(false);
    }
  }

  function openSource() {
    if (!article.sourceUrl) return;
    updateArticleSessionScroll(article.id, scrollYRef.current);
    stashArticleSession({
      article,
      companion,
      editionId: editionId ?? null,
      backLabel,
      clipSectionId,
      scrollY: scrollYRef.current,
      updatedAt: Date.now(),
    });
    void Linking.openURL(article.sourceUrl).catch(() => {});
  }

  async function handleShare() {
    const parts = [article.headline];
    if (article.dek) parts.push(article.dek);
    if (article.sourceUrl) {
      parts.push("", article.sourceUrl);
    } else {
      parts.push("", "Shared from Kindred");
    }
    try {
      await Share.share({
        message: parts.join("\n"),
        title: article.headline,
      });
    } catch {
      /* User dismissed share sheet. */
    }
  }

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom * 0.25 },
      ]}
    >
      <View style={styles.progressTrack} accessibilityElementsHidden>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={backLabel.replace(/^←\s*/, "Back to ")}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.back}>{backLabel}</Text>
        </Pressable>
        <Text style={styles.sectionTag} numberOfLines={1}>
          {formatSectionLabel(article.section)}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 88 + insets.bottom },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}
        bounces
        decelerationRate="normal"
      >
        <Animated.View
          style={[
            styles.column,
            {
              width: readingWidth,
              opacity: enterOpacity,
              transform: [{ translateY: enterRise }],
            },
          ]}
        >
          <View style={styles.mastheadRule} />

          <Text style={styles.kicker}>
            {briefing
              ? "Kindred briefing"
              : formatSectionLabel(article.section)}
          </Text>

          <Text style={styles.headline} maxFontSizeMultiplier={1.25}>
            {article.headline}
          </Text>

          {article.dek ? (
            <Text style={styles.dek} maxFontSizeMultiplier={1.25}>
              {article.dek}
            </Text>
          ) : null}

          <View style={styles.bylineBlock}>
            {article.byline ? (
              <Text style={styles.byline} maxFontSizeMultiplier={1.2}>
                {article.byline}
              </Text>
            ) : null}
            {metaParts.length > 0 ? (
              <Text style={styles.meta} maxFontSizeMultiplier={1.15}>
                {metaParts.join("  ·  ")}
              </Text>
            ) : (
              <Text style={styles.meta} maxFontSizeMultiplier={1.15}>
                {article.source}
              </Text>
            )}
          </View>

          {briefing ? (
            <Text style={styles.briefingNote} maxFontSizeMultiplier={1.25}>
              {article.body.length <= 1
                ? "A short Kindred note — limited source text was available. View the original source for the full publisher report."
                : "A Kindred summary for your morning paper — not the full article from the publisher."}
            </Text>
          ) : null}

          {companion?.whyThisMatters?.summary ? (
            <MagazineCallout
              kicker="Why this matters"
              title={
                companion.whyThisMatters.title !== "Why this matters"
                  ? companion.whyThisMatters.title
                  : null
              }
              body={companion.whyThisMatters.summary}
              featured
            />
          ) : null}

          {companion?.whyChosen ? (
            <MagazineCallout
              kicker="Why it’s in your paper"
              body={companion.whyChosen}
            />
          ) : null}

          {article.heroImage?.uri && !heroFailed ? (
            <View
              style={[
                styles.figure,
                {
                  marginHorizontal: -figureBleed,
                  width: readingWidth + figureBleed * 2,
                },
              ]}
            >
              <View style={[styles.imageFrame, shadow.photo]}>
                {!heroReady ? <View style={styles.imagePlaceholder} /> : null}
                <Animated.View
                  style={[styles.imageFade, { opacity: heroOpacity }]}
                >
                  <Image
                    source={{ uri: article.heroImage.uri }}
                    style={styles.image}
                    resizeMode="cover"
                    accessibilityLabel={
                      article.heroImage.caption || article.headline
                    }
                    onLoad={() => setHeroReady(true)}
                    onError={() => setHeroFailed(true)}
                  />
                </Animated.View>
              </View>
              {(article.heroImage.caption || article.heroImage.credit) && (
                <View style={styles.captionBlock}>
                  <View style={styles.captionRule} />
                  <View style={styles.captionCopy}>
                    {article.heroImage.caption ? (
                      <Text style={styles.caption} maxFontSizeMultiplier={1.2}>
                        {article.heroImage.caption}
                      </Text>
                    ) : null}
                    {article.heroImage.credit ? (
                      <Text style={styles.credit} maxFontSizeMultiplier={1.15}>
                        {article.heroImage.credit}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noImageRule} />
          )}

          {(article.body ?? []).map((paragraph, index) => (
            <View key={`p-${index}`}>
              <BodyParagraph
                text={paragraph}
                isLead={index === 0 && !briefing}
              />
              {pullQuote && index === pullIndex ? (
                <PullQuote text={pullQuote} />
              ) : null}
            </View>
          ))}

          {knowledgeNotes.length > 0 ? (
            <View style={styles.knowledgeBlock}>
              <Text style={styles.knowledgeHeading}>Kindred context</Text>
              <View style={styles.knowledgeRule} />
              {knowledgeNotes.map((note, i) => (
                <MagazineCallout
                  key={`${note.kicker}-${i}`}
                  kicker={note.kicker}
                  title={
                    note.title && note.title !== note.kicker
                      ? note.title
                      : null
                  }
                  body={note.summary}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.colophon}>
            <View style={styles.footerRule} />
            <Text style={styles.endMark}>◆</Text>
            <Text style={styles.attribution}>
              From the edition  ·  {article.source}
            </Text>
            {briefing && article.sourceUrl ? (
              <Text style={styles.sourceHint} maxFontSizeMultiplier={1.2}>
                For the complete piece from the publisher, view the original
                source — then return here to continue your paper.
              </Text>
            ) : null}
          </View>

          {continueItems.length > 0 && onOpenContinue ? (
            <View style={styles.continueBlock}>
              <Text style={styles.continueKicker}>Continue reading</Text>
              <Text style={styles.continueIntro}>
                Related pages from today’s edition.
              </Text>
              {continueItems.map((item, index) => (
                <Pressable
                  key={`${item.kind}-${index}`}
                  onPress={() => onOpenContinue?.(item)}
                  accessibilityRole="link"
                  accessibilityLabel={`${item.label}. ${item.title}`}
                  style={({ pressed }) => [
                    styles.continueItem,
                    index === continueItems.length - 1 && styles.continueItemLast,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.continueLabel}>{item.label}</Text>
                  <Text
                    style={styles.continueTitle}
                    maxFontSizeMultiplier={1.25}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={styles.continueSummary}
                    maxFontSizeMultiplier={1.25}
                  >
                    {item.summary}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.actionsBlock}>
            <Text style={styles.actionsKicker}>This article</Text>
            <View style={styles.actionsList}>
              {canClip ? (
                <ActionLink
                  label={
                    clipPending
                      ? "Saving…"
                      : clipped
                        ? "Saved"
                        : "Save"
                  }
                  onPress={() => void handleToggleClip()}
                  muted={clipped}
                  disabled={clipPending}
                />
              ) : null}
              <ActionLink label="Share" onPress={() => void handleShare()} />
              {article.sourceUrl ? (
                <ActionLink
                  label="View original source"
                  onPress={openSource}
                />
              ) : null}
              <ActionLink
                label={backLabel.replace(/^←\s*/, "") || "Today’s paper"}
                onPress={onBack}
                prefix="← "
              />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ActionLink({
  label,
  onPress,
  muted,
  disabled,
  prefix = "",
}: {
  label: string;
  onPress: () => void;
  muted?: boolean;
  disabled?: boolean;
  prefix?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`${prefix}${label}`}
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
    >
      <Text style={[styles.actionText, muted && styles.actionMuted]}>
        {prefix}
        {label}
      </Text>
    </Pressable>
  );
}

function BodyParagraph({
  text,
  isLead,
}: {
  text: string;
  isLead: boolean;
}) {
  if (!isLead || text.length < 2) {
    return (
      <Text
        style={[styles.paragraph, isLead && styles.leadParagraph]}
        maxFontSizeMultiplier={1.3}
      >
        {text}
      </Text>
    );
  }

  const first = text.charAt(0);
  const rest = text.slice(1);

  return (
    <Text
      style={[styles.paragraph, styles.leadParagraph]}
      maxFontSizeMultiplier={1.3}
    >
      <Text style={styles.dropCap}>{first}</Text>
      {rest}
    </Text>
  );
}

function PullQuote({ text }: { text: string }) {
  return (
    <View style={styles.pullQuoteBlock} accessibilityRole="text">
      <Text style={styles.pullMark} accessible={false}>
        “
      </Text>
      <Text style={styles.pullQuote} maxFontSizeMultiplier={1.25}>
        {text.replace(/^["“]|["”]$/g, "")}
      </Text>
      <View style={styles.pullRule} />
    </View>
  );
}

function formatReadTime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes < 1) return null;
  if (minutes === 1) return "1 min read";
  return `${minutes} min read`;
}

function formatSectionLabel(section: string): string {
  const map: Record<string, string> = {
    lead: "The Lead",
    top_stories: "Top Stories",
    today_in_history: "Today in History",
    looking_ahead: "Looking Ahead",
    discovery: "Bandit’s Picks",
    knowledge: "Context",
    business: "Business",
    science: "Science",
    cooking: "Cooking",
    cars: "Cars",
    sports: "Sports",
    health: "Health",
    culture: "Culture",
    technology: "Technology",
    recommendations: "Recommendations",
  };
  if (map[section]) return map[section];
  return section
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: paper.cream,
  },
  progressTrack: {
    height: 2,
    backgroundColor: paper.inkRule,
  },
  progressFill: {
    height: 2,
    backgroundColor: paper.terracotta,
    opacity: 0.55,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
    backgroundColor: paper.cream,
  },
  back: {
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.2,
    maxWidth: "62%",
  },
  sectionTag: {
    ...type.kicker,
    color: paper.inkFaint,
    maxWidth: "36%",
    textAlign: "right",
    letterSpacing: 1.7,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: 24,
  },
  column: {
    maxWidth: reader.measure,
  },
  mastheadRule: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 28,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.2,
    marginBottom: 16,
  },
  headline: {
    ...reader.headline,
    color: paper.ink,
    marginBottom: 18,
  },
  dek: {
    ...reader.dek,
    color: paper.inkBody,
    marginBottom: 22,
  },
  bylineBlock: {
    marginBottom: 22,
    gap: 7,
  },
  byline: {
    ...reader.byline,
    color: paper.inkMuted,
  },
  meta: {
    ...reader.meta,
    color: paper.inkFaint,
    fontFamily: "Georgia",
    fontStyle: "italic",
  },
  briefingNote: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 26,
    maxWidth: 420,
  },
  figure: {
    marginBottom: 40,
    alignSelf: "center",
  },
  imageFrame: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: paper.creamDeep,
  },
  imageFade: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "112%",
    marginTop: "-6%",
  },
  captionBlock: {
    flexDirection: "row",
    marginTop: 14,
    paddingRight: 4,
    gap: 12,
  },
  captionRule: {
    width: 1.5,
    backgroundColor: paper.terracotta,
    opacity: 0.7,
  },
  captionCopy: {
    flex: 1,
    gap: 4,
    paddingTop: 1,
  },
  caption: {
    ...reader.caption,
    color: paper.inkMuted,
  },
  credit: {
    ...reader.credit,
    color: paper.inkFaint,
    textTransform: "uppercase",
  },
  noImageRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 32,
  },
  paragraph: {
    ...reader.body,
    color: paper.inkBody,
    marginBottom: 28,
  },
  leadParagraph: {
    marginBottom: 30,
  },
  dropCap: {
    ...reader.dropCap,
    color: paper.ink,
  },
  pullQuoteBlock: {
    marginTop: 10,
    marginBottom: 40,
    paddingHorizontal: 6,
  },
  pullMark: {
    fontFamily: "Georgia",
    fontSize: 72,
    lineHeight: 60,
    color: paper.terracotta,
    opacity: 0.35,
    marginBottom: -10,
    marginLeft: -6,
  },
  pullQuote: {
    ...reader.pullQuote,
    color: paper.ink,
    marginBottom: 18,
  },
  pullRule: {
    width: 52,
    height: 1.5,
    backgroundColor: paper.terracotta,
    opacity: 0.65,
  },
  knowledgeBlock: {
    marginTop: 16,
    marginBottom: 12,
  },
  knowledgeHeading: {
    ...type.kicker,
    color: paper.inkFaint,
    letterSpacing: 2,
    marginBottom: 10,
  },
  knowledgeRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 18,
  },
  colophon: {
    marginTop: 20,
    alignItems: "flex-start",
    gap: 12,
  },
  footerRule: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 10,
  },
  endMark: {
    alignSelf: "center",
    fontSize: 11,
    color: paper.inkFaint,
    letterSpacing: 1,
  },
  attribution: {
    ...reader.meta,
    color: paper.inkMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    alignSelf: "center",
  },
  sourceHint: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 23,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginTop: 8,
    maxWidth: 400,
    alignSelf: "center",
    textAlign: "center",
  },
  continueBlock: {
    marginTop: 48,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  continueKicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.1,
    marginBottom: 10,
  },
  continueIntro: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 22,
    maxWidth: 400,
  },
  continueItem: {
    paddingBottom: 22,
    marginBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  continueItemLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 8,
  },
  continueLabel: {
    ...type.kicker,
    color: paper.inkFaint,
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  continueTitle: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    color: paper.ink,
    letterSpacing: -0.15,
    marginBottom: 8,
  },
  continueSummary: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    color: paper.inkBody,
  },
  actionsBlock: {
    marginTop: 40,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
    paddingBottom: 16,
  },
  actionsKicker: {
    ...type.kicker,
    color: paper.inkFaint,
    letterSpacing: 1.9,
    marginBottom: 14,
  },
  actionsList: {
    gap: 4,
  },
  actionRow: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  actionText: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.15,
  },
  actionMuted: {
    color: paper.inkMuted,
  },
  pressed: {
    opacity: press.opacity,
  },
});
