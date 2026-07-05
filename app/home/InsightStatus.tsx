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

    async function triggerProcessing() {
      await fetch("/api/insights/process", { method: "POST" });
    }

    function stopPolling() {
      stopped = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    }

    void triggerProcessing();
    router.refresh();

    intervalId = setInterval(() => {
      if (stopped || attempts >= pollMaxAttempts) {
        stopPolling();
        return;
      }

      attempts += 1;
      router.refresh();
    }, pollIntervalMs);

    const timeoutId = setTimeout(stopPolling, pollTimeoutMs);

    return () => {
      stopPolling();
      clearTimeout(timeoutId);
    };
  }, [
    pending,
    pollIntervalMs,
    pollMaxAttempts,
    pollTimeoutMs,
    router,
  ]);

  return null;
}
