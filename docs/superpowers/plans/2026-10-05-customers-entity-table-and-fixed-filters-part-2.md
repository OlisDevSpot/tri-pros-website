# Customers Entity Table Implementation Plan (R2, part 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers get their entity table hook, `useCustomersTable`; the customers records page and the two lead-sources customers tables are table views of it; one lead source's pane reads the shared customers list with its source pinned, and `leadSourcesRouter.getCustomers` goes.

**Architecture:** `useCustomersTable(tableView, { fixed? })` owns the read, the created-date mutation, the action configs, the meta, the profile-modal row click and the delete dialog, on the shared `useEntityTable`; it returns `{ query, visibility, dataTableProps, dialogs }`. The records page renders it through `EntityRecordsTable`; the lead-sources sections keep their own layout around it. The pane passes `fixed: { leadSource: [leadSourceId] }`, which part 1's `useDataViewQuery` merges into the read's filters. Components under `entities/customers/components/lists/` move to the entity whose tree they render.

**Tech Stack:** Next.js 15 App Router, tRPC v11, TanStack Query and Table, nuqs, Zod 4, CASL, shadcn/ui, pnpm, `tsx`, Playwright (read-only checks).

**Spec:** `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md` §5, §7, §8, §11 (approved by the owner 2026-10-05; stress-tested 2026-10-07 and the owner's rulings of that day applied), under the records tracker `docs/plans/2026-09-26-records-management-epic.md` **D11, D25, D45, D48, D51, D60, D62**, open item **O3**, ledger §3.1.

**Requires:** part 1, `docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md`, Tasks 1 and 2 (the `fixed` argument of `useDataViewQuery` and `loadDataViewQueryInput`, and `staticDataViewInput`). Confirm before starting: `grep -n "fixed?: FilterValues<F>" src/shared/dal/client/hooks/use-data-view-query.ts` prints one line. Also the data-views epic's DV3 (the `DataView` parts, `EntityRecordsTable` on them) and DV3a (every data view under `src/shared/components/data-view/{core,table,calendar,kanban,query-toolbar}/`), both built on local main; this plan is DV4 and ships to prod with them (data-view spec §11 #18). Confirm: `ls src/shared/components/data-view/core/data-view.tsx src/shared/components/data-view/table/ui/entity-records-table.tsx` lists both.

**Re-checked 2026-10-20** at `74b158894` against DV3 (`e6d18170f..048345bb8`), DV3a (`3ebf99d1d..84e895a1d`), #285 units 1–3 (`b17417fd0`), the modal-layers work and the profile modal's later commits (`6109448cf`, `559abef3e`, `a4bc5e6a5`): every "replace this" target in Tasks 1–4 is still in its file as written, and every `shared/components` path below is DV3a's.

**Stress-tested 2026-10-23** (`/stress-test-plan`, four read-only lenses, at `1f7542e2b`); the owner's rulings of that day are Owner confirms 18–24 and tracker **D68**. The findings folded in: omni-search's live import of the deleted customers config (Task 1 Step 6), a booking's stale Pipeline badge and the modal-layer opener (Task 3), a remount per source in the pane (Task 2 Step 4c), real agent and dispatcher accounts for the role checks (Task 1 Step 1), the states check in dark and as an agent, `pnpm theme:check` and separate `git add` / `git commit` calls (Global Constraints), and the stale lines noted where they were.

## Owner confirms

**All confirmed by the owner 2026-10-12, as recommended** (items 3–6 and 9 were the open ones). Item 2 was replaced the same day (tracker **D66**), which also retires item 13.

1. **Spec §5.5, ruled 2026-10-07 and 2026-10-12:** Edit Profile opens the profile modal **in its edit mode** (`defaultEditing`, item 12). Schedule Meeting opens the standalone **`CreateMeetingModal`** ("New meeting — <name>"), as the pipeline kanban's Schedule Meeting already does (item 2). Both are Task 3, one commit.
2. **Schedule Meeting reuses the kanban's `CreateMeetingModal`** (owner ruling 2026-10-12, D66; replaces the planned `defaultMeetingOpen` prop on the profile modal). **How it opens is amended by item 23 (D68):** through the modal layer, not held and rendered by the hook. As first written: `useCustomersTable` holds the customer it is booking for (`{ id, name } | null`) and renders `CreateMeetingModal` in its `dialogs`, as `customer-pipeline-view.tsx` does; the modal wraps the same `CreateMeetingForm` as the profile's Add meeting dialog. Nothing is added to the profile modal for it, and the dialog-stacking question (item 13) no longer arises. Unlike the kanban on the Leads pipeline, a table does not move the customer's stage after booking; the profile's own Add meeting dialog doesn't either.
3. **File names for the two lead-sources table views:** `all-customers-table-view.ts` and `lead-source-customers-table-view.ts` in `features/lead-sources-admin/constants/`, one constant per file as records-management does; `lead-sources-table-query-configs.ts` is deleted. The options type is `UseCustomersTableOptions`, as `UseMeetingsTableOptions` and `UseProjectsTableOptions`.
4. **`CustomerTableRow` becomes the list read's row type** (`AppRouterOutputs['customersRouter']['business']['list']['rows'][number]`), as `MeetingRow` and `ProjectRow` are. Today it is a hand-written interface with a nullable `pipeline` and optional lead-source fields, which `useEntityTable` rejects against the read's rows. The name stays.
5. **What refreshes the one-source pane changes slightly.** It read `leadSourcesRouter.getCustomers`, which every proposal and project change invalidates (for the signed counts). It will read `customersRouter.business.list`, which those changes do not invalidate, as the other two customers tables never were; customer edits, which did not refresh the pane before, now do. A Pipeline badge in the pane can therefore lag a proposal or project change until the next refetch (30 s stale time, window focus, or Refresh). To keep the old behaviour, add `trpc.customersRouter.business.list.queryFilter()` to `invalidateProposal` and `invalidateProject` in `use-invalidation.ts`. Not planned: the tracker's A7 wants those invalidations narrower, not wider.
6. **The pane loses the Source cell's reassign picker with the column** (the spec drops the column because its value is constant there). A super-admin reassigns a customer's lead source from the "All customers" pane or the customers records page.
7. **`openCustomerProfile(props)`** (added 2026-10-07; owner asked for it): one helper at `src/shared/modules/customers/core/lib/open-customer-profile.ts`. Its `props` type is the modal's own, so Task 3's `defaultEditing` flows through with no helper change. **Done by the modal-layers work** (owner moved it there 2026-10-14): on 2026-10-20 `grep -rn "accessor: 'CustomerProfile'" src` lists only the helper, and every caller, the customers table and both lead-sources sections included, already calls `openCustomerProfile`. Task 0 is therefore done.
8. **No `EntityTableSection`** (retracted by the owner later on 2026-10-07, tracker **D65**, after D64 had recorded it): the two lead-sources sections compose the `DataView` parts in their own `<section>` (Task 2 Steps 3–4). Re-checked against DV3's parts and DV3a's paths on 2026-10-20: the names, props and import path in the sketches are the built ones (`@/shared/components/data-view/core/data-view`); `Count` carries no typography of its own, so the panes pass today's classes.
9. **The panes gain the row-cap notice.** `QueryToolbar.Standard` includes `QueryToolbar.RowCapNotice`, which the hand-written pane toolbars left out. It shows only when a read hits the row cap, as on the records pages.
10. **Customers skeleton row height** (added 2026-10-07): the hook sets `skeletonRowClassName` to the measured row height (Task 1 Step 8), as projects did in `7572c341`. Without it the default `h-[61px]` jumps against the real rows.
11. **New customers files live at the module address** (owner ruling 2026-10-07, under the 2026-10-05 rule "code lives where its module will be"): `useCustomersTable` at `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx`, `openCustomerProfile` at `src/shared/modules/customers/core/lib/open-customer-profile.ts`, and (item 22) `CUSTOMERS_RECORDS_TABLE_VIEW` at `src/shared/modules/customers/core/constants/`. (`customer-actions-host.tsx` and `open-customer-profile.ts` were already there by 2026-10-23.) Both are client files with no DAL, so D12's "no partial module" (split-brain DAL) does not apply. Existing `entities/customers/**` files are edited where they are until the path-only move; Task 4's moves of existing files are unchanged.
12. **Edit Profile opens the profile in edit mode** (owner ruling 2026-10-07: "fix as needed"): new optional prop `defaultEditing` on `CustomerProfileModal`, seeding `useCustomerEditForm`'s `isEditing` for a viewer who can edit (Task 3 Step 1). Before, Edit Profile did exactly what View Profile does. The pipeline kanban card's Edit Profile still falls back to the pipeline board: same bug, out of this plan; name it in the Task 5 report.
13. ~~**Schedule Meeting on an already-loaded profile needs investigating first**~~ (2026-10-07). **Retired 2026-10-12 by item 2:** Schedule Meeting no longer opens the profile, so no dialog stacks on it and there is nothing to investigate.
14. **Switching sources starts the pane on page 1** (owner ruling 2026-10-07). Today, and in the plan as first written, page 3 of source A became page 3 of source B. The selection handler clears the pane's page key (Task 2 Step 4b). Its pipeline filter and search still carry over, as today.

**Added at the DV4 re-check (2026-10-20). Items 15–17 follow rulings already made; 18–21 were ruled by the owner on 2026-10-23, as recommended.**

15. **The customers route moves onto the loading-screen rule** (data-view spec §3.8, which names R2 Part 2 for it). `page.tsx`, `loading.tsx` and the layout's `DASHBOARD_ROUTE_PENDING_VIEWS` entry render one `CustomersRecordsView`, which owns the frame and the boundary, as meetings, projects and proposals already do (Task 1 Step 6). `CustomersRoutePendingView` goes (it is moved and renamed, as proposals' was in `048345bb8`).
16. **`RecordsPageShell` and `RecordsPageHeader` are deleted** with their last caller, `customers-table.tsx` (spec §1 success criterion, §4, §6; DV3a left both files in place for this). Task 1 Step 6.
17. **A dispatcher joins every role check** (spec §9: "re-checks the shipped customer reads (search gating, dispatcher reach)"). A dispatcher reads every customer and may update only contact and profile fields (`src/shared/domains/permissions/rules/dispatcher.ts:14-16`), may create meetings (`:25`), and cannot open lead sources.
18. **Ruled yes (2026-10-23): the new name `CustomersRecordsView`** at `src/features/records-management/ui/views/customers-records-view.tsx`, beside `MeetingsRecordsView`, `ProjectsRecordsView` and `ProposalsRecordsView`. **Recommend: yes.**
19. **Ruled yes (2026-10-23): the Created-date picker only for a viewer who may change it.** Today every customers table wires `onUpdateCreatedAt` for every viewer, so an agent or a dispatcher can open the picker and the server refuses the save (`customers.router/crud.router.ts:15`: the update is checked per column, and neither role holds `createdAt`). The hook can pass the handler only when `ability.can('update', 'Customer', 'createdAt')`; the cell then shows the date with no picker (`columns-registry.tsx`, the `createdAt` cell already does this when the handler is absent). Two lines in Task 1 Step 3. **Recommend: yes.** If declined, drop the `useAbility` lines from the hook and keep the handler unconditional.
20. **Ruled yes, edit cleared (2026-10-23): the three stale "tables dim them" comments** from DV3's final review (tracker "From DV3's final review"): `src/shared/dal/client/lib/types.ts:134` and `:215`, `src/shared/components/data-view/table/types.ts:34`. The last is under `data-view/`, which the owner asked to clear before any edit there. Task 1 Step 10, its own commit. **Recommend: yes, as written there.**
21. **Not in this plan (owner calls from DV3's final review):** the table footer's "Updating…" under a data view's error fallback (`data-view/table/lib/to-data-table-pagination.ts:15`, shared with every table) and `aria-busy` while a view draws its first-load skeleton. **Ruled 2026-10-23: their own step, not DV4.**

**Added at the stress test (2026-10-23), all ruled by the owner that day (tracker D68 for 23–24).**

22. **`CUSTOMERS_RECORDS_TABLE_VIEW` lives at the customers module**, `src/shared/modules/customers/core/constants/customers-records-table-view.ts`, not beside its siblings in `features/records-management/constants/`. Omni-search's server (`src/shared/services/search.service.ts:12,40`) builds its "See all" link from the customers page's URL prefix, and it imported the config Task 1 deletes; shared code imports no `features/` file (one exception today, `cta.tsx`). Task 1 Steps 4 and 6.
23. **Schedule Meeting opens through the modal layer** (amends D66, item 2). The cockpit's `CreateMeetingLayer` (`features/proposal-flow/ui/components/cockpit/create-meeting-layer.tsx`, 2026-10-17) moves to `src/shared/entities/meetings/components/create-meeting-layer.tsx`; new `openCreateMeeting(props)` at `src/shared/modules/meetings/core/lib/open-create-meeting.ts` names its accessor once, as `openCustomerProfile` does; the cockpit and the customers tables call it. The pipeline kanban and omni-search keep their inline `CreateMeetingModal`. Task 3 Step 2.
24. **A booking refreshes the customers list.** A customer's Pipeline reads "fresh" once any meeting exists (`derived-pipeline-sql.ts:26-30`), but `invalidateMeeting` (`use-invalidation.ts:53-58`) never touched `customersRouter`, so a row stayed "Leads" after its first meeting. `invalidateMeeting` gains the customers list, which covers every caller (meeting deletes too), and the layer calls `invalidateMeeting` on success (the cockpit's booking refreshed nothing before). Task 3 Step 2.

