/**
 * Deals publish pass — normalize → catalog → published.
 *
 * The sync job gathers `NormalizedDeal[]` from every configured connector, then
 * this module:
 *   1. Drops anything unsafe (Family-Friendly / restricted-business standard) or
 *      non-redeemable (no valid http(s) tracking URL). Trust over volume.
 *   2. Upserts survivors into `deals_catalog` (raw, deduped by provider+id).
 *   3. Projects them into the anon-readable `deals_published` table the app
 *      reads (upsert by stable `deal_key`).
 *
 * It NEVER deletes or archives rows it did not create — the manually seeded
 * Alcatraz offer (migration 0064) and any hand-curated published rows are left
 * untouched. Expiry is handled by the `deals_published` RLS policy (ends_at).
 *
 * Pure helpers are exported so the mapping + gating can be unit-tested with no
 * database or network.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isRestrictedBusinessListing } from "../editorial/restrictedBusinessFilter.ts";
import { gatherFromAllDealSources } from "./registry.ts";
import type { NormalizedDeal } from "./types.ts";

// --- Category → emoji (server mirror of the 8 Kindred deal categories) -------
// Kept minimal + stable; mirrors lib/deals/localDeals.ts DEAL_CATEGORIES.

const CATEGORY_EMOJI: Record<string, string> = {
  things_to_do: "🎟️",
  restaurants: "🍽️",
  coffee_dessert: "☕",
  breweries_wine: "🍺",
  shopping: "🛍️",
  entertainment: "🎭",
  hotels_staycations: "🏨",
  travel_transportation: "✈️",
};

const KNOWN_CATEGORIES = new Set(Object.keys(CATEGORY_EMOJI));

/** Coerce a possibly-unknown category to a known id (safe default). */
function safeCategory(category: string): string {
  return KNOWN_CATEGORIES.has(category) ? category : "things_to_do";
}

function emojiForCategory(category: string): string {
  return CATEGORY_EMOJI[safeCategory(category)];
}

// --- Redeem-URL validation (server mirror of lib/deals/redeemUrl.ts) ---------

