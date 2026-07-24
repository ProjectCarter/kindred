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
import { isV1TextOnlyListing } from "../lib/edition/v1ImagePolicy";
import { EditorialTitle } from "./EditorialTitle";
import { trackArticleShared } from "../lib/analytics";
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
import { isWireNewsSection } from "../lib/edition/articleIntegrity";
import { resolveSaveTarget } from "../lib/edition/saveTarget";
import { checkLiked, saveLike, removeLike } from "../lib/edition/likes";
import {
  MastheadLink,
} from "./KindredMasthead";
import { PullDownNavHeader } from "./PullDownNavHeader";
import {
  usePullDownNavScreen,
} from "../lib/navigation/usePullDownNavScreen";
import { mergePullDownNavOnScroll } from "../lib/navigation/pullDownNavScrollProps";
import { articleBackRowInsets } from "../lib/navigation/articleBackLayout";
import { ContentTemplateModules } from "./ContentTemplateModules";
import { StateAtAGlanceSection } from "./StateAtAGlanceSection";
import {
  categoryLabelForType,
} from "../lib/edition/contentSystem";
import {
  resolveArticleContextActions,
} from "../lib/edition/actionBar";
import { ArticleActionList } from "./ArticleActionList";
import { DetailHeroCard, DetailAboutCard } from "./DetailHeroCard";
import { detailHeroThemeForArticle } from "../lib/edition/detailHero";

function isCityHistorySection(section: string): boolean {
  return section === "story_of" || section === "your_city";
}

