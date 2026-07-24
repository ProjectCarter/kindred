import { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
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
import {
  dealCardSubtitle,
  LOCAL_DEALS_HOMEPAGE_ACCENT,
  type LocalDeal,
} from "../lib/deals/localDeals";
import { paper, type } from "../lib/edition/newspaperTheme";

/**
 * Local Deals — full list. A continuation of the homepage: the exact same
 * stacked compact card layout (via EditorialCardGrid `compact`), simply carrying
 * every deal rather than the front-page preview. No two-column grid, no listing
 * photography — imagery lives on the detail page, matching every other desk.
 */
export default function DealsScreen() {
  const router = useRouter();
  const { status, deals } = useLocalDeals();

  function handleBack() {
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    title: "Local Deals",
    backAccessibilityLabel: "Back to today’s paper",
  });

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
      >
        <View style={styles.backRow}>
          <KindredDetailBackButton onPress={handleBack} />
        </View>

        <Text style={styles.kicker}>Save while you explore</Text>
        <Text style={styles.title}>Local Deals</Text>
        <Text style={styles.subtitle}>
          A handful of local ways to save — on the experiences, tables, and shops
          worth leaving the house for.
        </Text>

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
              We couldn’t load Local Deals just now. Please check back a little later.
            </Text>
          </View>
        ) : null}

        {status === "ready" || status === "empty" ? (
          <EditorialCardGrid
            kicker="💰 Local Deals"
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
    marginBottom: 32,
    maxWidth: 420,
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
});
