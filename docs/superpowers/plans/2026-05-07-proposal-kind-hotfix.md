# Proposal Kind Classification Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct historical `proposal.kind` classification (so all proposals on a project's birthing meeting are `initial-sale`, only later-meeting proposals are `additional-work`), replace the wrong DB partial unique index with one that enforces "at most one approved initial-sale per project," and surface `kind` in the proposals table via a filter and an inline "Addendum" badge.

**Architecture:** Two write surfaces. (1) A rewritten committable migration script in `scripts/migrate-proposal-kind.ts` that drops the old index, recomputes `kind` for all existing rows using a `birthing_meetings` CTE, and adds the new partial unique index — single transaction, idempotent on both fresh and already-migrated DBs. (2) Schema declaration in `src/shared/db/schema/proposals.ts` updated so `drizzle-kit push` reports clean diff after the migration runs. Server query layer adds `kind` to the proposals-list filter shape; client filter config adds the multi-select; first-column cell renders an inline badge when `kind === 'additional-work'`.

**Tech Stack:** Next.js 15 App Router · tRPC · Drizzle ORM (Postgres/Neon) · Zod · TanStack React Query · TanStack Table · Tailwind v4 · shadcn/ui · `tsx` for migration scripts.

**Project conventions to honor (from `memory/`):**
- **NEVER run `pnpm build`.** Use `pnpm tsc` + `pnpm lint` for verification.
- **NEVER use `pnpm db:push`** (production). Use `pnpm db:push:dev` only.
- Migration scripts use the shared `db` client; `NODE_ENV` selects dev vs prod DB.
- One React component per file. Named exports only. No file-level constants/helpers in component files.
- Sort imports per `perfectionist/sort-imports`. Always brace single-line `if`.
- This is a runtime-correctness hotfix on dev data. There is no automated test framework for one-shot SQL migrations in this repo; verification is empirical (run on dev branch DB, inspect counts, inspect rows). Drizzle migration files are not generated for the rewritten one-shot script — `db:push:dev` keeps schema in sync after the script lands the column + index.

---

## File Structure

**Modify:**
- `scripts/migrate-proposal-kind.ts` — full rewrite of the SQL backfill + index swap (same outer shape: NODE_ENV-driven shared `db`, single transaction, prints counts).
- `src/shared/db/schema/proposals.ts` — replace `proposals_one_initial_sale_per_meeting_idx` declaration with `proposals_one_approved_initial_sale_per_meeting_idx`. Update the explanatory comment.
- `src/trpc/routers/proposals.router/crud.router.ts` — add `kind` to `paginatedQueryInput` filter shape and to `buildFilterWhere` mapping.
- `src/features/proposal-flow/constants/proposal-table-filter-config.ts` — add a `multi-select` filter definition with id `kind`.
- `src/features/proposal-flow/ui/components/table/columns.tsx` — render an inline "Addendum" badge in the first column when `row.original.kind === 'additional-work'`.

**Possibly create (decided in Task 6 based on `ui-ux-pro-max` output):**
- `src/shared/entities/proposals/components/addendum-badge.tsx` — only if the badge is reused across surfaces. Otherwise inline in the column cell.

**Do not touch:**
- `src/shared/entities/proposals/lib/derive-proposal-kind.ts` — runtime derivation is correct; spec marks it as non-goal.
- `src/shared/dal/server/proposals/api.ts` — `createProposal`'s use of `deriveProposalKind` stays as-is.
- Existing zoho-sign envelope assembly — already kind-aware via #168.

---

## Task 1: Rewrite the migration script with corrected backfill

**Files:**
- Modify: `scripts/migrate-proposal-kind.ts` (full rewrite, same path)

**Why:** The existing backfill marks at most one proposal per project as `initial-sale` (and silently mis-classifies projectless proposals). The corrected logic uses a `birthing_meetings` CTE to identify the earliest meeting per project and marks all proposals on that meeting as `initial-sale`.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `scripts/migrate-proposal-kind.ts` with:

