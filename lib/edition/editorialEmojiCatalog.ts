/**
 * Editorial Emoji Catalog — Kindred's newspaper-desk icon vocabulary.
 *
 * Every event classifies into a specific editorial category before an emoji is chosen.
 * Rules are ordered most-specific first. 🤝 is reserved for genuine networking /
 * collaboration — never used as a generic fallback.
 *
 * Keep in sync with `.cursor/rules/kindred-visual-language.mdc`.
 */

import type { LocalEventCategory } from "./localEvents.ts";

/** One editorial category → one permanent emoji. */
export const EDITORIAL_EMOJI = {
  // Music & performance
  live_music: "🎵",
  rock_concert: "🎸",
  pop_concert: "🎤",
  orchestra: "🎼",
  theater: "🎭",
  comedy: "😂",
  film: "🎬",
  art: "🎨",
  museum: "🏛️",
  author_talk: "📚",
  literature: "📖",
  dancing: "💃",

  // Sports (non-sportEventIcon desk still references these)
  baseball: "⚾",
  basketball: "🏀",
  football: "🏈",
  soccer: "⚽",
  hockey: "🏒",
  softball: "⚾",
  tennis: "🎾",
  volleyball: "🏐",
  boxing: "🥊",
  martial_arts: "🥋",
  running: "🏃",
  cycling: "🚴",
  swimming: "🏊",
  bowling: "🎳",
  billiards: "🎱",
  golf: "⛳",
  curling: "🥌",
  motorsports: "🏎️",
  pickleball: "🏓",
  fitness: "💪",
  yoga: "🧘",

  // Food & drink
  brewery: "🍺",
  winery: "🍷",
  cocktails: "🍸",
  coffee: "☕",
  pizza: "🍕",
  burgers: "🍔",
  tacos: "🌮",
  sushi: "🍣",
  steak: "🥩",
  dessert: "🍦",
  bakery: "🥐",
  brunch: "🥞",
  food_dining: "🍽️",
  food_festival: "🍽️",
  farmers_market: "🥕",

  // Shopping & fairs
  shopping: "🛍️",
  craft_fair: "🧵",
  flea_market: "🛒",
  antique_store: "🪑",

  // Celebrations & seasons
  festival: "🎪",
  celebration: "🎉",
  fireworks: "🎆",
  holiday: "🎄",
  halloween: "🎃",
  christmas: "🎅",

  // Outdoors & nature
  gardening: "🌱",
  desert: "🌵",
  flowers: "🌸",
  botanical_garden: "🌸",
  park: "🌳",
  nature_preserve: "🌿",
  hiking: "🥾",
  camping: "🏕️",
  beach: "🏖️",
  lake_river: "🌊",
  scenic_view: "🌅",
  walking_trail: "🚶",

  // Animals
  dogs: "🐶",
  cats: "🐱",
  dog_park: "🐕",
  pet_friendly: "🐾",

  // Civic & learning
  business: "💼",
  workshop: "💡",
  education: "🎓",
  seminar: "🧠",
  technology: "💻",
  science: "🔬",
  health: "⚕️",
  charity: "❤️",
  /** Rare — only explicit networking / collaboration / outreach. */
  community_networking: "🤝",
  historic_site: "📜",
  library: "📚",

  // Experiences & venues
  car_show: "🚗",
  aviation: "✈️",
  railroad: "🚂",
  boating: "⛵",
  water_sports: "🚤",
  arcade: "🕹️",
  escape_room: "🔐",
  go_karts: "🏎️",
  mini_golf: "🏌️",
  rock_climbing: "🧗",
  playground: "🛝",
} as const;

export type EditorialEmojiCategory = keyof typeof EDITORIAL_EMOJI;

export type EditorialEmojiRule = {
  category: EditorialEmojiCategory;
  test: RegExp;
};

/**
 * Newspaper editor order — most specific wins.
 * Food genres before generic food. Genre concerts before live music.
 * Taco festival before generic festival. Wine before 🍽️.
 */
