# Notion CRM Migration — Design Spec
**Date:** 2026-03-19
**Scope:** Contacts → Meetings → Proposals (Projects excluded)
**Approach:** Enrich `customers` table, URL-param intake forms, one-time Notion sync, decouple Notion from meeting creation

---

## Background

Currently the CRM runs partially on Notion:
- Contacts (leads) enter via a native Notion form or manual entry into the Notion contacts DB
- A Notion automation creates a meeting record in the Notion meetings DB when a datetime is provided
- When an agent starts a meeting in the app, it searches Notion for the contact, upserts them into Postgres `customers`, then creates a `meetings` row
- Post-proposal conversion, a project record is created in Notion

**Goal:** Transfer ownership of lead intake and contact management fully into the app. Notion remains the source of truth for trades, scopes, and SOWs only. The Notion contacts DB becomes read-only and is synced once into Postgres.

---

## Section 0: New Dependencies

Add to `package.json` (pnpm install):
- `@upstash/ratelimit` — rate limiting for public intake endpoints
- `@upstash/redis` — required peer dependency for `@upstash/ratelimit`

---

## Section 1: Schema Changes

### 1.1 `customers` table — new columns

| Column | Type | Notes |
|---|---|---|
| `initMeetingAt` | `timestamp (withTimezone)` | First scheduled appointment datetime, migrated from Notion or set via intake form |
| `leadSource` | `leadSourceEnum` | Which entity provided the lead |
| `leadType` | `leadTypeEnum` | Classification of how the lead was entered |
| `leadMetaJSON` | `jsonb ($type<LeadMeta>)` | Non-query setup fields: mp3 key, assigned salesrep (see 1.3) |

`notionContactId` column remains — harmless, used by migration skip logic.
`syncedAt` column remains — updated during migration. **Known tech debt:** post-migration, `syncedAt` will be set on every new customer row regardless of Notion origin; the column name becomes misleading. Renaming is out of scope for this spec.

### 1.2 New enums

**File:** `src/shared/constants/enums/leads.ts`
```ts
export const leadSources = [
  'telemarketing_leads_philippines',
  'noy',
  'quoteme',
  'other',
] as const

export const leadTypes = [
  'appointment_set',      // contact comes in with a meeting already scheduled
  'needs_confirmation',   // lead captured, meeting not yet confirmed
  'manual',               // manually added by an agent
] as const
```

> Note: `'appointment_set'` is intentionally distinct from `'meeting_scheduled'` (a `meetingPipelineStages` value) to avoid semantic confusion between the lead entry type and the pipeline position.

**File:** `src/shared/types/enums/leads.ts`
```ts
export type LeadSource = (typeof leadSources)[number]
export type LeadType = (typeof leadTypes)[number]
```

**File:** `src/shared/db/schema/meta.ts` — add:
```ts
export const leadSourceEnum = pgEnum('lead_source', leadSources)
export const leadTypeEnum = pgEnum('lead_type', leadTypes)
```

Both const arrays barrel-exported via `src/shared/constants/enums/index.ts`.
Both TS types barrel-exported via `src/shared/types/enums/index.ts`.

### 1.3 `leadMetaJSON` entity schema

**File:** `src/shared/entities/customers/schemas.ts` — add alongside existing schemas:

```ts
export const leadMetaSchema = z.object({
  mp3RecordingKey: z.string().optional(),    // Cloudflare R2 object key for telemarketing call recording
  assignedSalesrep: z.string().optional(),   // salesrep name from SALESREPS const (telemarketing only)
})
export type LeadMeta = z.infer<typeof leadMetaSchema>
```

`assignedSalesrep` lives in JSONB because it is informational metadata, not a query target. Both fields are non-query, non-indexed — JSONB is appropriate.

When updating `insertCustomerSchema` in `customers.ts`, add `leadMetaJSON: leadMetaSchema.optional()` to the drizzle-zod override alongside the existing JSONB overrides — without this the inferred type for `leadMetaJSON` will be `unknown` rather than `LeadMeta`.

### 1.4 New `customer_notes` table

**File:** `src/shared/db/schema/customer-notes.ts`

```ts
export const customerNotes = pgTable('customer_notes', {
  id,
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
})
```

- `authorId` is nullable — Drizzle makes columns without `.notNull()` nullable; no explicit `.nullable()` needed
- Exported individually and via `src/shared/db/schema/index.ts`
- This spec creates the table only; CRUD UI is a future feature
- Export `selectCustomerNoteSchema = createSelectSchema(customerNotes)` and `insertCustomerNoteSchema = createInsertSchema(customerNotes).omit({ id: true, createdAt: true, updatedAt: true })` — consistent with every other table in the project

