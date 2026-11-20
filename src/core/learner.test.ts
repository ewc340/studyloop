import { describe, expect, it } from "vitest";
import { ensureLearner, getLearner, InvalidTimezoneError, learnerId, LearnerNotFoundError, setLearnerTimezone } from "@/core";
import { useTestContext } from "@/test/core-harness";
import { actingAsNewLearner } from "@/test/learners";

describe("Learner", () => {
  const core = useTestContext();

  it("returns the acting Learner, defaulting to UTC", async () => {
    const ada = await actingAsNewLearner(core.ctx, { name: "Ada" });
    const learner = await getLearner(ada);
    expect(learner).toMatchObject({ id: ada.learnerId, name: "Ada", timezone: "UTC" });
  });

  it("sets the acting Learner's timezone", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    const learner = await setLearnerTimezone(ada, "America/Los_Angeles");
    expect(learner.timezone).toBe("America/Los_Angeles");
  });

  it("rejects a timezone that isn't a real IANA zone", async () => {
    const ada = await actingAsNewLearner(core.ctx);
    await expect(setLearnerTimezone(ada, "Mars/Olympus_Mons")).rejects.toBeInstanceOf(InvalidTimezoneError);
  });

  it("ensureLearner is idempotent", async () => {
    const first = await ensureLearner(core.ctx, { id: "same", name: "First", email: "same@example.test" });
    await ensureLearner(core.ctx, { id: "same", name: "Second", email: "same@example.test" });
    expect((await getLearner(first)).name).toBe("First");
  });

  it("fails clearly for a Learner who doesn't exist", async () => {
    const ghost = { ...core.ctx, learnerId: learnerId("nobody") };
    await expect(getLearner(ghost)).rejects.toBeInstanceOf(LearnerNotFoundError);
    await expect(setLearnerTimezone(ghost, "UTC")).rejects.toBeInstanceOf(LearnerNotFoundError);
  });

  describe("scoping", () => {
    it("one Learner can neither see nor change another Learner's records", async () => {
      const ada = await actingAsNewLearner(core.ctx, { name: "Ada" });
      const grace = await actingAsNewLearner(core.ctx, { name: "Grace" });

      await setLearnerTimezone(ada, "Asia/Tokyo");

      // Each Learner reads only themselves...
      expect(await getLearner(ada)).toMatchObject({ id: ada.learnerId, name: "Ada", timezone: "Asia/Tokyo" });
      expect(await getLearner(grace)).toMatchObject({ id: grace.learnerId, name: "Grace" });
      // ...and Ada's write didn't touch Grace.
      expect((await getLearner(grace)).timezone).toBe("UTC");
    });
  });
});
