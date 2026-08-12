# CRUD DAL Mutation-Interface Extension — Brainstorm & Requirements

> **Status:** Requirements-in-progress from a `/grill-with-docs` session (2026-08-12). **NOT design-complete.** Open questions remain (§8). This is the deliverable of **Projects Standardization Epic — Phase 2** (the "case study" that drives the interface extension), widened by user directive to a **cross-entity** analysis.
> **This is an epic-within-an-epic.** Parent line: `memory/project-crud-mutation-standardization.md` → `docs/plans/2026-08-11-projects-standardization-epic.md` (Phase 2) → this doc.
> **Coordinates with:** `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (#285 — owns permissions/scope; see §9). ADR-0002 (Entity Server System), ADR-0003 (backend layers) — this refines both (§10).
> **How a fresh session resumes:** read this doc top-to-bottom, then §8 (open questions) and §9 (what's still missing). The layering model in §2 is load-bearing for every decision below.

---

## 1. What this is

The generic entity toolkit — `createCrudDal(spec)` (5 single-row slots: `getById`, `create`, `update`, `delete`, `duplicate`; `list` is deliberately NOT CRUD), `createCrudRouter`, and `EntityServerSpec` — is deliberately minimal. As entities grew richer, mutations kept going **off** the toolkit (inline `db`, bespoke feature-DAL, services writing entity tables raw), which means **`EntityServerSpec.hooks` never fire → the entity's invariants, derived fields, and side-effects are silently skipped.**

Phase 2's job: **catalog what structurally blocks the generic interface from being used in more mutation contexts**, across ALL core entities (not just projects), and turn each blocker into an interface requirement. The design of the extension is the *next* session; this is the requirements + the architectural model we converged on.

**User's framing directives (verbatim intent):**
- Do **not** preserve backwards compatibility at the expense of a better generic interface.
- Do **not** resort to thin ad-hoc constants/functions; find what blocks the **generic** crud/trpc/entities interface and fix *that*.
- Analyze the real business requirements in each core entity/router/crud flow.

---

## 2. The layering model — THE core insight (user's)

This is the spine. Everything else is a consequence.

- **DAL (CRUD) = the universal resource chokepoint.** *Every* write to a resource, regardless of origin — tRPC procedure, service, background job, webhook — goes through the DAL, so behavior is predictable and invariants always fire. **"Any actor, any origin, same resource, same way."** The DAL interface must reflect that.
- **Service = reusable pre-orchestration.** Common actions that must happen together, pre-composed, origin-agnostic (server contexts AND tRPC), composes DAL calls.
- **tRPC procedure = client-origin, 1-off orchestration.** Routes by actor; composes DAL + services; where feature-specific one-off executions live.

**The decisive consequence:** the target is **not** "kill business routers." It is **"nothing writes a resource except through the DAL."** Cross-entity orchestration (composing multiple DAL calls, each of which fires its own hooks) legitimately lives *above* CRUD, in a service or a tRPC procedure — that is **not** a bypass and must **not** be absorbed into CRUD (that path rots the toolkit into a god-object).

- **True bypass (eliminate):** a write to an entity's own table *outside* its DAL (inline `db` in a router/service; bespoke feature-DAL). Examples: `accounting.service.ts:120` `db.update(projects)`; projects' bespoke `createProject`/`updateProject`/`deleteProject`; `providers/ai/client.ts:107` raw `proposals.projectJSON`; `compliance.service.ts:68,83` raw `customers`.
- **Legitimate composition (keep):** a business router/service composing multiple DAL calls. Example: meetings `setOutcomeWithReason` → `meetingCrud.update()` + `customerNoteCrud.create()` (`meetings.router/business.router.ts:27-76`).

**Permissions are an orchestrator concern, not a DAL concern.** The DAL stays **actor-agnostic** — it *consumes* a resolved permission context (scope + ability) passed in by whatever orchestrator called it; it never resolves or checks permissions itself. Gating happens at the orchestrator (service **or** tRPC procedure — either can be an entry point). The robust machinery for this is **#285's CASL scope-compiler** (`resolveScope`/`canAccess`, replacing `resolveVisibilityScope`/`resolveEffectiveScope`). We coordinate; we do not redesign permissions here.

---

## 3. The extended CRUD DAL interface — decisions

### 3.1 Hooks move OFF the spec, onto the factory invocation (the root-cause fix)

**Problem (confirmed in code):** `EntityServerSpec` carries `hooks`, so hooks are defined **inside the spec** — a config file. But hooks contain imperative DB logic, and `meetings/lib/server-spec.ts:177-186` runs a **raw `db.select`** on its own table. A file that `satisfies EntityServerSpec` imports `db`, `ably`, five QStash jobs. It is a behavior module wearing config's clothes.

**Root cause = a circular barrier.** `meetingCrud = createCrudDal(meetingServerSpec)` (`crud.ts:5`): the spec is the *input* that produces the handlers, so a hook defined inside the spec **cannot reference `meetingCrud`** — it doesn't exist yet. That is *why* `delete.before` reaches for raw `db` instead of `crud.getById`. The layer forces the bypass.

**Decision:** hooks are defined at the **factory invocation** (in `dal/server/crud.ts`), via a **builder that receives the produced handlers + a transaction context** (option **iii**):

```ts
// server-spec.ts — PURE declarative identity. No db, no jobs, no ably, no hooks, no duplicate-overrides.
export const meetingServerSpec = {
  entityName, caslSubject, visibility, table, schemas, primaryKey?, shareable?, parent?
} satisfies EntityServerSpec<typeof meetings>

