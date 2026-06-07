# Lead-Intake Normalization + Per-Contact Unenroll/Re-enroll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two voip-campaigns prod-blockers — (1) CloudTalk trade attributes stored as raw UUIDs / empty, and (2) no neutral per-contact unenroll-with-re-enroll — by restructuring `leadMetaJSON`, normalizing every lead source into one envelope, and adding the `removed` exit reason + UI affordances.

**Architecture:** A source-agnostic `leadMetaJSON` envelope (`interestedTradesRaw` + a `source` discriminated union) is populated by **one channel-agnostic `customerIntakeService.ingestLead`** that both the Bina webhook and the public intake form route through. Bina payloads are normalized to `{ core, leadMeta }` by a **pure provider-lib translator** (`gohighlevel/lib/normalize-bina-lead.ts`); the provider `client.ts` stays a leaf (auth + parse only). CloudTalk attribute derivation then reads `interestedTradesRaw` uniformly. Part B adds a neutral `removed` unenroll reason and per-contact Remove / switch-campaign UI.

**Tech Stack:** Next.js 15 (App Router route handlers + tRPC), Drizzle (Postgres/Neon), Zod, TanStack Query, shadcn/ui. **No test runner exists** — verification is `pnpm tsc` + `pnpm lint` + manual webhook/CT/DB checks. **Never run `pnpm build`.** Schema changes are `jsonb`-shape or `text`-enum-value only — **no `db:push` needed**.

---

## Conventions this plan follows (deviations from the spec, decided 2026-06-06)

These were reconciled against `docs/codebase-conventions/` and confirmed with the user (conventions win over the spec):

1. **Normalizer is a provider `lib/` translator, NOT a client method.** `service-architecture.md#providers-have-no-domain-types-in-signatures` allows domain translation in a provider's `lib/`. So `normalizeBinaLead(payload) → { core, leadMeta }` lives at `gohighlevel/lib/normalize-bina-lead.ts`. The `client.ts` exposes only provider-native ops (`verifyWebhookSecret`, `parseBinaWebhook`). **Spec §10's "egress vs ingress convention extension" is therefore dropped — not needed.**
2. **`bina_webhook_logs` write goes through a service** (`webhookService.logBinaInbound`), never a raw `db.insert` in the route (`webhook-routes.md` Rule 3).
3. **Unified customer creation uses `customerCrud.create`** (canonical entity DAL), not the legacy `createCustomerFromWebhook` (which `queries.ts` marks for retirement). The legacy fn's only caller is the Bina route, so it is removed once the route uses the service.
4. **Bina inbound payload schema stays in `gohighlevel/schemas.ts`** (in place — no relocation to `webhooks/`), per the user's "minimize churn" choice.
5. **`createFromIntake` keeps its existing raw-db reads** (list/search/addNote/lead-source lookup) — only the customer+note+meeting *creation* path is refactored into the service. No unrelated refactor of the rest of the router.

---

## File structure

**New files**
- `src/shared/services/providers/gohighlevel/client.ts` — `gohighlevelClient` singleton (`verifyWebhookSecret`, `parseBinaWebhook`). Leaf; provider-native types only.
- `src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts` — pure translator `BinaContactPayload → { core, leadMeta }` + `ghlString` + `formatBinaNote`.
- `src/shared/services/customer-intake.service.ts` — `customerIntakeService.ingestLead`. Channel-agnostic orchestrator. Zero raw `db.*`.
- `src/shared/entities/customers/dal/server/mutations.ts` — `addCustomerNote`.
- `src/shared/dal/server/webhook-logs.ts` — `insertBinaWebhookLog` DAL mutation.

