/**
 * Museum credit lines for seed scripts — keep in sync with
 * supabase/functions/_shared/heroArtwork/attribution.ts
 */

function licensePhrase(license) {
  const key = license.trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "cc0" || key === "government_work" || key === "museum_open_access" || key === "public_domain") {
    return "Public Domain";
  }
  return "Public Domain";
}

function normalizeInstitution(name) {
  const trimmed = name.trim();
  if (!trimmed) return "Open collection";
  if (/^the\s+/i.test(trimmed)) return trimmed;
  if (/museum|gallery|institution|archives|library of congress/i.test(trimmed)) {
    return `the ${trimmed.replace(/^the\s+/i, "")}`;
  }
  return trimmed;
}

export function inferMediumLabel(input) {
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
  if (/photograph|photo|nasa|hubble|space photography/.test(blob) || input.sourceProvider === "nasa") {
    return "Photography";
  }
  if (/illustration|botanical|engraving|scientific_illustration|historic_engravings/.test(blob)) {
    return "Illustration";
  }
  if (/painting|oil on canvas|watercolor|tempera|fresco/.test(blob)) return "Painting";
  if (/print|poster|map|cartograph/.test(blob)) return "Illustration";
  return "Painting";
}

function isStockPlatform(institution) {
  const lower = institution.toLowerCase();
  if (/unsplash/.test(lower)) return "unsplash";
  if (/pexels/.test(lower)) return "pexels";
  return null;
}

function isUnknownCreator(artist) {
  return !artist.trim() || /^unknown/i.test(artist.trim());
}

function artistDisplayName(artist) {
  const trimmed = artist.trim();
  if (!trimmed || /^unknown/i.test(trimmed)) return "Unknown artist";
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

export function buildMasterpieceCreditLine(input) {
  const artist = artistDisplayName(input.artist);
  const institution = input.sourceInstitution.trim() || "Open collection";
  const license = licensePhrase(input.license);
  const medium = inferMediumLabel(input);
  const stock = isStockPlatform(institution);

  if (stock === "unsplash") return `Photography by ${artist} • Courtesy of Unsplash`;
  if (stock === "pexels") return `Photo by ${artist} • Licensed via Pexels`;

  if (isUnknownCreator(input.artist)) {
    return `Artwork courtesy of ${normalizeInstitution(institution)} • ${license}`;
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

  if (/commons|wikimedia/i.test(institution)) {
    return `Painting by ${artist} • ${license} via Wikimedia Commons`;
  }

  if (/national gallery|smithsonian|metropolitan|rijksmuseum|art institute|musee|musée|van gogh|nga\.gov/i.test(institution)) {
    return `Painting by ${artist} • ${license} via ${institution}`;
  }

  return `Artwork courtesy of ${normalizeInstitution(institution)} • ${license}`;
}