```ts
/* eslint-disable no-console */
/**
 * Re-runnable schema-plus-data migration for proposal.kind (issue #92, hotfix
 * to #168).
 *
 * What it does, in a single transaction:
 *   1. Ensure `proposal_kind` enum + `proposals.kind` column exist (idempotent —
 *      no-op on already-migrated DBs, required for prod first-run).
 *   2. Drop the old partial unique index `proposals_one_initial_sale_per_meeting_idx`
 *      if present. Its invariant ("one initial-sale per meeting") was wrong —
 *      a meeting can legitimately have multiple sent/draft initial-sale
 *      attempts (the agent iterating on an offer).
 *   3. Recompute `kind` for every proposal using the corrected rule:
 *        - meeting has no project       → initial-sale
 *        - meeting is the earliest meeting (by created_at) linked to its
 *          project ("birthing meeting") → initial-sale (all proposals on it,
 *          regardless of status)
 *        - otherwise                    → additional-work
 *   4. Pre-flight: assert no meeting has 2+ approved initial-sale proposals
 *      (would block the new index and indicates dirty data).
 *   5. Add the new partial unique index
 *      `proposals_one_approved_initial_sale_per_meeting_idx` —
 *      `(meeting_id) WHERE kind = 'initial-sale' AND status = 'approved'`.
 *      Because all initial-sale proposals for a project live on one (birthing)
 *      meeting, "per meeting" transitively means "per project".
 *
 * Idempotent — safe to re-run. After this completes, `pnpm db:push:dev` should
 * report "no changes detected" for the proposals table.
 *
 * Usage:
 *   pnpm migrate:proposal-kind:dev    # dev DB (default NODE_ENV)
 *   pnpm migrate:proposal-kind        # prod DB (sets NODE_ENV=production)
 */
import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'

async function main() {
  const isProd = process.env.NODE_ENV === 'production'
  console.log(`NODE_ENV=${process.env.NODE_ENV ?? 'undefined'} → ${isProd ? 'PROD' : 'DEV'} DB`)

  await db.transaction(async (tx) => {
    console.log('\n[1/5] Ensuring proposal_kind enum + kind column exist...')
    await tx.execute(sql`
      DO $$ BEGIN
        CREATE TYPE proposal_kind AS ENUM ('initial-sale', 'additional-work');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `)
    await tx.execute(sql`
      ALTER TABLE proposals
        ADD COLUMN IF NOT EXISTS kind proposal_kind NOT NULL DEFAULT 'initial-sale'
    `)

    console.log('[2/5] Dropping old index proposals_one_initial_sale_per_meeting_idx (if present)...')
    await tx.execute(sql`
      DROP INDEX IF EXISTS proposals_one_initial_sale_per_meeting_idx
    `)

    console.log('[3/5] Recomputing kind for all existing proposals...')
    await tx.execute(sql`
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
    `)

    const totals = await tx.execute(sql`
      SELECT kind, COUNT(*)::int AS count
      FROM proposals
      GROUP BY kind
      ORDER BY kind
    `)
    console.log('       Totals by kind:', totals.rows)

    const cross = await tx.execute(sql`
      SELECT kind, status, COUNT(*)::int AS count
      FROM proposals
      GROUP BY kind, status
      ORDER BY kind, status
    `)
    console.log('       Cross-tab kind × status:', cross.rows)

    console.log('[4/5] Pre-flight: checking for meetings with 2+ approved initial-sale proposals...')
    const dupes = await tx.execute(sql`
      SELECT meeting_id, COUNT(*)::int AS c
      FROM proposals
      WHERE kind = 'initial-sale' AND status = 'approved'
      GROUP BY meeting_id
      HAVING COUNT(*) > 1
    `)
    if (dupes.rows.length > 0) {
      console.error('       Anomaly: meetings with 2+ approved initial-sales:', dupes.rows)
      throw new Error(
        'Found meetings with multiple approved initial-sale proposals. '
        + 'Resolve manually (un-approve the duplicates) before adding the unique index.',
      )
    }

    console.log('[5/5] Creating proposals_one_approved_initial_sale_per_meeting_idx...')
    await tx.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS proposals_one_approved_initial_sale_per_meeting_idx
      ON proposals (meeting_id)
      WHERE kind = 'initial-sale' AND status = 'approved'
    `)

    console.log('\n[done] Migration committed.')
  })

  process.exit(0)
}

