# Filter grouping fields (FR0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meetings get two filter grouping fields, **Sit** and **Outcome type**, on today's flat toolbar for the meetings records page (`pm`) and the schedule (`s`). Both are compiled through one generic classifier inverse, `valuesInGroups`, which replaces `stagesForBuckets`.

**Architecture:** A filter grouping field is an ordinary static `multiSelect` field whose values are a classifier's groups. Its SQL is `inArray(column, valuesInGroups(map, groups))`, the projects `statusBucket` pattern. No new filter kind, parser, control or chip. The URL keys (`pm_sit`, `s_outcomeSentiment`, …), server prefetch, popover and chips all come from the existing toolkit.

**Tech Stack:** TypeScript, Drizzle (`inArray`, `PgDialect`), zod 4, nuqs, Radix Popover, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-21-data-view-filter-rules-design.md` §4 (approved 2026-10-22; O12–O14 from this plan's stress test). Tracker row FR0 in `docs/plans/2026-10-21-data-view-filter-rules-epic.md`.

**Stress test 2026-10-22:** four lenses; 8.5/10 on conventions. Two HIGH findings (popover overflow, commit safety), seven MEDIUM and eight LOW, all folded in below. Owner rulings O12 (popover fix in FR0), O13 (Title Case labels), O14 (colour maps retyped in FR0).

## Global Constraints

- **Labels (O1, O13):** field **Sit** has values Sat · Didn't Sit · Not Set. Field **Outcome type** has values Positive · Neutral · Negative · Not Set. Values keep that order, in Title Case, matching `MEETING_OUTCOME_LABELS` (`'Not Set'`, `'No Show'`) and `PROJECT_STATUS_BUCKET_LABELS` (`'On Hold'`).
- **Field ids:** `sit`, `outcomeSentiment`. Neither is in `RESERVED_URL_SUFFIXES` (`src/shared/dal/lib/query/constants.ts:11`).
- **No hard-coded value lists in app code.** Do not hard-code a list of outcomes or meeting types; every value set derives from `MEETING_OUTCOME_SIT` / `MEETING_OUTCOME_SENTIMENT` (anti-goal, spec §2). Tests may name literal outcomes, because they pin the spec's business values.
- **"Not Set" is its own group,** never folded into another.
- **Edit the meetings field files in place.** `meeting-fields.ts` and `meeting-field-sql.ts` stay under `src/shared/entities/meetings/`; they move with the modules consolidation, not here. New meetings code goes in `src/shared/modules/meetings/core/`.
- **Gates:** `pnpm tsc` and `pnpm lint` only, run under `flock .superpowers/heavy.lock`. Never `pnpm build`. Run `git diff --shortstat` after each task; every target file is LF today.
- **No DB writes for testing.** `/api/dev/playwright-session?role=<role>` creates the `dev+<role>` fixture user on first use (`route.ts:78-90`). That is the existing sign-in ritual, not test data. Never print `DEV_LOGIN_SECRET`.
- **Commits on the shared main tree.** The index often holds another session's staged work, and three past sweeps are recorded in memory `feedback-subagent-shared-tree-safety`. Every commit follows this shape:
  1. `git diff --cached --name-only` prints nothing (if it prints anything, STOP and report).
  2. `git add <new files only>`.
  3. A separate Bash call that starts with `git commit -F - -- <every path of the task>`, with a heredoc message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, and a timeout of at least 300000 ms (the pre-commit hook takes about 110 s).
  4. `git show --stat HEAD` lists exactly the task's paths.

  Never use `git add -A`, `git add .`, `git add -u`, `git commit --amend` in any form, stash, reset, checkout or restore. If a commit comes out wrong, STOP and report.
- **Comments say why, never what.** Tests carry the `// eslint-disable-next-line test/no-import-node-test -- tests run on node:test via tsx; vitest is not installed` line above the `node:test` import, as `to-meeting-reps.test.ts` does.

## Review Focus

