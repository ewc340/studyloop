CREATE TABLE "topic_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"from_topic_id" uuid NOT NULL,
	"to_topic_id" uuid NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_link_not_self" CHECK ("topic_link"."from_topic_id" <> "topic_link"."to_topic_id"),
	CONSTRAINT "topic_link_type_check" CHECK ("topic_link"."type" in ('prerequisite_of', 'part_of', 'related_to')),
	CONSTRAINT "topic_link_related_ordered" CHECK ("topic_link"."type" <> 'related_to' or "topic_link"."from_topic_id" < "topic_link"."to_topic_id")
);
--> statement-breakpoint
ALTER TABLE "topic_link" ADD CONSTRAINT "topic_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_link" ADD CONSTRAINT "topic_link_from_topic_id_topic_id_fk" FOREIGN KEY ("from_topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_link" ADD CONSTRAINT "topic_link_to_topic_id_topic_id_fk" FOREIGN KEY ("to_topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "topic_link_from_to_type_key" ON "topic_link" USING btree ("from_topic_id","to_topic_id","type");--> statement-breakpoint
CREATE INDEX "topic_link_to_topic_id_idx" ON "topic_link" USING btree ("to_topic_id");--> statement-breakpoint
CREATE INDEX "topic_link_user_id_idx" ON "topic_link" USING btree ("user_id");