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
  return "That is all for today’s edition.";
}

export function editionFarewell(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Put the paper down when you’re ready. The day is yours.";
  if (hour < 17) return "Put the paper down when you’re ready. See you tomorrow.";
  if (hour < 21) return "Close the paper gently. Rest well tonight.";
  return "The night is quiet. See you in the morning.";
}

/** Calm lines while the presses catch up. */
export const waitingCopy = {
  loading: "Opening today’s paper…",
  emptyTitle: "Today’s paper isn’t ready yet.",
  emptyBody:
    "When you’re ready, we’ll set today’s edition. It usually takes about a minute.",
  openAction: "Open today’s paper",
  preparing: "Setting the type…",
  // Shown instead of the manual-build CTA when the overnight job already
  // has this edition in progress — no need to ask the reader to wait on it.
  backgroundTitle: "Tonight’s edition is on the press.",
  backgroundBody:
    "It’s already being set — no need to build it yourself. This page will refresh the moment it’s ready.",
  backgroundBuildNow: "Build it now instead",
} as const;

/**
 * A full edition can take close to a minute to build. A single static
 * hint over that long a wait reads as stalled — this gives the presses
 * a quiet sense of progress without ever feeling technical.
 */
export const PREPARING_LINES = [
  "Setting the type…",
  "Choosing today’s stories…",
  "Laying out the morning…",
  "Proofing the last few lines…",
  "Almost ready…",
] as const;

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
