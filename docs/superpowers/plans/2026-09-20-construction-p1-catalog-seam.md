# Construction P1 — Catalog Seam & Read Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give trades, scopes/add-ons, SOW templates and pain points one home — `src/shared/modules/construction/` — behind one `ConstructionCatalogSource` interface with exactly one binding, so the P5 Notion→Postgres swap is a one-line change.

**Architecture:** A path-only move lands the Notion internals in `modules/construction/sources/notion/` without changing a single type. A second commit then replaces the four Notion-shaped schemas with neutral domain schemas and renames every field at every call site. The seam, a cached module service, a renamed tRPC router and one client index builder stack on top. Nothing above the seam learns Notion exists.

**Tech Stack:** TypeScript, Next.js 15 (App Router, `unstable_cache`), tRPC v11, Zod, TanStack Query, `@notionhq/client`, pnpm, tsx.

**Spec:** `docs/superpowers/specs/2026-09-20-construction-p1-catalog-seam-design.md`

## Global Constraints

These apply to **every** task. They are repo rules, not suggestions.

- **Verification is `pnpm tsc` and `pnpm lint` only. NEVER run `pnpm build`.** (`CLAUDE.md`)
  Always run lint as **`CI=1 pnpm lint`**: under VS Code env vars `@antfu/eslint-config` prints "Detected running in editor, some rules are disabled" and softens rules. `tsc` checks every `**/*.ts` — including `tests/` — so every code grep in this plan covers `src/ scripts/ tests/`.
- **Work on `main`. Stage explicit file paths only — never `git add -A`, never a directory.** ~57 files in this tree carry other sessions' uncommitted WIP (`src/features/`, `src/shared/entities/`, `src/shared/domains/`, `docs/` …). A directory `git add` sweeps them into your commit — Task 1's plan-as-written did exactly that and had to be amended out. Every task runs the **commit gate**:

  ```bash
  S=/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b561a36a-bcab-41eb-8ac9-810207705807/scratchpad
  # Step 0, BEFORE the task's first edit — snapshot foreign WIP (paths + content hashes)
  git diff --cached --quiet || { echo "index not empty — STOP"; }
  git status --porcelain > $S/wip-before.txt
  git status --porcelain | awk '{print $NF}' | xargs -r sha1sum > $S/wip-hashes.txt 2>/dev/null
  # If any file on the task's Files list is already in wip-before.txt: STOP and ask the user.

  # At commit time
  sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null   # prints a foreign-WIP file you modified → STOP and ask
  git status --porcelain | grep -vxFf $S/wip-before.txt  # = this task's files; stage each by explicit path
  git diff --cached --name-status                        # must list only this task's files, or `git restore --staged <path>`
  ```
- **Import order is lint-enforced** (`perfectionist/sort-imports`). After rewriting import paths, run `CI=1 pnpm exec eslint --fix <this task's files>` — **never repo-wide**, which would rewrite the foreign-WIP files above. `--fix` also strips pre-existing "unused" `/* eslint-disable no-console */` headers in `scripts/` — restore them; they are out of scope.
- **Before staging, list every changed non-import line per file** and confirm each belongs to the task (a live session may be editing the same files):
  ```bash
  git diff -M HEAD -U0 -- <task paths, BOTH sides of each rename> \
    | awk '/^\+\+\+ /{f=substr($0,5)} /^--- a\//{d=substr($0,7)} /^\+\+\+ \/dev\/null/{f=d} /^[+-][^+-]/{print f"\t"$0}' \
    | grep -vP "\t[+-]\s*(import |\} from ')" | cut -f1 | sort | uniq -c
  ```
