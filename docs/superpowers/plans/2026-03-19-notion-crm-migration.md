# Notion CRM Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transfer ownership of lead intake and contact management from Notion into the app — building a token-authenticated public intake form, migrating existing Notion contacts to Postgres, and removing Notion from the meeting creation flow.

**Architecture:** New schema tables (`lead_sources`, `customer_notes`) + 3 new columns on `customers`. A public `/intake/[token]` route resolves form configuration from a `lead_sources` DB record. `meetings.create` accepts `customerId` (Postgres UUID) directly, removing all Notion API calls from meeting creation. A standalone migration script does a one-time read-only Notion sync (including mp3 download + R2 re-upload).

**Tech Stack:** Next.js 15 App Router · tRPC `baseProcedure` (public) + `agentProcedure` (auth) · Drizzle ORM + Postgres (Neon) · `@vis.gl/react-google-maps` (already installed) · `@upstash/ratelimit` + `@upstash/redis` (new) · `nanoid` (new) · Cloudflare R2 (existing service) · `nuqs` for `?customerId` prefill param

---

## Branch & Context

- **Branch:** `migrating-notion` (already created, already checked out)
- **Spec:** `docs/superpowers/specs/2026-03-19-notion-crm-migration-design.md`
- **Working directory:** project root (`/home/olis-solutions/olis-v3/nextjs/tri-pros-website`)
- **Package manager:** `pnpm`
- **Path alias:** `@/` → `src/`
- **Key rules (non-negotiable):**
  - ONE React component per file, named exports only
  - No barrel files in `ui/components/`, `ui/views/`, `constants/`, `hooks/`, `lib/`, `dal/`
  - pgEnums ONLY in `src/shared/db/schema/meta.ts`
  - Const arrays in `src/shared/constants/enums/<domain>.ts`
  - TS types from const arrays in `src/shared/types/enums/<domain>.ts`
  - No `Record<string, unknown>` for typed JSONB fields — always use `.$type<T>()`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/shared/constants/enums/leads.ts` | `leadSources` + `leadTypes` const arrays |
| `src/shared/types/enums/leads.ts` | `LeadSource` + `LeadType` TS types |
| `src/shared/entities/lead-sources/schemas.ts` | `LeadSourceFormConfig` Zod schema + type |
| `src/shared/db/schema/lead-sources.ts` | Drizzle `lead_sources` table |
| `src/shared/db/schema/customer-notes.ts` | Drizzle `customer_notes` table |
| `src/trpc/routers/intake.router.ts` | `getByToken`, `getInternalUsers`, `getRecordingUploadUrl` |
| `src/features/intake/schemas/intake-form-schema.ts` | Zod schema for public intake form |
| `src/features/intake/ui/views/intake-form-view.tsx` | Client form component |
| `src/features/intake/ui/components/address-autocomplete-field.tsx` | Google Places input + static map |
| `src/features/intake/ui/components/mp3-upload-field.tsx` | R2 mp3 upload UI |
| `src/features/intake/ui/components/meeting-scheduler-field.tsx` | Datetime picker + agent select |
| `src/shared/components/customer-search.tsx` | Search-or-prefill customer selector |
| `src/app/(frontend)/(site)/intake/[token]/page.tsx` | Public intake page (SSR token validation) |
| `scripts/migrate-notion-contacts.ts` | One-time Notion → Postgres sync |
| `scripts/seed-lead-sources.ts` | Seeds 4 initial `lead_sources` rows |

### Modified files
| File | Change |
|---|---|
| `src/shared/config/client-env.ts` | Fix `.optional` → `.optional()` |
| `src/shared/config/server-env.ts` | Add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| `src/shared/services/r2/buckets.ts` | Add `telemarketingRecordings`; `R2_PUBLIC_DOMAINS` → `Partial<Record>` |
| `src/shared/constants/enums/index.ts` | Add `export * from './leads'` |
| `src/shared/types/enums/index.ts` | Add `export * from './leads'` |
| `src/shared/db/schema/meta.ts` | Add `leadSourceEnum`, `leadTypeEnum` |
| `src/shared/db/schema/customers.ts` | Add 3 columns + `leadMetaJSON` JSONB override |
| `src/shared/entities/customers/schemas.ts` | Add `leadMetaSchema` + `LeadMeta` |
| `src/shared/db/schema/index.ts` | Export `lead-sources`, `customer-notes` |
| `src/trpc/routers/app.ts` | Register `intakeRouter` |
| `src/trpc/routers/customers.router.ts` | Add `search`, `createFromIntake` procedures |
| `src/trpc/routers/meetings.router.ts` | Remove Notion dependency from `create` |
| `src/trpc/routers/notion.router/index.ts` | Remove `contacts` sub-router |
| `src/features/meetings/ui/views/create-meeting-view.tsx` | Swap `NotionContactSearch` → `CustomerSearch` |
| `src/features/meetings/ui/views/meeting-flow.tsx` | Remove Notion contact re-fetch |
| `src/features/meetings/ui/components/edit-contact-form.tsx` | Swap `NotionContactSearch` → `CustomerSearch` |

### Deleted files
| File | Reason |
|---|---|
| `src/trpc/routers/notion.router/contacts.router.ts` | Replaced by `customersRouter.search` |
| `src/shared/components/notion/contact-search.tsx` | Replaced by `CustomerSearch` |

---

## Phase 1 — Housekeeping & Dependencies

### Task 1: Fix env bugs and install new packages

**Files:**
- Modify: `src/shared/config/client-env.ts`
- Modify: `src/shared/config/server-env.ts`

- [ ] **Step 1: Fix the missing `()` on `.optional` in client-env.ts**

```ts
// src/shared/config/client-env.ts
// BEFORE:
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional,
// AFTER:
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
```

- [ ] **Step 2: Add Upstash Redis env vars to server-env.ts**

In `src/shared/config/server-env.ts`, add to the schema object under the `// UPSTASH` comment:
```ts
// UPSTASH
QSTASH_URL: z.string(),
QSTASH_TOKEN: z.string(),
QSTASH_CURRENT_SIGNING_KEY: z.string(),
QSTASH_NEXT_SIGNING_KEY: z.string(),
UPSTASH_REDIS_REST_URL: z.string(),
UPSTASH_REDIS_REST_TOKEN: z.string(),
```

- [ ] **Step 3: Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your `.env` file**

