# Handoff: Lead ↔ Customer separation — make "lead" a first-class, visible thing

> ⚠️ **DIRECTION CHANGED (2026-07-27).** The spine-inversion approach explored
> below (and its blast-radius doc) was REJECTED — moving PII/identity to a new
> `leads` table is overkill and the wrong home for PII. The `leads` table was
> reverted. New direction (to be planned): keep `customers` (rename → `contacts`
> later) as the canonical person + PII home; disperse lead metadata across the
> existing `customer_*` satellites; make **lead** a thin lifecycle concept
> (draft → pii_submitted → converted) where "customer" = the converted state
> (reached at first meeting). Read this doc for the surface inventory + the
> visibility/wayfinding problems (still valid); ignore the entity-split framing.

> **How to use:** open a fresh session and point it at this doc. Start with
> `superpowers:brainstorming` — this is a modeling + UX problem, NOT a
> "add a nav link" task. The deliverable is a design spec (resolving the
> entity-boundary question below) → plan → implementation.
> Origin: funnel event-model Track-1 session (2026-07-26/27). This is the UI/UX
> + entity-boundary companion to **Track 2** already sketched in
> `docs/superpowers/specs/2026-07-26-funnel-event-model-redesign-design.md` §6.

## Mission

The app was built with only the concept of a **Customer**, so every incoming
funnel/telemarketing lead is forced to be a `customers` row and "lead-ness" is
merely *derived*. The user wants leads to be a clearly separated, first-class,
**visible** concept — so that everyone in the app knows what is a lead, what is
a customer, and where to find each. Two concrete surfaces are in scope now, but
the real work is getting the model + vocabulary right underneath them.

## The core question the design MUST resolve first

**Is a "lead" a derived view over `customers`, or its own entity/table?**

Do not skip this. The two in-scope UI surfaces can be built either way, but the
choice determines everything downstream (visibility scoping, lead-source
reporting joins, the Meta `Schedule`/appointment measurement, Track-2's
migration). Frame it explicitly in the brainstorm and get the user's ratified
decision before designing screens. Three honest options:

1. **Derived-view-first (cheapest, ships fast).** Keep everything as `customers`
   rows; add a **Leads** records surface + lead-source "leads" list that both
   filter to the existing derived `leads` bucket (`active` pipeline, zero
   meetings — `derivedPipelineSql`). Pro: no migration, immediate. Con: doesn't
   fix the modeling debt the user is naming; "lead" stays a filter, not a thing.
2. **Full entity split (Track-2 proper).** Promote the pre-PII `leads` table
   (built in Track 1) into the real lead entity that owns the lead phase, make
   `customers` reference it, and **demote** no-real-activity customers to leads
   via the surgical censused migration in the design spec §6. Pro: fixes the
   debt correctly; "lead" becomes a first-class record. Con: large blast radius
   (visibility scoping, dispatcher LeadsPool, CASL, every list UI) — this is a
   multi-week epic, not a screen.
3. **Hybrid / staged.** Ship option 1's surfaces now on the derived model, but
   design them against an interface (DAL + view-model) that survives the option-2
   migration unchanged, so the UI doesn't get rebuilt. Recommend evaluating this
   seriously — it de-risks the launch-adjacent UI work while keeping Track 2 open.

Whatever is chosen, the UI vocabulary (Lead vs Customer labels, where each
lives) must be decided ONCE and applied consistently.

## Current state — VERIFIED in code 2026-07-27 (trust but re-verify)

- **No lead entity for PII'd leads.** `funnels.router.submitLead` →
  `customerIntakeService.ingestLead` creates a `customers` row immediately. Same
  for telemarketing (Bina) intake. There is no promotion step and no
  "officiating" moment.
- **"Lead" is derived, not stored.** `src/shared/entities/customers/DOCS.md`
  `#derived-5-bucket-pipeline`: the stored `customers.pipeline` is 3-bucket
  (`active | rehash | dead`); `lib/derived-pipeline-sql.ts` (`derivedPipelineSql`,
  `derivedPipelineWhere`) explodes `active` into `leads | fresh | projects`:
  - `active` + no meeting → **`leads`** (pre-meeting)
  - `active` + ≥1 meeting → **`fresh`**
  - `active` + ≥1 project → **`projects`** (signed)
  - `rehash` / `dead` → passthrough (stored on the column; can outlive meetings)
- **The lead→customer "switch" today = first meeting creation.** That is the
  only thing that moves a row out of the derived `leads` bucket. There is no
  other linkage. (This directly answers the user's question — confirm it still
  holds.) Also relevant: `customers.pipelineStage` is a pre-meeting lead-funnel
  stage (see `DOCS.md#pipeline-stage-only-for-leads`), and `customers.leadType`
  exists as an enum.
- **Track-1 `leads` table is NOT this.** It holds anonymous **pre-PII draft**
  funnel sessions only (created on first answer, no PII), linked to a customer
  via `customers.leadId` at PII submit. It is analytics substrate, not the CRM
  lead list. Decide how it relates to the "lead entity" question (option 2 would
  grow THIS table into the real thing).
- **Records nav** lives in `src/features/agent-dashboard/lib/get-sidebar-nav.ts`
  (`recordsItems`: Customers, Meetings, Proposals, Projects — CASL-gated). A
  **Leads** entry goes here.
- **Lead Sources** surface: `src/app/(frontend)/dashboard/lead-sources/page.tsx`
  → `features/lead-sources-admin/ui/views/lead-sources-view`. The branded Meta
  ads lead source currently shows only customers (i.e. it's querying the
  customers table without surfacing the derived-`leads` rows as "leads") — the
  user wants leads visible there. Find the exact query/view and confirm what it
  filters.