- **The snapshot does not cover files a live session starts editing mid-task.** In Task 6 four meeting-flow files modified by another session at 07:53 — after the Step-0 snapshot — showed up as candidates and were staged; the index check caught them. So: keep an **explicit list of the files this task edited** (every sed/xargs target list, every Write/Edit), stage only that list, and treat any other candidate as foreign until proven otherwise (mtime after your last edit, content unrelated to the task). Also confirm none of *your* files changed after your verification run.
- **Preserve line endings.** 67 tracked `.ts/.tsx` files use CRLF (e.g. `src/trpc/routers/app.ts`). Python text-mode read/write silently converts them to LF — a whole-file diff. Use `open(p, newline='')` or `sed`, and check `git diff --stat` matches the intended line count.
- **Never `git add -N`** (or any index write) to make untracked files diffable — it marks every foreign untracked file intent-to-add.
- **Every commit must leave `pnpm tsc` and `pnpm lint` green.** No task ends red.
- **Non-defensive migration.** Move consumers and delete the old code in the *same* commit. No aliases, no re-export shims, no dual paths, no deprecated wrappers, no back-compat field names. If you find yourself adding a second way to do something, you have gone wrong.
- **No speculative types.** Do not create a type, constant, or helper that has zero call sites after this task. If the spec names one and it has no consumer, it belongs to a later phase.
- **Commit message attribution** — end every commit message body with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Do not run `git push`.** This plan produces local commits only.
- **Never delete a working tool to satisfy a refactor.** Only the files in each task's explicit *Delete* list may be removed. `scripts/portfolio-scraper/` in particular keeps every capability it has today — see Task 8's banner. If a rule in this plan seems to require deleting something not on a Delete list, the plan is wrong: stop and report it.
- **Scripts load env via `import './lib/load-env'`** — never `import 'dotenv/config'`. (`memory/feedback-scripts-load-env.md`)
- **Do not change behaviour or copy.** Every UI edit in this plan is an import path, a field name, or a hook name. Two P0 escalations (`programs.ts` IRA 25C claims, `program-step.tsx`'s missing loading gate) stay open and owner-owned — do not "fix" them here.

## Decisions taken after the spec was approved

The spec was written before three conflicts with ratified conventions surfaced. The user resolved all three on 2026-09-20; **this plan supersedes the spec on these points.**

| # | Spec said | This plan does | Why |
|---|---|---|---|
| D-a | flat `modules/construction/*` | a **`core/` unit**: `modules/construction/core/{schemas,constants,lib,hooks}` | `service-architecture.md#modules` — a module owns units; all three existing modules have one. Matches `CLAUDE.md`'s `modules/<module>/<unit>/DOCS.md` pointer. |
| D-b | singular `sources/` → `source/` | **plural `sources/`** | `provider-boundaries.md` names `modules/construction/sources/notion/` as the ratified target in two places. Plural matches every other category directory (`schemas/`, `hooks/`, `constants/`). No doc edit needed. |
| D-c | `construction.service.ts` | **`service.ts`** at the module root | `service-architecture.md#the-four-tiers`: a module's service is `modules/<module>/service.ts`. All seven module services in the repo are named `service.ts`. |
| D-d | (not mentioned) | **`tradeCategories` moves into the module; `TRADE_CATEGORY_ORDER` is deleted, not duplicated** | `features/meeting-flow/constants/trade-categories.ts:1-5` holds a verbatim copy of the Notion `Trade.type` enum, forcing an `as TradeCategory` cast at `showcase-text.tsx:29`. User: "do NOT keep both copies." |
| D-e | delete `scripts/portfolio-scraper/fetch-scopes.ts` outright | **reduce it** to `fuzzy-match-scopes.ts` | The file also exports `fuzzyMatchScopes` + two Levenshtein helpers, used at `index.ts:549,556`. Deleting it outright breaks `pnpm scrape-project`. Only the Notion-fetching half goes. |

## Final file layout

```
src/shared/services/providers/notion/          3 files — a true leaf
  client.ts                                    unchanged
  types.ts                                     NotionPropDef · RawPropertyMap
                                               NotionColumnType · PropertyFilter
  lib/config.ts                                unchanged (sanctioned outward dep)
  DOCS.md                                      rewritten to describe only the leaf

src/shared/modules/construction/
  DOCS.md                                      module-wide rules (mirrors modules/media/)
  service.ts                                   cached reads + composition
  sources/
    types.ts                                   ConstructionCatalogSource
    index.ts                                   the ONE binding
    notion/
      index.ts                                 notionCatalogSource
      databases.ts  query.ts  property-filter.ts  extractors.ts
      normalize-id.ts  blocks-to-tiptap.ts  page-to-tiptap.ts
      trades/{adapter,properties-map}.ts
      scopes/{adapter,properties-map}.ts
      sows/{adapter,properties-map}.ts
      pain-points/{adapter,properties-map}.ts
  core/
    schemas/index.ts                           Trade · Scope · SowTemplate · PainPoint
    constants/enums.ts                         moved from domains/construction/
    lib/build-catalog-index.ts
    hooks/use-construction-catalog.ts

src/trpc/routers/construction.router/
  index.ts  trades.router.ts  scopes.router.ts  sow.router.ts  pain-points.router.ts
```

**Deleted entirely:** `src/shared/domains/construction/`, `src/shared/services/construction-data.service.ts`, `src/trpc/routers/notion.router/`, `src/shared/services/providers/notion/{constants,dal}/`, `src/shared/services/providers/notion/lib/*` (except `config.ts`), `src/features/meeting-flow/hooks/use-trade-catalog.ts`, `src/features/meeting-flow/lib/group-scopes-by-trade.ts`, `src/features/meeting-flow/lib/get-cached-pain-points.ts`.

---

### Task 1: Move the house-profile enums into the module

`src/shared/domains/construction/` holds exactly one file, and it is not about the catalog at all — it holds property-profile enums describing the customer's *house* (`roofTypes`, `hvacTypes`, `homeAreas`, `foundationTypes`…). It moves so `domains/construction/` can be deleted, giving the module one unambiguous home.

`db/schema/*` importing from `modules/*` is already the established pattern — see `src/shared/db/schema/proposals.ts:2,10` and `src/shared/db/schema/projects.ts:2`.

**Files:**
- Create: `src/shared/modules/construction/core/constants/enums.ts`
- Delete: `src/shared/domains/construction/constants/enums.ts` (and the now-empty `src/shared/domains/construction/`)
- Modify: `src/shared/db/schema/customer-profiles.ts:24`
- Modify: `src/shared/db/schema/meta.ts:23`
- Modify: `src/shared/db/schema/scopes.ts:3`
- Modify: `src/shared/entities/customers/constants/property-profile-fields.ts:11`
- Modify: `src/shared/modules/proposals/core/schemas/index.ts:3`

**Interfaces:**
- Consumes: nothing.
- Produces: `@/shared/modules/construction/core/constants/enums` exporting, unchanged: `tradeLocations`/`TradeLocation`, `constructionTypes`/`ConstructionType`, `variableDataTypes`/`VariableDataType`, `homeAreas`/`HomeArea`, `roofTypes`/`RoofType`, `roofLocations`/`RoofLocation`, `hvacTypes`/`HVACType`, `hvacComponents`/`HVACComponent`, `windowsTypes`/`WindowsType`, `insulationLevels`/`InsulationLevel`, `foundationTypes`/`FoundationType`.

- [ ] **Step 1: Move the file with git mv, contents untouched**

```bash
mkdir -p src/shared/modules/construction/core/constants
git mv src/shared/domains/construction/constants/enums.ts \
       src/shared/modules/construction/core/constants/enums.ts
rmdir src/shared/domains/construction/constants src/shared/domains/construction
```

Do **not** edit the file's contents in this task. It is a byte-for-byte move.

- [ ] **Step 2: Repoint the five importers**

```bash
grep -rl "@/shared/domains/construction/constants/enums" src/ \
  | xargs sed -i 's#@/shared/domains/construction/constants/enums#@/shared/modules/construction/core/constants/enums#g'
```

- [ ] **Step 3: Verify nothing references the old path and the tree is gone**

```bash
grep -rn "domains/construction" src/ scripts/ tests/ docs/ ; echo "--- exit $? (1 = clean) ---"
test ! -d src/shared/domains/construction && echo "domains/construction removed"
```

Expected: the only remaining hits are in `docs/plans/` and `docs/superpowers/` prose, which Task 9 updates. Zero hits under `src/` and `scripts/`.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && CI=1 pnpm lint`
Expected: both clean. This is a pure path change, so any failure means an import was missed.

- [ ] **Step 5: Commit**

```bash
# The rename is already staged by `git mv`. Do NOT add `src/shared/domains` — it sweeps in
# foreign WIP (src/shared/domains/funnels/types.ts). Executed as commit 616465a7.
git add src/shared/modules/construction/core/constants/enums.ts \
        src/shared/db/schema/customer-profiles.ts \
        src/shared/db/schema/meta.ts \
        src/shared/db/schema/scopes.ts \
        src/shared/entities/customers/constants/property-profile-fields.ts \
        src/shared/modules/proposals/core/schemas/index.ts
git commit -m "$(cat <<'MSG'
refactor(construction-p1): move house-profile enums into modules/construction

Path-only. domains/construction/ held one file of property-profile enums
about the customer's house (roofTypes, hvacTypes, homeAreas, ...), not
catalog enums. Moving it lets domains/construction/ be deleted so the
module has one unambiguous home.

db/schema importing from modules/ is the established pattern
(db/schema/proposals.ts:2,10; db/schema/projects.ts:2).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Path-only move of the Notion internals into `sources/notion/`

The single riskiest change in P1, made safe by containing **zero** type or field changes. Every schema keeps its current shape and every field keeps its current name. Only paths move, four files shed a redundant prefix, and provably-dead exports are dropped.

This is the repo's documented migration recipe for exactly this situation — `service-architecture.md#entities-vs-modules`: *"The move itself is a path-only commit (`git mv` + import rewrites, zero behavior change) so it can be verified mechanically."*

**Files:**

Moved (19 files, via `git mv`):

| From `src/shared/services/providers/notion/` | To `src/shared/modules/construction/sources/notion/` |
|---|---|
| `constants/databases.ts` | `databases.ts` |
| `dal/query-notion-database.ts` | `query.ts` |
| `lib/property-filter.ts` | `property-filter.ts` |
| `lib/extractors.ts` | `extractors.ts` |
| `lib/normalize-notion-id.ts` | `normalize-id.ts` |
| `lib/blocks-to-tiptap-json.ts` | `blocks-to-tiptap.ts` |
| `lib/page-to-tiptap-json.ts` | `page-to-tiptap.ts` |
| `lib/trades/{adapter,properties-map,schema}.ts` | `trades/{adapter,properties-map,schema}.ts` |
| `lib/scopes/{adapter,properties-map,schema}.ts` | `scopes/{adapter,properties-map,schema}.ts` |
| `lib/sows/{adapter,properties-map,schema}.ts` | `sows/{adapter,properties-map,schema}.ts` |
| `lib/pain-points/{adapter,properties-map,schema}.ts` | `pain-points/{adapter,properties-map,schema}.ts` |

The four renames drop a prefix the directory already supplies: the folder is literally called `notion/`.

- Modify: `src/shared/services/providers/notion/types.ts` — split; keep only the generic half
- Delete: `src/shared/services/providers/notion/dal/trades/hooks/queries/use-get-trades.ts`
- Delete: `src/shared/services/providers/notion/dal/scopes/hooks/queries/use-get-scopes.ts`
- Modify: every importer (full list in Step 4)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `@/shared/services/providers/notion/types` — now exactly four exports: `NotionPropDef`, `RawPropertyMap<T>`, `NotionColumnType`, `PropertyFilter`.
  - `@/shared/modules/construction/sources/notion/databases` — `notionDatabasesMeta`, `type NotionDatabaseMap`, `type NotionDatabaseName`.
  - `@/shared/modules/construction/sources/notion/query` — `queryNotionDatabase`.
  - `@/shared/modules/construction/sources/notion/normalize-id` — `normalizeNotionId`.
  - `@/shared/modules/construction/sources/notion/page-to-tiptap` — `pageToTiptapJson`.
  - `.../notion/{trades,scopes,sows,pain-points}/adapter` — `pageToTrade`, `pageToScope`, `pageToSOW`, `pageToPainPoint` (signatures unchanged).
  - `.../notion/{trades,scopes,sows,pain-points}/schema` — `Trade`, `ScopeOrAddon`, `SOW`, `NotionPainPoint` **unchanged in this task**; Task 3 replaces them.

- [ ] **Step 1: Move the 19 files**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
P=src/shared/services/providers/notion
S=src/shared/modules/construction/sources/notion
mkdir -p $S/trades $S/scopes $S/sows $S/pain-points

git mv $P/constants/databases.ts        $S/databases.ts
git mv $P/dal/query-notion-database.ts  $S/query.ts
git mv $P/lib/property-filter.ts        $S/property-filter.ts
git mv $P/lib/extractors.ts             $S/extractors.ts
git mv $P/lib/normalize-notion-id.ts    $S/normalize-id.ts
git mv $P/lib/blocks-to-tiptap-json.ts  $S/blocks-to-tiptap.ts
git mv $P/lib/page-to-tiptap-json.ts    $S/page-to-tiptap.ts

for e in trades scopes sows pain-points; do
  for f in adapter properties-map schema; do
    git mv $P/lib/$e/$f.ts $S/$e/$f.ts
  done
done

git rm -r --quiet $P/dal      # NOT `$P/constants` too: it is already empty after the move, and git rm fails atomically
rmdir $P/constants
rmdir $P/lib/trades $P/lib/scopes $P/lib/sows $P/lib/pain-points 2>/dev/null
```

`git rm -r $P/dal` removes the two React-Query hook files along with the now-empty `dal/`. A provider directory holds no React hooks — `provider-boundaries.md#providers-are-leaves`. Their five call sites are inlined in Step 5.

- [ ] **Step 2: Reduce the provider's `types.ts` to the generic half**

Replace the whole file with:

```ts
import type { QueryDataSourceParameters } from '@notionhq/client'

export interface NotionPropDef {
  label: string
  type: NotionColumnType
}

export type RawPropertyMap<T extends Record<string, any>> = Omit<Record<keyof T, NotionPropDef>, 'id'>

export type NotionColumnType = 'title' | 'rich_text' | 'select' | 'multi_select' | 'date' | 'phone_number' | 'relation' | 'people' | 'timestamp' | 'checkbox'

export type PropertyFilter = NonNullable<QueryDataSourceParameters['filter']> // drop undefined
```

Five exports are deleted here. Each was verified to have zero consumers outside this file (`getDatabaseMeta`, `NotionDatabaseProperties`, `QueryNotionTradesOptions`) or only the hook being deleted in Step 1 (`QueryNotionScopesOptions`). `NotionDatabaseName` is not deleted — it moves to `databases.ts` in Step 3, because it names the four *construction* databases and is therefore module knowledge, not provider knowledge.

- [ ] **Step 3: Fix the moved files' internal imports and re-home `NotionDatabaseName`**

In `sources/notion/databases.ts`:
- add `export type NotionDatabaseName = 'painPoints' | 'trades' | 'scopes' | 'sows'` at the top;
- change `import type { NotionDatabaseName, RawPropertyMap } from '../types'` to `import type { RawPropertyMap } from '@/shared/services/providers/notion/types'`;
- change the four `from '../lib/<entity>/…'` imports to `from './<entity>/…'`;
- **delete the `properties: ZodRawShape` field** from `RawDatbaseMap` and from all four entries, and delete the four now-unused schema value imports plus `import type { ZodRawShape } from 'zod'`. Nothing has ever read `meta.properties`.

The file's `RawDatbaseMap` type and the four database UUIDs are otherwise untouched.

In `sources/notion/query.ts`:
```ts
import type { PageObjectResponse } from '@notionhq/client'
import type { NotionPropDef } from '@/shared/services/providers/notion/types'
import type { NotionDatabaseMap, NotionDatabaseName } from './databases'
import { notionClient } from '@/shared/services/providers/notion/client'
import { notionDatabasesMeta } from './databases'
import { buildPropertyFilter } from './property-filter'
```
Everything below the imports is unchanged.

In `sources/notion/property-filter.ts`, **two** imports change — it pulls in the renamed
file as well as the provider types:
```ts
import type { PropertyFilter } from '@/shared/services/providers/notion/types'
import { normalizeNotionId } from './normalize-id'
```

`sources/notion/{extractors,blocks-to-tiptap}.ts` need no import changes — `extractors.ts`
imports only from `@notionhq/client`, and `blocks-to-tiptap.ts` imports nothing.

In `sources/notion/page-to-tiptap.ts`:
```ts
import { notionClient } from '@/shared/services/providers/notion/client'
import { notionBlocksToTiptapDoc } from './blocks-to-tiptap'
```

In each of the four `sources/notion/<entity>/adapter.ts`: `from '../extractors'` and `from '../normalize-notion-id'` become `from '../extractors'` and `from '../normalize-id'` (the `../` depth is unchanged — only the filename changed).

In each of the four `sources/notion/<entity>/properties-map.ts`: the `RawPropertyMap` import path is already absolute (`@/shared/services/providers/notion/types`) and stays correct.

- [ ] **Step 4: Rewrite every external import path**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
OLD='@/shared/services/providers/notion'
NEW='@/shared/modules/construction/sources/notion'
FILES=$(grep -rl "providers/notion/\(lib\|dal\|constants\)" src/ scripts/ tests/)
echo "$FILES" | xargs sed -i \
  -e "s#$OLD/lib/trades/#$NEW/trades/#g" \
  -e "s#$OLD/lib/scopes/#$NEW/scopes/#g" \
  -e "s#$OLD/lib/sows/#$NEW/sows/#g" \
  -e "s#$OLD/lib/pain-points/#$NEW/pain-points/#g" \
  -e "s#$OLD/lib/normalize-notion-id#$NEW/normalize-id#g" \
  -e "s#$OLD/lib/page-to-tiptap-json#$NEW/page-to-tiptap#g" \
  -e "s#$OLD/lib/blocks-to-tiptap-json#$NEW/blocks-to-tiptap#g" \
  -e "s#$OLD/lib/property-filter#$NEW/property-filter#g" \
  -e "s#$OLD/lib/extractors#$NEW/extractors#g" \
  -e "s#$OLD/dal/query-notion-database#$NEW/query#g" \
  -e "s#$OLD/constants/databases#$NEW/databases#g"
```

This rewrites, among others: `src/shared/services/construction-data.service.ts` (5 imports), `src/features/meeting-flow/lib/get-cached-pain-points.ts`, `src/trpc/routers/notion.router/scopes.router.ts`, the three `scripts/verify-*.ts`, and the 29 files that import `Trade` / `ScopeOrAddon` / `SOW` / `NotionPainPoint` types.

- [ ] **Step 5: Inline the two deleted hooks at their five call sites**

`useGetAllTrades()` was one line; replace each call with the query it wrapped.

In `src/features/proposal-flow/ui/components/form/sow-field.tsx` — drop the two hook imports (lines 19-20), and replace lines 52-53:
```tsx
  const allTrades = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const scopesOfTrade = useQuery(trpc.notionRouter.scopes.getScopesByQuery.queryOptions(
    { query: tradeId, filterProperty: 'relatedTrade' },
    { enabled: !!tradeId },
  ))
```
This file already has `const trpc = useTRPC()` in scope; add `useQuery` to its existing `@tanstack/react-query` import.

In `src/features/meeting-flow/hooks/use-trade-catalog.ts` — drop the import at line 7 and replace line 13:
```ts
  const tradesQuery = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
```

In `src/shared/components/trade-scope-row.tsx` — drop the import at line 9 and replace lines 33-36:
```tsx
  const scopesQuery = useQuery(trpc.notionRouter.scopes.getScopesByQuery.queryOptions(
    { query: tradeId, filterProperty: 'relatedTrade' },
    { enabled: !!tradeId },
  ))
```
Add `import { useQuery } from '@tanstack/react-query'` and `import { useTRPC } from '@/trpc/helpers'` plus `const trpc = useTRPC()` inside the component if not already present.

In `src/shared/entities/meetings/components/meeting-scopes-picker.tsx` — drop the two imports (lines 23-24) and replace lines 36-39 and line 121 the same way, using `entry.tradeId` as the `query` in the `ScopeRow` component and `trpc.notionRouter.trades.getAll.queryOptions()` at line 121.

> These four files are touched again in Task 3 (field literal `'relatedTrade'` → `'tradeId'`) and in Task 6 (reshaped to `byTrade`). That is intentional: it keeps each commit green and single-purpose rather than bundling a move, a rename and an API reshape together.

- [ ] **Step 6: Prove the move was path-only**

```bash
# No file outside sources/notion/ may import provider internals any more.
grep -rn "providers/notion/\(lib/\|dal/\|constants/\)" src/ scripts/ tests/ ; echo "--- exit $? (1 = clean) ---"
# lib/config.ts is the one survivor, and only server-env may import it.
grep -rn "providers/notion/lib/config" src/ | grep -v "shared/config/server-env"; echo "--- exit $? (1 = clean) ---"
# The provider is now a leaf: client.ts, types.ts, lib/config.ts, DOCS.md.
find src/shared/services/providers/notion -type f | sort
# Field names must be untouched by this commit.
git diff --cached -U0 | grep -E "^[+-].*(relatedTrade|entryType|homeOrLot|relatedScopes)" | grep -v "^[+-][+-]"
```

The last command's output must show only *moved* lines (identical text appearing once as `-` and once as `+` in different files) — never a changed identifier. If any identifier changed, revert it; that belongs to Task 3.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && CI=1 pnpm lint`
Expected: both clean.

- [ ] **Step 8: Run the three existing verify scripts**

```bash
npx tsx scripts/verify-normalize-notion-id.ts
npx tsx scripts/verify-notion-adapters.ts
npx tsx scripts/verify-energy-trade-qualification.ts
```
Expected: all three pass. They are pure (no network), so they prove the adapters survived the move byte-identical in behaviour.

- [ ] **Step 9: Commit**

```bash
# Commit gate (Global Constraints): stage THIS task's files by explicit path — never a directory.
git status --porcelain | grep -vxFf $S/wip-before.txt   # the candidate list
sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null        # must print nothing
git add -- <each candidate path>   # expected: sources/notion/**, providers/notion/**, construction-data.service.ts,
                                   # the 5 inlined hook call sites, notion.router/*, the 3 verify scripts
git commit -m "$(cat <<'MSG'
refactor(construction-p1): move Notion internals into modules/construction/sources

Path-only, per service-architecture.md#entities-vs-modules. No schema,
field or behaviour change — verified by diffing for identifier changes.

providers/notion/ is now a leaf: client.ts, types.ts, lib/config.ts.
types.ts keeps only the four vendor-generic exports; NotionDatabaseName
moves to sources/notion/databases.ts because it names the four
construction databases, which is module knowledge.

Four files shed a prefix the directory already supplies
(normalize-notion-id -> normalize-id, query-notion-database -> query,
and the two tiptap files).

Dead code dropped in passing, each verified to have zero consumers:
getDatabaseMeta, NotionDatabaseProperties, QueryNotionTradesOptions, and
databases.ts's `properties: ZodRawShape` field (never read, which also
drops the zod imports from that file).

The two React Query hooks under dal/*/hooks/ are deleted and inlined at
their five call sites — a provider directory holds no React hooks
(provider-boundaries.md#providers-are-leaves).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Neutral domain schemas and the field renames

The semantic heart of P1. Four Notion-shaped schemas are replaced by four neutral ones in `core/schemas/index.ts`, the adapters are rewritten to emit the neutral shape directly, and every consumer's field access is renamed in the same commit. There is no intermediate Notion-shaped type and no second parse step.

**Files:**
- Create: `src/shared/modules/construction/core/schemas/index.ts`
- Delete: `src/shared/modules/construction/sources/notion/{trades,scopes,sows,pain-points}/schema.ts` (4 files)
- Modify: `src/shared/modules/construction/sources/notion/{trades,scopes,sows,pain-points}/{adapter,properties-map}.ts` (8 files)
- Modify: `src/shared/modules/construction/sources/notion/databases.ts`
- Modify: `src/shared/services/construction-data.service.ts`
- Modify: `src/trpc/routers/notion.router/scopes.router.ts`
- Modify: `src/features/meeting-flow/constants/trade-categories.ts` (delete `TRADE_CATEGORY_ORDER`)
- Modify: the 29 type importers + the field-access sites listed in Step 6
- Test: `scripts/verify-notion-adapters.ts`, `scripts/verify-energy-trade-qualification.ts`

**Interfaces:**
- Consumes: the `sources/notion/**` paths Task 2 produced.
- Produces — `@/shared/modules/construction/core/schemas`:
  - `tradeCategories: readonly ['Energy Efficiency', 'General Construction', 'Structural / Rough']`, `type TradeCategory`
  - `scopeKinds: readonly ['scope', 'addon']`, `type ScopeKind`
  - `tradeSchema`, `type Trade = { id, name, slug, coverImageUrl: string | null, category?: TradeCategory, scopeIds: string[] }`
  - `scopeSchema`, `type Scope = { id, name, kind: ScopeKind, unitOfPricing: string, coverImageUrl: string | null, tradeId: string, sowIds: string[] }`
  - `sowTemplateSchema`, `type SowTemplate = { id, name, scopeIds: string[] }`
  - `painPointSchema`, `type PainPoint` (same fields as today's `NotionPainPoint`)
- Produces — `@/shared/modules/construction/sources/notion/trades/properties-map`: `type TradePropertySource`

#### The rename table

| Before | After | Sites |
|---|---|---|
| `Trade.type` | `Trade.category` | 4 |
| `Trade.relatedScopes` | `Trade.scopeIds` | 2 |
| `Trade.homeOrLot` | **deleted** | written at `trades/adapter.ts:43`, read by nothing |
| `Trade.disabled` | **deleted** | always `false`; see below |
| `ScopeOrAddon` (type) | `Scope` | 29 importers |
| `ScopeOrAddon.entryType: string` | `Scope.kind: 'scope' \| 'addon'` | 3 app sites |
| `ScopeOrAddon.relatedTrade` | `Scope.tradeId` | 21 |
| `ScopeOrAddon.relatedScopesOfWork?` | `Scope.sowIds` | 1 (loses its `?`) |
| `SOW` (type) | `SowTemplate` | resolves the clash with `modules/proposals/core/types.ts:4` |
| `SOW.relatedScope` | `SowTemplate.scopeIds` | 2 |
| `NotionPainPoint` | `PainPoint` | 1 file, 10 references |

`Scope.unitOfPricing` keeps its name — it is domain vocabulary, not a Notion-ism.

**Why `Trade.disabled` goes.** P0 made `pageToTrade` return `null` for a disabled row (`trades/adapter.ts:32`) and then set `disabled: false` unconditionally at `:46`. The field is therefore `false` on every trade the catalog can produce, so `use-trade-catalog.ts:16`'s `.filter(trade => !trade.disabled)` can never remove anything. The domain type drops the field and the dead filter goes with it. The Notion source still reads the checkbox — that is an extraction-time gate, not a domain property, which is why `TRADE_PROPERTIES_MAP` needs `TradePropertySource`.

- [ ] **Step 1: Write the neutral schemas**

Create `src/shared/modules/construction/core/schemas/index.ts`:

```ts
import { z } from 'zod'

import { painPointCategories, painPointEmotionalDrivers, painPointSeverities, painPointUrgencies } from '@/shared/constants/enums/pain-points'

/**
 * Neutral construction-catalog schemas. Nothing here names a vendor: these are
 * the shapes the app reasons about, whoever supplies the rows.
 * see ../../DOCS.md#neutral-schemas
 */

/** Live Notion `Type` select values, verbatim. Reconciling these with `constants/enums.ts`'s `constructionTypes` is P2 — see ../../DOCS.md#category-taxonomy */
export const tradeCategories = [
  'Energy Efficiency',
  'General Construction',
  'Structural / Rough',
] as const
export type TradeCategory = (typeof tradeCategories)[number]

export const scopeKinds = ['scope', 'addon'] as const
export type ScopeKind = (typeof scopeKinds)[number]

export const tradeSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  coverImageUrl: z.string().nullable().default(null),
  category: z.enum(tradeCategories).optional(),
  scopeIds: z.array(z.string()).default([]),
})
export type Trade = z.infer<typeof tradeSchema>

