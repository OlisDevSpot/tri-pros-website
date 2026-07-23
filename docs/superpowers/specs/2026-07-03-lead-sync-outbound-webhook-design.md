# Lead Sync — Outbound Webhook Engine (Design)

**Date:** 2026-07-03
**Status:** Approved in brainstorming (session with Oliver)
**Companions:**
- `docs/adr/0003-service-provider-architecture.md` (four-tier provider/service rules)
- `src/shared/entities/lead-sources/DOCS.md` (source-owned config rules)
- `docs/superpowers/specs/2026-07-03-meta-campaign-engine-design.md` (the funnel leads this syncs are the same Meta-attributed leads)

## Goal

When a lead is captured through our funnels (bathrooms, kitchens, future roofing/…),
push that lead to an external Go High Level (GHL) instance owned by our marketing
agency **Bold Pro Digital**, so they can map it to a lead in their own GHL. Bold Pro —
like Bina before them — runs GHL; this is a *different destination*, not a different
mechanism.

Build this as a **general lead-sync engine** keyed off the **lead source**, not a
funnel-specific one-off: any lead source may later declare an outbound destination and
adopt the same pipeline with zero rewiring. Normalize the outbound payload so **one
contract works across every funnel/trade** without per-trade changes.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Destination binding | Bound to the **lead source** (`lead_sources.leadSyncConfigJSON`), one destination per source. Data-driven; new agency/CRM = config change, not code. |
| 2 | Timing | Sync on **lead create, then re-sync** as enrichment/address arrive. Each send is current full state; GHL upserts. Bold Pro gets every captured lead even if the user abandons later. |
| 3 | Payload shape | **Three-tier canonical contract**: required core → known-optional shared-step keys → generic `enrichment[]`. Funnel/trade-agnostic; unchanged when a new trade launches. |
| 4 | Which leads | **Send all + quality flags** (phone-verification status, ownership). Bold Pro decides what to act on. |
| 5 | Env isolation | **Production-host gate** (`isProductionHost(host(getPublicBaseUrl()))`, not `NODE_ENV`). Dev/preview logs the would-be payload and does not POST. |
| 6 | Trigger seam | **`customerIntakeService` intake methods dispatch `syncLeadJob`**, mirroring the existing `enrollLeadJob` auto-enroll dispatch. No customer server-spec hook changes. Optional `{ sync?: boolean }` suppress flag. |
| 7 | Dispatch mode | Async QStash job, best-effort `dispatch` (not `dispatchOrThrow`) — a sync enqueue hiccup must never fail lead capture. |
| 8 | Auth (v1) | **None** — the GHL inbound webhook URL is itself the capability secret. `auth` field is defined but unused in v1. |
| 9 | Admin surface | Super-admin **dashboard UI** on the lead source settings panel, via a **unified `updateConfig` procedure + reusable `ConfigSectionEditor`**. Which source carries a destination is set in the UI (no seed). |
| 10 | Config-write unification | `updateConfig(id, section, patch)` becomes the **single surface for every typed JSONB config section** — `form`, `voipCampaigns`, `voipInHouse` (reserved), `leadSync`. Retires the ad-hoc `setVoipCampaignsPolicy`/`voipCampaignsRouter.setSourcePolicy` alias and removes `formConfigJSON` from the generic `update`. Keyed by **id** (voip migrates off slug). |
| 11 | Unification boundary | `updateConfig` owns **only** JSONB config sections. Scalar identity/state (`name`/`slug`/`isActive`) stays on a narrowed `update`; lifecycle ops (`create`, `rotateToken`, `archive`, `delete`, `duplicate`) stay dedicated. Runtime VoIP writers: **none exist** (enrollment only reads config). |

## Architecture (units, one job each)

```
customerIntakeService (trigger seam)
  └─ ingestLead / enrichFunnelLead / setFunnelLeadAddress
        └─ void syncLeadJob.dispatch({ customerId, reason })   ← best-effort, next to enrollLeadJob

syncLeadJob (QStash)  { customerId }        ← minimal payload; reconstruct from DB in handler
  └─ leadSyncService.syncLead(SYSTEM_CONTEXT, { customerId })
        1. load Customer (by id)                     → core cols + leadMetaJSON
        2. load its LeadSource (by leadSourceId)     → leadSyncConfigJSON
        3. gate: enabled + webhookUrl present?       → else no-op (the general catchall no-op)
        4. gate: production host?                    → else log "would send" + return
        5. buildLeadPayload(customer)                → CanonicalLeadPayload
        6. dispatch by provider → gohighlevelClient.sendLead({ url }, payload)

gohighlevel provider (leaf)
  └─ sendLead({ url, auth? }, payload)  → fetch POST, throws on non-2xx
```

