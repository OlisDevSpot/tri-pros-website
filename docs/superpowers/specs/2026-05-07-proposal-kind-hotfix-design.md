# Proposal Kind Classification Hotfix

**Date:** 2026-05-07
**Status:** Approved (pending user spec review)
**Issue:** Follow-up to #168 (`feat(proposals): kind discriminator`)

## Problem

The `proposal.kind` discriminator landed in #168 with a backfill rule that was too narrow. Running `pnpm migrate:proposal-kind:dev` against the dev DB classified only **3 proposals as `initial-sale`** (one per project) and **13 as `additional-work`**, which contradicts the real business rule. Specifically, the existing backfill is wrong in two ways:

1. **Multiple proposals on a single birthing meeting** — when an agent iterates on an offer (4 proposals on one meeting, only one accepted) the unaccepted proposals were marked `additional-work`. They are not — they were attempts at the same initial sale.
2. **Projectless proposals** — proposals on meetings with no `project_id` were partitioned together by `PARTITION BY m.project_id`, and only the very earliest one in the NULL partition was marked `initial-sale`. The rest were silently mis-classified as `additional-work`.

The schema also carries a partial unique index `(meeting_id) WHERE kind = 'initial-sale'` that encodes the wrong invariant: it forbids the legitimate case of multiple `sent`/`draft` initial-sale proposals on the same birthing meeting.

The runtime `deriveProposalKind` (frozen at insert from `meeting.projectId`) is correct for forward operation and does not need to change.

## Goals

- Re-classify all historical proposals so they match the real business rule.
- Replace the wrong DB invariant with a meaningful one: at most one **approved** initial-sale per project.
- Surface `kind` in the proposals table so agents can see and filter by it.
- Idempotent, transactional migration that runs cleanly on dev and prod.

## Non-goals

- Reclassifying `kind` retroactively when a meeting is later assigned to an existing project via `meetingsRouter.assignToProject`. The UI flow makes this rare; flagged as a known limitation.
- Changing the runtime `deriveProposalKind` helper. The simple "meeting has projectId at insert time?" rule is correct for forward operation.
- Visual treatment for the new badge — handed to `ui-ux-pro-max` during implementation, not designed in this spec.
- Surfacing kind on the proposal detail header / contract-status panel (the existing pre-send review block already shows kind in prose).

## Classification Rule (canonical)

For a proposal `P` on meeting `M`:

### Runtime (insert-time) — already correct

| `M.projectId` at insert | `P.kind` |
|---|---|
| `NULL` | `initial-sale` |
| not null | `additional-work` |

This is implemented by `deriveProposalKind` and remains unchanged.

### Backfill (historical proposals) — needs rewrite

| Condition | `P.kind` |
|---|---|
| `M.projectId` is NULL | `initial-sale` |
| `M` is the earliest meeting (by `created_at`) linked to its project — the **birthing meeting** | `initial-sale` (applies to **all** proposals on `M`, regardless of status) |
| `M` is linked to a project but is not the birthing meeting | `additional-work` |

**Why backfill differs from runtime:** historical rows have no insert-time signal. The birthing-meeting heuristic reconstructs what `meeting.projectId` would have been at the moment `P` was inserted, given that meetings can only be linked to a project that already existed at link time.

## Schema Constraint

**Drop:** `proposals_one_initial_sale_per_meeting_idx`
```sql
UNIQUE (meeting_id) WHERE kind = 'initial-sale'
```
Reason: blocks the legitimate case of multiple sent/draft initial-sale proposals on the birthing meeting.

**Add:** `proposals_one_approved_initial_sale_per_meeting_idx`
```sql
UNIQUE (meeting_id) WHERE kind = 'initial-sale' AND status = 'approved'
```
Reason: enforces "at most one approved initial-sale per project". Because all initial-sale proposals for a project share one meeting (the birthing meeting), a per-meeting index transitively becomes per-project. Many `sent`/`draft` initial-sales can coexist freely.

The schema declaration in `src/shared/db/schema/proposals.ts` is updated to reflect the new index.

## Migration Script (`scripts/migrate-proposal-kind.ts`)

The existing committable migration is rewritten in place. Idempotent and transactional — same NODE_ENV-driven shared `db` client convention as before.

### Steps (single transaction)

1. **Ensure enum + column exist** (idempotent, preserved from existing script — required for prod first-run):
   ```sql
   DO $$ BEGIN
     CREATE TYPE proposal_kind AS ENUM ('initial-sale', 'additional-work');
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;

   ALTER TABLE proposals
     ADD COLUMN IF NOT EXISTS kind proposal_kind NOT NULL DEFAULT 'initial-sale';
   ```

2. **Drop the wrong index** (idempotent):
   ```sql
   DROP INDEX IF EXISTS proposals_one_initial_sale_per_meeting_idx
   ```