main().catch((err) => {
  console.error('\n[migrate] FAILED:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Run lint on the changed file**

Run: `pnpm lint`
Expected: PASS (no errors). If `perfectionist/sort-imports` complains, sort the imports (`'dotenv/config'` is a side-effect import — keep first; then `drizzle-orm`; then `@/shared/db`).

- [ ] **Step 3: Run typecheck**

Run: `pnpm tsc`
Expected: PASS. The script type-checks against the shared `db` client and `drizzle-orm` types.

- [ ] **Step 4: Run the migration on dev DB and capture output**

Run: `pnpm migrate:proposal-kind:dev`
Expected output shape:
```
NODE_ENV=undefined → DEV DB

[1/5] Ensuring proposal_kind enum + kind column exist...
[2/5] Dropping old index proposals_one_initial_sale_per_meeting_idx (if present)...
[3/5] Recomputing kind for all existing proposals...
       Totals by kind: [ { kind: 'initial-sale', count: <N1> }, { kind: 'additional-work', count: <N2> } ]
       Cross-tab kind × status: [ ... ]
[4/5] Pre-flight: checking for meetings with 2+ approved initial-sale proposals...
[5/5] Creating proposals_one_approved_initial_sale_per_meeting_idx...

[done] Migration committed.
```
**Manually verify** that `<N1>` (initial-sale count) is meaningfully larger than 3 — the user previously observed 3/13 was wrong. Roughly: `initial-sale` should equal the number of proposals on projectless meetings PLUS proposals on each project's birthing meeting; `additional-work` should equal proposals on subsequent (non-birthing) meetings of projects only. If the totals still look wrong, STOP and re-read the SQL with the user before continuing — do not proceed.

- [ ] **Step 5: Verify drizzle-kit push reports clean diff (after Task 2)**

Skip this verification for now — it's gated on Task 2 (schema declaration update). Will run after Task 2 completes.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-proposal-kind.ts
git commit -m "$(cat <<'EOF'
fix(proposals): correct migration backfill for kind classification

The previous backfill (#168) used PARTITION BY m.project_id with a
ROW_NUMBER over proposals, which mis-classified all proposals on
projectless meetings as additional-work and dropped non-earliest
proposals on the birthing meeting to additional-work too. Dev DB ran
3 initial-sale / 13 additional-work, which violated the real rule.

Rewrites the backfill around a birthing_meetings CTE so every proposal
on the earliest meeting of each project is initial-sale (regardless of
status), every proposal on subsequent project meetings is
additional-work, and projectless proposals are initial-sale.

Also drops the old "(meeting_id) WHERE kind = 'initial-sale'" partial
unique index — it forbade legitimate sent/draft initial-sale duplicates
on a single birthing meeting — and replaces it with the correct invariant
"(meeting_id) WHERE kind = 'initial-sale' AND status = 'approved'",
which transitively enforces one approved initial-sale per project.

Pre-flight aborts if any meeting already has 2+ approved initial-sales,
with a clear error message pointing at manual resolution.

Idempotent — safe to re-run on already-migrated DBs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update schema declaration to match the new index

**Files:**
- Modify: `src/shared/db/schema/proposals.ts:50-60`

**Why:** Drizzle's schema declaration is the source of truth for `db:push:dev`. After the migration runs, the declared index name must match what's actually in the DB or `db:push:dev` will try to drop+recreate.

- [ ] **Step 1: Replace the index block in the schema**

Open `src/shared/db/schema/proposals.ts`. Replace lines 50-60 (the `}, table => [ ... ])` block) with:

```ts
}, table => [
  // At most one APPROVED initial-sale per meeting. Because the runtime
  // derivation freezes kind from `meeting.projectId` at insert time, all
  // initial-sale proposals for a single project live on the project's
  // birthing meeting (the earliest meeting linked to it). So per-meeting
  // uniqueness on (kind='initial-sale', status='approved') transitively
  // enforces "at most one approved initial-sale per project" — the real
  // business invariant. Many sent/draft initial-sales on the birthing
  // meeting (the agent iterating on an offer) coexist freely.
  uniqueIndex('proposals_one_approved_initial_sale_per_meeting_idx')
    .on(table.meetingId)
    .where(sql`kind = 'initial-sale' AND status = 'approved'`),
])
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `pnpm tsc`
Expected: PASS.

- [ ] **Step 4: Verify drizzle-kit reports clean diff against dev DB**

Run: `pnpm db:push:dev`
Expected: drizzle-kit reports `No changes detected` (or equivalent — the table block matches what the migration script produced). If it suggests dropping/recreating any index, STOP — the schema declaration is out of sync with the migration script. Compare the WHERE clauses character-by-character. **Do not approve drops.**

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema/proposals.ts
git commit -m "$(cat <<'EOF'
fix(proposals): schema declares correct partial unique index

Replaces the index declaration so it matches what the migration script
lands. Drizzle-kit reports clean diff after migrate-proposal-kind runs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `kind` filter to the server-side proposals list

**Files:**
- Modify: `src/trpc/routers/proposals.router/crud.router.ts:80-88` (filter input shape)
- Modify: `src/trpc/routers/proposals.router/crud.router.ts:116-144` (`buildFilterWhere` mapping)

**Why:** The query toolkit on the proposals table sends `filters.kind` as part of its URL-persisted state; the server has to accept it and translate to a Drizzle predicate.

- [ ] **Step 1: Add `proposalKinds` to the import line**

In `src/trpc/routers/proposals.router/crud.router.ts`, find this import near the top:

```ts
import { proposalStatuses } from '@/shared/constants/enums'
```

Replace with:

```ts
import { proposalKinds, proposalStatuses } from '@/shared/constants/enums'
```

- [ ] **Step 2: Add `kind` to the `paginatedQueryInput` filter shape**

In the same file, find the `list` procedure's `.input(paginatedQueryInput({ ... }))` block (around line 80). It currently looks like:

```ts
.input(paginatedQueryInput({
  status: z.array(z.enum(proposalStatuses)).optional(),
  createdAt: dateRangeSchema.optional(),
  sentAt: dateRangeSchema.optional(),
  pipeline: z.enum(pipelines).optional(),
  price: numberRangeSchema.optional(),
  customerId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
}))
```

Add the `kind` line so it becomes:

```ts
.input(paginatedQueryInput({
  status: z.array(z.enum(proposalStatuses)).optional(),
  kind: z.array(z.enum(proposalKinds)).optional(),
  createdAt: dateRangeSchema.optional(),
  sentAt: dateRangeSchema.optional(),
  pipeline: z.enum(pipelines).optional(),
  price: numberRangeSchema.optional(),
  customerId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
}))
```

- [ ] **Step 3: Add `kind` to the `buildFilterWhere` mapping**

In the same file, find the `buildFilterWhere(input.filters, { ... })` block (around line 116). The `status` entry looks like:

```ts
status: v => (v.length > 0 ? inArray(proposals.status, v) : undefined),
```

Add an analogous `kind` entry directly after it:

```ts
status: v => (v.length > 0 ? inArray(proposals.status, v) : undefined),
kind: v => (v.length > 0 ? inArray(proposals.kind, v) : undefined),
```

- [ ] **Step 4: Run lint + typecheck**

Run: `pnpm lint && pnpm tsc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/proposals.router/crud.router.ts
git commit -m "$(cat <<'EOF'
feat(proposals): kind filter on server-side proposals list

Adds the kind filter to paginatedQueryInput and buildFilterWhere so the
proposals table can filter by initial-sale / additional-work via the
query toolbar.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `kind` to the client-side filter config

**Files:**
- Modify: `src/features/proposal-flow/constants/proposal-table-filter-config.ts`

**Why:** The query toolbar reads filter definitions from `PROPOSAL_FILTER_CONFIG`. Adding `kind` here surfaces it in the filter sheet, the chip rail, and URL state.

- [ ] **Step 1: Add the import**

In `src/features/proposal-flow/constants/proposal-table-filter-config.ts`, find:

```ts
import { proposalStatuses } from '@/shared/constants/enums'
```

Replace with:

```ts
import { proposalKinds, proposalStatuses } from '@/shared/constants/enums'
```

- [ ] **Step 2: Add the `kind` filter definition**

Find the `PROPOSAL_FILTER_CONFIG` array. It currently has entries in this order: `status`, `createdAt`, `sentAt`, `pipeline`, `price`. Insert a new `kind` entry directly after `status` so the order matches the server's filter shape and reads naturally in the UI:

```ts
export const PROPOSAL_FILTER_CONFIG = [
  {
    id: 'status',
    type: 'multi-select',
    label: 'Status',
    options: proposalStatuses.map(s => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: s,
    })),
  },
  {
    id: 'kind',
    type: 'multi-select',
    label: 'Kind',
    options: [
      { label: 'Initial sale', value: 'initial-sale' },
      { label: 'Additional work', value: 'additional-work' },
    ],
  },
  // ... rest unchanged (createdAt, sentAt, pipeline, price)
```

The remaining entries stay exactly as they are.

Note: `proposalKinds` is imported above but the option labels are spelled out manually because the const-array values use kebab-case (`'initial-sale'`) and the user-facing labels need title-case with a space (`'Initial sale'`). Don't try to derive the labels from the const array.

- [ ] **Step 3: Run lint + typecheck**

Run: `pnpm lint && pnpm tsc`
Expected: PASS. The `as const satisfies readonly FilterDefinition[]` will validate the structure.

- [ ] **Step 4: Manually verify the filter renders and applies**

Run dev server: `pnpm dev`
Open the proposals table. Open the filter sheet (clicking `QueryToolbar.FilterTrigger`). Confirm:
- "Kind" appears as a multi-select with two options: "Initial sale", "Additional work".
- Selecting "Additional work" updates the URL to include `?pp_kind=additional-work` (or similar; prefix is `pp_`).
- The chip rail shows the active filter chip.
- The table re-fetches and only shows additional-work proposals.
- Clearing the chip restores the full list.

If any of these fail: stop and inspect; do not proceed to badge work.

- [ ] **Step 5: Commit**

```bash
git add src/features/proposal-flow/constants/proposal-table-filter-config.ts
git commit -m "$(cat <<'EOF'
feat(proposals): kind multi-select in proposals table query toolbar

Surfaces initial-sale / additional-work as a filter in the proposals
table. Persists via URL prefix `pp_kind`, shows in the chip rail,
applies server-side via the kind filter added in the previous commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Render the inline "Addendum" badge in the first column

**Files:**
- Modify: `src/features/proposal-flow/ui/components/table/columns.tsx:1-77` (label cell)

**Why:** Agents need a glanceable cue that a proposal is `additional-work`. The badge appears only on additional-work rows; initial-sale rows render no badge (default state, no visual noise).

This task lands a working v1 with shadcn `Badge` + `PlusIcon`. Visual polish (token, sizing, spacing) is tightened in Task 6 via `ui-ux-pro-max`.

- [ ] **Step 1: Add imports for `Badge` and `PlusIcon`**

In `src/features/proposal-flow/ui/components/table/columns.tsx`, the current `lucide-react` import is:

```ts
import { EyeIcon } from 'lucide-react'
```

Replace with:

```ts
import { PlusIcon } from 'lucide-react'
```

(Note: `EyeIcon` was unused in the visible portion. Verify with `pnpm lint` that it's unused before removing — if lint complains it IS used elsewhere in the file, keep both: `import { EyeIcon, PlusIcon } from 'lucide-react'`.)

Then add the Badge import. Insert it alphabetically among the `@/shared/components/...` imports (perfectionist sort order):

```ts
import { Badge } from '@/shared/components/ui/badge'
```

- [ ] **Step 2: Render the badge inline next to the proposal label**

Find the label cell — it's the `cell:` function in the first column object (`accessorKey: 'label'`). The `<p className="font-medium leading-none truncate">{row.original.label}</p>` line renders the label.

Wrap that `<p>` in a flex container that conditionally renders the badge:

```tsx
<div className="flex items-center gap-1.5 min-w-0">
  <p className="font-medium leading-none truncate">{row.original.label}</p>
  {row.original.kind === 'additional-work' && (
    <Badge
      variant="secondary"
      className="shrink-0 gap-1 px-1.5 py-0 h-5 text-[10px] font-medium"
    >
      <PlusIcon className="size-2.5" />
      Addendum
    </Badge>
  )}
</div>
```

The full label-cell block becomes:

```tsx
cell: ({ row, table }) => {
  const meta = table.options.meta as ProposalTableMeta | undefined
  const { customerName, customerId } = row.original
  const canOpenProfile = Boolean(customerName && customerId)

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 space-y-0.5 max-w-55">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="font-medium leading-none truncate">{row.original.label}</p>
          {row.original.kind === 'additional-work' && (
            <Badge
              variant="secondary"
              className="shrink-0 gap-1 px-1.5 py-0 h-5 text-[10px] font-medium"
            >
              <PlusIcon className="size-2.5" />
              Addendum
            </Badge>
          )}
        </div>
        {canOpenProfile
          ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  meta?.onViewProfile(customerId!)
                }}
                className={cn(
                  'block max-w-full truncate text-left text-xs text-muted-foreground',
                  'underline decoration-dotted decoration-muted-foreground/40 underline-offset-[3px]',
                  'transition-colors hover:text-foreground hover:decoration-foreground/60',
                  'focus-visible:outline-none focus-visible:text-foreground focus-visible:decoration-foreground/60',
                  'cursor-pointer',
                )}
              >
                {customerName}
              </button>
            )
          : (
              <p className="text-xs text-muted-foreground truncate">—</p>
            )}
      </div>
      {meta && (
        <EntityActionMenu
          entity={row.original}
          actions={meta.proposalActions(row.original)}
          mode="compact"
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        />
      )}
    </div>
  )
},
```

- [ ] **Step 3: Run lint + typecheck**

Run: `pnpm lint && pnpm tsc`
Expected: PASS. `row.original.kind` is typed via `ProposalRow`, which is `inferRouterOutputs<AppRouter>['proposalsRouter']['crud']['list']['rows'][number]` — `kind` is a column on `proposals` and is included via `getTableColumns(proposals)` in the list query, so it's already on the row type with no procedure change needed.

- [ ] **Step 4: Manually verify the badge renders**

Run dev server: `pnpm dev`
Open the proposals table. Confirm:
- Rows with `kind === 'additional-work'` show a small "Addendum" pill with a `+` icon next to the proposal label.
- Rows with `kind === 'initial-sale'` show no badge.
- The badge does not visibly truncate or push the label off when the column is at default width.
- Filtering by Kind = "Initial sale" hides all badges; filtering by Kind = "Additional work" shows badges on every visible row.

If the badge truncates the label aggressively at the default column width, note it for Task 6 — `ui-ux-pro-max` will handle the visual tuning.

- [ ] **Step 5: Commit**

```bash
git add src/features/proposal-flow/ui/components/table/columns.tsx
git commit -m "$(cat <<'EOF'
feat(proposals): inline Addendum badge for additional-work rows