1. **A hand-typed bad value** such as `pm_sit=sat,bogus` or `s_outcomeSentiment=great`: the page loads, the field reads as off, and nothing throws. `multiSelect` builds `z.array(z.enum(values))` (`field-list.ts:122`), and `derive-data-view-input.ts` drops the value when `safeParse` fails. Pinned in Task 2 by a schema test.
2. **Reloading with a grouping filter in the URL** (`/dashboard/meetings?pm_sit=sat`): the server prefetch (`(records)/meetings/page.tsx:23`, `schedule/page.tsx:39`) and the client derive the same input. No `[data-view] suspense read on the server without a prefetch` error (`use-server-prefetch-guard.ts:13`), and the rows stay put after hydration. Pinned in Task 3.
3. **Twelve filters in the popover on a short screen (O12):** every control, Pipeline last, is reachable at 1440×900 and 1280×720 by scrolling inside the popover. Pinned in Task 3.
4. **Sit and Outcome together with Outcome:** `pm_sit=sat&pm_outcome=no_show` ANDs to zero rows and shows the empty state, not an error. Pinned in Task 2 by an SQL test, and checked by eye in Task 3.
5. **The schedule's Show switch:** activities must not inherit `s_sit`. `SCHEDULE_ACTIVITIES_QUERY.toolbar` is type-checked against the meetings toolbar ids (`schedule-queries.ts:31`). Covered by `pnpm tsc` in Task 2, and checked by eye in Task 3.

---

### Task 0: Commit the approved docs (controller, before any dispatch)

The spec, this plan and the tracker are untracked, and the CONTEXT.md filter terms share a diff with another session's energy-impact edits. A worktree or subagent would see none of them.

- [ ] **Step 1:** `git diff --cached --name-only` prints nothing.
- [ ] **Step 2:** Stage the docs:
  - `git add docs/superpowers/specs/2026-10-21-data-view-filter-rules-design.md docs/superpowers/plans/2026-10-22-filter-grouping-fields.md docs/plans/2026-10-21-data-view-filter-rules-epic.md`
  - Save `git diff CONTEXT.md` to a patch in the scratchpad.
  - Cut the patch down to the filter hunks only: the Data view terms "Filter rule" … "Quick filter" and "Outcome type", plus the Flagged ambiguities "sits" note.
  - `git apply --cached` that patch.
- [ ] **Step 3:** Check the index before committing:
  - `git diff --cached --name-only` lists exactly those 4 paths;
  - `git diff --cached CONTEXT.md` shows only filter hunks.

  Then, in a separate call that starts with `git commit -F -` (no pathspec here, because a pathspec would commit the energy hunks too), commit with the message `docs(filter-rules): data-view filter rules spec, FR0 plan, tracker and filter terms`.

### Task 1: The group lists and their one inverse, `valuesInGroups`

**Files:**
- Create: `src/shared/lib/values-in-groups.ts`
- Test: `src/shared/lib/values-in-groups.test.ts`
- Modify: `src/shared/constants/enums/meetings.ts:71,108` (the two bare unions become value lists with derived types)
- Modify: `src/shared/entities/meetings/constants/status-colors.ts:9` and `src/features/schedule-management/constants/schedule-calendar-config.ts:17` (O14: `Record<MeetingOutcomeSentiment, string>`, type-only import)
- Modify: `src/shared/constants/enums/pipelines.ts:109-118` (delete `stagesForBuckets` and its doc comment)
- Modify: `src/shared/modules/projects/core/dal/server/project-field-sql.ts:3,14`
- Modify: `src/shared/modules/projects/core/DOCS.md:99,101`

Placement (P1): `src/shared/lib/` holds this because it is a generic `Record` inverse that belongs in no `<domain>.ts` enums file. The enums files do export domain predicates (`isSit`, `deriveProjectStatusBucket`), so placement is not about functions versus constants.

**Interfaces:**
- **Produces:**
  - `export function valuesInGroups<V extends string, G extends string>(map: Record<V, G>, groups: readonly G[]): V[]`. It returns the map's keys whose group is in `groups`, in key order; empty `groups` gives `[]`.
  - `export const meetingSits = ['sat', 'not_sat', 'unknown'] as const` and `export type MeetingSit = (typeof meetingSits)[number]`.
  - `export const meetingOutcomeSentiments = ['positive', 'neutral', 'negative', 'unset'] as const` and `export type MeetingOutcomeSentiment = (typeof meetingOutcomeSentiments)[number]`.

  Both lists are re-exported through the enums barrel. The unions stay identical, so `analytics-rules.ts` and `analytics/types` need no change. List order is picker order.

