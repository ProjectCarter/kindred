/**
 * Local News story classification — one structure per desk, not one template for all.
 * Shared by the Story Editor (generation) and reader adapters (module labels).
 */

/** Minimal module shape for reader adapters (mirrors contentSystem/types). */
export type LocalNewsEditorialModule = {
  id: string;
  label: string;
  body: string;
};

export type LocalNewsStoryType =
  | "sports"
  | "local_government"
  | "business"
  | "community"
  | "public_safety"
  | "general";

export type LocalNewsSectionId =
  | "why_it_matters"
  | "background"
  | "looking_ahead"
  | "verified_facts"
  | "economic_impact";

export type LocalNewsSectionSpec = {
  id: LocalNewsSectionId;
  label: string;
  purpose: string;
};

export type LocalNewsStoryStructure = {
  type: LocalNewsStoryType;
  label: string;
  leadGoal: string;
  sections: LocalNewsSectionSpec[];
};

export const LOCAL_NEWS_STORY_STRUCTURES: Record<
  LocalNewsStoryType,
  LocalNewsStoryStructure
> = {
  sports: {
    type: "sports",
    label: "Sports",
    leadGoal: "What happened — the game, roster move, injury, or result.",
    sections: [
      {
        id: "why_it_matters",
        label: "WHY IT MATTERS",
        purpose: "Why this result or move matters to local fans right now.",
      },
      {
        id: "background",
        label: "PLAYER & TEAM BACKGROUND",
        purpose: "Season context, recent history, or player/team background from verified reporting.",
      },
      {
        id: "looking_ahead",
        label: "WHAT TO WATCH NEXT",
        purpose: "Next game, deadline, or development fans should follow.",
      },
    ],
  },
  local_government: {
    type: "local_government",
    label: "Local Government",
    leadGoal: "What happened — the vote, hearing, policy, or announcement.",
    sections: [
      {
        id: "why_it_matters",
        label: "WHY IT MATTERS TO RESIDENTS",
        purpose: "Practical consequences for people who live in the area.",
      },
      {
        id: "background",
        label: "BACKGROUND",
        purpose: "Prior votes, history of the issue, or how local government got here.",
      },
      {
        id: "looking_ahead",
        label: "NEXT STEPS",
        purpose: "Meetings, implementation dates, appeals, or votes still to come.",
      },
    ],
  },
  business: {
    type: "business",
    label: "Business",
    leadGoal: "What happened — the opening, closing, deal, hiring move, or market shift.",
    sections: [
      {
        id: "background",
        label: "COMPANY & INDUSTRY BACKGROUND",
        purpose: "What the company does and the relevant industry context.",
      },
      {
        id: "economic_impact",
        label: "ECONOMIC IMPACT",
        purpose: "Jobs, spending, taxes, or neighborhood effects when verified.",
      },
      {
        id: "looking_ahead",
        label: "WHAT'S NEXT",
        purpose: "Timelines, approvals, or what changes next for workers and customers.",
      },
    ],
  },
  community: {
    type: "community",
    label: "Community",
    leadGoal: "What happened — the event, program, milestone, or neighborhood change.",
    sections: [
      {
        id: "why_it_matters",
        label: "WHY IT MATTERS LOCALLY",
        purpose: "Why neighbors, families, or regulars should care.",
      },
      {
        id: "background",
        label: "COMMUNITY CONTEXT",
        purpose: "History of the place, organization, or issue in the community.",
      },
      {
        id: "looking_ahead",
        label: "LOOKING AHEAD",
        purpose: "Future dates, deadlines, or how the story may develop.",
      },
    ],
  },
  public_safety: {
    type: "public_safety",
    label: "Public Safety",
    leadGoal: "What happened — the incident, alert, investigation, or official action.",
    sections: [
      {
        id: "verified_facts",
        label: "VERIFIED FACTS",
        purpose: "Only confirmed details from official or wire reporting — no speculation.",
      },
      {
        id: "why_it_matters",
        label: "COMMUNITY IMPACT",
        purpose: "Who is affected and what changes for residents.",
      },
      {
        id: "looking_ahead",
        label: "WHAT RESIDENTS SHOULD KNOW",
        purpose: "Road closures, safety guidance, court dates, or next official updates.",
      },
    ],
  },
  general: {
    type: "general",
    label: "Local News",
    leadGoal: "What happened — the development that earned today's paper.",
    sections: [
      {
        id: "why_it_matters",
        label: "WHY IT MATTERS",
        purpose: "Why readers in this community should care today.",
      },
      {
        id: "background",
        label: "BACKGROUND",
        purpose: "Verified context that explains how we got here.",
      },
      {
        id: "looking_ahead",
        label: "LOOKING AHEAD",
        purpose: "What to expect next, or that further updates are expected.",
      },
    ],
  },
};

const STORY_TYPE_SET = new Set<string>(Object.keys(LOCAL_NEWS_STORY_STRUCTURES));

export function resolveLocalNewsStoryType(value: unknown): LocalNewsStoryType {
  if (typeof value === "string" && STORY_TYPE_SET.has(value)) {
    return value as LocalNewsStoryType;
  }
  return "general";
}

export function localNewsStructureDigest(): string {
  const lines = [
    "Classify every Local News story FIRST, then write to that desk's structure.",
    "story_type must be one of: sports, local_government, business, community, public_safety, general.",
    "",
  ];
  for (const structure of Object.values(LOCAL_NEWS_STORY_STRUCTURES)) {
    lines.push(`${structure.label.toUpperCase()} (${structure.type}):`);
    lines.push(`- Lead (paragraphs): ${structure.leadGoal}`);
    for (const section of structure.sections) {
      lines.push(
        `- field_answers.${section.id} — ${section.label}: ${section.purpose}`
      );
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function readLocalNewsFieldAnswers(
  desk: Record<string, unknown> | null | undefined
): Partial<Record<LocalNewsSectionId, string>> {
  const raw = desk?.fieldAnswers;
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<LocalNewsSectionId, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      out[key as LocalNewsSectionId] = value.trim();
    }
  }
  return out;
}

export function localNewsModulesFromDesk(
  desk: Record<string, unknown> | null | undefined,
  options?: { skipDisclaimer?: (text: string) => boolean }
): LocalNewsEditorialModule[] {
  const storyType = resolveLocalNewsStoryType(desk?.storyType ?? desk?.story_type);
  const structure = LOCAL_NEWS_STORY_STRUCTURES[storyType];
  const answers = readLocalNewsFieldAnswers(desk);
  const modules: LocalNewsEditorialModule[] = [];

  for (const section of structure.sections) {
    const body = answers[section.id]?.trim();
    if (!body || body.length < 12) continue;
    if (options?.skipDisclaimer?.(body)) continue;
    modules.push({
      id: section.id,
      label: section.label,
      body,
    });
  }

  return modules;
}

export const LOCAL_NEWS_SECTION_IDS: LocalNewsSectionId[] = [
  "why_it_matters",
  "background",
  "looking_ahead",
  "verified_facts",
  "economic_impact",
];
