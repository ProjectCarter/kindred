import {
  classifyGeo,
  classifyTone,
  isHeavyStory,
  shouldDeprioritizeForTone,
} from "./tone.ts";
import type {
  EditorialCalendar,
  EditorialDecisionRecord,
  EditorialDecisionSummary,
  EditorialPolicy,
  EditorialWhyChosen,
} from "./types.ts";

type StoryLike = {
  id: string;
  title: string;
  description: string;
  source: string;
  pool: string;
  category?: string | null;
};

type ScoredLike = {
  story: StoryLike;
  score: number;
  role?: string;
  reasons: Array<{ code: string; label: string; weight: number }>;
};

function hasLocal(c: ScoredLike): boolean {
  if (c.story.pool === "local") return true;
  return c.reasons.some(
    (r) => r.code === "local_relevance" || r.code === "local_pool"
  );
}

function deskWhy(role: string): EditorialWhyChosen {
  switch (role) {
    case "national":
      return {
        code: "national_desk",
        label: "National desk — significant story of the day",
        weight: 20,
      };
    case "world":
      return {
        code: "world_desk",
        label: "World desk — international development",
        weight: 18,
      };
    case "local":
      return {
        code: "local_desk",
        label: "Local desk — matters where you live",
        weight: 20,
      };
    case "interest":
      return {
        code: "interest_desk",
        label: "Chosen for your interests — still editorially sound",
        weight: 16,
      };
    case "feature":
      return {
        code: "feature_balance",
        label: "Feature for tonal balance — not only hard news",
        weight: 18,
      };
    case "breaking":
      return {
        code: "breaking_desk",
        label: "Developing news worth the front page",
        weight: 22,
      };
    default:
      return {
        code: "editorial_integrity",
        label: "Selected by editorial judgment",
        weight: 10,
      };
  }
}

/**
 * Build explainable “why this story” records — the editor’s annotations.
 */
export function buildDecisionRecord(
  c: ScoredLike,
  role: string,
  extras: EditorialWhyChosen[] = []
): EditorialDecisionRecord {
  const text = `${c.story.title} ${c.story.description}`;
  const isBreaking = c.reasons.some((r) => r.code.includes("breaking"));
  const tone = classifyTone(text, isBreaking);
  const geo = classifyGeo(text, c.story.pool, hasLocal(c));

  const why: EditorialWhyChosen[] = [deskWhy(role), ...extras];

  // Promote top scoring reasons that aren't role_ noise.
  for (const r of c.reasons
    .filter((x) => !x.code.startsWith("role_"))
    .slice(0, 3)) {
    why.push({
      code:
        r.code.includes("fresh")
          ? "freshness"
          : r.code.includes("favorite") || r.code.includes("learned")
          ? "personalization_soft"
          : r.code.includes("feature") || r.code.includes("emotional")
          ? "emotional_counterweight"
          : "editorial_integrity",
      label: r.label,
      weight: r.weight,
    });
  }

  if (isHeavyStory(text) && role === "feature") {
    why.unshift({
      code: "emotional_counterweight",
      label: "Counterweight — the page needed a lighter beat",
      weight: 15,
    });
  }

  return {
    storyId: c.story.id,
    title: c.story.title,
    role,
    geo,
    tone,
    why: why.slice(0, 6),
  };
}

export function summarizeEditorialDecisions(input: {
  calendar: EditorialCalendar;
  policy: EditorialPolicy;
  lead: ScoredLike | null;
  leadRole?: string;
  slate: ScoredLike[];
}): EditorialDecisionSummary {
  const editorNotes: string[] = [input.calendar.modeLabel];

  if (input.policy.requireEmotionalBalance) {
    editorNotes.push("Emotional balance required — avoid doomscrolling");
  }
  if (input.policy.preferLeisureTone) {
    editorNotes.push("Weekend leisure tone preferred");
  }
  if (input.policy.preferWorldBalance) {
    editorNotes.push("Seek local / national / world balance");
  }
  if (input.policy.leadDistinctFromSlate) {
    editorNotes.push("Lead kept distinct from Top Stories when possible");
  }

  const heavyCount = input.slate.filter((s) =>
    shouldDeprioritizeForTone(`${s.story.title} ${s.story.description}`)
  ).length;
  if (heavyCount > input.policy.maxHeavyStories) {
    editorNotes.push("Heavy slate — feature counterweight prioritized");
  }

  return {
    version: 1,
    calendar: input.calendar,
    policy: {
      mode: input.policy.mode,
      modeLabel: input.calendar.modeLabel,
      requireEmotionalBalance: input.policy.requireEmotionalBalance,
      maxHeavyStories: input.policy.maxHeavyStories,
      preferLeisureTone: input.policy.preferLeisureTone,
    },
    lead: input.lead
      ? buildDecisionRecord(input.lead, input.leadRole ?? "national", [
          {
            code: "lead_of_the_day",
            label: "Lead Story — the edition’s cover judgment",
            weight: 25,
          },
        ])
      : null,
    slate: input.slate.map((s) =>
      buildDecisionRecord(s, s.role ?? "feature")
    ),
    editorNotes,
  };
}

/** Calm prose for future “why chosen” surfaces — never mentions scores. */
export function formatEditorialWhy(record: EditorialDecisionRecord): string {
  const top = record.why
    .slice(0, 2)
    .map((w) => w.label)
    .join(" ");
  return top || "Selected by editorial judgment for today’s paper.";
}
