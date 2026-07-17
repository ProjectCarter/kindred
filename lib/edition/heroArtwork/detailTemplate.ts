import type { MasterpieceDetail } from "./types";

export type MasterpieceTemplateInput = {
  artworkTitle: string;
  artist: string;
  year: string | null;
  sourceInstitution: string;
  sourceUrl: string;
  aboutArtworkBody: string;
  collections?: string[];
  medium?: string | null;
};

function inferMuseumLocation(institution: string): string {
  const lower = institution.toLowerCase();
  if (/musée d'orsay|musee d'orsay/.test(lower)) return "Paris, France";
  if (/metropolitan museum|met museum/.test(lower)) return "New York, United States";
  if (/national gallery of art|nga/.test(lower)) return "Washington, D.C., United States";
  if (/rijksmuseum/.test(lower)) return "Amsterdam, Netherlands";
  if (/van gogh museum/.test(lower)) return "Amsterdam, Netherlands";
  if (/art institute of chicago/.test(lower)) return "Chicago, United States";
  if (/smithsonian/.test(lower)) return "Washington, D.C., United States";
  if (/wikimedia commons/.test(lower)) return "Online collection";
  return "Open collection";
}

function museumDisplayName(institution: string): string {
  if (/wikimedia commons/i.test(institution)) return "Wikimedia Commons";
  return institution.trim();
}

function collectionPhrase(collections: string[] | undefined): string {
  const primary = collections?.[0]?.replace(/_/g, " ") ?? "this tradition";
  return primary;
}

/** Homepage teaser when about copy is missing or too thin. */
export function buildHomepageTeaser(input: MasterpieceTemplateInput): string {
  const { artworkTitle, artist, year, collections } = input;
  const yearPhrase = year ? ` (${year})` : "";
  const collection = collections?.[0];

  if (collection === "ukiyo_e") {
    return (
      `${artist}'s ${artworkTitle}${yearPhrase} compresses an entire world into one unforgettable image — bold lines, flat color, and a scene you want to step inside. ` +
      `It makes you wonder what daily life looked like centuries ago.`
    );
  }

  if (collection === "impressionism") {
    return (
      `${artworkTitle}${yearPhrase} catches light the way memory does — fleeting, layered, and impossible to pin down. ` +
      `${artist} painted it when Impressionism was still a daring experiment, and it still teaches you to slow down and look.`
    );
  }

  return (
    `${artworkTitle}${yearPhrase} holds a detail most people walk past — until ${artist} makes you see it. ` +
    `It rewards anyone willing to linger for one more minute over coffee.`
  );
}

/**
 * Deterministic detail article from frozen metadata — not AI, not network.
 * Used when library rows predate detail migrations or edition JSON lacks detail.
 */
export function synthesizeMasterpieceDetail(
  input: MasterpieceTemplateInput
): MasterpieceDetail {
  const {
    artworkTitle: title,
    artist,
    year,
    sourceInstitution: institution,
    sourceUrl,
    collections,
    medium,
  } = input;

  const museumName = museumDisplayName(institution);
  const museumLocation = inferMuseumLocation(institution);
  const yearPhrase = year ? ` around ${year}` : "";
  const mediumPhrase = medium?.trim() || "paint and surface";
  const periodPhrase = collectionPhrase(collections);
  const collection = collections?.[0];

  const introduction =
    `Step closer to ${title}, and the homepage glimpse becomes something richer. ` +
    `${artist} built this work${yearPhrase} not as a caption for a place, but as an invitation to notice how light, structure, and mood can carry a whole afternoon. ` +
    `What felt radical to its first viewers now reads as a quiet lesson in paying attention.`;

  const aboutTheArtist =
    `${artist} is remembered as a significant voice in ${periodPhrase}. ` +
    `Within this tradition, their work helped shape how later audiences understand color, composition, and the subjects artists chose to honor. ` +
    `Major examples remain available for study through institutions such as ${museumName}.`;

  let storyBehindArtwork =
    `${title} reflects a moment when artists were rethinking how subject, light, and form could carry meaning. ` +
    `Working in ${mediumPhrase}, ${artist} asks the viewer to linger inside atmosphere and structure rather than chase narrative action.\n\n` +
    `Every passage of the surface — from the brightest highlights to the deepest shadows — suggests deliberate choices about rhythm, balance, and mood.`;

  if (collection === "ukiyo_e") {
    storyBehindArtwork =
      `${title} belongs to the ukiyo-e tradition of Japanese woodblock printing, where line, flat color, and careful composition carried both narrative and atmosphere. ` +
      `The craft values structure and surface rhythm as much as subject matter.\n\n` +
      `In this print, contour and color blocks define form with an economy that still feels vivid centuries later.`;
  }

  const historicalContext =
    `The work emerged during ${periodPhrase}, when artists and audiences were negotiating what painting, printmaking, or photography could express about modern life. ` +
    `${title} belongs to that conversation — not as a footnote, but as an example of how visual language adapts to its moment.`;

  const legacy =
    `${title} has remained part of public conversation because it rewards repeated attention. ` +
    `Each viewing can reveal a different balance of color, texture, and structure, which is one reason museum collections continue to share it with new audiences.`;

  const editorialReflection =
    `The original ${title} is held by ${museumName} in ${museumLocation}. ` +
    `Before you leave, look once more at how ${artist} handles light in the central passage of the work — that single choice is often what separates a glance from a memory. ` +
    `Kindred presents a mobile-optimized reproduction for morning discovery; the museum remains the authoritative home for the physical artwork and its full catalog record.`;

  const lookingCloser = [
    `Notice how ${artist} uses light across the surface — where it gathers, where it falls away, and how that shapes the mood of ${title}.`,
    `Look at the handling of ${mediumPhrase.toLowerCase()} in the central passage of the work; the texture and stroke or line weight tell you much about the artist's priorities.`,
    `Compare the foreground and background: see how detail, color, and scale guide your eye through the scene rather than letting every area compete for attention.`,
  ];

  const didYouKnow =
    `${title} is shared through ${museumName}'s open collection, making the work available for careful study, teaching, and quiet daily discovery outside the museum walls — the kind of fact worth mentioning over coffee.`;

  return {
    sections: [
      { heading: "Introduction", paragraphs: [introduction] },
      { heading: "About the Artist", paragraphs: [aboutTheArtist] },
      {
        heading: "The Story Behind the Artwork",
        paragraphs: storyBehindArtwork.split(/\n{2,}/).map((p) => p.trim()),
      },
      { heading: "Historical Context", paragraphs: [historicalContext] },
      { heading: "Legacy", paragraphs: [legacy] },
      { heading: "Editorial Reflection", paragraphs: [editorialReflection] },
    ],
    lookingCloser,
    didYouKnow,
    museumName,
    museumLocation,
    officialMuseumUrl: /wikimedia/i.test(institution)
      ? "https://commons.wikimedia.org/"
      : sourceUrl?.trim() || null,
    officialArtworkUrl: sourceUrl?.trim() || null,
    sourceReferences: sourceUrl?.trim() ? [sourceUrl.trim()] : [],
  };
}

export function isFrozenDetailComplete(
  detail: MasterpieceDetail | null | undefined
): boolean {
  if (!detail?.sections?.length) return false;
  if ((detail.lookingCloser?.length ?? 0) < 2) return false;
  if (!detail.didYouKnow?.trim()) return false;
  return true;
}
