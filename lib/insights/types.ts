export type InsightJobStatus = "pending" | "processing" | "completed" | "failed";

export type InsightJob = {
  id: string;
  user_id: string;
  item_id: string;
  status: InsightJobStatus;
  attempts: number;
  last_error: string | null;
  updated_at?: string;
};

export const INSIGHT_JOB_SELECT =
  "id, user_id, item_id, status, attempts, last_error, updated_at";
