export async function register() {
  const { validateEnvAtStartup } = await import("@/lib/env");
  validateEnvAtStartup();
}
