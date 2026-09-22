# Construction P2 — Plan 1: External Writes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trade slug stored data in Notion and required by the adapter, snapshot the live slugs into a generated `TradeSlug` type, mirror the `Unit of Pricing` select as a Zod enum, and drop the retired `construction_type` taxonomy from Postgres — every external write behind a gate the owner runs.

**Architecture:** Plan 1 is the half of P2 that touches things outside this repo's code: production Notion (a new `Slug` property and its backfill), the dev Postgres branch (one DDL), and a generated file. Each task lands the code first, proves it with a pure fixture script and the live seam check, then stops at an owner-run gate. Plan 2 (pure code — registries, resolver, consumers) starts after Task 3 here, because every registry it writes is typed by this plan's snapshot.

**Tech Stack:** TypeScript, Zod, `@notionhq/client` 5.9 (`dataSources.retrieve/query`, `pages.update`), Drizzle + `drizzle-kit push` (Neon Postgres), pnpm, `npx tsx`, `node:assert/strict` fixture scripts (this repo has no test framework; P0/P1 verify with `scripts/verify-*.ts`).

**Spec:** `docs/superpowers/specs/2026-09-22-construction-p2-rules-and-identity-design.md` — §2 decisions, §4.1 surface, §4.2 identity, §4.4 taxonomy and pricing units, §4.8 DDL, §5 gates V1, V3, V4, V5, §7 plan 1 table. Read it first; this plan argues from it.

## Global Constraints

These apply to **every** task. They are repo rules, not suggestions.

- **Verification is `pnpm tsc` and `CI=1 pnpm lint` only. NEVER run `pnpm build`.** (`CLAUDE.md`) Under VS Code env vars `@antfu/eslint-config` softens rules; `CI=1` restores them. `tsc` covers `**/*.ts`, so `scripts/` is type-checked too.
- **Never `git push`.** `main` is ~130 commits ahead of origin by design; the owner pushes.
- **Never `pnpm db:push:prod`, never `DRIZZLE_TARGET=prod` anything.** Prod is its own explicit go, after this plan, recorded in Task 6. `db:push:dev` and `db:seed:dev` are **owner-run gates** in Task 5, not steps you run.
- **Notion is production and there is only one.** Reads are free. The only write is `scripts/backfill-trade-slugs.ts --apply`, and the **owner runs it** (Task 1 gate 2). The `Slug` property itself is created by the owner in the Notion UI (Task 1 gate 1). You never call `pages.update` or `dataSources.update` outside that script.
- **Do not touch the dev server on :3000** (another session holds it). Nothing here needs it.
- **Work on `main`. Stage explicit file paths only — never `git add -A`, never a directory.** ~57 files in this tree carry other sessions' uncommitted WIP (`src/features/`, `src/shared/entities/`, `docs/` …). Every task runs the **commit gate**:

  ```bash
  S=/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/4550515e-e91f-4eb9-8ca7-b50d6b7e93de/scratchpad
  mkdir -p $S
  # Step 0, BEFORE the task's first edit — snapshot foreign WIP (paths + content hashes)
  git diff --cached --quiet || { echo "index not empty — STOP"; }
  git status --porcelain > $S/wip-before.txt
  git status --porcelain | awk '{print $NF}' | xargs -r sha1sum > $S/wip-hashes.txt 2>/dev/null
  # If any file on the task's Files list is already in wip-before.txt: STOP and ask the owner.

  # At commit time
  sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null   # prints a foreign-WIP file you modified → STOP and ask
  git status --porcelain | grep -vxFf $S/wip-before.txt  # = this task's files; stage each by explicit path
  git diff --cached --name-status                        # must list only this task's files, or `git restore --staged <path>`
  ```
- **Before staging, list every changed non-import line per file** and confirm each belongs to the task (a live session may be editing the same files):
  ```bash
  git diff -M HEAD -U0 -- <task paths, BOTH sides of each rename> \
    | awk '/^\+\+\+ /{f=substr($0,5)} /^--- a\//{d=substr($0,7)} /^\+\+\+ \/dev\/null/{f=d} /^[+-][^+-]/{print f"\t"$0}' \
    | grep -vP "\t[+-]\s*(import |\} from ')" | cut -f1 | sort | uniq -c
  ```
- **The snapshot does not cover files a live session starts editing mid-task.** Keep an explicit list of the files this task edited, stage only that list, and treat any other candidate as foreign until proven otherwise. Confirm none of *your* files changed after your verification run.
- **Preserve line endings.** 67 tracked `.ts/.tsx` files use CRLF. Use `sed` or an editor that keeps them; check `git diff --stat` matches the intended line count.
- **Never `git add -N`** — it marks every foreign untracked file intent-to-add.
- **Every commit leaves `pnpm tsc` and `CI=1 pnpm lint` green.** No task ends red.
- **Non-defensive migration** (D6). Delete the old path in the same commit that lands the new one. No aliases, shims, dual paths or back-compat fields. `slugifyTradeName` moving to `scripts/lib/` in Task 2 is the one move; there is never a copy in two places.
- **Scripts load env via `import './lib/load-env'`** — never `import 'dotenv/config'` (`memory/feedback-scripts-load-env.md`). Scratchpad scripts import it by absolute path.
- **Do not change behaviour or copy** beyond what a task names. The two open owner escalations (`programs.ts` IRA 25C claims, `program-step.tsx` loading gate) are not touched.
- **Import order is lint-enforced** (`perfectionist/sort-imports`). After adding imports, run `CI=1 pnpm exec eslint --fix <this task's files>` — **never repo-wide**, which would rewrite foreign-WIP files. `--fix` may strip a `/* eslint-disable no-console */` header it thinks is unused in `scripts/` — restore it.
- **Scope is this plan's file list.** Anything not named — `package.json` (no new scripts; everything runs via `npx tsx`), configs, barrels, `docs/codebase-conventions/enum-standardization.md`, the 2026-09-14 design doc, any `src/features/**` file — is a question to the owner before the edit. Plan 2 owns the consumers.
- **Ping staleness.** If a doc, comment or tracker line you read disagrees with the code, say: "⚠️ Stale ref — `<doc>:<line>` says `X`, but code at `<path>` does `Y`." Fix it only if it is on this plan's file list; otherwise report it.
- **Checkpoint format** at the end of every task: a markdown table of clickable relative file links with a few-word change column. No diffs.

## Review Focus

Failure modes the spec implies but no gate names. Each has its test pinned to the owning task.

1. **A trade title that derives an empty or duplicate slug** (a title of only symbols; two rows that slugify identically, one disabled). The backfill must refuse to write anything, not write a blank or a collision. → Task 1, `scripts/verify-slug-backfill-plan.ts`.
2. **The `Slug` property exists but is the wrong type** (created as Title, Formula or Select instead of Text). Every row would then fail extraction and the whole catalog would empty on the adapter switch. The backfill must refuse to run and say why. → Task 1, `slugPropertyProblem` test.
3. **The owner later edits a stored slug to something with spaces or capitals.** The adapter must drop that row with a warn, not serve a broken URL, and the seam check must fail. → Task 2, adapter fixtures.
4. **A scope whose `Unit of Pricing` select is blank** once the enum has no default. It must be found *before* the enum lands, and afterwards skipped with a warn rather than coerced to `'unit'`. → Task 4, blank-row pre-check and adapter fixtures.
5. **`drizzle-kit push` drops the column but leaves the `construction_type` enum type behind.** The post-push query must catch it and the owner has the one-line fallback. → Task 5, Step 8.

## Decisions taken while planning

Recorded so the tracker and plan 2 match what this plan does; none changes the spec's intent.

1. **The backfill reads raw rows through `queryNotionDatabase('trades')`**, which already paginates and does *not* apply the disabled gate (that lives in the adapter), instead of a hand-rolled paginator. Scripts importing `sources/notion/*` follows the P1 precedent `scripts/verify-notion-adapters.ts`.
2. **`slugifyTradeName` moves in Task 2, not Task 1.** Task 1's backfill imports it from `src/shared/lib/` while the adapter still does; Task 2 switches the adapter and `git mv`s the helper to `scripts/lib/` in the same commit. No interim copy.
3. **`tradeSchema.slug` gets a regex, not just `.min(1)`**: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. A stored slug is a URL segment; the schema is the one place to say so.
4. **Three DOCS anchors land in this plan with the code they describe**: `#catalog-identity` and `#slug-is-stored` (Task 2), `#category-taxonomy` rewritten (Task 5). Spec §4.6 assigned all anchors to plan 2; leaving the adapter citing an anchor that does not exist for a whole plan is the staleness `CLAUDE.md` forbids. Plan 2 writes the other five.
5. **`scripts/verify-catalog-keys.ts` is created here with its snapshot half** (snapshot ⊆ live, warn on live − snapshot), because spec §7 gates Task 4 on it. Plan 2 extends it with the id-keyed maps.
6. **The scopes adapter's `raw` loses its `Partial<Scope>` annotation.** With `unitOfPricing` an enum, the annotation forced the exact unchecked cast A5 removes; `safeParse` takes `unknown`.

