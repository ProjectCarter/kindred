/**
 * Template registry — one desk per content type.
 * Fields are questions readers naturally ask; answers must be prose.
 */

import type { ContentTemplate, ContentType } from "./types";

function t(
  partial: ContentTemplate
): ContentTemplate {
  return partial;
}

export const CONTENT_TEMPLATES: Record<ContentType, ContentTemplate> = {
  news: t({
    type: "news",
    categoryLabel: "News",
    personality: "Authoritative wire desk — clear stakes, careful context.",
    storyBeats: [
      "Open on the fact that changes the day",
      "Who is affected, and how",
      "What happens next",
    ],
    fields: [
      { id: "why_now", label: "Why it matters today", answers: "Why this story earns the paper now" },
      { id: "who_affected", label: "Who is affected", answers: "People, places, or systems in the frame" },
      { id: "what_next", label: "What comes next", answers: "Near-term developments to watch" },
      { id: "context", label: "Context", answers: "The short background a careful reader needs" },
    ],
  }),

  local_news: t({
    type: "local_news",
    categoryLabel: "Local",
    personality: "Neighborhood paper — specific streets, real consequences.",
    storyBeats: [
      "Name the place",
      "What changed for people who live there",
      "Where to learn more locally",
    ],
    fields: [
      { id: "background", label: "BACKGROUND", answers: "Historical context and verified timeline" },
      { id: "why_it_matters", label: "WHY IT MATTERS", answers: "Who is affected and why readers should care" },
      { id: "looking_ahead", label: "LOOKING AHEAD", answers: "What to expect next — or that updates are expected" },
    ],
  }),

  science: t({
    type: "science",
    categoryLabel: "Science",
    personality: "Curious science desk — wonder first, method second.",
    storyBeats: [
      "A concrete scene or finding",
      "What scientists learned",
      "Why a non-specialist should care",
    ],
    fields: [
      { id: "the_finding", label: "The finding", answers: "The result in plain language" },
      { id: "how_we_know", label: "How we know", answers: "Method, study, or evidence — briefly" },
      { id: "why_it_matters", label: "Why it matters", answers: "Human or planetary stake" },
      { id: "open_questions", label: "Still unknown", answers: "What researchers still need" },
    ],
  }),

  history: t({
    type: "history",
    categoryLabel: "History",
    personality: "Quiet archive desk — then and now in the same breath.",
    storyBeats: [
      "The moment in time",
      "Why it echoes today",
      "One detail worth remembering",
    ],
    fields: [
      { id: "then", label: "Then", answers: "What happened, when, and where" },
      { id: "why_remember", label: "Why we remember", answers: "The lasting significance" },
      { id: "echo_today", label: "Echoes today", answers: "How the past shows up now" },
      { id: "if_you_go", label: "If you want to go deeper", answers: "A place, book, or exhibit — when real" },
    ],
  }),

  local_event: t({
    type: "local_event",
    categoryLabel: "Local Event",
    personality: "Energetic listings desk — leave the house for this.",
    storyBeats: [
      "What the evening or afternoon feels like",
      "Who it is for",
      "The one reason to rearrange your plans",
    ],
    fields: [
      { id: "when", label: "When", answers: "Date and time, plainly" },
      { id: "where", label: "Where", answers: "Venue and neighborhood" },
      { id: "what_to_expect", label: "What to expect", answers: "The shape of the experience" },
      { id: "cost", label: "Cost", answers: "Ticket, donation, or free" },
      { id: "parking", label: "Getting there", answers: "Parking, transit, walkability" },
      { id: "tips", label: "A tip from the desk", answers: "One practical kindness" },
    ],
  }),

  festival: t({
    type: "festival",
    categoryLabel: "Festival",
    personality: "Festival desk — crowd, color, and a plan.",
    storyBeats: [
      "The spirit of the day",
      "What not to miss",
      "How to enjoy it without fighting the throng",
    ],
    fields: [
      { id: "what_to_expect", label: "What to expect", answers: "Atmosphere and headline acts or themes" },
      { id: "food", label: "Food", answers: "What is worth eating on site" },
      { id: "music", label: "Music & stages", answers: "Sound, lineup notes, or quiet corners" },
      { id: "parking", label: "Parking & arrival", answers: "How to arrive without misery" },
      { id: "family", label: "Family friendly", answers: "Whether kids will have a good day" },
      { id: "cost", label: "Cost", answers: "Entry, rides, food budget" },
      { id: "schedule", label: "Schedule", answers: "Hours and can’t-miss windows" },
      { id: "tips", label: "Festival tips", answers: "Shade, water, timing, exits" },
    ],
  }),

  restaurant: t({
    type: "restaurant",
    categoryLabel: "Table",
    personality: "Restaurant critic as friend — appetite and honesty.",
    storyBeats: [
      "Walk in and feel the room",
      "What to order first",
      "Who this table is for",
    ],
    fields: [
      { id: "signature", label: "Signature dishes", answers: "What the kitchen does best" },
      { id: "price", label: "Price range", answers: "Honest sense of the check" },
      { id: "reservations", label: "Reservations", answers: "Walk-in, book ahead, or bar seats" },
      { id: "ambience", label: "Ambience", answers: "Noise, light, occasion" },
      { id: "dietary", label: "Dietary options", answers: "Vegetarian, vegan, allergies — when known" },
      { id: "best_time", label: "Best time", answers: "When the room is at its best" },
      { id: "nearby", label: "Nearby", answers: "A drink or stroll after" },
    ],
  }),

  coffee: t({
    type: "coffee",
    categoryLabel: "Coffee",
    personality: "Café desk — steam, light, and somewhere to sit.",
    storyBeats: [
      "The first impression at the door",
      "What is in the cup",
      "Whether you will stay",
    ],
    fields: [
      { id: "atmosphere", label: "Atmosphere", answers: "Light, noise, pace of the room" },
      { id: "signature_drinks", label: "Signature drinks", answers: "What to order without overthinking" },
      { id: "seating", label: "Seating", answers: "Laptops welcome or conversation only" },
      { id: "patio", label: "Outdoor patio", answers: "Shade, heat, people-watching" },
      { id: "wifi", label: "Wi-Fi", answers: "Whether work is realistic" },
      { id: "locals_order", label: "What locals order", answers: "The regular’s habit" },
      { id: "best_time", label: "Best time to visit", answers: "Morning hush or afternoon hum" },
      { id: "nearby", label: "Nearby", answers: "A bookstore, walk, or second stop" },
    ],
  }),

  bakery: t({
    type: "bakery",
    categoryLabel: "Bakery",
    personality: "Pastry desk — butter, timing, and the morning line.",
    storyBeats: [
      "What draws people to the door",
      "What to take home",
      "When to arrive",
    ],
    fields: [
      { id: "signature", label: "Signature bakes", answers: "The pastries or breads that define the place" },
      { id: "atmosphere", label: "Atmosphere", answers: "Counter energy and seating, if any" },
      { id: "best_time", label: "Best time", answers: "Before sell-out or the quiet hour" },
      { id: "coffee", label: "Coffee", answers: "Whether the cup matches the crumb" },
      { id: "seating", label: "Seating", answers: "Stay or takeaway" },
      { id: "nearby", label: "Nearby", answers: "A park bench or next errand" },
    ],
  }),

  hiking: t({
    type: "hiking",
    categoryLabel: "Trails",
    personality: "Trail desk — honest effort, earned views.",
    storyBeats: [
      "Why this path, not another",
      "What the walk feels like underfoot",
      "The moment worth the climb",
    ],
    fields: [
      { id: "difficulty", label: "Difficulty", answers: "Honest grade for a typical walker" },
      { id: "distance", label: "Distance", answers: "Miles or kilometers, round trip if needed" },
      { id: "elevation", label: "Elevation", answers: "Gain that matters" },
      { id: "shade", label: "Shade", answers: "Sun exposure through the day" },
      { id: "dogs", label: "Dogs", answers: "Allowed, leashed, or better left home" },
      { id: "water", label: "Water", answers: "Carry-in only, or reliable sources" },
      { id: "best_season", label: "Best season", answers: "When the trail is kindest" },
      { id: "sunrise_sunset", label: "Sunrise & sunset", answers: "Whether the light is the point" },
      { id: "wildlife", label: "Wildlife", answers: "What you might see — carefully" },
    ],
  }),

  park: t({
    type: "park",
    categoryLabel: "Parks",
    personality: "Park desk — shade, lawn, and an afternoon well spent.",
    storyBeats: [
      "Why locals return",
      "The best corner of the grounds",
      "How long to stay",
    ],
    fields: [
      { id: "best_for", label: "Best for", answers: "Picnic, play, quiet reading, views" },
      { id: "shade", label: "Shade", answers: "Where to escape the sun" },
      { id: "facilities", label: "Facilities", answers: "Restrooms, water, playgrounds" },
      { id: "dogs", label: "Dogs", answers: "On-leash rules or dog areas" },
      { id: "best_time", label: "Best time", answers: "Morning calm or golden hour" },
      { id: "nearby", label: "Nearby", answers: "Coffee or a meal after" },
    ],
  }),

  beach: t({
    type: "beach",
    categoryLabel: "Beaches",
    personality: "Shore desk — tide, wind, and the right hour.",
    storyBeats: [
      "The character of this stretch of sand",
      "What the water asks of you",
      "When to come",
    ],
    fields: [
      { id: "character", label: "The shore", answers: "Sand, rock, surf, or calm water" },
      { id: "swimming", label: "Swimming", answers: "Whether the water invites a dip" },
      { id: "parking", label: "Parking & access", answers: "How hard it is to arrive" },
      { id: "facilities", label: "Facilities", answers: "Restrooms, rentals, shade structures" },
      { id: "best_time", label: "Best time", answers: "Tide, light, crowd pattern" },
      { id: "dogs", label: "Dogs", answers: "Rules on the sand" },
      { id: "nearby", label: "Nearby", answers: "A shower stop or lunch" },
    ],
  }),

  museum: t({
    type: "museum",
    categoryLabel: "Museums",
    personality: "Gallery desk — one room done well beats a checklist.",
    storyBeats: [
      "Why walk through these doors",
      "The exhibit that stays with you",
      "How long to give it",
    ],
    fields: [
      { id: "dont_miss", label: "Don’t miss", answers: "The essential gallery or object" },
      { id: "time_needed", label: "Time needed", answers: "Honest duration" },
      { id: "best_exhibits", label: "Best exhibits", answers: "Two or three highlights" },
      { id: "photography", label: "Photography", answers: "Allowed, restricted, or phone-friendly" },
      { id: "cafe", label: "Café", answers: "Whether to plan a pause" },
      { id: "gift_shop", label: "Gift shop", answers: "Worth a look or skip" },
    ],
  }),

  attraction: t({
    type: "attraction",
    categoryLabel: "Attractions",
    personality: "Visitor desk — worth the ticket when it earns it.",
    storyBeats: [
      "What you came for",
      "What surprised you",
      "Whether it is worth a return",
    ],
    fields: [
      { id: "what_to_expect", label: "What to expect", answers: "The core experience" },
      { id: "time_needed", label: "Time needed", answers: "How long to budget" },
      { id: "tickets", label: "Tickets", answers: "Advance purchase, price sense" },
      { id: "best_time", label: "Best time", answers: "Crowds and light" },
      { id: "tips", label: "Tips", answers: "One thing first-timers miss" },
      { id: "nearby", label: "Nearby", answers: "What to pair it with" },
    ],
  }),

  hidden_gem: t({
    type: "hidden_gem",
    categoryLabel: "Hidden gems",
    personality: "Side-street desk — small, specific, easy to miss.",
    storyBeats: [
      "How you find it",
      "Why locals keep it quiet",
      "What to do when you arrive",
    ],
    fields: [
      { id: "how_to_find", label: "How to find it", answers: "The turn, the unmarked door, the timing" },
      { id: "why_go", label: "Why go", answers: "The one reason it earns the detour" },
      { id: "best_time", label: "Best time", answers: "When it is most itself" },
      { id: "keep_quiet", label: "A courtesy", answers: "How to visit without spoiling it" },
      { id: "nearby", label: "Nearby", answers: "Another small find if the door is closed" },
    ],
  }),

  recommendation: t({
    type: "recommendation",
    categoryLabel: "From the desk",
    personality: "Trusted friend — improve someone’s day.",
    storyBeats: [
      "Why this, today",
      "What it will feel like",
      "When to stop",
    ],
    fields: [
      { id: "why_today", label: "Why today", answers: "The personal reason to try it now" },
      { id: "how_long", label: "How long", answers: "Minutes or an evening" },
      { id: "best_for", label: "Best for", answers: "Mood or occasion" },
      { id: "pair_with", label: "Pair with", answers: "A walk, a meal, a second chapter" },
    ],
  }),

  travel: t({
    type: "travel",
    categoryLabel: "Travel",
    personality: "Travel editor — one clear destination, one good reason.",
    storyBeats: [
      "The invitation to leave town",
      "What the day or overnight holds",
      "How to come home satisfied",
    ],
    fields: [
      { id: "why_go", label: "Why go", answers: "The destination’s claim on a day" },
      { id: "getting_there", label: "Getting there", answers: "Drive time, transit, or flight sense" },
      { id: "when_to_go", label: "When to go", answers: "Season and weekday vs weekend" },
      { id: "where_to_eat", label: "Where to eat", answers: "One reliable table" },
      { id: "dont_miss", label: "Don’t miss", answers: "The essential stop" },
      { id: "overnight", label: "Overnight", answers: "Whether to stay, and where — if known" },
    ],
  }),
};

export function getContentTemplate(type: ContentType): ContentTemplate {
  return CONTENT_TEMPLATES[type];
}

export function allContentTypes(): ContentType[] {
  return Object.keys(CONTENT_TEMPLATES) as ContentType[];
}
