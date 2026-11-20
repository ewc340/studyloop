import type { TestProject } from "vitest/node";
import {
  createDatabaseIfMissing,
  dropDatabase,
  localDatabaseUrls,
  runMigrations,
  withDatabaseName,
} from "@/core";

/** Creates a throwaway, migrated database for this test run and drops it afterwards. */
export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL ?? localDatabaseUrls.admin;
  const name = `studyloop_test_${Date.now()}_${process.pid}`;
  const url = withDatabaseName(adminUrl, name);

  try {
    await createDatabaseIfMissing(adminUrl, name);
  } catch (error) {
    throw new Error(`Could not create test database via ${adminUrl}. Is Postgres running? (npm run db:up)`, {
      cause: error,
    });
  }

  try {
    await runMigrations(url);
  } catch (error) {
    await dropDatabase(adminUrl, name);
    throw error;
  }

  project.provide("databaseUrl", url);
  return () => dropDatabase(adminUrl, name);
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
