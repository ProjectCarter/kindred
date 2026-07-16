/**
 * Discovery article desk — the editorial content shown when a reader taps
 * into a discovery recommendation (Bandit's Notebook, Experiences,
 * Recommendations, Local Businesses all resolve through here).
 *
 * The seed catalog recommends a *kind* of place or moment, not a verified
 * named venue — so these pieces write toward the experience honestly:
 * what it feels like, why it's worth going, what to notice. Never a
 * fabricated fact about a specific address. When Kindred has a curated
 * piece for an item, use it; otherwise fall back to a calm, honest brief.
 *
 * Monocle taught us to make people want to go. Smithsonian taught us to
 * tell it as a story rather than a listing. This is Kindred's own voice.
 */

import type { ContentType, EditorialFieldAnswers } from "./contentSystem";
import type { DiscoveryCategory, DiscoveryItem } from "./discovery";
import type { LocalEventCard } from "./localEvents";
import { resolveVenueClassification } from "./venueClassification";
import {
  editorialCopyConflicts,
  resolveVerifiedEditorialCategory,
  sanitizeEditorialParagraphs,
  validateEditorialArticle,
} from "./editorialCategory";
import { composeEventArticleFromVerifiedData } from "./eventEditorial";
import {
  discoveryBackgroundFromGrounding,
  type KnowledgeLookupResult,
} from "./knowledgeGrounding";
import { sanitizeAddressForDisplay } from "./verifiedLocation";
import {
  closingLineForPlace,
  containsEngineLanguage,
  isNearDuplicateCopy,
  openingLineForPlace,
  sanitizeReaderParagraphs,
  sceneLineForPlace,
} from "./editorialVoice";
import { containsGenericAiPhrase } from "./editorialIntelligence";
import {
  applyEditionVarietyToBody,
  buildVarietySeed,
  orderDiscoverySlots,
  type DiscoveryVarietySlot,
} from "./editionVariety";

export type CuratedDiscoveryArticle = {
  /** Editorial subheading for the reader — distinct from the homepage card dek. */
  dek: string;
  /** Body paragraphs — story first, always. */
  body: string[];
  /** Only when a line truly earns the pull-quote treatment. */
  pullQuote?: string;
  /** Universal Content System desk this piece belongs to. */
  contentType: ContentType;
  /** Practical questions answered in prose, rendered as desk modules. */
  fieldAnswers: EditorialFieldAnswers;
};

