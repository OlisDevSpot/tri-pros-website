# Property Facts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each customer one Property facts record (the facts about their home that never change), give the four profile fields that belong there their new home, retire the four that now live only in a Build, and put the customer profile and the meeting's context panel on the new record.

**Architecture:** A new 1:1 table `customer_property_facts`, keyed by the customer, copying the `customer_profiles` shape end to end: a sub-entity spec that is a field (`propertyFacts`) of the `Customer` subject, a one-line `upsertOneToOne` mutation, a column picker joined at the three customer read sites, and its own tRPC write beside the profile's. Year built is stored as an exact year or a range, never both, and read through one pure helper. Nothing in the trade scene changes in this plan.

**Tech Stack:** Next.js, TypeScript, Drizzle on Postgres (Neon), drizzle-zod, Zod, tRPC, CASL, react-hook-form. Pure-function tests on `node:test` through `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-06-home-on-file-design.md` (§3.1, §3.2, §9 plan 1, §11). Tracker rulings R263–R265, R269, R275, R278, R280–R282 in `docs/plans/2026-10-16-trade-scenes-epic.md`.

**Where it is built:** a new worktree and branch `feat/property-facts` off `origin/main` (one feature, one worktree, one PR). Paths and line numbers were checked against `origin/main` at `eda697387`. Stress-tested 2026-11-06; the findings are folded in.

**Not buildable yet: one open ruling.** How the new table reaches the shared dev database is the owner's to decide (Task 2 Step 8). Do not start before it is settled.

**Three things this plan does differently from the spec's §9, on purpose:**

1. **The lookup's columns wait for plan 2.** Electric utility, gas utility and climate zone are added with the free lookup, because their lists come from the service-area maps that plan trims. Plan 1 creates the table with the facts a person or the paid lookup sets.
2. **The `PropertyProfile` mapper waits for plan 3.** It has no caller until a Build exists. Plan 1 ships the one piece it will need, the year-built helper.
3. **The climate overrides wait for plan 5.**

## Global Constraints

- One home per fact: no value is stored in two places, and no list, limit or type is written a second time beside an existing one (`yearBuiltRanges`, `roofTypes`, `foundationTypes`, `CLIMATES`, the limits in Task 1).
- The eight property columns leave `customer_profiles`: `yearBuilt`, `roofType`, `foundationType`, `hoa` become Property facts; `hvacType`, `hvacComponents`, `windowsType`, `insulationLevel` go (R275). In the database the eight old columns are **not dropped by this plan**: they stay as frozen `*Deprecated` columns with no reader and no writer, the way `proposals` froze its blobs before their drop (`src/shared/db/schema/proposals.ts:39-47`), and the drop is tracked as T23 in the epic tracker (R282). No existing value of any of the eight is kept or copied (R281).
- Closed lists are `text({ enum: constArray })`, never a pg enum. One table per file, exported from `src/shared/db/schema/index.ts`.
- `db` is imported only under a `dal/` directory (scripts excepted). DAL functions take `ctx` first and return `DalReturn`.
- New files for the customer go under `src/shared/modules/customers/core/` (`lib/`, `constants/`); existing files under `src/shared/entities/customers/` are edited where they are.
- **The dev database is shared by every worktree, and it is ahead of `origin/main`.** On 2026-11-06 it held `meeting_conversations`, `voip_conversations` and new columns on `meetings` that `origin/main` does not define (they come from unshipped work on local `main`). A plain `pnpm db:push:dev` from this branch offers to drop them, and drizzle-kit applies all of its statements or none. Never accept a push that drops, renames or truncates anything. This plan only adds one table.
- No rows are written to any database by this plan, for testing, screenshots or anything else. The owner's hand check in Task 4 is the owner's.
- Never run `pnpm build`, `pnpm dev` or `next dev`. Checks run under the lock: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` and `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm eslint <files>`.
- Commit by explicit path, with a 300000 ms timeout (the pre-commit hook takes about 110 s). Never `git add -A`, `git commit -a`, `git stash`, `git reset` or `git checkout -- <file>`.
- Ship flow: push the branch and open the PR; if `main` moved, merge `origin/main` into the branch, never rebase or force-push; the owner squash-merges; the branch is not reused. Agents never merge or push to `main`.
- Comments say why, never what, and never cite a plan, spec or ruling.
- On screen the record is "Property Facts". "Property profile" is no longer used for it (`CONTEXT.md`).

## Review Focus

1. **A customer whose year built is exact.** The profile and the context panel must show the range worked out from it, not an empty field. Pinned in Task 1 (helper tests) and Task 4 (the owner's hand check on a real row).
2. **A rep picks a range on a customer who has an exact year.** The exact year must clear in the same write, or the database check rejects the save. Pinned in Task 2 (`withYearBuiltRule` tests) and Task 4 (hand check, twice in one open profile).
3. **A customer with no Property facts row** (nearly all of them). Every read must return nulls for the ten keys and every form must open clean. tsc cannot pin this: two of the three reads end in a cast. Pinned in Task 4 (screenshots with no row, then the hand check with one).
4. **A dispatcher or agent who could edit the property section before.** They must still be able to after the move. Pinned in Task 2 (rule lists and the type-check file).
5. **A patch that names a dropped field** (`hvacType` and the others) from a stale browser tab. It must be refused, not silently ignored into a partial save. Pinned in Tasks 2 and 3 (both patch schemas are strict where they are defined).

---

### Task 0: Before the first task

The plan, the spec and the tracker's rows for this work are uncommitted files in the trade-scenes worktree. They are not on `origin/main`, so they are not in the build worktree.

- [ ] **Step 1: Read the plan and the spec where they are**, by absolute path, and do not copy them into the branch:
  - `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes/docs/superpowers/plans/2026-11-06-property-facts.md`
  - `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes/docs/superpowers/specs/2026-11-06-home-on-file-design.md`

- [ ] **Step 2: Add the one glossary entry this plan uses.** Copy the **Property facts** entry, word for word, from the trade-scenes worktree's `CONTEXT.md` into the branch's `CONTEXT.md`, at the same place in the file. Add no other entry: that file carries other sessions' uncommitted work there.

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(glossary): property facts"
```

