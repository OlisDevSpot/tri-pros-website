# WS-3: Promotion (Generated STORED Columns + Trade-Query Fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote two queried JSONB paths to generated `STORED` columns with indexes (`proposals.starting_tcp`, `meetings.deal_mode`), rewrite the proposal `finalTcpExpr` to read the new column, and fix the two trade-query sites — including a **live NULL bug** in the agent action queue. `primary_trade` is deliberately **NOT** added (a proposal has one-to-many trades).

**Architecture:** Generated `STORED` columns are real, indexable, planner-statistics-bearing columns that Postgres keeps auto-synced with their JSONB source. They are read-only (Postgres computes them) and are omitted from insert/update paths. `starting_tcp` replaces the inline `(fundingJSON->'data'->>'startingTcp')::numeric` extraction so `WHERE`/`ORDER BY` on price hit an index. `deal_mode` is additive for future deal-mix analytics (`GROUP BY deal_mode`), not queried today. The two trade reads are corrected to the real `sow[].trade.label` array shape: the action queue aggregates all section trades (`string_agg`), and the customer profile standardizes on the already-correct `sowSummary` + `Trades` compound component, demoting the scalar `.trade` to an explicit "first scope" label.

**Tech Stack:** TypeScript, Drizzle ORM (`node-postgres` + Neon Postgres), Zod, pnpm, `tsx` for a throwaway DB smoke.

**Spec:** `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` §5.

**Depends on:** WS-1 for the governance rule (ADR-0005 + `jsonb-columns.md` promotion ladder) — but this workstream can **proceed independently**; nothing in the code changes here requires WS-1's docs to exist. WS-2 is unrelated (different seam). Sequence: independent, after WS-1.

## Global Constraints

- pnpm; alias `@/` → `src/`. **NEVER `pnpm build`** (use `pnpm tsc` + `pnpm lint`). **NEVER `pnpm db:push`** (prod) — schema changes go to dev via `pnpm db:push:dev` only (isolated Neon branch).
- Work on `main`; **stage explicitly** (`git add <path>`), never `git add -A`.
- **Named exports only**; derived values computed not stored; never set `updatedAt` manually.
- **Generated STORED columns are read-only** (Postgres computes them; omit from insert/update paths). `createInsertSchema` derives from the table, but a generated column has no meaningful insert value — never send one; the insert Zod for both tables already `.omit()`s server-managed fields and adds only explicit `.extend()`s, so no new omit is required (a generated column is never in a client payload).
- Migration risk trivial at this scale (small tables); `ADD COLUMN … GENERATED … STORED` rewrites the table under `ACCESS EXCLUSIVE` — fine on dev.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

### Out of scope (noted per spec §5.3, §5.1)

- **Discount-sum stays the existing correlated subquery** (`queries.ts:160-164`). It **cannot** be a generated column — set-returning (`jsonb_array_elements`) + aggregate (`SUM`) is not `IMMUTABLE`. `finalTcp` itself stays a runtime SQL expression (depends on that array sum) — matches the "never persist derived" convention.
- **`primary_trade` is DROPPED** (not added). A proposal's `projectJSON.data.sow` is `z.array(sowSchema).min(1)` — one SOW section per trade, one-to-many by design. A scalar column would encode a false 1:1; an array-of-trades generated column is impossible (needs set-returning + aggregate, not `IMMUTABLE`).
- **`proposal_trades` child table is deferred (YAGNI)** — introduce only when a real "proposals by trade" analytics consumer lands. The correct one-to-many representation already exists (`sowSummary` + `Trades`).
- **`lead_source_kind` is handled in WS-5** as a real `capture_channel` column on `lead_meta` (better than a generated column off the blob).

---

### Task 1: Add `proposals.starting_tcp` generated column + index

**Files:**
- Modify: `src/shared/db/schema/proposals.ts` (imports line 5; column list ~line 37 after `fundingJSON`; table-extras array lines 52-64)

**Interfaces:**
- Produces: `proposals.startingTcp` (`numeric`, `mode: 'number'`) + `proposals_starting_tcp_idx` — consumed by Task 3 (`finalTcpExpr` rewrite) and Task 5 (smoke).

