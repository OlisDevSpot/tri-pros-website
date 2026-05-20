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
- `nanoid` — cryptographically secure token generation for `lead_sources.token`

---

## Section 1: Schema Changes

### 1.1 `customers` table — new columns

| Column | Type | Notes |
|---|---|---|
| `leadSource` | `leadSourceEnum` | Which entity provided the lead |
| `leadType` | `leadTypeEnum` | Classification of how the lead was entered |
| `leadMetaJSON` | `jsonb ($type<LeadMeta>)` | Non-query setup fields: mp3 key only (see 1.3) |

`notionContactId` column remains — harmless, used by migration skip logic.
`syncedAt` column remains — updated during migration. **Known tech debt:** post-migration, `syncedAt` will be set on every new customer row regardless of Notion origin. Renaming is out of scope for this spec.

> **Note:** `initMeetingAt` is NOT added to the customers table. It was a Notion-era workaround for UI limitations. The `meetings.scheduledFor` column is the correct home for appointment datetime. Customers are already linked to meetings via FK.

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
  mp3RecordingKey: z.string().optional(), // Cloudflare R2 object key for telemarketing call recording
})
export type LeadMeta = z.infer<typeof leadMetaSchema>
```

Non-query, non-indexed — JSONB is appropriate.

When updating `insertCustomerSchema` in `customers.ts`, add `leadMetaJSON: leadMetaSchema.optional()` to the drizzle-zod override — without this the inferred type will be `unknown`.

### 1.4 New `lead_sources` table

**File:** `src/shared/db/schema/lead-sources.ts`

```ts
export const leadSources = pgTable('lead_sources', {
  id,
  name: text('name').notNull(),                           // "Telemarketing Leads - Philippines"
  slug: text('slug').notNull().unique(),                  // 'telemarketing_leads_philippines'
  token: text('token').notNull().unique(),                // nanoid(21) — used in intake URL
  formConfigJSON: jsonb('form_config_json').$type<LeadSourceFormConfig>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt,
  updatedAt,
})
```

**File:** `src/shared/entities/lead-sources/schemas.ts`

```ts
export const leadSourceFormConfigSchema = z.object({
  leadType: leadTypeSchema,                // z.enum(leadTypes)
  showEmail: z.boolean(),
  requireEmail: z.boolean(),
  showMeetingScheduler: z.boolean(),
  requireMeetingScheduler: z.boolean(),
  showMp3Upload: z.boolean(),
  showNotes: z.boolean(),
})
export type LeadSourceFormConfig = z.infer<typeof leadSourceFormConfigSchema>
```

**Seed script:** `scripts/seed-lead-sources.ts` — inserts the 4 initial lead sources with generated tokens. Idempotent (skip if slug already exists). Tokens are generated with `nanoid(21)` and are permanent — do not regenerate on re-run.

**Intake URL:** `/intake/[token]` (dynamic path segment, not query param). Lead sources share their unique URL with external parties. If a lead source's token is compromised, revoke by setting `isActive = false` and inserting a new record with a new token.

**`customers.leadSource`** remains the enum string (not a FK to `lead_sources.id`). Customers store the derived slug value — self-contained and immune to lead source record changes. The `lead_sources` table is for token validation and form configuration only.

### 1.5 New `customer_notes` table

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
export const selectCustomerNoteSchema = createSelectSchema(customerNotes)
export const insertCustomerNoteSchema = createInsertSchema(customerNotes).omit({ id: true, createdAt: true, updatedAt: true })
```

- `authorId` nullable (no `.notNull()` = nullable in Drizzle)
- Exported individually and via `src/shared/db/schema/index.ts`
- Table created now; CRUD UI is a future feature

### 1.6 Address field constraint behaviour

`customers.city` and `customers.zip` are `notNull()`. The intake form address autocomplete is **required** — submission is blocked until a place is confirmed, ensuring city/zip are always populated from the place result. Fallback: `city: ''`, `zip: ''` for contacts where these cannot be extracted (rare non-US edge case). Migration script uses the same fallback.

---

## Section 2: One-Time Notion Migration Script