**Dependency direction** (per ADR-0003): service → provider client (leaf) and → DAL;
provider imports nothing app-aware. The service is a general engine; `customerIntakeService`
is merely its first caller.

**Unit responsibilities:**

| Unit | Responsibility | Location |
|---|---|---|
| `leadSyncService.syncLead` | Orchestrate: load customer + source, gate, build payload, route to provider. Only entry point; extend via its options object, never use-case-named methods. | `src/shared/services/lead-sync/lead-sync.service.ts` |
| `buildLeadPayload` | Pure `Customer → CanonicalLeadPayload`. Trade/channel-agnostic. | `src/shared/services/lead-sync/lib/build-lead-payload.ts` |
| `resolveSyncDestination` | Pure `LeadSource → SyncDestination | null` (enabled + url; resolve `auth.secretEnvKey` from env when present). | `src/shared/services/lead-sync/lib/resolve-sync-destination.ts` |
| `gohighlevelClient.sendLead` | Outbound HTTP POST (extends the existing inbound-only GHL provider). | `src/shared/services/providers/gohighlevel/client.ts` |
| `to-ghl-payload` | Thin wire-shaping seam (near-identity v1; POST canonical object, Bold Pro maps on their side). | `src/shared/services/providers/gohighlevel/lib/to-ghl-payload.ts` |
| `syncLeadJob` | QStash job factory registration. | `src/shared/services/providers/upstash/jobs/sync-lead.ts` |

> Placement note: `services/lead-sync/` mirrors the `services/providers/<name>/` subfolder
> precedent (service file + co-located `lib/`). The implementer should confirm against the
> nearest existing service-with-helpers and follow it.

## Data model

### (a) Config home — `lead_sources.leadSyncConfigJSON`

Follows the **one-JSONB-column-per-concern** convention already used by `formConfigJSON`
and `voipConfigJSON`. **Not** a nested key inside `voipConfigJSON` (that is calling
policy), **not** a consolidated `integrationsConfigJSON` (YAGNI — one integration today).

```ts
// src/shared/db/schema/lead-sources.ts
leadSyncConfigJSON: jsonb('lead_sync_config_json').$type<LeadSyncConfig>(),   // nullable, like voipConfigJSON
```

```ts
// src/shared/entities/lead-sources/schemas.ts
export const leadSyncConfigSchema = z.object({
  enabled:    z.boolean().default(false),
  provider:   z.enum(['gohighlevel']).default('gohighlevel'),
  webhookUrl: z.string().url().optional(),          // required-when-enabled — enforced in service, not schema
  auth:       z.object({ headerName: z.string(), secretEnvKey: z.string() }).optional(), // defined, unused in v1
})
export type LeadSyncConfig = z.infer<typeof leadSyncConfigSchema>
```

**Write path — dedicated patch-merge mutation** (the `setVoipCampaignsPolicy` idiom:
read whole column → merge in TS → write whole column back). This writes the *entire*
column atomically, so it is **immune to the app's shallow-merge JSONB hazard**
(`create-crud-dal.ts` PG `||`), and has **no dependency on the unshipped deep-merge
project**:

```ts
// src/shared/entities/lead-sources/dal/server/mutations.ts
export async function setLeadSyncConfig(sourceId: string, patch: Partial<LeadSyncConfig>): DalReturn<…>
```

**Read path** is already free: `getLeadSourceBySlug`/`getLeadSourceById` (the former is
already called by `ingestLead`) returns the whole row incl. the new column.

**DOCS:** add an `outbound-sync-policy-lives-on-the-source` rule to
`src/shared/entities/lead-sources/DOCS.md`, mirroring the existing voip-policy rule.

### (b) Canonical payload — three-tier contract

Built **purely from the persisted Customer** (core columns + `leadMetaJSON`). The sync
layer never reads funnel client state — whatever the funnel normalized into
`leadMetaJSON.source.enrichment` at ingest is the source of truth.

```ts
CanonicalLeadPayload {
  // Tier 1 — required core (always present)
  fullName, phone, zip, city,

  // Tier 2 — known-optional; stable keys anchored to the SHARED funnel steps + core extras
  email?, state?, county?, address?, homeType?, timeline?,

  // Tier 3 — generic; variable per trade
  enrichment: [{ key, label, value, order }],

  // signals (decision #4 — send all + flags)
  quality: { ownership?, phoneVerification?: { status, lineType, carrierName } },

  // attribution
  source: { leadSourceSlug, funnelSlug?, trade?, offer?, utm?, meta?: { fbp, fbc }, consent? },

  // identity for upsert / idempotency
  externalId: customerId,
  occurredAt,
}
```

