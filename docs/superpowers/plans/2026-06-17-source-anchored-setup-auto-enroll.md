# Source-anchored Setup + auto-enroll-on-ingest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-enroll freshly-ingested leads into their source's default campaign when policy allows, and flip the Setup tab from campaign-anchored to source-anchored (per-source `enabled` / `autoEnroll` / `defaultCampaignId`).

**Architecture:** All policy lives on `lead_sources.voipConfigJSON.campaigns` (campaigns stay pools — no column on `voip_campaigns`). `ingestLead` (the one chokepoint behind both the Bina webhook and the public intake form) dispatches a best-effort QStash `enrollLeadJob` when `enabled && autoEnroll && defaultCampaignId`. The job calls the unchanged `enroll()` (which resolves the source default at run time and runs the full gate chain). The Setup UI gets one generalized `setSourcePolicy` write path.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), TanStack Query, QStash (Upstash), shadcn/ui, Zod.

**Spec:** `docs/superpowers/specs/2026-06-17-source-anchored-setup-auto-enroll-design.md`

**⚠️ Verification discipline (this repo has NO test framework — CLAUDE.md):** every task verifies with `pnpm tsc` + `pnpm lint` and, where noted, a **read-only** DB probe or manual inspection. NEVER `pnpm build`. NEVER `pnpm db:push` (prod) — schema work is `pnpm db:push:dev` only (this plan adds no schema). `DATABASE_URL` in this checkout points at PROD — any probe must be SELECT/COUNT only.

**Strategy:** additive-then-subtractive so every commit type-checks green. New mutation/proc/hook/component land alongside the old ones; the old `setVoipDefaultCampaign` / `setDefaultCampaign` are deleted only in Task 9 after the card stops using them.

---

## File map

**Part A — auto-enroll (backend)**
- Create `src/shared/services/providers/upstash/jobs/enroll-lead.ts` — single-`{ customerId }` QStash job → `enroll()`.
- Modify `src/app/api/qstash-jobs/route.ts` — register the job.
- Modify `src/shared/services/customer-intake.service.ts` — dispatch on policy match after customer create.

**Part B — write path + query**
- Modify `src/shared/entities/lead-sources/dal/server/mutations.ts` — add `setVoipCampaignsPolicy` (patch merge).
- Modify `src/trpc/routers/voip-campaigns.router.ts` — add `setSourcePolicy` proc; add `enabled`/`autoEnroll` to `getSourceCampaignSummaries`.
- Modify `src/features/campaigns-admin/hooks/use-campaign-mutations.ts` — add `setSourcePolicy` mutation wrapper.

**Part C — UI**
- Create `src/features/campaigns-admin/ui/components/setup/source-policy-row.tsx` — one editable source row.
- Modify `src/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card.tsx` — two-table layout.
- Delete `src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx`.

**Part D — cleanup + docs**
- Modify `mutations.ts` / `voip-campaigns.router.ts` / `use-campaign-mutations.ts` — remove dead `setVoipDefaultCampaign` / `setDefaultCampaign`.
- Modify `src/shared/entities/voip-campaigns/DOCS.md` — note auto-enroll is wired.

---

## Task 1: `enrollLeadJob` QStash job

**Files:**
- Create: `src/shared/services/providers/upstash/jobs/enroll-lead.ts`

- [ ] **Step 1: Write the job**

Mirror `graduate-from-campaign.ts` (single-`{ customerId }`, `SYSTEM_CONTEXT`) but call `enroll` and classify retryability (only `ct_api_failure` and non-precondition errors retry; deterministic precondition rejects are terminal).

