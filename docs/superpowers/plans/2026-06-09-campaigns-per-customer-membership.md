# Campaigns: Per-Customer Membership Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CloudTalk campaign membership a per-customer concern (any customer from any source can be enrolled/switched/removed), fix the enroll gate chain that was designed for an unbuilt auto-enroll flow, and fix the Leads table so the default "All" view shows every lead with its real status plus useful columns.

**Architecture:** Campaign membership already lives per-customer in `voip_campaign_contacts` (PK = `customer_id`, one campaign at a time). The blockers are (1) gates that require a source to be "enabled" and a campaign to be "owned" by a source, and (2) a Leads query that returns one status bucket at a time and silently defaults to `eligible`. We relax the gates to per-customer validity only, drop the campaign→source ownership concept (campaign is a pool; source only supplies a *default*), add a derived-status "all" query, and enrich the table.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), TanStack Query, Tailwind v4, shadcn/ui. No automated test framework in this repo — **verification is `pnpm tsc` + `pnpm lint` + targeted live probe scripts + manual UI checks**, then commit. NEVER run `pnpm build`. Use `pnpm db:push:dev` only (never `pnpm db:push`).

**Conventions (non-negotiable):** ONE React component per file; named exports only; no file-level constants or helpers in component files (extract to `constants/`/`lib/`); imports sorted (perfectionist); `if` bodies always braced + newlined. See `memory/coding-conventions.md`.

---

## Background — what the grilling established

- **Two enrollment modes.** Only *manual/explicit* enrollment exists in code (single `enroll`, `enrollSelected`, `enrollAll` batch). *Auto-enroll-on-ingest* is **not built** and is **out of scope**. `source.voipConfigJSON.campaigns.{enabled,autoEnroll,defaultCampaignId}` stay dormant, reserved for that future feature.
- **Kill campaign↔source ownership.** `voip_campaigns.source_slug` (a hard "this campaign belongs to source X" binding) is wrong. A campaign is a pool; the catch-all ("General Reaching Out") has no owning source. Stop reading `source_slug` now; drop the column in a **deferred** follow-up migration (Task 11).
- **Manual-enroll gate chain becomes:** `campaign is CT-active → not DNC → has valid phone → not already enrolled`. Drop the `source_enabled` gate. Keep `is-a-lead` for the eligible pool + bulk paths, but let **single manual `enroll`** bypass it (re-dial a cold/stalled non-lead).
- **"All" Leads view bug.** The status filter's "All" item emits the `__all__` sentinel → `undefined`; the router maps `undefined → 'eligible'`. So "All" silently shows eligible-only. Fix: `undefined → 'all'` + a real derived-status `'all'` query.
- **Enriched table:** add Phone, Lead Source, Attempts, Age; make the Campaign cell an inline enroll/switch/remove control.

---

## File Structure

**Logic / DAL**
- `src/shared/services/voip/campaigns/lib/eligibility.ts` — redefine `isCampaignDialable`; gate chain helpers.
- `src/shared/services/voip/campaigns/enrollment.service.ts` — drop source-enabled gate; `allowNonLead` option on `enroll`.
- `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` — enrich `CampaignLeadRow`; add `'all'` derived-status branch; widen all branch SELECTs.
- `src/trpc/routers/voip-campaigns.router.ts` — `status` enum gains `'all'`; default `→ 'all'`; `enroll` passes `allowNonLead: true`; `enrollAll`/`enrollSelected` pre-validate campaign is CT-active.

**UI**
- `src/features/campaigns-admin/constants/lead-status.ts` — add `'all'` filter option (display only).
- `src/features/campaigns-admin/ui/lib/leads-columns.tsx` — new columns; Campaign-as-switcher cell.
- `src/features/campaigns-admin/ui/components/leads/lead-campaign-cell.tsx` — **new** inline campaign control (enroll/switch/remove).
- `src/features/campaigns-admin/ui/components/leads/leads-bulk-action-bar.tsx` — add bulk-enroll-with-campaign-picker.
- `src/features/campaigns-admin/ui/components/leads/bulk-enroll-popover.tsx` — **new** campaign picker for bulk enroll.
- `src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx` + `cloudtalk-sync-card.tsx` — replace "bind to source" with "set source default" only.
- `src/features/campaigns-admin/hooks/use-campaign-mutations.ts` — `enrollSelected` toast already exists; ensure invalidation.

