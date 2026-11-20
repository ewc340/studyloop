import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/core";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/core/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl(),
  },
});