const CURATED_DISCOVERY_ARTICLES: Record<string, CuratedDiscoveryArticle> = {
  disc_coffee_third_wave: {
    dek: "Not the loudest shop on the block — the one with a window seat and nowhere to be.",
    contentType: "coffee",
    body: [
      "Every neighborhood has one, and almost nobody photographs it. It isn't the shop with the line out the door or the mural built for a feed — it's the one a few doors down, half-empty at nine, where the person behind the counter remembers how you take it by the third visit.",
      "The tell is usually the noise. A loud espresso machine is fine; a loud room is not. Walk in, and within about four seconds you can feel whether a place wants you to stay or wants you to move along — the good ones have chairs you'd actually choose to sit in, and nobody hovering over a table for two.",
      "Order the simplest thing on the board. A cortado, a plain drip, whatever the house makes without a menu of syrups to hide behind — that's the honest test of the place, not the seasonal special written on the chalkboard.",
      "Mornings here have their own rhythm: the hour after opening belongs to regulars and folded newspapers, mid-morning fills with laptops, and by early afternoon it softens into something closer to a living room. Locals learn which hour is theirs and quietly protect it.",
      "Find the one near you, not the one three towns over with the wait. The best cup is rarely the famous one. It's the one you can walk to.",
    ],
    fieldAnswers: {
      atmosphere:
        "Steam, low music, and just enough hum that a conversation feels private without trying. The good ones are calm rather than curated.",
      signature_drinks:
        "Skip the seasonal specials board on a first visit. Order what the house makes without decoration — a cortado or a straightforward drip tells you everything.",
      seating:
        "A mix of counter stools for the quick cup and at least one worn armchair for the long one. If every seat is built for turnover, keep walking.",
      best_time:
        "The first hour after opening, when it still belongs to regulars and the light is low and kind.",
      locals_order:
        "Whatever the person behind the counter drinks on their own break — ask, and most will tell you honestly.",
      nearby:
        "A bookstore or a park bench within a five-minute walk turns one stop into a whole morning.",
    },
  },

  disc_restaurant_neighborhood: {
    dek: "Short menu, real produce, and a room that isn't trying to be anywhere else.",
    contentType: "restaurant",
    body: [
      "The menu that changes every few weeks is usually the giveaway — not a seasonal insert clipped to a laminated card, but an actual short list, six or seven dishes, rewritten because the walk-in said so.",
      "These rooms rarely have a line. They don't need one; a neighborhood table survives on Tuesday nights, not on a single Saturday rush covered by somebody's feed. That quiet consistency is the whole point.",
      "Order whatever the server mentions twice without being asked — that's usually the dish the kitchen is proudest of tonight, not the one that photographs best.",
      "Go on a weeknight if you can. The room is calmer, the kitchen has more attention to spend on your plate, and you get the version of the place its regulars actually know.",
      "It won't be the loudest restaurant in your feed. It will be the one you end up returning to without planning it.",
    ],
    fieldAnswers: {
      signature:
        "Trust whatever's handwritten at the bottom of the menu, or whatever the server recommends unprompted — usually the kitchen's real pride, not its safest seller.",
      price:
        "A genuine neighborhood table is priced for a Tuesday, not a special occasion. If it isn't, it's probably performing for the wrong crowd.",
      reservations:
        "Small rooms like this often keep a few seats at the bar for walk-ins. Ask before assuming you need a booking.",
      ambience:
        "Low enough light to be kind, loud enough room to talk without an audience. Nothing about it is trying to be photographed.",
      best_time:
        "A weeknight, early. You'll get the kitchen's full attention and a table without waiting for one.",
      nearby:
        "A short walk after dinner beats a second round at the bar — let the meal be the whole evening.",
    },
  },

  disc_recipe_weeknight: {
    dek: "One pan, one hour, and an evening that ends calmer than it started.",
    contentType: "recommendation",
    body: [
      "The best weeknight recipes are almost boring to read. One pan. A short list of ingredients you probably already own. No step that needs a thermometer you don't have or a technique you'd have to look up twice.",
      "That plainness is the craft. A recipe earns a permanent place in rotation not by being clever but by being reliable — the kind of dish you can start after a long day without reading ahead first.",
      "The good ones also forgive you. A little extra garlic, a shorter simmer, whatever vegetable is actually in the drawer — a well-built weeknight dish survives your Tuesday-night attention span.",
      "Cook it once by the recipe. By the third time, you'll be cooking it by memory, and that's when it's really yours.",
    ],
    fieldAnswers: {
      why_today:
        "Some evenings need cooking that asks very little of you and still tastes like care was involved. This is that kind.",
      how_long:
        "Well under an hour, start to plate — built for a weeknight, not a project.",
      best_for: "A Tuesday that needs one small, good thing in it.",
      pair_with:
        "Whatever's already open in the fridge door — this isn't a dish that needs a shopping trip.",
    },
  },

  disc_beach_morning: {
    dek: "Before the joggers, before the umbrellas — just the tide and a clear head.",
    contentType: "beach",
    body: [
      "There's a version of every beach that only exists for about ninety minutes after sunrise: cooler air, flatter light, sand still holding the shape of last night's tide. Almost nobody sees it, because almost nobody is awake for it.",
      "This isn't necessarily a swim — it's a walk. Shoes off or shoes on, it doesn't matter. What matters is that the shore is doing something at that hour it won't do again until tomorrow: settling, quiet, entirely without performance.",
      "Locals know this hour and rarely mention it, because there's nothing to sell about it. No lifeguard stand open yet, no music, no rental stand — just the long walk out and the longer walk back.",
      "Bring nothing you need to carry. Coffee if you must, but the point of the hour is that your hands are empty and your only job is to notice the horizon.",
      "By the time the beach fills in, you'll already have had the best of it.",
    ],
    fieldAnswers: {
      character:
        "Early morning sand is firmer and cooler underfoot — a different texture entirely from the same stretch at noon.",
      swimming:
        "If the water invites it, it's usually calmest at first light, before wind and boat traffic stir it up.",
      parking:
        "Arrive before a beach town wakes and parking is rarely the problem it becomes by ten.",
      best_time: "The hour after sunrise — cooler, quieter, and yours.",
      nearby:
        "A coffee on the walk back turns a quiet walk into a proper morning.",
    },
  },

  disc_hike_ridge: {
    dek: "Chosen for the overlook, not the mileage — the kind of trail you keep thinking about.",
    contentType: "hiking",
    body: [
      "Every region has a handful of trails locals recommend to visitors, and a shorter list they actually hike themselves. The second list is shorter for a good reason: distance for its own sake gets old, but a real view at the top never does.",
      "A ridge trail worth the climb has a moment — usually one specific bend or clearing — where the effort suddenly makes sense. Everything before it is just walking. That moment is the whole reason to go.",
      "Go for the light, not just the exercise. Early enough that the air is still cool and the view isn't hazed out by midday heat is when a ridge earns its reputation.",
      "Carry more water than you think you need and less phone than you think you need. The overlook is better without one hand full of a screen.",
      "You won't remember the switchbacks in a year. You'll remember the five minutes at the top.",
    ],
    fieldAnswers: {
      difficulty:
        "Rate it honestly for yourself, not for the trailhead sign — a ridge trail earns respect for elevation, not distance.",
      water:
        "Carry more than the trail guide suggests; ridgelines are exposed and thirstier than valley trails.",
      best_season:
        "Spring and autumn generally offer the clearest air and the kindest temperatures for a climb.",
      sunrise_sunset:
        "If timing allows, sunrise or the hour before sunset turns a good view into an unforgettable one.",
      wildlife:
        "Ridgelines are often quieter for wildlife than valley trails, though mornings occasionally reward patient eyes.",
    },
  },

  disc_park_afternoon: {
    dek: "Shade, a bench, and nowhere else you need to be for twenty minutes.",
    contentType: "park",
    body: [
      "There's a specific kind of relief in a city park on a weekday afternoon — not the weekend crowd with the speaker and the frisbee, but the quieter version: a few readers, a few dog walkers, someone eating lunch alone on a bench without embarrassment.",
      "The value of a park has never really been about acreage. It's about having somewhere within walking distance where nobody expects anything of you — no purchase, no reservation, no reason for being there beyond wanting to sit outside.",
      "Locals return to the same bench or the same tree without quite deciding to; it becomes a habit before it becomes a favorite. That's usually the sign of a park doing its job well.",
      "Twenty minutes is enough. You don't need the whole afternoon — just enough time for your shoulders to drop and your thoughts to slow down.",
    ],
    fieldAnswers: {
      best_for:
        "Reading, a slow lunch, or simply sitting somewhere that isn't a screen — the most underrated use of a park is doing nothing in one.",
      shade:
        "Look for the mature trees rather than the open lawn on a hot afternoon; the shaded edges of a park are almost always the calmest.",
      best_time:
        "Weekday afternoons trade the crowd for the calm — the park is still there, just quieter.",
      nearby:
        "A coffee or a bakery within walking distance turns a park visit into a proper outing.",
    },
  },

  disc_drive_coastal: {
    dek: "The pull-offs matter more than the mileage — plan for stops, not speed.",
    contentType: "travel",
    body: [
      "A good scenic drive is really a string of small decisions about where to stop, not a straight line from A to B. The drive itself is rarely the point — it's the six or seven places along it worth pulling over for.",
      "Go slower than the speed limit invites. The whole appeal of this kind of route is that nobody's timing you, and the view doesn't wait for the next overlook sign to be worth noticing.",
      "Midweek and early are both good instincts here — the same road at golden hour on a Tuesday feels entirely different from the same road jammed on a Saturday.",
      "Fill the tank before you go and bring something to eat in the car. The best version of this drive doesn't have a fixed itinerary; it has room to change plans when a pull-off looks better than expected.",
      "Home by evening, a little sun-tired, with more photos on your phone than you meant to take.",
    ],
    fieldAnswers: {
      why_go:
        "For an afternoon that feels like a genuine change of scenery without the planning of a real trip.",
      getting_there:
        "Worth doing by car rather than any faster route — the pull-offs are the entire point.",
      when_to_go:
        "Golden hour, on a weekday if your schedule allows it — the light does most of the work.",
      dont_miss:
        "Whichever overlook has the fewest cars parked at it. That's usually the one everyone else is driving past.",
    },
  },

  disc_museum_wing: {
    dek: "Skip the checklist. One room, done properly, beats the whole building rushed.",
    contentType: "museum",
    body: [
      "Most people try to see an entire museum in an afternoon and remember almost none of it by dinner. The better strategy, and the one most curators would privately recommend, is choosing one wing and giving it real time.",
      "There's a particular fatigue that sets in around the fortieth object in a single visit — eyes glaze, captions blur, everything becomes a photograph rather than an experience. One wing, taken slowly, avoids that entirely.",
      "Sit down in front of something for longer than feels natural. Two minutes, not twenty seconds. Most museum-goers walk past more than they actually see; the ones who linger are usually the ones who leave with something.",
      "Go on a weekday morning if you can, when the crowd is thin and the room has time to breathe.",
      "You'll leave remembering one object clearly instead of forty vaguely. That's the better trade.",
    ],
    fieldAnswers: {
      dont_miss:
        "Whichever single gallery pulls you in on the way past — trust that instinct over the guidebook's top picks.",
      time_needed:
        "An hour, given fully to one wing, teaches you more than three hours spread thin across the whole building.",
      best_exhibits:
        "Ask a guard which room they'd send a friend to — it's rarely the one with the longest line.",
      cafe:
        "Worth the pause if there is one; a coffee halfway through resets attention better than pushing straight through.",
    },
  },

  disc_book_evening: {
    dek: "One title, no pile — chosen to be finished, not just started.",
    contentType: "recommendation",
    body: [
      "Most reading lists fail for the same reason: too many books, not enough evenings, and a quiet guilt that builds every time a new one gets added before the last one's finished.",
      "The fix isn't reading faster. It's choosing better — one book at a time, picked specifically because it earns the whole evening rather than the first thirty pages.",
      "A book worth finishing usually announces itself early: a voice you trust by page ten, a question you actually want answered, momentum instead of duty.",
      "Put the phone in another room. Even twenty uninterrupted minutes reads differently than an hour split six ways.",
      "Finish this one before starting the next. The pile can wait; it always does.",
    ],
    fieldAnswers: {
      why_today:
        "An evening with one clear book in hand feels different from an evening spent choosing between four half-started ones.",
      how_long:
        "A few focused evenings, not a project — this is a book built to be finished, not managed.",
      best_for: "A quiet night with the phone in another room.",
      pair_with: "Tea over coffee — something that doesn't rush the hour.",
    },
  },

  disc_movie_quiet: {
    dek: "Chosen for mood, not noise — good company for a slow evening.",
    contentType: "recommendation",
    body: [
      "There's a difference between a film you put on and a film you actually watch, and most streaming menus are built to blur that line. This one's for the second kind.",
      "Chosen for craft and pacing rather than what's trending this week — the sort of film that rewards actually paying attention, because there aren't really slow parts, just quiet ones.",
      "Dim the lights properly. Half the experience of a good quiet film is the room you watch it in — no overhead light, no second screen competing for attention.",
      "It won't be the loudest choice on the home screen tonight. That's rather the point.",
    ],
    fieldAnswers: {
      why_today:
        "Some nights call for something with a pulse instead of noise — this earns the couch time rather than filling it.",
      how_long:
        "One sitting, properly watched, beats two half-watched episodes of something louder.",
      best_for:
        "A slow evening, lights down, nothing else competing for attention.",
      pair_with: "Nothing louder than tea. Let the film hold the room.",
    },
  },

  disc_podcast_walk: {
    dek: "One episode that earns the headphones — curious, unhurried, worth the time.",
    contentType: "recommendation",
    body: [
      "A good walking podcast has a specific rhythm: it doesn't need visuals, it doesn't rush its point, and it's just as interesting at minute thirty as it was at minute three.",
      "Most people default to whatever autoplays next. Worth breaking that habit occasionally and choosing on purpose — one episode, picked because the subject actually pulled at your curiosity, not because it was simply next in the queue.",
      "Morning works best. The mind is quieter, the streets are quieter, and a good idea has room to actually land instead of competing with the noise of a commute.",
      "Finish the episode before checking your phone. It's a small discipline, and it's the whole reason this works.",
    ],
    fieldAnswers: {
      why_today:
        "A walk with one good idea in your ears beats a walk spent scrolling before you've even left the house.",
      how_long:
        "The length of one unhurried walk — no need to fit it into a commute.",
      best_for: "A morning with nowhere urgent to be for thirty minutes.",
      pair_with:
        "A route you've walked before — familiar streets leave more attention for listening.",
    },
  },

  disc_hidden_side_street: {
    dek: "Small, specific, and easy to walk past if you're not looking for it.",
    contentType: "hidden_gem",
    body: [
      "The best local finds are almost never on the main street. They're one block over, past a shop you weren't looking at, in a space that would be easy to mistake for a storage unit if you didn't already know to look.",
      "There's a reason locals don't advertise these places: attention changes them. A quiet, specific spot survives on the people who already know about it, and a viral write-up is usually the beginning of the end for the thing that made it good.",
      "Finding it is half the appeal. No sign worth photographing, no queue to signal you've arrived somewhere — just a door that looks unremarkable until you're inside it.",
      "If you find something like this, the courtesy is simple: go, enjoy it, and resist the urge to post the exact address. Let the next person have the same small discovery you just had.",
    ],
    fieldAnswers: {
      how_to_find:
        "Walk one block past where the map tells you to stop — the real find is rarely on the street with the foot traffic.",
      why_go:
        "For the specific pleasure of discovering something nobody handed you a listicle for.",
      best_time: "Off-peak, always — a quiet find deserves a quiet visit.",
      keep_quiet:
        "Enjoy it, don't geotag it. The best version of this place is the one that stays small.",
    },
  },

  disc_travel_day_trip: {
    dek: "One destination, one good meal, home by evening — no itinerary required.",
    contentType: "travel",
    body: [
      "The best day trips have exactly one reason to exist. Not a checklist of six attractions crammed into eight hours, but a single, clear pull — a view, a meal, a town worth the drive — with everything else built loosely around it.",
      "Leave earlier than feels necessary. The extra hour in the morning buys you the version of the destination before it's crowded, and you'll be home with daylight to spare instead of racing the sunset back.",
      "Pick one meal to build the day around and let everything else be optional. A day trip with a plan that flexible rarely disappoints, because there's nothing rigid enough to break.",
      "The measure of a good one isn't distance covered. It's whether you'd do it again next month without needing a reason.",
    ],
    fieldAnswers: {
      why_go:
        "For the rare feeling of a full change of scenery without needing a suitcase.",
      getting_there:
        "Close enough to do by car in under two hours — the whole appeal is being home for your own bed.",
      when_to_go:
        "A weekday if you can manage it; the same destination on a Saturday is a different, busier place.",
      where_to_eat:
        "Choose one meal worth planning around and let the rest of the day stay loose.",
    },
  },

  disc_recipe_weekend_bake: {
    dek: "Slow hands, a quiet kitchen, and a technique that teaches you something.",
    contentType: "recommendation",
    body: [
      "Weekend baking is a different kind of cooking than a weeknight dinner — less about getting food on the table and more about the hour spent with your hands doing something slow and specific.",
      "A bake worth the flour usually teaches you a real technique along the way: how dough actually feels when it's ready, why a rest matters, what happens if you rush the part you're not supposed to rush.",
      "Set aside the whole afternoon, not just the active minutes. The waiting is part of it — a rise, a chill, a rest — and rushing those steps is usually the difference between fine and genuinely good.",
      "Whatever comes out of the oven, the real result is a kitchen that smells like it for the rest of the day.",
    ],
    fieldAnswers: {
      why_today:
        "A weekend with an hour of slow, hands-on cooking in it tends to feel longer and calmer than one without.",
      how_long:
        "An afternoon, including the waiting — this isn't a rushed bake.",
      best_for: "A weekend with no fixed plans and a kitchen you don't mind flour on.",
      pair_with: "Good coffee and nowhere to be while it cools.",
    },
  },

  disc_activity_try_something: {
    dek: "Chosen for the doing, not the destination — you don't have to be good at it.",
    contentType: "recommendation",
    body: [
      "Most weekends default to watching something rather than doing something, mostly because doing something takes a little more planning than pressing play. This category exists for the other option: an hour or two spent actually using your hands, your balance, or your nerve.",
      "The appeal isn't skill. Nobody expects to be good at axe throwing or mini golf or a first afternoon on a paddleboard — the appeal is the small, specific focus of trying, which a screen can't really give you.",
      "Go with someone, if you can. These are almost always better shared than solo, and a little friendly competition tends to make the awkward first attempt at anything less self-conscious.",
      "Book ahead where you can — the good ones (an escape room, a lane at the bowling alley on a Saturday night) fill up faster than you'd expect for a Tuesday-brain decision made on a Thursday.",
      "You won't remember the score. You'll remember that you went and did the thing instead of talking about doing it.",
    ],
    fieldAnswers: {
      skill_level:
        "Built for first-timers as much as regulars — nobody's grading you on this one.",
      what_to_bring:
        "Closed-toe shoes and a willingness to be mediocre at something for an hour.",
      best_for: "A group looking for something to do together, not just somewhere to sit together.",
      booking:
        "Worth calling or booking ahead on weekends — the good spots fill up faster than a weekday errand suggests.",
    },
  },

  disc_activity_water: {
    dek: "Rent, don't buy — the point is the water, not the gear.",
    contentType: "recommendation",
    body: [
      "A first afternoon on a kayak or a paddleboard is almost always better than expected and shorter than planned — the learning curve is real but small, and most people are upright and moving within the first ten minutes.",
      "Rental is the right call before ownership. Renting means someone else worries about storage, transport, and whether you'll actually use it again next month — you just show up and get in the water.",
      "Go earlier than feels necessary. Calmer water, softer light, and a rental counter that isn't three groups deep — the same stretch of water at noon is a different, busier place.",
      "Life jackets aren't optional gear here, they're the whole reason this is a relaxing afternoon and not a nervous one. A good outfitter hands you one before you ask.",
      "The wobble on your first minute in is normal. By the last twenty, you'll have forgotten you were ever unsteady.",
    ],
    fieldAnswers: {
      skill_level: "No experience needed — most rental spots include a five-minute rundown before you're on the water.",
      best_time: "Morning, before wind picks up and the water gets choppy.",
      what_to_bring: "Sunscreen, a change of clothes, and nothing you're not prepared to get wet.",
      booking: "Weekend mornings book up — a call ahead beats showing up and hoping.",
    },
  },

  disc_bakery_morning: {
    dek: "Go for what just came out of the oven, not what's still in the case at noon.",
    contentType: "recommendation",
    body: [
      "A bakery has a clock most people never learn to read: whatever's freshest is usually gone by mid-morning, and what's left by afternoon is fine, not great. The good regulars know which hour is actually theirs.",
      "Croissants in particular don't forgive waiting — the first hour after they come out of the oven is the whole show, and no amount of case-lighting makes a five-hour-old pastry taste like a fresh one.",
      "Ask what came out most recently rather than pointing at whatever looks best under glass. The person behind the counter always knows, and they'll usually tell you straight.",
      "A real bakery smells like one from the doorway. If it doesn't, you're probably looking at a case restocked from somewhere else, not an oven in the back.",
      "Buy one thing you already know you like and one thing you don't recognize. That second one is usually how you find a new favorite.",
    ],
    fieldAnswers: {
      best_time: "Early — most of the best-known items sell out or go stale well before lunch.",
      what_to_get: "Whatever the counter says came out most recently, over whatever simply looks best in the case.",
      seating: "Some are counter-and-go, some have a table or two — worth checking before you plan on sitting.",
      nearby: "A coffee shop nearby turns a bakery stop into a proper morning instead of a five-minute errand.",
    },
  },

  disc_garden_slow_walk: {
    dek: "Twenty minutes among growing things — no destination, just a path and no hurry.",
    contentType: "recommendation",
    body: [
      "A garden asks less of you than almost anywhere else on a recommendations list. No reservation, no itinerary, no correct way to see it — just a path, and permission to walk it slowly.",
      "The best time depends entirely on what's in bloom, which changes the visit more than the season name suggests. A quick check before you go is worth more than assuming spring means flowers and winter means nothing worth seeing.",
      "Go on a weekday morning if the schedule allows it. Gardens absorb a weekend crowd fine, but they're built for the kind of quiet that a Tuesday morning still has.",
      "Bring a reason to sit, not just to walk through — a bench, a book, ten minutes with nowhere else to be. Most people move through a garden like a hallway; the ones who sit down get the better version of it.",
      "You don't need to know the names of anything growing there. Looking is enough.",
    ],
    fieldAnswers: {
      best_time: "Whatever's blooming dictates more than the calendar does — worth a quick check before you go.",
      best_for: "A slow twenty minutes, alone or with someone who doesn't need to be entertained.",
      accessibility: "Most garden paths are paved and gently graded, though it's worth confirming for a specific visit.",
      nearby: "A bench with actual shade is usually worth seeking out over the first one you see.",
    },
  },

  disc_wirecutter_gear_quiet: {
    dek: "Useful, tested, and chosen to last — never a haul.",
    contentType: "recommendation",
    body: [
      "Most gear recommendations are really just noise dressed up as advice — ten options, all slightly different, none of them actually helping you decide. The useful version is much rarer: one thing, chosen carefully, for a specific season's specific problem.",
      "The test worth applying to anything new isn't whether it's clever. It's whether you'd still be using it in a year without a special occasion to justify it.",
      "Buy less, choose better — the oldest advice in this category and still the only one that holds up. One well-made thing outlasts five mediocre ones, in the drawer and in the budget.",
      "This isn't a haul. It's one recommendation, made because it earned it.",
    ],
    fieldAnswers: {
      why_today:
        "One good, considered choice beats ten unconsidered ones — worth the extra minute before buying.",
      how_long:
        "Chosen to last well past this season, not just to solve this week's problem.",
      best_for: "Whoever's tired of gear advice that reads like an ad.",
      pair_with: "Nothing else — that's the whole point of choosing one thing well.",
    },
  },
};

