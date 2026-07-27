# Lead ↔ Customer spine inversion — blast-radius + requirements (Wave 5)

> Synthesis of a 4-agent blast-radius exploration (identity/ACL, data layer, UI,
> migration), 2026-07-27. Feeds a future brainstorm → design spec. **Supersedes
> Track-2 §6** of `docs/superpowers/specs/2026-07-26-funnel-event-model-redesign-design.md`
> (that migration was customer-spine; this replaces it). Registers as **Wave 5**
> of the JSONB-decomposition program (`docs/plans/jsonb-decomposition-deprecation-ledger.md`).

## Ratified model (user, 2026-07-27)

**Lead is the identity spine. Customer is a thin sales-phase record born at the
first meeting.** The meeting is simultaneously the business transition AND the
table-family boundary — pre-meeting acquisition data lives in the lead family,
post-meeting sales data in the customer family. That lifecycle line is the
decomposition rubric that was missing.

| Lead family (acquisition, pre-meeting) | Customer family (sales, post-meeting) |
|---|---|
| `leads` — identity (name/phone/email/address) + attribution + funnel session | `customers` — thin; QB id, pipeline, Schedule marker |
| `lead_enrichment` (was `customer_enrichment`) — funnel answers, 1:many | `customer_profiles` — discovery data (1:1, ~12%, post-meeting) |

- **FK direction: keep `customers.leadId → leads.id`** (customer→lead), the
  already-committed direction ("Track 2 never flips it"). Post-migration it is
  `NOT NULL` for every customer. A lead with no customer = no row references it.
  (The migration explorer floated inverting to `leads.customerId`; unnecessary —
  customer→lead expresses the 1:1 and honors the committed guard.)
- Identity **moves onto the lead**; the customer reads it by JOIN, never copy.

## The collision that defines the work

There are **two "lead" concepts** today and the inversion's job is to merge them:
1. The Track-1 `leads` table — anonymous **PII-free draft** funnel session
   (`funnelSlug NOT NULL`, funnel-only).
2. **"Customer-as-lead"** — a `customers` row with no meeting, called "lead" in
   three places: the derived pipeline bucket, `leadsPoolVisibility`, and the
   funnel router's `leadId` param (which is actually a **customerId** today —
   `enrichFunnelLead`/`setFunnelLeadAddress` write `customer_enrichment.customerId
   = input.leadId`). ⚠️ This mislabeled `leadId`-means-customerId seam is a
   concrete rename site and an easy mis-map hazard.

## Requirements (grouped by phase)

### Phase 0 — Decisions (blocking; see "Headline decisions" below)
- **R0.1** Lead access/visibility model (no meeting bridge exists).
- **R0.2** Lead phone-gating policy (sent-proposal trigger evaporates).
- **R0.3** DNC home (phone-keyed; TCPA-critical).
- **R0.4** CASL: new `Lead` subject vs reuse `Customer`+filter.
- **R0.5** Sequencing: ship the two visible surfaces now on the derived model, or
  go straight to the inversion.

### Phase 1 — `leads` schema evolution (additive, unblocks non-funnel leads)
- **R1.1** Relax `leads.funnelSlug` to nullable; add a `kind`/source
  discriminator (`funnel | bina | generic | …`) + `offer` — today `leads` is
  funnel-only, but bina/generic intakes must become leads too.
- **R1.2** Add identity columns to `leads` (name/phone/email/address/city/state/zip
  — or a `lead_contact` child; see R0 note). Add `captureJSON` (immutable
  `LeadMeta` snapshot, merges from attribution). Reconcile UTM shape (attribution
  promotes UTM to columns; leads keeps `utmJSON` blob + hot fbclid/fbp — pick the
  blob-plus-hot-field convention).
- **R1.3** Move `pipelineStage` (leads-only today, overloaded on customers) and
  `metaScheduleSentAt` (tightening-tally item) onto `leads`.

### Phase 2 — Table merge/rename
- **R2.1** Collapse `customer_lead_attribution` INTO `leads` (kind/funnelSlug/
  offer/utm/captureJSON become lead columns; drop the table).
