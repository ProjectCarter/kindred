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
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
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
  resolveClipTarget,
  checkClipped,
  saveClipping,
  removeClipping,
} from "../lib/edition/clippings";
import { checkLiked, saveLike, removeLike } from "../lib/edition/likes";
import {
  MastheadLink,
} from "./KindredMasthead";
import { PullDownNavHeader } from "./PullDownNavHeader";
import {
  pullDownNavTitleFromBackLabel,
  usePullDownNav,
} from "../lib/navigation/usePullDownNav";
import { ContentTemplateModules } from "./ContentTemplateModules";
import {
  categoryLabelForType,
} from "../lib/edition/contentSystem";
import {
  resolveArticleContextActions,
} from "../lib/edition/actionBar";
import { ArticleActionList } from "./ArticleActionList";

type Props = {
  article: KindredArticle;
  onBack: () => void;
  editionId?: string | null;
  companion?: ArticleCompanion | null;
  backLabel?: string;
  initialScrollY?: number;
  onOpenContinue?: (item: ContinueReadingItem) => void;
  /** Skip the entrance fade — show known card data immediately on navigation. */
  instantEnter?: boolean;
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
  initialScrollY = 0,
  onOpenContinue,
  instantEnter = false,
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
  const heroReadyRef = useRef(false);
  const [editorialFallback, setEditorialFallback] = useState<{
    source: ImageSourcePropType;
    caption: string;
    credit: string;
  } | null>(null);
  const [clipped, setClipped] = useState(false);
  const [clipPending, setClipPending] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(initialScrollY);
  const restoredScroll = useRef(false);
  const pullDownNav = usePullDownNav();

  const progressAnim = useRef(new Animated.Value(0)).current;
  const enterOpacity = useRef(
    new Animated.Value(instantEnter ? 1 : 0)
  ).current;
  const enterRise = useRef(
    new Animated.Value(instantEnter ? 0 : motion.risePx)
  ).current;
  const heroOpacity = useRef(
    new Animated.Value(
      instantEnter &&
        (article.heroImage?.source || !article.heroImage?.uri?.trim())
        ? 1
        : 0
    )
  ).current;

  const briefing = isKindredBriefing(article);
  const clipTarget = useMemo(() => resolveClipTarget(article), [article]);
  const canClip = Boolean(clipTarget);
  const articleContextActions = useMemo(
    () => resolveArticleContextActions(article),
    [article]
  );
  const continueItems = companion?.continueReading ?? [];
  const pullDownTitle = useMemo(() => {
    const fromBack = pullDownNavTitleFromBackLabel(backLabel);
    if (
      fromBack !== "Today's paper" &&
      fromBack !== "Today’s paper"
    ) {
      return fromBack;
    }
    if (briefing) return "Briefing";
    if (article.contentType) {
      return categoryLabelForType(article.contentType);
    }
    return formatSectionLabel(article.section);
  }, [backLabel, briefing, article.contentType, article.section]);

  useEffect(() => {
    heroReadyRef.current = heroReady;
  }, [heroReady]);

  useArticleReadingSession(article, progress, { editionId });

  useEffect(() => {
    restoredScroll.current = false;
    scrollYRef.current = initialScrollY;
    pullDownNav.reset();

    const hasLocalHero =
      Boolean(article.heroImage?.source) || !article.heroImage?.uri?.trim();

    if (instantEnter) {
      enterOpacity.setValue(1);
      enterRise.setValue(0);
      if (hasLocalHero) {
        setHeroReady(true);
        heroOpacity.setValue(1);
      }
      return;
    }

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
  }, [
    article.heroImage?.source,
    article.heroImage?.uri,
    article.id,
    enterOpacity,
    enterRise,
    heroOpacity,
    initialScrollY,
    instantEnter,
    pullDownNav,
  ]);

  const swapInEditorialHero = useCallback(() => {
    if (article.section === "today_in_history") {
      setHeroFailed(true);
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
  }, [article.body, article.headline, article.section, article.source]);

  useEffect(() => {
    setHeroFailed(false);
    setEditorialFallback(null);
    heroOpacity.setValue(
      instantEnter &&
        (article.heroImage?.source || !article.heroImage?.uri?.trim())
        ? 1
        : 0
    );
    // Local catalog assets are ready immediately.
    if (article.heroImage?.source && !article.heroImage?.uri) {
      setHeroReady(true);
      return;
    }
    if (instantEnter && !article.heroImage?.uri?.trim()) {
      setHeroReady(true);
      return;
    }
    setHeroReady(false);
    // A wire photo that never resolves — no onLoad, no onError — would
    // otherwise leave the hero permanently blank. Give it a generous
    // window, then quietly swap in an editorial photograph instead.
    const wireUri = article.heroImage?.uri?.trim();
    if (wireUri) {
      const timer = setTimeout(() => {
        if (!heroReadyRef.current) {
          if (article.section === "today_in_history") {
            setHeroFailed(true);
            return;
          }
          swapInEditorialHero();
        }
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [
    article.id,
    article.heroImage?.uri,
    article.heroImage?.source,
    heroOpacity,
    instantEnter,
    swapInEditorialHero,
  ]);

  useEffect(() => {
    if (!heroReady) return;
    if (instantEnter) {
      heroOpacity.setValue(1);
      return;
    }
    Animated.timing(heroOpacity, {
      toValue: 1,
      duration: motion.photoMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [heroReady, heroOpacity, instantEnter]);

  useEffect(() => {
    stashArticleSession({
      article,
      companion,
      editionId: editionId ?? null,
      backLabel,
      scrollY: scrollYRef.current,
      updatedAt: Date.now(),
    });
  }, [article, companion, editionId, backLabel]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        updateArticleSessionScroll(article.id, scrollYRef.current);
        stashArticleSession({
          article,
          companion,
          editionId: editionId ?? null,
          backLabel,
          scrollY: scrollYRef.current,
          updatedAt: Date.now(),
        });
      }
    });
    return () => sub.remove();
  }, [article, companion, editionId, backLabel]);

  useEffect(() => {
    if (!clipTarget) {
      setClipped(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const isClipped = await checkClipped(user.id, clipTarget.clipKey);
      if (!cancelled) setClipped(isClipped);
    })();
    return () => {
      cancelled = true;
    };
  }, [clipTarget]);

  // Liking shares the same eligibility (and key) as pinning — both live on
  // the same four content types — but is tracked independently.
  useEffect(() => {
    if (!clipTarget) {
      setLiked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const isLiked = await checkLiked(user.id, clipTarget.clipKey);
      if (!cancelled) setLiked(isLiked);
    })();
    return () => {
      cancelled = true;
    };
  }, [clipTarget]);

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
      pullDownNav.onScroll(event);
      const scrollable = Math.max(
        contentSize.height - layoutMeasurement.height,
        1
      );
      const next = Math.min(1, Math.max(0, contentOffset.y / scrollable));
      progressAnim.setValue(next);
      setProgress(next);
      updateArticleSessionScroll(article.id, contentOffset.y);
    },
    [progressAnim, article.id, pullDownNav]
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

  async function handleToggleClip() {
    if (!clipTarget || clipPending) return;
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
        const result = await removeClipping(user.id, clipTarget.clipKey);
        if (result.ok) {
          setClipped(false);
          void trackReadingSignal({
            signalType: "unclip",
            storyKey,
            sectionType: article.section,
            editionId,
            sectionId: clipTarget.sectionId,
            source: article.source,
            topic,
          });
        } else {
          if (__DEV__) {
            console.error("[ArticleReader] unclip failed", result.error);
          }
          setClipError("Couldn’t remove that clipping. Please try again.");
        }
      } else {
        const result = await saveClipping(user.id, clipTarget, article);
        if (result.ok) {
          setClipped(true);
          if (!result.duplicate) {
            void trackReadingSignal({
              signalType: "clip",
              storyKey,
              sectionType: article.section,
              editionId,
              sectionId: clipTarget.sectionId,
              source: article.source,
              topic,
              payload: { headline: article.headline.slice(0, 160) },
            });
          }
        } else {
          if (__DEV__) {
            console.error("[ArticleReader] clip failed", result.error);
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

  // The Like heart is a private "show me more like this" signal — no
  // counts, no confirmation, nothing shown outside this reader's own
  // future editions. Optimistic and quiet: on failure it simply reverts,
  // no error banner, since a missed like is low-stakes.
  async function handleToggleLike() {
    if (!clipTarget || likePending) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikePending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLiked(!nextLiked);
        return;
      }

      const storyKey = `${article.section}:${article.headline}`.slice(0, 240);
      const topic =
        article.contentType ?? inferTopicFromSection(article.section, article.headline);

      if (nextLiked) {
        const result = await saveLike(user.id, clipTarget, article);
        if (!result.ok) {
          setLiked(false);
          return;
        }
        if (!result.duplicate) {
          void trackReadingSignal({
            signalType: "like",
            storyKey,
            sectionType: article.section,
            editionId,
            sectionId: clipTarget.sectionId,
            source: article.source,
            topic,
            payload: { headline: article.headline.slice(0, 160) },
          });
        }
      } else {
        const result = await removeLike(user.id, clipTarget.clipKey);
        if (!result.ok) {
          setLiked(true);
          return;
        }
        void trackReadingSignal({
          signalType: "unlike",
          storyKey,
          sectionType: article.section,
          editionId,
          sectionId: clipTarget.sectionId,
          source: article.source,
          topic,
        });
      }
    } catch (err) {
      if (__DEV__) {
        console.error(
          "[ArticleReader] like threw",
          err instanceof Error ? err.message : String(err)
        );
      }
      setLiked(!nextLiked);
    } finally {
      setLikePending(false);
    }
  }

  function handleBack() {
    updateArticleSessionScroll(article.id, scrollYRef.current);
    stashArticleSession({
      article,
      companion,
      editionId: editionId ?? null,
      backLabel,
      scrollY: scrollYRef.current,
      updatedAt: Date.now(),
    });
    onBack();
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
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 96 + insets.bottom },
        ]}
        onScroll={onScroll}
        onScrollBeginDrag={pullDownNav.onScrollBeginDrag}
        onScrollEndDrag={pullDownNav.onScrollEndDrag}
        onMomentumScrollBegin={pullDownNav.onMomentumScrollBegin}
        onMomentumScrollEnd={pullDownNav.onMomentumScrollEnd}
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
          <View style={styles.inScrollBack}>
            <MastheadLink
              label={backLabel}
              onPress={handleBack}
              accessibilityLabel={backLabel.replace(/^←\s*/, "Back to ")}
            />
          </View>

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
              swapInEditorialHero();
            }}
          />

          <View style={[styles.column, { width: readingWidth }]}>
            {/* 1b. Pin (save) + Like (private taste signal) + Share — first interaction under the hero */}
            <View style={styles.heroActionsRow}>
              {canClip ? (
                <Pressable
                  onPress={() => void handleToggleClip()}
                  disabled={clipPending}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    clipped
                      ? "Saved to Clippings. Tap to remove."
                      : "Save to Clippings"
                  }
                  style={({ pressed }) => [
                    styles.heroActionButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={clipped ? "pin.fill" : "pin"}
                    size={20}
                    weight="regular"
                    tintColor={clipped ? paper.terracotta : paper.inkMuted}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    fallback={
                      <Ionicons
                        name={clipped ? "pin" : "pin-outline"}
                        size={20}
                        color={clipped ? paper.terracotta : paper.inkMuted}
                      />
                    }
                  />
                </Pressable>
              ) : null}
              {canClip ? (
                <Pressable
                  onPress={() => void handleToggleLike()}
                  disabled={likePending}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    liked
                      ? "Liked. Tap to remove — this only shapes your own future editions."
                      : "Like — show me more like this"
                  }
                  style={({ pressed }) => [
                    styles.heroActionButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <SymbolView
                    name={liked ? "heart.fill" : "heart"}
                    size={20}
                    weight="regular"
                    tintColor={liked ? paper.terracotta : paper.inkMuted}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    fallback={
                      <Ionicons
                        name={liked ? "heart" : "heart-outline"}
                        size={20}
                        color={liked ? paper.terracotta : paper.inkMuted}
                      />
                    }
                  />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => void handleShare()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Share"
                style={({ pressed }) => [
                  styles.heroActionButton,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolView
                  name="square.and.arrow.up"
                  size={19}
                  weight="regular"
                  tintColor={paper.inkMuted}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  fallback={
                    <Ionicons
                      name="share-outline"
                      size={19}
                      color={paper.inkMuted}
                    />
                  }
                />
              </Pressable>
            </View>
            {clipError ? (
              <Text style={styles.clipError} accessibilityRole="alert">
                {clipError}
              </Text>
            ) : null}

            {articleContextActions.length > 0 ? (
              <ArticleActionList actions={articleContextActions} />
            ) : null}

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
                        handleBack();
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
                      handleBack();
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
              <View style={styles.actionsList}>
                <ActionLink
                  label={backLabel.replace(/^←\s*/, "") || "Today's paper"}
                  onPress={handleBack}
                  prefix="← "
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      <PullDownNavHeader
        title={pullDownTitle}
        translateY={pullDownNav.translateY}
        onBack={handleBack}
        backAccessibilityLabel={backLabel.replace(/^←\s*/, "Back to ")}
      />
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
  detailBackBar: {
    paddingHorizontal: reader.gutter,
    paddingTop: 10,
    paddingBottom: 6,
    alignSelf: "stretch",
    zIndex: 10,
  },
  inScrollBack: {
    alignSelf: "stretch",
    width: "100%",
    paddingHorizontal: reader.gutter,
    paddingTop: 10,
    paddingBottom: 6,
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
  heroActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginBottom: 22,
  },
  heroActionButton: {
    minWidth: 44,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
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
