import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { KindredArticle, ArticleFigure } from "../lib/edition/article";
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
  press,
  motion,
} from "../lib/edition/newspaperTheme";
import {
  useArticleReadingSession,
  inferTopicFromSection,
  trackReadingSignal,
} from "../lib/personalization";
import { supabase } from "../lib/supabase";
import { resolveArticleHero, supportingFiguresForArticle } from "../lib/edition/articleHero";
import {
  KindredStickyMasthead,
  MastheadLink,
} from "./KindredMasthead";
import { ContentTemplateModules } from "./ContentTemplateModules";
import {
  categoryLabelForType,
} from "../lib/edition/contentSystem";

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
  const readingWidth = Math.min(
    windowWidth - reader.gutter * 2,
    reader.measure
  );

  const [contentHeight, setContentHeight] = useState(1);
  const [viewportHeight, setViewportHeight] = useState(1);
  const [progress, setProgress] = useState(0);
  const [heroFailed, setHeroFailed] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [editorialFallback, setEditorialFallback] = useState<{
    source: ImageSourcePropType;
    caption: string;
    credit: string;
  } | null>(null);
  const [clipped, setClipped] = useState(false);
  const [clipPending, setClipPending] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(initialScrollY);
  const restoredScroll = useRef(false);
  const mastheadScrollY = useRef(new Animated.Value(initialScrollY)).current;

  const progressAnim = useRef(new Animated.Value(0)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterRise = useRef(new Animated.Value(motion.risePx)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  const briefing = isKindredBriefing(article);
  const canClip = Boolean(clipSectionId);
  const continueItems = companion?.continueReading ?? [];

  useArticleReadingSession(article, progress, { editionId });

  useEffect(() => {
    restoredScroll.current = false;
    scrollYRef.current = initialScrollY;
    mastheadScrollY.setValue(initialScrollY);
    enterOpacity.setValue(0);
    enterRise.setValue(motion.risePx);
    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: motion.enterMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterRise, {
        toValue: 0,
        duration: motion.enterMs + 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [article.id, enterOpacity, enterRise, initialScrollY, mastheadScrollY]);

  useEffect(() => {
    setHeroFailed(false);
    setHeroReady(false);
    setEditorialFallback(null);
    heroOpacity.setValue(0);
    // Local catalog assets are ready immediately.
    if (article.heroImage?.source && !article.heroImage?.uri) {
      setHeroReady(true);
    }
  }, [article.id, article.heroImage?.uri, article.heroImage?.source, heroOpacity]);

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
  const metaLine = [readLabel, article.source, published]
    .filter(Boolean)
    .join("  ·  ");

  const banditNote =
    article.banditNote?.trim() ||
    companion?.banditNote?.trim() ||
    companion?.whyChosen?.trim() ||
    companion?.whyThisMatters?.summary?.trim() ||
    null;

  const pullQuote =
    article.pullQuote && article.body.length >= 4 ? article.pullQuote : null;
  const pullIndex = useMemo(() => {
    if (!pullQuote || article.body.length < 4) return -1;
    return Math.min(
      Math.max(1, Math.floor(article.body.length * 0.35)),
      article.body.length - 2
    );
  }, [pullQuote, article.body.length]);

  // Prefer article-supplied figures; skip auto fills so every image is intentional.
  const figures = useMemo(() => {
    if (article.figures?.length) {
      return article.figures.filter((f) => Boolean(f.uri?.trim() || f.source));
    }
    return supportingFiguresForArticle(article);
  }, [article]);
  const figuresByParagraph = useMemo(() => {
    const map = new Map<number, typeof figures>();
    for (const fig of figures) {
      const list = map.get(fig.afterParagraph) ?? [];
      list.push(fig);
      map.set(fig.afterParagraph, list);
    }
    return map;
  }, [figures]);

  const relatedItems = (continueItems ?? []).filter(
    (i) =>
      i.kind === "following" ||
      i.kind === "background" ||
      i.kind === "local" ||
      i.kind === "opposing"
  );
  const banditPickItems = (continueItems ?? []).filter(
    (i) => i.kind === "bandit"
  );
  const continueNavItems = (continueItems ?? []).filter(
    (i) => i.kind === "edition" || i.action === "return_to_edition"
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } =
        event.nativeEvent;
      scrollYRef.current = contentOffset.y;
      mastheadScrollY.setValue(contentOffset.y);
      const scrollable = Math.max(
        contentSize.height - layoutMeasurement.height,
        1
      );
      const next = Math.min(1, Math.max(0, contentOffset.y / scrollable));
      progressAnim.setValue(next);
      setProgress(next);
      updateArticleSessionScroll(article.id, contentOffset.y);
    },
    [progressAnim, article.id, mastheadScrollY]
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
    setClipError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setClipError("Sign in again to save passages from your paper.");
        return;
      }

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
        } else {
          if (__DEV__) {
            console.error("[ArticleReader] unclip failed", error.message);
          }
          setClipError("Couldn’t remove that clipping. Please try again.");
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
        } else {
          if (__DEV__) {
            console.error("[ArticleReader] clip failed", insertError.message);
          }
          setClipError("Couldn’t save that for later. Please try again.");
        }
      }
    } catch (err) {
      if (__DEV__) {
        console.error(
          "[ArticleReader] clip threw",
          err instanceof Error ? err.message : String(err)
        );
      }
      setClipError("Couldn’t save that for later. Please try again.");
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
      parts.push("", "From today’s Kindred edition");
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

      <KindredStickyMasthead
        scrollY={mastheadScrollY}
        style={styles.stickyMasthead}
        subtitle={
          briefing
            ? "Briefing"
            : article.contentType
              ? categoryLabelForType(article.contentType)
              : formatSectionLabel(article.section)
        }
        leading={
          <MastheadLink
            label={backLabel}
            onPress={onBack}
            accessibilityLabel={backLabel.replace(/^←\s*/, "Back to ")}
          />
        }
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 96 + insets.bottom },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical={false}
        decelerationRate="normal"
      >
        <Animated.View
          style={{
            opacity: enterOpacity,
            transform: [{ translateY: enterRise }],
            width: "100%",
            alignItems: "center",
          }}
        >
          {/* 1. Full-width hero */}
          <HeroFigure
            article={article}
            windowWidth={windowWidth}
            heroFailed={heroFailed}
            heroReady={heroReady}
            heroOpacity={heroOpacity}
            editorialFallback={editorialFallback}
            onReady={() => setHeroReady(true)}
            onWireError={() => {
              const heroUri = article.heroImage?.uri?.trim();
              if (!heroUri) {
                setHeroReady(true);
                return;
              }
              const fallback = resolveArticleHero({
                headline: article.headline,
                section: article.section,
                body: article.body,
                source: article.source,
              });
              if (fallback.source) {
                setEditorialFallback({
                  source: fallback.source,
                  caption: fallback.caption || article.headline,
                  credit: fallback.credit || "Kindred editorial archive",
                });
                setHeroFailed(false);
                setHeroReady(true);
                return;
              }
              setHeroFailed(true);
            }}
          />

          <View style={[styles.column, { width: readingWidth }]}>
            {/* 2. Category — desk label from Universal Content System when known */}
            <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
              {briefing
                ? "Kindred briefing"
                : article.contentType
                  ? categoryLabelForType(article.contentType)
                  : formatSectionLabel(article.section)}
            </Text>

            {/* 3. Headline */}
            <Text style={styles.headline} maxFontSizeMultiplier={1.25}>
              {article.headline}
            </Text>

            {/* 4. Reading time · source · date */}
            {metaLine ? (
              <Text style={styles.meta} maxFontSizeMultiplier={1.15}>
                {metaLine}
              </Text>
            ) : article.byline ? (
              <Text style={styles.meta} maxFontSizeMultiplier={1.15}>
                {article.byline}
              </Text>
            ) : null}

            {/* 5. Bandit's Note */}
            {banditNote ? (
              <View style={styles.banditNote} accessibilityRole="text">
                <Text style={styles.banditNoteKicker}>Bandit’s Note</Text>
                <Text style={styles.banditNoteBody} maxFontSizeMultiplier={1.25}>
                  {banditNote}
                </Text>
              </View>
            ) : null}

            {/* 6. Opening summary */}
            {article.dek ? (
              <Text style={styles.dek} maxFontSizeMultiplier={1.25}>
                {article.dek}
              </Text>
            ) : null}

            {briefing ? (
              <Text style={styles.briefingNote} maxFontSizeMultiplier={1.25}>
                {article.body.length <= 1
                  ? "A short Kindred note — the full report lives with the publisher."
                  : "A Kindred summary for your morning paper — not the publisher’s full article."}
              </Text>
            ) : null}

            {/* 7–9. Body · supporting images · pull quotes */}
            {(article.body ?? []).map((paragraph, index) => (
              <View key={`p-${index}`}>
                <BodyParagraph
                  text={paragraph}
                  isLead={index === 0 && !briefing}
                />
                {pullQuote && index === pullIndex ? (
                  <PullQuote text={pullQuote} />
                ) : null}
                {(figuresByParagraph.get(index) ?? []).map((fig, fi) => (
                  <InlineFigure
                    key={`fig-${index}-${fi}`}
                    figure={fig}
                    width={Math.min(windowWidth - 16, readingWidth + 28)}
                    bleed={Math.max(
                      0,
                      (Math.min(windowWidth - 16, readingWidth + 28) -
                        readingWidth) /
                        2
                    )}
                  />
                ))}
              </View>
            ))}

            {/* Desk modules — practical questions answered in prose (UCS) */}
            {(article.modules?.length ?? 0) > 0 ? (
              <ContentTemplateModules modules={article.modules!} />
            ) : null}

            <View style={styles.colophon}>
              <View style={styles.footerRule} />
              <Text style={styles.endMark}>◆</Text>
              <Text style={styles.attribution}>
                From this morning’s paper  ·  {article.source}
              </Text>
              <Text style={styles.closingCadence} maxFontSizeMultiplier={1.25}>
                {briefing
                  ? "That is the desk’s note on this story. Sit with it a moment."
                  : "That is the end of this story. Sit with it a moment."}
              </Text>
            </View>

            {/* 10. Related stories */}
            {relatedItems.length > 0 ? (
              <EndMatterBlock
                kicker="Related stories"
                intro="Nearby threads from today’s paper — chosen to deepen the reading, not the scroll."
              >
                {relatedItems.map((item, index) => (
                  <EndMatterItem
                    key={`related-${item.kind}-${index}`}
                    item={item}
                    isLast={index === relatedItems.length - 1}
                    onPress={() => {
                      if (item.action === "return_to_edition") {
                        onBack();
                        return;
                      }
                      onOpenContinue?.(item);
                    }}
                  />
                ))}
              </EndMatterBlock>
            ) : null}

            {/* 11. Continue Reading */}
            <EndMatterBlock
              kicker="Continue reading"
              intro="The rest of the morning paper is waiting when you are ready."
            >
              {(continueNavItems.length > 0
                ? continueNavItems
                : [
                    {
                      kind: "edition" as const,
                      label: "Return to today’s edition",
                      title: "Back to the morning paper",
                      summary: "The rest of today’s paper is waiting.",
                      action: "return_to_edition" as const,
                    },
                  ]
              ).map((item, index, arr) => (
                <EndMatterItem
                  key={`continue-${item.kind}-${index}`}
                  item={item}
                  isLast={index === arr.length - 1}
                  linkLabel={
                    item.action === "return_to_edition" ? "Return" : "Continue"
                  }
                  onPress={() => {
                    if (item.action === "return_to_edition") {
                      onBack();
                      return;
                    }
                    onOpenContinue?.(item);
                  }}
                />
              ))}
            </EndMatterBlock>

            {/* 12. Bandit's Picks */}
            {banditPickItems.length > 0 ? (
              <EndMatterBlock
                kicker="Bandit’s Picks"
                intro="One quiet recommendation from the desk — personal, not a feed."
              >
                {banditPickItems.map((item, index) => (
                  <EndMatterItem
                    key={`bandit-${index}`}
                    item={item}
                    isLast={index === banditPickItems.length - 1}
                    onPress={() => onOpenContinue?.(item)}
                  />
                ))}
              </EndMatterBlock>
            ) : null}

            <View style={styles.actionsBlock}>
              <Text style={styles.actionsKicker}>This page</Text>
              {clipError ? (
                <Text style={styles.clipError} accessibilityRole="alert">
                  {clipError}
                </Text>
              ) : null}
              <View style={styles.actionsList}>
                {canClip ? (
                  <ActionLink
                    label={
                      clipPending
                        ? "Saving…"
                        : clipped
                          ? "Saved"
                          : "Save for later"
                    }
                    onPress={() => void handleToggleClip()}
                    muted={clipped}
                    disabled={clipPending}
                  />
                ) : null}
                <ActionLink label="Share" onPress={() => void handleShare()} />
                {article.sourceUrl ? (
                  <ActionLink label="Original source" onPress={openSource} />
                ) : null}
                <ActionLink
                  label={backLabel.replace(/^←\s*/, "") || "Today’s paper"}
                  onPress={onBack}
                  prefix="← "
                />
              </View>
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