**Modified files**
- `src/shared/entities/customers/schemas/index.ts` — `leadMetaSchema` (envelope + discriminated union).
- `src/shared/services/providers/gohighlevel/schemas.ts` — Bina payload: top-level `address`; expanded `additionalData`.
- `src/shared/entities/lead-sources/dal/server/queries.ts` — add `getLeadSourceBySlug`.
- `src/shared/entities/customers/dal/server/queries.ts` — remove legacy `createCustomerFromWebhook` + `WebhookCustomerData` (moved to the service's input type); keep the rest.
- `src/shared/services/webhook.service.ts` — add `logBinaInbound`.
- `src/app/api/webhooks/bina/route.ts` — thin orchestrator.
- `src/trpc/routers/customers.router/business.router.ts` — `createFromIntake` resolves picked trade names + routes through the service.
- `src/shared/services/voip/campaigns/lib/build-contact-attributes.ts` — derive from `interestedTradesRaw`; delete `@migration`.
- `src/shared/services/voip/campaigns/enrollment.service.ts` — pass `interestedTradesRaw`.
- `src/shared/constants/enums/voip.ts` — add `removed`.
- `src/trpc/routers/voip-campaigns.router.ts` — `removeFromCampaign`.
- `src/features/campaigns-admin/hooks/use-campaign-mutations.ts` — `removeFromCampaign` + `enroll` mutations.
- `src/features/campaigns-admin/ui/components/enrolled-lead-row.tsx` + `enrolled-leads-list.tsx` — Remove + switch-campaign affordances.

**Scope note (re-enroll UI):** Removed leads return to the eligible pool, so they are re-enrollable via the existing single `enroll` / `enrollAll`. A dedicated "removed leads" list or a customer-profile VoIP panel for re-enrolling a *specific previously-removed* contact does **not** have an existing home and is left as a follow-up. Part B surfaces Remove + per-row switch-campaign on the existing active-enrolled list. Confirm with the user if a deeper re-enroll surface is required for prod.

---

# PART A — Lead-intake normalization (fixes prod-blocker #1)

## Task 1: Restructure `leadMetaSchema`

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts:66-81`

- [ ] **Step 1: Replace the `leadMetaSchema` block**

Replace lines 66-81 (the current `leadMetaSchema` + `LeadMeta` export) with:

```ts
export const leadMetaSchema = z.object({
  // ── operational (unchanged) ──
  mp3RecordingKey: z.string().optional(),
  closedBy: z.string().optional(),
  scheduledFor: z.string().optional(), // also receives Bina selfBookingDateTime

  // ── normalized envelope (source-AGNOSTIC; identical keys for every source) ──
  // Raw, human-readable interested-trade strings. Bina → split campaign trades;
  // in-app form → resolved picked-trade NAMES. Downstream (CT attributes, SMS
  // merge) reads ONLY the envelope — never branches on `source.kind`.
  interestedTradesRaw: z.array(z.string()).optional(),
  // Origin-campaign ATTRIBUTION — free string off the lead-source origin + intake
  // form. Descriptive/immutable; distinct from the OPERATIONAL enrolled campaign
  // (voip_campaign_contacts.voip_campaign_id). Does NOT drive routing.
  originCampaign: z.string().optional(),
  // OPTIONAL human-confirmed app-trade link, filled later by an agent. The
  // envelope's interestedTradesRaw is the cross-source truth; this is the
  // structured link to real app trades/scopes once a human confirms it.
  requestedTrades: z.array(z.object({
    tradeId: z.string(),
    scopeIds: z.array(z.string()),
  })).optional(),

  // ── typed source capture (discriminated union; kind = payload SHAPE, decoupled
  //    from the dynamic lead-source slug). Raw provider fields verbatim, for
  //    human/agent context. NEVER read by the generic dial/SMS path. ──
  source: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('bina'),
      budgetSolution: z.string().nullable(),
      rebateAmount: z.string().nullable(),
      bathroomAge: z.string().nullable(),
      bathroomSize: z.string().nullable(),
      bathroomScope: z.string().nullable(),
      kitchenAge: z.string().nullable(),
      kitchenSize: z.string().nullable(),
      kitchenScope: z.string().nullable(),
    }),
    z.object({ kind: z.literal('generic') }),
  ]).optional(),
})
export type LeadMeta = z.infer<typeof leadMetaSchema>
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc`
Expected: PASS. (Purely additive to an optional `jsonb` column — existing rows stay valid. The `customers.ts` `$type<LeadMeta>` picks up the new shape.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/customers/schemas/index.ts
git commit -m "feat(customers): restructure leadMetaSchema with source-agnostic envelope + discriminated union"
```

---

## Task 2: Expand the Bina payload schema

**Files:**
- Modify: `src/shared/services/providers/gohighlevel/schemas.ts:14-33`

- [ ] **Step 1: Replace `binaAdditionalDataSchema` and `binaContactPayloadSchema`**

Replace lines 14-33 with:

```ts
export const binaAdditionalDataSchema = z.object({
  // Existing fields. GHL sends literal "null" strings for empties — coalesced
  // downstream by `ghlString` in the normalizer. Kept permissive (.optional()).
  budgetSolution: z.string().optional(),
  rebateAmount: z.string().optional(),
  trades: z.string().optional(),
  // Self-booking time → reused as leadMeta.scheduledFor (no new field).
  selfBookingDateTime: z.string().optional(),
  // Campaign-specific capture (energy-efficiency vs bathroom/kitchen). The
  // "master payload" carries whichever the running Bina campaign populated.
  bathroomAge: z.string().optional(),
  bathroomSize: z.string().optional(),
  bathroomScope: z.string().optional(),
  kitchenAge: z.string().optional(),
  kitchenSize: z.string().optional(),
  kitchenScope: z.string().optional(),
})

/**
 * Bina sends a custom GHL workflow webhook with flat contact fields at the top
 * level + nested additionalData object:
 *   { firstName, lastName, email, phone, address?, city, zip, additionalData: {...} }
 */
export const binaContactPayloadSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string().optional(),
  city: z.string(),
  zip: z.string(),
  additionalData: binaAdditionalDataSchema,
})
```

> Note: `budgetSolution`/`rebateAmount` are relaxed from required → `.optional()` because the master payload only populates the fields the running campaign used. `BinaContactPayload`/`BinaAdditionalData` types auto-update via `types.ts` (`z.infer`).

- [ ] **Step 2: Verify**

Run: `pnpm tsc`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/gohighlevel/schemas.ts
git commit -m "feat(gohighlevel): expand Bina payload schema (address, selfBookingDateTime, kitchen/bathroom capture)"
```

---

## Task 3: Create the GoHighLevel provider client (leaf)

**Files:**
- Create: `src/shared/services/providers/gohighlevel/client.ts`

- [ ] **Step 1: Write the client**

```ts
import env from '@/shared/config/server-env'

import { BINA_AUTH_HEADER } from './constants'
import { binaContactPayloadSchema } from './schemas'
import type { BinaContactPayload } from './types'

// GoHighLevel provider client (leaf). Bina's lead intake arrives as a custom
// GHL workflow webhook. This client owns provider-native concerns ONLY: bearer
// auth verification + payload parsing. Translation to app-domain shapes lives in
// `lib/normalize-bina-lead.ts` (see service-architecture.md — domain translation
// belongs in a provider lib/, never in client signatures). Env is read lazily
// inside method bodies per provider-env-config rules.

export type BinaParseResult =
  | { ok: true, payload: BinaContactPayload }
  | { ok: false }

