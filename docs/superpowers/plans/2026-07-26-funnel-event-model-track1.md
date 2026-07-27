# Funnel Event-Model Track 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the ratified Meta event ladder (renter-gated `CompleteRegistration`, CRM `Schedule` via CAPI on meeting creation) plus the draft-leads table, before the Showcase campaign activates.

**Architecture:** Browser events stay convention-bound in the funnels tracking lib; the CRM `Schedule` event flows meetings `create.after` hook → QStash `meta-capi-event` job → `measurement.service` (DAL reads) → `meta-sync.service` → Meta CAPI. A new `leads` table captures pre-PII funnel sessions (drafts) and links to customers at PII submit via `customers.leadId`.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), QStash jobs, Meta Graph API v23 (existing `metaClient`).

**Spec:** `docs/superpowers/specs/2026-07-26-funnel-event-model-redesign-design.md` (approved). Two deviations, both evidence-forced, both encoded below:
1. Submit-time IP/UA + firstName/lastName are NOT persisted anywhere today — the delayed `Schedule` event omits them for existing customers (customer `name` cannot be split losslessly — see `funnels.router.ts` comment). New drafts DO persist `clientIp`/`clientUserAgent` for future events.
2. Attribution lives in `customer_lead_attribution` (Wave-2 child, epic #256), NOT `leadMetaJSONDeprecated`. The Schedule slice reads from the child table.

## Global Constraints

- Package manager **pnpm**; path alias `@/` → `src/`.
- **NEVER `pnpm build`.** Verify with `pnpm tsc` + `pnpm lint` only. No test runner exists in this repo — every task's cycle is: implement → `pnpm tsc` → `pnpm lint` → commit.
- Work on **main**; stage explicitly by path; **never `git add -A`**.
- Schema pushes: **`pnpm db:push:dev` only** (prod push is a separate explicit launch step, only when Oliver asks).
- Standard Meta events only — no `trackCustom`, no new event names beyond `META_EVENT` constants.
- Provider-scoped naming: `metaLeadEventId`, `metaScheduleSentAt` — never bare `leadEventId`.
- Layering: tRPC → service → DAL → DB. No naked `db` outside DAL files. Entity owns its mutations. `updatedAt` is never set manually.
- No raw SQL `NOW()` for event timestamps — JS `new Date().toISOString()` (mode:'string' columns).
- One component per file; named exports only; schemas/ sibling of lib/.
- Coding conventions: `memory/coding-conventions.md` applies to every task.

---

### Task 1: Renter gate on `CompleteRegistration`

**Files:**
- Modify: `src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts`
- Modify: `src/shared/domains/funnels/lib/tracking/convention-map.ts` (comment only)

**Interfaces:**
- Consumes: `firesLeadOptimization(answers: FunnelAnswers): boolean` from `./lead-qualification` (exists).
- Produces: no new exports; behavior change only.

- [ ] **Step 1: Gate conversion-kind events in the convention emitter**

In `use-funnel-tracking.ts`, add the import and gate the second effect (the kind-bound one). `ViewContent` stays ungated by design (traffic event):

```ts
import { firesLeadOptimization } from '@/shared/domains/funnels/lib/tracking/lead-qualification'
```

Replace the second `useEffect` body with:

```ts
  // CompleteRegistration (and any future kind-bound conversion event) — on step
  // kind. Renter rule: renters fire traffic events (PageView/ViewContent),
  // never conversion events. see ../../DOCS.md and lead-qualification.ts.
  const stepKind = engine.step.kind
  const answers = engine.answers
  useEffect(() => {
    const event = STEP_KIND_BROWSER_EVENT[stepKind]
    if (event && !fired.current.has(event) && firesLeadOptimization(answers)) {
      fired.current.add(event)
      firePixel(event, { eventId: mintEventId(), contentCategory, contentName })
    }
  }, [stepKind, answers, contentCategory, contentName])
```

- [ ] **Step 2: Update the convention-map comment**

In `convention-map.ts`, replace the JSDoc's last sentence (`` `pii-form` (Lead) and `datetime` (Schedule)…``) with:

```ts
 * `pii-form` (Lead) is NOT here — it is dual-fire (server twin with a threaded
 * event_id) and fires at its own submit site. Events emitted from this map are
 * conversion events and are renter-gated at the emitter (use-funnel-tracking).
 * `Schedule` is NOT a browser event at all — it fires server-only from the CRM
 * when a meeting is created (see measurement.service.trackAppointmentSet).
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts src/shared/domains/funnels/lib/tracking/convention-map.ts
git commit -m "feat(tracking): renter-gate CompleteRegistration — renters fire traffic events, never conversion events"
```

---

### Task 2: Schema — `leads` table + two additive customers columns

**Files:**
- Create: `src/shared/db/schema/leads.ts`
- Modify: `src/shared/db/schema/customers.ts` (two columns)
- Modify: `src/shared/db/schema/index.ts` (export)

**Interfaces:**
- Produces: `leads` table; types `Lead`, `InsertLead`, `LeadStepTimelineEntry`; `customers.leadId`, `customers.metaScheduleSentAt`. Later tasks import `{ leads }` and the types from `@/shared/db/schema`.

- [ ] **Step 1: Create `src/shared/db/schema/leads.ts`**

```ts
import type { FunnelUtm } from '@/shared/domains/funnels/types'
import type z from 'zod'
import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'

/** One step-advance observation on a draft lead. Append-only. */
export interface LeadStepTimelineEntry {
  stepId: string
  stepIndex: number
  enteredAt: string // ISO — written by JS, never SQL NOW()
}

// The lead phase of a funnel visitor, decoupled from customers (design spec
// 2026-07-26 §3). Created anonymously on FIRST ANSWER (not page load — filters
// bots/bounces); a referencing customers.leadId row means "converted", no row
// means "draft" — status is DERIVED, never stored. NO PII lives here: PII
// enters only through submitLead → customers. Unconverted drafts are pruned
// after 90 days (prune-draft-leads job). Track 2 (customers→leads port) grows
// this table into the full lead entity — see the design spec §6.
export const leads = pgTable('leads', {
  id,
  funnelSlug: text('funnel_slug').notNull(),
  trade: text('trade'),
  // Answers-so-far keyed by step id. Full-value writes only — never a shallow
  // jsonb merge. see docs/codebase-conventions/jsonb-columns.md
  answersJSON: jsonb('answers_json').$type<Record<string, unknown>>().notNull(),
  stepTimelineJSON: jsonb('step_timeline_json').$type<LeadStepTimelineEntry[]>().notNull(),
  // Promoted attribution hot-fields (mirrors customer_lead_attribution's
  // promoted-columns pattern); utmJSON is the provider-plural raw capture
  // (source/medium/campaign/content/term + fbclid + gclid).
  fbclid: text('fbclid'),
  fbp: text('fbp'),
  utmJSON: jsonb('utm_json').$type<FunnelUtm>(),
  // Captured server-side at draft creation so the delayed CRM Schedule event
  // can carry the session's real IP/UA match keys (not persisted anywhere else).
  clientIp: text('client_ip'),
  clientUserAgent: text('client_user_agent'),
  // Meta join key: the Lead pixel/CAPI event_id, stamped at PII submit.
  metaLeadEventId: text('meta_lead_event_id'),
  createdAt,
  updatedAt,
}, table => [
  index('leads_funnel_slug_created_at_idx').on(table.funnelSlug, table.createdAt),
  index('leads_fbclid_idx').on(table.fbclid),
])

export const selectLeadSchema = createSelectSchema(leads)
export type Lead = z.infer<typeof selectLeadSchema>

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertLead = z.infer<typeof insertLeadSchema>
```

- [ ] **Step 2: Add the two customers columns**

In `src/shared/db/schema/customers.ts`, add the import and, directly below the `pipelineStage` column, insert:

```ts
import { leads } from './leads'
```

```ts
  // Lead-phase decoupling (design spec 2026-07-26 §3). Points at the funnel
  // draft-lead this customer converted from; end-state direction (customer →
  // lead) so Track 2 never flips it. Null for non-funnel customers and all
  // customers predating the leads table.
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  // Once-ever marker for the CRM Schedule CAPI event (appointment-set). Lives
  // on customers in Track 1 because pre-existing funnel customers have no
  // leads row until Track 2's backfill — tightening tally: moves to leads in
  // Track 2. see design spec §2.
  metaScheduleSentAt: timestamp('meta_schedule_sent_at', { mode: 'string', withTimezone: true }),
```

- [ ] **Step 3: Export from the schema index**

In `src/shared/db/schema/index.ts`, add (alphabetical position with the other exports):

```ts
export * from './leads'
```

- [ ] **Step 4: Push to dev DB**

Run: `pnpm db:push:dev`
Expected: `leads` table created; two columns added to `customers`. If working in a worktree, VERIFY the target DB afterward (see `memory/feedback-db-push-wt.md`).

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/leads.ts src/shared/db/schema/customers.ts src/shared/db/schema/index.ts
git commit -m "feat(schema): leads draft table + customers.leadId/metaScheduleSentAt (Track 1 decoupling increment)"
```

---

### Task 3: Leads DAL + customer link seam

**Files:**
- Create: `src/shared/entities/leads/dal/server/mutations.ts`
- Create: `src/shared/entities/leads/dal/server/queries.ts`
- Modify: `src/shared/entities/customers/dal/server/mutations.ts` (one function)
- Modify: `src/shared/services/customer-intake.service.ts` (one method)

**Interfaces:**
- Produces (leads DAL):
  - `createDraftLead(input: InsertLead): Promise<{ id: string }>`
  - `appendDraftStep(id: string, input: { answersJSON: Record<string, unknown>, entry: LeadStepTimelineEntry }): Promise<boolean>` — false if draft not found
  - `setMetaLeadEventId(id: string, metaLeadEventId: string): Promise<void>`
  - `deleteStaleDrafts(cutoffIso: string): Promise<number>`
  - `getLeadById(id: string): Promise<Lead | null>`
- Produces (customers DAL): `linkCustomerToLead(customerId: string, leadId: string): Promise<void>`
- Produces (intake service): `customerIntakeService.linkDraftLead(ctx, { customerId, draftLeadId, metaLeadEventId }): Promise<void>` — best-effort, logs on failure.

- [ ] **Step 1: Create `src/shared/entities/leads/dal/server/mutations.ts`**

```ts
import type { InsertLead, LeadStepTimelineEntry } from '@/shared/db/schema'
import { and, eq, isNull, lt, notInArray, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers, insertLeadSchema, leads } from '@/shared/db/schema'

export async function createDraftLead(input: InsertLead): Promise<{ id: string }> {
  const parsed = insertLeadSchema.parse(input)
  const [row] = await db.insert(leads).values(parsed).returning({ id: leads.id })
  return { id: row.id }
}

/**
 * Full-value write: caller supplies the complete answers map; the timeline
 * entry is appended to the freshly-read array. Single-writer per session
 * (the visitor's own browser), so read-modify-write is race-safe in practice.
 * Never a shallow jsonb merge. see docs/codebase-conventions/jsonb-columns.md
 */
export async function appendDraftStep(
  id: string,
  input: { answersJSON: Record<string, unknown>, entry: LeadStepTimelineEntry },
): Promise<boolean> {
  const [current] = await db
    .select({ stepTimelineJSON: leads.stepTimelineJSON })
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1)
  if (!current) {
    return false
  }
  await db
    .update(leads)
    .set({
      answersJSON: input.answersJSON,
      stepTimelineJSON: [...current.stepTimelineJSON, input.entry],
    })
    .where(eq(leads.id, id))
  return true
}