```ts
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'

import { createJob } from '../lib/create-job'

/**
 * Auto-enroll a single freshly-ingested lead into its source's default campaign
 * (source-anchored Setup + auto-enroll, spec 2026-06-17). Dispatched best-effort
 * from customerIntakeService.ingestLead when the source policy says
 * `enabled && autoEnroll && defaultCampaignId`. The gate decision lives at the
 * dispatch site; this job is a dumb executor.
 *
 * Payload is `{ customerId }` only — enroll() resolves the source's CURRENT
 * defaultCampaignId at run time (no campaignId pinned) and runs the full gate
 * chain (is-a-lead passes for a fresh ingest; DNC / phone / already-enrolled
 * still protect). System action → no requestedByUserId.
 *
 * Retry policy: deterministic precondition rejects (dnc_match / invalid_phone /
 * already_enrolled / no_dialable_campaign / not_a_lead) won't change on retry →
 * swallow + log. Throw on ct_api_failure or any non-precondition error so QStash
 * retries a transient CloudTalk / DB outage. Contrast graduate-from-campaign,
 * which uses dispatchOrThrow because a dropped dial-stop is a safety bug; a
 * dropped auto-enroll just means the lead isn't auto-dialed (admin can Enroll-all).
 */
export const enrollLeadJob = createJob(
  'enroll-lead',
  async (payload: { customerId: string }) => {
    const result = await campaignEnrollmentService.enroll(SYSTEM_CONTEXT, {
      customerId: payload.customerId,
    })
    if (result.success) {
      return
    }

    const isTerminalPrecondition
      = result.error.type === 'precondition-failed'
        && result.error.reason !== 'ct_api_failure'
    if (isTerminalPrecondition) {
      console.warn('[enroll-lead] skipped (terminal)', {
        customerId: payload.customerId,
        reason: result.error.reason,
      })
      return
    }

    const reason = result.error.type === 'precondition-failed'
      ? result.error.reason
      : result.error.type
    throw new Error(`enroll-lead retryable failure for ${payload.customerId}: ${reason}`)
  },
)
```

- [ ] **Step 2: Verify type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (the job is new and not yet imported anywhere; no consumers to break).

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/upstash/jobs/enroll-lead.ts
git commit -m "feat(voip): enroll-lead QStash job for auto-enroll-on-ingest"
```

---

## Task 2: Register `enrollLeadJob` in the QStash route

**Files:**
- Modify: `src/app/api/qstash-jobs/route.ts`

- [ ] **Step 1: Inspect the registry**

Run: `sed -n '1,60p' src/app/api/qstash-jobs/route.ts`
Note the existing import block (around line 8) and the registry object/array that lists jobs (around line 46, where `enrollSourceBatchJob` and `graduateFromCampaignJob` appear). The registry keys jobs so `?job=<key>` routes to the handler.

- [ ] **Step 2: Add the import**

Add alongside the other job imports (keep `perfectionist/sort-imports` order — alphabetical within the group; `enroll-lead` sorts before `enroll-source-batch`):

```ts
import { enrollLeadJob } from '@/shared/services/providers/upstash/jobs/enroll-lead'
```

- [ ] **Step 3: Add to the registry**

In the same object/array that already contains `enrollSourceBatchJob`, add `enrollLeadJob` (match the existing style — if it's a flat list of job objects, add `enrollLeadJob,`).

```ts
  enrollLeadJob,
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/qstash-jobs/route.ts
git commit -m "feat(voip): register enroll-lead job in qstash route"
```

---

## Task 3: Dispatch auto-enroll from `ingestLead`

**Files:**
- Modify: `src/shared/services/customer-intake.service.ts`

- [ ] **Step 1: Add the import**

Add to the import block (alphabetical within the `@/shared/services/...` group; this sorts near the existing service imports):

```ts
import { enrollLeadJob } from '@/shared/services/providers/upstash/jobs/enroll-lead'
```

- [ ] **Step 2: Dispatch right after the customer is created**

Immediately after `const customer = created.data` (currently line 64), before the optional-note block, insert. `sourceResult.data` is already in scope (resolved + null-checked above) and `.select()` returns the full row including `voipConfigJSON`:

```ts
      // ── Auto-enroll (best-effort, fire-and-forget) ─────────────────────────
      // Source-anchored policy gates here; enrollLeadJob is a dumb executor.
      // A dropped enqueue only means the lead isn't auto-dialed (admin can still
      // "Enroll all"), so best-effort `dispatch` — never breaks ingest.
      // see docs/superpowers/specs/2026-06-17-source-anchored-setup-auto-enroll-design.md
      const voipPolicy = sourceResult.data.voipConfigJSON?.campaigns
      if (voipPolicy?.enabled && voipPolicy.autoEnroll && voipPolicy.defaultCampaignId) {
        void enrollLeadJob.dispatch({ customerId: customer.id })
      }
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Read-only probe — confirm a live source would dispatch**

