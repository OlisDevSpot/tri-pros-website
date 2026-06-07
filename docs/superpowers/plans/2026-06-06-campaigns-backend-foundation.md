# Campaigns Control Center — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tRPC + DAL surface the redesigned Campaigns Control Center consumes. **~90% is already wired** — this plan adds exactly one real new query (`listLeads`) plus thin wrappers around existing service/compliance methods.

> ## Scope decision (refined 2026-06-07)
> The page ships in **two phases**, split so the one CloudTalk-API unknown is OFF the critical path:
> - **Phase 1 (this plan's core — Tasks 4–9): everything the page needs to ship, zero CloudTalk-verification dependency.** The unified `listLeads`, the overview extension, and the trivial mutations (cherry-pick bulk enroll, bulk remove, first-class DNC, switch-campaign). The lead drawer ships **DB-first** (identity + enrolled campaign/date + actions).
> - **Phase 2 (fast-follow — Tasks 0–3, DEFERRED): the live "Live from CloudTalk" drawer block + per-row live-signal cell.** Gated on the Task 0 CloudTalk verification (needs live CT creds + a known enrolled contact). Build right after Phase 1 lands. The drawer + table are designed to slot this in without rework.
>
> **Reality check on "new" backend:** of Phase 1, only `listLeads` is genuinely new logic — it assembles *existing* predicates (`derivedPipelineWhere(['leads'])`, the participation joins) into the *existing* `paginate()` toolkit. `enrollSelected`/`removeBulk`/`markDnc`/`removeDnc` are loops/wrappers over existing `enroll`/`unenroll`/`complianceService`. `switchCampaign` composes existing `removeTags`+`addTags`. Single `enroll`, `enrollAll`, `disqualify*`, `removeFromCampaign`, all summaries, resync/bind/default — **already exist.**

**Architecture:** Additive to the existing voip-campaigns stack (perfect separation unchanged). New reads/mutations live in the existing `voipCampaignsRouter` (glue), composing entity DAL queries/mutations (`voip-campaign-contacts`, `customers`) + the `complianceService`. The unified `listLeads` uses the existing query toolkit (`paginatedQueryInput` / `paginate`). Phase 2's one live-read path (`getContactActivity`) derives from the existing `listCalls` capability — it never persists.

**Tech Stack:** Next.js 15 App Router + tRPC, Drizzle (Postgres/Neon), Zod, the shared query toolkit (`src/shared/dal/server/lib/query/`). **No test runner exists** — verification per task is `pnpm tsc` + `pnpm lint` + targeted manual checks. **Never run `pnpm build`.** No schema/DB changes (all reads/mutations hit existing tables).

**Scope note:** This is Plan 1 of 2. Plan 2 (Frontend — the 3 tabs + ~20 components) consumes this API and follows once this lands. Spec: `docs/superpowers/specs/2026-06-06-campaigns-page-ux-redesign-design.md`.

---

## File structure

**Modify**
- `src/shared/services/providers/cloudtalk/types.ts` — add `disposition` to `CloudtalkCall`; add `CtContactActivity` type.
- `src/shared/services/providers/cloudtalk/schemas/call.ts` — surface `Disposition.name` in the call list row schema.
- `src/shared/services/providers/cloudtalk/client.ts` — surface disposition in `rowToCall`; add `listCalls` contact filter; add `getContactActivity`.
- `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` — add `listLeadsPaginated` + `countLeadsByStatus`-style helpers.
- `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts` — add `repointCampaign` (switch-campaign DAL write).
- `src/shared/services/voip/campaigns/enrollment.service.ts` — add `switchCampaign` orchestrator verb.
- `src/trpc/routers/voip-campaigns.router.ts` — add `listLeads`, `getLeadCtActivity`, `getOverviewSummaries`, `enrollSelected`, `removeBulk`, `markDnc`, `removeDnc`, `switchCampaign`.

**No new files** (everything extends existing modules; Plan 2 adds the frontend files).

---

> **⏸ TASKS 0–3 ARE PHASE 2 (DEFERRED FAST-FOLLOW).** Skip them for the v1 ship. Start implementation at **Task 4** (Phase 1). Come back to Tasks 0–3 once Phase 1 + the frontend have landed and you have live CloudTalk creds to run the Task 0 verification. The Leads table omits the live-signal column and the drawer omits the "Live from CloudTalk" block until then — both designed to slot in without rework.

## Task 0 — PHASE 2 (DEFERRED): Verify CloudTalk contact-scoped call history (spike — GATES the live block)

**Why:** `getContactActivity` derives the drawer's live signals (last disposition, attempts, last-contacted, DID, recording) from CloudTalk call records. `listCalls` already exists, but we must confirm CT can return calls **scoped to one contact**, and that `Disposition` is present on list rows. This is the one real unknown.

**Files:** none (research → documented findings appended to this task).

- [ ] **Step 1: Read the existing call schema + research notes**

Run: `sed -n '1,60p' src/shared/services/providers/cloudtalk/schemas/call.ts` and `grep -niE "contact_id|contact|Disposition|/calls/index|filter" docs/plans/voip-campaigns/cloudtalk-api-research.md`
Note what the `ctCallListResponseSchema` currently parses and whether a contact filter is documented.

- [ ] **Step 2: Probe the live CloudTalk API (super-admin creds in prod env)**

Write a throwaway script `scripts/_probe-ct-contact-calls.ts` (delete after) that calls CT directly:

```ts
import './lib/load-env'
import { cloudtalkClient } from '../src/shared/services/providers/cloudtalk/client'

// Pick a known enrolled contact id from prod (voip_campaign_contacts.cloudtalk_contact_id).
const CONTACT_ID = process.argv[2]
// Probe A: does /calls/index.json accept contact_id?  Probe B: is Disposition returned?
async function main() {
  const calls = await cloudtalkClient.listCalls({ limit: 5 })
  console.log('sample call rows:', JSON.stringify(calls, null, 2))
  console.log('contact id under test:', CONTACT_ID)
}
main().catch(console.error)
```

Run: `pnpm tsx scripts/_probe-ct-contact-calls.ts <ctContactId>`

- [ ] **Step 3: Determine the contact-scoping mechanism + record the verdict**

In CloudTalk's Swagger / by trial, confirm ONE of:
- **(a)** `/calls/index.json?contact_id=<id>` filters calls by contact → use that query key in Task 3.
- **(b)** No contact filter, but `/contacts/show/<id>.json` returns recent activities/calls → derive from there.
- **(c)** Neither → fall back: `getContactActivity` returns only what `/contacts/show` gives (tags/attributes) and the drawer hides the call-history rows (graceful degradation per spec).

Append the verdict here (which option, exact query key/field paths, whether `Disposition.name` is present). **This determines the exact code in Tasks 1–3.** "Next scheduled dial" is CT-internal cadence state and is **expected unavailable** — confirm and, if so, drop that field from the drawer (already flagged in the spec).

- [ ] **Step 4: Delete the probe script**

Run: `rm scripts/_probe-ct-contact-calls.ts`

- [ ] **Step 5: Commit the findings**

```bash
git add docs/superpowers/plans/2026-06-06-campaigns-backend-foundation.md
git commit -m "docs(campaigns): record CloudTalk contact-call-history verification findings"
```

---

## Task 1: Surface `disposition` on `CloudtalkCall`

**Files:**
- Modify: `src/shared/services/providers/cloudtalk/types.ts`
- Modify: `src/shared/services/providers/cloudtalk/schemas/call.ts`
- Modify: `src/shared/services/providers/cloudtalk/client.ts` (`rowToCall`, ~line "function rowToCall")

- [ ] **Step 1: Add `disposition` to the `CloudtalkCall` type**

In `types.ts`, find the `CloudtalkCall` interface and add the field (place after `isVoicemail`):

```ts
  /** CT call disposition name (e.g. "meeting_booked", "no-answer"). Null when unset. */
  disposition?: string | null
```

- [ ] **Step 2: Surface `Disposition.name` in the call list row schema**

In `schemas/call.ts`, find the list-row object inside `ctCallListResponseSchema` (the `Cdr`/`Disposition` shape) and ensure `Disposition` is parsed. If it already allows `Disposition: z.object({ name: z.string() }).optional()`, no change; otherwise add:

```ts
  Disposition: z.object({ name: z.string() }).optional(),
```

(Confirm exact nesting against Task 0 findings.)

- [ ] **Step 3: Map disposition in `rowToCall`**

In `client.ts`, the `rowToCall` helper currently drops `row.Disposition`. Add to its returned object (after `isVoicemail: row.Cdr.is_voicemail,`):

```ts
    disposition: row.Disposition?.name ?? null,
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/cloudtalk/types.ts src/shared/services/providers/cloudtalk/schemas/call.ts src/shared/services/providers/cloudtalk/client.ts
git commit -m "feat(cloudtalk): surface call Disposition on CloudtalkCall"
```

---

## Task 2: Add `cloudtalkClient.getContactActivity`

**Files:**
- Modify: `src/shared/services/providers/cloudtalk/types.ts` (add `CtContactActivity`)
- Modify: `src/shared/services/providers/cloudtalk/client.ts` (add `listCalls` contact filter + `getContactActivity`)

- [ ] **Step 1: Add the `CtContactActivity` provider-domain type**

In `types.ts`:

```ts
/**
 * Read-only snapshot of a contact's CloudTalk call activity. Derived live from
 * call records — NEVER persisted (perfect separation). Fields are optional so
 * the drawer degrades gracefully when CT omits any.
 */
export interface CtContactActivity {
  attempts: number
  lastDisposition: string | null
  lastContactedAt: string | null
  lastDidE164: string | null
  lastRecordingUrl: string | null
}
```

- [ ] **Step 2: Add a contact filter to `listCalls`**

In `client.ts`, extend `ListCallsInput` and the `listCalls` query (use the contact-scoping key confirmed in Task 0; shown here as `contact_id`):

```ts
interface ListCallsInput {
  since?: Date
  limit?: number
  contactId?: string
}
```

In the `listCalls` body, add to the `query` object:

```ts
        contact_id: input.contactId,
```

- [ ] **Step 3: Add `getContactActivity` (place after `getCall`, before `recordingPath`)**

```ts
    /**
     * Live, unstored snapshot of a contact's call activity for the lead drawer.
     * Derives attempts/last-disposition/last-contacted/DID/recording from the
     * contact's recent calls. Returns zeroed activity (attempts 0, nulls) when
     * the contact has no calls. NEVER persisted — read-through only.
     */
    async getContactActivity(contactId: string): Promise<CtContactActivity> {
      const calls = await this.listCalls({ contactId, limit: 50 })
      if (calls.length === 0) {
        return { attempts: 0, lastDisposition: null, lastContactedAt: null, lastDidE164: null, lastRecordingUrl: null }
      }
      // Most recent first by startedAt.
      const sorted = [...calls].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
      const latest = sorted[0]!
      return {
        attempts: calls.length,
        lastDisposition: latest.disposition ?? null,
        lastContactedAt: latest.startedAt ?? null,
        lastDidE164: latest.didE164 ?? null,
        lastRecordingUrl: latest.recordingUrl ?? null,
      }
    },
```

Add `CtContactActivity` to the `import type { ... } from './types'` block at the top.

> If Task 0 found option (b)/(c) (no `contact_id` filter on `/calls/index.json`), implement the body against `getContact`/activities instead, keeping the same `CtContactActivity` return shape so downstream code is unaffected.

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/cloudtalk/types.ts src/shared/services/providers/cloudtalk/client.ts
git commit -m "feat(cloudtalk): add getContactActivity (live, unstored call-activity snapshot)"
```

---

## Task 3: Add `getLeadCtActivity` tRPC query

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts`

- [ ] **Step 1: Add the procedure (in the "Reads" section, after `listEnrolledLeads`)**

Resolve the customer's CT contact id via the existing participation row, then fetch live activity. Returns `null` when the customer has no CT contact (never enrolled).

```ts
  /**
   * Live CloudTalk activity for one lead (drawer "Live from CloudTalk" block).
   * Read-through — never stored. Returns null when the customer has no CT
   * contact id (never enrolled). Super-admin only (matches the page gate).
   */
  getLeadCtActivity: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .query(async ({ input }) => {
      const enrollment = dalToTrpc(await findActiveEnrollment(input.customerId))
      if (!enrollment?.cloudtalkContactId) {
        return null
      }
      return cloudtalkClient.getContactActivity(enrollment.cloudtalkContactId)
    }),
```

- [ ] **Step 2: Add the imports**

```ts
import { findActiveEnrollment } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'
```

(Respect perfectionist import sort; `findActiveEnrollment` joins the existing import line from that queries module if present.)

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual verification**

In a scratch tRPC call or the app, invoke `voipCampaignsRouter.getLeadCtActivity` with an enrolled customer's id → expect a `CtContactActivity` object (or `null` for a never-enrolled customer). Confirm no DB write occurs.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip-campaigns): add getLeadCtActivity live-read procedure"
```

---

## Task 4: Add the unified `listLeadsPaginated` DAL query

**Files:**
- Modify: `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts`

The Leads tab needs ONE paginated query over four statuses. `eligible` = pre-meeting lead, not DNC, has phone, not actively enrolled. `enrolled` = active participation row. `removed` = unenrolled with reason `removed`. `dnc` = `dncOptedOutAt` set. Use the query toolkit's `paginate` + `paginatedQueryInput`-derived args.

- [ ] **Step 1: Study the toolkit reference impl**

Run: `sed -n '1,120p' src/shared/dal/server/lib/query/schemas.ts` and `sed -n '1,80p' src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
Match the `paginate({ query, count })` + `PaginatedResult` shape and the `{ pagination: { limit, offset }, search?, filters? }` arg shape.

- [ ] **Step 2: Add the row type + query**

Append to `queries.ts` (imports: add `ilike`, `or`, `sql` from `drizzle-orm` as needed without duplicating; import `derivedPipelineWhere` from `@/shared/entities/customers/lib/derived-pipeline-sql`; import `paginate` + the `PaginatedResult`/args types from the query toolkit — match the reference impl exactly):

```ts
export type LeadStatus = 'eligible' | 'enrolled' | 'removed' | 'dnc'

export interface CampaignLeadRow {
  customerId: string
  name: string
  status: LeadStatus
  campaignId: string | null
  campaignName: string | null
  enrolledAt: string | null
  leadSourceId: string | null
}

export interface ListLeadsArgs {
  status: LeadStatus
  sourceSlug?: string
  campaignId?: string
  search?: string
  limit: number
  offset: number
}

/**
 * Unified, paginated leads query for the Campaigns Control Center Leads tab.
 * One status at a time (the UI filters by exactly one). Reuses the canonical
 * eligibility predicate (`derivedPipelineWhere(['leads'])`) for `eligible` —
 * never reinvents it. Returns { rows, total } via the shared toolkit.
 */
export async function listLeadsPaginated(
  args: ListLeadsArgs,
): Promise<DalReturn<{ rows: CampaignLeadRow[], total: number }>> {
  return dalDbOperation(async () => {
    // Build per-status from/where. `enrolled` & `removed` start from the
    // participation table; `eligible` & `dnc` start from customers.
    // (Implementer: assemble with the toolkit's `paginate({ query, count })`
    // so page + count fire in parallel — mirror the reference impl in
    // lead-source-customers-section's procedure.)
    // ...status-specific query construction here, returning CampaignLeadRow...
    throw new Error('replace with toolkit-backed implementation per Step 2 reference')
  })
}
```

> **Implementer note (not a placeholder — explicit construction guide):** build four `where` predicates and a shared `select` projecting `CampaignLeadRow`:
> - `enrolled`: from `voipCampaignContacts` innerJoin `voipCampaigns` + `customers`, `isNull(unenrolledAt)`, optional `eq(voipCampaigns.sourceSlug, sourceSlug)` / `eq(voipCampaigns.id, campaignId)`.
> - `removed`: same joins but `isNotNull(unenrolledAt)` + `eq(voipCampaignContacts.unenrollReason, 'removed')`.
> - `eligible`: from `customers` (leftJoin `leadSources` for slug filter), `derivedPipelineWhere(['leads'])` + `isNull(dncOptedOutAt)` + `isNotNull(phone)` + `isNotNull(leadSourceId)` + `NOT EXISTS (active participation row)`; `campaignId`/`campaignName`/`enrolledAt` are `null`.
> - `dnc`: from `customers`, `isNotNull(dncOptedOutAt)`.
> Apply `search` as `ilike(customers.name, %q%) OR ilike(customers.phone, %q%)`. Wrap both the page query and a `count()` in `paginate(...)`.

- [ ] **Step 3: Replace the `throw` with the real implementation**

Following the construction guide + the toolkit reference, implement each status branch. (The `throw` exists only so Step 2 compiles standalone; Step 3 removes it.)

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Manual verification (dev DB)**

Call `listLeadsPaginated({ status: 'eligible', limit: 20, offset: 0 })` and `{ status: 'enrolled', ... }` against the dev DB; confirm counts match the existing `countEligibleLeadsBySource` / `countActiveEnrollmentsBySource` totals.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/voip-campaign-contacts/dal/server/queries.ts
git commit -m "feat(voip-campaigns): add unified paginated listLeadsPaginated DAL query"
```

---

## Task 5: Add the `listLeads` tRPC procedure

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts`

- [ ] **Step 1: Add the procedure (Reads section)**

Use `paginatedQueryInput` with a `status`/`sourceSlug`/`campaignId` filter shape (match `src/shared/dal/server/lib/query/schemas.ts`):

```ts
  /** Paginated unified leads workspace (Leads tab). */
  listLeads: superAdminProcedure
    .input(paginatedQueryInput({
      status: z.enum(['eligible', 'enrolled', 'removed', 'dnc']),
      sourceSlug: z.string().optional(),
      campaignId: z.string().uuid().optional(),
    }))
    .query(async ({ input }) => {
      return dalToTrpc(await listLeadsPaginated({
        status: input.filters.status,
        sourceSlug: input.filters.sourceSlug,
        campaignId: input.filters.campaignId,
        search: input.search,
        limit: input.pagination.limit,
        offset: input.pagination.offset,
      }))
    }),
```

> Confirm the exact `input.filters` / `input.search` / `input.pagination` access path against `paginatedQueryInput`'s return shape (Task 4 Step 1). Add imports for `paginatedQueryInput` and `listLeadsPaginated`.

- [ ] **Step 2: Verify** — `pnpm tsc && pnpm lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip-campaigns): add paginated listLeads procedure"
```

---

## Task 6: Extend `getSourceCampaignSummaries` with DNC counts + binding health

**Files:**
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (add `countDncBySource`)
- Modify: `src/trpc/routers/voip-campaigns.router.ts` (`getSourceCampaignSummaries`)

- [ ] **Step 1: Add `countDncBySource` DAL**

In `customers/dal/server/queries.ts` (mirror `countEligibleLeadsBySource`):

```ts
/** Count DNC'd customers grouped by lead source. Drives Overview DNC stat. */
export async function countDncBySource(): Promise<DalReturn<Record<string, number>>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({ leadSourceId: customers.leadSourceId, n: count() })
      .from(customers)
      .where(and(isNotNull(customers.leadSourceId), isNotNull(customers.dncOptedOutAt)))
      .groupBy(customers.leadSourceId)
    const out: Record<string, number> = {}
    for (const row of rows) {
      if (row.leadSourceId) {
        out[row.leadSourceId] = row.n
      }
    }
    return out
  })
}
```

- [ ] **Step 2: Extend the summary mapper**

In `getSourceCampaignSummaries`, add the DNC read + a binding-health flag (`eligible > 0 && !defaultCampaignId`):

```ts
    const dncById = dalToTrpc(await countDncBySource())
    // ...inside the .map(source => ({ ... })):
      dncCount: dncById[source.id] ?? 0,
      needsBinding: (eligibleById[source.id] ?? 0) > 0 && !(source.voipConfigJSON?.campaigns?.defaultCampaignId),
```

Add the `countDncBySource` import.

- [ ] **Step 3: Verify** — `pnpm tsc && pnpm lint` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/dal/server/queries.ts src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip-campaigns): add DNC counts + binding-health to source summaries"
```

---

## Task 7: Add `switchCampaign` service verb + DAL repoint

**Files:**
- Modify: `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts`
- Modify: `src/shared/services/voip/campaigns/enrollment.service.ts`

- [ ] **Step 1: Add `repointCampaign` DAL mutation**

In `voip-campaign-contacts/dal/server/mutations.ts` (match the file's existing mutation style — `dalDbOperation`, no manual `updatedAt`):

```ts
/**
 * Re-point an active participation row to a different campaign. Used by the
 * switch-campaign service verb AFTER tags are swapped on CloudTalk. Updates
 * only the FK — enrolledAt/contact id persist.
 */
