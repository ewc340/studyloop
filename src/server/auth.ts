// Better Auth configuration: GitHub sign-in, sessions stored in Postgres via the core's tables.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { tables } from "@/core";
import { sharedDb } from "./core";

export const auth = betterAuth({
  database: drizzleAdapter(sharedDb(), {
    provider: "pg",
    schema: { user: tables.user, session: tables.session, account: tables.account, verification: tables.verification },
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, defaultValue: "UTC", input: false },
    },
  },
  plugins: [nextCookies()],
});
