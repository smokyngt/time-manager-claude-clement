CREATE TYPE "public"."clock_source" AS ENUM('clock', 'manual');--> statement-breakpoint
CREATE TYPE "public"."encryption_domain" AS ENUM('content', 'hash', 'pii');--> statement-breakpoint
CREATE TYPE "public"."encryption_status" AS ENUM('active', 'decrypt-only');--> statement-breakpoint
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
CREATE TABLE "clocks" (
	"clocked_in_at" bigint NOT NULL,
	"clocked_out_at" bigint,
	"created_at" bigint NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note" text,
	"source" "clock_source" DEFAULT 'clock' NOT NULL,
	"updated_at" bigint,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encryption_keys" (
	"created_at" bigint NOT NULL,
	"domain" "encryption_domain" NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "encryption_status" DEFAULT 'active' NOT NULL,
	"version" integer NOT NULL,
	"wrapped_key" text NOT NULL
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
CREATE TABLE "team_members" (
	"created_at" bigint NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"archived_at" bigint,
	"created_at" bigint NOT NULL,
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manager_id" uuid NOT NULL,
	"name" text NOT NULL,
	"updated_at" bigint,
	"weekly_hours_target" integer DEFAULT 35 NOT NULL,
	"work_end" text DEFAULT '17:00' NOT NULL,
	"work_start" text DEFAULT '09:00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"archived_at" bigint,
	"created_at" bigint NOT NULL,
	"email" text NOT NULL,
	"email_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_name" text NOT NULL,
	"microsoft_id" text,
	"password_hash" text,
	"phone_number" text,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"updated_at" bigint,
	CONSTRAINT "users_microsoft_id_unique" UNIQUE("microsoft_id")
);
--> statement-breakpoint
ALTER TABLE "clocks" ADD CONSTRAINT "clocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "clocks_created_at_id_idx" ON "clocks" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "clocks_user_id_clocked_in_at_idx" ON "clocks" USING btree ("user_id","clocked_in_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clocks_user_id_open_idx" ON "clocks" USING btree ("user_id") WHERE "clocks"."clocked_out_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "encryption_keys_domain_version_idx" ON "encryption_keys" USING btree ("domain","version");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_members_user_id_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teams_created_at_id_idx" ON "teams" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "teams_manager_id_idx" ON "teams" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "teams_archived_at_idx" ON "teams" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_hash_idx" ON "users" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "users_created_at_id_idx" ON "users" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_archived_at_idx" ON "users" USING btree ("archived_at");