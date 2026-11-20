// Connection strings for the local Docker Compose database (see docker-compose.yml). Dev/test only.
const LOCAL_SERVER = "postgres://studyloop:studyloop@localhost:5432";

export const localDatabaseUrls = {
  dev: `${LOCAL_SERVER}/studyloop`,
  e2e: `${LOCAL_SERVER}/studyloop_e2e`,
  /** Maintenance database, used to create and drop other databases. */
  admin: `${LOCAL_SERVER}/postgres`,
} as const;