export function getCuratedDiscoveryArticle(
  id: string
): CuratedDiscoveryArticle | null {
  return CURATED_DISCOVERY_ARTICLES[id] ?? null;
}

/**
 * The seed catalog has ~35 entries across 13 categories, but only the
 * handful above got their own hand-written piece — matched by exact id.
 * Every catalog id outside that list (plus every Foursquare place and
 * every local event reshaped into a discovery card, neither of which can
 * ever match a static id) was falling through to a two-sentence generic
 * brief. Rather than write one thin filler per missing id, every real
 * category borrows the curated essay already written for that kind of
 * place or moment — genuinely rich, honest, category-true writing,
 * never a fabricated fact about one specific address. Deterministic per
 * item id so the same seed reads the same way within one session.
 */
const CATEGORY_ESSAY_IDS: Partial<Record<DiscoveryCategory, string[]>> = {
  coffee: ["disc_coffee_third_wave"],
  restaurants: ["disc_restaurant_neighborhood"],
  recipes: ["disc_recipe_weeknight", "disc_recipe_weekend_bake"],
  beaches: ["disc_beach_morning"],
  hiking: ["disc_hike_ridge"],
  parks: ["disc_park_afternoon"],
  scenic_drives: ["disc_drive_coastal"],
  museums: ["disc_museum_wing"],
  books: ["disc_book_evening"],
  movies: ["disc_movie_quiet"],
  podcasts: ["disc_podcast_walk"],
  experiences: ["disc_hidden_side_street", "disc_wirecutter_gear_quiet"],
  travel: ["disc_travel_day_trip"],
  activities: ["disc_activity_try_something", "disc_activity_water"],
  bakeries: ["disc_bakery_morning"],
  gardens: ["disc_garden_slow_walk"],
};

function hashKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function isWaterActivityVenue(
  venueCategories: string[] | null | undefined
): boolean {
  const blob = (venueCategories ?? []).join(" ").toLowerCase();
  return /\b(kayak|paddle|paddleboard|canoe|boat|marina|sailing|surf|swim|water)\b/.test(
    blob
  );
}

/** Activity essays matched to venue type — never kayak copy on a bowling alley. */
function activityEssayIds(
  venueCategories: string[] | null | undefined
): string[] {
  if (isWaterActivityVenue(venueCategories)) {
    return ["disc_activity_water", "disc_activity_try_something"];
  }
  return ["disc_activity_try_something"];
}

/**
 * A category-appropriate curated essay for any discovery item that
 * doesn't have its own hand-written piece. Every real category has at
 * least one — this is the second-tier fallback, tried before the plain
 * generic composer.
 */
export function getCategoryDiscoveryArticle(
  category: DiscoveryCategory | string | null | undefined,
  seedKey: string,
  options?: { venueCategories?: string[] | null }
): CuratedDiscoveryArticle | null {
  let ids = CATEGORY_ESSAY_IDS[category as DiscoveryCategory];
  if (!ids?.length) return null;
  if (category === "activities") {
    ids = activityEssayIds(options?.venueCategories);
  }
  const id = ids[hashKey(seedKey) % ids.length];
  return CURATED_DISCOVERY_ARTICLES[id] ?? null;
}

