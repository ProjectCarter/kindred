import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  LOCAL_DEALS_HOMEPAGE_ACCENT,
  type LocalDeal,
} from "../../lib/deals/localDeals";
import { fetchDealById } from "../../lib/deals/dealsRepository";
import { canRedeemOffer, redeemOffer } from "../../lib/deals/redeemOffer";
import { GOOGLE_MAPS_ACTION_LABEL } from "../../lib/edition/googleMaps";
import { detailTint, toAboutParagraphs } from "../../lib/edition/detailHero";
import { paper, press } from "../../lib/edition/newspaperTheme";

/**
 * Deal — full article-style page. Hero, the offer, how much you save, the
 * practical details, and clear actions (Maps, Redeem). The deal is read from the
 * published catalog by its public `deal_key`. Affiliate redirects happen only
 * after tapping "Redeem Deal".
 */
export default function DealDetailScreen() {
  const { id, backLabel } = useLocalSearchParams<{
    id: string;
    backLabel?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const dealId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const [deal, setDeal] = useState<LocalDeal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const key = dealId ? decodeURIComponent(dealId) : "";
      const found = key ? await fetchDealById(key) : null;
      if (cancelled) return;
      setDeal(found);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

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
    fallbackTitle: "Offers",
    backAccessibilityLabel: back.replace(/^←\s*/, "Back to "),
  });

  // ABOUT — one or two concise editorial paragraphs, deduped against the warm
  // "Why you'll love it" line so the card never repeats itself.
  const overviewParagraphs = useMemo(
    () =>
      deal
        ? toAboutParagraphs(deal.description, {
            maxParagraphs: 2,
            maxWordsEach: 55,
            avoid: deal.knownFor ?? null,
          })
        : [],
    [deal]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <Pressable
          onPress={handleBack}
          style={[styles.backRow, articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true })]}
        >
          <Text style={styles.back}>{back}</Text>
        </Pressable>
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={paper.terracotta} />
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.missing}>This offer is no longer available.</Text>
      </SafeAreaView>
    );
  }

  const category = dealCategory(deal.category);
  // Google Maps only makes sense for a physical local business. Online and
  // nationwide offers have no single location, so the Maps action is hidden.
  const showMaps = deal.scope === "local" && Boolean(deal.city.trim());
  // Redeem is shown only when the offer carries a safe, openable affiliate URL.
  const canRedeem = canRedeemOffer(deal);
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
    parts.push("", deal.website || deal.redeemUrl || "From today’s D.R.O.P. edition");
    void Share.share({ message: parts.join("\n"), title: deal.title }).catch(
      () => {}
    );
  }

  async function redeem() {
    if (!deal) return;
    // Affiliate redirect happens only here, on explicit intent. The reusable
    // helper opens the EXACT stored redeem URL (tracking preserved) in the
    // browser; it fails soft if the link can't be opened.
    const opened = await redeemOffer(deal);
    if (!opened) {
      Alert.alert(
        "Offer unavailable",
        "This offer can’t be opened right now. Please try again later."
      );
    }
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

          {/* Share — same row and placement as every detail page. Deals are not
              saveable in V1, so only Share is shown here. */}
          <View style={styles.iconRow}>
            <ShareIconButton onPress={shareDeal} style={styles.iconButton} />
          </View>

          {/* Google Maps (local only) + Redeem — standardized stacked buttons.
              The Redeem button appears only when the offer has a valid
              affiliate URL; the whole stack hides if neither action applies. */}
          {showMaps || canRedeem ? (
            <DetailActionStack style={styles.actions}>
              {showMaps ? (
                <DetailActionButton
                  label={GOOGLE_MAPS_ACTION_LABEL}
                  variant="secondary"
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${deal.merchant} in Google Maps`}
                  onPress={openMaps}
                />
              ) : null}
              {canRedeem ? (
                <DetailActionButton
                  label="Redeem Offer"
                  variant="primary"
                  accessibilityRole="link"
                  accessibilityLabel={`Redeem offer at ${deal.merchant}`}
                  onPress={redeem}
                />
              ) : null}
            </DetailActionStack>
          ) : null}

          {/* Quick Overview — everything about the deal in one card. */}
          <DetailAboutCard
            label="About this offer"
            title={overviewTitle}
            meta={overviewMeta ?? undefined}
            body={overviewParagraphs.length ? overviewParagraphs : undefined}
            knownFor={deal.knownFor?.trim() || undefined}
            tint={detailTint(LOCAL_DEALS_HOMEPAGE_ACCENT)}
            style={styles.aboutCard}
          >
            {deal.terms?.trim() ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>GOOD TO KNOW</Text>
                <Text style={styles.blockText} maxFontSizeMultiplier={1.3}>
                  {deal.terms.trim()}
                </Text>
              </View>
            ) : null}

            {deal.source?.trim() ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>SOURCE</Text>
                <Text style={styles.blockText} maxFontSizeMultiplier={1.3}>
                  Offer provided via {deal.source.trim()}.
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
              D.R.O.P. summarizes trusted offers for quick local discovery. This
              is not the merchant’s full listing.
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
  loadingBlock: {
    paddingTop: 64,
    alignItems: "center",
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
  block: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.border,
  },
  blockLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: paper.inkMuted,
    marginBottom: 6,
  },
  blockText: {
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