/** Exact http(s) URL, or null. Never rewrites or appends parameters. */
export function normalizeRedeemUrl(raw: string | null | undefined): string | null {
  const url = raw?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

// --- Normalization helpers (pure) --------------------------------------------

/** Lowercase, alphanumerics separated by single spaces. */
export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Stable public key for a deal: `${provider}-${merchant}-${providerId}`. */
export function dealKeyFor(deal: NormalizedDeal): string {
  return [deal.provider, slug(deal.merchant), slug(deal.providerId)]
    .filter(Boolean)
    .join("-");
}

/** Content hash used for change detection in the raw catalog. */
export function contentFingerprint(deal: NormalizedDeal): string {
  const basis = [
    deal.title,
    deal.merchant,
    deal.savingsLabel ?? "",
    deal.description ?? "",
    deal.redeemUrl ?? "",
    deal.endsAt ?? "",
  ].join("|");
  let hash = 5381;
  for (let i = 0; i < basis.length; i += 1) {
    hash = ((hash << 5) + hash) ^ basis.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Deterministic UUID derived from a key, so upserts keep a stable primary key. */
export function stableUuid(key: string): string {
  // Two 64-bit-ish FNV-1a passes → 32 hex chars → RFC-4122-shaped string.
  const hex = (seed: number): string => {
    let h = seed >>> 0;
    for (let i = 0; i < key.length; i += 1) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  const a = hex(0x811c9dc5);
  const b = hex(0x1000193);
  const c = hex(0xdeadbeef);
  const d = hex(0x9e3779b9);
  const raw = `${a}${b}${c}${d}`;
  return [
    raw.slice(0, 8),
    raw.slice(8, 12),
    raw.slice(12, 16),
    raw.slice(16, 20),
    raw.slice(20, 32),
  ].join("-");
}

// --- Safety + publishability -------------------------------------------------

/**
 * True when a deal is safe and complete enough to publish: passes the
 * restricted-business / weapons safety gate, has a valid redeem URL, and carries
 * the required editorial fields. Mirrors the client read-time gate.
 */
export function isPublishableDeal(deal: NormalizedDeal): boolean {
  if (!deal.merchant?.trim() || !deal.title?.trim()) return false;
  if (!normalizeRedeemUrl(deal.redeemUrl)) return false;
  if (
    isRestrictedBusinessListing({
      name: deal.merchant,
      venue: deal.merchant,
      category: deal.category,
      dek: deal.title,
      description: deal.description,
    })
  ) {
    return false;
  }
  return true;
}

// --- Row projections ---------------------------------------------------------

export type CatalogRow = Record<string, unknown>;
export type PublishedRow = Record<string, unknown>;

/** Project a NormalizedDeal into a `deals_catalog` insert row. */
export function toCatalogRow(deal: NormalizedDeal): CatalogRow {
  return {
    scope: deal.scope,
    metro_key: deal.metroKey ?? null,
    provider: deal.provider,
    provider_id: deal.providerId,
    provider_category: deal.providerCategory ?? null,
    category: safeCategory(deal.category),
    deal_type: deal.dealType ?? null,
    discount_type: deal.discountType ?? null,
    merchant: deal.merchant,
    normalized_merchant: normalizeMerchant(deal.merchant),
    title: deal.title,
    savings_label: deal.savingsLabel ?? null,
    description: deal.description ?? null,
    savings_detail: deal.savingsDetail ?? null,
    known_for: deal.knownFor ?? null,
    highlights: deal.highlights ?? [],
    terms: deal.terms ?? null,
    voucher_code: deal.voucherCode ?? null,
    city: deal.city ?? null,
    state: deal.state ?? null,
    lat: deal.lat ?? null,
    lon: deal.lon ?? null,
    website: deal.website ?? null,
    redeem_url: normalizeRedeemUrl(deal.redeemUrl),
    image_url: deal.imageUrl ?? null,
    content_fingerprint: contentFingerprint(deal),
    lifecycle: "new",
    status: "active",
    starts_at: deal.startsAt ?? null,
    ends_at: deal.endsAt ?? null,
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Project a NormalizedDeal into an anon-readable `deals_published` row. */
export function toPublishedRow(deal: NormalizedDeal): PublishedRow {
  const category = safeCategory(deal.category);
  const dealKey = dealKeyFor(deal);
  return {
    id: stableUuid(dealKey),
    deal_key: dealKey,
    scope: deal.scope,
    region_key: deal.metroKey ?? null,
    category,
    deal_type: deal.dealType ?? null,
    discount_type: deal.discountType ?? null,
    emoji: emojiForCategory(category),
    merchant: deal.merchant,
    title: deal.title,
    savings_label: deal.savingsLabel?.trim() || "Offer",
    description: deal.description?.trim() || deal.title,
    savings_detail: deal.savingsDetail?.trim() || "",
    known_for: deal.knownFor ?? null,
    highlights: deal.highlights ?? [],
    city: deal.city ?? null,
    state: deal.state ?? null,
    lat: deal.lat ?? null,
    lon: deal.lon ?? null,
    website: deal.website ?? null,
    redeem_url: normalizeRedeemUrl(deal.redeemUrl),
    source: "AWIN",
    terms: deal.terms ?? null,
    voucher_code: deal.voucherCode ?? null,
    image_url: null,
    quality_score: 0.6,
    starts_at: deal.startsAt ?? null,
    ends_at: deal.endsAt ?? null,
    status: "published",
    updated_at: new Date().toISOString(),
  };
}

// --- Orchestration -----------------------------------------------------------

export type DealsSyncStats = {
  ok: boolean;
  gathered: number;
  publishable: number;
  publishedUpserts: number;
  bySource: Record<string, { gathered: number; ok: boolean; error?: string }>;
  error?: string;
};

/**
 * Gather from every configured connector, drop unsafe/non-redeemable offers,
 * and upsert survivors into `deals_catalog` + `deals_published`. Records one
 * `deals_catalog_sync_runs` diagnostics row. Never deletes existing rows.
 */
export async function runDealsSync(
  admin: SupabaseClient,
  options?: { mode?: "incremental" | "full" }
): Promise<DealsSyncStats> {
  const mode = options?.mode ?? "incremental";
  const startedAt = new Date().toISOString();

  const results = await gatherFromAllDealSources({ mode });
  const bySource: DealsSyncStats["bySource"] = {};
  const gathered: NormalizedDeal[] = [];
  for (const result of results) {
    bySource[result.source] = {
      gathered: result.deals.length,
      ok: result.ok,
      error: result.error,
    };
    if (result.ok) gathered.push(...result.deals);
  }

  const publishable = gathered.filter(isPublishableDeal);

  // Dedupe by public deal_key across all sources (stable last-wins).
  const byKey = new Map<string, NormalizedDeal>();
  for (const deal of publishable) byKey.set(dealKeyFor(deal), deal);
  const finalDeals = [...byKey.values()];

  let publishedUpserts = 0;
  let ok = true;
  let error: string | undefined;

  try {
    if (finalDeals.length) {
      const catalogRows = finalDeals.map(toCatalogRow);
      const { error: catalogError } = await admin
        .from("deals_catalog")
        .upsert(catalogRows, { onConflict: "provider,provider_id" });
      if (catalogError) throw new Error(`catalog upsert: ${catalogError.message}`);

      const publishedRows = finalDeals.map(toPublishedRow);
      const { error: publishError } = await admin
        .from("deals_published")
        .upsert(publishedRows, { onConflict: "deal_key" });
      if (publishError) throw new Error(`published upsert: ${publishError.message}`);
      publishedUpserts = publishedRows.length;
    }
  } catch (err) {
    ok = false;
    error = err instanceof Error ? err.message : String(err);
  }

  // Best-effort diagnostics row; a logging failure never fails the sync.
  try {
    await admin.from("deals_catalog_sync_runs").insert({
      provider: "awin",
      mode: "publish",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      raw_deals_returned: gathered.length,
      published_count: publishedUpserts,
      rejected: gathered.length - publishable.length,
      ok,
      error: error ?? null,
      diagnostics: { bySource },
    });
  } catch (logErr) {
    console.warn("[deals:publish] sync_runs insert failed", logErr);
  }

  return {
    ok,
    gathered: gathered.length,
    publishable: publishable.length,
    publishedUpserts,
    bySource,
    error,
  };
}