Confirm at least one source has the full triple set in prod (READ-ONLY; `DATABASE_URL` is prod). Write a throwaway probe using raw `drizzle + pg` (NOT app modules — tsx chokes on the provider barrel; see CLAUDE.md memory). Save as `scripts/probe-autoenroll.ts`:

```ts
import './lib/load-env'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

const rows = await db.execute(sql`
  SELECT slug,
         voip_config_json->'campaigns'->>'enabled'           AS enabled,
         voip_config_json->'campaigns'->>'autoEnroll'         AS auto_enroll,
         voip_config_json->'campaigns'->>'defaultCampaignId'  AS default_campaign_id
  FROM lead_sources
  ORDER BY slug
`)
console.table(rows.rows)
await pool.end()
```

Run: `pnpm tsx scripts/probe-autoenroll.ts`
Expected: prints each source's policy. Bina/meta currently shows `autoEnroll=false` (so it would NOT dispatch yet — that's correct; the toggle is set via the new UI). Note: a source dispatches only when all three columns are truthy. Delete the probe after: `rm scripts/probe-autoenroll.ts` (do NOT commit it).

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/customer-intake.service.ts
git commit -m "feat(voip): dispatch auto-enroll from ingestLead when source policy allows"
```

---

## Task 4: Generalize the policy mutation (additive)

**Files:**
- Modify: `src/shared/entities/lead-sources/dal/server/mutations.ts`

- [ ] **Step 1: Import the policy type**

Add `VoipCampaignsPolicy` to the existing type import (currently `import type { VoipConfig } from '@/shared/entities/lead-sources/schemas'`), keeping alphabetical named-import order:

```ts
import type { VoipCampaignsPolicy, VoipConfig } from '@/shared/entities/lead-sources/schemas'
```

- [ ] **Step 2: Add `setVoipCampaignsPolicy` (keep `setVoipDefaultCampaign` for now)**

Add a new exported function below the existing one. Imperative merge: spread existing campaigns (annotated `VoipCampaignsPolicy` so the assignment to `nextConfig.campaigns` is type-checked), then apply only the patched fields. `defaultCampaignId === null` clears (set to `undefined` → dropped by JSONB serialization, matching the existing pattern).

```ts
interface VoipCampaignsPolicyPatch {
  enabled?: boolean
  autoEnroll?: boolean
  // omit = leave unchanged; null = clear the default; uuid = set it.
  defaultCampaignId?: string | null
}

/**
 * Patch a lead source's `voip_config_json.campaigns` policy. Read-modify-write
 * merge: only the provided fields change; the rest (caps, template overrides)
 * are preserved. One write path for the source-anchored Setup tab (default
 * campaign + enabled + autoEnroll). No-op when the source is missing.
 *
 * `updatedAt` auto-bumps via the schema-helper `$onUpdate`.
 */