**Ruled by the owner during execution (2026-10-23, tracker D69).**

25. **The Edit Profile action goes** ("No need for the edit profile action (it is a legacy action no one uses)"). `CUSTOMER_ACTIONS.edit` and `useCustomerActionConfigs`'s `onEdit` override are deleted, so every customer surface offers at most View Profile, Schedule Meeting and Delete, as each surface and the viewer's permissions allow. Task 3 Step 1 (`defaultEditing`) is not built, and Task 3 also edits `constants/actions.ts` and `hooks/use-customer-action-configs.ts`. Supersedes items 1 (its Edit Profile half) and 12, and the Edit Profile parts of Review Focus 5 and Task 3 Steps 2–4.

## Global Constraints

- Verification per task: `pnpm tsc`, `pnpm lint` and `pnpm theme:check` (the Claude pre-commit gate runs all three). **Never `pnpm build`.**
- **No database writes for testing** (dev included). Browser checks read and open UI only: never submit the new-meeting form, never confirm a delete, never pick a created date. A write check runs only on a customer the owner names, or is verified by code read.
- **Order (data-views epic `docs/plans/2026-10-12-data-views-epic.md`):** DV3 (data-view phase 1) → DV3a (the folders) → this plan (DV4) → DV5–DV6. DV3, DV3a and DV4 ship to prod together (spec §11 #18). #285 units 1–3 shipped before this plan (`b17417fd0`; tracker DV7), so nothing rebases: this plan's files already read `permit(...)` and `@/shared/domains/permissions/client`, and the code below uses them as they are. Pipeline-speed phase 2's `CustomerActionsHost` and `MeetingActionsHost` exist under `src/shared/modules/<m>/core/components/` and serve the card trees (kanban, cockpit); this plan leaves them as they are. A table gets its actions from `useCustomerActionConfigs` through `useEntityTable`'s meta, as the projects and meetings table hooks do.
- **The owner clears any edit under `src/shared/components/data-view/` first** (shared with the other DV sessions). This plan makes one: Task 1 Step 10 (Owner confirms 20).
- **No schema change.** If a step seems to need one, stop and report it.
- No unit runner in the repo: pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/` (git-ignored; the same workspace as part 1), run from the repo root with `pnpm exec tsx --test <file>`. A file that imports a `server-only` module runs with `NODE_OPTIONS=--conditions=react-server`. Never commit them.
- Work on `main`; other sessions commit concurrently and the index can hold their staged work. Add only new files with `git add -- <path>`, then **commit with an explicit pathspec** (`git commit -m "…" -- <paths>`, as every commit block below does) so nothing already staged rides along; confirm with `git show --stat HEAD`. Never `git add -A`, `git stash`, `checkout`, `reset`, `restore`, `clean` or `commit --amend`. Before editing, moving or deleting any file this plan touches, run `git status --short <file>`: if it shows changes you didn't make, stop and ask. The #285 permissions worktree and the profile modal's polish pass both touch customer files. Message shape `type(scope): subject`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Run `git add` and `git commit` as separate Bash calls:** the pre-commit gate (`.claude/settings.json`) fires only on a command that starts with `git commit`, so a block run as one call would commit ungated.
- After any scripted edit (`sed`, a script), check `git diff --shortstat -- <file>`: a whole-file count means the line endings changed. No file this plan edits had CRLF endings on 2026-10-23.
- Edits are given as exact "replace this with that" pairs or whole files. If the text to replace is not in the file as written, stop and re-read the file: another session changed it. Do not guess.
- Never start, stop or restart a dev server; never touch `.next`. Run `ss -ltnp | grep :3000` and reuse the running one.
- Browser checks: the local Playwright script (Task 1 Step 1; memory `reference-playwright-auth.md`, `/api/dev/playwright-session`), desktop and 390px wide, light and dark. **Sign in as real users only:** no role parameter for the super-admin (the owner's account), `&as=<email>` for the agent and the dispatcher the owner names in Task 1 Step 1. Never `&role=…`: it creates a `dev+<role>` user or rewrites its role (`playwright-session/route.ts:78-91`), a database write, and a fresh agent reads no customers, so its checks would pass on nothing; screenshots and reports land under `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/` and are listed in the task report. Never print `.env.local`, `DEV_LOGIN_SECRET` or a URL containing `secret=`. The script is a tool: if one of its selectors misses, fix the script, never the app, and say so in the report.
- `tableId`s and URL prefixes do not change: `customers` · `pc`, `all-customers` · `all`, `lead-source-customers` · `src`. Saved column layouts and bookmarked URLs must keep working.
- A fixed filter narrows what a view asks for; **it is not access control** (spec §2). Who sees which customers is decided by `permit(ctx, 'read', customerServerSpec)` alone.
- Layout stays the callsite's (D45): the hook returns wiring, never markup beyond its dialogs. No customer expanded row (spec non-goal); a row click opens the profile modal.
- Non-defensive migrations: a step that moves a consumer deletes the old path in the same task. No shims, no re-exports.
- Names: the spec's (`useCustomersTable`, `CUSTOMERS_RECORDS_TABLE_VIEW`, `ALL_CUSTOMERS_TABLE_VIEW`, `LEAD_SOURCE_CUSTOMERS_TABLE_VIEW`, `CustomersRecordsTable`, `CustomerColumnKey`). Do not coin others; the unavoidable ones are under "Owner confirms".
- Code conventions (memory `coding-conventions.md`): one component per file, named exports, constants in `constants/`, only DAL files import `db`. Comments say why, never what; no plan, spec or tracker citations in code.
- Render rules (`data-table.tsx` meta doc): meta function entries are event callbacks; action config arrays come from `useStableCallbacks` (inside `useCustomerActionConfigs`), never `useMemo` over mutation objects.
- Action labels stay as they are ("View Profile", "Schedule Meeting", "Delete"); Edit Profile goes (Owner confirms 25).

## Review Focus

1. **Switching lead sources in the pane shows the new source's customers, never the previous one's, from page 1.** The pane remounts per source (Task 2 Step 4c), so it never pairs one source's page with another's id; an inline `fixed` object must not refetch on every render. Pinned by Task 2 Step 8 (browser, switching from page 2 both ways: each source is read at offset 0 only, with its own `filters.leadSource`, and `readCount` stays small).
2. **A saved column layout that names the removed Source column still loads.** A viewer who resized or hid Source in the pane has `leadSourceName` in the `dt.lead-source-customers` cookie; the table must load, ignore it, and keep the rest of the layout. Pinned by Task 2 Step 8 (browser, cookie preset through `TABLE_PREFS`).
3. **An agent and a dispatcher see the same customers as before, and the pane's read cannot widen that.** The records page for each shows that role's baseline rows; `/dashboard/lead-sources` still sends both to the dashboard. Pinned by Task 1 Step 8 and Task 2 Step 8 (browser, agent and dispatcher sessions).
4. **An old pane URL keeps its page and filters, and a key that tries to name another source is ignored.** `?src_p=2&src_pipeline=fresh` still applies; `src_leadSource` or `src_sourceId` in the URL never changes whose customers show. Pinned by Task 2 Step 1 (test) and Step 8 (browser).
5. **Schedule Meeting and Edit Profile reach their targets, on a phone too.** Schedule Meeting opens "New meeting — <name>" for that row's customer, usable and fully on screen at 390px; closing it leaves the table as it was. Edit Profile opens the profile with its edit form on for a viewer who can edit (a super-admin, an agent for `age` and the profile, a dispatcher for the contact fields), and as View Profile does for one who cannot. Pinned by Task 3 Step 4 (browser, nothing submitted) and Step 3 (code read). A booking refreshes the customers list, so a first meeting moves the row's Pipeline badge (Owner confirms 24; code read, since nothing is submitted).
6. **The customers page and both panes get back what DV3 took from the table.** A key with no match shows `DataView.Empty` in place of the table; rows of the previous key dim after 200 ms; a refresh never dims; a failed read shows the retry inside its view. On a return, `/dashboard/customers` shows its cached rows on the loading screen and a bad cached row stays inside the view. Pinned by Task 1 Step 8 and Task 2 Step 8 (DV3's checks, as the super-admin in light and dark and as the agent). `/dashboard/lead-sources` has no loading screen yet; that is DV10, not this plan.
7. **Omni-search's "See all" still lands on the customers page with the term applied** after its config import moves (Owner confirms 22). Pinned by Task 1 Step 8 (by hand).

## File map

| Task | Files |
|---|---|
| 0 `openCustomerProfile` | done by the modal-layers work (Owner confirms 7); nothing to edit |
| 1 The hook and the records page | `src/shared/entities/customers/lib/columns-registry.tsx` · `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx` (new) · `src/shared/modules/customers/core/constants/customers-records-table-view.ts` (new) · `src/features/records-management/ui/components/customers-records-table.tsx` (new) · `src/features/records-management/ui/views/customers-records-view.tsx` (moved from `src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx`) · `src/app/(frontend)/dashboard/(records)/customers/{page,loading}.tsx` · `src/features/agent-dashboard/constants/route-pending-views.ts` · `src/shared/services/search.service.ts` (Owner confirms 22) · deleted: `src/shared/entities/customers/components/customers-table.tsx`, `src/shared/entities/customers/constants/customers-table-query-config.ts`, `src/shared/components/records-page-shell.tsx`, `src/shared/components/records-page-header.tsx` · Step 10 (own commit): `src/shared/dal/client/lib/types.ts`, `src/shared/components/data-view/table/types.ts` |
| 2 The lead-sources tables | `src/features/lead-sources-admin/constants/{all-customers-table-view,lead-source-customers-table-view}.ts` (new) · `src/features/lead-sources-admin/ui/components/{all-customers-section,lead-source-customers-section,source-detail}.tsx` · `src/features/lead-sources-admin/ui/views/lead-sources-view.tsx` · `src/app/(frontend)/dashboard/lead-sources/page.tsx` · `src/trpc/routers/lead-sources.router.ts` · `src/shared/entities/customers/dal/customer-fields.ts` · `src/shared/entities/customers/dal/server/{customer-field-sql,queries}.ts` · deleted: `src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts` |
| 3 The two row actions | `src/shared/entities/customers/hooks/use-customer-edit-form.ts` · `src/shared/entities/customers/components/profile/{customer-profile-modal,customer-profile-modal-content}.tsx` · `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx` · `src/shared/entities/meetings/components/create-meeting-layer.tsx` (moved from `src/features/proposal-flow/ui/components/cockpit/create-meeting-layer.tsx`) · `src/shared/modules/meetings/core/lib/open-create-meeting.ts` (new) · `src/features/proposal-flow/ui/components/cockpit/cockpit.tsx` · `src/shared/dal/client/hooks/use-invalidation.ts` |
| 4 Ownership moves | `src/shared/entities/customers/components/lists/*` → `src/shared/entities/meetings/components/`, `src/shared/modules/projects/core/components/` · `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx` |
| 5 Hand-off | `docs/plans/2026-09-26-records-management-epic.md` · `docs/plans/2026-10-12-data-views-epic.md` · `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md` · `src/shared/entities/customers/DOCS.md` · `docs/ubiquitous-language.md` · `docs/codebase-conventions/{query-toolkit,frontend-stack}.md` |

On 2026-10-23 every `src/` file and every doc this plan touches was clean (`CONTEXT.md` held another session's hunks; this plan does not edit it). Task 5's rule for a doc with someone else's hunks still applies. Check every file with `git status --short` anyway: the profile modal's folder is edited often by other sessions.

---

### Task 0: `openCustomerProfile` (Owner confirms 7): done

Built by the modal-layers work. Confirm before Task 1: `grep -rn "accessor: 'CustomerProfile'" src` lists only `src/shared/modules/customers/core/lib/open-customer-profile.ts`. If anything else shows, stop and report it.

---

### Task 1: `useCustomersTable` and the customers records page

**Files:**
- Modify: `src/shared/entities/customers/lib/columns-registry.tsx`
- Create: `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx`
- Create: `src/shared/modules/customers/core/constants/customers-records-table-view.ts`
- Create: `src/features/records-management/ui/components/customers-records-table.tsx`
- Move: `src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx` → `src/features/records-management/ui/views/customers-records-view.tsx` (Owner confirms 15, 18)
- Modify: `src/app/(frontend)/dashboard/(records)/customers/page.tsx`
- Modify: `src/app/(frontend)/dashboard/(records)/customers/loading.tsx`
- Modify: `src/features/agent-dashboard/constants/route-pending-views.ts`
- Modify: `src/shared/services/search.service.ts` (omni-search's "See all" link; Owner confirms 22)
- Delete: `src/shared/entities/customers/components/customers-table.tsx`
- Delete: `src/shared/entities/customers/constants/customers-table-query-config.ts`
- Delete: `src/shared/components/records-page-shell.tsx`, `src/shared/components/records-page-header.tsx` (Owner confirms 16)
- Modify (Step 10, own commit, Owner confirms 20): `src/shared/dal/client/lib/types.ts`, `src/shared/components/data-view/table/types.ts`
- Tool (throwaway): `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts`
- Tools (reused, read-only): DV3's checks in `.superpowers/sdd/2026-10-13-data-view-phase-1/` (`check-lib.mjs`, `check-states.mjs`, `check-return.mjs`, `check-error-return.mjs`) and `scripts/perf/records-probe.mjs`

**Interfaces:**
- Consumes: `useDataViewQuery(procedure, extra, config, fixed?)` (part 1); `useEntityTable`, `EntityRecordsTable`, `EntityTableView` (built with the projects table, rebuilt on the parts by DV3); `useCustomerActionConfigs<T>({ onView?, onEdit?, onScheduleMeeting?, onDeleted? })`; `openCustomerProfile` (modal-layers); `DataViewBoundary`, `DataViewPending`, `RecordsPageFrame` (`data-view/core/ui/`).
- Produces:
  - `CustomerTableRow` = the row type of `customersRouter.business.list`; `CustomerColumnKey = keyof typeof CUSTOMER_COLUMNS`
  - `UseCustomersTableOptions { fixed?: FilterValues<typeof CUSTOMER_FIELDS> }`
  - `useCustomersTable(tableView: EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>, options?: UseCustomersTableOptions)` → `{ query, visibility, dataTableProps, dialogs }`
  - Noted 2026-10-08, outside this plan's scope: the hook should also return the toolbar's `searchPlaceholder` ("name, email or phone"), so the three table views stop restating it (D45: the hook holds the wiring that would otherwise be copied).
  - `CUSTOMERS_RECORDS_TABLE_VIEW` (`tableId: 'customers'`, prefix `pc`); `CustomersRecordsTable()` (no props); `CustomersRecordsView()` (no props), rendered by the page, its loading screen and the layout's entry

- [ ] **Step 1: Baseline, before any edit**

Create `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts` as below; if part 1 left a copy, replace it (this one signs in by account, not by role). Type-checked when this plan was written; the sign-in lines changed on 2026-10-23:

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

import { chromium } from 'playwright'

// Usage: pnpm exec tsx <this file> <label> <who> <path> [<path>…]
//   <who> is `super-admin` (the owner's account: no role parameter) or a real user's email (`&as=`, their own role and data)
// Reads only: signs in, opens each path at two widths in both schemes, presses each table's Refresh, and writes
// screenshots plus one JSON report. It never submits a form.
//   TABLE_PREFS='{"<tableId>":{…}}'  loads with saved table layouts, in the cookie format DataTable writes
//   THEN_CLICK='<selector>'          clicks one element after the page settles (e.g. another lead source)
const DIR = '.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters'
const BASE = process.env.BASE ?? 'http://localhost:3000'
const [label, who, ...paths] = process.argv.slice(2)
const secret = readFileSync('.env.local', 'utf8').match(/^DEV_LOGIN_SECRET=(.*)$/m)![1].replace(/"/g, '').trim()
const tablePrefs: Record<string, unknown> = JSON.parse(process.env.TABLE_PREFS ?? '{}')
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const
const LIST_READS = ['customersRouter.business.list', 'leadSourcesRouter.getCustomers', 'meetingsRouter.reads.list', 'projectsRouter.crud.list', 'scheduleRouter.activities.list', 'customerPipelinesRouter.getCustomerPipelineItems']

interface ListRead { procedure: string, input: unknown, ids: string[], total: number }

const slug = (path: string) => path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'
// `&role=` would create or re-role a dev user, a database write; `&as=` only signs in as someone who exists.
const signIn = who === 'super-admin' ? '' : `&as=${encodeURIComponent(who)}`
const readKey = (read: ListRead) => JSON.stringify([read.procedure, read.input])
const textOf = (els: Element[]) => els.map(el => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim())

mkdirSync(DIR, { recursive: true })
const browser = await chromium.launch()
const report: Record<string, unknown> = {}

try {
  for (const path of paths) {
    for (const [width, viewport] of Object.entries(VIEWPORTS)) {
      for (const colorScheme of ['light', 'dark'] as const) {
        const ctx = await browser.newContext({ viewport, colorScheme, isMobile: width === 'phone', hasTouch: width === 'phone' })
        await ctx.addCookies(Object.entries(tablePrefs).map(([tableId, prefs]) => ({
          name: `dt.${tableId}`,
          value: encodeURIComponent(JSON.stringify(prefs)),
          domain: new URL(BASE).hostname,
          path: '/dashboard',
        })))
        const page = await ctx.newPage()
        const errors: string[] = []
        const reads: ListRead[] = []
        page.on('pageerror', error => errors.push(error.message.slice(0, 400)))
        page.on('console', (message) => {
          if (message.type() === 'error') {
            errors.push(message.text().slice(0, 400))
          }
        })
        // A batched GET names its procedures in the path and carries their inputs, by position, in `input`.
        page.on('response', async (response) => {
          const url = new URL(response.url())
          if (!url.pathname.startsWith('/api/trpc/')) {
            return
          }
          const procedures = url.pathname.slice('/api/trpc/'.length).split(',')
          const inputs = JSON.parse(url.searchParams.get('input') ?? '{}')
          const body = await response.json().catch(() => null)
          procedures.forEach((procedure, i) => {
            const data = body?.[i]?.result?.data?.json
            if (LIST_READS.includes(procedure) && Array.isArray(data?.rows)) {
              reads.push({ procedure, input: inputs[i]?.json, ids: data.rows.map((row: { id: string }) => row.id), total: data.total })
            }
          })
        })

        await page.goto(`${BASE}/api/dev/playwright-session?secret=${secret}${signIn}&redirect=/api/auth/get-session`, { waitUntil: 'load', timeout: 120_000 })
        await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 120_000 })
        await page.waitForFunction(() => document.querySelectorAll('[data-slot=data-view-pending]').length === 0, undefined, { timeout: 60_000 })
        await page.waitForTimeout(1500)
        if (process.env.THEN_CLICK) {
          // A target one width doesn't show (the phone layout hides the source list behind a pane) is recorded, not fatal.
          await page.locator(process.env.THEN_CLICK).first().click({ timeout: 5000 }).catch(() => errors.push('THEN_CLICK: target not found at this width'))
          await page.waitForTimeout(2500)
        }
        await page.screenshot({ path: `${DIR}/${label}-${slug(who)}-${slug(path)}-${width}-${colorScheme}.png` })

        // A document load streams its rows inside the HTML. Refresh makes the table ask over HTTP, where its ids can be read.
        for (const refresh of await page.locator('main button[aria-label="Refresh"]').all()) {
          if (await refresh.isVisible()) {
            await refresh.click()
            await page.waitForTimeout(2000)
          }
        }

        report[`${path} ${width} ${colorScheme}`] = {
          url: page.url(),
          columns: await page.locator('main thead th').evaluateAll(textOf),
          rows: await page.locator('main tbody tr:not([aria-hidden]):not([data-expanded-row])').evaluateAll(textOf),
          chips: await page.locator('main a[href^="#"]').evaluateAll(textOf),
          sections: await page.locator('#meetings, #proposals, #projects').evaluateAll(textOf),
          // One entry per distinct request, sorted, so two runs diff cleanly; `readCount` keeps how many responses arrived.
          reads: [...new Map(reads.map(read => [readKey(read), read])).values()].sort((a, b) => readKey(a).localeCompare(readKey(b))),
          readCount: reads.length,
          errors,
        }
        await ctx.close()
      }
    }
  }
}
finally {
  await browser.close()
}

writeFileSync(`${DIR}/${label}-${slug(who)}.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(`wrote ${DIR}/${label}-${slug(who)}.json`)
```

Confirm a dev server is up (`ss -ltnp | grep :3000`; if none, stop and ask the owner). **Ask the owner for one agent and one dispatcher account** that each read some customers (an agent sees customers it has meetings with), and export them for the session as `AGENT=<email>` and `DISPATCHER=<email>`; never write either email into a committed file. Pick two lead sources that have customers, A and B (their names and counts are in the left list on `/dashboard/lead-sources`). Learn each one's id by clicking it and reading the URL the click writes:

```bash
THEN_CLICK='nav[aria-label="Lead sources"] >> text="<name of A>"' pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts find-a super-admin /dashboard/lead-sources
```

The desktop entries' `url` in `find-a-super-admin.json` ends with `?id=<uuid of A>`. Repeat for B (`find-b`). Then capture the baseline:

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-baseline super-admin /dashboard/customers /dashboard/lead-sources "/dashboard/lead-sources?id=<A>" "/dashboard/lead-sources?id=<B>"
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-baseline "$AGENT" /dashboard/customers /dashboard/lead-sources
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-baseline "$DISPATCHER" /dashboard/customers /dashboard/lead-sources
```

Then the render and return baselines (DV3's tools, read-only; each prints PASS/FAIL lines):

```bash
W=.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters
node scripts/perf/records-probe.mjs /dashboard/customers > $W/probe-before-customers.txt
node .superpowers/sdd/2026-10-13-data-view-phase-1/check-return.mjs > $W/return-before.txt
node .superpowers/sdd/2026-10-13-data-view-phase-1/check-error-return.mjs > $W/error-return-before.txt
```

Both check scripts already list `customers`. The states check has no baseline here: before Task 1 the customers page has no `DataView.Body`, which is the gap DV3 left on local main (spec §11 #18).

Expected in `p2-baseline-super-admin.json`: for each table, `columns` (Customer, Source, Pipeline, Created), `rows` (page 1 as text) and, under `reads`, each distinct list request with its `input`, row `ids` and `total` (`customersRouter.business.list` for the records page and the All pane, `leadSourcesRouter.getCustomers` for A and B). The entry with `pagination.offset` 0 is page 1; an entry with offset 20 is the next page's prefetch. `readCount` is how many list responses arrived. For the agent and the dispatcher (their files are `p2-baseline-<email slug>.json`), `/dashboard/lead-sources` lands on `/dashboard` (`url`), and `/dashboard/customers` shows at least one row; if either shows none, ask the owner for another account, since an empty table proves nothing. Record the A and B ids in the task report. Note any `errors` already present; they are the baseline, not this plan's.

- [ ] **Step 2: The registry's row and key types**

In `src/shared/entities/customers/lib/columns-registry.tsx`:

Replace the type imports at the top (drop `Pipeline`, add `AppRouterOutputs`):

```ts
import type { ColumnRegistry } from '@/shared/components/data-view/table/lib/use-entity-columns'
import type { EntityTableMeta } from '@/shared/components/data-view/table/types/entity-table-meta'
import type { SortId } from '@/shared/dal/lib/query/field-list'
import type { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import type { AppRouterOutputs } from '@/trpc/routers/app'
```

Replace the `CustomerTableRow` interface and the doc comment above it with:

```ts
/** `pipeline` is the derived five-bucket classification, not the stored three-bucket column. */
export type CustomerTableRow = AppRouterOutputs['customersRouter']['business']['list']['rows'][number]
```

Every customers table reads that one list, so the row is the read's row; `useEntityTable` takes one row type for the registry and the query, and the hand-written interface (nullable `pipeline`, optional lead-source fields) does not match the read's.

After the closing `} as const satisfies ColumnRegistry<CustomerTableRow, SortId<typeof CUSTOMER_FIELDS>>` line, add:

```ts