Get these from the Upstash console (create a Redis database if you don't have one, separate from QStash). Add:
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

- [ ] **Step 4: Install new packages**
```bash
pnpm add @upstash/ratelimit @upstash/redis nanoid
```

- [ ] **Step 5: Verify lint passes**
```bash
pnpm lint
```
Expected: no new errors

- [ ] **Step 6: Commit**
```bash
git add src/shared/config/client-env.ts src/shared/config/server-env.ts package.json pnpm-lock.yaml
git commit -m "chore: fix env bugs, install ratelimit/redis/nanoid"
```

---

### Task 2: Update R2 buckets

**Files:**
- Modify: `src/shared/services/r2/buckets.ts`

- [ ] **Step 1: Update the file**

```ts
// src/shared/services/r2/buckets.ts
export const R2_BUCKETS = {
  portfolioProjects: 'tpr-portfolio-projects',
  companyDocs: 'tpr-company-docs',
  telemarketingRecordings: 'tpr-telemarketing-recordings',
} as const

export type R2BucketName = (typeof R2_BUCKETS)[keyof typeof R2_BUCKETS]

// Partial — not all buckets have a public domain (telemarketingRecordings is private)
export const R2_PUBLIC_DOMAINS: Partial<Record<R2BucketName, string>> = {
  'tpr-portfolio-projects': 'https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev',
  'tpr-company-docs': 'https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev',
}
```

- [ ] **Step 2: Check for callers of `R2_PUBLIC_DOMAINS` that assumed non-partial**
```bash
grep -r "R2_PUBLIC_DOMAINS" src/ --include="*.ts" --include="*.tsx"
```

If any callers use `R2_PUBLIC_DOMAINS[bucket]` without null-check, add `?? ''` or a null guard there.

- [ ] **Step 3: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 4: Commit**
```bash
git add src/shared/services/r2/buckets.ts
git commit -m "feat(r2): add telemarketingRecordings bucket, make public domains partial"
```

---

## Phase 2 — Schema & Entities

### Task 3: Lead enums (const arrays, TS types, pgEnums)

**Files:**
- Create: `src/shared/constants/enums/leads.ts`
- Create: `src/shared/types/enums/leads.ts`
- Modify: `src/shared/constants/enums/index.ts`
- Modify: `src/shared/types/enums/index.ts`
- Modify: `src/shared/db/schema/meta.ts`

- [ ] **Step 1: Create const arrays**

```ts
// src/shared/constants/enums/leads.ts
export const leadSources = [
  'telemarketing_leads_philippines',
  'noy',
  'quoteme',
  'other',
] as const

export const leadTypes = [
  'appointment_set',       // contact comes in with a meeting already scheduled
  'needs_confirmation',    // lead captured, meeting not yet confirmed
  'manual',                // manually added by an agent
] as const
```

- [ ] **Step 2: Create TS types**

```ts
// src/shared/types/enums/leads.ts
import type { leadSources, leadTypes } from '@/shared/constants/enums/leads'

export type LeadSource = (typeof leadSources)[number]
export type LeadType = (typeof leadTypes)[number]
```

- [ ] **Step 3: Add barrel exports**

In `src/shared/constants/enums/index.ts`, add:
```ts
export * from './leads'
```

In `src/shared/types/enums/index.ts`, add:
```ts
export * from './leads'
```

- [ ] **Step 4: Add pgEnums to meta.ts**

In `src/shared/db/schema/meta.ts`, add to imports:
```ts
import { leadSources, leadTypes } from '@/shared/constants/enums'
```

Add to the bottom of the file:
```ts
// LEADS
export const leadSourceEnum = pgEnum('lead_source', leadSources)
export const leadTypeEnum = pgEnum('lead_type', leadTypes)
```

- [ ] **Step 5: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 6: Commit**
```bash
git add src/shared/constants/enums/leads.ts src/shared/types/enums/leads.ts \
  src/shared/constants/enums/index.ts src/shared/types/enums/index.ts \
  src/shared/db/schema/meta.ts
git commit -m "feat(schema): add leadSource and leadType enums"
```

---

### Task 4: `LeadMeta` entity schema + customers table columns

**Files:**
- Modify: `src/shared/entities/customers/schemas.ts`
- Modify: `src/shared/db/schema/customers.ts`

- [ ] **Step 1: Add `leadMetaSchema` to the customer entity schemas**

In `src/shared/entities/customers/schemas.ts`, add at the bottom:
```ts
export const leadMetaSchema = z.object({
  mp3RecordingKey: z.string().optional(), // Cloudflare R2 object key for call recording
})
export type LeadMeta = z.infer<typeof leadMetaSchema>
```

- [ ] **Step 2: Add 3 new columns and JSONB override to customers.ts**

In `src/shared/db/schema/customers.ts`:

Add to imports:
```ts
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import type { LeadMeta } from '@/shared/entities/customers/schemas'
import { leadSourceEnum, leadTypeEnum } from './meta'
```

Add columns to the `customers` table definition (after `financialProfileJSON`):
```ts
leadSource: leadSourceEnum('lead_source'),
leadType: leadTypeEnum('lead_type'),
leadMetaJSON: jsonb('lead_meta_json').$type<LeadMeta>(),
```

Update `insertCustomerSchema` override to include `leadMetaJSON`:
```ts
export const insertCustomerSchema = createInsertSchema(customers, {
  customerProfileJSON: customerProfileSchema.optional(),
  propertyProfileJSON: propertyProfileSchema.optional(),
  financialProfileJSON: financialProfileSchema.optional(),
  leadMetaJSON: leadMetaSchema.optional(),  // ← ADD THIS LINE
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
```

- [ ] **Step 3: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 4: Commit**
```bash
git add src/shared/entities/customers/schemas.ts src/shared/db/schema/customers.ts
git commit -m "feat(schema): add leadSource, leadType, leadMetaJSON columns to customers"
```

---

### Task 5: `LeadSourceFormConfig` entity schema

**Files:**
- Create: `src/shared/entities/lead-sources/schemas.ts`

- [ ] **Step 1: Create entity schema**

```ts
// src/shared/entities/lead-sources/schemas.ts
import z from 'zod'
import { leadTypes } from '@/shared/constants/enums'

export const leadSourceFormConfigSchema = z.object({
  leadType: z.enum(leadTypes),
  showEmail: z.boolean(),
  requireEmail: z.boolean(),
  showMeetingScheduler: z.boolean(),
  requireMeetingScheduler: z.boolean(),
  showMp3Upload: z.boolean(),
  showNotes: z.boolean(),
})

export type LeadSourceFormConfig = z.infer<typeof leadSourceFormConfigSchema>
```

- [ ] **Step 2: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 3: Commit**
```bash
git add src/shared/entities/lead-sources/schemas.ts
git commit -m "feat(entities): add LeadSourceFormConfig schema"
```

---

### Task 6: `lead_sources` and `customer_notes` tables + schema index

**Files:**
- Create: `src/shared/db/schema/lead-sources.ts`
- Create: `src/shared/db/schema/customer-notes.ts`
- Modify: `src/shared/db/schema/index.ts`

- [ ] **Step 1: Create lead_sources schema**

```ts
// src/shared/db/schema/lead-sources.ts
import type z from 'zod'
import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

export const leadSources = pgTable('lead_sources', {
  id,
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  token: text('token').notNull().unique(),
  formConfigJSON: jsonb('form_config_json').$type<LeadSourceFormConfig>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt,
  updatedAt,
})

export const selectLeadSourceSchema = createSelectSchema(leadSources, {
  formConfigJSON: leadSourceFormConfigSchema,
})
export type LeadSource = z.infer<typeof selectLeadSourceSchema>

export const insertLeadSourceSchema = createInsertSchema(leadSources, {
  formConfigJSON: leadSourceFormConfigSchema,
}).omit({ id: true, createdAt: true, updatedAt: true })
export type InsertLeadSource = z.infer<typeof insertLeadSourceSchema>
```

> **Warning:** `leadSources` is already used as the const array name in `src/shared/constants/enums/leads.ts`. The table variable is also `leadSources`. This will cause a name collision if both are imported in the same file. Use a named import alias when needed: `import { leadSources as leadSourcesTable } from '@/shared/db/schema/lead-sources'`.

- [ ] **Step 2: Create customer_notes schema**

```ts
// src/shared/db/schema/customer-notes.ts
import type z from 'zod'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'

export const customerNotes = pgTable('customer_notes', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
})

export const selectCustomerNoteSchema = createSelectSchema(customerNotes)
export type CustomerNote = z.infer<typeof selectCustomerNoteSchema>

export const insertCustomerNoteSchema = createInsertSchema(customerNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertCustomerNote = z.infer<typeof insertCustomerNoteSchema>
```

- [ ] **Step 3: Add exports to schema index**

In `src/shared/db/schema/index.ts`, add (keeping the `/* eslint-disable perfectionist/sort-exports */` comment at top):
```ts
export * from './customer-notes'
export * from './lead-sources'
```

- [ ] **Step 4: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 5: Commit**
```bash
git add src/shared/db/schema/lead-sources.ts src/shared/db/schema/customer-notes.ts \
  src/shared/db/schema/index.ts
git commit -m "feat(schema): add lead_sources and customer_notes tables"
```

---

### Task 7: Push schema to database

- [ ] **Step 1: Push the schema**
```bash
pnpm db:push
```
Expected: Drizzle prints the new tables and columns it's creating. Confirm the prompt.

- [ ] **Step 2: Verify the schema pushed correctly**

Check that you see these new tables in the output:
- `lead_sources` (6 columns)
- `customer_notes` (6 columns)
- 3 new columns on `customers`: `lead_source`, `lead_type`, `lead_meta_json`
- 2 new enum types: `lead_source`, `lead_type`

- [ ] **Step 3: Commit nothing** — db:push doesn't generate migration files in this project

---

### Task 8: Seed lead_sources

**Files:**
- Create: `scripts/seed-lead-sources.ts`

- [ ] **Step 1: Create the seed script**

```ts
// scripts/seed-lead-sources.ts
import { nanoid } from 'nanoid'
import { db } from '../src/shared/db'
import { leadSources as leadSourcesTable } from '../src/shared/db/schema/lead-sources'

const INITIAL_SOURCES = [
  {
    name: 'Telemarketing Leads - Philippines',
    slug: 'telemarketing_leads_philippines',
    formConfigJSON: {
      leadType: 'appointment_set' as const,
      showEmail: false,
      requireEmail: false,
      showMeetingScheduler: true,
      requireMeetingScheduler: true,
      showMp3Upload: true,
      showNotes: false,
    },
  },
  {
    name: 'Noy',
    slug: 'noy',
    formConfigJSON: {
      leadType: 'needs_confirmation' as const,
      showEmail: true,
      requireEmail: false,
      showMeetingScheduler: false,
      requireMeetingScheduler: false,
      showMp3Upload: false,
      showNotes: true,
    },
  },
  {
    name: 'QuoteMe',
    slug: 'quoteme',
    formConfigJSON: {
      leadType: 'needs_confirmation' as const,
      showEmail: true,
      requireEmail: false,
      showMeetingScheduler: false,
      requireMeetingScheduler: false,
      showMp3Upload: false,
      showNotes: true,
    },
  },
  {
    name: 'Other',
    slug: 'other',
    formConfigJSON: {
      leadType: 'manual' as const,
      showEmail: true,
      requireEmail: false,
      showMeetingScheduler: true,
      requireMeetingScheduler: false,
      showMp3Upload: false,
      showNotes: true,
    },
  },
]

async function main() {
  for (const source of INITIAL_SOURCES) {
    const existing = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where((t: any) => t.slug.eq(source.slug))
      .limit(1)

    if (existing.length > 0) {
      console.log(`⏭  Skipping "${source.name}" — already exists`)
      continue
    }

    const token = nanoid(21)
    await db.insert(leadSourcesTable).values({ ...source, token })
    console.log(`✅ Seeded "${source.name}" with token: ${token}`)
    console.log(`   URL: /intake/${token}`)
  }

  console.log('\nDone. Store these tokens securely — they are permanent.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

> **Correction note on the where clause:** Drizzle's `select().where()` uses `eq(table.col, value)`. Update the `.where` above to:
> ```ts
> import { eq } from 'drizzle-orm'
> .where(eq(leadSourcesTable.slug, source.slug))
> ```
> (The pseudo-code above uses a shorthand for clarity; use the real Drizzle API.)

- [ ] **Step 2: Run the seed**
```bash
pnpm tsx scripts/seed-lead-sources.ts
```
Expected: 4 lines of `✅ Seeded "..." with token: ...` and 4 URLs. **Copy the tokens — they are the shareable intake URLs.**

- [ ] **Step 3: Commit**
```bash
git add scripts/seed-lead-sources.ts
git commit -m "feat(scripts): add seed-lead-sources script"
```

---

## Phase 3 — API Layer

### Task 9: `intakeRouter` — token validation, internal users, recording upload

**Files:**
- Create: `src/trpc/routers/intake.router.ts`
- Modify: `src/trpc/routers/app.ts`

- [ ] **Step 1: Create intake router**

```ts
// src/trpc/routers/intake.router.ts
import { TRPCError } from '@trpc/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { eq, inArray } from 'drizzle-orm'
import z from 'zod'
import { db } from '@/shared/db'
import { leadSources as leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { user } from '@/shared/db/schema/auth'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'
import { getPresignedUploadUrl } from '@/shared/services/r2/get-presigned-upload-url'
import { R2_BUCKETS } from '@/shared/services/r2/buckets'
import env from '@/shared/config/server-env'
import { baseProcedure, createTRPCRouter } from '../init'

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

const uploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'intake:upload',
})

