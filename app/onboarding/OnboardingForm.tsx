"use client";

import { useState, type FormEvent } from "react";
import {
  finishOnboardingInsight,
  saveFirstItem,
  type SaveFirstItemResult,
} from "./actions";
import { ONBOARDING_PHASE_MESSAGES } from "@/lib/insights/constants";

type SubmitPhase = "idle" | "saving" | "thinking";

export default function OnboardingForm() {
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);

  const pending = phase !== "idle";
  const statusMessage =
    phase === "saving"
      ? ONBOARDING_PHASE_MESSAGES.saving
      : phase === "thinking"
        ? ONBOARDING_PHASE_MESSAGES.thinking
        : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPhotoWarning(null);
    setPhase("saving");

    const formData = new FormData(e.currentTarget);
    const result: SaveFirstItemResult = await saveFirstItem(formData);

    if ("error" in result) {
      setPhase("idle");
      setError(result.error);
      return;
    }

    if (result.photoWarning) {
      setPhotoWarning(result.photoWarning);
    }

    setPhase("thinking");

    await finishOnboardingInsight({
      itemId: result.itemId,
      description: result.description,
      hasPhoto: result.hasPhoto,
    });
    // On success, finishOnboardingInsight redirects on the server.
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
          accept="image/*"
          disabled={pending}
          className="w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-sm file:text-ink/80"
        />
      </div>

      {photoWarning && (
        <p className="text-sm text-ink/70" role="status">
          {photoWarning}
        </p>
      )}

      {error && (
        <p className="text-sm text-terracotta" role="alert">
          {error}
        </p>
      )}

      {statusMessage && (
        <p className="text-sm text-ink/70" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn-primary w-full"
      >
        {pending ? statusMessage ?? "One moment…" : "Tell Kindred"}
      </button>
    </form>
  );
}
