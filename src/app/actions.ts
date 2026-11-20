"use server";

import { InvalidTimezoneError, setLearnerTimezone } from "@/core";
import { requireLearnerContext } from "@/server/learner";

/** Records the browser's timezone so the Learner's days begin and end where they live. */
export async function syncTimezone(timezone: string): Promise<void> {
  try {
    await setLearnerTimezone(await requireLearnerContext(), timezone);
  } catch (error) {
    if (!(error instanceof InvalidTimezoneError)) throw error;
  }
}
