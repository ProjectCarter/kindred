/**
 * "Why you'll love it" — the warm editorial recommendation on every discovery
 * detail page (Activities, Food & Drinks, and curated places).
 *
 * Kindred Editorial Constitution V2: this is an editorial recommendation, not a
 * metadata field. It answers "why would I want to go here?" in one or two warm,
 * confident sentences — never a category label, never provider/listing text.
 *
 * Sourcing order (strongest verified editorial first):
 *   1. Bandit's Note — a genuine per-item recommendation written for this place.
 *   2. A curated line for the VERIFIED editorial category — used only when the
 *      category is high-confidence and structured (Foursquare / metadata), so a
 *      keyword guess never picks a line. These lines summarize what an experience
 *      of this kind is like (Rule #1: summarizing is not inventing); they stay to
 *      broadly-true, experiential statements and never claim a specific fact,
 *      award, or superlative about an individual business.
 *   3. Otherwise omit — Kindred never pads a weak listing with filler.
 *
 * Variants + a stable per-item hash keep two same-category picks in one section
 * from reading identically.
 */

import type { EditorialCategoryId } from "./editorialCategory";
import type { VenueClassification } from "./venueClassification";
import { toKnownForBlurb } from "./detailHero";

/**
 * Warm, broadly-true category recommendations. Each line describes what the
 * experience feels like and who tends to enjoy it — confident and inviting, never
 * salesy, exaggerated, or specific to one business.
 */
