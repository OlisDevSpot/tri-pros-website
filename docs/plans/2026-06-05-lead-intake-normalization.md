# Lead-intake normalization + leadMeta restructure + per-contact unenroll/re-enroll

**Status:** Design approved (brainstorm 2026-06-05). Ready for implementation plan.
**Motivation:** Two prod-blockers for the voip-campaigns launch:
1. **CT trade attributes are broken** — `primary_trade` / `trades_interested` are stored as raw trade-UUIDs (in-app leads) or not stored at all (Bina leads). The `@migration` note in `build-contact-attributes.ts`.
2. **No neutral per-contact unenroll** — only bulk `disqualify` + per-source `unenrollAll` are surfaced; there's no "remove this one contact, re-enroll later" action.

Both must land before pushing voip-campaigns to prod.

This design fixes #1 at the root by **restructuring `leadMetaJSON`** (raw-first trade capture + typed per-source payload), introduces a **channel-agnostic `customerIntakeService`**, moves Bina payload **normalization onto a new `gohighlevelClient`** (provider layer), and adds the **neutral unenroll + re-enroll** primitives for #2.

---

## 1. Current state (what's actually wired today)

- **Bina leads never populate `leadMetaJSON.requestedTrades`.** `src/app/api/webhooks/bina/route.ts` fuzzy-matches `additionalData.trades` → app trades, but writes the result only to a **customer note** + `bina_webhook_logs`. `createCustomerFromWebhook` doesn't accept `leadMeta`. → Bina-enrolled leads get **empty** CT trade attributes.
- **`requestedTrades` is written in exactly one place:** the in-app intake form (`src/features/intake/ui/views/intake-form-view.tsx`), where a human picks `tradeId`s. → those leads enroll with **raw UUIDs** as the CT attribute value (problem #1).
- **`buildContactAttributes`** reads `customer.leadMetaJSON?.requestedTrades` → `tradeIds` → emits raw IDs.
- The whole Bina "master payload" (rebate, budget, kitchen/bathroom age·size·scope, self-booking) is **flattened into a text note** — structured data lost.
- **Notes** are inserted via raw `db.insert(customerNotes)` in **both** the Bina route and `createFromIntake` — no DAL mutation exists.
- **Unenroll:** `campaignEnrollmentService.unenroll(ctx, {customerId, reason})` exists with reasons `graduated | opted_out | disqualified`. `disqualify` (single), `disqualifyBulk`, `unenrollAll` all call it with `reason:'disqualified'`. The reason is attribution only — it does **not** gate re-enroll (re-enroll only checks "no active enrollment"). `opted_out` additionally writes DNC.
- **GoHighLevel provider** (`src/shared/services/providers/gohighlevel/`) has `schemas.ts` / `constants.ts` / `types.ts` but **no `client.ts`**.

---

## 2. Locked decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Raw-first trades.** Store the provider's raw trade strings as the cross-source truth (`interestedTradesRaw: string[]`). The app-trade link (`requestedTrades`) stays **optional, human-confirmed later**. **Drop the webhook-time fuzzy match** entirely. | Bina trades ≠ app trades; don't pretend they map. Raw strings are already human-readable → solves #1 for free. |
| D2 | **Source-specific data = discriminated union** on `kind` (the payload *shape*, decoupled from the dynamic lead-source slug), with a `generic` fallback variant so the union stays total. | Textbook discriminated union; adding a source = add a variant, never migrates existing rows. |
| D3 | **Reuse `scheduledFor`** for Bina `selfBookingDateTime` — do **not** add a new field. | Same concept; `leadMetaJSON.scheduledFor` already feeds meeting creation (`business.router.ts`). |
| D4 | **`address` flows through `core`** → `customers.address`, enabling downstream geocode/Google-Place (same as `createFromIntake`). | Bina sends a top-level `address`; carry it through. |
| D5 | **Normalizer lives on the provider client.** Create `gohighlevelClient` (singleton, mirrors `cloudtalkClient`) exposing `verifyWebhookSecret` + `normalizeBinaLead`. | Webhooks always come from a provider; provider-specific parsing is the provider's job. |
| D6 | **Ingress-provider convention extension.** The CloudTalk "leaf provider — no app-domain types" rule is scoped to **egress** API clients. **Ingress webhook providers** normalize inbound payloads to app-domain shapes (`{core, leadMeta}`) — that's their entire purpose. Documented, not a silent exception. | Resolves the tension D5 creates with the documented leaf rule. |
| D7 | **`customerIntakeService`** — new channel-agnostic orchestrator. **Both** the Bina webhook and `createFromIntake` route through it. | One ingestion path instead of two divergent inline copies (DRY / right-altitude). |
| D8 | **Neutral `removed` unenroll reason** (4th reason). Per-contact `removeFromCampaign` + surface existing `enroll(campaignId)` per-contact (campaign picker). "Switch campaign" composes from the two. | C: "unenroll with potential to re-enroll later / different campaign," distinct from `disqualified` (bad lead) and `opted_out` (DNC). |
| D9 | **Bina does NOT auto-create a meeting** from `selfBookingDateTime`. It stores `scheduledFor` for human pre-fill. Only `createFromIntake`'s `customer_and_meeting` mode creates meetings. | Safer; a human confirms the appointment. |
| D10 | **Both channels populate `interestedTradesRaw`.** Bina → raw split strings; in-app form → resolved picked-trade **names**. | CT derivation reads `interestedTradesRaw` uniformly; otherwise in-app leads regress to empty trade attributes. |

---

## 3. `leadMetaJSON` final schema

`src/shared/entities/customers/schemas/index.ts`:

```ts
export const leadMetaSchema = z.object({
  // ── operational (unchanged) ──
  mp3RecordingKey: z.string().optional(),
  closedBy: z.string().optional(),
  scheduledFor: z.string().optional(),            // ALSO receives Bina selfBookingDateTime (D3)

  // ── normalized envelope (source-AGNOSTIC contract; identical keys for every source) ──
  interestedTradesRaw: z.array(z.string()).optional(),   // ["Kitchen","Bathroom"] → CT trades_interested / primary_trade (D1, D10)
  originCampaign: z.string().optional(),                 // existing
  requestedTrades: z.array(z.object({                    // OPTIONAL human-confirmed app-trade link (filled later)
    tradeId: z.string(),
    scopeIds: z.array(z.string()),
  })).optional(),

  // ── typed source capture (discriminated union; kind = payload shape) (D2) ──
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
```

**Back-compat:** purely additive (new optional fields; `requestedTrades` retained). Existing rows stay valid. The DB column is `jsonb $type<LeadMeta>`, nullable — **no schema push needed**.

---

## 4. The normalization convention (5 rules — the load-bearing part)

So every future source slots in identically:

1. **The envelope is the source-agnostic contract.** Downstream consumers — CT attribute builder, future SMS merge, screen-pop, eligibility — read **only** envelope fields (`interestedTradesRaw`, `scheduledFor`, `originCampaign`, `requestedTrades`). They **never** branch on `source.kind`. This keeps the dialer/SMS layer from re-coupling to provider shape.
2. **The `source` variant is typed raw capture** — provider campaign fields verbatim, for human/agent context + future source-specific logic. Never read by the generic dial/SMS path.
3. **One normalizer per source, on the provider client** (D5/D6): `gohighlevelClient.normalizeBinaLead(validatedPayload) → { core, leadMeta }`. Pure, no I/O, unit-testable. The **only** place that knows provider field names.
4. **Thin webhook route = orchestrator** (per `webhook-routes.md` Rule 2): auth → parse/switch → `gohighlevelClient.normalizeBinaLead` → `customerIntakeService.ingestLead` → 200. No mapping logic inline.
5. **`createCustomerFromWebhook` accepts + persists `leadMeta`.**

---

## 5. Provider layer — `gohighlevelClient` (new)

`src/shared/services/providers/gohighlevel/client.ts` — singleton factory mirroring `cloudtalkClient`:

- `verifyWebhookSecret({ authHeader })` — moves the bearer-token check out of the route.
- `normalizeBinaLead(payload: BinaContactPayload) → { core: WebhookCustomerData; leadMeta: LeadMeta }`:

```
core: {
  name: `${firstName} ${lastName}`,
  phone, email: ghlString(email) ?? null,
  address: ghlString(address) ?? null,    // D4 — NEW top-level field on binaContactPayloadSchema
  city, zip, leadSourceSlug: 'bina',
}
leadMeta: {
  interestedTradesRaw: ghlString(trades)?.split(',').map(s=>s.trim()).filter(Boolean) ?? [],
  scheduledFor: ghlString(additionalData.selfBookingDateTime) ?? undefined,   // D3
  source: {
    kind: 'bina',
    budgetSolution, rebateAmount, bathroomAge, bathroomSize, bathroomScope,
    kitchenAge, kitchenSize, kitchenScope,                                    // each via ghlString → null
  },
}
```

**Schema additions** (`gohighlevel/schemas.ts`):
- `binaContactPayloadSchema`: add top-level `address: z.string().optional()`.
- `binaAdditionalDataSchema`: add `selfBookingDateTime`, `bathroomAge`, `bathroomSize`, `bathroomScope`, `kitchenAge`, `kitchenSize`, `kitchenScope` (all `z.string().optional()`), keep `budgetSolution`/`rebateAmount`/`trades`.

`ghlString` (the `"null"`-string coalescer) moves from the route into the provider.

---

## 6. Service layer — `customerIntakeService` (new)

`src/shared/services/customer-intake.service.ts` — orchestrator, customer-domain, channel-agnostic. Zero raw `db.*`, zero provider parsing.

```ts
ingestLead(ctx, {
  core: WebhookCustomerData,     // incl. leadSourceSlug, address
  leadMeta?: LeadMeta,
  note?: string,
  createMeeting?: boolean,        // true + leadMeta.scheduledFor present → create Meeting
}): Promise<DalReturn<{ customer: Customer; meetingId: string | null }>>
```

Steps (each via DAL / sibling service):
1. `createCustomerFromWebhook(ctx, { data: core, leadMeta })` — DAL, **extended to accept `leadMeta`**.
2. `note` → `addCustomerNote(customerId, content)` — **new** DAL mutation (`entities/customers/dal/server/mutations.ts`), replacing the two raw `db.insert(customerNotes)` copies.
3. `createMeeting && leadMeta.scheduledFor` → `meetingCrud.create(...)`.
4. `// @migration` (deferred, not built now): lead-source `voipConfigJSON.campaigns.autoEnroll` → `campaignEnrollmentService.enroll(...)`.

**Not its job:** provider parsing (provider), auth/rate-limit/200 (route/router), `bina_webhook_logs` write (provider-audit; stays route-side).

**DAL change** — `WebhookCustomerData` gains `address?: string | null`; `createCustomerFromWebhook` accepts a `leadMeta?: LeadMeta` arg and persists it.

---

## 7. Both intake channels converge (D7)

- **Bina webhook** (`/api/webhooks/bina/route.ts`, ~120 lines → thin):
  `verifyWebhookSecret → parse(binaContactPayloadSchema) → gohighlevelClient.normalizeBinaLead → customerIntakeService.ingestLead({core, leadMeta, note: <formatted master-payload summary>, createMeeting: false})` → write `bina_webhook_logs` (provider audit) → 200.
- **Public form** (`createFromIntake` in `customers.router/business.router.ts`): router keeps rate-limit + zod; the form already submits `leadMetaJSON.requestedTrades` (tradeIds). The router **resolves those tradeIds → names server-side via `constructionDataService.getTrades()`** (exact, not fuzzy — the human picked real app trades) and sets `leadMeta.interestedTradesRaw` = those names (D10), keeping `requestedTrades` as-is. Then calls `customerIntakeService.ingestLead({…, createMeeting: mode==='customer_and_meeting'})`. The note + meeting-create logic currently inlined moves into the service. **No change to the intake form/schema** — resolution is server-side.

---

## 8. CT attribute derivation (closes #1)

`build-contact-attributes.ts` input changes `requestedTrades: {tradeId}[]` → `interestedTradesRaw: string[]`:
- `primary_trade = interestedTradesRaw[0] ?? ''`
- `trades_interested = [...new Set(interestedTradesRaw)].sort().join(', ')`
- `lead_source = slug` (unchanged)

`enrollment.service.ts` passes `customer.leadMetaJSON?.interestedTradesRaw`. The `@migration` note + raw-UUID problem are deleted. All values human-readable; no ID→label lookup.

**Backfill (prod only, optional):** existing customers with `requestedTrades` but no `interestedTradesRaw` would enroll with empty trade attributes. If prod has pre-existing enrollable leads, run a one-time script resolving their `requestedTrades` tradeIds → names → set `interestedTradesRaw`. Dev: not needed (test data). Flag at prod-push time.

---

## 9. Per-contact unenroll + re-enroll (closes #2 / D8)

- **Enum:** `voipUnenrollReasons = ['graduated','opted_out','disqualified','removed']`. `removed` = neutral manual unenroll, re-enrollable, **no DNC** (text column → migration-free). Update the enum comment block.
- **Router** (`voip-campaigns.router.ts`):
  - `removeFromCampaign: superAdminProcedure.input({customerId}).mutation(...)` → `unenroll(SYSTEM_CONTEXT, {customerId, reason:'removed'})`.
  - `enroll` already exists (`{customerId, campaignId?}`) and reuses the persisted CT contact → this **is** re-enroll. Surface per-contact with a campaign picker.
  - "Switch campaign" = `removeFromCampaign` + `enroll(newCampaignId)` (compose; one-click convenience deferred).
- **UI:** per-contact "Remove from campaign" + "Enroll / Re-enroll into…" (campaign picker) on the customer profile and the enrolled-leads list.

---

## 10. Convention + doc updates (part of this work)

- **`docs/codebase-conventions/service-architecture.md`** (and/or `cloudtalk/client.ts` header + a `gohighlevel/DOCS.md`): document the **egress vs ingress provider** distinction (D6). Scope the "no app-domain types" rule to egress; state ingress providers normalize to `{core, leadMeta}`.
- **Note (not forced):** route path is `/api/webhooks/bina` though the *provider* is GoHighLevel; `webhook-routes.md` says one route per provider. Keep `bina` (it's the configured GHL webhook URL) but the client/provider is `gohighlevel`. Flag for a future rename if more GHL workflows land.

### Related but OUT of scope (tracked separately)
- `docs/plans/voip/INTEGRATION-SEAM.md` is **stale** vs the 2026-06-04 "perfect separation" decision (still documents `customers.voipCampaignStatus`, `voipLifecycleTags`, `lifecycle-mapper.ts`, and our app pushing `Lead`/`Engaged`/`Booked` tags). Plus two stale comments in `cloudtalk/client.ts` (`addTags`/`removeTags` docstrings reference `['Lead','Campaign-X']` / "swap Lead → Engaged"). Doc-hygiene fix, separate PR.

---

## 11. File-change inventory

**New**
- `src/shared/services/providers/gohighlevel/client.ts` — `gohighlevelClient` (`verifyWebhookSecret`, `normalizeBinaLead`, `ghlString`).
- `src/shared/services/customer-intake.service.ts` — `customerIntakeService.ingestLead`.
- `src/shared/entities/customers/dal/server/mutations.ts` — `addCustomerNote` (if file absent, create per entity conventions).

**Modified**
- `src/shared/entities/customers/schemas/index.ts` — `leadMetaSchema` (envelope + discriminated union).
- `src/shared/services/providers/gohighlevel/schemas.ts` — Bina payload: top-level `address`, expanded `additionalData`.
- `src/shared/entities/customers/dal/server/queries.ts` — `WebhookCustomerData` +`address`; `createCustomerFromWebhook` +`leadMeta`.
- `src/app/api/webhooks/bina/route.ts` — thin orchestrator (delete inline mapping/fuzzy-match/note/log-inline).
- `src/trpc/routers/customers.router/business.router.ts` — `createFromIntake` → `customerIntakeService`; resolve picked `requestedTrades` ids → names via `constructionDataService` and set `interestedTradesRaw`. (Intake form/schema unchanged.)
- `src/shared/services/voip/campaigns/lib/build-contact-attributes.ts` — derive from `interestedTradesRaw`; delete `@migration`.
- `src/shared/services/voip/campaigns/enrollment.service.ts` — pass `interestedTradesRaw`.
- `src/shared/constants/enums/voip.ts` — add `removed`.
- `src/trpc/routers/voip-campaigns.router.ts` — `removeFromCampaign`; surface per-contact `enroll`.
- VoIP UI (customer profile + enrolled-leads list) — Remove / Re-enroll affordances.
- `docs/codebase-conventions/service-architecture.md` — egress vs ingress provider convention.

**No DB schema push** (all changes are `jsonb` shape or `text`-column enum values).

---

## 12. Validation

- `pnpm tsc` + `pnpm lint` clean.
- Bina webhook (dev, tunnel up): POST master payload → customer created with `address`, `leadMetaJSON.interestedTradesRaw`, `source.kind:'bina'` populated; note + `bina_webhook_logs` written; **no** meeting auto-created.
- In-app `createFromIntake`: customer created with `interestedTradesRaw` = picked trade names + `requestedTrades` ids; `customer_and_meeting` still creates a meeting.
- Enroll either lead → CT contact shows **human-readable** `primary_trade` / `trades_interested` (verify in CloudTalk dashboard).
- `removeFromCampaign` then `enroll(differentCampaign)` → row flips `unenrolled_at` then re-activates against the new campaign; CT membership tag swapped.
- Discriminated union: constructing a `kind:'bina'` variant missing a field fails to compile; `generic` accepted.
