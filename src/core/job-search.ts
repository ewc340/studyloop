// Job search: Companies and the Applications the Learner pursues at them.
import { and, asc, eq } from "drizzle-orm";
import type { LearnerContext } from "./context";
import { company } from "./db/schema";

/** Identifies a Company. Branded so other ids can't be passed where a Company is meant. */
export type CompanyId = string & { readonly __brand: "CompanyId" };

export function companyId(id: string): CompanyId {
  return id as CompanyId;
}

export interface Company {
  id: CompanyId;
  name: string;
  notes: string | null;
}

export interface CompanyDetails {
  name: string;
  notes?: string | null;
}

export interface CompanyPage {
  company: Company;
  applications: never[];
}

/** No Company with this id belongs to the acting Learner. */
export class CompanyNotFoundError extends Error {
  constructor(id: string) {
    super(`Company ${id} not found`);
    this.name = "CompanyNotFoundError";
  }
}

const companyColumns = { id: company.id, name: company.name, notes: company.notes };

function toCompany(row: { id: string; name: string; notes: string | null }): Company {
  return { ...row, id: companyId(row.id) };
}

/** Records a Company for the acting Learner. */
export async function createCompany(ctx: LearnerContext, input: CompanyDetails): Promise<Company> {
  const [row] = await ctx.db
    .insert(company)
    .values({ userId: ctx.learnerId, name: input.name, notes: input.notes })
    .returning(companyColumns);
  return toCompany(row);
}

/** The acting Learner's Company and its Applications. */
export async function getCompany(ctx: LearnerContext, id: CompanyId): Promise<CompanyPage> {
  const [row] = await ctx.db
    .select(companyColumns)
    .from(company)
    .where(and(eq(company.id, id), eq(company.userId, ctx.learnerId)))
    .orderBy(asc(company.name));
  if (!row) throw new CompanyNotFoundError(id);
  return { company: toCompany(row), applications: [] };
}
