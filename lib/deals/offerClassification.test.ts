import { test } from "node:test";
import assert from "node:assert/strict";
import type { LocalDeal } from "./localDeals.ts";
import {
  buildOfferSections,
  classifyOffer,
  isEligibleForReaderMetro,
  normalizeKey,
  OFFER_OVERRIDES,
  OFFER_SCOPE_ORDER,
  OFFER_TAXONOMY,
  scopeSectionDeals,
  type ClassifiableOffer,
  type OfferClassification,
} from "./offerClassification.ts";

function offer(overrides: Partial<ClassifiableOffer> = {}): ClassifiableOffer {
  return {
    id: "some-offer",
    merchant: "Some Merchant",
    title: "A great deal",
    description: "",
    scope: "online",
    sourceCategory: null,
    metroSlug: null,
    ...overrides,
  };
}

function deal(overrides: Partial<LocalDeal> = {}): LocalDeal {
  return {
    id: "deal-1",
    category: "things_to_do",
    emoji: "🎟️",
    merchant: "Merchant",
    title: "Title",
    savingsLabel: "Save",
    description: "",
    savingsDetail: "",
    knownFor: "",
    city: "",
    scope: "online",
    metroSlug: null,
    state: null,
    sourceCategory: null,
    ...overrides,
  };
}

function ok(offer: ClassifiableOffer): OfferClassification {
  const result = classifyOffer(offer);
  assert.equal(result.ok, true, `expected classifiable: ${offer.id}`);
  if (!result.ok) throw new Error("unreachable");
  return result.classification;
}

// --- Overrides are authoritative -------------------------------------------

test("override by merchant name wins over raw scope", () => {
  const c = ok(
    offer({
      id: "extranomical-alcatraz-sf-city-tour",
      merchant: "Extranomical Tours",
      scope: "local",
      metroSlug: "san-francisco-ca",
      sourceCategory: "things_to_do",
    })
  );
  assert.equal(c.scope, "travel");
  assert.equal(c.subcategory.id, "attractions");
  assert.equal(c.isNationwide, true);
});

test("override map keys are normalized lookups", () => {
  assert.ok(OFFER_OVERRIDES["extranomical tours"]);
  assert.equal(normalizeKey("Extranomical  Tours!"), "extranomical tours");
});

test("override category label resolves to a subcategory id", () => {
  const c = ok(
    offer({ merchant: "Extranomical Tours", scope: "nationwide" })
  );
  // "attractions" from the override map resolves to the real subcategory.
  assert.equal(c.subcategory.id, "attractions");
});

// --- Raw scope drives the base decision ------------------------------------

test("db scope online → online", () => {
  assert.equal(ok(offer({ scope: "online" })).scope, "online");
});

test("db scope local (with metro) → local", () => {
  const c = ok(offer({ scope: "local", metroSlug: "gilbert-az" }));
  assert.equal(c.scope, "local");
  assert.equal(c.isNationwide, false);
  assert.equal(c.metroSlug, "gilbert-az");
});

test("db scope nationwide + travel keyword → travel", () => {
  const c = ok(
    offer({ scope: "nationwide", title: "Guided Alcatraz Tour", merchant: "X" })
  );
  assert.equal(c.scope, "travel");
});

test("db scope nationwide without travel signal → online", () => {
  const c = ok(
    offer({ scope: "nationwide", title: "20% off sneakers", merchant: "ShoeCo" })
  );
  assert.equal(c.scope, "online");
});

// --- Exclusions (trust over volume) ----------------------------------------

