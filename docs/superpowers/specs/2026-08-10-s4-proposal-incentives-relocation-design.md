# S4 — `proposal-incentives` relocation (tRPC Standardization Epic)

- **Date:** 2026-08-10
- **Epic:** `docs/plans/2026-08-09-trpc-standardization-epic.md` (slice S4)
- **Approach:** A — pure relocation (deliberate, likely-temporary down-scale of the entity/sub-entity system)
- **Blocked by:** S3b (shipped)

## Problem

`proposal_incentives` is a Wave-2 child table, but all of its code lives inside the
parent `entities/proposals/` folder: the replace-all write, the list read, and the
row↔domain mappers. This violates R11 (a child DAL dumped under the parent) and
leaves a raw child-table write (`db.insert(proposalIncentives)`) inside the parent's
duplicate override — the exact drift this epic exists to remove.

## Why not a full spec'd child (like media)

Media earned `createCrudDal` because it has genuine per-row CRUD
(getById/create/update/delete). **Incentives has none.** Its entire surface is:

| Op | Kind |
|---|---|
| `replaceProposalIncentives` | bespoke bulk replace-all (lock gate + triggers proposal financial recompute) |
| `listProposalIncentives` | read (consumed by replace, `getFullView` hydration, duplicate) |
| `incentive-rows.ts` | row↔domain mappers |
| clone (inside duplicate) | bulk insert |

A `proposalIncentiveServerSpec` + `proposalIncentiveCrud` would produce four CRUD
methods with **zero callers** — dead surface failing the deletion test. So S4 is a
*relocate-and-colocate*, not a `createCrudDal` clone.

### Deliberate down-scale (accepted)

No `server-spec.ts`, no `createCrudDal`, no `ENTITY_NAMES`/CASL registration, no
child `proposalIncentiveProcedure`. The router stays on `proposalProcedure`; scope +
lock are already enforced inside the bespoke mutation's parent-scoped select. This is
a knowing, temporary asymmetry vs. media — revisit if/when W3 section-incentives
(`sow_item_id` FK) introduces per-row editing that needs the ctx.scope bridge.

## Design

### Moves into `entities/proposal-incentives/`

| New file | From | Content |
|---|---|---|
| `dal/server/mutations.ts` | `proposals/dal/server/mutations.ts` | `replaceProposalIncentives`; new `cloneProposalIncentives(sourceId, targetId)` (see below) |
| `dal/server/queries.ts` | `proposals/dal/server/queries.ts` | `listProposalIncentives` |
| `lib/incentive-rows.ts` | `proposals/lib/incentive-rows.ts` | `incentiveRowsToDomain`, `domainIncentivesToRows` |

`replaceProposalIncentives` is moved verbatim: it keeps its own parent-scoped select
(`and(eq(proposals.id, id), ctx.scope ?? undefined)`), the `isProposalFrozen` gate,
and the trailing `recomputeProposalFinancials` call (imported back from the parent).

### Stays in `entities/proposals/` (imports repointed to the child)

- **`recomputeProposalFinancials`, `setCashInDeal`** — proposal-level rollup + funding
  blob write. `recomputeProposalFinancials` is imported *by* the child's
  `replaceProposalIncentives` and `cloneProposalIncentives`-callers (one-way child→parent edge).
- **`getFullView`** (queries.ts) — repoints to import `listProposalIncentives` +
  `incentiveRowsToDomain` from the child (parent hydrating child rows — expected).
- **`duplicateProposalWithIncentives`** (duplicate.ts) — stays (proposal
  orchestration). Its inline `db.insert(proposalIncentives)` is replaced by a call to
  the child's `cloneProposalIncentives`; it keeps orchestrating the post-clone
  `recomputeProposalFinancials` and merging `finalTcpCents` into the returned row.
- **`schemas/` (incentiveSchema/incentiveTypes/Incentive)** — the shared funding-form
  *domain* schema; consumed by funding-form UI + the drizzle enum source. Untouched.
- **`proposal-lock.ts`, `scrub-blob-incentives.ts`** — untouched.
- **DB schema** `src/shared/db/schema/proposal-incentives.ts` — stays (schema-dir
  convention; insert/select schemas stay with it).

### The duplicate clone extraction

`duplicate.ts:56` currently does a raw `db.insert(proposalIncentives)`. Extract the
insert into `cloneProposalIncentives(sourceId, targetId): DalReturn<void>` in the
child's `dal/server/mutations.ts` — it reads the source's global rows and inserts
copies onto the target. `duplicateProposalWithIncentives` calls it, then runs
`recomputeProposalFinancials` exactly as today. Behavior identical; the child-table
write now lives with its owner (entity-owns-its-mutations).

### Router

`incentives.router.ts` — change one import path (`replaceProposalIncentives` now from
`@/shared/entities/proposal-incentives/dal/server/mutations`). `incentiveSchema`
import unchanged. tRPC path `proposals.incentives.replace` unchanged. Zero client
changes.

## Import / cycle safety

All edges are one-way at the module level:

- `proposal-incentives/mutations` → `proposals/mutations` (recompute),
  `proposals/lib/proposal-lock` (isProposalFrozen), `proposal-incentives/queries`,
  `proposal-incentives/lib` (mappers), `proposals/schemas` (Incentive type)
- `proposal-incentives/queries` → db + schema only (no `proposals` import)
- `proposal-incentives/lib/incentive-rows` → `proposals/schemas` (Incentive type) + row types
- `proposals/queries` → `proposal-incentives/{queries,lib}` (parent reads child)
- `proposals/duplicate` → `proposal-incentives/{queries,mutations}` (clone + list)
- `incentives.router` → `proposal-incentives/mutations` + `proposals/schemas`

After the move, `proposals/mutations.ts` no longer imports anything from
`proposal-incentives` (its `listProposalIncentives`/`domainIncentivesToRows` imports
existed only for the relocated `replaceProposalIncentives`), so the `proposal-incentives
→ proposals/mutations` recompute edge is acyclic. Folder-level, `proposals` and
`proposal-incentives` are mutually dependent (a tightly-coupled child whose write
drives a parent rollup and whose rows the parent hydrates) — acceptable and expected.

## Testing / verification

- `pnpm tsc` + `pnpm lint` green (only the pre-existing `server.ts:6` WIP error may remain).
- Behavior byte-for-byte preserved — pure move + import repoint + a semantics-preserving
  extraction of the duplicate insert.
- Manual sanity:
  1. `proposals.incentives.replace` still writes rows + reconverges `finalTcpCents`.
  2. Duplicating a proposal with discounts/exclusive-offers still copies the rows and
     the copy's `finalTcpCents` matches the source.
  3. `getFullView` still hydrates `fundingJSON.data.incentives` from rows.

## Out of scope

- W3 section-incentives (`sow_item_id` FK), per-row editing, and any `createCrudDal`/
  spec for incentives — deferred until a real per-row consumer exists.
- The `proposals` router's own S8 migration.