- **Visibility is meeting-participation-based** (`DOCS.md#visibility-via-meeting-participation`):
  a non-omni agent sees a customer only via meeting participation. **Leads have
  no meeting yet** → today they're visible only to omni + the dispatcher
  LeadsPool (see `project-dispatcher-role`). Any Leads surface MUST get its
  visibility model right — this is the subtlest part. A naive "leads list" could
  leak pre-commitment leads to agents the phone-gating + LeadsPool design
  deliberately walls off.

## Read first (in order)

1. `src/shared/entities/customers/DOCS.md` — derived pipeline, visibility,
   phone-gating threshold. The whole current lead concept lives here.
2. `src/shared/entities/customers/lib/derived-pipeline-sql.ts` — the exact
   `leads` bucket definition.
3. `docs/superpowers/specs/2026-07-26-funnel-event-model-redesign-design.md`
   §3 (draft `leads` table) + §6 (Track-2 customers→leads migration) — the
   entity-split already has a designed destination; align with it or supersede it.
4. `src/features/agent-dashboard/lib/get-sidebar-nav.ts` — records nav.
5. `src/app/(frontend)/dashboard/lead-sources/` + `features/lead-sources-admin/`
   — the lead-source view to extend.
6. `docs/ubiquitous-language.md` — the canonical Lead / Customer / Draft-lead
   terms (Track 1 added Draft-lead). The UI must use these exactly.
7. Memory: `project-dispatcher-role` (LeadsPool + lead-qualifier VA visibility),
   `project-leads-pipeline` (pre-meeting stages on `customers.pipelineStage`),
   `project-records-migration` (deferred `/dashboard/records/*` consolidation),
   `project-users-entity-migration`, `feedback-phone-visibility-threshold`.
8. `src/shared/entities/customers/lib/columns-registry.tsx` +
   `components/lists/` — how the customers table/list is built (a Leads list
   should reuse this machinery, not reinvent it — see
   `feedback-entity-overview-card`, `pattern-pagination-toolkit`).

## Decision points the design must resolve

1. **Entity boundary** (the core question above) — derived-view vs full-split vs
   hybrid. Ratify with the user before UI design.
2. **Where the lead→customer transition is defined and NAMED.** If staying
   derived: is "first meeting = becomes a customer" the right business rule, or
   does the user want an explicit promotion (a lead is "converted" when X)?
   Nail the exact trigger and give it a name in ubiquitous language. Note the
   Meta `Schedule`/appointment-set event already fires on meeting creation — if
   the business "conversion" moment moves, keep it consistent with that.
3. **Leads records surface** — new nav entry (label, icon, CASL gate: what
   ability governs "read Lead"? today there's no `Lead` CASL subject — does one
   get created, or does it reuse `Customer` + a filter?). Route
   (`/dashboard/leads`? or the deferred `/dashboard/records/*` consolidation?).
   Columns (lead-appropriate: source, trade, funnel, captured-at, stage — NOT
   proposal/project columns). Reuse the customers list/table machinery.
4. **Lead visibility model** — leads have no meeting, so the meeting-participation
   bridge doesn't cover them. Who sees the Leads list? (omni, dispatcher/
   LeadsPool, assigned agent?) Get this right or it leaks. Phone-gating threshold
   still applies.
5. **Lead Sources — show leads.** Make the branded Meta ads (and every) lead
   source surface its leads, distinctly labeled as leads vs customers. Decide the
   count/segmentation (leads vs fresh vs signed per source — the derived buckets
   already express this). This doubles as the per-source funnel diagnostic the
   Meta measurement work wants.
6. **Vocabulary + wayfinding** — the user's explicit success criterion: "everyone
   knows what is a lead, what is a customer, and where to find each." Decide
   labels, badges (`pattern-entity-overview-card`, the stage-color convention),
   empty states, and any cross-links (a lead detail → becomes → customer detail).
   Must read consistently across records nav, lead sources, and any list.
7. **Relationship to the Track-1 `leads` (draft) table + Track-2 migration** —
   if the chosen option grows that table into the real lead entity, this handoff
   and Track-2 §6 merge into one epic; say so explicitly and update the spec.

## Constraints

- Entity-first org, reuse existing API surface (customers list machinery,
  pagination toolkit, overview-card pattern) — do NOT hand-roll a parallel list
  stack. See `memory/coding-conventions.md`, `feedback-reuse-existing-api-surface`.
- Visibility/CASL is load-bearing and easy to get wrong — treat the lead
  visibility model as a first-class design artifact, not an afterthought.
- Backend layering tRPC → service → DAL → DB; visibility scoping via
  `scopeMiddleware`. No naked `db` outside DAL.
- UI methodology: brainstorm the user-flow FIRST, then ui-ux-pro-max →
  web-design-guidelines → impeccable, THEN code (`feedback-ui-work-methodology`).
- Use ubiquitous-language terms exactly; if the model changes, update that doc +
  `customers/DOCS.md` in the same PR.
- `pnpm lint && pnpm tsc` preflight; work on main, stage by path.

## Deliverables

1. Design spec (`docs/superpowers/specs/`) resolving decision points 1–7, with
   the ratified entity-boundary decision stated up top.
2. Implementation plan + implementation: the Leads records nav surface + list,
   the lead-sources leads display, the visibility model, vocabulary/UL updates.
3. Doc updates: `customers/DOCS.md` (or a new `leads/DOCS.md`),
   `docs/ubiquitous-language.md`, and — if the entity split is chosen — a
   reconciliation note merging this with Track-2 §6 of the event-model spec.