**Context for the implementer:** `proposals.ts:5` currently imports `import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'` — it does **NOT** import `numeric` or `index`. `sql` IS already imported from `drizzle-orm` at line 4 (`import { relations, sql } from 'drizzle-orm'`); `SQL` (the type) is not. The table already uses the array-return extras form (`}, table => [ … ])` at lines 52-64 for `uniqueIndex`. In Postgres, `.generatedAlwaysAs()` emits `STORED` by default — **no `{ mode: 'stored' }`** (that option is MySQL-only). The `(): SQL => sql\`…\`` callback form is required when the expression references other columns of the same table (verified against Drizzle pg generated-columns docs, 2026-07-03).

- [ ] **Step 1: Extend the `drizzle-orm/pg-core` import with `numeric` and `index`**

In `src/shared/db/schema/proposals.ts`, replace line 5:

```ts
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
```

with:

```ts
import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
```

- [ ] **Step 2: Add the `SQL` type import from `drizzle-orm`**

Replace line 4:

```ts
import { relations, sql } from 'drizzle-orm'
```

with:

```ts
import type { SQL } from 'drizzle-orm'
import { relations, sql } from 'drizzle-orm'
```

- [ ] **Step 3: Add the generated column after `fundingJSON`**

In the `pgTable('proposals', { … })` column object, immediately after the `fundingJSON` line (currently line 37):

```ts
  fundingJSON: jsonb('funding_JSON').$type<FundingSection>().notNull(),

  // Generated STORED column — the sortable/filterable price input pulled out
  // of the fundingJSON blob (a value that leaked into a blob is the canonical
  // promotion symptom). Postgres keeps it synced with the JSONB source; it is
  // read-only (never written by inserts/updates). `finalTcp` stays a runtime
  // expression (subtracts the discount sum). see ../../entities/proposals/DOCS.md#final-tcp-derived
  // see docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md §5.3
  startingTcp: numeric('starting_tcp', { mode: 'number' })
    .generatedAlwaysAs((): SQL => sql`(${proposals.fundingJSON}->'data'->>'startingTcp')::numeric`),
```

- [ ] **Step 4: Add the index to the table-extras array**

In the `}, table => [ … ]` array (lines 52-64), add the index alongside the existing `uniqueIndex`:

```ts
}, table => [
  uniqueIndex('proposals_one_approved_initial_sale_per_meeting_idx')
    .on(table.meetingId)
    .where(sql`kind = 'initial-sale' AND status = 'approved'`),
  index('proposals_starting_tcp_idx').on(table.startingTcp),
])
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (Confirms `numeric`/`index`/`SQL` resolve and the generated-column callback types cleanly.)

- [ ] **Step 6: Push the schema to the dev DB**

Run: `pnpm db:push:dev`
Expected: Drizzle reports adding `starting_tcp` (`GENERATED ALWAYS AS … STORED`) + `proposals_starting_tcp_idx` to `proposals`. Accept the additive change. (Isolated Neon dev branch — safe.)

- [ ] **Step 7: Commit**

```bash
git add src/shared/db/schema/proposals.ts
git commit -m "feat(schema): promote proposals.starting_tcp to generated STORED column + index

Pulls the sortable/filterable startingTcp out of fundingJSON into a
read-only generated column so price WHERE/ORDER BY can use an index.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add `meetings.deal_mode` generated column + index

**Files:**
- Modify: `src/shared/db/schema/meetings.ts` (imports lines 6-7; column list ~line 31 after `flowStateJSON`; add a table-extras array)

**Interfaces:**
- Produces: `meetings.dealMode` (`text`) + `meetings_deal_mode_idx` — not consumed by any query today (analytics-forward; enables `GROUP BY deal_mode`).

**Context for the implementer:** `meetings.ts:6` imports `import { relations } from 'drizzle-orm'` (no `sql`, no `SQL` type). `meetings.ts:7` imports `import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'` — `text` IS present, but `index` is **NOT**. The `meetings` table currently has **no table-extras array** (it closes with `})` at line 39) — you add one. `flowStateJSON` is `MeetingFlowState`, and `meetingFlowStateSchema` is `.partial()` with `dealStructure` a direct property; `dealStructureSchema.mode` = `z.enum(['finance', 'cash'])` — so the JSON path is `flowStateJSON -> dealStructure -> mode`, i.e. `#>> '{dealStructure,mode}'` (yields `'finance' | 'cash' | NULL`, text). `#>>` is `IMMUTABLE`. ✓

- [ ] **Step 1: Add `sql` value + `SQL` type imports from `drizzle-orm`**

Replace line 6:

```ts
import { relations } from 'drizzle-orm'
```

with:

```ts
import type { SQL } from 'drizzle-orm'
import { relations, sql } from 'drizzle-orm'
```

- [ ] **Step 2: Add `index` to the `drizzle-orm/pg-core` import**

Replace line 7:

```ts
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
```

with:

```ts
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
```

- [ ] **Step 3: Add the generated column after `flowStateJSON`**

In the `pgTable('meetings', { … })` column object, immediately after the `flowStateJSON` line (currently line 31):

```ts
  flowStateJSON: jsonb('flow_state_json').$type<MeetingFlowState>(),

  // Generated STORED column — deal mode ('finance' | 'cash' | NULL) pulled from
  // the flow-state blob for deal-mix analytics (GROUP BY deal_mode). Not queried
  // today. Read-only; Postgres keeps it synced with the JSONB source.
  // see docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md §5.3
  dealMode: text('deal_mode')
    .generatedAlwaysAs((): SQL => sql`${meetings.flowStateJSON} #>> '{dealStructure,mode}'`),
```

- [ ] **Step 4: Add a table-extras array with the index**

Change the table close (line 39) from:

```ts
  createdAt,
  updatedAt,
})
```

to:

```ts
  createdAt,
  updatedAt,
}, table => [
  index('meetings_deal_mode_idx').on(table.dealMode),
])
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Push the schema to the dev DB**