## Final file layout (this plan)

```
scripts/
  backfill-trade-slugs.ts            NEW  dry-run / --apply, owner-run
  generate-trade-slugs.ts            NEW  writes the snapshot
  verify-catalog-keys.ts             NEW  snapshot ⊆ live (plan 2 extends)
  verify-slug-backfill-plan.ts       NEW  pure fixture test for the planner
  verify-notion-adapters.ts          MOD  trade + pricing-unit fixtures
  verify-catalog-seam.ts             MOD  slug uniqueness, select-option mirrors
  lib/plan-slug-backfill.ts          NEW  pure planner + property check
  lib/slugify-trade-name.ts          MOVED from src/shared/lib/
src/shared/modules/construction/
  core/schemas/index.ts              MOD  slug regex, pricingUnits, unitOfPricing enum
  core/constants/enums.ts            MOD  constructionTypes deleted
  core/constants/trade-slugs.generated.ts  NEW (generated)
  sources/notion/trades/properties-map.ts  MOD  slug: rich_text
  sources/notion/trades/adapter.ts   MOD  reads Slug, never derives
  sources/notion/scopes/adapter.ts   MOD  cast removed
  DOCS.md                            MOD  #catalog-identity, #slug-is-stored, #category-taxonomy
src/shared/db/
  schema/scopes.ts, schema/meta.ts   MOD  column + enum removed
  seeds/data/scopes.ts, seeds/scopes.ts  MOD  field removed (52 rows), upsert line removed
docs/plans/2026-09-15-construction-data-standardization-epic.md  MOD  Task 5 pointer, Task 6 status
```

---

### Task 1: The `Slug` property map entry and the backfill script

The Notion Trades data source gets a `Slug` rich_text property (owner, UI). This task teaches the property map about it and ships the script that fills it — dry-run by default, `--apply` owner-run, never overwriting, refusing on duplicates or blanks. The adapter still derives the slug after this task; Task 2 flips it.

**Files:**
- Modify: `src/shared/modules/construction/sources/notion/trades/properties-map.ts`
- Create: `scripts/lib/plan-slug-backfill.ts`
- Create: `scripts/verify-slug-backfill-plan.ts`
- Create: `scripts/backfill-trade-slugs.ts`

