/**
 * Local Deals — Version 1 editorial data model and placeholder catalog.
 *
 * This module is the single source of truth for the Local Deals desk while
 * affiliate integrations are still ahead of us. Every deal here is a realistic
 * placeholder using invented local merchant names so nothing is fabricated
 * about a real business. When a verified affiliate feed lands later, it should
 * produce the same `LocalDeal` shape and these seeds can be retired.
 *
 * No network, no affiliate SDKs, no monetization logic — presentation data only.
 */

/** The eight browsable Local Deals categories (See All grouping order). */
export type DealCategoryId =
  | "things_to_do"
  | "restaurants"
  | "coffee_dessert"
  | "breweries_wine"
  | "shopping"
  | "entertainment"
  | "hotels_staycations"
  | "travel_transportation";

export type DealCategory = {
  id: DealCategoryId;
  /** Section title shown on the See All page. */
  title: string;
  /** One permanent category emoji (Kindred visual-language aligned). */
  emoji: string;
  /** Soft pastel used for image panels and category tinting. */
  accent: string;
};

/**
 * A single curated local deal. `imageUrl` is intentionally null for placeholder
 * seeds — the UI renders an elegant branded panel instead of a fabricated photo.
 * When authorized merchant photography is available it slots straight in here.
 */
export type LocalDeal = {
  id: string;
  category: DealCategoryId;
  /** Most specific editorial emoji for this deal (homepage identifier). */
  emoji: string;
  /** Merchant / venue name. */
  merchant: string;
  /** Headline offer — the deal itself (e.g. "Buy One Get One Pizza"). */
  title: string;
  /** Short savings badge for cards (e.g. "BOGO", "20% off", "Free side"). */
  savingsLabel: string;
  /** Editorial description — why this is worth it (verified-safe, no invented claims). */
  description: string;
  /** Plain-language savings summary shown on the detail page. */
  savingsDetail: string;
  /**
   * Editorial "Known for" — the warm, local-friend reason to visit (roughly
   * 20–50 words). It answers "why would someone want to go here?", not what the
   * offer is. Authored placeholder copy about a fictional merchant concept —
   * never a claim about a real business.
   */
  knownFor: string;
  /**
   * "Offer Includes" highlight bullets for the detail overview — short factual
   * points drawn from this deal's own terms. Presentation seed content only;
   * never claims about a real business. Omit when there is nothing to list.
   */
  highlights?: string[];
  /** Human expiration line, when known. */
  expiration?: string | null;
  /** City used for the Google Maps search + card location line. */
  city: string;
  /** Official website — null for placeholder merchants (button hidden when absent). */
  website?: string | null;
  /** Optional terms & conditions shown on the detail page. */
  terms?: string | null;
  /** Authorized photo, when available. Null placeholders render a branded panel. */
  imageUrl?: string | null;
};

/** Homepage Local Deals accent — one soft-green square for every row. */
export const LOCAL_DEALS_HOMEPAGE_ACCENT = "#B7E4C7";

export const DEAL_CATEGORIES: readonly DealCategory[] = [
  { id: "things_to_do", title: "Things To Do", emoji: "🎟️", accent: "#B7E4C7" },
  { id: "restaurants", title: "Restaurants", emoji: "🍽️", accent: "#F6C6B8" },
  { id: "coffee_dessert", title: "Coffee & Dessert", emoji: "☕", accent: "#E8D3B0" },
  { id: "breweries_wine", title: "Breweries & Wine", emoji: "🍺", accent: "#E3C4DD" },
  { id: "shopping", title: "Shopping", emoji: "🛍️", accent: "#CFE0F0" },
  { id: "entertainment", title: "Entertainment", emoji: "🎭", accent: "#FFE0A3" },
  { id: "hotels_staycations", title: "Hotels & Staycations", emoji: "🏨", accent: "#C9E4E7" },
  { id: "travel_transportation", title: "Travel & Transportation", emoji: "✈️", accent: "#CDE7D8" },
] as const;

const CATEGORY_BY_ID: Record<DealCategoryId, DealCategory> = DEAL_CATEGORIES.reduce(
  (acc, category) => {
    acc[category.id] = category;
    return acc;
  },
  {} as Record<DealCategoryId, DealCategory>
);

export function dealCategory(id: DealCategoryId): DealCategory {
  return CATEGORY_BY_ID[id];
}