**Deferred migration (Task 11)**
- `src/shared/db/schema/voip-campaigns.ts` — drop `source_slug` column.
- Remove `bindCampaignToSource` router proc + `listVoipCampaignsBySource` query + `setDefaultCampaign`'s coupling.

---

## Phase 1 — Logic: relax the gates (the unblock)

### Task 1: Redefine `isCampaignDialable` (drop source ownership)

**Files:**
- Modify: `src/shared/services/voip/campaigns/lib/eligibility.ts:29-38`

- [ ] **Step 1: Read the current gate**

Run: `sed -n '29,38p' src/shared/services/voip/campaigns/lib/eligibility.ts`
Expected: `return campaign.sourceSlug !== null && campaign.ctStatus === 'active'`

- [ ] **Step 2: Replace the gate body + doc comment**

In `eligibility.ts`, replace the `isCampaignDialable` function and its doc comment with:

```ts
/**
 * Gate — the target campaign is dialable: it is CT-active. Campaigns are pools,
 * NOT owned by a lead source (the catch-all belongs to none), so source binding
 * is intentionally NOT checked. A campaign always has a membership tag (the sync
 * skips tagless ones), so CT-active is the only runtime requirement.
 */
export function isCampaignDialable(campaign: VoipCampaign | null): boolean {
  if (!campaign) {
    return false
  }
  return campaign.ctStatus === 'active'
}
```

- [ ] **Step 3: Verify types + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean (no errors referencing eligibility.ts).

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/voip/campaigns/lib/eligibility.ts
git commit -m "refactor(voip): campaign dialability no longer requires source binding"
```

---

### Task 2: Drop the source-enabled gate; add `allowNonLead` to single enroll

**Files:**
- Modify: `src/shared/services/voip/campaigns/enrollment.service.ts` (EnrollInput ~38-43; Gate 1 ~90-93; Gate 3 ~109-116)

- [ ] **Step 1: Add `allowNonLead` to `EnrollInput`**

Replace the `EnrollInput` interface:

```ts
interface EnrollInput {
  customerId: string
  // Explicit target campaign (bulk "enroll all" picker). When omitted, the
  // source's defaultCampaignId is used (auto-enroll — not yet wired).
  campaignId?: string
  // Single manual enroll (one named customer) authorizes re-dialing a cold or
  // stalled non-lead, so it bypasses the is-a-lead gate. Bulk paths leave this
  // false — they operate on the eligible (leads) pool.
  allowNonLead?: boolean
}
```

- [ ] **Step 2: Delete Gate 1 (source enabled)**

Remove the entire Gate 1 block (the `isSourceEnabled` check). It currently reads:

```ts
      // ── Gate 1: source enabled ───────────────────────────────────────────
      if (!leadSource || !isSourceEnabled(policy)) {
        return reject('source_disabled')
      }
```

Replace it with a narrower check that only fails when the source row is missing (we still need the source for slug/attributes), NOT when it's "disabled":

```ts
      // ── Source must exist (for attribute build), but a source being
      // "disabled" no longer blocks a manual enroll — that flag is reserved for
      // the future auto-enroll-on-ingest flow. ──────────────────────────────
      if (!leadSource) {
        return reject('source_disabled')
      }
```

- [ ] **Step 3: Make Gate 3 (is-a-lead) respect `allowNonLead`**

Replace the Gate 3 block:

```ts
      // ── Gate: pre-meeting lead (single manual enroll may bypass) ──────────
      if (!input.allowNonLead) {
        const isLeadResult = await isCustomerInLeads(input.customerId)
        if (!isLeadResult.success) {
          return isLeadResult
        }
        if (!isLeadResult.data) {
          return reject('not_a_lead')
        }
      }
