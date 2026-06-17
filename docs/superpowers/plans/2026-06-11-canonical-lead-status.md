# Canonical Campaign-Lead Status + Drop Source Ownership — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Make campaign-lead status (eligible / enrolled / removed / dnc) a SINGLE business-logic definition used everywhere, fixing the eligible-count bug (it doesn't subtract enrolled), re-anchoring all "by source" numbers to the customer's lead source, and removing the dead campaign→source ownership binding (`source_slug`).

**Architecture:** One central lib of SQL-fragment predicates is the sole source of truth for what each status means. The Leads query collapses its 4 buckets + the `all` view into one canonical customer-anchored query parameterized by status. The three per-source count functions collapse into one `(lead_source, status)` GROUP BY. Every list/count/filter becomes a slice of the same definition. Then `source_slug` (campaign ownership) is removed.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon). NO test framework — verify via `pnpm tsc` + `pnpm lint` + standalone read-only DB probes (deleted before commit). NEVER `pnpm build`. Schema changes: `pnpm db:push:dev` only (prod push needs explicit user approval).

**Branch:** stay on `main` (user consented). No PR.

---

## Decisions (from the grill)

1. **One canonical view.** Collapse the 4 status buckets + `all` into a single customer-anchored query; counts/lists/filters are slices.
2. **Central helpers.** SQL-fragment predicates in one lib; eligible **excludes** enrolled/dnc/removed (fixes the bug).
3. **One status per customer**, priority `enrolled > dnc > removed > eligible`. Consequence (accepted): a deliberately-`removed` lead is NOT in the eligible pool — re-enroll explicitly.
4. **By-source = the customer's lead source** everywhere (not the campaign's). The catch-all stops being a rollup black hole.
5. **One counts query** `countLeadsByStatusPerSource()`, in the voip-campaign-contacts entity; deletes the 3 scattered count fns.
6. **Per-source rollups only** (no per-campaign rollup this round).
7. **Drop `source_slug`** column + binding UI; keep per-source "default campaign."

---

## File Structure

**New**
- `src/shared/entities/voip-campaign-contacts/lib/lead-campaign-status.ts` — the central SQL-fragment predicates + status CASE.

**Modified — logic**
- `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` — collapse `listLeadsPaginated`; add `countLeadsByStatusPerSource`; re-anchor `listEnrolledLeadsBySource` + `listActiveCustomerIdsBySource`; delete `countActiveEnrollmentsBySource` + `listVoipCampaignsBySource` consumers.
- `src/shared/entities/customers/dal/server/queries.ts` — delete `countEligibleLeadsBySource` + `countDncBySource` (moved into the consolidated count).
- `src/shared/entities/voip-campaigns/dal/server/queries.ts` — delete `listVoipCampaignsBySource` (dead).
- `src/trpc/routers/voip-campaigns.router.ts` — rewire `getSourceCampaignSummaries` + `getEnrollmentCounts` to the consolidated count; remove `bindCampaignToSource`.

**Modified — schema/UI (ownership drop)**
- `src/shared/db/schema/voip-campaigns.ts` — drop `source_slug` column + index.
- `src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx` + `cloudtalk-sync-card.tsx` — remove the "bind to source" control; keep "set default campaign."
- `src/features/campaigns-admin/hooks/use-campaign-mutations.ts` — remove `bindCampaignToSource` wrapper.

---

## Phase A — Central status logic + canonical view

### Task A1: Create the central status-predicate lib

**File:** Create `src/shared/entities/voip-campaign-contacts/lib/lead-campaign-status.ts`

