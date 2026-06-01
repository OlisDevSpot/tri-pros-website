# Customer Entity Server Spec Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the customers entity into structural parity with the canonical EntityServerSpec pattern (proposals). After this lands, `customersRouter` exposes the same `crud` + `business` shape, every customer DAL function returns `DalReturn<T>` and accepts `ScopedContext`, the inline `isOmni`/`db.*` dance disappears from the router, and JSONB profile updates deep-merge instead of overwriting.

**Architecture:** Five surgical phases over a single branch. Phase 0 is a small framework prerequisite that closes a stale-doc gap (`jsonbMergeColumns` is declared and documented but never consumed — see "Staleness Ping" below). Phases 1–5 migrate customers using the now-truthful framework. Each phase compiles, lints, and leaves the app fully functional — frequent commits, behavior-preserving except for the explicit JSONB-merge fix.

**Tech stack:** Next.js 15, tRPC v11, Drizzle ORM (Postgres/Neon), Zod, CASL, better-auth. Verification gates: `pnpm tsc` + `pnpm lint`. No build step. Manual flow walk via dev server.

---

## Staleness Ping (read before starting)

⚠️ **`spec.update.jsonbMergeColumns` is declared and documented but unwired.**

- Type declares it: [src/shared/dal/server/types.ts:79](src/shared/dal/server/types.ts#L79)
- Proposals sets it: [src/shared/entities/proposals/lib/server-spec.ts:37-44](src/shared/entities/proposals/lib/server-spec.ts#L37-L44)
- DOCS.md claims it works: [src/trpc/DOCS.md:221-224](src/trpc/DOCS.md#L221-L224) and [src/shared/entities/proposals/DOCS.md:95-96](src/shared/entities/proposals/DOCS.md#L95-L96)
- **But:** [src/shared/dal/server/lib/create-crud-dal.ts:117-121](src/shared/dal/server/lib/create-crud-dal.ts#L117-L121) does plain `.set(validated)` — `jsonbMergeColumns` is never read anywhere in `src/`.

**Implication for customers:** the entire purpose of declaring `update.jsonbMergeColumns: [customerProfileJSON, propertyProfileJSON, financialProfileJSON]` is to fix the existing partial-update overwrite bug in `business.updateProfile`. We can only fix it if Phase 0 closes the framework gap. Skipping Phase 0 would just relocate the bug from the router to the DAL.

Phase 0 is therefore part of this plan, not a separate effort.

---

## File structure (what each phase touches)

| File | Phase | Action |
|---|---|---|
| `src/shared/dal/server/lib/create-crud-dal.ts` | 0 | Modify `updateImpl` to honor `spec.update.jsonbMergeColumns` via `sql\`COALESCE(col, '{}'::jsonb) \|\| ${value}::jsonb\`` |
| `src/shared/entities/customers/lib/server-spec.ts` | 1 | Add `update.jsonbMergeColumns` (3 columns) + `hooks.delete.before` (cascade meetings/proposals) |
| `src/shared/entities/customers/dal/server/queries.ts` | 2 | Rewrite `getCustomer`/`getCustomers` to take `ScopedContext` and return `DalReturn<T>`; remove `CustomersViewer`; drop inline `deleteCustomer` (logic moves to spec hook) |
| `src/trpc/routers/customers.router/index.ts` | 3 | Mount `crud: createCrudRouter(...)` alongside `business` |
| `src/trpc/routers/customers.router/business.router.ts` | 4–5 | Refactor mutations to call `customerCrud.update/delete`; replace `isOmni` + `userCanSeeCustomer` dance with `ctx.scope` |
| `src/shared/components/customer-search.tsx`, `src/shared/entities/customers/hooks/use-customer-actions.ts` | 5 (verify only) | No code change — existing `trpc.customersRouter.business.*` procedure names preserved |

**Untouched:** `dal/server/visibility.ts`, `lib/visibility.ts`, `lib/constants.ts`, `lib/phone-gating-sql.ts`, `lib/derived-pipeline-sql.ts`, `lib/signed-customer-sql.ts`, `lib/customer-predicates.ts`, `DOCS.md`. The schema layer, derived helpers, and business rules survive verbatim.

---

## Phase 0 — Wire `jsonbMergeColumns` in `updateImpl`

**Why first:** proposals declares this config; customers' migration depends on it for correctness. Closing the framework gap once benefits all entities.

### Task 0.1: Add JSONB deep-merge to updateImpl

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts:95-135`

- [ ] **Step 1: Read the current `updateImpl`**

Open [src/shared/dal/server/lib/create-crud-dal.ts:95](src/shared/dal/server/lib/create-crud-dal.ts#L95) — confirm `.set(validated as Record<string, unknown>)` on line 119 has no merge logic.

- [ ] **Step 2: Add merge utility above `updateImpl`**

Insert after line 92 (between `createImpl` and `updateImpl`):

```ts
import { sql } from 'drizzle-orm'

/**
 * Build a Drizzle `.set()` payload that deep-merges configured JSONB
 * columns with their existing row value via `COALESCE(col, '{}') || $value`.
 * Non-JSONB fields pass through to plain overwrite. see ../DOCS.md#jsonb-merge-on-update
 *
 * Only merges fields the caller actually passed — undefined fields are dropped
 * so existing JSONB content is preserved when the input has no key for it.
 */
function buildUpdateSet<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  validated: Record<string, unknown>,
): Record<string, unknown> {
  const mergeCols = spec.update?.jsonbMergeColumns
  if (!mergeCols || mergeCols.length === 0) {
    return validated
  }
  const mergeNames = new Set(mergeCols.map(col => col.name))
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(validated)) {
    if (value === undefined) {
      continue
    }
    if (mergeNames.has(key) && value !== null && typeof value === 'object') {
      out[key] = sql`COALESCE(${sql.identifier(key)}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`
    }
    else {
      out[key] = value
    }
  }
  return out
}
```

Note: `sql.identifier(key)` is required because the column name (camelCase in TS) maps to a snake_case DB column via Drizzle's mapping. We use the Drizzle column name from the PgColumn objects in `mergeCols`. Replace the `mergeNames` set construction to map TS key → DB column name:

```ts
const mergeNames = new Map(mergeCols.map(col => [col.name, col]))
// then:
if (mergeNames.has(key) && value !== null && typeof value === 'object') {
  const col = mergeNames.get(key)!
  out[key] = sql`COALESCE(${col}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`
}
```

Drizzle's `PgColumn` interpolates correctly with table-qualified snake_case in `sql\`\`` template literals — that's why `col` works directly and `sql.identifier(key)` is wrong here. Use `col` (the PgColumn from the spec) in the SQL fragment.

- [ ] **Step 3: Wire `buildUpdateSet` into `updateImpl`**

Replace [src/shared/dal/server/lib/create-crud-dal.ts:117-121](src/shared/dal/server/lib/create-crud-dal.ts#L117-L121):

```ts
    const validated = spec.schemas.update.parse(enrichedData) as Update<TTable>
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [row] = await db
      .update(spec.table as PgTable)
      .set(buildUpdateSet(spec, validated as Record<string, unknown>))
      .where(where)
      .returning()
```

- [ ] **Step 4: Add a smoke type-check + lint**

Run:
```bash
pnpm tsc
pnpm lint
```
Expected: clean. The `sql` import added at the top should be sorted by `perfectionist/sort-imports` — verify the import ordering matches the existing pattern (alphabetical within group, drizzle-orm imports together).

- [ ] **Step 5: Manual smoke against proposals (regression guard)**

Start dev: `pnpm dev`. Open a proposal that has existing `formMetaJSON.someKey = "old"`. Send a partial update setting only `formMetaJSON.otherKey = "new"`. Confirm via DB inspection (or refetch) that `formMetaJSON.someKey` is still `"old"` and `formMetaJSON.otherKey === "new"`. If the proposal-flow UI doesn't expose a partial JSONB update path easily, query directly via `pnpm tsx scripts/<adhoc>.ts` calling `proposalCrud.update(SYSTEM_CONTEXT, { id, data: { formMetaJSON: { otherKey: 'new' } } })`. Confirm by reading the row back: existing keys survive, new key is added.

If a regression appears (proposals expects overwrite semantics somewhere), pause and investigate — but per the DOCS.md claim, merge is the intended behavior.

- [ ] **Step 6: Commit**

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "$(cat <<'EOF'
feat(dal): wire spec.update.jsonbMergeColumns into createCrudDal updateImpl

The config was declared in EntityServerSpec and set on proposalServerSpec, and
documented in src/trpc/DOCS.md + entities/proposals/DOCS.md as the enforcement
point for JSONB deep-merge on update — but the updateImpl in create-crud-dal.ts
never read it, doing plain .set() instead. This wires it up so the docs match
the code, and unblocks customers migrating their three JSONB profile columns
(customerProfileJSON, propertyProfileJSON, financialProfileJSON) to partial
updates without losing existing keys.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — Enrich `customerServerSpec`

**Why:** Customers carries three JSONB profile columns and needs cascade delete semantics (today inlined in `deleteCustomer`). Move both onto the spec so the standardized CRUD handles them.

### Task 1.1: Add JSONB merge config + delete cascade hook

**Files:**
- Modify: `src/shared/entities/customers/lib/server-spec.ts`

- [ ] **Step 1: Rewrite the spec**

Replace [src/shared/entities/customers/lib/server-spec.ts](src/shared/entities/customers/lib/server-spec.ts) with:

```ts
import type { EntityServerSpec } from '@/shared/dal/server/types'

import { inArray } from 'drizzle-orm'

import { db } from '@/shared/db'
import {
  customers,
  insertCustomerSchema,
  selectCustomerSchema,
} from '@/shared/db/schema'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'

const updateCustomerSchema = insertCustomerSchema.partial()

export const customerSchemas = {
  insert: insertCustomerSchema,
  update: updateCustomerSchema,
}

export const customerServerSpec = {
  entityName: CUSTOMER,
  caslSubject: CUSTOMER,
  visibility: customerVisibility,
  table: customers,
  schemas: {
    insert: insertCustomerSchema,
    update: updateCustomerSchema,
    select: selectCustomerSchema,
  },
  // see ../DOCS.md#three-jsonb-profiles — agents fill these progressively;
  // partial updates must deep-merge, not overwrite.
  update: {
    jsonbMergeColumns: [
      customers.customerProfileJSON,
      customers.propertyProfileJSON,
      customers.financialProfileJSON,
      customers.leadMetaJSON,
    ] as const,
  },
  hooks: {
    delete: {
      // The schema's FK behavior for meetings.customerId / proposals.meetingId
      // is SET NULL on parent delete — which would orphan rows. We manually
      // delete proposals → meetings in the same transaction before the
      // customer row is removed. customer_notes and projects cascade via
      // schema FKs and need no manual step.
      // Was previously inlined in dal/server/queries.ts:deleteCustomer.
      async before(id, _ctx) {
        await db.transaction(async (tx) => {
          const customerMeetings = await tx
            .select({ id: meetings.id })
            .from(meetings)
            .where(inArray(meetings.customerId, [id as string]))
          const meetingIds = customerMeetings.map(m => m.id)
          if (meetingIds.length > 0) {
            await tx.delete(proposals).where(inArray(proposals.meetingId, meetingIds))
            await tx.delete(meetings).where(inArray(meetings.id, meetingIds))
          }
        })
      },
    },
  },
} satisfies EntityServerSpec<typeof customers>
```

Notes:
- `leadMetaJSON` is added to the merge list because it's also a Zod-typed JSONB and partial updates should behave the same way (`see DOCS.md#lead-attribution-fields`).
- The delete hook intentionally does its cascade in a **separate transaction** that commits BEFORE the customer row is deleted by `updateImpl`. This matches `dalDbOperation`'s outer try/catch and avoids nested transactions. If a future requirement is "delete must be fully atomic with cascade," it warrants a separate refactor — out of scope here.
- The schema's published FK behavior is captured in the inline comment — verify against [src/shared/db/schema/meetings.ts](src/shared/db/schema/meetings.ts) and [src/shared/db/schema/proposals.ts](src/shared/db/schema/proposals.ts) before committing. If the FK is actually `ON DELETE CASCADE`, the hook is unnecessary and we drop it; if it's `SET NULL`, the hook is required.

- [ ] **Step 2: Verify FK behavior matches the comment**

```bash
grep -n "references(" /home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/db/schema/meetings.ts | head -5
grep -n "references(" /home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/db/schema/proposals.ts | head -5
```

Expected: `meetings.customerId` references `customers.id` with `{ onDelete: 'set null' }` (or similar). `proposals.meetingId` references `meetings.id` with `{ onDelete: 'set null' }`. Confirm this matches the comment in the spec. If the schema actually cascades, drop the entire `hooks.delete` block from the spec — `customerCrud.delete` will then just work via the FK.

- [ ] **Step 3: tsc + lint**

```bash
pnpm tsc
pnpm lint
```
Expected: clean. `customerSchemas` was already exported (line 13 of the original); it's still exported.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/lib/server-spec.ts
git commit -m "$(cat <<'EOF'
feat(customers): enrich server spec with JSONB merge + delete cascade hook

Adds update.jsonbMergeColumns for the four typed JSONB columns
(customerProfileJSON, propertyProfileJSON, financialProfileJSON,
leadMetaJSON) so partial updates deep-merge — was a known shallow-overwrite
bug in business.updateProfile. Moves the manual proposals→meetings cascade
delete out of dal/server/queries.ts:deleteCustomer and onto
spec.hooks.delete.before so customerCrud.delete handles it transparently.

No router/DAL surface changes yet — those follow in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Standardize `dal/server/queries.ts`

**Why:** All DAL functions in the canonical pattern accept `ScopedContext` first and return `Promise<DalReturn<T>>`. Today customers' queries use a bespoke `CustomersViewer { userId, isSuperAdmin }` shape and return raw `Promise<Customer>`. Migration punch-list category B.

### Task 2.1: Convert reads to ScopedContext + DalReturn

**Files:**
- Modify: `src/shared/entities/customers/dal/server/queries.ts`

- [ ] **Step 1: Rewrite the file**

Replace [src/shared/entities/customers/dal/server/queries.ts](src/shared/entities/customers/dal/server/queries.ts) with:

```ts
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Customer } from '@/shared/db/schema/customers'
import type { Contact } from '@/shared/services/providers/notion/lib/contacts/schema'

import { and, eq, getTableColumns } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { queryNotionDatabase } from '@/shared/services/providers/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/providers/notion/lib/contacts/adapter'

export type { Customer }

export type CustomerWithPhoneGate = Customer & { hasSentProposal: boolean }

// Phone-gating column selection. The `ability` on ctx tells us whether the
// caller is super-admin (sees real phone) or agent (sees gated null). When
// ability is null (SYSTEM_CONTEXT — jobs, webhooks), we ungate fully because
// SYSTEM-level callers never surface phone to a user.
// see ../../DOCS.md#phone-visibility-threshold
function customerSelectWithGate(ctx: ScopedContext) {
  const isOmni = ctx.ability == null || ctx.ability.can('manage', 'all')
  const { phone: _phone, ...rest } = getTableColumns(customers)
  return {
    ...rest,
    phone: gatedPhoneSql(isOmni),
    hasSentProposal: hasSentProposalSql(),
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Phone-gated single-customer read. Scope applied via ctx.scope (set by
 * scopeMiddleware on the customers entity router, or by buildUserContext
 * for service/job callers).
 */
export async function getCustomer(
  ctx: ScopedContext,
  input: { id: string },
): Promise<DalReturn<CustomerWithPhoneGate | undefined>> {
  return dalDbOperation(async () => {
    const [customer] = await db
      .select(customerSelectWithGate(ctx))
      .from(customers)
      .where(and(eq(customers.id, input.id), ctx.scope ?? undefined))
    return customer as CustomerWithPhoneGate | undefined
  })
}

/** Phone-gated list of all customers visible to ctx. */
export async function listCustomers(
  ctx: ScopedContext,
): Promise<DalReturn<CustomerWithPhoneGate[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select(customerSelectWithGate(ctx))
      .from(customers)
      .where(ctx.scope ?? undefined)
    return rows as CustomerWithPhoneGate[]
  })
}

// ── System-level upserts ──────────────────────────────────────────────────────
// These run under SYSTEM_CONTEXT (Notion sync, webhook ingestion). They write
// the customers table directly because they predate the entity-server pattern
// and are scheduled for migration to customerCrud.create in a follow-up. For
// now, signature-standardize them.

export async function upsertCustomerFromNotion(
  ctx: ScopedContext,
  input: { contact: Contact },
): Promise<DalReturn<Customer>> {
  return dalDbOperation(async () => {
    const { contact } = input
    const now = new Date().toISOString()
    const [customer] = await db
      .insert(customers)
      .values({
        notionContactId: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        address: contact.address,
        city: contact.city,
        state: contact.state,
        zip: contact.zip,
        syncedAt: now,
      })
      .onConflictDoUpdate({
        target: customers.notionContactId,
        set: {
          name: contact.name,
          phone: contact.phone ?? null,
          email: contact.email ?? null,
          address: contact.address ?? null,
          city: contact.city ?? '',
          state: contact.state ?? null,
          zip: contact.zip ?? '',
          syncedAt: now,
        },
      })
      .returning()
    return customer
  })
}

interface HomeownerData {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

export async function findOrCreateCustomerFromHomeowner(
  ctx: ScopedContext,
  input: { data: HomeownerData },
): Promise<DalReturn<Customer>> {
  return dalDbOperation(async () => {
    const { data } = input
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, data.email))
      .limit(1)
    if (existing) {
      return existing
    }
    const [customer] = await db
      .insert(customers)
      .values({
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        address: data.address ?? null,
        city: data.city ?? '',
        state: data.state ?? null,
        zip: data.zip ?? '',
        syncedAt: new Date().toISOString(),
      })
      .returning()
    return customer
  })
}

interface WebhookCustomerData {
  name: string
  phone: string
  email?: string | null
  city: string
  zip: string
  state?: string | null
  leadSourceSlug: string
}

export async function createCustomerFromWebhook(
  ctx: ScopedContext,
  input: { data: WebhookCustomerData },
): Promise<DalReturn<Customer>> {
  return dalDbOperation(async () => {
    const { data } = input
    const { leadSourceSlug, ...customerData } = data
    const [leadSource] = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, leadSourceSlug))
      .limit(1)
    if (!leadSource) {
      throw new Error(`Lead source "${leadSourceSlug}" not found`)
    }
    const [customer] = await db
      .insert(customers)
      .values({
        ...customerData,
        email: customerData.email ?? null,
        state: customerData.state ?? 'CA',
        leadSourceId: leadSource.id,
      })
      .returning()
    return customer
  })
}

// ── Notion full sync ──────────────────────────────────────────────────────────

export async function syncAllCustomers(
  ctx: ScopedContext,
): Promise<DalReturn<{ upserted: number }>> {
  return dalDbOperation(async () => {
    const pages = await queryNotionDatabase('contacts') as PageObjectResponse[] | undefined
    if (!pages) {
      return { upserted: 0 }
    }
    let upserted = 0
    for (const page of pages) {
      try {
        const contact = pageToContact(page)
        const result = await upsertCustomerFromNotion(ctx, { contact })
        if (result.success) {
          upserted++
        }
      }
      catch {
        // Skip malformed Notion contacts — do not abort the full sync
      }
    }
    return { upserted }
  })
}
```

Removed: `CustomersViewer` interface, `customerVisibilityWhere` helper, `deleteCustomer` function (logic moved to `spec.hooks.delete.before` in Phase 1).

- [ ] **Step 2: tsc — expect callers to break**

```bash
pnpm tsc
```
Expected: errors at every call site for the renamed/resigned functions. Capture the list. Most should be:
- `src/trpc/routers/customers.router/business.router.ts` — uses `getCustomer`, `getCustomers`, `deleteCustomer`
- `src/shared/services/providers/notion/**` — uses `upsertCustomerFromNotion`, `syncAllCustomers`
- `src/shared/services/providers/upstash/jobs/**` — may use `createCustomerFromWebhook`
- `src/features/landing/dal/**` — may use `findOrCreateCustomerFromHomeowner`

- [ ] **Step 3: Update non-router callers (system-context paths)**

For each caller in `services/providers/notion/`, `services/providers/upstash/jobs/`, or `features/landing/dal/` that uses the renamed functions: pass `SYSTEM_CONTEXT` as the first arg, restructure the call into the new `(ctx, { ...input })` shape, and unwrap `DalReturn` with `dalVerifySuccess` or pattern-match on `result.success`.

Example transformation:

Before:
```ts
import { upsertCustomerFromNotion } from '@/shared/entities/customers/dal/server/queries'
const customer = await upsertCustomerFromNotion(contact)
```

After:
```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { upsertCustomerFromNotion } from '@/shared/entities/customers/dal/server/queries'

const customer = dalVerifySuccess(
  await upsertCustomerFromNotion(SYSTEM_CONTEXT, { contact }),
)
```

The router caller (`business.router.ts`) gets fixed in Phase 4. For now, also fix it minimally just so tsc passes:

```ts
// in business.router.ts:53 (inside getAll)
const result = await getCustomers(ctx)
return result.success ? result.data : []
```
This is a temporary shim — Phase 4 replaces it with proper `ctx.scope`-based code.

- [ ] **Step 4: tsc + lint**

```bash
pnpm tsc
pnpm lint
```
Expected: clean. If any call site is missed, tsc will say so explicitly.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/customers/dal/server/queries.ts src/trpc/routers/customers.router/business.router.ts src/shared/services src/features
git commit -m "$(cat <<'EOF'
refactor(customers/dal): standardize queries to ScopedContext + DalReturn<T>

Brings dal/server/queries.ts onto the canonical DAL signature
((ctx: ScopedContext, input) => Promise<DalReturn<T>>) and drops the
bespoke CustomersViewer shape in favor of ctx.scope + ctx.ability.
deleteCustomer is removed entirely — the cascade now lives on
customerServerSpec.hooks.delete.before (added in the previous commit).

All non-router callers updated to pass SYSTEM_CONTEXT and unwrap DalReturn.
The single router caller (business.router.ts) gets a minimal shim that
Phase 4 replaces with ctx.scope-based code.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Mount `crud` on `customersRouter`

**Why:** Match the proposals shape. The CRUD sub-router becomes the canonical 5-slot API; `business` keeps custom queries and field-specific mutations.

### Task 3.1: Mount createCrudRouter

**Files:**
- Modify: `src/trpc/routers/customers.router/index.ts`

- [ ] **Step 1: Rewrite the index**

Replace [src/trpc/routers/customers.router/index.ts](src/trpc/routers/customers.router/index.ts) with:

```ts
import z from 'zod'

import { customerSchemas, customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { createCustomerBusinessRouter } from './business.router'

export const customersRouter = createEntityRouter(customerServerSpec, (entity) => {
  return createTRPCRouter({
    // ── CRUD (5 single-row operations) ──────────────────────────────────
    // Generated by createCrudRouter. spec.update.jsonbMergeColumns deep-merges
    // the four typed JSONB columns; spec.hooks.delete.before cascades meeting
    // and proposal deletes before the customer row is removed.
    crud: createCrudRouter({
      spec: customerServerSpec,
      schemas: { ...customerSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),

    // ── Business queries + entity-specific mutations ────────────────────
    // Hand-coded: list/search/getAll (phone-gated reads), createFromIntake
    // (rate-limited public + multi-step tx), addNote (customer_notes table),
    // updateProfile/updateCreatedAt/updateLeadSource/updateCustomerContact
    // (field-specific CASL + side effects).
    business: createCustomerBusinessRouter(entity),
  })
})
```

- [ ] **Step 2: tsc + lint**

```bash
pnpm tsc
pnpm lint
```
Expected: clean. `createCrudRouter` is generic-inferred; `z.string().uuid()` matches the spec's default `TId = string`.

- [ ] **Step 3: Manual smoke**

Start dev: `pnpm dev`. In the browser console on any agent page, fire:
```js
fetch('/api/trpc/customersRouter.crud.getById?input=' + encodeURIComponent(JSON.stringify({json:{id:'<some-customer-uuid>'}})))
  .then(r => r.json()).then(console.log)
```
Expected: returns the customer row (or 403 FORBIDDEN if CASL gates the read for the logged-in role). 500s mean a wiring bug — investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/customers.router/index.ts
git commit -m "$(cat <<'EOF'
feat(customers/router): mount crud sub-router alongside business

Brings customersRouter to structural parity with proposalsRouter — the
5-slot CRUD surface (getById/create/update/delete/duplicate) is now
generated from customerServerSpec, with JSONB merge and cascade-delete
behavior wired through the spec. Existing business procedures are
unchanged in this commit; subsequent commits route their internals
through customerCrud and remove the inline isOmni/db dance.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Route business mutations through `customerCrud`

**Why:** Each existing business mutation does `db.update(customers).set(...).where(eq(customers.id, ...))` directly. Routing through `customerCrud.update` gets visibility scoping for free (scope middleware applies), gets JSONB merge for free (spec config), and keeps field-specific CASL gates + side effects (geocode reset, lead-source join) in the router where they belong.

### Task 4.1: Refactor `updateProfile`

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts:152-174`

- [ ] **Step 1: Replace the mutation body**

In [business.router.ts:152](src/trpc/routers/customers.router/business.router.ts#L152), replace the `updateProfile` mutation block with:

```ts
    // Update customer profile JSONB fields (used during meeting intake).
    // Routes through customerCrud.update — spec.update.jsonbMergeColumns
    // deep-merges customerProfileJSON / propertyProfileJSON /
    // financialProfileJSON so partial updates don't overwrite existing keys.
    // see ../../shared/entities/customers/DOCS.md#three-jsonb-profiles
    updateProfile: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        customerProfileJSON: customerProfileSchema.optional(),
        propertyProfileJSON: propertyProfileSchema.optional(),
        financialProfileJSON: financialProfileSchema.optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { customerId, ...profiles } = input
        return dalToTrpc(await customerCrud.update(ctx, { id: customerId, data: profiles }))
      }),
```

Add the imports at the top of the file (alphabetical within the import group, per `perfectionist/sort-imports`):

```ts
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { dalToTrpc } from '../../lib/dal-to-trpc'
```

Remove the now-unused `TRPCError` import only if no other handler uses it (don't blindly remove — search the file first).

### Task 4.2: Refactor `updateCreatedAt`

- [ ] **Step 1: Replace mutation body**

Replace [business.router.ts:182-203](src/trpc/routers/customers.router/business.router.ts#L182-L203):

```ts
    updateCreatedAt: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        createdAt: z.string().datetime(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.ability.cannot('update', 'Customer', 'createdAt')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to edit the created date.' })
        }
        const row = dalToTrpc(await customerCrud.update(ctx, {
          id: input.customerId,
          data: { createdAt: input.createdAt },
        }))
        return { id: row.id, createdAt: row.createdAt }
      }),
