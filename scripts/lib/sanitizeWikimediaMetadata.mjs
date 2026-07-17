/**
 * Strip Wikimedia/Wikidata machine syntax — keep in sync with
 * supabase/functions/_shared/heroArtwork/sanitizeMetadata.ts
 */

const WIKIDATA_BLOCK_SPLIT =
  /\s+(?:title|label|description|aliases?)\s+QS:/i;
const WIKIDATA_QS_SPLIT = /\bQS:/i;
const TRUNCATED_METADATA_TAIL = /\blabe[….…]+\s*/gi;

export function stripHtml(text) {
  return String(text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function containsWikidataSyntax(text) {
  if (!text?.trim()) return false;
  return (
    /\bQS:/i.test(text) ||
    /\blabel\s+QS:/i.test(text) ||
    /\btitle\s+QS:/i.test(text) ||
    /,\s*en:"/i.test(text) ||
    /,\s*[a-z]{2,3}:"/i.test(text)
  );
}

function extractQuotedEnglishLabel(raw) {
  const en = raw.match(/,\s*en:"([^"]+)"/i);
  if (en?.[1]?.trim()) return en[1].trim();
  const label = raw.match(/(?:title|label)\s+QS:P\d+[^"]*"([^"]+)"/i);
  if (label?.[1]?.trim()) return label[1].trim();
  return null;
}

export function stripWikidataMarkup(raw) {
  if (!raw?.trim()) return "";
  let text = stripHtml(raw);
  const quoted = extractQuotedEnglishLabel(text);
  if (quoted) return quoted.replace(TRUNCATED_METADATA_TAIL, " ").trim();
  text = text.split(WIKIDATA_BLOCK_SPLIT)[0] ?? text;
  text = text.split(WIKIDATA_QS_SPLIT)[0] ?? text;
  return text.replace(TRUNCATED_METADATA_TAIL, " ").replace(/\s+/g, " ").trim();
}

export function parseTitleFromFilePageTitle(filePageTitle) {
  if (!filePageTitle?.trim()) return null;
  let name = filePageTitle.replace(/^File:/i, "").trim();
  name = name.replace(/\.(jpe?g|png|webp|gif)$/i, "").trim();
  const parts = name.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const titlePart = stripWikidataMarkup(parts[1]);
    if (titlePart.length >= 4 && !containsWikidataSyntax(titlePart)) return titlePart;
  }
  return null;
}

export function sanitizeArtworkTitle(raw, hints = {}) {
  const objectName = hints.objectName?.trim();
  if (objectName) {
    const fromObject = stripWikidataMarkup(objectName);
    if (fromObject.length >= 4 && !containsWikidataSyntax(fromObject)) {
      return fromObject.length > 140 ? `${fromObject.slice(0, 137)}…` : fromObject;
    }
  }
  if (raw?.trim()) {
    const quoted = extractQuotedEnglishLabel(raw);
    if (quoted && quoted.length >= 4) {
      return quoted.length > 140 ? `${quoted.slice(0, 137)}…` : quoted;
    }
    const stripped = stripWikidataMarkup(raw);
    if (stripped.length >= 4 && !containsWikidataSyntax(stripped)) {
      return stripped.length > 140 ? `${stripped.slice(0, 137)}…` : stripped;
    }
  }
  const fromFile = parseTitleFromFilePageTitle(hints.filePageTitle);
  if (fromFile) return fromFile.length > 140 ? `${fromFile.slice(0, 137)}…` : fromFile;
  return "Untitled artwork";
}

export function sanitizeArtistName(raw, filePageTitle) {
  const text = stripWikidataMarkup(stripHtml(raw ?? ""));
  if (text.length >= 2 && !/^unknown/i.test(text) && !containsWikidataSyntax(text)) {
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  }
  if (filePageTitle) {
    let name = filePageTitle.replace(/^File:/i, "").trim();
    const parts = name.split(/\s*[-–—]\s*/);
    const artist = stripWikidataMarkup(parts[0]?.replace(/_/g, " ") ?? "");
    if (artist.length >= 2) return artist;
  }
  return "Unknown artist";
}

export function parseArtworkYearFromText(text) {
  const raw = text ?? "";
  const clean = stripWikidataMarkup(raw);
  if (!clean.trim()) return null;
  const prop = raw.match(/QS:P(\d+)/i);
  const single = clean.match(/(?:^|[^\d])(1[0-9]{3}|20[0-1][0-9])(?:[^\d]|$)/);
  if (!single?.[1]) return null;
  if (prop && prop[1] === single[1]) return null;
  return single[1];
}

export function sanitizeArtworkYear(year, context = {}) {
  const stored = year?.trim();
  const rawContext = [context.title, context.imageDescription, context.filePageTitle]
    .filter(Boolean)
    .join(" ");
  if (stored) {
    const prop = rawContext.match(/QS:P(\d+)/i);
    if (prop && prop[1] === stored) {
      return parseArtworkYearFromText(
        [context.imageDescription, context.filePageTitle].filter(Boolean).join(" ")
      );
    }
    if (!containsWikidataSyntax(stored)) return stored;
  }
  return parseArtworkYearFromText(
    [context.imageDescription, context.filePageTitle, context.title].filter(Boolean).join(" ")
  );
}