export const intakeRouter = createTRPCRouter({
  // Validates a lead source token and returns form configuration
  getByToken: baseProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const [row] = await db
        .select()
        .from(leadSourcesTable)
        .where(eq(leadSourcesTable.token, input.token))
        .limit(1)

      if (!row || !row.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'This link is no longer active.' })
      }

      const formConfig = leadSourceFormConfigSchema.parse(row.formConfigJSON)

      return {
        leadSourceSlug: row.slug,
        leadSourceName: row.name,
        formConfig,
      }
    }),

  // Returns all internal users (agents + super-admins) for "Closed By" dropdown
  getInternalUsers: baseProcedure
    .query(async () => {
      const internalUsers = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.role, ['agent', 'super-admin']))

      return internalUsers
    }),

  // Returns a presigned R2 upload URL for a call recording
  getRecordingUploadUrl: baseProcedure
    .input(z.object({
      contentType: z.enum(['audio/mpeg', 'audio/mp4']),
    }))
    .mutation(async ({ input, ctx }) => {
      // Rate limit by IP
      const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
      const { success } = await uploadRatelimit.limit(ip)

      if (!success) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many upload attempts. Please try again later.',
        })
      }

      const timestamp = Date.now()
      const key = `recordings/${timestamp}-${crypto.randomUUID()}.mp3`

      const uploadUrl = await getPresignedUploadUrl({
        bucket: R2_BUCKETS.telemarketingRecordings,
        pathKey: key,
        mimeType: input.contentType,
        expiresIn: 900, // 15 minutes
      })

      return { uploadUrl, key }
    }),
})
```

- [ ] **Step 2: Register in app.ts**

In `src/trpc/routers/app.ts`:

Add import:
```ts
import { intakeRouter } from './intake.router'
```

Add to the router object:
```ts
intakeRouter,
```

- [ ] **Step 3: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 4: Commit**
```bash
git add src/trpc/routers/intake.router.ts src/trpc/routers/app.ts
git commit -m "feat(trpc): add intakeRouter (getByToken, getInternalUsers, getRecordingUploadUrl)"
```

---

### Task 10: `customersRouter` — add `search` and `createFromIntake`

**Files:**
- Modify: `src/trpc/routers/customers.router.ts`

- [ ] **Step 1: Add `search` procedure**

In `src/trpc/routers/customers.router.ts`:

Add to imports:
```ts
import { ilike, or } from 'drizzle-orm'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { leadSources, leadTypes } from '@/shared/constants/enums'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import env from '@/shared/config/server-env'
import { baseProcedure } from '../init'
```

Add `search` procedure to the router:
```ts
search: agentProcedure
  .input(z.object({ query: z.string().min(1) }))
  .query(async ({ input }) => {
    const q = `%${input.query}%`
    return db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        address: customers.address,
      })
      .from(customers)
      .where(or(ilike(customers.name, q), ilike(customers.phone, q)))
      .limit(10)
  }),
