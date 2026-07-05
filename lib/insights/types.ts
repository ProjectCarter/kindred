export type InsightJobStatus = "pending" | "processing" | "completed" | "failed";

export type InsightJob = {
  id: string;
  user_id: string;
  item_id: string;
  status: InsightJobStatus;
  attempts: number;
  last_error: string | null;
};
