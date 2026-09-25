# Construction P0 — Provider Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the live correctness bugs in the Notion construction-data path — silent 100-row truncation, adapters that crash a whole list on one bad row, unnormalized ids, and a program qualifier that can never fire — without moving or renaming anything.

**Architecture:** Every change stays inside the existing `services/providers/notion/` provider, its one consuming service (`construction-data.service.ts`), and the meeting-flow energy qualifier. No new directories, no `modules/construction`, no router rename. Pagination becomes two private loop helpers in the provider; the three throwing adapters adopt the shape `pageToTrade` already uses; a new `normalizeNotionId` is applied at every adapter and at the relation-filter branch.

**Tech Stack:** TypeScript, Next.js 15, `@notionhq/client`, Zod, tRPC, React Query, pnpm. Verification is `pnpm tsc` + `pnpm lint` + `pnpm tsx scripts/verify-*.ts` — **there is no unit test runner in this repo** (no vitest, no jest, no `test` script).

**Spec:** `docs/superpowers/specs/2026-09-15-construction-p0-provider-hardening-design.md`
**Epic:** `docs/plans/2026-09-15-construction-data-standardization-epic.md` — phase P0, owns F3, F4, F5 · B1–B4, B14–B18 · A3.

## Global Constraints

- **Never run `pnpm build`.** Verification is `pnpm tsc` (`tsc --noEmit`) and `pnpm lint` only.
- **Work on `main`, stage by explicit path.** Never `git add -A` — the tree holds several other sessions' uncommitted work.
- **Off limits — foreign edits live in the tree:** `src/features/meeting-flow/ui/components/steps/specialties/**`, `src/features/meeting-flow/ui/components/trade-sheet/**`, `src/shared/modules/**`, `docs/design-system/**`, `docs/superpowers/specs/2026-09-14-specialties-stage-and-rail-design.md`, `docs/superpowers/specs/2026-09-15-projects-media-modules-design.md`. Touching any of these means you have the wrong file.
- **No scope creep.** P0 does not rename `notionRouter`, does not add caching, does not change `baseProcedure` to anything else, does not create `modules/construction`, and does **not** delete `getScopesByQuery` (it is live behind `useGetScopes`; it goes at P3).
- **Extractors keep throwing.** `providers/notion/lib/extractors.ts` throws by design (`DOCS.md#extractors-throw-by-design-adapters-recover`). Recovery belongs in the adapter's `try/catch`. Never add defaults to an extractor.
- **Verify scripts** follow the repo pattern: `/* eslint-disable no-console */` first line, `node:assert/strict`, `@/` path alias, run with `pnpm tsx scripts/<name>.ts`. Pure-logic scripts take no env; anything touching Notion puts `import './lib/load-env'` as its **very first** line.
- **Notion page ids are dashed lowercase UUIDs** (8-4-4-4-12). Notion's `dataSources.query` max `page_size` is 100, which is also its default.

---

### Task 1: `normalizeNotionId` helper

The repo has no id-normalization helper anywhere, and one undashed id is already checked in (`app/(frontend)/(site)/tests/[label]/page.tsx:17`). Every id comparison in the codebase is raw string equality or a `Map` key, so a dashed/undashed mismatch silently returns nothing instead of erroring.

**Files:**
- Create: `src/shared/services/providers/notion/lib/normalize-notion-id.ts`
- Create: `scripts/verify-normalize-notion-id.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalizeNotionId(id: string): string` — Tasks 4 and 5 import it from `@/shared/services/providers/notion/lib/normalize-notion-id`.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-normalize-notion-id.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { normalizeNotionId } from '@/shared/services/providers/notion/lib/normalize-notion-id'

const DASHED = '6240ca1b-548b-837d-a9c0-01acc1fb530a'
const UNDASHED = '6240ca1b548b837da9c001acc1fb530a'

assert.equal(normalizeNotionId(UNDASHED), DASHED, 'undashed 32-hex gains dashes')
assert.equal(normalizeNotionId(DASHED), DASHED, 'already dashed is idempotent')
assert.equal(normalizeNotionId(DASHED.toUpperCase()), DASHED, 'uppercase is lowercased')
assert.equal(normalizeNotionId(UNDASHED.toUpperCase()), DASHED, 'uppercase undashed')
assert.equal(normalizeNotionId('  ' + DASHED + '  '), DASHED, 'surrounding whitespace trimmed')

// Not a Notion id — returned unchanged, never mangled.
assert.equal(normalizeNotionId(''), '', 'empty string passes through')
assert.equal(normalizeNotionId('kitchen-remodel'), 'kitchen-remodel', 'a slug passes through')
assert.equal(normalizeNotionId('Kitchen Remodel'), 'Kitchen Remodel', 'a display name passes through unchanged, case intact')
assert.equal(normalizeNotionId('6240ca1b'), '6240ca1b', 'too short passes through')
assert.equal(normalizeNotionId('z'.repeat(32)), 'z'.repeat(32), 'non-hex 32 chars passes through')

console.log('✅ normalizeNotionId verified')
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm tsx scripts/verify-normalize-notion-id.ts`
Expected: FAIL — the module does not exist yet (`Cannot find module '.../normalize-notion-id'`).

- [ ] **Step 3: Write the minimal implementation**

Create `src/shared/services/providers/notion/lib/normalize-notion-id.ts`:

```ts
const HEX_32 = /^[0-9a-f]{32}$/

/**
 * Notion page and relation ids are dashed lowercase UUIDs, but undashed forms
 * circulate in hand-written config and URLs. Every id comparison in the app is
 * raw string equality or a Map key, so a mismatch silently returns nothing.
 * Normalize at the adapter and at relation-filter inputs.
 *
 * Anything that is not 32 hex characters (a slug, a display name, an empty
 * string) is returned untouched — this must be safe to call on any string.
 */
