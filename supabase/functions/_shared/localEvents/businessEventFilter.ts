/**
 * Business / professional-development exclusion — Local Events only.
 *
 * Kindred Local Events is a local *discovery* desk ("What's happening today?"),
 * not a professional-development directory. Business training, seminars,
 * networking, career fairs, corporate education, and coworking/office-promotion
 * events do not fit the reader experience and are removed from every source
 * (Eventbrite and fallbacks) before dedupe → rank → homepage.
 *
 * This gate is intentionally SEPARATE from the shared family-friendly filter so
 * it applies only to Local Events and never touches Activities, Food & Drinks,
 * or other discovery surfaces.
 *
 * Keyword + semantic: a listing is excluded when its title, description,
 * organizer, venue, category, or source context indicates the primary purpose is
 * learning business skills, professional advancement, career development,
 * networking for work, selling business services, recruiting, corporate
 * education, or promoting coworking/office services. Public workshops focused on
 * art, crafts, food, gardening, recreation, or hobbies are always kept.
 */

import type { LocalEvent } from "./provider.ts";

export type BusinessEventFilterAssessment = {
  excluded: boolean;
  /** Human-readable match for edition diagnostics — never reader-facing. */
  signal?: string;
};

export type BusinessEventFilterResult = {
  kept: LocalEvent[];
  filteredCount: number;
  /** Up to 8 samples for build logs — diagnostics only. */
  samples: Array<{ name: string; signal: string }>;
};

export type BusinessEventListingInput = {
  name: string;
  venue?: string | null;
  category?: string | null;
  description?: string | null;
  tags?: string[];
  organizer?: string | null;
  sourceUrl?: string | null;
};

/**
 * Public hobby / arts / recreation / cultural safe harbor. When present WITHOUT
 * an explicit business signal, generic "workshop / class / seminar" words are
 * kept — a watercolor workshop or cooking class is exactly what belongs here.
 */
const HOBBY_SAFE_HARBOR =
  /\b(art|arts|art\s+show|watercolou?r|acrylic|oil\s+painting|painting|paint\s+&?\s*sip|drawing|sketch|pottery|ceramic|clay|craft|crafts|knit|knitting|crochet|sew|sewing|quilt|jewelry|calligraphy|photograph(y|er)|cooking|culinary|baking|pastry|chef|wine|winery|brewery|beer|cocktail|mixology|tasting|garden|gardening|planting|floral|flower|yoga|pilates|meditation|dance|dancing|zumba|ballet|music|concert|guitar|piano|ukulele|singing|choir|karaoke|theat(er|re)|improv|comedy|festival|farmers?\s+market|parade|holiday|kids|children|toddler|family|teen|nature|hiking|kayak|paddle|climbing|fitness|martial\s+arts|self[\s-]defense|swimming|fishing|birding|astronomy|stargazing|museum|history|historic|heritage|cultural|storytime|story\s+hour|book\s+club|craft\s+fair|home\s+&?\s*garden|comic\s+con|anime|gaming|car\s+show)\b/i;

/**
 * Explicit business / professional signals — exclude regardless of format words
 * (these define the primary purpose on their own).
 */
const BUSINESS_PRIMARY_PATTERNS: Array<{ re: RegExp; signal: string }> = [
  { re: /\bprofessional\s+development\b/i, signal: "professional development" },
  { re: /\bprofessional[\s-]?dev\b/i, signal: "professional development" },
  { re: /\bcareer[\s-]?development\b/i, signal: "career development" },
  { re: /\bcareer\s+fair\b/i, signal: "career fair" },
  { re: /\bjob\s+fair\b/i, signal: "job fair" },
  { re: /\bjob\s+expo\b/i, signal: "job expo" },
  { re: /\bhiring\s+(event|fair|expo)\b/i, signal: "hiring event" },
  { re: /\brecruit(ing|ment)\b/i, signal: "recruiting event" },
  { re: /\bnetworking\b/i, signal: "networking event" },
  { re: /\bbusiness\s+mixer\b/i, signal: "business mixer" },
  { re: /\bprofessional\s+mixer\b/i, signal: "professional mixer" },
  { re: /\bentrepreneur(ship|s)?\b/i, signal: "entrepreneur event" },
  { re: /\bstart[\s-]?ups?\b/i, signal: "startup event" },
  { re: /\bfounders?\b/i, signal: "founders event" },
  { re: /\bsmall\s+business\b/i, signal: "small business event" },
  { re: /\bb2b\b/i, signal: "B2B event" },
  { re: /\bsaas\b/i, signal: "SaaS event" },
  { re: /\bchamber\s+of\s+commerce\b/i, signal: "chamber of commerce" },
  { re: /\bco[\s-]?working\b/i, signal: "coworking space event" },
  { re: /\boffice\s+space\b/i, signal: "office space event" },
  { re: /\bregus\b/i, signal: "Regus (office-space promotion)" },
  { re: /\bwework\b/i, signal: "WeWork (office-space promotion)" },
  { re: /\bskelora\b/i, signal: "Skelora (business-service promotion)" },
  { re: /\bcontinuing\s+education\b/i, signal: "continuing education" },
  { re: /\bce\s+credits?\b/i, signal: "continuing education credits" },
  { re: /\bceus?\b/i, signal: "continuing education units" },
  { re: /\bmastermind\b/i, signal: "mastermind program" },
  { re: /\bcoaching\s+program\b/i, signal: "coaching program" },
  {
    re: /\b(business|executive|career|leadership|sales|success|mindset|life)\s+coach(ing)?\b/i,
    signal: "professional coaching",
  },
  { re: /\blead\s+generation\b/i, signal: "lead generation" },
  { re: /\bsales\s+funnel\b/i, signal: "sales funnel" },
  { re: /\bproject\s+management\b/i, signal: "project management" },
  { re: /\bbusiness\s+analytics\b/i, signal: "business analytics" },
  { re: /\bbusiness\s+strateg(y|ies)\b/i, signal: "business strategy" },
  { re: /\bdigital\s+marketing\b/i, signal: "digital marketing" },
  { re: /\bsocial\s+media\s+marketing\b/i, signal: "marketing training" },
  { re: /\bleadership\s+(development|training|seminar|workshop|summit|academy)\b/i, signal: "leadership training" },
  { re: /\bmanagement\s+(training|workshop|seminar|essentials|skills)\b/i, signal: "management training" },
  { re: /\bsales\s+(training|workshop|seminar|bootcamp)\b/i, signal: "sales training" },
  { re: /\bmarketing\s+(training|workshop|seminar|bootcamp|masterclass)\b/i, signal: "marketing training" },
  { re: /\b(finance|financial)\s+(training|workshop|seminar)\b/i, signal: "finance training" },
  { re: /\baccounting\s+(training|workshop|seminar)\b/i, signal: "accounting training" },
  { re: /\bbookkeeping\s+(training|workshop|seminar|class)\b/i, signal: "bookkeeping training" },
  { re: /\bhuman\s+resources?\b/i, signal: "HR training" },
  { re: /\breal\s+estate\s+(investing|investor)\b/i, signal: "real estate investing" },
  { re: /\bwholesaling\s+(real\s+estate|properties)\b/i, signal: "real estate wholesaling" },
  { re: /\bbuild\s+your\s+client\s+base\b/i, signal: "grow your business" },
  { re: /\b(grow|scale|launch)\s+your\s+business\b/i, signal: "grow your business" },
  { re: /\bbusiness\s+(seminar|workshop|training|conference|summit|expo|bootcamp)\b/i, signal: "business seminar" },
  { re: /\bcorporate\s+(training|seminar|workshop|education|retreat)\b/i, signal: "corporate training" },
  { re: /\bprofessional\s+(training|seminar|workshop|certification)\b/i, signal: "professional training" },
];