export type CustomerColumnKey = keyof typeof CUSTOMER_COLUMNS
```

- [ ] **Step 3: The entity table hook**

Create `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx`:

```tsx
'use client'

import type { EntityTableView } from '@/shared/components/data-view/table/types/entity-table-view'
import type { FilterValues } from '@/shared/dal/lib/query/field-list'
import type { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import type { CustomerColumnKey, CustomerTableMeta, CustomerTableRow } from '@/shared/entities/customers/lib/columns-registry'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { useEntityTable } from '@/shared/components/data-view/table/lib/use-entity-table'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useAbility } from '@/shared/domains/permissions/client'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'
import { CUSTOMER_COLUMNS } from '@/shared/entities/customers/lib/columns-registry'
import { openCustomerProfile } from '@/shared/modules/customers/core/lib/open-customer-profile'
import { useTRPC } from '@/trpc/helpers'

export interface UseCustomersTableOptions {
  /** Filter values only this callsite knows (one lead source's id). A pin that never changes belongs in the table view's `query.fixed`. */
  fixed?: FilterValues<typeof CUSTOMER_FIELDS>
}

export function useCustomersTable(
  tableView: EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>,
  { fixed }: UseCustomersTableOptions = {},
) {
  const trpc = useTRPC()
  const ability = useAbility()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()

  const query = useDataViewQuery(trpc.customersRouter.business.list, {}, tableView.query, fixed)

  const { mutate: updateCreatedAt } = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => {
        toast.success('Created date updated')
        invalidateCustomer()
        // A lead source's figures are counted over its customers' created dates.
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )

  const openProfile = useCallback((row: CustomerTableRow) => openCustomerProfile({ customerId: row.id }), [])

  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({ onView: openProfile })

  // The server checks each changed column, so a viewer without `createdAt` would open the picker only to be refused;
  // without the handler the cell shows the date alone.
  const canEditCreatedAt = ability.can('update', 'Customer', 'createdAt')
  const meta = useMemo(() => ({
    onUpdateCreatedAt: canEditCreatedAt
      ? (customerId: string, date: Date) => updateCreatedAt({ id: customerId, data: { createdAt: date.toISOString() } })
      : undefined,
  }) satisfies Omit<CustomerTableMeta, 'rowActions'>, [canEditCreatedAt, updateCreatedAt])

  const table = useEntityTable({
    tableView,
    registry: CUSTOMER_COLUMNS,
    query,
    actions,
    meta,
    onRowClick: openProfile,
    entityName: 'customer',
    rowDataAttribute: 'data-customer-row',
    skeletonRowClassName: 'h-[61px]',
  })

  return { ...table, dialogs: <DeleteConfirmDialog /> }
}
```

Edit Profile and Schedule Meeting keep today's fallback in this task (they open the pipeline board); Task 3 gives them their target. `h-[61px]` is the table's default skeleton height, written out here so Step 8 has one value to replace with the measured one.

- [ ] **Step 4: The table view**

Create `src/shared/modules/customers/core/constants/customers-records-table-view.ts`:

```ts
import type { EntityTableView } from '@/shared/components/data-view/table/types/entity-table-view'
import type { CustomerColumnKey } from '@/shared/entities/customers/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

