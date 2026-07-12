/**
 * One-shot message when a magic-link exchange fails.
 * Root layout sets it; login consumes and displays it.
 */

let pendingAuthLinkError: string | null = null;

export function setAuthLinkError(message: string | null): void {
  pendingAuthLinkError = message;
}

export function consumeAuthLinkError(): string | null {
  const message = pendingAuthLinkError;
  pendingAuthLinkError = null;
  return message;
}
