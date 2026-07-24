import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { BanditCharacter } from "../components/BanditCharacter";
import { DealImagePanel } from "../components/DealImagePanel";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { useLocalDeals } from "../lib/deals/useLocalDeals";
import type { LocalDeal } from "../lib/deals/localDeals";
import { paper, press, type } from "../lib/edition/newspaperTheme";

/**
 * Local Deals — full browsable desk. Unlike the emoji-only homepage, this page
 * is where imagery lives: each deal carries a category panel (or authorized
 * merchant photo when available). Deals are grouped into the eight Kindred deal
 * categories for calm, magazine-style browsing.
 */
export default function DealsScreen() {
  const router = useRouter();
  const { status, groups } = useLocalDeals();

  function handleBack() {
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    title: "Local Deals",
    backAccessibilityLabel: "Back to today’s paper",
  });

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

        {status === "empty" ? (
          <View style={styles.stateBlock}>
            <BanditCharacter
              pose="standing-no-newspaper"
              size={96}
              accessibilityLabel="Bandit, waiting with no deals to deliver yet"
            />
            <Text style={styles.stateHeadline}>No deals just yet</Text>
            <Text style={styles.stateText}>
              Fresh local savings are on the way — check back tomorrow morning.
            </Text>
          </View>
        ) : null}

        {status === "ready"
          ? groups.map((group) => (
              <View key={group.category.id} style={styles.categoryBlock}>
                <View style={styles.categoryHeaderRow}>
                  <Text style={styles.categoryHeader}>
                    {group.category.emoji}  {group.category.title}
                  </Text>
                  <View style={styles.categoryRule} />
                </View>

                {group.deals.map((deal) => (
                  <Pressable
                    key={deal.id}
                    onPress={() => openDeal(deal)}
                    accessibilityRole="button"
                    accessibilityLabel={`${deal.title} at ${deal.merchant}. ${deal.savingsLabel}.`}
                    style={({ pressed }) => [
                      styles.card,
                      pressed && { opacity: press.opacity },
                    ]}
                  >
                    <DealImagePanel deal={deal} height={160} />
                    <View style={styles.cardBody}>
                      <View style={styles.savingsPill}>
                        <Text style={styles.savingsPillText}>{deal.savingsLabel}</Text>
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {deal.title}
                      </Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {deal.merchant} · {deal.city}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))
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
  categoryBlock: {
    marginBottom: 36,
  },
  categoryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  categoryHeader: {
    fontFamily: "Georgia",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
  },
  categoryRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  card: {
    marginBottom: 22,
    borderRadius: 18,
    backgroundColor: paper.cream,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    overflow: "hidden",
  },
  cardBody: {
    padding: 16,
  },
  savingsPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: paper.terracottaWash,
    marginBottom: 10,
  },
  savingsPillText: {
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  cardTitle: {
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: paper.ink,
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: paper.inkMuted,
  },
});
