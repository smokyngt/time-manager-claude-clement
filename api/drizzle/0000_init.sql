CREATE TYPE "public"."user_role" AS ENUM('admin', 'employee', 'manager');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"actor_id" uuid,
	"actor_role" text,
	"created_at" bigint NOT NULL,
	"event" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"family_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revoked_at" bigint,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"archived_at" bigint,
	"created_at" bigint NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_name" text NOT NULL,
	"microsoft_id" text,
	"password_hash" text,
	"phone_number" text,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"updated_at" bigint,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_microsoft_id_unique" UNIQUE("microsoft_id")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_created_at_id_idx" ON "users" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_archived_at_idx" ON "users" USING btree ("archived_at");