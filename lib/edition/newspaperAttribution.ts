/**
 * Newspaper-style source attribution — transparent, never defensive.
 */

export function newspaperSourceAttribution(publisher: string | null | undefined): string {
  const name = publisher?.trim() || "the original publication";
  return `This summary reflects reporting published by ${name}.`;
}

export function newspaperThinWireAttribution(
  publisher: string | null | undefined
): string {
  const name = publisher?.trim() || "the original source";
  return `This report is presented as published by ${name}.`;
}

export function newspaperBriefWireNote(
  publisher: string | null | undefined
): string {
  const name = publisher?.trim() || "the original publication";
  return `Reported by ${name}.`;
}
