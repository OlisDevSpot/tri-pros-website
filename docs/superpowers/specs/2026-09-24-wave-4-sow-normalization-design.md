# Wave 4 — SOW normalization: `projectJSON` → rows (design)

> **Status:** design approved by the owner section by section on 2026-09-22 → 24 (`docs/plans/2026-09-22-wave-4-re-grounding.md` §4.2 brief + §4.2b §1–§5), with rulings R1–R13 (§6) and the shape grill G1–G8 (§6a). Written 2026-09-24. **Owner review of this document pending**; the implementation plan is written only after that review.
> **Inputs (read in this order):** the JSONB program spec (`docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md`, Addenda A–C) · the W4 handoff (`docs/plans/2026-07-26-wave-4-design-handoff.md`) and amendments (`docs/plans/2026-08-25-wave-4-pre-design-amendments.md`, §R rulings) · the re-grounding (`docs/plans/2026-09-22-wave-4-re-grounding.md`) · Spec A (`docs/superpowers/specs/2026-09-22-proposal-foundations-design.md`, §4.11) · the deprecation ledger (`docs/plans/jsonb-decomposition-deprecation-ledger.md`).
> **Epic:** JSONB decomposition #256. **Landing order:** Spec A (multi-proposal epic) lands before this wave's cutover (C60); the either-order rule in Spec A §4.11 covers the reverse.

## 1. Purpose and scope

Wave 4 is the last decomposition wave. It moves the Scope of Work out of `proposals."project_JSON"` into rows — `proposal_sow_items`, `proposal_sow_scopes`, `proposal_sow_cost_lines`, and section rows in `proposal_incentives` — moves the blob's remaining non-SOW scalars into columns, makes the financial rollup a pure SQL statement over rows, and freezes `projectJSON` so it can be dropped the release after. When this wave is done, no proposal data lives in a JSONB blob.

**In scope:** the three child units and their cruds, hooks and services; the read side (`getFullView`, the aggregate read, `toSowInputs`, the list projection); the proposal editor and create view rewritten to the granular write contract with their current layout; the recompute chokepoint rewritten over rows; the backfill, parity script and cutover; amendments to Spec A and the trackers this wave requires.

**Out of scope (ruled):** any transaction in the SOW write path (R.1) · permissions work (R.4; the create-side parent probe below is the existing media pattern, flagged for the owner) · a sixth crud slot · optimistic version checks (R9) · nested children on any slot · any whole-SOW write (2026-09-23 ruling) · the `projectJSON` DROP itself (next release, drop protocol) · Push 1's `sent_message` / `meeting_id NOT NULL` (Spec A/D, own go) · the AI-summary hatch, which the prep PR deletes (R10) · Spec E's UI redesign · realtime (C41) · the homeowner read boundary (R6, a blocker for one task, §13).

## 2. Principles and the write-model ruling

Every decision below derives from rules already in force, each verified in code or docs the day it was cited:

- **P1** Rows with identity are entities: own spec with `parent: { spec, fk }`, own `createCrudDal`, own hooks (Addendum B; precedent `modules/proposals/incentives/`).
- **P2** Every row write goes through its entity's five slots, so hooks fire for every origin (`docs/codebase-conventions/service-architecture.md#row-lifecycle-vs-orchestration`, `src/trpc/DOCS.md#crud-five-slots-fixed`). The incentives delete-all-and-insert is the one documented exception, not a pattern.
- **P3** Hooks carry the row's own invariants only; cross-entity composition and parent probes are service verbs; a DAL never imports a service (R.2).
- **P4** A service is the crud spread + verbs + child services and is the one server API; routers are adapters (`modules/proposals/service.ts` header; C17).
- **P5** Derived values re-drive from the hook of every row that is a term, through one idempotent chokepoint (Addendum A).
- **P6** Invariants live on the entity, policies at the callsite.
- **P7** Scope comes from the spec, parent bridge included (`src/shared/dal/server/lib/scope.ts` — the bridge recurses up the parent chain).
- **P8** Standing rulings: no tx in the save (R.1); nothing permissions-related (R.4); new names get sign-off (R.5, done — §12); non-defensive migration: consumers move and the old path dies in one change; no dead code.

**Write model — GRANULAR (owner-ruled 2026-09-23).** One user action is one slot call. There is no whole-SOW `replace`, no reconcile helper, no client-side diff. Basis: every recorded reason for a whole-SOW write was about the editor's RHF form or the blob (the form's one submit; blob sections without ids; "in one tx", struck by R.1; "mirrors `replaceProposalIncentives`", which no longer exists), none was a domain invariant; Addendum B prescribes per-child mutations and batch-fetch reads and never replace-all for rows; Spec D already forbids whole-document writes per tap; `pre-draft` was designed as born-empty-then-incremental; mature line-item editors (Stripe invoice items, HubSpot line items, Notion, Linear) persist rows the moment they exist, with single idempotent mutations, server cascades, debounced text and one state gate for whole-aggregate validation; replace-all APIs are the documented source of accidental deletes. The middle option (explicit Save → client diff → N calls) inherits granular's idempotency burden without its UX, since `httpBatchLink` coalesces requests but runs them concurrently with no order and no atomicity. The full research record is in the re-grounding §4.2.