/**
 * Full-piece composer for any discovery card without its own curated
 * essay — borrows the matching category essay so it reads as a complete
 * newspaper piece rather than a two-sentence filler. Returns null only
 * when the category itself isn't one of the desk's covered categories
 * (defensive — every current DiscoveryCategory is covered).
 */
export function composeCategorySeedArticle(input: {
  title: string;
  dek?: string | null;
  category: DiscoveryCategory | string | null | undefined;
  seedKey: string;
  venueCategories?: string[] | null;
  editionDate?: string | null;
}): { dek: string; body: string[]; fieldAnswers: EditorialFieldAnswers } | null {
  const essay = getCategoryDiscoveryArticle(input.category, input.seedKey, {
    venueCategories: input.venueCategories,
  });
  if (!essay) return null;

  const verified = resolveVerifiedEditorialCategory({
    title: input.title,
    venueCategories: input.venueCategories,
    discoveryCategory: input.category,
    dek: input.dek,
  });

  const dek = input.dek?.trim() || essay.dek;
  const body = sanitizeEditorialParagraphs(
    verified.categoryId,
    dedupeDiscoveryBody(essay.body)
  );

  const fieldAnswers: EditorialFieldAnswers = {};
  for (const [key, value] of Object.entries(essay.fieldAnswers)) {
    if (typeof value === "string" && editorialCopyConflicts(verified.categoryId, value)) {
      continue;
    }
    fieldAnswers[key] = value;
  }

  if (body.length === 0) return null;

  const varietySeed = buildVarietySeed(input.editionDate, input.seedKey || input.title);
  const variedBody = applyEditionVarietyToBody(body, varietySeed);

  return { dek, body: variedBody, fieldAnswers };
}

/**
 * Honest, scene-first fallback for discovery items without a curated piece —
 * commonly real local events reshaped into discovery candidates upstream.
 * Never invents a fact beyond the dek / why already supplied by the engine.
 */