function isProtectedHistoricalSection(section: string): boolean {
  return section === "today_in_history" || isCityHistorySection(section);
}

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
  const [liked, setLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(initialScrollY);
  const restoredScroll = useRef(false);

  const briefing = isKindredBriefing(article);
  const textOnlyListing = isV1TextOnlyListing(article);
  const isLocalNewsArticle = article.section === "local_news";

  // Standardized Kindred detail hero — Activities, Food & Drinks, and Local
  // Events only. Null for every protected section (Story of, Today in History,
  // News, Lead, Knowledge, …), which keep their existing reader layout.
  const heroTheme = detailHeroThemeForArticle(article);
  const isListingDetail = Boolean(heroTheme);
  const isEventListing =
    article.section === "local_events" || article.savedContentType === "event";
  // "About" card summary: discovery uses the dek; events use the generated
  // summary (first body paragraph) so the card explains why to attend — never
  // the bare venue/location line. Bandit's note keeps its own block below.
  const eventUsesFirstBody =
    isEventListing && Boolean(article.body?.[0]?.trim());
  const aboutCardBody = !isListingDetail
    ? null
    : isEventListing
      ? eventUsesFirstBody
        ? article.body[0].trim()
        : null
      : article.dek?.trim() || null;
  const showAboutCard = Boolean(heroTheme) && Boolean(aboutCardBody);

  const handleBack = useCallback(() => {
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
  }, [article, companion, editionId, backLabel, onBack]);

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    backLabel,
    itemTitle: article.headline,
    fallbackTitle: briefing
      ? "Briefing"
      : article.contentType
        ? categoryLabelForType(article.contentType)
        : formatSectionLabel(article.section),
    backAccessibilityLabel: backLabel.replace(/^←\s*/, "Back to "),
  });
  const { pullDownNav } = pullDownNavScreen;

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

  const saveTarget = useMemo(() => resolveSaveTarget(article), [article]);
  const canSave = Boolean(saveTarget);
  const articleContextActions = useMemo(
    () => resolveArticleContextActions(article),
    [article]
  );
  const continueItems = companion?.continueReading ?? [];

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
    if (
      isProtectedHistoricalSection(article.section) ||
      isWireNewsSection(article.section) ||
      article.section === "bandits_pick" ||
      article.section === "discovery" ||
      article.section === "local_events" ||
      article.savedContentType
    ) {
      setHeroFailed(true);
      setEditorialFallback(null);
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
          if (
            isProtectedHistoricalSection(article.section) ||
            isWireNewsSection(article.section) ||
            article.section === "bandits_pick" ||
            article.section === "discovery" ||
            article.section === "local_events" ||
            article.savedContentType
          ) {
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
    if (!saveTarget) {
      setLiked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const isLiked = await checkLiked(user.id, saveTarget.clipKey);
      if (!cancelled) setLiked(isLiked);
    })();
    return () => {
      cancelled = true;
    };
  }, [saveTarget]);

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
    !isEventListing && article.pullQuote && article.body.length >= 4
      ? article.pullQuote
      : null;
  const pullIndex = useMemo(() => {
    if (!pullQuote || article.body.length < 4) return -1;
    return Math.min(
      Math.max(1, Math.floor(article.body.length * 0.35)),
      article.body.length - 2
    );
  }, [pullQuote, article.body.length]);

  // Prefer article-supplied figures; never auto-fill discovery/event bodies.
  const figures = useMemo(() => {
    if (
      article.section === "bandits_pick" ||
      article.section === "discovery" ||
      article.section === "local_events" ||
      article.savedContentType
    ) {
      return article.figures?.filter((f) => Boolean(f.uri?.trim() || f.source)) ?? [];
    }
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

  const onReadingScroll = useCallback(
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

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      mergePullDownNavOnScroll(pullDownNav, onReadingScroll)(event);
    },
    [pullDownNav, onReadingScroll]
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

  async function handleToggleLike() {
    if (!saveTarget || likePending) return;
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
        const result = await saveLike(user.id, saveTarget, article);
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
            sectionId: saveTarget.sectionId,
            source: article.source,
            topic,
            payload: { headline: article.headline.slice(0, 160) },
          });
        }
      } else {
        const result = await removeLike(user.id, saveTarget.clipKey);
        if (!result.ok) {
          setLiked(true);
          return;
        }
        void trackReadingSignal({
          signalType: "unlike",
          storyKey,
          sectionType: article.section,
          editionId,
          sectionId: saveTarget.sectionId,
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
      trackArticleShared({
        contentId: article.id,
        contentTitle: article.headline,
        sectionType: article.section,
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
        onScrollBeginDrag={pullDownNavScreen.scrollProps.onScrollBeginDrag}
        onScrollEndDrag={pullDownNavScreen.scrollProps.onScrollEndDrag}
        onMomentumScrollBegin={pullDownNavScreen.scrollProps.onMomentumScrollBegin}
        onMomentumScrollEnd={pullDownNavScreen.scrollProps.onMomentumScrollEnd}
        scrollEventThrottle={pullDownNavScreen.scrollProps.scrollEventThrottle}
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
          <View
            style={[
              styles.inScrollBack,
              articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true }),
            ]}
          >
            <MastheadLink
              label={backLabel}
              onPress={handleBack}
              accessibilityLabel={backLabel.replace(/^←\s*/, "Back to ")}
            />
          </View>

          {/* 1. Hero — emoji hero card for listing detail pages; text-only
              rule for other V1 listing desks; photograph elsewhere. */}
          {heroTheme ? (
            <View style={[styles.listingHeroWrap, { width: readingWidth }]}>
              <DetailHeroCard
                emoji={article.categoryIcon?.trim() || heroTheme.fallbackEmoji}
                title={article.headline}
                categoryLabel={heroTheme.categoryLabel}
                accent={heroTheme.accent}
              />
            </View>
          ) : textOnlyListing ? (
            <View style={styles.textOnlyLead}>
              <View style={styles.textOnlyRule} />
            </View>
          ) : (
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
          if (
            isProtectedHistoricalSection(article.section) ||
            isWireNewsSection(article.section) ||
            article.section === "bandits_pick" ||
            article.section === "discovery" ||
            article.section === "local_events" ||
            article.savedContentType
          ) {
            setHeroFailed(true);
            setEditorialFallback(null);
            setHeroReady(true);
            return;
          }
          swapInEditorialHero();
              }}
            />
          )}

          <View style={[styles.column, { width: readingWidth }]}>
            {/* Save + Share — first interaction under the hero */}
            <View style={styles.heroActionsRow}>
              {canSave ? (
                <Pressable
                  onPress={() => void handleToggleLike()}
                  disabled={likePending}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    liked
                      ? "Saved. Tap to remove."
                      : "Save"
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

            {!textOnlyListing &&
            articleContextActions.length > 0 &&
            !isLocalNewsArticle ? (
              <ArticleActionList actions={articleContextActions} />
            ) : null}

            {/* 2. Category — desk label from Universal Content System when known.
                Listing detail pages carry the category in the hero pill. */}
            {!isListingDetail ? (
              <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
                {briefing
                  ? "Kindred briefing"
                  : article.section === "bandits_pick"
                    ? "What's Special Right Now"
                    : article.contentType
                      ? categoryLabelForType(article.contentType)
                      : formatSectionLabel(article.section)}
              </Text>
            ) : null}

            {/* 3. Headline — the hero card is the title on listing detail pages. */}
            {isListingDetail ? null : article.categoryIcon ? (
              <EditorialTitle
                icon={article.categoryIcon}
                title={article.headline}
                style={styles.headline}
                maxFontSizeMultiplier={1.25}
              />
            ) : (
              <Text style={styles.headline} maxFontSizeMultiplier={1.25}>
                {article.headline}
              </Text>
            )}

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

            {/* 5. Bandit's introduction or note */}
            {banditNote ? (
              <View style={styles.banditNote} accessibilityRole="text">
                {article.section !== "bandits_pick" ? (
                  <Text style={styles.banditNoteKicker}>Bandit’s Note</Text>
                ) : null}
                <Text style={styles.banditNoteBody} maxFontSizeMultiplier={1.25}>
                  {banditNote}
                </Text>
              </View>
            ) : null}

            {/* 6. Opening summary — tinted "About" card on listing detail pages */}
            {showAboutCard && heroTheme ? (
              <DetailAboutCard
                label={heroTheme.aboutLabel}
                body={aboutCardBody!}
                tint={heroTheme.tint}
                style={styles.listingAbout}
              />
            ) : isListingDetail ? null : article.dek ? (
              <Text style={styles.dek} maxFontSizeMultiplier={1.25}>
                {article.dek}
              </Text>
            ) : null}

            {briefing && !isLocalNewsArticle ? (
              <Text style={styles.briefingNote} maxFontSizeMultiplier={1.25}>
                {article.body.length <= 1
                  ? "A short Kindred note — the full report lives with the publisher."
                  : "A Kindred summary for your morning paper — not the publisher’s full article."}
              </Text>
            ) : null}

            {textOnlyListing && articleContextActions.length > 0 ? (
              <ArticleActionList actions={articleContextActions} />
            ) : null}

            {/* 7–9. Body · supporting images · pull quotes.
                Event listings promote the first paragraph into the About card. */}
            {(article.body ?? []).map((paragraph, index) => {
              if (eventUsesFirstBody && index === 0) return null;
              return (
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
              );
            })}

            {isCityHistorySection(article.section) && article.stateAtAGlance ? (
              <StateAtAGlanceSection
                glance={article.stateAtAGlance}
                contentWidth={readingWidth}
              />
            ) : null}

            {/* Desk modules — practical questions answered in prose (UCS) */}
            {(article.modules?.length ?? 0) > 0 &&
            !isCityHistorySection(article.section) ? (
              <ContentTemplateModules modules={article.modules!} />
            ) : null}

            {(article.nearbyEditorial?.length ?? 0) > 0 ? (
              <View style={styles.nearbyBlock}>
                <Text style={styles.nearbyKicker}>Nearby</Text>
                {article.nearbyEditorial!.map((place, index) => (
                  <View
                    key={`nearby-${place.name}-${index}`}
                    style={[
                      styles.nearbyItem,
                      index === article.nearbyEditorial!.length - 1 &&
                        styles.nearbyItemLast,
                    ]}
                  >
                    <Text style={styles.nearbyName} maxFontSizeMultiplier={1.2}>
                      {place.glyph ? `${place.glyph} ` : ""}
                      {place.name}
                    </Text>
                    <Text
                      style={styles.nearbyDescription}
                      maxFontSizeMultiplier={1.2}
                    >
                      {place.description}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {article.closingBanditNote ? (
              <View style={styles.banditNote} accessibilityRole="text">
                <Text style={styles.banditNoteKicker}>Bandit's Note</Text>
                <Text style={styles.banditNoteBody} maxFontSizeMultiplier={1.25}>
                  {article.closingBanditNote}
                </Text>
              </View>
            ) : null}

            {isLocalNewsArticle && articleContextActions.length > 0 ? (
              <ArticleActionList actions={articleContextActions} />
            ) : null}

            {isLocalNewsArticle && article.briefingFooterNote ? (
              <Text style={styles.briefingNote} maxFontSizeMultiplier={1.25}>
                {article.briefingFooterNote}
              </Text>
            ) : null}

            <View style={styles.colophon}>
              <View style={styles.footerRule} />
              <Text style={styles.endMark}>◆</Text>
              <Text style={styles.attribution}>
                From this morning’s paper  ·  {article.source}
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
              intro="The rest of today’s morning paper is waiting."
            >
              <ActionLink
                label="Return to Today’s Paper"
                onPress={handleBack}
                prefix="← "
              />
            </EndMatterBlock>

            {/* 12. What's Special Right Now */}
            {banditPickItems.length > 0 ? (
              <EndMatterBlock
                kicker="What's Special Right Now"
                intro="What Bandit says not to miss today or this week."
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
          </View>
        </Animated.View>
      </ScrollView>
      <PullDownNavHeader {...pullDownNavScreen.headerProps} />
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
    if (heroUri && heroFailed) {
      return (
        <View style={[styles.heroBleed, { width: windowWidth }]}>
          <View
            style={[
              styles.imageUnavailable,
              { width: windowWidth, height: Math.round(windowWidth * 0.72) },
            ]}
            accessibilityRole="text"
            accessibilityLabel="Photograph unavailable"
          >
            <Text style={styles.imageUnavailableText} maxFontSizeMultiplier={1.1}>
              Photograph unavailable
            </Text>
          </View>
        </View>
      );
    }
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
    recommendations: "Food & Drink",
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
  listingHeroWrap: {
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  listingAbout: {
    marginTop: 8,
    marginBottom: 36,
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
  nearbyBlock: {
    marginBottom: 32,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  nearbyKicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.2,
    marginBottom: 18,
  },
  nearbyItem: {
    marginBottom: 20,
  },
  nearbyItemLast: {
    marginBottom: 8,
  },
  nearbyName: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    color: paper.ink,
    marginBottom: 6,
  },
  nearbyDescription: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
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
  imageUnavailable: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: paper.creamDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    paddingHorizontal: 16,
  },
  imageUnavailableText: {
    ...reader.caption,
    fontStyle: "normal",
    color: paper.inkMuted,
    textAlign: "center",
  },
  textOnlyLead: {
    width: "100%",
    paddingHorizontal: reader.gutter,
    paddingTop: 8,
    paddingBottom: 4,
  },
  textOnlyRule: {
    height: 2,
    backgroundColor: paper.terracotta,
    opacity: 0.35,
    alignSelf: "stretch",
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