```

- [ ] **Step 2: Add `createFromIntake` procedure**

Add to the same router (below `search`):

```ts
createFromIntake: baseProcedure
  .input(z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    address: z.string().optional(),
    city: z.string().min(1),
    state: z.string().length(2).optional(),
    zip: z.string().min(1),
    email: z.string().email().optional(),
    notes: z.string().optional(),
    leadSource: z.enum(leadSources),   // import leadSources from '@/shared/constants/enums'
    leadType: z.enum(leadTypes),       // import leadTypes from '@/shared/constants/enums'
    leadMetaJSON: leadMetaSchema.optional(),
    scheduledFor: z.string().optional(),
    closedById: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const { notes, scheduledFor, closedById, ...customerData } = input

    // Rate limit by IP
    const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
    const { success } = await intakeRatelimit.limit(ip)
    if (!success) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
    }

    // 1. Insert customer
    const [customer] = await db
      .insert(customers)
      .values({ ...customerData, zip: customerData.zip || '' })
      .returning()

    if (!customer) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create customer' })
    }

    // 2. Insert note (if provided) — failure is non-fatal
    if (notes) {
      await db.insert(customerNotes).values({
        customerId: customer.id,
        content: notes,
        authorId: null,
      }).catch((e) => console.error('Note insert failed (non-fatal):', e))
    }

    // 3. Insert meeting (if scheduler provided) — failure is non-fatal
    if (scheduledFor && closedById) {
      await db.insert(meetings).values({
        customerId: customer.id,
        ownerId: closedById,
        scheduledFor,
        status: 'in_progress',
      }).catch((e) => console.error('Meeting insert failed (non-fatal):', e))
    }

    return { customerId: customer.id }
  }),
```

Also add the rate limiter instance before the router definition:
```ts
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

const intakeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'intake:submit',
})
```

Add missing imports to `customers.router.ts`:
```ts
import { meetings } from '@/shared/db/schema/meetings'
import { leadSources, leadTypes } from '@/shared/constants/enums'
```

- [ ] **Step 3: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 4: Commit**
```bash
git add src/trpc/routers/customers.router.ts
git commit -m "feat(trpc): add customersRouter.search and createFromIntake"
```

---

### Task 11: Simplify `meetings.create` — remove Notion dependency

**Files:**
- Modify: `src/trpc/routers/meetings.router.ts`

- [ ] **Step 1: Remove Notion imports and rewrite `create`**

Remove these 3 imports from `meetings.router.ts`:
```ts
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { upsertCustomerFromNotion } from '@/shared/dal/server/customers/api'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'
```

Replace the `create` procedure:
```ts
create: agentProcedure
  .input(insertMeetingSchema.extend({
    customerId: z.string().uuid('A customer is required'),
  }))
  .mutation(async ({ ctx, input }) => {
    const { customerId, ...meetingData } = input

    const [created] = await db
      .insert(meetings)
      .values({ ...meetingData, ownerId: ctx.session.user.id, customerId })
      .returning()

    return created
  }),
```

- [ ] **Step 2: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 3: Commit**
```bash
git add src/trpc/routers/meetings.router.ts
git commit -m "feat(meetings): remove Notion dependency from meetings.create"
```

---

## Phase 4 — Customer Search Component

### Task 12: `CustomerSearch` component

**Files:**
- Create: `src/shared/components/customer-search.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/shared/components/customer-search.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { CheckIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTRPC } from '@/trpc/helpers'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface CustomerSearchProps {
  onSelect: (id: string, name: string) => void
  onClear: () => void
  prefillCustomerId?: string
}