Renders a small Plus + Addendum pill next to the proposal label when
proposal.kind is additional-work. Initial-sale rows render no badge.

Visual polish (token, size, spacing) follows in a separate ui-ux-pro-max
pass.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Visual polish via `ui-ux-pro-max`

**Files:**
- Modify: `src/features/proposal-flow/ui/components/table/columns.tsx` (badge JSX)
- Possibly create: `src/shared/entities/proposals/components/addendum-badge.tsx`

**Why:** Per the spec, final visual treatment for the Addendum badge is delegated to `ui-ux-pro-max`. This task takes the working v1 from Task 5 and dials in the design-language fit.

- [ ] **Step 1: Invoke `ui-ux-pro-max` for the badge design**

Use the `Skill` tool with skill name `ui-ux-pro-max`. Brief it as follows:

> Polish a small inline status badge that appears in the first column of an existing data table. The table is part of an agent-facing CRM at Tri Pros Remodeling — proposals list view. The badge says "Addendum" with a leading PlusIcon, and only renders when `proposal.kind === 'additional-work'` (additional scope on an existing project, distinct from the initial-sale proposal). The current implementation uses shadcn `Badge` with `variant="secondary"` and Tailwind classes `shrink-0 gap-1 px-1.5 py-0 h-5 text-[10px] font-medium`. Constraints: must be visually subordinate to the proposal label (the label is the primary content), must not cause label truncation at standard column widths, must remain legible on mobile, and must fit the existing data-table design language (look at neighboring `StatusDropdownCell`, `DateCell`, `EntityActionMenu` for tone). The codebase uses Tailwind v4 + shadcn/ui + lucide-react. Goal: production-grade visual treatment, not a placeholder. Return the final JSX + class list, plus a one-line rationale.

