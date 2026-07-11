/**
 * Lightweight continuity helpers — overlap and date math for memory threads.
 */

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "at",
  "from",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "says",
  "said",
  "new",
  "after",
  "before",
]);

export function tokenOverlap(a: string, b: string): number {
  const A = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOP.has(t))
  );
  const B = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3 && !STOP.has(t))
  );
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n += 1;
  return n / Math.min(A.size, B.size);
}

export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso.slice(0, 10)}T12:00:00Z`);
  const b = new Date(`${bIso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Count consecutive morning editions ending at (or just before) editionDate.
 * Quiet continuity — relationship memory, not a retention badge.
 */
export function continuityDays(
  editionDates: string[],
  editionDate: string
): number {
  const set = new Set(editionDates.map((d) => d.slice(0, 10)));
  // Include today once this edition is built; count prior consecutive days.
  let days = 0;
  const cursor = new Date(`${editionDate.slice(0, 10)}T12:00:00Z`);
  // Walk backward from yesterday so today's in-progress edition doesn't inflate.
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let i = 0; i < 60; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    days += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  // Today’s build continues the habit.
  return days > 0 ? days + 1 : set.has(editionDate.slice(0, 10)) ? 1 : 0;
}

export function slugId(prefix: string, text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${prefix}:${slug || "thread"}`;
}