- **R2.2** Rename `customer_enrichment` → `lead_enrichment`, repoint FK to
  `leads.id`, unique `(lead_id, step_id)`; flip all writers/readers.
- **R2.3** `customer_profiles` STAYS customer-side. Invariant (code-confirmed): a
  profile never attaches to a pure lead (lazy-upserted at discovery = post-meeting).

### Phase 3 — Write-path inversion
- **R3.1** Intake (`ingestLead`) mints a **lead** first (identity + attribution +
  enrichment lead-side), NOT a customer.
- **R3.2** Customer is minted lazily at **first meeting** (from the meetings
  `create.after` hook), referencing the lead. This is the named spine-crossing;
  keep it consistent with the Meta `Schedule` event that already fires there.
- **R3.3** Rename the `leadId`-means-customerId params (funnel router, intake
  service, enrichment DAL) to point at real `leads.id`.

### Phase 4 — Access control (the "bulk of the work")
- **R4.1** Stand up a full `leadServerSpec` (visibility + CASL subject + schemas +
  hooks) + a scoped `leadsRouter`. Middleware is already entity-agnostic/ready.
- **R4.2** Implement the chosen lead-visibility model (R0.1); `userCanSeeCustomer`
  simplifies to meeting-participation-only (every customer now has a meeting).
- **R4.3** Bifurcate phone-gating: leads → chosen lead policy (R0.2);
  customers → existing sent-proposal threshold, now on the customer's own JOINed phone.
- **R4.4** Repoint DNC + VoIP call/SMS logging + CloudTalk campaign enrollment
  (`voip_campaign_contacts` PK, `enroll-lead` job, `compliance.isDnc` phone match)
  to the lead per R0.3. **HIGHEST real-world risk — TCPA/FTC.**
- **R4.5** Retire the derived `leads` bucket from `derivedPipelineSql`
  (customers reduce to `fresh | projects | rehash | dead`); repoint
  `derivedPipelineWhere(['leads'])` consumers to the leads table.

### Phase 5 — UI (largely relabeling; data already segments)
- **R5.1** Leads records-nav entry (`ROOTS.dashboard.leads` — new route; icon;
  gate per R0.4). Leads list assembled from EXISTING machinery (columns registry,
  `usePaginatedQuery`, `RecordsPageShell`, overview-card, prefetch) — no reinvention.
- **R5.2** Lead Sources: split/relabel the mislabeled "Customers" tab into Leads
  vs Customers. Server ALREADY computes per-source leads/meetings/signed
  segmentation — this is a copy + segmentation change, not new plumbing.
- **R5.3** Wayfinding: disambiguate the three "Leads" surfaces (records list vs
  pipeline kanban vs lead-sources funnel). A leads pipeline kanban already exists
  at `/dashboard/pipeline/leads`.
- **R5.4** Relabel pre-meeting identity surfaces (action queue, schedule) Lead vs
  Customer; post-meeting surfaces stay "Customer" (correct by the boundary).

### Phase 6 — Migration/backfill (own plan; dry-run-first)
- **R6.1** FK-reference census of `customers` (schema-wide), reviewed before any
  write. Demotion predicate = no meetings AND no projects AND no proposals AND no
  contracts AND no other blocking FK.
- **R6.2** Phase A (additive): every customer gets a lead row (port identity +
  attribution + enrichment); set `leadId`. Phase B (demotable only): lead becomes
  surviving record, demotion-safe FKs repointed, customer row **archived** (never
  hard-deleted) with a `customerId→leadId` mapping log. Phase C: hard-delete after
  a clean-verification window.
- **R6.3** Non-funnel leads (bina/generic) need synthesized lead rows — blocked
  until R1.1 lands.
- **R6.4** `customer_notes` split per-row by origin (funnel-intake note → lead;
  agent notes → customer).
- **R6.5** Safety: `scripts/` + `load-env`, dev-first vs fresh prod snapshot,
  `DRIZZLE_TARGET=prod` only, `--dry-run` default, idempotent/resumable,
  post-run invariants (`customers_before = customers_after + demoted`; zero orphans).

