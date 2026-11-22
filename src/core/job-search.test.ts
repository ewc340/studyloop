import { describe, expect, it } from "vitest";
import {
  companyId,
  CompanyNotFoundError,
  createCompany,
  findCompanies,
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
});