```

### Task 4.3: Refactor `updateLeadSource`

- [ ] **Step 1: Replace mutation body**

Replace [business.router.ts:209-253](src/trpc/routers/customers.router/business.router.ts#L209-L253):

```ts
    updateLeadSource: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        leadSourceId: z.string().uuid(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.ability.cannot('update', 'Customer', 'leadSourceId')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to change the lead source.' })
        }
        // Validate target lead source exists (FK check would also catch it,
        // but a clean 404 beats a Postgres FK error)
        const [target] = await db
          .select({ name: leadSourcesTable.name, slug: leadSourcesTable.slug })
          .from(leadSourcesTable)
          .where(eq(leadSourcesTable.id, input.leadSourceId))
          .limit(1)
        if (!target) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Lead source not found' })
        }
        const updated = dalToTrpc(await customerCrud.update(ctx, {
          id: input.customerId,
          data: { leadSourceId: input.leadSourceId },
        }))
        return {
          id: updated.id,
          leadSourceId: updated.leadSourceId,
          leadSourceName: target.name,
          leadSourceSlug: target.slug,
        }
      }),
```

### Task 4.4: Refactor `updateCustomerContact`

- [ ] **Step 1: Replace mutation body**

Replace [business.router.ts:259-305](src/trpc/routers/customers.router/business.router.ts#L259-L305):

```ts
    updateCustomerContact: entity.authedProcedure
      .input(z.object({
        customerId: z.string().uuid(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().length(2).optional(),
        zip: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { customerId, ...fields } = input
        const updateData: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined) {
            continue
          }
          if (ctx.ability.cannot('update', 'Customer', key)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: `You do not have permission to update ${key}.` })
          }
          updateData[key] = value
        }
        if (Object.keys(updateData).length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' })
        }
        // Invalidate cached geocode whenever address components change.
        // see ../../shared/entities/customers/DOCS.md#geocoding-stored-on-customer
        const addressChanged = ['address', 'city', 'state', 'zip'].some(k => k in updateData)
        if (addressChanged) {
          updateData.latitude = null
          updateData.longitude = null
          updateData.geocodedAt = null
        }
        return dalToTrpc(await customerCrud.update(ctx, { id: customerId, data: updateData }))
      }),