**Interfaces:**
- Consumes: `queryNotionDatabase('trades')` (`sources/notion/query.ts`, paginates, returns raw pages incl. disabled), extractors `titleText` / `richText` / `checkbox`, `notionDatabasesMeta.trades.id`, `notionClient` (`providers/notion/client.ts`), `slugifyTradeName` (still at `src/shared/lib/slugify-trade-name.ts` until Task 2).
- Produces: `TRADE_PROPERTIES_MAP.slug = { label: 'Slug', type: 'rich_text' }` and `TradePropertySource = Omit<Trade, 'coverImageUrl'> & { disabled: boolean }` (Task 2's adapter reads the label); `planSlugBackfill(rows: SlugBackfillRow[]): SlugBackfillPlan` and `slugPropertyProblem(prop): string | null` in `scripts/lib/plan-slug-backfill.ts`.

- [ ] **Step 0: Commit-gate snapshot** (Global Constraints). Confirm none of this task's files appear in `$S/wip-before.txt`.

- [ ] **Step 1: Add `slug` to the trades property map**

Replace the whole of `src/shared/modules/construction/sources/notion/trades/properties-map.ts` with:

```ts
import type { Trade } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'

/** `disabled` is an extraction-time gate, not a domain field — see ./adapter.ts. */
export type TradePropertySource = Omit<Trade, 'coverImageUrl'> & { disabled: boolean }

export const TRADE_PROPERTIES_MAP = {
  name: {
    label: 'Trade',
    type: 'title',
  },
  slug: {
    label: 'Slug',
    type: 'rich_text',
  },
  category: {
    label: 'Type',
    type: 'select',
  },
  scopeIds: {
    label: 'Scopes',
    type: 'relation',
  },
  disabled: {
    label: 'Disabled',
    type: 'checkbox',
  },
} as const satisfies RawPropertyMap<TradePropertySource>
```

`RawPropertyMap<T>` is `Omit<Record<keyof T, NotionPropDef>, 'id'>`, so removing `'slug'` from the `Omit` is what *requires* the new entry — `satisfies` fails without it. Run `pnpm tsc`: expected clean (the adapter does not read `slug` from the map yet, and `databases.ts` types the map through the same `TradePropertySource`).

- [ ] **Step 2: Write the failing planner test**

Create `scripts/verify-slug-backfill-plan.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { planSlugBackfill, slugPropertyProblem } from './lib/plan-slug-backfill'

// --- classification: write / same / conflict, disabled rows included ---
const plan = planSlugBackfill([
  { pageId: 'a', title: 'Roof & Gutters', disabled: false, current: '', derived: 'roof-and-gutters' },
  { pageId: 'b', title: 'HVAC', disabled: false, current: 'hvac', derived: 'hvac' },
  { pageId: 'c', title: 'Solar', disabled: true, current: '', derived: 'solar' },
  { pageId: 'd', title: 'Tile', disabled: false, current: 'tiles', derived: 'tile' },
])
assert.deepEqual(plan.rows.map(r => r.action), ['write', 'same', 'write', 'conflict'])
assert.equal(plan.writes, 2, 'blank slugs are written, disabled rows included')
assert.equal(plan.conflicts, 1, 'a stored slug that differs from the derived one is a conflict, never overwritten')
assert.deepEqual(plan.duplicates, [])
assert.deepEqual(plan.unslugifiable, [])

// --- Review Focus 1: empty and colliding derived slugs are refused, not written ---
const bad = planSlugBackfill([
  { pageId: 'a', title: 'Tile', disabled: false, current: '', derived: 'tile' },
  { pageId: 'b', title: 'Tile ', disabled: true, current: '', derived: 'tile' },
  { pageId: 'c', title: '???', disabled: false, current: '', derived: '' },
])
assert.deepEqual(bad.duplicates, [{ slug: 'tile', titles: ['Tile', 'Tile '] }], 'duplicates are detected across disabled rows too')
assert.deepEqual(bad.unslugifiable, ['???'], 'a title that derives an empty slug is reported by title')
assert.equal(bad.rows.find(r => r.pageId === 'c')?.action, 'write', 'the row is still classified; the caller refuses on unslugifiable')

// --- idempotency: re-planning the applied state is all `same` ---
const applied = plan.rows.filter(r => r.action !== 'conflict').map(r => ({ ...r, current: r.derived }))
assert.ok(planSlugBackfill(applied).rows.every(r => r.action === 'same'), 'after apply, every row is same')

// --- Review Focus 2: the Slug property must exist and be rich_text ---
assert.equal(slugPropertyProblem(undefined), 'no "Slug" property — create it in the Notion UI as type "Text"')
assert.equal(slugPropertyProblem({ type: 'title' }), '"Slug" is type "title", not rich_text — recreate it as type "Text"')
assert.equal(slugPropertyProblem({ type: 'rich_text' }), null)

console.log('✅ slug backfill plan: write/same/conflict, duplicates, unslugifiable, idempotent, property check')
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsx scripts/verify-slug-backfill-plan.ts`
Expected: FAIL — `Cannot find module './lib/plan-slug-backfill'`.

- [ ] **Step 4: Write the planner**

Create `scripts/lib/plan-slug-backfill.ts`:

```ts
/**
 * Pure planner for `scripts/backfill-trade-slugs.ts`. No I/O, so it is
 * testable with fixtures (`scripts/verify-slug-backfill-plan.ts`).
 *
 * A row is `write` when its stored slug is blank, `same` when stored equals
 * derived, and `conflict` when a stored slug differs — the backfill never
 * overwrites a slug a human typed. Duplicate and empty derived slugs are
 * reported separately; the caller refuses to write while either is non-empty,
 * because a blank or colliding slug would break URLs and registry keys
 * (P2 spec §4.2, DOCS.md#slug-is-stored).
 */
export interface SlugBackfillRow {
  pageId: string
  title: string
  disabled: boolean
  /** The stored `Slug` rich_text, trimmed; '' when blank. */
  current: string
  /** `slugifyTradeName(title)`. */
  derived: string
}

export type SlugBackfillAction = 'write' | 'same' | 'conflict'

export interface SlugBackfillPlan {
  rows: Array<SlugBackfillRow & { action: SlugBackfillAction }>
  /** Derived slugs shared by more than one row, disabled rows included. */
  duplicates: Array<{ slug: string, titles: string[] }>
  /** Titles whose derived slug is empty. */
  unslugifiable: string[]
  writes: number
  conflicts: number
}

export function planSlugBackfill(rows: SlugBackfillRow[]): SlugBackfillPlan {
  const titlesBySlug = new Map<string, string[]>()
  for (const row of rows) {
    if (row.derived !== '') {
      titlesBySlug.set(row.derived, [...(titlesBySlug.get(row.derived) ?? []), row.title])
    }
  }

  const planned = rows.map((row) => {
    const action: SlugBackfillAction = row.current === ''
      ? 'write'
      : row.current === row.derived ? 'same' : 'conflict'
    return { ...row, action }
  })

  return {
    rows: planned,
    duplicates: [...titlesBySlug.entries()]
      .filter(([, titles]) => titles.length > 1)
      .map(([slug, titles]) => ({ slug, titles })),
    unslugifiable: rows.filter(row => row.derived === '').map(row => row.title),
    writes: planned.filter(row => row.action === 'write').length,
    conflicts: planned.filter(row => row.action === 'conflict').length,
  }
}

/** `null` when the data source's `Slug` property is usable; otherwise the message to print before exiting. */
export function slugPropertyProblem(prop: { type: string } | undefined): string | null {
  if (!prop) {
    return 'no "Slug" property — create it in the Notion UI as type "Text"'
  }
  if (prop.type !== 'rich_text') {
    return `"Slug" is type "${prop.type}", not rich_text — recreate it as type "Text"`
  }
  return null
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx tsx scripts/verify-slug-backfill-plan.ts`
Expected: `✅ slug backfill plan: write/same/conflict, duplicates, unslugifiable, idempotent, property check`

- [ ] **Step 6: Write the backfill script**

Create `scripts/backfill-trade-slugs.ts`:

```ts
/* eslint-disable no-console */
/**
 * Backfill the Notion Trades data source's `Slug` property from each row's
 * title, with the same derivation the adapter used before P2 — so no public
 * URL changes (P2 spec §4.2, V3). Reads EVERY row, disabled included, so a
 * trade re-enabled later never arrives slugless.
 *
 *   npx tsx scripts/backfill-trade-slugs.ts            dry run: prints the plan, writes nothing
 *   npx tsx scripts/backfill-trade-slugs.ts --apply    writes the `write` rows only
 *
 * Never overwrites a stored slug (a differing one is a `conflict` and aborts),
 * never writes while any derived slug is blank or duplicated. Re-runnable:
 * after a successful apply every row is `same`. Run it again whenever a trade
 * is added in Notion without a slug — the adapter drops slugless rows
 * (DOCS.md#slug-is-stored), so this is the tool that finds them.
 *
 * Reads and writes production Notion (there is only one). Imports
 * `sources/notion/*` the way `verify-notion-adapters.ts` does — scripts are
 * the one sanctioned consumer of those internals.
 */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import process from 'node:process'
import './lib/load-env'
import { planSlugBackfill, slugPropertyProblem } from './lib/plan-slug-backfill'
import { slugifyTradeName } from '@/shared/lib/slugify-trade-name'
import { notionDatabasesMeta } from '@/shared/modules/construction/sources/notion/databases'
import { checkbox, richText, titleText } from '@/shared/modules/construction/sources/notion/extractors'
import { queryNotionDatabase } from '@/shared/modules/construction/sources/notion/query'
import { TRADE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/trades/properties-map'
import { notionClient } from '@/shared/services/providers/notion/client'

const SLUG = TRADE_PROPERTIES_MAP.slug.label
/** Notion allows ~3 requests/second; 28 sequential writes at this spacing take ~10s. */
const WRITE_INTERVAL_MS = 350

function toRow(page: PageObjectResponse) {
  const p = page.properties
  const title = titleText(p, TRADE_PROPERTIES_MAP.name.label)
  return {
    pageId: page.id,
    title,
    disabled: checkbox(p, TRADE_PROPERTIES_MAP.disabled.label),
    current: richText(p, SLUG).trim(),
    derived: slugifyTradeName(title),
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const dataSourceId = notionDatabasesMeta.trades.id
  console.log(`target: production Notion, Trades data source ${dataSourceId} — ${apply ? 'APPLY' : 'dry run'}`)

  const dataSource = await notionClient.dataSources.retrieve({ data_source_id: dataSourceId })
  const problem = slugPropertyProblem('properties' in dataSource ? dataSource.properties[SLUG] : undefined)
  if (problem) {
    console.error(problem)
    process.exit(2)
  }

  const pages = (await queryNotionDatabase('trades')) ?? []
  const plan = planSlugBackfill(pages.map(toRow))

  console.table(plan.rows.map(r => ({ title: r.title, disabled: r.disabled, current: r.current, derived: r.derived, action: r.action })))
  console.log(`${plan.rows.length} rows: ${plan.writes} write, ${plan.rows.length - plan.writes - plan.conflicts} same, ${plan.conflicts} conflict`)

  if (plan.unslugifiable.length > 0) {
    console.error('titles that derive an empty slug — rename them in Notion first:', plan.unslugifiable)
    process.exit(1)
  }
  if (plan.duplicates.length > 0) {
    console.error('duplicate derived slugs — rename one of each in Notion first:', plan.duplicates)
    process.exit(1)
  }
  if (plan.conflicts > 0) {
    console.error('stored slugs that differ from the derived slug — this script never overwrites; resolve them in Notion first')
    process.exit(1)
  }
  if (!apply) {
    console.log(plan.writes > 0 ? `dry run — re-run with --apply to write ${plan.writes} slug(s)` : 'nothing to write')
    return
  }

  for (const row of plan.rows) {
    if (row.action !== 'write') {
      continue
    }
    await notionClient.pages.update({
      page_id: row.pageId,
      properties: { [SLUG]: { rich_text: [{ type: 'text', text: { content: row.derived } }] } },
    })
    console.log(`wrote ${row.derived}  ← ${row.title}${row.disabled ? ' (disabled)' : ''}`)
    await new Promise(resolve => setTimeout(resolve, WRITE_INTERVAL_MS))
  }
  console.log(`✓ wrote ${plan.writes} slug(s); re-run without --apply to confirm every row is 'same'`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && CI=1 pnpm exec eslint --fix scripts/backfill-trade-slugs.ts scripts/lib/plan-slug-backfill.ts scripts/verify-slug-backfill-plan.ts src/shared/modules/construction/sources/notion/trades/properties-map.ts && CI=1 pnpm lint`
Expected: clean. If `--fix` reorders imports, keep its order. If it removed a `/* eslint-disable no-console */` header, restore it.

- [ ] **Step 8: 🚧 GATE 1 — the owner creates the property**

Stop and ask the owner to add a property named exactly **`Slug`**, type **Text**, to the Notion **Trades** data source (the one `notionDatabasesMeta.trades.id` names, `6f00ca1b-548b-8279-9f2d-87f649413084`). Do not proceed until they confirm. Then prove it:

Run: `npx tsx scripts/backfill-trade-slugs.ts`
Expected (dry run): a table of **28 rows** (27 live + 1 disabled — the P2 spec Appendix B read), every `action` = `write`, `0 conflict`, no duplicates, no unslugifiable titles, ending `dry run — re-run with --apply to write 28 slug(s)`. The derived column must match Appendix B slug-for-slug (e.g. `Windows & doors` → `windows-and-doors`, `Electricals (finish)` → `electricals-finish`). If the property is missing or the wrong type the script exits 2 with the message from Step 4 — that is Review Focus 2 working, not a bug.

- [ ] **Step 9: 🚧 GATE 2 — the owner applies**

Ask the owner to run, themselves:

```bash
npx tsx scripts/backfill-trade-slugs.ts --apply
```

Expected: 28 `wrote <slug> ← <title>` lines, then `✓ wrote 28 slug(s)`. Then you run the dry run again:

Run: `npx tsx scripts/backfill-trade-slugs.ts`
Expected: every `action` = `same`, `nothing to write`. Paste that summary line into the checkpoint.

- [ ] **Step 10: Commit** (run the commit gate first)

```bash
git add scripts/backfill-trade-slugs.ts scripts/lib/plan-slug-backfill.ts scripts/verify-slug-backfill-plan.ts src/shared/modules/construction/sources/notion/trades/properties-map.ts
git commit -m "feat(construction-p2): Slug property map entry + trade-slug backfill (dry-run / --apply)

Notion Trades gains a Slug rich_text property (created by the owner);
this script fills it from each title with the pre-P2 derivation so no URL
changes. Reads every row incl. disabled, never overwrites, refuses on
duplicate or empty slugs. Planner is pure and fixture-tested.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**Checkpoint table** (paste to the owner): properties-map — `slug: rich_text`; plan-slug-backfill — pure planner; verify-slug-backfill-plan — fixtures; backfill-trade-slugs — dry-run/apply script; plus the dry-run summary line after apply.

---

### Task 2: The adapter reads the stored slug; the helper leaves `src/`

After this task `Trade.slug` comes from Notion and nothing in `src/` can derive one. The shared helper moves to `scripts/lib/` because the backfill is its only remaining consumer.

**Files:**
- Modify: `src/shared/modules/construction/core/schemas/index.ts:25` (slug regex)
- Modify: `src/shared/modules/construction/sources/notion/trades/adapter.ts`
- Rename: `src/shared/lib/slugify-trade-name.ts` → `scripts/lib/slugify-trade-name.ts`
- Modify: `scripts/backfill-trade-slugs.ts:23` (import path)
- Modify: `scripts/verify-notion-adapters.ts` (trade fixtures)
- Modify: `scripts/verify-catalog-seam.ts` (slug uniqueness)
- Modify: `src/shared/modules/construction/DOCS.md` (two anchors)

**Interfaces:**
- Consumes: `TRADE_PROPERTIES_MAP.slug.label` (Task 1), `richText` extractor.
- Produces: `tradeSchema.slug` rejects anything but `^[a-z0-9]+(?:-[a-z0-9]+)*$`; `pageToTrade` returns `null` for a blank, malformed or missing slug; DOCS anchors `#catalog-identity`, `#slug-is-stored` for code to cite.

- [ ] **Step 0: Commit-gate snapshot.**

- [ ] **Step 1: V3 baseline — dump every live `id → slug` before touching the adapter**

Create `$S/dump-trade-slugs.ts` (scratchpad, not committed):

```ts
import '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/scripts/lib/load-env'
import { catalogSource } from '@/shared/modules/construction/sources'

async function main() {
  const trades = await catalogSource.getTrades()
  console.log(trades.map(t => `${t.id}\t${t.slug}`).sort().join('\n'))
}
main()
```

Run: `npx tsx --tsconfig tsconfig.json $S/dump-trade-slugs.ts 2>/dev/null > $S/slugs-before.txt && wc -l $S/slugs-before.txt`
Expected: `27`. (The `dropped 1 of 28 rows` warn is the disabled row, on stderr.)

- [ ] **Step 2: Write the failing adapter fixtures**

In `scripts/verify-notion-adapters.ts`, add two imports after the existing sows import:

```ts
import { pageToTrade } from '@/shared/modules/construction/sources/notion/trades/adapter'
import { TRADE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/trades/properties-map'
```

add two fixture helpers after `relation`:

```ts
function richText(text: string) {
  return { type: 'rich_text', rich_text: [{ plain_text: text }] }
}
function checkbox(checked: boolean) {
  return { type: 'checkbox', checkbox: checked }
}
```

and, before the `// --- sows ---` block, a trades block:

```ts
// --- trades (P2: the slug is stored, never derived — DOCS.md#slug-is-stored) ---
function tradePage(slug: unknown) {
  return page({
    [TRADE_PROPERTIES_MAP.name.label]: title('Roof & Gutters'),
    [TRADE_PROPERTIES_MAP.slug.label]: slug,
    [TRADE_PROPERTIES_MAP.category.label]: select('Energy Efficiency'),
    [TRADE_PROPERTIES_MAP.scopeIds.label]: relation([SCOPE_ID]),
    [TRADE_PROPERTIES_MAP.disabled.label]: checkbox(false),
  }, TRADE_ID)
}
assert.equal(pageToTrade(tradePage(richText('roofing-custom')))?.slug, 'roofing-custom', 'the slug comes from the Slug property, not from the title')
assert.equal(pageToTrade(tradePage(richText(''))), null, 'a blank Slug fails schema: the trade is not in the catalog')
// Review Focus 3: a human edits the stored slug into something that is not a URL segment.
assert.equal(pageToTrade(tradePage(richText('Roof Gutters'))), null, 'spaces or capitals in a stored slug fail schema')
const noSlugProperty = page({ [TRADE_PROPERTIES_MAP.name.label]: title('Roof & Gutters') }, TRADE_ID)
assert.equal(pageToTrade(noSlugProperty), null, 'a page without the Slug property returns null, never throws')
const disabledTrade = page({ ...tradePage(richText('roofing-custom')).properties, [TRADE_PROPERTIES_MAP.disabled.label]: checkbox(true) }, TRADE_ID)
assert.equal(pageToTrade(disabledTrade), null, 'the disabled gate still runs before the slug is read')
```

Update the final line to `console.log('✅ notion adapters return entity-or-null and never throw; trade slugs are stored')`.

- [ ] **Step 3: Run it to verify it fails**

Run: `npx tsx scripts/verify-notion-adapters.ts`
Expected: FAIL on the first trade assertion — the adapter still derives `roof-and-gutters` from the title, so `'roof-and-gutters' !== 'roofing-custom'`.

- [ ] **Step 4: Tighten the schema and switch the adapter**

In `src/shared/modules/construction/core/schemas/index.ts`, replace

```ts
  slug: z.string(),
```
with
```ts
  /** Stored, never derived — see ../../DOCS.md#slug-is-stored. A URL segment: lowercase, digits, single hyphens. */
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be a lowercase hyphenated URL segment'),
```

In `src/shared/modules/construction/sources/notion/trades/adapter.ts`:
- delete `import { slugifyTradeName } from '@/shared/lib/slugify-trade-name'`
- change the extractors import to `import { checkbox, relationIds, richText, selectName, titleText } from '../extractors'`
- replace `slug: slugifyTradeName(name),` with
  ```ts
      // see ../../../DOCS.md#slug-is-stored — read, never derived from `name`
      slug: richText(p, TRADE_PROPERTIES_MAP.slug.label).trim(),
  ```

Nothing else in the file changes: a missing `Slug` property makes `richText` throw, the existing `catch` returns `null` with the `[pageToTrade] Failed to extract trade` warn, and a blank or malformed slug fails `safeParse` with the `Skipping invalid trade` warn. Both are `#adapter-returns-entity-or-null` working.

- [ ] **Step 5: Run the fixtures to verify they pass**

Run: `npx tsx scripts/verify-notion-adapters.ts`
Expected: `✅ notion adapters return entity-or-null and never throw; trade slugs are stored` (with three `[pageToTrade]` warn lines above it — those are the null-returning fixtures).

- [ ] **Step 6: Move the helper out of `src/`**

```bash
git mv src/shared/lib/slugify-trade-name.ts scripts/lib/slugify-trade-name.ts
```

In `scripts/backfill-trade-slugs.ts` change `import { slugifyTradeName } from '@/shared/lib/slugify-trade-name'` to `import { slugifyTradeName } from './lib/slugify-trade-name'`. Prepend to the moved file:

```ts
/**
 * The pre-P2 slug derivation, kept ONLY for `scripts/backfill-trade-slugs.ts`.
 * Nothing under `src/` derives a slug: `Trade.slug` is stored in Notion and
 * required by the adapter (DOCS.md#slug-is-stored). V2 asserts zero hits here.
 */
```

Grep gate: `grep -rn "slugifyTradeName\|slugify-trade-name" src/` → expected **no output**.

- [ ] **Step 7: Extend the seam check — slugs are unique**

In `scripts/verify-catalog-seam.ts`, replace the trades loop

```ts
  for (const trade of trades) {
    assert.ok(UUID.test(trade.id), `trade id is not a dashed lowercase UUID: ${trade.id}`)
    assert.ok(trade.slug.length > 0, `trade has no slug: ${trade.name}`)
  }
```
with
```ts
  // P2 — the slug is stored in Notion and required (DOCS.md#slug-is-stored).
  // A blank or malformed slug never reaches here (the adapter drops the row),
  // so the live assertion is uniqueness: two trades sharing a slug would
  // collide in URLs, registries and `tradesBySlug`.
  const slugs = new Map<string, string>()
  for (const trade of trades) {
    assert.ok(UUID.test(trade.id), `trade id is not a dashed lowercase UUID: ${trade.id}`)
    assert.ok(trade.slug.length > 0, `trade has no slug: ${trade.name}`)
    assert.ok(!slugs.has(trade.slug), `duplicate slug "${trade.slug}": "${slugs.get(trade.slug)}" and "${trade.name}"`)
    slugs.set(trade.slug, trade.name)
  }
```

and change the final log to `console.log(\`✓ catalog seam verified (${orphans} orphan scope(s), all ids normalized, all kinds valid, ${slugs.size} unique slugs)\`)`.

Run: `npx tsx scripts/verify-catalog-seam.ts`
Expected: `trades: 27  scopes: 120` … `✓ catalog seam verified (… 27 unique slugs)`. If it prints `trades: 0`, the adapter is reading a property that is not there — go back to Task 1 gate 1; do not commit.

- [ ] **Step 8: V3 — the slug set is byte-identical**

Run: `npx tsx --tsconfig tsconfig.json $S/dump-trade-slugs.ts 2>/dev/null > $S/slugs-after.txt && diff $S/slugs-before.txt $S/slugs-after.txt && echo "V3 OK: identical"`
Expected: `V3 OK: identical`. The sitemap is built from these slugs (`src/app/sitemap.ts:75-86` via `getTradesByPillar`), so an identical set is an identical sitemap.

- [ ] **Step 9: Write the two anchors**

In `src/shared/modules/construction/DOCS.md`, insert before `### category-taxonomy`:

```markdown
### catalog-identity

A trade has three names for three jobs, and nothing keys on the wrong one:

- **`id`** — the normalized Notion page id (`#ids-are-normalized-at-the-adapter`). The persisted reference: meetings, proposals, projects, applications and `TRADE_FACTS.notionTradeId` store this.
- **`slug`** — the stable key for URLs, registries and copy maps (`#slug-is-stored`). Code that needs a compile-time key uses `TradeSlug` from `core/constants/trade-slugs.generated.ts`.
- **`name`** — display only. It may change in Notion at any time; nothing keys on it, nothing compares it.

**Why**: name-keyed maps broke silently on every Notion rename, and id-keyed copy is unreadable. One key per job.

**Enforced by**: `tradeSchema` (`slug` regex), `TradeSlug`-typed maps (`tsc`), `scripts/verify-catalog-keys.ts`.

### slug-is-stored

`Trade.slug` is read from the Notion Trades **`Slug`** rich_text property and is **never derived** from the name (D2, `derived-values.md#snapshot-discipline`). The adapter requires it: a trade with a blank, malformed (not `^[a-z0-9]+(?:-[a-z0-9]+)*$`) or missing slug fails schema and is **not in the catalog** — it is dropped with a warn like any invalid row (`#adapter-returns-entity-or-null`).

That makes `scripts/backfill-trade-slugs.ts` the tool for a new or re-enabled trade: its dry run lists every row whose slug is blank; `--apply` (owner-run) writes the derived slug. It never overwrites a slug a human typed. Renaming a trade in Notion changes `name` only; the URL stays.

**Why**: URLs, registry keys and copy maps must survive a rename. Deriving the slug from the name meant a rename silently moved a public page and orphaned every keyed entry.

**Enforced by**: `tradeSchema`, `scripts/verify-notion-adapters.ts` (fixtures), `scripts/verify-catalog-seam.ts` (uniqueness, V4). Retires at P5 into a `slug` column with a unique index.
```

`DOCS.md` has no separate anchor index — the `### slug` headings under `## Rules` are the index, so the two sections above are all it takes. Then update `## See also`: change the `scripts/verify-catalog-seam.ts` bullet to `— asserts ids, kinds, the 100-row cap and slug uniqueness against production`, and add after it:

```markdown
- `scripts/backfill-trade-slugs.ts` — fills blank `Slug` rows from the title (dry-run by default, `--apply` owner-run); the tool for a new or re-enabled trade
```

- [ ] **Step 10: Type-check, lint, and the non-import-line audit**

Run: `pnpm tsc && CI=1 pnpm exec eslint --fix scripts/verify-notion-adapters.ts scripts/verify-catalog-seam.ts scripts/backfill-trade-slugs.ts scripts/lib/slugify-trade-name.ts src/shared/modules/construction/sources/notion/trades/adapter.ts src/shared/modules/construction/core/schemas/index.ts && CI=1 pnpm lint`
Expected: clean. `tsc` also proves no other `src/` file imported the moved helper.

- [ ] **Step 11: Commit** (commit gate first)

```bash
git add src/shared/modules/construction/core/schemas/index.ts src/shared/modules/construction/sources/notion/trades/adapter.ts src/shared/lib/slugify-trade-name.ts scripts/lib/slugify-trade-name.ts scripts/backfill-trade-slugs.ts scripts/verify-notion-adapters.ts scripts/verify-catalog-seam.ts src/shared/modules/construction/DOCS.md
git commit -m "feat(construction-p2): Trade.slug is read from Notion, never derived (C2, A11)

The adapter reads the Slug rich_text property; a blank, malformed or
missing slug drops the row. tradeSchema.slug is a URL-segment regex.
slugifyTradeName moves to scripts/lib/ for the backfill only. Seam check
asserts uniqueness; V3 proved the live slug set unchanged. DOCS gains
#catalog-identity and #slug-is-stored.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Checkpoint: the file table plus the two proof lines (`✓ catalog seam verified (… 27 unique slugs)`, `V3 OK: identical`).

---

### Task 3: The slug snapshot and its check

A generated const array + `TradeSlug` type, and the script that keeps it honest against the live catalog. Plan 2 types every registry and copy map with `TradeSlug`; this task is the boundary plan 2 waits for.

**Files:**
- Create: `scripts/generate-trade-slugs.ts`
- Create (generated): `src/shared/modules/construction/core/constants/trade-slugs.generated.ts`
- Create: `scripts/verify-catalog-keys.ts`
- Modify: `src/shared/modules/construction/DOCS.md` (`## See also`, two bullets)

**Interfaces:**
- Consumes: `catalogSource.getTrades()`.
- Produces: `tradeSlugs: readonly [...]` and `TradeSlug` in `core/constants/trade-slugs.generated.ts` (plan 2 imports both); `scripts/verify-catalog-keys.ts` with the snapshot-⊆-live assertion (plan 2 appends its map checks to `main()`).

- [ ] **Step 0: Commit-gate snapshot.**

- [ ] **Step 1: Write the generator**

Create `scripts/generate-trade-slugs.ts` (the header mirrors `scripts/generate-service-area-zips.ts`, the repo's one generated-file precedent):

```ts
/* eslint-disable no-console */
/**
 * Regenerate `core/constants/trade-slugs.generated.ts` from the live catalog.
 * The snapshot types every slug-keyed registry and copy map, so `tsc` fails
 * on a key the catalog does not know (P2 spec §4.2, F12). Re-run after a
 * trade is added, enabled or re-slugged in Notion — `scripts/verify-catalog-keys.ts`
 * says when. Retires at P5, when slugs are a Postgres column.
 *
 *   npx tsx scripts/generate-trade-slugs.ts
 */
import { writeFileSync } from 'node:fs'
import process from 'node:process'
import './lib/load-env'
import { catalogSource } from '@/shared/modules/construction/sources'

const OUT = 'src/shared/modules/construction/core/constants/trade-slugs.generated.ts'

async function main() {
  const trades = await catalogSource.getTrades()
  const slugs = [...new Set(trades.map(t => t.slug))].sort()
  const body = [
    '// GENERATED by scripts/generate-trade-slugs.ts — do not edit by hand.',
    `// The ${slugs.length} live trade slugs, sorted. Regenerate after a trade is added,`,
    '// enabled or re-slugged in Notion. see ../../DOCS.md#catalog-identity',
    'export const tradeSlugs = [',
    ...slugs.map(slug => `  '${slug}',`),
    '] as const',
    '',
    'export type TradeSlug = (typeof tradeSlugs)[number]',
    '',
  ].join('\n')
  writeFileSync(OUT, body)
  console.log(`✓ wrote ${slugs.length} slugs to ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Generate, and inspect**

Run: `npx tsx scripts/generate-trade-slugs.ts && cat src/shared/modules/construction/core/constants/trade-slugs.generated.ts`
Expected: `✓ wrote 27 slugs …` and a file whose 27 entries equal the P2 spec Appendix B list, `addition` first, `windows-and-doors` last. If a count or a slug differs from Appendix B, the catalog changed since the spec's read — say so in the checkpoint; the generator, not the appendix, is the source.

- [ ] **Step 3: Idempotency**

Run:
```bash
F=src/shared/modules/construction/core/constants/trade-slugs.generated.ts
sha1sum $F && npx tsx scripts/generate-trade-slugs.ts && sha1sum $F
```
Expected: the two hashes are identical — the output has no timestamp, so a regenerate with no catalog change is a byte-for-byte no-op. (This is what lets plan 2 and later sessions re-run the generator freely and trust `git status`.)

- [ ] **Step 4: Write the keys check (snapshot half)**

Create `scripts/verify-catalog-keys.ts`:

```ts
/* eslint-disable no-console */
/**
 * Slug-key check (P2 spec V5). Reads the live catalog through `catalogSource`
 * and proves the generated snapshot against it:
 *   - every snapshot slug is live — a dropped or re-slugged trade fails HERE
 *     first; after regenerating, `tsc` fails at each registry entry that
 *     keyed on it, which is the point (F12).
 *   - every live trade missing from the snapshot is reported, so its copy
 *     gets written.
 * Plan 2 appends the id-keyed maps (SCOPE_PHOTOS, TRADE_FACTS, featured pairs).
 *
 *   npx tsx scripts/verify-catalog-keys.ts
 */
import assert from 'node:assert/strict'
import process from 'node:process'
import './lib/load-env'
import { tradeSlugs } from '@/shared/modules/construction/core/constants/trade-slugs.generated'
import { catalogSource } from '@/shared/modules/construction/sources'

async function main() {
  const trades = await catalogSource.getTrades()
  const live = new Set(trades.map(t => t.slug))

  const stale = tradeSlugs.filter(slug => !live.has(slug))
  assert.deepEqual(stale, [], `snapshot slugs missing from the live catalog — run scripts/generate-trade-slugs.ts: ${stale.join(', ')}`)

  const snapshot = new Set<string>(tradeSlugs)
  const unsnapshotted = [...live].filter(slug => !snapshot.has(slug)).sort()
  if (unsnapshotted.length > 0) {
    console.warn(`  live trades not in the snapshot — regenerate, then write their copy: ${unsnapshotted.join(', ')}`)
  }

  console.log(`✓ snapshot ⊆ live (${tradeSlugs.length} in snapshot, ${live.size} live, ${unsnapshotted.length} unsnapshotted)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

In `src/shared/modules/construction/DOCS.md` `## See also`, add after the backfill bullet:

```markdown
- `scripts/generate-trade-slugs.ts` → `core/constants/trade-slugs.generated.ts` — the `TradeSlug` snapshot every slug-keyed map is typed by; regenerate after a trade is added or enabled (retires at P5)
- `scripts/verify-catalog-keys.ts` — asserts the snapshot ⊆ the live catalog and reports live trades with no snapshot entry
```

- [ ] **Step 5: Run it, then prove it catches a stale slug**

Run: `npx tsx scripts/verify-catalog-keys.ts`
Expected: `✓ snapshot ⊆ live (27 in snapshot, 27 live, 0 unsnapshotted)`.

Then, without committing, append a fake line `  'not-a-trade',` inside the generated array, run again — expected: `AssertionError … snapshot slugs missing from the live catalog — run scripts/generate-trade-slugs.ts: not-a-trade`. Regenerate (`npx tsx scripts/generate-trade-slugs.ts`) to restore the file, and confirm with `git diff --stat` that only the intended file is touched.

- [ ] **Step 6: Type-check, lint, commit**

Run: `pnpm tsc && CI=1 pnpm exec eslint --fix scripts/generate-trade-slugs.ts scripts/verify-catalog-keys.ts src/shared/modules/construction/core/constants/trade-slugs.generated.ts && CI=1 pnpm lint`
Expected: clean. If `--fix` changes the generated file's formatting, change the generator's template to emit that formatting and regenerate — the file must be lint-clean straight out of the generator (Step 3's no-op property depends on it).

```bash
git add scripts/generate-trade-slugs.ts scripts/verify-catalog-keys.ts src/shared/modules/construction/core/constants/trade-slugs.generated.ts src/shared/modules/construction/DOCS.md
git commit -m "feat(construction-p2): generated TradeSlug snapshot + keys check (F12)

tradeSlugs / TradeSlug generated from the live catalog; every slug-keyed
map in plan 2 is typed by it so tsc rejects unknown keys. The keys check
asserts snapshot ⊆ live and reports live trades with no snapshot entry.
Retires at P5.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**→ Plan 2 may start after this commit** (spec §7).

---

### Task 4: `pricingUnits` mirrors the `Unit of Pricing` select

`Scope.unitOfPricing` becomes a Zod enum with no default, the scopes adapter loses its unchecked cast, and the seam check proves both code enums equal their Notion selects' option lists.

**Files:**
- Modify: `src/shared/modules/construction/core/schemas/index.ts` (`pricingUnits`, `PricingUnit`, `unitOfPricing`)
- Modify: `src/shared/modules/construction/sources/notion/scopes/adapter.ts:26-38`
- Modify: `scripts/verify-notion-adapters.ts` (pricing-unit fixtures)
- Modify: `scripts/verify-catalog-seam.ts` (select-option mirrors, V4)
- Modify: `src/shared/modules/construction/DOCS.md` (`## See also`, seam bullet)

**Interfaces:**
- Consumes: `notionClient.dataSources.retrieve`, `notionDatabasesMeta`, both property maps.
- Produces: `pricingUnits = ['unit', 'sqft', 'space', 'linear ft', 'bsq'] as const`, `PricingUnit`, `Scope.unitOfPricing: PricingUnit` (plan 2 types landing's `UNIT_LABELS` with it).

- [ ] **Step 0: Commit-gate snapshot.**

- [ ] **Step 1: Review Focus 4 — find blank pricing units BEFORE the enum lands**

Create `$S/blank-units.ts` (scratchpad):

```ts
import '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/scripts/lib/load-env'
import { selectName, titleText } from '@/shared/modules/construction/sources/notion/extractors'
import { queryNotionDatabase } from '@/shared/modules/construction/sources/notion/query'
import { SCOPE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/scopes/properties-map'

async function main() {
  const pages = (await queryNotionDatabase('scopes')) ?? []
  const blank = pages.filter(pg => selectName<string>(pg.properties, SCOPE_PROPERTIES_MAP.unitOfPricing.label) === null)
  console.log(`${pages.length} scopes, ${blank.length} with a blank Unit of Pricing`)
  for (const pg of blank) {
    console.log(' -', titleText(pg.properties, SCOPE_PROPERTIES_MAP.name.label))
  }
}
main()
```

Run: `npx tsx --tsconfig tsconfig.json $S/blank-units.ts`
Expected: `120 scopes, 0 with a blank Unit of Pricing`. **If the count is not 0: 🚧 GATE — stop, give the owner the list, and wait until they have set a unit on each in Notion and this prints 0.** Today's `.default('unit')` masks exactly these rows; after this task they would be skipped.

- [ ] **Step 2: Write the failing fixtures**

In `scripts/verify-notion-adapters.ts`, after the `orphanScope` assertion, add:

```ts
// --- pricing units (P2 A5: z.enum mirrors the select; no default, no cast) ---
function scopeWithUnit(unit: unknown) {
  return page({
    [SCOPE_PROPERTIES_MAP.name.label]: title('Paver Patio'),
    [SCOPE_PROPERTIES_MAP.kind.label]: select('Scope'),
    [SCOPE_PROPERTIES_MAP.unitOfPricing.label]: unit,
    [SCOPE_PROPERTIES_MAP.tradeId.label]: relation([TRADE_ID]),
    [SCOPE_PROPERTIES_MAP.sowIds.label]: relation([]),
  })
}
assert.equal(pageToScope(scopeWithUnit(select('bsq')))?.unitOfPricing, 'bsq', "'bsq' is a live pricing unit the old cast did not know")
assert.equal(pageToScope(scopeWithUnit(select('acre'))), null, 'an unknown pricing unit fails the enum: the row is skipped, never coerced')
// Review Focus 4: a blank select is skipped with a warn, not defaulted to 'unit'.
assert.equal(pageToScope(scopeWithUnit({ type: 'select', select: null })), null, 'a blank pricing unit fails the enum (no default)')
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx tsx scripts/verify-notion-adapters.ts`
Expected: FAIL at `'acre'` — today any string passes and `'acre'` comes back as a scope.

- [ ] **Step 4: The enum and the adapter**

In `src/shared/modules/construction/core/schemas/index.ts`, after the `scopeKinds` pair add:

```ts
/** Live Notion `Unit of Pricing` select values, verbatim — see ../../DOCS.md#source-select-is-source-of-truth-for-enums. `verify-catalog-seam.ts` asserts the select's options equal this list. */
export const pricingUnits = ['unit', 'sqft', 'space', 'linear ft', 'bsq'] as const
export type PricingUnit = (typeof pricingUnits)[number]
```

and replace `unitOfPricing: z.string().default('unit'),` with `unitOfPricing: z.enum(pricingUnits),`.

In `src/shared/modules/construction/sources/notion/scopes/adapter.ts`, replace lines 26-38 (from `const rawKind` through the closing `}` of `raw`) with:

```ts
    const rawKind = selectName<'Scope' | 'Addon'>(p, SCOPE_PROPERTIES_MAP.kind.label)

    // Not annotated `Partial<Scope>`: `safeParse` takes `unknown`, and the
    // enum is what checks `unitOfPricing` — no cast (A5).
    const raw = {
      id: normalizeNotionId(page.id),
      name: titleText(p, SCOPE_PROPERTIES_MAP.name.label),
      kind: rawKind === 'Addon' ? 'addon' : 'scope',
      unitOfPricing: selectName<string>(p, SCOPE_PROPERTIES_MAP.unitOfPricing.label) ?? undefined,
      coverImageUrl: extractCoverImageUrl(page),
      tradeId: relationIds(p, SCOPE_PROPERTIES_MAP.tradeId.label).map(normalizeNotionId)[0],
      sowIds: relationIds(p, SCOPE_PROPERTIES_MAP.sowIds.label).map(normalizeNotionId),
    }
```

If the file's `Scope` type import becomes unused, remove it (lint will say). The `console.warn` that reads `raw.name` still compiles.

- [ ] **Step 5: Run the fixtures to verify they pass**

Run: `npx tsx scripts/verify-notion-adapters.ts`
Expected: the `✅` line, with two extra `[pageToScope] Skipping invalid scope` warns for `'acre'` and the blank select.

- [ ] **Step 6: V4 — the seam check proves both selects mirror the enums**

In `scripts/verify-catalog-seam.ts` add imports:

```ts
import { pricingUnits, tradeCategories } from '@/shared/modules/construction/core/schemas'
import { notionDatabasesMeta } from '@/shared/modules/construction/sources/notion/databases'
import { SCOPE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/scopes/properties-map'
import { TRADE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/trades/properties-map'
import { notionClient } from '@/shared/services/providers/notion/client'
```

add above `main`:

```ts
/** The option list of a select property, sorted — read from the data source's schema, not from the rows in use. */
async function selectOptions(dataSourceId: string, label: string): Promise<string[]> {
  const dataSource = await notionClient.dataSources.retrieve({ data_source_id: dataSourceId })
  const prop = 'properties' in dataSource ? dataSource.properties[label] : undefined
  assert.ok(prop && prop.type === 'select', `"${label}" is not a select property on data source ${dataSourceId}`)
  return prop.select.options.map(option => option.name).sort()
}
```

and, inside `main` before the final `console.log`:

```ts
  // V4 — the code enums mirror the source selects exactly (DOCS.md#source-select-is-source-of-truth-for-enums).
  // An option added in Notion fails here BEFORE any row is skipped for it.
  assert.deepEqual(
    await selectOptions(notionDatabasesMeta.trades.id, TRADE_PROPERTIES_MAP.category.label),
    [...tradeCategories].sort(),
    'Trades `Type` options ≠ tradeCategories — add the option to the enum or delete it in Notion',
  )
  assert.deepEqual(
    await selectOptions(notionDatabasesMeta.scopes.id, SCOPE_PROPERTIES_MAP.unitOfPricing.label),
    [...pricingUnits].sort(),
    'Scopes `Unit of Pricing` options ≠ pricingUnits — add the option to the enum or delete it in Notion',
  )
```

Update the file's header comment: it says "Reads through `catalogSource`, never `service.ts`" — append "and the two data sources' schemas through the Notion client, to compare select options with the code enums". Change the final log to end `…, ${slugs.size} unique slugs, selects mirror enums)`. In `src/shared/modules/construction/DOCS.md` `## See also`, the seam-script bullet becomes `— asserts ids, kinds, the 100-row cap, slug uniqueness and that both Notion selects mirror the code enums, against production` (add `DOCS.md` to this task's commit).

Run: `npx tsx scripts/verify-catalog-seam.ts`
Expected: `✓ catalog seam verified (… selects mirror enums)`. **If either `deepEqual` fails, stop and report the diff to the owner**: an extra Notion option is either dead (owner deletes it in Notion) or a real unit/category the enum must gain (then add it to the array, re-run the fixtures, and note the addition in the checkpoint). Do not "fix" it by loosening the assert.

- [ ] **Step 7: Type-check, lint, commit**

Run: `pnpm tsc && CI=1 pnpm exec eslint --fix src/shared/modules/construction/core/schemas/index.ts src/shared/modules/construction/sources/notion/scopes/adapter.ts scripts/verify-notion-adapters.ts scripts/verify-catalog-seam.ts && CI=1 pnpm lint`
Expected: clean. `tsc` will also show whether any consumer typed `unitOfPricing` as a string in a way an enum breaks; today the only reader is landing's `scopes-grid.tsx:50` indexing a `Record<string, string>`, which still compiles (plan 2 retypes it). Any other error is a file outside this plan — report it, do not edit it.

```bash
git add src/shared/modules/construction/core/schemas/index.ts src/shared/modules/construction/sources/notion/scopes/adapter.ts scripts/verify-notion-adapters.ts scripts/verify-catalog-seam.ts src/shared/modules/construction/DOCS.md
git commit -m "feat(construction-p2): pricingUnits enum mirrors the Unit of Pricing select (A5)

unitOfPricing is z.enum(['unit','sqft','space','linear ft','bsq']) with no
default; the adapter's unchecked cast is gone. The seam check now reads
both data-source schemas and asserts Type ≡ tradeCategories and Unit of
Pricing ≡ pricingUnits.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Retire `constructionTypes` and drop the seed-only column

`tradeCategories` is the one taxonomy. The Postgres `construction_type` enum and the `scopes.construction_type` column only ever carried seed data (zero runtime reads — memory `reference-trades-notion-vs-postgres`). Code first, then the owner pushes dev.

**Files:**
- Modify: `src/shared/modules/construction/core/constants/enums.ts:4-5` (delete)
- Modify: `src/shared/modules/construction/core/schemas/index.ts:11` (comment)
- Modify: `src/shared/db/schema/meta.ts` (import list + `constructionTypeEnum`)
- Modify: `src/shared/db/schema/scopes.ts` (import + column)
- Modify: `src/shared/db/seeds/data/scopes.ts` (52 `constructionType:` lines)
- Modify: `src/shared/db/seeds/scopes.ts:39`
- Modify: `src/shared/modules/construction/DOCS.md` (`#category-taxonomy`)
- Modify: `docs/plans/2026-09-15-construction-data-standardization-epic.md` (§5 "Enums" pointer)

**Interfaces:**
- Consumes: nothing new.
- Produces: no `constructionTypes` / `ConstructionType` / `constructionTypeEnum` symbol anywhere under `src/`; `scopes` table without `construction_type`.

- [ ] **Step 0: Commit-gate snapshot.** `src/shared/db/seeds/**` and `schema/**` must not be in `wip-before.txt`; if they are, STOP.

- [ ] **Step 1: Delete the enum from the schema and the module, let `tsc` find the seed**

- `src/shared/modules/construction/core/constants/enums.ts`: delete lines 4-5 (`constructionTypes` and `ConstructionType`) and the blank line after them.
- `src/shared/db/schema/meta.ts`: remove `constructionTypes,` from the `@/shared/modules/construction/core/constants/enums` import list, and delete the line `export const constructionTypeEnum = pgEnum('construction_type', constructionTypes)`.
- `src/shared/db/schema/scopes.ts`: delete `import { constructionTypeEnum } from './meta'` and the line `constructionType: constructionTypeEnum('construction_type').notNull(),`.

Run: `pnpm tsc`
Expected: **errors only in** `src/shared/db/seeds/data/scopes.ts` (52 × "Object literal may only specify known properties, and 'constructionType' does not exist in type …") and `src/shared/db/seeds/scopes.ts:39`. Any error elsewhere means a consumer this plan did not know about — stop and report it.

- [ ] **Step 2: Remove the field from the seed**

```bash
grep -c "constructionType:" src/shared/db/seeds/data/scopes.ts        # expected 52
sed -i '/^\s*constructionType: /d' src/shared/db/seeds/data/scopes.ts
grep -c "constructionType:" src/shared/db/seeds/data/scopes.ts        # expected 0
```

In `src/shared/db/seeds/scopes.ts` delete the line `constructionType: sql\`EXCLUDED.construction_type\`,`.

Run: `pnpm tsc`
Expected: clean.

- [ ] **Step 3: Grep gate (V2 slice)**

```bash
grep -rn "constructionTypes\|ConstructionType\b\|constructionTypeEnum\|constructionType\b\|construction_type" src/ scripts/ --include=*.ts --include=*.tsx --include=*.md | grep -v "src/shared/db/migrations/"
```
Expected: only `src/shared/modules/construction/DOCS.md` (rewritten in Step 4) and `src/shared/modules/construction/core/schemas/index.ts:11` (rewritten in Step 4). Nothing else.

- [ ] **Step 4: Rewrite the stale docs**

In `src/shared/modules/construction/core/schemas/index.ts`, replace the comment above `tradeCategories` with:

```ts
/** Live Notion `Type` select values, verbatim — the one taxonomy. see ../../DOCS.md#category-taxonomy */
```

In `src/shared/modules/construction/DOCS.md`, replace the whole `### category-taxonomy` section (from the heading to the line before `## Anti-patterns`) with:

```markdown
### category-taxonomy

`tradeCategories` in `core/schemas/index.ts` is the **one** taxonomy. It mirrors the Notion Trades `Type` select verbatim (`#source-select-is-source-of-truth-for-enums`), and `scripts/verify-catalog-seam.ts` asserts the select's option list equals the array, so an option added in Notion fails the check before any row is skipped for it. Landing derives its two pillars from `#energy-efficient-trades`, not from a second list.

`constructionTypes` (`['energy-efficient', 'rough-construction', 'finish-construction']`) was **retired in P2**. It only ever typed the seed-only `scopes.construction_type` Postgres column — never a property profile, whatever this section said before — and that column and its `construction_type` enum type were dropped with it. Do not reintroduce a second value set for this concept. The rest of `core/constants/enums.ts` is property-profile vocabulary (`tradeLocations`, `homeAreas`, `roofTypes`, …) that happens to live in this module; it is not catalog taxonomy.

**P5:** when the catalog moves to Neon, the taxonomy returns as a Postgres enum generated from `tradeCategories` — one array, one enum.

**Enforced by**: `tsc` (the Zod enum), `scripts/verify-catalog-seam.ts` (V4 select mirror), grep (`constructionTypes` has zero hits under `src/`).
```

In `docs/plans/2026-09-15-construction-data-standardization-epic.md` §5, replace the **Enums** pointer line

```
- **Enums:** `modules/construction/core/constants/enums.ts` — property-profile vocabulary (house attributes), *not* catalog enums; its `constructionTypes` drift from `Trade.category` is recorded at `modules/construction/DOCS.md#category-taxonomy` for P2.
```
with
```
- **Enums:** catalog enums (`tradeCategories`, `scopeKinds`, `pricingUnits`) live in `modules/construction/core/schemas/index.ts` and mirror their Notion selects (V4). `core/constants/enums.ts` is property-profile vocabulary (house attributes) only — `constructionTypes` was **retired by P2 plan 1** (`DOCS.md#category-taxonomy`; P5 note there).
```

- [ ] **Step 5: Lint and commit the code** (commit gate first)

Run: `pnpm tsc && CI=1 pnpm exec eslint --fix src/shared/modules/construction/core/constants/enums.ts src/shared/modules/construction/core/schemas/index.ts src/shared/db/schema/meta.ts src/shared/db/schema/scopes.ts src/shared/db/seeds/data/scopes.ts src/shared/db/seeds/scopes.ts && CI=1 pnpm lint`
Expected: clean.

```bash
git add src/shared/modules/construction/core/constants/enums.ts src/shared/modules/construction/core/schemas/index.ts src/shared/db/schema/meta.ts src/shared/db/schema/scopes.ts src/shared/db/seeds/data/scopes.ts src/shared/db/seeds/scopes.ts src/shared/modules/construction/DOCS.md docs/plans/2026-09-15-construction-data-standardization-epic.md
git commit -m "refactor(construction-p2): retire constructionTypes; drop seed-only scopes.construction_type (A5, F11)

tradeCategories is the one taxonomy. The construction_type pgEnum and the
scopes.construction_type column only carried 52 seed rows and had zero
runtime reads. DOCS #category-taxonomy rewritten (its property-profile
claim was stale) with the P5 note. DDL lands via db:push:dev, owner-run.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 6: 🚧 GATE — the owner pushes dev**

Ask the owner to run, themselves, and to paste the SQL `drizzle-kit` prints (`verbose: true`, `strict: true` — it asks for confirmation on the drop):

```bash
pnpm db:push:dev
```

Expected SQL, in this order: `ALTER TABLE "scopes" DROP COLUMN "construction_type";` then `DROP TYPE "public"."construction_type";`. Anything else in the diff (another table, another column) is **foreign schema WIP from another session** reaching the shared dev branch — the owner decides; you do not.

- [ ] **Step 7: 🚧 GATE — the owner seeds dev**

```bash
pnpm db:seed:dev
```
Expected: exits 0. (The seed upserts on `scopes.accessor`; the 52 rows no longer carry the field.)

- [ ] **Step 8: Review Focus 5 — prove the column AND the type are gone**

Create `$S/check-ddl.ts` (scratchpad):

```ts
import '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/scripts/lib/load-env'
import process from 'node:process'
import { Pool } from 'pg'

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_DEV_URL })
  const column = await pool.query(`select 1 from information_schema.columns where table_name = 'scopes' and column_name = 'construction_type'`)
  const type = await pool.query(`select 1 from pg_type where typname = 'construction_type'`)
  const rows = await pool.query(`select count(*)::int as n from scopes`)
  console.log(`dev: scopes.construction_type column rows=${column.rowCount}  construction_type type rows=${type.rowCount}  scopes=${rows.rows[0].n}`)
  await pool.end()
}
main()
```

Run: `npx tsx --tsconfig tsconfig.json $S/check-ddl.ts`
Expected: `dev: scopes.construction_type column rows=0  construction_type type rows=0  scopes=52`.
If `type rows=1`: `drizzle-kit push` dropped the column but not the type. The owner runs this one statement on the **dev** branch (Neon SQL editor or `psql "$DATABASE_DEV_URL"`): `DROP TYPE "public"."construction_type";` — then re-run the check. Record which path happened in the checkpoint; it decides what the prod push will need.

- [ ] **Step 9: Checkpoint.** Table of the eight files, the `drizzle-kit` SQL the owner pasted, and the `check-ddl` line. **Prod is not pushed in this plan** — Task 6 records it as pending.

---

### Task 6: Tracker, memory, and the prod-push marker

No code. Records plan 1 as shipped so plan 2 and the next session start from the truth.

**Files:**
- Modify: `docs/plans/2026-09-15-construction-data-standardization-epic.md` (§0 P2 row; §3 C2, A5, A11, F12 notes)
- Modify (memory): `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-construction-catalog-centralization.md`

- [ ] **Step 1: Tracker**

In §0, the P2 row's **Plan** cell: replace `— not written` with `— plan 1 [external writes](../superpowers/plans/2026-09-22-construction-p2-plan-1-external-writes.md) **complete <date>** (commits `<first>..<last>`; **prod `db:push:prod` for the `construction_type` drop is PENDING an explicit go**); plan 2 (pure code) next`.

In §3:
- **C2** → `[x]`, append: `**Shipped <date> (P2 plan 1):** \`Slug\` rich_text on the Trades data source, backfilled by \`scripts/backfill-trade-slugs.ts --apply\` (28 rows, all \`same\` on re-run), adapter requires it (\`DOCS.md#slug-is-stored\`), V3 identical.`
- **A5** → `[x]`, append: `**Shipped <date> (P2 plan 1):** \`pricingUnits\` z.enum, no default; \`constructionTypes\` retired; seam check asserts both selects ≡ enums (V4).`
- **A11** → `[x]`, append: `**Shipped <date> (P2 plan 1)** with C2.`
- **F12** stays `[ ]`, append: `**Plan 1 shipped the mechanism <date>:** \`core/constants/trade-slugs.generated.ts\` + \`scripts/{generate-trade-slugs,verify-catalog-keys}.ts\`. Plan 2 types the maps.`

- [ ] **Step 2: Memory**

In the project memory's **P2 SPEC WRITTEN** paragraph, prepend: `**P2 PLAN 1 SHIPPED <date>** (commits \`<first>..<last>\`, unpushed; prod \`db:push:prod\` for the \`construction_type\` drop PENDING explicit go). Plan 2 (pure code) next — every registry is typed by \`core/constants/trade-slugs.generated.ts\`.` and update the frontmatter `description` to say `P2 PLAN 1 SHIPPED`.

- [ ] **Step 3: Commit the tracker** (commit gate; memory is outside the repo)

```bash
git add docs/plans/2026-09-15-construction-data-standardization-epic.md
git commit -m "docs(construction-p2): plan 1 shipped — C2, A5, A11 closed; prod push pending

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Verification summary

| Gate | Where |
|---|---|
| **V1** `pnpm tsc` + `CI=1 pnpm lint` | every task's lint step |
| **V3** slug set identical before/after | Task 2 Steps 1, 8 |
| **V4** slug non-empty + unique; `Type` ≡ `tradeCategories`; `Unit of Pricing` ≡ `pricingUnits` | Task 2 Step 7, Task 4 Step 6 |
| **V5** (snapshot half) snapshot ⊆ live, warn on unsnapshotted | Task 3 Steps 4-5 |
| **V2** (this plan's slice) `slugifyTradeName` zero hits in `src/`; `constructionTypes`/`construction_type` zero hits outside migrations | Task 2 Step 6, Task 5 Step 3 |
| Fixture tests | `scripts/verify-slug-backfill-plan.ts` (Task 1), `scripts/verify-notion-adapters.ts` (Tasks 2, 4) |
| Owner gates | Task 1 Steps 8-9 (Notion property, `--apply`), Task 4 Step 1 (blank units, conditional), Task 5 Steps 6-7 (`db:push:dev`, `db:seed:dev`) |
| Not in this plan | `db:push:prod` (explicit go, recorded Task 6); V6 browser pass (plan 2); the remaining five DOCS anchors (plan 2) |

## What this plan deliberately does not do

- Touch any `src/features/**` file, `TRADE_FACTS`, the registries, the resolver, the landing `UNIT_LABELS` retype, or any consumer — all plan 2.
- Push prod, push git, or restart anything.
- Create the Notion property programmatically. `dataSources.update` could, but the property's creation is the owner's act and the backfill asserts it happened (Review Focus 2).
- Edit `docs/codebase-conventions/enum-standardization.md` (owner-reserved), the 2026-09-14 design doc (foreign hunks), or `src/shared/db/migrations/**` (legacy snapshots).
