/** Homepage teaser copy — 1–2 sentences from stored aboutArtworkBody. */

export function homepageMasterpieceSummary(body: string | null | undefined): string {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) return "";

  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  if (sentences.length === 0) return trimmed;
  return sentences.slice(0, 2).join(" ");
}
