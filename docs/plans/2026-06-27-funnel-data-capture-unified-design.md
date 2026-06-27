# Funnel Data-Capture — System Analysis, Requirements & Unified Design

> Status: **analysis + proposal (no code written)**. Date: 2026-06-27.
> Scope: `src/shared/domains/funnels/` capture flow + the server write paths it
> drives (`customer-intake.service.ts`, `customers/dal/server/mutations.ts`,
> `funnels.router.ts`, the customer CRUD/spec, `leadMetaSchema`).
> Method per the hand-off: **treat today's observed outcomes as the spec**, map
> every path, then surface where the *mechanisms* contradict each other. The
> defect is architectural, not a single bug.

---

## 0. TL;DR

A funnel run writes lead data through **four independent paths** that were each
added in isolation. They disagree on five axes that should be uniform:

| Axis | Lead-create (WP1) | Enrichment (WP2) | Address (WP3) | CAPI (WP4) |
|---|---|---|---|---|
| Trigger | PII submit, **awaited/blocking** | answer-set change, **fire-and-forget** | address pick, **fire-and-forget** | dispatched in WP1 |
| Atomicity | single insert | **atomic** nested `jsonb_set` | **read-modify-write** (TOCTOU) | async job |
| "Is funnel lead?" check | n/a (creates it) | **SQL string** predicate | **typed JS** guard | reads `source.kind` in JS |
| Side-effect hooks | create hooks | **none** (bypasses CRUD) | **geocode + GCal** hooks | n/a |
| Rate limit | 5/h `ip:phone` | 20/h `ip` | 10/h `ip` | (shares WP1) |

The same rule ("is this a funnel lead?") has **two homes with two failure
modes**; enrichment is written by **two paths** with different merge semantics;
location (`city/state/zip`) has **two writers**; and the lead's identity lives
**only in `localStorage`** with no server-side idempotency, so a lost
`leadId` silently produces a duplicate customer or a broken enrichment stream.

The fix is to model the run as **one idempotent funnel-session upsert** through a
**single typed field-map** that knows, per datum, where it lands and how it
merges — subsuming all four ad-hoc paths.

---

## 1. System Map

### 1.1 Capture points → write paths

Every datum a funnel run can persist, with the step that captures it, the path
that writes it, and when.

