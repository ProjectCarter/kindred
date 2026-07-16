import { NEWSPAPER_STYLE_RULES } from "../editorialStyle.ts";
import {
  ABOUT_ARTWORK_SENTENCE_MIN,
  ABOUT_ARTWORK_SENTENCE_MAX,
  countWords,
  validateAboutArtworkBody,
} from "./editorial.ts";

export type WriteAboutArtworkInput = {
  artworkTitle: string;
  artist: string;
  year?: string | null;
  sourceInstitution: string;
  sourceUrl?: string | null;
  collectionTitle?: string | null;
  groundingText?: string | null;
  imageDescription?: string | null;
  anthropicApiKey: string;
};

function parseBodyJson(text: string): string {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as { body?: string };
    return parsed.body?.trim() ?? "";
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        const parsed = JSON.parse(fenced[1].trim()) as { body?: string };
        return parsed.body?.trim() ?? "";
      } catch {
        return "";
      }
    }
    return trimmed;
  }
}

export async function writeAboutArtworkBody(
  input: WriteAboutArtworkInput
): Promise<string | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system:
        "You are Kindred's art editor, writing the short 'About Today's Artwork' note " +
        "for a calm morning newspaper masthead. " +
        "Tone: thoughtful, warm, educational, timeless — like a curator speaking over coffee. " +
        "Never marketing, never exclamation points, never 'According to Wikipedia'. " +
        "Write ONLY from the facts provided — do not invent dates, patrons, or provenance. " +
        `${NEWSPAPER_STYLE_RULES} ` +
        "Respond ONLY with valid JSON: {\"body\": string}. " +
        "The body is one paragraph of plain prose (no markdown).",
      messages: [
        {
          role: "user",
          content:
            `Artwork: ${input.artworkTitle}\n` +
            `Artist: ${input.artist}\n` +
            `Year: ${input.year ?? "unknown"}\n` +
            `Source: ${input.sourceInstitution}\n` +
            (input.collectionTitle
              ? `Collection: ${input.collectionTitle}\n`
              : "") +
            (input.imageDescription
              ? `Image description: ${input.imageDescription}\n`
              : "") +
            (input.groundingText
              ? `Reference notes:\n${input.groundingText}\n`
              : "") +
            `\nWrite exactly ${ABOUT_ARTWORK_SENTENCE_MIN}–${ABOUT_ARTWORK_SENTENCE_MAX} complete sentences (plain prose, no markdown) covering:\n` +
            "1) what the artwork is\n" +
            "2) why it became historically important\n" +
            "3) one interesting fact\n" +
            "4) why it is still appreciated today",
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  const body = parseBodyJson(text);
  const validation = validateAboutArtworkBody(body);

  console.log("[heroArtwork] writeAboutArtworkBody", {
    ok: response.ok,
    valid: validation.valid,
    wordCount: validation.wordCount,
    reason: validation.reason ?? null,
  });

  return validation.valid ? body : null;
}