export async function setMetaLeadEventId(id: string, metaLeadEventId: string): Promise<void> {
  await db.update(leads).set({ metaLeadEventId }).where(eq(leads.id, id))
}

/** Unconverted drafts older than the cutoff. Converted leads are permanent. */
export async function deleteStaleDrafts(cutoffIso: string): Promise<number> {
  const converted = db
    .select({ leadId: customers.leadId })
    .from(customers)
    .where(sql`${customers.leadId} is not null`)
  const deleted = await db
    .delete(leads)
    .where(and(lt(leads.createdAt, cutoffIso), notInArray(leads.id, converted)))
    .returning({ id: leads.id })
  return deleted.length
}
```

Note: if `notInArray` with a subquery trips the installed drizzle version's types, use `sql`${leads.id} not in (select ${customers.leadId} from ${customers} where ${customers.leadId} is not null)`` inside the `and(...)` instead — same semantics. Do NOT use `isNull` import if unused after resolution; keep imports clean.

- [ ] **Step 2: Create `src/shared/entities/leads/dal/server/queries.ts`**

```ts
import type { Lead } from '@/shared/db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { leads } from '@/shared/db/schema'

export async function getLeadById(id: string): Promise<Lead | null> {
  const [row] = await db.select().from(leads).where(eq(leads.id, id)).limit(1)
  return row ?? null
}
```

- [ ] **Step 3: Add `linkCustomerToLead` to `src/shared/entities/customers/dal/server/mutations.ts`**

Append (matching the file's existing style — read it first, follow its import pattern):

```ts
/** Track-1 decoupling seam: point the customer at its originating draft lead. */
export async function linkCustomerToLead(customerId: string, leadId: string): Promise<void> {
  await db.update(customers).set({ leadId }).where(eq(customers.id, customerId))
}
```

- [ ] **Step 4: Add `linkDraftLead` to `customer-intake.service.ts`**

Read the service first; add a method alongside `ingestLead` (same ctx conventions):

```ts
    /**
     * Best-effort post-ingest link: draft lead ↔ customer + Meta Lead event_id
     * stamp. Failure must never fail the lead submit — analytics-grade linkage.
     */
    async linkDraftLead(_ctx: UserContext, args: {
      customerId: string
      draftLeadId: string
      metaLeadEventId?: string | null
    }): Promise<void> {
      try {
        await linkCustomerToLead(args.customerId, args.draftLeadId)
        if (args.metaLeadEventId) {
          await setMetaLeadEventId(args.draftLeadId, args.metaLeadEventId)
        }
      }
      catch (error) {
        console.warn('[customer-intake.linkDraftLead] failed:', error)
      }
    },