Run: `pnpm db:push:dev`
Expected: Drizzle reports adding `deal_mode` (`GENERATED ALWAYS AS … STORED`) + `meetings_deal_mode_idx` to `meetings`. Accept the additive change.

- [ ] **Step 7: Commit**

```bash
git add src/shared/db/schema/meetings.ts
git commit -m "feat(schema): promote meetings.deal_mode to generated STORED column + index

Extracts flowStateJSON.dealStructure.mode into a read-only generated
column for future deal-mix analytics (GROUP BY deal_mode). Not queried today.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Rewrite `finalTcpExpr` to read the `starting_tcp` column

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (`finalTcpExpr`, lines 156-165)

**Interfaces:**
- Consumes: `proposals.startingTcp` (Task 1).
- Produces: an identical-shaped `sql<number>` expression, now sourcing `startingTcp` from the indexed column instead of the JSONB path. No signature change; `finalTcpExpr` is still used by the `price` filter (lines 191-192) and the `price` sort key (line 206).

**Context for the implementer:** Only the `startingTcp` term changes. The **discount-sum subquery (lines 160-164) stays exactly as-is** — it cannot be a generated column (see Out of scope). `proposals.startingTcp` is `numeric mode:'number'`, so `COALESCE(proposals.startingTcp, 0)` keeps the numeric type the surrounding `GREATEST(0::numeric, …)` expects (the column is nullable because generated columns can produce NULL when the source key is absent).

- [ ] **Step 1: Replace the `startingTcp` extraction in `finalTcpExpr`**

In `queries.ts`, replace the `finalTcpExpr` block (lines 156-165):

```ts
    // SQL mirror of `computeFinalTcp`. see ../../DOCS.md#final-tcp-derived
    const finalTcpExpr = sql<number>`GREATEST(
      0::numeric,
      COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0)
      - COALESCE((
          SELECT SUM((inc->>'amount')::numeric)
          FROM jsonb_array_elements(${proposals.fundingJSON}->'data'->'incentives') AS inc
          WHERE inc->>'type' = 'discount'
        ), 0)
    )`
```

with:

```ts
    // SQL mirror of `computeFinalTcp`. see ../../DOCS.md#final-tcp-derived
    // startingTcp now reads the generated STORED column (indexed); the
    // discount sum stays a correlated subquery — set-returning + aggregate
    // can't be a generated column (not IMMUTABLE).
    // see docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md §5.3
    const finalTcpExpr = sql<number>`GREATEST(
      0::numeric,
      COALESCE(${proposals.startingTcp}, 0)
      - COALESCE((
          SELECT SUM((inc->>'amount')::numeric)
          FROM jsonb_array_elements(${proposals.fundingJSON}->'data'->'incentives') AS inc
          WHERE inc->>'type' = 'discount'
        ), 0)
    )`
