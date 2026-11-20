import { canReportIssues } from "@/core";
import { issueReportingFrom } from "@/server/issue-reporting";
import { currentLearnerContext } from "@/server/learner";
import { IssueReportSheet } from "./issue-report-sheet";

/** The "Report issue" control, shown only to the owner, and only when issue reporting is configured. */
export async function IssueReportControl() {
  const reporting = issueReportingFrom();
  if (!reporting) return null;
  const ctx = await currentLearnerContext();
  if (!ctx || !(await canReportIssues(ctx, reporting))) return null;
  return <IssueReportSheet repository={reporting.repository} />;
}