```

### Task 4.5: Refactor `delete`

- [ ] **Step 1: Replace mutation body**

Replace [business.router.ts:379-387](src/trpc/routers/customers.router/business.router.ts#L379-L387):

```ts
    delete: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        // CASL gate is also enforced by createCrudRouter.delete; this
        // duplicates it here so the explicit business endpoint returns
        // the same FORBIDDEN message format as before.
        if (ctx.ability.cannot('delete', 'Customer')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to delete customers.' })
        }
        dalToTrpc(await customerCrud.delete(ctx, { id: input.customerId }))
        return { success: true as const }
      }),
```

The cascade (meetings + proposals deletion) now fires via `spec.hooks.delete.before` from Phase 1.

### Task 4.6: tsc + lint + manual smoke for Phase 4

- [ ] **Step 1: Verify**

```bash
pnpm tsc
pnpm lint
```
Expected: clean.

- [ ] **Step 2: Manual smoke walk**

`pnpm dev`. Open a customer in the agent dashboard:
1. Edit a profile field (e.g., trigger event) — confirm save succeeds and other profile keys are preserved on refresh.
2. (Super-admin only) Edit createdAt and lead source — confirm both save and lead-source name/slug refresh.
3. Edit address — confirm geocode coords clear (latitude/longitude reset to null).
4. Delete a test customer that has at least one meeting + proposal — confirm meeting and proposal rows are deleted (no orphans).

If any step fails, fix before committing.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers/router): route business mutations through customerCrud

updateProfile, updateCreatedAt, updateLeadSource, updateCustomerContact,
and delete all now call customerCrud.update / customerCrud.delete instead
of inlining db.update / db.delete. Per-field CASL gates and side effects
(geocode reset on address change, lead-source join after update) stay in
the router where they belong. The cascade for delete moves to
spec.hooks.delete.before (already added).

Behavior change: updateProfile now deep-merges the three JSONB profile
columns instead of overwriting — was a pre-existing bug where partial
profile saves wiped sibling keys.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Remove the inline `isOmni` + `userCanSeeCustomer` dance

**Why:** Scope middleware (applied by `createEntityRouter`) already injects `ctx.scope` as either `null` (omni) or the visibility predicate (agent). The five inline `isOmni` checks in business.router.ts duplicate this logic and bypass the standardized middleware contract.

### Task 5.1: Refactor `getAll`

- [ ] **Step 1: Replace the procedure**

Replace [business.router.ts:52-56](src/trpc/routers/customers.router/business.router.ts#L52-L56):

```ts
    // Fetch all customers visible to the caller. Scope is set by middleware.
    getAll: entity.authedProcedure
      .query(async ({ ctx }) => {
        return dalToTrpc(await listCustomers(ctx))
      }),