Tracker steps (Task 5 Step 3) are done in the trade-scenes worktree, where the rows live.

---

### Task 1: The year-built helper, the garage list and the limits

**Files:**
- Create: `src/shared/modules/construction/core/lib/year-built-range.ts`
- Create: `src/shared/modules/construction/core/lib/year-built-range.test.ts`
- Create: `src/shared/modules/construction/core/constants/property-fact-limits.ts`
- Modify: `src/shared/modules/construction/core/constants/era-defaults.ts` (after `ERA_BUILD_YEAR`, line 22)
- Modify: `src/shared/modules/construction/core/constants/enums.ts` (after `foundationTypes`, line 48)

**Interfaces:**
- Produces:
  - `ERA_START_YEAR = { 'Pre-1950': 0, '1950-1978': 1950, '1978-1998': 1978, '1998-2014': 1998, 'Post-2014': 2015 } as const satisfies Record<YearBuiltRange, number>`: the first year of each range. The only place the boundary years are written.
  - `yearBuiltRangeFor(year: number): YearBuiltRange`: the last range, in `yearBuiltRanges` order, whose start is not after the year.
  - `yearBuiltRangeOf(facts: { yearBuiltExact: number | null, yearBuilt: YearBuiltRange | null } | null | undefined): YearBuiltRange | null`
  - `garageTypes = ['none', 'attached', 'detached'] as const`, `type GarageType`
  - `YEAR_BUILT_EXACT_MIN = 1800`, `YEAR_BUILT_EXACT_MAX = 2100`, `NUM_STORIES_MIN = 1`, `NUM_STORIES_MAX = 4`, `LOT_SIZE_SQFT_MIN = 1`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { yearBuiltRanges } from '@/shared/constants/enums/customers'
import { ERA_BUILD_YEAR } from '@/shared/modules/construction/core/constants/era-defaults'
import { yearBuiltRangeFor, yearBuiltRangeOf } from './year-built-range'

describe('yearBuiltRangeFor', () => {
  it('puts a year the ranges share in the later range', () => {
    assert.equal(yearBuiltRangeFor(1949), 'Pre-1950')
    assert.equal(yearBuiltRangeFor(1950), '1950-1978')
    assert.equal(yearBuiltRangeFor(1977), '1950-1978')
    assert.equal(yearBuiltRangeFor(1978), '1978-1998')
    assert.equal(yearBuiltRangeFor(1997), '1978-1998')
    assert.equal(yearBuiltRangeFor(1998), '1998-2014')
    assert.equal(yearBuiltRangeFor(2014), '1998-2014')
    assert.equal(yearBuiltRangeFor(2015), 'Post-2014')
  })
  it('puts each range\'s typical year back in its own range', () => {
    for (const range of yearBuiltRanges) {
      assert.equal(yearBuiltRangeFor(ERA_BUILD_YEAR[range]), range)
    }
  })
})