- [ ] **Step 1: Write the lib.** These are SQL fragments over an UNALIASED `customers` table (so `derivedPipelineWhere`'s hard-coded `"customers"."…"` refs resolve) + correlated subqueries on `voip_campaign_contacts`. Usable in both Drizzle `.where()` and raw `db.execute()`.

```ts
import { sql } from 'drizzle-orm'

import { derivedPipelineWhere } from '@/shared/entities/customers/lib/derived-pipeline-sql'

// ── Canonical campaign-lead status (single source of truth) ─────────────────
// A customer's relationship to CloudTalk campaigns resolves to exactly ONE
// status. Priority: enrolled > dnc > removed > eligible. Every count, list, and
// filter MUST derive from these fragments — never hand-copy a WHERE clause.
//
// All fragments reference an UNALIASED `customers` table. The query that embeds
// them must use `FROM customers` (not `FROM customers c`) — `derivedPipelineWhere`
// emits literal `"customers"."…"` refs that an alias would hide. See the 'all'
// branch note in queries.ts.

function enrolledExistsSql() {
  return sql`EXISTS (
    SELECT 1 FROM voip_campaign_contacts vcc
    WHERE vcc.customer_id = "customers"."id" AND vcc.unenrolled_at IS NULL
  )`
}

function removedRowExistsSql() {
  return sql`EXISTS (
    SELECT 1 FROM voip_campaign_contacts vcc
    WHERE vcc.customer_id = "customers"."id"
      AND vcc.unenrolled_at IS NOT NULL AND vcc.unenroll_reason = 'removed'
  )`
}

/** Active participation row exists. */
export function isEnrolledSql() {
  return enrolledExistsSql()
}

/** DNC and not currently enrolled (enrolled wins by priority). */
export function isDncSql() {
  return sql`("customers"."dnc_opted_out_at" IS NOT NULL AND NOT ${enrolledExistsSql()})`
}

/** Has a 'removed' row, not enrolled, not DNC (those win by priority). */
export function isRemovedSql() {
  return sql`(${removedRowExistsSql()}
    AND NOT ${enrolledExistsSql()}
    AND "customers"."dnc_opted_out_at" IS NULL)`
}

/**
 * A fresh, actionable lead: in the leads pipeline, has phone + lead source, and
 * has NOT been acted upon (not enrolled, not removed) and is not DNC. This is
 * the canonical enrollment pool — it subtracts enrolled (the bug this fixes).
 */
export function isEligibleSql() {
  return sql`(${derivedPipelineWhere(['leads'])}
    AND "customers"."phone" IS NOT NULL
    AND "customers"."lead_source_id" IS NOT NULL
    AND "customers"."dnc_opted_out_at" IS NULL
    AND NOT ${enrolledExistsSql()}
    AND NOT ${removedRowExistsSql()})`
}

/** Union: any customer with a campaign-relevant status (the 'all' view). */
export function isCampaignLeadSql() {
  return sql`(${isEnrolledSql()} OR ${isDncSql()} OR ${isRemovedSql()} OR ${isEligibleSql()})`
}

/** Single derived status label. Mirrors the priority order above. */
export function leadStatusCaseSql() {
  return sql`CASE
    WHEN ${isEnrolledSql()} THEN 'enrolled'
    WHEN ${isDncSql()} THEN 'dnc'
    WHEN ${isRemovedSql()} THEN 'removed'
    ELSE 'eligible'
  END`
}
```

- [ ] **Step 2: tsc + lint.** Run `pnpm tsc && pnpm lint` — expect clean.

- [ ] **Step 3: Probe the predicates are mutually exclusive + sum correctly** (read-only standalone, no app-module import). Create `scripts/probe-status.ts`:

```ts
import './lib/load-env'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'
import { isCampaignLeadSql, leadStatusCaseSql } from '@/shared/entities/voip-campaign-contacts/lib/lead-campaign-status'

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }))
async function main() {
  const rows = (await db.execute(sql`
    SELECT ${leadStatusCaseSql()} AS status, COUNT(*)::int AS n
    FROM customers
    WHERE customers.lead_source_id IS NOT NULL AND ${isCampaignLeadSql()}
    GROUP BY status
  `)).rows as { status: string, n: number }[]
  console.log('per-status totals:', rows)
  // Sanity: no customer should be counted twice → sum of slices == count of union.
  const union = (await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM customers
    WHERE customers.lead_source_id IS NOT NULL AND ${isCampaignLeadSql()}
  `)).rows[0] as { n: number }
  const sliceSum = rows.reduce((a, r) => a + r.n, 0)
  console.log('union:', union.n, 'sliceSum:', sliceSum, 'EXCLUSIVE:', union.n === sliceSum)
  await (db as any).$client?.end?.(); process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

Run: `npx tsx scripts/probe-status.ts 2>&1 | grep -v "SECURITY\|sslmode\|libpq\|dotenv\|postgresql\|prepare\|behavior\|standard\|trace-warn"`
Expected: prints per-status totals AND `EXCLUSIVE: true` (union == sliceSum → the four statuses partition the set, proving mutual exclusivity). If `EXCLUSIVE: false`, the predicates overlap — FIX the lib until true.

