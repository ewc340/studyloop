import { notFound } from "next/navigation";
import { companyId, CompanyNotFoundError, getCompany, type CompanyPage } from "@/core";
import { requireLearnerContext } from "@/server/learner";

/** The signed-in Learner's Company page, or a 404. */
export async function loadCompanyPage(id: string): Promise<CompanyPage> {
  try {
    return await getCompany(await requireLearnerContext(), companyId(id));
  } catch (error) {
    if (error instanceof CompanyNotFoundError) notFound();
    throw error;
  }
}