describe('yearBuiltRangeOf', () => {
  it('works the range out from the exact year', () => {
    assert.equal(yearBuiltRangeOf({ yearBuiltExact: 1962, yearBuilt: null }), '1950-1978')
  })
  it('falls back to the stored range', () => {
    assert.equal(yearBuiltRangeOf({ yearBuiltExact: null, yearBuilt: 'Post-2014' }), 'Post-2014')
  })
  it('is null with neither, and with no record', () => {
    assert.equal(yearBuiltRangeOf({ yearBuiltExact: null, yearBuilt: null }), null)
    assert.equal(yearBuiltRangeOf(null), null)
  })
})
```

These are the first test files on `origin/main`; the header above is the house form.

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm exec tsx --test src/shared/modules/construction/core/lib/year-built-range.test.ts`
Expected: FAIL, cannot find module `./year-built-range`.

- [ ] **Step 3: Add `ERA_START_YEAR`** to `era-defaults.ts`, in the form of the tables beside it, then **implement the two functions** in `year-built-range.ts` on it. No year literal in the helper file.

- [ ] **Step 4: Add `garageTypes` and `GarageType`** to `enums.ts`, in the house form (`as const` array, then the type). **Add the five limits** to the new `property-fact-limits.ts`.

- [ ] **Step 5: Run the test and the checks**

Run: the test command from Step 2. Expected: 5 pass.
Run: tsc and eslint (the three new files, `era-defaults.ts` and `enums.ts`) under the lock. Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/modules/construction/core/lib/year-built-range.ts src/shared/modules/construction/core/lib/year-built-range.test.ts src/shared/modules/construction/core/constants/property-fact-limits.ts src/shared/modules/construction/core/constants/era-defaults.ts src/shared/modules/construction/core/constants/enums.ts
git commit -m "feat(construction): one helper works a home's era out from its exact year; garage types and the limits on property facts"
```

---

### Task 2: The Property facts record (table, spec, grants, write)

Additive only. Nothing reads the table after this task.

**Files:**
- Create: `src/shared/db/schema/customer-property-facts.ts`
- Modify: `src/shared/db/schema/index.ts` (barrel, beside `customer-profiles`)
- Modify: `src/shared/entities/customers/lib/constants.ts` (new name constant; lines 5–8 and 11 say a 1:1 child has its own subject, which the code no longer does)
- Modify: `src/shared/entities/customers/lib/server-spec.ts` (new spec after `customerProfileServerSpec`)
- Modify: `src/shared/domains/permissions/abilities.ts` (`ENTITY_NAMES`), `src/shared/domains/permissions/specs.ts` (`ServerSpec` union), `src/shared/dal/server/specs.ts` (`SERVER_SPECS`)
- Modify: `src/shared/domains/permissions/rules/agent.ts` (the grant at line 10, its comment at line 9), `src/shared/domains/permissions/rules/dispatcher.ts` (line 14, comment at line 13)
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts` (lines 85 and 284)
- Create: `src/shared/modules/customers/core/lib/year-built-rule.ts`, `src/shared/modules/customers/core/lib/year-built-rule.test.ts`
- Modify: `src/shared/entities/customers/dal/server/mutations.ts`

