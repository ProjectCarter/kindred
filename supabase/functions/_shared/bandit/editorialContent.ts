/**
 * Bandit's Pick editorial features — headline, card excerpt, full story, desk modules.
 * Headlines are newspaper-style; whispers rotate separately in selectPick.ts.
 */

import {
  HORIZON_BUCKET_LABEL,
  type EventHorizonBucket,
} from "../localEvents/horizon.ts";

export type BanditEditorialModule = {
  id: string;
  label: string;
  body: string;
};

export type BanditSeasonalEditorial = {
  headline: string;
  /** Card dek — never the whisper. */
  cardExcerpt: string;
  body: string[];
  modules: BanditEditorialModule[];
  closingNote: string;
  mapsQuery: string;
  actionLabel: string;
};

export const CLOSING_NOTE_POOL = [
  "I have a feeling you'll be glad you didn't miss this one.",
  "Some things are only beautiful because they don't last.",
  "I'll keep looking. See you tomorrow.",
];

export const BANDIT_SEASONAL_EDITORIAL: Record<string, BanditSeasonalEditorial> = {
  blueberry_season: {
    headline: "Blueberry Season",
    cardExcerpt:
      "Blueberry season only lasts a few weeks each summer before farms close their fields for the year.",
    body: [
      "Early mornings are cooler, baskets fill quickly, and many local farms also offer homemade pies, fresh jam, lemonade, and simple family activities along the rows.",
      "Midweek tends to be the sweet spot — fields are fuller after the weekend rush, and the fruit hasn't yet softened in the afternoon heat.",
      "If you've never picked blueberries straight from the bush, this is one of those quiet traditions worth doing at least once. Sticky fingers, sun on your shoulders, a bag that somehow weighs more on the walk back to the car.",
      "Most farms post daily field conditions online. A quick check before you leave saves a wasted drive when a row has been picked clean for the day.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Early morning, midweek. Fields reopen at first light and the fruit is firmest before the heat of the afternoon.",
      },
      {
        id: "why_special",
        label: "Why It's Special",
        body: "A short window, a real harvest, and a morning that feels unhurried — the kind of errand that becomes a memory.",
      },
      {
        id: "good_to_know",
        label: "Good To Know",
        body: "Wear a hat, bring water, and check whether the farm accepts cash only or requires reservations on busy weekends.",
      },
      {
        id: "families",
        label: "Perfect For Families",
        body: "Low rows, easy picking, and plenty of room for kids to treat it like a treasure hunt.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[0],
    mapsQuery: "u-pick blueberry farms",
    actionLabel: "Find nearby farms",
  },

  peach_season: {
    headline: "Peach Season Is Here",
    cardExcerpt:
      "Tree-ripened peaches arrive for only a few weeks — softer, sweeter, and gone before you realize you should have bought another bag.",
    body: [
      "Roadside stands and orchard shops fill with fruit that actually smells like summer. This is not the hard supermarket peach; it bruises easily and rewards you for eating it the same day.",
      "Orchards often sell by the basket, with seconds priced for jam and pies. Ask what's ripe today — varieties turn over fast, and the best flavor is rarely the prettiest fruit on the table.",
      "A short drive to a farm stand can feel like a small vacation: shade under tin roofs, handwritten signs, and the polite urgency of produce that will not wait for your schedule.",
      "Freeze what you can't eat, or slice them over yogurt that night. Peach season teaches a simple lesson — enjoy it now, while the bins are full.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Late morning on a weekday, before stands sell out and before the afternoon heat softens the fruit in the sun.",
      },
      {
        id: "why_now",
        label: "Why Now",
        body: "Peak ripeness is measured in days, not months. A good week can disappear with one heavy rain.",
      },
      {
        id: "take_home",
        label: "Take Home",
        body: "A flat of seconds for jam, a few perfect specimens for eating out of hand, and whatever cobbler recipe you've been saving.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[1],
    mapsQuery: "peach orchards farm stands",
    actionLabel: "Find local peach orchards",
  },

  firefly_season: {
    headline: "Firefly Evenings",
    cardExcerpt:
      "For a few warm weeks each summer, fireflies return at dusk — a small, fleeting light show that rewards anyone willing to slow down after dinner.",
    body: [
      "They prefer edges: meadows beside woods, unlit paths, backyards where the porch light stays off. The display is never guaranteed, but when it arrives, the whole evening changes.",
      "Children remember these nights longer than most vacations. Adults remember them too, if they put the phone down long enough to watch.",
      "The window is narrow — humidity, temperature, and moonlight all matter. A still, warm evening after a rain shower is often your best chance.",
      "You do not need a destination, only a willingness to walk slowly and let your eyes adjust to the dark.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Thirty minutes after sunset, before the night grows too cool. Late June through mid-July in most regions.",
      },
      {
        id: "good_to_know",
        label: "Good To Know",
        body: "Dim your lights, skip insect spray near the gathering spot, and stay on paths — fireflies need undisturbed ground cover.",
      },
      {
        id: "families",
        label: "Perfect For Families",
        body: "A late bedtime worth granting once — quiet wonder without a ticket or a line.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[0],
    mapsQuery: "nature parks meadows",
    actionLabel: "Find a quiet park nearby",
  },

  wildflower_bloom: {
    headline: "Wildflowers Are Peaking",
    cardExcerpt:
      "Meadows and roadside hillsides reach their brief peak — a week or two of color before heat, wind, or the next mowing takes them back.",
    body: [
      "Wildflower season is not a single event but a moving front: first the low fields, then the slopes, then the late-summer stands of gold and purple along country roads.",
      "The best viewing is often free and unmarked — a pull-off you haven't used before, a trail segment that suddenly opens into open grass.",
      "Photographs help, but this is really a see-it-with-your-own-eyes season. Petals change daily; a hillside that blazes on Tuesday can look tired by Sunday.",
      "Go gently. Stay on paths where they exist, and leave the blooms for the next walker — these displays survive only when people treat them as borrowed scenery.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Early morning light, midweek, before weekend foot traffic compacts trails along popular overlooks.",
      },
      {
        id: "why_special",
        label: "Why It's Special",
        body: "No admission gate, no schedule — just a landscape doing something beautiful on its own timetable.",
      },
      {
        id: "worth_drive",
        label: "Worth The Drive",
        body: "If a regional bloom report mentions your county, a forty-minute detour often beats waiting another year.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[1],
    mapsQuery: "wildflower trails meadows",
    actionLabel: "See nearby wildflowers",
  },

  strawberry_season: {
    headline: "Strawberry Season",
    cardExcerpt:
      "Strawberry fields hit their stride for a short stretch each spring and early summer — the fruit is small, bright, and best the day it's picked.",
    body: [
      "U-pick rows are the classic version of this season: kneel in straw, fill a flat, eat one for quality control. Farm shops sell what the field produced that morning — not last week's shipment.",
      "Rain shifts the calendar overnight. A wet week can delay ripening; a hot spell can compress the entire season into ten urgent days.",
      "Shortcake, jam, or eaten straight from the carton on the passenger seat — strawberries rarely survive long enough to become a pantry project.",
      "Call ahead or check social pages for field openings. Many farms close rows when picked out, then reopen two days later with a fresh flush.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Weekday mornings, before heat wilts the fruit and before weekend crowds empty the best rows.",
      },
      {
        id: "take_home",
        label: "Take Home",
        body: "A flat for freezing, a pint for tonight, and a jar of farm jam if they sell their own.",
      },
      {
        id: "families",
        label: "Perfect For Families",
        body: "Low stakes, quick rewards, and a tangible result kids can carry to the car.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[0],
    mapsQuery: "u-pick strawberry farms",
    actionLabel: "Find nearby strawberry fields",
  },

  pumpkin_patches: {
    headline: "Pumpkin Patch Weekend",
    cardExcerpt:
      "Pumpkin patches open for a narrow autumn window — hayrides, corn mazes, and the satisfying work of choosing the right gourd before the first hard frost.",
    body: [
      "The best patches feel like a small country fair: muddy boots, apple cider, and children negotiating for a pumpkin larger than they can carry.",
      "Go earlier in the month for the best selection; go later if you prefer character — knobby, warty, and gloriously imperfect.",
      "Many farms bundle the visit with apple bins, fresh donuts, and photo spots that justify the drive even if you only leave with one modest pumpkin.",
      "Weekends fill quickly. A Friday afternoon visit often means shorter lines and a calmer walk through the rows.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Late September through mid-October, preferably before the Halloween crush on the final two weekends.",
      },
      {
        id: "families",
        label: "Perfect For Families",
        body: "Hayrides, petting areas, and the rare outing where tired kids still call it a good day.",
      },
      {
        id: "good_to_know",
        label: "Good To Know",
        body: "Bring cash for small vendors, wear shoes you don't mind getting muddy, and check whether tickets are timed-entry.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[0],
    mapsQuery: "pumpkin patches farms",
    actionLabel: "Find nearby pumpkin patches",
  },

  monsoon_evenings: {
    headline: "Monsoon Evening Skies",
    cardExcerpt:
      "Summer monsoon storms build most evenings in July and August — dramatic clouds, golden light, and sunsets locals actually pull over to watch.",
    body: [
      "The show usually starts with building clouds on the horizon, then a shift in the light that turns ordinary neighborhoods cinematic for twenty minutes.",
      "You do not need a ticket or a reservation — just a clear view west, a little patience, and the willingness to step outside when the sky begins to change.",
      "The best evenings feel unrepeatable: a burst of wind, a pause, then color rolling across the undersides of the clouds.",
      "Conditions change night to night. The locals' habit is simple — when the clouds stack up, grab your keys and find an open view.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Early evening through sunset, especially on days when storms build to the west and the humidity climbs.",
      },
      {
        id: "why_special",
        label: "Why It's Special",
        body: "A short desert-season ritual — dramatic skies that only appear for a few weeks each summer.",
      },
      {
        id: "good_to_know",
        label: "Good To Know",
        body: "Watch the weather radar, keep distance from active lightning, and never chase storms into open fields.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[1],
    mapsQuery: "scenic overlook sunset",
    actionLabel: "Find a viewpoint nearby",
  },

  meteor_showers: {
    headline: "The Perseids",
    cardExcerpt:
      "The Perseid meteor shower reaches its brief peak in mid-August — one of the year's best chances to watch falling stars without equipment or expertise.",
    body: [
      "You need darkness more than anything else: a spot away from porch lights and parking lots, a blanket, and patience for your eyes to adjust.",
      "Activity builds after midnight, when the sky is fully dark and the shower's radiant climbs higher. A reclining chair beats craning your neck from a camp stool.",
      "Meteors are unpredictable by nature — bursts of three in a minute, then quiet. The pleasure is in the waiting, the cool air, and the small gasp when a bright streak finally appears.",
      "Check the local forecast for cloud cover, and give yourself at least thirty minutes. Most people leave too early and miss the best hour.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "After midnight, mid-August, on a clear night with low humidity and minimal moonlight.",
      },
      {
        id: "what_to_bring",
        label: "What To Bring",
        body: "A blanket, a light jacket, insect repellent, and a thermos — comfort keeps you under the sky longer.",
      },
      {
        id: "worth_drive",
        label: "Worth The Drive",
        body: "Even thirty minutes beyond the city glow can double what you're able to see.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[1],
    mapsQuery: "dark sky parks observatories",
    actionLabel: "Find a dark-sky spot nearby",
  },

  apple_picking: {
    headline: "Apple Picking Season",
    cardExcerpt:
      "Orchards open for a few golden weeks each fall — ladders, wooden bins, and the particular satisfaction of choosing apples still warm from the sun.",
    body: [
      "Early varieties lead the season; later ones hang through crisp October weekends. Ask which block is open — farms rotate picking areas to protect the trees.",
      "The experience is as much about the walk between rows as the fruit itself: cider on draft, bees in the grass, and the thunk of apples landing in your bag.",
      "Bring home more than you think you need. Pies, sauce, and desk snacks disappear faster than the orchard's closing time suggests.",
      "Dress for mud and changing weather. The best picking days are often slightly overcast — cool for climbing, kind to the fruit.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Weekday mornings in late September and early October, before buses arrive and before the best branches are picked clean.",
      },
      {
        id: "take_home",
        label: "Take Home",
        body: "A mixed bag for eating, a sack of baking apples, and cider if the farm presses their own.",
      },
      {
        id: "families",
        label: "Perfect For Families",
        body: "Safe, scenic, and productive — kids leave with something they picked themselves.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[0],
    mapsQuery: "apple orchards u-pick",
    actionLabel: "Find nearby apple orchards",
  },

  butterfly_season: {
    headline: "Butterfly Migration",
    cardExcerpt:
      "Late summer and early fall bring migrating butterflies through gardens, meadows, and coastal corridors — a quiet spectacle easy to miss if you're not watching.",
    body: [
      "Monarchs and their cousins follow routes older than the highways that now cross them. A single butterfly bush in bloom can hold a dozen visitors at once.",
      "The migration is not one day but a season of passages — check local botanical gardens and wildlife refuges for peak counts and tagged releases.",
      "Photography is rewarding; stillness is better. Sit on a bench near nectar flowers and let the show come to you.",
      "Plantings matter. Late-blooming asters and goldenrod often host the last concentrated gatherings before cold nights end the flight.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Sunny mid-mornings in September, when butterflies warm their wings and feed before afternoon wind picks up.",
      },
      {
        id: "why_special",
        label: "Why It's Special",
        body: "A long journey compressed into something you can witness from a garden path — fragile, deliberate, and brief.",
      },
      {
        id: "local_tip",
        label: "Local Tip",
        body: "Botanical gardens and native-plant preserves often post weekly counts during peak migration.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[1],
    mapsQuery: "butterfly gardens botanical gardens",
    actionLabel: "Find butterfly gardens nearby",
  },

  cherry_blossoms: {
    headline: "Cherry Blossom Season",
    cardExcerpt:
      "Cherry and ornamental fruit trees bloom for a handful of days — a pale, brief canopy that turns an ordinary street into something people drive across town to see.",
    body: [
      "Peak bloom is a moving target. Warm days accelerate it; wind strips petals overnight. The most reliable plan is to go at the first credible report, not the perfect one.",
      "Early morning offers the best light and thinnest crowds. A single block of trees in an older neighborhood can rival the famous plantings if you know where to look.",
      "Treat it as a walk, not a photo assignment. The scent is faint, the color delicate, and the mood unmistakably spring.",
      "Petals fall like slow snow. The ground afterward is as beautiful as the branches — another reason not to wait for next weekend.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Dawn to mid-morning, midweek, at the first local peak-bloom report.",
      },
      {
        id: "dont_miss",
        label: "Don't Miss",
        body: "The day after full bloom, when petals begin to fall — often the most photogenic and least crowded hour.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[1],
    mapsQuery: "cherry blossom trees parks",
    actionLabel: "Find blossom walks nearby",
  },

  lavender_bloom: {
    headline: "Lavender Season",
    cardExcerpt:
      "Lavender fields reach their purple peak for a short summer window — fragrance, bees, and rows that look borrowed from another country entirely.",
    body: [
      "Harvest timing is everything. Cut too early and the color is pale; wait too long and the oil peaks while the visual drama fades.",
      "Small farms often sell bundles, sachets, and honey on honor tables at the field edge. Larger ones add cafes and shaded benches worth the admission.",
      "Midday sun strengthens the scent but also brings heat. Late afternoon visits trade harsh light for softer photographs and cooler air.",
      "This is a season that rewards the detour. Even a small planting beside a country road can feel like an occasion if you stop the car.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Late June through early July, preferably late afternoon on a clear day.",
      },
      {
        id: "take_home",
        label: "Take Home",
        body: "Fresh bundles dry well, and farm honey makes an easy gift.",
      },
      {
        id: "worth_drive",
        label: "Worth The Drive",
        body: "Regional lavender farms are often rural — plan for a slow afternoon, not a quick stop.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[0],
    mapsQuery: "lavender farms",
    actionLabel: "Find lavender farms nearby",
  },

  sunflower_bloom: {
    headline: "Sunflower Season",
    cardExcerpt:
      "Sunflower fields turn gold for a brief late-summer act — tall heads tracking the sun, bees at work, and rows that make an ordinary afternoon feel cinematic.",
    body: [
      "Farmers plant in waves so the bloom doesn't arrive all at once. Social posts from the field are often more current than any calendar.",
      "Stay on paths when farms provide them — plants bruise easily, and these fields are someone's crop, not just a backdrop.",
      "Early morning and late afternoon light flatter the flowers and spare you the harshest heat of midday.",
      "Many farms sell bouquets at the gate. One bundle on the kitchen table extends the visit by a week.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Golden hour — first light or two hours before sunset — when the heads catch low sun.",
      },
      {
        id: "good_to_know",
        label: "Good To Know",
        body: "Wear closed shoes, bring water, and respect posted hours — some fields close once petals begin to drop.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[1],
    mapsQuery: "sunflower fields farms",
    actionLabel: "Find sunflower fields nearby",
  },

  holiday_market: {
    headline: "Holiday Market Season",
    cardExcerpt:
      "Outdoor holiday markets open for a limited run each December — handmade gifts, warm drinks, and the rare pleasure of buying something from the person who made it.",
    body: [
      "The best markets feel like a village square transplanted in time: lights, music, and stalls small enough to talk to every vendor before your coffee cools.",
      "Weekday evenings are underrated — fewer strollers, easier parking, and a calmer chance to browse without bumping elbows.",
      "Go with a short list but leave room for the unexpected: a jam you didn't know you needed, an ornament for next year's tree, a bottle of something local for the host.",
      "These markets close for the year without ceremony. When the tents come down, the same squares return to ordinary winter — which is exactly why they're worth an evening now.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "Weeknight openings in early December, before the final pre-Christmas crush.",
      },
      {
        id: "dont_miss",
        label: "Don't Miss",
        body: "The small makers' tables — often the best finds are not on the main aisle.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[2],
    mapsQuery: "holiday Christmas markets",
    actionLabel: "Explore holiday markets",
  },

  christmas_lights: {
    headline: "Holiday Lights Begin Tonight",
    cardExcerpt:
      "Neighborhood light displays and downtown installations switch on for a short winter season — free evenings of color worth a slow walk after dark.",
    body: [
      "The first week after lights go up carries a particular excitement — families still adjusting timers, new displays being fine-tuned, hot chocolate stands finding their rhythm.",
      "You don't need a famous address. A loop through older neighborhoods often reveals competing yards done with stubborn pride and extension cords buried in snow.",
      "Dress warmer than you think. Standing still to watch a tree fade from red to gold pulls heat from your feet faster than a winter hike.",
      "These displays disappear in January without announcement. The modest ritual of an after-dinner walk is the whole point.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "After 6 p.m., Sunday through Thursday, when sidewalks are quieter and parking is easier.",
      },
      {
        id: "families",
        label: "Perfect For Families",
        body: "Low cost, high wonder — especially with thermoses and a route short enough for small legs.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[2],
    mapsQuery: "holiday light displays",
    actionLabel: "Find holiday light displays",
  },
};

/** Fallback editorial for moments without a full feature yet. */
export function fallbackSeasonalEditorial(
  momentId: string,
  title: string
): BanditSeasonalEditorial {
  const clean = title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F?\u200D?]+\s*/u, "").trim();
  const headline = clean || title;
  return {
    headline,
    cardExcerpt: `${headline} arrives for a short window each year — easy to postpone, harder to catch once it passes.`,
    body: [
      `This is one of those seasonal rhythms that doesn't announce itself loudly. ${headline} simply appears, peaks, and leaves while everyone is still meaning to get around to it.`,
      "Locals often learn the timing by repetition — a stand that opens, a field that fills, a neighborhood that quietly does something beautiful for two weeks and then stops.",
      "The practical advice is simple: go sooner than feels necessary. These moments rarely improve with delay.",
      "If you have been waiting for the right weekend, this is the nudge to take the ordinary version — a weekday hour, a short drive, an early start.",
    ],
    modules: [
      {
        id: "best_time",
        label: "Best Time",
        body: "This month, before the season turns or the crowds arrive.",
      },
      {
        id: "why_now",
        label: "Why Now",
        body: "Seasonal windows do not slide — they open, peak, and close on their own calendar.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[2],
    mapsQuery: headline.toLowerCase(),
    actionLabel: "Explore nearby",
  };
}

export function getBanditSeasonalEditorial(momentId: string, title: string): BanditSeasonalEditorial {
  return BANDIT_SEASONAL_EDITORIAL[momentId] ?? fallbackSeasonalEditorial(momentId, title);
}

function eventPlanningExcerpt(
  headline: string,
  venue: string | undefined,
  bucket: EventHorizonBucket | null | undefined
): string {
  const place = venue ? ` at ${venue}` : "";
  switch (bucket) {
    case "today":
      return `${headline}${place} is on today's calendar — a local gathering worth making room for.`;
    case "this_weekend":
      return `${headline}${place} lands this weekend — worth blocking a little time before the week fills up.`;
    case "next_weekend":
      return `${headline}${place} is coming up next weekend — the kind of date worth saving now.`;
    case "coming_soon":
      return `${headline}${place} is on the calendar this month — easy to postpone, harder to catch once it passes.`;
    default:
      return venue
        ? `${headline} at ${venue} is on the calendar for a limited run — the kind of local gathering that disappears as quietly as it arrived.`
        : `${headline} is on the calendar this month — a local moment worth planning for while it is still there.`;
  }
}

function eventWhyNowModule(bucket: EventHorizonBucket | null | undefined): string {
  if (bucket && bucket !== "beyond") {
    const label = HORIZON_BUCKET_LABEL[bucket];
    if (bucket === "coming_soon") {
      return "On the calendar this month — worth planning for before the date slips past.";
    }
    return `${label} — worth putting on the calendar before the week fills up.`;
  }
  return "On the calendar this month — the date moves faster than most of us plan.";
}

export function composeEventEditorial(event: {
  name: string;
  venue?: string | null;
  banditNote?: string | null;
  horizonBucket?: EventHorizonBucket | null;
  startDateIso?: string | null;
}): BanditSeasonalEditorial {
  const headline = event.name.replace(/\s+[—–|-]\s+[^—–|-]+$/, "").trim();
  const venue = event.venue?.trim();
  const note = event.banditNote?.trim();
  return {
    headline,
    cardExcerpt: eventPlanningExcerpt(headline, venue, event.horizonBucket),
    body: [
      note
        ? note
        : `${headline} is exactly the sort of thing Kindred watches for: specific, timely, and unlikely to still be there when you finally get around to it.`,
      venue
        ? `The setting matters — ${venue} gives the event a sense of place that a generic listing never quite captures.`
        : "Check the official listing for hours and any last-minute schedule changes before you head out.",
      "Arrive a little early if you dislike crowds; stay a little late if you like the quieter second act when families head home.",
      "These events rarely feel life-changing on paper. They often feel exactly right in person — an evening out that becomes the story you tell at breakfast.",
    ],
    modules: [
      {
        id: "why_now",
        label: "Why Now",
        body: eventWhyNowModule(event.horizonBucket),
      },
      {
        id: "good_to_know",
        label: "Good To Know",
        body: "Confirm hours, parking, and whether tickets are required at the door.",
      },
    ],
    closingNote: CLOSING_NOTE_POOL[0],
    mapsQuery: venue ? `${headline} ${venue}` : headline,
    actionLabel: venue ? "Open in Maps" : "Find event details",
  };
}

export function pickClosingNote(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) {
    n = (n + seed.charCodeAt(i) * (i + 3)) % CLOSING_NOTE_POOL.length;
  }
  return CLOSING_NOTE_POOL[n];
}