### 1.5 Address field constraint behaviour

`customers.city` and `customers.zip` are `notNull()` in the schema. The intake form uses a Google Places autocomplete that populates `city` and `zip` from the resolved place. The autocomplete field is **required** for all lead sources — form submission is blocked until a place is selected from the autocomplete dropdown, ensuring city and zip are always populated. Fallback values match the existing DAL pattern: `city: ''`, `zip: ''` for contacts where city/zip cannot be extracted from the place result (rare edge case for non-US addresses). The migration script uses the same `''` fallback for Notion contacts missing these fields.

---

## Section 2: One-Time Notion Migration Script

**File:** `scripts/migrate-notion-contacts.ts`
**Run:** `pnpm tsx scripts/migrate-notion-contacts.ts`
**Safety:** Idempotent — skips existing customers via `onConflictDoUpdate` on `notionContactId` (existing `upsertCustomerFromNotion` pattern). Re-running is safe.
**Error strategy:** Log-and-skip per contact — a malformed Notion page never aborts the full sync. Each failure is logged with the Notion page ID for manual review.

### 2.1 Field mapping

| Notion field | Postgres column | Notes |
|---|---|---|
| name | `customers.name` | |
| phone | `customers.phone` | |
| email | `customers.email` | |
| address | `customers.address` | |
| city | `customers.city` | fallback `''` if missing |
| state | `customers.state` | |
| zip | `customers.zip` | fallback `''` if missing |
| initMeetingAt | `customers.initMeetingAt` | nullable |
| notes | **skipped** | No existing notes worth migrating |
| ownerId | **dropped** | Notion user IDs don't map to app users |
| relatedMeetingsIds | **dropped** | FK relationship covers this |
| relatedProjectsIds | **dropped** | Out of scope |

No mp3 recordings are migrated — `leadMetaJSON.mp3RecordingKey` is null for all migrated contacts.

### 2.2 Lead classification via "Closed By" Notion property

The script reads the raw `Closed By` property directly from the Notion page response — this property is NOT added to the permanent `CONTACT_PROPERTIES_MAP` adapter (migration-only read).

| "Closed By" value | `leadType` | `leadSource` |
|---|---|---|
| Austin / Rico / Mei Ann / Angelica | `appointment_set` | `telemarketing_leads_philippines` |
| QuoteMe | `needs_confirmation` | `quoteme` |
| Noy | `needs_confirmation` | `noy` |
| anything else / empty | `manual` | `other` |

### 2.3 What is NOT migrated
- Notion meetings DB — pre-app scheduling records, superseded by the richer Postgres `meetings` table
- Notion projects DB — out of scope
- No Notion rows are modified or deleted (read-only access)
- Historical call recordings — `leadMetaJSON.mp3RecordingKey` left null for migrated contacts

---

## Section 3: Intake Form System

### 3.1 Route

**Public page** (no auth): `src/app/(frontend)/(site)/intake/page.tsx`
Shareable URL per lead source. No login required.

### 3.2 URL param

Single nuqs param: `?source=telemarketing_leads_philippines|noy|quoteme|other`

`leadType` is derived in code from `leadSource` — no second param needed. If `source` param is missing or invalid, the form defaults to `other` / `manual`.

### 3.3 Feature structure

```
src/features/intake/
  constants/
    form-configs.ts         ← per-source IntakeFormConfig objects
    salesreps.ts            ← static list of agent names for telemarketing dropdown
  schemas/
    intake-form-schema.ts   ← base zod schema (all fields optional at root, refined per config)
  ui/
    views/
      intake-form-view.tsx
    components/
      address-autocomplete-field.tsx   ← Google Places autocomplete + static map preview
      mp3-upload-field.tsx             ← R2 upload, telemarketing only
      meeting-scheduler-field.tsx      ← datetime picker + salesrep select, telemarketing only
```

### 3.4 Form configuration

```ts
// src/features/intake/constants/form-configs.ts
type IntakeFormConfig = {
  leadSource: LeadSource
  leadType: LeadType
  showEmail: boolean
  requireEmail: boolean
  showMeetingScheduler: boolean
  requireMeetingScheduler: boolean
  showMp3Upload: boolean
  showNotes: boolean
}
```

| Source | leadType | email | meeting scheduler | required? | mp3 | notes |
|---|---|---|---|---|---|---|
| `telemarketing_leads_philippines` | `appointment_set` | ❌ | ✅ | required | ✅ optional | ❌ |
| `noy` | `needs_confirmation` | optional | ❌ | — | ❌ | ✅ |
| `quoteme` | `needs_confirmation` | optional | ❌ | — | ❌ | ✅ |
| `other` | `manual` | optional | optional | optional | ❌ | ✅ |