**Interfaces:**
- Consumes: `garageTypes` and the limits (Task 1); `yearBuiltRanges`; `roofTypes`, `foundationTypes`; `CLIMATES` from `@/shared/modules/construction/core/constants/climate-presets`.
- Produces:
  - table `customerPropertyFacts` (`customer_property_facts`) with columns, all nullable but the key:

    | Property | Column | Type |
    |---|---|---|
    | `customerId` | `customer_id` | uuid, primary key, references `customers.id`, on delete cascade |
    | `yearBuiltExact` | `year_built_exact` | integer |
    | `yearBuilt` | `year_built` | text, enum `yearBuiltRanges` |
    | `numStories` | `num_stories` | integer |
    | `foundationType` | `foundation_type` | text, enum `foundationTypes` |
    | `roofType` | `roof_type` | text, enum `roofTypes` |
    | `lotSizeSqft` | `lot_size_sqft` | integer |
    | `garage` | `garage` | text, enum `garageTypes` |
    | `pool` | `pool` | boolean |
    | `hoa` | `hoa` | boolean |
    | `climate` | `climate` | text, enum `CLIMATES` |
    | `createdAt`, `updatedAt` | | the schema helpers |

    One table check, in the form of `lead-source-monthly-spend.ts:17-21`: `check('customer_property_facts_year_built_one_form_ck', sql\`num_nonnulls(${table.yearBuiltExact}, ${table.yearBuilt}) <= 1\`)`.
  - `selectCustomerPropertyFactsSchema`; `insertCustomerPropertyFactsSchema`, whose field overrides (the second argument of `createInsertSchema`, as `customer-profiles.ts:69-75` does) bound the three numbers with Task 1's limits; `customerPropertyFactsPatchSchema` (insert, minus `customerId`, partial, **strict**); types `CustomerPropertyFactsRow`, `CustomerPropertyFactsPatch`, `PropertyFactKey = keyof CustomerPropertyFactsPatch`.
  - The number limits live in Zod only, as the customer's age does (`customers.ts:77`): every write passes `spec.schemas.update`. The database check is for the one rule a write could break across two columns.
  - `CUSTOMER_PROPERTY_FACTS = 'CustomerPropertyFacts' as const`
  - `customerPropertyFactsServerSpec`: `defineSubEntitySpec` with `primaryKey: 'customerId'` and `parent: { spec: customerServerSpec, fk: customerPropertyFacts.customerId, field: 'propertyFacts' }`.
  - `withYearBuiltRule(patch: CustomerPropertyFactsPatch): CustomerPropertyFactsPatch`
  - `upsertCustomerPropertyFacts(ctx: ScopedContext, input: { customerId: string, patch: CustomerPropertyFactsPatch }): Promise<DalReturn<CustomerPropertyFactsRow>>`. Every writer of Property facts, in this plan and the later ones, goes through this function: a direct `upsertOneToOne` call skips the year-built rule.

- [ ] **Step 1: Write the failing test for the year-built rule**