// dal/server/crud.ts — behavior lives where its dependencies live
export const meetingCrud = createCrudDal(meetingServerSpec, (crud, tx) => ({
  hooks: { /* ... can call crud.*, other entities' handlers, and use tx ... */ },
  duplicate: { /* overrides is behavior → also moves here */ },
}))
```

This single move lands four things:
1. **Kills the circular barrier** — hooks call `crud.*` (own + other entities) instead of raw `db`. The db-in-config bypass *cannot recur* (the spec has no `db` import).
2. **Purifies `EntityServerSpec`** — `hooks` and `duplicate.overrides` (behavior) leave the type; the spec becomes declarative identity only.
3. **Threads the transaction (G1)** — the factory owns the write boundary, opens one `tx`, hands `tx`-bound handlers to hooks → before→write→after + child + cross-entity writes are atomic. Lands **G3** (child-replace in-tx) and **G4** (delete reads its row via `crud.getById` in-tx).
4. **Trade-off (banked):** typing lift — the builder must stay generic over the table so hooks receive `Insert<T>`/`Row<T>` and `crud` is fully typed. Solvable via a late-bound closure (hooks run at call-time; capturing `crud`, assigned just after, is fine).

### 3.2 Two-layer additive hooks (user's design)

Hooks are supplied **twice**, same interface, different lifetime:

| Layer | Where | Semantics |
|---|---|---|
| **Factory hooks** | `createCrudDal(spec, (crud, tx) => ({ hooks }))` | **Invariant** — always run, every origin, no exceptions. *This is what "factory hook" means, by convention.* |
| **Call-site hooks** | `meetingCrud.create(ctx, input, { before, after })` | **Additive** — context-specific, per-call. Can only **add** behavior, never remove. |

Default (no options) = every invariant fires (the any-origin guarantee holds). Anonymous `before/after` come **back** at the factory — no named-hook maps, no skip flags, no skip taxonomy. That is the complexity the user wanted removed.

### 3.3 Onion ordering + payload threading (user's ruling)

```
factory.before → callsite.before → [validate → write] → callsite.after → factory.after
```

Factory is the **outer** layer (first to open, last to close); call-site is **inner**. **The threaded value passes hook-to-hook — never the original input:**

- **before phase** (threaded value = the write payload): `p1 = factory.before(input)` → `p2 = callsite.before(p1)` → `validate(p2)` → write → `row`.
- **after phase** (threaded value = the result, seeded from `row`): `r1 = callsite.after(row)` → `r2 = factory.after(r1)` → **return `r2`**.

**Interface change (bank it):** `after` hooks stop being `void` — they **receive and return** the threaded result. This *fixes* a real current limitation: the proposals `duplicate`-with-incentives override manually merges `finalTcpCents` because an after-hook couldn't shape the returned row (`duplicate.ts:40-47`); threaded after-hooks make that native.

### 3.4 "Prohibit a hook" is solved by INVERSION, not by disabling (user's epiphany)

The original ask was "disable a certain hook for a business context." Rejected. The model instead says: **you never disable — you relocate.** If you'd ever want a hook *off* in some context, it was never an invariant, so it doesn't belong at the factory; it belongs as a **call-site hook at the specific call sites that want it.** The design *forces* correct placement of effects.

**Worked example — the crammed `meetings` create.after (`server-spec.ts:69-97`, one anon fn doing 4 things) splits:**
- **Factory (invariant, every origin):** `addOwnerParticipant`, `syncGcal`, `graduateFromCampaign`.
- **Call-site (only the booking tRPC procedure):** `metaCapi` "Schedule" event — a job/backfill writing a meeting must *not* fire a conversion event, so it was never invariant. This dissolves the "should a job fire Meta CAPI?" ambiguity **by placement**, not a flag.

### 3.5 CRUD-based abstractions — the anti-ad-hoc pattern (user's insight)

Context-specific behavior is **neither** a factory invariant **nor** an ad-hoc raw-`db` function. It is a **named, reusable DAL function that wraps a CRUD handler with a call-site hook** — "DAL functions BASED ON our CRUD DAL while still being abstracted":

```ts
// entities/proposals/dal/server/mutations.ts — based ON crud, not around it
export const updateProposalFinancials = (ctx, id, data) =>
  proposalCrud.update(ctx, { id, data }, { after: recomputeFinancialsHook })