**File:** `scripts/migrate-notion-contacts.ts`
**Run:** `pnpm tsx scripts/migrate-notion-contacts.ts`
**Safety:** Idempotent — skips existing customers via `onConflictDoUpdate` on `notionContactId`. Re-running is safe.
**Error strategy:** Log-and-skip per contact — malformed pages never abort the full sync.

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
| notes | **skipped** | No existing notes worth migrating |
| initMeetingAt | **dropped** | No destination column; field removed from schema |
| ownerId | **dropped** | Notion user IDs don't map to app users |
| relatedMeetingsIds | **dropped** | FK relationship covers this |
| relatedProjectsIds | **dropped** | Out of scope |

### 2.2 MP3 recording migration (per-contact, best-effort)

Notion contacts may have a call recording attached as a `files`-type property. This is NOT in the permanent `CONTACT_PROPERTIES_MAP` (migration-only read).

**Strategy:**
1. After fetching the raw `PageObjectResponse`, scan `page.properties` for any property where `type === 'files'`
2. For each file entry: check if the URL (Notion signed URL) ends with `.mp3` (case-insensitive)
3. If found: download the file (Notion signed URLs expire in 1 hour — run migration without delay between fetch and download), upload to R2 `telemarketingRecordings` bucket with key `recordings/migrated-{notionContactId}-{timestamp}.mp3`
4. Store the R2 key in `leadMetaJSON.mp3RecordingKey`
5. On any failure (download error, R2 error, no mp3 found): log and continue — mp3 is non-critical, the customer row is inserted without it

**No permanent additions** to `CONTACT_PROPERTIES_MAP`, `contactSchema`, or `pageToContact` — migration reads raw `PageObjectResponse` directly.

### 2.3 Lead classification via "Closed By" Notion property

The script reads the raw `Closed By` property directly from the Notion page response — NOT added to the permanent `CONTACT_PROPERTIES_MAP` adapter (migration-only read).

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
- Historical call recordings

---

## Section 3: Intake Form System

### 3.1 Route

**Public page** (no auth): `src/app/(frontend)/(site)/intake/[token]/page.tsx`
Dynamic route — each lead source has a unique unguessable token (nanoid 21 chars) embedded in the URL.

Shareable URL per lead source: `https://app.triprosremodeling.com/intake/<token>`
No login required. Token validity checked server-side before rendering the form.

If token is invalid or `isActive = false` → render a "This link is no longer active" page (no 500, no redirect leak).

### 3.2 Token-based access control

No nuqs URL params for form configuration. All configuration comes from the `lead_sources` DB record resolved by token.

**`intakeRouter.getByToken`** — `baseProcedure`
- Input: `{ token: string }`
- Queries `lead_sources` table by token
- If not found or `isActive = false` → throws `NOT_FOUND`
- Returns: `{ leadSourceId: string, slug: string, name: string, formConfig: LeadSourceFormConfig }`

The page server component fetches this before rendering. Client form receives `formConfig` as props — no token passed to client.

### 3.3 Feature structure

```
src/features/intake/
  schemas/
    intake-form-schema.ts   ← base zod schema refined per formConfig
  ui/
    views/
      intake-form-view.tsx
    components/
      address-autocomplete-field.tsx   ← Google Places autocomplete + static map preview
      mp3-upload-field.tsx             ← R2 upload, telemarketing only
      meeting-scheduler-field.tsx      ← datetime picker + "Closed By" agent select, telemarketing only
scripts/
  seed-lead-sources.ts      ← seeds 4 initial lead_sources rows with tokens
```

> No `constants/form-configs.ts` — configuration lives in DB. `seed-lead-sources.ts` is the canonical source of truth for initial config values.

### 3.4 Initial lead source seed data

| Name | slug | leadType | email | scheduler | required? | mp3 | notes |
|---|---|---|---|---|---|---|---|
| Telemarketing Leads - Philippines | `telemarketing_leads_philippines` | `appointment_set` | ❌ | ✅ | required | ✅ | ❌ |
| Noy | `noy` | `needs_confirmation` | optional | ❌ | — | ❌ | ✅ |
| QuoteMe | `quoteme` | `needs_confirmation` | optional | ❌ | — | ❌ | ✅ |
| Other | `other` | `manual` | optional | optional | optional | ❌ | ✅ |