export function normalizeNotionId(id: string): string {
  const trimmed = id.trim()
  const compact = trimmed.replace(/-/g, '').toLowerCase()

  if (!HEX_32.test(compact)) {
    return trimmed === '' ? trimmed : (trimmed === id ? id : trimmed)
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-')
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm tsx scripts/verify-normalize-notion-id.ts`
Expected: PASS — `✅ normalizeNotionId verified`

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no new errors. Pre-existing warnings in unrelated files are fine.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/providers/notion/lib/normalize-notion-id.ts scripts/verify-normalize-notion-id.ts
git commit -m "fix(notion): add normalizeNotionId for dashed-lowercase id comparison

Notion returns dashed lowercase UUIDs but undashed forms circulate in config
and URLs. Every id comparison in the app is string equality or a Map key, so a
mismatch silently returns nothing. Non-UUID strings pass through untouched.

Refs: construction epic F5.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Paginate `queryNotionDatabase`

`dataSources.query` runs at Notion's default page size of 100 — also its maximum — and `has_more`/`next_cursor` are never read, so reads silently truncate. `getAllScopes` is the highest-volume read, feeding 8+ surfaces including the specialties step. This task also fixes three defects in the same file: an unchecked partial-page cast (B14), `sorts` silently dropped on the filtered path (B15), and a discarded error cause (B16).

**Files:**
- Modify: `src/shared/services/providers/notion/dal/query-notion-database.ts:40-77`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: no signature change. `queryNotionDatabase` keeps both overloads and its `Promise<PageObjectResponse[] | undefined>` return. Callers are untouched by this task.

- [ ] **Step 1: Replace the body from line 40 to the end of the file**

The current body (lines 40–77) has three branches with no pagination. Replace everything from `if (opts.id) {` through the closing brace of the function with:

```ts
  if (opts.id) {
    const page = await notionClient.pages.retrieve({ page_id: opts.id })

    // pages.retrieve can return a PartialPageObjectResponse (no `properties`).
    // Adapters require the full shape, so drop a partial rather than cast it.
    return 'properties' in page ? [page as PageObjectResponse] : []
  }

  const sorts = opts.sortBy && [
    {
      property: propertyToSortBy?.label as string,
      direction: opts.sortBy.direction || 'ascending',
    },
  ]

  if (!opts.filterProperty) {
    return queryAllPages(meta.id, { sorts })
  }

  const propertyToFilterBy = propertiesMap[opts.filterProperty as keyof typeof propertiesMap] as unknown as NotionPropDef

  const propertyFilterObject = buildPropertyFilter(propertyToFilterBy.label, propertyToFilterBy.type, opts.query || '')

  try {
    // `sorts` was silently dropped on this path before.
    return await queryAllPages(meta.id, { filter: propertyFilterObject, sorts })
  }
  catch (e) {
    throw new Error(`Failed to query Notion data source "${databaseName}"`, { cause: e })
  }
}

type QueryArgs = Parameters<typeof notionClient.dataSources.query>[0]

/**
 * Notion caps `page_size` at 100 and returns `has_more` + `next_cursor`.
 * Nothing in this codebase read them, so every list read silently truncated.
 * see ../DOCS.md#reads-paginate
 */
async function queryAllPages(
  dataSourceId: string,
  args: Pick<QueryArgs, 'filter' | 'sorts'>,
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = []
  let cursor: string | undefined

  do {
    const response = await notionClient.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
      ...args,
    })

    pages.push(...(response.results as PageObjectResponse[]))
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return pages
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc`
Expected: PASS. If `Pick<QueryArgs, 'filter' | 'sorts'>` errors because `QueryArgs` resolves to a union, replace the `QueryArgs` line with an inline shape instead:

```ts
interface QueryArgs { filter?: unknown, sorts?: unknown }
```

and cast at the call: `...(args as Record<string, unknown>)`.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors.

- [ ] **Step 4: Verify the three side-fixes are present**

Run: `grep -n "properties' in page\|start_cursor\|has_more\|cause: e\|sorts" src/shared/services/providers/notion/dal/query-notion-database.ts`
Expected: the partial-page guard, `start_cursor`, `has_more`, `{ cause: e }`, and `sorts` passed on **both** the filtered and unfiltered paths.

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/notion/dal/query-notion-database.ts
git commit -m "fix(notion): paginate data-source queries; stop silent 100-row truncation

dataSources.query ran at Notion's default page size of 100 (also its max) and
has_more/next_cursor were never read, so every list read silently truncated.
getAllScopes feeds 8+ surfaces including the specialties step.

Also in this file: guard the unchecked PartialPageObjectResponse cast on the
retrieve path, pass sorts on the filtered path (silently dropped before), and
preserve the error cause instead of throwing a bare string.

Refs: construction epic F3, B2, B14, B15, B16.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Paginate block children in `pageToTiptapJson`

`page_size: 100` is hardcoded at both read sites and `has_more` is never read, so a SOW page with more than 100 top-level blocks — or any list with more than 100 children — is silently truncated.

**Files:**
- Modify: `src/shared/services/providers/notion/lib/page-to-tiptap-json.ts:9-37`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: no signature change. `pageToTiptapJson(pageId: string): Promise<string>` is unchanged; its only caller is `construction-data.service.ts:72`.

- [ ] **Step 1: Add the pagination helper and use it at both sites**

Replace lines 9–37 with:

```ts
/**
 * blocks.children.list caps page_size at 100 and returns has_more + next_cursor.
 * Both read sites ignored them, truncating long SOW documents and long lists.
 * see ../DOCS.md#reads-paginate
 */
async function listAllBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = []
  let cursor: string | undefined

  do {
    const response = await notionClient.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    }) as { results: NotionBlock[], has_more: boolean, next_cursor: string | null }

    blocks.push(...response.results)
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return blocks
}

async function resolveChildren(blocks: NotionBlock[]): Promise<NotionBlock[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (!block.has_children)
        return block

      const children = await resolveChildren(await listAllBlockChildren(block.id))

      return { ...block, children }
    }),
  )
}

