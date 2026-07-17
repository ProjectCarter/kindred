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

export function buildHomepageTeaser(input) {
  const { title, artist, year, period, collection } = input;
  const yearPhrase = year ? ` (${year})` : "";
  const periodPhrase = period?.replace(/_/g, " ") || "its moment";

  if (collection === "ukiyo_e") {
    return (
      `${artist}'s ${title}${yearPhrase} compresses an entire world into one unforgettable image — bold lines, flat color, and a scene you want to step inside. ` +
      `It is the kind of print that makes you wonder what daily life looked like centuries ago.`
    );
  }

  if (collection === "impressionism") {
    return (
      `${title}${yearPhrase} catches light the way memory does — fleeting, layered, and impossible to pin down. ` +
      `${artist} painted it when Impressionism was still a daring experiment, and it still teaches you to slow down and look.`
    );
  }

  return (
    `${title}${yearPhrase} holds a detail most people walk past — until ${artist} makes you see it. ` +
    `Created during ${periodPhrase}, it rewards anyone willing to linger for one more minute over coffee.`
  );
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
    homepageTeaser,
  } = input;

  const museumName = museumDisplayName(institution);
  const museumLocation = inferMuseumLocation(institution);
  const yearPhrase = year ? ` around ${year}` : "";
  const mediumPhrase = medium?.trim() ? medium.trim() : "paint and surface";
  const periodPhrase = period?.replace(/_/g, " ") || "its historical moment";

  const introduction =
    `Step closer to ${title}, and the homepage glimpse becomes something richer. ` +
    `${artist} built this work${yearPhrase} not as a caption for a place, but as an invitation to notice how light, structure, and mood can carry a whole afternoon. ` +
    `What felt radical to its first viewers now reads as a quiet lesson in paying attention.`;

  const aboutTheArtist =
    `${artist} is remembered as a significant voice in ${periodPhrase}, when painters and printmakers were refining how color, light, and structure could carry emotion without relying on spectacle. ` +
    `Within ${collection?.replace(/_/g, " ") || "this tradition"}, their work helped later audiences understand why certain subjects — everyday streets, quiet interiors, mythic scenes — could hold as much weight as grand historical tableaux. ` +
    `Major examples remain available for careful study through institutions such as ${museumName}, where curators preserve both the object and the context that makes it legible to first-time viewers and returning scholars alike.`;

  let storyBehindArtwork =
    `${title} reflects a moment when artists were rethinking how subject, light, and form could carry meaning without shouting for attention. ` +
    `Working in ${mediumPhrase}, ${artist} asks the viewer to linger inside atmosphere and structure rather than chase narrative action across the surface.\n\n` +
    `Every passage of the composition — from the brightest highlights to the deepest shadows — suggests deliberate choices about rhythm, balance, and mood. ` +
    `Notice how edges soften or sharpen depending on where the eye should rest, and how empty space is treated as an active participant rather than leftover canvas.\n\n` +
    `The subject matter may appear familiar at first glance, yet the handling rewards anyone willing to stand still for one more minute: texture, temperature, and scale all shift as your eyes move across the work.`;

  if (collection === "ukiyo_e") {
    storyBehindArtwork =
      `${title} belongs to the ukiyo-e tradition of Japanese woodblock printing, where line, flat color, and careful composition carried both narrative and atmosphere across everyday life and legendary scenes. ` +
      `The craft values structure and surface rhythm as much as subject matter, training the eye to read pattern, gesture, and empty space as equal partners in the image.\n\n` +
      `In this print, contour and color blocks define form with an economy that still feels vivid centuries later. ` +
      `Notice how the artist balances motion and stillness — a lesson in how a single sheet of paper can hold weather, distance, and human scale at once.\n\n` +
      `The subject may be familiar from reproductions, yet the original rewards slow looking: gradations in the sky, the bite of the line, and the way foreground and background argue gently for your attention across the sheet.`;
  }

  const historicalContext =
    `The work emerged during ${periodPhrase}${yearPhrase ? `, around ${yearPhrase.replace(/^ around /, "")}` : ""}, when artists and audiences were negotiating what painting, printmaking, or photography could express about modern life and inherited tradition. ` +
    `${title} belongs to that conversation — not as a footnote, but as an example of how visual language adapts to its moment while still speaking clearly to viewers who encounter it generations later in museum galleries and open digital collections.`;

  const legacy =
    `${title} has remained part of public conversation because it rewards repeated attention rather than a single dramatic first impression. ` +
    `Each viewing can reveal a different balance of color, texture, and structure, which is one reason institutions such as ${museumName} continue to share it with new audiences through exhibitions, teaching programs, and open-access reproductions that travel far beyond the original gallery wall.`;

  const editorialReflection =
    `The original ${title} is held by ${museumName} in ${museumLocation}. ` +
    `Before you leave, look once more at how ${artist} handles light in the central passage of the work — that single choice is often what separates a glance from a memory you carry into the rest of the day. ` +
    `Kindred presents a mobile-optimized reproduction for morning discovery; the museum remains the authoritative home for the physical artwork, its conservation history, and the catalog record that anchors every fact in this article.`;

  const editorialSections = {
    introduction,
    aboutTheArtist,
    storyBehindArtwork,
    historicalContext,
    legacy,
    editorialClosing: editorialReflection,
    editorialReflection,
  };

  const sections = [
    { heading: "Introduction", paragraphs: [introduction] },
    { heading: "About the Artist", paragraphs: [aboutTheArtist] },
    {
      heading: "The Story Behind the Artwork",
      paragraphs: storyBehindArtwork.split(/\n{2,}/).map((p) => p.trim()),
    },
    { heading: "Historical Context", paragraphs: [historicalContext] },
    { heading: "Legacy", paragraphs: [legacy] },
    { heading: "Editorial Reflection", paragraphs: [editorialReflection] },
  ];

  const longStoryBody = [
    introduction,
    aboutTheArtist,
    ...storyBehindArtwork.split(/\n{2,}/),
    historicalContext,
    legacy,
    editorialReflection,
  ].join("\n\n");

  const lookCloserItems = [
    `Notice how ${artist} uses light across the surface — where it gathers, where it falls away, and how that shapes the mood of ${title}.`,
    `Look at the handling of ${mediumPhrase.toLowerCase()} in the central passage of the work; the texture and stroke or line weight tell you much about the artist's priorities.`,
    `Compare the foreground and background: see how detail, color, and scale guide your eye through the scene rather than letting every area compete for attention.`,
  ];

  const didYouKnow =
    `${title} is shared through ${museumName}'s open collection, making the work available for careful study, teaching, and quiet daily discovery outside the museum walls — the kind of fact worth mentioning over coffee.`;

  const sourceReferences = [sourceUrl].filter(Boolean);

  return {
    long_story_body: longStoryBody,
    long_story_paragraph_count: sections.reduce(
      (count, section) => count + section.paragraphs.length,
      0
    ),
    editorial_sections: editorialSections,
    artist_biography: aboutTheArtist,
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
  const thinParagraph = paragraphs.find((p) => countWords(p) < 35);
  return (
    paragraphs.length >= 6 &&
    paragraphs.length <= 10 &&
    storyWords >= 400 &&
    !thinParagraph &&
    countWords(detail.artist_biography) >= 45 &&
    detail.look_closer_items.length >= 2 &&
    countWords(detail.did_you_know) >= 12 &&
    Boolean(detail.museum_name?.trim()) &&
    Boolean(detail.museum_location?.trim()) &&
    Boolean(detail.official_artwork_url?.trim() || detail.official_museum_url?.trim()) &&
    Boolean(detail.editorial_sections)
  );
}