function createGohighlevelClient() {
  return {
    /**
     * Verify the bearer token Bina's GHL workflow sends. Returns false when a
     * secret is configured and the token mismatches. In dev with no secret set,
     * accepts (logs a warning). In production with no secret, returns false
     * (the route maps that to a 500 / unauthorized — fail closed).
     */
    verifyWebhookSecret({ authHeader }: { authHeader: string | null }): boolean {
      const secret = env.BINA_WEBHOOK_SECRET
      if (secret) {
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
        return token === secret
      }
      if (env.NODE_ENV === 'production') {
        console.error('[gohighlevel] BINA_WEBHOOK_SECRET not configured in production')
        return false
      }
      console.warn('[gohighlevel] no BINA_WEBHOOK_SECRET set — accepting (dev only)')
      return true
    },

    /** The auth header name Bina uses. Re-exported so the route reads one place. */
    authHeaderName: BINA_AUTH_HEADER,

    /** Parse + validate a raw Bina webhook body into the provider-native shape. */
    parseBinaWebhook(raw: unknown): BinaParseResult {
      const result = binaContactPayloadSchema.safeParse(raw)
      if (!result.success) {
        console.warn('[gohighlevel] Bina payload failed validation', result.error.flatten())
        return { ok: false }
      }
      return { ok: true, payload: result.data }
    },
  }
}

export const gohighlevelClient = createGohighlevelClient()
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/gohighlevel/client.ts
git commit -m "feat(gohighlevel): add provider client (verifyWebhookSecret + parseBinaWebhook)"
```

---

## Task 4: Create the Bina → domain normalizer (provider lib translator)

**Files:**
- Create: `src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts`

- [ ] **Step 1: Write the translator**

```ts
import type { LeadMeta } from '@/shared/entities/customers/schemas'
import type { BinaContactPayload } from '../types'

// Pure translator: provider-native Bina payload → app-domain { core, leadMeta }.
// This is the ONLY place that knows Bina/GHL field names. No I/O. See
// service-architecture.md#providers-have-no-domain-types-in-signatures — domain
// translation belongs in a provider lib/, keeping client.ts a leaf.

/** GHL sends literal "null" strings for empty custom fields. */
export function ghlString(value: string | undefined): string | null {
  if (!value || value === 'null') {
    return null
  }
  return value
}

/** Core customer fields the intake service persists (channel-agnostic shape). */
export interface IntakeCore {
  name: string
  phone: string
  email: string | null
  address: string | null
  city: string
  zip: string
  state: string | null
  leadSourceSlug: string
}

export interface NormalizedBinaLead {
  core: IntakeCore
  leadMeta: LeadMeta
  note: string | null
}

export function normalizeBinaLead(payload: BinaContactPayload): NormalizedBinaLead {
  const a = payload.additionalData

  const interestedTradesRaw = (ghlString(a.trades)?.split(',').map(s => s.trim()).filter(Boolean)) ?? []

  const core: IntakeCore = {
    name: `${payload.firstName} ${payload.lastName}`.trim(),
    phone: payload.phone,
    email: ghlString(payload.email),
    address: ghlString(payload.address),
    city: payload.city,
    zip: payload.zip,
    state: null, // service defaults to 'CA' when null
    leadSourceSlug: 'bina',
  }

  const leadMeta: LeadMeta = {
    interestedTradesRaw,
    scheduledFor: ghlString(a.selfBookingDateTime) ?? undefined,
    source: {
      kind: 'bina',
      budgetSolution: ghlString(a.budgetSolution),
      rebateAmount: ghlString(a.rebateAmount),
      bathroomAge: ghlString(a.bathroomAge),
      bathroomSize: ghlString(a.bathroomSize),
      bathroomScope: ghlString(a.bathroomScope),
      kitchenAge: ghlString(a.kitchenAge),
      kitchenSize: ghlString(a.kitchenSize),
      kitchenScope: ghlString(a.kitchenScope),
    },
  }

  return { core, leadMeta, note: formatBinaNote(payload) }
}

/** Human-readable summary of the master payload, stored as a customer note. */
export function formatBinaNote(payload: BinaContactPayload): string | null {
  const a = payload.additionalData
  const lines: string[] = ['📋 Lead from Bina (GoHighLevel)']

  const push = (label: string, value: string | null) => {
    if (value) {
      lines.push(`${label}: ${value}`)
    }
  }

  push('Budget Solution', ghlString(a.budgetSolution))
  const rebate = ghlString(a.rebateAmount)
  if (rebate) {
    lines.push(`Rebate Amount: $${rebate}`)
  }
  push('Trades', ghlString(a.trades))
  push('Self-booking', ghlString(a.selfBookingDateTime))
  push('Bathroom (age/size/scope)', [ghlString(a.bathroomAge), ghlString(a.bathroomSize), ghlString(a.bathroomScope)].filter(Boolean).join(' · ') || null)
  push('Kitchen (age/size/scope)', [ghlString(a.kitchenAge), ghlString(a.kitchenSize), ghlString(a.kitchenScope)].filter(Boolean).join(' · ') || null)

  return lines.length > 1 ? lines.join('\n') : null
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts
git commit -m "feat(gohighlevel): add normalizeBinaLead translator (payload -> {core, leadMeta, note})"
```

---

## Task 5: Add `getLeadSourceBySlug` DAL read

**Files:**
- Modify: `src/shared/entities/lead-sources/dal/server/queries.ts`

- [ ] **Step 1: Confirm the existing exports + table import**

Run: `sed -n '1,40p' src/shared/entities/lead-sources/dal/server/queries.ts`
Note the import of the lead-sources table, `dalDbOperation`, `DalReturn`, and the existing `getLeadSourceById` shape — match its style exactly.

- [ ] **Step 2: Append `getLeadSourceBySlug`**

Add (matching the file's existing imports — `eq` from `drizzle-orm`, the table import, `dalDbOperation`, `DalReturn`, the row type):

```ts
/** Resolve a lead source by slug. SYSTEM-level read — used by intake ingestion. */
export async function getLeadSourceBySlug(
  slug: string,
): Promise<DalReturn<{ id: string } | null>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ id: leadSourcesTable.id })
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, slug))
      .limit(1)
    return row ?? null
  })
}
```

> Adjust `leadSourcesTable` / `db` import names to whatever the file already uses. If the file already imports `eq`, don't duplicate it (perfectionist/import lint).

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/lead-sources/dal/server/queries.ts
git commit -m "feat(lead-sources): add getLeadSourceBySlug DAL read"
```