```ts
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed
import { describe, it } from 'node:test'
import { withYearBuiltRule } from './year-built-rule'

describe('withYearBuiltRule', () => {
  it('an exact year clears the range', () => {
    assert.deepEqual(withYearBuiltRule({ yearBuiltExact: 1962 }), { yearBuiltExact: 1962, yearBuilt: null })
  })
  it('a picked range clears the exact year', () => {
    assert.deepEqual(withYearBuiltRule({ yearBuilt: '1950-1978' }), { yearBuilt: '1950-1978', yearBuiltExact: null })
  })
  it('the exact year wins when a patch names both', () => {
    assert.deepEqual(withYearBuiltRule({ yearBuiltExact: 1962, yearBuilt: 'Post-2014' }), { yearBuiltExact: 1962, yearBuilt: null })
  })
  it('clearing one leaves the other untouched', () => {
    assert.deepEqual(withYearBuiltRule({ yearBuiltExact: null }), { yearBuiltExact: null })
    assert.deepEqual(withYearBuiltRule({ yearBuilt: null }), { yearBuilt: null })
  })
  it('a patch about something else passes through', () => {
    assert.deepEqual(withYearBuiltRule({ pool: true }), { pool: true })
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm exec tsx --test src/shared/modules/customers/core/lib/year-built-rule.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the schema file** to the table above, copying the form of `customer-profiles.ts` (helpers, `createSelectSchema`, `createInsertSchema` with overrides, the patch schema and its comment "undefined = untouched, null = clear"). Add the barrel line. If tsc refuses a strict object as the spec's `update` schema (`ZodObjectAny`, `src/shared/dal/server/types.ts:114`), stop and report; do not move the strictness to the routers.

- [ ] **Step 4: Declare the record.** Add the name constant, the spec, and the spec's entry in `ENTITY_NAMES`, the `ServerSpec` union and `SERVER_SPECS`. In `constants.ts`, the comment on the new constant says only that it is a part of the customer named `propertyFacts` in rules; reword the two comments above it that claim a 1:1 child has its own subject. On the spec, one comment names the trap: writes go through `upsertCustomerPropertyFacts`, or the database refuses a row holding both year forms.

- [ ] **Step 5: Grant it.** In `agent.ts` the update list becomes `['age', 'profile', 'profile.*', 'propertyFacts', 'propertyFacts.*']`. In `dispatcher.ts` add the same two entries to its list. Reword the comment above each grant, which says the profile is the only part written. In `must-not-compile.ts` replace both `'profile.hoa'` with `'profile.ageGroup'` and add `'propertyFacts'`, `'propertyFacts.*'`, `'propertyFacts.hoa'` to `customerFields`, plus `ability.can('update', 'Customer', 'propertyFacts.hoa')` beside the profile line.

  The unbuilt energy-impact plan adds `'utilityBills', 'utilityBills.*'` to the same two lists and its own entries at the same points in the three registries. Whichever lands second keeps both: `['age', 'profile', 'profile.*', 'propertyFacts', 'propertyFacts.*', 'utilityBills', 'utilityBills.*']`.

- [ ] **Step 6: Implement `withYearBuiltRule`** and the mutation. The mutation is `upsertOneToOne(ctx, customerPropertyFactsServerSpec, input.customerId, withYearBuiltRule(input.patch))`, with a one-line doc comment in the manner of `upsertCustomerProfile`.

- [ ] **Step 7: Run the test and the checks**

Run: the test from Step 2. Expected: 5 pass.
Run: tsc under the lock. Expected: clean. A failure in `must-not-compile.ts` means a list in Step 4 was missed.
Run: eslint on the touched files under the lock. Expected: clean.

- [ ] **Step 8: The new table on dev. OPEN: the owner's ruling.**

Do not run a plain `pnpm db:push:dev` (Global Constraints: it offers to drop other branches' tables). How this one table reaches the shared dev database is not settled. The step is written here once the owner rules; until then, stop and report. Tasks 3 and 4 Steps 1 to 4 type-check without the table; Task 4 Step 5 and the PR's preview need it.

- [ ] **Step 9: Commit**

```bash
git add src/shared/db/schema/customer-property-facts.ts src/shared/db/schema/index.ts src/shared/entities/customers/lib/constants.ts src/shared/entities/customers/lib/server-spec.ts src/shared/domains/permissions/abilities.ts src/shared/domains/permissions/specs.ts src/shared/dal/server/specs.ts src/shared/domains/permissions/rules/agent.ts src/shared/domains/permissions/rules/dispatcher.ts src/shared/domains/permissions/type-checks/must-not-compile.ts src/shared/modules/customers/core/lib/year-built-rule.ts src/shared/modules/customers/core/lib/year-built-rule.test.ts src/shared/entities/customers/dal/server/mutations.ts
git commit -m "feat(customers): property facts are a part of the customer, with their own record and grant"
```

---

### Task 3: The switch (one change: readers, writers and the eight columns)

After this task nothing in `src` reads or writes a property column on `customer_profiles`. The eight columns stay in the schema file under `*Deprecated` property names, so a push proposes no change to them.

**Files:**
- Modify: `src/shared/db/schema/customer-profiles.ts` (the eight property columns become `*Deprecated` properties on the same database columns; their enum imports go; the patch schema becomes strict)
- Modify: `src/shared/entities/customers/schemas/index.ts`
- Create: `src/shared/modules/customers/core/constants/property-fact-fields.ts`
- Delete: `src/shared/entities/customers/constants/property-profile-fields.ts`
- Create: `src/features/meeting-flow/constants/context-property-fact-fields.ts`
- Create: `src/shared/modules/customers/core/lib/property-facts-select.ts`
- Modify: `src/shared/entities/customers/lib/profile-select.ts` (strips the eight `*Deprecated` columns; drop the column count from its comment)
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (`CustomerWithProfile`, `getCustomer`)
- Modify: `src/shared/entities/customers/dal/server/get-customer-profile.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (`getByIdWithJoins`, the nested customer)
- Create: `src/trpc/routers/customers.router/property-facts.router.ts`; modify `src/trpc/routers/customers.router/index.ts` to mount it as `propertyFacts`, beside `profile`
- Modify: `src/trpc/routers/meeting-flow.router.ts`
- Modify: `src/shared/entities/customers/hooks/use-customer-edit-form.ts`, `src/shared/entities/customers/lib/build-customer-form-defaults.ts`, `src/shared/entities/customers/types.ts`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-details.tsx`
- Modify: `src/features/meeting-flow/ui/components/context-panel.tsx`, `src/features/meeting-flow/lib/context-fill-count.ts`, `src/features/meeting-flow/ui/views/meeting-flow.tsx`
- Modify: `src/features/meeting-flow/lib/build-persona-profile.ts` (only if tsc asks), `src/shared/entities/customers/lib/customer-predicates.ts` (only if tsc asks)
- Delete: `scripts/clear-old-insulation-levels.ts` (its column is gone)
- Modify: `src/shared/entities/customers/DOCS.md` (lines 98, 101, 122, 133, 134: the key lists, the key count and the file names; line 128: the profile is a field of `Customer`, not its own subject)

**Interfaces:**
- Consumes: Task 2's table, schemas, `PropertyFactKey`, spec and mutation; Task 1's limits and lists.
- Produces:
  - `PROPERTY_FACT_FIELDS`, the one hand-written list of the facts, each id typed `PropertyFactKey`, in this order:

    | id | label | type | options and limits |
    |---|---|---|---|
    | `yearBuiltExact` | Year Built (exact) | number | `YEAR_BUILT_EXACT_MIN`, `YEAR_BUILT_EXACT_MAX` |
    | `yearBuilt` | Year Built | select | `yearBuiltRanges` |
    | `numStories` | Stories | number | `NUM_STORIES_MIN`, `NUM_STORIES_MAX` |
    | `roofType` | Roof Type | select | `roofTypes` |
    | `foundationType` | Foundation Type | select | `foundationTypes` |
    | `lotSizeSqft` | Lot Size (sq ft) | number | `LOT_SIZE_SQFT_MIN` |
    | `garage` | Garage | select | `garageTypes` |
    | `pool` | Pool | boolean | |
    | `hoa` | HOA | boolean | |
    | `climate` | Coastal or Inland | select | `CLIMATES`, labels `CLIMATE_LABELS` |

    A compile-time check in the same file holds that the ids are exactly `PropertyFactKey`: a missing, extra or misspelt id fails tsc.
  - `PROPERTY_FACT_COLUMN_KEYS`, in the same file, worked out from the list (`PROPERTY_FACT_FIELDS.map(f => f.id)`), never written out.
  - `CONTEXT_PROPERTY_FACT_FIELDS`: the entries of `PROPERTY_FACT_FIELDS` whose id is `yearBuilt`, `roofType`, `foundationType` or `hoa`, filtered from the one list and so in its order (the `CUSTOMER_OVERVIEW_PROFILE_FIELDS` form, `customer-overview-profile-fields.ts:6-10`).
  - In `schemas/index.ts`: `PROPERTY_PROFILE_COLUMN_KEYS` is removed. `PROFILE_COLUMN_KEYS` is the customer and financial keys only.
  - `propertyFactsCols()`: the table's columns minus `customerId`, `createdAt`, `updatedAt`, as `profileCols()` does.
  - `CustomerWithProfile` gains `& { [K in PropertyFactKey]: CustomerPropertyFactsRow[K] | null }`. The type keeps its name.
  - `trpc.customersRouter.propertyFacts.upsert`: `agentProcedure`, input `{ id: uuid, data: customerPropertyFactsPatchSchema }`, calls `upsertCustomerPropertyFacts`.
  - `trpc.meetingFlowRouter.updateCustomerPropertyFacts`: input `{ meetingId: uuid, customerId: uuid, patch: customerPropertyFactsPatchSchema }`, calls the same mutation and publishes `meeting.updated` exactly as `updateCustomerProfile` does. Both procedures publish through one file-local `publishMeetingUpdated(meetingId, fields)`.
  - `CustomerFormValues` gains `Partial<Pick<CustomerWithProfile, PropertyFactKey>>`.

- [ ] **Step 1: The one list.** Write `property-fact-fields.ts` with the ten fields, the id check and the derived key list, and `context-property-fact-fields.ts`. Delete `property-profile-fields.ts`.

- [ ] **Step 2: Freeze the eight columns** in `customer-profiles.ts` and update the key lists in `schemas/index.ts`. Each keeps its database name and type, loses its enum, and carries `/** @deprecated */`: `hoaDeprecated: boolean('hoa')`, `yearBuiltDeprecated: text('year_built')`, `roofTypeDeprecated: text('roof_type')`, `foundationTypeDeprecated: text('foundation_type')`, `hvacTypeDeprecated: text('hvac_type')`, `hvacComponentsDeprecated: text('hvac_components')`, `windowsTypeDeprecated: text('windows_type')`, `insulationLevelDeprecated: text('insulation_level')`. One comment above them gives the trap: removing a property here makes the next push drop a column that deployed code and open branches still select. Then keep them out of every path:
  - `profileCols()` strips the eight beside `customerId` and the timestamps;
  - `insertCustomerProfileSchema` omits them, so the patch schema cannot name them;
  - `customerProfilePatchSchema` becomes strict where it is defined (the routers pass it as it is);
  - no key list holds them.

- [ ] **Step 3: Reads.** Add `...propertyFactsCols()` and a `leftJoin(customerPropertyFacts, eq(customerPropertyFacts.customerId, customers.id))` at the three sites, each directly after the profile's spread and join. Widen `CustomerWithProfile`. `getCustomer` and `getByIdWithJoins` end in a cast, so tsc does not notice a forgotten spread: check all three by eye.

- [ ] **Step 4: Writes.** Add the two procedures and the shared publish helper.

- [ ] **Step 5: The edit form.** In `use-customer-edit-form.ts`:
  - add `canEditPropertyFacts = ability.can('update', 'Customer', 'propertyFacts')` and include it in `canEdit`;
  - add a third mutation on `propertyFacts.upsert` with the same `invalidateCustomer` on success, and include it in `isPending`;
  - work the dirty patch out in one local function used by the profile block and the new block (dirty keys from a key list, `undefined` sent as `null`);
  - after a successful save the form is reset to the customer as saved, and again whenever the customer row changes while the form is not being edited. Today a saved field stays dirty, so a second save in the same open profile would send the old exact year along with a newly picked range, and the exact year would win.

  `buildCustomerFormDefaults` seeds both key lists with the stored values. It does not seed `yearBuilt` with a worked-out range: the range field holds only a range a person picked.

- [ ] **Step 6: The meeting flow.** In `meeting-flow.tsx`, `handleCustomerProfileChange` splits the incoming patch by `PROPERTY_FACT_COLUMN_KEYS` membership and sends each **non-empty** part through its own writer (a second `QueryMutationObserver` on `updateCustomerPropertyFacts`, same handlers as the first). The panel sends one key at a time, so one part is always empty, and an empty patch is refused by `upsertOneToOne`. `context-panel.tsx` and `context-fill-count.ts` use `CONTEXT_PROPERTY_FACT_FIELDS`.

- [ ] **Step 7: The profile card** in `customer-profile-details.tsx` reads `pickProfileColumns(customer, PROPERTY_FACT_COLUMN_KEYS)`, lists `PROPERTY_FACT_FIELDS`, uses `canEditPropertyFacts` for `canEditField`, and is titled "Property Facts".

- [ ] **Step 8: Checks**

Run: `git grep -n -e hvacType -e hvacComponents -e windowsType -e insulationLevel -- src/shared/db src/shared/entities/customers src/shared/modules/customers src/features/meeting-flow src/trpc`
Expected: only the four `*Deprecated` lines in `customer-profiles.ts`.
Run: `git grep -n -e PROPERTY_PROFILE -e property-profile-fields -- src`
Expected: no output.
Run: tsc, then eslint on the touched files, under the lock. Expected: clean.

- [ ] **Step 9: Commit**, in one commit. The delete and the removed file are staged with `git rm`.

```bash
git rm src/shared/entities/customers/constants/property-profile-fields.ts scripts/clear-old-insulation-levels.ts
git add src/shared/db/schema/customer-profiles.ts src/shared/entities/customers/schemas/index.ts src/shared/modules/customers/core/constants/property-fact-fields.ts src/features/meeting-flow/constants/context-property-fact-fields.ts src/shared/modules/customers/core/lib/property-facts-select.ts src/shared/entities/customers/lib/profile-select.ts src/shared/entities/customers/dal/server/queries.ts src/shared/entities/customers/dal/server/get-customer-profile.ts src/shared/entities/meetings/dal/server/queries.ts src/trpc/routers/customers.router/property-facts.router.ts src/trpc/routers/customers.router/index.ts src/trpc/routers/meeting-flow.router.ts src/shared/entities/customers/hooks/use-customer-edit-form.ts src/shared/entities/customers/lib/build-customer-form-defaults.ts src/shared/entities/customers/types.ts src/shared/entities/customers/components/profile/customer-profile-details.tsx src/features/meeting-flow/ui/components/context-panel.tsx src/features/meeting-flow/lib/context-fill-count.ts src/features/meeting-flow/ui/views/meeting-flow.tsx src/shared/entities/customers/DOCS.md
git commit -m "refactor(customers): the home's facts read and write on property facts; HVAC, windows and insulation leave the profile"
```

Add `build-persona-profile.ts` and `customer-predicates.ts` to the `git add` only if tsc made you change them.

---

### Task 4: The year a person sees, and a look at it

**Files:**
- Modify: `src/features/meeting-flow/ui/components/context-panel.tsx`, `src/features/meeting-flow/lib/context-fill-count.ts`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-details.tsx`