/**
 * Placeholder catalog. Believable, family-friendly, local-first offers — never
 * unrealistic ("90% off!") and never a real business's name.
 */
const DEALS: readonly LocalDeal[] = [
  // Things To Do
  {
    id: "vertical-ridge-climbing",
    category: "things_to_do",
    emoji: "🧗",
    merchant: "Vertical Ridge Climbing Gym",
    title: "First Climb Free with Gear Rental",
    savingsLabel: "Intro free",
    description:
      "A newcomer-friendly day pass on the house when you rent a harness and shoes. Auto-belays and a bouldering cave make it an easy first try for beginners and a quick session for regulars.",
    savingsDetail: "First-time day pass free with any gear rental — about $18 in value.",
    knownFor:
      "A welcoming spot to try climbing for the first time or fit in a quick session, with forgiving auto-belays, a bouldering cave, and staff who are used to walking nervous beginners up their very first wall.",
    highlights: ["First-time climbers", "Gear rental required", "Auto-belays & bouldering cave"],
    expiration: "Through the end of the month",
    city: "Gilbert, AZ",
    website: null,
    terms:
      "Present this offer in the Kindred app. First-time climbers only. Gear rental required. Waiver must be signed on arrival.",
    imageUrl: null,
  },
  {
    id: "desert-greens-mini-golf",
    category: "things_to_do",
    emoji: "⛳",
    merchant: "Desert Greens Mini Golf",
    title: "Two-for-One Rounds Before Noon",
    savingsLabel: "2-for-1",
    description:
      "Beat the heat with a morning round on a shaded 18-hole desert course. The second round is free when you tee off before noon — a good excuse to make it a rematch.",
    savingsDetail: "Buy one round, get the second free before 12 p.m.",
    knownFor:
      "A shaded, easygoing course that turns a hot morning into a relaxed round for the whole group — low-key enough for kids and just competitive enough to talk everyone into a rematch.",
    highlights: ["Second round free", "Before noon daily", "Shaded 18-hole course"],
    expiration: null,
    city: "Gilbert, AZ",
    website: null,
    terms: "Valid before noon daily. One free round per paid round. Not valid on holidays.",
    imageUrl: null,
  },
  {
    id: "saguaro-lake-kayak",
    category: "things_to_do",
    emoji: "🛶",
    merchant: "Saguaro Lake Kayak Co.",
    title: "$15 Off Sunset Paddle Tours",
    savingsLabel: "$15 off",
    description:
      "A guided evening paddle along the lake's quiet coves as the desert light turns gold. Guides handle the route and the gear; you handle the photos.",
    savingsDetail: "$15 off each guided sunset tour booking.",
    knownFor:
      "A guided evening paddle through the lake's quiet coves just as the desert light turns gold — the route and gear are handled for you, so the only job left is to take it all in.",
    highlights: ["Guided sunset tour", "Gear provided", "Reservation required"],
    expiration: "Seasonal — through early fall",
    city: "Mesa, AZ",
    website: null,
    terms: "Reservation required. Weather-dependent. Life vests provided and required.",
    imageUrl: null,
  },
  {
    id: "enigma-escape-rooms",
    category: "things_to_do",
    emoji: "🔐",
    merchant: "Enigma Escape Rooms",
    title: "20% Off Weekday Bookings",
    savingsLabel: "20% off",
    description:
      "Three original rooms ranging from beginner to fiendish, ideal for a small group or a date night with a little friendly competition. Weekday slots are the quietest.",
    savingsDetail: "20% off any room booked Monday through Thursday.",
    knownFor:
      "Three original story-driven rooms from beginner to fiendish, built for clever puzzle-solving under a little friendly pressure — an easy win for a date night, a group outing, or a first-timer's attempt at beating the clock.",
    highlights: ["Weekdays (Mon–Thu)", "Groups of 2–6", "Beginner to advanced rooms"],
    expiration: null,
    city: "Chandler, AZ",
    website: null,
    terms: "Monday–Thursday only. Groups of two to six. Book at least two hours ahead.",
    imageUrl: null,
  },

  // Restaurants
  {
    id: "la-milpa-taqueria",
    category: "restaurants",
    emoji: "🌮",
    merchant: "La Milpa Taqueria",
    title: "Free Elote with Any Entrée",
    savingsLabel: "Free side",
    description:
      "A neighborhood taqueria known for mesquite-grilled plates and hand-pressed tortillas. Your first order of street corn is on the house with any entrée.",
    savingsDetail: "Complimentary order of elote (street corn) with each entrée.",
    knownFor:
      "A from-scratch neighborhood taqueria built around mesquite-grilled plates and hand-pressed tortillas — the kind of unfussy, deeply local spot regulars quietly hope stays their little secret.",
    highlights: ["Free elote (street corn)", "Dine-in only", "One per entrée"],
    expiration: null,
    city: "Gilbert, AZ",
    website: null,
    terms: "Dine-in only. One free side per entrée. Cannot be combined with other offers.",
    imageUrl: null,
  },
  {
    id: "crust-and-ember",
    category: "restaurants",
    emoji: "🍕",
    merchant: "Crust & Ember Pizzeria",
    title: "Buy One Get One Neapolitan Pizza",
    savingsLabel: "BOGO",
    description:
      "Wood-fired pies with a blistered, airy crust and a short menu that changes with the season. Order one and the second is free — bring a friend or take one home.",
    savingsDetail: "Buy any Neapolitan pizza, get a second of equal or lesser value free.",
    knownFor:
      "Wood-fired Neapolitan pies with a blistered, airy crust and a short menu that changes with the season — a relaxed, share-a-table pick whether you're staying in or grabbing one to go.",
    highlights: ["Buy one, get one free", "Dine-in or takeout", "Equal or lesser value"],
    expiration: "Through this month",
    city: "Gilbert, AZ",
    website: null,
    terms: "Dine-in or takeout. Second pizza of equal or lesser value. One offer per table.",
    imageUrl: null,
  },
  {
    id: "ramen-republic",
    category: "restaurants",
    emoji: "🍜",
    merchant: "Ramen Republic",
    title: "$5 Off Dinner for Two",
    savingsLabel: "$5 off",
    description:
      "Slow-simmered tonkotsu and a bright, vegetable-forward shoyu share the menu at this small counter-service shop. A quiet weeknight favorite.",
    savingsDetail: "$5 off when two dinner bowls are ordered together.",
    knownFor:
      "A tiny counter shop trading in slow-simmered tonkotsu and a bright, vegetable-forward shoyu — the kind of warm, low-key find that makes an ordinary weeknight dinner for two feel like a treat.",
    highlights: ["$5 off two bowls", "Dine-in only", "Minimum two bowls"],
    expiration: null,
    city: "Tempe, AZ",
    website: null,
    terms: "Dine-in only. Minimum two bowls. Not valid with other discounts.",
    imageUrl: null,
  },

  // Coffee & Dessert
  {
    id: "ironwood-coffee",
    category: "coffee_dessert",
    emoji: "☕",
    merchant: "Ironwood Coffee Roasters",
    title: "Free Pastry with a Morning Latte",
    savingsLabel: "Free pastry",
    description:
      "A small-batch roaster with a rotating single-origin menu and pastries baked in-house each morning. Order a latte before eleven and choose a pastry on the house.",
    savingsDetail: "One pastry free with any latte ordered before 11 a.m.",
    knownFor:
      "A small-batch roaster with a rotating single-origin menu and pastries baked in-house each morning — an unhurried, good-light corner that quietly makes the whole day start better.",
    highlights: ["Free pastry with a latte", "Before 11 a.m. daily", "While supplies last"],
    expiration: null,
    city: "Gilbert, AZ",
    website: null,
    terms: "Before 11 a.m. daily. One pastry per latte. While supplies last.",
    imageUrl: null,
  },
  {
    id: "frostbite-creamery",
    category: "coffee_dessert",
    emoji: "🍦",
    merchant: "Frostbite Creamery",
    title: "Second Scoop Free on Sundays",
    savingsLabel: "2nd free",
    description:
      "Small-batch ice cream with a handful of inventive flavors alongside the classics. On Sundays, the second scoop is free — a standing reason to walk over after dinner.",
    savingsDetail: "Buy one scoop, get the second free every Sunday.",
    knownFor:
      "Small-batch ice cream with a few inventive flavors sitting right beside the classics — the sort of after-dinner walk-over that quietly turns into a standing weekend ritual.",
    highlights: ["Second scoop free", "Sundays only", "Dine-in or takeaway"],
    expiration: null,
    city: "Chandler, AZ",
    website: null,
    terms: "Sundays only. One free scoop per paid scoop. Dine-in or takeaway.",
    imageUrl: null,
  },
  {
    id: "sunrise-donut-bar",
    category: "coffee_dessert",
    emoji: "🍩",
    merchant: "Sunrise Donut Bar",
    title: "Baker's Dozen for the Price of Six",
    savingsLabel: "Half off",
    description:
      "Cake and raised doughnuts made fresh before dawn, with a few seasonal specials each week. Buy six and take home thirteen.",
    savingsDetail: "A baker's dozen (13) for the price of six doughnuts.",
    knownFor:
      "Cake and raised doughnuts made fresh before dawn, with a few seasonal specials each week — worth the early trip while the good ones are still warm from the fryer.",
    highlights: ["13 for the price of 6", "In-store only", "One dozen deal per customer"],
    expiration: "While supplies last each morning",
    city: "Mesa, AZ",
    website: null,
    terms: "In-store only. Subject to daily availability. One dozen deal per customer.",
    imageUrl: null,
  },

  // Breweries & Wine
  {
    id: "copper-canyon-brewing",
    category: "breweries_wine",
    emoji: "🍺",
    merchant: "Copper Canyon Brewing",
    title: "$3 Off Flights on Thursdays",
    savingsLabel: "$3 off",
    description:
      "A neighborhood taproom pouring a rotating lineup of house beers, from a crisp desert lager to a barrel-aged seasonal. Thursday flights are the easiest way to taste around.",
    savingsDetail: "$3 off any tasting flight every Thursday.",
    knownFor:
      "A welcoming neighborhood taproom pouring everything from a crisp desert lager to a barrel-aged seasonal — a relaxed, unpretentious place to taste around and unwind with friends after work.",
    highlights: ["$3 off tasting flights", "Thursdays only", "Must be 21+"],
    expiration: null,
    city: "Gilbert, AZ",
    website: null,
    terms: "Thursdays only. Must be 21+. One discounted flight per guest.",
    imageUrl: null,
  },
  {
    id: "vetro-wine-bar",
    category: "breweries_wine",
    emoji: "🍷",
    merchant: "Vetro Wine Bar",
    title: "Half-Price Bottles on Mondays",
    savingsLabel: "50% off",
    description:
      "A cozy list leaning toward small producers, with a knowledgeable staff happy to point you somewhere new. Bottles are half price on Mondays.",
    savingsDetail: "50% off retail bottles enjoyed in-house on Mondays.",
    knownFor:
      "A cozy list leaning toward small producers, with staff who genuinely enjoy pointing you somewhere new — an inviting, low-lit place to slow down over a good bottle you'd never have picked yourself.",
    highlights: ["Half-price bottles", "Mondays only", "Must be 21+"],
    expiration: null,
    city: "Scottsdale, AZ",
    website: null,
    terms: "Mondays only. Must be 21+. Dine-in bottles only; one per table.",
    imageUrl: null,
  },

  // Shopping
  {
    id: "wanderword-bookshop",
    category: "shopping",
    emoji: "📚",
    merchant: "Wanderword Bookshop",
    title: "15% Off Any Local Author Title",
    savingsLabel: "15% off",
    description:
      "An independent bookshop with a well-curated local-author shelf and regular reading nights. Take 15% off any title from an Arizona writer.",
    savingsDetail: "15% off any book by a local or regional author.",
    knownFor:
      "An independent bookshop with a thoughtfully curated local-author shelf and regular reading nights — the browse-for-an-hour kind of place that quietly keeps a neighborhood's character alive.",
    highlights: ["15% off local authors", "In-store only", "Excludes sale pricing"],
    expiration: null,
    city: "Gilbert, AZ",
    website: null,
    terms: "In-store only. Local-author titles only. Cannot be combined with sale pricing.",
    imageUrl: null,
  },
  {
    id: "heritage-row-antiques",
    category: "shopping",
    emoji: "🪑",
    merchant: "Heritage Row Antiques",
    title: "$20 Off Purchases Over $100",
    savingsLabel: "$20 off",
    description:
      "A rambling collective of vendor booths — mid-century furniture, vinyl, and the occasional genuine find. Worth an unhurried afternoon of browsing.",
    savingsDetail: "$20 off any single purchase of $100 or more.",
    knownFor:
      "A rambling collective of vendor booths — mid-century furniture, old vinyl, and the occasional genuine find — best enjoyed as an unhurried afternoon of treasure hunting with no particular list in hand.",
    highlights: ["$20 off $100+", "One discount per visit", "Excludes consignment"],
    expiration: null,
    city: "Mesa, AZ",
    website: null,
    terms: "Minimum $100 purchase before tax. One discount per visit. Excludes consignment.",
    imageUrl: null,
  },

  // Entertainment
  {
    id: "gilbert-playhouse",
    category: "entertainment",
    emoji: "🎭",
    merchant: "Gilbert Playhouse",
    title: "$10 Off Weeknight Performances",
    savingsLabel: "$10 off",
    description:
      "A community theater staging a mix of familiar musicals and new work in an intimate room where there isn't a bad seat. Weeknight tickets are the best value.",
    savingsDetail: "$10 off each ticket to Tuesday–Thursday performances.",
    knownFor:
      "An intimate community theater staging familiar musicals and new work in a room without a bad seat — a warm, personal night out where you're close enough to feel every scene.",
    highlights: ["$10 off tickets", "Tue–Thu shows", "Subject to availability"],
    expiration: "Current season",
    city: "Gilbert, AZ",
    website: null,
    terms: "Tuesday–Thursday shows. Subject to availability. Not valid on premieres.",
    imageUrl: null,
  },
  {
    id: "retro-lanes-bowling",
    category: "entertainment",
    emoji: "🎳",
    merchant: "Retro Lanes Bowling",
    title: "Free Shoe Rental with Two Games",
    savingsLabel: "Free rental",
    description:
      "Classic lanes with a snack bar and a low-key arcade in the corner — an easy plan for a group or a rainy-day afternoon with the kids.",
    savingsDetail: "Shoe rental free when you bowl two or more games.",
    knownFor:
      "Classic lanes with a snack bar and a small arcade tucked in the corner — the reliable, everyone's-welcome plan for a group hangout, a birthday, or a rainy-day afternoon with the kids.",
    highlights: ["Free shoe rental", "Two-game minimum", "Arcade & snack bar"],
    expiration: null,
    city: "Chandler, AZ",
    website: null,
    terms: "Two-game minimum per person. One free rental per bowler. Subject to lane availability.",
    imageUrl: null,
  },
  {
    id: "vista-drive-in",
    category: "entertainment",
    emoji: "🎬",
    merchant: "Vista Drive-In Cinema",
    title: "Carload Night: $25 per Vehicle",
    savingsLabel: "Carload",
    description:
      "A restored drive-in showing double features under the desert sky. Bring the whole car for one flat price on carload nights.",
    savingsDetail: "One flat $25 admission per vehicle on designated carload nights.",
    knownFor:
      "A restored drive-in showing double features under the open desert sky — a nostalgic, pack-the-whole-car night out that's getting harder to find anywhere else.",
    highlights: ["$25 per vehicle", "Carload nights only", "Double features"],
    expiration: "Select nights — check the marquee",
    city: "Mesa, AZ",
    website: null,
    terms: "Carload nights only. Standard vehicles only. Cash or card at the gate.",
    imageUrl: null,
  },

  // Hotels & Staycations
  {
    id: "mesa-verde-inn",
    category: "hotels_staycations",
    emoji: "🏨",
    merchant: "The Mesa Verde Inn",
    title: "Weekend Staycation: 20% Off + Late Checkout",
    savingsLabel: "20% off",
    description:
      "A boutique inn with a courtyard pool and a quiet in-house café — an easy overnight reset without leaving town. Weekend rate includes a relaxed noon checkout.",
    savingsDetail: "20% off weekend room rates plus complimentary late checkout.",
    knownFor:
      "A boutique inn with a courtyard pool and a quiet in-house café — an easy overnight reset that feels like a proper getaway without ever leaving town.",
    highlights: ["20% off weekend rates", "Late checkout to noon", "Fri–Sun nights"],
    expiration: "Subject to availability",
    city: "Mesa, AZ",
    website: null,
    terms: "Friday–Sunday nights. Based on availability. Late checkout until noon on request.",
    imageUrl: null,
  },
  {
    id: "agave-springs-spa",
    category: "hotels_staycations",
    emoji: "♨️",
    merchant: "Agave Springs Resort & Spa",
    title: "Midweek Spa Escape for Two",
    savingsLabel: "Spa deal",
    description:
      "A desert spa day for two — pool access, a treatment each, and a slow afternoon. Midweek pricing keeps it a genuine treat rather than a splurge.",
    savingsDetail: "Reduced midweek rate on the spa-day-for-two package.",
    knownFor:
      "A calm desert spa day for two — pool time, a treatment each, and a slow, unbothered afternoon that turns a midweek slump into a genuine escape.",
    highlights: ["Spa day for two", "Midweek (Mon–Thu)", "Advance booking required"],
    expiration: null,
    city: "Scottsdale, AZ",
    website: null,
    terms: "Monday–Thursday. Advance booking required. Must be 18+ for spa access.",
    imageUrl: null,
  },

  // Travel & Transportation
  {
    id: "canal-path-bikes",
    category: "travel_transportation",
    emoji: "🚲",
    merchant: "Canal Path Bike Rentals",
    title: "All-Day Rental for the Price of Half",
    savingsLabel: "Half day free",
    description:
      "Cruisers and e-bikes a few steps from the canal trails, with helmets and locks included. Pay the half-day rate and keep the bike until closing.",
    savingsDetail: "Full-day rental charged at the half-day rate.",
    knownFor:
      "Cruisers and e-bikes just steps from the canal trails, with helmets and locks included — the simplest way to trade the car for a breezy morning of exploring on two wheels.",
    highlights: ["All-day for half-day rate", "Helmet & lock included", "Return by closing"],
    expiration: null,
    city: "Tempe, AZ",
    website: null,
    terms: "Return by closing. Helmet and lock included. ID and card required at pickup.",
    imageUrl: null,
  },
  {
    id: "downtown-valet",
    category: "travel_transportation",
    emoji: "🅿️",
    merchant: "Downtown Valet Parking",
    title: "First Two Hours Free on Weekends",
    savingsLabel: "2 hrs free",
    description:
      "Covered valet in the heart of downtown, an easy start to a night out. The first two hours are free on weekends when you show the offer.",
    savingsDetail: "First two hours of weekend valet free.",
    knownFor:
      "Covered valet right in the heart of downtown — a small luxury that makes a night out feel effortless from the second you pull up to the curb.",
    highlights: ["First 2 hours free", "Weekends only", "Covered valet"],
    expiration: null,
    city: "Gilbert, AZ",
    website: null,
    terms: "Saturday–Sunday. First two hours free, standard rate after. Show offer on arrival.",
    imageUrl: null,
  },
] as const;