export const CUSTOMERS_RECORDS_TABLE_VIEW = {
  tableId: 'customers',
  query: {
    fields: CUSTOMER_FIELDS,
    paramPrefix: 'pc',
    toolbar: ['pipeline', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['name', 'leadSourceName', 'pipeline', 'createdAt'],
} as const satisfies EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>
```

- [ ] **Step 5: The records table**

Create `src/features/records-management/ui/components/customers-records-table.tsx`:

```tsx
'use client'

import { EntityRecordsTable } from '@/shared/components/data-view/table/ui/entity-records-table'
import { useCustomersTable } from '@/shared/modules/customers/core/components/customers-table/use-customers-table'
import { CUSTOMERS_RECORDS_TABLE_VIEW } from '@/shared/modules/customers/core/constants/customers-records-table-view'

export function CustomersRecordsTable() {
  const table = useCustomersTable(CUSTOMERS_RECORDS_TABLE_VIEW)
  return <EntityRecordsTable title="Customers" entityName="customers" searchPlaceholder="Search by name, email or phone…" table={table} />
}
```

`EntityRecordsTable` draws what `CustomersTable` drew by hand, on the parts: `DataView.Bar` with the title and its count, `QueryToolbar.Standard`, and `DataView.Body` around the `DataTable` (`entity-records-table.tsx`).

- [ ] **Step 6: One view for the page, its loading screen and the layout's entry; the old table and the shells go (Owner confirms 15, 16, 18)**

Data-view spec §3.8: the page, its `loading.tsx` and the layout's `DASHBOARD_ROUTE_PENDING_VIEWS` entry render the same component, which owns the boundary, so the three cannot drift. This is the shape `048345bb8` gave proposals.

Move the pending view to the records views and make it that component:

```bash
git mv src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx src/features/records-management/ui/views/customers-records-view.tsx
```

Replace the moved file's contents with:

```tsx
'use client'

import { CustomersRecordsTable } from '@/features/records-management/ui/components/customers-records-table'
import { DataViewBoundary } from '@/shared/components/data-view/core/ui/boundary'
import { RecordsPageFrame } from '@/shared/components/data-view/core/ui/records-page-frame'

export function CustomersRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <CustomersRecordsTable />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
```

Replace `src/app/(frontend)/dashboard/(records)/customers/page.tsx` with (the projects page's shape):

```tsx
import type { SearchParams } from 'nuqs/server'

import { CustomersRecordsView } from '@/features/records-management/ui/views/customers-records-view'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { CUSTOMERS_RECORDS_TABLE_VIEW } from '@/shared/modules/customers/core/constants/customers-records-table-view'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function CustomersPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the
  // prefetch work.
  if (authState.status === 'authenticated') {
    const input = await loadDataViewQueryInput(searchParams, CUSTOMERS_RECORDS_TABLE_VIEW.query)
    prefetch(trpc.customersRouter.business.list.queryOptions(input))
  }

  return (
    <HydrateClient>
      <CustomersRecordsView />
    </HydrateClient>
  )
}
```

Replace `src/app/(frontend)/dashboard/(records)/customers/loading.tsx` with:

```tsx
import { CustomersRecordsView } from '@/features/records-management/ui/views/customers-records-view'
import { DataViewPending } from '@/shared/components/data-view/core/ui/pending'

export default function CustomersLoading() {
  return (
    <DataViewPending>
      <CustomersRecordsView />
    </DataViewPending>
  )
}
```

In `src/features/agent-dashboard/constants/route-pending-views.ts`, replace

```ts
  [ROOTS.dashboard.customers.root()]: dynamic(() => import('@/features/agent-dashboard/ui/components/customers-route-pending-view').then(m => m.CustomersRoutePendingView)),
```

with

```ts
  [ROOTS.dashboard.customers.root()]: dynamic(() => import('@/features/records-management/ui/views/customers-records-view').then(m => m.CustomersRecordsView)),
```

Omni-search's server builds its "See all" link from the customers page's URL prefix and still imports the config deleted below (`src/shared/services/search.service.ts:12`, `:40`; Owner confirms 22). Run `git status --short src/shared/services/search.service.ts` first. Replace

```ts
import { CUSTOMERS_TABLE_QUERY_CONFIG } from '@/shared/entities/customers/constants/customers-table-query-config'
import { searchCustomersRanked } from '@/shared/entities/customers/dal/server/search-customers-ranked'
import { listMeetingsForCustomers } from '@/shared/entities/meetings/dal/server/queries'
```

with

```ts
import { searchCustomersRanked } from '@/shared/entities/customers/dal/server/search-customers-ranked'
import { listMeetingsForCustomers } from '@/shared/entities/meetings/dal/server/queries'
import { CUSTOMERS_RECORDS_TABLE_VIEW } from '@/shared/modules/customers/core/constants/customers-records-table-view'
```

(the new line sorts after `@/shared/entities/…` and before `@/shared/modules/projects/…`; if ESLint orders it otherwise, take ESLint's order), and

```ts
  const { searchKey } = makeQueryParsers(CUSTOMERS_TABLE_QUERY_CONFIG.paramPrefix)
```

with

```ts
  const { searchKey } = makeQueryParsers(CUSTOMERS_RECORDS_TABLE_VIEW.query.paramPrefix)
```

The prefix is `pc` in both, so the link is unchanged: `/dashboard/customers?pc_q=<term>`.

Delete the old table, its config and the two shells it was the last caller of:

```bash
grep -rln "RecordsPageShell\|RecordsPageHeader" src   # expect: records-page-shell.tsx, records-page-header.tsx, customers-table.tsx, and lead-source-customers-section.tsx (a comment only; Task 2 replaces the file)
grep -rln "customers-table-query-config" src           # expect: customers-table.tsx only (search.service.ts was just re-pointed)
git rm -- src/shared/entities/customers/components/customers-table.tsx src/shared/entities/customers/constants/customers-table-query-config.ts src/shared/components/records-page-shell.tsx src/shared/components/records-page-header.tsx
```

If the grep lists any other file, stop and report it.

- [ ] **Step 7: Type-check, lint, greps**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: clean. The two lead-sources sections still compile untouched: they use `CustomerTableRow` and `CUSTOMER_COLUMNS`, and their reads return the same row shape.

Run: `grep -rnw "CUSTOMERS_TABLE_QUERY_CONFIG\|CUSTOMERS_TABLE_SHOW_COLUMNS" src; grep -rn "customers/components/customers-table'\|customers-table-query-config\|CustomersRoutePendingView\|customers-route-pending-view\|records-page-shell\|records-page-header" src`
Expected: no output (`-w` keeps the lead-sources configs, which go in Task 2, out of the match).

Run: `grep -rln "RecordsPageShell\|RecordsPageHeader" src`
Expected: only `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` (a comment; Task 2 replaces the file, and after Task 2 the grep is empty: spec §1's success criterion).

- [ ] **Step 8: Browser read check**

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task1 super-admin /dashboard/customers "/dashboard/customers?pc_p=2&pc_pipeline=fresh&pc_sort=name&pc_dir=asc"
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task1 "$AGENT" /dashboard/customers
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task1 "$DISPATCHER" /dashboard/customers
```

Against `p2-baseline-*.json` and its screenshots, for all three roles, both widths and both schemes:
- `/dashboard/customers`: the same `columns`, `rows`, `reads[].input` and `reads[].ids` (compare the `pagination.offset` 0 entries); the header reads "Customers" with the same count; the toolbar has search, the Pipeline and Created filters, Columns, Refresh and page size;
- the bookmarked URL loads page 2 of the Fresh pipeline sorted by name ascending, with a Pipeline chip, and its `reads[].input` holds `pagination.offset: 20`, `filters.pipeline: ["fresh"]`, `sort: { sortBy: "name", sortDir: "asc" }` (if Fresh has a single page, the page clamps back to 1, as it does today);
- `errors` holds no `[prefetch drift]`, no `[data-view]`, no `needs a <DataViewBoundary>` and no hydration error the baseline did not have;
- for the agent and the dispatcher, the rows equal that role's baseline (Review Focus 3), the Source cell is plain text (no picker), and (Owner confirms 19) the Created cell is plain text (no picker). For the super-admin both pickers stay.

The data-view states and the return (Review Focus 6). Copy DV3's states check into this plan's workspace and point it at customers:

```bash
W=.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters
cp .superpowers/sdd/2026-10-13-data-view-phase-1/check-lib.mjs .superpowers/sdd/2026-10-13-data-view-phase-1/check-states.mjs $W/
```

In `$W/check-states.mjs`, set `W` to `'.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters'` and `ROUTES` to `{ customers: { path: '/dashboard/customers', entity: 'customers', proc: 'customersRouter.business.list', row: 'tbody tr[data-customer-row]' } }`. Make the copies run as another account and in dark (data-view spec §8 asks for both roles and both schemes; DV3's originals sign in as the super-admin in light only), three edits to the copies only:
- `$W/check-lib.mjs`, in `openPage`: `browser.newContext({ viewport })` becomes `browser.newContext({ viewport, colorScheme: process.env.SCHEME ?? 'light' })`;
- `$W/check-states.mjs`: `openPage(r.path, '', {` becomes ``openPage(r.path, process.env.AS ? `&as=${encodeURIComponent(process.env.AS)}` : '', {``;
- `$W/check-states.mjs`: every screenshot path `${W}/states-${name}-` becomes `${W}/states-${process.env.LABEL ?? 'sa-light'}-${name}-`, so the runs don't overwrite each other.

Then:

```bash
node $W/check-states.mjs > $W/states-task1.txt
SCHEME=dark LABEL=sa-dark node $W/check-states.mjs > $W/states-task1-dark.txt
AS="$AGENT" LABEL=agent node $W/check-states.mjs > $W/states-task1-agent.txt
node scripts/perf/records-probe.mjs /dashboard/customers > $W/probe-after-customers.txt
node .superpowers/sdd/2026-10-13-data-view-phase-1/check-return.mjs > $W/return-task1.txt
node .superpowers/sdd/2026-10-13-data-view-phase-1/check-error-return.mjs > $W/error-return-task1.txt
```

Expected: every line of the three states files PASS (stale rows dim and stay clickable, a refresh never dims, a no-match search shows `Empty` with no table and clearing it escapes, a forced error shows the retry with no count and no `Empty`, no page errors; at 1440 and 390). DV3's notes on two harness timings apply: "refresh never dims" can read the 200 ms fade back, and a search typed while the loading screen is up is lost; re-run with a settle before calling either a defect (`.superpowers/sdd/2026-10-13-data-view-phase-1/progress.md`, Task 5). The probe: no phase renders more rows than `probe-before-customers.txt`. Return and error-return: the `customers` lines PASS, as in the before files.

By hand, as a super-admin on desktop: a row click opens that customer's profile modal; the row menu ("Actions") lists View Profile, Edit Profile, Schedule Meeting and Delete; clicking a Created cell opens the date picker (close it without picking); clicking a Source cell opens the lead-source picker (close it without picking). A hard reload shows the page's skeleton, then the rows, with no jump (the loading screen draws the same view). Omni-search (Review Focus 7): search a customer's name, press "See all", and the customers page opens with `pc_q=<term>` in the URL and the term in the search box.

**Skeleton height (Owner confirms 10).** Measure real customer row heights at 1440 px (`getBoundingClientRect().height` on `[data-customer-row]`, a few rows), set `skeletonRowClassName` in the hook to the common height (only if two heights exist, add a one-line why-comment, as `use-projects-table.tsx` does; never a comment that names this plan or a step), re-run `pnpm tsc`, and reload once more to confirm no jump. Measure with no other session's theme edits in `globals.css` if possible (`git status --short src/app/(frontend)/globals.css`); if they are present, note it in the commit body.

- [ ] **Step 9: Commit**

Two Bash calls (Global Constraints): the `git add`, then the `git commit` with its pathspec.

```bash
git add -- src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx src/shared/modules/customers/core/constants/customers-records-table-view.ts src/features/records-management/ui/components/customers-records-table.tsx
git commit -m "feat(customers): customers entity table hook; the records page is a table view of it, and its page, loading screen and layout entry render one CustomersRecordsView

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/entities/customers/lib/columns-registry.tsx src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx src/shared/modules/customers/core/constants/customers-records-table-view.ts src/features/records-management/ui/components/customers-records-table.tsx src/features/records-management/ui/views/customers-records-view.tsx src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx "src/app/(frontend)/dashboard/(records)/customers/page.tsx" "src/app/(frontend)/dashboard/(records)/customers/loading.tsx" src/features/agent-dashboard/constants/route-pending-views.ts src/shared/services/search.service.ts src/shared/entities/customers/components/customers-table.tsx src/shared/entities/customers/constants/customers-table-query-config.ts src/shared/components/records-page-shell.tsx src/shared/components/records-page-header.tsx
git show --stat HEAD
```

- [ ] **Step 10: The stale-rows comments say who dims now (Owner confirms 20; the owner clears this edit under `data-view/` first)**

DV3 moved the dim from `DataTable` to `DataView.Body`; three comments still credit the table. Run `git status --short src/shared/dal/client/lib/types.ts src/shared/components/data-view/table/types.ts` first.

`src/shared/dal/client/lib/types.ts`, both occurrences (lines 134 and 215 on 2026-10-20): replace

```ts
  /** The rows belong to an older URL state while the requested one loads; tables dim them. */
```

with

```ts
  /** The rows belong to an older URL state while the requested one loads; `DataView.Body` dims them. */
```

`src/shared/components/data-view/table/types.ts` (line 34): replace

```ts
  /** The rows belong to an older query while the next one loads; the table dims them after a short delay. */
```

with

```ts
  /** The rows belong to an older query while the next one loads; with no rows to show, the table draws skeleton rows (the dim is `DataView.Body`'s). */
```

(`data-table-body.tsx` reads it only for that: an empty stale result draws skeleton rows rather than nothing.) Run `pnpm tsc && pnpm exec eslint src/shared/dal/client/lib/types.ts src/shared/components/data-view/table/types.ts`, then:

```bash
git commit -m "docs(data-view): the stale-rows comments name DataView.Body as what dims them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/dal/client/lib/types.ts src/shared/components/data-view/table/types.ts
git show --stat HEAD
```

---

### Task 2: The lead-sources tables on the hook; the pane reads the shared list

**Files:**
- Create: `src/features/lead-sources-admin/constants/all-customers-table-view.ts`
- Create: `src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts`
- Delete: `src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts`
- Modify: `src/features/lead-sources-admin/ui/components/all-customers-section.tsx`
- Modify: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
- Modify: `src/app/(frontend)/dashboard/lead-sources/page.tsx`
- Modify: `src/features/lead-sources-admin/ui/views/lead-sources-view.tsx` (the source selection handler; Owner confirms 14)
- Modify: `src/features/lead-sources-admin/ui/components/source-detail.tsx` (the pane remounts per source; Step 4c)
- Modify: `src/trpc/routers/lead-sources.router.ts` (`getCustomers` and two imports)
- Modify: `src/shared/entities/customers/dal/customer-fields.ts`
- Modify: `src/shared/entities/customers/dal/server/customer-field-sql.ts`
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (one doc comment)
- Test (throwaway): `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/customers-table-views.test.ts`

**Interfaces:**
- Consumes: the `DataView` compound (`src/shared/components/data-view/`; the data-view spec's phase 1, which lands before this plan; D65); `useCustomersTable(tableView, { fixed })` and `CustomerColumnKey` (Task 1); `CUSTOMERS_RECORDS_TABLE_VIEW` (Task 1, in the test); `staticDataViewInput`, `loadDataViewQueryInput(searchParams, config, extra?, fixed?)` (part 1).
- Produces: `ALL_CUSTOMERS_TABLE_VIEW` (`all-customers` · `all`, four columns); `LEAD_SOURCE_CUSTOMERS_TABLE_VIEW` (`lead-source-customers` · `src`, no Source column). Removed: `leadSourcesRouter.getCustomers`; `CUSTOMER_FIELDS.sourceId` and `.segment` with their SQL; `ALL_CUSTOMERS_TABLE_QUERY_CONFIG`, `LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG`.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/customers-table-views.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ALL_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/all-customers-table-view'
import { LEAD_SOURCE_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/lead-source-customers-table-view'
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { CUSTOMERS_RECORDS_TABLE_VIEW } from '@/shared/modules/customers/core/constants/customers-records-table-view'

const SOURCE = '11111111-1111-4111-8111-111111111111'
const OTHER_SOURCE = '22222222-2222-4222-8222-222222222222'

test('saved column layouts and bookmarked URLs keep their keys', () => {
  assert.deepEqual(
    [CUSTOMERS_RECORDS_TABLE_VIEW, ALL_CUSTOMERS_TABLE_VIEW, LEAD_SOURCE_CUSTOMERS_TABLE_VIEW].map(view => [view.tableId, view.query.paramPrefix]),
    [['customers', 'pc'], ['all-customers', 'all'], ['lead-source-customers', 'src']],
  )
})

test('only the one-source pane drops the Source column', () => {
  assert.deepEqual(CUSTOMERS_RECORDS_TABLE_VIEW.columns, ['name', 'leadSourceName', 'pipeline', 'createdAt'])
  assert.deepEqual(ALL_CUSTOMERS_TABLE_VIEW.columns, ['name', 'leadSourceName', 'pipeline', 'createdAt'])
  assert.deepEqual(LEAD_SOURCE_CUSTOMERS_TABLE_VIEW.columns, ['name', 'pipeline', 'createdAt'])
})

test('with no URL state every table asks for the newest twenty customers', () => {
  const expected = { pagination: { limit: 20, offset: 0 }, sort: { sortBy: 'createdAt', sortDir: 'desc' }, search: undefined, filters: undefined }
  assert.deepEqual(staticDataViewInput(CUSTOMERS_RECORDS_TABLE_VIEW.query), expected)
  assert.deepEqual(staticDataViewInput(ALL_CUSTOMERS_TABLE_VIEW.query), expected)
  assert.deepEqual(staticDataViewInput(LEAD_SOURCE_CUSTOMERS_TABLE_VIEW.query, { leadSource: [SOURCE] }), { ...expected, filters: { leadSource: [SOURCE] } })
})

test('the pane keeps its page and toolbar filters from the URL, and its source from the pin alone', async () => {
  const input = await loadDataViewQueryInput(
    { src_p: '2', src_pipeline: 'fresh,rehash', src_leadSource: OTHER_SOURCE, src_sourceId: OTHER_SOURCE },
    LEAD_SOURCE_CUSTOMERS_TABLE_VIEW.query,
    undefined,
    { leadSource: [SOURCE] },
  )
  assert.deepEqual(input.pagination, { limit: 20, offset: 20 })
  assert.deepEqual(input.filters, { pipeline: ['fresh', 'rehash'], leadSource: [SOURCE] })
})
```

Run: `NODE_OPTIONS=--conditions=react-server pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/customers-table-views.test.ts`
Expected: FAIL, the module `@/features/lead-sources-admin/constants/all-customers-table-view` is not found.

- [ ] **Step 2: The two table views**

Create `src/features/lead-sources-admin/constants/all-customers-table-view.ts`:

```ts
import type { EntityTableView } from '@/shared/components/data-view/table/types/entity-table-view'
import type { CustomerColumnKey } from '@/shared/entities/customers/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

export const ALL_CUSTOMERS_TABLE_VIEW = {
  tableId: 'all-customers',
  query: {
    fields: CUSTOMER_FIELDS,
    paramPrefix: 'all',
    toolbar: ['pipeline', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['name', 'leadSourceName', 'pipeline', 'createdAt'],
} as const satisfies EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>
```

Create `src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts`:

```ts
import type { EntityTableView } from '@/shared/components/data-view/table/types/entity-table-view'
import type { CustomerColumnKey } from '@/shared/entities/customers/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/** The "Customers from this source" pane. The pane pins its source when it calls the hook, so there is no Source column: it would repeat one value. */
export const LEAD_SOURCE_CUSTOMERS_TABLE_VIEW = {
  tableId: 'lead-source-customers',
  query: {
    fields: CUSTOMER_FIELDS,
    paramPrefix: 'src',
    toolbar: ['pipeline', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['name', 'pipeline', 'createdAt'],
} as const satisfies EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>
```

Delete the old configs: `git rm -- src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts`

Run the test again. Expected: 4 pass.

- [ ] **Step 3: The "All customers" section on the `DataView` parts (Owner confirms 8, 9)**

Replace `src/features/lead-sources-admin/ui/components/all-customers-section.tsx` with (the section wrapper and the eyebrow heading are today's; the count, toolbar root, fill cell, stale dim and empty state come from the parts; `QueryToolbar.Standard` replaces the hand-written toolbar, which was Standard minus the row-cap notice):

```tsx
'use client'

import { ALL_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/all-customers-table-view'
import { DataView } from '@/shared/components/data-view/core/data-view'
import { QueryToolbar } from '@/shared/components/data-view/query-toolbar/ui/query-toolbar'
import { DataTable } from '@/shared/components/data-view/table/ui/data-table'
import { useCustomersTable } from '@/shared/modules/customers/core/components/customers-table/use-customers-table'

export function AllCustomersSection() {
  const { query, visibility, dataTableProps, dialogs } = useCustomersTable(ALL_CUSTOMERS_TABLE_VIEW)

  return (
    <DataView query={query} entityName="customers">
      {dialogs}
      <section aria-label="All customers" className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <DataView.Title as="h3" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              All customers
            </DataView.Title>
            <DataView.Count className="text-xs text-muted-foreground tabular-nums" />
          </div>
          <DataView.Toolbar>
            <QueryToolbar.Standard searchPlaceholder="Filter by name, email or phone…" visibility={visibility} />
          </DataView.Toolbar>
        </div>
        <DataView.Body empty>
          <DataTable {...dataTableProps} />
        </DataView.Body>
      </section>
    </DataView>
  )
}
```

`DataView.Body` draws the `min-h-0 flex-1` cell the old file wrote by hand, so no extra wrapper around `DataTable`. `empty` alone shows the shared "No customers" (`core/ui/empty.tsx`), as the records page does; neither pane had an empty state before, so no new copy. `DataView.Count`'s wording is the shared one (`formatTotalCount`: the number only, spec §11 #9), replacing the pane's "N total"; it carries no typography of its own, so the pane passes the classes its old `<span>` had.

- [ ] **Step 4: The one-source section**

Replace `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` with the same composition, pinned:

```tsx
'use client'

import { LEAD_SOURCE_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/lead-source-customers-table-view'
import { DataView } from '@/shared/components/data-view/core/data-view'
import { QueryToolbar } from '@/shared/components/data-view/query-toolbar/ui/query-toolbar'
import { DataTable } from '@/shared/components/data-view/table/ui/data-table'
import { useCustomersTable } from '@/shared/modules/customers/core/components/customers-table/use-customers-table'

interface LeadSourceCustomersSectionProps {
  leadSourceId: string
}

export function LeadSourceCustomersSection({ leadSourceId }: LeadSourceCustomersSectionProps) {
  const { query, visibility, dataTableProps, dialogs } = useCustomersTable(LEAD_SOURCE_CUSTOMERS_TABLE_VIEW, {
    fixed: { leadSource: [leadSourceId] },
  })

  return (
    <DataView query={query} entityName="customers">
      {dialogs}
      <section aria-label="Customers from this lead source" className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <DataView.Title as="h3" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customers from this source
            </DataView.Title>
            <DataView.Count className="text-xs text-muted-foreground tabular-nums" />
          </div>
          <DataView.Toolbar>
            <QueryToolbar.Standard searchPlaceholder="Filter by name, email or phone…" visibility={visibility} />
          </DataView.Toolbar>
        </div>
        <DataView.Body empty>
          <DataTable {...dataTableProps} />
        </DataView.Body>
      </section>
    </DataView>
  )
}
```

The pane is mounted only in the browser, after the source's own read, so it has no server prefetch and the page passes no `fixed` to a loader.

- [ ] **Step 4b: A new source starts on page 1 (Owner confirms 14)**

`src/features/lead-sources-admin/ui/views/lead-sources-view.tsx` selects a source through `setSelectedId(id, { history: 'push' })` in three callbacks (`onSelect`, `onView`, `onCreated`). Run `git status --short` on the file first (clean on 2026-10-07). Add the imports `import { dataViewUrlKeys } from '@/shared/dal/lib/query/derive-data-view-input'` and `import { LEAD_SOURCE_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/lead-source-customers-table-view'` (`useCallback` from `react` if not already imported), and after the `selectedId` state:

```tsx
  const [, setSourcePanePage] = useQueryState(dataViewUrlKeys(LEAD_SOURCE_CUSTOMERS_TABLE_VIEW.query.paramPrefix).pageKey)
  // The pane's page belongs to the source it was read for; the next source starts on page 1.
  const selectSource = useCallback((id: string) => {
    void setSourcePanePage(null)
    void setSelectedId(id, { history: 'push' })
  }, [setSourcePanePage, setSelectedId])
```

Then replace each of the three `id => setSelectedId(id, { history: 'push' })` callbacks with `selectSource`. `onBack` (back to All) is unchanged: the All pane has its own prefix. nuqs applies both writes as one URL update, so the pane asks once, for page 1 of the new source.

- [ ] **Step 4c: The pane remounts per source**

The hook defers the URL state but not the fixed filter (`use-data-view-query.ts`, `shownState`), so a pane that stays mounted across a switch can pair the old source's page with the new source's id for one render and ask for it. `SourceDetail` already remounts the pane when the new source's own read is not cached (it draws a skeleton meanwhile), but not when it is. A key makes every switch a fresh mount, and also clears a forced error left from the previous source. Run `git status --short src/features/lead-sources-admin/ui/components/source-detail.tsx` first. Replace

```tsx
          <DataViewBoundary>
            <LeadSourceCustomersSection leadSourceId={source.id} />
          </DataViewBoundary>
```

with

```tsx
          {/* One mount per source: the pane's page and error belong to the source they were read for. */}
          <DataViewBoundary key={source.id}>
            <LeadSourceCustomersSection leadSourceId={source.id} />
          </DataViewBoundary>
```

- [ ] **Step 5: The page's prefetch**

In `src/app/(frontend)/dashboard/lead-sources/page.tsx`, replace the `lead-sources-table-query-configs` import with

```ts
import { ALL_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/all-customers-table-view'
```

and the loader call with

```ts
      const input = await loadDataViewQueryInput(params, ALL_CUSTOMERS_TABLE_VIEW.query)
```

- [ ] **Step 6: `getCustomers` and its two fixed-only fields go**

First confirm nothing else uses them:

Run: `grep -rn "getCustomers" src`
Expected: only the procedure itself in `src/trpc/routers/lead-sources.router.ts`.

Run: `grep -rnw "sourceId\|segment" src/features/lead-sources-admin src/features/customer-pipelines src/shared/entities/customers src/shared/entities/lead-sources src/trpc/routers/lead-sources.router.ts src/trpc/routers/customer-pipelines.router.ts --include=*.ts --include=*.tsx`
Expected: only `customer-fields.ts` (the two entries), `customer-field-sql.ts` (the two entries and the `segment-sql` import), the doc comment in `customers/dal/server/queries.ts`, the `getCustomers` lines and the `segment-sql` import in `lead-sources.router.ts`, and `lead-sources/lib/segment-sql.ts` (`buildSegmentWhere`, which stays: `getStatusCounts` calls it directly). The pipeline board's config (`src/features/customer-pipelines/constants/customer-pipeline-query.ts`) lists `rep`, `leadSource` and `createdAt`: neither field. If anything else shows, stop and report it.

`src/trpc/routers/lead-sources.router.ts`: delete the whole `getCustomers` procedure with the comment line above it, and the two imports only it used:

```ts
import { customerListInputSchema, listCustomers } from '@/shared/entities/customers/dal/server/queries'
```

```ts
import { customerSegments } from '@/shared/entities/lead-sources/constants/customer-segments'
```

`TRPCError`, `dalToTrpc`, `db`, `eq`, `leadSourcesTable` and `buildSegmentWhere` are still used by other procedures.

`src/shared/entities/customers/dal/customer-fields.ts`: delete the `sourceId` and `segment` entries and the `customerSegments` import, and drop `fixedOnly` from the `field-list` import:

```ts
import { dateRange, defineFieldList, multiSelect } from '@/shared/dal/lib/query/field-list'
```

`src/shared/entities/customers/dal/server/customer-field-sql.ts`: delete the `sourceId` and `segment` entries of `filter` and the `buildSegmentWhere` import, and drop `eq` from the `drizzle-orm` import:

```ts
import { desc, inArray, sql } from 'drizzle-orm'
```

`src/shared/entities/customers/dal/server/queries.ts`: the doc comment above `listCustomers` becomes

```ts
/** One customers list for every table: the read's visibility decides who sees what; a table narrows it with filters, pinned ones included. */
```

- [ ] **Step 7: Tests, type-check, lint, greps**

Run: `NODE_OPTIONS=--conditions=react-server pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/customers-table-views.test.ts`
Expected: 4 pass.

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: clean. (`defineFieldSql` fails `pnpm tsc` if a filter id and its SQL entry disagree, so the two removals are checked against each other.)

Run: `grep -rn "getCustomers\|CUSTOMERS_TABLE_QUERY_CONFIG\|lead-sources-table-query-configs" src; grep -rln "RecordsPageShell\|RecordsPageHeader\|data-view-type-toggle" src`
Expected: no output (the second is spec §1's success criterion).

Code read for Review Focus 3, with line numbers in the task report: `customersRouter.business.list` is `agentProcedure` (reach from `permit(ctx, 'read', customerServerSpec)`, unrestricted for a viewer who can `manage all`); `src/app/(frontend)/dashboard/lead-sources/page.tsx` still redirects a viewer who cannot `manage all`. And for spec §8: with a deleted source the list returns no rows. ⚠️ The spec says the pane's parent reports the source missing; in the code `source-detail.tsx` draws its skeleton for as long as `getById` has no data, and `getById` throws NOT_FOUND (`lead-sources.router.ts`), so a deleted source shows a skeleton forever. That is today's behaviour, not this plan's: name it in the task report for the owner, with the line numbers.

- [ ] **Step 8: Browser read check (Review Focus 1–4)**

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2 super-admin /dashboard/lead-sources "/dashboard/lead-sources?id=<A>" "/dashboard/lead-sources?id=<B>" "/dashboard/lead-sources?id=<A>&src_p=2&src_leadSource=<B>&src_sourceId=<B>"
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2 "$AGENT" /dashboard/lead-sources
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2 "$DISPATCHER" /dashboard/lead-sources
THEN_CLICK='nav[aria-label="Lead sources"] >> text="<name of B>"' pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2-switch super-admin "/dashboard/lead-sources?id=<A>"
TABLE_PREFS='{"lead-source-customers":{"sizes":{"name":320,"leadSourceName":240},"visibility":{"leadSourceName":false,"pipeline":false}}}' pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2-prefs super-admin "/dashboard/lead-sources?id=<A>"
```

Against `p2-baseline-super-admin.json` and its screenshots, at both widths and in both schemes:
- **All customers pane** (`/dashboard/lead-sources`): the same `columns`, `rows`, `reads[].input` and `reads[].ids`; the section title is unchanged, and the count reads the number alone ("N total" before; spec §11 #9) in the same type;
- **one source's pane** (A, then B): `columns` are Customer, Pipeline, Created (Source is gone, and is not in the Columns menu); `reads` holds only `customersRouter.business.list` entries, each with `input.filters.leadSource` equal to `[<that source's id>]`, and their `ids` and `total` equal the baseline's `leadSourcesRouter.getCustomers` entries for the same source; no entry is a `leadSourcesRouter.getCustomers` read; `url` holds no `src_leadSource` key; the pane's count badge and performance strip above it are unchanged;
- **the old bookmark**: `?id=<A>&src_p=2&src_leadSource=<B>&src_sourceId=<B>` shows page 2 of A's customers (or A's last page if A has one page; the clamp is today's), `input.filters.leadSource` is `[<A>]`, and no chip mentions a source (Review Focus 4);
- **switching from page 2** (run the switch capture from `"/dashboard/lead-sources?id=<A>&src_p=2"` clicking B, then from `"/dashboard/lead-sources?id=<B>&src_p=2"` clicking A, to reach the case where the target source is cached as well as the one where it isn't): after each click the `url` holds no `src_p`, and `reads` holds no read of the clicked source at `offset: 20` (only `offset: 0` and its next-page prefetch) (Owner confirms 14, Step 4c);
- **switching** (`p2-task2-switch`, desktop entries): `reads` holds page 1 for A (asked at load) and page 1 for B (asked after the click), each with its own `filters.leadSource`; the final `rows` are B's baseline rows; `readCount` is under ten (A, B, B's Refresh and their next-page prefetches), where a pin that refetched on every render would show dozens (Review Focus 1);
- **the saved layout** (`p2-task2-prefs`): the table loads with no error; `columns` are Customer and Created (Pipeline hidden by the saved layout, Source absent); the Customer column is visibly wider than in `p2-task2` (Review Focus 2);
- `errors` holds no `[prefetch drift]`, no `[data-view]` and no hydration error the baseline did not have;
- the agent's and the dispatcher's `url` for `/dashboard/lead-sources` is `/dashboard` (Review Focus 3).

The data-view states on both panes (Review Focus 6). In `$W/check-states.mjs` (Task 1 Step 8), set `ROUTES` to the two panes, with A's id from Step 1:

```js
const ROUTES = {
  allPane: { path: '/dashboard/lead-sources', entity: 'customers', proc: 'customersRouter.business.list', row: 'tbody tr[data-customer-row]' },
  sourcePane: { path: '/dashboard/lead-sources?id=<A>', entity: 'customers', proc: 'customersRouter.business.list', row: 'tbody tr[data-customer-row]' },
}
```

Run the three variants, as in Task 1 Step 8:

```bash
node $W/check-states.mjs > $W/states-task2.txt
SCHEME=dark LABEL=sa-dark node $W/check-states.mjs > $W/states-task2-dark.txt
```

(no agent run: neither pane opens for an agent). Expected: every line PASS, as in Task 1 Step 8. The forced error must show its retry inside the pane's section, with the source list and the performance strip still on screen (look at `states-sa-light-sourcePane-1440-error.png`; the retry belongs to the boundary in `source-detail.tsx` / `all-detail.tsx`). At 390 px the All pane is hidden by design (`lead-sources-view.tsx` shows it from `lg` up), so `allPane@390` lines are not applicable; the source pane may sit behind the source list too. A `ran` FAIL at 390 that names a hidden selector is the harness, not the app: say so and keep the 1440 results.

By hand, as a super-admin on desktop, in A's pane: a row click opens the profile modal; a Created cell opens its date picker (close it without picking); the toolbar's Pipeline filter narrows the rows and its chip clears.

- [ ] **Step 9: Commit**

```bash
git add -- src/features/lead-sources-admin/constants/all-customers-table-view.ts src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts
# then, as its own Bash call:
git commit -m "refactor(lead-sources): both customers tables are table views of the customers entity table; one source's pane reads the shared list with its source pinned, and getCustomers goes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/lead-sources-admin/constants/all-customers-table-view.ts src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts src/features/lead-sources-admin/ui/components/all-customers-section.tsx src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx "src/app/(frontend)/dashboard/lead-sources/page.tsx" src/features/lead-sources-admin/ui/views/lead-sources-view.tsx src/features/lead-sources-admin/ui/components/source-detail.tsx src/trpc/routers/lead-sources.router.ts src/shared/entities/customers/dal/customer-fields.ts src/shared/entities/customers/dal/server/customer-field-sql.ts src/shared/entities/customers/dal/server/queries.ts
git show --stat HEAD
```

---

### Task 3: Schedule Meeting opens the new-meeting modal; the Edit Profile action goes (Owner confirms 2, 23–25)

> **Amended 2026-10-23 (Owner confirms 25, D69), while this task ran:** Step 1 is not built; the hook passes only `onScheduleMeeting`; `CUSTOMER_ACTIONS.edit` and the `onEdit` override go from `src/shared/entities/customers/constants/actions.ts` and `src/shared/entities/customers/hooks/use-customer-action-configs.ts`; the Edit Profile checks in Steps 3–4 are replaced by "the row menu lists exactly View Profile, Schedule Meeting and Delete". The steps below are kept as first written for the record.

**Files:**
- Modify: `src/shared/entities/customers/hooks/use-customer-edit-form.ts`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-modal.tsx`
- Modify: `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx`
- Move: `src/features/proposal-flow/ui/components/cockpit/create-meeting-layer.tsx` → `src/shared/entities/meetings/components/create-meeting-layer.tsx` (Owner confirms 23)
- Create: `src/shared/modules/meetings/core/lib/open-create-meeting.ts` (Owner confirms 23)
- Modify: `src/features/proposal-flow/ui/components/cockpit/cockpit.tsx` (its Schedule Meeting calls the opener)
- Modify: `src/shared/dal/client/hooks/use-invalidation.ts` (`invalidateMeeting` refreshes the customers list; Owner confirms 24)

**Interfaces:**
- Consumes: `useCustomersTable` (Task 1); `useCustomerActionConfigs`'s `onEdit` and `onScheduleMeeting` overrides (existing); `CreateMeetingLayer` (the cockpit's, moved here; it wraps `CreateMeetingModal`, the pipeline kanban's Schedule Meeting target, in a modal layer); `openModal` (`src/shared/lib/open-modal.ts`); `useModalLayer`; `invalidateMeeting` from `useInvalidation`.
- Produces: `CustomerProfileModal` prop `defaultEditing?: boolean`; `useCustomerEditForm(customer, { defaultEditing? })`; `openCreateMeeting(props: ComponentProps<typeof CreateMeetingLayer>)`, the one place that names the `CreateMeeting` accessor. In every customers table, Edit Profile opens the profile modal in its edit mode, and Schedule Meeting opens "New meeting — <name>" for that row's customer. The cockpit opens the same modal through the opener. `invalidateMeeting` also refreshes `customersRouter.business.list`. Other callers of `useCustomerActionConfigs` (the kanban, through `CustomerActionsHost`) are untouched, and the kanban and omni-search keep their inline `CreateMeetingModal`.

Today both actions fall through to `router.push(ROOTS.dashboard.pipeline())` in every customers table, because no table passes `onEdit` or `onScheduleMeeting` (`use-customer-action-configs.ts`, `defaultNavigate`).

- [ ] **Step 1: The profile modal can open in edit mode**

`src/shared/entities/customers/components/profile/customer-profile-modal.tsx`: replace the `Props` interface and the function's signature line with

```tsx
interface Props {
  customerId: string
  /** Opens with the edit form on, for a caller whose action was "edit this customer". Ignored for a viewer who cannot edit. */
  defaultEditing?: boolean
  defaultTab?: CustomerProfileTab
  highlightMeetingId?: string
}

export function CustomerProfileModal({ customerId, defaultEditing, defaultTab, highlightMeetingId }: Props) {
```

and pass it down: in the `<CustomerProfileModalContent …>` element, add `defaultEditing={defaultEditing}` above `defaultTab={defaultTab}`.

`src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx`: in `Props`, add `defaultEditing?: boolean` above `defaultTab?: CustomerProfileTab`; add `defaultEditing` to the destructured props (after `data`); and change `const editForm = useCustomerEditForm(data.customer)` to

```ts
  const editForm = useCustomerEditForm(data.customer, { defaultEditing })
```

`src/shared/entities/customers/hooks/use-customer-edit-form.ts`: replace

```ts
export function useCustomerEditForm(customer: CustomerWithProfile) {
  const [isEditing, setIsEditing] = useState(false)
  const ability = useAbility()
```

with

```ts
export function useCustomerEditForm(customer: CustomerWithProfile, { defaultEditing = false }: { defaultEditing?: boolean } = {}) {
  const ability = useAbility()
```

and, right after the line `const canEdit = canEditContact || canEditProfiles || canEditAge`, add

```ts
  const [isEditing, setIsEditing] = useState(defaultEditing && canEdit)
```

(the state moves below the ability reads it depends on; hook order stays fixed on every render). The content mounts only once the profile has loaded, so the form opens on the customer's data, never over the skeleton or the error state.

- [ ] **Step 2: One opener for the new-meeting modal; a booking refreshes the customers list; the hook passes both handlers (Owner confirms 23, 24)**

Run `git status --short src/features/proposal-flow/ui/components/cockpit/ src/shared/dal/client/hooks/use-invalidation.ts` first (the proposal page work edits the cockpit often).

Move the cockpit's layer to the meetings entity, so shared code can open it:

```bash
git mv src/features/proposal-flow/ui/components/cockpit/create-meeting-layer.tsx src/shared/entities/meetings/components/create-meeting-layer.tsx
```

Replace the moved file's contents with (the same layer, and it refreshes meetings on success; the cockpit's booking refreshed nothing before):

```tsx
'use client'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useModalLayer } from '@/shared/hooks/use-modal-layer'

import { CreateMeetingModal } from './create-meeting-modal'

// The modal's other hosts render it inline, outside any layer, so the layer is read here rather than inside it.
export function CreateMeetingLayer({ customerId, customerName }: { customerId: string, customerName: string }) {
  const { isOpen, close } = useModalLayer()
  const { invalidateMeeting } = useInvalidation()
  return (
    <CreateMeetingModal
      isOpen={isOpen}
      onClose={close}
      onSuccess={() => invalidateMeeting({ customerId })}
      customerId={customerId}
      customerName={customerName}
    />
  )
}
```

Create `src/shared/modules/meetings/core/lib/open-create-meeting.ts` (the shape of `open-customer-profile.ts`):

```ts
import type { ComponentProps } from 'react'

import { CreateMeetingLayer } from '@/shared/entities/meetings/components/create-meeting-layer'
import { openModal } from '@/shared/lib/open-modal'

/** Opens the new-meeting modal from anywhere; the one place that names its modal accessor. */
export function openCreateMeeting(props: ComponentProps<typeof CreateMeetingLayer>) {
  openModal({ accessor: 'CreateMeeting', Component: CreateMeetingLayer, props })
}
```

`src/features/proposal-flow/ui/components/cockpit/cockpit.tsx`: delete `import { CreateMeetingLayer } from './create-meeting-layer'`; add `import { openCreateMeeting } from '@/shared/modules/meetings/core/lib/open-create-meeting'` directly below the `MeetingActionsHost` import; and replace

```tsx
    onScheduleMeeting: (customer: { id: string, name: string }) => openModal({
      accessor: 'CreateMeeting',
      Component: CreateMeetingLayer,
      props: { customerId: customer.id, customerName: customer.name },
    }),
```

with

```tsx
    onScheduleMeeting: (customer: { id: string, name: string }) => openCreateMeeting({ customerId: customer.id, customerName: customer.name }),
```

(`openModal` stays imported: Internal financials still uses it.)

`src/shared/dal/client/hooks/use-invalidation.ts`, in `invalidateMeeting`: replace

```ts
    void qc.invalidateQueries(trpc.meetingsRouter.pathFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    void qc.invalidateQueries(cross.customerProfile(opts?.customerId))
```

with

```ts
    void qc.invalidateQueries(trpc.meetingsRouter.pathFilter())
    void qc.invalidateQueries(cross.customerPipeline())
    // A customer's Pipeline is derived from whether a meeting exists, so the customers list reads meetings too.
    void qc.invalidateQueries(trpc.customersRouter.business.list.queryFilter())
    void qc.invalidateQueries(cross.customerProfile(opts?.customerId))
```

If that block is not in the file as written, stop and re-read it.

Then in `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx`:

- add `import { openCreateMeeting } from '@/shared/modules/meetings/core/lib/open-create-meeting'` directly below the `openCustomerProfile` import;
- replace

```tsx
  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({ onView: openProfile })
```

with

```tsx
  const editProfile = useCallback(
    (row: CustomerTableRow) => openCustomerProfile({ customerId: row.id, defaultEditing: true }),
    [],
  )
  const scheduleMeeting = useCallback(
    (row: CustomerTableRow) => openCreateMeeting({ customerId: row.id, customerName: row.name }),
    [],
  )

  // Without these two, Edit Profile and Schedule Meeting fall back to opening the pipeline board.
  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({
    onView: openProfile,
    onEdit: editProfile,
    onScheduleMeeting: scheduleMeeting,
  })
```

`dialogs` stays `<DeleteConfirmDialog />`: the new-meeting modal mounts in the modal layers, outside the table, so opening or closing it re-renders nothing in the table. `CreateMeetingForm` invalidates nothing itself; the layer's `invalidateMeeting` refreshes the meetings reads, the pipeline board, that customer's profile, the dashboard and now the customers list, so a customer's first meeting moves its row from Leads to Fresh. The kanban's own `onSuccess` still refreshes its board.

- [ ] **Step 3: Type-check, lint, code read**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: clean.

Run: `grep -rn "accessor: 'CreateMeeting'\|create-meeting-layer" src`
Expected: only `src/shared/modules/meetings/core/lib/open-create-meeting.ts` (both lines).

Code read, with line numbers in the task report:
- `CUSTOMER_ACTIONS.scheduleMeeting` carries `permission: ['create', 'Meeting']`, so a viewer who cannot book never sees the action that opens the modal.
- `useCustomerEditForm` starts editing only when `canEdit` is true, so Edit Profile opens a viewer who cannot edit on the plain profile.
- List the other callers (`grep -rn "openCustomerProfile(" src`) and confirm that none but this hook passes `defaultEditing`, so they open as before.
- `derived-pipeline-sql.ts` reads meetings (the `EXISTS` on `meetings`), and `invalidateMeeting` now refreshes `customersRouter.business.list`; list `invalidateMeeting`'s callers (`grep -rn "invalidateMeeting(" src`): each one now also refreshes the customers list, which only refetches where a customers table is mounted.

- [ ] **Step 4: Browser read check (nothing submitted)**

With a short script beside `capture.ts` that signs in the same way (the super-admin with no role parameter, then `$AGENT`, then `$DISPATCHER`), on `/dashboard/customers`, at 1440px and at 390px, light and dark:
- open the first row's menu (the button named "Actions") and choose **Edit Profile**: the customer's profile modal opens (title "<name>'s Profile") with its edit form on (the save and cancel buttons show in place of the edit toggle) for each of the three (each can edit some field: Review Focus 5); the URL is still `/dashboard/customers`. Press cancel and close it. **Do not save.**
- choose **Schedule Meeting**: the "New meeting — <name>" modal opens for that row's customer, with its form usable and fully on screen at 390px (Review Focus 5). Press Cancel, then open it again and press Escape: each time the modal closes and the table is as it was. **Do not submit the form.**
- choose **View Profile** and click a row: the profile opens with no form on, as before.
- repeat Edit Profile and Schedule Meeting once in `/dashboard/lead-sources` (All pane) and in one source's pane as a super-admin: the same.
- on `/dashboard/pipeline/fresh`, a card's Schedule Meeting still opens the same modal (that caller passes its own handler).
- in the proposal flow's cockpit, as a super-admin, the customer row's Schedule Meeting opens the same modal through the opener; close it with Escape.

Then re-run the render probe: `node scripts/perf/records-probe.mjs /dashboard/customers > $W/probe-after-task3.txt` (with `W` as in Task 1 Step 8). Expected: no phase renders more rows than `probe-after-customers.txt`.

Screenshots of the Schedule Meeting and Edit Profile states at both widths and in both schemes go in the task report.

- [ ] **Step 5: Commit**

Two Bash calls (Global Constraints). First:

```bash
git add -- src/shared/modules/meetings/core/lib/open-create-meeting.ts
```

Then:

```bash
git commit -m "fix(customers): Edit Profile opens the customer's profile in edit mode and Schedule Meeting opens the new-meeting modal through one opener, as the cockpit did; a booking refreshes the customers list, whose Pipeline is derived from meetings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/entities/customers/hooks/use-customer-edit-form.ts src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx src/shared/entities/customers/components/profile/customer-profile-modal.tsx src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx src/features/proposal-flow/ui/components/cockpit/create-meeting-layer.tsx src/shared/entities/meetings/components/create-meeting-layer.tsx src/shared/modules/meetings/core/lib/open-create-meeting.ts src/features/proposal-flow/ui/components/cockpit/cockpit.tsx src/shared/dal/client/hooks/use-invalidation.ts
git show --stat HEAD
```

---

### Task 4: Components move to the entity whose tree they render (O3)

**Files:**
- Move: `src/shared/entities/customers/components/lists/customer-meetings-list.tsx` → `src/shared/entities/meetings/components/customer-meetings-list.tsx`
- Move: `src/shared/entities/customers/components/lists/customer-projects-list.tsx` → `src/shared/modules/projects/core/components/customer-projects-list.tsx`
- Move: `src/shared/entities/customers/components/lists/project-entity-card.tsx` → `src/shared/modules/projects/core/components/project-entity-card.tsx`
- Delete: `src/shared/entities/customers/components/lists/proposal-row.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`

**Interfaces:**
- Produces: the same three components at their new paths, markup unchanged; `components/lists/` no longer exists. `ProposalRow` is gone (no importer; `MeetingProposalRow` replaced it).

Path-only. The green left border on `project-entity-card.tsx` is a known design finding left for the profile modal's polish pass: do not touch it.

- [ ] **Step 1: Confirm nobody else holds these files**

Run: `git status --short src/shared/entities/customers/components/lists src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`
Expected: no output. If any of the five files shows a change (the profile modal's polish pass edits here), stop and ask.

Run: `grep -rn "lists/proposal-row" src`
Expected: no output: nothing imports it (`MeetingProposalRow` replaced it; the `ProposalRow` type in the proposals registry is a different thing).

- [ ] **Step 2: Move and delete**

```bash
git mv src/shared/entities/customers/components/lists/customer-meetings-list.tsx src/shared/entities/meetings/components/customer-meetings-list.tsx
git mv src/shared/entities/customers/components/lists/customer-projects-list.tsx src/shared/modules/projects/core/components/customer-projects-list.tsx
git mv src/shared/entities/customers/components/lists/project-entity-card.tsx src/shared/modules/projects/core/components/project-entity-card.tsx
git rm -- src/shared/entities/customers/components/lists/proposal-row.tsx
```

`customer-projects-list.tsx` imports `./project-entity-card`, which moves with it; every other import in the three files is an `@/` alias. No edit inside them.

- [ ] **Step 3: The one importer**

In `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`, replace

```ts
import { CustomerMeetingsList } from '../lists/customer-meetings-list'
import { CustomerProjectsList } from '../lists/customer-projects-list'
```

with

```ts
import { CustomerMeetingsList } from '@/shared/entities/meetings/components/customer-meetings-list'
import { CustomerProjectsList } from '@/shared/modules/projects/core/components/customer-projects-list'
```

- [ ] **Step 4: Type-check, lint, read check**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: clean.

Run: `ls src/shared/entities/customers/components/lists 2>/dev/null; grep -rn "components/lists\|\.\./lists/" src --include=*.ts --include=*.tsx`
Expected: no directory, no output.

Browser, super-admin, desktop and 390px: open a customer profile that has meetings and a project (from `/dashboard/customers`); the Meetings tab lists the meeting cards and the Projects tab the project card with its meetings, as before. No screenshot comparison is needed beyond one of each tab.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(customers): the profile's meeting and project lists live with the entity whose tree they render; the unused proposal row goes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/entities/customers/components/lists/customer-meetings-list.tsx src/shared/entities/customers/components/lists/customer-projects-list.tsx src/shared/entities/customers/components/lists/project-entity-card.tsx src/shared/entities/customers/components/lists/proposal-row.tsx src/shared/entities/meetings/components/customer-meetings-list.tsx src/shared/modules/projects/core/components/customer-projects-list.tsx src/shared/modules/projects/core/components/project-entity-card.tsx src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx
git show --stat HEAD
```

---

### Task 5: Hand-off: tracker, spec, notes

**Files:**
- Modify: `docs/plans/2026-09-26-records-management-epic.md`
- Modify: `docs/plans/2026-10-12-data-views-epic.md`
- Modify: `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md`
- Modify: `src/shared/entities/customers/DOCS.md`
- Modify: `docs/ubiquitous-language.md`
- Modify: `docs/codebase-conventions/query-toolkit.md`
- Modify: `docs/codebase-conventions/frontend-stack.md`

Re-read each file first; edit only what this plan built. If a file carries uncommitted hunks you didn't make, do not commit it: report the edit for the owner.

- [ ] **Step 1: The tracker**

In `docs/plans/2026-09-26-records-management-epic.md`:
- the **Status** line at the top: where it lists the order, mark R2 as built ("R2 customers with fixed filters: built") and leave the rest;
- §3, row **R2**, status cell: `[x] built on local main <first-sha>..<last-sha> (part 1: fixed filters, the first-rows window, dashboard reads; part 2: \`useCustomersTable\`, three table views, the one-source pane on the shared list, \`getCustomers\` gone, the \`lists/\` components moved)`, with both parts' first and last commit hashes;
- §3.1 ledger: the **Customers records** row's file becomes `features/records-management/ui/components/customers-records-table.tsx` with every column `[x]`; the two **Lead sources** rows read `[x]` under "Field-list read" and "Shared hook" (through `useCustomersTable`);
- §3.1, the bullet list that defines the shared structure: replace the third bullet ("a records page goes through `EntityRecordsTable`, while a table embedded in another page keeps its own layout and uses only the hook;") with "a records page goes through `EntityRecordsTable`; a table embedded in another page composes the `DataView` parts in its own wrapper (D65);" (do not add a second bullet that contradicts it); the two **Lead sources** rows' "Records page" cells read `n/a (embedded; DataView parts)`;
- **D68** was recorded at the stress test (2026-10-23): leave it as it is;
- §4, row **O3**: append "Audited and moved in R2: `customer-meetings-list` → meetings, `customer-projects-list` and `project-entity-card` → projects, `proposal-row` deleted. The green border on `project-entity-card` stays for the profile modal's polish pass; the `text-[10px]` finding was already gone."

- [ ] **Step 1b: The data-views tracker**

In `docs/plans/2026-10-12-data-views-epic.md`: the **DV4** row's status cell becomes `[x] built on local main (<the commits, named one by one: other sessions' commits interleave on main>), awaiting owner ship with DV3 and DV3a (spec §11 #18); the customers route on the loading-screen rule; RecordsPageShell and RecordsPageHeader deleted`; in "From DV3's final review", mark the three-comments item done (Task 1 Step 10's commit), and leave the two owner calls as they are. Rewrite the **Status** line as a whole (on 2026-10-23 it still said "Next is DV3a"): DV3, DV3a and DV4 built on local main, awaiting the owner's ship together, and the next step, and drop customers from H4 ("customers, proposals and pipeline compose `DataViewBoundary` … twice": only pipeline is left, until DV6).

- [ ] **Step 2: The spec's status**

In the spec, replace the **Status** line with `> **Status:** approved by the owner 2026-10-05; rulings of 2026-10-07 applied; built (plans: \`docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md\` and \`…-part-2.md\`).` Under §5.5, say in one sentence what was built: Schedule Meeting opens the new-meeting modal through `openCreateMeeting` (D66, D68), and the Edit Profile action was deleted (D69, already recorded there).

- [ ] **Step 3: Notes that name moved or deleted paths**

- `src/shared/entities/customers/DOCS.md`, line 5: it places the column registries in `constants/`; the registry is `lib/columns-registry.tsx`. Fix it with the next edit.
- `src/shared/entities/customers/DOCS.md`, the "This directory holds" line: replace "components grouped by surface (`components/profile/`, `components/lists/`, `components/timeline/`)" with "components grouped by surface (`components/profile/`, `components/timeline/`); the entity table hook and `openCustomerProfile` already sit at the module address, `src/shared/modules/customers/core/`".
- `docs/ubiquitous-language.md`, the action-surface table: the `Profile/Projects/Project` row's file becomes `shared/modules/projects/core/components/project-entity-card.tsx`; the `Profile/Projects/Project/Meeting/Proposal` row's file becomes `shared/entities/meetings/components/meeting-proposal-row.tsx` (it already lived there; the row was stale).
- `docs/codebase-conventions/query-toolkit.md`, section "shared-table-config": its **Reference impl** line names the deleted `src/shared/entities/customers/constants/customers-table-query-config.ts`; point it at `src/shared/modules/customers/core/constants/customers-records-table-view.ts` (the `query` of a table view). The section's text still describes the legacy `PaginatedQueryConfig` names; leave that and name it in the report.
- `docs/codebase-conventions/query-toolkit.md`, rule "always-use-usepaginatedquery" (lines 35–40 on 2026-10-23): this plan makes `use-customers-table.tsx` one of its references, but the rule says paginated reads go through `usePaginatedQuery`, while every data-view table (projects, meetings, now customers) reads through `useDataViewQuery` and its page loader `loadDataViewQueryInput`. Rewrite the rule's text to say that, and that `usePaginatedQuery` remains only for proposals and campaign leads until R3 and DV9 move them; keep its anchor so links still land. The same for `docs/codebase-conventions/frontend-stack.md` line 31 (Tier 2 tables), which still prescribes `loadPaginatedQueryInput` / `usePaginatedQuery`.
- `docs/codebase-conventions/query-toolkit.md`, the section whose **Reference impl** is `src/shared/entities/customers/components/customers-table.tsx` ("hand-rolled state diverges"): point it at `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx`.
- `docs/codebase-conventions/query-toolkit.md`, the prefix section ("two tables sharing `?p=` reset each other"): its **Reference impl** names the two sections for `src_*` / `all_*`; point it at `src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts` (`src`) vs `all-customers-table-view.ts` (`all`), where the prefixes now live.
- `docs/codebase-conventions/query-toolkit.md`, "See also": its first bullet calls `lead-source-customers-section.tsx` the "reference full-stack impl"; point it at `src/shared/modules/customers/core/components/customers-table/use-customers-table.tsx` ("reference entity table hook: read, pinned filters, actions, meta").
- `docs/codebase-conventions/frontend-stack.md`, the Tier 1 / Tier 2 **Reference impl** line: replace `src/shared/entities/customers/components/customers-table.tsx` (Tier 2) with `src/features/records-management/ui/components/customers-records-table.tsx` (Tier 2).

- [ ] **Step 4: Report what this plan leaves stale elsewhere**

Do not edit these; list them in the task report for the owner:
- `docs/superpowers/specs/2026-09-29-customers-module-design.md` (lines naming `core/components/lists/project-entity-card.tsx` as moving with customers, and `lists/proposal-row.tsx` as a Phase 1 deletion): both already happened here.
- `docs/superpowers/specs/2026-10-01-customer-profile-modal-design.md` and its plan name `components/lists/customer-meetings-list.tsx`, now `src/shared/entities/meetings/components/customer-meetings-list.tsx`.
- Found by the 2026-10-23 stress test, outside this plan:
  - A deleted lead source draws `source-detail.tsx`'s skeleton forever (`getById` throws NOT_FOUND); the customers spec §8 says the parent reports it missing.
  - `docs/adr/0002-entity-server-system.md` (line 175 on 2026-10-23) allows `db` imports only from `shared/dal/` and `shared/entities/*/dal/`, but `src/shared/modules/*/core/dal/server/` exists.
  - `src/trpc/routers/lead-sources.router.ts` imports `db` and runs raw `db.*` calls, against ADR-0002's DAL-only rule; this plan removed one (`getCustomers`).
  - The lint guard `project/no-inline-table-config` (`eslint.config.js`) matches only `usePaginatedQuery` / `loadPaginatedQueryInput`, so `useDataViewQuery` / `loadDataViewQueryInput` callsites are unguarded.
  - The data-view spec (§6, §10) says the records ledger §3.1 gained a "DataView parts" column; the ledger has none.
  - `.superpowers/harness/data-view-harness.ts`, `.claude/agents/knowledge/convention-auditor-ledger.md` and `docs/superpowers/plans/2026-10-12-omni-search.md` (shipped, not deleted) still name `CUSTOMERS_TABLE_QUERY_CONFIG`.
  - Memory `coding-conventions.md` (rules 8, 13, 20) predates `src/shared/modules/`; memory `project-modal-layers.md` cites the deleted modal-layers spec.

- [ ] **Step 5: Session memory (not in git)**

In `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-records-table-enrichment.md` and `project-data-view-filtering.md`, record: R2 built (both parts, commit range); the data view has `fixed` (config and runtime) and a `first` window; the three customers tables are table views of `useCustomersTable`; next is R3 proposals. In `project-modal-layers.md`, record `openCreateMeeting` (D68) beside `openCustomerProfile`. In `project-data-view-surface.md`, record DV4 built. Update the matching lines in `MEMORY.md`.

- [ ] **Step 6: Commit**

```bash
git commit -m "docs(records): R2 is built; the tracker, the spec and the notes that named moved files follow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/plans/2026-09-26-records-management-epic.md docs/plans/2026-10-12-data-views-epic.md docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md src/shared/entities/customers/DOCS.md docs/ubiquitous-language.md docs/codebase-conventions/query-toolkit.md docs/codebase-conventions/frontend-stack.md
git show --stat HEAD
```

---

## Self-review notes (kept for the executor)

- **Spec coverage.** §5.2 (the hook) → Task 1 Step 3; §5.3 (three table views, the records table, old files deleted) → Task 1 Steps 4–6, Task 2 Steps 2–5; §5.4 (the pane's read, `getCustomers`, `sourceId`, `segment`) → Task 2 Steps 4 and 6; §5.5 → Task 3; §7 (ownership moves) → Task 4; §8 (deleted source, old bookmark, two prefixes) → Task 2 Steps 1, 7 and 8; §10 (tracker) → Task 5, with H2 and O9 done in part 1; §11 (baseline, URL keys, saved layout, one request, console) → Task 1 Steps 1 and 8, Task 2 Step 8. Success criteria: the `getCustomers` grep is Task 2 Step 7; the `liveOnly` grep is part 1.
- **Type consistency.** `CustomerTableRow` (Task 1 Step 2) types the registry, `useCustomerActionConfigs<CustomerTableRow>`, `openProfile`, `scheduleMeeting` (Task 3) and the query rows. `CustomerColumnKey` types all three table view constants. `UseCustomersTableOptions.fixed` is `FilterValues<typeof CUSTOMER_FIELDS>`, the type of `useDataViewQuery`'s fourth argument; the pane's `{ leadSource: [leadSourceId] }` matches the field's `string[]` value. `defaultEditing` is the same name in the modal, its content and `useCustomerEditForm`.
- **Order.** Task 0 is a check only. Task 2 needs Task 1's hook and types. Task 3 edits the hook from Task 1. Task 4 is independent and may run any time after Task 1. Task 1 Step 10 waits for the owner's clearance and is independent of the rest. Task 5 is last.
- **Data-view spec coverage (DV4's share).** §3.8 (customers onto the loading-screen rule) → Task 1 Step 6; §4 and §6 (`RecordsPageShell`, `RecordsPageHeader` deleted with their last caller) → Task 1 Step 6, with spec §1's grep in Task 2 Step 7; §4 "Panes (lead-sources ×2)" → Task 2 Steps 3–4; §8 (states forced once each, probes, return checks) → Task 1 Step 8 and Task 2 Step 8; §9 (dispatcher reach) → Review Focus 3 and the dispatcher runs.
- **Checked while writing (2026-10-05, on a scratch copy of the tree at `834614d7` with part 1 applied).** Every code block here was applied in task order, and `tsc --noEmit` and ESLint passed after Tasks 1, 2, 3 and 4; the table views test passed (4). The capture script was type-checked only; no browser step was run.
- **Re-checked 2026-10-20 (DV4), by reading only:** the replace targets against the files at `74b158894`; the import paths against DV3a's tree; the sketches' imports re-sorted for the new paths. The code blocks changed since 2026-10-05 (the hook's `createdAt` gate, Task 1 Step 6's view, page and loading screen, Task 2's `Count` classes) were not applied to a scratch tree: `pnpm tsc` and ESLint after each task are the check.
- **Stress-tested 2026-10-23, by reading only** (four lenses: conventions, reuse, completeness, vocabulary and hygiene). Every import path and named export in the code blocks exists at `1f7542e2b`; the greps return what the steps expect; the unmerged `feat/filter-grouping-fields` branch shares no file with this plan. The blocks added that day (`search.service.ts` in Task 1 Step 6, the remount in Task 2 Step 4c, the layer, the opener, the cockpit and `invalidateMeeting` in Task 3 Step 2, the capture script's sign-in) were not applied to a scratch tree: `pnpm tsc`, ESLint and `pnpm theme:check` after each task are the check.
