import { getEnv } from "@/lib/env";

const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46] },
  { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type PhotoValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function matchesMagicBytes(buffer: Uint8Array, mime: string): boolean {
  const rule = MAGIC_BYTES.find((entry) => entry.mime === mime);
  if (!rule) {
    return false;
  }

  const offset = rule.offset ?? 0;

  if (buffer.length < offset + rule.bytes.length) {
    return false;
  }

  return rule.bytes.every((byte, index) => buffer[offset + index] === byte);
}

export async function validatePhoto(file: File): Promise<PhotoValidationResult> {
  const { PHOTO_MAX_BYTES } = getEnv();

  if (file.size === 0) {
    return { ok: false, error: "That photo file looks empty." };
  }

  if (file.size > PHOTO_MAX_BYTES) {
    return {
      ok: false,
      error: "That photo is too large — please use one under 5 MB.",
    };
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Please upload a JPEG, PNG, WebP, or GIF photo.",
    };
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  if (!matchesMagicBytes(header, file.type)) {
    return {
      ok: false,
      error: "That file doesn't look like a valid photo.",
    };
  }

  return { ok: true };
}