```

with imports `{ linkCustomerToLead }` from the customers DAL mutations and `{ setMetaLeadEventId }` from `@/shared/entities/leads/dal/server/mutations`. Match the service's actual ctx type name (`UserContext` or whatever `ingestLead` uses — copy it).

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/leads/dal/server/mutations.ts src/shared/entities/leads/dal/server/queries.ts src/shared/entities/customers/dal/server/mutations.ts src/shared/services/customer-intake.service.ts
git commit -m "feat(leads): draft-lead DAL + customer link seam"
```

---

### Task 4: Draft tracking — tRPC procedure, client hook, submitLead link, retire dormant seam

**Files:**
- Modify: `src/trpc/routers/funnels.router.ts` (add `trackDraftStep`, extend `submitLead`, DELETE `trackFunnelEvent`)
- Create: `src/shared/domains/funnels/lib/tracking/use-draft-lead.ts`
- Modify: wherever `useFunnelTracking` is mounted (`funnel-engine.tsx` — grep `useFunnelTracking(`) to also mount `useDraftLead`
- Modify: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx` (pass `draftId`)

**Interfaces:**
- Consumes: Task 3 DAL fns; `useFunnelUtm` hook (`src/shared/domains/funnels/hooks/use-funnel-utm.ts` — read it for the exact return shape); `clientIp` helper (`src/trpc/lib/client-ip.ts`).
- Produces: `funnelsRouter.trackDraftStep` mutation `{ draftId: string | null, funnelSlug, trade, stepId, stepIndex, answers, utm, fbp } → { draftId: string }`; `useDraftLead(spec, engine): void`; sessionStorage key `` `draft-lead:${spec.slug}` ``.

- [ ] **Step 1: Router — replace `trackFunnelEvent` with `trackDraftStep`**

Delete the entire `trackFunnelEvent` procedure (lines ~247–268) and the now-stale comment. Rename `trackRatelimit` → `draftRatelimit` with prefix `'funnel:draft'` and limit `60, '1 h'` (a session can advance ~15 steps; 60/h is comfortable headroom). Add:

```ts
  // Anonymous draft-lead capture (design spec 2026-07-26 §3). Fire-and-forget
  // from the funnel client on each step advance; creates the draft on first
  // answer. NO PII accepted here — PII enters only via submitLead. The pii
  // step's answers key is defensively stripped server-side.
  trackDraftStep: baseProcedure
    .input(z.object({
      draftId: z.string().uuid().nullable(),
      funnelSlug: z.string().min(1).max(100),
      trade: z.string().max(100).nullable(),
      stepId: z.string().min(1).max(100),
      stepIndex: z.number().int().min(0).max(100),
      answers: z.record(z.string(), z.unknown()),
      utm: z.object({
        source: z.string().nullable(),
        medium: z.string().nullable(),
        campaign: z.string().nullable(),
        content: z.string().nullable(),
        term: z.string().nullable(),
        fbclid: z.string().nullable(),
        gclid: z.string().nullable(),
      }).nullable(),
      fbp: z.string().max(200).nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await draftRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }
      const { pii: _pii, ...answers } = input.answers
      const entry = {
        stepId: input.stepId,
        stepIndex: input.stepIndex,
        enteredAt: new Date().toISOString(),
      }
      if (input.draftId) {
        const found = await appendDraftStep(input.draftId, { answersJSON: answers, entry })
        if (found) {
          return { draftId: input.draftId }
        }
        // Draft pruned or bogus id — fall through and mint a fresh one.
      }
      const ua = (ctx as { req?: Request }).req?.headers.get('user-agent') ?? null
      const { id } = await createDraftLead({
        funnelSlug: input.funnelSlug,
        trade: input.trade,
        answersJSON: answers,
        stepTimelineJSON: [entry],
        fbclid: input.utm?.fbclid ?? null,
        fbp: input.fbp,
        utmJSON: input.utm,
        clientIp: ip === 'anonymous' ? null : ip,
        clientUserAgent: ua,
      })
      return { draftId: id }
    }),
