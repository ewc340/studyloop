import postgres from "postgres";

/** Returns the URL of database `name` on the same server as `url`. */
export function withDatabaseName(url: string, name: string): string {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
}

function assertSafeName(name: string) {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unsafe database name: ${name}`);
}

async function withAdmin<T>(adminUrl: string, fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

export async function createDatabaseIfMissing(adminUrl: string, name: string): Promise<void> {
  assertSafeName(name);
  await withAdmin(adminUrl, async (sql) => {
    const exists = await sql`select 1 from pg_database where datname = ${name}`;
    if (exists.length === 0) await sql.unsafe(`create database ${name}`);
  });
}

export async function dropDatabase(adminUrl: string, name: string): Promise<void> {
  assertSafeName(name);
  await withAdmin(adminUrl, (sql) => sql.unsafe(`drop database if exists ${name} with (force)`));
}