```

Update the import at the top: change `getCustomer, getCustomers` → `getCustomer, listCustomers` (Phase 2 renamed `getCustomers` to `listCustomers`).

### Task 5.2: Refactor `list`

- [ ] **Step 1: Replace the visibility branch**

In [business.router.ts:63-113](src/trpc/routers/customers.router/business.router.ts#L63-L113), replace lines 69-72 (the `isOmni` + `visibilityWhere` block):

```ts
        const searchWhere = buildSearchWhere(input.search, [customers.name, customers.email])
        const filterWhere = buildFilterWhere(input.filters, {
          // ...unchanged
        })
        const where = and(ctx.scope ?? undefined, searchWhere, filterWhere)
```

Drop the `userCanSeeCustomer` import (still used by `search` — verify before removing). Drop the `isOmni` local var. Everything else in `list` is unchanged.

### Task 5.3: Refactor `getById`

- [ ] **Step 1: Replace the procedure body**

Replace [business.router.ts:116-121](src/trpc/routers/customers.router/business.router.ts#L116-L121):

```ts
    // Phone-gated single-customer read. Scope is enforced by middleware.
    getById: entity.authedProcedure
      .input(z.object({ customerId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return dalToTrpc(await getCustomer(ctx, { id: input.customerId }))
      }),
```

### Task 5.4: Refactor `search`

- [ ] **Step 1: Replace the procedure**

Replace [business.router.ts:126-150](src/trpc/routers/customers.router/business.router.ts#L126-L150):

```ts
    // Search customers by name (agents) or name + phone (super-admins). Phone
    // is returned gated. see ../../shared/entities/customers/DOCS.md#phone-visibility-threshold
    search: entity.authedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        const isOmni = ctx.ability.can('manage', 'all')
        const q = `%${input.query}%`
        // Super-admins can match by phone; agents cannot (leaks customer-at-number).
        const textWhere = isOmni
          ? or(ilike(customers.name, q), ilike(customers.phone, q))
          : ilike(customers.name, q)
        return db
          .select({
            id: customers.id,
            name: customers.name,
            phone: gatedPhoneSql(isOmni),
            hasSentProposal: hasSentProposalSql(),
            address: customers.address,
          })
          .from(customers)
          .where(and(textWhere, ctx.scope ?? undefined))
          .limit(10)
      }),