```

Imports to add: `appendDraftStep, createDraftLead` from `@/shared/entities/leads/dal/server/mutations`. NOTE — layering: this router already dispatches jobs and reads DAL-adjacent helpers directly for funnel-side plumbing (see `submitLead`); if `pnpm lint` flags the DAL import per Rule 19 tooling, route the two calls through a thin `leadsService` instead (`src/shared/services/leads.service.ts`, two pass-through methods) and import that.

- [ ] **Step 2: Router — extend `submitLead`**

Add to the input object:

```ts
      draftId: z.string().uuid().optional(),
```

After `const customerId = result.data.customer.id`, add:

```ts
      // Track-1 decoupling: link the pre-PII draft to the new customer and
      // stamp the Meta Lead event_id (the Meta↔first-party join key).
      if (input.draftId) {
        await customerIntakeService.linkDraftLead(SYSTEM_CONTEXT, {
          customerId,
          draftLeadId: input.draftId,
          metaLeadEventId: input.eventId ?? null,
        })
      }
```

(`linkDraftLead` swallows its own errors — the submit can never fail on linkage.)

- [ ] **Step 3: Create `use-draft-lead.ts`**

```ts
'use client'

import type { FunnelEngineApi } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useFunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'
import { readFbCookies } from '@/shared/domains/funnels/lib/tracking/fire-pixel'
import { useTRPC } from '@/trpc/helpers'

/**
 * First-party draft-lead capture (design spec 2026-07-26 §3). Creates an
 * anonymous draft on the FIRST answer and appends one timeline entry per step
 * advance. Fire-and-forget: failures never disturb the funnel UX. The draft id
 * survives reloads via sessionStorage and is threaded into submitLead by the
 * PII step so the draft links to the customer.
 */
