// Job search: Companies and the Applications the Learner pursues at them.
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { LearnerContext } from "./context";
import { application, applicationStatus, applicationStatusChange, company } from "./db/schema";
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
  applications: Application[];
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
  const found = await companyRow(ctx, id);
  const applications = await loadApplications(ctx, eq(application.companyId, found.id));
  return { company: found, applications: applications.map((a) => a.application) };
}

/** Identifies an Application. Branded so other ids can't be passed where an Application is meant. */
export type ApplicationId = string & { readonly __brand: "ApplicationId" };

export function applicationId(id: string): ApplicationId {
  return id as ApplicationId;
}

/** An Application's statuses, in pipeline order. */
export const APPLICATION_STATUSES = applicationStatus.enumValues;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** A calendar date in the Learner's own timezone, as `YYYY-MM-DD`. */
export type LocalDate = string;

export interface Application {
  id: ApplicationId;
  company: Pick<Company, "id" | "name">;
  role: string;
  appliedOn: LocalDate;
  source: string | null;
  link: string | null;
  /** The Application's current status: the last one on its timeline. */
  status: ApplicationStatus;
  /** When the Application took its current status. */
  statusChangedOn: LocalDate;
}

export interface ApplicationDetails {
  role: string;
  appliedOn: LocalDate;
  /** Where the Application came from, e.g. a job board or a referral. */
  source?: string | null;
  /** The job posting. */
  link?: string | null;
}

/** One entry on an Application's timeline: it took this status on this date. */
export interface ApplicationStatusChange {
  status: ApplicationStatus;
  changedOn: LocalDate;
}

export interface ApplicationPage {
  application: Application;
  /** The Application's status changes, oldest first, starting with applied on its applied date. */
  timeline: ApplicationStatusChange[];
}

/** No Application with this id belongs to the acting Learner. */
export class ApplicationNotFoundError extends Error {
  constructor(id: string) {
    super(`Application ${id} not found`);
    this.name = "ApplicationNotFoundError";
  }
}

/** Records an Application under the acting Learner's Company. It starts applied, on its applied date. */
export async function createApplication(
  ctx: LearnerContext,
  companyId: CompanyId,
  input: ApplicationDetails,
): Promise<Application> {
  const owner = await companyRow(ctx, companyId);
  const [row] = await ctx.db
    .insert(application)
    .values({
      userId: ctx.learnerId,
      companyId: owner.id,
      role: input.role,
      appliedOn: input.appliedOn,
      source: input.source,
      link: input.link,
    })
    .returning({ id: application.id });
  return (await applicationPage(ctx, applicationId(row.id))).application;
}

export interface NewApplicationStatus {
  status: ApplicationStatus;
  changedOn: LocalDate;
}

/** Records that the acting Learner's Application took a status on a date, and returns its updated page. */
export async function changeApplicationStatus(
  ctx: LearnerContext,
  id: ApplicationId,
  change: NewApplicationStatus,
): Promise<ApplicationPage> {
  await applicationPage(ctx, id);
  await ctx.db.insert(applicationStatusChange).values({
    userId: ctx.learnerId,
    applicationId: id,
    status: change.status,
    changedOn: change.changedOn,
  });
  return applicationPage(ctx, id);
}

/** The acting Learner's Application and its timeline. */
export async function getApplication(ctx: LearnerContext, id: ApplicationId): Promise<ApplicationPage> {
  return applicationPage(ctx, id);
}

async function applicationPage(ctx: LearnerContext, id: ApplicationId): Promise<ApplicationPage> {
  if (!isUuid(id)) throw new ApplicationNotFoundError(id);
  const [page] = await loadApplications(ctx, eq(application.id, id));
  if (!page) throw new ApplicationNotFoundError(id);
  return page;
}

/** The acting Learner's Applications matching `where`, each with its timeline. */
async function loadApplications(ctx: LearnerContext, where: SQL): Promise<ApplicationPage[]> {
  const rows = await ctx.db
    .select({
      id: application.id,
      companyId: company.id,
      companyName: company.name,
      role: application.role,
      appliedOn: application.appliedOn,
      source: application.source,
      link: application.link,
    })
    .from(application)
    .innerJoin(company, eq(company.id, application.companyId))
    .where(and(eq(application.userId, ctx.learnerId), where));
  if (rows.length === 0) return [];

  const changes = await ctx.db
    .select({
      applicationId: applicationStatusChange.applicationId,
      status: applicationStatusChange.status,
      changedOn: applicationStatusChange.changedOn,
    })
    .from(applicationStatusChange)
    .where(
      and(
        eq(applicationStatusChange.userId, ctx.learnerId),
        inArray(
          applicationStatusChange.applicationId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .orderBy(asc(applicationStatusChange.changedOn), asc(applicationStatusChange.seq));

  return rows.map((row) => {
    const timeline: ApplicationStatusChange[] = [
      { status: "applied", changedOn: row.appliedOn },
      ...changes
        .filter((c) => c.applicationId === row.id)
        .map(({ status, changedOn }) => ({ status, changedOn })),
    ];
    const current = timeline[timeline.length - 1];
    return {
      application: {
        id: applicationId(row.id),
        company: { id: companyId(row.companyId), name: row.companyName },
        role: row.role,
        appliedOn: row.appliedOn,
        source: row.source,
        link: row.link,
        status: current.status,
        statusChangedOn: current.changedOn,
      },
      timeline,
    };
  });
}