export const scopeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(scopeKinds).default('scope'),
  unitOfPricing: z.string().default('unit'),
  coverImageUrl: z.string().nullable().default(null),
  tradeId: z.string(),
  sowIds: z.array(z.string()).default([]),
})
export type Scope = z.infer<typeof scopeSchema>

/** A reusable statement-of-work template attached to scopes. Named `SowTemplate`, not `SOW`, because `modules/proposals/core/types.ts` already owns `SOW` — a proposal's own written scope. */
export const sowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  scopeIds: z.array(z.string()).default([]),
})
export type SowTemplate = z.infer<typeof sowTemplateSchema>

export const painPointSchema = z.object({
  id: z.string(),
  name: z.string(),
  accessor: z.string(),
  category: z.enum(painPointCategories).optional(),
  severity: z.enum(painPointSeverities).optional(),
  urgency: z.enum(painPointUrgencies).optional(),
  emotionalDrivers: z.array(z.enum(painPointEmotionalDrivers)).default([]),
  trades: z.array(z.string()).default([]),
  householdResonance: z.array(z.string()).default([]),
  programFit: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
})
export type PainPoint = z.infer<typeof painPointSchema>
```

- [ ] **Step 2: Rewrite the four property maps**

`RawPropertyMap<T>` is `Omit<Record<keyof T, NotionPropDef>, 'id'>` — it is keyed by the **domain** field name, so each map's keys rename with the schema. Only the `.label` values keep Notion's column titles.

`sources/notion/trades/properties-map.ts`:
```ts
import type { Trade } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'

/** `disabled` is an extraction-time gate, not a domain field — see ./adapter.ts. */
export type TradePropertySource = Omit<Trade, 'slug' | 'coverImageUrl'> & { disabled: boolean }

export const TRADE_PROPERTIES_MAP = {
  name: { label: 'Trade', type: 'title' },
  category: { label: 'Type', type: 'select' },
  scopeIds: { label: 'Scopes', type: 'relation' },
  disabled: { label: 'Disabled', type: 'checkbox' },
} as const satisfies RawPropertyMap<TradePropertySource>
```
`homeOrLot` is gone from the map as well as from the type — nothing reads it.

`sources/notion/scopes/properties-map.ts`:
```ts
import type { Scope } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'

export const SCOPE_PROPERTIES_MAP = {
  name: { label: 'Scope or Addon', type: 'title' },
  kind: { label: 'Entry Type', type: 'select' },
  unitOfPricing: { label: 'Unit of Pricing', type: 'select' },
  tradeId: { label: 'Trade', type: 'relation' },
  sowIds: { label: 'Scopes of Work', type: 'relation' },
} as const satisfies RawPropertyMap<Omit<Scope, 'coverImageUrl'>>
```

`sources/notion/sows/properties-map.ts`:
```ts
import type { SowTemplate } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'

export const SOW_TEMPLATE_PROPERTIES_MAP = {
  name: { label: 'SOW', type: 'title' },
  scopeIds: { label: 'Scope', type: 'relation' },
} as const satisfies RawPropertyMap<SowTemplate>
```

`sources/notion/pain-points/properties-map.ts`: keys are already neutral. Change only the two type imports — `PainPoint` from `core/schemas`, `RawPropertyMap` unchanged — and the `satisfies RawPropertyMap<Omit<PainPoint, 'id'>>` clause. `PAIN_POINT_PROPERTIES_MAP` keeps its name and contents.

- [ ] **Step 3: Rewrite the four adapters**

`sources/notion/trades/adapter.ts` — replace the import block and the `raw` object; `extractCoverImageUrl` and the try/catch are unchanged:
```ts
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Trade } from '@/shared/modules/construction/core/schemas'
import { tradeSchema } from '@/shared/modules/construction/core/schemas'
import { slugifyTradeName } from '@/shared/lib/slugify-trade-name'
import { checkbox, relationIds, selectName, titleText } from '../extractors'
import { normalizeNotionId } from '../normalize-id'
import { TRADE_PROPERTIES_MAP } from './properties-map'
```
```ts
    const raw: Partial<Trade> = {
      id: normalizeNotionId(page.id),
      name,
      slug: slugifyTradeName(name),
      coverImageUrl: extractCoverImageUrl(page),
      category: selectName(p, TRADE_PROPERTIES_MAP.category.label) ?? undefined,
      scopeIds: relationIds(p, TRADE_PROPERTIES_MAP.scopeIds.label).map(normalizeNotionId),
    }
```
The `homeOrLot` line and the `disabled: false` line are both deleted. The `checkbox(...)` early return at `:32` stays exactly as it is.

`sources/notion/scopes/adapter.ts` — `pageToScope(page): Scope | null`, with the kind mapping:
```ts
    const rawKind = selectName<'Scope' | 'Addon'>(p, SCOPE_PROPERTIES_MAP.kind.label)

    const raw: Partial<Scope> = {
      id: normalizeNotionId(page.id),
      name: titleText(p, SCOPE_PROPERTIES_MAP.name.label),
      kind: rawKind === 'Addon' ? 'addon' : 'scope',
      unitOfPricing: selectName<'sqft' | 'linear ft' | 'space' | 'unit'>(p, SCOPE_PROPERTIES_MAP.unitOfPricing.label) ?? undefined,
      coverImageUrl: extractCoverImageUrl(page),
      tradeId: relationIds(p, SCOPE_PROPERTIES_MAP.tradeId.label).map(normalizeNotionId)[0],
      sowIds: relationIds(p, SCOPE_PROPERTIES_MAP.sowIds.label).map(normalizeNotionId),
    }
```
`rawKind === 'Addon' ? 'addon' : 'scope'` is the whole classifier: an absent or unrecognised select lands on `'scope'`, matching today's `.default('Scope')` behaviour.

`sources/notion/sows/adapter.ts` — rename the function to `pageToSowTemplate`, returning `SowTemplate | null`, with `scopeIds: relationIds(p, SOW_TEMPLATE_PROPERTIES_MAP.scopeIds.label).map(normalizeNotionId)`. Update the two `console.warn` prefixes to `[pageToSowTemplate]`.

`sources/notion/pain-points/adapter.ts` — change the type import to `PainPoint` and the schema import to `painPointSchema` from `core/schemas`; the body is otherwise unchanged.

- [ ] **Step 4: Delete the four old schema files and fix `databases.ts`**

```bash
git rm src/shared/modules/construction/sources/notion/{trades,scopes,sows,pain-points}/schema.ts
```

In `sources/notion/databases.ts`, the `RawDatbaseMap` union now reads from `core/schemas` and uses the new map name:
```ts
import type { PainPoint, Scope, SowTemplate } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'
import type { TradePropertySource } from './trades/properties-map'
import { PAIN_POINT_PROPERTIES_MAP } from './pain-points/properties-map'
import { SCOPE_PROPERTIES_MAP } from './scopes/properties-map'
import { SOW_TEMPLATE_PROPERTIES_MAP } from './sows/properties-map'
import { TRADE_PROPERTIES_MAP } from './trades/properties-map'

export type NotionDatabaseName = 'painPoints' | 'trades' | 'scopes' | 'sows'

type RawDatbaseMap = {
  [K in NotionDatabaseName]: {
    id: string
    name: K
    propertiesMap:
      | RawPropertyMap<Omit<PainPoint, 'id'>>
      | RawPropertyMap<TradePropertySource>
      | RawPropertyMap<Omit<Scope, 'coverImageUrl'>>
      | RawPropertyMap<SowTemplate>
  }
}
```
The four entries keep their UUIDs; `scopes` and `sows` point at `SCOPE_PROPERTIES_MAP` and `SOW_TEMPLATE_PROPERTIES_MAP`.

- [ ] **Step 5: Update the service and the router's property literals**

`src/shared/services/construction-data.service.ts` — types become `Trade`/`Scope`/`SowTemplate` from `core/schemas`, `pageToSOW` becomes `pageToSowTemplate`, and the SOW filter literal at `:60` changes:
```ts
      const raw = await queryNotionDatabase('sows', {
        filterProperty: 'scopeIds',
        query: params.scopeId,
      })
```
Its return type becomes `Promise<SowTemplate[]>` and the warn prefix stays as-is. This file is deleted in Task 5; it must simply compile here.

`src/trpc/routers/notion.router/scopes.router.ts` — `scopeOrAddonSchema` becomes `scopeSchema` from `core/schemas`. The two `getTypedKeys(...)` `z.enum`s now enumerate the neutral keys, so `'relatedTrade'` is no longer a valid input; Task 6 removes them entirely.

- [ ] **Step 6: Rename every field access**

Run the mechanical renames, then hand-check the four that are not pure identifier swaps.

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
# Type names and the unambiguous field names.
grep -rl "ScopeOrAddon\|scopeOrAddonSchema\|relatedTrade\|relatedScopesOfWork\|relatedScopesOfWork\|NotionPainPoint\|notionPainPointSchema" src/ scripts/ tests/ \
  | xargs sed -i \
    -e 's/\bScopeOrAddon\b/Scope/g' \
    -e 's/\bscopeOrAddonSchema\b/scopeSchema/g' \
    -e 's/\brelatedTrade\b/tradeId/g' \
    -e 's/\brelatedScopesOfWork\b/sowIds/g' \
    -e 's/\bNotionPainPoint\b/PainPoint/g' \
    -e 's/\bnotionPainPointSchema\b/painPointSchema/g'
# Trade.relatedScopes -> Trade.scopeIds (distinct from the scope's own sowIds).
grep -rl "relatedScopes\b" src/ scripts/ tests/ | xargs sed -i 's/\brelatedScopes\b/scopeIds/g'
```