export function useDraftLead(spec: FunnelSpec, engine: FunnelEngineApi): void {
  const trpc = useTRPC()
  const track = useMutation(trpc.funnelsRouter.trackDraftStep.mutationOptions())
  const utm = useFunnelUtm()
  const storageKey = `draft-lead:${spec.slug}`
  const lastTrackedStep = useRef<string | null>(null)

  const hasAnyAnswer = Object.values(engine.answers).some(v => v != null)
  const stepId = engine.step.id
  // FunnelEngineApi exposes `step`, not an index — derive it from the spec.
  const stepIndex = Math.max(0, spec.steps.findIndex(s => s.id === stepId))

  useEffect(() => {
    if (!hasAnyAnswer || lastTrackedStep.current === stepId) {
      return
    }
    lastTrackedStep.current = stepId
    const draftId = sessionStorage.getItem(storageKey)
    const { fbp } = readFbCookies()
    track.mutate(
      {
        draftId,
        funnelSlug: spec.slug,
        trade: spec.pixel.contentCategory ?? null,
        stepId,
        stepIndex,
        answers: engine.answers,
        utm,
        fbp,
      },
      { onSuccess: data => sessionStorage.setItem(storageKey, data.draftId) },
    )
    // Intentionally NOT depending on `track`/`utm` identity — fire per step change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyAnswer, stepId])
}
```

Adaptation notes (read the real files, keep the intent): if `spec.steps` is named differently on `FunnelSpec`, use the actual steps array; if `useFunnelUtm` requires args or returns a wrapper object, destructure accordingly; if `spec.pixel.contentCategory` is non-optional, drop the `?? null`.

- [ ] **Step 4: Mount the hook + thread draftId into submitLead**

- In `src/shared/domains/funnels/ui/funnel-engine.tsx` (line ~37, `useFunnelTracking(spec, engine)`), add `useDraftLead(spec, engine)` directly beneath it.
- In `pii-form-step.tsx`, where the `submitLead` mutation input is assembled (`submit.mutate({ ... })` around line 90), add:

```ts
      draftId: sessionStorage.getItem(`draft-lead:${ctx.spec.slug}`) ?? undefined,
```

(match how the step accesses the spec — it may be `spec.slug` from context; grep the file for `slug`).

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0. Manual smoke (optional but cheap): `pnpm dev`, open `kitchens.localhost:3000`, answer the first question, confirm a `leads` row exists (`pnpm db:snapshot --dry-run` not needed — query via drizzle studio or psql).

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/funnels.router.ts src/shared/domains/funnels/lib/tracking/use-draft-lead.ts src/shared/domains/funnels/ui/steps/pii-form-step.tsx <funnel-engine mount file>
git commit -m "feat(funnels): first-party draft-lead capture + submitLead linkage; retire dormant trackFunnelEvent"
```

---

### Task 5: CRM `Schedule` CAPI slice

**Files:**
- Modify: `src/shared/services/meta-sync.service.ts` (add `trackSchedule`)
- Modify: `src/shared/services/measurement.service.ts` (add `trackAppointmentSet`)
- Modify: `src/shared/services/providers/upstash/jobs/meta-capi-event.ts` (payload union)
- Create: `src/shared/entities/customers/dal/server/measurement.ts` (read + marker fns)
- Modify: `src/shared/entities/meetings/lib/server-spec.ts` (create.after dispatch)

**Interfaces:**
- Consumes: `metaClient`, `META_EVENT.Schedule`, `META_ACTION_SOURCE.website`, `getMetaConfig`/`isMetaConfigured`, `deriveFbc` (all exist); `ROOTS.subdomainUrl(slug)` from `@/shared/config/roots`; `firesLeadOptimization` from the funnels tracking lib (pure fn, server-safe); `getLeadById` (Task 3); phone E.164 helper from `@/shared/lib/phone` (read the file — memory says storage is bare 10-digit and E.164 belongs at external boundaries; use the exported E.164 formatter, whatever its exact name).
- Produces: `metaSyncService.trackSchedule(args: ScheduleEventArgs)`; `measurementService.trackAppointmentSet(args: AppointmentSetArgs)`; job payload variant `{ event: 'Schedule', args: AppointmentSetArgs }`; DAL fns `getCustomerForMeasurement`, `markMetaScheduleSent`.

- [ ] **Step 1: Customers measurement DAL — `src/shared/entities/customers/dal/server/measurement.ts`**

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customerLeadAttribution, customers } from '@/shared/db/schema'

/**
 * Read surface for the delayed CRM→CAPI Schedule event. One joined read: the
 * customer's identity match keys + the immutable funnel attribution snapshot.
 * see docs/superpowers/specs/2026-07-26-funnel-event-model-redesign-design.md §2
 */
export async function getCustomerForMeasurement(customerId: string) {
  const [row] = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      city: customers.city,
      state: customers.state,
      zip: customers.zip,
      leadId: customers.leadId,
      metaScheduleSentAt: customers.metaScheduleSentAt,
      attributionKind: customerLeadAttribution.kind,
      funnelSlug: customerLeadAttribution.funnelSlug,
      captureJSON: customerLeadAttribution.captureJSON,
    })
    .from(customers)
    .leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
    .where(eq(customers.id, customerId))
    .limit(1)
  return row ?? null
}

