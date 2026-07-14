import type { VerifiedEditorialCategory } from "../editorialCategory.ts";
import { editorialImagePhrasesFor } from "../editorialCategory.ts";

export type SearchTierId = "venue" | "category" | "broader";

export type SearchTierGroup = {
  tier: SearchTierId;
  minAcceptScore: number;
  queries: string[];
};

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "at",
  "in",
  "of",
  "for",
  "on",
  "to",
  "llc",
  "inc",
]);

function uniqueQueries(queries: string[]): string[] {
  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 3))];
}

function deriveBroaderPhrases(
  displayLabel: string,
  imagePhrases: string[],
  title?: string
): string[] {
  const out: string[] = [];
  const label = `${displayLabel} ${title ?? ""}`.toLowerCase();

  if (/japanese|sushi|ramen|izakaya/i.test(label)) {
    out.push("Sushi", "Japanese food", "Japanese restaurant");
  } else if (/dog park|off.?leash/i.test(label)) {
    out.push("dogs playing", "dog park", "dogs running");
  } else if (/observatory|planetarium|astronomy/i.test(label)) {
    out.push("telescope", "astronomy", "stargazing");
  } else if (/escape room/i.test(label)) {
    out.push("escape room", "puzzle room");
  } else if (/bowling/i.test(label)) {
    out.push("bowling", "bowling lanes");
  } else if (/museum|gallery/i.test(label)) {
    out.push("museum exhibit", "museum interior");
  } else if (/winery|vineyard|wine/i.test(label)) {
    out.push("wine tasting", "winery", "vineyard");
  } else if (/coffee|cafe/i.test(label)) {
    out.push("coffee", "latte art", "cafe");
  } else if (/bakery/i.test(label)) {
    out.push("bakery", "pastries", "fresh bread");
  } else if (/beach|shore/i.test(label)) {
    out.push("beach", "shoreline");
  } else if (/hiking|trail/i.test(label)) {
    out.push("hiking trail", "nature trail");
  }

  for (const phrase of imagePhrases) {
    const words = phrase.split(/\s+/);
    if (words.length >= 2) out.push(words.slice(0, 2).join(" "));
    if (words.length >= 3) out.push(words.slice(0, 3).join(" "));
    const last = words[words.length - 1];
    if (last && last.length >= 4 && !STOP_WORDS.has(last)) out.push(last);
  }

  const labelWords = displayLabel.split(/\s+/).filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  if (labelWords.length >= 2) {
    out.push(labelWords.slice(-2).join(" "));
  }
  if (labelWords.length >= 1) {
    out.push(labelWords[labelWords.length - 1]!);
  }

  return uniqueQueries(out).slice(0, 8);
}

/**
 * Three-tier editorial search plan:
 * 1. Exact venue + place name
 * 2. Verified category phrases
 * 3. Broader but still on-topic terms
 */
export function buildEditorialImageSearchPlan(input: {
  title: string;
  city?: string | null;
  state?: string | null;
  category: VerifiedEditorialCategory;
}): SearchTierGroup[] {
  const title = input.title.trim();
  const city = input.city?.trim() || "";
  const state = input.state?.trim() || "";
  const label = input.category.displayLabel;
  const imagePhrases = editorialImagePhrasesFor(input.category.categoryId);

  const venueQueries: string[] = [];
  if (title && city) {
    venueQueries.push([title, city, state].filter(Boolean).join(" "));
  } else if (title && state) {
    venueQueries.push(`${title} ${state}`);
  }
  if (title && label) {
    venueQueries.push(`${title} ${label}`);
  }

  const categoryQueries = uniqueQueries([
    label,
    `${label} interior`,
    ...imagePhrases,
    ...imagePhrases.map((phrase) => (city ? `${phrase} ${city}` : phrase)),
    city ? `${label} ${city}` : "",
  ]);

  const broaderQueries = deriveBroaderPhrases(label, imagePhrases, title);

  return [
    { tier: "venue" as const, minAcceptScore: 74, queries: uniqueQueries(venueQueries) },
    { tier: "category" as const, minAcceptScore: 62, queries: categoryQueries },
    { tier: "broader" as const, minAcceptScore: 52, queries: broaderQueries },
  ].filter((group) => group.queries.length > 0);
}

/** Flat list of every query attempted, in tier order — for verification reports. */
export function flattenSearchPlan(plan: SearchTierGroup[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of plan) {
    for (const query of group.queries) {
      if (!seen.has(query)) {
        seen.add(query);
        out.push(query);
      }
    }
  }
  return out;
}