**Tier 2 mapping rule:** `buildLeadPayload` holds a `KNOWN_LEAD_FIELDS` set of shared-step
keys (`homeType`, `timeline`, …, aligned with `domains/funnels/lib/steps/`). Enrichment
entries whose key is in that set are **promoted to Tier-2 top-level**; every remaining
`leadMetaJSON.source.enrichment` entry falls through into **Tier-3 `enrichment[]`**.
Core geo/contact (`fullName`,`phone`,`city`,`state`,`zip`,`email`,`address`) come from the
Customer columns. Result: adding a *shared* step extends Tier 2; adding a *trade-specific*
step just appears in Tier 3 — **zero contract change either way.**

## Trigger & runtime flow

**Seam — `customerIntakeService`** (the single shared ingest chokepoint; funnel `submitLead`
**and** the Bina API route both route through `ingestLead`, so a service-level seam covers
both — a tRPC-procedure-level option would miss Bina):

```
ingestLead(…, opts?: { sync?: boolean })     → void syncLeadJob.dispatch({ customerId, reason: 'created' })
enrichFunnelLead(…)                          → void syncLeadJob.dispatch({ customerId, reason: 'enriched' })
setFunnelLeadAddress(…)                       → void syncLeadJob.dispatch({ customerId, reason: 'address'  })
```

- Placed next to the existing `enrollLeadJob` dispatch — same "policy lives on the source →
  dispatch a job" pattern. `enrichFunnelLead` is covered here even though its DAL mutation
  (`mergeFunnelEnrichment`) deliberately bypasses customer CRUD hooks — the dispatch lives in
  the **service method**, not the raw DAL mutation ("services orchestrate, DAL implements").
- `reason` is for logging only; every send rebuilds current full state, so the three triggers
  are not behaviorally different — they progressively re-assert the latest state.
- `sync: false` is an escape hatch (e.g. a bulk backfill import) — default on, real gate is
  the source config.
- Typical bathroom lead → 3 sends (create=core, enriched=+dimensions, address=full), each an
  idempotent GHL upsert on the same contact.

**Env isolation:** the send is gated on `isProductionHost(host(getPublicBaseUrl()))` (reusing
the host allow-list in `config/roots.ts`). In dev/preview `getPublicBaseUrl()` resolves to the
ngrok/vercel-preview host → gate closes → **log the would-be payload, do not POST**. Server-side
analogue of the shipped funnel-pixel isolation (host-based, deliberately not `NODE_ENV`).

**Idempotency:** no dedup bookkeeping. Every send carries `externalId: customerId` and current
full state; GHL upserts on phone/email; redundant re-sends are harmless (last-write-wins), which
also makes QStash retries safe. (Content-hash "skip if unchanged" is a noted future optimization;
lead volume is low.)

**Errors:** provider throws on non-2xx → job throws → QStash retries w/ backoff → dead-letters
after max attempts (logged loudly). Configured-but-broken destination (e.g. missing future
`secretEnvKey`) logs a prod error and skips, mirroring `meta-sync`'s "configured but dropped".

## Provider — GHL outbound (extend existing leaf)

The `gohighlevel` provider is currently inbound-only (`parseBinaWebhook`, `verifyWebhookSecret`).
Add an outbound method; keep it a pure leaf:

```ts
// src/shared/services/providers/gohighlevel/client.ts
async sendLead(dest: { url: string; auth?: { headerName: string; secret: string } }, payload: unknown): Promise<void> {
  const res = await fetch(dest.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(dest.auth ? { [dest.auth.headerName]: dest.auth.secret } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`[ghl] lead sync POST failed ${res.status}: ${await res.text().catch(() => '')}`)
}
```

The service passes the resolved destination + the canonical payload (shaped by the near-identity
`to-ghl-payload` seam). v1 POSTs the canonical object as-is; Bold Pro maps fields inside their GHL
workflow. Flattening/renaming, if Bold Pro requests it, is a change isolated to `to-ghl-payload`.

## Config-write unification + admin UI

### The unification (why this is a prerequisite, not scope creep)

Audit of every lead-source config write today found **three divergent, similarly-natured paths**:
`formConfigJSON` via the generic `leadSourcesRouter.update`; `voipConfigJSON.campaigns` via a
*separate* hand-rolled read-modify-write (`setVoipCampaignsPolicy`, exposed as
`voipCampaignsRouter.setSourcePolicy`, keyed by **slug**, called only from the campaigns-admin
`source-policy-card`); and — if added naively — `leadSyncConfigJSON` would be a fourth. Shipping
lead-sync next to those would entrench the divergence. So we **unify first**.

