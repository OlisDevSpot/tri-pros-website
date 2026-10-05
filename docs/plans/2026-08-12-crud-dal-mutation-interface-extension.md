# CRUD DAL Mutation-Interface Extension — Epic Index

> **What this is:** the epic index for extending `createCrudDal` so the generic entity toolkit becomes the real, hook-guarded, transactional write-chokepoint for every core entity. The cross-cutting **architecture is locked** (§3 model, §5 decisions). The work is split into **four sub-plans** (§6): three **infrastructure** sub-plans (A/B/C) that each got their **own dedicated grill/brainstorm**, and one **adoption** sub-plan (D) that wires everything into the entities. **A + B shipped; C (`afterCommit`) is deferred (2026-08-19)** — the engine stays naked + sequential and B's `ctx.tx` is the minimal, ad-hoc tx capability (§6-C). **D was itself grilled (2026-08-19)** — despite the "mechanical" label it invents named DAL abstractions and standardizes a bespoke entity; the grill **killed the two-schema / "trusted-write" subsystem** (§5.2/5.4, G8 — proven zero consumers) and redrew D as a **non-blocking boundary** with no #285/tx dependency inside it (§6-D). **✅ D SHIPPED 2026-08-19** (commits `0e66b7b6..7aca28ca` on `main`): hooks relocated off the spec for customers/proposals/customer-notes, `synthesizeFromSpec` deleted, `EntityServerSpec` purged of `hooks`/`duplicate`, lead-sources standardized, projects lifecycle routed through `projectCrud`. **D-c (non-tx bypass elimination) was DEFERRED out of D** — still open (see the master roadmap). Master index: `docs/plans/2026-08-20-backend-refactor-roadmap.md`.
> **Parent line:** `memory/project-crud-mutation-standardization.md` → `docs/plans/2026-08-11-projects-standardization-epic.md` (Phase 2) → this doc. This is **Projects Standardization Epic — Phase 2**, widened by user directive from projects-only to **cross-entity**.
> **Coordinates with:** `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (#285 — owns permissions/scope). Refines **ADR-0002** (Entity Server System) + **ADR-0003** (backend layers) — ADRs written when each infra sub-plan firms (§7).
> **How to use this doc:** §1–§5 are the shared, settled foundation every sub-plan inherits — read them once. §6 is the four sub-plans. Each infra sub-plan (A/B/C) opens its own grill using §3/§5 as given, and produces its own spec + plan. D was **grilled 2026-08-19** (it was not the rubber-stamp the "mechanical" label implied) and produces one plan — its corrected boundary is §6-D.
> **✅ Doc staleness RESOLVED (2026-08-20):** the earlier warning here — that `src/trpc/DOCS.md` "Lifecycle Hooks" still documented hooks on `EntityServerSpec.hooks` — is retired. Sub-plan D-b (`43f7dec9`) rewrote `src/trpc/DOCS.md` to the config-factory model; DOCS now match code.

---

## 1. What this is & where it sits

**The problem in one line:** today `createCrudDal(spec)` gives a new entity 5 autocommit slots with hooks bolted to the *spec* — a shape that structurally *forces* entities to write around it, so `EntityServerSpec.hooks` silently never fire. This epic makes the CRUD DAL the universal write door so a new entity gets correct, hook-guarded, transactional mutations out of the box.

**Where it sits in the nested epic sequence:**

```
tRPC Standardization Epic ─────────────── S1–S7 ✅ shipped
  │  (createEntityRouter / EntityToolkit / entity-registry DELETED in S7)
  └─ S8 ─┬─ Projects Standardization Epic
         │    ├─ Phase 1  ✅ structure migration (projects DAL consolidated; still bypasses CRUD)
         │    ├─ Phase 2  ✅ THIS DOC — A/B shipped, C deferred, D shipped (2026-08-19)
         │    ├─ Phase 3  🟡 core shipped via D-e; residuals (media/gdrive/business/accounting) remain
         │    └─ Follow-up ⬚ Proposal Financials Consolidation  (gated on JSONB Wave 4 — §8)
         └─ Lead-sources half — ✅ DAL/entity standardized in D-d; router-shape residual
  ⟂ coordinates with #285 CASL Scope-Compiler (Phase 0 only) — owns permissions (§7)