Then repoint every `core/schemas` type import. All 29 files currently import from `sources/notion/{trades,scopes,sows,pain-points}/schema`; those files no longer exist:

```bash
grep -rl "sources/notion/\(trades\|scopes\|sows\|pain-points\)/schema" src/ scripts/ tests/ \
  | xargs sed -i -E "s#@/shared/modules/construction/sources/notion/(trades\|scopes\|sows\|pain-points)/schema#@/shared/modules/construction/core/schemas#g"
```

Several files will now import twice from `core/schemas`; merge each pair into one `import type { Scope, Trade } from '@/shared/modules/construction/core/schemas'`. `pnpm lint` flags the duplicates, so let it find them.

**The four hand-edits `sed` cannot do:**

1. `src/features/landing/ui/components/services/scopes-grid.tsx:24-25` — the classifier:
```tsx
  const primaryScopes = scopes.filter(s => s.kind === 'scope')
  const addons = scopes.filter(s => s.kind === 'addon')
```

2. `src/features/meeting-flow/lib/group-scopes-by-trade.ts:8` — same classifier:
```ts
    if (item.kind === 'addon') {
```
(This file is deleted in Task 7; it must compile here.)

3. `src/shared/components/dialogs/modals/templates-modal.tsx:41` — `sowIds` is no longer optional, so the `?.` goes:
```tsx
              {SOWs[scopeI].data?.filter(sow => scope.sowIds.includes(sow.id)).map(sow => (
```

4. `src/features/landing/lib/notion-trade-helpers.ts:40` — `Trade.type` → `Trade.category`:
```ts
  const pillarTrades = allTrades.filter(t => t.category && allowedTypes.includes(t.category))
```
Also rename `PILLAR_TYPE_MAP` to `PILLAR_CATEGORY_MAP` at `:15` and `:39`, and type it `Record<PillarSlug, TradeCategory[]>` importing `TradeCategory` from `core/schemas` — the string literals it holds are now a real enum.

And three more `Trade.type` reads, each a one-word change:
- `src/features/meeting-flow/constants/energy-trades.ts:15` → `trade.category === 'Energy Efficiency'`
- `src/features/meeting-flow/lib/group-trades-for-switcher.ts:18` → `trade.category === category`
- `src/features/meeting-flow/ui/components/steps/specialties/showcase-text.tsx:29` → see Step 7

- [ ] **Step 7: Delete the duplicated category const**

`src/features/meeting-flow/constants/trade-categories.ts:1-5`'s `TRADE_CATEGORY_ORDER` is a verbatim copy of the Notion `Trade.type` enum. The module now owns that list. Delete the copy — do not keep both. The file keeps only what is genuinely feature presentation:

```ts
import type { TradeCategory } from '@/shared/modules/construction/core/schemas'

/** Display copy for the specialties trade switcher. The category list itself lives in the module — `tradeCategories` in `modules/construction/core/schemas`. */
export const TRADE_CATEGORY_LABELS: Record<TradeCategory, string> = {
  'Energy Efficiency': 'Energy Efficiency',
  'General Construction': 'General Construction',
  'Structural / Rough': 'Structural & Rough',
}
```

Its two consumers repoint:

`src/features/meeting-flow/lib/group-trades-for-switcher.ts` — lines 1 and 6:
```ts
import type { TradeCategory } from '@/shared/modules/construction/core/schemas'
import { tradeCategories } from '@/shared/modules/construction/core/schemas'
import { TRADE_CATEGORY_LABELS } from '@/features/meeting-flow/constants/trade-categories'
```
and line 15 iterates `tradeCategories.map(...)`. `TRADE_CATEGORY_LABELS[category as TradeCategory]` loses its cast — `category` is already a `TradeCategory`:
```ts
    ...tradeCategories.map(category => ({
      key: category,
      label: TRADE_CATEGORY_LABELS[category],
      trades: rest.filter(trade => trade.category === category),
    })),
```

`src/features/meeting-flow/ui/components/steps/specialties/showcase-text.tsx:3,29` — the `TradeCategory` type import moves to `core/schemas`, and the cast goes because `Trade.category` is now typed:
```tsx
  const category = trade.category ? TRADE_CATEGORY_LABELS[trade.category] : undefined
```
The `TradeCategory` type import at `:3` is then unused — delete it.

- [ ] **Step 8: Delete the dead `disabled` filter**

`src/features/meeting-flow/hooks/use-trade-catalog.ts:16` — the field no longer exists:
```ts
  const trades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data])
```
(The whole file is deleted in Task 7; it must compile here.)

- [ ] **Step 9: Update the two verify scripts that construct fixtures**

`scripts/verify-energy-trade-qualification.ts:8-10` — the fixture drops two fields and renames one:
```ts
function trade(id: string, name: string, category: Trade['category']): Trade {
  return { id, name, slug: name.toLowerCase(), coverImageUrl: null, category, scopeIds: [] }
}
```
`scripts/verify-notion-adapters.ts` — `SCOPE_OR_ADDON_PROPERTIES_MAP` becomes `SCOPE_PROPERTIES_MAP`, `SOW_PROPERTIES_MAP` becomes `SOW_TEMPLATE_PROPERTIES_MAP`, `pageToSOW` becomes `pageToSowTemplate`, and the map-key references become `.kind.label`, `.tradeId.label`, `.sowIds.label`, `.scopeIds.label`. Its existing assertions about the returned object's fields must be updated to the neutral names; add one asserting the classifier:
```ts
assert.equal(pageToScope(addonPage as PageObjectResponse)?.kind, 'addon', "Entry Type 'Addon' maps to kind 'addon'")
```
building `addonPage` from the existing scope fixture with `select('Addon')`.

- [ ] **Step 10: Grep-gate the Notion property names**

```bash
grep -rn "\brelatedTrade\b\|\bentryType\b\|\bhomeOrLot\b\|\brelatedScopesOfWork\b\|\brelatedScopes\b\|\brelatedScope\b\|\bScopeOrAddon\b\|\bNotionPainPoint\b" src/ ; echo "--- exit $? (1 = clean) ---"
```
Expected: **zero hits in `src/`**. `scripts/portfolio-scraper/` still has its own local `entryType` shape — Task 8 owns that, so exclude `scripts/` from this gate until then.

- [ ] **Step 11: Type-check, lint, and run the pure verify scripts**

```bash
pnpm tsc && CI=1 pnpm lint
npx tsx scripts/verify-normalize-notion-id.ts
npx tsx scripts/verify-notion-adapters.ts
npx tsx scripts/verify-energy-trade-qualification.ts
```
Expected: all clean and all three scripts pass.

- [ ] **Step 12: Commit**

```bash
# Commit gate (Global Constraints): stage THIS task's files by explicit path — never a directory.
git status --porcelain | grep -vxFf $S/wip-before.txt   # the candidate list
sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null        # must print nothing
git add -- <each candidate path>   # expected: core/schemas, sources/notion/**, the rename-table call sites,
                                   # trade-categories.ts, the 2 verify scripts
git commit -m "$(cat <<'MSG'
refactor(construction-p1): neutral catalog schemas, no Notion names above the seam

Four Notion-shaped schemas become four neutral ones in
modules/construction/core/schemas. The adapters build the neutral shape
directly — no intermediate type, no second parse.

  Trade.type            -> category (now a real enum)
  Trade.relatedScopes   -> scopeIds
  ScopeOrAddon          -> Scope
  .entryType: string    -> .kind: 'scope' | 'addon'
  .relatedTrade         -> .tradeId            (21 sites)
  .relatedScopesOfWork? -> .sowIds             (loses the ?)
  SOW                   -> SowTemplate         (SOW is taken by modules/proposals)
  SOW.relatedScope      -> SowTemplate.scopeIds
  NotionPainPoint       -> PainPoint

Two fields are deleted rather than renamed. homeOrLot was written and
never read. disabled has been false on every producible trade since P0
gated it at extraction time, so use-trade-catalog's !trade.disabled
filter could never remove anything — the field and the filter both go.
TRADE_PROPERTIES_MAP keeps the checkbox via TradePropertySource, because
it is an extraction-time gate, not a domain property. (B18)

trade-categories.ts's TRADE_CATEGORY_ORDER was a verbatim copy of the
Notion enum; the module owns the list now and the copy is deleted, not
kept alongside. That also removes two `as TradeCategory` casts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: The `ConstructionCatalogSource` seam

Mirrors `src/shared/services/voip/dialer/{types,index}.ts` — the one seam in this codebase with a proven binding swap behind it. Read both files before writing these.

**Files:**
- Create: `src/shared/modules/construction/sources/types.ts`
- Create: `src/shared/modules/construction/sources/index.ts`
- Create: `src/shared/modules/construction/sources/notion/index.ts`

**Interfaces:**
- Consumes: `pageToTrade`, `pageToScope`, `pageToSowTemplate`, `pageToPainPoint`, `queryNotionDatabase`, `pageToTiptapJson` from Task 2/3.
- Produces:
  - `@/shared/modules/construction/sources` → `catalogSource: ConstructionCatalogSource`, plus `export * from './types'`.
  - `@/shared/modules/construction/sources/notion` → `notionCatalogSource: ConstructionCatalogSource`.

- [ ] **Step 1: Write the neutral contract**

`src/shared/modules/construction/sources/types.ts`:

```ts
import type { PainPoint, Scope, SowTemplate, Trade } from '@/shared/modules/construction/core/schemas'

/**
 * Neutral construction-catalog contract. Shaped around the reads the app
 * performs, not any vendor's endpoints. Notion (or, at P5, Postgres)
 * implements this; everything above depends ONLY on this interface via the
 * `../sources` barrel binding, never on `sources/notion/*` directly.
 *
 * There is deliberately no `getCatalog()` here — composition and caching
 * belong to `modules/construction/service.ts`, so a future binding is a
 * method-for-method implementation rather than a re-derivation.
 *
 * see ../DOCS.md#the-seam
 */
export interface ConstructionCatalogSource {
  getTrades: () => Promise<Trade[]>
  getScopes: () => Promise<Scope[]>
  getSowTemplatesByScope: (scopeId: string) => Promise<SowTemplate[]>
  getSowContent: (sowId: string) => Promise<string>
  getPainPoints: () => Promise<PainPoint[]>
}
```

- [ ] **Step 2: Write the Notion implementation**

`src/shared/modules/construction/sources/notion/index.ts`. The five bodies are lifted from `construction-data.service.ts` (which Task 5 deletes) plus `get-cached-pain-points.ts`, keeping P0's drop-count warning on every list read:

```ts
import type { ConstructionCatalogSource } from '../types'
import { pageToPainPoint } from './pain-points/adapter'
import { pageToTiptapJson } from './page-to-tiptap'
import { queryNotionDatabase } from './query'
import { pageToScope } from './scopes/adapter'
import { pageToSowTemplate } from './sows/adapter'
import { pageToTrade } from './trades/adapter'

/**
 * The Notion-backed catalog source. The only file that assembles the Notion
 * implementation; nothing outside `sources/` imports `sources/notion/*`.
 *
 * Every list read drops invalid rows rather than throwing, and warns with a
 * count — see ./DOCS.md#adapter-returns-entity-or-null (P0).
 */
function readAll<T>(
  label: string,
  raw: PageObjectResponse[] | undefined,
  adapt: (page: PageObjectResponse) => T | null,
): T[] {
  if (!raw) {
    return []
  }
  const rows = raw.flatMap(page => adapt(page) ?? [])
  if (rows.length < raw.length) {
    console.warn(`[notionCatalogSource.${label}] dropped ${raw.length - rows.length} of ${raw.length} rows`)
  }
  return rows
}

export const notionCatalogSource: ConstructionCatalogSource = {
  getTrades: async () => readAll(
    'getTrades',
    await queryNotionDatabase('trades', { sortBy: { property: 'name', direction: 'ascending' } }),
    pageToTrade,
  ),

  getScopes: async () => readAll('getScopes', await queryNotionDatabase('scopes'), pageToScope),

  getSowTemplatesByScope: async scopeId => readAll(
    'getSowTemplatesByScope',
    await queryNotionDatabase('sows', { filterProperty: 'scopeIds', query: scopeId }),
    pageToSowTemplate,
  ),

  getSowContent: async sowId => pageToTiptapJson(sowId),

  getPainPoints: async () => readAll('getPainPoints', await queryNotionDatabase('painPoints'), pageToPainPoint),
}
```

Add `import type { PageObjectResponse } from '@notionhq/client'` at the top. `readAll` replaces five near-identical `flatMap` + drop-count blocks — that consolidation is the point of having one file assemble the source.

- [ ] **Step 3: Write the single binding**

`src/shared/modules/construction/sources/index.ts`:

```ts
import type { ConstructionCatalogSource } from './types'

import { notionCatalogSource } from './notion'

// The SINGLE seam binding — the one place the app names its live catalog
// source. Consumers import `catalogSource` from here (never `./notion/*`).
// Swapping to Postgres at P5 = one line, plus deleting `./notion/`.
// see ../DOCS.md#the-seam
export const catalogSource: ConstructionCatalogSource = notionCatalogSource

export * from './types'
```

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && CI=1 pnpm lint`
Expected: clean. Nothing consumes the seam yet — Task 5 does. The old service still runs every read, so behaviour is unchanged.

- [ ] **Step 5: Commit**