```

Every context that needs that behavior calls the abstraction; nobody writes the table raw. This is the sanctioned replacement for the scattered raw `db.update(proposals)` and for one-off feature-DALs. (Note: recompute *specifically* turns out to be a factory invariant, not this pattern — see §6 — but the pattern stands as the general tool for genuinely non-invariant reusable behaviors, e.g. `setCashInDeal`.)

### 3.6 Low-level raw primitive — narrow, honest charter (user accepted)

A single, documented, **no-hook** write primitive exposed by the factory (e.g. `meetingCrud.raw.create`), **never reachable from a client-facing procedure.** Its legitimate domain is exactly two things, both non-client, system-level:
1. **Infra bulk ops** — seeds, migrations, backfills (a backfill must not fire 10k GCal syncs).
2. **In-DB computed-convergence writes** — SQL-expression rollups like `finalTcpCents` that aren't expressible as scalar `column = value` (§6).

It is the **sole** skip door; business call-sites stay additive-only (§3.2).

### 3.7 Transactions (G1) — the mechanism

The factory owns the write boundary and opens one `tx` per mutation; hooks receive `tx`-bound handlers. **DAL handlers must accept and propagate an optional `tx`** so an orchestrator (service or tRPC) or a parent hook can thread **one** transaction through **many** DAL calls (cross-entity atomicity). This is "predictable from any origin" made concrete: atomicity is a DAL-boundary capability, not something each caller reinvents.

**Missing/undecided (see §9):** external side-effects dispatched from hooks (QStash jobs, Ably publish) must **not** run inside the tx (a job could execute before commit). The model needs an explicit **after-commit** phase distinct from in-tx `after`. Not yet grilled.

---

## 4. The gap catalog (G1–G8) — cross-entity evidence

Each is a structural reason a mutation goes off-toolkit. Evidence spans all core entities.

- **G1 — No transaction threading.** No hook receives a `tx`; the toolkit never opens `db.transaction`. Every cross-entity write, cascade, and delete-then-insert is non-atomic. Evidence: customers `delete.before` cascade "No transaction wraps the cascade" (`customers/lib/server-spec.ts:108-142`); proposals `duplicate` override still non-transactional (`duplicate.ts:30-49`). **→ solved by §3.1/§3.7.**
- **G2 — Side-channel non-column input.** Insert/update schemas are strict `ZodObject`; a payload field that isn't a column can't ride through. `scopeIds` alone is why projects never adopted `createCrudRouter` (`projects/lib/server-spec.ts:12-15`). **→ modeling call: is the child-set part of the parent resource (DAL owns parent+child write, in-tx) or its own resource (own DAL, orchestrator composes)? Either way, never inline `db`.**
- **G3 — Multi-row / child-table replace.** `duplicate` copies only the parent; no "replace child set" slot. `setProjectScopes` del+ins (`projects/dal/server/mutations.ts:15-28`); `replaceProposalIncentives` (tx del+ins + recompute). **→ in-tx via §3.7.**
- **G4 — delete hooks receive only `id`, not the row.** Forces a manual re-read for any delete side-effect needing row data: meetings `gcalEventId` (`meetings/lib/server-spec.ts:177-187`); projects R2 media cleanup reads `media_files` (`deleteProject`). **→ solved: delete hook gets the row via `crud.getById` in-tx (§3.1).**
- **G5 — Per-call permission/actor variance.** Fixed `SLOT_ACTIONS` map; no per-call action/subject override; no branch on caller *channel*. Evidence: customers `search` uses `manage all` as a non-visibility signal + gates the phone output column (`customers.router/business.router.ts:100-130`); proposals `applyEnvelopeContext` channel-branched field auth (`contracts.router.ts:192-197`). **→ NOT a DAL gap. Orchestrator + #285 (§2, §9). DAL stays actor-agnostic.**
- **G6 — Cross-entity write as one operation.** Pervasive. **→ NOT a gap to absorb. Legitimate orchestration above CRUD (§2).**
- **G7 — empty-`.set()` throws in `updateImpl`.** Drizzle's `mapUpdateSet` filters `Object.entries(data)` and throws "No values to set" **before** `$onUpdate` columns are force-included (`create-crud-dal.ts:95-145`). Reachable via a side-channel-only/partial update. projects' bespoke `updateProject` had to add an `Object.keys(data).length` guard. **→ the extended update impl must treat empty/side-channel-only partial updates as first-class.**
- **G8 — Server-only / derived columns can't be persisted through CRUD.** Surfaced from the recompute investigation (§6). Two sub-problems:
  - **G8(i) Permission-via-schema.** Derived columns (e.g. `finalTcpCents`) are omitted from the writable schema *to stop clients writing them* (`schema/proposals.ts:129`, inherited `server-spec.ts:21`); `updateImpl` parses through that schema (`create-crud-dal.ts:125`) so a legit server write is stripped. But "who may write this column" is **authorization** — it belongs at **orchestrator + field-level CASL (#285's `assertCanUpdateFields`)**, not baked into the DAL write schema. **→ proposed: make the DAL write schema complete; enforce client-prohibition via CASL field-authz; hooks/`SYSTEM_CONTEXT` write derived columns through CRUD; unifies with G5/#285.** (Open — Q10.3.)
  - **G8(ii) Scalar-only writes.** CRUD `.set({ col: value })` can't express a SQL-expression convergence write (`SET x = (SELECT …)`). **→ legitimate low-level-primitive domain (§3.6).**

---

## 5. Per-entity business invariants — the placement map

The behavior each entity carries, sorted by where the model says it belongs. This is the raw material for the migration (every item currently in a spec-hook, feature-DAL, service, or router must be re-placed).

**proposals**
- create.before: derive `kind` from linked meeting, generate share `token`, snapshot SOW (`snapSowFromMeeting`) → **factory invariant (before)**.
- financial rollup `recomputeProposalFinancials` → **guarded factory invariant (after)** — fires iff `startingTcpCents`/`projectJSON` in input (§6). Write-back of the derived `finalTcpCents` → **low-level primitive** (server-only + SQL-expression).
- lock ladder (`touchesFrozenLockedFields` → throw `precondition-failed`) → **factory invariant (before, precondition gate)**.
- incentives replace (`replaceProposalIncentives`) → **child multi-row, in-tx (G3)**; triggers recompute.
- `setCashInDeal` narrow scalar → **candidate to route through CRUD** (`cashInDealCents` IS writable; raw today only by the narrow-scalar seam ruling).
- `ai/client.ts:106-114` projectJSON write → **true bypass to fix** (writes a financial-input column raw, skipping recompute; safe today only because it writes `summary`/`energyBenefits`, not financial terms).

**meetings**
- create.before: server-force `ownerId` (CASL-branched, `resolveMeetingOwnerId`) → **factory invariant (before)**.
- update.before: derive `pipeline` from `meetingOutcome` (`OUTCOME_PIPELINE_MAP`) → **factory invariant (before)**.
- create.after: `addOwnerParticipant`, `syncGcal`, `graduateFromCampaign` → **factory invariants (after)**; `metaCapi` Schedule → **call-site (booking procedure only)**.
- update.after: `syncGcal` (guarded on GCal-affecting fields) → **factory invariant**; `notifyMeetingTimeChanged`, Ably publish → **after-commit / orchestration** (see §9 after-commit gap).
- delete.before: capture `gcalEventId` + dispatch delete → **factory invariant (delete, needs row via G4)**.

**customers**
- update.before: geocode-cache invalidation (null lat/lng/geocodedAt on address change) → **factory invariant (before)**.
- delete-cascade (proposals + meetings; FKs `set null` not cascade) → **referential integrity → write impl/tx, non-skippable** (not a skippable hook).
- update.after: `propagateCustomerChangeJob` → **after-commit / orchestration**.
- `createFromIntake` (side-channel `notes`/`mode`/`leadSourceSlug`/`leadMetaJSON` + multi-entity orchestration) → **service** (`customerIntakeService.ingestLead`).

**projects** (the case study)
- `scopeIds` side-channel (G2) + `setProjectScopes` child-replace (G3) → **DAL parent+child write, in-tx**.
- R2 media cleanup on delete (reads `media_files` before cascade) → **delete invariant needing the row (G4)**; ordering: delete R2 objects before DB cascade wipes `media_files`.
- `business.create`: proposal-gate (≥1 proposal on meeting) + customer read + derived `slug`/`accessor` + cross-write meeting (`meetingCrud.update` outcome=converted) + scope link → **tRPC orchestration composing DAL calls** (the two `BYPASS(crud)` reads are cross-entity reads, fine as orchestration).
- `accounting.service.ensureProjectSubCustomer` `db.update(projects, { qbSubCustomerId })` → **true bypass to fix** (route through projects DAL).

**customer-notes**
- create.before: stamp `authorId` + cross-scope visibility probe (rebuilds ctx) → **factory invariant (before)**.
- update/delete.before: author-or-admin gate → **factory invariant (before, precondition)**.

**Cross-cutting scope realization:** this refactor is **not only** "extend the interface." It is **also a large migration** — relocating hooks off *every* entity's spec into its `crud.ts` factory invocation, and re-placing each behavior per the map above. Sizing/sequencing must account for that (§9).

---

## 6. Recompute case study — the worked example (agent-verified facts)

The user suspected the proposal financial recompute was mis-implemented ("there should never be a hook loop"). A parallel investigation confirmed the instinct and reframed it:

- **No hook loop exists, and none is possible.** update.after recompute is **already guarded on input columns** (`proposals/lib/server-spec.ts:89-93`): fires only if `startingTcpCents` or `projectJSON` is in the write. A write-back sets only `finalTcpCents` → trips neither → wouldn't re-fire. **Recompute is already a guarded factory invariant** firing from any origin exactly when a financial *input* changes — which IS the §3.2 model, already working.
- **The raw `db.update` is legitimate, not a bypass to eliminate:** (i) `finalTcpCents` is deliberately off the writable schema (server-only derived; `schema/proposals.ts:129`) → `proposalCrud.update` would strip it; (ii) the write is a single in-DB SQL expression over child `proposal_incentives` rows (`mutations.ts:31-40`), idempotent ("verify = repair") — not a scalar `column=value`. This is the textbook **low-level-primitive** case (§3.6).
- **Financial input-set vs output-set:** INPUTS = `startingTcpCents`, `proposal_incentives` discount rows, `projectJSON.sow[].financials.incentives` (dying in JSONB Wave 4). OUTPUT = `finalTcpCents` only. `cashInDealCents`/`depositAmountCents`/`miscPriceCents` are funding columns but **NOT** finalTcp inputs — which is why `setCashInDeal` correctly does not recompute.
- **Take-away:** recompute stays a **guarded factory invariant**; the abstraction pattern (§3.5) is for non-invariant behaviors. The generalizable gap this exposed is **G8**, not re-entrancy.

---

## 7. Decisions locked (this session)

1. Phase 2 deliverable = **cross-entity interface-gap requirements** (not projects-only, not full design). Update the epic's Phase 2 AC from "projects-only" to "cross-entity."
2. **Layering model** (§2) is the governing architecture. DAL = universal chokepoint; service = reusable pre-orchestration; tRPC = 1-off client orchestration. Target = "nothing writes a resource except through the DAL." Cross-entity orchestration stays above CRUD.
3. Permissions/actor variance = **orchestrator + #285**, DAL actor-agnostic (§2, G5). Not redesigned here.
4. **Hooks move off `EntityServerSpec` onto the `createCrudDal` factory invocation** via a **builder over `(crud, tx)`** (option iii). Spec becomes pure declarative identity; `hooks` and `duplicate.overrides` leave the type (§3.1).
5. **Two-layer additive hooks** — factory (invariant) + call-site (additive-only) (§3.2).
6. **Onion ordering + payload threading**; `after` hooks return the threaded result (§3.3).
7. **Prohibit-by-inversion** — never disable, relocate to call-sites (§3.4).
8. **CRUD-based abstractions** are the anti-ad-hoc pattern (§3.5).
9. **Low-level raw primitive** — two-part charter (infra bulk + in-DB convergence), sole skip door, never client-facing (§3.6).
10. **Recompute** stays a guarded factory invariant; its raw derived-write is sanctioned, not a bypass (§6).

---

## 8. Open questions (unresolved — start here)

- **Q10.1** — Confirm: low-level primitive charter = infra bulk **+** in-DB computed-convergence writes (the two-part scope). *(Leaning yes.)*
- **Q10.2** — Confirm: recompute stays a guarded **factory invariant** (not the abstraction pattern). *(Agent findings support yes.)*
- **Q10.3 (the live fork)** — G8(i): protect derived/server-only columns via **field-level CASL (#285)** with a **complete DAL write schema** (recommended — unifies with G5/#285) — **vs.** keep a **separate server-authoritative write schema** per entity (two schemas). *Not yet decided.*
- **Q9 (resolved by §6):** "financial consistency by convention vs factory-invariant guard" — resolved: recompute is already a guarded factory invariant; keep it.

---

## 9. What's still missing / not yet grilled

1. **After-commit phase for external side-effects.** Hooks dispatch QStash jobs + Ably publishes; these must run **after** the tx commits, not inside it. The model currently has in-tx `after` only. Needs an explicit `afterCommit` phase (or a post-commit dispatch queue). **Not designed.**
2. **Cross-entity transaction propagation — concrete mechanism.** Handlers accept optional `tx`; but how a proposal hook writing a meeting threads the *same* tx (and how the builder exposes `tx`-bound other-entity handlers) needs a concrete shape.
3. **`createCrudRouter` interaction with call-site hooks.** Generated router procedures call bare handlers (invariants only). A procedure needing a call-site hook uses an **abstraction DAL fn** (§3.5) or a slot override. This path isn't fully specified.
4. **Typing story.** Generic builder over the table; typed threaded hooks; typed call-site `{ before, after }` options; keeping `satisfies EntityServerSpec` inference on the now-pure spec. Real work, unspecified.
5. **`duplicate` slot.** `duplicate.overrides` (behavior) moves to the factory builder; interaction with two-layer hooks + tx not detailed.
6. **Reads are out of scope** (bespoke, `ctx.scope`-driven, `list` not CRUD) — confirmed, but note the boundary so the fresh session doesn't re-open it.
7. **Migration scope + sequencing.** This touches every core entity (hook relocation) + depends on #285 for the permission pieces (G5, G8(i)). Order: likely projects (case study) → proposals/meetings/customers hook-relocation, with #285 landing the CASL field-authz before G8(i)/G5. Needs a real phase plan.
8. **`setCashInDeal` and `ai/client.ts:106` cleanups** — catalogued (§5); decide whether they route through CRUD/abstraction in this line or defer.
9. **The complete "true bypass" register** to eliminate: `accounting.service.ts:120`, `providers/ai/client.ts:107`, `compliance.service.ts:68,83`, `voip-link-tokens.service.ts:186`, projects feature-DAL, and the `INSERT…ON CONFLICT` upserts (`customers/dal/server/mutations.ts:88,117`) — the last aren't a CRUD slot and may need an `upsert` capability decision.

---

## 10. Coordination + ADR candidates

- **#285 (CASL scope-compiler)** owns G5 and the G8(i) field-authz. Sequence this line so the permission pieces land after #285's relevant phases. Do not build on the retiring visibility seams (see `memory/project-projects-standardization-epic.md`).
- **ADR candidates** (offer once the design firms — not yet, design is incomplete):
  - "Hooks belong to the CRUD factory invocation, not the entity server-spec" — refines **ADR-0002**. Hard to reverse (touches every entity), surprising without context, a real trade-off (typing cost vs layering correctness).
  - "DAL is the universal resource chokepoint; orchestration lives in services + tRPC" — refines/clarifies **ADR-0003**.
  - "Server-only/derived columns are protected by field-level CASL, not schema omission" (if Q10.3 lands that way).

---

## 11. Session provenance

Grill session 2026-08-12, model made judgment errors near the end (prompting this clean handoff). All decisions above are the user's rulings or agent-verified facts. The recompute investigation was a dispatched sub-agent (findings in §6). A fresh session should treat §7 as settled, §8 as the immediate agenda, and §9 as the backlog.