const CATEGORY_WHY: Partial<Record<EditorialCategoryId, string[]>> = {
  restaurant: [
    "A welcoming spot for date night or dinner with friends, where a relaxed dining room makes it easy to settle in and stay awhile.",
    "The kind of local table people come back to — an easygoing atmosphere and a menu worth lingering over with good company.",
  ],
  coffee_shop: [
    "A comfortable place to slow down over a handcrafted drink, whether you're catching up with a friend or settling in with a good book.",
    "An easy morning ritual — carefully made coffee and a calm, unhurried atmosphere that invites you to stay a little longer.",
  ],
  bakery: [
    "The smell of fresh baking and a case full of pastries make this a happy little detour worth building a morning around.",
    "A cheerful stop for something warm from the oven — the sort of neighborhood bakery that turns a quick errand into a treat.",
  ],
  winery: [
    "A relaxed place to taste your way through a thoughtful lineup, unwind on the patio, and let a slow afternoon stretch out.",
    "Wine tasting without the fuss — an inviting room, knowledgeable pours, and an easy excuse to gather a few friends.",
  ],
  cocktail_bar: [
    "A stylish spot for a well-made drink and good conversation, whether you're starting the night or making an evening of it.",
    "Craft cocktails and a warm, low-lit room make this an easy pick for date night or a memorable night out with friends.",
  ],
  brewery: [
    "Small-batch beers and a welcoming taproom make this a relaxed, unpretentious place to taste around and unwind with friends.",
    "A neighborhood taproom with a rotating lineup — the easy kind of hangout that's just as good after work as on a slow weekend.",
  ],
  park: [
    "Wide-open green space for a walk, a picnic, or an easy afternoon outdoors — a simple, reliable way to get everyone out of the house.",
    "A pleasant place to stretch your legs and slow down, whether you're bringing the kids, the dog, or just yourself.",
  ],
  dog_park: [
    "A fenced, off-leash space where dogs can run and play — an easy daily outing your four-legged friend will genuinely look forward to.",
    "Room for pups to burn energy and make friends, and for owners to trade tips on the bench — a low-key local favorite.",
  ],
  playground: [
    "A fun, safe place to let kids climb, swing, and burn off energy while grown-ups relax nearby — an easy win for the family.",
    "Bright play structures and open space make this an effortless afternoon out with the little ones.",
  ],
  museum: [
    "A rewarding stop for curious visitors, with thoughtfully arranged exhibits that make it easy to lose an afternoon exploring.",
    "The kind of place where you learn something without trying — engaging exhibits and a calm pace suited to all ages.",
  ],
  historic_site: [
    "A chance to step into the area's story, where the history feels close enough to touch and every corner has something to notice.",
    "A memorable stop for anyone curious about how this place came to be — history made vivid and worth slowing down for.",
  ],
  botanical_garden: [
    "Winding paths, seasonal color, and quiet corners make this a restorative escape for a slow, wander-anywhere afternoon.",
    "A beautiful place to breathe and unwind among the plantings — equally lovely for a solo stroll or an easy date.",
  ],
  beach: [
    "Sand, open water, and room to spread out for the day — an easy plan for sunshine, a swim, or simply doing nothing at all.",
    "A relaxed spot to soak up the sun and the shoreline, whether you're bringing the whole crew or just a good book.",
  ],
  lake: [
    "Calm water and open sky make this an easy place to slow down — good for a paddle, a picnic, or a quiet afternoon by the shore.",
    "A scenic escape for time on the water or a lazy afternoon on the bank, with room to breathe and unwind.",
  ],
  river: [
    "A pretty stretch of water for a riverside walk or an easy afternoon outdoors, with the sound of the current doing the rest.",
    "A calm, scenic spot to slow down by the water — an effortless way to get outside for an hour or a whole afternoon.",
  ],
  scenic_lookout: [
    "A short trip for a big view — the kind of overlook worth timing for golden hour and a few unforgettable photos.",
    "Sweeping scenery that makes the drive worth it, whether you're catching sunrise, sunset, or just a quiet moment.",
  ],
  observation_deck: [
    "A memorable place to take in the night sky or the view, where a little time looking up leaves a lasting impression.",
    "Big-sky wonder and a fresh perspective — a genuinely memorable outing for the curious and the young at heart.",
  ],
  scenic_drive: [
    "A beautiful route made for slowing down, rolling the windows down, and stopping wherever the view asks you to.",
    "One of those drives that's the whole point — changing scenery, easy pullouts, and no reason to rush.",
  ],
  library: [
    "A quiet, welcoming place to read, work, or wander the stacks — a calm corner of the community open to everyone.",
    "More than books: a peaceful spot to settle in, discover something new, and take your time doing it.",
  ],
  bookstore: [
    "A browse-for-an-hour kind of place, with well-chosen shelves and the small thrill of stumbling onto your next favorite read.",
    "An inviting shop for readers, where staff picks and cozy corners make it easy to lose track of time.",
  ],
  arcade: [
    "Rows of games, a little friendly competition, and easy nostalgia make this a lively pick for a group or a rainy afternoon.",
    "Lights, sounds, and plenty of fun — a low-key way to bring out everyone's competitive streak.",
  ],
  bowling_alley: [
    "Easy, everyone's-welcome fun for a group or a birthday — grab a lane, keep score loosely, and let the night take care of itself.",
    "A reliable good time whatever the weather, with lanes, snacks, and just enough rivalry to keep it interesting.",
  ],
  mini_golf: [
    "A playful round that's low on skill and high on fun — an easy plan for families, first dates, or a laid-back rematch.",
    "Whimsical holes and a relaxed pace make this a crowd-pleaser for just about any age or group.",
  ],
  escape_room: [
    "Expect clever puzzles, an immersive theme, and just enough pressure to keep your group talking long after the game ends.",
    "A memorable team challenge where the fun is in the figuring-out — ideal for a group outing or an inventive date night.",
  ],
  rock_climbing_gym: [
    "A welcoming place to test yourself on the wall, whether it's your first climb or your hundredth — encouraging staff and a good sweat.",
    "Approachable routes, a supportive vibe, and a real sense of accomplishment make this a rewarding way to move.",
  ],
  golf_course: [
    "A relaxed round in the open air, whether you're chasing a good score or just enjoying the walk and the company.",
    "Well-kept fairways and easy pacing make this a pleasant way to spend a morning outdoors.",
  ],
  pickleball: [
    "The sport everyone's hooked on — quick to learn, genuinely fun, and an easy way to get a group moving and laughing.",
    "Fast, friendly rallies for all skill levels, and one of the most social ways to spend an afternoon outside.",
  ],
  zoo: [
    "Up-close encounters with animals big and small make this a full, memorable day out for families and the endlessly curious.",
    "A classic outing kids never tire of, with room to roam and something surprising around every bend.",
  ],
  aquarium: [
    "Glowing tanks and up-close sea life make this a calming, wide-eyed outing that's just as fun for grown-ups as for kids.",
    "A mesmerizing look beneath the surface — an easy, all-ages way to spend a couple of hours exploring.",
  ],
  farm: [
    "Fresh air, farm animals, and hands-on fun make this a wholesome, memorable outing the whole family can enjoy.",
    "A charming taste of country life — pick something in season, meet the animals, and slow down for an afternoon.",
  ],
  farmers_market: [
    "Fresh produce, local makers, and a friendly buzz create one of the community's most enjoyable weekend traditions.",
    "A cheerful morning out among local vendors — good food, small finds, and the kind of atmosphere that's contagious.",
  ],
  shopping_district: [
    "A walkable stretch of local shops and small finds — the kind of place made for an unhurried afternoon of browsing.",
    "Independent storefronts and easy strolling make this a pleasant way to spend a few hours and support local makers.",
  ],
  market: [
    "A lively hall of local vendors and small bites — graze, browse, and let the crowd and the flavors set the pace.",
    "Part food, part finds, all local character — an easy, wander-and-sample kind of outing.",
  ],
  kayaking: [
    "Time on the water at your own pace — a refreshing, get-outside adventure that's easier to try than it looks.",
    "Calm coves and open water make this a memorable way to spend a morning, whether you're a first-timer or a regular.",
  ],
  paddleboarding: [
    "A fun, surprisingly peaceful way to get on the water — easy enough for beginners and a genuinely good time for everyone.",
    "Balance, sunshine, and a fresh view from the water make this an easy adventure to say yes to.",
  ],
  theater: [
    "A memorable night out where the lights dim and the room leans in — live performance you'll be talking about afterward.",
    "An intimate room and real stagecraft make this a special evening for a date or a night with friends.",
  ],
  country_club: [
    "A polished setting for a relaxed round and easy hospitality — a pleasant way to spend a morning on the greens.",
    "Manicured grounds and unhurried pacing make this an inviting escape for a leisurely day out.",
  ],
  rock_shop: [
    "Cases of crystals, minerals, and small treasures make this a surprisingly delightful browse for collectors and curious kids alike.",
    "A quirky, hands-on stop where every shelf holds something worth picking up — easy fun and easy to lose track of time.",
  ],
};

/** Deterministic per-item variant pick so same-category cards don't read alike. */
function pickVariant(variants: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

/**
 * Resolve the "Why you'll love it" line for a discovery place. Prefers a genuine
 * Bandit's Note, then a curated line for a VERIFIED category, else null.
 */
export function resolveWhyYoullLoveIt(input: {
  banditNote?: string | null;
  classification?: Pick<
    VenueClassification,
    "categoryId" | "confidence" | "source"
  > | null;
  /** Stable id used to vary the category line (e.g. the article/item id). */
  seed?: string | null;
}): string | null {
  const note = input.banditNote?.trim();
  if (note) return toKnownForBlurb(note);

  const c = input.classification;
  if (
    c &&
    c.confidence === "high" &&
    (c.source === "foursquare" || c.source === "metadata")
  ) {
    const variants = CATEGORY_WHY[c.categoryId];
    if (variants?.length) {
      return pickVariant(variants, input.seed?.trim() || c.categoryId);
    }
  }
  return null;
}