- [ ] **Step 1: Write the failing test** `values-in-groups.test.ts`, `describe('valuesInGroups')`:
  - `it('returns the keys whose group is picked, in map order')`: `valuesInGroups({ a: 'x', b: 'y', c: 'x' }, ['x'])` deep-equals `['a', 'c']`.
  - `it('returns nothing for no groups')`: `valuesInGroups(MEETING_OUTCOME_SIT, [])` deep-equals `[]`.
  - `it('splits the project stages across the status buckets, each once')`, which is the behaviour `stagesForBuckets` had: `projectStatusBuckets.flatMap(bucket => valuesInGroups(PROJECT_STAGE_BUCKET, [bucket]))`, sorted, deep-equals `[...projectPipelineStages].sort()`.
  - `it('splits the meeting outcomes across the sit groups, each once')`: the same over `meetingSits` and `MEETING_OUTCOME_SIT` against `meetingOutcomes`.

  The domain values ("Not Set" = `not_set` only, Positive = the two revenue outcomes) are pinned in Task 2's SQL test, not here.

- [ ] **Step 2: Run it and check it fails.**

  Run: `pnpm exec tsx --test src/shared/lib/values-in-groups.test.ts`
  Expected: FAIL, cannot find module `./values-in-groups`.

- [ ] **Step 3: Value lists.** In `meetings.ts`, replace `export type MeetingOutcomeSentiment = 'positive' | 'neutral' | 'negative' | 'unset'` and `export type MeetingSit = 'sat' | 'not_sat' | 'unknown'` with the lists and derived types from Interfaces, at the same spots.

  In `status-colors.ts:9` (`OutcomeColorScheme`) and `schedule-calendar-config.ts:17` (`CALENDAR_ACCENT_BY_SENTIMENT`), replace the hand-typed `'positive' | 'negative' | 'neutral' | 'unset'` with `MeetingOutcomeSentiment`, imported type-only from `@/shared/constants/enums/meetings`. A new group then fails tsc instead of rendering with no colour.

- [ ] **Step 4: Implement `valuesInGroups`** in `values-in-groups.ts` as a named export: `getTypedKeys(map).filter(value => groups.includes(map[value]))`. Import `getTypedKeys` from `@/shared/types` (`src/shared/types/index.ts:12`, which has no dependencies). Use no cast and no comment: `keyof Record<V, G>` is `V`.

- [ ] **Step 5: Run it and check it passes.**

  Run: `pnpm exec tsx --test src/shared/lib/values-in-groups.test.ts`
  Expected: PASS, 4 tests.

- [ ] **Step 6: Fold `stagesForBuckets` in.**
  - Delete it from `pipelines.ts`.
  - In `project-field-sql.ts`, import `PROJECT_STAGE_BUCKET` from `@/shared/constants/enums` and `valuesInGroups` from `@/shared/lib/values-in-groups`.
  - The `statusBucket` condition becomes `v => inArray(sql\`coalesce(${projects.pipelineStage}, 'closed')\`, valuesInGroups(PROJECT_STAGE_BUCKET, v))`. Drop the `v.length > 0` guard: `where` skips an empty multi-select before it calls a condition (`field-sql.ts:62`). Keep the existing comment.
  - In `DOCS.md`, rewrite line 99's grouping sentence (it names `ACTIVE_PROJECT_STAGES` / `ON_HOLD_PROJECT_STAGES`, which don't exist) and line 101's `stagesForBuckets`. Both now say that grouping expands buckets through `valuesInGroups(PROJECT_STAGE_BUCKET, …)`, and that the dashboard's Active / On hold sections pin `statusBucket` (`dashboard-queries.ts`).

- [ ] **Step 7: Run the checks.**

  Run: `grep -rn "stagesForBuckets" src` → no output.
  Run: `flock .superpowers/heavy.lock pnpm tsc && flock .superpowers/heavy.lock pnpm lint` → both clean.
  Run: `git diff --shortstat` → only this task's 8 files.