export async function markMetaScheduleSent(customerId: string, sentAtIso: string): Promise<void> {
  await db.update(customers).set({ metaScheduleSentAt: sentAtIso }).where(eq(customers.id, customerId))
}
```

- [ ] **Step 2: `meta-sync.service.ts` — add `ScheduleEventArgs` + `trackSchedule`**

Below `LeadEventArgs`, add:

```ts
export interface ScheduleEventArgs {
  eventId: string
  eventTime: number
  phone?: string | null
  email?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  externalId: string
  fbp?: string | null
  fbc?: string | null
  clientIp?: string | null
  clientUserAgent?: string | null
  eventSourceUrl?: string | null
  contentName?: string | null
  testEventCode?: string | null
}
```

Generalize `buildUserData` to accept `LeadEventArgs | ScheduleEventArgs` (it only reads optional fields — `firstName`/`lastName` are simply absent on Schedule; TypeScript: change the parameter type to a structural subset, e.g. `Pick<LeadEventArgs, 'phone' | 'email' | 'city' | 'state' | 'zip' | 'externalId' | 'fbp' | 'fbc' | 'clientIp' | 'clientUserAgent'> & { firstName?: string | null, lastName?: string | null }`). Then add to the service object:

```ts
    /**
     * CRM appointment-set → standard `Schedule`. Server-only (no browser twin —
     * the documented exception to dual-fire; explicit event_id gives retry
     * idempotence and future-proofs a dual-fire upgrade). Renter gate +
     * once-per-lead guard live in measurement.service, NOT here — this tier
     * only translates domain → wire. see providers/meta/DOCS.md
     */
    async trackSchedule(args: ScheduleEventArgs): Promise<void> {
      if (!isMetaConfigured()) {
        if (env.NODE_ENV === 'production') {
          console.error('[meta-sync] CAPI Schedule dropped — Meta is not configured in production.')
        }
        return
      }
      const { testEventCode: envTestEventCode } = getMetaConfig()
      const event: MetaServerEvent = {
        event_name: META_EVENT.Schedule,
        event_time: args.eventTime,
        event_id: args.eventId,
        action_source: META_ACTION_SOURCE.website,
        event_source_url: args.eventSourceUrl ?? undefined,
        user_data: buildUserData(args),
        custom_data: {
          content_name: args.contentName ?? undefined,
        },
      }
      await metaClient.sendConversions([event], {
        testEventCode: args.testEventCode ?? envTestEventCode ?? undefined,
      })
    },
```

- [ ] **Step 3: `measurement.service.ts` — add `trackAppointmentSet`**

```ts
import type { FunnelAnswers } from '@/shared/domains/funnels/types'
import { ROOTS } from '@/shared/config/roots'
import { firesLeadOptimization } from '@/shared/domains/funnels/lib/tracking/lead-qualification'
import { getCustomerForMeasurement, markMetaScheduleSent } from '@/shared/entities/customers/dal/server/measurement'
import { getLeadById } from '@/shared/entities/leads/dal/server/queries'
import { deriveFbc } from '@/shared/services/providers/meta/lib/derive-fbc'

export interface AppointmentSetArgs {
  customerId: string
  occurredAtIso: string
}
```

and the method (all guards live HERE — the design's chokepoint):

```ts
    /**
     * CRM appointment-set (meeting created) → Meta `Schedule`, server-only.
     * Guards: funnel-originated customers only; once per lead ever
     * (customers.metaScheduleSentAt — Meta dedup is only 48h); renter gate
     * (renters never fire conversion events; missing/unknown ownership fires,
     * matching firesLeadOptimization semantics). event_time = the meeting-
     * creation moment, never backdated. see design spec 2026-07-26 §2.
     */
    async trackAppointmentSet(args: AppointmentSetArgs): Promise<void> {
      const row = await getCustomerForMeasurement(args.customerId)
      if (!row || row.attributionKind !== 'funnel' || row.metaScheduleSentAt) {
        return
      }
      const lead = row.leadId ? await getLeadById(row.leadId) : null
      if (lead && !firesLeadOptimization(lead.answersJSON as FunnelAnswers)) {
        return // renter — traffic events only, never conversion events
      }
      const source = row.captureJSON?.source
      const funnel = source?.kind === 'funnel' ? source : undefined
      const nowMs = Date.now()
      await metaSyncService.trackSchedule({
        eventId: `appt-set-${row.id}`,
        eventTime: Math.floor(Date.parse(args.occurredAtIso) / 1000),
        phone: toE164(row.phone),
        email: row.email,
        city: row.city,
        state: row.state,
        zip: row.zip,
        externalId: row.id,
        fbp: funnel?.meta?.fbp ?? lead?.fbp ?? null,
        fbc: deriveFbc({
          fbc: funnel?.meta?.fbc,
          fbclid: funnel?.utm.fbclid ?? lead?.fbclid ?? undefined,
          nowMs,
        }),
        clientIp: lead?.clientIp ?? null,
        clientUserAgent: lead?.clientUserAgent ?? null,
        eventSourceUrl: row.funnelSlug ? ROOTS.subdomainUrl(row.funnelSlug) : null,
        contentName: row.funnelSlug,
      })
      await markMetaScheduleSent(args.customerId, new Date().toISOString())
    },