export const EDITORIAL_EMOJI_RULES: readonly EditorialEmojiRule[] = [
  // ── Seasonal & holidays (specific before generic holiday) ──
  { category: "halloween", test: /\b(halloween|trunk or treat|spooky\b.*\bnight)\b/i },
  { category: "christmas", test: /\b(christmas|santa\b|tree lighting|holiday market)\b/i },
  { category: "holiday", test: /\b(hanukkah|kwanzaa|new year'?s eve|nye\b|holiday\b)\b/i },
  { category: "fireworks", test: /\b(fireworks|fourth of july|independence day)\b/i },

  // ── Rare 🤝 — networking & collaboration only ──
  {
    category: "community_networking",
    test: /\b(networking|meet-?and-?greet|business mixer|chamber of commerce|collaboration summit|professional mixer|speed networking)\b/i,
  },
  {
    category: "community_networking",
    test: /\b(community outreach|volunteer outreach|volunteer fair)\b/i,
  },

  // ── Food genres (before generic food / festival) ──
  { category: "tacos", test: /\b(taco fest|taco festival|taco tuesday|taco\b.*\bnight)\b/i },
  { category: "pizza", test: /\b(pizza fest|pizza night|pizza party|\bpizza\b)\b/i },
  { category: "burgers", test: /\b(burger fest|burger bash|smash burger|\bburgers\b)\b/i },
  { category: "sushi", test: /\b(sushi|sashimi|nigiri|omakase)\b/i },
  { category: "steak", test: /\b(steakhouse|steak dinner|steak night|\bsteak\b)\b/i },
  { category: "dessert", test: /\b(ice cream|dessert|cupcake|gelato|donut|pastry crawl)\b/i },
  { category: "bakery", test: /\b(bakery|bake sale|bread festival|patisserie)\b/i },
  { category: "brunch", test: /\b(brunch|breakfast club|morning social)\b/i },
  { category: "winery", test: /\b(wine tasting|winery|vineyard|vino\b)\b/i },
  { category: "brewery", test: /\b(brewery|brewpub|taproom|craft beer)\b/i },
  { category: "cocktails", test: /\b(cocktail|speakeasy|mixology|happy hour)\b/i },
  { category: "coffee", test: /\b(coffee|cafe|café|espresso|latte art)\b/i },
  {
    category: "food_festival",
    test: /\b(food fest|food festival|tasting festival|culinary festival|chef showcase)\b/i,
  },

  // ── Music genres (before generic live music) ──
  { category: "rock_concert", test: /\b(rock\b|metal\b|grunge|pearl jam|tribute band.*rock)\b/i },
  { category: "pop_concert", test: /\b(pop\b|top 40|boy band|girl group)\b/i },
  {
    category: "orchestra",
    test: /\b(orchestra|symphony|philharmonic|chamber music|classical\b.*\bconcert)\b/i,
  },
  { category: "pop_concert", test: /\bconcert\b/i },
  {
    category: "live_music",
    test: /\b(live music|\bdj\b|jazz|blues|open mic|acoustic set|karaoke|country music|folk\b.*\bnight)\b/i,
  },

  // ── Performance & culture ──
  { category: "comedy", test: /\b(comedy|stand-?up|improv)\b/i },
  {
    category: "theater",
    test: /\b(theater|theatre|\bplay\b|broadway|musical|opera|shakespeare|ballet)\b/i,
  },
  { category: "dancing", test: /\b(ballroom|dance class|dancing|salsa night)\b/i },
  { category: "film", test: /\b(film|movie|cinema|screening|film festival)\b/i },
  { category: "art", test: /\b(art walk|art show|art gallery|gallery opening|exhibit opening)\b/i },
  { category: "museum", test: /\b(museum|exhibit at the museum)\b/i },
  {
    category: "author_talk",
    test: /\b(author talk|book signing|book talk|poetry reading|writer'?s workshop)\b/i,
  },
  { category: "literature", test: /\b(book club|literary|storytelling night|readings)\b/i },

  // ── Learning & professional ──
  { category: "business", test: /\b(business breakfast|entrepreneur|startup pitch|trade show)\b/i },
  { category: "workshop", test: /\b(workshop|hands-?on class|maker class|craft workshop)\b/i },
  { category: "gardening", test: /\b(gardening|garden club|plant swap|master gardener)\b/i },
  { category: "desert", test: /\b(desert botanical|sonoran|saguaro|cactus\b.*\btour)\b/i },
  { category: "seminar", test: /\b(seminar|symposium|panel discussion|talk\b.*\bseries)\b/i },
  { category: "technology", test: /\b(tech talk|hackathon|coding|software|ai\b.*\bmeetup)\b/i },
  { category: "science", test: /\b(science fair|planetarium|astronomy|stem\b.*\bnight)\b/i },
  { category: "health", test: /\b(health fair|wellness fair|medical\b.*\bscreening)\b/i },
  { category: "education", test: /\b(lecture|educational|university\b.*\btalk|school\b.*\bevent)\b/i },
  { category: "fitness", test: /\b(fitness|crossfit|boot camp|workout class)\b/i },
  { category: "yoga", test: /\b(yoga|meditation|mindfulness)\b/i },

  // ── Sports (non-team; team sports handled by sportEventIcon) ──
  { category: "softball", test: /\bsoftball\b/i },
  { category: "curling", test: /\bcurling\b/i },
  { category: "billiards", test: /\b(billiards|pool hall|snooker)\b/i },
  { category: "pickleball", test: /\bpickleball\b/i },
  { category: "tennis", test: /\btennis\b/i },
  { category: "volleyball", test: /\bvolleyball\b/i },
  { category: "boxing", test: /\b(boxing|mma\b|ufc\b)\b/i },
  { category: "martial_arts", test: /\b(karate|taekwondo|judo|jiu-?jitsu|martial arts)\b/i },
  {
    category: "running",
    test: /\b(marathon|half marathon|5k\b|10k\b|fun run|running race|turkey trot)\b/i,
  },
  { category: "cycling", test: /\b(cycling|bike race|gran fondo|criterium)\b/i },
  { category: "swimming", test: /\b(swim meet|swimming|aquatics)\b/i },
  { category: "bowling", test: /\bbowling\b/i },
  { category: "golf", test: /\b(pga\b|lpga\b|golf tournament|golf classic|\bgolf\b)(?!.*mini)/i },

  // ── Animals ──
  { category: "dogs", test: /\b(dog show|puppy|canine|dog parade|dog festival)\b/i },
  { category: "cats", test: /\b(cat show|feline|kitten)\b/i },
  { category: "dog_park", test: /\bdog park\b/i },
  { category: "pet_friendly", test: /\b(pet friendly|dog friendly|bark in the park)\b/i },

  // ── Outdoors ──
  { category: "camping", test: /\b(camping|campout|camp fire|campfire)\b/i },
  { category: "hiking", test: /\b(hike|hiking|trail run)\b/i },
  { category: "flowers", test: /\b(flower show|bloom festival|wildflower)\b/i },
  { category: "botanical_garden", test: /\b(botanical|arboretum)\b/i },
  { category: "beach", test: /\bbeach\b/i },
  {
    category: "water_sports",
    test: /\b(water ski|wakeboard|jet ski|kayak race|paddleboard race)\b/i,
  },
  { category: "boating", test: /\b(boat show|sailing regatta|regatta|yacht)\b/i },
  { category: "lake_river", test: /\b(lake|river|kayak|paddleboard|paddle board|boating)\b/i },
  { category: "scenic_view", test: /\b(sunrise|sunset|scenic view|overlook|vista)\b/i },
  { category: "walking_trail", test: /\bwalking trail\b/i },
  { category: "park", test: /\b(park\b)(?!.*dog)/i },
  { category: "nature_preserve", test: /\b(nature preserve|wildlife refuge)\b/i },

  // ── Fairs & markets ──
  { category: "craft_fair", test: /\b(craft fair|maker fair|artisan market|handmade market)\b/i },
  { category: "farmers_market", test: /\bfarmers?\s*market\b/i },
  { category: "flea_market", test: /\bflea market\b/i },
  { category: "antique_store", test: /\b(antique mall|antique show|antique market)\b/i },
  {
    category: "festival",
    test: /\b(festival|street fair|county fair|state fair|carnival|fiesta)\b/i,
  },
  {
    category: "celebration",
    test: /\b(block party|neighborhood party|community picnic|celebration|parade)\b/i,
  },

  // ── Civic & charity ──
  { category: "charity", test: /\b(charity|fundraiser|benefit gala|telethon)\b/i },
  { category: "historic_site", test: /\b(historic site|heritage district|heritage walk)\b/i },
  { category: "library", test: /\blibrary\b/i },

  // ── Transportation & hobbies ──
  { category: "car_show", test: /\b(car show|auto show|cruise night|classic car)\b/i },
  { category: "aviation", test: /\b(air show|aviation|fly-?in)\b/i },
  { category: "railroad", test: /\b(train show|model railroad|railroad|railway)\b/i },
  { category: "motorsports", test: /\b(nascar|indycar|formula\s*1|\bf1\b|motocross|drag racing)\b/i },

  // ── Experience venues ──
  { category: "escape_room", test: /\bescape room\b/i },
  { category: "go_karts", test: /\bgo-?kart\b/i },
  { category: "mini_golf", test: /\b(mini golf|putt-?putt)\b/i },
  { category: "arcade", test: /\b(arcade|video arcade)\b/i },
  { category: "rock_climbing", test: /\b(rock climb|bouldering|climbing gym)\b/i },
  { category: "playground", test: /\b(playground|kids fest|family fun day)\b/i },
  { category: "shopping", test: /\b(shopping|mall crawl|boutique crawl)\b/i },

  // ── Generic food (after all cuisines) ──
  {
    category: "food_dining",
    test: /\b(food\b|dinner|restaurant|tasting|culinary|chef|brunch\b.*\bbuffet)\b/i,
  },
];

/** Primary venue identity — checked on venue name before event title. */
export const EDITORIAL_VENUE_EMOJI_RULES: readonly EditorialEmojiRule[] = [
  { category: "escape_room", test: /\bescape room\b/i },
  { category: "go_karts", test: /\bgo-?kart\b/i },
  { category: "mini_golf", test: /\b(mini golf|putt-?putt)\b/i },
  { category: "bowling", test: /\bbowling\b/i },
  { category: "arcade", test: /\b(arcade|video arcade)\b/i },
  { category: "rock_climbing", test: /\b(rock climb|bouldering|climbing gym)\b/i },
  { category: "brewery", test: /\b(brewery|brewpub|taproom)\b/i },
  { category: "winery", test: /\b(winery|vineyard)\b/i },
  { category: "cocktails", test: /\b(cocktail|speakeasy)\b/i },
  { category: "coffee", test: /\b(coffee|cafe|café)\b/i },
  { category: "museum", test: /\bmuseum\b/i },
  { category: "historic_site", test: /\b(historic site|heritage site)\b/i },
  { category: "library", test: /\blibrary\b/i },
  { category: "literature", test: /\b(bookstore|book shop)\b/i },
  { category: "botanical_garden", test: /\b(botanical|arboretum)\b/i },
  { category: "beach", test: /\bbeach\b/i },
  { category: "dog_park", test: /\bdog park\b/i },
  { category: "playground", test: /\bplayground\b/i },
  { category: "art", test: /\b(art gallery|gallery)\b/i },
  { category: "golf", test: /\b(golf course|country club)\b/i },
];

/** Section-level emoji when text classification finds nothing — never 🤝. */
export const LOCAL_EVENT_SECTION_EMOJI: Record<LocalEventCategory, string> = {
  music: EDITORIAL_EMOJI.live_music,
  comedy: EDITORIAL_EMOJI.comedy,
  arts: EDITORIAL_EMOJI.art,
  family: EDITORIAL_EMOJI.playground,
  sports: "🏅",
  food: EDITORIAL_EMOJI.food_dining,
  market: EDITORIAL_EMOJI.farmers_market,
  nightlife: EDITORIAL_EMOJI.live_music,
  community: EDITORIAL_EMOJI.celebration,
};

/** Last-resort desk emoji when category is unknown — celebration, not handshake. */
export const EDITORIAL_EMOJI_SECTION_FALLBACK = EDITORIAL_EMOJI.celebration;

export function hayFromParts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function resolveEditorialEmojiFromHay(hay: string): string | null {
  const normalized = hay.trim().toLowerCase();
  if (!normalized) return null;
  for (const rule of EDITORIAL_EMOJI_RULES) {
    if (rule.test.test(normalized)) return EDITORIAL_EMOJI[rule.category];
  }
  return null;
}

export function resolveEditorialVenueEmoji(venue: string | null | undefined): string | null {
  const hay = hayFromParts([venue]);
  if (!hay) return null;
  for (const rule of EDITORIAL_VENUE_EMOJI_RULES) {
    if (rule.test.test(hay)) return EDITORIAL_EMOJI[rule.category];
  }
  return null;
}

/** @deprecated Use EDITORIAL_EMOJI — kept for existing imports. */
export const CATEGORY_ICON_DICTIONARY = {
  live_music: EDITORIAL_EMOJI.live_music,
  concert: EDITORIAL_EMOJI.pop_concert,
  theater: EDITORIAL_EMOJI.theater,
  comedy: EDITORIAL_EMOJI.comedy,
  movies: EDITORIAL_EMOJI.film,
  festival: EDITORIAL_EMOJI.festival,
  food_festival: EDITORIAL_EMOJI.food_festival,
  coffee_shop: EDITORIAL_EMOJI.coffee,
  brewery: EDITORIAL_EMOJI.brewery,
  winery: EDITORIAL_EMOJI.winery,
  cocktail_bar: EDITORIAL_EMOJI.cocktails,
  dancing: EDITORIAL_EMOJI.dancing,
  art_gallery: EDITORIAL_EMOJI.art,
  museum: EDITORIAL_EMOJI.museum,
  historic_site: EDITORIAL_EMOJI.historic_site,
  library: EDITORIAL_EMOJI.library,
  bookstore: EDITORIAL_EMOJI.literature,
  park: EDITORIAL_EMOJI.park,
  botanical_garden: EDITORIAL_EMOJI.botanical_garden,
  nature_preserve: EDITORIAL_EMOJI.nature_preserve,
  scenic_view: EDITORIAL_EMOJI.scenic_view,
  beach: EDITORIAL_EMOJI.beach,
  lake_river: EDITORIAL_EMOJI.lake_river,
  hiking: EDITORIAL_EMOJI.hiking,
  walking_trail: EDITORIAL_EMOJI.walking_trail,
  cycling: EDITORIAL_EMOJI.cycling,
  running: EDITORIAL_EMOJI.running,
  pickleball: EDITORIAL_EMOJI.pickleball,
  tennis: EDITORIAL_EMOJI.tennis,
  golf: EDITORIAL_EMOJI.golf,
  mini_golf: EDITORIAL_EMOJI.mini_golf,
  bowling: EDITORIAL_EMOJI.bowling,
  arcade: EDITORIAL_EMOJI.arcade,
  escape_room: EDITORIAL_EMOJI.escape_room,
  go_karts: EDITORIAL_EMOJI.go_karts,
  rock_climbing: EDITORIAL_EMOJI.rock_climbing,
  swimming: EDITORIAL_EMOJI.swimming,
  playground: EDITORIAL_EMOJI.playground,
  dog_park: EDITORIAL_EMOJI.dog_park,
  pet_friendly: EDITORIAL_EMOJI.pet_friendly,
  shopping: EDITORIAL_EMOJI.shopping,
  antique_store: EDITORIAL_EMOJI.antique_store,
  flea_market: EDITORIAL_EMOJI.flea_market,
  community_event: EDITORIAL_EMOJI.community_networking,
  business_networking: EDITORIAL_EMOJI.business,
  educational_talk: EDITORIAL_EMOJI.education,
  charity: EDITORIAL_EMOJI.charity,
  car_show: EDITORIAL_EMOJI.car_show,
  aviation: EDITORIAL_EMOJI.aviation,
  fireworks: EDITORIAL_EMOJI.fireworks,
  holiday_event: EDITORIAL_EMOJI.holiday,
  farmers_market: EDITORIAL_EMOJI.farmers_market,
  food_dining: EDITORIAL_EMOJI.food_dining,
} as const;

/** Section fallback — never the rare 🤝 handshake. */
export const CATEGORY_ICON_FALLBACK = EDITORIAL_EMOJI_SECTION_FALLBACK;