**Interfaces:**
- Consumes: `yearBuiltRangeOf` (Task 1), `CONTEXT_PROPERTY_FACT_FIELDS` (Task 3).

- [ ] **Step 1: The context panel's Property section** passes the customer row as its `values` with `yearBuilt` replaced by `yearBuiltRangeOf(customerRow)`. `context-fill-count.ts` counts the same list against the same values, so a home with an exact year counts as filled.

- [ ] **Step 2: The profile's Property Facts card** shows `yearBuilt` as `yearBuiltRangeOf(customer)` in read mode, and the raw `yearBuiltExact` beside it. In edit mode both fields show what is stored.

- [ ] **Step 3: Checks**

Run: tsc, then eslint on the touched files, under the lock. Expected: clean.

- [ ] **Step 4: Look at it, with no row.** Needs the table on dev (Task 2 Step 8). The owner's dev server must answer on this worktree's port (`ss -ltnp`); if it does not, stop and ask the owner to start it. Sign in with `/api/dev/playwright-session?…&as=info%40triprosremodeling.com` and take three shots, changing no data: a customer profile in read mode; the same in edit mode with the Property Facts card open; a meeting's context panel with the Property section open. Check: ten fields in the card in the table's order, four in the panel, no HVAC, windows or insulation field anywhere, nothing clipped at phone width.

