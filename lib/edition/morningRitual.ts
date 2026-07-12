/**
 * Morning ritual copy — tiny craft helpers for a 10-year habit.
 * Not a product system; just the words and salutations of opening Kindred.
 */

export function morningSalutation(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return "You’re up early.";
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  if (hour < 21) return "Good evening.";
  return "A quiet night.";
}

/** Closing lines at the end of an edition — calm, complete. */
export function editionColophon(): string {
  return "You’ve reached the end of today’s edition.";
}

export function editionFarewell(): string {
  return "See you tomorrow.";
}

/** Calm lines while the presses catch up. */
export const waitingCopy = {
  loading: "Opening today’s paper…",
  emptyTitle: "Today’s paper isn’t ready yet.",
  emptyBody:
    "When you’re ready, tap below. It usually takes about a minute.",
  openAction: "Get today’s paper",
  preparing: "Preparing your paper…",
  previous: "Read a previous paper",
} as const;

/** Soft Bandit fallbacks when the stored line isn’t ready — same line all day. */
const BANDIT_DAY_LINES = [
  "I left the paper open for you.",
  "Take your time with this one.",
  "I thought you’d enjoy this.",
  "This was my favorite story today.",
  "I’ve kept the noise down this morning.",
  "A few careful pages — nothing more than you need.",
  "Sit with this for a minute. The day can wait.",
  "I chose the lead with you in mind.",
  "The desk is quiet. Your edition is ready.",
  "No rush. The paper will keep.",
] as const;

export function banditDayLine(editionDate?: string | null): string {
  let seed = 0;
  if (editionDate && /^\d{4}-\d{2}-\d{2}/.test(editionDate)) {
    seed = Number(editionDate.replace(/-/g, "")) || 0;
  } else {
    const d = new Date();
    seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  return BANDIT_DAY_LINES[Math.abs(seed) % BANDIT_DAY_LINES.length];
}