## 3. Data model

All vocabularies are `text({ enum })`, never pgEnums (Addendum C). Money is integer cents at the DAL boundary. Ruled in the shape grill (re-grounding §6a); the P5 catalog move (construction #195) is designed against.

### 3.1 `proposal_sow_items` — a priced work item belonging to one trade and covering 1..N catalog scopes (G1)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` default random | = Spec A's section id, lifted verbatim by the backfill; client-minted on create |
| `proposal_id` | `uuid NOT NULL` FK `proposals(id) ON DELETE CASCADE` | |
| `position` | `integer NOT NULL` | caller-set; gaps allowed; reads `ORDER BY position, created_at` |
| `title` | `text NOT NULL` | backfill fallback: trade label, then first scope label |
| `trade_id` | `uuid NULL` | the item's classification, kept after P5 (zero-scope items keep their trade; list reads avoid a join) |
| `trade_label` | `text NULL` | Notion-era snapshot from the catalog at pick time; retires at P5 (ledger row, §3.6) |
| `content_json` | `jsonb NULL`, `$type<JSONContent>()` (`JSONContent` from `@tiptap/react`) | TipTap doc, validated `type === 'doc'` at the write boundary; empty → `NULL` (G5) |
| `content_html` | `text NULL` | write-time cache with one writer (the editor); never recomputed server-side this wave |
| `section_price_cents` | `bigint NULL`, `CHECK (section_price_cents IS NULL OR section_price_cents >= 0)` | |
| `pain_points` | `text[] NOT NULL DEFAULT '{}'` | identity-free value array (Spec A) |
| `notes` | `text NULL` | rep-private (R6) |
| `created_at`, `updated_at` | house helpers | |

Indexes `(proposal_id, position)`, `(trade_id)`. **No** `UNIQUE(proposal_id, trade_id)` (G1: a proposal may repeat a trade across items).

### 3.2 `proposal_sow_scopes` — the catalog scopes an item covers (Q2, G3, G4)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` default random | minted by the backfill (the blob has no scope-row ids) |
| `sow_item_id` | `uuid NOT NULL` FK `proposal_sow_items(id) ON DELETE CASCADE` | |
| `position` | `integer NOT NULL` | |
| `scope_id` | `uuid NOT NULL` | the catalog scope id (G2) |
| `scope_label` | `text NULL` | Notion-era snapshot; retires at P5 |
| `kind` | `text({ enum: scopeKinds }) NULL` | stamped from the catalog via `toScopeRef`; scope truth lives on the in-house `scopes` row at P5, so this copy retires with the binding swap (G4) |
| timestamps | | |

`UNIQUE(sow_item_id, scope_id)`; indexes `(sow_item_id, position)`, `(scope_id)`.

### 3.3 `proposal_sow_cost_lines` (G3, G6)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` default random | lifted from the blob's `costLineSchema.id` |
| `sow_item_id` | `uuid NOT NULL` FK `proposal_sow_items(id) ON DELETE CASCADE` | |
| `position` | `integer NOT NULL` | |
| `label` | `text NOT NULL` | |
| `amount_cents` | `bigint NOT NULL`, `CHECK (amount_cents > 0)` | |
| `related_scope_id` | `uuid NOT NULL` | the catalog scope id, as in the blob |
| `notes` | `text NULL` | |
| timestamps | | |

**Composite FK** `(sow_item_id, related_scope_id) → proposal_sow_scopes(sow_item_id, scope_id) ON DELETE CASCADE`: removing a scope row cascades exactly its cost lines — the editor's UI cascade made structural (Spec A SA17/C62 becomes this constraint). Index `(sow_item_id, position)`.

### 3.4 `proposal_incentives` (A6, G7)

- New FK `sow_item_id → proposal_sow_items(id) ON DELETE CASCADE`; index `(proposal_id, sow_item_id)`.
- Section rows are `type = 'discount'` with `sow_item_id` set; ids lifted from the blob's `sectionIncentiveSchema.id`. No new vocabulary.
- New `CHECK proposal_incentives_section_label_ck (sow_item_id IS NULL OR label IS NOT NULL)`.
- The recompute's `sow_item_id IS NULL` predicate is removed (residue #2 dies, §8).

### 3.5 `proposals` — the q5 columns and the freeze

The non-SOW `projectJSON.data` fields become columns (handoff q5): `summary text NULL` · `project_type text({ enum: projectTypes }) NOT NULL` · `time_allocated text NOT NULL` · `valid_through_timeframe text({ enum: validThroughTimeframes }) NOT NULL` · `energy_benefits text NULL` · `project_objectives text[] NOT NULL DEFAULT '{}'` · `home_areas_upgrades text[] NOT NULL DEFAULT '{}'` (values from the construction `homeAreas` vocabulary, validated by Zod) · `agreement_notes text NULL`. `data.label` is already mirrored to `proposals.label` and is dropped; `meta.enabled` has zero readers and is dropped. Column names are proposed here and need R.5 sign-off (§12).

At the freeze: `"project_JSON"` NOT NULL is relaxed (B7; the W3 §3a-fix precedent), zero writers remain, `calc_version` is stamped `2`. The DROP is the release after, under the column-drop protocol; **never a `truncate` plan**; the FK closure is checked via `pg_constraint` before any DROP.

**Rides the same push (ledger):** drop `"funding_JSON"` and `"form_meta_JSON"` (Drizzle `fundingJSONDeprecated` / `formMetaJSONDeprecated`; hand-written DDL must quote the mixed-case physical names); delete `scripts/backfill-wave3-scalars.ts`; delete the `@deprecated` envelope schemas.

### 3.6 P5 hooks and ledger rows (not W4 DDL)

At the P5 binding swap: `trade_id → trades(id)` and `scope_id` / `related_scope_id → scopes(id)` as `ON DELETE RESTRICT` FKs with no column rewrite (uuid columns, G2); `trade_label`, `scope_label`, `kind` drop under the column-drop protocol. W4 registers one ledger row for those three columns with kill trigger "P5 binding swap; owner decides after a snapshot-discipline check on sent/approved rows". Future requirements recorded, reserved nothing (G8): per-item variable values (`variables_json` or child rows), template provenance (`sow_template_id uuid NULL`), materials per scope — all additive at P5, grilled when the owner chooses.

## 4. Units, files, composition (approved §1)

Three units, flat under the module (`service-architecture.md:7` — each unit is one entity). Ownership shows in the service composition, not in folder nesting.

```
src/shared/modules/proposals/
  sow/                              unit: proposal_sow_items
    server-spec.ts                  proposalSowItemServerSpec     parent → proposals   (fk proposal_id)
    dal/server/crud.ts              proposalSowItemCrud           hooks §5; duplicate config §5.6
    dal/server/queries.ts           listProposalSow (aggregate read, §6); sowSummary projection
    dal/server/clone.ts             cloneProposalSow — a loop of item duplicates, called from the proposal's duplicate.after
    schemas/index.ts                the unit's Zod input/output shapes (tRPC input inference)
    lib/sow-rows.ts                 toSowInputs(rows) → SOW[]     rows → domain (dollars); mirrors incentives/lib/incentive-rows.ts
    hooks/use-proposal-sow-actions.ts   client mutation wrappers (§7.2)
    service.ts                      proposalSowService = { ...proposalSowItemCrud, create (parent probe), list, get scopes(), get costLines() }
  sow-scopes/                       unit: proposal_sow_scopes
    server-spec.ts                  proposalSowScopeServerSpec    parent → sow items   (fk sow_item_id)
    dal/server/crud.ts              proposalSowScopeCrud          hooks §5
    service.ts                      proposalSowScopesService = { ...proposalSowScopeCrud, create (parent probe + G1 trade check) }
  sow-cost-lines/                   unit: proposal_sow_cost_lines
    server-spec.ts                  proposalSowCostLineServerSpec parent → sow items   (fk sow_item_id)
    dal/server/crud.ts              proposalSowCostLineCrud       hooks §5
    service.ts                      proposalSowCostLinesService = { ...proposalSowCostLineCrud, create (parent probe) }
  incentives/dal/server/crud.ts     + the lock gate its header defers to W4; recompute hooks unchanged
  incentives/dal/server/queries.ts  + listSectionIncentives(proposalId)
  core/dal/server/lock-gate.ts      assertProposalEditable(ctx, proposalId)
  core/dal/server/crud.ts           duplicate.after → cloneGlobalIncentiveRows (landed) + cloneProposalSow
  core/dal/server/mutations.ts      recomputeProposalFinancials — rows-only statement (§8)
  service.ts                        get sow() (Spec A adds it); create override with the seed (§7.3)

src/shared/modules/construction/core/{schemas,lib}   catalogRefSchema, scopeRefSchema, toCatalogRef, toScopeRef (Q3; ≤60 lines, no table, no DAL)
src/shared/lib/tiptap/                                tiptapDocSchema — the write-boundary validator for content_json (the three read-side safeParseDoc copies stay untouched this wave)
src/shared/db/schema/proposal-sow-{items,scopes,cost-lines}.ts
src/trpc/routers/proposals.router/sow.router.ts       proposals.sow.*
src/trpc/routers/proposals.router/incentives.router.ts + proposals.incentives.{getById,create,update,delete,duplicate} via createCrudRouter (§7.6)
scripts/backfill-sow-rows.ts, scripts/verify-sow-rows-parity.ts
```

| Layer | Owns | Never does |
|---|---|---|
| spec | table, parent fk, column-only insert/update/select schemas | hooks, nested children |
| crud | the five slots with the row's invariants in factory hooks | compose another entity |
| `cloneProposalSow` | read the source items, duplicate each onto the target through the item crud | diff, key, or update anything |
| unit service | crud spread + the create-side parent probe + `list` + child getters | write a row directly |
| router | `createCrudRouter` per spec + `list` in one `createTRPCRouter` literal (the index.ts pattern) | adapt or gate by hand |

**Router.**

```ts
export const sowRouter = createTRPCRouter({
  items:     createCrudRouter({ spec: proposalSowItemServerSpec,     schemas: { ...proposalSowItemSchemas,     id: z.string().uuid() }, crud: proposalService.sow }),
  scopes:    createCrudRouter({ spec: proposalSowScopeServerSpec,    schemas: { ...proposalSowScopeSchemas,    id: z.string().uuid() }, crud: proposalService.sow.scopes }),
  costLines: createCrudRouter({ spec: proposalSowCostLineServerSpec, schemas: { ...proposalSowCostLineSchemas, id: z.string().uuid() }, crud: proposalService.sow.costLines }),
  list: proposalProcedure.input(z.object({ proposalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => dalToTrpc(await proposalService.sow.list(ctx, input))),
})
```

Client surface: `proposals.sow.items.*`, `proposals.sow.scopes.*`, `proposals.sow.costLines.*` (five slots each), `proposals.sow.list`. No `mergeRouters`, no new procedure in `procedures.ts`, `init.ts` untouched. Spec A's `proposals.sow.{create,update,delete}` becomes `proposals.sow.items.*` (a docs amendment; Spec A ships no procedures).

**Scope model.** Every user write is a slot leaf, so the caller's scope is always the right one: each crud router resolves its spec's scope, and a scope-row update runs `WHERE id = ? AND sow_item_id IN (SELECT id FROM proposal_sow_items WHERE proposal_id IN (SELECT id FROM proposals WHERE <scope>))` with zero new code. The one orchestration, `cloneProposalSow`, runs inside `duplicate.after` under `SYSTEM_CONTEXT` on a target the engine just created for this caller (precedent: `proposalCrud.create.before` reads the meeting under `SYSTEM_CONTEXT`).

## 5. Hooks (approved §2)

### 5.1 The gate helper

`core/dal/server/lock-gate.ts`:

```ts
export async function assertProposalEditable(ctx: ScopedContext, proposalId: string): Promise<ProposalLockSignals> {
  const signals = dalVerifySuccess(await getProposalLockSignals(proposalId))              // existing read, 5 columns
  if (isProposalFrozen(signals)) {
    throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_frozen' })
  }
  if (signals.status === 'pre-draft' && ctx.session) {                                    // a system write never promotes
    dalVerifySuccess(await proposalCrud.update(SYSTEM_CONTEXT, { id: proposalId, data: { status: 'draft' } }))
  }
  return signals
}
```

The lock ladder is the existing helper. Promotion is Spec A §4.4's rule moved to where child writes happen (R7) and runs in `before`: a promoted pre-draft whose child write then fails is a valid state (C4, zero-section drafts are valid). **Promotion requires a session:** seeding at create, `cloneProposalSow`, the backfill and any script run as `SYSTEM_CONTEXT` and must leave `pre-draft` alone (Spec A §4.4 amendment, §11).

### 5.2 Per crud

Only existing reads; a factory's `update.before` reads its own row through the handlers the factory receives (`types.ts` `CrudConfigFactory`).

| crud | `create.before` | `update.before` | `delete.before` | `after` |
|---|---|---|---|---|
| items | gate on `input.proposalId` | own row → gate | gate on `row.proposalId` | `update`: recompute when `sectionPriceCents` is in the payload (§8). `delete`: recompute — the DB cascade removes the section's incentive rows without firing their hooks |
| scopes | item row (`proposalSowItemCrud.getById`, system) → gate | own row → item → gate | `row.sowItemId` → item → gate | none (cascaded cost lines are not a rollup term) |
| cost lines | same as scopes | same | same | none |
| incentives (existing) | + gate on `input.proposalId` | + own row → gate | + gate on `row.proposalId` | recompute, unchanged |

Two or three primary-key reads per grandchild write: single-row user actions, accepted over a new join query.

### 5.3 Position

Required on every insert and set by the caller; append is a UI policy and every caller knows its list (editor, Specialties, seed, clone). Delete leaves gaps. Reorder is `update({ position })`. No `nextPosition` helper.

### 5.4 Schemas per unit (all from `createInsertSchema`)

- Items: insert omits timestamps only (`id` optional = client-minted; `position` required; `contentJson: tiptapDocSchema.nullable().optional()`); update omits `id`, `proposalId`.
- Scopes: insert requires `sowItemId`, `scopeId`, `position`; `scopeLabel`, `kind` nullable; update omits `id`, `sowItemId`, `scopeId` (a toggle is create or delete; the pair is the G3 unique).
- Cost lines: insert requires `sowItemId`, `label`, `amountCents`, `relatedScopeId`, `position`; update omits `id`, `sowItemId`.
- Incentives: unchanged.

### 5.5 Create-side parent probe and the G1 trade check (service overrides, the media pattern)

The engine's bare `create` has no WHERE, so each unit service overrides `create` with `isVisible(parentSpec, ctx, parentId)` then the engine create (`media/service.ts`). Items probe the proposal; scopes and cost lines probe the item, and the bridge resolves the rest. The scopes `create` override also carries G1's write check: the picked scope's catalog `tradeId` (from the cached construction catalog, `constructionService`) must equal the item's `trade_id`, else `precondition-failed: scope_not_in_trade`. It lives on the service, not in the hook, because a DAL never imports a service (P3). Existing pattern applied; flagged against R.4 for the owner to strike.

### 5.6 Duplicate, per item and per proposal, through the engine's own slot

The item crud's `duplicate` config excludes timestamps and gains `duplicate.after` (landed in `c135a455`), which creates the source's scopes → cost lines → section incentives onto the new row through their cruds. Then:

- The UI's "duplicate section" is `proposals.sow.items.duplicate({ id })`. It lands at the source's position; the `created_at` tiebreak places it right after.
- `cloneProposalSow(sourceId, targetId)` = for each source item, `proposalSowItemCrud.duplicate(SYSTEM_CONTEXT, { id }, { before: data => ({ ...data, proposalId: targetId }) })`. The callsite `before` is the engine's retarget seam (`create-crud-dal.ts` `duplicateImpl` takes `'create'` callsite hooks). No mapper, no id remap; fresh ids from the PK defaults.
- The proposal's `duplicate.after` (landed in `7631cfd8`) gains one call: `cloneProposalSow(source.id, row.id)` after `cloneGlobalIncentiveRows`, and re-drives the rollup once, as it does today.

### 5.7 Import cycle, stated

`core/dal/server/crud.ts` → `sow/dal/server/clone.ts` → `sow/dal/server/crud.ts` → `core/dal/server/lock-gate.ts` → `core/dal/server/crud.ts`. Every reference is inside a hook body, resolved at call time — the root service header's rule for services, applied to DAL modules. No top-level use of an imported crud.

## 6. Reads (approved §3)

**Two read shapes by consumer.** Editing surfaces work on rows (a slot call needs a row id). Display surfaces keep the blob-shaped `SOW[]` domain, so the display consumers listed in the re-grounding §4.5 (PDF builders, homeowner page, review, AI summary, financials façade) do not change.

- **Aggregate read** `listProposalSow(proposalId)` in `sow/dal/server/queries.ts`, the batch-fetch idiom: items by proposal; scopes and cost lines by `inArray(sowItemId, …)`; section incentives through `listSectionIncentives(proposalId)` in the incentives unit (the `IS NOT NULL` sibling of its global read). Four queries, grouped in memory, `ORDER BY position, created_at`. Returns
  ```ts
  type ProposalSowRows = Array<ProposalSowItemRow & { scopes: ProposalSowScopeRow[], costLines: ProposalSowCostLineRow[], incentives: ProposalIncentiveRow[] }>
  ```
- **Hydrator** `toSowInputs(rows): SOW[]` in `sow/lib/sow-rows.ts`, the twin of `toFundingInputs`: cents → dollars, `content_json` stringified back to `contentJSON`, `{ tradeId, tradeLabel }` → `trade`, scope rows → `{ id: scopeId, label }`, plus Spec A's `id`, `painPoints`, `notes`. Pure.
- **Who reads what.** `getFullView` → its proposal row (q5 columns) + `listProposalSow` → `toSowInputs` ⇒ `{ ...proposal, sow: SOW[] }`. Editor, Solution tab, Specialties → `proposals.sow.list` ⇒ `ProposalSowRows`, via `proposalSowService.list` = parent probe → rows (the media `list` pattern). `listProposals`, `getProposalsByMeetingId`, the customer profile and the action queue → a `sowSummary` projection in SQL (`array_agg` over items by position for trade ids and labels; `array_agg` over scope rows for scope ids) ⇒ `{ firstTradeLabel, tradeIds, scopeIds }`, no per-row round trips; Spec A's `listableProposalSql()` survives. `recomputeProposalFinancials` and readiness read rows directly.
- **R6 stays deferred.** With rows the homeowner boundary can be structural: a homeowner read does not run the cost-line query and does not select `notes`. Whether that read is a `getFullView` projection or #285's H10 is the open question (§13).
- Section, cost-line and section-incentive ids are the row PKs: no second id space.

## 7. Call paths (approved §4)

### 7.1 Scope of the editor work

W4 refactors the existing proposal editor (`src/features/proposal-flow/`) to the row model **with its current layout**: no visual redesign, no new components. Spec E's Solution tab inherits the write contract when its UI grill happens. The create view collapses to columns (§7.3).

### 7.2 The write contract and client mechanics

| User action | Call |
|---|---|
| add section | `sow.items.create({ id: randomUUID(), proposalId, position, title: '', tradeId: null, … })` |
| remove section (confirm) | `sow.items.delete({ id })`; scopes, cost lines, incentives cascade |
| duplicate section | `sow.items.duplicate({ id })` |
| title, content, price, pain points, notes | debounced `sow.items.update({ id, data: { <field> } })` |
| pick trade | the scope clears below, then `sow.items.update({ id, data: { tradeId, tradeLabel } })` |
| toggle scope on | `sow.scopes.create({ sowItemId, scopeId, scopeLabel, kind, position })` |
| toggle scope off (confirm if it has cost lines, as today) | `sow.scopes.delete({ id })`; its cost lines cascade |
| add / edit / remove cost line | `sow.costLines.create` / debounced `update` / `delete` |
| add / edit / remove section incentive | `incentives.create` / `update` / `delete` with `sowItemId`, `type: 'discount'` |

Every row the editor holds came from `proposals.sow.list`, so it has the id for every call; client-minted section ids let a scope create queue behind its section create. `use-proposal-sow-actions.ts` follows `docs/codebase-conventions/entity-frontend.md#L152` (mutation wrappers over the entity's crud router). Every mutation carries `scope: { id: proposalId }` (React Query 5.80), so one proposal's writes run in order, parent before child; that trades `httpBatchLink` coalescing for determinism, which single-row actions do not need. Text fields debounce through the shared `useDebounce` at the Specialties provider's 800 ms, flushed on blur and unmount. **Not optimistic in W4:** `isPending` disables the control; success invalidates through the existing `invalidateProposal`; failure is a toast and the control re-enables — the Specialties provider's rule today. No queue, no retry.

### 7.3 Create and seed

The create view becomes columns only: label, meeting, project type, display mode, funding scalars; its SOW half goes. Seeding from meeting trade selections must not promote `pre-draft`, so it is not client calls under a session: `proposalService.create` is overridden (the media pattern applied to the root) as `proposalCrud.create(ctx, columns)` then the seed's items and scopes through their cruds under `SYSTEM_CONTEXT`, when the input carries a seed. Spec A's `seedSowSections` becomes the pure mapper from trade selections to item + scope inputs (§11).

### 7.4 Specialties (Spec D)

Per-tap slot calls, Spec D's own rule. Its debounced whole-array write to `meetings.flowStateJSON.tradeSelections` is replaced at Spec D, not by W4.

### 7.5 The send gate

Referential rules are the FKs. Completeness rules live in Spec A's `getProposalReadiness`, which grows two reasons — `section-missing-trade`, and in breakdown mode `section-missing-price` — shown inline in the editor. Drafts may be incomplete.

### 7.6 The funding half of the page

The same page cannot autosave sections and keep a Save button for deposits. Funding scalars become debounced `crud.update` calls; global incentives get `proposals.incentives.{getById,create,update,delete,duplicate}` — one `createCrudRouter` line from the existing `proposalIncentiveServerSpec` — so they are per-row like everything else. `proposals.incentives.replace` loses its editor caller and is deleted with the funding form's second mutation; `replaceGlobalIncentiveRows` keeps its remaining caller (`cloneGlobalIncentiveRows`).

### 7.7 Lock and errors

Unchanged: the editor disables on `proposalLocked`; the server refuses with `precondition-failed: proposal_frozen` from the gate. The client maps that reason to the existing lock notice instead of surfacing the raw string.

## 8. Derived values — the chokepoint over rows

`recomputeProposalFinancials(proposalId)` becomes one SQL statement over rows, idempotent and self-healing (Addendum A), stamping `calc_version = CURRENT_CALC_VERSION` (= 2, the A1 prep item):

```
starting := CASE price_display_mode WHEN 'breakdown'
              THEN COALESCE(SUM(section_price_cents) over the proposal's items, 0) + COALESCE(misc_price_cents, 0)
              ELSE starting_tcp_cents END
final    := GREATEST(0, starting − COALESCE(SUM(amount_cents) FILTER (WHERE type = 'discount') over ALL the proposal's incentive rows, 0))
cash     := LEAST(cash_in_deal_cents, final)
UPDATE proposals SET starting_tcp_cents = starting, final_tcp_cents = final, cash_in_deal_cents = cash, calc_version = 2 WHERE id = ?
```

This retires the funding form's breakdown-sum effect and the submit-time `cashInDeal` clamp; in total mode `startingTcp` stays user-entered. Triggers: incentive rows' hooks (existing); item `update.after` when `sectionPriceCents` is in the payload; item `delete.after` (cascade); the proposal `update.after` adds `miscPriceCents` and `priceDisplayMode` to its trigger list and drops `projectJSON`. `scripts/recompute-final-tcp.ts` is rewritten to the same statement in the same commit. `computeFinalTcp({ funding, sow })` keeps its dollars input this wave.

## 9. Data migration and cutover

Per the program protocol §4 and amendment B9; every prod push is its own explicit go; deploy-first.

1. **Additive DDL on dev** (`pnpm db:push:dev`): §3.1–3.5 tables, FKs, indexes, CHECKs, q5 columns.
2. **Backfill** `scripts/backfill-sow-rows.ts`: a migration script with raw Drizzle inserts (the W2/W3 precedent), **not** an application write — the gate would refuse every frozen proposal, and frozen proposals have SOWs. Idempotent (skips proposals that already have items), `--dry-run`, `DRIZZLE_TARGET`-aware, non-zero exit on any blob failing Zod. Lifts every id the blob has (section ids after Spec A's backfill, cost-line and section-incentive ids); mints only scope row ids; normalizes catalog ids (`normalizeNotionId`) and pre-checks that every stored id is a UUID (the prod runbook step for G2); fills empty labels and `kind` from the cached catalog (unknown → `NULL`); title fallback per G1; q5 columns from `projectJSON.data`. Runs once, before cutover, never after.
3. **Parity** `scripts/verify-sow-rows-parity.ts` (read-only, non-zero exit on any mismatch): per proposal, `toSowInputs(rows)` ≡ the normalized blob (order by position, cents → dollars, ignore minted scope-row ids); row counts ≡ array lengths; three-way money parity (TS-from-rows = TS-from-blob = `final_tcp_cents` = the new SQL statement, including the derived breakdown `startingTcp`); `calc_version = 2` everywhere; q5 columns ≡ blob scalars.
4. **Neon-branch rehearsal** of prod: DDL + backfill + parity on a branch.
5. **Deploy** the reader/writer flip (§9.1) with the DDL already applied; then the **prod push on its own go**, after Push 1 is deployed.
6. **Freeze** `"project_JSON"`: NOT NULL relaxed, zero writers, ledger tally. **Drop** the release after under the column-drop protocol.

### 9.1 Writer / reader flip (re-grounding §4.5, unchanged where not listed)

Writers that flip or die: the editor and create view (§7); the meeting-flow seed (§7.3); Spec A's blob-backed `sow` bodies (replaced by the spread); `scripts/backfill-sow-financials.ts` deleted; the AI hatch (deleted in the prep PR, R10). Readers that flip: `recomputeProposalFinancials` (§8); `projectJSON` leaves `frozenProposalLockedFields` and the q5 columns join it; the proposal `update.after` trigger list (§8); the raw-blob readers of §4.5 (`derive-scope-ids.ts`, `get-customer-profile.ts`, `get-action-queue.ts`, `map-proposal-row-to-card-data.ts`, the Zoho registry and `assemble-envelope.ts`) move to `sowSummary` or the q5 columns. Shape consumers of `SOW[]` stay untouched via `toSowInputs`.

## 10. Verification (no test runner)

`pnpm tsc` + `pnpm lint` per task. Pure scripts kept green: `verify-financials-facade.ts`, `verify-sow-doc-definition.ts`, `verify-pack-sow-text.ts`, `verify-tiptap-to-pdfmake.ts`; `verify-is-long-sow.ts` fails today (asserts 3600 vs constant 600) and is fixed first so it can be trusted. DB scripts: `recompute-final-tcp.ts --dry-run`, `verify-generate-sow-pdf.ts`, the parity script (§9.3). Session smoke `scripts/tmp-smoke-proposal-foundations.ts` (never committed) extended for: every slot on the three cruds from both the service and the bare crud; the gate refusing on a frozen proposal; promotion on a session write and not on a system write; item delete re-driving the rollup; scope delete cascading exactly its cost lines; the G1 trade check; `cloneProposalSow` from `duplicate.after` with fresh ids; the seed leaving `pre-draft`; the recompute statement in breakdown and total mode. Playwright (`src/app/api/dev/playwright-session/route.ts`): an agent edits a section and a reload shows the row; the PDF per `pdf-documents.md#verification`. The homeowner token check is tied to R6.

## 11. Amendments this wave requires in other documents

| Document | Amendment |
|---|---|
| Spec A §4.6 / C56 | `sow` verbs accept the full section shape; no `.strict()` rejection of financials; content-only is Specialties' callsite policy (the blob-era recompute already fires on any `projectJSON` write) |
| Spec A §4.4 | a write without a session never promotes |
| Spec A §4.7 / S3 | at W4, create is the `proposalService.create` override with the seed; `seedSowSections` maps trade selections to item + scope inputs |
| Spec A §4.8 / SA14 / SA20 | `sow.clone` → `cloneProposalSow`, a loop of item duplicates; the item crud gets the same `duplicate.after` key |
| Spec A §4.1 | at W4, position is caller-set; delete leaves gaps; reorder is an update |
| Spec A §4.11 | the whole-SOW-save row is struck; `proposals.sow.*` → `proposals.sow.items.*`; `replaceProposalSow` leaves the names list |
| Spec A SA17 / C62 | the cascade is the composite FK |
| Multi-proposal tracker | C56 as above; P6 "toggle = `sow.update({ scopes })`" → `sow.scopes.create/delete`; the "`sow.replace` leaf W4 joins" sentence goes; **Spec E gets a new decision: its write model is §7.2**; §4.7 "mirrors `replaceProposalIncentives`" is a stale ref |
| W4 amendments doc §R | R.3 and the two R.5 names (`replaceProposalSow`, `sow.replace`) superseded by a dated note; dated plans keep their text |
| Construction tracker | F1 (`CatalogRef`/`ScopeRef` have seven call sites; W4 lands the ref half of F14/A9), F14 (mapper → `seedSowSections` in proposals), §7/K7 (#195 variable values and template provenance target `proposal_sow_items`) |
| Deprecation ledger | rows for `projectJSON` (freeze → drop), the P5 retirement of `trade_label` / `scope_label` / `kind`, the W3 frozen-column drops riding this push |

## 12. Names (R.5)

**Signed off 2026-09-24 (R13):** `proposalSowItemServerSpec` / `proposalSowItemCrud` / `proposalSowService` · `proposalSowScopeServerSpec` / `proposalSowScopeCrud` / `proposalSowScopesService` · `proposalSowCostLineServerSpec` / `proposalSowCostLineCrud` / `proposalSowCostLinesService` · `PROPOSAL_SOW_ITEM` / `PROPOSAL_SOW_SCOPE` / `PROPOSAL_SOW_COST_LINE` · `proposal_sow_scopes` (with the locked `proposal_sow_items`, `proposal_sow_cost_lines`) · `assertProposalEditable`, `cloneProposalSow`, `listProposalSow`, `listSectionIncentives`, `ProposalSowRows`, `sowSummary`, `toSowInputs` (locked), `CURRENT_CALC_VERSION` (locked) · `proposals.sow.{items,scopes,costLines}.*`, `proposals.sow.list`, `proposals.incentives.*` · `use-proposal-sow-actions.ts` · `section-missing-trade`, `section-missing-price` · `catalogRefSchema`, `scopeRefSchema`, `toCatalogRef`, `toScopeRef` · `verify-sow-rows-parity.ts`, `backfill-sow-rows.ts`.

**Proposed here, need sign-off:** the q5 column names (`summary`, `project_type`, `time_allocated`, `valid_through_timeframe`, `energy_benefits`, `project_objectives`, `home_areas_upgrades`, `agreement_notes`) · `lock-gate.ts` (file) · `sow-rows.ts` (file, the `incentive-rows.ts` precedent) · `tiptapDocSchema` · `scope_not_in_trade` (reason string).

**Struck:** `replaceProposalSow`, `sow.replace`, `sow.clone`, `includeRepPrivate`, `reconcileOneToMany`, `reconcileProposalSow`, `pickChanged`, `SowItemWrite`, `proposalSowItemProcedure`, `nextPosition`.

## 13. Open items and blockers

- **R6** (the homeowner read boundary) must be reconciled before the `getFullView` task starts; the token path returns the whole row today. §6 records what rows make structural.
- **#285 ← main sync** before this wave lands; its Phase-9 audit gains the three specs, the two leaves and the two service overrides.
- **Spec D** is the first consumer of `proposals.sow.*`: it lands on rows if this wave is within reach at its spec time, else on the blob bodies with the hazard documented (the C5 bet). **Spec E** waits for its UI grill and inherits §7.2.
- **Spec A Tasks 3–7** land first with §11's amendments applied to its spec and plan; Tasks 1–2 (`duplicate.after`) landed 2026-09-24 (`c135a455`, `7631cfd8`).
- The two R.4-flagged service overrides (§5.5): existing pattern applied; the owner may strike.

## 14. Sequencing

The game plan is the re-grounding §5: step 0 done · step 1 Spec A build (with §11) · step 2 the W4 prep PR (A1 stamping half, R10 delete, A5 enums, A6 decision, A4 remainder) · step 3 this spec → its plan · step 4 the #285 sync · step 5 the W4 build on dev DDL · step 6 the prod push on its own go · step 7 post-waves (`projectJSON` drop, ledger tally, `sowSchema` → `sow/schemas/`, conventions sweep and the child-entity ADR).
