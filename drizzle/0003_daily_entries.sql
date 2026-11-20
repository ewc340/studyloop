CREATE TABLE "daily_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_entry_topic" (
	"daily_entry_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"confidence" smallint NOT NULL,
	CONSTRAINT "daily_entry_topic_daily_entry_id_topic_id_pk" PRIMARY KEY("daily_entry_id","topic_id"),
	CONSTRAINT "daily_entry_topic_confidence_range" CHECK ("daily_entry_topic"."confidence" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "daily_entry" ADD CONSTRAINT "daily_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entry_topic" ADD CONSTRAINT "daily_entry_topic_daily_entry_id_daily_entry_id_fk" FOREIGN KEY ("daily_entry_id") REFERENCES "public"."daily_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entry_topic" ADD CONSTRAINT "daily_entry_topic_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_entry_user_id_date_key" ON "daily_entry" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "daily_entry_topic_topic_id_idx" ON "daily_entry_topic" USING btree ("topic_id");