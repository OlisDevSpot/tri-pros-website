CREATE TYPE "public"."user_role" AS ENUM('user', 'homeowner', 'agent', 'super-admin');--> statement-breakpoint
ALTER TABLE "media_files" ALTER COLUMN "phase" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "media_files" ALTER COLUMN "phase" SET DEFAULT 'uncategorized'::text;--> statement-breakpoint
DROP TYPE "public"."media_phase";--> statement-breakpoint
CREATE TYPE "public"."media_phase" AS ENUM('uncategorized', 'before', 'during', 'after');--> statement-breakpoint
ALTER TABLE "media_files" ALTER COLUMN "phase" SET DEFAULT 'uncategorized'::"public"."media_phase";--> statement-breakpoint
ALTER TABLE "media_files" ALTER COLUMN "phase" SET DATA TYPE "public"."media_phase" USING "phase"::"public"."media_phase";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "before_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "during_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "after_description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "main_description" text;