```

Note: `isOmni` is **kept** here intentionally — it drives the phone-column WHERE clause and the gated-phone select expression. This is the legitimate case from the migration punch list E ("the legitimate spots: middleware, DAL helpers, render gates"). It is NOT a duplicate of the visibility predicate.

### Task 5.5: Drop unused imports + tsc + lint

- [ ] **Step 1: Clean up**

After Tasks 5.1–5.4, the following imports are likely unused in business.router.ts. Verify and remove:
- `userCanSeeCustomer` from `@/shared/entities/customers/dal/server/visibility` (only `search` referenced it pre-migration; now it doesn't)

Run:
```bash
pnpm tsc
pnpm lint
```
Expected: clean. `perfectionist/sort-imports` may reorder imports — accept.

- [ ] **Step 2: Manual smoke walk**

`pnpm dev`. Test as both agent and super-admin:
1. `/dashboard/customers` table loads with correct row count (agent sees scoped subset, super-admin sees all).
2. Customer profile modal opens with gated phone (agent: null until sent proposal; super-admin: always shown).
3. Customer search in proposal/meeting flows returns results.
4. Lead-sources admin's "All customers" pane loads.
5. Action queue + dashboard hub don't regress.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/customers.router/business.router.ts
git commit -m "$(cat <<'EOF'
refactor(customers/router): drop inline isOmni dance, use ctx.scope

Five inline `isOmni`/`userCanSeeCustomer` branches in business.router.ts
duplicated what scopeMiddleware already injects via ctx.scope. Removing
them leaves the canonical EntityServerSpec contract: middleware resolves
scope once at the procedure boundary; handlers just use ctx.scope ?? undefined.

The single isOmni call retained in `search` is a legitimate non-visibility
use (it drives the gated-phone column and the agent-vs-super-admin text
WHERE clause), matching the migration punch list category E exceptions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Verification + punch-list update

### Task 6.1: Full app smoke walk

- [ ] **Step 1: Verify gates**

```bash
pnpm tsc
pnpm lint
```
Both must be clean.

- [ ] **Step 2: Walk every customer surface as agent**

Login as a non-omni agent. Verify each surface still works:
- `/dashboard/customers` — table loads, only visible customers shown
- Customer profile modal — opens, profile/details/timeline tabs render
- Customer search modal (from meeting/proposal flows) — typing returns results
- Quick note add — persists
- Profile field edit — sibling JSONB keys preserved across saves
- Address edit — geocode coords clear

- [ ] **Step 3: Walk every customer surface as super-admin**

Login as super-admin. Verify the above PLUS:
- Phone numbers visible in all surfaces
- Edit createdAt + lead-source on a test customer — refreshes both customer + lead-source query trees
- Delete a test customer with ≥1 meeting + proposal — confirm cascade

- [ ] **Step 4: Verify CRUD via the new surface**

In browser devtools, fire each of:
- `trpc.customersRouter.crud.getById.query({ id: '<test-uuid>' })`
- `trpc.customersRouter.crud.update.mutate({ id: '<test-uuid>', data: { customerProfileJSON: { newKey: 'value' } } })` then re-fetch and confirm sibling keys preserved

Expected: each call works (or returns CASL FORBIDDEN if role-gated).

### Task 6.2: Update the punch list

**Files:**
- Modify: `docs/plans/entity-server-migration-punch-list.md`

- [ ] **Step 1: Mark customers as done**

In the category-A table, change the customers row's status from "P2 | already partially migrated" to "✅ shipped <PR-num>". In the category-B table, mark both customers DAL files as ✅. In the recommended issue grouping, mark issue 1 done.

- [ ] **Step 2: Add a note about Phase 0**

Add a footnote under "Status snapshot": "Phase 0 of the customer migration (PR #N) wired `spec.update.jsonbMergeColumns` into createCrudDal — proposals also gained correct deep-merge behavior as a side effect; verify no regression in proposal-flow partial-update paths."

- [ ] **Step 3: Commit**

```bash
git add docs/plans/entity-server-migration-punch-list.md
git commit -m "$(cat <<'EOF'
docs(plans): mark customer entity migration shipped, note jsonb-merge wiring

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6.3: Verify DOCS.md claims are now truthful