export async function repointCampaign(
  input: { customerId: string, toCampaignId: string },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db
      .update(voipCampaignContacts)
      .set({ voipCampaignId: input.toCampaignId })
      .where(and(
        eq(voipCampaignContacts.customerId, input.customerId),
        isNull(voipCampaignContacts.unenrolledAt),
      ))
  })
}
```

(Add `and`, `eq`, `isNull` imports from `drizzle-orm` if not present.)

- [ ] **Step 2: Add `switchCampaign` orchestrator to `enrollment.service.ts`**

A customer is in exactly one campaign. Switch = remove old membership tag on CT → add new tag → repoint the FK. Compose `findActiveEnrollment` (old tag + contact id), the target campaign's tag (via `voipCampaignCrud`/`listVoipCampaigns`), `cloudtalkClient.removeTags`/`addTags`, then `repointCampaign`. Return a precondition-failed `DalReturn` when there's no active enrollment or the target campaign is unknown.

```ts
    /**
     * Atomically move an actively-enrolled customer to a different campaign:
     * removeTags(old) → addTags(new) → repoint FK. No-op-safe: precondition-
     * failed when the customer isn't actively enrolled.
     */
    async switchCampaign(
      ctx: ScopedContext,
      input: { customerId: string, toCampaignId: string },
    ): Promise<DalReturn<{ switched: boolean }>> {
      const active = await findActiveEnrollment(input.customerId)
      if (!active.success) {
        return active
      }
      if (!active.data || !active.data.cloudtalkContactId) {
        return dalError({ type: 'precondition-failed', reason: 'not_actively_enrolled' })
      }
      const target = await getVoipCampaignById(input.toCampaignId) // existing DAL read; confirm name
      if (!target.success) {
        return target
      }
      if (!target.data?.ctMembershipTag) {
        return dalError({ type: 'precondition-failed', reason: 'unknown_target_campaign' })
      }
      if (active.data.ctMembershipTag) {
        await cloudtalkClient.removeTags({ contactId: active.data.cloudtalkContactId, tags: [active.data.ctMembershipTag] })
      }
      await cloudtalkClient.addTags({ contactId: active.data.cloudtalkContactId, tags: [target.data.ctMembershipTag] })
      const repoint = await repointCampaign({ customerId: input.customerId, toCampaignId: input.toCampaignId })
      if (!repoint.success) {
        return repoint
      }
      return dalSuccess({ switched: true })
    },
