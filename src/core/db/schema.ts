// Drizzle table definitions. Auth tables follow Better Auth's core schema; the `user` row is the Learner.
import { sql } from "drizzle-orm";
import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** A Learner. Named `user` because Better Auth owns sign-in for this table. */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** IANA timezone; decides where the Learner's days begin and end. */
  timezone: text("timezone").notNull().default("UTC"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/** A Topic: a named subject or skill a Learner is learning. Names are unique per Learner, ignoring case. */
export const topic = pgTable(
  "topic",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [uniqueIndex("topic_user_id_name_key").on(t.userId, sql`lower(${t.name})`)],
);


/** A Company: an organization the Learner has engaged with as a potential employer. */
export const company = pgTable(
  "company",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("company_user_id_idx").on(t.userId)],
);

/** An Application: the Learner's pursuit of one role at one Company. Its status lives in its status changes. */
export const application = pgTable(
  "application",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    /** The date the Learner applied, in their own timezone; the Application's status is applied from then. */
    appliedOn: date("applied_on", { mode: "string" }).notNull(),
    source: text("source"),
    link: text("link"),
    ...timestamps,
  },
  (t) => [index("application_user_id_idx").on(t.userId), index("application_company_id_idx").on(t.companyId)],
);

export const applicationStatus = pgEnum("application_status", [
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "ghosted",
]);

/** A dated change of an Application's status, after it was applied for. */
export const applicationStatusChange = pgTable(
  "application_status_change",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Orders changes recorded for the same date. */
    seq: integer("seq").generatedAlwaysAsIdentity().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    status: applicationStatus("status").notNull(),
    /** The date the status changed, in the Learner's own timezone. */
    changedOn: date("changed_on", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("application_status_change_application_id_idx").on(t.applicationId)],
);