- [ ] **Step 4: delete probe + commit.**
```bash
rm scripts/probe-status.ts
git add src/shared/entities/voip-campaign-contacts/lib/lead-campaign-status.ts
git commit -m "feat(voip): central canonical campaign-lead status predicates"
```

---

### Task A2: Collapse `listLeadsPaginated` onto the canonical view

**File:** Modify `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts`

- [ ] **Step 1: Replace the entire body of `listLeadsPaginated`** (all of: the `'all'` branch from the prior plan, plus the `enrolled`/`removed`/`eligible`/`dnc` if-branches) with ONE canonical query parameterized by status. Keep the `CampaignLeadRow` interface and `ListLeadsArgs` (status stays `LeadStatus | 'all'`). New body:

```ts
export async function listLeadsPaginated(
  args: ListLeadsArgs,
): Promise<DalReturn<{ rows: CampaignLeadRow[], total: number }>> {
  return dalDbOperation(async () => {
    const statusPredicate
      = args.status === 'all'
        ? isCampaignLeadSql()
        : args.status === 'enrolled'
          ? isEnrolledSql()
          : args.status === 'dnc'
            ? isDncSql()
            : args.status === 'removed'
              ? isRemovedSql()
              : isEligibleSql()

    const sourceFilter = args.sourceSlug
      ? sql`AND ls.slug = ${args.sourceSlug}`
      : sql``
    const campaignFilter = args.campaignId
      ? sql`AND part.voip_campaign_id = ${args.campaignId}`
      : sql``
    const searchFilter = args.search
      ? sql`AND (customers.name ILIKE ${`%${args.search}%`} OR customers.phone ILIKE ${`%${args.search}%`})`
      : sql``

    // `customers` is UNALIASED on purpose — the status predicates embed
    // derivedPipelineWhere's literal "customers"."…" refs, which an alias hides.
    // `part` LATERAL provides the display fields (campaign, attempts, etc.) for
    // the customer's most-relevant participation row.
    const fromAndWhere = sql`
      FROM customers
      LEFT JOIN lead_sources ls ON ls.id = customers.lead_source_id
      LEFT JOIN LATERAL (
        SELECT vcc.voip_campaign_id, vcc.enrolled_at, vcc.unenrolled_at,
               vcc.unenroll_reason, vcc.dial_attempts, vcc.last_sync_error
        FROM voip_campaign_contacts vcc
        WHERE vcc.customer_id = customers.id
        ORDER BY (vcc.unenrolled_at IS NULL) DESC, vcc.enrolled_at DESC NULLS LAST
        LIMIT 1
      ) part ON TRUE
      LEFT JOIN voip_campaigns vc ON vc.id = part.voip_campaign_id
      WHERE customers.lead_source_id IS NOT NULL AND ${statusPredicate}
      ${sourceFilter}
      ${campaignFilter}
      ${searchFilter}
    `

    return paginate({
      query: async () => {
        const result = await db.execute(sql`
          SELECT
            customers.id AS "customerId",
            customers.name AS name,
            ${leadStatusCaseSql()} AS status,
            part.voip_campaign_id AS "campaignId",
            vc.ct_campaign_name AS "campaignName",
            part.enrolled_at AS "enrolledAt",
            customers.lead_source_id AS "leadSourceId",
            customers.phone AS phone,
            ls.name AS "leadSourceName",
            COALESCE(part.dial_attempts, 0) AS "dialAttempts",
            customers.created_at AS "createdAt",
            part.unenroll_reason AS "unenrollReason",
            part.last_sync_error AS "lastSyncError"
          ${fromAndWhere}
          ORDER BY customers.created_at DESC
          LIMIT ${args.limit} OFFSET ${args.offset}
        `)
        return result.rows as unknown as CampaignLeadRow[]
      },
      count: async () => {
        const result = await db.execute(sql`SELECT COUNT(*)::int AS n ${fromAndWhere}`)
        return (result.rows[0] as { n: number } | undefined)?.n ?? 0
      },
    })
  })
}
```