```

Add `import { toE164 } from '@/shared/lib/phone'` — verified: `toE164(input: string | null | undefined): string | null` (`src/shared/lib/phone.ts:50`). Customers store bare 10-digit; the Lead path sent E.164, and browser/server hashes must normalize identically (`providers/meta/DOCS.md`), so E.164 here keeps the cross-event hash stable. Marker is written AFTER a successful send: a send-then-crash retry re-sends, and the explicit `event_id` dedupes within 48h.

- [ ] **Step 4: Job union — `meta-capi-event.ts`**

```ts
import type { AppointmentSetArgs, FunnelLeadArgs } from '@/shared/services/measurement.service'
import { measurementService } from '@/shared/services/measurement.service'
import { createJob } from '../lib/create-job'

export type MetaCapiEventPayload
  = | { event: 'Lead', args: FunnelLeadArgs }
    | { event: 'Schedule', args: AppointmentSetArgs }

export const metaCapiEventJob = createJob(
  'meta-capi-event',
  async (payload: MetaCapiEventPayload) => {
    if (payload.event === 'Lead') {
      await measurementService.trackFunnelLead(payload.args)
    }
    else if (payload.event === 'Schedule') {
      await measurementService.trackAppointmentSet(payload.args)
    }
  },
)
```

(Export `AppointmentSetArgs` from measurement.service. Update the file's JSDoc: phase-2 comment now reads "Schedule shipped 2026-07 (appointment-set); Contact/MeetingComplete/ProposalSent/Purchase remain phase-2".)

- [ ] **Step 5: Meetings hook — `server-spec.ts` create.after**

Inside the existing `if (row.customerId) { ... }` block (after the `graduateFromCampaignJob` dispatch), add:

```ts
          // Meta measurement: appointment-set = meeting created (design spec
          // 2026-07-26 §2). Cosmetic criticality → best-effort dispatch, like
          // the funnel Lead twin. All guards (funnel-origin, renter gate,
          // once-per-lead) live in measurement.trackAppointmentSet.
          void metaCapiEventJob.dispatch({
            event: 'Schedule',
            args: { customerId: row.customerId, occurredAtIso: new Date().toISOString() },
          })
```

with the import `{ metaCapiEventJob }` added to the file's job imports.

- [ ] **Step 6: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/shared/services/meta-sync.service.ts src/shared/services/measurement.service.ts src/shared/services/providers/upstash/jobs/meta-capi-event.ts src/shared/entities/customers/dal/server/measurement.ts src/shared/entities/meetings/lib/server-spec.ts
git commit -m "feat(meta): CRM Schedule CAPI slice — appointment-set on meeting creation, renter-gated, once per lead"
```

---

### Task 6: Draft-prune job

**Files:**
- Create: `src/shared/services/providers/upstash/jobs/prune-draft-leads.ts`
- Modify: `src/app/api/qstash-jobs/route.ts` (register)

**Interfaces:**
- Consumes: `deleteStaleDrafts(cutoffIso)` (Task 3).
- Produces: `pruneDraftLeadsJob` registered under key `prune-draft-leads`. Triggered by a QStash Schedule (created manually at launch — Task 8 checklist).

- [ ] **Step 1: Create the job**

```ts
import { deleteStaleDrafts } from '@/shared/entities/leads/dal/server/mutations'
import { createJob } from '../lib/create-job'

const DRAFT_RETENTION_DAYS = 90

/**
 * Retention sweep for unconverted draft leads (design spec 2026-07-26 §3):
 * drafts are analytics exhaust, not records — pruned after 90 days. Converted
 * leads (referenced by customers.leadId) are permanent and never touched.
 * Triggered by a daily QStash Schedule targeting
 * /api/qstash-jobs?job=prune-draft-leads (created in the Upstash console —
 * see the launch runbook).
 */
export const pruneDraftLeadsJob = createJob('prune-draft-leads', async () => {
  const cutoffIso = new Date(Date.now() - DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const deleted = await deleteStaleDrafts(cutoffIso)
  // eslint-disable-next-line no-console
  console.log(`[prune-draft-leads] deleted ${deleted} stale drafts (cutoff ${cutoffIso})`)
})
```

- [ ] **Step 2: Register it**