- [ ] **Step 5: Ask the owner for the hand check**, on dev, on one customer who has a meeting. Agents write no rows. Report each line as seen or not seen:
  1. Type an exact year (1962) on the profile and save: read mode shows 1950-1978 with 1962 beside it.
  2. Without closing the profile, edit again, pick the range Post-2014 and save: read mode shows Post-2014 and no exact year.
  3. Open that customer's meeting: the context panel's Property section shows Post-2014, and counts it as filled.
  4. Pick a roof type in the panel: no error toast, and the profile shows it after a reload.

- [ ] **Step 6: Commit**

```bash
git add src/features/meeting-flow/ui/components/context-panel.tsx src/features/meeting-flow/lib/context-fill-count.ts src/shared/entities/customers/components/profile/customer-profile-details.tsx
git commit -m "feat(customers): year built shows the era worked out from the exact year, on the profile and in the meeting panel"
```

---

### Task 5: Ship

- [ ] **Step 1: Whole-branch checks.** `pnpm lint` and `pnpm tsc` under the lock, and both test files. Expected: clean, 10 pass.

- [ ] **Step 2: Open the PR** from `feat/property-facts` with the template. The description carries:
  - the owner's one prod step: **before merging**, from this branch, `pnpm db:push:prod`. Expected: one new empty table, `customer_property_facts`, and nothing else. If it offers anything else, abort: whether prod is also ahead of `origin/main` was not checked. The table must exist before the new code goes live. Nothing is dropped on prod;
  - a note that the preview reads the dev database when one is set for it (`src/shared/db/index.ts:9-11`), so the preview's customer pages need the table there too. Which database the preview environment names was not checked; ask the owner.