```bash
# Commit gate (Global Constraints): stage THIS task's files by explicit path — never a directory.
git status --porcelain | grep -vxFf $S/wip-before.txt   # the candidate list
sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null        # must print nothing
git add src/shared/modules/construction/sources/types.ts \
        src/shared/modules/construction/sources/index.ts \
        src/shared/modules/construction/sources/notion/index.ts
git commit -m "$(cat <<'MSG'
feat(construction-p1): add the ConstructionCatalogSource seam

One neutral interface, one binding, mirroring services/voip/dialer.
No getCatalog() on the source: composition and caching belong to the
service, so the P5 Postgres binding stays method-for-method.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: The cached module service

> **Foreign file, decided 2026-09-22 (user):** `scripts/tmp-trade-photo-density.ts` is another session's untracked probe that imports `constructionDataService`, which this task deletes. Update it **in place** (`constructionService.getTrades()` or equivalent) so `tsc` stays green, and **never stage it**. Task 3 already renamed its `trade.relatedScopes` → `trade.scopeIds` the same way.

One cache tag covers every catalog read, so the existing refresh button keeps its single-click behaviour. This is also the fix for **P0 escalation #1**: `scopes.getAll` is a public `baseProcedure` with no server cache, called by `portfolio-block.tsx:17` and `funnel-project-carousel.tsx:37` on paid-traffic funnel pages, so today every visitor triggers a live Notion request — two serial ones since P0 added pagination.

**Files:**
- Create: `src/shared/modules/construction/service.ts`
- Delete: `src/shared/services/construction-data.service.ts`
- Delete: `src/features/meeting-flow/lib/get-cached-pain-points.ts`
- Modify: `src/features/landing/lib/notion-trade-helpers.ts` (drop both `unstable_cache` blocks)
- Modify: `src/trpc/routers/notion.router/{trades,scopes}.router.ts`
- Modify: `src/trpc/routers/meeting-flow.router.ts:10,66`
- Modify: `src/features/proposal-flow/ui/components/form/sow-field.tsx`, `src/shared/components/trade-scope-row.tsx`, `src/shared/entities/meetings/components/meeting-scopes-picker.tsx` (the `byTrade` reshape)

**Interfaces:**
- Consumes: `catalogSource` from Task 4.
- Produces — `@/shared/modules/construction/service`:
  - `CONSTRUCTION_CATALOG_TAG: 'construction-catalog'`
  - `constructionService.getCatalog(): Promise<{ trades: Trade[], scopes: Scope[] }>`
  - `constructionService.getPainPoints(): Promise<PainPoint[]>`
  - `constructionService.getSowTemplatesByScope(scopeId: string): Promise<SowTemplate[]>`
  - `constructionService.getSowContent(sowId: string): Promise<string>`

- [ ] **Step 1: Write the service**

`src/shared/modules/construction/service.ts`:

```ts
import { unstable_cache } from 'next/cache'

import { catalogSource } from './sources'

/**
 * Cached construction-catalog reads. One tag covers all four, so the refresh
 * button's single `revalidateTag` still clears everything.
 *
 * Scripts must NOT import this — `unstable_cache` needs a Next request
 * context. They import `catalogSource` from `./sources` directly.
 * see ./DOCS.md#one-cache-tag
 */
export const CONSTRUCTION_CATALOG_TAG = 'construction-catalog'

const REVALIDATE_SECONDS = 600