In `src/app/api/qstash-jobs/route.ts`: add the import (alphabetical with siblings) and `pruneDraftLeadsJob` to the `jobs: Job[]` array.

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/providers/upstash/jobs/prune-draft-leads.ts src/app/api/qstash-jobs/route.ts
git commit -m "feat(leads): 90-day draft-lead retention sweep job"
```

---

### Task 7: Documentation

**Files:**
- Modify: `src/shared/services/providers/meta/DOCS.md`
- Modify: `scripts/meta/DOCS.md`
- Modify: `docs/ubiquitous-language.md`
- Modify: `docs/plans/2026-07-26-funnel-event-model-research-findings.md` (mark R2 items done)

**Interfaces:** none — prose. Every claim written must match the code shipped in Tasks 1–6 (trust-but-verify: re-read the shipped code, not this plan, before writing).

- [ ] **Step 1: `providers/meta/DOCS.md`** — add under Invariants:

```md
- **`Schedule` = CRM appointment-set, server-only.** Fired from the meetings
  create hook via the `meta-capi-event` job when a meeting is created for a
  funnel-originated customer. This is the documented exception to dual-fire:
  there is no browser session at appointment-set time. It still carries an
  explicit `event_id` (`appt-set-<customerId>`) — QStash-retry idempotence
  within Meta's 48h dedup window + future dual-fire proofing — and a
  once-ever guard (`customers.metaScheduleSentAt`) because 48h is not
  "once per lead". Renter gate applies (renters fire traffic events, never
  conversion events). `event_time` = meeting-creation moment, never backdated;
  events older than 7 days must never be sent (CAPI rejects the batch).
```

- [ ] **Step 2: `scripts/meta/DOCS.md`** — update the `optimization-ladder` section: ad sets stay on `optimizationEvent: 'LEAD'`; `SCHEDULE` now exists as a server-fired event usable for reporting/audiences and a future probe ad set (learning-limited expected below ~50/wk). Append a `## campaign-duplication-runbook` section with the five steps from the design spec §4 (declare `contentCategory` → ladder self-wires → `optimizationEvent: 'LEAD'` + `pnpm meta sync` → apply the saved "Funnel Ladder" column preset → one Events Manager validation pass → baseline rung thresholds after ~2 weeks).

- [ ] **Step 3: `docs/ubiquitous-language.md`** — add to the event vocabulary: **Schedule** — Meta standard event meaning *an appointment was set: a meeting row was created for a funnel-originated customer*; fired server-only via CAPI; renter-gated; once per lead. **Purchase** — RESERVED for contract-signed with real `value`/`currency`; never appointment-set. **Draft lead** — an anonymous pre-PII funnel session persisted in `leads`; becomes a converted lead when a customer references it via `customers.leadId`.

- [ ] **Step 4: Research-findings doc** — in §6 Phase 2, mark R2.1–R2.7 with ✅ + date. (R2.1 shipped as "no new event" per final design — note that.)

- [ ] **Step 5: Verify + commit**

Run: `pnpm lint` (markdown untouched by tsc).

```bash
git add src/shared/services/providers/meta/DOCS.md scripts/meta/DOCS.md docs/ubiquitous-language.md docs/plans/2026-07-26-funnel-event-model-research-findings.md
git commit -m "docs(meta): Schedule invariant, campaign-duplication runbook, UL event vocabulary"
```

---

### Task 8: Full preflight + validation & launch runbook

**Files:** none created — this task is verification + a human checklist handed to Oliver.

- [ ] **Step 1: Full preflight**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0 across the whole repo.

- [ ] **Step 2: Dev smoke of the full loop**

`pnpm dev` → `kitchens.localhost:3000`:
1. Answer the hero question → verify a `leads` row (answers + timeline + utm).
2. Advance steps → timeline grows, one entry per step.
3. Submit PII (test data) → `customers.leadId` set, `leads.metaLeadEventId` set.
4. Create a meeting for that customer in the dashboard → QStash log shows `meta-capi-event` dispatch; with dev Meta config set, Events Manager **Test Events** shows `Schedule` (server, `test_event_code`); `customers.metaScheduleSentAt` set.
5. Create a SECOND meeting → no second dispatch effect (marker guard).
6. Repeat 1–3 answering `ownership = rent` → NO Lead, NO CompleteRegistration, and meeting creation produces NO Schedule.

- [ ] **Step 3: Write the launch-day runbook message to Oliver (manual Meta-UI steps, in order)**

1. Deploy to prod.
2. Real-browser validation (NEVER headless): Events Manager → Test Events → "Open Website" + Pixel Helper — Lead dedups (Browser+Server, one event_id), EMQ ≥7, diagnostics clean.
3. Build + save the **"Funnel Ladder"** Ads Manager column preset: Spend → CPM → Link CTR → Cost/Landing Page View → ViewContents+cost → Leads+Cost/Lead → CompleteRegistrations → Schedules+Cost/Schedule.
4. Create the QStash Schedule: daily cron → `POST <prod-url>/api/qstash-jobs?job=prune-draft-leads`.
5. Write down target ranges per ladder rung (pre-committed thresholds).
6. Activate Showcase optimizing on `LEAD`, 7-day-click/1-day-view; hands off ad sets ≥7 days.
7. (~4 weeks) Optional `Schedule` probe ad set; expect learning-limited; kill if it loses to Lead-optimized sets.

- [ ] **Step 4: Commit anything the smoke test forced you to fix, by explicit path, with a `fix(...)` message.**