```

- [ ] **Step 2: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (`proposals.startingTcp` resolves as a `PgColumn`; `sql` interpolation of a column reference is standard.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/proposals/dal/server/queries.ts
git commit -m "refactor(proposals): read finalTcp startingTcp term from the generated column

Swaps the inline (fundingJSON->'data'->>'startingTcp')::numeric extraction
for the indexed proposals.startingTcp generated column. Discount subquery
unchanged (can't be a generated column).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Fix the live NULL trade bug in the agent action queue

**Files:**
- Modify: `src/features/agent-dashboard/dal/server/get-action-queue.ts` (the `trade` select, line 125)

**Interfaces:**
- Consumes: `proposals.projectJSON` (`ProjectSection` — `data.sow[].trade.label`).
- Produces: `ActionItem.trade` (`string | null`) now populated with a comma-joined list of the proposal's SOW trades instead of always-NULL. No `ActionItem` interface change (still `trade: string | null`, line 24).

**Context for the implementer (the bug):** Line 125 reads `${proposals.projectJSON}->'data'->'trade'->>'label'` — but `projectDataSchema` has **no** top-level `data.trade`; trades live at `data.sow[].trade.label` (`sowSchema.trade` = `constructionItemSchema` = `{ id, label }`). So `ActionItem.trade` has been silently **NULL** for every proposal in the queue. Fix by aggregating all section trades. The correlated subquery is scoped to `proposals.projectJSON` (the outer row), so it works inside the existing `GROUP BY proposals.id, …` — no new group key needed. `<> ''` guards against empty labels; `DISTINCT` de-dupes when two sections share a trade; `string_agg` returns `NULL` when there are no matching rows, matching the `string | null` type.

- [ ] **Step 1: Replace the broken `trade` select expression**

In `get-action-queue.ts`, replace line 125:

```ts
      trade: sql<string | null>`${proposals.projectJSON}->'data'->'trade'->>'label'`.as('trade'),
```

with:

```ts
      // Aggregate every SOW section's trade label (a proposal is one-to-many
      // over trades). Previous path `->'data'->'trade'->>'label'` was always
      // NULL — no top-level data.trade exists; trades live at data.sow[].trade.
      // see docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md §5.2
      trade: sql<string | null>`(
        SELECT string_agg(DISTINCT elem->'trade'->>'label', ', ')
        FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS elem
        WHERE elem->'trade'->>'label' <> ''
      )`.as('trade'),
```

- [ ] **Step 2: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/agent-dashboard/dal/server/get-action-queue.ts
git commit -m "fix(agent-dashboard): action-queue trade was always NULL — aggregate SOW trades

The trade select read a non-existent data.trade path (always NULL). Replace
with a string_agg over data.sow[].trade.label so ActionItem.trade shows the
proposal's real trade(s).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: DB smoke — prove generated columns populate + the action-queue trade is non-null

**Files:**
- Create: `scripts/smoke-ws3-promotion.ts` (temporary verification script; deleted at the end of the task)

**Interfaces:**
- Consumes: the dev DB (isolated Neon branch) after Tasks 1-4 are pushed.

**Context:** No DB test harness exists; this is a manual smoke. Scripts must `import './lib/load-env'` (NOT `dotenv/config`) so `.env.local` worktree overrides load; the runtime DB client selects `DATABASE_DEV_URL` via `NODE_ENV`. This script reads existing dev rows (the DB snapshot has real proposals/meetings) and asserts: (a) `starting_tcp` populated where `fundingJSON.data.startingTcp` exists; (b) `deal_mode` populated where `flowStateJSON.dealStructure.mode` exists; (c) the action-queue `trade` expression returns non-null for at least one sent proposal that has a SOW trade. It writes nothing — pure read asserts, so no cleanup of DB state is needed.

- [ ] **Step 1: Write the smoke script**

Create `scripts/smoke-ws3-promotion.ts`:

```ts
import './lib/load-env'