- [ ] **Step 8: Commit** per Global Constraints. `git add` the two new files, then:
  `git commit -F - -- src/shared/lib/values-in-groups.ts src/shared/lib/values-in-groups.test.ts src/shared/constants/enums/meetings.ts src/shared/entities/meetings/constants/status-colors.ts src/features/schedule-management/constants/schedule-calendar-config.ts src/shared/constants/enums/pipelines.ts src/shared/modules/projects/core/dal/server/project-field-sql.ts src/shared/modules/projects/core/DOCS.md`
  Message: `refactor(query): one classifier inverse, valuesInGroups, replaces stagesForBuckets; sit and outcome-type value lists (FR0)`.

### Task 2: Sit and Outcome type on meetings

**Files:**
- Create: `src/shared/modules/meetings/core/constants/outcome-labels.ts` (the folder is new; the name mirrors `modules/projects/core/constants/status-labels.ts`)
- Modify: `src/shared/entities/meetings/dal/meeting-fields.ts` (add `sit` and `outcomeSentiment` right after `outcome`)
- Modify: `src/shared/entities/meetings/dal/server/meeting-field-sql.ts` (their `filter` entries right after `outcome`; no sort entries)
- Modify: `src/features/records-management/constants/meetings-records-table-view.ts:12` and `src/features/schedule-management/constants/schedule-queries.ts:22` (`'sit', 'outcomeSentiment'` after `'outcome'` in each `toolbar`)
- Modify: `src/shared/components/data-view/query-toolbar/ui/filter-trigger.tsx:76` (O12)
- Test: `src/shared/entities/meetings/dal/server/meeting-field-sql.test.ts`

**Interfaces:**
- **Consumes:** `valuesInGroups`, `meetingSits` and `meetingOutcomeSentiments` (Task 1).
- **Produces:**
  - `MEETING_SIT_LABELS: Record<MeetingSit, string>` = `{ sat: 'Sat', not_sat: "Didn't Sit", unknown: MEETING_OUTCOME_LABELS.not_set }`.
  - `MEETING_OUTCOME_SENTIMENT_LABELS: Record<MeetingOutcomeSentiment, string>` = `{ positive: 'Positive', neutral: 'Neutral', negative: 'Negative', unset: MEETING_OUTCOME_LABELS.not_set }`.

    `MEETING_OUTCOME_LABELS` comes from `@/shared/entities/meetings/constants/status-colors`, so the "Not Set" spelling has one source.
  - `MEETING_FIELDS` ids `sit` and `outcomeSentiment`. FR4 uses them as filter-rule fields unchanged.

- [ ] **Step 1: Write the failing test** `meeting-field-sql.test.ts`. Render with `new PgDialect().sqlToQuery(MEETING_FIELD_SQL.where(filters)!)` from `drizzle-orm/pg-core`. `describe('meeting filter grouping fields')`:
  - `it('Sit: Not Set matches only not_set')`: `where({ sit: ['unknown'] })` → `sql` deep-equals `'"meetings"."meeting_outcome" in ($1)'` and `params` deep-equals `['not_set']`.
  - `it('Sit: Sat covers sat outcomes and leaves out the rest')`: `where({ sit: ['sat'] })` → `params` include `'not_good'`, `'follow_up_needed'` and `'converted_to_project'`, and exclude `'not_set'`, `'no_show'`, `'cancelled'` and `'rescheduled'`.
  - `it('Outcome type: Positive is the two revenue outcomes')`: `where({ outcomeSentiment: ['positive'] })` → sorted `params` deep-equals `['additional_work', 'converted_to_project']`.
  - `it('Outcome type: Not Set matches only not_set')`: `where({ outcomeSentiment: ['unset'] })` → `params` deep-equals `['not_set']`.
  - `it('ANDs a grouping field with Outcome')`: `where({ sit: ['sat'], outcome: ['no_show'] })` → `sql` contains `' and '` and `params` include `'no_show'`.
  - `it('drops a value outside the groups')`: `MEETING_FIELDS.sit.filter.schema.safeParse(['sat', 'bogus']).success` is `false`, and `MEETING_FIELDS.outcomeSentiment.filter.schema.safeParse(['great']).success` is `false`.

  Don't assert a whole negative or neutral list: unshipped `0d0d33896` reclassifies `rescheduled`, and the map is the source of truth.