NOTE: the campaign-filter previously on the `enrolled`/`removed` buckets filtered by the CAMPAIGN's source_slug; that's intentionally gone — `sourceFilter` now uses `ls.slug` (the customer's lead source). Remove any now-unused imports (`voipCampaigns` may still be used elsewhere in the file — only remove if `pnpm tsc`/lint flags it; do NOT remove `leadStatusCaseSql`/predicate imports).

- [ ] **Step 2: Add imports** for the central helpers (sorted into the internal group):
```ts
import { isCampaignLeadSql, isDncSql, isEligibleSql, isEnrolledSql, isRemovedSql, leadStatusCaseSql } from '@/shared/entities/voip-campaign-contacts/lib/lead-campaign-status'
```

- [ ] **Step 3: tsc + lint.** Run `pnpm tsc && pnpm lint` — expect clean. If unused imports remain (e.g. `derivedPipelineWhere`, `desc`, `isNull` that were only used by the deleted branches), remove them.

- [ ] **Step 4: Probe each status slice returns rows + correct labels** (standalone, reuse the Task A1 probe pattern but call the real exported `listLeadsPaginated` is NOT possible via tsx — so probe by status with raw SQL using the helpers, same as A1, iterating status filters). Minimum: confirm `eligible` slice count == the eligible total from the A1-style probe, and that `eligible` slice contains NO enrolled customers. A quick check:

```ts
// scripts/probe-slices.ts (standalone)
import './lib/load-env'
import process from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'
import { isEligibleSql, isEnrolledSql } from '@/shared/entities/voip-campaign-contacts/lib/lead-campaign-status'
const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }))
async function main() {
  const elig = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM customers WHERE customers.lead_source_id IS NOT NULL AND ${isEligibleSql()}`)).rows[0] as { n: number }
  const enr = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM customers WHERE customers.lead_source_id IS NOT NULL AND ${isEnrolledSql()}`)).rows[0] as { n: number }
  const overlap = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM customers WHERE ${isEligibleSql()} AND ${isEnrolledSql()}`)).rows[0] as { n: number }
  console.log('eligible:', elig.n, 'enrolled:', enr.n, 'overlap(MUST be 0):', overlap.n)
  await (db as any).$client?.end?.(); process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
```
Run it; expect `overlap(MUST be 0): 0`. Delete the probe.

- [ ] **Step 5: commit.**
```bash
git add src/shared/entities/voip-campaign-contacts/dal/server/queries.ts
git commit -m "refactor(voip): collapse leads query onto canonical status predicates"
```

---

### Task A3: Consolidate the per-source counts

**Files:** Modify `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts`, `src/shared/entities/customers/dal/server/queries.ts`, `src/trpc/routers/voip-campaigns.router.ts`

- [ ] **Step 1: Add `countLeadsByStatusPerSource`** to the voip-campaign-contacts queries file:

```ts
export interface LeadStatusCounts {
  eligible: number
  enrolled: number
  removed: number
  dnc: number
}

/**
 * Per-source, per-status counts in ONE pass — the single source of truth for
 * every rollup badge. Keyed by lead_source_id (uuid). Uses the canonical status
 * CASE so the four numbers always partition that source's campaign-leads.
 */
export async function countLeadsByStatusPerSource(): Promise<DalReturn<Record<string, LeadStatusCounts>>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      SELECT customers.lead_source_id AS "leadSourceId",
             ${leadStatusCaseSql()} AS status,
             COUNT(*)::int AS n
      FROM customers
      WHERE customers.lead_source_id IS NOT NULL AND ${isCampaignLeadSql()}
      GROUP BY customers.lead_source_id, status
    `)).rows as { leadSourceId: string, status: keyof LeadStatusCounts, n: number }[]

    const out: Record<string, LeadStatusCounts> = {}
    for (const row of rows) {
      const bucket = out[row.leadSourceId] ?? { eligible: 0, enrolled: 0, removed: 0, dnc: 0 }
      bucket[row.status] = row.n
      out[row.leadSourceId] = bucket
    }
    return out
  })
}
```

- [ ] **Step 2: Delete the three superseded count fns.** Remove `countActiveEnrollmentsBySource` from the voip-campaign-contacts queries file; remove `countEligibleLeadsBySource` and `countDncBySource` from `src/shared/entities/customers/dal/server/queries.ts`. (Search the repo for each name first: `grep -rn "countActiveEnrollmentsBySource\|countEligibleLeadsBySource\|countDncBySource" src` — the ONLY callers should be the router, which the next step rewires.)

