"use client";

import { useState, type FormEvent } from "react";
import { submitFirstItem } from "./actions";

export default function OnboardingForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const result = await submitFirstItem(formData);

    setPending(false);

    if (result && "error" in result) {
      setError(result.error);
    }
    // On success, submitFirstItem redirects to /home on the server —
    // there is nothing else to do here.
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        name="description"
        required
        rows={3}
        placeholder="e.g. an old kayak I haven't used in two summers"
        className="w-full rounded-lg border border-ink/20 bg-white px-4 py-3 outline-none focus:border-terracotta"
      />
      <div>
        <label className="mb-1 block text-sm text-ink/60">
          A photo helps, but it&apos;s optional
        </label>
        <input
          type="file"
          name="photo"
          accept="image/*"
          className="w-full text-sm text-ink/70"
        />
      </div>
      {error && <p className="text-sm text-terracotta">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-ink px-4 py-3 text-cream transition disabled:opacity-50"
      >
        {pending ? "One moment…" : "Tell Kindred"}
      </button>
    </form>
  );
}