- [ ] **Step 2: Apply the recommended styling**

Replace the badge JSX in `columns.tsx` with whatever `ui-ux-pro-max` returns. If it suggests extracting to a reusable component, create `src/shared/entities/proposals/components/addendum-badge.tsx` with named export:

```tsx
import type { ProposalKind } from '@/shared/constants/enums'
import { PlusIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'

interface AddendumBadgeProps {
  kind: ProposalKind
}

export function AddendumBadge({ kind }: AddendumBadgeProps) {
  if (kind !== 'additional-work') {
    return null
  }
  return (
    <Badge variant="secondary" className="...">
      <PlusIcon className="size-2.5" />
      Addendum
    </Badge>
  )
}
```

(Use exactly the className that `ui-ux-pro-max` returned. The `kind !== 'additional-work'` guard returns null so callers can render unconditionally.)

If `ui-ux-pro-max` keeps it inline (no extraction), skip creating the file and update only `columns.tsx`.

- [ ] **Step 3: Run lint + typecheck**

Run: `pnpm lint && pnpm tsc`
Expected: PASS.

- [ ] **Step 4: Manually verify**

Run dev server: `pnpm dev`
Confirm:
- Badge looks polished and proportional next to the label at desktop column width.
- Badge is legible on mobile (resize the browser or use DevTools mobile mode).
- Label text isn't aggressively truncated.
- Hover/focus states on the customer-name button below the label are unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/features/proposal-flow/ui/components/table/columns.tsx \
        src/shared/entities/proposals/components/addendum-badge.tsx 2>/dev/null
