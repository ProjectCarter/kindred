"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth_failed:
    "That sign-in link didn't work — it may have expired. Try again.",
};

type LoginFormProps = {
  authError?: string;
};

export default function LoginForm({ authError }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    authError ? (AUTH_ERROR_MESSAGES[authError] ?? null) : null
  );
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setPending(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="mb-3 font-serif text-2xl">Check your email</h1>
          <p className="text-ink/70">
            We sent a link to <strong>{email}</strong>. Open it on this
            device to continue.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4"
        aria-busy={pending}
      >
        <h1 className="font-serif text-3xl">Kindred</h1>
        <p className="text-ink/70">
          Hi. Let&apos;s get started — what&apos;s your email?
        </p>
        <div>
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input-field"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        {error && (
          <p id="login-error" className="text-sm text-terracotta" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn-primary w-full"
        >
          {pending ? "Sending…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