**Shared fields (all sources):** name (required), phone (required), address via autocomplete (required).

### 3.5 Address UX

Uses `@vis.gl/react-google-maps` (already a project dependency).

- Single **Places Autocomplete** input — on selection auto-populates `address`, `city`, `state`, `zip` from place result components
- A **static map** renders below once a place is confirmed, centered on resolved coordinates
- Map height: 200px mobile, 240px desktop. Disappears if address is cleared.
- `lat`/`lng` kept internal to the component (map preview only) — not exposed via `onChange`, not stored in DB

```ts
interface AddressAutocompleteFieldProps {
  onChange: (fields: { address: string; city: string; state: string; zip: string }) => void
  onClear: () => void
}
```

`APIProvider` from `@vis.gl/react-google-maps` must be rendered in `intake-form-view.tsx` wrapping the form content. The intake page is a standalone public route — the existing site layout does not include it. API key read from `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

### 3.6 "Closed By" selector — dynamic agent list (telemarketing only)

The intake form is public (no auth) but must allow selection of which internal agent is closing the lead. This is solved by fetching internal users from the app's Postgres `user` table at form load time.

**New procedure:** `intakeRouter.getInternalUsers` — `baseProcedure` (public, read-only)
- Queries `user` table for rows where `role IN ('agent', 'super-admin')` using the same logic as `isInternalUser()`
- Returns: `Array<{ id: string, name: string }>` — only id and name, no sensitive data
- Result used to populate the "Closed By" dropdown in `meeting-scheduler-field.tsx`
- Selected user `id` becomes `meetings.ownerId` when the meeting is created

No static `SALESREPS` const or hardcoded user ID map. The list is always current as agents are added/removed via Google OAuth with `@triprosremodeling.com` email domain assignment.

### 3.7 Submission flow — meeting IS created from intake (telemarketing)

When `showMeetingScheduler` is true and a datetime + agent are provided, a `meetings` row **is** created as part of the intake submission. The selected agent's user ID (`closedById`) becomes `meetings.ownerId`.

**Submission steps:**
1. If `showMp3Upload` and file present → obtain presigned URL from `intakeRouter.getRecordingUploadUrl`, upload to R2, receive object key
2. Call `customersRouter.createFromIntake` (`baseProcedure`, rate-limited):
   - Creates `customers` row with `leadSource`, `leadType`, `leadMetaJSON` (mp3 key)
   - If notes field populated → inserts row into `customer_notes` (authorId: null)
   - If `scheduledFor` + `closedById` provided → inserts `meetings` row with `scheduledFor`, `ownerId = closedById`, `customerId`, `status = 'in_progress'`
   - If notes field populated → inserts row into `customer_notes` (authorId: null)
3. Returns `{ customerId }` — form shows confirmation message, no redirect

`createFromIntake` is a single tRPC call. The R2 upload (step 1) precedes it client-side; the key is passed as input. Customer insert and optional meeting/notes inserts are intentionally non-transactional — a notes or meeting insert failure does not roll back the customer (see Implementation Notes).

### 3.8 R2 upload — security model

**Bucket:** `telemarketingRecordings: 'tpr-telemarketing-recordings'` — new entry in `R2_BUCKETS`.

**Type fix:** Change `R2_PUBLIC_DOMAINS` type from `Record<R2BucketName, string>` to `Partial<Record<R2BucketName, string>>` — telemarketing bucket is private (no public domain entry).

**Key path:** `recordings/{timestamp}-{randomUUID}.mp3`
**Presigned URL procedure:** `intakeRouter.getRecordingUploadUrl` — `baseProcedure` + Upstash rate limiting (5 requests/IP/hour)
**File constraints:** content type `audio/mpeg` or `audio/mp4`, max 100MB, presigned URL valid 15 minutes
**Spam/bot protection:** Upstash rate limiting + honeypot field (CSS-hidden). CAPTCHA is a future step.

**Deployment prerequisite:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` must be set in production. Currently marked `optional()` in `client-env.ts` — must be set as required in the deployment environment.

### 3.9 tRPC procedures