```

- [ ] **Step 4: Remove the now-unused `isSourceEnabled` import (if unused)**

Run: `grep -n "isSourceEnabled" src/shared/services/voip/campaigns/enrollment.service.ts`
If the only remaining hit is the import line, remove `isSourceEnabled` from the import from `./lib/eligibility`. Leave `isCampaignDialable`, `isDncBlocked`, `normalizeToE164`.

- [ ] **Step 5: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

```bash
git add src/shared/services/voip/campaigns/enrollment.service.ts
git commit -m "refactor(voip): drop source-enabled gate; single enroll may bypass is-a-lead"
```

---

### Task 3: Router — `enroll` bypasses lead gate; `enrollAll`/`enrollSelected` pre-validate campaign

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts` (`enroll` ~122-129; `enrollAll` ~132-141; `enrollSelected` ~192-203)
- Read: `src/shared/entities/voip-campaigns/dal/server/queries.ts` (`getVoipCampaignById`)

- [ ] **Step 1: Single `enroll` passes `allowNonLead: true`**

Replace the `enroll` mutation body's service call:

```ts
      return dalToTrpc(await campaignEnrollmentService.enroll(SYSTEM_CONTEXT, {
        customerId: input.customerId,
        campaignId: input.campaignId,
        allowNonLead: true,
      }))
```

- [ ] **Step 2: Add a shared pre-validation helper at the top of the router file**

Below the imports, add a small async guard (router-as-glue; this is fine inline in the router file — it is not a React component file):

```ts
async function assertCampaignDialable(campaignId: string) {
  const result = await getVoipCampaignById(campaignId)
  if (!result.success || !isCampaignDialable(result.data)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'That campaign is not active in CloudTalk — resync or pick another.',
    })
  }
}
```

Add the imports it needs (sorted into the existing groups):

```ts
import { TRPCError } from '@trpc/server'
import { getVoipCampaignById } from '@/shared/entities/voip-campaigns/dal/server/queries'
import { isCampaignDialable } from '@/shared/services/voip/campaigns/lib/eligibility'
```

- [ ] **Step 3: `enrollAll` pre-validates before dispatch**

Replace the `enrollAll` mutation body:

```ts
    .mutation(async ({ ctx, input }) => {
      await assertCampaignDialable(input.campaignId)
      void enrollSourceBatchJob.dispatch({
        sourceSlug: input.sourceSlug,
        campaignId: input.campaignId,
        requestedByUserId: ctx.session.user.id,
      })
      return { ok: true }
    }),
```

- [ ] **Step 4: `enrollSelected` pre-validates too**

In `enrollSelected`, add `await assertCampaignDialable(input.campaignId)` as the first line of the mutation body (before the loop).

- [ ] **Step 5: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip): pre-validate campaign on bulk enroll; single enroll bypasses lead gate"
```

---

### Task 4: Live-verify the gate unblock against prod data (no schema risk)

**Files:**
- Create (temporary, deleted at end): `scripts/probe-enroll-gates.ts`

- [ ] **Step 1: Write a read-only probe that simulates the gate decision for telemarketing's eligible leads**

```ts
import './lib/load-env'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }))

