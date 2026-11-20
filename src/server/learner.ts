// Resolves the signed-in Learner for a request and builds the LearnerContext core operations need.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ensureLearner, learnerId, type LearnerContext } from "@/core";
import { auth } from "./auth";
import { coreContext } from "./core";
import { bypassLearnerIdFrom } from "./test-auth-bypass";

/** The signed-in Learner's context, or a redirect to sign-in. */
export async function requireLearnerContext(): Promise<LearnerContext> {
  const requestHeaders = await headers();

  const bypassId = bypassLearnerIdFrom(requestHeaders);
  if (bypassId) {
    return ensureLearner(coreContext(), { id: bypassId, name: "E2E Learner", email: `${bypassId}@e2e.test` });
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) redirect("/sign-in");
  return { ...coreContext(), learnerId: learnerId(session.user.id) };
}