**New:** `customersRouter.createFromIntake` — `baseProcedure` + Upstash rate limit
- Input: explicit schema (NOT from `insertCustomerSchema`) — accepts only: `name`, `phone`, `address`, `city`, `state`, `zip`, `email?`, `notes?`, `leadSource`, `leadType`, `leadMetaJSON?`, `scheduledFor?`, `closedById?`
- Creates customer + optional meeting + optional note
- Returns `{ customerId: string }`

**New:** `intakeRouter.getByToken` — `baseProcedure`
- Input: `{ token: string }`
- Returns: `{ leadSourceId, slug, name, formConfig: LeadSourceFormConfig }` or throws `NOT_FOUND`

**New:** `intakeRouter.getInternalUsers` — `baseProcedure`
- No input
- Returns: `Array<{ id: string, name: string }>` for all `role IN ('agent', 'super-admin')` users

**New:** `intakeRouter.getRecordingUploadUrl` — `baseProcedure` + Upstash rate limit
- Input: `{ fileName: string, contentType: 'audio/mpeg' | 'audio/mp4' }`
- Returns: `{ uploadUrl: string, key: string }`

---

## Section 4: Decoupling Notion from Meeting Creation

### 4.1 `CustomerSearch` component

**File:** `src/shared/components/customer-search.tsx`
Replaces `src/shared/components/notion/contact-search.tsx`.

```ts
interface CustomerSearchProps {
  value: string
  onSelect: (id: string, name: string) => void
  onClear: () => void
  prefillCustomerId?: string // skips search, fetches + renders this customer directly
}
```

- **Search mode** (`prefillCustomerId` absent): type name/phone → search → select from results
- **Pre-populated mode** (`prefillCustomerId` provided): fetches by ID, renders selected immediately

### 4.2 `customersRouter.search` + `getById`

**`search`** — `agentProcedure`, `ilike` on `name` and `phone`, returns `Array<{ id, name, phone, address }>`
**`getById`** — `agentProcedure`, single customer by UUID, used by pre-populated mode

### 4.3 `meetings.create` — simplified

