/** Decode Commons wiki path segments without throwing on corrupt percent-encoding. */
export function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
