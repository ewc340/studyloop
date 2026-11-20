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
  findOrCreateTopic,
  findTopics,
  getTopicPage,
  InvalidTopicError,
  topicId,
  TopicNotFoundError,
  type NewTopic,
  type Topic,
  type TopicId,
  type TopicPage,
  type TopicSearch,
  type TopicTimelineEntry,
} from "./topics";

// Infrastructure for adapters, scripts and the test harness
export { connect, databaseUrl, type Db, type DbHandle } from "./db/client";
export { runMigrations } from "./db/migrate";
export { localDatabaseUrls } from "./db/local";
export { createDatabaseIfMissing, dropDatabase, withDatabaseName } from "./db/admin";
export { authTables } from "./db/auth-tables";
export {
  canReportIssues,
  inMemoryIssueTracker,
  InvalidIssueReportError,
  IssueTrackerError,
  ISSUE_REPORT_LIMITS,
  NotIssueReporterError,
  previewIssueReport,
  reportIssue,
  type InMemoryIssueTracker,
  type IssueDraft,
  type IssueReport,
  type IssueReportImage,
  type IssueReporting,
  type IssueReportPreview,
  type IssueReportPage,
  type IssueReportType,
  type IssueTracker,
  type IssueTrackerFailure,
  type ReportedIssue,
} from "./issue-reports";