export async function setVoipCampaignsPolicy(
  sourceSlug: string,
  patch: VoipCampaignsPolicyPatch,
): Promise<DalReturn<{ rowsAffected: number }>> {
  return dalDbOperation(async () => {
    const [current] = await db
      .select({ voipConfigJSON: leadSourcesTable.voipConfigJSON })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, sourceSlug))
      .limit(1)
    if (!current) {
      return { rowsAffected: 0 }
    }

    const existing: VoipConfig = current.voipConfigJSON ?? {}
    const nextCampaigns: VoipCampaignsPolicy = { ...(existing.campaigns ?? { enabled: true, autoEnroll: false }) }
    if (patch.enabled !== undefined) {
      nextCampaigns.enabled = patch.enabled
    }
    if (patch.autoEnroll !== undefined) {
      nextCampaigns.autoEnroll = patch.autoEnroll
    }
    if (patch.defaultCampaignId !== undefined) {
      nextCampaigns.defaultCampaignId = patch.defaultCampaignId ?? undefined
    }

    const nextConfig: VoipConfig = { ...existing, campaigns: nextCampaigns }

    const result = await db
      .update(leadSourcesTable)
      .set({ voipConfigJSON: nextConfig })
      .where(eq(leadSourcesTable.slug, sourceSlug))
      .returning({ id: leadSourcesTable.id })

    return { rowsAffected: result.length }
  })
}
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/lead-sources/dal/server/mutations.ts
git commit -m "feat(voip): setVoipCampaignsPolicy patch-merge mutation"
```

---

## Task 5: Router — `setSourcePolicy` proc + summary flags (additive)

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts`

- [ ] **Step 1: Import the new mutation**

Update the import (line 6) to bring in `setVoipCampaignsPolicy` alongside the existing `setVoipDefaultCampaign` (keep both for now; alphabetical named-import order per `perfectionist/sort-named-imports`):

```ts
import { setVoipCampaignsPolicy, setVoipDefaultCampaign } from '@/shared/entities/lead-sources/dal/server/mutations'
```

- [ ] **Step 2: Add `enabled` / `autoEnroll` to `getSourceCampaignSummaries`**

In the `.map(source => ({ ... }))` (currently lines 59-68), add two fields:

```ts
      autoEnroll: source.voipConfigJSON?.campaigns?.autoEnroll ?? false,
      enabled: source.voipConfigJSON?.campaigns?.enabled ?? true,
```