**`updateConfig` is the single surface for every typed JSONB config section**, keyed by id:

```ts
// src/trpc/routers/lead-sources.router.ts
updateConfig: superAdminProcedure.input(z.discriminatedUnion('section', [
  z.object({ id: z.string().uuid(), section: z.literal('form'),          patch: leadSourceFormConfigSchema.partial() }),
  z.object({ id: z.string().uuid(), section: z.literal('voipCampaigns'), patch: voipCampaignsPolicySchema.partial() }),
  z.object({ id: z.string().uuid(), section: z.literal('voipInHouse'),   patch: voipInHousePolicySchema.partial() }),   // reserved — no writer today
  z.object({ id: z.string().uuid(), section: z.literal('leadSync'),      patch: leadSyncConfigSchema.partial() }),
])).mutation(/* dispatch by section → the matching per-section DAL mutation */)
```

**Mechanism — per-section read-modify-write DAL, *not* the generic `jsonbMergeColumns` merge.**
The generic CRUD merge is the shallow PG `||` (deep-merge unshipped); a shallow merge on
`{ campaigns: partialPatch }` would replace the *whole* `campaigns` sub-object and drop unpatched
fields. Each section instead routes to a dedicated RMW mutation that merges at the correct depth,
is safe **today**, and needs no deep-merge dependency. One uniform section-registry is also more
unified than mixing CRUD-merge (flat sections) + bespoke (nested sections).

```
updateConfig(id, section, patch) → dispatch:
  form          → setFormConfig(id, patch)              // flat whole-column write
  voipCampaigns → setVoipCampaignsPolicy(id, patch)     // EXISTING logic, migrated slug→id
  voipInHouse   → setVoipInHousePolicy(id, patch)       // reserved; no caller yet
  leadSync      → setLeadSyncConfig(id, patch)           // new, flat
```