export async function pageToTiptapJson(pageId: string) {
  const blocks = await resolveChildren(await listAllBlockChildren(pageId))
  const tiptapJson = notionBlocksToTiptapDoc(blocks)

  return JSON.stringify(tiptapJson)
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS, no new errors.

- [ ] **Step 3: Confirm no `page_size: 100` remains without a cursor loop**

Run: `grep -n "page_size\|has_more\|start_cursor" src/shared/services/providers/notion/lib/page-to-tiptap-json.ts`
Expected: exactly one `page_size: 100`, inside `listAllBlockChildren`, alongside `start_cursor` and `has_more`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/providers/notion/lib/page-to-tiptap-json.ts
git commit -m "fix(notion): paginate block children when building SOW TipTap JSON

page_size: 100 was hardcoded at both read sites with has_more never read, so a
SOW page over 100 top-level blocks, or any list over 100 children, was silently
truncated mid-document.

Refs: construction epic F3, B2.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Adapters return `Entity | null` instead of throwing

`pageToTrade` is already the compliant reference implementation (disabled gate first, `safeParse`, `console.warn` + `return null`, `try/catch` around extraction). The other three throw, so one malformed Notion row fails an entire list — and `providers/notion/DOCS.md:15` already admits this. A scope with no trade relation throws today (B17), because `relationIds(...)[0]` is `undefined` while `scopeOrAddonSchema.relatedTrade` is a required `z.string()`.

**Files:**
- Modify: `src/shared/services/providers/notion/lib/scopes/adapter.ts:21-40`
- Modify: `src/shared/services/providers/notion/lib/sows/adapter.ts:7-22`
- Modify: `src/shared/services/providers/notion/lib/pain-points/adapter.ts:7-32`
- Modify: `src/shared/services/construction-data.service.ts:43,52,60,68`
- Modify: `src/features/meeting-flow/lib/get-cached-pain-points.ts:8`
- Create: `scripts/verify-notion-adapters.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `pageToScope(page: PageObjectResponse): ScopeOrAddon | null`, `pageToSOW(page: PageObjectResponse): SOW | null`, `pageToPainPoint(page: PageObjectResponse): NotionPainPoint | null`. Task 5 edits the same three files to add id normalization.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-notion-adapters.ts`:

```ts
/* eslint-disable no-console */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import assert from 'node:assert/strict'
import { pageToPainPoint } from '@/shared/services/providers/notion/lib/pain-points/adapter'
import { pageToScope } from '@/shared/services/providers/notion/lib/scopes/adapter'
import { pageToSOW } from '@/shared/services/providers/notion/lib/sows/adapter'

const TRADE_ID = '6240ca1b-548b-837d-a9c0-01acc1fb530a'
const SCOPE_ID = '7351db2c-659c-948e-b0d1-12bdd2gc641b'

function title(text: string) {
  return { type: 'title', title: [{ plain_text: text }] }
}
function select(name: string) {
  return { type: 'select', select: { name } }
}
function relation(ids: string[]) {
  return { type: 'relation', relation: ids.map(id => ({ id })) }
}
function page(properties: Record<string, unknown>, id = SCOPE_ID): PageObjectResponse {
  return { id, cover: null, properties } as unknown as PageObjectResponse
}

// --- scopes ---
const validScope = page({
  'Name': title('Cabinet Replacement'),
  'Entry Type': select('Scope'),
  'Unit of Pricing': select('unit'),
  'Related Trade': relation([TRADE_ID]),
  'Related Scopes of Work': relation([]),
})
const scope = pageToScope(validScope)
assert.ok(scope, 'a valid scope page adapts to an entity')
assert.equal(scope.name, 'Cabinet Replacement', 'scope name extracted')

// B17: a scope with no trade relation used to throw.
const orphanScope = page({
  'Name': title('Orphan'),
  'Entry Type': select('Scope'),
  'Unit of Pricing': select('unit'),
  'Related Trade': relation([]),
  'Related Scopes of Work': relation([]),
})
assert.equal(pageToScope(orphanScope), null, 'a scope with no trade relation returns null, never throws')

// A missing required property used to throw out of the extractor.
assert.equal(pageToScope(page({})), null, 'a page missing every property returns null')

// --- sows ---
const validSow = page({ 'Name': title('Demo & Haul'), 'Related Scope': relation([SCOPE_ID]) })
const sow = pageToSOW(validSow)
assert.ok(sow, 'a valid SOW page adapts to an entity')
assert.equal(pageToSOW(page({})), null, 'a malformed SOW page returns null')

// --- pain points ---
assert.equal(pageToPainPoint(page({})), null, 'a malformed pain-point page returns null')

console.log('✅ notion adapters return entity-or-null and never throw')
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm tsx scripts/verify-notion-adapters.ts`
Expected: FAIL — the adapters throw instead of returning `null` (an uncaught `Error` from `must()` or from `new Error(valid.error.message)`).

- [ ] **Step 3: Rewrite `scopes/adapter.ts` — wrap and return null**

Replace `pageToScope` (lines 21–40) with:

```ts
// see ../../DOCS.md#adapter-returns-entity-or-null
export function pageToScope(page: PageObjectResponse): ScopeOrAddon | null {
  try {
    const p = page.properties

    const raw: Partial<ScopeOrAddon> = {
      id: page.id,
      name: titleText(p, SCOPE_OR_ADDON_PROPERTIES_MAP.name.label),
      entryType: selectName<'Scope' | 'Addon'>(p, SCOPE_OR_ADDON_PROPERTIES_MAP.entryType.label) ?? undefined,
      unitOfPricing: selectName<'sqft' | 'linear ft' | 'space' | 'unit'>(p, SCOPE_OR_ADDON_PROPERTIES_MAP.unitOfPricing.label) ?? undefined,
      coverImageUrl: extractCoverImageUrl(page),
      relatedTrade: relationIds(p, SCOPE_OR_ADDON_PROPERTIES_MAP.relatedTrade.label)[0],
      relatedScopesOfWork: relationIds(p, SCOPE_OR_ADDON_PROPERTIES_MAP.relatedScopesOfWork.label),
    }

    const valid = scopeOrAddonSchema.safeParse(raw)

    if (valid.success) {
      return valid.data
    }

    console.warn('[pageToScope] Skipping invalid scope', {
      id: page.id,
      name: raw.name,
      issues: valid.error.issues,
    })
    return null
  }
  catch (err) {
    console.warn('[pageToScope] Failed to extract scope', { id: page.id, error: err })
    return null
  }
}
```

- [ ] **Step 4: Rewrite `sows/adapter.ts`**

Replace `pageToSOW` (lines 7–22) with:

```ts
// see ../../DOCS.md#adapter-returns-entity-or-null
export function pageToSOW(page: PageObjectResponse): SOW | null {
  try {
    const p = page.properties

    const raw: Partial<SOW> = {
      id: page.id,
      name: titleText(p, SOW_PROPERTIES_MAP.name.label),
      relatedScope: relationIds(p, SOW_PROPERTIES_MAP.relatedScope.label),
    }

    const valid = sowSchema.safeParse(raw)

    if (valid.success) {
      return valid.data
    }

    console.warn('[pageToSOW] Skipping invalid SOW', {
      id: page.id,
      name: raw.name,
      issues: valid.error.issues,
    })
    return null
  }
  catch (err) {
    console.warn('[pageToSOW] Failed to extract SOW', { id: page.id, error: err })
    return null
  }
}
```

- [ ] **Step 5: Rewrite `pain-points/adapter.ts`**

Replace `pageToPainPoint` (lines 7–32) with:

```ts
// see ../../DOCS.md#adapter-returns-entity-or-null
export function pageToPainPoint(page: PageObjectResponse): NotionPainPoint | null {
  try {
    const p = page.properties
    const map = PAIN_POINT_PROPERTIES_MAP

    const raw = {
      id: page.id,
      name: titleText(p, map.name.label),
      accessor: richText(p, map.accessor.label),
      category: selectName(p, map.category.label) ?? undefined,
      severity: selectName(p, map.severity.label) ?? undefined,
      urgency: selectName(p, map.urgency.label) ?? undefined,
      emotionalDrivers: multiSelectNames(p, map.emotionalDrivers.label),
      trades: relationIds(p, map.trades.label),
      householdResonance: multiSelectNames(p, map.householdResonance.label),
      programFit: multiSelectNames(p, map.programFit.label),
      tags: multiSelectNames(p, map.tags.label),
    }

    const valid = notionPainPointSchema.safeParse(raw)

    if (valid.success) {
      return valid.data
    }

    console.warn('[pageToPainPoint] Skipping invalid pain point', {
      id: page.id,
      name: raw.name,
      issues: valid.error.issues,
    })
    return null
  }
  catch (err) {
    console.warn('[pageToPainPoint] Failed to extract pain point', { id: page.id, error: err })
    return null
  }
}
```

- [ ] **Step 6: Switch the five callers from `.map` to `.flatMap`**

In `src/shared/services/construction-data.service.ts`, replace each of these four lines:

```ts
// :43  getAllScopes
      return raw ? raw.flatMap(page => pageToScope(page) ?? []) : []
// :52  getScopesByQuery
      return raw ? raw.flatMap(page => pageToScope(page) ?? []) : []
// :60  getScopesByTrade   (deleted in Task 7 — update it here anyway so tsc stays green)
      return raw ? raw.flatMap(page => pageToScope(page) ?? []) : []
// :68  getSOWsByScope
      return raw ? raw.flatMap(page => pageToSOW(page) ?? []) : []
```

In `src/features/meeting-flow/lib/get-cached-pain-points.ts:8`:

```ts
    return raw ? raw.flatMap(page => pageToPainPoint(page) ?? []) : []
```

- [ ] **Step 7: Run the verification script — it should pass now**

Run: `pnpm tsx scripts/verify-notion-adapters.ts`
Expected: PASS — `✅ notion adapters return entity-or-null and never throw`

- [ ] **Step 8: Typecheck, lint, and confirm no adapter throws**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

Run: `grep -rn "throw" src/shared/services/providers/notion/lib/{scopes,sows,pain-points,trades}/adapter.ts`
Expected: zero matches.

- [ ] **Step 9: Commit**

```bash
git add src/shared/services/providers/notion/lib/scopes/adapter.ts \
        src/shared/services/providers/notion/lib/sows/adapter.ts \
        src/shared/services/providers/notion/lib/pain-points/adapter.ts \
        src/shared/services/construction-data.service.ts \
        src/features/meeting-flow/lib/get-cached-pain-points.ts \
        scripts/verify-notion-adapters.ts
git commit -m "fix(notion): scope, SOW and pain-point adapters return entity-or-null

All three threw, so one malformed Notion row failed an entire list — including
scopes.getAll, which the specialties step depends on. They now match the
pageToTrade reference impl: try/catch, safeParse, console.warn, return null.
Callers switch from .map to .flatMap.

Fixes the case where a scope with no trade relation threw, because
relationIds(...)[0] is undefined while relatedTrade is a required string.

Refs: construction epic F4, B3, B17.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Apply id normalization at the adapters and the relation filter

Ids now flow through a normalizer at both ends: out of the adapters, and into Notion relation filters. The filter branch matters because a caller passing an undashed id gets an **empty result with no error** — which is exactly why the scratch page deleted in Task 7 never worked.

**Files:**
- Modify: `src/shared/services/providers/notion/lib/trades/adapter.ts:38,44`
- Modify: `src/shared/services/providers/notion/lib/scopes/adapter.ts` (the `raw` object)
- Modify: `src/shared/services/providers/notion/lib/sows/adapter.ts` (the `raw` object)
- Modify: `src/shared/services/providers/notion/lib/pain-points/adapter.ts` (the `raw` object)
- Modify: `src/shared/services/providers/notion/lib/property-filter.ts:22`

**Interfaces:**
- Consumes: `normalizeNotionId` from Task 1; the `| null` adapter shapes from Task 4.
- Produces: no signature changes. Every `id` and relation id returned by an adapter is dashed lowercase.

- [ ] **Step 1: Normalize in `trades/adapter.ts`**

Add the import, then change the two id lines inside `raw`:

```ts
import { normalizeNotionId } from '../normalize-notion-id'
```

```ts
      id: normalizeNotionId(page.id),
      relatedScopes: relationIds(p, TRADE_PROPERTIES_MAP.relatedScopes.label).map(normalizeNotionId),
```

- [ ] **Step 2: Normalize in `scopes/adapter.ts`**

Add `import { normalizeNotionId } from '../normalize-notion-id'`, then:

```ts
      id: normalizeNotionId(page.id),
      relatedTrade: relationIds(p, SCOPE_OR_ADDON_PROPERTIES_MAP.relatedTrade.label).map(normalizeNotionId)[0],
      relatedScopesOfWork: relationIds(p, SCOPE_OR_ADDON_PROPERTIES_MAP.relatedScopesOfWork.label).map(normalizeNotionId),
```

- [ ] **Step 3: Normalize in `sows/adapter.ts`**

Add `import { normalizeNotionId } from '../normalize-notion-id'`, then:

```ts
      id: normalizeNotionId(page.id),
      relatedScope: relationIds(p, SOW_PROPERTIES_MAP.relatedScope.label).map(normalizeNotionId),
```

- [ ] **Step 4: Normalize in `pain-points/adapter.ts`**

Add `import { normalizeNotionId } from '../normalize-notion-id'`, then:

```ts
      id: normalizeNotionId(page.id),
      trades: relationIds(p, map.trades.label).map(normalizeNotionId),
```

- [ ] **Step 5: Normalize the relation branch of `property-filter.ts` — that branch only**

Add `import { normalizeNotionId } from './normalize-notion-id'` and change **only** the `'relation'` case:

```ts
    case 'relation':
      // An undashed caller id makes Notion return an empty set with no error.
      return { property: propertyName, relation: { contains: normalizeNotionId(query) } }
```

Leave `title`, `rich_text`, `phone_number`, `select`, `date`, `people` and `default` exactly as they are — those filter on free text, and normalizing a display name would corrupt the query. `normalizeNotionId` passes non-UUID strings through, but the point is intent: only relation filters take ids.

- [ ] **Step 6: Re-run both verification scripts**

Run: `pnpm tsx scripts/verify-normalize-notion-id.ts && pnpm tsx scripts/verify-notion-adapters.ts`
Expected: both PASS. The adapter script's fixtures already use dashed ids, so normalization is a no-op there — that is the idempotence check.

- [ ] **Step 7: Typecheck and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Confirm only the relation branch normalizes**

Run: `grep -n "normalizeNotionId" src/shared/services/providers/notion/lib/property-filter.ts`
Expected: exactly two lines — the import and the `'relation'` case.

- [ ] **Step 9: Commit**

```bash
git add src/shared/services/providers/notion/lib/trades/adapter.ts \
        src/shared/services/providers/notion/lib/scopes/adapter.ts \
        src/shared/services/providers/notion/lib/sows/adapter.ts \
        src/shared/services/providers/notion/lib/pain-points/adapter.ts \
        src/shared/services/providers/notion/lib/property-filter.ts
git commit -m "fix(notion): normalize page and relation ids to dashed lowercase

Every id comparison in the app is string equality or a Map key, so a
dashed/undashed mismatch silently returned nothing. Adapters now normalize
their own id and every relation id; relation filters normalize their input,
where an undashed id previously produced an empty result with no error.

Only the relation filter branch normalizes — text filters must not be touched.

Refs: construction epic F5.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Fix energy-trade classification

`isEnergyEfficientTrade` tests `['insulation','hvac','windows','solar'].includes(tradeId)`, but `tradeId` is a dashed Notion UUID (`trade-selection.ts:79` sets `tradeId: trade.id`). The comparison is always `false`, so `qualifyEnergySaver` always returns `qualified: false` and the Energy Saver+ program is permanently unqualifiable.

The list is broken a second way: measured against the seeded Postgres accessors (`db/seeds/data/trades.ts`), `hvac` and `solar` exist, `windows` is really `windowsAndDoors`, and **`insulation` is not a trade at all** — so there is no correct hardcoded list to fall back to. Classify by category instead: `Trade.type` is a live Notion select (`providers/notion/lib/trades/schema.ts:8`) and landing already classifies on it (`notion-trade-helpers.ts:15-18` maps `energy-efficient-construction` → `['Energy Efficiency']`). This is the rule the epic's F11 lands at P2.

**Files:**
- Modify: `src/features/meeting-flow/constants/energy-trades.ts` (whole file, 5 lines)
- Modify: `src/features/meeting-flow/types/index.ts:43-47`
- Modify: `src/features/meeting-flow/constants/programs.ts:14-30`
- Modify: `src/features/meeting-flow/ui/components/steps/program-step.tsx:30-41`
- Modify: `src/shared/constants/enums/meetings.ts:145-147`
- Create: `scripts/verify-energy-trade-qualification.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `isEnergyEfficientTrade(trade: Trade): boolean`; `QualificationContext` gains `tradesById: Map<string, Trade>`. `TradeSelection` (the persisted shape) is **not** changed.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-energy-trade-qualification.ts`:

```ts
/* eslint-disable no-console */
import type { QualificationContext } from '@/features/meeting-flow/types'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import assert from 'node:assert/strict'
import { isEnergyEfficientTrade } from '@/features/meeting-flow/constants/energy-trades'
import { PROGRAMS } from '@/features/meeting-flow/constants/programs'

function trade(id: string, name: string, type: Trade['type']): Trade {
  return { id, name, slug: name.toLowerCase(), coverImageUrl: null, type, relatedScopes: [], disabled: false }
}
function selection(tradeId: string, tradeName: string): TradeSelection {
  return { tradeId, tradeName, selectedScopes: [], painPoints: [] }
}

const SOLAR = trade('6240ca1b-548b-837d-a9c0-01acc1fb530a', 'Solar', 'Energy Efficiency')
const KITCHEN = trade('7351db2c-659c-948e-b0d1-12bdd2gc641b', 'Kitchen', 'General Construction')

assert.equal(isEnergyEfficientTrade(SOLAR), true, 'an Energy Efficiency trade qualifies')
assert.equal(isEnergyEfficientTrade(KITCHEN), false, 'a General Construction trade does not')

const energySaver = PROGRAMS.find(p => p.accessor === 'energy-saver-plus')
assert.ok(energySaver, 'the Energy Saver+ program exists')

function ctx(trades: Trade[], selections: TradeSelection[]): QualificationContext {
  return {
    tradeSelections: selections,
    customer: null,
    meetingType: 'in-home',
    tradesById: new Map(trades.map(t => [t.id, t])),
  } as QualificationContext
}

assert.equal(
  energySaver.qualify(ctx([SOLAR, KITCHEN], [selection(SOLAR.id, 'Solar')])).qualified,
  true,
  'Energy Saver+ qualifies when an energy-efficient trade is selected — the bug this fixes',
)
assert.equal(
  energySaver.qualify(ctx([SOLAR, KITCHEN], [selection(KITCHEN.id, 'Kitchen')])).qualified,
  false,
  'Energy Saver+ does not qualify on a non-energy trade',
)
assert.equal(
  energySaver.qualify(ctx([SOLAR], [selection('not-in-catalog', 'Ghost')])).qualified,
  false,
  'a selection whose trade is missing from the catalog does not qualify, and does not throw',
)

console.log('✅ energy-trade qualification verified')
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `pnpm tsx scripts/verify-energy-trade-qualification.ts`
Expected: FAIL — a type error on `isEnergyEfficientTrade(SOLAR)` (it takes a `string` today), and the "qualifies" assertion fails because the comparison can never match.

- [ ] **Step 3: Rewrite `energy-trades.ts`**

Replace the whole file:

```ts
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'

/**
 * Energy-efficient trades are classified by their Notion category, not by a
 * hardcoded id list. The previous list compared Notion page UUIDs against
 * ['insulation','hvac','windows','solar'], so it never matched and the Energy
 * Saver+ program could never qualify — and two of those four keys did not
 * name a real trade either.
 *
 * Landing already classifies on the same field (PILLAR_TYPE_MAP in
 * features/landing/lib/notion-trade-helpers.ts). The construction epic folds
 * both into one module rule at P2 (F11).
 */
export function isEnergyEfficientTrade(trade: Trade): boolean {
  return trade.type === 'Energy Efficiency'
}
```

- [ ] **Step 4: Add `tradesById` to `QualificationContext`**

In `src/features/meeting-flow/types/index.ts`, add the import and the field:

```ts
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
```

```ts
export interface QualificationContext {
  tradeSelections: TradeSelection[]
  customer: CustomerWithProfile | null
  meetingType: MeetingType
  /** The live trade catalog, so qualifiers can classify by category rather than by id. */
  tradesById: Map<string, Trade>
}
```

- [ ] **Step 5: Resolve through the catalog in `qualifyEnergySaver`**

In `src/features/meeting-flow/constants/programs.ts`, change line 15 from
`const energyTrades = ctx.tradeSelections.filter(t => isEnergyEfficientTrade(t.tradeId))`
to:

```ts
  const energyTrades = ctx.tradeSelections.flatMap((selection) => {
    const trade = ctx.tradesById.get(selection.tradeId)
    return trade && isEnergyEfficientTrade(trade) ? [trade] : []
  })
```

Leave the rest of the function, and `qualifyMonthlySpecial` / `qualifyExistingCustomer`, untouched.

- [ ] **Step 6: Pass `tradesById` from `ProgramStep`**

In `src/features/meeting-flow/ui/components/steps/program-step.tsx`, add the catalog hook above the `qualCtx` memo and feed it in:

```ts
  const { tradesById } = useTradeCatalog()

  const qualCtx: QualificationContext = useMemo(() => ({
    tradeSelections,
    customer,
    meetingType,
    tradesById,
  }), [tradeSelections, customer, meetingType, tradesById])
```

Add the import: `import { useTradeCatalog } from '@/features/meeting-flow/hooks/use-trade-catalog'`. `useTradeCatalog` already exposes a memoized `tradesById`, so the dep array stays stable.

- [ ] **Step 7: Delete the dead accessor constant**

In `src/shared/constants/enums/meetings.ts`, delete lines 145–147 — the `// Energy-efficient trade classification` comment, `energyEfficientTradeAccessors`, and the `EnergyEfficientTrade` type. `energy-trades.ts` was their only consumer.

- [ ] **Step 8: Run the verification script — it should pass now**

Run: `pnpm tsx scripts/verify-energy-trade-qualification.ts`
Expected: PASS — `✅ energy-trade qualification verified`

- [ ] **Step 9: Typecheck, lint, and confirm the constant is gone**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

Run: `grep -rn "energyEfficientTradeAccessors\|EnergyEfficientTrade" src/ scripts/`
Expected: zero matches.

- [ ] **Step 10: Verify in the browser**

Run `pnpm dev`. Open a meeting, select a trade whose Notion `type` is `Energy Efficiency` (Solar is the clearest), and go to the program step.
Expected: Energy Saver+ shows as **qualified**. Then deselect it, leaving only a General Construction trade: the program shows unqualified with "Requires at least 1 energy-efficient trade".

- [ ] **Step 11: Commit**

```bash
git add src/features/meeting-flow/constants/energy-trades.ts \
        src/features/meeting-flow/constants/programs.ts \
        src/features/meeting-flow/types/index.ts \
        src/features/meeting-flow/ui/components/steps/program-step.tsx \
        src/shared/constants/enums/meetings.ts \
        scripts/verify-energy-trade-qualification.ts
git commit -m "fix(meeting-flow): Energy Saver+ can qualify again

isEnergyEfficientTrade compared Notion page UUIDs against
['insulation','hvac','windows','solar'], so it never matched and the program
was permanently unqualifiable. That list was wrong in its own id space too:
'windows' is really 'windowsAndDoors' and 'insulation' is not a trade at all.

Classify by the live Notion category instead (Trade.type === 'Energy
Efficiency'), which landing already does. QualificationContext carries the
catalog; the persisted TradeSelection shape is unchanged.

Refs: construction epic B1, V4; anticipates F11.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Delete dead code

Five items with zero live consumers, plus the `getScopesByTrade` chain (owner decision D9: delete the page, the procedure and the service function together — the page is already broken, since its hardcoded undashed id makes the relation filter return empty).

**Files:**
- Delete: `src/shared/services/providers/notion/lib/page-to-html.ts`
- Delete: `src/shared/services/providers/notion/lib/blocks-to-html.ts`
- Delete: `src/shared/services/providers/notion/lib/page-to-blocks.ts`
- Delete: `src/app/(frontend)/(site)/tests/[label]/page.tsx`
- Modify: `src/shared/services/providers/notion/dal/trades/hooks/queries/use-get-trades.ts:4-7`
- Modify: `src/trpc/routers/notion.router/trades.router.ts:10-17`
- Modify: `src/trpc/routers/notion.router/scopes.router.ts:25-29`
- Modify: `src/shared/services/construction-data.service.ts:26-39,55-61`

**Interfaces:**
- Consumes: nothing.
- Produces: `useGetAllTrades` survives untouched in the same file. `constructionDataService` loses `getTradesByQuery` and `getScopesByTrade`; it keeps `getTrades`, `getAllScopes`, `getScopesByQuery`, `getSOWsByScope`, `getSOWContent`.

- [ ] **Step 1: Re-confirm zero consumers before deleting anything**

```bash
grep -rn "page-to-html\|pageToHTML\|blocks-to-html\|blocksToHtml\|page-to-blocks\|pageToBlocks" src/ scripts/ tests/ video/
grep -rn "useGetTrades\b" src/
grep -rn "getTradesByQuery\|getScopesByTrade" src/ scripts/
```
Expected: the first returns only the files being deleted; the second returns only the declaration (every other hit is the sibling `useGetAllTrades`); the third returns only the router, the service and the scratch page.

**If any of these returns an unexpected consumer, stop and report it — do not delete.**

- [ ] **Step 2: Delete the three orphaned lib files and the scratch page**

```bash
git rm src/shared/services/providers/notion/lib/page-to-html.ts \
       src/shared/services/providers/notion/lib/blocks-to-html.ts \
       src/shared/services/providers/notion/lib/page-to-blocks.ts \
       "src/app/(frontend)/(site)/tests/[label]/page.tsx"
```

If `src/app/(frontend)/(site)/tests/` is now empty, remove the directory too.

- [ ] **Step 3: Delete the `useGetTrades` export only**

In `src/shared/services/providers/notion/dal/trades/hooks/queries/use-get-trades.ts`, delete the `useGetTrades` function (lines 4–7). **Keep `useGetAllTrades`** (lines 9–12) — it is live in `use-trade-catalog.ts:7`, `sow-field.tsx:20` and `meeting-scopes-picker.tsx:24`. Keep the file.

- [ ] **Step 4: Delete the two tRPC procedures**

In `src/trpc/routers/notion.router/trades.router.ts`, delete the `getTradesByQuery` procedure (lines 10–17), leaving `getAll`.

In `src/trpc/routers/notion.router/scopes.router.ts`, delete the `getScopesByTrade` procedure (lines 25–29). **Leave `getScopesByQuery` (lines 13–24) in place** — it is live behind `useGetScopes` and goes at P3.

- [ ] **Step 5: Delete the two service functions**

In `src/shared/services/construction-data.service.ts`, delete `getTradesByQuery` (lines 26–39) and `getScopesByTrade` (lines 55–61). Keep `getTrades`, `getAllScopes`, `getScopesByQuery`, `getSOWsByScope`, `getSOWContent`.

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. A type error here means something still referenced a deleted symbol — fix the reference or restore the symbol; do not cast it away.

- [ ] **Step 7: Re-run every verification script**

Run: `pnpm tsx scripts/verify-normalize-notion-id.ts && pnpm tsx scripts/verify-notion-adapters.ts && pnpm tsx scripts/verify-energy-trade-qualification.ts`
Expected: all three PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/services/providers/notion/dal/trades/hooks/queries/use-get-trades.ts \
        src/trpc/routers/notion.router/trades.router.ts \
        src/trpc/routers/notion.router/scopes.router.ts \
        src/shared/services/construction-data.service.ts
git commit -m "chore(notion): delete dead adapters, hook, procedures and scratch page

Zero consumers: page-to-html, blocks-to-html (orphaned even from page-to-html,
which imports blocksToHtml from the npm package), the empty page-to-blocks, the
useGetTrades export (useGetAllTrades in the same file stays), and
getTradesByQuery, reachable only through that dead hook.

getScopesByTrade and its scratch page go together (owner decision D9): the page
hardcoded an undashed trade id, so it already returned empty.

getScopesByQuery stays — it is live behind useGetScopes and goes at P3.

Refs: construction epic B4, D9.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Update the provider DOCS and verify pagination against live Notion

The provider's `DOCS.md` states the adapter rule but admits three adapters violate it, and never mentions a row cap at all. `V7` requires docs to land with the change.

**Files:**
- Modify: `src/shared/services/providers/notion/DOCS.md:15,72,78`
- Create: `scripts/tmp-verify-notion-pagination.ts` (deleted at the end of this task)
- Modify: `docs/plans/2026-09-15-construction-data-standardization-epic.md` (tick the P0 requirement boxes)

**Interfaces:**
- Consumes: the paginated reads from Tasks 2 and 3.
- Produces: nothing code-facing.

- [ ] **Step 1: Write the live pagination check**

Create `scripts/tmp-verify-notion-pagination.ts` — note `load-env` must be the **first** line, because the Notion client reads `NOTION_API_KEY` at import time:

```ts
/* eslint-disable no-console */
import './lib/load-env'
import { constructionDataService } from '@/shared/services/construction-data.service'

const scopes = await constructionDataService.getAllScopes()
const trades = await constructionDataService.getTrades()

console.log(`scopes: ${scopes.length}`)
console.log(`trades: ${trades.length}`)

if (scopes.length === 100) {
  console.error('❌ exactly 100 scopes — suspicious; the cursor loop may not be running')
  process.exit(1)
}

const ids = scopes.map(s => s.id)
const undashed = ids.filter(id => !/^[0-9a-f-]{36}$/.test(id))
if (undashed.length > 0) {
  console.error('❌ unnormalized ids:', undashed.slice(0, 5))
  process.exit(1)
}

console.log('✅ pagination + id normalization verified against live Notion')
```

- [ ] **Step 2: Run it**

Run: `pnpm tsx scripts/tmp-verify-notion-pagination.ts`
Expected: prints the real counts and `✅`. **Compare the scopes count against the Notion UI's row count for the scopes database** — they must match. Before this change the read stopped at 100; if Notion holds more than 100 scopes, the number should now be visibly higher than it was.

If the count is exactly 100, the loop is not running — go back to Task 2.

- [ ] **Step 3: Update `DOCS.md`**

In `src/shared/services/providers/notion/DOCS.md`:

1. At `:15`, delete the sentence "Other entity adapters (`pageToScope`, `pageToSOW`, `pageToPainPoint`) still throw — they should be migrated as they're touched." Replace with: "All four entity adapters (`pageToTrade`, `pageToScope`, `pageToSOW`, `pageToPainPoint`) return `Entity | null` and never throw on a single row."

2. Add a new rule section `### reads-paginate`:

```markdown
### reads-paginate

Every list read loops on `has_more` / `next_cursor` at `page_size: 100`. Notion's
default page size is 100 and that is also its maximum, so a single request
silently truncates — `dataSources.query` in `dal/query-notion-database.ts`
(via `queryAllPages`) and `blocks.children.list` in `lib/page-to-tiptap-json.ts`
(via `listAllBlockChildren`).

**Why**: reads used to stop at 100 rows with no error. `getAllScopes` feeds 8+
surfaces, so missing scopes showed up as missing UI, not as a failure.
**Enforced by**: convention — never call `dataSources.query` or
`blocks.children.list` directly; go through the two helpers.
```

3. Add a new rule section `### ids-are-normalized-at-the-adapter`:

```markdown
### ids-are-normalized-at-the-adapter

Adapters return dashed lowercase UUIDs for their own `id` and for every relation
id, via `lib/normalize-notion-id.ts`. `buildPropertyFilter` normalizes the
`relation` branch's input for the same reason — and **only** that branch; text
filters must not be normalized.

**Why**: every id comparison in the app is string equality or a Map key, so a
dashed/undashed mismatch returns nothing instead of erroring. An undashed id in
a relation filter makes Notion return an empty set with no error.
**Enforced by**: convention
```

4. At `:72`, keep the "filtering disabled rows outside the adapter" anti-pattern entry and append: "Note that `disabled` exists only on **trades** — scopes, SOWs and pain points have no such property. `features/meeting-flow/hooks/use-trade-catalog.ts:16` still re-filters it client-side; that goes at P1 with the hook move."

5. At `:78`, after "one filter property at a time, no compound filter support yet", add ", and it paginates — see `#reads-paginate`."

- [ ] **Step 4: Delete the temporary script**

```bash
rm scripts/tmp-verify-notion-pagination.ts
```

Per repo convention, `tmp-*` scripts are deleted after use. The two `verify-*` scripts from Tasks 1, 4 and 6 stay — they are pure and re-runnable.

- [ ] **Step 5: Tick the P0 boxes in the epic tracker**

In `docs/plans/2026-09-15-construction-data-standardization-epic.md`:
- §3.2 — tick **F3**, **F4**, **F5**.
- §3.3 — tick **A3**.
- §4 — mark **B1, B2, B3, B4, B14, B15, B16, B17** done; leave **B18** noting the P1 half.
- §0 table — set the P0 row's Plan column to this file and its Status to `[x]`.
- Header — change the status line to name P1 as next.

- [ ] **Step 6: Final full verification**

Run: `pnpm tsc && pnpm lint`
Expected: PASS, no new warnings.

Run: `pnpm tsx scripts/verify-normalize-notion-id.ts && pnpm tsx scripts/verify-notion-adapters.ts && pnpm tsx scripts/verify-energy-trade-qualification.ts`
Expected: all three PASS.

Smoke in the browser (`pnpm dev`): meeting-flow specialties step loads its trades and scopes; the proposal SOW field loads scopes and a SOW template; a portfolio page filters by trade. These are the `scopes.getAll` consumers most exposed by the `.map` → `.flatMap` switch.

- [ ] **Step 7: Commit**

```bash
git add src/shared/services/providers/notion/DOCS.md \
        docs/plans/2026-09-15-construction-data-standardization-epic.md
git commit -m "docs(notion): record pagination and id-normalization rules; close P0

Adds #reads-paginate and #ids-are-normalized-at-the-adapter, drops the note
that three adapters still throw, and records that 'disabled' exists only on
trades. Ticks F3/F4/F5/A3 and B1-B4, B14-B17 in the construction epic tracker.

Refs: construction epic A3, V7.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review notes

**Spec coverage.** §3.1 → Tasks 2, 3. §3.2 → Task 4. §3.3 → Tasks 1, 5. §3.4 → Task 7 (D9 resolved: delete all three). §3.5 → Task 6. §3.6 → Task 8. §4 verification: V1 in every task; P0-V1 Task 1; P0-V2 Task 4; P0-V3 Task 8 Step 2; P0-V4 Task 6 Step 10; P0-V5 Tasks 4, 6, 7; smoke Task 8 Step 6.

**Type consistency.** `normalizeNotionId(id: string): string` is defined in Task 1 and imported under that exact name in Task 5 at five sites. `pageToScope` / `pageToSOW` / `pageToPainPoint` gain `| null` in Task 4 and are re-edited in Task 5 without further signature change. `isEnergyEfficientTrade(trade: Trade)` (Task 6 Step 3) matches its call in Task 6 Step 5 and the verify script in Step 1. `QualificationContext.tradesById: Map<string, Trade>` (Step 4) matches `ctx.tradesById.get(...)` (Step 5), `useTradeCatalog()`'s existing `tradesById` (Step 6), and the script's `new Map(...)`.

**Ordering constraint.** Task 4 must land before Task 5 — both edit the same three adapter files, and Task 5's diffs assume Task 4's `try/catch` wrapper is already in place. Task 7 must land after Task 4, because Task 4 Step 6 edits `getScopesByTrade` (which Task 7 then deletes); doing them in the other order leaves `pnpm tsc` red in between.

**Known risk.** Task 6 Step 6 adds a `useTradeCatalog()` call to `ProgramStep`. That hook fires two tRPC queries, but every other meeting-flow step already calls it, so React Query serves them from cache — no new network cost. If `ProgramStep` is ever rendered outside the meeting-flow provider tree, the qualifier degrades to "no trades resolved, nothing qualifies" rather than throwing, which the third assertion in Step 1 pins down.
