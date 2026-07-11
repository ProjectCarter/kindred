/**
 * Client mirror — Newspaper Editor AI contracts.
 * Decisions are made at edition build time; these helpers explain them later.
 */

export type EditorialWhyChosen = {
  code: string;
  label: string;
  weight: number;
};

export type EditorialDecisionRecord = {
  storyId: string;
  title: string;
  role: string;
  geo: string;
  tone: string;
  why: EditorialWhyChosen[];
};

export type EditorialDecisionSummary = {
  version: 1;
  calendar: {
    editionDate: string;
    dayOfWeek: number;
    isWeekend: boolean;
    mode: string;
    modeLabel: string;
  };
  policy: {
    mode: string;
    modeLabel: string;
    requireEmotionalBalance: boolean;
    maxHeavyStories: number;
    preferLeisureTone: boolean;
  };
  lead: EditorialDecisionRecord | null;
  slate: EditorialDecisionRecord[];
  editorNotes: string[];
};

export function parseEditorialDecisions(
  value: unknown
): EditorialDecisionSummary | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<EditorialDecisionSummary>;
  if (raw.version !== 1 || !raw.calendar || !Array.isArray(raw.slate)) {
    return null;
  }
  return raw as EditorialDecisionSummary;
}

/** Calm prose — never mentions scores or algorithms. */
export function formatEditorialWhy(record: EditorialDecisionRecord): string {
  const top = record.why
    .slice(0, 2)
    .map((w) => w.label)
    .join(" ");
  return top || "Selected by editorial judgment for today’s paper.";
}

export const EditorialDecisionService = {
  parseEditorialDecisions,
  formatEditorialWhy,
};

export default EditorialDecisionService;
