// Drizzle table definitions. Auth tables follow Better Auth's core schema; the `user` row is the Learner.
import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

export const topicLinkTypes = ["prerequisite_of", "part_of", "related_to"] as const;

/**
 * A Topic Link: `from` is a prerequisite of / part of / related to `to`. A related-to link is stored
 * with the smaller id first, so the same pair can't be related twice in opposite directions.
 */
export const topicLink = pgTable(
  "topic_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fromTopicId: uuid("from_topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    toTopicId: uuid("to_topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    type: text("type", { enum: topicLinkTypes }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("topic_link_from_to_type_key").on(t.fromTopicId, t.toTopicId, t.type),
    index("topic_link_to_topic_id_idx").on(t.toTopicId),
    index("topic_link_user_id_idx").on(t.userId),
    check("topic_link_not_self", sql`${t.fromTopicId} <> ${t.toTopicId}`),
    check("topic_link_type_check", sql`${t.type} in ('prerequisite_of', 'part_of', 'related_to')`),
    check("topic_link_related_ordered", sql`${t.type} <> 'related_to' or ${t.fromTopicId} < ${t.toTopicId}`),
  ],
);