- [ ] **Step 3: Rewire the router.** In `voip-campaigns.router.ts`:
  - `getEnrollmentCounts`: return just the enrolled slice:
    ```ts
    getEnrollmentCounts: agentProcedure.query(async () => {
      const byId = dalToTrpc(await countLeadsByStatusPerSource())
      const out: Record<string, number> = {}
      for (const [id, c] of Object.entries(byId)) {
        out[id] = c.enrolled
      }
      return out
    }),
    ```
    (Verify how `getEnrollmentCounts`' result is consumed in the UI — if it was keyed by source SLUG before via `countActiveEnrollmentsBySource`, find the consumer and confirm a switch to source ID is safe; if the consumer needs slug, build the map keyed by slug using the sources list. CHECK `grep -rn "getEnrollmentCounts" src/features`.)
  - `getSourceCampaignSummaries`: replace the three `count*` calls with one:
    ```ts
    const counts = dalToTrpc(await countLeadsByStatusPerSource())
    // …
    return sources.map(source => ({
      sourceSlug: source.slug,
      name: source.name,
      isActive: source.isActive,
      defaultCampaignId: source.voipConfigJSON?.campaigns?.defaultCampaignId ?? null,
      dncCount: counts[source.id]?.dnc ?? 0,
      eligibleCount: counts[source.id]?.eligible ?? 0,
      enrolledCount: counts[source.id]?.enrolled ?? 0,
      needsBinding: (counts[source.id]?.eligible ?? 0) > 0 && !source.voipConfigJSON?.campaigns?.defaultCampaignId,
    }))
    ```
  - Update imports: remove `countActiveEnrollmentsBySource, countDncBySource, countEligibleLeadsBySource`; add `countLeadsByStatusPerSource`.

- [ ] **Step 4: tsc + lint.** Run `pnpm tsc && pnpm lint` — expect clean.

- [ ] **Step 5: commit.**
```bash
git add src/shared/entities/voip-campaign-contacts/dal/server/queries.ts src/shared/entities/customers/dal/server/queries.ts src/trpc/routers/voip-campaigns.router.ts
git commit -m "refactor(voip): one per-source per-status counts query; fixes eligible over-count"
```

---

### Task A4: Re-anchor the remaining by-source readers

**File:** Modify `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts`

- [ ] **Step 1: `listEnrolledLeadsBySource(sourceSlug)`** — currently joins `voipCampaigns` and filters `eq(voipCampaigns.sourceSlug, sourceSlug)`. Rewrite to anchor on customers + the canonical enrolled predicate, filtered by the customer's lead source slug. Replace its body with a customer-anchored query:
```ts
export async function listEnrolledLeadsBySource(sourceSlug: string): Promise<DalReturn<{ customerId: string, name: string }[]>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      SELECT customers.id AS "customerId", customers.name AS name
      FROM customers
      JOIN lead_sources ls ON ls.id = customers.lead_source_id
      WHERE ls.slug = ${sourceSlug} AND ${isEnrolledSql()}
      ORDER BY customers.name
    `)).rows as { customerId: string, name: string }[]
    return rows
  })
}
```
(VERIFY the exact return shape the caller `listEnrolledLeads` expects — read it. If it returns more fields, include them. Keep the shape identical to avoid router churn.)

- [ ] **Step 2: `listActiveCustomerIdsBySource(sourceSlug)`** — same re-anchor:
```ts
export async function listActiveCustomerIdsBySource(sourceSlug: string): Promise<DalReturn<string[]>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      SELECT customers.id AS "customerId"
      FROM customers
      JOIN lead_sources ls ON ls.id = customers.lead_source_id
      WHERE ls.slug = ${sourceSlug} AND ${isEnrolledSql()}
    `)).rows as { customerId: string }[]
    return rows.map(r => r.customerId)
  })
}
```

- [ ] **Step 3: tsc + lint + probe.** Run `pnpm tsc && pnpm lint`. Then a quick standalone probe: for a known source slug (e.g. `'telemarketing'`), confirm `listActiveCustomerIdsBySource`-equivalent SQL returns the same customers that the enrolled slice shows for that source. (Reuse the predicate-probe pattern.) Delete probe.