(Place them in the existing object; ordering inside the object literal isn't lint-enforced, but keep it tidy near `defaultCampaignId`.)

- [ ] **Step 3: Add the `setSourcePolicy` proc**

Add next to `setDefaultCampaign` (after it, around line 113). Keep `setDefaultCampaign` for now.

```ts
  /** Patch a source's campaigns policy (default campaign + enabled + autoEnroll). */
  setSourcePolicy: superAdminProcedure
    .input(z.object({
      sourceSlug: z.string(),
      patch: z.object({
        autoEnroll: z.boolean().optional(),
        defaultCampaignId: z.string().uuid().nullable().optional(),
        enabled: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await setVoipCampaignsPolicy(input.sourceSlug, input.patch))
    }),
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip): setSourcePolicy proc + enabled/autoEnroll in source summaries"
```

---

## Task 6: Hook — `setSourcePolicy` wrapper (additive)

**Files:**
- Modify: `src/features/campaigns-admin/hooks/use-campaign-mutations.ts`

- [ ] **Step 1: Add the mutation wrapper**

After the existing `setDefaultCampaign` block (lines 42-50), add (keep `setDefaultCampaign` for now):

```ts
  const setSourcePolicy = useMutation(
    trpc.voipCampaignsRouter.setSourcePolicy.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Source policy updated')
      },
      onError: err => toast.error(err.message || 'Failed to update source policy'),
    }),
  )
```

- [ ] **Step 2: Export it**

Add `setSourcePolicy,` to the returned object (the `return { ... }` block, near `setDefaultCampaign`).

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/campaigns-admin/hooks/use-campaign-mutations.ts
git commit -m "feat(voip): useCampaignMutations.setSourcePolicy wrapper"
```

---

## Task 7: `SourcePolicyRow` component

**Files:**
- Create: `src/features/campaigns-admin/ui/components/setup/source-policy-row.tsx`

- [ ] **Step 1: Write the component**

One source row: name, default-campaign Select (with an explicit "— none —" sentinel since shadcn `Select` can't hold an empty value), Enabled switch, Auto-enroll switch (disabled with tooltip unless `enabled && defaultCampaignId`), and an `eligible / enrolled` count cell.

```tsx
'use client'

import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { TableCell, TableRow } from '@/shared/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'

// shadcn Select forbids an empty-string item value; use a sentinel for "no default".
const NO_DEFAULT = '__none__'

interface SourcePolicySummary {
  sourceSlug: string
  name: string
  defaultCampaignId: string | null
  enabled: boolean
  autoEnroll: boolean
  eligibleCount: number
  enrolledCount: number
}

interface SourcePolicyPatch {
  enabled?: boolean
  autoEnroll?: boolean
  defaultCampaignId?: string | null
}

interface SourcePolicyRowProps {
  source: SourcePolicySummary
  campaigns: VoipCampaign[]
  busy: boolean
  onPatch: (sourceSlug: string, patch: SourcePolicyPatch) => void
}

export function SourcePolicyRow({ source, campaigns, busy, onPatch }: SourcePolicyRowProps) {
  // Auto-enroll is inert without a master switch + a default campaign
  // (enroll() would reject no_dialable_campaign), so gate the control to match.
  const autoEnrollDisabled = busy || !source.enabled || !source.defaultCampaignId

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{source.name}</TableCell>
      <TableCell>
        <Select
          value={source.defaultCampaignId ?? NO_DEFAULT}
          disabled={busy}
          onValueChange={value =>
            onPatch(source.sourceSlug, { defaultCampaignId: value === NO_DEFAULT ? null : value })}
        >
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder="— none —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_DEFAULT}>— none —</SelectItem>
            {campaigns.map(campaign => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.ctCampaignName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Switch
          checked={source.enabled}
          disabled={busy}
          onCheckedChange={checked => onPatch(source.sourceSlug, { enabled: checked })}
          aria-label={`Enable VoIP campaigns for ${source.name}`}
        />
      </TableCell>
      <TableCell>
        {autoEnrollDisabled && !busy
          ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch
                      checked={source.autoEnroll}
                      disabled
                      aria-label={`Auto-enroll new leads for ${source.name}`}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Set a default campaign and enable the source first.</TooltipContent>
              </Tooltip>
            )
          : (
              <Switch
                checked={source.autoEnroll}
                disabled={autoEnrollDisabled}
                onCheckedChange={checked => onPatch(source.sourceSlug, { autoEnroll: checked })}
                aria-label={`Auto-enroll new leads for ${source.name}`}
              />
            )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {source.eligibleCount}
        {' / '}
        {source.enrolledCount}
      </TableCell>
    </TableRow>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (new file, not yet imported). If lint flags an unused export, ignore — Task 8 consumes it.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns-admin/ui/components/setup/source-policy-row.tsx
git commit -m "feat(voip): SourcePolicyRow component for source-anchored Setup"
```

---

## Task 8: Rewrite the Setup card to two tables

**Files:**
- Modify: `src/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card.tsx`
- Delete: `src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx`

- [ ] **Step 1: Rewrite the card**

Replace the file body. Keep the Resync button. Render two tables: read-only **Synced campaigns** (no source column — pools), then editable **Per-source policy** using `SourcePolicyRow`. The summary type now carries `enabled`/`autoEnroll` (Task 5).

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { RefreshCwIcon } from 'lucide-react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { SourcePolicyRow } from '@/features/campaigns-admin/ui/components/setup/source-policy-row'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { useTRPC } from '@/trpc/helpers'

/**
 * CloudTalk identity + per-source policy panel. Resync button, then a read-only
 * synced-campaigns readout (campaigns are pools — no source column), then the
 * editable per-source policy table (default campaign + enabled + autoEnroll).
 * Lives at the top of the Campaigns Control Center.
 */
export function CloudtalkSyncCard() {
  const trpc = useTRPC()
  const { resync, setSourcePolicy } = useCampaignMutations()

  const campaignsQuery = useQuery(trpc.voipCampaignsRouter.listCampaigns.queryOptions())
  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())

  const campaigns = campaignsQuery.data ?? []
  const summaries = summariesQuery.data ?? []

  const busy = resync.isPending || setSourcePolicy.isPending

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">CloudTalk Sync &amp; Per-Source Policy</CardTitle>
          <CardDescription>
            Pull campaigns from CloudTalk, then set each lead source&apos;s default campaign, enable VoIP, and auto-enroll.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={resync.isPending}
          onClick={() => resync.mutate()}
        >
          <RefreshCwIcon aria-hidden="true" className={resync.isPending ? 'size-4 animate-spin' : 'size-4'} />
          {resync.isPending ? 'Resyncing…' : 'Resync from CloudTalk'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* ── Synced campaigns (read-only) ─────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Synced campaigns</h3>
          {campaignsQuery.isLoading
            ? <Skeleton className="h-24 w-full" />
            : campaigns.length === 0
              ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No campaigns synced yet. Run Resync to pull campaigns from CloudTalk.
                  </p>
                )
              : (
                  <div aria-label="Synced campaigns" className="overflow-x-auto" role="region" tabIndex={0}>
                    <Table className="min-w-120">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Membership tag</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map(campaign => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium text-foreground">{campaign.ctCampaignName}</TableCell>
                            <TableCell>
                              <Badge variant={campaign.ctStatus === 'active' ? 'default' : 'secondary'}>
                                {campaign.ctStatus === 'active' ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{campaign.ctMembershipTag}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
        </section>

        {/* ── Per-source policy (editable) ─────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Per-source policy</h3>
          {summariesQuery.isLoading
            ? <Skeleton className="h-24 w-full" />
            : summaries.length === 0
              ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No lead sources found.</p>
                )
              : (
                  <div aria-label="Per-source policy" className="overflow-x-auto" role="region" tabIndex={0}>
                    <Table className="min-w-160">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead>Default campaign</TableHead>
                          <TableHead>Enabled</TableHead>
                          <TableHead>Auto-enroll</TableHead>
                          <TableHead>Eligible / Enrolled</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summaries.map(source => (
                          <SourcePolicyRow
                            key={source.sourceSlug}
                            source={source}
                            campaigns={campaigns}
                            busy={busy}
                            onPatch={(sourceSlug, patch) => setSourcePolicy.mutate({ sourceSlug, patch })}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
        </section>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Delete the obsolete row component**

```bash
git rm src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (`SourcePolicyRow`'s `source` prop is structurally satisfied by the summary row, which now includes `enabled`/`autoEnroll` from Task 5. If tsc complains a summary field is missing, re-check Task 5 Step 2.)

- [ ] **Step 4: Commit**

```bash
git add src/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card.tsx
git commit -m "feat(voip): source-anchored Setup tab (two-table layout)"
```

---

## Task 9: Remove the dead `setDefaultCampaign` / `setVoipDefaultCampaign`

**Files:**
- Modify: `src/shared/entities/lead-sources/dal/server/mutations.ts`
- Modify: `src/trpc/routers/voip-campaigns.router.ts`
- Modify: `src/features/campaigns-admin/hooks/use-campaign-mutations.ts`

- [ ] **Step 1: Confirm nothing else references them**

Run: `grep -rn "setDefaultCampaign\|setVoipDefaultCampaign" src/`
Expected: only the three definition sites (mutation, router proc + its import, hook wrapper + its export). If any OTHER consumer appears, stop and update it to `setSourcePolicy` first.

- [ ] **Step 2: Remove the hook wrapper**

In `use-campaign-mutations.ts`, delete the `const setDefaultCampaign = useMutation(...)` block and its `setDefaultCampaign,` entry in the returned object.

- [ ] **Step 3: Remove the router proc + import**

In `voip-campaigns.router.ts`, delete the `setDefaultCampaign: superAdminProcedure...` proc and drop `setVoipDefaultCampaign` from the import on line 6, leaving:

```ts
import { setVoipCampaignsPolicy } from '@/shared/entities/lead-sources/dal/server/mutations'
```

- [ ] **Step 4: Remove the mutation**

In `mutations.ts`, delete the entire `setVoipDefaultCampaign` function.

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.
Run: `grep -rn "setDefaultCampaign\|setVoipDefaultCampaign" src/`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(voip): drop setVoipDefaultCampaign superseded by setSourcePolicy"
```

---

## Task 10: Update DOCS (ping-on-staleness)

**Files:**
- Modify: `src/shared/entities/voip-campaigns/DOCS.md`

- [ ] **Step 1: Note auto-enroll is wired**

In the `#admin-binding` invariant, the sentence "(and, in future, auto-enroll-on-ingest)" is now stale. Update to reflect that auto-enroll-on-ingest is live: a source's `defaultCampaignId` is used by `enrollLeadJob` (dispatched from `customerIntakeService.ingestLead` when `enabled && autoEnroll && defaultCampaignId`). Reference the spec `docs/superpowers/specs/2026-06-17-source-anchored-setup-auto-enroll-design.md`.

```md
A lead source's **default** campaign — used to pre-select the campaign in
"Enroll all" and to auto-enroll new leads on ingest (when the source's policy
sets `enabled && autoEnroll`) — lives on
`lead_sources.voipConfigJSON.campaigns.defaultCampaignId`, set via the Setup tab.
Auto-enroll is dispatched best-effort by `enrollLeadJob` from
`customerIntakeService.ingestLead`. That is a *default*, not ownership: one
campaign can be the default for zero, one, or many sources.
```

- [ ] **Step 2: Verify reference + commit**

Run: `pnpm tsc` (docs-only change, but confirm nothing else is mid-edit)
Expected: PASS.

```bash
git add src/shared/entities/voip-campaigns/DOCS.md
git commit -m "docs(voip): note auto-enroll-on-ingest is wired (was 'future')"
```

---

## Final verification (after all tasks)

- [ ] `pnpm tsc && pnpm lint` — clean.
- [ ] `grep -rn "campaign-binding-row\|setVoipDefaultCampaign\|setDefaultCampaign" src/` — no matches.
- [ ] Manual smoke (dev or prod, your call): open the Campaigns Control Center → Setup. Confirm the **Per-source policy** table renders one row per source; set a default campaign, toggle Enabled, then toggle Auto-enroll; confirm each persists on refetch and that Auto-enroll is disabled (with tooltip) until both Enabled and a default are set.
- [ ] Post-deploy prod observation: a new Bina lead for a source with `enabled && autoEnroll && defaultCampaignId` lands actively enrolled (check the Leads tab `enrolled` count / CloudTalk contact tag).

## Notes for the implementer

- **No test framework.** Do not scaffold vitest/jest. Verification is `pnpm tsc` + `pnpm lint` + the read-only probe in Task 3 + manual smoke. (CLAUDE.md.)
- **`DATABASE_URL` is prod** in this checkout — every probe is SELECT/COUNT only. Never `pnpm db:push` (prod); this plan needs no schema change anyway.
- **tsx + provider barrel** — probes must use raw `drizzle + pg` + `sql`, importing only `./lib/load-env`, never app service/query modules (tsx throws `__name is not a function`).
- **Conventions:** one component per file; named exports only; imports perfectionist-sorted; braced `if` bodies. The new files already follow these.
- **Coupling note (Task 3):** `ingestLead` gaining a `void` fire-and-forget reference to a voip job is intentional and reviewed — it's the only shared chokepoint for both ingest channels; a `customerCrud.create` hook would wrongly fire for agent-manual creates and conversions.