---

## Task 6: Add `addCustomerNote` DAL mutation

**Files:**
- Create: `src/shared/entities/customers/dal/server/mutations.ts`

- [ ] **Step 1: Write the mutation**

```ts
// Customer business mutations that don't fit generic CRUD. Services call these;
// never reach for db.insert/update from a service layer.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { customerNotes } from '@/shared/db/schema/customer-notes'

/**
 * Append a note to a customer. `authorId` null = system/webhook-originated note.
 * Replaces the two inline `db.insert(customerNotes)` copies (Bina route +
 * createFromIntake) — both now flow through the intake service.
 */
export async function addCustomerNote(
  input: { customerId: string, content: string, authorId?: string | null },
): Promise<DalReturn<{ id: string }>> {
  return dalDbOperation(async () => {
    const [note] = await db
      .insert(customerNotes)
      .values({
        customerId: input.customerId,
        content: input.content,
        authorId: input.authorId ?? null,
      })
      .returning({ id: customerNotes.id })
    return note!
  })
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/customers/dal/server/mutations.ts
git commit -m "feat(customers): add addCustomerNote DAL mutation"
```

---

## Task 7: Create `customerIntakeService`

**Files:**
- Create: `src/shared/services/customer-intake.service.ts`

- [ ] **Step 1: Write the service**

```ts
import type { IntakeCore } from '@/shared/services/providers/gohighlevel/lib/normalize-bina-lead'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Customer } from '@/shared/db/schema/customers'
import type { LeadMeta } from '@/shared/entities/customers/schemas'

import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { addCustomerNote } from '@/shared/entities/customers/dal/server/mutations'
import { getLeadSourceBySlug } from '@/shared/entities/lead-sources/dal/server/queries'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'

// ---------------------------------------------------------------------------
// customerIntakeService — channel-agnostic lead ingestion (DRY across the Bina
// webhook + the public intake form). PURE ORCHESTRATION: zero raw db.*, zero
// provider parsing. Composes customerCrud.create (canonical entity create) +
// addCustomerNote + meetingCrud.create.
//
// Standardizes both channels on customerCrud.create (the legacy
// createCustomerFromWebhook is retired — see queries.ts migration note).
//
// see docs/codebase-conventions/service-architecture.md
// ---------------------------------------------------------------------------

interface IngestLeadInput {
  core: IntakeCore
  leadMeta?: LeadMeta
  note?: string | null
  // When present, create a Meeting owned by `ownerId` using
  // leadMeta.scheduledFor. Caller resolves the owner (session / fallback).
  meeting?: { ownerId: string } | null
}

function createCustomerIntakeService() {
  return {
    async ingestLead(
      ctx: ScopedContext,
      input: IngestLeadInput,
    ): Promise<DalReturn<{ customer: Customer, meetingId: string | null }>> {
      // ── Resolve lead source slug → id ──────────────────────────────────────
      const sourceResult = await getLeadSourceBySlug(input.core.leadSourceSlug)
      if (!sourceResult.success) {
        return sourceResult
      }
      if (!sourceResult.data) {
        return dalError({ type: 'not-found' })
      }
      const leadSourceId = sourceResult.data.id

      // ── 1. Create customer (canonical DAL; fires create hooks if defined) ───
      const created = await customerCrud.create(ctx, {
        name: input.core.name,
        phone: input.core.phone,
        email: input.core.email ?? null,
        address: input.core.address ?? null,
        city: input.core.city,
        state: input.core.state ?? 'CA',
        zip: input.core.zip || '',
        leadSourceId,
        leadMetaJSON: input.leadMeta ?? null,
      })
      if (!created.success) {
        return created
      }
      const customer = created.data

      // ── 2. Optional note (best-effort — never rolls back the customer) ──────
      if (input.note) {
        const noteResult = await addCustomerNote({
          customerId: customer.id,
          content: input.note,
          authorId: null,
        })
        if (!noteResult.success) {
          console.error('[customerIntake] note insert failed (customer kept)', noteResult.error)
        }
      }

      // ── 3. Optional meeting ────────────────────────────────────────────────
      let meetingId: string | null = null
      if (input.meeting) {
        const scheduledFor = input.leadMeta?.scheduledFor
        if (!scheduledFor) {
          return dalError({ type: 'precondition-failed', reason: 'missing_scheduled_for' })
        }
        const meetingResult = await meetingCrud.create(ctx, {
          ownerId: input.meeting.ownerId,
          customerId: customer.id,
          meetingType: 'Fresh',
          scheduledFor,
        })
        if (!meetingResult.success) {
          // Customer + note already committed; surface so the caller can message.
          return dalError({ type: 'precondition-failed', reason: 'meeting_create_failed' })
        }
        meetingId = meetingResult.data.id
      }

      return dalSuccess({ customer, meetingId })
    },
  }
}

export const customerIntakeService = createCustomerIntakeService()
```