**Unification boundary (decisions #10–#11):**

| Fold INTO `updateConfig` (JSONB config sections) | Stays SEPARATE (different nature) |
|---|---|
| `form` (from `update`'s `formConfigJSON`) | `create` (entity init) |
| `voipCampaigns` (retire `setVoipCampaignsPolicy`/`setSourcePolicy`) | `update` narrowed → `name`/`slug`/`isActive` (scalar + slug→token side-effect) |
| `voipInHouse` (reserved) | `rotateToken`, `archive`, `delete`, `duplicate` (lifecycle) |
| `leadSync` (new) | enrollment service + VoIP jobs (**read-only**; never write config) |

**Migration required by folding voip in:** change `setVoipCampaignsPolicy` key slug→id; retire
`voipCampaignsRouter.setSourcePolicy`; repoint the campaigns-admin `source-policy-card` (and its
`useCampaignMutations().setSourcePolicy` hook) to `leadSourcesRouter.updateConfig(id,'voipCampaigns',patch)`;
remove `formConfigJSON` from the generic `update` input.

### Admin UI

**Current panel** (`src/features/lead-sources-admin/`) composes `IdentityEditor` +
`FormConfigEditor` + `DangerZone` — each a plain-`useState` draft + `JSON.stringify` dirty-check +
Save/Revert row, validated server-side only.

1. **One component — `ConfigSectionEditor`** — owns the draft/dirty/save/revert/toast/invalidate
   boilerplate all section editors duplicate; each concrete section renders its fields via a
   render-prop child, and all call `updateConfig`. Refactor `FormConfigEditor` onto it; build the
   new lead-sync editor on it.
2. **New "Outbound lead sync" editor** (super-admin only, matching the page guard): an **Enabled**
   toggle + a **Webhook URL** field. Provider fixed to GoHighLevel (read-only). Whole v1 UI — no
   auth, one URL.
3. **`source-policy-card`** (campaigns-admin) is repointed to `updateConfig` as part of the voip
   migration — so both the lead-sources panel and the campaigns setup tab now write config through
   the one procedure.

Read path unchanged (`leadSourcesRouter.getById` returns the whole row incl. the new column).
Invalidation unchanged (`invalidateLeadSource()` is router-level).

> Not generalized cross-entity: customers/proposals already use the generic `jsonbMergeColumns`
> mechanism for their profile JSONB. A future shared "config-section patcher" could unify both
> families, but that's out of scope here — `updateConfig` stays lead-source-local.

## Testing

- **`buildLeadPayload`** (unit, highest-value): required core always present; shared-step keys
  promoted to Tier 2; remaining enrichment → Tier 3; quality flags mapped. Cases incl. zero-enrichment
  lead and an unknown/future trade (must pass through Tier 3 untouched).
- **`resolveSyncDestination`** (unit): disabled → null; enabled-without-url → null; future
  missing-`secretEnvKey` → configured-but-broken (skip + prod-log, don't throw).
- **Env gate** (unit): non-prod host → returns would-send log, no POST.
- **`leadSyncConfigSchema`** round-trip + `setLeadSyncConfig` preserves the whole column.
- **`updateConfig` section routing** (unification): each section validates against its own schema
  and dispatches to the right DAL mutation; unknown section rejected. **Regression guard:** a
  partial `voipCampaigns` patch preserves both the untouched `campaigns` fields **and** the sibling
  `inHouse` sub-object (the exact loss the shallow generic merge would cause). Confirm the migrated
  `source-policy-card` still round-trips voip policy through `updateConfig` unchanged.
- **`gohighlevelClient.sendLead`** (integration, mocked fetch): POST body + optional auth header;
  non-2xx throws.
- **`leadSyncService.syncLead`** (service): no-config → no-op; happy path calls provider once;
  retry-safe (always current state).
- **Dev-verification reality:** because of the production-host gate, dev/preview never POSTs —
  end-to-end is verified by asserting the suppressed-send **log line**, then confirmed for real in
  prod once Bold Pro's URL is live (mirrors the codebase's "verify in the real environment" rule,
  e.g. Meta test-events).

## Out of scope / future (tracked, not built now)

- **Multi-destination per source.** v1 is a single destination object — acknowledged as "not ideal
  but fine for now." Extension is a trivial object→array change to `leadSyncConfigSchema` +
  `resolveSyncDestination` (→ `resolveSyncDestinations`) + a loop in the service.
- **Auth on the destination.** `auth` field is defined but unused; wire `headerName`/`secretEnvKey`
  (secret resolved from **env**, not DB) when a destination requires it.
- **`voipInHouse` writer** — the `voipInHouse` section is reserved in `updateConfig` but has no
  writer/UI yet (schema forward-declared); wire it when the voip-in-house EPIC needs source policy.
- **Cross-entity config-section patcher** — customers/proposals use the generic `jsonbMergeColumns`
  merge; a future shared abstraction could unify both families with lead-sources' section registry.
- **Content-hash "skip if unchanged"** dedup guard, if send volume ever warrants it.
- **Adopt for other lead sources** (Bina, manual, VoIP) — the engine already supports it; just
  configure a destination on the source. No code change.

## File-touch map

**New:**
- `src/shared/services/lead-sync/lead-sync.service.ts`
- `src/shared/services/lead-sync/lib/build-lead-payload.ts`
- `src/shared/services/lead-sync/lib/resolve-sync-destination.ts`
- `src/shared/services/providers/gohighlevel/lib/to-ghl-payload.ts`
- `src/shared/services/providers/upstash/jobs/sync-lead.ts`
- `src/features/lead-sources-admin/ui/components/config-section-editor.tsx`
- `src/features/lead-sources-admin/ui/components/lead-sync-config-editor.tsx`

**Modified:**
- `src/shared/db/schema/lead-sources.ts` (add column + migration)
- `src/shared/entities/lead-sources/schemas.ts` (add `leadSyncConfigSchema`)
- `src/shared/entities/lead-sources/dal/server/mutations.ts` (add `setLeadSyncConfig`, `setFormConfig`, `setVoipInHousePolicy`; migrate `setVoipCampaignsPolicy` slug→id)
- `src/shared/entities/lead-sources/DOCS.md` (add source-owned outbound-sync rule)
- `src/shared/services/providers/gohighlevel/client.ts` (add `sendLead`)
- `src/shared/services/customer-intake.service.ts` (dispatch `syncLeadJob` in the 3 intake methods)
- `src/trpc/routers/lead-sources.router.ts` (add unified `updateConfig`; remove `formConfigJSON` from `update`)
- `src/trpc/routers/voip-campaigns.router.ts` (retire `setSourcePolicy` — folded into `updateConfig`)
- `src/app/api/qstash-jobs/route.ts` (register `syncLeadJob`)
- `src/features/lead-sources-admin/ui/components/lead-source-settings-panel.tsx` (add the section)
- `src/features/lead-sources-admin/ui/components/form-config-editor.tsx` (refactor onto `ConfigSectionEditor`)
- `src/features/campaigns-admin/ui/components/setup/source-policy-card.tsx` (repoint to `updateConfig`)
- the campaigns-admin mutations hook (`useCampaignMutations().setSourcePolicy` → `updateConfig`)
```
