CREATE TYPE "public"."application_status" AS ENUM('applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'ghosted');--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"role" text NOT NULL,
	"applied_on" date NOT NULL,
	"source" text,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_status_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" integer GENERATED ALWAYS AS IDENTITY (sequence name "application_status_change_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"status" "application_status" NOT NULL,
	"changed_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_change" ADD CONSTRAINT "application_status_change_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_change" ADD CONSTRAINT "application_status_change_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_user_id_idx" ON "application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "application_company_id_idx" ON "application" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "application_status_change_application_id_idx" ON "application_status_change" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "company_user_id_idx" ON "company" USING btree ("user_id");