**Remove:** `notionContactId` input, `queryNotionDatabase` call, `upsertCustomerFromNotion` call, `pageToContact` import
**Add:** `customerId: z.string().uuid()` via `.extend()` on `insertMeetingSchema` (since `customerId` is in the schema's `.omit()` list)

### 4.4 `create-meeting-view.tsx`

- Replace `<NotionContactSearch>` with `<CustomerSearch>`
- Read `?customerId` nuqs param → pass as `prefillCustomerId`
- Pass `customerId` to `meetings.create`

### 4.5 `meeting-flow.tsx` — remove Notion contact re-fetch

Lines 69–113 currently: read `notionContactId` → fetch from Notion → build `MeetingContext.customer`.

Fix: remove `contactId` / `contactQuery`. Build `MeetingContext.customer` directly from `dbCustomer` (already in `meeting.customer` from the left-join). Null-guard `dbCustomer` before construction.

**Implementation note:** `MeetingContext.customer.id` currently receives a Notion page ID string. After migration it will be a Postgres UUID. Before removing the Notion fetch, grep `MeetingContext` consumers to confirm nothing uses `customer.id` as a Notion identifier.

### 4.6 `edit-contact-form.tsx` — migrate to `CustomerSearch`

- Replace `<NotionContactSearch>` with `<CustomerSearch>` (search mode)
- On save: write both `customerId` (FK) and `contactName` — `insertMeetingSchema.partial()` already accepts `customerId`, no schema change needed

### 4.7 Notion router cleanup

**Before deleting `contacts.router.ts`:** grep `notionRouter.contacts` / `trpc.notionRouter.contacts` across the codebase. Known sites (all addressed above): `create-meeting-view.tsx`, `meeting-flow.tsx`, `edit-contact-form.tsx`, `contact-search.tsx`.

- `src/trpc/routers/notion.router/contacts.router.ts` — deleted
- `src/shared/components/notion/contact-search.tsx` — deleted
- Notion infrastructure remains for trades, scopes, SOWs

**Dead code — follow-up pass:**
- `customersRouter.syncFromNotion` + `customersRouter.getByNotionId` — no callers post-migration
- `syncCustomersJob` QStash handler — calls `syncAllCustomers()`; disable the scheduled job

---

## Implementation Notes

1. **`MeetingContext.customer.id`:** Currently a Notion page ID. After migration it becomes a Postgres UUID. Verify no consumers use it as a Notion identifier before removing the re-fetch in `meeting-flow.tsx`.

2. **Pre-existing env bug:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional` in `client-env.ts` is missing the call parentheses (`.optional` vs `.optional()`). Fix alongside this work.

3. **`createFromIntake` non-transactional:** Customer insert + meeting insert + notes insert are separate calls. Notes/meeting failures do not roll back the customer. Acceptable — the customer record is the critical entity.

4. **`meetings.create` input schema:** `customerId` is in `insertMeetingSchema`'s `.omit()` list. Use `.extend({ customerId: z.string().uuid() })` to add it.

---

## Out of Scope (This Spec)

- Notion projects DB migration
- Post-sale project management in the app
- Customer notes UI (table is created; CRUD UI is a future feature)
- Lead source management UI (seed script is sufficient; UI is a future feature)
- Removing `notionContactId` from the schema
- CAPTCHA on the intake form
- `syncedAt` column rename

---

## File Changelist Summary

### New files
- `src/shared/constants/enums/leads.ts`
- `src/shared/types/enums/leads.ts`
- `src/shared/db/schema/lead-sources.ts`
- `src/shared/db/schema/customer-notes.ts`
- `src/shared/entities/lead-sources/schemas.ts`
- `src/features/intake/schemas/intake-form-schema.ts`
- `src/features/intake/ui/views/intake-form-view.tsx`
- `src/features/intake/ui/components/address-autocomplete-field.tsx`
- `src/features/intake/ui/components/mp3-upload-field.tsx`
- `src/features/intake/ui/components/meeting-scheduler-field.tsx`
- `src/shared/components/customer-search.tsx`
- `src/app/(frontend)/(site)/intake/[token]/page.tsx`
- `src/trpc/routers/intake.router.ts`
- `scripts/migrate-notion-contacts.ts`
- `scripts/seed-lead-sources.ts`

### Modified files
- `package.json` — add `@upstash/ratelimit`, `@upstash/redis`, `nanoid`
- `src/shared/db/schema/customers.ts` — add 3 columns (`leadSource`, `leadType`, `leadMetaJSON`); add `leadMetaJSON` JSONB override to `insertCustomerSchema`
- `src/shared/db/schema/meta.ts` — add `leadSourceEnum`, `leadTypeEnum`
- `src/shared/db/schema/index.ts` — export `customerNotes`, `leadSources`
- `src/shared/constants/enums/index.ts` — re-export from `leads.ts`
- `src/shared/types/enums/index.ts` — re-export from `leads.ts`
- `src/shared/entities/customers/schemas.ts` — add `leadMetaSchema` + `LeadMeta`
- `src/shared/services/r2/buckets.ts` — add `telemarketingRecordings`; change `R2_PUBLIC_DOMAINS` to `Partial<Record<R2BucketName, string>>`
- `src/shared/config/client-env.ts` — fix `.optional` → `.optional()` on Maps API key
- `src/trpc/routers/app.ts` — register `intakeRouter`
- `src/trpc/routers/customers.router.ts` — add `search`, `getById`, `createFromIntake`
- `src/trpc/routers/meetings.router.ts` — simplify `create` (remove Notion dependency)
- `src/trpc/routers/notion.router/index.ts` — remove `contacts` sub-router
- `src/features/meetings/ui/views/create-meeting-view.tsx` — swap search component + mutation input
- `src/features/meetings/ui/views/meeting-flow.tsx` — remove Notion re-fetch; source from `dbCustomer`
- `src/features/meetings/ui/components/edit-contact-form.tsx` — `CustomerSearch` + write `customerId`
- `src/shared/dal/server/customers/api.ts` — extend upsert for new columns

### Deleted files
- `src/trpc/routers/notion.router/contacts.router.ts`
- `src/shared/components/notion/contact-search.tsx`