export function CustomerSearch({ onSelect, onClear, prefillCustomerId }: CustomerSearchProps) {
  const trpc = useTRPC()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedName, setSelectedName] = useState('')

  // Pre-populated mode: fetch customer by ID on mount
  const prefillQuery = useQuery(
    trpc.customersRouter.getById.queryOptions(
      { customerId: prefillCustomerId ?? '' },
      { enabled: !!prefillCustomerId && !selectedId },
    ),
  )

  useEffect(() => {
    if (prefillQuery.data && !selectedId) {
      setSelectedId(prefillQuery.data.id)
      setSelectedName(prefillQuery.data.name)
      onSelect(prefillQuery.data.id, prefillQuery.data.name)
    }
  }, [prefillQuery.data, selectedId, onSelect])

  const searchQuery = useQuery(
    trpc.customersRouter.search.queryOptions(
      { query },
      { enabled: query.length >= 2 && !selectedId },
    ),
  )

  function handleSelect(id: string, name: string) {
    setSelectedId(id)
    setSelectedName(name)
    setQuery('')
    onSelect(id, name)
  }

  function handleClear() {
    setSelectedId('')
    setSelectedName('')
    setQuery('')
    onClear()
  }

  if (selectedId) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <CheckIcon className="size-4 shrink-0 text-primary" />
        <span className="flex-1 text-sm font-medium">{selectedName}</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={handleClear}>
          <XIcon className="size-3" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-1">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by name or phone…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      {query.length >= 2 && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
          {searchQuery.isLoading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          )}
          {searchQuery.data?.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No customers found.</p>
          )}
          {searchQuery.data?.map(c => (
            <button
              key={c.id}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted/50"
              onClick={() => handleSelect(c.id, c.name)}
            >
              <span className="text-sm font-medium">{c.name}</span>
              {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 3: Commit**
```bash
git add src/shared/components/customer-search.tsx
git commit -m "feat(components): add CustomerSearch (search + prefill modes)"
```

---

## Phase 5 — Intake Form UI

### Task 13: Intake form schema

**Files:**
- Create: `src/features/intake/schemas/intake-form-schema.ts`

- [ ] **Step 1: Create schema**

```ts
// src/features/intake/schemas/intake-form-schema.ts
import z from 'zod'

export const intakeFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Phone is required'),
  address: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2).optional(),
  zip: z.string().min(3, 'ZIP is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().optional(),
  scheduledFor: z.string().optional(),
  closedById: z.string().optional(),
  mp3Key: z.string().optional(),     // R2 key after upload completes
  _honeypot: z.string().max(0, 'Bot detected').optional(),
})

export type IntakeFormValues = z.infer<typeof intakeFormSchema>
```

- [ ] **Step 2: Commit**
```bash
git add src/features/intake/schemas/intake-form-schema.ts
git commit -m "feat(intake): add intake form Zod schema"
```

---

### Task 14: `AddressAutocompleteField` component

**Files:**
- Create: `src/features/intake/ui/components/address-autocomplete-field.tsx`

> This component uses `@vis.gl/react-google-maps` which is already installed. The `APIProvider` must be rendered above this component in the tree. It uses `usePlacesAutocomplete` from the library.

- [ ] **Step 1: Create the component**

```tsx
// src/features/intake/ui/components/address-autocomplete-field.tsx
'use client'

import { Map, useMapsLibrary } from '@vis.gl/react-google-maps'
import { MapPinIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'

interface AddressFields {
  address: string
  city: string
  state: string
  zip: string
}

interface AddressAutocompleteFieldProps {
  onChange: (fields: AddressFields) => void
  onClear: () => void
}

interface LatLng { lat: number, lng: number }

export function AddressAutocompleteField({ onChange, onClear }: AddressAutocompleteFieldProps) {
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const [resolvedLoc, setResolvedLoc] = useState<LatLng | null>(null)
  const [displayValue, setDisplayValue] = useState('')

  useEffect(() => {
    if (!placesLib || !inputRef.current) return

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address', 'geometry'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.address_components) return

      const get = (type: string) =>
        place.address_components?.find(c => c.types.includes(type))?.long_name ?? ''
      const getShort = (type: string) =>
        place.address_components?.find(c => c.types.includes(type))?.short_name ?? ''

      const streetNumber = get('street_number')
      const route = get('route')
      const address = [streetNumber, route].filter(Boolean).join(' ')
      const city = get('locality') || get('sublocality') || get('administrative_area_level_2')
      const state = getShort('administrative_area_level_1')
      const zip = get('postal_code')

      if (place.geometry?.location) {
        setResolvedLoc({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        })
      }

      setDisplayValue(place.formatted_address ?? address)
      onChange({ address, city, state, zip })
    })

    return () => placesLib.event.clearInstanceListeners(autocomplete)
  }, [placesLib, onChange])

  function handleClear() {
    setDisplayValue('')
    setResolvedLoc(null)
    if (inputRef.current) inputRef.current.value = ''
    onClear()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <MapPinIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="pl-8 pr-8"
          placeholder="Start typing an address…"
          value={displayValue}
          onChange={e => setDisplayValue(e.target.value)}
        />
        {displayValue && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1/2 size-6 -translate-y-1/2"
            onClick={handleClear}
          >
            <XIcon className="size-3" />
          </Button>
        )}
      </div>

      {resolvedLoc && (
        <div className="h-[200px] overflow-hidden rounded-lg border border-border md:h-[240px]">
          <Map
            center={resolvedLoc}
            zoom={16}
            gestureHandling="none"
            disableDefaultUI
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 3: Commit**
```bash
git add src/features/intake/ui/components/address-autocomplete-field.tsx
git commit -m "feat(intake): add AddressAutocompleteField with static map preview"
```

---

### Task 15: `Mp3UploadField` component

**Files:**
- Create: `src/features/intake/ui/components/mp3-upload-field.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/features/intake/ui/components/mp3-upload-field.tsx
'use client'

import { useMutation } from '@tanstack/react-query'
import { MicIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

interface Mp3UploadFieldProps {
  onUploaded: (key: string) => void
  onClear: () => void
}

export function Mp3UploadField({ onUploaded, onClear }: Mp3UploadFieldProps) {
  const trpc = useTRPC()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')

  const getUploadUrl = useMutation(
    trpc.intakeRouter.getRecordingUploadUrl.mutationOptions(),
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      toast.error('Only .mp3 files are accepted')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File must be under 100 MB')
      return
    }

    try {
      const { uploadUrl, key } = await getUploadUrl.mutateAsync({ contentType: 'audio/mpeg' })
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
      setFileName(file.name)
      onUploaded(key)
      toast.success('Recording uploaded')
    }
    catch {
      toast.error('Upload failed. Please try again.')
    }
  }

  function handleClear() {
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
    onClear()
  }

  if (fileName) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <MicIcon className="size-4 shrink-0 text-primary" />
        <span className="flex-1 truncate text-sm">{fileName}</span>
        <Button size="icon" variant="ghost" className="size-6" onClick={handleClear}>
          <XIcon className="size-3" />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,audio/mpeg"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        className="w-full gap-2"
        disabled={getUploadUrl.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <MicIcon className="size-4" />
        {getUploadUrl.isPending ? 'Preparing upload…' : 'Attach call recording (.mp3)'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 3: Commit**
```bash
git add src/features/intake/ui/components/mp3-upload-field.tsx
git commit -m "feat(intake): add Mp3UploadField with presigned R2 upload"
```

---

### Task 16: `MeetingSchedulerField` component

**Files:**
- Create: `src/features/intake/ui/components/meeting-scheduler-field.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/features/intake/ui/components/meeting-scheduler-field.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { CalendarIcon } from 'lucide-react'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

interface MeetingSchedulerFieldProps {
  scheduledFor: string
  closedById: string
  onDateChange: (iso: string) => void
  onAgentChange: (id: string) => void
  required?: boolean
}

export function MeetingSchedulerField({
  scheduledFor,
  closedById,
  onDateChange,
  onAgentChange,
  required = false,
}: MeetingSchedulerFieldProps) {
  const trpc = useTRPC()

  const agentsQuery = useQuery(
    trpc.intakeRouter.getInternalUsers.queryOptions(),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">
          Appointment Date & Time
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <DateTimePicker
          value={scheduledFor ? new Date(scheduledFor) : undefined}
          onChange={d => onDateChange(d?.toISOString() ?? '')}
          placeholder="Select date & time"
          className="w-full justify-start border border-input bg-background px-3 py-2 h-9 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">
          Closed By
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <Select value={closedById} onValueChange={onAgentChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select agent…">
              <CalendarIcon className="mr-2 size-3.5 text-muted-foreground" />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {agentsQuery.data?.map(agent => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 3: Commit**
```bash
git add src/features/intake/ui/components/meeting-scheduler-field.tsx
git commit -m "feat(intake): add MeetingSchedulerField (datetime + agent select)"
```

---

### Task 17: `IntakeFormView` — main form

**Files:**
- Create: `src/features/intake/ui/views/intake-form-view.tsx`

- [ ] **Step 1: Create the view**

```tsx
// src/features/intake/ui/views/intake-form-view.tsx
'use client'

import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import type { LeadSource, LeadType } from '@/shared/types/enums'
import { APIProvider } from '@vis.gl/react-google-maps'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddressAutocompleteField } from '@/features/intake/ui/components/address-autocomplete-field'
import { MeetingSchedulerField } from '@/features/intake/ui/components/meeting-scheduler-field'
import { Mp3UploadField } from '@/features/intake/ui/components/mp3-upload-field'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import clientEnv from '@/shared/config/client-env'
import { useTRPC } from '@/trpc/helpers'

interface IntakeFormViewProps {
  leadSourceSlug: LeadSource
  formConfig: LeadSourceFormConfig
  leadSourceName: string
}

export function IntakeFormView({ leadSourceSlug, formConfig, leadSourceName }: IntakeFormViewProps) {
  const trpc = useTRPC()
  const [submitted, setSubmitted] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [closedById, setClosedById] = useState('')
  const [mp3Key, setMp3Key] = useState('')
  const [honeypot, setHoneypot] = useState('')

  const submit = useMutation(
    trpc.customersRouter.createFromIntake.mutationOptions({
      onSuccess: () => setSubmitted(true),
      onError: (err) => toast.error(err.message),
    }),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (honeypot) return // bot detected

    if (!name || !phone || !city || !zip) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formConfig.requireMeetingScheduler && (!scheduledFor || !closedById)) {
      toast.error('Appointment date and agent are required')
      return
    }

    submit.mutate({
      name,
      phone,
      email: email || undefined,
      address: address || undefined,
      city,
      state: state || undefined,
      zip,
      notes: notes || undefined,
      leadSource: leadSourceSlug as LeadSource,
      leadType: formConfig.leadType as LeadType,
      leadMetaJSON: mp3Key ? { mp3RecordingKey: mp3Key } : undefined,
      scheduledFor: scheduledFor || undefined,
      closedById: closedById || undefined,
    })
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-2xl font-semibold">Contact Added ✓</p>
        <p className="text-muted-foreground">The lead has been successfully submitted.</p>
      </div>
    )
  }

  return (
    <APIProvider apiKey={clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">New Lead — {leadSourceName}</h1>

        {/* Honeypot — hidden from real users */}
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="absolute -top-[9999px] left-0 opacity-0"
          value={honeypot}
          onChange={e => setHoneypot(e.target.value)}
        />

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
          <Input id="name" required value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
          <Input id="phone" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} />
        </div>

        {/* Email (conditional) */}
        {formConfig.showEmail && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">
              Email
              {formConfig.requireEmail && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <Input
              id="email"
              type="email"
              required={formConfig.requireEmail}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        )}

        {/* Address */}
        <div className="flex flex-col gap-1.5">
          <Label>Address <span className="text-destructive">*</span></Label>
          <AddressAutocompleteField
            onChange={(fields) => {
              setAddress(fields.address)
              setCity(fields.city)
              setState(fields.state)
              setZip(fields.zip)
            }}
            onClear={() => {
              setAddress('')
              setCity('')
              setState('')
              setZip('')
            }}
          />
        </div>

        {/* MP3 upload (conditional) */}
        {formConfig.showMp3Upload && (
          <div className="flex flex-col gap-1.5">
            <Label>Call Recording (optional)</Label>
            <Mp3UploadField onUploaded={setMp3Key} onClear={() => setMp3Key('')} />
          </div>
        )}

        {/* Meeting scheduler (conditional) */}
        {formConfig.showMeetingScheduler && (
          <MeetingSchedulerField
            scheduledFor={scheduledFor}
            closedById={closedById}
            onDateChange={setScheduledFor}
            onAgentChange={setClosedById}
            required={formConfig.requireMeetingScheduler}
          />
        )}

        {/* Notes (conditional) */}
        {formConfig.showNotes && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Any context about this lead…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        )}

        <Button type="submit" size="lg" disabled={submit.isPending} className="w-full py-6">
          {submit.isPending ? 'Submitting…' : 'Submit Lead'}
        </Button>
      </form>
    </APIProvider>
  )
}
```

- [ ] **Step 2: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 3: Commit**
```bash
git add src/features/intake/ui/views/intake-form-view.tsx
git commit -m "feat(intake): add IntakeFormView"
```

---

### Task 18: Public intake page `/intake/[token]`

**Files:**
- Create: `src/app/(frontend)/(site)/intake/[token]/page.tsx`

- [ ] **Step 1: Create the page**

> **Note:** `src/trpc/server.ts` exports `trpc` (a `createTRPCOptionsProxy`) — there is no `caller` export. For server-component data fetching, query the DB directly (no tRPC overhead needed, no auth required for this public page).

```tsx
// src/app/(frontend)/(site)/intake/[token]/page.tsx
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { db } from '@/shared/db'
import { leadSources as leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { leadSourceFormConfigSchema } from '@/shared/entities/lead-sources/schemas'

interface Props {
  params: Promise<{ token: string }>
}

export default async function IntakePage({ params }: Props) {
  const { token } = await params

  const [row] = await db
    .select()
    .from(leadSourcesTable)
    .where(eq(leadSourcesTable.token, token))
    .limit(1)

  if (!row || !row.isActive) {
    notFound()
  }

  const formConfig = leadSourceFormConfigSchema.parse(row.formConfigJSON)

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <IntakeFormView
        leadSourceSlug={row.slug as never}
        leadSourceName={row.name}
        formConfig={formConfig}
      />
    </main>
  )
}
```

- [ ] **Step 2: Verify lint + build**
```bash
pnpm lint && pnpm build
```

- [ ] **Step 4: Manual test**
  - Run `pnpm dev`
  - Visit `http://localhost:3000/intake/<token-from-seed>` (use a token printed by the seed script)
  - Verify: form renders with correct fields for that lead source
  - Verify: invalid token → 404

- [ ] **Step 5: Commit**
```bash
git add src/app/(frontend)/(site)/intake/
git commit -m "feat(intake): add public /intake/[token] route"
```

---

## Phase 6 — Decouple Meetings from Notion

### Task 19: Update `create-meeting-view.tsx`

**Files:**
- Modify: `src/features/meetings/ui/views/create-meeting-view.tsx`

- [ ] **Step 1: Rewrite the view**

```tsx
// src/features/meetings/ui/views/create-meeting-view.tsx
'use client'

import { useMutation } from '@tanstack/react-query'
import { CalendarIcon, PlayIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { toast } from 'sonner'
import { CustomerSearch } from '@/shared/components/customer-search'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

export function CreateMeetingView() {
  const router = useRouter()
  const trpc = useTRPC()

  const [customerId, setCustomerId] = useState('')
  const [contactName, setContactName] = useState('')
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined)

  // ?customerId param from pipeline customer card
  const [prefillId] = useQueryState('customerId')

  const createMeeting = useMutation(
    trpc.meetingsRouter.create.mutationOptions({
      onSuccess: (meeting) => {
        toast.success('Meeting started!')
        router.push(`${ROOTS.dashboard.meetings()}/${meeting.id}`)
      },
      onError: (err) => toast.error(err.message),
    }),
  )

  function handleStart() {
    createMeeting.mutate({
      customerId,
      contactName: contactName || undefined,
      scheduledFor: scheduledFor?.toISOString(),
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-6 min-h-0 overflow-auto pr-1"
    >
      <div className="rounded-xl border border-border/40 bg-card/40 p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">
          Find Customer
          {contactName && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {contactName}
            </span>
          )}
        </p>
        <CustomerSearch
          onSelect={(id, name) => {
            setCustomerId(id)
            setContactName(name)
          }}
          onClear={() => {
            setCustomerId('')
            setContactName('')
          }}
          prefillCustomerId={prefillId ?? undefined}
        />
        {!customerId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Select a customer to start a meeting.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-card/40 p-5">
        <Label className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarIcon className="size-3.5 text-muted-foreground" />
          Schedule
        </Label>
        <DateTimePicker
          value={scheduledFor}
          onChange={setScheduledFor}
          placeholder="Select date & time (optional)"
          className="w-full justify-start border border-input bg-background px-3 py-2 h-9 text-sm"
        />
      </div>

      <Button
        className="w-full gap-2 py-6 text-base font-semibold"
        disabled={!customerId || createMeeting.isPending}
        size="lg"
        onClick={handleStart}
      >
        <PlayIcon className="size-5" />
        {createMeeting.isPending ? 'Starting…' : 'Start Meeting'}
      </Button>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 3: Commit**
```bash
git add src/features/meetings/ui/views/create-meeting-view.tsx
git commit -m "feat(meetings): replace NotionContactSearch with CustomerSearch in create-meeting-view"
```

---

### Task 20: Fix `meeting-flow.tsx` — remove Notion contact re-fetch

**Files:**
- Modify: `src/features/meetings/ui/views/meeting-flow.tsx`

- [ ] **Step 1: Identify the lines to change**

Open `src/features/meetings/ui/views/meeting-flow.tsx`. Lines 68–113 currently:
1. Read `notionContactId` from `meetingQuery.data?.customer?.notionContactId`
2. Call `trpc.notionRouter.contacts.getSingleById` to re-fetch from Notion
3. Build `MeetingContext.customer` from the Notion response

- [ ] **Step 2: Remove the Notion fetch and build context from `dbCustomer`**

Remove:
```ts
// Contact data for personalised program content
const contactId = meetingQuery.data?.customer?.notionContactId ?? ''
const contactQuery = useQuery(
  trpc.notionRouter.contacts.getSingleById.queryOptions(
    { id: contactId },
    { enabled: !!contactId },
  ),
)
```

Replace the `ctx` useMemo (lines ~80–113) with:
```ts
const ctx = useMemo<MeetingContext>(() => {
  const ctxCustomer = dbCustomer
    ? {
        address: dbCustomer.address ?? null,
        city: dbCustomer.city ?? '',
        email: dbCustomer.email ?? null,
        id: dbCustomer.id,
        name: dbCustomer.name,
        phone: dbCustomer.phone ?? null,
        state: dbCustomer.state ?? null,
      }
    : null

  return {
    collectedData: {
      bill: meeting?.programDataJSON?.bill ?? '',
      dmsPresent: meeting?.situationProfileJSON?.decisionMakersPresent ?? '',
      scope: meeting?.programDataJSON?.scope ?? '',
      timeline: meeting?.programDataJSON?.timeline ?? '',
      triggerEvent: dbCustomer?.customerProfileJSON?.triggerEvent ?? '',
      yrs: meeting?.programDataJSON?.yrs ?? '',
    },
    customer: ctxCustomer,
  }
}, [meeting, dbCustomer])
```

Remove `contactQuery` from the dependency array (it no longer exists).

Also remove the `contactId` variable and the `contactQuery` import-related lines.

- [ ] **Step 3: Grep for any other use of `contactQuery` or `contactId` in this file**
```bash
grep -n "contactQuery\|contactId\|notionRouter.contacts" src/features/meetings/ui/views/meeting-flow.tsx
```
Expected: zero results after your edit.

- [ ] **Step 4: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 5: Commit**
```bash
git add src/features/meetings/ui/views/meeting-flow.tsx
git commit -m "feat(meetings): remove Notion contact re-fetch in meeting-flow, source from dbCustomer"
```

---

### Task 21: Fix `edit-contact-form.tsx` — swap to `CustomerSearch`

**Files:**
- Modify: `src/features/meetings/ui/components/edit-contact-form.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
// src/features/meetings/ui/components/edit-contact-form.tsx
'use client'

import type { Meeting } from '@/shared/db/schema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, SaveIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { CustomerSearch } from '@/shared/components/customer-search'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

interface EditContactFormProps {
  meeting: Meeting
}

export function EditContactForm({ meeting }: EditContactFormProps) {
  const router = useRouter()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [customerId, setCustomerId] = useState('')
  const [contactName, setContactName] = useState(meeting.contactName ?? '')

  const updateMeeting = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetingsRouter.getAll.queryFilter())
        toast.success('Meeting updated')
        router.push(`${ROOTS.dashboard.root}?step=meetings`)
      },
      onError: () => toast.error('Failed to update meeting'),
    }),
  )

  function handleSave() {
    updateMeeting.mutate({
      id: meeting.id,
      contactName: contactName || undefined,
      ...(customerId ? { customerId } : {}),
    })
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      initial={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4 min-h-0 overflow-auto pr-1"
    >
      <Button
        className="self-start gap-2 -ml-2"
        size="sm"
        variant="ghost"
        onClick={() => router.push(`${ROOTS.dashboard.root}?step=meetings`)}
      >
        <ArrowLeftIcon className="size-4" />
        Back to meetings
      </Button>

      <Separator />

      <div className="rounded-xl border border-border/40 bg-card/40 p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">
          Customer Contact
          {contactName && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {contactName}
            </span>
          )}
        </p>
        <CustomerSearch
          onSelect={(id, name) => {
            setCustomerId(id)
            setContactName(name)
          }}
          onClear={() => {
            setCustomerId('')
          }}
          prefillCustomerId={meeting.customerId ?? undefined}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          To edit profile data, open the meeting and use the Intake view.
        </p>
      </div>

      <Button
        className="w-full gap-2 py-6 text-base font-semibold"
        disabled={updateMeeting.isPending}
        size="lg"
        onClick={handleSave}
      >
        <SaveIcon className="size-5" />
        {updateMeeting.isPending ? 'Saving…' : 'Save Changes'}
      </Button>
    </motion.div>
  )
}
```

> **Note:** `insertMeetingSchema` already omits `customerId`. When calling `meetingsRouter.update`, the input is `insertMeetingSchema.partial().extend({ id })`. The `customerId` field is not in `insertMeetingSchema` — it's omitted. You'll need to also update the `update` procedure to accept `customerId` as an optional field if you want to write it here. Alternatively, accept `customerId` in the update input schema as well (`.extend({ id, customerId: z.string().uuid().optional() })`). Check what the existing `update` procedure signature is and extend if needed.

- [ ] **Step 2: Check if `meetings.update` needs to accept `customerId`**

In `src/trpc/routers/meetings.router.ts`, the `update` procedure:
```ts
update: agentProcedure
  .input(insertMeetingSchema.partial().extend({ id: z.string().uuid() }))