export function composeFallbackDiscoveryBody(input: {
  title: string;
  dek?: string | null;
  why?: string | null;
  city?: string | null;
}): string[] {
  const dek = input.dek?.trim() || "";
  const why = input.why?.trim() || "";
  const paragraphs: string[] = [];

  if (why && !containsEngineLanguage(why) && !isNearDuplicateCopy(why, dek)) {
    paragraphs.push(why);
  } else if (dek && !containsEngineLanguage(dek)) {
    paragraphs.push(dek);
  } else if (input.city) {
    paragraphs.push(
      `${input.title.trim()} is worth a closer look${input.city ? ` near ${input.city}` : ""}.`
    );
  } else {
    paragraphs.push(input.title.trim());
  }

  if (paragraphs.length === 1) {
    paragraphs.push(
      "The listing has the latest hours and details — worth a quick check before you head out."
    );
  }

  return sanitizeReaderParagraphs(paragraphs);
}

/**
 * Natural singular noun for a kind of place, used when Foursquare hasn't
 * supplied its own (more specific) category name. Keep in sync with the
 * server's CATEGORY_LABEL in places/notes.ts — same categories, same voice.
 */
const PLACE_TYPE_LABEL: Partial<Record<DiscoveryCategory, string>> = {
  coffee: "coffee shop",
  restaurants: "restaurant",
  parks: "park",
  museums: "museum",
  books: "bookstore",
  scenic_drives: "scenic drive or lookout",
  experiences: "local spot",
  beaches: "beach",
  hiking: "trailhead",
  travel: "destination",
  activities: "local activity spot",
  bakeries: "bakery",
  gardens: "botanical garden",
};

function withIndefiniteArticle(noun: string): string {
  const trimmed = noun.trim();
  if (!trimmed) return trimmed;
  return /^[aeiou]/i.test(trimmed) ? `an ${trimmed}` : `a ${trimmed}`;
}

/**
 * The most specific honest label for what kind of place this is —
 * Foursquare's own category name when Kindred has it (e.g. "Café" or
 * "Italian Restaurant"), falling back to Kindred's broader category
 * bucket. Never invented; always traceable to a real field.
 */
function venueTypeLabel(
  venueCategories: string[] | null | undefined,
  category: DiscoveryCategory | string | null | undefined,
  title?: string | null
): string {
  return resolveVenueClassification({
    title,
    venueCategories,
    discoveryCategory: category,
  }).displayLabel;
}

function editorialBriefForVenueType(typeLabel: string): {
  who: string;
  howLong: string;
  tips: string;
  difficulty?: string;
  equipment?: string;
  bestSeason?: string;
  atmosphere?: string;
  photoTip?: string;
} {
  const t = typeLabel.toLowerCase();
  if (/dog park/.test(t)) {
    return {
      who: "Dog owners who want a real off-leash outing — and anyone who enjoys watching a park actually being used.",
      howLong: "Plan for 45–90 minutes, depending on how social your dog is.",
      tips: "Bring water, waste bags, and shade if it's warm. Mid-morning is usually calmer than late afternoon.",
      difficulty: "Easy — flat paths and open fields; no special fitness required.",
      equipment: "Leash for arrival and departure; water bowl if the park doesn't provide one.",
      bestSeason: "Spring and fall mornings are the most comfortable; summer visits belong early.",
      atmosphere: "Off-leash energy, owners chatting at the fence line, and the particular happiness of a tired dog on the drive home.",
      photoTip: "Action shots work best in the first hour — later light is kinder on faces than on fur in motion.",
    };
  }
  if (/escape room/.test(t)) {
    return {
      who: "Groups of two to six who like puzzles, a little pressure, and something to talk about afterward.",
      howLong: "Most rooms run 60 minutes — arrive a few minutes early for the briefing.",
      tips: "Book ahead on weekends. Split up to search the room; the first ten minutes matter.",
    };
  }
  if (/museum|history/.test(t)) {
    return {
      who: "Anyone curious about the place they live — especially visitors who want context, not just a photo stop.",
      howLong: "Allow 60–90 minutes for a first visit; longer if there's a special exhibit.",
      tips: "Check hours before you go. Weekday mornings tend to be the calmest time to look.",
    };
  }
  if (/restaurant|sushi|steakhouse/.test(t)) {
    return {
      who: "Anyone planning a meal worth leaving the house for — not just the nearest convenient option.",
      howLong: "Plan for a full sit-down visit; add time if you're going on a weekend.",
      tips: "Reservations help on Friday and Saturday. If the kitchen has a specialty, order that before anything safe.",
    };
  }
  if (/coffee/.test(t)) {
    return {
      who: "Morning people, remote workers, and anyone who measures a neighborhood by its coffee.",
      howLong: "Twenty minutes for a quick stop; longer if you're staying to read or meet someone.",
      tips: "Go earlier than feels necessary — the best pastries and quiet seats go first.",
    };
  }
  if (/observatory|planetarium|stargazing/.test(t)) {
    return {
      who: "Anyone curious about the night sky — families with older kids, date nights, and first-time stargazers.",
      howLong: "Plan for 60–90 minutes, especially if there's a scheduled viewing or talk.",
      tips: "Check the schedule for telescope viewing hours. Dress warmer than the daytime forecast suggests.",
    };
  }
  if (/winery|vineyard|wine bar|tasting/.test(t)) {
    return {
      who: "Anyone who wants a relaxed tasting afternoon — couples, small groups, and visitors who'd rather sit on a patio than rush a meal.",
      howLong: "Budget 90 minutes for a tasting flight and a slow walk through the room or patio.",
      tips: "Reserve tastings on weekends when you can. Eat something beforehand — this is wine, not a beach day.",
    };
  }
  if (/bowling/.test(t)) {
    return {
      who: "Friends, families, and anyone who wants an easy group activity without a complicated plan.",
      howLong: "Budget 60–90 minutes for a couple of games, including shoe rental and setup.",
      tips: "Book lanes ahead on Friday and Saturday. Closed-toe shoes are the right call — this is bowling, not kayaking.",
    };
  }
  if (/esports|gaming lounge|gaming center/.test(t)) {
    return {
      who: "Gamers, friend groups, and anyone who wants a few focused hours indoors without a complicated plan.",
      howLong: "Budget two to three hours if you are settling in for tournaments or open play.",
      tips: "Peak hours fill up on weekends — arrive a little early if you want your pick of stations.",
    };
  }
  if (/bowling|mini golf|arcade|climbing|axe|go-kart|kayak|paddle/.test(t)) {
    return {
      who: "Friends, families, and anyone who'd rather do something than scroll through options all afternoon.",
      howLong: "Budget 60–120 minutes, including setup and the inevitable rematch.",
      tips: "Book ahead when you can on weekends. Closed-toe shoes are almost always the right call.",
    };
  }
  if (/country club|golf/.test(t)) {
    return {
      who: "Golfers, members' guests, and anyone who wants a lake-and-fairway afternoon without a generic resort feel.",
      howLong: "A round or a meal is usually a half-day commitment — don't rush the parking lot.",
      tips: "Call ahead about guest policies and dress code. This is a club, not a public beach.",
    };
  }
  if (/park|garden|trail|hiking|beach/.test(t)) {
    return {
      who: "Anyone who needs an hour outside without a complicated plan.",
      howLong: "Plan for 45–90 minutes of unhurried time — longer if you're staying for sunset.",
      tips: "Sunscreen, water, and comfortable shoes. Weekday mornings are the quietest window.",
      difficulty: /hiking|trail/.test(t)
        ? "Moderate unless the listing notes a paved path — check distance before you commit."
        : "Easy to moderate — mostly walking, no special training required.",
      equipment: /hiking|trail/.test(t)
        ? "Sturdy shoes, water, and a light layer — trails cool down faster than parking lots."
        : "Comfortable shoes and water; a hat helps on open paths.",
      bestSeason: /beach/.test(t)
        ? "Late spring through early fall for warm water; winter walks have their own quiet charm."
        : "Spring and fall for color and comfort; summer belongs to early morning or golden hour.",
      atmosphere: /beach/.test(t)
        ? "Salt air, shifting light, and the particular patience required to enjoy a beach without rushing it."
        : "Birdsong, filtered light, and the rare feeling of time moving slower than your phone.",
      photoTip: "Golden hour flatters trails and water alike — midday sun is honest but unforgiving.",
    };
  }
  return {
    who: "Anyone who wants a local option that feels specific to the neighborhood — not another interchangeable stop.",
    howLong: "Plan for about an hour — enough to actually see the place, not just drive by.",
    tips: "Confirm hours before you go; local spots can shift schedules without much notice.",
    atmosphere: "The room or street has its own rhythm — worth noticing in the first five minutes before you order or sit down.",
  };
}

