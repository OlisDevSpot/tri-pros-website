CREATE TYPE "public"."construction_type" AS ENUM('energy-efficient', 'rough-construction', 'finish-construction');--> statement-breakpoint
CREATE TYPE "public"."data_type" AS ENUM('text', 'select', 'number', 'boolean');--> statement-breakpoint
CREATE TYPE "public"."home_area" AS ENUM('bathroom', 'kitchen', 'bedroom', 'living-room', 'dining-room', 'front-yard', 'back-yard', 'side-yard', 'garage', 'attic', 'basement', 'foundation', 'exterior-shell', 'interior-space');--> statement-breakpoint
CREATE TYPE "public"."location" AS ENUM('exterior', 'interior', 'lot');--> statement-breakpoint
CREATE TYPE "public"."media_phase" AS ENUM('before', 'during', 'after', 'main');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('in_progress', 'completed', 'converted');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('general-remodeling', 'energy-efficient');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'approved', 'declined');--> statement-breakpoint
CREATE TYPE "public"."view_source" AS ENUM('email', 'direct', 'unknown');--> statement-breakpoint
CREATE TABLE "addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(80) NOT NULL,
	"accessor" varchar(80) NOT NULL,
	"description" varchar(255),
	"outcome_statement" varchar(255),
	"image_url" varchar(255) NOT NULL,
	"trade_id" integer NOT NULL,
	CONSTRAINT "addons_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notion_contact_id" text,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"city" text NOT NULL,
	"state" varchar(2) DEFAULT 'CA',
	"zip" text NOT NULL,
	"customer_profile_json" jsonb,
	"property_profile_json" jsonb,
	"financial_profile_json" jsonb,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_notion_contact_id_unique" UNIQUE("notion_contact_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"nickname" text,
	"role" text DEFAULT 'homeowner',
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benefit_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"accessor" varchar(80) NOT NULL,
	"label" varchar(80) NOT NULL,
	CONSTRAINT "benefit_categories_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "benefits" (
	"id" serial PRIMARY KEY NOT NULL,
	"accessor" text NOT NULL,
	"content" text NOT NULL,
	"lucide_icon" text,
	"category_id" integer NOT NULL,
	CONSTRAINT "benefits_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "finance_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"accessor" text NOT NULL,
	"sort_order" integer NOT NULL,
	"finance_provider" integer NOT NULL,
	"term_in_months" integer NOT NULL,
	"interest_rate" real NOT NULL,
	CONSTRAINT "finance_options_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "finance_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"accessor" text NOT NULL,
	"logo" text,
	CONSTRAINT "finance_providers_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(80) NOT NULL,
	"accessor" varchar(80) NOT NULL,
	"description" varchar(255),
	"outcome_statement" varchar(255),
	"image_url" varchar(255) NOT NULL,
	"lifespan" integer,
	"warranty" integer,
	CONSTRAINT "materials_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"path_key" text NOT NULL,
	"bucket" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_extension" text NOT NULL,
	"url" varchar(255) NOT NULL,
	"tags" jsonb,
	"is_hero_image" boolean DEFAULT false NOT NULL,
	"phase" "media_phase" DEFAULT 'main' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"duration" integer,
	"thumbnail_url" varchar(255),
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_files_path_key_unique" UNIQUE("path_key")
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"notion_contact_id" text,
	"customer_id" uuid,
	"contact_name" text,
	"program" text,
	"scheduled_for" timestamp with time zone,
	"status" "meeting_status" DEFAULT 'in_progress' NOT NULL,
	"situation_objective_profile_json" jsonb,
	"program_data_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(80) NOT NULL,
	"accessor" varchar(80) NOT NULL,
	"description" varchar(255),
	"backstory" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"address" varchar(255),
	"city" varchar(80) NOT NULL,
	"state" varchar(2) DEFAULT 'CA',
	"zip" varchar(5),
	"ho_requirements" jsonb,
	"homeowner_name" varchar(80),
	"homeowner_quote" text,
	"project_duration" varchar(40),
	"completed_at" timestamp with time zone,
	"challenge_description" text,
	"solution_description" text,
	"result_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(80) NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"owner_id" text NOT NULL,
	"token" text NOT NULL,
	"notion_page_id" text,
	"meeting_id" uuid,
	"form_meta_JSON" jsonb NOT NULL,
	"homeowner_JSON" jsonb NOT NULL,
	"project_JSON" jsonb NOT NULL,
	"funding_JSON" jsonb NOT NULL,
	"finance_option_id" integer,
	"docusign_envelope_id" text,
	"contract_sent_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(80) NOT NULL,
	"accessor" varchar(80) NOT NULL,
	"description" varchar(255),
	"outcome_statement" varchar(255),
	"image_url" varchar(255) NOT NULL,
	"scope_of_work_base" text,
	"home_areas" jsonb NOT NULL,
	"construction_type" "construction_type" NOT NULL,
	"trade_id" integer NOT NULL,
	CONSTRAINT "scopes_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"accessor" text NOT NULL,
	"description" text,
	CONSTRAINT "tags_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(80) NOT NULL,
	"accessor" varchar(80) NOT NULL,
	"description" varchar(255),
	"outcome_statement" varchar(255),
	"image_url" varchar(255) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"location" "location" NOT NULL,
	CONSTRAINT "trades_accessor_unique" UNIQUE("accessor")
);
--> statement-breakpoint
CREATE TABLE "variables" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(80) NOT NULL,
	"label" varchar(80) NOT NULL,
	"data_type" "data_type" NOT NULL,
	"description" varchar(255),
	"options" jsonb,
	CONSTRAINT "variables_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "x_material_benefits" (
	"id" serial PRIMARY KEY NOT NULL,
	"material_id" integer NOT NULL,
	"benefit_id" integer NOT NULL,
	CONSTRAINT "material_id_benefit_id_unique" UNIQUE("material_id","benefit_id")
);
--> statement-breakpoint
CREATE TABLE "x_project_media_files" (
	"project_id" uuid NOT NULL,
	"media_file_id" integer NOT NULL,
	CONSTRAINT "x_project_media_files_project_id_media_file_id_pk" PRIMARY KEY("project_id","media_file_id")
);
--> statement-breakpoint
CREATE TABLE "x_project_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"scope_id" integer NOT NULL,
	"scope_material_id" integer,
	"variables_data" jsonb,
	CONSTRAINT "project_id_scope_id_unique" UNIQUE("project_id","scope_id")
);
--> statement-breakpoint
CREATE TABLE "x_scope_benefits" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope_id" integer NOT NULL,
	"benefit_id" integer NOT NULL,
	CONSTRAINT "scope_id_benefit_id_unique" UNIQUE("scope_id","benefit_id")
);
--> statement-breakpoint
CREATE TABLE "x_scope_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope_id" integer NOT NULL,
	"material_id" integer NOT NULL,
	"is_most_popular" boolean,
	CONSTRAINT "scope_id_material_id_unique" UNIQUE("scope_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "x_scope_variables" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope_id" integer NOT NULL,
	"variable_id" integer NOT NULL,
	CONSTRAINT "scope_id_variable_id_unique" UNIQUE("scope_id","variable_id")
);
--> statement-breakpoint
CREATE TABLE "x_trade_benefits" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"benefit_id" integer NOT NULL,
	CONSTRAINT "trade_id_benefit_id_unique" UNIQUE("trade_id","benefit_id")
);
--> statement-breakpoint
CREATE TABLE "proposal_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"source" "view_source" DEFAULT 'unknown' NOT NULL,
	"referer" text
);
--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benefits" ADD CONSTRAINT "benefits_category_id_benefit_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."benefit_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_options" ADD CONSTRAINT "finance_options_finance_provider_finance_providers_id_fk" FOREIGN KEY ("finance_provider") REFERENCES "public"."finance_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_finance_option_id_finance_options_id_fk" FOREIGN KEY ("finance_option_id") REFERENCES "public"."finance_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scopes" ADD CONSTRAINT "scopes_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_material_benefits" ADD CONSTRAINT "x_material_benefits_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_material_benefits" ADD CONSTRAINT "x_material_benefits_benefit_id_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_project_media_files" ADD CONSTRAINT "x_project_media_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_project_media_files" ADD CONSTRAINT "x_project_media_files_media_file_id_media_files_id_fk" FOREIGN KEY ("media_file_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_project_scopes" ADD CONSTRAINT "x_project_scopes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_project_scopes" ADD CONSTRAINT "x_project_scopes_scope_id_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_project_scopes" ADD CONSTRAINT "x_project_scopes_scope_material_id_x_scope_materials_id_fk" FOREIGN KEY ("scope_material_id") REFERENCES "public"."x_scope_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_scope_benefits" ADD CONSTRAINT "x_scope_benefits_scope_id_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_scope_benefits" ADD CONSTRAINT "x_scope_benefits_benefit_id_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_scope_materials" ADD CONSTRAINT "x_scope_materials_scope_id_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_scope_materials" ADD CONSTRAINT "x_scope_materials_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_scope_variables" ADD CONSTRAINT "x_scope_variables_scope_id_scopes_id_fk" FOREIGN KEY ("scope_id") REFERENCES "public"."scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_scope_variables" ADD CONSTRAINT "x_scope_variables_variable_id_variables_id_fk" FOREIGN KEY ("variable_id") REFERENCES "public"."variables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_trade_benefits" ADD CONSTRAINT "x_trade_benefits_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x_trade_benefits" ADD CONSTRAINT "x_trade_benefits_benefit_id_benefits_id_fk" FOREIGN KEY ("benefit_id") REFERENCES "public"."benefits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_views" ADD CONSTRAINT "proposal_views_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");