/** Ambiguous training/education formats — excluded only with a professional topic. */
const TRAINING_FORMAT =
  /\b(training|seminar|webinar|workshop|boot\s?camp|master\s?class|certification|conference|convention|summit|expo|meet[\s-]?up|mixer|cohort|masterclass)\b/i;

/** Professional-skill topics that make a generic format a business event. */
const PROFESSIONAL_SKILL_TOPIC =
  /\b(business|corporate|professional|leadership|management|managerial|executive|sales|marketing|advertising|finance|financial|accounting|bookkeeping|productivity|negotiation|strateg(y|ic)|analytics|data\s+science|excel|powerpoint|project\s+management|agile|scrum|six\s+sigma|lean|kanban|human\s+resources|\bhr\b|recruit(ing|ment)|compliance|osha|real\s+estate|investing|entrepreneur|startup|networking|career|resume|linkedin|public\s+speaking|time\s+management|crm|salesforce|pmp|cpa|\bmba\b|cybersecurity\s+certification|it\s+certification|coding\s+boot\s?camp|workforce)\b/i;

function listingHay(input: BusinessEventListingInput): string {
  return [
    input.name,
    input.venue,
    input.category,
    input.description,
    input.organizer,
    input.sourceUrl,
    ...(input.tags ?? []),
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
}

/**
 * Assess whether a listing's primary purpose is business / professional
 * development. Keyword + semantic — explicit business signals win outright;
 * ambiguous "workshop / seminar / class" formats are excluded only when paired
 * with a professional-skill topic and no public hobby/arts/recreation context.
 */
export function assessBusinessProfessionalListing(
  input: BusinessEventListingInput
): BusinessEventFilterAssessment {
  const hay = listingHay(input);
  if (!hay) return { excluded: false };

  for (const { re, signal } of BUSINESS_PRIMARY_PATTERNS) {
    if (re.test(hay)) {
      return { excluded: true, signal };
    }
  }

  if (
    TRAINING_FORMAT.test(hay) &&
    PROFESSIONAL_SKILL_TOPIC.test(hay) &&
    !HOBBY_SAFE_HARBOR.test(hay)
  ) {
    return { excluded: true, signal: "professional-skills training" };
  }

  return { excluded: false };
}

export function buildBusinessEventInput(
  event: LocalEvent
): BusinessEventListingInput {
  const signals = event.badgeSignals;
  const providerTags = signals?.providerTags ?? [];
  return {
    name: event.name,
    venue: event.venue,
    category: event.category ?? signals?.eventCategory ?? null,
    description: signals?.description ?? null,
    tags: providerTags,
    organizer: event.sourceName,
    sourceUrl: event.sourceUrl,
  };
}

export function isNonBusinessEvent(event: LocalEvent): boolean {
  return !assessBusinessProfessionalListing(buildBusinessEventInput(event))
    .excluded;
}

export function filterNonBusinessEvents(
  events: LocalEvent[]
): BusinessEventFilterResult {
  const kept: LocalEvent[] = [];
  const samples: BusinessEventFilterResult["samples"] = [];

  for (const event of events) {
    const assessment = assessBusinessProfessionalListing(
      buildBusinessEventInput(event)
    );
    if (assessment.excluded) {
      if (samples.length < 8) {
        samples.push({
          name: event.name.slice(0, 80),
          signal: assessment.signal ?? "business/professional event",
        });
      }
      continue;
    }
    kept.push(event);
  }

  return {
    kept,
    filteredCount: events.length - kept.length,
    samples,
  };
}