/**
 * Full piece for a verified local place (Foursquare) — leads with the
 * specific venue and every verified fact Kindred actually has (name,
 * kind of place, address/city), folds in Kindred's own grounded note,
 * then honestly widens into the category context the desk already
 * writes for this kind of place — reframed as "what to look for," not
 * a disconnected essay. Never claims a fact about this specific venue
 * Kindred doesn't have; the verified specifics are always kept distinct
 * from the general guidance that follows them.
 */
export function composePlaceDiscoveryArticle(input: {
  title: string;
  dek?: string | null;
  city?: string | null;
  address?: string | null;
  venueCategories?: string[] | null;
  sourceName?: string | null;
  category?: DiscoveryCategory | string | null;
  seedKey: string;
  editionDate?: string | null;
  knowledgeGrounding?: KnowledgeLookupResult | null;
}): {
  dek: string;
  body: string[];
  fieldAnswers: EditorialFieldAnswers;
} {
  const title = input.title.trim();
  const note = input.dek?.trim() || "";
  const city = input.city?.trim() || "";
  const address = sanitizeAddressForDisplay(input.address) || "";
  const verified = resolveVerifiedEditorialCategory({
    title,
    venueCategories: input.venueCategories,
    discoveryCategory: input.category,
    dek: note,
    address,
  });
  const typeLabel = verified.displayLabel;
  const brief = editorialBriefForVenueType(typeLabel);

  const placeLine = [title, city].filter(Boolean).join(" · ");
  const dek = placeLine || title;

  const locationPhrase = address ? `on ${address}` : city ? `in ${city}` : "";

  const opening = openingLineForPlace({
    title,
    typeLabel,
    city,
    note,
    locationPhrase: locationPhrase || null,
  });

  const scene = sceneLineForPlace(title, typeLabel, city);

  const whyVisit =
    note &&
    !containsEngineLanguage(note) &&
    !isNearDuplicateCopy(note, opening) &&
    !isNearDuplicateCopy(note, title)
      ? note
      : scene;

  const essay = getCategoryDiscoveryArticle(input.category, input.seedKey, {
    venueCategories: input.venueCategories,
  });

  const wikipediaBackground = discoveryBackgroundFromGrounding(
    input.knowledgeGrounding,
    title
  );

  let practicalTips =
    typeof essay?.fieldAnswers?.tips === "string" && essay.fieldAnswers.tips.trim()
      ? essay.fieldAnswers.tips
      : typeof essay?.fieldAnswers?.booking === "string" && essay.fieldAnswers.booking.trim()
        ? essay.fieldAnswers.booking
        : brief.tips;

  if (editorialCopyConflicts(verified.categoryId, practicalTips)) {
    practicalTips = brief.tips;
  }

  const varietySeed = buildVarietySeed(input.editionDate, input.seedKey || title);

  const closing = closingLineForPlace(title, city, input.seedKey, input.editionDate);

  const atmosphereParagraph =
    (typeof essay?.fieldAnswers?.atmosphere === "string" &&
      essay.fieldAnswers.atmosphere.trim() &&
      !editorialCopyConflicts(verified.categoryId, essay.fieldAnswers.atmosphere)
      ? essay.fieldAnswers.atmosphere.trim()
      : null) ||
    brief.atmosphere ||
    null;

  const highlightsParagraph =
    typeof essay?.fieldAnswers?.signature === "string" &&
    essay.fieldAnswers.signature.trim() &&
    !editorialCopyConflicts(verified.categoryId, essay.fieldAnswers.signature)
      ? `What regulars notice first: ${essay.fieldAnswers.signature.trim()}`
      : typeof essay?.fieldAnswers?.highlights === "string" &&
          essay.fieldAnswers.highlights.trim() &&
          !editorialCopyConflicts(verified.categoryId, essay.fieldAnswers.highlights)
        ? essay.fieldAnswers.highlights.trim()
        : null;

  const slots: DiscoveryVarietySlot[] = [
    { role: "opening", text: opening },
    ...(atmosphereParagraph && atmosphereParagraph !== opening
      ? [{ role: "atmosphere" as const, text: atmosphereParagraph }]
      : []),
    ...(whyVisit !== opening ? [{ role: "why" as const, text: whyVisit }] : []),
    ...(highlightsParagraph ? [{ role: "highlights" as const, text: highlightsParagraph }] : []),
    { role: "who", text: brief.who },
    { role: "howLong", text: brief.howLong },
    ...(brief.difficulty ? [{ role: "difficulty" as const, text: brief.difficulty }] : []),
    ...(brief.equipment ? [{ role: "equipment" as const, text: brief.equipment }] : []),
    ...(brief.bestSeason ? [{ role: "season" as const, text: brief.bestSeason }] : []),
    { role: "tips", text: practicalTips },
    ...(brief.photoTip ? [{ role: "photo" as const, text: brief.photoTip }] : []),
    ...(wikipediaBackground ? [{ role: "history" as const, text: wikipediaBackground }] : []),
    { role: "closing", text: closing },
  ];

  const rawBody = dedupeDiscoveryBody(orderDiscoverySlots(slots, varietySeed));

  const body = sanitizeEditorialParagraphs(verified.categoryId, rawBody);

  const safeFieldAnswers: EditorialFieldAnswers = {
    why_go: whyVisit,
    best_for: brief.who,
    how_long: brief.howLong,
    tips: practicalTips,
  };
  if (brief.difficulty) safeFieldAnswers.difficulty = brief.difficulty;
  if (brief.equipment) safeFieldAnswers.equipment = brief.equipment;
  if (brief.bestSeason) safeFieldAnswers.best_season = brief.bestSeason;
  if (atmosphereParagraph) safeFieldAnswers.atmosphere = atmosphereParagraph;
  if (brief.photoTip) safeFieldAnswers.photo_tip = brief.photoTip;
  if (wikipediaBackground) {
    safeFieldAnswers.background = wikipediaBackground;
  }
  if (essay?.fieldAnswers) {
    for (const [key, value] of Object.entries(essay.fieldAnswers)) {
      if (typeof value === "string" && editorialCopyConflicts(verified.categoryId, value)) {
        continue;
      }
      safeFieldAnswers[key] = value;
    }
  }

  const validated = validateEditorialArticle({
    categoryId: verified.categoryId,
    dek,
    body,
  });

  return {
    dek,
    body: validated.valid
      ? body
      : sanitizeReaderParagraphs([
          opening,
          brief.who,
          brief.howLong,
          practicalTips,
          closing,
        ]),
    fieldAnswers: safeFieldAnswers,
  };
}