> Verified against `src/shared/dal/server/types.ts`: `DalError` includes `{ type: 'not-found' }` and `{ type: 'precondition-failed', reason: string }` (`reason` is a free string), so the two `dalError(...)` calls above compile as written.

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/customer-intake.service.ts
git commit -m "feat(services): add channel-agnostic customerIntakeService.ingestLead"
```

---

## Task 8: Route the Bina audit-log write through a service

**Files:**
- Create: `src/shared/dal/server/webhook-logs.ts`
- Modify: `src/shared/services/webhook.service.ts`

- [ ] **Step 1: Write the DAL mutation**

```ts
// src/shared/dal/server/webhook-logs.ts
import type { DalReturn } from '@/shared/dal/server/types'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { binaWebhookLogs } from '@/shared/db/schema'

export async function insertBinaWebhookLog(input: {
  ghlEventType: string
  ghlResourceId: string | null
  payload: Record<string, unknown>
}): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db.insert(binaWebhookLogs).values({
      ghlEventType: input.ghlEventType,
      ghlLocationId: null,
      ghlResourceId: input.ghlResourceId,
      payload: input.payload,
      matchedTrades: null, // fuzzy-match dropped (raw-first trades)
      processedAt: null,
    })
  })
}
```

> Confirm the `binaWebhookLogs` column names against `src/shared/db/schema` — match the existing insert in the current route (`ghlEventType`, `ghlLocationId`, `ghlResourceId`, `payload`, `matchedTrades`, `processedAt`). `matchedTrades` is now always null since the webhook-time fuzzy match is removed.

- [ ] **Step 2: Replace `webhook.service.ts` with a real `logBinaInbound`**

```ts
import { insertBinaWebhookLog } from '@/shared/dal/server/webhook-logs'

/** Incoming-webhook audit + (future) routing. */
function createWebhookService() {
  return {
    /** Persist a Bina inbound webhook for audit/replay. Best-effort caller-side. */
    logBinaInbound: async (input: {
      ghlEventType: string
      ghlResourceId: string | null
      payload: Record<string, unknown>
    }): Promise<void> => {
      const result = await insertBinaWebhookLog(input)
      if (!result.success) {
        console.error('[webhook] failed to persist bina webhook log', result.error)
      }
    },
  }
}

export type WebhookService = ReturnType<typeof createWebhookService>
export const webhookService = createWebhookService()
```

> This removes the unimplemented `verifyAndRoute` stub (nothing calls it — confirm with `rg "verifyAndRoute" src` → zero matches before deleting).

- [ ] **Step 3: Verify nothing referenced the old stub**

Run: `rg "verifyAndRoute" src`
Expected: no matches.

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/dal/server/webhook-logs.ts src/shared/services/webhook.service.ts
git commit -m "feat(webhook): persist Bina inbound logs via service+DAL (no raw db in route)"
```

---

## Task 9: Rewrite the Bina webhook route as a thin orchestrator

**Files:**
- Modify: `src/app/api/webhooks/bina/route.ts` (full rewrite)

- [ ] **Step 1: Replace the file entirely**

```ts
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { normalizeBinaLead } from '@/shared/services/providers/gohighlevel/lib/normalize-bina-lead'
import { gohighlevelClient } from '@/shared/services/providers/gohighlevel/client'
import { customerIntakeService } from '@/shared/services/customer-intake.service'
import { webhookService } from '@/shared/services/webhook.service'

/**
 * Bina (GoHighLevel) webhook receiver. Thin orchestrator (webhook-routes.md
 * Rule 2): auth → parse → normalize (provider lib) → ingest (service) → audit
 * (service) → 200. No mapping, no fuzzy-match, no raw db here.
 */
export async function POST(request: Request): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get(gohighlevelClient.authHeaderName)
  if (!gohighlevelClient.verifyWebhookSecret({ authHeader })) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await request.json()
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  const parsed = gohighlevelClient.parseBinaWebhook(raw)
  if (!parsed.ok) {
    return new Response('Invalid payload', { status: 400 })
  }

  // ── Normalize + ingest ────────────────────────────────────────────────────
  const { core, leadMeta, note } = normalizeBinaLead(parsed.payload)
  const result = await customerIntakeService.ingestLead(SYSTEM_CONTEXT, {
    core,
    leadMeta,
    note,
    meeting: null, // Bina never auto-creates a meeting (D9); scheduledFor is for human pre-fill
  })

  if (!result.success) {
    console.error('[bina webhook] ingest failed', result.error)
  }
  else {
    // eslint-disable-next-line no-console
    console.log('[bina webhook] created customer', { id: result.data.customer.id, name: result.data.customer.name })
  }

  // ── Audit (always, even on ingest failure — captures the raw payload) ───────
  await webhookService.logBinaInbound({
    ghlEventType: 'ContactCreate',
    ghlResourceId: parsed.payload.email || parsed.payload.phone,
    payload: raw as Record<string, unknown>,
  })

  return new Response('OK', { status: 200 })
}
```

- [ ] **Step 2: Verify the old imports are gone**

Run: `rg "findBestMatch|constructionDataService|createCustomerFromWebhook|customerNotes|binaWebhookLogs" src/app/api/webhooks/bina/route.ts`
Expected: no matches.

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual verification (dev, tunnel up)**

Start tunnel + dev (`pnpm dev:mobile` or separate `pnpm tunnel`). POST a Bina master payload to `https://destined-emu-bold.ngrok-free.app/api/webhooks/bina` with the bearer token. Confirm in the dev DB:
- A customer row created with `lead_source` = bina, `address` populated, `lead_meta_json.interestedTradesRaw` = split trade strings, `lead_meta_json.source.kind` = `'bina'` with the campaign fields.
- A `customer_notes` row with the formatted summary.
- A `bina_webhook_logs` row (`matched_trades` null).
- **No** meeting row.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/bina/route.ts
git commit -m "refactor(bina): thin webhook route — normalize via provider lib + ingest via service"
```

---

## Task 10: Retire legacy `createCustomerFromWebhook`

**Files:**
- Modify: `src/shared/entities/customers/dal/server/queries.ts:237-273`

- [ ] **Step 1: Confirm no remaining callers**

Run: `rg "createCustomerFromWebhook" src`
Expected: only the definition in `queries.ts` (the Bina route no longer imports it after Task 9). If any other caller exists, STOP and migrate it through `customerIntakeService.ingestLead` first.

- [ ] **Step 2: Delete `WebhookCustomerData` interface + `createCustomerFromWebhook`**

Remove lines 237-273 (the `WebhookCustomerData` interface and the `createCustomerFromWebhook` function). Leave the rest of the file untouched.

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/dal/server/queries.ts
git commit -m "refactor(customers): retire legacy createCustomerFromWebhook (intake service owns ingestion)"
```

