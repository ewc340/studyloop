// Drizzle table definitions. Auth tables follow Better Auth's core schema; the `user` row is the Learner.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

/** A Daily Entry: what a Learner worked on and learned on one date. At most one per Learner per date. */
export const dailyEntry = pgTable(
  "daily_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The calendar date, in the Learner's own timezone, the entry is for. */
    date: date("date", { mode: "string" }).notNull(),
    body: text("body").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("daily_entry_user_id_date_key").on(t.userId, t.date)],
);

/** A Topic tagged in a Daily Entry, with the Learner's Confidence (1–5) in it on that date. */
export const dailyEntryTopic = pgTable(
  "daily_entry_topic",
  {
    dailyEntryId: uuid("daily_entry_id")
      .notNull()
      .references(() => dailyEntry.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    confidence: smallint("confidence").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.dailyEntryId, t.topicId] }),
    index("daily_entry_topic_topic_id_idx").on(t.topicId),
    check("daily_entry_topic_confidence_range", sql`${t.confidence} between 1 and 5`),
  ],
);
