const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `id` could name a row: ids are UUIDs, and Postgres rejects anything else in a uuid comparison. */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}