function HeroFigure({
  article,
  windowWidth,
  heroFailed,
  heroReady,
  heroOpacity,
  editorialFallback,
  onReady,
  onWireError,
}: {
  article: KindredArticle;
  windowWidth: number;
  heroFailed: boolean;
  heroReady: boolean;
  heroOpacity: Animated.Value;
  editorialFallback: {
    source: ImageSourcePropType;
    caption: string;
    credit: string;
  } | null;
  onReady: () => void;
  onWireError: () => void;
}) {
  const heroUri = article.heroImage?.uri?.trim() || null;
  const heroLocal =
    editorialFallback?.source ?? article.heroImage?.source ?? null;
  const showHero = Boolean(heroLocal) || (Boolean(heroUri) && !heroFailed);

  if (!showHero) {
    return <View style={styles.heroAbsentRule} />;
  }

  const caption =
    editorialFallback?.caption ||
    article.heroImage?.caption ||
    article.headline;
  const credit =
    editorialFallback?.credit || article.heroImage?.credit || null;
  const heroH = Math.round(windowWidth * 0.72);

  return (
    <View style={[styles.heroBleed, { width: windowWidth }]}>
      <View style={[styles.heroFrame, { height: heroH }]}>
        {!heroReady ? <View style={styles.imagePlaceholder} /> : null}
        <Animated.View style={[styles.imageFade, { opacity: heroOpacity }]}>
          <Image
            source={heroLocal ? heroLocal : { uri: heroUri! }}
            style={styles.heroImage}
            resizeMode="cover"
            accessibilityLabel={caption}
            onLoad={onReady}
            onError={onWireError}
          />
        </Animated.View>
      </View>
      {(caption || credit) && (
        <View style={styles.heroCaptionBlock}>
          <View style={styles.captionRule} />
          <View style={styles.captionCopy}>
            {caption ? (
              <Text style={styles.caption} maxFontSizeMultiplier={1.2}>
                {caption}
              </Text>
            ) : null}
            {credit ? (
              <Text style={styles.credit} maxFontSizeMultiplier={1.15}>
                {credit}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

function InlineFigure({
  figure,
  width,
  bleed,
}: {
  figure: ArticleFigure;
  width: number;
  bleed: number;
}) {
  const src = figure.source
    ? figure.source
    : figure.uri
      ? { uri: figure.uri }
      : null;
  if (!src) return null;

  return (
    <View
      style={[
        styles.inlineFigure,
        { width, marginHorizontal: -bleed },
      ]}
    >
      <View style={styles.inlineFrame}>
        <Image
          source={src}
          style={styles.inlineImage}
          resizeMode="cover"
          accessibilityLabel={figure.caption || "Photograph"}
        />
      </View>
      {(figure.caption || figure.credit) && (
        <View style={styles.captionBlock}>
          <View style={styles.captionRule} />
          <View style={styles.captionCopy}>
            {figure.caption ? (
              <Text style={styles.caption} maxFontSizeMultiplier={1.2}>
                {figure.caption}
              </Text>
            ) : null}
            {figure.credit ? (
              <Text style={styles.credit} maxFontSizeMultiplier={1.15}>
                {figure.credit}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

function EndMatterBlock({
  kicker,
  intro,
  children,
}: {
  kicker: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.endMatter}>
      <Text style={styles.endMatterKicker}>{kicker}</Text>
      <Text style={styles.endMatterIntro} maxFontSizeMultiplier={1.2}>
        {intro}
      </Text>
      {children}
    </View>
  );
}

function EndMatterItem({
  item,
  isLast,
  onPress,
  linkLabel = "Continue",
}: {
  item: ContinueReadingItem;
  isLast: boolean;
  onPress: () => void;
  linkLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${item.label}. ${item.title}. ${item.editorWhy ?? linkLabel}`}
      style={({ pressed }) => [
        styles.endMatterItem,
        isLast && styles.endMatterItemLast,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.endMatterLabel}>{item.label}</Text>
      <Text style={styles.endMatterTitle} maxFontSizeMultiplier={1.25}>
        {item.title}
      </Text>
      <Text style={styles.endMatterSummary} maxFontSizeMultiplier={1.25}>
        {item.summary}
      </Text>
      {item.editorWhy ? (
        <Text style={styles.endMatterWhy} maxFontSizeMultiplier={1.2}>
          {item.editorWhy}
        </Text>
      ) : null}
      <Text style={styles.endMatterLink}>{linkLabel}</Text>
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
  const trimmed = text.trim();
  const isSectionHead =
    trimmed.length > 0 &&
    trimmed.length <= 48 &&
    !/[.!?]$/.test(trimmed) &&
    !trimmed.startsWith("“") &&
    !trimmed.startsWith('"');

  if (isSectionHead) {
    return (
      <Text style={styles.sectionHead} maxFontSizeMultiplier={1.2}>
        {trimmed}
      </Text>
    );
  }

  if (!isLead || trimmed.length < 2) {
    return (
      <Text
        style={[styles.paragraph, isLead && styles.leadParagraph]}
        maxFontSizeMultiplier={1.3}
      >
        {trimmed}
      </Text>
    );
  }

  const first = trimmed.charAt(0);
  const rest = trimmed.slice(1);

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
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}

function formatSectionLabel(section: string): string {
  const map: Record<string, string> = {
    lead: "The Lead",
    top_stories: "Top Stories",
    today_in_history: "Today in History",
    looking_ahead: "Looking Ahead",
    discovery: "From the desk",
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
    backgroundColor: paper.page,
  },
  progressTrack: {
    height: 1.5,
    backgroundColor: paper.border,
  },
  progressFill: {
    height: 1.5,
    backgroundColor: paper.terracotta,
    opacity: 0.4,
  },
  stickyMasthead: {
    top: 1.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 0,
  },
  column: {
    maxWidth: reader.measure,
    paddingHorizontal: reader.gutter,
    paddingTop: 28,
    alignSelf: "center",
    width: "100%",
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.4,
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
    marginTop: 8,
    marginBottom: 36,
  },
  meta: {
    ...reader.meta,
    color: paper.inkMuted,
    fontFamily: "Georgia",
    fontStyle: "italic",
    letterSpacing: 0.2,
    marginBottom: 28,
  },
  banditNote: {
    marginBottom: 32,
    paddingVertical: 22,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  banditNoteKicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.2,
    marginBottom: 12,
  },
  banditNoteBody: {
    ...reader.calloutBody,
    color: paper.inkBody,
  },
  briefingNote: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 28,
    maxWidth: 420,
  },
  heroBleed: {
    alignSelf: "center",
    marginBottom: 8,
  },
  heroFrame: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroCaptionBlock: {
    flexDirection: "row",
    marginTop: 14,
    paddingHorizontal: reader.gutter,
    gap: 12,
  },
  heroAbsentRule: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginTop: 12,
    marginBottom: 8,
    marginHorizontal: reader.gutter,
  },
  inlineFigure: {
    marginTop: 8,
    marginBottom: 40,
    alignSelf: "center",
  },
  inlineFrame: {
    width: "100%",
    aspectRatio: 4 / 3,
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  inlineImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: paper.creamDeep,
  },
  imageFade: {
    width: "100%",
    height: "100%",
  },
  captionBlock: {
    flexDirection: "row",
    marginTop: 14,
    paddingRight: 8,
    paddingLeft: 4,
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
  paragraph: {
    ...reader.body,
    color: paper.inkBody,
    marginBottom: 36,
  },
  sectionHead: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: paper.terracotta,
    marginTop: 12,
    marginBottom: 20,
  },
  leadParagraph: {
    marginBottom: 38,
  },
  dropCap: {
    ...reader.dropCap,
    color: paper.ink,
  },
  pullQuoteBlock: {
    marginTop: 12,
    marginBottom: 44,
    paddingHorizontal: 4,
  },
  pullMark: {
    fontFamily: "Georgia",
    fontSize: 68,
    lineHeight: 56,
    color: paper.terracotta,
    opacity: 0.32,
    marginBottom: -8,
    marginLeft: -4,
  },
  pullQuote: {
    ...reader.pullQuote,
    color: paper.ink,
    marginBottom: 18,
  },
  pullRule: {
    width: 48,
    height: 1.5,
    backgroundColor: paper.terracotta,
    opacity: 0.6,
  },
  colophon: {
    marginTop: 28,
    alignItems: "center",
    gap: 14,
  },
  footerRule: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 8,
  },
  endMark: {
    fontSize: 10,
    color: paper.inkFaint,
    letterSpacing: 1,
  },
  attribution: {
    ...reader.meta,
    color: paper.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  closingCadence: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkBody,
    textAlign: "center",
    maxWidth: 340,
    marginTop: 4,
  },
  endMatter: {
    marginTop: 48,
    paddingTop: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  endMatterKicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.2,
    marginBottom: 12,
  },
  endMatterIntro: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 28,
    maxWidth: 400,
  },
  endMatterItem: {
    paddingBottom: 26,
    marginBottom: 26,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  endMatterItemLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 4,
  },
  endMatterLabel: {
    ...type.kicker,
    color: paper.inkFaint,
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  endMatterTitle: {
    fontFamily: "Georgia",
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "600",
    color: paper.ink,
    letterSpacing: -0.15,
    marginBottom: 10,
  },
  endMatterSummary: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
    marginBottom: 10,
  },
  endMatterWhy: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 12,
    maxWidth: 400,
  },
  endMatterLink: {
    fontFamily: "Georgia",
    fontSize: 15,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.2,
  },
  actionsBlock: {
    marginTop: 48,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
    paddingBottom: 20,
  },
  actionsKicker: {
    ...type.kicker,
    color: paper.inkFaint,
    letterSpacing: 1.9,
    marginBottom: 16,
  },
  clipError: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
    color: paper.terracotta,
    marginBottom: 12,
  },
  actionsList: {
    gap: 2,
  },
  actionRow: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
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
