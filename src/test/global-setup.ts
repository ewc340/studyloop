import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { runMigrations } from "@/core/db/migrate";

const ADMIN_DEFAULT = "postgres://studyloop:studyloop@localhost:5432/postgres";

/** Creates a throwaway, migrated database for this test run and drops it afterwards. */
export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL ?? ADMIN_DEFAULT;
  const name = `studyloop_test_${Date.now()}_${process.pid}`;
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });

  try {
    await admin.unsafe(`create database ${name}`);
  } catch (error) {
    await admin.end();
    throw new Error(
      `Could not create test database via ${adminUrl}. Is Postgres running? (npm run db:up)\n${error}`,
    );
  }

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  await runMigrations(url.toString());
  project.provide("databaseUrl", url.toString());

  return async () => {
    await admin.unsafe(`drop database if exists ${name} with (force)`);
    await admin.end();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