**Shared fields (all sources):** name (required), phone (required), address via autocomplete (required — populates address, city, state, zip).

### 3.5 Address UX

Uses `@vis.gl/react-google-maps` (already a project dependency).

- Single **Places Autocomplete** input is the only address field visible to the user
- On place selection: auto-populates `address`, `city`, `state`, `zip` in form state from the place result's address components
- A **static map** renders below the input, centered on the resolved coordinates, once a place is confirmed
- Map height: 200px on mobile, 240px on desktop
- If the address is cleared, the static map disappears
- `lat`/`lng` from the place result are used internally by the component for map rendering only — they are **not** exposed via `onChange` and are **not** stored in the DB

```ts
// Component signature
interface AddressAutocompleteFieldProps {
  onChange: (fields: { address: string; city: string; state: string; zip: string }) => void
  onClear: () => void
}
```

### 3.6 Salesrep selector (telemarketing only)

Since the intake form is public (no auth), the salesrep is selected from a **static const array** of agent names:

```ts
// src/features/intake/constants/salesreps.ts
export const SALESREPS = ['Austin', 'Rico', 'Mei Ann', 'Angelica'] as const
export type Salesrep = (typeof SALESREPS)[number]
```

Selected salesrep name is stored in `leadMetaJSON.assignedSalesrep` (see 1.3). This keeps the `meetings` table schema unchanged for this spec.

### 3.7 Submission flow — no meeting created from intake

**Key decision:** The intake form does NOT create a `meetings` row. The intake form is public and unauthenticated — `meetings.ownerId` is `NOT NULL` and requires an authenticated agent. Creating a meeting without an owner would violate the schema.

Instead:
- `initMeetingAt` is stored on the customer record (the scheduled appointment time as metadata)
- `leadMetaJSON.assignedSalesrep` stores who is assigned
- When the scheduled time approaches, an agent opens the customer from the pipeline (which shows `initMeetingAt`) and clicks **Start Meeting** → `create-meeting-view.tsx` pre-populated with `?customerId=<uuid>` — the formal meeting record is created at that point with a proper `ownerId`

**Submission steps:**
1. If `showMp3Upload` and file present → obtain presigned URL from `intakeRouter.getRecordingUploadUrl`, upload file directly to R2, receive the object key
2. Call `customersRouter.createFromIntake` (`baseProcedure`, rate-limited):
   - Creates `customers` row with `leadSource`, `leadType`, `initMeetingAt`, `leadMetaJSON` (mp3 key + assignedSalesrep)
   - If notes field populated → inserts row into `customer_notes` (authorId: null)
3. Returns success — form shows a confirmation message. No redirect (form is reusable per lead source).

`createFromIntake` is a single atomic tRPC call. The R2 upload (step 1) happens client-side before calling tRPC; the resulting key is passed as part of the tRPC input.

### 3.8 R2 upload — security model

**Bucket:** `telemarketingRecordings: 'tpr-telemarketing-recordings'` — new entry in `R2_BUCKETS` in `src/shared/services/r2/buckets.ts`.

**Type fix required:** `R2_PUBLIC_DOMAINS` is currently typed as `Record<R2BucketName, string>`. Adding a third bucket makes `R2BucketName` a three-member union, requiring a matching entry in `R2_PUBLIC_DOMAINS`. The telemarketing recordings bucket is private (no public domain). Fix: change the type to `Partial<Record<R2BucketName, string>>` — public buckets have entries, private buckets do not. This is a non-breaking change.

**Key path:** `recordings/{timestamp}-{randomUUID}.mp3`
**Presigned URL procedure:** `intakeRouter.getRecordingUploadUrl` — `baseProcedure`, protected by Upstash rate limiting via `@upstash/ratelimit` (5 presigned URL requests per IP per hour)
**File constraints enforced server-side before issuing URL:** content type must be `audio/mpeg` or `audio/mp4`, max size 100MB
**Expiry:** presigned URL valid for 15 minutes

**File:** New `src/trpc/routers/intake.router.ts` containing `getRecordingUploadUrl` and any future public intake procedures. `createFromIntake` stays in `customersRouter` for co-location with customer DAL.

**Spam/bot protection:** Upstash rate limiting (via `@upstash/ratelimit` + `@upstash/redis`) is the primary defence. A honeypot hidden field is added to the form (hidden via CSS, not `display:none`). CAPTCHA is acknowledged as a future hardening step and is not in scope for this spec.

