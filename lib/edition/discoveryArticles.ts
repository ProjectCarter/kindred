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
import type { DiscoveryItem } from "./discovery";
import type { LocalEventCard } from "./localEvents";

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

  if (dek) {
    paragraphs.push(dek);
  } else if (input.city) {
    paragraphs.push(`A recommendation worth a closer look, near ${input.city}.`);
  } else {
    paragraphs.push(input.title.trim());
  }

  if (why && why.toLowerCase() !== dek.toLowerCase()) {
    paragraphs.push(why);
  }

  paragraphs.push(
    "Kindred flagged this one for today's paper. Worth a look before the day fills in."
  );

  return paragraphs;
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
  event: LocalEventCard
): VerifiedEventDiscoveryArticle {
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  const whenParts = [event.date, event.time].filter(
    (p) => p && !/TBA/i.test(p)
  );
  const whenLine = whenParts.join(" · ") || null;
  const banditNote = event.banditNote?.trim() || null;
  const hay = `${event.name} ${event.venue}`.toLowerCase();
  const isFestival = /festival|fair|parade|carnival/.test(hay);

  const opening =
    banditNote ||
    `${event.name.trim()} is on${whenLine ? `, ${whenLine}` : ""}${
      place ? ` at ${place}` : ""
    } — a real, nearby happening rather than a generic suggestion.`;

  const whyItMadeTheNotebook = isFestival
    ? "Festivals like this are where a town actually shows up for itself. It earned a place in the notebook because it's real and it's close, not because it's the kind of thing that photographs well."
    : "It earned a place in the notebook for a simple reason: it's a real, nearby happening, not a category suggestion. That's rarer than it sounds.";

  const whatToExpect = whenLine
    ? `Here's what Kindred can actually verify: it's on ${whenLine}${
        place ? `, at ${place}` : ""
      }. Kindred doesn't yet have independently confirmed detail on the atmosphere, the crowd, or exactly what's on offer beyond that — worth a look at the original listing before building the whole outing around it.`
    : `Kindred has the name and a general sense of where, but the exact timing wasn't in the listing — worth confirming directly before you head out.`;

  const who =
    "This suits someone who likes knowing about a local happening while it's still upcoming, more than someone who needs every detail nailed down first.";

  const goodToKnow = event.sourceUrl
    ? "Good to know: schedules for local happenings can shift close to the date. The source listing linked below is the most current word on hours and any cost."
    : "Good to know: schedules for local happenings can shift close to the date — a quick check before you leave is worth it.";

  const body = [
    opening,
    whyItMadeTheNotebook,
    whatToExpect,
    who,
    goodToKnow,
  ].filter(Boolean);

  return {
    dek: place || event.name.trim(),
    body,
    contentType: isFestival ? "festival" : "local_event",
    fieldAnswers: {
      when: whenLine,
      where: place || null,
      what_to_expect: banditNote,
      tips: event.sourceUrl
        ? "Check the listing for the latest hours and any cost before you go."
        : "Details can shift close to the date — a quick check beforehand is worth it.",
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

  const opening = dek || `${title} — an idea from today's notebook.`;

  const worthConsidering =
    why && why.toLowerCase() !== dek.toLowerCase()
      ? why
      : `It made today's notebook on editorial judgment, not a trending list — worth a look if the idea appeals to you.`;

  const whatToExpect = `Kindred doesn't have a specific, verified place attached to this one yet — it's a category recommendation (the kind of ${categoryLabel} experience worth seeking out) rather than a confirmed listing, so treat it as a nudge rather than a review of one exact address.`;

  const who =
    "Good for anyone who likes a nudge in a direction, and is happy to find the specific version of it nearby.";

  const goodToKnow = input.sourceName
    ? `Good to know: this idea is credited to ${input.sourceName} — worth searching nearby to find a real version of it close to you.`
    : `Good to know: this is a general idea rather than a specific verified place — worth searching nearby to find a real version of it.`;

  return {
    body: [opening, worthConsidering, whatToExpect, who, goodToKnow],
    fieldAnswers: {},
  };
}

export type { DiscoveryItem };