```

> Confirm the single-campaign read helper name in `voip-campaigns/dal/server/queries.ts` (e.g. `getVoipCampaignById`); if absent, add a one-liner `getVoipCampaignById(id)` mirroring `findActiveEnrollment`'s style. Add imports: `repointCampaign`, the campaign read, `dalError`/`dalSuccess`, `ScopedContext`.

- [ ] **Step 3: Verify** — `pnpm tsc && pnpm lint` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts src/shared/services/voip/campaigns/enrollment.service.ts
git commit -m "feat(voip-campaigns): add switchCampaign service verb + repointCampaign DAL"
```

---

## Task 8: Add `enrollSelected`, `removeBulk`, `switchCampaign`, DNC mutations

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts`

- [ ] **Step 1: Add `enrollSelected` (cherry-pick bulk into one campaign)**

```ts
  /** Enroll an explicit set of customers into one campaign (cherry-pick bulk). */
  enrollSelected: superAdminProcedure
    .input(z.object({ customerIds: z.array(z.string().uuid()).min(1), campaignId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      let enrolled = 0
      for (const customerId of input.customerIds) {
        const r = await campaignEnrollmentService.enroll(SYSTEM_CONTEXT, { customerId, campaignId: input.campaignId })
        if (r.success) {
          enrolled++
        }
      }
      return { requested: input.customerIds.length, enrolled }
    }),
```

- [ ] **Step 2: Add `removeBulk` (neutral bulk remove)**

```ts
  /** Bulk neutral remove (reason 'removed' — re-enrollable). */
  removeBulk: superAdminProcedure
    .input(z.object({ customerIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ input }) => {
      let removed = 0
      for (const customerId of input.customerIds) {
        const r = await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, { customerId, reason: 'removed' })
        if (r.success && r.data.unenrolled) {
          removed++
        }
      }
      return { requested: input.customerIds.length, removed }
    }),