- [ ] **Step 2: Run it and check it fails.**

  Run: `NODE_OPTIONS="--conditions=react-server" pnpm exec tsx --test src/shared/entities/meetings/dal/server/meeting-field-sql.test.ts`
  Expected: FAIL. `where` skips ids it has no condition for (`field-sql.ts:62`), so it returns `undefined` and `sqlToQuery` throws a TypeError. `MEETING_FIELDS.sit` is also undefined.

  P2: `--conditions=react-server` lets the `server-only` import resolve, as the repo's scripts do (`package.json:32-36`). It is the first such test, and FR4's SQL tests reuse this exact command.

- [ ] **Step 3: Label maps.** Create `outcome-labels.ts` with the two maps from Interfaces. Import the group types type-only from `@/shared/constants/enums`, as `status-labels.ts` does.

- [ ] **Step 4: Fields.** In `meeting-fields.ts`, after `outcome`:
  - `sit: { label: 'Sit', filter: multiSelect({ values: meetingSits, optionLabel: sit => MEETING_SIT_LABELS[sit] }) }`
  - `outcomeSentiment: { label: 'Outcome type', filter: multiSelect({ values: meetingOutcomeSentiments, optionLabel: sentiment => MEETING_OUTCOME_SENTIMENT_LABELS[sentiment] }) }`

  Neither gets `sort` (P4: it would sort by the raw outcome, which `outcome` already does). The fields and their SQL land in one step pair, because `FieldSqlMap` makes a field without a condition fail tsc (`field-sql.ts:13`).

- [ ] **Step 5: SQL.** In `meeting-field-sql.ts`, after `outcome`:
  - `sit: v => inArray(meetings.meetingOutcome, valuesInGroups(MEETING_OUTCOME_SIT, v))`
  - `outcomeSentiment: v => inArray(meetings.meetingOutcome, valuesInGroups(MEETING_OUTCOME_SENTIMENT, v))`

  `meeting_outcome` is non-null with default `not_set` (`db/schema/meetings.ts:31`), so there is no `coalesce`.

- [ ] **Step 6: Toolbars.** Add `'sit', 'outcomeSentiment'` after `'outcome'` in the `pm` and `s` `toolbar` arrays. Leave the activities config untouched; its `satisfies` check proves there's no collision.

- [ ] **Step 7: Popover height (O12).** In `filter-trigger.tsx:76`, the `PopoverContent` className becomes `w-80 p-0 max-h-(--radix-popover-content-available-height) overflow-y-auto`. It is the same Radix idiom as `select.tsx:64` and `dropdown-menu.tsx:45`. The popover scrolls inside itself and stops at the edge of the screen.

- [ ] **Step 8: Run the test and the checks.**

  Run: `NODE_OPTIONS="--conditions=react-server" pnpm exec tsx --test src/shared/entities/meetings/dal/server/meeting-field-sql.test.ts` → PASS, 6 tests.
  Run: `flock .superpowers/heavy.lock pnpm tsc && flock .superpowers/heavy.lock pnpm lint` → both clean.
  Run: `git diff --shortstat` → only this task's 7 files.

- [ ] **Step 9: Commit** per Global Constraints. `git add` the two new files, then:
  `git commit -F - -- src/shared/modules/meetings/core/constants/outcome-labels.ts src/shared/entities/meetings/dal/meeting-fields.ts src/shared/entities/meetings/dal/server/meeting-field-sql.ts src/shared/entities/meetings/dal/server/meeting-field-sql.test.ts src/features/records-management/constants/meetings-records-table-view.ts src/features/schedule-management/constants/schedule-queries.ts src/shared/components/data-view/query-toolbar/ui/filter-trigger.tsx`
  Message: `feat(meetings): Sit and Outcome type filters on the meetings records page and the schedule; the Filters popover scrolls inside the screen (FR0)`.

### Task 3: Verify in the browser, then mark FR0 built