- [ ] **Step 1: Sanity check stale doc**

Re-read `src/trpc/DOCS.md:221-224` and `src/shared/entities/proposals/DOCS.md:95-96`. After Phase 0, both are now **truthful** — `jsonbMergeColumns` is consumed by `updateImpl`. No doc edits needed; the staleness is resolved by the code change.

If desired, add a one-line "history" note to `src/shared/entities/customers/DOCS.md#three-jsonb-profiles` indicating partial updates are now safe:
> Partial updates merge — drives `spec.update.jsonbMergeColumns` in `customerServerSpec`. Sibling keys survive a partial save.

---

## Post-merge follow-ups (out of scope here, but call out)

- The four `system-level` DAL functions (`upsertCustomerFromNotion`, `findOrCreateCustomerFromHomeowner`, `createCustomerFromWebhook`, `syncAllCustomers`) still raw-write the customers table. Eventually they should call `customerCrud.create` to inherit any future create-hook logic. Not blocking for this migration.
- `business.createFromIntake` likewise still raw-inserts. Same eventual destination.
- The punch list's category C/D items (`notification.service.ts`, `accounting.service.ts`, `create-qb-records.ts`) that touch customer rows directly — they should migrate to use `customerCrud.update` via `SYSTEM_CONTEXT`. Separate effort.

---

## Self-review (run before handing off)

1. **Spec coverage:** every section of the user request ("customers entity doesn't follow EntityServerSpec, fix to match proposals/meetings") maps to a task:
   - Spec parity → Phase 1
   - DAL signature parity → Phase 2
   - Router surface parity (`crud` mount) → Phase 3
   - Mutation routing → Phase 4
   - `isOmni` removal → Phase 5
   - Framework prerequisite (jsonbMergeColumns) → Phase 0
2. **Placeholder scan:** no TODOs, no "implement later", no missing code blocks. Each step includes exact file paths + exact code.
3. **Type consistency:** `customerCrud` (Phase 4 imports) is the export name from `dal/server/crud.ts` (verified). `listCustomers` (Phase 5) matches the rename in Phase 2. `customerSchemas` (Phase 3) is the same export name from `lib/server-spec.ts` (verified — pre-existed, retained). `dalToTrpc` is the standard bridge (verified — used identically in proposals.router).
4. **Behavior preservation:** every change is either (a) structural (no semantic change) or (b) explicitly noted behavior change. The two intentional behavior changes are: JSONB deep-merge on update (was: overwrite — bug), and proposals' JSONB merge (Phase 0 — also a bug fix that matches the DOCS.md claim).
