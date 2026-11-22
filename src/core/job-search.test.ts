import { describe, expect, it } from "vitest";
import { createCompany, getCompany } from "@/core";
import { useTestContext } from "@/test/core-harness";
import { actingAsNewLearner } from "@/test/learners";

describe("Job search", () => {
  const core = useTestContext();

  describe("Companies", () => {
    it("records a Company with notes", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const acme = await createCompany(ada, { name: "Acme Robotics", notes: "Met their CTO at a meetup" });

      expect(await getCompany(ada, acme.id)).toMatchObject({
        company: { id: acme.id, name: "Acme Robotics", notes: "Met their CTO at a meetup" },
        applications: [],
      });
    });
  });
});
