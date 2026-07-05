"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { saveFirstItem, type SaveFirstItemResult } from "./actions";
import { ONBOARDING_PHASE_MESSAGES } from "@/lib/insights/constants";

type OnboardingFormProps = {
  saveTimeoutMs: number;
};

export default function OnboardingForm({ saveTimeoutMs }: OnboardingFormProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setShowRecovery(false);
    setPending(true);

    const timeoutId = window.setTimeout(() => {
      setShowRecovery(true);
    }, saveTimeoutMs);

    try {
      const formData = new FormData(e.currentTarget);
      const result: SaveFirstItemResult = await saveFirstItem(formData);

      if (result && "error" in result) {
        setError(result.error);
        setPending(false);
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={pending}>
      <div>
        <label htmlFor="description" className="sr-only">
          Describe something you own
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={3}
          disabled={pending}
          placeholder="e.g. an old kayak I haven't used in two summers"
          className="input-field"
        />
      </div>
      <div>
        <label htmlFor="photo" className="mb-1 block text-sm text-ink/60">
          A photo helps, but it&apos;s optional
        </label>
        <input
          id="photo"
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={pending}
          className="w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-sm file:text-ink/80"
        />
      </div>

      {error && (
        <p className="text-sm text-terracotta" role="alert">
          {error}
        </p>
      )}

      {pending && (
        <p className="text-sm text-ink/70" role="status" aria-live="polite">
          {ONBOARDING_PHASE_MESSAGES.saving}
        </p>
      )}

      {showRecovery && pending && (
        <p className="text-sm text-ink/70" role="status">
          This is taking longer than expected. If nothing happens, you can{" "}
          <Link href="/home" className="underline">
            continue to home
          </Link>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn-primary w-full"
      >
        {pending ? ONBOARDING_PHASE_MESSAGES.saving : "Tell Kindred"}
      </button>
    </form>
  );
}
