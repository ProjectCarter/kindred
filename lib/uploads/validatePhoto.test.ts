import { describe, expect, it, beforeEach } from "vitest";
import { getEnv, resetEnvCacheForTests } from "@/lib/env";
import { validatePhoto } from "@/lib/uploads/validatePhoto";

function makeFile(
  bytes: number[],
  type: string,
  sizeOverride?: number
): File {
  const buffer = new Uint8Array(sizeOverride ?? bytes.length);
  buffer.set(bytes.slice(0, Math.min(bytes.length, buffer.length)));
  return new File([buffer], "photo.jpg", { type });
}

describe("validatePhoto", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.PHOTO_MAX_BYTES = "1048576";
  });

  it("accepts a valid JPEG", async () => {
    const file = makeFile([0xff, 0xd8, 0xff, 0x00], "image/jpeg");
    await expect(validatePhoto(file)).resolves.toEqual({ ok: true });
  });

  it("rejects unsupported mime types", async () => {
    const file = makeFile([0x25, 0x50, 0x44, 0x46], "application/pdf");
    const result = await validatePhoto(file);
    expect(result.ok).toBe(false);
  });

  it("rejects files over the size limit", async () => {
    const file = makeFile([0xff, 0xd8, 0xff], "image/jpeg", 2_000_000);
    const result = await validatePhoto(file);
    expect(result.ok).toBe(false);
  });

  it("rejects mismatched magic bytes", async () => {
    const file = makeFile([0x89, 0x50, 0x4e, 0x47], "image/jpeg");
    const result = await validatePhoto(file);
    expect(result.ok).toBe(false);
  });
});