```

`insertMeetingSchema` omits `customerId`. If you want `edit-contact-form` to write `customerId`, extend `update`:
```ts
.input(insertMeetingSchema.partial().extend({
  id: z.string().uuid(),
  customerId: z.string().uuid().optional(),
}))
```

- [ ] **Step 3: Verify lint**
```bash
pnpm lint
```

- [ ] **Step 4: Commit**
```bash
git add src/features/meetings/ui/components/edit-contact-form.tsx src/trpc/routers/meetings.router.ts
git commit -m "feat(meetings): replace NotionContactSearch with CustomerSearch in edit-contact-form"
```

---

### Task 22: Delete Notion contacts router + component

**Files:**
- Delete: `src/trpc/routers/notion.router/contacts.router.ts`
- Delete: `src/shared/components/notion/contact-search.tsx`
- Modify: `src/trpc/routers/notion.router/index.ts`

- [ ] **Step 1: Grep for all callers of the contacts router**
```bash
grep -rn "notionRouter.contacts\|contacts.router" src/ --include="*.ts" --include="*.tsx"
```
Expected: zero results (all callers removed in Tasks 19–21).

- [ ] **Step 2: Grep for NotionContactSearch usage**
```bash
grep -rn "NotionContactSearch\|contact-search" src/ --include="*.ts" --include="*.tsx"
```
Expected: zero results.

- [ ] **Step 3: Remove `contacts` from the notion router index**

In `src/trpc/routers/notion.router/index.ts`, remove:
```ts
import { contactsRouter } from './contacts.router'
```
And remove:
```ts
contacts: contactsRouter,
```

- [ ] **Step 4: Delete the files**
```bash
rm src/trpc/routers/notion.router/contacts.router.ts
rm src/shared/components/notion/contact-search.tsx
```

- [ ] **Step 5: Verify lint + build**
```bash
pnpm lint && pnpm build
```

Expected: no errors.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "chore: delete Notion contacts router and NotionContactSearch component"
```

