ALTER TABLE "x_project_scopes" DROP CONSTRAINT "x_project_scopes_scope_id_scopes_id_fk";
--> statement-breakpoint
ALTER TABLE "x_project_scopes" ALTER COLUMN "scope_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN "notion_contact_id";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "notion_page_id";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "homeowner_JSON";