```

This work builds on the **post-S7 toolkit** (`createCrudRouter` inline-scoped + `createCrudDal(spec)` + `EntityServerSpec`) — no conflict; the old toolkit is already deleted. It **does** change `EntityServerSpec` itself (sub-plan A).

**User's framing directives (still governing):** don't preserve back-compat at the expense of a better generic interface; don't paper over with thin ad-hoc constants/functions — find what blocks the *generic* interface and fix that; analyze the real business requirements per entity.

---

## 2. Problem statements

The distinct problems this epic exists to solve (each grounded in code):

1. **Mutations bypass CRUD → spec hooks never fire.** The central problem: invariants, derived fields, and side-effects are silently skipped. Projects & lead-sources bypass CRUD entirely; ~20 bespoke write sites exist.
2. **The spec-carries-hooks circular barrier.** `meetingCrud = createCrudDal(meetingServerSpec)` — a hook defined *inside* the spec can't reference `meetingCrud` (doesn't exist yet), so it reaches for raw `db` ([meetings/lib/server-spec.ts](src/shared/entities/meetings/lib/server-spec.ts) `delete.before` raw `db.select`). The layer forces the bypass.
3. **No transaction threading (G1).** Module-level `db` singleton ([create-crud-dal.ts:27](src/shared/dal/server/lib/create-crud-dal.ts#L27)); `ScopedContext` has no `tx`; only 6 isolated `db.transaction` islands, none composable. Every cross-entity write / cascade / delete-then-insert is non-atomic.
4. **Side-channel non-column input (G2).** Strict `ZodObject` schemas reject payload fields that aren't columns — `scopeIds` alone is why projects never adopted `createCrudRouter`.
5. **Multi-row / child-table replace has no slot (G3).** `duplicate` copies only the parent; no "replace child set."
6. **Delete hooks receive only `id`, not the row (G4).** Forces manual re-reads for delete side-effects (`gcalEventId`, R2 media cleanup).
7. **empty-`.set()` throws in `updateImpl` (G7).** Drizzle's `mapUpdateSet` throws "No values to set" *before* `$onUpdate` cols are force-included ([create-crud-dal.ts:127](src/shared/dal/server/lib/create-crud-dal.ts#L127)); reachable via side-channel-only partial updates. Only [updateProject](src/shared/entities/projects/dal/server/mutations.ts#L65) hand-guards it today.
8. **Server-only / derived columns can't persist through CRUD (G8).** `updateImpl` parses through a schema that omits them to stop client writes → a legitimate server write is stripped; and scalar-only `.set()` can't express a SQL-expression convergence write.

Explicitly **not** problems for this epic (do not absorb into CRUD): per-call permission/actor variance (G5 → orchestrator + #285) and cross-entity writes (G6 → legitimate orchestration above CRUD).

---

## 3. The architectural model (locked — inherited by all sub-plans)

This is the spine. Every sub-plan grill takes it as given.

**3.1 Layering.** DAL (CRUD) = the **universal resource chokepoint**: every write to a resource, any origin (tRPC / service / job / webhook), goes through the DAL. **"Any actor, any origin, same resource, same way."** Service = reusable pre-orchestration (origin-agnostic). tRPC procedure = client-origin, one-off orchestration. The target is **not** "kill business routers" — it is **"nothing writes a resource except through the DAL."** Cross-entity orchestration (composing DAL calls) legitimately lives *above* CRUD and must not be absorbed into it (that rots the toolkit into a god-object).

**3.2 Permissions are an orchestrator concern.** The DAL stays **actor-agnostic** — it consumes a resolved permission context (scope + ability) passed in; it never resolves or checks permissions. The machinery is **#285's CASL scope-compiler**. We coordinate; we do not redesign permissions here.

**3.3 Hooks move OFF the spec, onto the factory invocation.** The root-cause fix. Hooks are defined at `createCrudDal(spec, configFactory)` where `configFactory = (crudHandlers) => ({ hooks, duplicate })` — a **config factory** receiving the produced handlers (late-bound; see 5.12). `tx` is **not** a config-factory arg — it rides on `ctx` (5.6). The spec becomes **pure declarative identity** (`entityName, caslSubject, visibility, table, schemas, primaryKey?, shareable?, parent?`); `hooks` and `duplicate.overrides` leave the type. This kills the circular barrier (hooks call `crud.*`, not raw `db`) and purifies the spec.

**3.4 Two-layer additive hooks.** Factory hooks = **invariant** (always run, every origin). Call-site hooks (`crud.create(ctx, input, { before, after })`) = **additive-only** (add behavior, never remove). Default (no options) = every invariant fires. No named-hook maps, no skip flags, no skip taxonomy.

**3.5 Onion ordering + payload threading.** `factory.before → callsite.before → [validate → write] → callsite.after → factory.after`. Factory is outer. The threaded value passes hook-to-hook — never the original input. **`after` hooks receive and return the threaded result** (no longer `void`) — this natively fixes the proposals duplicate-with-incentives manual `finalTcpCents` merge.

**3.6 Prohibit-by-inversion.** You never disable a hook — you relocate it. If a hook could ever be "off" in some context, it was never an invariant → it belongs as a call-site hook at the sites that want it. Corollary: a behavior that must apply to *every* invocation of a slot is a factory invariant by definition.

**3.7 CRUD-based abstractions.** Context-specific reusable behavior = a **named DAL function wrapping a CRUD handler with a call-site hook** (`updateProposalFinancials = (ctx,id,data) => proposalCrud.update(ctx,{id,data},{after: recomputeHook})`). The sanctioned replacement for scattered raw `db.update` and one-off feature-DALs. "Based ON our CRUD DAL while abstracted."

**3.8 Where multi-write composition lives — aggregate-internal vs cross-entity.** A mutation that touches more than one table is *not* automatically "orchestration above CRUD." Split by whether the extra table is a **child of the same aggregate** or a **separate entity**:

| Write shape | Example | Home |
|---|---|---|
| Single owning-table row | project columns | `crud.*` — pure single-table door |
| **Aggregate-internal child set** (join/child rows the entity owns; may reference read-only catalogs) | `x_projectScopes` (project↔scope links), `proposal_incentives` | **§3.7 DAL abstraction** (`setProjectWithScopes`, `replaceProposalIncentives`) — composes `crud.*` + a plain-`db` child-replace fn (5.9) in one tx |
| **Cross-entity** (≥2 independent resources) | project **+** meeting; proposal-gate then project create | **tRPC / service** orchestration above CRUD (G6) |

**Test:** does the second table have independent entity identity, or is it meaningless without its parent? Aggregate-internal → DAL abstraction. Independent → orchestrator. The god-object hazard (§3.1) is about pulling *cross-entity* writes into the **generic toolkit** — it does **not** apply to a *separate, entity-specific* abstraction that composes its own aggregate.

**tx ownership is orthogonal to placement.** The orchestrator (tRPC/service) owns `db.transaction()` and passes a tx-bound `ctx` (5.6); the DAL abstraction merely *participates* via `withTx(ctx)` — reusing `ctx.tx` when present, opening its own only for a standalone call. So "needs a tx across two writes" does **not** force the composition up to tRPC. **Reusability decides:** the same aggregate op is needed from ≥2 origins — project scopes from both the edit form ([crud.router.ts:57](src/trpc/routers/projects.router/crud.router.ts#L57)) and create-from-meeting ([business.router.ts:78](src/trpc/routers/projects.router/business.router.ts#L78)) — so it lives once, below the origin layer, callable from tRPC/services/jobs alike. A `projects.router/scopes.router` owning the composition was considered and rejected: the create-from-meeting origin could not reuse it without duplication.

---

## 4. Gap catalog (G1–G8) — mapped to problem & closing sub-plan

| Gap | What | Evidence | Closed by |
|---|---|---|---|
| **G1** | No transaction threading | customers `delete.before` cascade "no transaction" ([customers/lib/server-spec.ts:114](src/shared/entities/customers/lib/server-spec.ts#L114)); proposals `duplicate` non-atomic | **B** |
| **G2** | Side-channel non-column input | `scopeIds` blocked projects' `createCrudRouter` adoption | **A** (builder) + **D** (callsite **closure** in a named abstraction — 5.11; the engine stays column-pure, **no per-entity "extra input" modeling**) |
| **G3** | Multi-row / child-table replace | `setProjectScopes` del+ins; `replaceProposalIncentives` | **D** (named abstraction = `crud.*` + inline `after` child-set, **non-atomic** — the in-tx version is deferred with C/crux-2) |
| **G4** | delete hook gets only `id`, not row | meetings `gcalEventId`; projects R2 cleanup | **A** (row via `crud.getById` in-tx) |
| **G7** | empty-`.set()` throws | [create-crud-dal.ts:127](src/shared/dal/server/lib/create-crud-dal.ts#L127); [updateProject guard](src/shared/entities/projects/dal/server/mutations.ts#L65) | **A** (update-impl hardening) |
| **G8(i)** | Server-only cols stripped by write schema | `finalTcpCents` omitted → server write stripped ([create-crud-dal.ts:125](src/shared/dal/server/lib/create-crud-dal.ts#L125)) | ~~D (two-schema split)~~ **OVERTURNED 2026-08-19** — no scalar server-only col needs a trusted engine path; the column is written by **one naked DAL writer** and kept **absent from every editable schema** (already how `finalTcpCents` works — DOCS.md:192). Field-authz (which *user* writes which field) stays **#285**. See §5.2/5.4. |
| **G8(ii)** | Scalar-only `.set()` can't express SQL convergence | `recomputeProposalFinancials` `SET x = (SELECT…)` | **D** — stays plain `db` (§5.1); this is *why* even a trusted schema could never carry it (a `sql\`…\`` expression can't pass Zod `.parse()`) — the naked writer is correct by construction, not a workaround. |
| **G5** | Per-call permission/actor variance | **NOT a DAL gap** → orchestrator + #285 | — |
| **G6** | Cross-entity write as one op | **NOT a gap** → legitimate orchestration above CRUD | — |

