// Job search: Companies and the Applications the Learner pursues at them.
import { and, asc, eq, sql } from "drizzle-orm";
import type { LearnerContext } from "./context";
import { company } from "./db/schema";
import { isUuid } from "./ids";

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

export class InvalidCompanyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCompanyError";
  }
}

const companyColumns = { id: company.id, name: company.name, notes: company.notes };

function toCompany(row: { id: string; name: string; notes: string | null }): Company {
  return { ...row, id: companyId(row.id) };
}

function companyValues(input: CompanyDetails) {
  const name = input.name.trim();
  if (!name) throw new InvalidCompanyError("A Company needs a name");
  return { name, notes: input.notes?.trim() || null };
}

/** Records a Company for the acting Learner. */
export async function createCompany(ctx: LearnerContext, input: CompanyDetails): Promise<Company> {
  const [row] = await ctx.db
    .insert(company)
    .values({ userId: ctx.learnerId, ...companyValues(input) })
    .returning(companyColumns);
  return toCompany(row);
}

/** Replaces the name and notes of the acting Learner's Company. */
export async function updateCompany(ctx: LearnerContext, id: CompanyId, input: CompanyDetails): Promise<Company> {
  const values = companyValues(input);
  if (!isUuid(id)) throw new CompanyNotFoundError(id);
  const [row] = await ctx.db
    .update(company)
    .set(values)
    .where(and(eq(company.id, id), eq(company.userId, ctx.learnerId)))
    .returning(companyColumns);
  if (!row) throw new CompanyNotFoundError(id);
  return toCompany(row);
}

/** The acting Learner's Companies, alphabetically (ignoring case). */
export async function findCompanies(ctx: LearnerContext): Promise<Company[]> {
  const rows = await ctx.db
    .select(companyColumns)
    .from(company)
    .where(eq(company.userId, ctx.learnerId))
    .orderBy(asc(sql`lower(${company.name})`), asc(company.name));
  return rows.map(toCompany);
}

async function companyRow(ctx: LearnerContext, id: CompanyId): Promise<Company> {
  if (!isUuid(id)) throw new CompanyNotFoundError(id);
  const [row] = await ctx.db
    .select(companyColumns)
    .from(company)
    .where(and(eq(company.id, id), eq(company.userId, ctx.learnerId)));
  if (!row) throw new CompanyNotFoundError(id);
  return toCompany(row);
}

/** The acting Learner's Company and its Applications. */
export async function getCompany(ctx: LearnerContext, id: CompanyId): Promise<CompanyPage> {
  return { company: await companyRow(ctx, id), applications: [] };
}
