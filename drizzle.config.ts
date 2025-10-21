import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  // This is fine locally; on Vercel it just won’t find a file and will no-op.
  path: ".env.local",
});

export default defineConfig({
  // Include BOTH the core schema and the userlog schema so migrations cover Persona/UserLog/PersonaMemory.
  schema: ["./lib/db/schema.ts", "./lib/db/userlog-schema.ts"],
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Support both NEW_POSTGRES_URL (from Neon integration) and POSTGRES_URL
    // biome-ignore lint: Forbidden non-null assertion.
    url: (process.env.NEW_POSTGRES_URL || process.env.POSTGRES_URL)!,
  },
});