```

- [ ] **Step 3: Add `switchCampaign` procedure**

```ts
  /** Move a customer to a different campaign (drawer/bulk). */
  switchCampaign: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid(), toCampaignId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await campaignEnrollmentService.switchCampaign(ctx, input))
    }),
```

- [ ] **Step 4: Add `markDnc` / `removeDnc` (single + bulk)**

DNC is first-class. Wrap the existing `complianceService` (reason `'admin'`, `addedByUserId` = caller). Marking DNC must ALSO unenroll (excluded from eligible). Removing DNC just clears the flag.

```ts
  /** Mark customer(s) DNC (reason 'admin') + unenroll. Single or bulk. */
  markDnc: superAdminProcedure
    .input(z.object({ customerIds: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      for (const customerId of input.customerIds) {
        await complianceService.addToDnc({ customerId, reason: 'admin', addedByUserId: ctx.session.user.id })
        await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, { customerId, reason: 'opted_out' })
      }
      return { count: input.customerIds.length }
    }),

  /** Clear DNC (admin opt-back-in). */
  removeDnc: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await complianceService.removeFromDnc({ customerId: input.customerId })
      return { ok: true }
    }),
```

- [ ] **Step 5: Add imports** — `complianceService` from `@/shared/services/voip/compliance.service`.

- [ ] **Step 6: Verify** — `pnpm tsc && pnpm lint` → PASS.

- [ ] **Step 7: Manual verification (dev)** — exercise each mutation against a dev customer; confirm: enrollSelected creates participation rows; removeBulk sets `unenroll_reason='removed'`; markDnc sets `dnc_opted_out_at` + unenrolls; switchCampaign repoints the FK and swaps tags (verify in CloudTalk dev contact).

- [ ] **Step 8: Commit**

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip-campaigns): add enrollSelected, removeBulk, switchCampaign, markDnc/removeDnc"
```