async function main() {
  // General Reaching Out campaign id + telemarketing eligible leads.
  const camp = (await db.execute(sql`
    SELECT id, ct_status FROM voip_campaigns WHERE ct_campaign_name = 'General Reaching Out'
  `)).rows[0] as { id: string, ct_status: string } | undefined
  console.log('catch-all campaign:', camp)
  console.log('dialable (ct_status active):', camp?.ct_status === 'active')
  await (db as any).$client?.end?.()
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/probe-enroll-gates.ts 2>&1 | grep -v "SECURITY\|sslmode\|libpq\|dotenv"`
Expected: prints the catch-all campaign row and `dialable ... true`.

- [ ] **Step 3: Delete the probe**

Run: `rm scripts/probe-enroll-gates.ts`

- [ ] **Step 4: Commit (no-op if nothing staged)**

No commit needed — probe was deleted. (Manual end-to-end enroll is verified in Task 10.)

---

## Phase 2 — Logic: the derived-status "all" Leads view

### Task 5: Enrich `CampaignLeadRow` + widen every bucket SELECT

**Files:**
- Modify: `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` (`CampaignLeadRow` ~160-167; each branch SELECT)

- [ ] **Step 1: Extend the row interface**

Replace the `CampaignLeadRow` interface:

```ts
export interface CampaignLeadRow {
  customerId: string
  name: string
  status: LeadStatus
  campaignId: string | null
  campaignName: string | null
  enrolledAt: string | null
  leadSourceId: string | null
  // ── Enrichment (Q4) ──
  phone: string | null
  leadSourceName: string | null
  dialAttempts: number
  createdAt: string | null
  unenrollReason: string | null
  lastSyncError: string | null
}
```

- [ ] **Step 2: Add the lead-source join + new select fields to the `enrolled` branch**

In the `enrolled` branch: add `.leftJoin(leadSources, eq(customers.leadSourceId, leadSources.id))` after the customers join, and extend the `.select({...})` with:

```ts
            phone: customers.phone,
            leadSourceName: leadSources.name,
            dialAttempts: voipCampaignContacts.dialAttempts,
            createdAt: customers.createdAt,
            unenrollReason: voipCampaignContacts.unenrollReason,
            lastSyncError: voipCampaignContacts.lastSyncError,
```

Add the import: `import { leadSources } from '@/shared/db/schema/lead-sources'` (verify the exact export name with `grep "export const leadSources\|export const leadSourcesTable" src/shared/db/schema/lead-sources.ts` and match it).

- [ ] **Step 3: Mirror the same select additions + lead-source join in the `removed` branch**

Same `.leftJoin(leadSources, ...)` and same six extra select fields.

- [ ] **Step 4: Add the new fields to the `eligible` and `dnc` branches**

These branches anchor on `customers` and have no participation row, so:

```ts
            phone: customers.phone,
            leadSourceName: leadSources.name,
            dialAttempts: sql<number>`0`,
            createdAt: customers.createdAt,
            unenrollReason: sql<string | null>`NULL`,
            lastSyncError: sql<string | null>`NULL`,
```

Add `.leftJoin(leadSources, eq(customers.leadSourceId, leadSources.id))` to both.

- [ ] **Step 5: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: clean. (If a branch's `count()` query complains about the join, the count query does not need the new select fields — only the row `query()` does. Leave count queries as-is.)

```bash
git add src/shared/entities/voip-campaign-contacts/dal/server/queries.ts
git commit -m "feat(voip): enrich campaign-lead rows with phone, source, attempts, age"
```

---

### Task 6: Add the `'all'` derived-status branch

**Files:**
- Modify: `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` (`ListLeadsArgs.status` ~170-176; new branch before the `enrolled` branch)
- Read: `src/shared/entities/customers/lib/derived-pipeline-sql.ts` (`derivedPipelineWhere`)

- [ ] **Step 1: Widen the status arg type**

Change `ListLeadsArgs.status` from `LeadStatus` to `LeadStatus | 'all'`:

```ts
export interface ListLeadsArgs {
  status: LeadStatus | 'all'
  // …rest unchanged
}
```

(`CampaignLeadRow.status` stays `LeadStatus` — a row always resolves to one concrete status.)

- [ ] **Step 2: Add the `'all'` branch at the start of the `if`-ladder in `listLeadsPaginated`**

Insert before `if (args.status === 'enrolled')`. This is a customer-anchored, derived-status query using a LATERAL pick of each customer's most-relevant participation row (active first, else most recent). Priority: enrolled → dnc → removed → eligible.

```ts
    if (args.status === 'all') {
      // Customer-anchored derived status. The LATERAL grabs the single most
      // relevant participation row per customer: an active row (unenrolled_at
      // NULL) sorts first, else the most recent. Derived status priority:
      // enrolled > dnc > removed > eligible. Customers matching none (e.g. a
      // graduated lead with no active/removed row, not DNC, no longer a lead)
      // are excluded by the WHERE.
      const sourceFilter = args.sourceSlug
        ? sql`AND ls.slug = ${args.sourceSlug}`
        : sql``
      const campaignFilter = args.campaignId
        ? sql`AND part.voip_campaign_id = ${args.campaignId}`
        : sql``
      const searchFilter = args.search
        ? sql`AND (c.name ILIKE ${`%${args.search}%`} OR c.phone ILIKE ${`%${args.search}%`})`
        : sql``

      const eligibleLeads = derivedPipelineWhere(['leads'])

      const fromAndWhere = sql`
        FROM customers c
        LEFT JOIN lead_sources ls ON ls.id = c.lead_source_id
        LEFT JOIN LATERAL (
          SELECT vcc.voip_campaign_id, vcc.enrolled_at, vcc.unenrolled_at,
                 vcc.unenroll_reason, vcc.dial_attempts, vcc.last_sync_error,
                 TRUE AS matched
          FROM voip_campaign_contacts vcc
          WHERE vcc.customer_id = c.id
          ORDER BY (vcc.unenrolled_at IS NULL) DESC, vcc.enrolled_at DESC NULLS LAST
          LIMIT 1
        ) part ON TRUE
        LEFT JOIN voip_campaigns vc ON vc.id = part.voip_campaign_id
        WHERE (
          (part.matched AND part.unenrolled_at IS NULL)
          OR c.dnc_opted_out_at IS NOT NULL
          OR (part.matched AND part.unenrolled_at IS NOT NULL AND part.unenroll_reason = 'removed')
          OR (${eligibleLeads} AND c.phone IS NOT NULL AND c.lead_source_id IS NOT NULL)
        )
        ${sourceFilter}
        ${campaignFilter}
        ${searchFilter}
      `

      return paginate({
        query: async () => {
          const result = await db.execute(sql`
            SELECT
              c.id AS "customerId",
              c.name AS name,
              CASE
                WHEN part.matched AND part.unenrolled_at IS NULL THEN 'enrolled'
                WHEN c.dnc_opted_out_at IS NOT NULL THEN 'dnc'
                WHEN part.matched AND part.unenroll_reason = 'removed' THEN 'removed'
                ELSE 'eligible'
              END AS status,
              part.voip_campaign_id AS "campaignId",
              vc.ct_campaign_name AS "campaignName",
              part.enrolled_at AS "enrolledAt",
              c.lead_source_id AS "leadSourceId",
              c.phone AS phone,
              ls.name AS "leadSourceName",
              COALESCE(part.dial_attempts, 0) AS "dialAttempts",
              c.created_at AS "createdAt",
              part.unenroll_reason AS "unenrollReason",
              part.last_sync_error AS "lastSyncError"
            ${fromAndWhere}
            ORDER BY c.created_at DESC
            LIMIT ${args.limit} OFFSET ${args.offset}
          `)
          return result.rows as unknown as CampaignLeadRow[]
        },
        count: async () => {
          const result = await db.execute(sql`SELECT COUNT(*)::int AS n ${fromAndWhere}`)
          return (result.rows[0] as { n: number } | undefined)?.n ?? 0
        },
      })
    }
```

Add the import for `derivedPipelineWhere` if not already present:

```ts
import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'
```

(Verify it is exported from that path: `grep -n "export function derivedPipelineWhere\|export const derivedPipelineWhere" src/shared/entities/customers/lib/derived-pipeline-sql.ts`. If the existing `eligible` branch already imports it, reuse that import.)

- [ ] **Step 3: Verify types + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Live-verify the `'all'` query returns mixed statuses (read-only)**

Create `scripts/probe-all-leads.ts`:

```ts
import './lib/load-env'
import process from 'node:process'
import { listLeadsPaginated } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

async function main() {
  const res = await listLeadsPaginated({ status: 'all', limit: 50, offset: 0 })
  if (!res.success) {
    console.error('FAILED', res.error)
    process.exit(1)
  }
  const counts: Record<string, number> = {}
  for (const r of res.data.rows) {
    counts[r.status] = (counts[r.status] ?? 0) + 1
  }
  console.log('total:', res.data.total, 'statusBreakdown:', counts)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

Run: `npx tsx scripts/probe-all-leads.ts 2>&1 | grep -v "SECURITY\|sslmode\|libpq\|dotenv"`
Expected: a `statusBreakdown` containing more than one status (e.g. `enrolled`, `eligible`). If it throws with the `__name` provider-config error, instead inline a raw `db.execute` copy of the `'all'` SQL in the probe (the query itself imports no provider config — only `derivedPipelineWhere`, which is pure).

- [ ] **Step 5: Delete the probe + commit**

```bash
rm scripts/probe-all-leads.ts
git add src/shared/entities/voip-campaign-contacts/dal/server/queries.ts
git commit -m "feat(voip): add derived-status 'all' branch to leads query"
```

---

### Task 7: Router — `status` enum gains `'all'`; default to `'all'`

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts` (`listLeads` ~81-96)

- [ ] **Step 1: Add `'all'` to the input enum and flip the default**

In `listLeads`, change the status enum and the fallback:

```ts
  listLeads: superAdminProcedure
    .input(paginatedQueryInput({
      status: z.enum(['all', 'eligible', 'enrolled', 'removed', 'dnc']),
      sourceSlug: z.string().optional(),
      campaignId: z.string().uuid().optional(),
    }))
    .query(async ({ input }) => {
      return dalToTrpc(await listLeadsPaginated({
        status: input.filters?.status ?? 'all',
        sourceSlug: input.filters?.sourceSlug,
        campaignId: input.filters?.campaignId,
        search: input.search,
        limit: input.pagination.limit,
        offset: input.pagination.offset,
      }))
    }),
```

- [ ] **Step 2: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip): leads list defaults to 'all' (derived status) instead of eligible"
```

---

## Phase 3 — UI: status filter, enriched columns, inline + bulk enroll

### Task 8: Add the "All" status filter option (display)

**Files:**
- Modify: `src/features/campaigns-admin/constants/lead-status.ts` (`LEAD_STATUS_OPTIONS`)

- [ ] **Step 1: Prepend an explicit "All" option**

The select control already renders an implicit `__all__` → `undefined`. With the router now defaulting `undefined → 'all'`, the implicit "All" already works. Adding an explicit labelled option is optional but clearer. Leave `LEAD_STATUS_OPTIONS` as the 4 concrete statuses (the control's built-in "All" covers the reset). **No code change required here** — confirm by reading `select-filter-control.tsx` that the `__all__` item is always rendered.

Run: `grep -n "ALL_VALUE\|All" src/shared/components/query-toolbar/ui/filter-controls/select-filter-control.tsx`
Expected: the control renders an `All` item mapping to `undefined`. ✅ No change needed.

- [ ] **Step 2: No commit (verification-only task).**

---

### Task 9: Inline Campaign cell + new columns

**Files:**
- Create: `src/features/campaigns-admin/ui/components/leads/lead-campaign-cell.tsx`
- Modify: `src/features/campaigns-admin/ui/lib/leads-columns.tsx`
- Read: `src/features/campaigns-admin/ui/components/leads/switch-campaign-popover.tsx` (reuse its pattern)

- [ ] **Step 1: Create the inline Campaign cell component**

`lead-campaign-cell.tsx` — one component, named export. Shows the current campaign as a `Select`; choosing a campaign enrolls (if not enrolled) or switches (if enrolled); a "Remove" choice unenrolls. Uses existing mutations.

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'

import type { LeadTableRow } from '@/features/campaigns-admin/ui/lib/leads-columns'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

const REMOVE_VALUE = '__remove__'

export function LeadCampaignCell({ row }: { row: LeadTableRow }) {
  const trpc = useTRPC()
  const { enroll, switchCampaign, removeFromCampaign } = useCampaignMutations()
  const { data } = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = data ?? []

  const isEnrolled = row.status === 'enrolled'
  const current = row.campaignId ?? undefined

  function handleChange(next: string) {
    if (next === REMOVE_VALUE) {
      removeFromCampaign.mutate({ customerId: row.customerId })
      return
    }
    if (isEnrolled) {
      switchCampaign.mutate({ customerId: row.customerId, toCampaignId: next })
      return
    }
    enroll.mutate({ customerId: row.customerId, campaignId: next })
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-44 text-sm">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {campaigns.map(c => (
          <SelectItem key={c.id} value={c.id}>{c.ctCampaignName}</SelectItem>
        ))}
        {isEnrolled && (
          <SelectItem value={REMOVE_VALUE}>Remove from campaign</SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 2: Wire the cell + add columns in `leads-columns.tsx`**

Replace the `campaign` column cell to render `<LeadCampaignCell row={row.original} />`. Add columns for Phone, Source, Attempts, Age. Add a date/phone formatter to the file's existing helper area (these are module-scope helpers in a `.tsx` that already holds `formatEnrolledAt` — acceptable, this file is a column-builder lib, not a component file).

Add the import: `import { LeadCampaignCell } from '@/features/campaigns-admin/ui/components/leads/lead-campaign-cell'`

New/updated column defs (insert Phone + Source after Name; Attempts + Age after Status):

```tsx
    {
      cell: ({ row }) => <LeadCampaignCell row={row.original} />,
      header: 'Campaign',
      id: 'campaign',
    },
    {
      cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.phone ?? '—'}</span>,
      header: 'Phone',
      id: 'phone',
    },
    {
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.leadSourceName ?? '—'}</span>,
      header: 'Source',
      id: 'source',
    },
    {
      cell: ({ row }) => <span className="text-sm tabular-nums text-muted-foreground">{row.original.dialAttempts}</span>,
      header: 'Attempts',
      id: 'attempts',
    },
    {
      cell: ({ row }) => <span className="text-sm tabular-nums text-muted-foreground">{formatEnrolledAt(row.original.createdAt)}</span>,
      header: 'Age',
      id: 'createdAt',
    },
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

```bash
git add src/features/campaigns-admin/ui/components/leads/lead-campaign-cell.tsx src/features/campaigns-admin/ui/lib/leads-columns.tsx
git commit -m "feat(voip): inline campaign switcher + phone/source/attempts/age columns in leads table"
```

---

### Task 10: Bulk enroll-with-campaign-picker + end-to-end manual verification

**Files:**
- Create: `src/features/campaigns-admin/ui/components/leads/bulk-enroll-popover.tsx`
- Modify: `src/features/campaigns-admin/ui/components/leads/leads-bulk-action-bar.tsx`

- [ ] **Step 1: Create the bulk-enroll popover**

`bulk-enroll-popover.tsx` — campaign picker → `enrollSelected({ customerIds, campaignId })`. Mirror `enroll-all-popover.tsx`'s structure (Popover + Select + confirm Button), one component, named export.

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

interface BulkEnrollPopoverProps {
  onDone: () => void
  selectedIds: string[]
}

export function BulkEnrollPopover({ onDone, selectedIds }: BulkEnrollPopoverProps) {
  const trpc = useTRPC()
  const { enrollSelected } = useCampaignMutations()
  const { data } = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const campaigns = data ?? []
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">{`Enroll selected (${selectedIds.length})`}</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3">
        <p className="text-sm font-medium">Enroll into campaign</p>
        <Select value={campaignId ?? undefined} onValueChange={setCampaignId}>
          <SelectTrigger>
            <SelectValue placeholder="Select campaign…" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.ctCampaignName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!campaignId || enrollSelected.isPending}
          size="sm"
          onClick={() => {
            if (!campaignId) {
              return
            }
            enrollSelected.mutate(
              { customerIds: selectedIds, campaignId },
              { onSuccess: () => { setOpen(false); onDone() } },
            )
          }}
        >
          {enrollSelected.isPending ? 'Enrolling…' : 'Enroll'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Mount it in the bulk action bar**

In `leads-bulk-action-bar.tsx`, import and render `<BulkEnrollPopover selectedIds={selectedIds} onDone={onClear} />` alongside the existing Remove/Disqualify/DNC buttons. Confirm `enrollSelected` is exposed from `useCampaignMutations` (it is — verify with `grep -n "enrollSelected" src/features/campaigns-admin/hooks/use-campaign-mutations.ts`; if missing a hook wrapper, add a `useMutation` for `trpc.voipCampaignsRouter.enrollSelected` following the file's existing pattern with `invalidateVoipCampaigns()` + a success toast `Enrolled ${res.enrolled} of ${res.requested}`).

- [ ] **Step 3: Verify + commit**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

```bash
git add src/features/campaigns-admin/ui/components/leads/bulk-enroll-popover.tsx src/features/campaigns-admin/ui/components/leads/leads-bulk-action-bar.tsx src/features/campaigns-admin/hooks/use-campaign-mutations.ts
git commit -m "feat(voip): bulk enroll selected leads into a chosen campaign"
```

- [ ] **Step 4: End-to-end manual verification (dev server)**

Run: `pnpm dev` (port per `.env.local`), open the Campaigns Control Center → Leads tab. Confirm:
1. Default view shows **mixed statuses** (not eligible-only).
2. New columns render (Phone, Source, Attempts, Age).
3. Pick 1–3 telemarketing eligible leads → "Enroll selected → General Reaching Out" → toast success, rows flip to `enrolled`, Campaign cell shows the campaign.
4. Switch one enrolled lead to a different campaign via the inline cell → succeeds.
5. Cross-check in CloudTalk: the contacts carry the `Campaign-GeneralReachingOut` tag.

Document the result (pass/fail per item) in the PR description.

---

## Phase 4 — UI: Setup tab (default-only, no ownership binding)

### Task 11 (DEFERRED, separate PR): drop `source_slug` + binding UI

> **Do this as a follow-up PR after Phase 1–3 ship and bake.** It is a schema migration + UI removal; keeping it separate keeps the behavioral change reviewable and reversible.

**Files:**
- Modify: `src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx` + `cloudtalk-sync-card.tsx` — remove the "bind to source" Select; keep only the per-source "set default campaign" control.
- Modify: `src/trpc/routers/voip-campaigns.router.ts` — remove `bindCampaignToSource`.
- Modify: `src/shared/entities/voip-campaigns/dal/server/queries.ts` — remove `listVoipCampaignsBySource`.
- Modify: `src/shared/db/schema/voip-campaigns.ts` — drop the `source_slug` column + its index.
- Migration: `pnpm db:push:dev` (dev), then `pnpm db:push` only when the user explicitly approves prod.

- [ ] **Step 1:** Confirm nothing reads `voip_campaigns.source_slug` after Phase 1 (`grep -rn "sourceSlug\|source_slug" src | grep -i "voipCampaign\|voip_campaign"`). The only remaining writer should be the sync upsert (which already omits it) and the Setup binding UI.
- [ ] **Step 2:** Remove the binding UI + router proc + query (full code provided at execution time once Phase 1–3 are merged and the exact call sites are stable).
- [ ] **Step 3:** Drop the column in the schema, `pnpm db:push:dev`, `pnpm tsc && pnpm lint`.
- [ ] **Step 4:** Commit `refactor(voip): remove campaign→source ownership binding`.

---

## Self-Review

- **Spec coverage:** model split (Background + Task 2/3), kill ownership (Task 1, Task 11), gate chain (Task 1–3), Setup UI (Task 11), catch-all flow (Task 10), no-op feedback (Task 3 pre-validate; per-row `lastSyncError` already written by the batch job), "all" view (Task 5–8), enriched table (Task 5, 9). ✅ All branches covered.
- **Deferred-but-tracked:** column drop + binding-UI removal (Task 11) — intentionally separate PR per the grilling decision.
- **Type consistency:** `CampaignLeadRow.status: LeadStatus` (concrete) vs `ListLeadsArgs.status: LeadStatus | 'all'` (filter) — deliberately different and used consistently. `allowNonLead` defined in Task 2, consumed in Task 3. `LeadCampaignCell`/`BulkEnrollPopover` named exactly as imported.
- **Verification reality:** no test runner in repo → every task verifies via `pnpm tsc && pnpm lint` + (where useful) a read-only live probe that is deleted before commit, plus one end-to-end manual pass (Task 10). Matches CLAUDE.md discipline.
- **Risk:** the `'all'` branch uses raw `db.execute(sql\`…\`)` — the riskiest piece; Task 6 Step 4 live-probes its status breakdown before commit.