**Deployment prerequisite:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` must be set in production. The intake form's address autocomplete is a required field — if the key is absent, the form will be stuck. This key is currently `optional()` in `client-env.ts`; it must be set as required in the deployment environment even if the schema is not changed.

### 3.9 tRPC procedures

**New:** `customersRouter.createFromIntake` — `baseProcedure` + Upstash rate limit
- Input: explicitly defined schema (NOT derived from `insertCustomerSchema`) to prevent client-controlled `syncedAt`, `notionContactId`, `pipeline`, `pipelineStage` fields. The input schema accepts only: `name`, `phone`, `address`, `city`, `state`, `zip`, `email?`, `notes?`, `initMeetingAt?`, `leadSource`, `leadType`, `leadMetaJSON?`
- Creates customer row + optional `customer_notes` row
- Returns `{ customerId: string }`

**New:** `intakeRouter.getRecordingUploadUrl` — `baseProcedure` + Upstash rate limit
- Input: `{ fileName: string, contentType: 'audio/mpeg' | 'audio/mp4' }`
- Returns: `{ uploadUrl: string, key: string }`

---

## Section 4: Decoupling Notion from Meeting Creation

### 4.1 `CustomerSearch` component

**File:** `src/shared/components/customer-search.tsx`
Replaces `src/shared/components/notion/contact-search.tsx`.

**Two modes controlled by props:**

```ts
interface CustomerSearchProps {
  value: string              // selected customerId
  onSelect: (id: string, name: string) => void
  onClear: () => void
  prefillCustomerId?: string // skips search, fetches + renders this customer directly
}
```

- **Search mode** (`prefillCustomerId` absent): agent types name or phone → search → select from badge results
- **Pre-populated mode** (`prefillCustomerId` provided): fetches customer by ID, renders in selected state immediately — no search interaction required

Used in `create-meeting-view.tsx` (both modes) and any future customer lookup context (pipeline search, customer linking).

### 4.2 `customersRouter.search` procedure

**New procedure** on `customersRouter`:
- Input: `{ query: string }` — `ilike` match against `name` and `phone`
- Returns: `Array<{ id, name, phone, address }>`
- `agentProcedure` — search is agent-only, not public

**New procedure:** `customersRouter.getById` — `agentProcedure`, returns single customer by UUID. Used by pre-populated mode.

### 4.3 `meetings.create` mutation — simplified

**Remove:**
- `notionContactId` input field
- `queryNotionDatabase('contacts', ...)` call
- `upsertCustomerFromNotion(contact)` call
- `pageToContact` import

**Add:**
- `customerId: z.string().uuid()` input — agent selects an existing customer

Meeting creation becomes a simple insert with no external API call.

### 4.4 `create-meeting-view.tsx`

- Replace `<NotionContactSearch>` with `<CustomerSearch>`
- Read optional `?customerId` nuqs param → pass as `prefillCustomerId` to `<CustomerSearch>`
- Pass `customerId` (not `notionContactId`) to the `meetings.create` mutation

### 4.5 `meeting-flow.tsx` — remove Notion contact re-fetch

Lines 69–113 of `meeting-flow.tsx` currently:
1. Read `meeting.customer.notionContactId`
2. Fire `trpc.notionRouter.contacts.getSingleById` to fetch the contact from Notion
3. Use the result to build `MeetingContext.customer` (fields: `address`, `city`, `email`, `name`, `phone`, `state`)

After migration, `meetings.getById` already joins `customers` and returns `meeting.customer` with the same fields — the Notion re-fetch is redundant. Fix:
- Remove `contactId` / `contactQuery` entirely
- Build `MeetingContext.customer` directly from `dbCustomer` (already loaded as `meeting.customer`)
- The shape is identical — no downstream changes to `MeetingContext` consumers needed

`meeting-flow.tsx` is added to the **Modified files** changelist.

### 4.6 `edit-contact-form.tsx` — migrate to `CustomerSearch`

`src/features/meetings/ui/components/edit-contact-form.tsx` currently:
- Renders `<NotionContactSearch>` to find a contact
- On save, only writes `contactName` to the meeting (not `customerId`)

After migration:
- Replace `<NotionContactSearch>` with `<CustomerSearch>` (search mode, no prefill)
- On save, write **both** `customerId` (FK) and `contactName` to the meeting update mutation
- The `meetings.update` input already accepts `customerId` via `insertMeetingSchema.partial()` — no schema change needed

`edit-contact-form.tsx` is added to the **Modified files** changelist.

### 4.7 `intake-form-view.tsx` — `APIProvider` placement

`@vis.gl/react-google-maps` requires an ancestor `<APIProvider apiKey={...}>` for `useMapsLibrary` to work. The intake page is a standalone public route; the existing site layout does not include `APIProvider`.

`APIProvider` must be rendered in `intake-form-view.tsx`, wrapping the form content. The API key is read from `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

