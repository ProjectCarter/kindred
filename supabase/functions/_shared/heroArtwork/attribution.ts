/**
 * Museum-quality credit lines — composed once at ingest, never at app open.
 */

export type MasterpieceCreditInput = {
  artist: string;
  license: string;
  sourceInstitution: string;
  sourceProvider?: string | null;
  mediumHint?: string | null;
  collections?: string[];
  tags?: string[];
};

export type MediumLabel =
  | "Painting"
  | "Photography"
  | "Photo"
  | "Illustration"
  | "Woodblock print"
  | "Artwork";

function licensePhrase(license: string): string {
  const key = license.trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "cc0") return "Public Domain";
  if (key === "government_work") return "Public Domain";
  if (key === "museum_open_access" || key === "public_domain") return "Public Domain";
  return "Public Domain";
}

function normalizeInstitution(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Open collection";
  if (/^the\s+/i.test(trimmed)) return trimmed;
  if (/museum|gallery|institution|archives|library of congress/i.test(trimmed)) {
    return `the ${trimmed.replace(/^the\s+/i, "")}`;
  }
  return trimmed;
}

export function inferMediumLabel(input: MasterpieceCreditInput): MediumLabel {
  const blob = [
    input.mediumHint ?? "",
    ...(input.tags ?? []),
    ...(input.collections ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (/ukiyo|woodblock|hokusai|hiroshige/.test(blob)) return "Woodblock print";
  if (/unsplash|pexels/.test(blob) || /unsplash|pexels/i.test(input.sourceInstitution)) {
    return "Photo";
  }
  if (
    /photograph|photo|nasa|hubble|space photography|astrophotography/.test(blob) ||
    input.sourceProvider === "nasa"
  ) {
    return "Photography";
  }
  if (
    /illustration|botanical|engraving|scientific_illustration|historic_engravings/.test(
      blob
    )
  ) {
    return "Illustration";
  }
  if (/painting|oil on canvas|watercolor|tempera|fresco/.test(blob)) {
    return "Painting";
  }
  if (/print|poster|map|cartograph/.test(blob)) return "Illustration";
  return "Painting";
}

function isStockPlatform(institution: string): "unsplash" | "pexels" | null {
  const lower = institution.toLowerCase();
  if (/unsplash/.test(lower)) return "unsplash";
  if (/pexels/.test(lower)) return "pexels";
  return null;
}

function isUnknownCreator(artist: string): boolean {
  return !artist.trim() || /^unknown/i.test(artist.trim());
}

/**
 * Warm, human-readable museum caption — stored on kindred_hero_artwork.attribution_text.
 */
export function buildMasterpieceCreditLine(input: MasterpieceCreditInput): string {
  const artist = artistDisplayName(input.artist);
  const institution = input.sourceInstitution.trim() || "Open collection";
  const license = licensePhrase(input.license);
  const medium = inferMediumLabel(input);
  const stock = isStockPlatform(institution);

  if (stock === "unsplash") {
    return `Photography by ${artist} • Courtesy of Unsplash`;
  }
  if (stock === "pexels") {
    return `Photo by ${artist} • Licensed via Pexels`;
  }

  if (isUnknownCreator(input.artist)) {
    const courtesyInst = normalizeInstitution(institution);
    return `Artwork courtesy of ${courtesyInst} • ${license}`;
  }

  if (medium === "Woodblock print") {
    return `${medium} by ${artist} • ${license} via ${institution}`;
  }

  if (medium === "Illustration") {
    if (/commons|wikimedia/i.test(institution)) {
      return `${medium} by ${artist} • ${license}`;
    }
    return `${medium} by ${artist} • ${license} via ${institution}`;
  }

  if (medium === "Photography") {
    return `Photography by ${artist} • ${license} via ${institution}`;
  }

  if (medium === "Photo") {
    return `Photo by ${artist} • Licensed via ${institution}`;
  }

  // Painting — default for fine art
  if (/commons|wikimedia/i.test(institution)) {
    return `Painting by ${artist} • ${license} via Wikimedia Commons`;
  }

  if (/national gallery|smithsonian|metropolitan|rijksmuseum|art institute|musee|musée|van gogh|nga\.gov/i.test(institution)) {
    return `Painting by ${artist} • ${license} via ${institution}`;
  }

  return `Artwork courtesy of ${normalizeInstitution(institution)} • ${license}`;
}

function artistDisplayName(artist: string): string {
  const trimmed = artist.trim();
  if (!trimmed || /^unknown/i.test(trimmed)) return "Unknown artist";
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}
