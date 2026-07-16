/**
 * Template masterpiece detail for seed scripts — conservative, metadata-grounded.
 * Keep validation rules in sync with supabase/functions/_shared/heroArtwork/detailEditorial.ts
 */

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function inferMuseumLocation(institution) {
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

function museumDisplayName(institution) {
  if (/wikimedia commons/i.test(institution)) return "Wikimedia Commons";
  return institution.trim();
}

export function buildMasterpieceDetail(input) {
  const {
    title,
    artist,
    year,
    medium,
    period,
    institution,
    sourceUrl,
    collection,
  } = input;

  const museumName = museumDisplayName(institution);
  const museumLocation = inferMuseumLocation(institution);
  const yearPhrase = year ? ` around ${year}` : "";
  const mediumPhrase = medium?.trim() ? medium.trim() : "traditional materials";
  const periodPhrase = period?.replace(/_/g, " ") || "its historical moment";

  const paragraphs = [
    `${title} is a work associated with ${artist}${yearPhrase}. The piece belongs to the visual traditions of ${periodPhrase}, and it has been preserved through ${museumName}'s open collections for study and public appreciation.`,
    `${artist} worked within a period when artists were rethinking how subject, light, and form could carry meaning. ${title} reflects those concerns through its handling of ${mediumPhrase}, inviting the viewer to linger rather than glance.`,
    `When looking at the composition, notice how the artist organizes space and tone. The relationship between foreground and background, together with the direction of light across the surface, gives the scene its particular mood and rhythm.`,
    `Works like this one matter because they connect everyday looking with broader cultural history. They show how an artist responded to the materials, conventions, and questions of a specific era — and why those choices still feel alive to viewers today.`,
    `${title} has remained part of public conversation because it rewards repeated attention. Each viewing can reveal a different balance of color, texture, and structure, which is one reason museum collections continue to share it with new audiences.`,
    `The original work is held by ${museumName} in ${museumLocation}. Kindred presents a mobile-optimized reproduction for morning discovery; the museum remains the authoritative home for the physical artwork and its full catalog record.`,
  ];

  if (collection === "ukiyo_e") {
    paragraphs[1] =
      `${artist} worked within the ukiyo-e tradition of Japanese woodblock printing, where line, flat color, and careful composition carried both narrative and atmosphere. ${title} reflects those craft values through its structure and surface rhythm.`;
    paragraphs[2] =
      "When looking at the print, notice how contour lines define form and how color blocks create depth without Western perspective tricks. The balance between empty space and detail is part of what makes the image breathe.";
  }

  const longStoryBody = paragraphs.join("\n\n");

  const artistBiography =
    `${artist} is remembered as a significant voice in ${periodPhrase}. ` +
    `Their work is preserved and studied through institutions such as ${museumName}, ` +
    `where open-access collections allow readers to encounter major examples without leaving home. ` +
    `Within ${collection?.replace(/_/g, " ") || "this tradition"}, ${artist} helped shape how later audiences understand color, composition, and the everyday subjects artists chose to honor.`;

  const lookCloserItems = [
    `Notice how ${artist} uses light across the surface — where it gathers, where it falls away, and how that shapes the mood of ${title}.`,
    `Look at the handling of ${mediumPhrase.toLowerCase()} in the central passage of the work; the texture and stroke or line weight tell you much about the artist's priorities.`,
    `Compare the foreground and background: see how detail, color, and scale guide your eye through the scene rather than letting every area compete for attention.`,
    `Follow the main diagonal or curve of the composition — ${artist} often uses that movement to slow the eye and keep the viewer inside the image.`,
  ].slice(0, 3);

  const didYouKnow =
    `${title} is shared through ${museumName}'s open collection, ` +
    `which makes the work available for careful study, teaching, and quiet daily discovery outside the museum walls.`;

  const sourceReferences = [sourceUrl].filter(Boolean);

  return {
    long_story_body: longStoryBody,
    long_story_paragraph_count: paragraphs.length,
    artist_biography: artistBiography,
    look_closer_items: lookCloserItems,
    did_you_know: didYouKnow,
    museum_name: museumName,
    museum_location: museumLocation,
    official_museum_url: /wikimedia/i.test(institution)
      ? "https://commons.wikimedia.org/"
      : sourceUrl,
    official_artwork_url: sourceUrl,
    source_references: sourceReferences,
    detail_editorial_status: "approved",
  };
}

export function validateDetailFields(detail) {
  const paragraphs = detail.long_story_body.trim().split(/\n{2,}/);
  const storyWords = countWords(detail.long_story_body);
  return (
    paragraphs.length >= 4 &&
    paragraphs.length <= 8 &&
    storyWords >= 320 &&
    countWords(detail.artist_biography) >= 45 &&
    detail.look_closer_items.length >= 2 &&
    countWords(detail.did_you_know) >= 12 &&
    Boolean(detail.museum_name?.trim()) &&
    Boolean(detail.museum_location?.trim()) &&
    Boolean(detail.official_artwork_url?.trim() || detail.official_museum_url?.trim())
  );
}
