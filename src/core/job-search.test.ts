import { describe, expect, it } from "vitest";
import {
  changeApplicationStatus,
  companyId,
  CompanyNotFoundError,
  createApplication,
  createCompany,
  findCompanies,
  getApplication,
  getCompany,
  InvalidCompanyError,
  updateCompany,
} from "@/core";
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

    it("needs only a name; surrounding whitespace is dropped", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const company = await createCompany(ada, { name: "  Acme Robotics ", notes: "  " });
      expect(company).toMatchObject({ name: "Acme Robotics", notes: null });
    });

    it("rejects a blank name", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      await expect(createCompany(ada, { name: "  " })).rejects.toBeInstanceOf(InvalidCompanyError);
    });

    it("edits a Company's name and notes", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const acme = await createCompany(ada, { name: "Acme", notes: "Recruiter reached out" });

      const edited = await updateCompany(ada, acme.id, { name: "Acme Robotics", notes: "" });
      expect(edited).toEqual({ id: acme.id, name: "Acme Robotics", notes: null });
      expect((await getCompany(ada, acme.id)).company).toEqual(edited);
      await expect(updateCompany(ada, acme.id, { name: " " })).rejects.toBeInstanceOf(InvalidCompanyError);
    });

    it("lists the Learner's Companies alphabetically, ignoring case", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      for (const name of ["globex", "Acme Robotics", "Initech"]) await createCompany(ada, { name });

      expect((await findCompanies(ada)).map((c) => c.name)).toEqual(["Acme Robotics", "globex", "Initech"]);
    });

    it("never shows or edits another Learner's Company", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const grace = await actingAsNewLearner(core.ctx);
      const acme = await createCompany(ada, { name: "Acme Robotics" });

      expect(await findCompanies(grace)).toEqual([]);
      await expect(getCompany(grace, acme.id)).rejects.toBeInstanceOf(CompanyNotFoundError);
      await expect(updateCompany(grace, acme.id, { name: "Mine now" })).rejects.toBeInstanceOf(CompanyNotFoundError);
      expect((await getCompany(ada, acme.id)).company.name).toBe("Acme Robotics");
    });

    it("is not found for an id that doesn't name a Company", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      await expect(getCompany(ada, companyId("not-a-uuid"))).rejects.toBeInstanceOf(CompanyNotFoundError);
      await expect(updateCompany(ada, companyId("not-a-uuid"), { name: "Acme" })).rejects.toBeInstanceOf(
        CompanyNotFoundError,
      );
    });
  });

  describe("Applications", () => {
    it("records an Application under a Company, applied for on its applied date", async () => {
      const ada = await actingAsNewLearner(core.ctx);
      const acme = await createCompany(ada, { name: "Acme Robotics" });

      const application = await createApplication(ada, acme.id, {
        role: "Backend Engineer",
        appliedOn: "2025-12-20",
        source: "Referral from Sam",
        link: "https://jobs.example.test/acme/backend",
      });

      const expected = {
        id: application.id,
        company: { id: acme.id, name: "Acme Robotics" },
        role: "Backend Engineer",
        appliedOn: "2025-12-20",
        source: "Referral from Sam",
        link: "https://jobs.example.test/acme/backend",
        status: "applied",
        statusChangedOn: "2025-12-20",
      };
      expect(application).toEqual(expected);
      expect(await getApplication(ada, application.id)).toEqual({
        application: expected,
        timeline: [{ status: "applied", changedOn: "2025-12-20" }],
      });
      expect((await getCompany(ada, acme.id)).applications).toEqual([expected]);
    });

    describe("status changes", () => {
      it("are recorded with dates; the timeline shows them in date order, the latest being the current status", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const acme = await createCompany(ada, { name: "Acme Robotics" });
        const { id } = await createApplication(ada, acme.id, { role: "Backend Engineer", appliedOn: "2025-12-01" });

        await changeApplicationStatus(ada, id, { status: "interviewing", changedOn: "2025-12-15" });
        // Backfilled: the screening call was forgotten at the time.
        await changeApplicationStatus(ada, id, { status: "screening", changedOn: "2025-12-05" });

        const page = await getApplication(ada, id);
        expect(page.timeline).toEqual([
          { status: "applied", changedOn: "2025-12-01" },
          { status: "screening", changedOn: "2025-12-05" },
          { status: "interviewing", changedOn: "2025-12-15" },
        ]);
        expect(page.application).toMatchObject({ status: "interviewing", statusChangedOn: "2025-12-15" });
      });

      it("on the same date keep the order they were recorded in", async () => {
        const ada = await actingAsNewLearner(core.ctx);
        const acme = await createCompany(ada, { name: "Acme Robotics" });
        const { id } = await createApplication(ada, acme.id, { role: "Backend Engineer", appliedOn: "2025-12-01" });

        await changeApplicationStatus(ada, id, { status: "offer", changedOn: "2025-12-20" });
        await changeApplicationStatus(ada, id, { status: "withdrawn", changedOn: "2025-12-20" });

        const page = await getApplication(ada, id);
        expect(page.timeline.map((c) => c.status)).toEqual(["applied", "offer", "withdrawn"]);
        expect(page.application.status).toBe("withdrawn");
      });
    });
  });
});