import { and, eq, isNotNull, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'

async function main() {
  // (a) starting_tcp populates from fundingJSON.data.startingTcp.
  const [tcp] = await db
    .select({
      id: proposals.id,
      startingTcp: proposals.startingTcp,
      jsonTcp: sql<string | null>`${proposals.fundingJSON}->'data'->>'startingTcp'`,
    })
    .from(proposals)
    .where(sql`${proposals.fundingJSON}->'data'->>'startingTcp' IS NOT NULL`)
    .limit(1)
  const tcpOk = !!tcp && tcp.startingTcp !== null && String(tcp.startingTcp) === String(tcp.jsonTcp)
  console.log('starting_tcp populated & matches JSON:', tcpOk, JSON.stringify(tcp))

  // (b) deal_mode populates from flowStateJSON.dealStructure.mode.
  const [mode] = await db
    .select({
      id: meetings.id,
      dealMode: meetings.dealMode,
      jsonMode: sql<string | null>`${meetings.flowStateJSON} #>> '{dealStructure,mode}'`,
    })
    .from(meetings)
    .where(sql`${meetings.flowStateJSON} #>> '{dealStructure,mode}' IS NOT NULL`)
    .limit(1)
  // If no meeting has a deal mode yet, treat as vacuously OK (column exists, is queryable).
  const modeOk = !mode || (mode.dealMode !== null && mode.dealMode === mode.jsonMode)
  console.log('deal_mode populated & matches JSON:', modeOk, JSON.stringify(mode ?? 'no rows with dealStructure.mode'))

  // (c) action-queue trade expression is non-null for a sent proposal with a SOW trade.
  const [trade] = await db
    .select({
      id: proposals.id,
      trade: sql<string | null>`(
        SELECT string_agg(DISTINCT elem->'trade'->>'label', ', ')
        FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS elem
        WHERE elem->'trade'->>'label' <> ''
      )`,
    })
    .from(proposals)
    .where(and(
      eq(proposals.status, 'sent'),
      isNotNull(sql`${proposals.projectJSON}->'data'->'sow'->0->'trade'->>'label'`),
    ))
    .limit(1)
  const tradeOk = !trade || (trade.trade !== null && trade.trade.length > 0)
  console.log('action-queue trade non-null:', tradeOk, JSON.stringify(trade ?? 'no sent proposal with a SOW trade'))

  if (!tcpOk || !modeOk || !tradeOk) {
    throw new Error('SMOKE FAILED')
  }
  console.log('SMOKE PASSED')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```

> If the dev DB has zero proposals with a `startingTcp` (fresh/empty DB), run `pnpm db:snapshot` first to copy prod data with 🧪 markers (see `memory/reference-db-snapshot.md`), then re-run. The `mode`/`trade` asserts are vacuously-OK on empty result sets so an empty deal-mode set doesn't false-fail — only `starting_tcp` requires at least one qualifying row.

- [ ] **Step 2: Run the smoke against the dev DB**

Run: `pnpm tsx scripts/smoke-ws3-promotion.ts`
Expected: `starting_tcp populated & matches JSON: true …`, `deal_mode populated & matches JSON: true …`, `action-queue trade non-null: true …`, then `SMOKE PASSED`.

- [ ] **Step 3: Delete the throwaway script**

Run: `rm scripts/smoke-ws3-promotion.ts`

- [ ] **Step 4: Verify nothing else changed**

Run: `git status --porcelain`
Expected: empty (the script was created and deleted; no tracked changes remain from this task).

---

### Task 6: Standardize the trade display on `sowSummary` / `Trades`

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts` (the `trade` select comment, line 71)

**Interfaces:**
- Consumes: the already-correct `sowSummary` (built at lines 89-103, surfaced on `CustomerProfileProposal.sowSummary` at line 121) + the `Trades` compound component (`src/shared/entities/proposals/components/overview-card.tsx:341-368`, which reads `proposal.sowSummary`).
- Produces: the scalar `.trade` (line 71) explicitly demoted to "first/primary scope's trade" — a single-chip fallback, NOT "the trades."

**Context for the implementer:** `get-customer-profile.ts:71` reads `${proposals.projectJSON}->'data'->'sow'->0->'trade'->>'label'` — the **first scope's** trade only (lossy for multi-trade proposals). This is *functional* but must not be treated as the full trade set. The correct multi-trade source **already exists in this same file**: `sowSummary` (lines 89-103) parses the whole `sow` array into `{ trade, scopes }[]` and is returned on every `CustomerProfileProposal` (line 121). The `Trades` component (overview-card.tsx:344-348) already renders `proposal.sowSummary` as de-duped badges. So there is **no data-layer rewrite needed** — the multi-trade path is present and correct. This task's scope is narrow: (1) relabel `.trade` in code so future readers know it's first-scope-only, not the trade set; (2) confirm (do not change) that the `Trades` component / `sowSummary` is the canonical multi-trade surface. If a consumer of `get-customer-profile` currently renders `.trade` as "the trade(s)", that UI swap is a **follow-up** (there is no such consumer to change in this file; the DAL already ships `sowSummary`).

- [ ] **Step 1: Verify `sowSummary` is complete and `.trade` is genuinely first-scope-only**

Read `get-customer-profile.ts` lines 71-123 and confirm: (a) `sowSummary` (lines 91-103) maps the full `sow` array → `{ trade, scopes }[]`; (b) it is assigned to the returned `CustomerProfileProposal.sowSummary` (line 121); (c) line 71's `->'sow'->0->'trade'->>'label'` is index-`0` only. No code change in this step — this is the grounding check before the relabel.

- [ ] **Step 2: Demote the scalar `.trade` with an explicit comment**

In `get-customer-profile.ts`, replace line 71:

```ts
      trade: sql<string | null>`${proposals.projectJSON}->'data'->'sow'->0->'trade'->>'label'`.as('trade'),
```

with:

```ts
      // FIRST/PRIMARY scope's trade only — a single-chip fallback, NOT the
      // full trade set. For "the trades" use `sowSummary` (built below) + the
      // `Trades` compound component. A proposal is one-to-many over trades.
      // see docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md §5.2
      trade: sql<string | null>`${proposals.projectJSON}->'data'->'sow'->0->'trade'->>'label'`.as('trade'),
```

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors (comment-only change; the SQL is unchanged, so runtime behavior is identical — `sowSummary` was already the multi-trade source).

- [ ] **Step 4: Commit**

```bash
git add src/features/customer-pipelines/dal/server/get-customer-profile.ts
git commit -m "docs(customer-profile): demote scalar .trade to first-scope fallback

Marks the sow[0].trade read as a single-chip fallback, not the trade set.
The canonical multi-trade surface (sowSummary + Trades component) already
ships on CustomerProfileProposal; no data-layer change needed.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (§5 of the spec):**
- §5.1 `primary_trade` dropped → not added anywhere; rationale in Global Constraints "Out of scope." ✓
- §5.2 trade query-site fixes:
  - `get-action-queue.ts:125` NULL bug → Task 4 (`string_agg` over `data.sow`), proven non-null in Task 5. ✓
  - `get-customer-profile.ts:71` lossy `sow[0].trade` → Task 6 (demote to first-scope; standardize on the already-present `sowSummary` + `Trades`). ✓
- §5.3 generated columns:
  - `proposals.starting_tcp` + index → Task 1; `finalTcpExpr` rewrite → Task 3. ✓
  - `meetings.deal_mode` + index → Task 2. ✓
  - discount-sum stays subquery / `finalTcp` stays runtime expr → Task 3 (unchanged) + Out of scope note. ✓
  - `lead_source_kind` deferred to WS-5 → Out of scope note. ✓
- Migration via `pnpm db:push:dev` only; generated columns read-only → Global Constraints + Tasks 1-2 Step 6. ✓

**Placeholder scan:** No TBD / "add error handling" / "write the query." The one conditional (Task 5's `pnpm db:snapshot` if the dev DB is empty) is explicit and bounded; the smoke script is throwaway and deleted in Task 5 Step 3. Task 6 correctly identifies there is **no** UI consumer to rewrite in-file and scopes itself to a relabel — not a fabricated change. ✓

**Type consistency:**
- `proposals.startingTcp` is `numeric('starting_tcp', { mode: 'number' })` → `number | null` in TS; `COALESCE(${proposals.startingTcp}, 0)` (Task 3) keeps the `GREATEST(0::numeric, …)` numeric. ✓
- `meetings.dealMode` is `text('deal_mode')` → `'finance' | 'cash' | null` at the DB (typed `string | null` by Drizzle); `#>>` yields text. ✓
- `ActionItem.trade` stays `string | null` (interface line 24 unchanged); `string_agg(… , ', ')` returns text-or-NULL. ✓
- `finalTcpExpr` remains `sql<number>` — same generic as before; still valid as the `price` filter operand (lines 191-192) and `price` sort key (line 206). ✓
- Both insert schemas (`insertProposalSchema`, `insertMeetingSchema`) are unchanged; a generated column is never in a client payload, and neither schema references the new columns, so no `.omit()` churn. ✓

**⚠️ Staleness found during grounding:** none new. The spec's own §2.1 already logged the `get-action-queue.ts:125` NULL bug and the stale merge/MEMORY docs (those doc fixes belong to WS-2, not this workstream). All code paths, line numbers, imports, and JSON paths in this plan were verified against the current files on 2026-07-03; Drizzle `generatedAlwaysAs` STORED-by-default (Postgres) + `(): SQL =>` callback form confirmed via context7 (`/drizzle-team/drizzle-orm-docs`).