**Files:**
- Modify: `docs/plans/2026-10-21-data-view-filter-rules-epic.md` (FR0 row)
- Memory, outside the repo: `project-data-view-filter-rules.md` and `project-agent-dashboard.md:33` (both name `stagesForBuckets`)
- Screenshots go to the scratchpad's `fr0-shots/`, never the repo.

This is a verification task, so it has no test-first steps. It fails if any check below fails. Record each row count in the report.

- [ ] **Step 1: Find or start the dev server.** Run `ss -ltnp` for the `PORT` in `.env.local` (default 3000), and use the server that answers. If none does, run `pnpm dev` in the background. Read the secret into the URL inside the script; never print it.

- [ ] **Step 2: Records page, as super-admin.** Sign in with `role=super-admin&redirect=/dashboard/meetings` and open Filters.
  - The popover lists **Sit** and **Outcome type** after **Outcome**, with options in the order and spelling from Global Constraints.
  - At 1440×900 and at 1280×720, scrolling inside the popover reaches **Pipeline**, the last control (Review Focus 3).
  - Picking **Sat** writes `pm_sit=sat`, the row count drops, and a chip shows.
  - Adding Outcome **No Show** shows the empty state, not an error (Review Focus 4).
  - Reload `/dashboard/meetings?pm_sit=sat`. The rows stay the same through hydration, and the dev server log has no `[data-view] suspense read on the server without a prefetch` line (Review Focus 2).
  - Load `/dashboard/meetings?pm_sit=sat,bogus`. The page loads unfiltered with no Sit chip (Review Focus 1).

- [ ] **Step 3: Schedule.** The dev agent's current week can be empty, so check rows on a window that has meetings.
  - **As super-admin,** open `/dashboard/schedule?s_v=month`, moving `s_d` back a month at a time until meetings show. Outcome type **Positive** changes the meeting count, and a chip shows.
  - **Activities,** with `s_sit=sat` still in the URL: switch Show to **Activities**. The activity count matches the count without `s_sit`, and no Sit control shows (Review Focus 5).
  - **As agent** (`role=agent&redirect=/dashboard/schedule`): the Filters popover shows Sit and Outcome type.

  P5: FR0 adds no permission check, so the dispatcher pass that spec §10 asks for waits for FR6.

- [ ] **Step 4: Screenshots.** Take the Filters popover open with Sit picked, on the records page and on the schedule. Each in light and dark, at 1440×900 and 390×844.
  - At 390, it is the bottom sheet. Look at every shot.
  - Option text isn't clipped, and dark mode is legible.
  - The chip rail scrolls sideways (`chip-rail.tsx:51`), and its last chip is reachable.

- [ ] **Step 5: Mark it built.**
  - **Tracker:** the FR0 status becomes `[x] built <date> (<first>..<last> commits), not on prod`.
  - **Ship notes:**
    - "Outcome type: Negative" differs between local main and prod until `0d0d33896` ships.
    - Sit = Sat counts project visits too; the "Sits" quick filter that leaves them out (O7) comes with FR5.
  - **Memory:** update both files to name `valuesInGroups`.
  - **Commit** per Global Constraints: `git commit -F - -- docs/plans/2026-10-21-data-view-filter-rules-epic.md`, message `docs(filter-rules): FR0 built`.

## Plan calls (please check)

- **P1.** `valuesInGroups` lives in `src/shared/lib/`: it is a generic `Record` inverse that fits no domain enums file.
- **P2.** Tests that import `server-only` modules run with `NODE_OPTIONS="--conditions=react-server"`. FR4's SQL tests reuse the command.
- **P3.** Superseded by owner ruling O13 (Title Case).
- **P4.** Neither grouping field is sortable.
- **P5.** No dispatcher pass in FR0 (no permission check added); FR6 covers it.

Reported, out of FR0's scope:
- `DECIDED_OUTCOMES` (`meetings.ts:159`) is unused.
- `meetings-stat-config.ts:41` labels the negative group "Not Interested", and nothing appears to import it.
- Analytics' `MEETING_ORDER_LABELS.not_sat` = "Never sat" is a different axis (meeting order).