- [ ] **Step 4: commit.**
```bash
git add src/shared/entities/voip-campaign-contacts/dal/server/queries.ts
git commit -m "refactor(voip): re-anchor enrolled-by-source reads to the customer's lead source"
```

---

## Phase B — Drop campaign→source ownership

### Task B1: Remove the binding UI + mutation + dead query

**Files:** `voip-campaigns.router.ts`, `use-campaign-mutations.ts`, `campaign-binding-row.tsx`, `cloudtalk-sync-card.tsx`, `voip-campaigns/dal/server/queries.ts`

- [ ] **Step 1:** Delete `listVoipCampaignsBySource` from `src/shared/entities/voip-campaigns/dal/server/queries.ts` (confirmed zero callers — re-verify with `grep -rn listVoipCampaignsBySource src`).
- [ ] **Step 2:** Remove the `bindCampaignToSource` mutation from `voip-campaigns.router.ts` and its `useMutation` wrapper + return entry from `use-campaign-mutations.ts`.
- [ ] **Step 3:** In `campaign-binding-row.tsx` + `cloudtalk-sync-card.tsx`, remove the "bind to source" Select control and all `onBind`/`bindCampaignToSource`/`campaign.sourceSlug` references; KEEP the per-source "set default campaign" toggle (`setDefaultCampaign` / `onToggleDefault`). The "is this campaign the default for source X" check must no longer read `campaign.sourceSlug` — derive it solely from the source's `defaultCampaignId` (the `defaultBySlug` map already exists in `cloudtalk-sync-card.tsx`). Read both files fully first and rework the row so it shows each campaign with a "Set as default for \<source\>" control only.
- [ ] **Step 4: tsc + lint.** `pnpm tsc && pnpm lint` — expect clean. Fix any dangling `sourceSlug` references the compiler surfaces.
- [ ] **Step 5: commit.** `refactor(voip): remove campaign→source ownership binding UI + mutation`

---

### Task B2: Drop the `source_slug` column

**File:** `src/shared/db/schema/voip-campaigns.ts`

- [ ] **Step 1:** Confirm zero remaining reads/writes: `grep -rn "sourceSlug\|source_slug" src | grep -i "voipCampaign\|voip_campaign"` — should return nothing except the schema column definition itself and the (already-omitting) sync upsert. If the sync upsert (`upsertCampaignByCtId`) references `sourceSlug` anywhere, remove that reference.
- [ ] **Step 2:** Remove the `sourceSlug` column AND its index from `voip-campaigns.ts` (the `voip_campaigns_source_slug_idx` index). Remove any now-unused `index` import only if unused.
- [ ] **Step 3:** Push schema to DEV: `pnpm db:push:dev`. Confirm it reports dropping the column. Run `pnpm tsc && pnpm lint`.
- [ ] **Step 4: commit.** `refactor(voip): drop voip_campaigns.source_slug column`
- [ ] **Step 5: PROD migration — STOP and ask the user.** Do NOT run `pnpm db:push` (prod). Report that the column drop is ready and prod push needs explicit approval + should be timed with the deploy.

---

## Self-Review

- **Spec coverage:** central helpers (A1); canonical collapse (A2); count consolidation + eligible-bug fix (A3); by-source re-anchor (A3 counts + A4 lists); ownership removal (B1) + column drop (B2). ✅
- **The bug:** A3's `countLeadsByStatusPerSource` uses `isEligibleSql()` (which subtracts enrolled), so the Eligible badge now matches the eligible list. Verified by A2 Step 4 overlap probe (must be 0).
- **One-status invariant:** A1 Step 3 probe asserts `union == sliceSum` (mutual exclusivity). The `removed > eligible` priority means removed leads leave the eligible pool — accepted consequence.
- **Type consistency:** `LeadStatusCounts` defined in A3, consumed in the router. Predicate fn names (`isEnrolledSql` etc.) identical across A1/A2/A3/A4.
- **Risk:** raw SQL again — every task with SQL has a standalone read-only probe gate before commit. The unaliased-`customers` requirement is documented in the lib and the query.
- **Out of scope (noted):** per-campaign rollup; auto-enroll-on-ingest; any change to the four canonical bucket *meanings* beyond making them exclusive.