3. **Re-derive `kind` for every existing proposal** using the corrected SQL:
   ```sql
   WITH birthing_meetings AS (
     SELECT DISTINCT ON (m.project_id) m.project_id, m.id AS meeting_id
     FROM meetings m
     WHERE m.project_id IS NOT NULL
     ORDER BY m.project_id, m.created_at ASC
   )
   UPDATE proposals p
   SET kind = CASE
     WHEN m.project_id IS NULL          THEN 'initial-sale'::proposal_kind
     WHEN m.id = bm.meeting_id          THEN 'initial-sale'::proposal_kind
     ELSE                                    'additional-work'::proposal_kind
   END
   FROM meetings m
   LEFT JOIN birthing_meetings bm ON bm.project_id = m.project_id
   WHERE p.meeting_id = m.id
   ```

4. **Pre-flight check** — abort if any meeting already has 2+ approved initial-sale proposals (would block the new index and indicates dirty data needing manual resolution):
   ```sql
   SELECT meeting_id, COUNT(*)::int AS c
   FROM proposals
   WHERE kind = 'initial-sale' AND status = 'approved'
   GROUP BY meeting_id
   HAVING COUNT(*) > 1
   ```
   Throw a clear, named error inside the transaction so the rollback message is actionable.

5. **Add the new partial unique index** (idempotent):
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS proposals_one_approved_initial_sale_per_meeting_idx
   ON proposals (meeting_id)
   WHERE kind = 'initial-sale' AND status = 'approved'
   ```

6. **Print sanity-check counts**: `kind` totals AND `kind × status` cross-tab.

### What's preserved from the existing script

- Single-transaction wrapper, NODE_ENV-driven shared `db` client, package.json wire-up (`migrate:proposal-kind:dev`, `migrate:proposal-kind`).
- Idempotency: every step uses `IF NOT EXISTS` / `DROP … IF EXISTS` / duplicate-object guards, so the script runs cleanly on both a fresh DB (prod first-run) and an already-migrated DB (dev re-run after #168).

After this completes, `drizzle-kit push` should report no diff.

## UI Changes

### Filter (proposals table)

In `src/trpc/routers/proposals.router/crud.router.ts` add `kind` to the `paginatedQueryInput` filter shape and to `buildFilterWhere`:
```ts
kind: z.array(z.enum(proposalKinds)).optional()
// in buildFilterWhere mapping:
kind: v => (v.length > 0 ? inArray(proposals.kind, v) : undefined)
```

In `src/features/proposal-flow/constants/proposal-table-filter-config.ts` add a `multi-select` filter definition:
```ts
{
  id: 'kind',
  type: 'multi-select',
  label: 'Kind',
  options: [
    { label: 'Initial sale', value: 'initial-sale' },
    { label: 'Additional work', value: 'additional-work' },
  ],
}
```

URL persistence and chip-rail rendering are inherited from the existing query toolkit. No new mechanics.

### Inline badge (proposals table, first column)

The first column already renders the proposal label / customer-name composite. Render a small "Addendum" pill — `PlusIcon` + label — inline next to the proposal label, only when `proposal.kind === 'additional-work'`. `initial-sale` rows render no badge (default state, no visual noise).

Final visual treatment (token, size, gap, hover behavior) is delegated to `ui-ux-pro-max` during implementation, scoped to land in the existing data-table design language. Constraints: must not cause label truncation at standard column widths and must remain legible on mobile.

`proposal.kind` is already returned from `proposalsRouter.crud.list` (it's a column on `proposals`, picked up by `getTableColumns(proposals)`), so no procedure change is needed for the badge.

## Known Limitations (out of scope)

These are deliberately deferred — flagged here so they're not lost:

1. **`assignToProject` retroactive reclassification.** When a meeting is later assigned to an existing project via `meetingsRouter.assignToProject`, proposals already created on that meeting keep `kind = 'initial-sale'`. By strict business rule they should become `additional-work`. The UX naturally serializes "assign first, then create proposals," so this is rare in practice.

2. **Race between proposal insert and meeting-project assignment.** If a proposal is inserted in the same instant a meeting is assigned to a project, `deriveProposalKind` may read stale `meeting.projectId`. Same UX-serialization assumption.

3. **Badge on proposal detail header / contract-status panel.** The existing kind-reason text in the pre-send review block already conveys the same information in prose. Adding a visual badge there would be consistent but is not blocking this hotfix.

## Verification

- `pnpm migrate:proposal-kind:dev` produces correct counts (manually verified against dev DB after run — expect more than 3 initial-sale).
- `drizzle-kit push:dev` reports no diff after the migration runs.
- Proposals table renders the "Addendum" badge on `additional-work` rows; filter dropdown lists both kinds and applies server-side; URL chip rail reflects active kind filter.
- Approving a second initial-sale on a meeting that already has one approved initial-sale fails with a constraint violation (verifies the new index).

## File Touch List (predicted)

- `scripts/migrate-proposal-kind.ts` — full rewrite (same outer shape).
- `src/shared/db/schema/proposals.ts` — replace index declaration.
- `src/trpc/routers/proposals.router/crud.router.ts` — add `kind` to filter input + `buildFilterWhere`.
- `src/features/proposal-flow/constants/proposal-table-filter-config.ts` — add `kind` filter definition.
- `src/features/proposal-flow/ui/components/table/columns.tsx` — render Addendum badge in first column for `kind === 'additional-work'`.
- A new small badge component under `src/shared/entities/proposals/components/` if the `ui-ux-pro-max` output suggests reuse across surfaces; otherwise inline in the column cell.
