# DV3a: one folder for every data view

> **Tracker:** `docs/plans/2026-10-12-data-views-epic.md` DV3a. **Owner rulings 2026-10-16:** (a) `entity-records-table.tsx`, `records-page-frame.tsx` and `page-bar.tsx` move under `data-view/`; (b) `query-toolbar/` moves under `data-view/`; (c) `constants/` folders stay as they are until the larger constants migration.
> **Shape:** path moves and import re-points only. No file's code changes except its import lines and the import order lint enforces. Ships to prod with DV3 and DV4.

## Target

```
src/shared/components/data-view/
  core/
    data-view.tsx
    lib/context.ts
    ui/  bar body boundary count empty pending root title toolbar  + page-bar, records-page-frame
  table/          ← shared/components/data-table/   (+ ui/entity-records-table.tsx)
  calendar/       ← shared/components/calendar/
  kanban/         ← shared/components/kanban/
  query-toolbar/  ← shared/components/query-toolbar/
```

`records-page-header.tsx` and `records-page-shell.tsx` stay where they are: DV4 deletes them.

## Global constraints

- Work on local main. The tree is shared: no `git stash`, `checkout <ref> -- …`, `restore`, `reset`, `clean`; no `git add -A` / `.` / `-u`. Stage moves with `git mv`; commit with `git commit -m "…" -- <explicit paths>` (old and new paths both), never `--amend`. `git show --stat HEAD` after each commit; if it is wrong, STOP.
- Before each task: `git status --short` on every file the task touches. Any change that is not yours: STOP.
- Never `pnpm build`. Verify with `pnpm tsc` and `pnpm exec eslint <touched files>`. No database writes.
- Commits end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook takes about 110 s: use a 300 s timeout, one `git commit` per Bash call.
- No new names. Nothing in a moved file changes except import paths and their order.

## Task 1: `data-view/core/`

1. `mkdir -p src/shared/components/data-view/core` then
   `git mv src/shared/components/data-view/data-view.tsx src/shared/components/data-view/core/data-view.tsx`
   `git mv src/shared/components/data-view/lib src/shared/components/data-view/core/lib`
   `git mv src/shared/components/data-view/ui src/shared/components/data-view/core/ui`
   `git mv src/shared/components/page-bar.tsx src/shared/components/data-view/core/ui/page-bar.tsx`
   `git mv src/shared/components/records-page-frame.tsx src/shared/components/data-view/core/ui/records-page-frame.tsx`
2. Re-point, in every file under `src/` that matches (`grep -rlE … src`):
   `sed -i -E 's#shared/components/data-view/(data-view|lib/|ui/)#shared/components/data-view/core/\1#g; s#shared/components/page-bar#shared/components/data-view/core/ui/page-bar#g; s#shared/components/records-page-frame#shared/components/data-view/core/ui/records-page-frame#g'`
3. `pnpm exec eslint --fix <every re-pointed file and every moved file>` (import order), then `pnpm tsc` → 0 errors, and eslint on the same files → 0 errors.
4. `git diff --shortstat`: no whole-file rewrites (CRLF). Every content hunk is an import line.
5. Commit: `refactor(data-view): the compound moves to data-view/core, with the page bar and the records page frame`.

## Task 2: `data-view/table/`

1. `git mv src/shared/components/data-table src/shared/components/data-view/table`
   `git mv src/shared/components/entity-records-table.tsx src/shared/components/data-view/table/ui/entity-records-table.tsx`
2. `sed -i -E 's#shared/components/data-table/#shared/components/data-view/table/#g; s#shared/components/entity-records-table#shared/components/data-view/table/ui/entity-records-table#g'` over every matching file under `src/`.
3. As Task 1 steps 3–4.
4. Commit: `refactor(data-view): the table body moves to data-view/table, with EntityRecordsTable`.

## Task 3: `data-view/calendar/`, `data-view/kanban/`, `data-view/query-toolbar/`

1. `git mv src/shared/components/calendar src/shared/components/data-view/calendar`
   `git mv src/shared/components/kanban src/shared/components/data-view/kanban`
   `git mv src/shared/components/query-toolbar src/shared/components/data-view/query-toolbar`
2. `sed -i -E 's#shared/components/calendar/#shared/components/data-view/calendar/#g; s#shared/components/kanban/#shared/components/data-view/kanban/#g; s#shared/components/query-toolbar/#shared/components/data-view/query-toolbar/#g'` over every matching file under `src/`. (`shared/components/ui/calendar` is the date picker and does not match.)
3. As Task 1 steps 3–4. Then `grep -rnE 'shared/components/(data-table/|calendar/|kanban/|query-toolbar/|entity-records-table|records-page-frame|page-bar)|shared/components/data-view/(data-view|lib/|ui/)' src` → no output.
4. Commit: `refactor(data-view): calendar, kanban and the query toolbar move under data-view`.

## Task 4: docs cite the new paths

1. Apply the sed expressions of Tasks 1–3, in that order, to every clean doc that cites the old paths:
   `docs/codebase-conventions/app-shell.md`, `docs/codebase-conventions/query-toolkit.md`, every file under `docs/plans/` and `docs/superpowers/{plans,specs}/` that matches, and `docs/handoff-2026-04-22-lead-sources.md`.
2. Skip: `docs/superpowers/plans/2026-10-13-data-view-phase-1.md` (the executed DV3 plan; its paths are history), and any file `git status` shows as modified by someone else (on 2026-10-16: `docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters-part-2.md`, DV4's plan; DV4 re-points it when it starts). Leave the old `data-view-boundary` / `data-view-pending` citations alone (DV4 re-checks them).
3. `git diff --stat` on the docs: only path strings change.
4. Commit: `docs(data-view): docs cite the data-view/{core,table,calendar,kanban,query-toolbar} paths`.

## Verification (controller)

`pnpm tsc`, `pnpm lint`, the DV3 parts check (workspace script re-pointed to `core/`), `check-states`, `check-return`, `check-error-return`, and the layout probe on a dev server. Then the tracker's DV3a row and memory.