---

## Task 9: Final checkpoint

- [ ] **Step 1:** `pnpm tsc` — clean.
- [ ] **Step 2:** `pnpm lint` — clean (no NEW warnings in touched files).
- [ ] **Step 3:** `git diff main...HEAD --stat` — review for stray probe scripts / debug logs.
- [ ] **Step 4:** Confirm the API surface the frontend (Plan 2) needs exists: `listLeads`, `getLeadCtActivity`, `getSourceCampaignSummaries` (now with `dncCount`/`needsBinding`), `enroll`, `enrollSelected`, `enrollAll`, `removeFromCampaign`, `removeBulk`, `disqualify`, `disqualifyBulk`, `switchCampaign`, `markDnc`, `removeDnc`, `resyncFromCloudtalk`, `bindCampaignToSource`, `setDefaultCampaign`, `listCampaigns`, `listAttributes`.

---

## Self-review notes (against the spec)

- **Spec coverage:** `listLeads` (Task 4–5), drawer live block `getLeadCtActivity` + `getContactActivity` (Tasks 1–3), DNC first-class (Task 8), `enrollSelected`/`removeBulk`/`switchCampaign` (Tasks 7–8), overview DNC + binding-health (Task 6). Single `enroll` already exists (no task needed). ✓
- **Out of scope (correct):** no stored CT analytics, no reconciliation cron, no schema changes. ✓
- **Known verification dependency:** Task 0 gates the exact `getContactActivity` mechanism; Tasks 1–3 are written for the most likely path (contact-filtered `listCalls`) with an explicit fallback note. This is a real external-API unknown, not a placeholder.
- **Frontend deferred to Plan 2:** all UI (3 tabs, ~20 components, `usePaginatedQuery` wiring, the Sheet drawer) consumes this surface.
