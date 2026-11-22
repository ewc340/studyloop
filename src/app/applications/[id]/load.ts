import { notFound } from "next/navigation";
import {
  applicationId,
  ApplicationNotFoundError,
  getApplication,
  learnerToday,
  type ApplicationPage,
  type LocalDate,
} from "@/core";
import { requireLearnerContext } from "@/server/learner";

/** The signed-in Learner's Application page and today's date in their timezone, or a 404. */
export async function loadApplicationPage(id: string): Promise<ApplicationPage & { today: LocalDate }> {
  const ctx = await requireLearnerContext();
  try {
    const [page, today] = await Promise.all([getApplication(ctx, applicationId(id)), learnerToday(ctx)]);
    return { ...page, today };
  } catch (error) {
    if (error instanceof ApplicationNotFoundError) notFound();
    throw error;
  }
}
