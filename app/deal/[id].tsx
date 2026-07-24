import { useMemo } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DetailHeroCard } from "../../components/DetailHeroCard";
import { PullDownNavHeader } from "../../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../../lib/navigation/usePullDownNavScreen";
import { articleBackRowInsets } from "../../lib/navigation/articleBackLayout";
import {
  dealCategory,
  dealMapsUrl,
  getLocalDealById,
  LOCAL_DEALS_HOMEPAGE_ACCENT,
} from "../../lib/deals/localDeals";
import { detailTint } from "../../lib/edition/detailHero";
import { paper, press } from "../../lib/edition/newspaperTheme";

/**
 * Local Deal — full article-style page. Hero imagery, the offer, how much you
 * save, the practical details, and clear actions (Maps, Website, Redeem). The
 * Redeem action is an intentional placeholder until a verified redemption path
 * ships — no monetization or affiliate logic runs here.
 */
export default function DealDetailScreen() {
  const { id, backLabel } = useLocalSearchParams<{
    id: string;
    backLabel?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const dealId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const deal = useMemo(
    () => (dealId ? getLocalDealById(decodeURIComponent(dealId)) : null),
    [dealId]
  );

  const back =
    typeof backLabel === "string" && backLabel.trim()
      ? decodeURIComponent(backLabel)
      : "← Local Deals";

  function handleBack() {
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    backLabel: back,
    itemTitle: deal?.title ?? null,
    fallbackTitle: "Local Deals",
    backAccessibilityLabel: back.replace(/^←\s*/, "Back to "),
  });

  if (!deal) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <Pressable
          onPress={handleBack}
          style={[styles.backRow, articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true })]}
        >
          <Text style={styles.back}>{back}</Text>
        </Pressable>
        <Text style={styles.missing}>This deal is no longer available.</Text>
      </SafeAreaView>
    );
  }

  const category = dealCategory(deal.category);

  function openMaps() {
    if (!deal) return;
    void Linking.openURL(dealMapsUrl(deal)).catch(() => {});
  }

  function openWebsite() {
    if (!deal?.website) return;
    void Linking.openURL(deal.website).catch(() => {});
  }

  function redeem() {
    Alert.alert(
      "Redeem in the app",
      "Deal redemption opens when Local Deals goes live. This is a preview of how it will work."
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
      >
        <Pressable
          onPress={handleBack}
          style={[styles.backRow, articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true })]}
          accessibilityRole="button"
          accessibilityLabel={back.replace(/^←\s*/, "Back to ")}
        >
          <Text style={styles.back}>{back}</Text>
        </Pressable>

        <View style={styles.body}>
          <DetailHeroCard
            emoji={deal.emoji}
            title={deal.title}
            categoryLabel={category.title}
            accent={LOCAL_DEALS_HOMEPAGE_ACCENT}
            style={styles.hero}
          />

          <Text style={styles.merchant} maxFontSizeMultiplier={1.2}>
            {deal.merchant} · {deal.city}
          </Text>

          <View style={styles.savingsCard}>
            <Text style={styles.savingsLabel}>What you save</Text>
            <Text style={styles.savingsDetail}>{deal.savingsDetail}</Text>
            {deal.expiration ? (
              <Text style={styles.expiration}>{deal.expiration}</Text>
            ) : null}
          </View>

          <Text style={styles.description} maxFontSizeMultiplier={1.3}>
            {deal.description}
          </Text>

          <Pressable
            onPress={redeem}
            style={({ pressed }) => [
              styles.redeem,
              pressed && { opacity: press.opacity },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Redeem deal — preview"
          >
            <Text style={styles.redeemText}>Redeem Deal</Text>
          </Pressable>

          <View style={styles.secondaryActions}>
            <Pressable
              onPress={openMaps}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && { opacity: press.opacity },
              ]}
              accessibilityRole="link"
              accessibilityLabel={`Open ${deal.merchant} in Google Maps`}
            >
              <Text style={styles.secondaryText}>Google Maps</Text>
            </Pressable>

            {deal.website ? (
              <Pressable
                onPress={openWebsite}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && { opacity: press.opacity },
                ]}
                accessibilityRole="link"
                accessibilityLabel={`Open the ${deal.merchant} website`}
              >
                <Text style={styles.secondaryText}>Official Website</Text>
              </Pressable>
            ) : null}
          </View>

          {deal.terms?.trim() ? (
            <View style={styles.termsBlock}>
              <Text style={styles.termsHeading}>Terms &amp; Conditions</Text>
              <Text style={styles.termsText} maxFontSizeMultiplier={1.3}>
                {deal.terms.trim()}
              </Text>
            </View>
          ) : null}

          <Text style={styles.previewNote} maxFontSizeMultiplier={1.2}>
            Preview — sample deal shown while Local Deals is in development.
          </Text>
        </View>
      </ScrollView>
      <PullDownNavHeader {...pullDownNavScreen.headerProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: paper.page,
  },
  scroll: {
    paddingBottom: 64,
  },
  backRow: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  back: {
    fontSize: 15,
    color: paper.terracotta,
    letterSpacing: 0.2,
  },
  missing: {
    fontFamily: "Georgia",
    fontSize: 22,
    color: paper.inkMuted,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  hero: {
    marginBottom: 22,
  },
  merchant: {
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
    marginTop: 4,
    marginBottom: 22,
    textAlign: "center",
  },
  savingsCard: {
    borderRadius: 18,
    backgroundColor: detailTint(LOCAL_DEALS_HOMEPAGE_ACCENT),
    padding: 20,
    marginBottom: 24,
  },
  savingsLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.inkMuted,
    marginBottom: 8,
  },
  savingsDetail: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    color: paper.ink,
  },
  expiration: {
    fontSize: 13,
    lineHeight: 19,
    color: paper.inkMuted,
    marginTop: 10,
  },
  description: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 30,
    color: paper.inkBody,
    marginBottom: 28,
    maxWidth: 520,
  },
  redeem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: paper.terracotta,
    marginBottom: 14,
  },
  redeemText: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#FFFFFF",
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.terracotta,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: paper.terracotta,
  },
  termsBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.border,
    paddingTop: 20,
    marginBottom: 20,
  },
  termsHeading: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.inkMuted,
    marginBottom: 10,
  },
  termsText: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    color: paper.inkBody,
    maxWidth: 520,
  },
  previewNote: {
    fontSize: 12,
    letterSpacing: 0.3,
    fontStyle: "italic",
    color: paper.inkFaint,
  },
});