/**
 * Match a discovery card back to the edition's real local_events data by
 * exact (normalized) name. localEventsAsDiscoveryItems() sets the
 * DiscoveryItem title to the event name verbatim, so this is a reliable,
 * cheap way to recover the verified fields (photo, venue, date, time,
 * grounded Bandit note) that get dropped when an event becomes a
 * discovery candidate — without touching the discovery engine itself.
 */
export function matchVerifiedLocalEvent(
  item: Pick<DiscoveryItem, "title">,
  events: LocalEventCard[] | null | undefined
): LocalEventCard | null {
  if (!events?.length) return null;
  const key = item.title.trim().toLowerCase();
  if (!key) return null;
  return events.find((e) => e.name.trim().toLowerCase() === key) ?? null;
}

export type VerifiedEventDiscoveryArticle = {
  dek: string;
  body: string[];
  contentType: ContentType;
  fieldAnswers: EditorialFieldAnswers;
};

/**
 * Build an honest article for a discovery card that matched a real,
 * verified local event. Every sentence traces back to a real field
 * (name, venue, city, date, time, the grounded Bandit note, or the
 * source listing) — nothing about atmosphere, menu, crowd, or parking is
 * claimed unless it's already present in that verified data.
 */
export function composeVerifiedEventDiscoveryArticle(
  event: LocalEventCard,
  options?: { editionDate?: string | null }
): VerifiedEventDiscoveryArticle {
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  const whenParts = [event.date, event.time].filter(
    (p) => p && !/TBA/i.test(p)
  );
  const whenLine = whenParts.join(" · ") || null;
  const hay = `${event.name} ${event.venue}`.toLowerCase();
  const isFestival = /festival|fair|parade|carnival/.test(hay);
  const body = composeEventArticleFromVerifiedData(event, options);

  return {
    dek: place || event.name.trim(),
    body,
    contentType: isFestival ? "festival" : "local_event",
    fieldAnswers: {
      when: whenLine,
      where: place || null,
      what_to_expect: body[1] ?? body[0] ?? null,
      tips: event.sourceUrl
        ? "Check the listing for the latest hours and any cost before you go."
        : null,
    },
  };
}

export type GenericDynamicDiscoveryArticle = {
  body: string[];
  fieldAnswers: EditorialFieldAnswers;
};

/**
 * Honest, calm brief for a discovery card with no curated piece and no
 * matching verified event — built strictly from title, category, dek,
 * why, and source. Never invents a specific place's atmosphere, menu,
 * or facts; frames itself honestly as a category idea, not a review.
 */
export function composeGenericDynamicDiscoveryArticle(input: {
  title: string;
  category: string;
  dek?: string | null;
  why?: string | null;
  sourceName?: string | null;
  city?: string | null;
}): GenericDynamicDiscoveryArticle {
  const title = input.title.trim();
  const dek = input.dek?.trim() || "";
  const why = input.why?.trim() || "";
  const categoryLabel = input.category.replace(/_/g, " ");

  const opening = dek && !containsEngineLanguage(dek) && !containsGenericAiPhrase(dek)
    ? dek
    : `${title} — worth a closer look when you have an hour to spare.`;

  const worthConsidering =
    why && !containsEngineLanguage(why) && !containsGenericAiPhrase(why) && !isNearDuplicateCopy(why, dek)
      ? why
      : `Worth considering if the idea appeals — a nudge in a direction, not a full itinerary.`;

  const whatToExpect = `This is a ${categoryLabel} idea worth seeking out nearby — treat it as inspiration, then find the version closest to you.`;

  const who =
    "Best when you want a suggestion with room to explore, rather than a fixed plan.";

  const goodToKnow = input.city
    ? `Start near ${input.city} and see what is open when you are — hours and seasons change.`
    : "See what is open nearby when you are — hours and seasons change.";

  return {
    body: sanitizeReaderParagraphs(
      dedupeDiscoveryBody(
        [opening, worthConsidering, whatToExpect, who, goodToKnow].filter(
          (p): p is string => Boolean(p)
        )
      )
    ),
    fieldAnswers: {},
  };
}

function dedupeDiscoveryBody(body: string[]): string[] {
  const out: string[] = [];
  for (const paragraph of body) {
    const cleaned = paragraph.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    if (out.some((prev) => isNearDuplicateCopy(prev, cleaned))) continue;
    out.push(cleaned);
  }
  return out;
}

export type { DiscoveryItem };