| Datum | Captured by (step) | Write path | When | Pre/post lead | Guarantee |
|---|---|---|---|---|---|
| `name`, `phone` | `pii` form ([pii-form-step.tsx:63-116](../../src/shared/domains/funnels/ui/steps/pii-form-step.tsx#L63-L116)) | **WP1** create | on submit, **awaited** | creates lead | gated (mobile-only, 5/h), blocking |
| `city`, `state`, `zip` (from ZIP) | `zip` step → `answers.zip` | **WP1** create (snapshot of `answers.zip`, [build-lead-input.ts:26-28](../../src/shared/domains/funnels/lib/build-lead-input.ts#L26-L28)) | at create | creates lead | one-shot |
| `address`, `city`, `state`, `zip` (from address) | `address` step ([address-step.tsx:13-27](../../src/shared/domains/funnels/ui/steps/address-step.tsx#L13-L27)) | **WP3** `setFunnelLeadAddress` | on pick, **fire-and-forget** | post-lead | best-effort, overwrites WP1 location |
| `leadMetaJSON.source` (offer, slug, utm, meta{fbp,fbc}) | URL + cookies, assembled at PII submit | **WP1** create ([build-lead-input.ts:31-42](../../src/shared/domains/funnels/lib/build-lead-input.ts#L31-L42)) | at create | creates lead | one-shot |
| `source.enrichment` (card-select dims) | each enrichment step | **WP1** snapshot **and** **WP2** merge | create **and** every answer change | both | see §1.3 (double-written) |
| `phoneVerification` | server, during WP1 | **WP1** create ([funnels.router.ts:135-139](../../src/trpc/routers/funnels.router.ts#L135-L139)) | at create | creates lead | server-set |
| `interestedTradesRaw`, `originCampaign` | derived from slug/utm | **WP1** create | at create | creates lead | one-shot |
| Meta `Lead` event (browser + CAPI) | PII submit | **WP4** ([pii-form-step.tsx](../../src/shared/domains/funnels/ui/steps/pii-form-step.tsx) browser + [funnels.router.ts:149-185](../../src/trpc/routers/funnels.router.ts#L149-L185) server) | after WP1 succeeds | post-lead | dedup via shared `eventId` |
| `leadId`, full answer set, `currentStepId` | engine | **client localStorage** ([use-funnel-engine.ts](../../src/shared/domains/funnels/hooks/use-funnel-engine.ts), `funnelStateKey(slug)`) | every change | both | survives reload; **no server mirror of `leadId`** |
| browser `PageView`/`ViewContent`/`CompleteRegistration` | page + steps | **client pixel only** | per lifecycle | both | host-gated, no server twin |

### 1.2 The four server write paths

```
WP1  Lead create  (blocking, gated)
     PII submit
       └─ funnelsRouter.submitLead         (5/h ip:phone, mobile gate, awaited)
            └─ customerIntakeService.ingestLead
                 └─ customerCrud.create     → fires create hooks; writes WHOLE leadMetaJSON.source
                 └─ (void) metaCapiEventJob.dispatch  ── WP4

WP2  Enrichment patch  (fire-and-forget)
     useProgressiveEnrichment  (effect on [leadId, enrichmentSignature])
       └─ enrichFunnelLead       (20/h ip)
            └─ customerIntakeService.enrichFunnelLead
                 └─ mergeFunnelEnrichment   → ATOMIC jsonb_set at {source,enrichment};
                                              capability = SQL predicate source.kind='funnel';
                                              BYPASSES CRUD → no hooks

WP3  Address patch  (fire-and-forget)
     address step onSelect
       └─ setFunnelLeadAddress   (10/h ip)
            └─ customerIntakeService.setFunnelLeadAddress
                 └─ customerCrud.getById     → capability = TYPED JS guard source.kind!=='funnel'
                 └─ customerCrud.update       → fires geocode-invalidation + GCal-propagation hooks
                                                (read-modify-write: TOCTOU window)

WP4  CAPI twin  (async, durable-ish via QStash)
     metaCapiEventJob → measurementService → metaSyncService.trackLead → Meta
       dedup on shared eventId; attribution from leadMetaJSON.source.{meta,utm}
```

### 1.3 The structural contradictions (mechanisms disagreeing on the same intent)

- **C1 — "Is this a funnel lead?" has two homes.** WP3 uses a typed JS guard
  `customer.leadMetaJSON?.source?.kind !== 'funnel'`
  ([customer-intake.service.ts:174](../../src/shared/services/customer-intake.service.ts#L174)).
  WP2 uses an **un-typechecked SQL string** `leadMetaJSON #>> '{source,kind}' = 'funnel'`
  ([mutations.ts:72](../../src/shared/entities/customers/dal/server/mutations.ts#L72)). If the
  JSON path ever moves, the JS guard fails to compile (loud) while the SQL silently
  matches zero rows (silent data loss). Two encodings, two failure modes.

- **C2 — Enrichment is written by two paths with different merge semantics.**
  WP1 writes the **entire** `source` object (including an enrichment snapshot,
  [build-lead-input.ts:18,40](../../src/shared/domains/funnels/lib/build-lead-input.ts#L18-L40)).
  WP2 does an **atomic nested deep-merge** at `{source,enrichment}`. They don't
  currently collide only because kitchens/bathrooms place every enrichment dim
  *after* PII (so WP1's snapshot is `{}`). A funnel that put an enrichment
  dimension *before* PII would have WP1 seed it and WP2 merge onto it — works,
  but by accident of ordering, not design.

- **C2′ — Latent footgun: `leadMetaJSON` is a *shallow* top-level merge column.**
  It is registered in `jsonbMergeColumns`
  ([server-spec.ts:53](../../src/shared/entities/customers/lib/server-spec.ts#L53)), and the
  generic merge is `COALESCE(col,'{}') || new`
  ([create-crud-dal.ts:148](../../src/shared/dal/server/lib/create-crud-dal.ts#L148)) — a
  **shallow** `||`. Because `source` is a top-level key, **any** future CRUD
  update that passes a partial `leadMetaJSON.source` would replace the whole
  `source` and wipe `enrichment`, `meta` (fbp/fbc), and `utm`. WP2 exists
  precisely to dodge this. The invariant "never write `source` through CRUD" is
  load-bearing and undocumented as a system rule.

- **C3 — Location has two writers with implicit precedence.** WP1 seeds
  `city/state/zip` from the ZIP answer; WP3 overwrites `address/city/state/zip`
  from the address pick. If WP3's fire-and-forget request is dropped, the
  ZIP-derived location persists. Two sources of truth, last-writer-wins by luck
  of timing, no reconciliation.

- **C4 — Side-effect asymmetry.** Both WP2 and WP3 are conceptually "patch
  funnel metadata onto an existing lead," yet WP3 fires geocode-invalidation +
  GCal-propagation hooks **per address pick** while WP2 fires nothing. The
  decision of *which writes trigger downstream effects* is an accident of which
  path each happened to be built on (CRUD vs bespoke).

- **C5 — Guarantee/limits asymmetry.** Three different rate limits (5/h, 20/h,
  10/h) and three different retry/blocking postures, with no shared model of
  what must be durable vs best-effort.

- **C6 — Identity lives only on the client.** `leadId` exists solely in
  `localStorage`. There is **no server idempotency key** tying a funnel session
  to a customer. `submitLead` is a plain create with no dedupe.

---

## 2. Scenario × Step Outcome Matrix

Observed/intended outcome treated as correct; the right-hand column flags where
two mechanisms would produce different stored state for the same user intent.

| Scenario | What happens today (observed = spec) | Stored state | Mechanism conflict |
|---|---|---|---|
| **Happy path to completion** | WP1 creates lead at PII; WP2 merges each post-PII dim; WP3 overwrites location at address; WP4 fires Lead + CAPI | Full customer row + `source.enrichment` complete | None visible — but enrichment correctness depends on the *atomic* WP2; pre-fix it lost the first dim |
| **Drop-off before PII** | No lead created (WP1 never runs). Answers live only in `localStorage` | **Nothing server-side** | By design — but the "progressive capture saves everything" promise does **not** hold pre-PII |
| **Drop-off at first post-PII dim** | WP1 done; WP2 fires once with the one answered dim | Lead + that one enrichment key | The bug we fixed lived here (lost-update). Atomic merge now correct |
| **Drop-off at last post-PII dim** | WP2 fired progressively; full record present | Lead + all dims | OK |
| **Back → change an answered dim** | `setValue` overwrites; `enrichmentSignature` changes; WP2 re-sends **full** record; atomic merge overwrites that key | Updated enrichment, last-write-wins | OK for enrichment. But **no parallel mechanism** re-runs WP1-only fields (e.g. if name were editable) |
| **Re-tap same answer** | `sig` unchanged → WP2 effect does **not** re-fire | No write | OK (idempotent by signature) |
| **Refresh / resume mid-flow** | `localStorage` rehydrates `leadId` + answers; **reuses** lead, no re-create; WP2 re-fires on mount if `sig` differs | Same lead, self-heals dropped enrichment | OK **iff** localStorage survives. Cross-device / cleared storage → see below |
| **Resume with cleared/lost localStorage** | No `leadId` → re-entering PII runs WP1 again → **new customer row**; or `submitLead` 5/h `ip:phone` limit blocks the re-submit → PII step errors, user **stuck**, no `leadId` ⇒ WP2/WP3 can never run | **Duplicate customer** or **dead-end** | C6: identity only client-side; WP1 not idempotent |
| **ZIP out-of-service-area** | Gate rejects in the ZIP step before PII | No lead | OK — but location validation lives only client-side |
| **Phone verification fails / Twilio outage** | `validatePhoneLine` **fails open** ([funnels.router.ts:110-120](../../src/trpc/routers/funnels.router.ts#L110-L120)); lead created with `phoneVerification.status='unverified'` | Lead saved, flagged unverified | OK by design |
| **Enrich request dropped / 20/h hit** | Fire-and-forget, error swallowed; next answer re-sends the **full** record → self-heals; if it was the **last** dim and user drops, that dim is **lost** | Possibly missing the final dim | Self-healing depends on a *subsequent* answer existing |
| **Rapid-fire / concurrent answers** | Atomic `jsonb_set` per key → no clobber (the fixed race) | Correct | **Only WP2** is race-safe. WP3's read-modify-write is **not** — concurrent address + any CRUD update can still lose a write |
| **Same person, two funnels (kitchens then bathrooms)** | Separate `funnelStateKey` per slug → separate engine state → WP1 runs twice → **two customer rows** (unless 5/h `ip:phone` blocks the 2nd) | **Two customers** for one person | C6: no cross-session identity; enrichment keyed by `stepId` would *not* collide because rows are distinct |
| **Dev/preview vs production** | Browser pixel host-gated off ([is-production-host.ts](../../src/shared/config/is-production-host.ts)); CAPI `test_event_code` env-gated, boot-fails if set in prod | No live-pixel pollution | OK — must be preserved by any redesign |

**Key reading:** the system is *correct on the happy path* and *correct under the
race we fixed*, but its correctness is **non-uniform** — it holds only on the one
path that was hardened (WP2). The same guarantees do not extend to WP3 (address),
to identity (C6), or to the pre-PII window.

---

## 3. Requirements (read off the matrix — the list that was never written down)

These are the invariants the system *already tries* to satisfy in places, stated
once, for the whole system:

- **R1 — One persistence boundary.** All funnel answer persistence flows through
  a single server operation with a single capability check. No per-field bespoke
  procedures.
- **R2 — Atomic, monotonic, idempotent writes for *every* field**, not just
  enrichment. Re-sending the current snapshot must converge; concurrent/out-of-
  order writes must never clobber a sibling. (Generalize the WP2 property to WP3
  and location.)
- **R3 — Drop-off completeness.** Every answered datum is persisted as soon as it
  is known and a lead exists, independent of reaching the end. (Today holds for
  post-PII; the pre-PII gap is a conscious decision to confirm — see Decisions.)
- **R4 — Deterministic answer-change semantics.** Changing a previously answered
  question updates the stored value (last-write-wins per key) uniformly across
  all destinations (columns and nested JSONB).
- **R5 — Clean resume / single identity.** A returning user (reload, later
  session, **and ideally another device**) resolves to the **same** customer; the
  system never double-creates. Identity must not depend solely on `localStorage`.
- **R6 — Explicit cross-funnel identity rule.** Same person across two funnels is
  either one customer (dedupe) or two-by-design — decided once, enforced in one
  place.
- **R7 — Uniform failure model.** One policy for what is durable vs best-effort,
  what retries, and how rate limits are derived — not three accidental limits.
- **R8 — Attribution/measurement coupling preserved.** `source.{meta,utm}` and
  the `eventId` dedup contract must survive every write; **no write may ever
  shallow-replace `source`**. Host-gate + `test_event_code` isolation preserved.
- **R9 — Single, typed capability home.** "Is this a funnel lead?" is encoded
  **once**, typechecked, and a JSON-path change cannot silently break it.
- **R10 — Centralized side-effect policy.** Which writes invalidate geocoding /
  propagate to GCal is decided by *which fields changed*, in one place — not by
  which entry point the write came through.
- **R11 — Ordering independence.** A field answered first is never clobbered by
  one answered last (the whole race class, not the one instance).
- **R12 — Convention compliance.** Three-layer backend (tRPC→Service→DAL→DB);
  services orchestrate, DAL implements; reuse generic CRUD where it fits; derived
  values (labels) stay computed, not re-stored.

---

## 4. Unified Design

### 4.1 The core model: an idempotent funnel-session upsert through one field-map

Replace four write paths with **one persistence boundary** built from three
proven patterns:

1. **Client-minted `sessionId`** — the funnel session is the identity. The engine
   mints a `sessionId` once (alongside today's persisted state), stores it in
   `localStorage` *and* sends it on every server call. It is the idempotency key.
2. **Idempotent upsert** — the server resolves `sessionId → customer` (creating
   on first sight, reusing thereafter). Lead "creation" becomes the *first patch*,
   not a distinct operation. A lost `localStorage` no longer forks a duplicate as
   long as the `sessionId` round-trips (and we can additionally reconcile on
   `phone` within a window — see Decisions).
3. **Declarative field-map (the spec) + atomic patch** — a single typed table
   declares, for each captured datum: its **destination** (top-level column vs
   nested JSONB path), its **merge strategy** (replace / deep-merge), and its
   **side-effect triggers** (geocode, GCal, Meta). One server operation reads the
   incoming answer snapshot, routes each field through the map, and applies it in
   **one atomic statement set** with the funnel-kind predicate baked into the
   update branch.

This is the same "send the full snapshot, converge idempotently" contract WP2
already proved — generalized from `source.enrichment` to **every** field.

### 4.2 Shape

```
funnelSync (one tRPC procedure, baseProcedure, SYSTEM_CONTEXT)
  input: { sessionId, slug, answers, attribution, eventId? }
    └─ funnelLeadService.sync(ctx, input)            ← orchestration only
         1. resolve-or-create customer by sessionId   (idempotent; capability set here, ONCE)
         2. project `answers` → typed FieldPatch via FIELD_MAP   (labels computed, not stored anew)
         3. applyFunnelPatch(customerId, patch)        ← DAL: atomic, path-aware deep-merge,
                                                          funnel-kind predicate in WHERE
         4. decide side-effects from changed-field set (geocode / GCal / Meta)  ← one place
```

- `FIELD_MAP` subsumes `buildLeadInput` + `buildLeadEnrichment` +
  `setFunnelLeadAddress`'s implicit field list. It is the single source of "what
  a funnel can capture and where it goes."
- `applyFunnelPatch` is **one** DAL mutation that does path-aware deep-merge
  (the generalization of `mergeFunnelEnrichment`). The funnel-kind check is its
  WHERE predicate — **the one home (R9)** — but typed (see Decision 2 on whether
  to make nested-path merge a first-class toolkit feature so it's typechecked,
  vs one documented bespoke mutation).
- The Lead pixel/CAPI timing contract (browser fires only after server persists,
  shared `eventId`) is preserved: `funnelSync`'s *first* call (the one that
  creates the lead) is the awaited/blocking one that gates the pixel; subsequent
  patches are fire-and-forget. The create-vs-patch split becomes a property of
  *"is this the first sync for this session?"*, not a separate procedure.

### 4.3 How each requirement maps

| Req | Mechanism |
|---|---|
| R1 | single `funnelSync` boundary |
| R2, R11 | `applyFunnelPatch` atomic path-aware merge for all fields |
| R3 | every sync persists the current snapshot |
| R4 | merge = last-write-wins per key/column, uniformly |
| R5, R6 | `sessionId` idempotent upsert + explicit phone-reconciliation policy |
| R7 | one rate-limit + one best-effort policy on `funnelSync` |
| R8 | `source` never shallow-replaced — only deep-merged by path; attribution fields are map entries that always survive |
| R9 | funnel-kind predicate in the single patch mutation |
| R10 | side-effects decided from the changed-field set in the service |
| R12 | service orchestrates, one DAL mutation implements, labels stay derived |

### 4.4 What gets deleted

- `setFunnelLeadAddress` service method + its TOCTOU read-modify-write + its
  duplicate JS capability guard (C1, C3, C4 resolved).
- The enrichment snapshot inside `buildLeadInput` as a *separate* concept (it
  becomes the first `funnelSync` patch).
- Two of the three rate limiters; the divergent blocking/fire-and-forget trio
  collapses to one policy.
- The undocumented "never write `source` via CRUD" landmine — replaced by an
  explicit path-aware merge that *can't* shallow-replace `source`.

---

## 5. Migration Plan (phased, reviewable, still no code)

**P0 — Lock the invariants (docs only).** Write the R1–R12 list into
`src/shared/entities/customers/DOCS.md` + a funnel DOCS.md; add the "`source` is
never shallow-merged" rule explicitly. Captures intent before touching code.

**P1 — Introduce `sessionId` + idempotent create (non-breaking).** Engine mints
& persists `sessionId`; `submitLead` accepts it and becomes resolve-or-create.
Removes the duplicate-customer / dead-end resume failure (C6, R5). No path
collapse yet — lowest-risk, highest-value first.

**P2 — Collapse address into the atomic patch.** Route address through the single
patch mutation (drop TOCTOU + JS guard). **Decision point:** whether funnel
address changes still fire geocode/GCal hooks (R10) — today they do.

**P3 — Unify enrichment + create snapshot + attribution into `funnelSync` +
`FIELD_MAP`.** One procedure, one capability home, one rate-limit/failure policy.
This is the big collapse; do it after P1/P2 have de-risked the pieces.

**P4 — (Optional) Generalize nested-path deep-merge in the query toolkit.** If we
want path-aware merge reusable beyond funnels (and typechecked), extend
`jsonbMergeColumns` to support nested paths instead of a bespoke mutation.
Touches shared DAL used by other entities — gate behind its own review.

**Throughout — Meta guardrails:** keep browser/CAPI dedup `eventId` contract and
the pixel timing; keep host-gate + `test_event_code` isolation; add a regression
check that `source.{meta,utm}` survive every patch. (Verify in a real browser per
`feedback-meta-pixel-verify-real-browser.md` — never headless.)

**Risks:** (a) Meta measurement regression if a patch ever shallow-touches
`source`; (b) identity edge cases under phone reuse / two funnels; (c) rate-limit
changes altering abuse posture; (d) P4 touches shared DAL.

---

## 6. Decisions I need from you before any implementation

1. **Identity model (R5/R6). — RESOLVED 2026-06-27.** Dedup begins at PII submit,
   keyed on the **customerId** (the native handle). Server does **resolve-or-create
   by phone** at submit, returning the existing `customerId` if the phone is known
   — covers cleared-localStorage and same-person-two-funnels without a client
   session id. The persisted client handle is renamed `leadId → customerId` (today
   `leadId` already holds `created.customerId`, [pii-form-step.tsx:114](../../src/shared/domains/funnels/ui/steps/pii-form-step.tsx#L114) —
   the name is misleading). **Open follow-on:** if two funnels dedupe to one
   customer, `source` (single `funnelSlug`/`offer`, flat `enrichment` by `stepId`)
   can't hold both and shared step ids collide — needs a `source` shape that keys
   enrichment by funnel (e.g. `enrichment[slug][stepId]`). Schema decision, not
   blocking the merge work.

2. **Nested deep-merge home (R12 tension). — RESOLVED 2026-06-27.** Fix the
   **toolkit**: the entity-server-spec JSONB merge must be a **true recursive deep
   merge** so a partial nested payload never deletes sibling data — a hard rule for
   ALL entities, not a per-field workaround. This is offloaded to a dedicated
   session: see `2026-06-27-jsonb-deep-merge-handoff.md`. Once landed,
   `mergeFunnelEnrichment` can be retired and the funnel routes enrichment through
   generic CRUD (subject to the side-effect/hook decision below).

3. **Side-effect policy on funnel patches (R10).** Should an address captured
   *during the funnel* keep firing geocode-invalidation + GCal-propagation (today
   it does), or defer all downstream propagation until a human touches the lead?
   Should **any** funnel patch fire hooks?

4. **Procedure shape.** One `funnelSync` (full-snapshot, create = first patch) —
   or keep an explicit awaited `createLead` (for the blocking Lead-pixel gate)
   separate from a fire-and-forget `patchFunnelLead`? *(Both satisfy the pixel
   timing; the question is one entry point vs two.)*

5. **Pre-PII capture (R3).** Today nothing persists before PII. Keep that (PII is
   the consent/identity boundary), or persist an anonymous session earlier? *(I
   recommend keeping PII as the boundary unless there's a measurement reason.)*

6. **`sessionId` storage.** New dedicated column on `customers`, or inside
   `leadMetaJSON.source.sessionId`? *(Column = indexable/idempotent-upsert-friendly;
   JSONB = no migration.)*

---

*Sources verified in code this session: [funnel-engine](../../src/shared/domains/funnels/ui/funnel-engine.tsx),
[use-progressive-enrichment.ts](../../src/shared/domains/funnels/hooks/use-progressive-enrichment.ts),
[build-lead-input.ts](../../src/shared/domains/funnels/lib/build-lead-input.ts),
[customer-intake.service.ts](../../src/shared/services/customer-intake.service.ts),
[mutations.ts](../../src/shared/entities/customers/dal/server/mutations.ts),
[create-crud-dal.ts](../../src/shared/dal/server/lib/create-crud-dal.ts),
[server-spec.ts](../../src/shared/entities/customers/lib/server-spec.ts),
[schemas/index.ts](../../src/shared/entities/customers/schemas/index.ts),
[funnels.router.ts](../../src/trpc/routers/funnels.router.ts), plus the Meta tracking layer.*
</content>
</invoke>