### Phase 7 — Contract (per ledger drop protocol)
- **R7.1** Drop deprecated columns (archived customer identity, old FKs) only via
  the ratified column-drop protocol (reader/writer sweep, data-parity proof,
  Neon-branch rehearsal, backfill-script deletion in the same commit).
- **R7.2** Register a "Wave 5" ledger section; keep a tightening tally of every
  dual-shape bridge with the Phase-C kill trigger.

### Cross-cutting — Docs
- **R8.1** Rewrite `customers/DOCS.md` (derived pipeline + visibility), add
  `entities/leads/DOCS.md`, update `docs/ubiquitous-language.md` (Lead/Customer/
  Draft-lead/Pipeline — note pre-existing Pipeline/Lead-lifecycle staleness to fix
  in the same PR) — all in the PR that changes the model.

## What gets SIMPLER (the payoff)
- `userCanSeeCustomer` becomes total/honest (every customer has a meeting).
- The derived `leads` bucket and its `NOT EXISTS meeting` gymnastics vanish.
- `pipelineStage` stops being an overloaded footgun; `customer_lead_attribution`
  immutability fits the lead's write-once-at-arrival nature.

## Headline decisions (need Oliver)
1. **Lead access/visibility model** — leads have no meeting, so the
   meeting-participation bridge can't scope them. Options: **pool-only**
   (omni + dispatcher LeadsPool, ~today), **assignment-based** (assign a lead to
   an agent; agent sees own leads), or an **ownership column** on leads.
2. **Lead phone-gating** — no sent-proposal trigger pre-meeting. Options:
   pool/dispatcher-only, or assignment-based unlock.
3. **DNC home** — recommend a **standalone phone-keyed DNC registry** decoupled
   from lead/customer (it's phone-matched and shared by both VoIP epics), vs DNC
   on the lead.
4. **CASL** — new `Lead` subject vs reuse `Customer` + filter.
5. **Sequencing** — ship the two visible surfaces now on the derived model
   (fast, low-risk, but on the concept we're removing), or go straight to the
   inversion (no interim band-aid).

## Top risks (ranked)
1. **DNC/TCPA** — DNC is phone-matched against customers today; leads hold the
   phone post-inversion. A miss = calling opted-out numbers. Highest real-world risk.
2. **Non-funnel leads** blocked by `leads.funnelSlug NOT NULL` — schema must
   evolve (R1.1) before backfill.
3. **`leadId`-means-customerId conflation** — mechanical rename that lies about
   its referent; easy to mis-map.
4. **Meta join direction + `metaScheduleSentAt` relocation** — the once-ever
   Schedule dedup marker must not double-fire or drop during the flip.
5. **Cascade-delete ordering** — lead-phase children are `cascade` on customers
   today; must be repointed before the customer is archived.

## Key file surface (for the plan author)
Schema: `leads.ts`, `customer-lead-attribution.ts`, `customer-enrichment.ts`,
`customer-profiles.ts`, `customers.ts`, `meetings.ts`. Predicate/visibility:
`customers/lib/derived-pipeline-sql.ts`, `customers/dal/server/visibility.ts`,
`customers/lib/{phone-gating-sql,can-see-phone}.ts`, `permissions/abilities.ts`,
`pipelines/lib/get-accessible-pipelines.ts`. Write path/conflation:
`trpc/routers/funnels.router.ts`, `services/customer-intake.service.ts`,
`entities/customers/dal/server/mutations.ts`. Integrations:
`services/measurement.service.ts`, `entities/customers/dal/server/measurement.ts`,
`services/voip/compliance.service.ts`, `services/accounting.service.ts`,
`services/providers/upstash/jobs/{enroll-lead,create-qb-records,graduate-from-campaign,
notify-last-interacting-agent,propagate-customer-change}.ts`. UI:
`features/agent-dashboard/lib/get-sidebar-nav.ts`, `entities/customers/lib/columns-registry.tsx`,
`features/lead-sources-admin/**`, `features/customer-pipelines/**`. Governance:
`docs/plans/jsonb-decomposition-deprecation-ledger.md`, spec §6.