---

## 5. Final decisions (settled — inherited by all sub-plans)

- **5.1 · No `crud.raw` door (Q10.1).** The "one raw primitive, two uses" charter is dropped — it conflated bulk (skip-hooks-for-volume) with convergence (SQL-expression to a protected column). Convergence + bulk stay **plain `db.*` writes for now**; `recomputeProposalFinancials` stays exactly as-is. A future `crud.bulk` primitive is **deferred** (no bulk paths exist yet).
- **5.2 · Two-schema split for server-only columns (Q10.3). — ⛔ OVERTURNED 2026-08-19 (D grill).** The split was machinery for a problem with **zero consumers**. Investigation: `finalTcpCents` is the codebase's only server-only scalar, and it's written by a **`sql\`GREATEST(0, …subqueries…)\`` expression** ([mutations.ts:31](src/shared/entities/proposals/dal/server/mutations.ts#L31)) that a Zod-parsed "permissive schema" could never carry anyway (G8(ii)); every *other* server-only/derived field is already handled by **absence from the editable schema + a single naked DAL writer** (`finalTcpCents` — DOCS.md:192; proposals `kind` — omitted from insert schema) or **JIT-derived-never-materialized** (meetings deal-derived). **Sanctioned pattern instead:** a server-only column is written by *one* hand-written DAL function using naked `db` (which **is** the DAL chokepoint per §3.1 — `createCrudDal` is a generator for the common case, not the only permitted writer) and kept off every editable schema. No trusted-schema engine path, no `EntityServerSpec` change. The `@deprecated RETIRING(#285)` two-schema idea only ever had a *second* rationale — field-level authz interim — which is **#285's** axis (§7), not this epic's.
- **5.3 · Recompute stays the existing naked-`db` choke point (Q10.2). — REVISED 2026-08-19.** It already *is* a single naked DAL writer ([`recomputeProposalFinancials`](src/shared/entities/proposals/dal/server/mutations.ts#L26)), scope-agnostic + idempotent (verify = repair), fired from its 4 call sites (create.after, guarded update.after, incentives-replace on a *different* entity, duplicate). D does **not** wrap it in a new `updateProposalFinancials` abstraction or route it through crud — it is left exactly as-is and *sanctioned* as the naked-writer pattern (5.2). The hooks that call it (proposals create.after/update.after) relocate onto the config factory unchanged (D-a).
- **5.4 · Enforcement by absence, not by convergence (was 5.1 × 5.2 × 5.3). — ⛔ OVERTURNED 2026-08-19 (D grill).** The "two-schema split makes the abstraction the sole door" mechanism is dead with 5.2. The enforcement that actually holds — and already ships — is simpler and **stronger**: `finalTcpCents` is **absent from every editable schema**, so the CRUD engine's own runtime `.parse()` ([create-crud-dal.ts:179](src/shared/dal/server/lib/create-crud-dal.ts#L179)) **strips it even against an `as any` force-cast**, and exactly one naked writer sets it (DOCS.md:192). Staleness stays structurally impossible via absent-from-schema + single-writer — no trusted path, no engine change. (Child-table incentives: same "the incentives mutation always recomputes" guarantee, unchanged.)
- **5.5 · `afterCommit` phase (§9.1).** Explicit third hook phase alongside `before`/`after`, on both layers, onion-ordered like `after`. Order: `before → write → after (in-tx) → COMMIT → afterCommit`. **Side-effect-only**: receives the committed row read-only, returns `void` (outside threading), a throw is **logged, not propagated**. Durability = best-effort after-commit (transactional-outbox rejected as over-machinery). QStash/Ably dispatches move here.
- **5.6 · `tx` rides on `ctx` (§9.2).** Optional `ctx.tx`; every impl executes on `(ctx.tx ?? db)`. **The orchestrator (tRPC procedure / API route / service) owns `db.transaction()`** and passes the tx-bound `ctx` down; the factory/abstraction opens its own tx (via `withTx`) **only** when `ctx.tx` is absent (standalone single-entity call). Cross-entity atomicity = the orchestrator passes one tx-bound ctx into each entity's handler. (Rejected: trailing `tx` param — forgettable; handler registry — needs a global registry. Refines the earlier "factory opens the transaction" wording — ownership is the caller's; B finalizes.)
- **5.7 · `createCrudRouter` stays hook-agnostic (§9.3).** Generated procedures call bare handlers → only factory invariants fire. A procedure needing call-site behavior is a bespoke slot-override calling a §3.7 abstraction or `crud.update(ctx, input, {before, after, afterCommit})` inline. No new machinery.
- **5.8 · `duplicate` slot (§9.5).** `duplicate.overrides` moves onto the factory builder; runs as one tx (create hooks fire); call-site hooks additive like any slot.
- **5.9 · Upserts stay bespoke DAL fns (§9.9).** `INSERT…ON CONFLICT` (customers) stay bespoke DAL functions — not client-facing, not the anti-pattern, no 6th slot — but must live in the entity DAL, never inline in a router/service.
- **5.10 · Aggregate-internal child sets = DAL abstraction, not tRPC (§3.8).** Join/child-row replacement owned by one entity (`x_projectScopes`, `proposal_incentives`) is a §3.7 DAL abstraction composing `crud.*` + a plain-`db` child-replace fn in one tx — **NOT** a tRPC procedure and **NOT** absorbed into the generic factory. Only genuinely cross-entity writes (≥2 independent resources) orchestrate above CRUD. The deciding factor is reusability across origins, not "it's two writes" (which tx-on-ctx handles regardless of layer). Rejected mid-grill: a `projects.router/scopes.router` owning the composition — the create-from-meeting origin can't reuse it without duplication.
- **5.11 · CRUD input stays strictly typed; no side-channel widening.** `crud.*` accepts only `Insert<T>`/`Update<T>` — never non-column keys (`scopeIds`). Side-channels are captured by the abstraction's **closure** (5.10), never by crud's typed input — so the generic builder needs **no** per-entity "extra input" generic and **no** before→after carry object. (Rejected: widening the door + a threaded carry — pulls child-table knowledge into the single-table handler, the god-object hazard.)
- **5.12 · Config factory is single-arg `configFactory = (crudHandlers) => ({ hooks, duplicate })`.** Named `configFactory` (the 2nd arg to `createCrudDal`; "builder" rejected as vague); its parameter is `crudHandlers`. `tx` is **not** a config-factory parameter — at construction time (module load) no tx exists; at call time it arrives via `ctx` (5.6). `crudHandlers` is **late-bound**: the factory builds the handlers object, runs `configFactory` with a reference to it, then the hook closures resolve `crudHandlers.*` when invoked (never at build time). Refines §3.3's earlier `(crud, tx)` sketch.
- **5.17 · Typing story (A's capstone).** `configFactory: CrudConfigFactory<TTable, TId> = (crudHandlers) => CrudConfig<TTable, TId>`; hooks + the whole `duplicate` config live in `CrudConfig`, with the threaded signatures (`create`/`update.after` return `Row<T>`; `delete.before`/`after` take the row). Exactly **one** new cast — the `{} as CrudHandlers<TTable, TId>` bootstrap for the late-bound self-reference, populated by `Object.assign` immediately after `configFactory` runs. Call-site options are **exported** types (`CreateCallsiteHooks<TTable>` / `UpdateCallsiteHooks<TTable>` / `DeleteCallsiteHooks<TTable>`, each carrying an `afterCommit?` field — A-stubbed, C-wired) so §3.7 abstractions can name them. The pure spec still `satisfies EntityServerSpec<typeof table>` (slimmer interface). **Bivariance cleanup (verify in A's plan, bonus-not-AC):** the `ts/method-signature-style` bivariant-method eslint-disables ([types.ts:120](src/shared/dal/server/types.ts#L120)) exist because hooks ride the spec that erases to `EntityServerSpec<PgTable>` at the `createCrudRouter` boundary; relocating hooks into `configFactory` (consumed at the concrete table type, never erased) should let strict `(fn) => U` signatures return and the disables be deleted. Zod↔Drizzle boundary cast unchanged; server-col-survives-parse is D's two-schema split (5.2).
- **5.15 · Delete hooks receive the row snapshot (G4).** Prefetch the target row **once** (loud-abort like update's `previousRow`; in-tx once B lands), and pass the **same pre-delete snapshot** to both `delete.before(row, ctx)` and `delete.after(row, ctx)`. Delete hooks stay **`void`** (the handler returns `DalReturn<void>` — nothing to thread); the row *is* the payload (no carry object, per 5.11). `before` runs **before** the `DELETE`, so R2-before-cascade (projects media cleanup) and `gcalEventId` capture (meetings) land before the DB cascade wipes related rows. Signature change `(id, ctx) → (row, ctx)` breaks the 2 specs using delete hooks (meetings, customers) — relocated in D. Prefetch only when a delete hook exists on either layer.
- **5.14 · Hook execution model (both layers, concrete — the §3.5 mechanics).**
  - **`before`:** factory (outer) → callsite (inner), each `Insert/Update → Insert/Update`; the **threaded** value is what gets `schema.parse`'d and written — never the original input.
  - **write:** per 5.13 (empty-data force-includes `$onUpdate`).
  - **`after`:** callsite (inner) → factory (outer), each `Row<T> → Row<T>`, a **return-value transform only** — enrichment fills *fresher column values* into the returned row (e.g. proposals' recompute writes `finalTcpCents` via its own statement per 5.1/5.3, then the hook merges `{ finalTcpCents }` into the returned row so the caller sees it fresh with no re-read). It is **not** a second `UPDATE` of the main row, and it **must stay `Row<T>`** (cannot widen — preserves the `CrudHandlers` return contract). This makes the duplicate-with-incentives merge free.
  - **`previousRow` prefetch** fires if **either** layer has an `after` (today gated on the spec hook only), keeping the loud-abort-before-write ([create-crud-dal.ts:110-123](src/shared/dal/server/lib/create-crud-dal.ts#L110)).
  - **`meta`** is identical across both layers: `{ previousRow, input }`, where `input` is the **original** `input.data` (a hook can compare what the caller asked vs. what enrichment produced).
  - **Default** (no call-site options) = only factory invariants fire (§3.4).
- **5.13 · `crud.update(ctx, { id, data: {} })` = real write of auto-managed columns (G7).** A column-less update is **first-class**, not a throw and not a no-op read: it emits a genuine `UPDATE` that force-includes `$onUpdate` columns (`SET updated_at = now()`) even with zero business columns, returns the fresh row, and fires `update.after`. Rule: *"you called `update` → `updatedAt` moves; you just set no business columns."* Semantics = **aggregate-touch** (consistent with §3.8 — a child-set change *is* an aggregate mutation). **⚠️ Business-rule change:** projects' current scopes-only edit deliberately does **not** bump `projects.updatedAt` ([updateProject `hasFields` guard](src/shared/entities/projects/dal/server/mutations.ts#L65)); this **flips** that — scopes-only edits now bump `updatedAt`. Deemed a correctness improvement (the old "don't bump" was an artifact of the join-write being a bolted-on side-channel). The hand-guard is deleted when projects route through CRUD (D). **Implementation note for A's plan:** Drizzle's `mapUpdateSet` throws before `$onUpdate` is consulted ([create-crud-dal.ts:127](src/shared/dal/server/lib/create-crud-dal.ts#L127)) — forcing the bump likely means the generic handler explicitly injects `updatedAt` on the empty-data path, a **localized, centralized** exception to `feedback-no-manual-updated-at` (never manually set `updatedAt` per-entity) that must be verified against Drizzle's actual `$onUpdate` behavior before adopting.

---

## 6. The four sub-plans

**Dependency spine:** `A → B → D` (**C deferred 2026-08-19**, see §6-C), with the **#285 gate** on D's permission-dependent slices and the **Financials Consolidation** follow-up downstream of the whole epic (§8).

```
A (factory builder) ──── B (tx threading) ──── D (adoption) ──▶ projects Phase 3 / lead-sources
                              ⋯ C (afterCommit) DEFERRED       ⟂ #285 field-CASL gate
```

A/B were **infrastructure** — each opened its **own grill/brainstorm** (own spec in `docs/superpowers/specs/`, own plan), inheriting §3/§5 as settled. **C (afterCommit) is deferred** (§6-C) — the engine stays naked + sequential; B's `ctx.tx` substrate is the minimal tx capability, threaded ad-hoc by the rare orchestrator that needs it. D is **adoption — one plan**, but it was **grilled (2026-08-19)**, not rubber-stamped: the grill killed the (b) two-schema subsystem, drew a **non-blocking boundary** (nothing inside waits on #285 or crux-2/tx), and folded projects back in as buildable-now (§6-D).

---

### Sub-plan A · Factory-builder hook relocation *(INFRA — needs its own grill)*

**Purpose:** invert hooks off the spec onto the `(crud, tx)` factory builder, and harden the update impl. The enabling change everything else builds on.

**Builds:**
- `createCrudDal(spec, (crud) => ({ hooks, duplicate }))` — the builder receiving produced handlers (late-bound; `tx` rides on `ctx` per 5.12, not a builder arg).
- Purified `EntityServerSpec` — `hooks` + `duplicate.overrides` leave the type ([types.ts:71-153](src/shared/dal/server/types.ts#L71-L153)).
- Two-layer additive hooks (§3.4) + onion ordering + payload-threaded `after` (§3.5).
- **Update-impl hardening (G7):** empty / side-channel-only partial updates first-class — guard the empty `.set()` at [create-crud-dal.ts:127](src/shared/dal/server/lib/create-crud-dal.ts#L127) so `$onUpdate` cols still apply.
- **G4:** delete hook receives the row (via `crud.getById`, in-tx once B lands).

**Closes:** problem 2 (circular barrier), G7, G4, unblocks G2's builder side.

**Lands on:** [create-crud-dal.ts](src/shared/dal/server/lib/create-crud-dal.ts) (5 slots, hook execution, updateImpl), [types.ts](src/shared/dal/server/types.ts) (`EntityServerSpec`, `CrudHandlers`), and the 4 specs that carry hooks (proposals, meetings, customers, customer-notes) at signature level only (full relocation is D).

**Depends on:** nothing. First.

**Grill — ✅ COMPLETE (2026-08-12→13). Full design → [`docs/superpowers/specs/2026-08-13-crud-dal-sub-plan-a-factory-config-hooks-design.md`](docs/superpowers/specs/2026-08-13-crud-dal-sub-plan-a-factory-config-hooks-design.md).** Resolved:
- ✅ **Config-factory shape** — 2nd arg `configFactory = (crudHandlers) => ({hooks, duplicate})`, single-arg, `tx` on `ctx`, late-bound (5.12; "builder" → `configFactory`).
- ✅ **Side-channels** — CRUD input strictly `Insert`/`Update`; handled by abstractions above CRUD (5.11).
- ✅ **Aggregate-internal vs cross-entity placement** — join/child-set = DAL abstraction, not tRPC (§3.8 / 5.10).
- ✅ **Empty-update (G7)** — `crud.update({})` real write of auto-managed cols; flips projects' scopes-only `updatedAt` (5.13).
- ✅ **Hook execution model** — two-layer onion, threaded `before`, `after` = `Row<T>→Row<T>` return-transform, either-layer prefetch, shared `meta` (5.14).
- ✅ **Delete gets the row (G4)** — one pre-delete snapshot to both `before`/`after`, `void`, `before` pre-`DELETE` (5.15).
- ✅ **One instance per entity; router consumes it (was 5.7/5.8)** — `crud.ts` builds `xCrud`; `createCrudRouter` takes required `crud`, drops its internal rebuild; whole `duplicate` config on the factory (5.16).
- ✅ **Typing story** — one bootstrap cast, `CrudConfig<TTable,TId>` threaded sigs, exported `*CallsiteHooks<TTable>`, bivariance-disable-drop attempt (5.17).

**Done-when:** one entity (proposals or meetings) fully runs on the builder with green tsc/lint, invariants firing, no raw `db` in its hooks.

---

### Sub-plan B · Transaction threading *(INFRA — needs its own grill)*

**Purpose:** make atomicity a DAL-boundary capability. `tx` rides on `ctx` (5.6).

**Builds:**
- Optional `ctx.tx` on `ScopedContext`; every impl executes on `(ctx.tx ?? db)` ([create-crud-dal.ts:27,56,77,127,161](src/shared/dal/server/lib/create-crud-dal.ts#L27), incl. the `getByIdImpl` prefetch inside `updateImpl`).
- Factory opens `db.transaction`, builds the tx-bound ctx once, threads it before→write→after.
- Cross-entity atomicity: pass the tx-bound ctx to another entity's handler.

**Closes:** G1; the mechanics for G3 (child-replace in-tx) and G4 (delete reads its row in-tx). Makes the customers delete-cascade and proposal duplicate+incentive-clone atomic.

**Lands on:** [create-crud-dal.ts](src/shared/dal/server/lib/create-crud-dal.ts), `ScopedContext` in [types.ts](src/shared/dal/server/types.ts). Reconciles the 7 existing `db.transaction` islands (verified 2026-08-18: media-files/media-ops, projects.router/media, applications/mutations, voip-dids/mutations ×2, push-subscriptions/queries, proposal-incentives/mutations).

**Depends on:** A (the `tx` the builder exposes is the tx-bound ctx).

**Grill — ✅ COMPLETE (2026-08-18). Full design → [`docs/superpowers/specs/2026-08-18-crud-dal-sub-plan-b-transaction-threading-design.md`](docs/superpowers/specs/2026-08-18-crud-dal-sub-plan-b-transaction-threading-design.md).** Resolved:
- ✅ **tx-bound-ctx shape** — `ScopedContext.tx?: Tx` (optional; `Tx = Parameters<Parameters<DB['transaction']>[0]>[0]`); every impl runs on `const exec = ctx.tx ?? db`, including internal prefetches (2.1).
- ✅ **Threading one tx through many DAL calls** — the orchestrator passes the same tx-bound `ctx` into each `crud.*` call; `withTx(ctx, fn)` reuses `ctx.tx` when present, else opens a fresh `db.transaction` (2.3). Raw-executor / inline-`db` hook writes don't auto-join — they need explicit `ctx.tx ?? db` (2.4; applying this per-entity is D).
- ✅ **`dalDbOperation` interaction / rollback boundary** — Approach A: reuse `dalVerifySuccess` inside `withTx` to re-throw a swallowed `ThrowableDalError` so the tx aborts; `dalDbOperation`'s catch/swallow logic is unchanged (2.2). Accepted cost: caller discipline (every composed `crud.*` must be unwrapped with `dalVerifySuccess`).
- ✅ **Nested-tx / savepoint policy** — reuse-or-open, never `tx.transaction()`; no savepoints (YAGNI) (2.3).

**Plan — ✅ SHIPPED (2026-08-18).** [`docs/superpowers/plans/2026-08-18-crud-dal-sub-plan-b-transaction-threading.md`](docs/superpowers/plans/2026-08-18-crud-dal-sub-plan-b-transaction-threading.md). Commits: `a8c63c10` (`Tx` type + `ScopedContext.tx?`), `95a7a393` (`withTx` helper), `3a17e4d6` (`exec = ctx.tx ?? db` across impls + prefetches), `f1fe7d6e` (meetings `INTERIM(C):` markers). Proof (throwaway script, disposed): rollback under forced not-found, happy-path reuse + flat nesting, standalone autocommit — all passed against the dev DB.

**Cross-Phase Ledger mirror (spec §5 — full table there):** the two `INTERIM(C):` markers (`helpers.ts` `withTx` JSDoc; meetings `dal/server/crud.ts` job-dispatch sites) are **NOT** retired by C — **C is deferred** (§6-C). They were rewritten (2026-08-19) into the permanent **hook caveat**: side-effects live inline in `after`, so threading a tx fires them pre-commit un-rolled-back — the wrapping call site owns that. `grep -rn "INTERIM(C)"` empty (renamed, not run). The `withTx` first *live* caller + any in-hook `ctx.tx ?? db` threading remain **ad-hoc, per-orchestrator** work, adopted only where a real atomicity need appears — no longer a scheduled sub-plan step.

**Done-when:** a cross-entity write (e.g. customers delete-cascade) is provably atomic under a forced mid-cascade failure.

---

### Sub-plan C · afterCommit phase *(⏸️ DEFERRED 2026-08-19 — grilled, not built)*

**Status:** deferred indefinitely after a full grill (design preserved at [`docs/superpowers/specs/2026-08-18-crud-dal-sub-plan-c-aftercommit-design.md`](docs/superpowers/specs/2026-08-18-crud-dal-sub-plan-c-aftercommit-design.md), with a DEFERRED banner). Not a blocker for D.

**Why deferred (north star):** `afterCommit` + a self-wrapping engine taxes **all ~100 future entities** — every author must reason about tx frames and which slot a side-effect belongs in — to serve cross-entity atomicity the codebase does not currently need. The three real orchestrations prove it: `ingestLead` and the customer delete-cascade *deliberately* want partial progress (atomicity unwanted); `setOutcomeWithReason` "should be atomic" but ships fine today with a `"saved but note failed"` 500. So the CRUD engine stays **naked + sequential**: a mutation is one autocommit write + inline hooks; side-effects fire inline post-autocommit and are safe because no enclosing tx exists. New-entity setup = spec + crud (with hooks) + optional router, **zero tx ceremony** — the thing that scales.

**What ships instead:** nothing new. **B already extended the crud handlers to accept a tx** (`ctx.tx ?? db` + `withTx`) — the "minimally required tx approach." It unblocks **ad-hoc** tx threading for the rare orchestrator that truly needs atomicity, *without* a system-wide slot.

**⚠️ Load-bearing caveat (replaces what C would have fixed):** with no `afterCommit` phase, a hooked mutation's external side-effects (QStash/Ably dispatches) live in `after` = **PRE-COMMIT** under a threaded tx, and are **NOT rolled back** if the tx aborts → the external system gets data for a write that never committed. Any orchestrator that threads a tx **must handle those hooks at the call site** (don't wrap the hooked mutation, or hoist the dispatch out of the tx). Canonical statement: the `withTx` JSDoc in [helpers.ts](src/shared/dal/server/lib/helpers.ts); per-site markers in [meetings/dal/server/crud.ts](src/shared/entities/meetings/dal/server/crud.ts).

**Revival trigger:** a genuine, *recurring* multi-write-atomic invariant (money, contracts, hard cross-entity constraint) whose call sites can't cleanly own their hooks. `afterCommit` is purely additive and B's substrate stays in place → reviving the preserved spec is low-regret and non-breaking.

**Consequence for B's Cross-Phase Ledger:** the two `INTERIM(C):` markers are **not** retired by C. They were rewritten (2026-08-19) from "pending relocation in C" into the permanent hook caveat above. `grep -rn "INTERIM(C)"` is expected empty (renamed, not because C ran).

---

### Sub-plan D · Adopt the new factory *(grilled 2026-08-19 — one plan; non-blocking boundary)*

**Purpose:** wire what A/B built into the entities. **Grill outcome:** the "mechanical" label was wrong — D invents named abstractions and standardizes a bespoke entity — so it was grilled. The grill (a) **killed the (b) two-schema/trusted-write subsystem** (§5.2/5.4, G8 — zero consumers; naked-writer is the sanctioned pattern), (b) **drew a done-when with no external clock inside it** (nothing waits on #285 or crux-2/tx), and (c) **folded projects back in as buildable-now** by handling `scopeIds` via a hook, dropping tx, and keeping the current unscoped `agentProcedure` (routing ≠ scope-tightening; the two are separable because project mutations are unscoped today).

**Work items (buildable now):**

- **D-0 · Spec correction (this doc + code docs).** Sanction the naked-writer pattern (server-only column = one naked DAL writer + absent from editable schema); the G8/§5.2/§5.4 overturns above. `recompute` + `setCashInDeal` stay naked, by design. Fix the overstated coupling comment at [projects/lib/server-spec.ts:38](src/shared/entities/projects/lib/server-spec.ts#L38) (route-through-crud ≠ gain-scope) and the stale hook-model text at [trpc/DOCS.md:185,203](src/trpc/DOCS.md#L185) (retired by D-b).
- **D-a · Hook relocation ×3**, risk-ascending: **customers → proposals → customer-notes**. customers (3/3) + proposals (5/5) are **pure moves** (all hooks call cross-entity `crud.*` or the naked `recompute`; no self-`crud`). customer-notes is the one **circular-barrier rewrite** — `update.before`/`delete.before` currently `await import('../dal/server/crud')` to reach their *own* `customerNoteCrud` ([lines 88,100](src/shared/entities/customer-notes/lib/server-spec.ts#L88)); the config factory hands `crudHandlers` in as an arg, dissolving the lazy import, and `delete.before` further collapses via G4 (receives the row → no `getById`). Behavior-preserving; smoke-test the rewrite.
- **D-b · Shim removal** *(gated on D-a completing all three)*. Only code reader of `spec.hooks`/`spec.duplicate` is `createCrudDal` (verified). Delete `synthesizeFromSpec`; swap its default `cfg` from `synthesizeFromSpec(spec)` to `{}` ([create-crud-dal.ts:57-59](src/shared/dal/server/lib/create-crud-dal.ts#L57)); strip `hooks`/`duplicate` from the `EntityServerSpec` type; rewrite `trpc/DOCS.md:185,203`. Hookless entities (voip ×8, applications) stay clean 1-arg `createCrudDal(spec)` — nothing to migrate. ⚠️ This is the one edit that collides with **#285**'s spec change (A strips `hooks`, #285 strips `visibility` — disjoint field removals); resolved by whoever rebases second, no need to race.
- **D-c · Non-tx bypass elimination (5.9 register)** — per site, route through the owning entity DAL (naked-writer where server-only): [accounting.service.ts:120](src/shared/services/accounting.service.ts#L120) (`ensureProjectSubCustomer` upsert → customers DAL), [providers/ai/client.ts:107](src/shared/services/providers/ai/client.ts#L107) (`projectJSON` write → proposals DAL), `compliance.service.ts:68,83`, `voip-link-tokens.service.ts:186`, projects feature-DAL. Each site is independent; interleave *after* its entity's D-a to avoid double-touching files.
- **D-d · lead-sources full standardization** — it has **no server-spec / no crud**, only bespoke DAL. Author the standard entity setup (server-spec + `createCrudDal` + schemas + visibility + constants), route its DAL/router through crud, and retire the bespoke mutations — standardizing it onto equal footing (config factory reference = meetings, not this entity).
- **D-e · projects mutations through CRUD** — `createProjectWithScopes(ctx, data, scopeIds)` / `updateProjectWithScopes(ctx, id, data, scopeIds)` = `projectCrud.create/update(ctx, data, { after: row => setProjectScopes(row.id, scopeIds) })` **inline, no tx** (matches today's non-atomic order); `projectCrud.delete.before` R2 cleanup (G4, gets the row); the router routes through the abstractions while **keeping bare `agentProcedure`** so `ctx.scope` stays `undefined` and behavior is preserved. Deletes the hand-rolled `hasFields` guard (engine G7 handles it). `scopeIds` stays a **callsite closure** — never engine input (G2 / 5.11).

**Sequence:** D-0 → (D-d ∥ D-a: customers→proposals→customer-notes) → D-b → (D-c per site ∥) → D-e. Critical path = D-a→D-b; everything else hangs off it in parallel.

**Deferred tail (named; NOT in D's done-when):**
- **#285 follow-up** — projects security *tightening* (swap `agentProcedure → projectProcedure` for `ctx.scope` + `delete` gate on `can('delete','Project')`); field-authz two-schema *iff* #285 ever needs it. D routes the DAL; #285 tightens it.
- **crux-2 revival** — in-tx atomicity for parent+child (project row + scopes; `replaceProposalIncentives` child-replace) — only if a recurring atomic invariant appears (§6-C).

**Placement map (raw material — the behavior each entity carries, sorted by where the model puts it):**

- **proposals** — `create.before` (derive `kind`, gen `token`, snapshot SOW) → factory invariant; recompute (create.after + guarded update.after) → **stays naked `recomputeProposalFinancials`** (5.3), hook relocates unchanged; lock ladder → factory invariant (precondition); `setCashInDeal` → **stays a naked lock-gated DAL fn** (5.2 pattern); incentives replace → child multi-row, **deferred (crux-2 tx)**; [ai/client.ts:106](src/shared/services/providers/ai/client.ts#L106) projectJSON write → true bypass to fix (D-c). All 5 hooks are **pure moves**.
- **meetings** — `create.before` force `ownerId` → invariant; `update.before` derive `pipeline` → invariant; `create.after` `addOwnerParticipant`/`syncGcal`/`graduateFromCampaign` → invariants, `metaCapi` Schedule → call-site (booking procedure only); `update.after` `syncGcal` → invariant, `notifyMeetingTimeChanged`/Ably → **stay inline in `after`** (C deferred; naked-safe); `delete.before` capture `gcalEventId` → invariant needing the row (G4).
- **customers** — `update.before` geocode-cache invalidation → invariant; delete-cascade → relocates **as-is** (raw `db.delete(proposals)` + loop `meetingCrud.delete`, non-atomic + partial-tolerant, already documented); `update.after` `propagateCustomerChange` → **stay inline in `after`** (C deferred; naked-safe); `createFromIntake` → service (`customerIntakeService.ingestLead`). All 3 hooks are **pure moves** (delete sig `id → row` per G4, trivial).
- **projects** — `scopeIds` (G2) + `setProjectScopes` (G3) → named abstraction (`create/updateProjectWithScopes`) = `crud.*` + **inline `after` child-set, no tx** (D-e); R2 media cleanup on delete → `delete.before` invariant needing the row (G4), R2 before DB cascade; router keeps bare `agentProcedure` (unscoped — scope tightening is the #285 tail); `business.create` proposal-gate + cross-write meeting → tRPC orchestration (stays); `accounting.ensureProjectSubCustomer` → true bypass to fix (D-c).
- **customer-notes** — `create.before` stamp `authorId` + cross-scope visibility probe → invariant; update/delete `before` author-or-admin gate → invariant (precondition).

**Depends on:** A, B (**not C — deferred**, §6-C). Side-effecting hooks stay **inline in `after`** (naked-safe); D does not relocate them to `afterCommit`. **No item in D depends on #285 or crux-2/tx** — the security tightening (G8(i) field-authz, G5, projects scope/delete-gate) is the named #285 tail, and the in-tx child abstractions are the crux-2 tail; neither is in D's done-when.

**Done-when:** the 3 spec-hook entities are relocated + `synthesizeFromSpec`/`spec.hooks`/`spec.duplicate` deleted; the non-tx bypass register is empty; lead-sources is standardized (spec + crud + router); projects mutations route through CRUD (unscoped, hooks firing); green `tsc`/`lint`. Nothing here waits on an external clock.

---

## 7. Dependencies & retiring seams

**#285 (CASL scope-compiler) — the named tail of D's permission slices.** G5 and G8(i) field-authz are #285's. **Note (2026-08-19):** the two-schema split (5.2) is **overturned for server-only columns** (killed — naked-writer pattern) — it survives *only* as a hypothetical field-authz interim, and even that is #285's to build if it ever ships field-level `assertCanUpdateFields`. Field-level CASL on update **partially exists already** — `createCrudRouter.update` iterates fields calling `ability.can('update', subject, field)` — #285 generalizes/owns it. **Projects security tightening** (route projects onto `projectProcedure` for `ctx.scope` + gate `delete` on `can('delete','Project')`) is also this tail — D routes projects' DAL through crud *unscoped* (behavior-preserving); #285 tightens.

**Status (verified 2026-08-13 via `.worktrees/issue-285`):** #285 has **Phase 1 shipped in its worktree** — row-visibility compiled from CASL for customers/meetings/proposals/projects; `resolveActorScope` (DAL) + `resolveTrpcActorScope` (tRPC middleware) + `canAccess` landed — **not yet merged to main** (main is still pre-#285; the `memory` index saying "#285 Phase 0" is stale). **Shared surface with this epic is narrow but real:** both epics rewrite `EntityServerSpec` in [types.ts](src/shared/dal/server/types.ts) from **disjoint directions** — A strips `hooks` + `duplicate.overrides`, #285 strips `visibility`. No semantic conflict, but a **mechanical merge conflict on that one interface** — whichever lands second rebases over the other's edit. Research confirmed #285 never touches `hooks` / `createCrudDal` / the factory config — the hook-relocation is **exclusively** this epic's.

**JSONB Wave 4 (SOW normalization) — drives the downstream follow-up** (§8), not this epic.

**Do-not-build-on register (retiring seams — from #285 + tRPC epic):**
- `projectVisibility` / `projectParticipationScope` ([projects/lib/visibility.ts](src/shared/entities/projects/lib/visibility.ts)) — DELETED by #285.
- `resolveVisibilityScope` / `resolveEffectiveScope` (+ orphaned `scopeMiddleware`) — **replaced by #285's shipped `resolveTrpcActorScope` (tRPC middleware) / `resolveActorScope` (DAL) / `canAccess` (point-probe)**, NOT `resolveScope` (a stale name in #285's own design spec — the committed code uses `resolveActorScope`). A *consumes* these resolved-scope helpers (§3.2); it never resolves scope itself. Verified in `.worktrees/issue-285` 2026-08-13.
- `EntityServerSpec.visibility` field on `projectServerSpec` — removed by #285 (spec purified from two directions — A strips hooks, #285 strips visibility).
- `crud.router.ts:list` hand-rolled omni check; `get-customer-pipeline-items.ts:367` `ownerId=me OR isPublic` drift — #285 Phase 2 owns these; don't re-author project row-security.
- project-media parent-bridge scope flip — #285-coordinated.
- `createEntityRouter` / `EntityToolkit` / `entity-registry` — deleted S7; do not reintroduce.
- `crud.raw` (dropped, 5.1), "recompute-as-invariant" (overturned, 5.3), `jsonbMergeColumns` (deleted Wave 2) — do not build on.

---

## 8. Deferred / out of scope

- **Typing story** — folded into **sub-plan A's grill** (was §9.4).
- **Per-entity migration sequencing** — produced by **sub-plan D's plan** (was §9.7).
- **`crud.bulk`** — future primitive; deferred, no bulk paths exist yet (5.1).
- **Proposal Financials Consolidation** — its **own brainstorm at the epic's end** (business logic, not architecture). Resolves that `finalTcp` is implemented twice (SQL persisted `recomputeProposalFinancials` vs TS live-editor `computeProposalFinancials` — [compute-totals.ts:49-81](src/shared/entities/proposals/lib/financials/compute-totals.ts#L49-L81)) and can drift. Directional (verify to 100% in that brainstorm): eliminate `startingTcp`; derive price from per-SOW section prices; `finalTcp = Σ(SOWᵢ price − SOWᵢ discounts) − Σ(global incentives)` with `max(0,…)` floor; `pricingDisplayMode` = the single display lever. **Driver:** JSONB Wave 4 (SOW normalization) makes per-SOW price/incentives/costs first-class, collapsing SQL rollup + TS façade onto one calculation.

---

## Appendix — provenance & superseded rulings

This doc was re-cut (2026-08-12) from a two-session chronological brainstorm into this forward-only epic index. **The approach was not rethought** — only reorganized. The full original chronology is in git history (pre-restructure revision of this file).

**Session history:** Grill session 1 (2026-08-12) produced the layering model + interface decisions (§3/§5 here) and left open questions. Grill session 2 (same day) resolved them, overturning two session-1 conclusions. The recompute investigation was a dispatched sub-agent.

**Superseded rulings (recorded so they aren't re-proposed):**
- **`crud.raw` primitive charter — DROPPED.** Session 1 proposed a no-hook raw write primitive with a "two uses" charter (infra bulk + in-DB convergence). Session 2 dropped it: convergence + bulk stay plain `db.*`; future `crud.bulk` deferred (now 5.1).
- **"Recompute stays a guarded factory invariant" — OVERTURNED.** Session 1 concluded recompute was an already-working guarded factory invariant. Session 2 re-read the code (4 call sites, one cross-entity) and reclassified it as a §3.7 abstraction enforced sole-door via the two-schema split (now 5.3/5.4). The session-1 *facts* (no re-entrancy; the input-set; the SQL-expression nature of the write) still hold; only the classification changed.
- **"Two-schema split / trusted-write path enforces sole-door for server-only columns (5.2/5.4)" — OVERTURNED (D grill, 2026-08-19).** The subsystem had **zero consumers**: the only server-only scalar (`finalTcpCents`) is a `sql\`…\`` convergence write a Zod schema can't carry (G8(ii)), and its client-block already ships for free via absent-from-editable-schema + single naked writer (DOCS.md:192); no other entity has a (b)-shaped scalar. Superseded by the **naked-writer pattern** (5.2/5.4 rewritten). Consequence: D builds **no** two-schema split, **no** trusted `updateImpl` path, **no** `EntityServerSpec` change; the engine stays column-pure. This also settles the session-2 "recompute → `updateProposalFinancials` abstraction" step — recompute stays exactly the naked fn it already is (5.3 revised).
- **"D is mechanical — one plan, no grill" — OVERTURNED (2026-08-19).** D got its own grill; it invents named abstractions (`create/updateProjectWithScopes`), standardizes a bespoke entity (lead-sources), and required the (b) overturn. Redrawn as a **non-blocking boundary** (§6-D) whose done-when excludes the #285 and crux-2 tails. Projects — earlier leaning "defer wholesale" — was folded **back in** once the code showed its mutations are unscoped today (bare `agentProcedure`), so routing through crud is scope-preserving and separable from #285.
- **"Design-complete, go build" — REFRAMED.** Session 2 declared the interface design complete. Per user direction (2026-08-12), the cross-cutting **architecture** is locked (§3/§5), but each **infrastructure** piece (A/B/C) gets its own dedicated grill before building; only **adoption** (D) is mechanical.
