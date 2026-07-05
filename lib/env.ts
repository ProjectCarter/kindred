import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).optional(),
  AI_PROVIDER: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  INSIGHT_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10),
  INSIGHT_MAX_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  INSIGHT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  INSIGHT_POLL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(20),
  INSIGHT_POLL_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  ONBOARDING_SAVE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PHOTO_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  INSIGHT_PROCESSING_STALE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(120000),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function validateEnvAtStartup(): void {
  const isProduction = process.env.NODE_ENV === "production";

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    if (isProduction) {
      throw new Error(
        "Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    return;
  }

  const env = getEnv();

  if (isProduction && !env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required in production for insight generation."
    );
  }
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
