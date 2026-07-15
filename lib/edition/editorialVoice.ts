/**
 * Reader-facing editorial voice — engine language stays inside the desk,
 * never in the morning paper.
 */

/** Patterns that break the newspaper illusion — never publish to readers. */
export const ENGINE_LANGUAGE_PATTERN =
  /\b(verified listing|category guess|confidence score|source confidence|category detection|selected because|kindred flagged|kindred selected|algorithmic suggestion|algorithmic recommendation|ai verified|foursquare verified|evidence gate|experience verified|verified near|verified through|not a category|category suggestion|category recommendation|confirmed listing|quiet desk recommendation|fits your place|editorial quality|hand-selected|we could confirm|grounded in what|not a line-by-line review|kindred doesn'?t have|kindred can (actually )?verify|worth a look before the day fills|today'?s notebook on editorial judgment|trending list|mood board version|earned a place in today'?s paper|from today'?s paper)\b/i;

export function containsEngineLanguage(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return ENGINE_LANGUAGE_PATTERN.test(text.trim());
}

/** Strip or drop paragraphs that read like internal reasoning. */
export function sanitizeReaderParagraphs(paragraphs: string[]): string[] {
  return paragraphs
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 12 && !containsEngineLanguage(p));
}

export function isNearDuplicateCopy(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

/**
 * Opening line for a local place — observation, not verification meta-talk.
 * Uses the provider note when it already reads like editorial copy.
 */
export function openingLineForPlace(input: {
  title: string;
  typeLabel: string;
  city?: string | null;
  note?: string | null;
  locationPhrase?: string | null;
}): string {
  const title = input.title.trim();
  const typeLabel = input.typeLabel.trim().toLowerCase();
  const city = input.city?.trim() || "";
  const note = input.note?.trim() || "";
  const where = input.locationPhrase?.trim() || (city ? `in ${city}` : "");

  if (note && !containsEngineLanguage(note) && note.length >= 24) {
    return note;
  }

  const placeRef = where ? `${title} ${where}` : title;
  const cityRef = city ? `${city}'s ` : "";

  if (/esports|gaming lounge|gaming center/.test(`${typeLabel} ${title}`)) {
    return `${placeRef} is ${cityRef}dedicated esports lounge — high-end PCs, console stations, and regular tournaments for anyone who wants a few focused hours of play.`;
  }
  if (/bowling/.test(typeLabel)) {
    return `${placeRef} is ${cityRef}bowling alley — lanes, shoe rental, and the kind of easy group night that does not ask for much planning.`;
  }
  if (/escape room/.test(typeLabel)) {
    return `${placeRef} is ${cityRef}escape room — puzzles, a timed clock, and something worth talking about on the drive home.`;
  }
  if (/coffee/.test(typeLabel)) {
    return `${placeRef} is ${cityRef}coffee shop — worth a stop when you want a quiet seat and a cup made with care.`;
  }
  if (/restaurant|sushi|steakhouse/.test(typeLabel)) {
    return `${placeRef} is ${cityRef}${typeLabel}${where ? ` ${where}` : ""} — a sit-down meal worth leaving the house for.`;
  }
  if (/museum/.test(typeLabel)) {
    return `${placeRef} is ${cityRef}museum — unhurried rooms and exhibits worth an afternoon of looking.`;
  }
  if (/park|garden|trail|hiking|beach/.test(typeLabel)) {
    return `${placeRef} is ${cityRef}${typeLabel}${where ? ` ${where}` : ""} — open air, easy to reach, and good for an hour without a complicated plan.`;
  }
  if (/arcade|mini golf|go-kart|axe|climbing|kayak|paddle/.test(typeLabel)) {
    return `${placeRef} is ${cityRef}${typeLabel}${where ? ` ${where}` : ""} — the sort of afternoon that feels like doing something, not just going somewhere.`;
  }

  return `${placeRef} is ${cityRef}${typeLabel}${where ? ` ${where}` : ""} — a local spot worth knowing about before the week gets away from you.`;
}

/** Second paragraph — why it matters, never why the engine picked it. */
export function sceneLineForPlace(
  title: string,
  typeLabel: string,
  city: string
): string {
  const t = typeLabel.toLowerCase();
  const area = city ? ` around ${city}` : "";

  if (/bowling/.test(t)) {
    return `Whether you are escaping the afternoon heat or meeting friends for a rematch, it is an easy place to spend an hour without overthinking the plan.`;
  }
  if (/esports|gaming/.test(t)) {
    return `Whether you are escaping the afternoon heat or meeting friends for a few hours of gaming, it is an easy place to settle in and stay awhile.`;
  }
  if (/escape room/.test(t)) {
    return `Good for groups that like a little pressure, a clear goal, and a story to retell afterward.`;
  }
  if (/coffee/.test(t)) {
    return `Best approached slowly — a pastry, a second cup, and nowhere you need to be right away.`;
  }
  if (/museum/.test(t)) {
    return `Give yourself time to wander. The point is looking, not checking a box.`;
  }
  if (/park|garden|trail|hiking|beach/.test(t)) {
    return `Go when you have an hour to spare${area} — weekday mornings tend to be the calmest window.`;
  }

  return `Worth a visit when you want something local and specific${area}, not another evening spent deciding where to go.`;
}

export function closingLineForPlace(title: string, city: string): string {
  if (city) {
    return `${title} is one of those ${city} places that is easier to postpone than to visit — and usually more fun once you finally go.`;
  }
  return `${title} is worth finding out for yourself — the kind of place you are glad you did not keep putting off.`;
}
