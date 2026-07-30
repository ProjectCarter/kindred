import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  EditorialCardGrid,
  type EditorialGridCard,
} from "../components/EditorialCardGrid";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { BanditCharacter } from "../components/BanditCharacter";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { useOfferSections } from "../lib/deals/useLocalDeals";
import { scopeSectionDeals } from "../lib/deals/offerClassification";
import { formatDealCount } from "../lib/deals/dealCounts";
import {
  dealCardSubtitle,
  LOCAL_DEALS_HOMEPAGE_ACCENT,
  type LocalDeal,
} from "../lib/deals/localDeals";
import { paper, type } from "../lib/edition/newspaperTheme";

/**
 * Offers — full list. A continuation of the homepage, organized into the same
 * three layers the classification engine returns: Local, then Travel, then
 * Online. Within each scope, offers are grouped by subcategory (only non-empty
 * groups render). All scope/subcategory decisions come from the engine — this
 * screen only maps sections to the shared compact card grid. No listing
 * photography; imagery lives on the detail page, matching every desk.
 */
export default function DealsScreen() {
  const router = useRouter();
  const { region } = useLocalSearchParams<{ region?: string }>();
  const regionKey = typeof region === "string" ? region : null;

  const { status, sections, totalCount } = useOfferSections(regionKey);

  function handleBack() {
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    title: "Offers",
    backAccessibilityLabel: "Back to Homepage",
  });

  const openDeal = useCallback(
    (deal: LocalDeal) => {
      router.push(`/deal/${encodeURIComponent(deal.id)}`);
    },
    [router]
  );

  const byId = useMemo(() => {
    const map = new Map<string, LocalDeal>();
    for (const section of sections) {
      for (const deal of scopeSectionDeals(section)) map.set(deal.id, deal);
    }
    return map;
  }, [sections]);

  const openCard = useCallback(
    (card: EditorialGridCard) => {
      const deal = byId.get(card.id);
      if (deal) openDeal(deal);
    },
    [byId, openDeal]
  );

  const countLabel =
    status === "ready" && totalCount > 0
      ? `${formatDealCount(totalCount)} ${totalCount === 1 ? "offer" : "offers"} for you`
      : null;

  const ready = status === "ready" || status === "empty";

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
        <Text style={styles.title}>Offers</Text>
        <Text style={styles.subtitle}>
          Local ways to save, destinations worth traveling for, and deals you can
          redeem from anywhere.
        </Text>
        {countLabel ? <Text style={styles.count}>{countLabel}</Text> : null}

        {status === "loading" ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={paper.terracotta} />
            <Text style={styles.stateText}>Gathering today’s offers…</Text>
          </View>
        ) : null}

        {status === "error" ? (
          <View style={styles.stateBlock}>
            <BanditCharacter
              pose="standing-no-newspaper"
              size={96}
              accessibilityLabel="Bandit, unable to fetch offers right now"
            />
            <Text style={styles.stateHeadline}>Offers took the morning off</Text>
            <Text style={styles.stateText}>
              We couldn’t load Offers just now. Please check back a little later.
            </Text>
          </View>
        ) : null}

        {ready && totalCount === 0 ? (
          <View style={styles.stateBlock}>
            <BanditCharacter
              pose="standing-no-newspaper"
              size={96}
              accessibilityLabel="Bandit, waiting with no offers to deliver yet"
            />
            <Text style={styles.stateHeadline}>Nothing to redeem just yet</Text>
            <Text style={styles.stateText}>
              Fresh savings are on the way — check back tomorrow morning.
            </Text>
          </View>
        ) : null}

        {ready && totalCount > 0
          ? sections.map((section) => {
              if (section.total === 0) {
                // Travel / Online with nothing today simply don't render. Local
                // gets a tasteful "coming soon" so readers know it exists.
                if (section.scope !== "local") return null;
                return (
                  <View key={section.scope} style={styles.scopeBlock}>
                    <Text style={styles.scopeHeading}>
                      {section.emoji} {section.label}
                    </Text>
                    <Text style={styles.localEmpty}>
                      Local offers are coming soon for your area.
                    </Text>
                  </View>
                );
              }

              return (
                <View key={section.scope} style={styles.scopeBlock}>
                  <Text style={styles.scopeHeading}>
                    {section.emoji} {section.label}
                  </Text>
                  <Text style={styles.scopeTagline}>{section.tagline}</Text>

                  {section.groups.map((group) => {
                    const cards: EditorialGridCard[] = group.deals.map(
                      (deal) => ({
                        id: deal.id,
                        categoryIcon: deal.emoji,
                        title: deal.title,
                        subtitle: dealCardSubtitle(deal),
                      })
                    );
                    return (
                      <EditorialCardGrid
                        key={group.subcategory.id}
                        kicker={`${group.subcategory.emoji} ${group.subcategory.label}`}
                        compact
                        accentColor={LOCAL_DEALS_HOMEPAGE_ACCENT}
                        cards={cards}
                        initialRenderCount={Math.max(cards.length, 1)}
                        onOpenCard={openCard}
                      />
                    );
                  })}
                </View>
              );
            })
          : null}
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
  scopeBlock: {
    marginTop: 8,
    marginBottom: 8,
  },
  scopeHeading: {
    ...type.display,
    fontSize: 24,
    lineHeight: 30,
    color: paper.ink,
    marginBottom: 4,
  },
  scopeTagline: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 18,
    maxWidth: 420,
  },
  localEmpty: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 23,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 8,
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