/** A homepage-friendly, varied spread — never more than two from one category. */
const FEATURED_ORDER: readonly string[] = [
  "la-milpa-taqueria",
  "ironwood-coffee",
  "desert-greens-mini-golf",
  "copper-canyon-brewing",
  "wanderword-bookshop",
  "gilbert-playhouse",
  "mesa-verde-inn",
  "saguaro-lake-kayak",
];

/** All deals, in catalog order. */
export function allLocalDeals(): LocalDeal[] {
  return [...DEALS];
}

/** Featured deals for the homepage, capped and varied (default 8). */
export function featuredLocalDeals(limit = 8): LocalDeal[] {
  const byId = new Map(DEALS.map((deal) => [deal.id, deal]));
  const featured = FEATURED_ORDER.map((id) => byId.get(id)).filter(
    (deal): deal is LocalDeal => Boolean(deal)
  );
  const rest = DEALS.filter((deal) => !FEATURED_ORDER.includes(deal.id));
  return [...featured, ...rest].slice(0, limit);
}

export type DealCategoryGroup = {
  category: DealCategory;
  deals: LocalDeal[];
};

/** Deals grouped by category in the canonical See All order (empty groups dropped). */
export function localDealsByCategory(): DealCategoryGroup[] {
  return DEAL_CATEGORIES.map((category) => ({
    category,
    deals: DEALS.filter((deal) => deal.category === category.id),
  })).filter((group) => group.deals.length > 0);
}

export function getLocalDealById(id: string): LocalDeal | null {
  return DEALS.find((deal) => deal.id === id) ?? null;
}

/** Short card location + savings line, e.g. "La Milpa Taqueria · Save with BOGO". */
export function dealCardSubtitle(deal: LocalDeal): string {
  return `${deal.merchant} · ${deal.savingsLabel}`;
}

/** Google Maps search URL for a deal's merchant (works for any name). */
export function dealMapsUrl(deal: LocalDeal): string {
  const query = encodeURIComponent(`${deal.merchant}, ${deal.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