---

## Task 11: Route `createFromIntake` through the service + resolve trade names

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts:147-283`

- [ ] **Step 1: Add the construction-data import**

At the top, add (respecting perfectionist import sort):

```ts
import { customerIntakeService } from '@/shared/services/customer-intake.service'
import { constructionDataService } from '@/shared/services/construction-data.service'
```

- [ ] **Step 2: Replace the `createFromIntake` mutation body**

Replace the mutation (lines 147-283) with the version below. The router KEEPS: rate-limit, zod input, the `customer_and_meeting` `scheduledFor` guard, owner resolution (session / info@ fallback). It DELEGATES customer+note+meeting creation to the service and resolves picked tradeIds → names for `interestedTradesRaw`.

```ts
    // Public intake form submission — creates customer + optional note (+ meeting)
    createFromIntake: entity.publicProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        address: z.string().optional(),
        city: z.string().min(1),
        state: z.string().length(2).optional(),
        zip: z.string().min(1),
        email: z.string().optional(),
        notes: z.string().optional(),
        mode: z.enum(intakeModes),
        leadSourceSlug: z.string().optional(),
        leadMetaJSON: leadMetaSchema.optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { notes, mode, leadSourceSlug, ...customerData } = input

        // Rate limit by IP
        const ip = (ctx as { req?: Request }).req?.headers.get('x-forwarded-for') ?? 'anonymous'
        const { success } = await intakeRatelimit.limit(ip)
        if (!success) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
        }

        if (mode === 'customer_and_meeting' && !customerData.leadMetaJSON?.scheduledFor) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'A meeting must have a scheduled date.' })
        }

        const session = (ctx as { session?: { user: { id: string } } }).session ?? null

        // Resolve picked app-trade ids → human-readable NAMES for the envelope
        // (D10). Exact lookup (the human picked real app trades), not fuzzy.
        const pickedTradeIds = customerData.leadMetaJSON?.requestedTrades?.map(t => t.tradeId) ?? []
        let interestedTradesRaw: string[] | undefined
        if (pickedTradeIds.length > 0) {
          const allTrades = await constructionDataService.getTrades()
          const nameById = new Map(allTrades.map(t => [t.id, t.name]))
          interestedTradesRaw = pickedTradeIds.map(id => nameById.get(id)).filter((n): n is string => Boolean(n))
        }

        const leadMeta = customerData.leadMetaJSON
          ? { ...customerData.leadMetaJSON, ...(interestedTradesRaw ? { interestedTradesRaw } : {}) }
          : (interestedTradesRaw ? { interestedTradesRaw } : undefined)

        // Resolve meeting owner (session, else info@ fallback) — business rule
        // with session context stays in the router.
        let meeting: { ownerId: string } | null = null
        if (mode === 'customer_and_meeting') {
          let ownerId = session?.user.id
          if (!ownerId) {
            const [fallbackUser] = await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.email, 'info@triprosremodeling.com'))
              .limit(1)
            if (!fallbackUser) {
              throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Fallback meeting owner not found. Contact an administrator.' })
            }
            ownerId = fallbackUser.id
          }
          meeting = { ownerId: ownerId! }
        }

        const result = await customerIntakeService.ingestLead(SYSTEM_CONTEXT, {
          core: {
            name: customerData.name,
            phone: customerData.phone,
            email: customerData.email ?? null,
            address: customerData.address ?? null,
            city: customerData.city,
            state: customerData.state ?? null,
            zip: customerData.zip,
            leadSourceSlug: leadSourceSlug ?? 'manual',
          },
          leadMeta,
          note: notes ?? null,
          meeting,
        })

        if (!result.success) {
          // Map service failures to user-facing messages.
          if (result.error.type === 'not-found') {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Lead source "${leadSourceSlug ?? 'manual'}" not found. Contact an administrator.` })
          }
          console.error('[createFromIntake] ingest failed:', result.error)
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Customer could not be saved (or the meeting could not be scheduled). Add it manually from the customer profile.' })
        }

        return { customerId: result.data.customer.id, meetingId: result.data.meetingId }
      }),
```

- [ ] **Step 3: Remove now-unused imports**

After the rewrite, `customerCrud`, `customerNotes`, `meetingCrud`, `dalVerifySuccess`, and `leadSourcesTable` may be unused in this file (the `list`/`search` procedures still use `customers`, `leadSourcesTable`, db helpers — check each). Run `pnpm lint` and remove only the genuinely-unused ones it flags. **Do NOT** remove imports still used by `list`/`search`/`addNote`.

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Manual verification (dev)**

Submit the in-app intake form in both modes:
- `customer_only`: customer created; `lead_meta_json.interestedTradesRaw` = picked trade NAMES; `requestedTrades` ids retained; no meeting.
- `customer_and_meeting`: same + a meeting row created with the scheduled time.

- [ ] **Step 6: Commit**

```bash
git add src/trpc/routers/customers.router/business.router.ts
git commit -m "refactor(intake): route createFromIntake through customerIntakeService + resolve trade names"
```

---

## Task 12: Derive CT attributes from `interestedTradesRaw`

**Files:**
- Modify: `src/shared/services/voip/campaigns/lib/build-contact-attributes.ts`
- Modify: `src/shared/services/voip/campaigns/enrollment.service.ts:146-152`

- [ ] **Step 1: Rewrite `build-contact-attributes.ts`**

Replace the file's header comment (delete the `@migration` block) and the input/derivation:

```ts
// Pure mapping (EPIC decision #13 + #16): build the CloudTalk custom-attribute
// write list for a customer + a stable hash for delta-push skipping. No I/O.
// Composed by the enrollment service, which supplies the app_key → ct_attribute_id
// bridge (synced into voip_contact_attributes).
//
// Built-in `name` + `city` go to CT's first-class Contact fields via
// upsertContact — NOT through this list. This builds the 3 custom attributes:
//   - lead_source       : the source slug (drives CT segmentation/templating)
//   - primary_trade     : the lead's first interested trade (human-readable)
//   - trades_interested : alpha-sorted, deduped interested trades (human-readable)
//
// Values come from leadMetaJSON.interestedTradesRaw — already human-readable for
// every source (Bina: raw campaign trade strings; in-app form: resolved trade
// names). No ID→label lookup needed.

import type { CloudtalkContactAttributeAppKey } from '@/shared/services/providers/cloudtalk/constants'

import { createHash } from 'node:crypto'

export interface ContactAttributeWrite {
  attributeId: string
  value: string
}

interface BuildContactAttributesInput {
  leadSourceSlug: string
  interestedTradesRaw?: string[]
  // Built-in fields — not written as custom attributes, but folded into the
  // hash so a name/city change still invalidates the delta-skip.
  name: string
  city: string
  attributeIdByKey: Partial<Record<CloudtalkContactAttributeAppKey, string>>
}

export interface BuiltContactAttributes {
  attributes: ContactAttributeWrite[]
  attributeHash: string
}

export function buildContactAttributes(
  input: BuildContactAttributesInput,
): BuiltContactAttributes {
  const trades = (input.interestedTradesRaw ?? []).map(t => t.trim()).filter(Boolean)
  const sortedTrades = [...new Set(trades)].sort()

  const valueByKey: Record<CloudtalkContactAttributeAppKey, string> = {
    lead_source: input.leadSourceSlug,
    primary_trade: trades[0] ?? '',
    trades_interested: sortedTrades.join(', '),
  }

  const attributes: ContactAttributeWrite[] = []
  for (const [key, value] of Object.entries(valueByKey) as [CloudtalkContactAttributeAppKey, string][]) {
    const attributeId = input.attributeIdByKey[key]
    if (attributeId) {
      attributes.push({ attributeId, value })
    }
  }

  const hashSource = JSON.stringify({ name: input.name, city: input.city, values: valueByKey })
  const attributeHash = createHash('sha1').update(hashSource).digest('hex')

  return { attributes, attributeHash }
}
```

- [ ] **Step 2: Update the call site in `enrollment.service.ts`**

Replace lines 146-152 (`buildContactAttributes({ ... })`):

```ts
      const { attributes, attributeHash } = buildContactAttributes({
        leadSourceSlug: leadSource.slug,
        interestedTradesRaw: customer.leadMetaJSON?.interestedTradesRaw,
        name: customer.name,
        city: customer.city,
        attributeIdByKey,
      })
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual verification (dev, tunnel up)**

Enroll a Bina lead and an in-app lead. In the CloudTalk dashboard, confirm `Primary Trade` and `Trades Interested` show **human-readable** names (not UUIDs, not empty).

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/voip/campaigns/lib/build-contact-attributes.ts src/shared/services/voip/campaigns/enrollment.service.ts
git commit -m "fix(voip-campaigns): derive CT trade attributes from interestedTradesRaw (closes raw-UUID bug)"
```

---

# PART B — Per-contact unenroll + re-enroll (fixes prod-blocker #2)

## Task 13: Add the `removed` unenroll reason

**Files:**
- Modify: `src/shared/constants/enums/voip.ts:56-64`

- [ ] **Step 1: Update the comment + enum**

Replace lines 56-64:

```ts
// WHY a contact left a campaign — recorded on voip_campaign_contacts.unenroll_reason
// when we unenroll. Attribution of OUR action (not a CT lifecycle status):
//   - graduated:    meeting booked (positive exit). app meeting-create OR CT meeting_booked.
//   - opted_out:    STOP/opt-out (compliance). Also writes DNC.
//   - disqualified: manual "stop calling / bad lead, no meeting". UI button OR CT
//                   not_interested/wrong_number disposition.
//   - removed:      neutral manual unenroll — pulled from the campaign with the
//                   intent to re-enroll later / into a different campaign. NOT a
//                   bad lead (≠ disqualified), NO DNC (≠ opted_out). Re-enrollable.
// Not a pgEnum (kept lightweight as a typed text column); add a pgEnum only if it grows.
export const voipUnenrollReasons = ['graduated', 'opted_out', 'disqualified', 'removed'] as const
export type VoipUnenrollReason = (typeof voipUnenrollReasons)[number]
```

- [ ] **Step 2: Verify** — Run: `pnpm tsc && pnpm lint` → PASS. (No DB push: `unenroll_reason` is a text column.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/constants/enums/voip.ts
git commit -m "feat(voip-campaigns): add neutral 'removed' unenroll reason"
```

---

## Task 14: Add `removeFromCampaign` router mutation

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts` (after `disqualify`, ~line 129)

- [ ] **Step 1: Add the mutation**

Insert after the `disqualify` mutation:

```ts
  /**
   * Neutral per-contact unenroll — pulls the contact from its campaign with the
   * intent to re-enroll later (reason 'removed', no DNC). Distinct from
   * `disqualify` (bad lead). Re-enroll via the existing `enroll` mutation; the
   * contact returns to the eligible pool. Super-admin only (SYSTEM_CONTEXT).
   */
  removeFromCampaign: superAdminProcedure
    .input(z.object({ customerId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return dalToTrpc(await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
        customerId: input.customerId,
        reason: 'removed',
      }))
    }),
```

- [ ] **Step 2: Verify** — Run: `pnpm tsc && pnpm lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip-campaigns): add removeFromCampaign (neutral per-contact unenroll)"
```

---

## Task 15: Wire `removeFromCampaign` + `enroll` mutation hooks

**Files:**
- Modify: `src/features/campaigns-admin/hooks/use-campaign-mutations.ts`

- [ ] **Step 1: Add two mutations** (after `disqualifyBulk`, before the `return`):

```ts
  const removeFromCampaign = useMutation(
    trpc.voipCampaignsRouter.removeFromCampaign.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Removed from campaign — can be re-enrolled later')
      },
      onError: err => toast.error(err.message || 'Failed to remove from campaign'),
    }),
  )

  const enroll = useMutation(
    trpc.voipCampaignsRouter.enroll.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Enrolled into campaign')
      },
      onError: err => toast.error(err.message || 'Failed to enroll'),
    }),
  )
```

- [ ] **Step 2: Add both to the returned object**

```ts
  return {
    resync,
    bindCampaignToSource,
    setDefaultCampaign,
    enrollAll,
    unenrollAll,
    disqualify,
    disqualifyBulk,
    removeFromCampaign,
    enroll,
  }
```

- [ ] **Step 3: Verify** — Run: `pnpm tsc && pnpm lint` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/campaigns-admin/hooks/use-campaign-mutations.ts
git commit -m "feat(campaigns-admin): add removeFromCampaign + enroll mutation hooks"
```

---

## Task 16: Add Remove + switch-campaign affordances to the enrolled-leads UI

**Files:**
- Modify: `src/features/campaigns-admin/ui/components/enrolled-lead-row.tsx`
- Modify: `src/features/campaigns-admin/ui/components/enrolled-leads-list.tsx`

- [ ] **Step 1: Add a neutral "Remove" action to the row**

In `enrolled-lead-row.tsx`, add an `onRemove` prop and a button. Update the props interface and signature:

```ts
interface EnrolledLeadRowProps {
  lead: EnrolledLead
  selected: boolean
  busy: boolean
  onToggleSelect: (customerId: string, checked: boolean) => void
  onDisqualify: (customerId: string) => void
  onRemove: (customerId: string) => void
}

export function EnrolledLeadRow({ lead, selected, busy, onToggleSelect, onDisqualify, onRemove }: EnrolledLeadRowProps) {
```

Add this button immediately before the existing Disqualify `<Button>`:

```tsx
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        disabled={busy}
        onClick={() => onRemove(lead.customerId)}
      >
        Remove
      </Button>
```

- [ ] **Step 2: Wire it in the list**

In `enrolled-leads-list.tsx`:
- Pull `removeFromCampaign` from the hook: `const { disqualify, disqualifyBulk, removeFromCampaign } = useCampaignMutations()`
- Include it in `busy`: `const busy = disqualify.isPending || disqualifyBulk.isPending || removeFromCampaign.isPending`
- Pass the handler to the row:

```tsx
          <EnrolledLeadRow
            key={lead.customerId}
            lead={lead}
            selected={selected.has(lead.customerId)}
            busy={busy}
            onToggleSelect={toggleSelect}
            onDisqualify={customerId => disqualify.mutate({ customerId })}
            onRemove={customerId => removeFromCampaign.mutate({ customerId })}
          />
```

- [ ] **Step 3: Verify** — Run: `pnpm tsc && pnpm lint` → PASS.

- [ ] **Step 4: Manual verification (dev, tunnel up)**

In the Campaigns Control Center enrolled-leads list: click **Remove** on a lead → toast "Removed from campaign…", row disappears (no longer active), CT membership tag removed. The lead reappears in the source's **eligible** count and can be re-enrolled via Enroll-all / single enroll. In the DB, `voip_campaign_contacts.unenroll_reason` = `'removed'`.

- [ ] **Step 5: Commit**

```bash
git add src/features/campaigns-admin/ui/components/enrolled-lead-row.tsx src/features/campaigns-admin/ui/components/enrolled-leads-list.tsx
git commit -m "feat(campaigns-admin): add neutral Remove action to enrolled-leads list"
```

---

## Final verification

- [ ] `pnpm tsc` — clean
- [ ] `pnpm lint` — clean
- [ ] `git diff main...HEAD --stat` — review for unintended changes / stray console logs
- [ ] Full manual pass per Tasks 9, 11, 12, 16 (Bina ingest, in-app intake both modes, CT human-readable attributes, Remove → re-enroll round-trip)
- [ ] Discriminated-union compile guard: temporarily construct a `source: { kind: 'bina' }` missing a field in a scratch file and confirm `pnpm tsc` errors; `{ kind: 'generic' }` is accepted. Delete the scratch file.

## Prod-push checklist (do NOT do as part of this plan — flag at push time)
- **Backfill:** existing prod customers with `requestedTrades` but no `interestedTradesRaw` enroll with empty trade attributes. If prod has pre-existing enrollable leads, run a one-time script resolving their `requestedTrades` tradeIds → names → set `interestedTradesRaw`. Dev: not needed.
- **Out of scope, tracked separately:** `docs/plans/voip/INTEGRATION-SEAM.md` is stale vs the 2026-06-04 "perfect separation" decision; two stale docstrings in `cloudtalk/client.ts` (`addTags`/`removeTags`). Doc-hygiene PR.
