import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  EditorialCardGrid,
  type EditorialGridCard,
} from "../components/EditorialCardGrid";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { BanditCharacter } from "../components/BanditCharacter";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { useLocalDeals } from "../lib/deals/useLocalDeals";
import { formatDealCount } from "../lib/deals/dealCounts";
import {
  dealCardSubtitle,
  LOCAL_DEALS_HOMEPAGE_ACCENT,
  type LocalDeal,
} from "../lib/deals/localDeals";
import { paper, type } from "../lib/edition/newspaperTheme";

/** Trigger load-more this many px before the end of the list. */
const LOAD_MORE_THRESHOLD = 480;

/**
 * Deals — full list. A continuation of the homepage: the same stacked compact
 * card layout (EditorialCardGrid `compact`), carrying every deal rather than the
 * front-page preview. Pages in 20–30 at a time and loads more while scrolling; no
 * listing photography — imagery lives on the detail page, matching every desk.
 */
export default function DealsScreen() {
  const router = useRouter();
  const { status, deals, hasMore, loadingMore, totalCount, loadMore } =
    useLocalDeals();

  function handleBack() {
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    title: "Deals",
    backAccessibilityLabel: "Back to Homepage",
  });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      pullDownNavScreen.pullDownNav.onScroll(event);
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const distanceToEnd =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceToEnd <= LOAD_MORE_THRESHOLD) loadMore();
    },
    [pullDownNavScreen.pullDownNav, loadMore]
  );

  const byId = useMemo(() => {
    const map = new Map<string, LocalDeal>();
    for (const deal of deals) map.set(deal.id, deal);
    return map;
  }, [deals]);

  const cards = useMemo<EditorialGridCard[]>(
    () =>
      deals.map((deal) => ({
        id: deal.id,
        categoryIcon: deal.emoji,
        title: deal.title,
        subtitle: dealCardSubtitle(deal),
      })),
    [deals]
  );

  function openDeal(deal: LocalDeal) {
    router.push(`/deal/${encodeURIComponent(deal.id)}`);
  }

  const countLabel =
    status === "ready" && totalCount > 0
      ? `${formatDealCount(totalCount)} ${totalCount === 1 ? "deal" : "deals"} near you`
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
        onScroll={handleScroll}
      >
        <View style={styles.backRow}>
          <KindredDetailBackButton onPress={handleBack} />
        </View>

        <Text style={styles.kicker}>Save while you explore</Text>
        <Text style={styles.title}>Deals</Text>
        <Text style={styles.subtitle}>
          A handful of local ways to save — on the experiences, tables, and shops
          worth leaving the house for.
        </Text>
        {countLabel ? <Text style={styles.count}>{countLabel}</Text> : null}

        {status === "loading" ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={paper.terracotta} />
            <Text style={styles.stateText}>Gathering today’s deals…</Text>
          </View>
        ) : null}

        {status === "error" ? (
          <View style={styles.stateBlock}>
            <BanditCharacter
              pose="standing-no-newspaper"
              size={96}
              accessibilityLabel="Bandit, unable to fetch deals right now"
            />
            <Text style={styles.stateHeadline}>Deals took the morning off</Text>
            <Text style={styles.stateText}>
              We couldn’t load Deals just now. Please check back a little later.
            </Text>
          </View>
        ) : null}

        {status === "ready" || status === "empty" ? (
          <EditorialCardGrid
            kicker="💰 Deals"
            compact
            accentColor={LOCAL_DEALS_HOMEPAGE_ACCENT}
            cards={cards}
            initialRenderCount={Math.max(cards.length, 1)}
            analyticsSectionType="local_deals"
            emptyCopy="Fresh local savings are on the way — check back tomorrow morning."
            showBanditWhenEmpty
            onOpenCard={(card) => {
              const deal = byId.get(card.id);
              if (deal) openDeal(deal);
            }}
          />
        ) : null}

        {loadingMore ? (
          <View style={styles.loadMore}>
            <ActivityIndicator color={paper.terracotta} />
          </View>
        ) : null}
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 72,
  },
  backRow: {
    marginBottom: 24,
    alignSelf: "flex-start",
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 10,
  },
  title: {
    ...type.display,
    fontSize: 32,
    lineHeight: 38,
    color: paper.ink,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 25,
    color: paper.inkBody,
    marginBottom: 12,
    maxWidth: 420,
  },
  count: {
    fontFamily: "Georgia",
    fontSize: 13,
    letterSpacing: 0.2,
    color: paper.inkMuted,
    marginBottom: 28,
  },
  stateBlock: {
    alignItems: "center",
    paddingVertical: 48,
  },
  stateHeadline: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 30,
    color: paper.ink,
    marginTop: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  stateText: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 320,
  },
  loadMore: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