test("local offer with no metro is excluded", () => {
  const result = classifyOffer(offer({ scope: "local", metroSlug: null }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "local_without_metro");
});

test("unknown/blank scope is excluded", () => {
  const result = classifyOffer(
    offer({ scope: undefined, sourceCategory: null, title: "", description: "" })
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unknown_scope");
});

// --- Subcategory inference --------------------------------------------------

test("local restaurant keyword → food_drink", () => {
  const c = ok(
    offer({ scope: "local", metroSlug: "gilbert-az", title: "BOGO tacos at the taqueria" })
  );
  assert.equal(c.subcategory.id, "food_drink");
});

test("online sneakers keyword → clothing_accessories", () => {
  const c = ok(offer({ scope: "online", title: "New sneaker drop", description: "fashion apparel" }));
  assert.equal(c.subcategory.id, "clothing_accessories");
});

test("travel cruise keyword → cruises", () => {
  const c = ok(offer({ scope: "nationwide", title: "Sunset dinner cruise" }));
  assert.equal(c.scope, "travel");
  assert.equal(c.subcategory.id, "cruises");
});

test("legacy db category maps when no keyword matches (local)", () => {
  const c = ok(
    offer({
      scope: "local",
      metroSlug: "gilbert-az",
      sourceCategory: "restaurants",
      title: "Weekend special",
      description: "",
      merchant: "Place",
    })
  );
  assert.equal(c.subcategory.id, "food_drink");
});

test("unmatched offer lands in the scope's Other bucket", () => {
  const c = ok(
    offer({ scope: "online", title: "Mystery membership", description: "", sourceCategory: null, merchant: "ZZ" })
  );
  assert.equal(c.subcategory.id, "other_online");
});

// --- Metro eligibility ------------------------------------------------------

test("nationwide offers are eligible in any metro (and with no metro)", () => {
  const travel: OfferClassification = {
    scope: "travel",
    subcategory: OFFER_TAXONOMY.travel.subcategories[0],
    isNationwide: true,
    metroSlug: null,
  };
  assert.equal(isEligibleForReaderMetro(travel, "gilbert-az"), true);
  assert.equal(isEligibleForReaderMetro(travel, null), true);
});

test("local offer eligible only for its exact metro", () => {
  const local: OfferClassification = {
    scope: "local",
    subcategory: OFFER_TAXONOMY.local.subcategories[0],
    isNationwide: false,
    metroSlug: "gilbert-az",
  };
  assert.equal(isEligibleForReaderMetro(local, "gilbert-az"), true);
  assert.equal(isEligibleForReaderMetro(local, "seattle-wa"), false);
  assert.equal(isEligibleForReaderMetro(local, null), false);
});

// --- Section builder --------------------------------------------------------

test("buildOfferSections returns all three scopes in order", () => {
  const sections = buildOfferSections([], "gilbert-az");
  assert.deepEqual(
    sections.map((s) => s.scope),
    [...OFFER_SCOPE_ORDER]
  );
  for (const section of sections) assert.equal(section.total, 0);
});

test("buildOfferSections filters local by metro but keeps nationwide", () => {
  const deals: LocalDeal[] = [
    deal({ id: "sf-local", scope: "local", metroSlug: "san-francisco-ca", title: "SF cafe deal", sourceCategory: "restaurants" }),
    deal({ id: "gilbert-local", scope: "local", metroSlug: "gilbert-az", title: "Gilbert taco deal", sourceCategory: "restaurants" }),
    deal({ id: "alcatraz", merchant: "Extranomical Tours", scope: "local", metroSlug: "san-francisco-ca", title: "Alcatraz tour" }),
    deal({ id: "online-shoes", scope: "online", title: "sneaker sale", description: "apparel" }),
  ];

  const sections = buildOfferSections(deals, "gilbert-az");
  const byScope = Object.fromEntries(sections.map((s) => [s.scope, s]));

  // Only the Gilbert local offer survives metro filtering.
  assert.equal(byScope.local.total, 1);
  assert.equal(scopeSectionDeals(byScope.local)[0].id, "gilbert-local");

  // Alcatraz (override → travel) is nationwide, so a Gilbert reader still sees it.
  assert.equal(byScope.travel.total, 1);
  assert.equal(scopeSectionDeals(byScope.travel)[0].id, "alcatraz");

  // Online offer surfaces nationwide.
  assert.equal(byScope.online.total, 1);
  assert.equal(scopeSectionDeals(byScope.online)[0].id, "online-shoes");
});

test("buildOfferSections de-duplicates by id and groups by subcategory", () => {
  const deals: LocalDeal[] = [
    deal({ id: "dup", scope: "online", title: "sneaker sale", description: "apparel" }),
    deal({ id: "dup", scope: "online", title: "sneaker sale", description: "apparel" }),
    deal({ id: "book", scope: "online", title: "ebook bundle", description: "learning course" }),
  ];
  const online = buildOfferSections(deals, null).find((s) => s.scope === "online")!;
  assert.equal(online.total, 2);
  const ids = online.groups.map((g) => g.subcategory.id).sort();
  assert.deepEqual(ids, ["books_education", "clothing_accessories"]);
});

test("empty local + populated online (unknown reader metro)", () => {
  const deals: LocalDeal[] = [
    deal({ id: "local-x", scope: "local", metroSlug: "gilbert-az", title: "taco deal" }),
    deal({ id: "online-x", scope: "online", title: "sneaker sale", description: "apparel" }),
  ];
  const sections = buildOfferSections(deals, null);
  const byScope = Object.fromEntries(sections.map((s) => [s.scope, s]));
  assert.equal(byScope.local.total, 0); // reader metro unknown → no local
  assert.equal(byScope.online.total, 1); // nationwide still shows
});
