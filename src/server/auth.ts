// Better Auth configuration: GitHub sign-in, sessions stored in Postgres via the core's tables.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { authTables } from "@/core";
import { sharedDb } from "./core";

export const auth = betterAuth({
  database: drizzleAdapter(sharedDb(), {
    provider: "pg",
    schema: authTables,
  }),
  socialProviders: {
    github: {
      // Presence is enforced at startup (src/server/startup-checks.ts).
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  // We never call GitHub on the Learner's behalf, but encrypt the stored tokens anyway.
  account: { encryptOAuthTokens: true },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, defaultValue: "UTC", input: false },
    },
  },
  plugins: [nextCookies()],
});
