import { useMemo } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ShareIconButton } from "../../components/ShareIconButton";
import { DetailHeroCard, DetailAboutCard } from "../../components/DetailHeroCard";
import {
  DetailActionButton,
  DetailActionStack,
} from "../../components/DetailActionButton";
import { PullDownNavHeader } from "../../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../../lib/navigation/usePullDownNavScreen";
import { articleBackRowInsets } from "../../lib/navigation/articleBackLayout";
import {
  dealCategory,
  dealMapsUrl,
  getLocalDealById,
  LOCAL_DEALS_HOMEPAGE_ACCENT,
} from "../../lib/deals/localDeals";
import { GOOGLE_MAPS_ACTION_LABEL } from "../../lib/edition/googleMaps";
import { detailTint, toAboutParagraphs } from "../../lib/edition/detailHero";
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
      : "← Back to Homepage";

  function handleBack() {
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    backLabel: back,
    itemTitle: deal?.title ?? null,
    fallbackTitle: "Deals",
    backAccessibilityLabel: back.replace(/^←\s*/, "Back to "),
  });

  if (!deal) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
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
  // ABOUT — one or two concise editorial paragraphs, deduped against the warm
  // "Why you'll love it" line so the card never repeats itself.
  const overviewParagraphs = toAboutParagraphs(deal.description, {
    maxParagraphs: 2,
    maxWordsEach: 55,
    avoid: deal.knownFor ?? null,
  });
  // Quick fact line — the offer and when it ends, so the warm "Known for" copy
  // can stay purely about why the place is worth a visit.
  const overviewMeta =
    [deal.savingsDetail?.trim(), deal.expiration?.trim()]
      .filter(Boolean)
      .join(" · ") || null;
  const cityShort = deal.city.split(",")[0].trim();
  const overviewTitle = cityShort
    ? `${deal.merchant} • ${cityShort}`
    : deal.merchant;

  function openMaps() {
    if (!deal) return;
    void Linking.openURL(dealMapsUrl(deal)).catch(() => {});
  }

  function shareDeal() {
    if (!deal) return;
    const parts = [deal.title, deal.merchant];
    parts.push("", deal.website || "From today’s Kindred edition");
    void Share.share({ message: parts.join("\n"), title: deal.title }).catch(
      () => {}
    );
  }

  function redeem() {
    Alert.alert(
      "Redeem in the app",
      "Deal redemption opens when Deals goes live. This is a preview of how it will work."
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
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

          {/* Like / Share — same row and placement as every detail page. Local
              Deals are not saveable in V1, so only Share is shown here. */}
          <View style={styles.iconRow}>
            <ShareIconButton onPress={shareDeal} style={styles.iconButton} />
          </View>

          {/* Google Maps + section action — standardized stacked buttons. */}
          <DetailActionStack style={styles.actions}>
            <DetailActionButton
              label={GOOGLE_MAPS_ACTION_LABEL}
              variant="secondary"
              accessibilityRole="link"
              accessibilityLabel={`Open ${deal.merchant} in Google Maps`}
              onPress={openMaps}
            />
            <DetailActionButton
              label="Redeem Deal"
              variant="primary"
              accessibilityLabel="Redeem deal — preview"
              onPress={redeem}
            />
          </DetailActionStack>

          {/* Quick Overview — everything about the deal in one card. */}
          <DetailAboutCard
            label="About this deal"
            title={overviewTitle}
            meta={overviewMeta ?? undefined}
            body={overviewParagraphs.length ? overviewParagraphs : undefined}
            knownFor={deal.knownFor?.trim() || undefined}
            tint={detailTint(LOCAL_DEALS_HOMEPAGE_ACCENT)}
            style={styles.aboutCard}
          >
            {deal.terms?.trim() ? (
              <View style={styles.conditions}>
                <Text style={styles.conditionsLabel}>GOOD TO KNOW</Text>
                <Text style={styles.conditionsText} maxFontSizeMultiplier={1.3}>
                  {deal.terms.trim()}
                </Text>
              </View>
            ) : null}
          </DetailAboutCard>

          {/* Footer — Return → one-line disclaimer. Nothing else. */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back to Homepage"
              style={({ pressed }) => [pressed && { opacity: press.opacity }]}
            >
              <Text style={styles.returnLink}>← Back to Homepage</Text>
            </Pressable>
            <Text style={styles.disclaimer} maxFontSizeMultiplier={1.25}>
              Kindred summarizes trusted listings for quick local discovery. This
              is not the publisher’s full listing.
            </Text>
          </View>
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
    marginBottom: 20,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginBottom: 22,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  actions: {
    marginBottom: 24,
  },
  aboutCard: {
    marginBottom: 24,
  },
  conditions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.border,
  },
  conditionsLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: paper.inkMuted,
    marginBottom: 6,
  },
  conditionsText: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    color: paper.inkBody,
  },
  footer: {
    marginTop: 4,
  },
  returnLink: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.15,
    paddingVertical: 10,
  },
  disclaimer: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginTop: 8,
    maxWidth: 420,
  },
});