### 4.8 Notion router cleanup

**Before deleting `contacts.router.ts`:** grep for `notionRouter.contacts` and `trpc.notionRouter.contacts` across the entire codebase. Known call sites (all addressed in this spec): `create-meeting-view.tsx`, `meeting-flow.tsx`, `edit-contact-form.tsx`, `contact-search.tsx`. Verify no others exist before deletion.

- `src/trpc/routers/notion.router/contacts.router.ts` — deleted
- `src/shared/components/notion/contact-search.tsx` — deleted
- `src/shared/services/notion/` infrastructure remains — still active for trades, scopes, SOWs
- `notionRouter` remains in `app.ts` — without the `contacts` sub-router

**Dead code to clean up (follow-up pass, not in this spec):**
- `customersRouter.syncFromNotion` — calls `syncAllCustomers()` which hits the Notion API; no callers post-migration
- `customersRouter.getByNotionId` — no callers post-migration
- `syncCustomersJob` QStash job handler (`src/shared/services/upstash/jobs/sync-customers.ts`) — calls `syncAllCustomers()`; disable the scheduled QStash job and remove the handler

---

## Out of Scope (This Spec)

- Notion projects DB migration
- Post-sale project management in the app
- Customer notes UI (table is created; CRUD UI is a future feature)
- Removing `notionContactId` from the schema
- CAPTCHA on the intake form (Upstash rate limiting + honeypot is the initial defence)
- `syncedAt` column rename (acknowledged tech debt)

---

## File Changelist Summary

### New files
- `src/shared/constants/enums/leads.ts`
- `src/shared/types/enums/leads.ts`
- `src/shared/db/schema/customer-notes.ts`
- `src/features/intake/constants/form-configs.ts`
- `src/features/intake/constants/salesreps.ts` *(feature-internal const + type co-located — intentional deviation from shared enum convention)*
- `src/features/intake/schemas/intake-form-schema.ts`
- `src/features/intake/ui/views/intake-form-view.tsx`
- `src/features/intake/ui/components/address-autocomplete-field.tsx`
- `src/features/intake/ui/components/mp3-upload-field.tsx`
- `src/features/intake/ui/components/meeting-scheduler-field.tsx`
- `src/shared/components/customer-search.tsx`
- `src/app/(frontend)/(site)/intake/page.tsx`
- `src/trpc/routers/intake.router.ts`
- `scripts/migrate-notion-contacts.ts`

### Modified files
- `package.json` — add `@upstash/ratelimit`, `@upstash/redis`
- `src/shared/db/schema/customers.ts` — add 4 columns (`initMeetingAt`, `leadSource`, `leadType`, `leadMetaJSON`); add `leadMetaJSON: leadMetaSchema.optional()` to `insertCustomerSchema` override
- `src/shared/db/schema/meta.ts` — add `leadSourceEnum`, `leadTypeEnum`
- `src/shared/db/schema/index.ts` — export `customerNotes`
- `src/shared/constants/enums/index.ts` — re-export from `leads.ts`
- `src/shared/types/enums/index.ts` — re-export from `leads.ts`
- `src/shared/entities/customers/schemas.ts` — add `leadMetaSchema` + `LeadMeta` type
- `src/shared/services/r2/buckets.ts` — add `telemarketingRecordings` bucket; change `R2_PUBLIC_DOMAINS` type to `Partial<Record<R2BucketName, string>>`
- `src/trpc/routers/app.ts` — register `intakeRouter`
- `src/trpc/routers/customers.router.ts` — add `search`, `getById`, `createFromIntake` procedures
- `src/trpc/routers/meetings.router.ts` — simplify `create` procedure (remove Notion dependency)
- `src/trpc/routers/notion.router/index.ts` — remove `contacts` sub-router
- `src/features/meetings/ui/views/create-meeting-view.tsx` — swap search component + mutation input
- `src/features/meetings/ui/views/meeting-flow.tsx` — remove Notion contact re-fetch; source `MeetingContext.customer` from `dbCustomer` directly (see 4.5)
- `src/features/meetings/ui/components/edit-contact-form.tsx` — replace `NotionContactSearch` with `CustomerSearch`; update mutation to write `customerId` (see 4.6)
- `src/shared/dal/server/customers/api.ts` — extend upsert for new columns

### Deleted files
- `src/trpc/routers/notion.router/contacts.router.ts`
- `src/shared/components/notion/contact-search.tsx`