const getCatalog = unstable_cache(
  async () => {
    const [trades, scopes] = await Promise.all([
      catalogSource.getTrades(),
      catalogSource.getScopes(),
    ])
    return { trades, scopes }
  },
  ['construction-catalog'],
  { tags: [CONSTRUCTION_CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

/** Kept out of `getCatalog` so a landing render never fetches them — only meeting-flow reads pain points. */
const getPainPoints = unstable_cache(
  async () => catalogSource.getPainPoints(),
  ['construction-pain-points'],
  { tags: [CONSTRUCTION_CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

const getSowTemplatesByScope = unstable_cache(
  async (scopeId: string) => catalogSource.getSowTemplatesByScope(scopeId),
  ['construction-sow-templates'],
  { tags: [CONSTRUCTION_CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

const getSowContent = unstable_cache(
  async (sowId: string) => catalogSource.getSowContent(sowId),
  ['construction-sow-content'],
  { tags: [CONSTRUCTION_CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

export const constructionService = {
  getCatalog,
  getPainPoints,
  getSowTemplatesByScope,
  getSowContent,
}
```

`unstable_cache` keys on the cache-key array **plus the arguments**, so the two parameterised reads are cached per id without any manual key building.

- [ ] **Step 2: Repoint the two routers onto the service**

`src/trpc/routers/notion.router/trades.router.ts`:
```ts
import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const tradesRouter = createTRPCRouter({
  getAll: baseProcedure.query(async () => (await constructionService.getCatalog()).trades),
})
```

`src/trpc/routers/notion.router/scopes.router.ts` — rewrite the whole file:

```ts
import { z } from 'zod'
import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const scopesRouter = createTRPCRouter({
  getAll: baseProcedure.query(async () => (await constructionService.getCatalog()).scopes),

  /**
   * One trade's scopes. Replaces getScopesByQuery, whose `filterProperty`
   * input was a literal Notion property key. The per-trade query pattern
   * survives to P3 (F7); the Notion leak does not.
   */
  byTrade: baseProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ input }) => {
      const { scopes } = await constructionService.getCatalog()
      return scopes.filter(scope => scope.tradeId === input.tradeId)
    }),

  getAllSOW: baseProcedure
    .input(z.object({ scopeId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionService.getSowTemplatesByScope(input.scopeId)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }
    }),

  getSOWContent: baseProcedure
    .input(z.object({ sowId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionService.getSowContent(input.sowId)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }
    }),
})
```
(keep the `TRPCError` import). `getAllSOW` / `getSOWContent` keep their names for one more commit — Task 6 moves them onto a `sow` sub-router.

`getScopesByQuery` is reshaped **here**, not in Task 6, so that no router ever imports `sources/` directly: the service exposes no filtered read, and reaching past it to `catalogSource` or `queryNotionDatabase` would breach the seam for a commit. Filtering the cached catalog in memory replaces a filtered Notion round-trip per trade — all three callers already hold a `tradeId` and none ever passed `sortBy`.

Deleting `getScopesByQuery` also deletes its `sortBy` `z.enum`, which admitted relation properties Notion cannot sort on — **P0 escalation #4 closes here.**

Its three callers change shape (Task 2 inlined them; the path is still `notionRouter` until Task 6):

```tsx
// sow-field.tsx  ·  trade-scope-row.tsx
  useQuery(trpc.notionRouter.scopes.byTrade.queryOptions(
    { tradeId },
    { enabled: !!tradeId },
  ))

// meeting-scopes-picker.tsx (inside ScopeRow)
  useQuery(trpc.notionRouter.scopes.byTrade.queryOptions(
    { tradeId: entry.tradeId },
    { enabled: !!entry.tradeId },
  ))
```

- [ ] **Step 3: Repoint the pain-points read and delete the feature-owned cache**

`src/trpc/routers/meeting-flow.router.ts` — replace the line-10 import with `import { constructionService } from '@/shared/modules/construction/service'` and line 66 with:
```ts
      const painPointsDb = await constructionService.getPainPoints()
```

```bash
git rm src/features/meeting-flow/lib/get-cached-pain-points.ts
```

A tRPC router importing a feature `lib/` inverted the dependency direction; it now reads from the module instead.

- [ ] **Step 4: Drop landing's two `unstable_cache` blocks**

In `src/features/landing/lib/notion-trade-helpers.ts`, delete `getCachedTrades` and `getCachedScopes` (lines 20-34), delete the `unstable_cache` and `constructionDataService` imports, and change line 37:
```ts
  const { trades: allTrades, scopes: allScopes } = await constructionService.getCatalog()
```
adding `import { constructionService } from '@/shared/modules/construction/service'`.

The 180s TTL becomes the uniform 600s. Catalog edits are manual and followed by the refresh button, so a longer TTL costs nothing and removes a second number to reason about.

- [ ] **Step 5: Delete the old service**

```bash
git rm src/shared/services/construction-data.service.ts
grep -rn "construction-data.service\|constructionDataService" src/ scripts/ tests/ ; echo "--- exit $? (1 = clean) ---"
```
Expected: zero hits.

- [ ] **Step 6: Verify the old cache tags are gone**

```bash
grep -rn "notion-trades\|notion-scopes\|notion-pain-points" src/ ; echo "--- exit $? (1 = clean) ---"
```
Expected: one remaining hit — `notion.router/index.ts`'s `revalidateNotionCache`, which Task 6 rewrites. Nothing else.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && CI=1 pnpm lint`
Expected: clean.

- [ ] **Step 8: Prove the cache is live**

> **Executed 2026-09-22** in a throwaway `git worktree` on :3005 (the user's own `pnpm dev` held :3000 from a VS Code terminal — do not kill it), with a temporary `[P1-PROOF]` log in `queryAllPages`: cold `scopes.getAll` = 3 Notion requests; warm `scopes.getAll`/`trades.getAll`/`byTrade` = 0 (≈30ms); `revalidateNotionCache` (agent session via `/api/dev/playwright-session`) → next read = 3; repeat = 0; `/services/luxury-renovations` served from the same entry = 0.

Start the dev server (`pnpm dev`), open a landing pillar page, and confirm in the server log that a second reload within 600s issues **no** new Notion request. Then click the refresh button and confirm the next load does.

> If port 3000 is held by another session, set `PORT=3001` in `.env.local` first — see `CLAUDE.md`. Do not skip this step; it is the only proof that P0 escalation #1 actually closes.

- [ ] **Step 9: Commit**

```bash
# Commit gate (Global Constraints): stage THIS task's files by explicit path — never a directory.
git status --porcelain | grep -vxFf $S/wip-before.txt   # the candidate list
sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null        # must print nothing
git add src/shared/modules/construction/service.ts \
        src/shared/services/construction-data.service.ts \
        src/features/meeting-flow/lib/get-cached-pain-points.ts \
        src/features/landing/lib/notion-trade-helpers.ts \
        src/trpc/routers/notion.router/<each changed file> \
        src/trpc/routers/meeting-flow.router.ts
git commit -m "$(cat <<'MSG'
feat(construction-p1): one cached catalog service on one revalidation tag

Four cached reads behind modules/construction/service.ts, all tagged
construction-catalog so the refresh button's single revalidateTag still
clears everything. Replaces construction-data.service.ts and both
existing unstable_cache sites (landing's 180s pair and meeting-flow's
pain-point cache).

Closes P0 escalation #1: scopes.getAll and trades.getAll were public
baseProcedures with no server cache, called by portfolio-block.tsx:17
and funnel-project-carousel.tsx:37 on paid-traffic funnel pages, so
every visitor triggered a live Notion request. They read the cache now.

Closes P0 escalation #4: getScopesByQuery is reshaped to
scopes.byTrade({ tradeId }) here rather than in the router rename, so no
router ever reaches past the service into sources/. That deletes the
sortBy z.enum, which admitted relation properties Notion cannot sort on.
byTrade filters the cached catalog in memory instead of issuing a
filtered Notion round-trip per trade. The per-trade query pattern
survives to P3 as F7 requires; the Notion property-key leak does not.

meeting-flow.router.ts no longer imports a feature lib/ for its pain
points — that inverted the dependency direction.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: `constructionRouter` replaces `notionRouter`

Vendor names leave the API surface (A4). A pure namespace rename plus one regrouping: the two SOW procedures move off `scopes` onto their own `sow` sub-router. `scopes.byTrade` already exists — Task 5 reshaped it, so nothing here changes an input or a return type.

**Files:**
- Create: `src/trpc/routers/construction.router/{index,trades,scopes,sow,pain-points}.router.ts`
- Delete: `src/trpc/routers/notion.router/` (3 files)
- Modify: `src/trpc/routers/app.ts:16,37`
- Rename: `src/features/landing/ui/components/services/notion-refresh-button.tsx` → `catalog-refresh-button.tsx`
- Modify: the ~10 `trpc.notionRouter.*` call sites (all pure path changes — Step 5)

**Interfaces:**
- Consumes: `constructionService` from Task 5, `catalogSource` is no longer referenced by any router.
- Produces:

| Procedure | Input | Output |
|---|---|---|
| `constructionRouter.trades.getAll` | — | `Trade[]` |
| `constructionRouter.scopes.getAll` | — | `Scope[]` |
| `constructionRouter.scopes.byTrade` | `{ tradeId: string }` | `Scope[]` |
| `constructionRouter.sow.byScope` | `{ scopeId: string }` | `SowTemplate[]` |
| `constructionRouter.sow.content` | `{ sowId: string }` | `string` |
| `constructionRouter.painPoints.getAll` | — | `PainPoint[]` |
| `constructionRouter.revalidateCatalog` | — | `{ success: true, revalidatedAt: string }` |

- [ ] **Step 1: Write the four sub-routers**

`src/trpc/routers/construction.router/trades.router.ts`:
```ts
import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const tradesRouter = createTRPCRouter({
  getAll: baseProcedure.query(async () => (await constructionService.getCatalog()).trades),
})
```

`src/trpc/routers/construction.router/scopes.router.ts` — Task 5 already wrote `getAll` and `byTrade`. Carry both over verbatim and move `getAllSOW` / `getSOWContent` out to `sow.router.ts`, so this file is just:
```ts
import { z } from 'zod'
import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const scopesRouter = createTRPCRouter({
  getAll: baseProcedure.query(async () => (await constructionService.getCatalog()).scopes),

  /**
   * One trade's scopes. Replaced getScopesByQuery, whose `filterProperty`
   * input was a literal Notion property key. The per-trade query pattern
   * survives to P3 (F7); the Notion leak does not.
   */
  byTrade: baseProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ input }) => {
      const { scopes } = await constructionService.getCatalog()
      return scopes.filter(scope => scope.tradeId === input.tradeId)
    }),
})
```

`src/trpc/routers/construction.router/sow.router.ts`:
```ts
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { constructionService } from '@/shared/modules/construction/service'
import { baseProcedure, createTRPCRouter } from '../../init'

export const sowRouter = createTRPCRouter({
  byScope: baseProcedure
    .input(z.object({ scopeId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionService.getSowTemplatesByScope(input.scopeId)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }
    }),

  content: baseProcedure
    .input(z.object({ sowId: z.string() }))
    .query(async ({ input }) => {
      try {
        return await constructionService.getSowContent(input.sowId)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }
    }),
})
```

`src/trpc/routers/construction.router/pain-points.router.ts`:
```ts
import { constructionService } from '@/shared/modules/construction/service'
import { agentProcedure, createTRPCRouter } from '../../init'

export const painPointsRouter = createTRPCRouter({
  getAll: agentProcedure.query(async () => constructionService.getPainPoints()),
})
```

`agentProcedure`, not `baseProcedure`: pain points are internal sales-psychology data shown only inside the meeting flow, never on a public page.

- [ ] **Step 2: Write the router index**

`src/trpc/routers/construction.router/index.ts`:
```ts
import { revalidateTag } from 'next/cache'

import { CONSTRUCTION_CATALOG_TAG } from '@/shared/modules/construction/service'
import { agentProcedure, createTRPCRouter } from '@/trpc/init'
import { painPointsRouter } from './pain-points.router'
import { scopesRouter } from './scopes.router'
import { sowRouter } from './sow.router'
import { tradesRouter } from './trades.router'

export const constructionRouter = createTRPCRouter({
  trades: tradesRouter,
  scopes: scopesRouter,
  sow: sowRouter,
  painPoints: painPointsRouter,

  /** One tag covers every cached catalog read — see modules/construction/DOCS.md#one-cache-tag */
  revalidateCatalog: agentProcedure.mutation(async () => {
    revalidateTag(CONSTRUCTION_CATALOG_TAG)
    return { success: true, revalidatedAt: new Date().toISOString() }
  }),
})
```

- [ ] **Step 3: Delete the old router and register the new one**

```bash
git rm -r src/trpc/routers/notion.router
```

`src/trpc/routers/app.ts` — line 16 becomes `import { constructionRouter } from './construction.router'` (moved up to keep the import block alphabetical: it sorts before `customerNotesRouter`), and line 37's `notionRouter` entry becomes `constructionRouter`, likewise repositioned.

- [ ] **Step 4: Rename the refresh button**

```bash
git mv src/features/landing/ui/components/services/notion-refresh-button.tsx \
       src/features/landing/ui/components/services/catalog-refresh-button.tsx
```

In the moved file: `export function NotionRefreshButton()` → `CatalogRefreshButton`, the mutation becomes `trpc.constructionRouter.revalidateCatalog.mutationOptions({...})`, and `aria-label="Refresh Notion cache"` → `aria-label="Refresh catalog cache"`. Toast copy ("Cache refreshed" / "Failed to refresh cache") is already vendor-neutral — leave it.

Repoint its two renderers: `src/features/landing/ui/views/trade-view.tsx:12,55` and `src/features/landing/ui/views/pillar-view.tsx:17,138`.

- [ ] **Step 5: Repoint every `trpc.notionRouter` call site**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
grep -rl "trpc\.notionRouter" src/ | xargs sed -i \
  -e 's#trpc\.notionRouter\.scopes\.getAllSOW#trpc.constructionRouter.sow.byScope#g' \
  -e 's#trpc\.notionRouter\.scopes\.getSOWContent#trpc.constructionRouter.sow.content#g' \
  -e 's#trpc\.notionRouter#trpc.constructionRouter#g'
```

Because Task 5 already reshaped `getScopesByQuery` into `byTrade`, every remaining call site is a pure path change and this `sed` finishes them all. Confirm with:

```bash
grep -rn "constructionRouter\." src/ | sort
```
Expected procedures and nothing else: `trades.getAll`, `scopes.getAll`, `scopes.byTrade`, `sow.byScope`, `sow.content`, `revalidateCatalog`.

- [ ] **Step 6: Grep-gate the vendor name out of the API surface**

```bash
grep -rn "notionRouter\|revalidateNotionCache\|NotionRefreshButton" src/ ; echo "--- exit $? (1 = clean) ---"
```
Expected: zero hits in `src/`. `src/shared/entities/applications/DOCS.md:90` and `src/shared/services/providers/notion/DOCS.md:82,85` mention `notionRouter` in prose — Task 9 rewrites both.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && CI=1 pnpm lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
# Commit gate (Global Constraints): stage THIS task's files by explicit path — never a directory.
git status --porcelain | grep -vxFf $S/wip-before.txt   # the candidate list
sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null        # must print nothing
git add -- <each candidate path>   # expected: construction.router/**, notion.router/** (deleted), trpc/routers/index,
                                   # every trpc.notionRouter call site, catalog-refresh-button.tsx
git commit -m "$(cat <<'MSG'
refactor(construction-p1): constructionRouter replaces notionRouter

No vendor name on the API surface (A4). Pure namespace rename plus a
regrouping: the two SOW procedures move off scopes onto their own `sow`
sub-router (getAllSOW -> sow.byScope, getSOWContent -> sow.content).
scopes.byTrade was already reshaped in the previous commit.

painPoints.getAll is new and agent-only; pain points are internal sales
data, never public. revalidateNotionCache becomes revalidateCatalog and
clears the single construction-catalog tag.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: The client read model

One pure index builder and one hook replace the per-feature catalog reads.

**Files:**
- Create: `src/shared/modules/construction/core/lib/build-catalog-index.ts`
- Create: `src/shared/modules/construction/core/hooks/use-construction-catalog.ts`
- Delete: `src/features/meeting-flow/hooks/use-trade-catalog.ts`
- Delete: `src/features/meeting-flow/lib/group-scopes-by-trade.ts`
- Modify: `src/features/meeting-flow/types/index.ts` (drop `TradeScopeGroup` + `TradeCatalog`)
- Modify: `src/features/landing/lib/notion-trade-helpers.ts:42-47`
- Modify: every `useTradeCatalog` importer

**Interfaces:**
- Consumes: `Scope`, `Trade` from `core/schemas`; `trpc.constructionRouter.{trades,scopes}.getAll` from Task 6.
- Produces:
  - `@/shared/modules/construction/core/lib/build-catalog-index` → `buildCatalogIndex(trades: Trade[], scopes: Scope[]): CatalogIndex`, `interface CatalogIndex`, `interface TradeScopeGroup`
  - `@/shared/modules/construction/core/hooks/use-construction-catalog` → `useConstructionCatalog(): ConstructionCatalog`
  - `type ConstructionCatalog = CatalogIndex & { isLoading: boolean, error: Error | null, refetch: () => void }`

- [ ] **Step 1: Write the index builder**

`src/shared/modules/construction/core/lib/build-catalog-index.ts`:

```ts
import type { Scope, Trade } from '@/shared/modules/construction/core/schemas'

/** A trade's catalog entries, split by `Scope.kind`. */
export interface TradeScopeGroup {
  scopes: Scope[]
  addons: Scope[]
}

export interface CatalogIndex {
  trades: Trade[]
  tradesById: ReadonlyMap<string, Trade>
  tradesBySlug: ReadonlyMap<string, Trade>
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
}

/**
 * The whole catalog, indexed once. Pure — used by both the client hook and
 * any RSC path, so neither re-derives these maps.
 * see ../../DOCS.md#one-read-model
 */
export function buildCatalogIndex(trades: Trade[], scopes: Scope[]): CatalogIndex {
  const scopesByTrade = new Map<string, TradeScopeGroup>()
  for (const scope of scopes) {
    const group = scopesByTrade.get(scope.tradeId) ?? { scopes: [], addons: [] }
    if (scope.kind === 'addon') {
      group.addons.push(scope)
    }
    else {
      group.scopes.push(scope)
    }
    scopesByTrade.set(scope.tradeId, group)
  }

  return {
    trades,
    tradesById: new Map(trades.map(trade => [trade.id, trade])),
    tradesBySlug: new Map(trades.map(trade => [trade.slug, trade])),
    scopesByTrade,
  }
}
```

- [ ] **Step 2: Write the hook**

`src/shared/modules/construction/core/hooks/use-construction-catalog.ts`:

```ts
'use client'

import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { buildCatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import { useTRPC } from '@/trpc/helpers'

export type ConstructionCatalog = CatalogIndex & {
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/** The whole trade and scope catalog, fetched once and indexed once. No per-trade or hover-time queries. */
export function useConstructionCatalog(): ConstructionCatalog {
  const trpc = useTRPC()
  const tradesQuery = useQuery(trpc.constructionRouter.trades.getAll.queryOptions())
  const scopesQuery = useQuery(trpc.constructionRouter.scopes.getAll.queryOptions())

  const index = useMemo(
    () => buildCatalogIndex(tradesQuery.data ?? [], scopesQuery.data ?? []),
    [tradesQuery.data, scopesQuery.data],
  )

  const refetchTrades = tradesQuery.refetch
  const refetchScopes = scopesQuery.refetch
  const refetch = useCallback(() => {
    void refetchTrades()
    void refetchScopes()
  }, [refetchTrades, refetchScopes])

  const isLoading = tradesQuery.isLoading || scopesQuery.isLoading
  const error = (tradesQuery.error as Error | null) ?? (scopesQuery.error as Error | null) ?? null

  return useMemo(
    () => ({ ...index, isLoading, error, refetch }),
    [index, isLoading, error, refetch],
  )
}
```

- [ ] **Step 3: Delete the two replaced files and repoint their consumers**

```bash
git rm src/features/meeting-flow/hooks/use-trade-catalog.ts \
       src/features/meeting-flow/lib/group-scopes-by-trade.ts

grep -rl "useTradeCatalog\|use-trade-catalog\|groupScopesByTrade\|meeting-flow/lib/group-scopes-by-trade" src/ \
  | xargs sed -i \
    -e 's#@/features/meeting-flow/hooks/use-trade-catalog#@/shared/modules/construction/core/hooks/use-construction-catalog#g' \
    -e 's/\buseTradeCatalog\b/useConstructionCatalog/g'
```

`features/meeting-flow/lib/group-scopes-by-trade.ts`'s entire body is `buildCatalogIndex`'s scope loop — keeping both is the duplication P1 exists to remove.

> **Not** touched: `src/features/project-management/lib/group-scopes-by-trade.ts`. Its signature is `(selectedScopeIds, allScopes) → TradeRow[]` — a projection of a *selection*, not a catalog index. It is not a duplicate. P3 decides whether it should derive from `CatalogIndex`.

- [ ] **Step 4: Move the two types out of meeting-flow**

In `src/features/meeting-flow/types/index.ts`, delete `TradeScopeGroup` (lines 257-261) and `TradeCatalog` (263-271), and drop the now-unused `Scope` type import. `TradeCatalogContextValue` at `:314` becomes:
```ts
/** Stable once both reads have loaded. */
export interface TradeCatalogContextValue {
  catalog: ConstructionCatalog
  projects: ShowcaseProjectIndex
}
```
with `import type { ConstructionCatalog } from '@/shared/modules/construction/core/hooks/use-construction-catalog'` at the top.

Any file importing `TradeScopeGroup` or `TradeCatalog` from `@/features/meeting-flow/types` repoints:
```bash
grep -rl "TradeScopeGroup\|TradeCatalog\b" src/ | xargs grep -l "features/meeting-flow/types"
```
`TradeScopeGroup` now comes from `@/shared/modules/construction/core/lib/build-catalog-index`; `TradeCatalog` is gone — its users want `ConstructionCatalog`.

> **What stays in meeting-flow.** `TradeCatalogContext` bundles `catalog` *and* `projects`, and `projects` is meeting-flow's own showcase data. The context and its eleven consumers stay exactly where they are — only the hook underneath it changed.

- [ ] **Step 5: Make landing use the index**

In `src/features/landing/lib/notion-trade-helpers.ts`, delete the hand-rolled map at lines 42-47 and use the builder:
```ts
  const { trades: allTrades, scopes: allScopes } = await constructionService.getCatalog()
  const { scopesByTrade } = buildCatalogIndex(allTrades, allScopes)
```
and at line 62:
```ts
    scopes: [...(scopesByTrade.get(trade.id)?.scopes ?? []), ...(scopesByTrade.get(trade.id)?.addons ?? [])],
```
The old map held scopes *and* add-ons together, so both groups are concatenated to preserve `ScopesGrid`'s input — it re-splits them by `kind` itself (`scopes-grid.tsx:24-25`).

Add `import { buildCatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'`.

- [ ] **Step 6: Type-check and lint**

Run: `pnpm tsc && CI=1 pnpm lint`
Expected: clean.

- [ ] **Step 7: Browser check — no visual change**

> **Deferred 2026-09-22 (user):** Node on this host cannot reach Notion, so no dev server can render these surfaces. Data equivalence was proven offline instead (120 live scopes via curl through the real adapters: meeting-flow groups identical; landing counts + `ScopesGrid` split identical). **The browser pass over all three surfaces runs once, at Task 9 Step 7 (final verification).**

With `pnpm dev` running, confirm three surfaces render exactly as before:
1. a landing pillar page (`/energy-efficient-construction`) — trade cards with their scopes and add-ons,
2. a meeting flow's specialties step — the trade switcher's category groups and each trade's scope/add-on split,
3. a funnel page carrying a portfolio block.

Any visual difference is a bug in this task, not an improvement. Report it rather than adjusting copy or layout.

- [ ] **Step 8: Commit**

```bash
# Commit gate (Global Constraints): stage THIS task's files by explicit path — never a directory.
git status --porcelain | grep -vxFf $S/wip-before.txt   # the candidate list
sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null        # must print nothing
git add -- <each candidate path>   # expected: core/lib/build-catalog-index.ts, core/hooks/use-construction-catalog.ts,
                                   # the useTradeCatalog call sites, the 2 deleted meeting-flow files
git commit -m "$(cat <<'MSG'
feat(construction-p1): one catalog index and one hook for the client

buildCatalogIndex is pure, so the client hook and any RSC path share it.
useConstructionCatalog replaces meeting-flow's useTradeCatalog, and
meeting-flow's group-scopes-by-trade.ts is deleted — its whole body was
buildCatalogIndex's scope loop. Landing drops its hand-rolled
scopesByTrade map for the same builder.

TradeScopeGroup and TradeCatalog move out of the feature's types.
TradeCatalogContext stays: it bundles catalog AND projects, and projects
is meeting-flow's own showcase data.

project-management/lib/group-scopes-by-trade.ts is deliberately left
alone — (selectedScopeIds, allScopes) -> TradeRow[] projects a
selection, not a catalog. P3 decides its fate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: Scripts — one Notion client, and a new seam verifier

> ## ⛔ The portfolio scraper is NOT deleted
>
> `scripts/portfolio-scraper/` is a working, actively-used tool (`pnpm scrape-project`)
> and **every one of its capabilities survives P1 intact**. Do not delete any file in
> that directory. Do not remove a command, a flag, a prompt, a site-scraper or a
> matcher. If any step below appears to reduce what the scraper can do, **stop and
> report it** — you have misread the step.
>
> Exactly one thing is removed, and it is replaced in the same commit:
> `fetch-scopes.ts`'s Notion-fetching half (`extractScope`, `fetchAllScopes`, the
> second `new Client(...)`, the hardcoded `SCOPES_DATABASE_ID`) gives way to
> `catalogSource.getScopes()`. The file's matcher half is kept and the file is
> renamed to say what it now does.
>
> The scraper **gains** a bug fix in the trade: `fetchAllScopes` issued a single
> un-paginated `dataSources.query`, so it silently capped at 100 scopes — the exact
> P0 bug, still live there. Reading through `catalogSource` paginates.

`scripts/portfolio-scraper/fetch-scopes.ts:30` constructs a **second** `new Client({ auth: notionApiKey })` with its own hardcoded database UUID and its own `{ id, name, entryType }` shape. Pointing it at `catalogSource` retires that duplicate client and its duplicate scope shape. That is the whole of F16.

**Scripts import `catalogSource` from `sources/`, never `service.ts`** — `unstable_cache` requires a Next request context.

**Why no env plumbing is needed — verified, do not add any.** Three facts make the swap safe, and an implementer who does not know them may be tempted to add defensive env loading:

1. `providers/notion/lib/config.ts` does **not** import `shared/config/server-env.ts`. `createProviderConfig().get()` calls `opts.fragment.parse(process.env)` (`create-provider-config.ts:141`) — it validates only the `{ NOTION_API_KEY }` slice, never the app's full env schema. A script pulling in `catalogSource` therefore never triggers whole-env validation.
2. `notionClient` is `lazyProxy(() => new Client({ auth: getNotionConfig().apiKey }))`, so the key is read on first *use*, not on import.
3. `NOTION_API_KEY` lives in `.env`, which `index.ts:11` already loads, and the `catalogSource` import at `:549` is **dynamic** (`await import(...)`) — it resolves long after that `config()` call.

`index.ts:5`'s `import { config } from 'dotenv'` is a pre-existing deviation from `memory/feedback-scripts-load-env.md`. It is **out of brief — leave it alone.** It loads `.env` explicitly by absolute path, which is all `NOTION_API_KEY` needs.

**Files:**
- Create: `scripts/verify-catalog-seam.ts`
- Rename: `scripts/portfolio-scraper/fetch-scopes.ts` → `scripts/portfolio-scraper/fuzzy-match-scopes.ts`, keeping the matcher
- Modify: `scripts/portfolio-scraper/{types,prompts,index}.ts`
- Modify: `package.json` (add the verify script)
- **Delete: nothing.** No file is removed in this task. The rename above is the only path that changes, and `git mv` preserves history.

Untouched, and must stay that way: `scripts/portfolio-scraper/{classify-images,constants,download-images,generate-content,import-project,scrape-images}.ts` and `scripts/portfolio-scraper/site-scrapers/`.

**Interfaces:**
- Consumes: `catalogSource` from Task 4, `Scope` from Task 3.
- Produces: `fuzzyMatchScopes(allScopes: Scope[], description: string): MatchedScope[]`; `MatchedScope = { id: string, name: string, kind: ScopeKind }`.

- [ ] **Step 1: Reduce the scraper's Notion file to its matcher**

```bash
git mv scripts/portfolio-scraper/fetch-scopes.ts scripts/portfolio-scraper/fuzzy-match-scopes.ts
```

In the renamed file, delete lines 1-45 — the `PageObjectResponse` import, the `Client` import, `SCOPES_DATABASE_ID`, `interface NotionScope`, `extractScope` and `fetchAllScopes` — and keep `fuzzyMatchScopes`, `levenshteinSimilar` and `levenshteinDistance` unchanged except for the signature and the mapped shape:

```ts
import type { Scope } from '@/shared/modules/construction/core/schemas'
import type { MatchedScope } from './types'

export function fuzzyMatchScopes(
  allScopes: Scope[],
  description: string,
): MatchedScope[] {
```
and inside the loop:
```ts
        matched.set(scope.id, {
          id: scope.id,
          name: scope.name,
          kind: scope.kind,
        })
```

> The file is **reduced, not deleted.** The spec's §5 said "deleted outright"; that would take `fuzzyMatchScopes` with it and break `pnpm scrape-project`. Only the Notion-fetching half goes.

- [ ] **Step 2: Repoint the scraper's local scope shape**

`scripts/portfolio-scraper/types.ts:32-36`:
```ts
import type { ScopeKind } from '@/shared/modules/construction/core/schemas'

export interface MatchedScope {
  id: string
  name: string
  kind: ScopeKind
}
```

`scripts/portfolio-scraper/prompts.ts:64` → `name: \`${s.name} (${s.kind})\``.

`scripts/portfolio-scraper/index.ts` — replace the four structural `{ id: string, name: string, entryType: string }` literals at `:355`, `:404`, `:405` with `Scope` (imported as a type), and the three display lines at `:375`, `:559`, `:630` with `${s.kind}`. At `:549-550`:
```ts
  const { catalogSource } = await import('@/shared/modules/construction/sources')
  const { fuzzyMatchScopes } = await import('./fuzzy-match-scopes')
  const allScopes = await catalogSource.getScopes()
```
`notionApiKey` is no longer passed to the fetch — `catalogSource` reads it through the provider's `lib/config.ts`. If `notionApiKey` becomes unused in that function, delete it and its plumbing; if it is still used elsewhere in the file, leave it.

- [ ] **Step 3: Write the seam verifier**

`scripts/verify-catalog-seam.ts`. Unlike the other three verify scripts this one hits **production Notion**, so it is a read-only integration check, not a unit test:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import './lib/load-env'
import { catalogSource } from '@/shared/modules/construction/sources'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const [trades, scopes] = await Promise.all([
  catalogSource.getTrades(),
  catalogSource.getScopes(),
])

console.log(`trades: ${trades.length}  scopes: ${scopes.length}`)

// V5 — P0 lifted the 100-row cap. P0 measured 120 scopes and 27 trades;
// this asserts the magnitude, not the exact count, because the owner edits
// Notion continuously.
assert.ok(scopes.length > 100, `expected more than 100 scopes, got ${scopes.length}`)
assert.ok(trades.length > 0, 'expected at least one trade')

const tradeIds = new Set(trades.map(t => t.id))

for (const trade of trades) {
  assert.ok(UUID.test(trade.id), `trade id is not a dashed lowercase UUID: ${trade.id}`)
  assert.ok(trade.slug.length > 0, `trade has no slug: ${trade.name}`)
}

let orphans = 0
for (const scope of scopes) {
  assert.ok(UUID.test(scope.id), `scope id is not a dashed lowercase UUID: ${scope.id}`)
  assert.ok(scope.kind === 'scope' || scope.kind === 'addon', `scope.kind is neither 'scope' nor 'addon': ${scope.kind} (${scope.name})`)
  if (!tradeIds.has(scope.tradeId)) {
    orphans++
    console.warn(`  orphan scope: "${scope.name}" -> tradeId ${scope.tradeId} is not in this read`)
  }
}

// A scope whose trade is disabled is legitimately absent from `trades`, so
// orphans are reported, not fatal. A large count means id normalization or
// the disabled gate has regressed.
assert.ok(orphans < scopes.length * 0.2, `${orphans} of ${scopes.length} scopes point at a trade that is not in the catalog`)

console.log(`✓ catalog seam verified (${orphans} orphan scope(s), all ids normalized, all kinds valid)`)
```

Add to `package.json` beside `verify:ct-note`:
```json
    "verify:catalog": "tsx scripts/verify-catalog-seam.ts",
```

- [ ] **Step 4: Run every verifier**

```bash
npx tsx scripts/verify-normalize-notion-id.ts
npx tsx scripts/verify-notion-adapters.ts
npx tsx scripts/verify-energy-trade-qualification.ts
pnpm verify:catalog
```
Expected: the three pure scripts pass; `verify:catalog` prints a count above 100 and exits 0.

- [ ] **Step 5: Prove the scraper still works, end to end on the changed path**

`--help` alone is not enough — it exits at `index.ts:79` before any scope code runs. Exercise the *actual* path that changed, without writing anything:

The script must live **inside `scripts/`**, not `/tmp` — `tsx` resolves the `@/` path alias from `tsconfig.json`, which only covers files in the project tree. `scripts/tmp-*.ts` is the repo's existing convention for throwaway probes and is gitignored-by-habit; delete it when done.

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
cat > scripts/tmp-smoke-scraper-scopes.ts <<'EOF'
/* eslint-disable no-console */
import './lib/load-env'

const { catalogSource } = await import('@/shared/modules/construction/sources')
const { fuzzyMatchScopes } = await import('./portfolio-scraper/fuzzy-match-scopes')

const allScopes = await catalogSource.getScopes()
console.log(`fetched ${allScopes.length} scopes`)
if (allScopes.length <= 100) {
  throw new Error(`expected >100 scopes (P0 lifted the cap); got ${allScopes.length}`)
}

const matched = fuzzyMatchScopes(allScopes, 'kitchen remodel, flooring')
console.log(`matched ${matched.length}:`, matched.slice(0, 5).map(m => `${m.name} (${m.kind})`))
if (matched.length === 0) {
  throw new Error('fuzzyMatchScopes returned nothing — the matcher regressed')
}
for (const m of matched) {
  if (m.kind !== 'scope' && m.kind !== 'addon') {
    throw new Error(`MatchedScope.kind is not neutral: ${JSON.stringify(m)}`)
  }
}
console.log('✓ scraper scope path OK')
EOF
npx tsx scripts/tmp-smoke-scraper-scopes.ts
rm scripts/tmp-smoke-scraper-scopes.ts
```

Make sure the `rm` runs — `scripts/tmp-smoke-scraper-scopes.ts` must not appear in the commit.

Expected: more than 100 scopes (the old `fetchAllScopes` capped at 100 — this is the regression fix made visible), a non-empty match list, and every `kind` neutral.

Then confirm the CLI itself still boots:
```bash
pnpm scrape-project --help 2>&1 | head -20
```
Expected: usage prints with no module-resolution error.

Do **not** run a full scrape — it writes files and calls paid APIs.

- [ ] **Step 5b: Confirm nothing else in the scraper was lost**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
ls scripts/portfolio-scraper/ scripts/portfolio-scraper/site-scrapers/
git diff --cached --stat scripts/portfolio-scraper/
git diff --cached --diff-filter=D --name-only scripts/portfolio-scraper/
```

The directory listing must still contain `classify-images.ts`, `constants.ts`, `download-images.ts`, `generate-content.ts`, `import-project.ts`, `index.ts`, `prompts.ts`, `scrape-images.ts`, `types.ts`, `site-scrapers/`, and `fuzzy-match-scopes.ts` in place of `fetch-scopes.ts`.

The last command lists deletions. It must print **either nothing** (git recorded the rename) **or** exactly `scripts/portfolio-scraper/fetch-scopes.ts` alongside the new `fuzzy-match-scopes.ts`. Any other deleted path is a mistake — restore it.

- [ ] **Step 6: Final grep gates (V2)**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
echo "--- notionRouter ---";        grep -rn "notionRouter" src/ scripts/ tests/
echo "--- domains/construction ---"; grep -rn "domains/construction" src/ scripts/ tests/
echo "--- provider internals ---";   grep -rn "providers/notion/\(lib/\|dal/\|constants/\)" src/ scripts/ tests/ | grep -v "lib/config"
echo "--- Notion property names ---"; grep -rn "\brelatedTrade\b\|\bentryType\b\|\bhomeOrLot\b\|\brelatedScopesOfWork\b\|\brelatedScopes\b\|\bScopeOrAddon\b\|\bNotionPainPoint\b" src/ scripts/ tests/
echo "--- old cache tags ---";       grep -rn "notion-trades\|notion-scopes\|notion-pain-points" src/ scripts/ tests/
echo "--- second Notion client ---"; grep -rn "new Client(" src/ scripts/ tests/ | grep -v "providers/notion/client.ts"
echo "--- provider file list ---";   find src/shared/services/providers/notion -type f | sort
```

Every one of the first six must print nothing. The last must print exactly four files: `client.ts`, `types.ts`, `lib/config.ts`, `DOCS.md`.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && CI=1 pnpm lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
# Commit gate (Global Constraints): stage THIS task's files by explicit path — never a directory.
git status --porcelain | grep -vxFf $S/wip-before.txt   # the candidate list
sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null        # must print nothing
# NEVER `git add scripts/` — ~21 untracked foreign scripts/tmp-*.ts live there.
git add -- package.json \
           scripts/verify-catalog-seam.ts \
           scripts/portfolio-scraper/fuzzy-match-scopes.ts \
           scripts/portfolio-scraper/fetch-scopes.ts \
           scripts/portfolio-scraper/index.ts \
           <any other candidate path this task changed>
git commit -m "$(cat <<'MSG'
refactor(construction-p1): scripts read the catalog through the seam (F16)

portfolio-scraper held a second `new Client({ auth: notionApiKey })` with
its own hardcoded database UUID, its own {id,name,entryType} shape, and
no pagination — so it silently capped at 100 scopes, the same P0 bug.
It reads catalogSource.getScopes() now.

The scraper keeps every capability. fetch-scopes.ts is reduced to
fuzzy-match-scopes.ts rather than deleted: it also owned fuzzyMatchScopes
and the Levenshtein helpers, which index.ts:549,556 still need. No other
file in portfolio-scraper/ is removed.

Scripts import catalogSource from sources/, never service.ts —
unstable_cache needs a Next request context.

New: scripts/verify-catalog-seam.ts (pnpm verify:catalog) asserts against
production Notion that ids are normalized UUIDs, every kind is
scope|addon, and the read still clears P0's 100-row cap.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Docs, tracker amendments, and memory

The last commit. Nothing here changes behaviour; it stops the docs describing a codebase that no longer exists.

**Files:**
- Create: `src/shared/modules/construction/DOCS.md`
- Rewrite: `src/shared/services/providers/notion/DOCS.md`
- Modify: `docs/plans/2026-09-15-construction-data-standardization-epic.md` (the 7 amendments)
- Modify: `docs/codebase-conventions/provider-boundaries.md` (the `providers/notion/**` row)
- Modify: `src/shared/entities/applications/DOCS.md:90`
- Modify: `docs/codebase-conventions/enum-standardization.md:11` · `.claude/agents/knowledge/convention-auditor-ledger.md:279,300` · `memory/coding-conventions.md:690` (stale `domains/construction/` path — found at Task 1)
- Modify: `memory/project-construction-catalog-centralization.md` and `memory/MEMORY.md`

- [ ] **Step 1: Write the module's DOCS.md**

`src/shared/modules/construction/DOCS.md`, following `src/shared/modules/media/DOCS.md`'s shape. It must carry slug anchors for every in-code `// see` reference this plan introduced:

- `#neutral-schemas` — the four schemas are the app's shapes; no vendor name appears in a field. The rename table from Task 3.
- `#the-seam` — `ConstructionCatalogSource`, one binding in `sources/index.ts`, why there is no `getCatalog()` on the source, and that swapping to Postgres at P5 is one line plus deleting `sources/notion/`.
- `#one-cache-tag` — `CONSTRUCTION_CATALOG_TAG`, the 600s TTL, the four cached reads, and that one `revalidateTag` clears all of them.
- `#scripts-bypass-the-cache` — scripts import `catalogSource`, never `service.ts`, because `unstable_cache` needs a Next request context.
- `#one-read-model` — `buildCatalogIndex` is pure and shared by the hook and any RSC path.
- `#category-taxonomy` — **record, do not fix**: `constants/enums.ts`'s `constructionTypes` (`['energy-efficient','rough-construction','finish-construction']`) and `schemas`' `tradeCategories` (`['Energy Efficiency','General Construction','Structural / Rough']`) are two value sets for one concept and have drifted. Nothing reads `constructionTypes` against a trade today, so this is not a live bug. **P2 owns reconciling them (F11 / A5).**
- `#disabled-is-an-extraction-gate` — why `Trade` has no `disabled` field and `TRADE_PROPERTIES_MAP` still has the checkbox (B18).

- [ ] **Step 2: Rewrite the provider's DOCS.md**

`src/shared/services/providers/notion/DOCS.md` currently documents adapters, property maps, the database registry and the cache — none of which live there any more. Reduce it to what the leaf actually is: the lazily-constructed client, the env fragment, and the four generic types. Every construction rule moves to the module's DOCS.md; leave a one-line pointer to it. Delete the stale `notionRouter` references at `:82,85` and the `NotionDatabaseName` reference at `:3`.

Keep `#reads-paginate` — `sources/notion/query.ts:89` and `page-to-tiptap.ts:21` still cite it by slug. **Move that anchor into the module's DOCS.md and update both `// see` comments** to `see ../../DOCS.md#reads-paginate`, since pagination is now the source's behaviour, not the provider's. Same for `#adapter-returns-entity-or-null` and `#disabled-checkbox-is-extraction-time-gate`, cited by all four adapters — but the adapters sit one level deeper (`sources/notion/<entity>/`), so theirs become **`../../../DOCS.md#…`**. (Since Task 2 these links resolve to a nonexistent `sources/DOCS.md`.)

```bash
grep -rn "DOCS.md#" src/shared/modules/construction src/shared/services/providers/notion
```
Every slug printed must exist in whichever DOCS.md the relative path now resolves to. Check each one.

- [ ] **Step 3: Apply the seven tracker amendments**

In `docs/plans/2026-09-15-construction-data-standardization-epic.md`:

1. **C6 / F1** — the provider keeps `client.ts`, `types.ts` **and `lib/config.ts`**. As written C6 is unachievable: `provider-boundaries.md#provider-lib-is-provider-internal` sanctions `lib/config.ts` and all ten providers use that shape via `shared/config/server-env.ts:8-16`. Also record that `types.ts` was split, its construction-bound half (`NotionDatabaseName`) moving to `sources/notion/databases.ts`.
2. **F1** — `CatalogRef` and `ScopeRef` are dropped from P1; they describe *persisted* references, which is P4 (F14, A9). They had zero call sites.
3. **F7** — `getScopesByQuery` is *reshaped* to `scopes.byTrade` at P1 and *deleted* at P3.
4. **A5** — the category/kind/pricing-unit const arrays did not exist; `entryType` and `unitOfPricing` were bare `z.string()`. P1 creates `tradeCategories` and `scopeKinds`; `unitOfPricing` is still a bare string and remains A5's work at P2.
5. **§5 Pointers** — the service had 5 functions, not 7 (P0 deleted two). `domains/construction/constants/enums.ts` held property-profile enums about the customer's *house*, not catalog enums; its `constructionTypes` drift from `Trade.category` is recorded as a P2 item.
6. **B18** — the P1 half is satisfied by *deleting* `Trade.disabled`, not by moving the filter.
7. **Escalation status** — P0 escalations **1** (public uncached reads) and **4** (`sortBy` admitting relation properties) **close with this phase**. **2** (IRA 25C claims accuracy in `programs.ts:22/:113/:139`) and **3** (`program-step.tsx`'s missing loading gate) remain **open and owner-owned**.

Add an eighth line recording the three post-spec decisions D-a/D-b/D-c from this plan's header, so the tracker matches what shipped.

- [ ] **Step 4: Update provider-boundaries.md**

The `providers/notion/**` row in `## Known non-compliance` is now resolved — remove it from that table. The `#translators-live-in-domain-land` **Target shape** line becomes a statement of fact rather than a plan: `modules/construction/sources/notion/` **is** where the data-source ids, property maps, translators and extractors live, with `providers/notion` reduced to `client.ts` + `types.ts` + `lib/config.ts`. Cite this plan's date.

- [ ] **Step 5: Fix the stale references**

`src/shared/entities/applications/DOCS.md:90` says `notionRouter.trades.getAll` → `constructionDataService.getTrades()`. Both names are gone. It now reads `constructionRouter.trades.getAll` → `constructionService.getCatalog()`.

Found at Task 1 — each still names `src/shared/domains/construction/constants/enums.ts`, now `src/shared/modules/construction/core/constants/enums.ts`:
- `docs/codebase-conventions/enum-standardization.md:11` — the co-location "live example".
- `.claude/agents/knowledge/convention-auditor-ledger.md:279` ("`domains/construction/` holds only `constants/enums.ts`") and `:300`.
- `memory/coding-conventions.md:690` ("actually lives at `src/shared/domains/construction/...` (verified 2026-09-14)").

⚠️ The first two carried **foreign uncommitted WIP** at plan time (`enum-standardization.md:11` is itself inside that WIP). Check `wip-before.txt`; if either is still foreign-modified, ask the user before editing or staging it.

- [ ] **Step 6: Update memory**

In `memory/project-construction-catalog-centralization.md`: mark **P1 SHIPPED 2026-09-20** with its commit range; replace the `sources/notion/` plan wording with what landed; record that escalations 1 and 4 are closed and 2 and 3 stay open; note `service.ts` / `core/` / plural `sources/` as the settled shape; add the `tradeCategories` dedup. Update the one-line hook in `memory/MEMORY.md` to match.

- [ ] **Step 7: Final full verification**

> **Includes the browser pass deferred from Task 7 Step 7** — landing pillar page, meeting-flow specialties step, a funnel page with a portfolio block. Needs Node→Notion reachability; ask the user how to run it (no workaround without explicit OK).

```bash
pnpm tsc && CI=1 pnpm lint
npx tsx scripts/verify-normalize-notion-id.ts
npx tsx scripts/verify-notion-adapters.ts
npx tsx scripts/verify-energy-trade-qualification.ts
pnpm verify:catalog
```
Then re-run **all seven grep gates from Task 8 Step 6**. Every one must still be clean.

- [ ] **Step 8: Commit**

```bash
# Commit gate (Global Constraints): stage THIS task's files by explicit path — never a directory.
git status --porcelain | grep -vxFf $S/wip-before.txt   # the candidate list
sha1sum -c --quiet $S/wip-hashes.txt 2>/dev/null        # must print nothing
# ⚠️ Two files below carried FOREIGN WIP at plan time — check wip-before.txt and ask before staging:
#    src/shared/entities/applications/DOCS.md (modified by another session)
#    docs/codebase-conventions/provider-boundaries.md (UNTRACKED — staging it commits the whole file)
git add -- src/shared/modules/construction/DOCS.md \
           src/shared/services/providers/notion/DOCS.md \
           <each other candidate path>
git commit -m "$(cat <<'MSG'
docs(construction-p1): module DOCS, provider DOCS, tracker amendments

modules/construction/DOCS.md carries every rule the code cites by slug:
the seam, the one cache tag, the read model, why scripts bypass the
service, why Trade has no `disabled` field, and the category-taxonomy
drift recorded for P2 without fixing it.

providers/notion/DOCS.md is cut down to the leaf it now describes.
provider-boundaries.md's `providers/notion/**` non-compliance row is
resolved and removed.

Seven tracker amendments, incl. C6 (the provider also keeps
lib/config.ts — as written C6 was unachievable) and the escalation
status: P0 #1 and #4 close with this phase, #2 and #3 stay owner-owned.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

Commit `memory/` separately — it is outside the repo.

---

## Verification summary

| ID | Check | Where |
|---|---|---|
| **V1** | `pnpm tsc` + `pnpm lint` clean. **Never `pnpm build`.** | every task |
| **V2** | Seven grep gates: no `notionRouter`, no `domains/construction`, no provider internals imported outside the source, no Notion property names in `src/` **or** `scripts/`, no old cache tags, no second `new Client(`, provider is exactly 4 files | Task 8 Step 6, re-run at Task 9 Step 7 |
| **V5** | `getCatalog()` returns **more than 100 scopes** against production Notion. P0 measured 120 scopes / 27 trades — expected magnitude, not an exact assertion; the owner edits Notion. | `pnpm verify:catalog` |
| **New** | Every `Scope.kind` is `scope`\|`addon`; every id is a dashed lowercase UUID; orphan `tradeId`s stay under 20% | `pnpm verify:catalog` |
| **Regression** | The three existing pure verify scripts still pass | Tasks 2, 3, 8, 9 |
| **Cache** | Two loads inside 600s issue one set of Notion requests; the refresh button forces a new one | Task 5 Step 8 |
| **Browser** | Landing pillar page, specialties step, and a funnel portfolio block render unchanged | Task 7 Step 7 |

A full sweep of every P3 consumer surface stays at **V6**, out of scope here.

## What this plan deliberately does not do

Each is a spec non-goal. Do not drift into them.

1. **Collapse the duplicated consumers** — nine `groupScopesByTrade`-shaped call sites, three picker rows, the per-trade-row query pattern. All **P3**, after the specialties build lands (C4).
2. **Consolidate the scope-vs-add-on classifiers** — P1 sets `kind` at the translator; **P2** (F10) reconciles the feature-side ones.
3. **Reconcile `constructionTypes` with `tradeCategories`** — recorded in DOCS.md, fixed at **P2**.
4. **Stored slug** — `slugifyTradeName` keeps deriving it. D2's Notion `Slug` property and its backfill are **P2**.
5. **`TRADE_FACTS`** — its hardcoded trade names stay wrong until **P2** (B6, F18).
6. **`CatalogRef` / `ScopeRef`** — zero call sites; they describe persisted references, which is **P4**.
7. **The two open P0 escalations** — IRA 25C claims accuracy in `programs.ts`, and `program-step.tsx`'s missing loading gate. Both are owner calls. Task 3 repoints `program-step.tsx`'s import and changes nothing else about it.
8. **Any visual or copy change.** Every UI edit here is an import path, a field name, or a hook name.
9. **Remove or reduce any tool's capability.** `pnpm scrape-project` does exactly what it does today, minus a duplicated Notion client and a 100-row cap. `index.ts:5`'s non-standard `dotenv` import is a pre-existing deviation and stays — out of brief.