- [ ] **Step 3: Record it, in the trade-scenes worktree.** Add the shipped commit to the tracker row TS4 in `docs/plans/2026-10-16-trade-scenes-epic.md`, confirm T23 (drop the eight frozen columns) is still open there, strike the run of `clear-old-insulation-levels.ts` from `docs/superpowers/plans/2026-10-30-up-close-on-a-system.md` (line 928), and delete this plan file once the PR merges.

---

## What this plan leaves for the next ones

- Plan 2 adds `electricProvider`, `gasProvider` and `climateZone` to this table and to `PROPERTY_FACT_FIELDS`, and makes an empty `climate` follow the zone. A select or a switch on the profile cannot go back to "not known" today; coastal or inland needs that way back once empty means "follows the zone".
- Plans 2, 3 and 4 write Property facts through `upsertCustomerPropertyFacts` only. Plan 4's translator turns an answer outside the limits (a lot size of 0) into "not known" before the write.
- Plan 3 builds the `PropertyProfile` mapper on `yearBuiltRangeOf` and saves the scene's year built, roof type, foundation and coastal or inland.
- Plan 5 adds the four climate overrides.
- The calculators' `numStories` limits (`src/features/calculators/scope-pricing-calculator/schemas/form.ts:8`) repeat 1 and 4; that file reads `NUM_STORIES_MIN` and `NUM_STORIES_MAX` when the calculators work next touches it.
- The customers-module design (`docs/superpowers/specs/2026-09-29-customers-module-design.md`, owner review pending) folds each meeting-flow profile write into the customer's own write with an optional meeting. If it is approved, `updateCustomerPropertyFacts` goes the same way as `updateCustomerProfile`.