---

## Phase 7 — One-Time Migration Script

### Task 23: Migration script — Notion → Postgres

**Files:**
- Create: `scripts/migrate-notion-contacts.ts`

- [ ] **Step 1: Create the script**

```ts
// scripts/migrate-notion-contacts.ts
/**
 * One-time migration: Notion Contacts → Postgres customers
 *
 * Run: pnpm tsx scripts/migrate-notion-contacts.ts
 *
 * Safety: Idempotent — uses onConflictDoUpdate on notionContactId.
 * Notion access: READ-ONLY. No Notion rows are modified.
 * MP3s: Downloaded from Notion signed URLs and re-uploaded to R2.
 *        Per-contact failure is logged and skipped, never aborts the run.
 */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { db } from '../src/shared/db'
import { customers } from '../src/shared/db/schema/customers'
import { notionClient } from '../src/shared/services/notion/client'
import { notionDatabasesMeta } from '../src/shared/services/notion/constants/databases'
import { pageToContact } from '../src/shared/services/notion/lib/contacts/adapter'
import { r2Client } from '../src/shared/services/r2/client'
import { R2_BUCKETS } from '../src/shared/services/r2/buckets'

// "Closed By" → leadSource / leadType mapping
const AGENT_NAMES = ['austin', 'rico', 'mei ann', 'angelica']

function classifyContact(closedBy: string | null): {
  leadSource: 'telemarketing_leads_philippines' | 'noy' | 'quoteme' | 'other'
  leadType: 'appointment_set' | 'needs_confirmation' | 'manual'
} {
  if (!closedBy) return { leadSource: 'other', leadType: 'manual' }
  const lower = closedBy.toLowerCase().trim()
  if (AGENT_NAMES.some(n => lower.includes(n))) {
    return { leadSource: 'telemarketing_leads_philippines', leadType: 'appointment_set' }
  }
  if (lower.includes('quoteme')) return { leadSource: 'quoteme', leadType: 'needs_confirmation' }
  if (lower.includes('noy')) return { leadSource: 'noy', leadType: 'needs_confirmation' }
  return { leadSource: 'other', leadType: 'manual' }
}

async function findMp3InPage(page: PageObjectResponse): Promise<string | null> {
  // Scan all properties for type === 'files' and check for .mp3
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type !== 'files') continue
    for (const file of prop.files) {
      const url = file.type === 'file' ? file.file.url : file.type === 'external' ? file.external.url : null
      if (url && url.toLowerCase().includes('.mp3')) {
        return url
      }
    }
  }
  return null
}

async function downloadAndUploadMp3(url: string, notionContactId: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    const key = `recordings/migrated-${notionContactId}-${Date.now()}.mp3`

    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKETS.telemarketingRecordings,
      Key: key,
      Body: buffer,
      ContentType: 'audio/mpeg',
    }))

    return key
  }
  catch (e) {
    console.error(`  ⚠ MP3 upload failed for ${notionContactId}:`, e)
    return null
  }
}

async function main() {
  console.log('📥 Fetching all Notion contacts…')

  const response = await notionClient.dataSources.query({
    data_source_id: notionDatabasesMeta.contacts.id,
  })

  const pages = response.results as PageObjectResponse[]
  console.log(`Found ${pages.length} contacts\n`)

  let synced = 0
  let skipped = 0
  let errors = 0

  for (const page of pages) {
    try {
      const contact = pageToContact(page)

      // Read "Closed By" from raw properties (migration-only, not in permanent adapter)
      const closedByProp = page.properties['Closed By']
      let closedBy: string | null = null
      if (closedByProp?.type === 'select') {
        closedBy = closedByProp.select?.name ?? null
      }
      else if (closedByProp?.type === 'rich_text') {
        closedBy = closedByProp.rich_text.map(t => t.plain_text).join('') || null
      }

      const { leadSource, leadType } = classifyContact(closedBy)

      // Check for MP3
      let mp3RecordingKey: string | undefined
      const mp3Url = await findMp3InPage(page)
      if (mp3Url) {
        console.log(`  🎙 Found MP3 for ${contact.name}, uploading…`)
        const key = await downloadAndUploadMp3(mp3Url, page.id)
        if (key) mp3RecordingKey = key
      }

      await db
        .insert(customers)
        .values({
          notionContactId: page.id,
          name: contact.name,
          phone: contact.phone ?? undefined,
          email: contact.email ?? undefined,
          address: contact.address ?? undefined,
          city: contact.city || '',
          state: contact.state ?? undefined,
          zip: contact.zip || '',
          leadSource,
          leadType,
          leadMetaJSON: mp3RecordingKey ? { mp3RecordingKey } : undefined,
        })
        .onConflictDoUpdate({
          target: customers.notionContactId,
          set: {
            // Update only if data has changed
            name: contact.name,
            phone: contact.phone ?? undefined,
            email: contact.email ?? undefined,
            address: contact.address ?? undefined,
            leadSource,
            leadType,
          },
        })

      console.log(`✅ ${contact.name} (${leadSource})`)
      synced++
    }
    catch (e) {
      console.error(`❌ Error processing page ${page.id}:`, e)
      errors++
    }
  }

  console.log(`\n--- Done ---`)
  console.log(`✅ Synced: ${synced}`)
  console.log(`⏭  Skipped (conflict update): included in synced count`)
  console.log(`❌ Errors: ${errors}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

