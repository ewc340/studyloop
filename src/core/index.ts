// Public interface of the core module. Everything outside src/core imports from here only (enforced by ESLint).

// Context and ports
export { learnerId, type CoreContext, type LearnerContext, type LearnerId } from "./context";
export { systemClock, type Clock } from "./clock";

// Operations
export { getHealth, type Health } from "./health";
export {
  ensureLearner,
  getLearner,
  setLearnerTimezone,
  InvalidTimezoneError,
  LearnerNotFoundError,
  type Learner,
  type NewLearner,
} from "./learner";
export {
  createTopic,
  DuplicateTopicNameError,
  getTopicPage,
  InvalidTopicError,
  type NewTopic, type Topic, type TopicId, type TopicPage } from "./topics";

// Infrastructure for adapters, scripts and the test harness
export { connect, databaseUrl, type Db, type DbHandle } from "./db/client";
export { runMigrations } from "./db/migrate";
export { localDatabaseUrls } from "./db/local";
export { createDatabaseIfMissing, dropDatabase, withDatabaseName } from "./db/admin";
export { authTables } from "./db/auth-tables";
