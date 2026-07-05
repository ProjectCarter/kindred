"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type InsightStatusProps = {
  pending: boolean;
  pollIntervalMs: number;
  pollMaxAttempts: number;
  pollTimeoutMs: number;
};

export default function InsightStatus({
  pending,
  pollIntervalMs,
  pollMaxAttempts,
  pollTimeoutMs,
}: InsightStatusProps) {
  const router = useRouter();

  useEffect(() => {
    if (!pending) {
      return;
    }

    let attempts = 0;
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
      stopped = true;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    async function pollOnce() {
      if (stopped || attempts >= pollMaxAttempts) {
        stopPolling();
        return;
      }

      attempts += 1;

      try {
        await fetch("/api/insights/process", { method: "POST" });
      } catch {
        // Network failures should not stop polling from retrying processing.
      }

      router.refresh();
    }

    void pollOnce();
    intervalId = setInterval(() => {
      void pollOnce();
    }, pollIntervalMs);

    const timeoutId = setTimeout(stopPolling, pollTimeoutMs);

    return () => {
      stopPolling();
      clearTimeout(timeoutId);
    };
  }, [pending, pollIntervalMs, pollMaxAttempts, pollTimeoutMs, router]);

  return null;
}