> **Important:** The `onConflictDoUpdate` import in Drizzle is:
> ```ts
> import { eq } from 'drizzle-orm'
> // and the method is on the insert builder directly:
> .onConflictDoUpdate({ target: customers.notionContactId, set: { ... } })
> ```
> No separate import needed — it's a builder method.

- [ ] **Step 2: Run a dry sanity check**

Before full migration, count how many contacts Notion has:
```bash
pnpm tsx scripts/migrate-notion-contacts.ts 2>&1 | head -5
```
You should see: `Found N contacts`. If this fails, check `NOTION_API_KEY` in `.env`.

- [ ] **Step 3: Run the full migration**
```bash
pnpm tsx scripts/migrate-notion-contacts.ts 2>&1 | tee migration-log.txt
```

Review `migration-log.txt`. Expect errors for any malformed contact (phone without `+` prefix, missing required fields, etc.) — these are skipped, not fatal.

- [ ] **Step 4: Verify data in DB**

Open Drizzle Studio or query directly:
```bash
pnpm db:push  # won't change anything, but opens the studio connection
```
Or query: `SELECT COUNT(*), lead_source FROM customers GROUP BY lead_source;`

- [ ] **Step 5: Commit**
```bash
git add scripts/migrate-notion-contacts.ts migration-log.txt
git commit -m "feat(scripts): add migrate-notion-contacts one-time sync script"
```

---

## Phase 8 — Final Verification

### Task 24: End-to-end smoke test + cleanup

- [ ] **Step 1: Full lint + build**
```bash
pnpm lint && pnpm build
```
Expected: clean build.

- [ ] **Step 2: Check for leftover Notion contact references**
```bash
grep -rn "notionContactId\|NotionContactSearch\|notionRouter.contacts\|getByNotionId\|getSingleById" \
  src/ --include="*.ts" --include="*.tsx"
```
Expected: only `notionContactId` in `customers.ts` schema (the column is kept), `dal/server/customers/api.ts` (upsert logic, now migration-only), and possibly `customers.router.ts` (`getByNotionId` procedure — mark it for future removal but leave for now as it's a dead but harmless route).

- [ ] **Step 3: Manual test — meeting creation flow**
  - Start dev server: `pnpm dev`
  - Navigate to dashboard → Meetings → Create
  - Verify: `CustomerSearch` renders (not `NotionContactSearch`)
  - Search for a migrated customer → verify it appears
  - Create meeting → verify it succeeds without any Notion API calls in server logs

- [ ] **Step 4: Manual test — intake form**
  - Visit `/intake/<token>` with a valid seed token
  - Fill form, submit → verify customer appears in customer pipeline

- [ ] **Step 5: Manual test — meeting flow page**
  - Open an existing meeting
  - Verify: no Notion API call in server logs (check terminal running `pnpm dev`)
  - Verify: `MeetingContext.customer` is populated from `dbCustomer`

- [ ] **Step 6: Commit cleanup notes**
```bash
git add -A
git commit -m "chore: final verification pass"
```

---

## Note on `src/shared/dal/server/customers/api.ts`

This file contains `upsertCustomerFromNotion` and `syncAllCustomers` — both of which are now effectively dead code after this migration. **Do NOT modify this file in this PR.** The migration script does its own direct `db.insert().onConflictDoUpdate()` with the full new schema, bypassing this DAL function. The DAL file's upsert will simply never be called post-migration. It is cleaned up in the "Dead Code" phase below.

---

## Appendix: Dead Code (future cleanup)

After the migration is confirmed stable, schedule removal of:

| What | Where | When |
|---|---|---|
| `customersRouter.syncFromNotion` | `customers.router.ts` | After confirming Notion sync is no longer needed |
| `customersRouter.getByNotionId` | `customers.router.ts` | Same |
| `syncAllCustomers()` + `getCustomerByNotionId()` | `shared/dal/server/customers/api.ts` | Same |
| `syncCustomersJob` QStash handler | `/api/qstash-jobs/` | Disable scheduled trigger first |
| `customers.notionContactId` column | `customers.ts` schema | Only when confirmed no row needs it |
| `customers.syncedAt` column | `customers.ts` schema | Column rename to `notionSyncedAt` or removal |

Do not remove these in this branch — the migration script still uses `notionContactId` for conflict resolution.

---

## Environment Variables Required

Ensure all of these are set in `.env` before executing:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres |
| `NOTION_API_KEY` | Migration script |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Intake form address autocomplete |
| `UPSTASH_REDIS_REST_URL` | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_JURISDICTION`, `R2_TOKEN` | R2 mp3 uploads |