git commit -m "$(cat <<'EOF'
polish(proposals): refine Addendum badge visual treatment

ui-ux-pro-max pass on the additional-work badge — tightens sizing and
spacing to fit the existing data-table design language.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(The `2>/dev/null` on the git add line silently skips the second path if the file wasn't created — only one of the two paths needs to be staged.)

---

## Task 7: End-to-end verification

**Files:** None (verification-only).

- [ ] **Step 1: Re-run the migration to confirm idempotency**

Run: `pnpm migrate:proposal-kind:dev` (a second time)
Expected: same totals as the first run, no errors. Idempotency guards (`IF NOT EXISTS`, `DROP … IF EXISTS`, `EXCEPTION WHEN duplicate_object`) make this safe.

- [ ] **Step 2: Confirm `db:push:dev` reports clean diff**

Run: `pnpm db:push:dev`
Expected: `No changes detected` (or equivalent) — no index drops, no column additions. If anything is suggested, STOP and reconcile the schema declaration with what the migration script produced.

- [ ] **Step 3: Confirm the new index actually rejects duplicate approvals**

Pick any project in the dev DB. Find its birthing meeting (the earliest meeting linked to it) — there should be at least one approved initial-sale proposal there if the project was approved through the normal flow.

In `src/shared/db/index.ts` or via `pnpm db:studio` (if available in this repo) — or directly in a Neon SQL console — try:
```sql
-- Find a candidate
SELECT m.id AS meeting_id, COUNT(*) FILTER (WHERE p.kind = 'initial-sale' AND p.status = 'approved') AS approved_initial_sales
FROM meetings m
LEFT JOIN proposals p ON p.meeting_id = m.id
GROUP BY m.id
HAVING COUNT(*) FILTER (WHERE p.kind = 'initial-sale' AND p.status = 'approved') = 1
LIMIT 1;
```
Then attempt to update one of that meeting's other initial-sale proposals to `status = 'approved'`. The new partial unique index should reject this with a duplicate-key error like:
```
duplicate key value violates unique constraint "proposals_one_approved_initial_sale_per_meeting_idx"
```
**Roll back** any test write you did. This is a manual safety check — no commit.

- [ ] **Step 4: Confirm the proposals table renders and filters correctly**

Run dev server: `pnpm dev`
Walk through:
- Proposals page loads, table renders.
- Filter sheet shows "Kind" with two options.
- Toggling "Initial sale" / "Additional work" reflects in URL, chip rail, and visible rows.
- Additional-work rows show the polished Addendum badge.
- Initial-sale rows show no badge.
- Status filter still works alongside the kind filter.

- [ ] **Step 5: Final lint + typecheck**

Run: `pnpm lint && pnpm tsc`
Expected: PASS on both.

- [ ] **Step 6: Stop and report**

Report to the user:
- Final counts from the dev migration run (`<N1>` initial-sale, `<N2>` additional-work).
- Any rows that surprised the spec-time mental model (e.g., a project with zero approved initial-sales — possible if no proposal was ever flipped to `approved`).
- Whether `ui-ux-pro-max` extracted the badge to a reusable component or kept it inline.
- Whether the prod migration is ready to run (it should be — same script, same idempotency).

Wait for user confirmation before suggesting prod migration or PR creation.

---

## Self-Review

**Spec coverage:**
- Classification rule (runtime + backfill) → covered by Task 1 (backfill SQL) + spec note that runtime is unchanged. ✓
- Schema constraint swap (drop old index, add new) → Task 1 (migration) + Task 2 (schema declaration). ✓
- Migration script (idempotent, transactional, pre-flight, counts) → Task 1. ✓
- UI filter (server + client) → Tasks 3 + 4. ✓
- Inline Addendum badge with PlusIcon → Tasks 5 + 6. ✓
- Visual treatment via `ui-ux-pro-max` → Task 6. ✓
- Out-of-scope items (assignToProject reclassification, race conditions, detail-header badge) → already documented in the spec; not introduced as tasks. ✓

**Placeholder scan:**
- No "TBD" / "TODO" / "fill in later" in any step.
- Every code step shows the actual code to write.
- The `ui-ux-pro-max` output isn't pre-known, so Task 6 says "use exactly the className that `ui-ux-pro-max` returned" — that's a real instruction, not a placeholder.

**Type consistency:**
- `proposalKinds` / `ProposalKind` used consistently across Tasks 3, 4, 6.
- Index name `proposals_one_approved_initial_sale_per_meeting_idx` matches between Task 1 (migration) and Task 2 (schema declaration). ✓
- Column name `kind` matches what's on `proposals` table; `row.original.kind` is reachable via `inferRouterOutputs<AppRouter>` since the list query selects `getTableColumns(proposals)`. ✓
