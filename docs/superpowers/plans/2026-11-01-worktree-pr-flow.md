# Worktree → PR Flow Implementation Plan

> **Status**
> - Stage: building · second `/stress-test-plan` 2026-11-22 folded in (rulings WF9–WF13) · T1, T12, T13, T14 partly done
> - Built on: `origin/main` (no lane branch) · Verified at: `origin/main@75d085907` (2026-11-22) · page: https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS#lane-dev-flow
> - Done: T0 (#289) · T12 Steps 1–3 (#293, #294; no vercel.app wildcard) · T1 steps 4, 5, 7 + idle sleep · T13 port claim · T14 per-checkout pre-commit gate, pre-ship retired, lane rules in CLAUDE.md (#295, #296)
> - Next: the execution order under Rulings (WF9): T1 → T7 → T9 → T2–T3 → T3a → T4–T6 → T8 → T10 → T12 rest → T15 → T16. Lane creation, `wt:db link`, previews, Orca hooks and the ship skill go to the lane-linking plan (WF13, not written yet).
> - Open: dev-flow-next-after-t0 · dev-flow-repo-private · WF12 Vercel token home (blocks the lane-linking plan's `link`) · T10's removal of four non-`db:*` prod scripts not in the spec (owner OK) · Lane / Lane copy / Review slot not in `GLOSSARY.md` (owner to agree the terms) · plan A (merge commits) design not written
> - Blocked: none

## Rulings

| # | Ruling | Date |
|---|---|---|
| WF1 | Execute the plan in order, Task 0 first. The orient page (above) is the living tracker for this plan: what is built, files affected, key code facts, infra and patterns, so the owner has visibility into the new structure as it lands. | owner, 2026-11-06 |
| WF3 | "For now let's not disable it. We'll keep it convention." Squash and merge stays a convention: the repo keeps all three merge buttons, so Task 14's "Repo setting: squash-merge only" and Task 16's "allow squash merge only" are skipped until the owner reopens it. | owner, 2026-11-18 |
| WF2 | Task 0 runs as one `/pre-ship` session this week with the owner present: sort the 189 commits and the dirty tree into ship / move to a branch / drop, then one push to `origin/main`. | owner, 2026-11-06 |
| WF4 | Keep a quick hotfix path, tiered by risk: UI, copy or style = a small `fix/<slug>` lane from `origin/main` → PR → squash; business or server logic = the same plus the lane's tests and the preview Playwright check; a schema change is never a hotfix. Task 15 rewrites `scripts/hotfix.sh` for this (start a `fix/` worktree, open its PR) instead of deleting it. | owner, 2026-11-21 |
| WF5 | No guard on local main: editing there stays an escape hatch. The rule is to commit on a branch (`git switch -c fix/<slug>` carries the edits), and every doc must stop telling sessions to work on local main. | owner, 2026-11-21 |
| WF6 | "When we merge a worktree, the work is not done yet. We sometimes want to merge a worktree that has some work done already, while not destroying the worktree (as we're still bug hunting for example). Essentially, we are ok with shipping features when they're 'good enough' while we're still working on them." Branches are not auto-deleted after merge; a shipped worktree and its branch keep going. Supersedes CLAUDE.md "Delete the branch and worktree; a squashed branch is never reused" and "the epic worktree … never opens a PR" (CLAUDE.md fixed in #296). | owner, 2026-11-21 |
| WF7 | "We checked our preview db and it pointed to our dev db. It needs to point to our neon wt db." A lane's preview uses that lane's own Neon copy (`wt/<slug>`), not shared dev. Task 11's mechanism is reopened: the owner picks how. | owner, 2026-11-21 |
| WF8 | Mechanism for WF7: a Preview-only, branch-scoped, Sensitive `DATABASE_DEV_URL` per lane pointing at its `wt/<slug>` copy (the app prefers it over `DATABASE_URL` off production); not the Neon–Vercel integration, which forks unscrubbed prod and rewrites Production's `DATABASE_URL`. No manual per-worktree setup: "We'll wait for task 3 (so we don't need to do this manually per worktree). This process of linking a worktree to a lane to a GitHub issue, retrieved and organized on the parallel ship board, with its own preview and Neon db instance, is the central focus." Task 3's `wt:db create/delete` adds and removes the Vercel variable (Vercel refuses a branch it has not seen, so it lands at or after the lane's first push). Reviewed reference script: `~/claude-archive/2026-11-21-lane-preview-db/set-lane-preview-db.mjs`. | owner, 2026-11-21 |
| WF9 | Baseline first, then `wt:db`. Prod has no `drizzle.__drizzle_migrations` (it was always `db:push`), so drizzle's `migrate()` would run the stale `0000_tearful_william_stryker.sql` on any prod copy and fail on its first `CREATE TYPE`. T9 therefore runs on a copy made by hand in the Neon console and lands on prod before T3's live run; `migrateDb` (moved into T9) refuses a database with no baseline row. Execution order: T1 → T7 → T9 → T2–T3 → T3a → T4–T6 → T8 → T10 → T12 rest → T15 → T16. | owner, 2026-11-22 |
| WF10 | "During the worktree creation (this should 'link' vercel's deployment/neon/gh issues/worktree in one go when we opt for creating a new lane). Creating a new worktree db instance VS reusing dev is an explicit decision … and it should always be possible to add a worktree db as soon as we see that the worktree actually does need one and link that new neon wt db instance to our vercel preview." Entry point: a `/new-lane` skill plus a `pnpm lane` command. The agent asks "own database or shared dev?", makes the worktree, pushes the branch (Vercel accepts a branch variable only once the branch exists), runs `wt:db create` + `wt:db link` when chosen, links or opens the issue, adds the board row. `pnpm wt:db create` in any lane later also links. Orca setup stays install + port. | owner, 2026-11-22 |
| WF11 | Re-fork now: the four lane copies forked from `development` (`wt/data-views`, `wt/proposal-page`, `wt/home-visit-messages`, `wt/office-tv-mode`) are retired and re-created from prod by `wt:db create`, each lane's schema re-applied as a migration. Their test data goes (accepted). Task 3a. | owner, 2026-11-22 |
| WF12 | Where the Vercel token lives (it can likely read Production variables not marked Sensitive): decide later. Until decided, nothing builds `wt:db link`. | owner, 2026-11-22 |
| WF13 | Split a lane-linking plan out of this one: lane creation (WF10), `wt:db link`, previews on lane copies (WF7, WF8), Orca hooks, the ship skill, rewritten for WF3 and WF6. This plan keeps the safety base. Old T11, T13 and T14's skill move there with the requirements listed under "Handed to the lane-linking plan". | owner, 2026-11-22 |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One idea = one Orca worktree (own port, own scrubbed Neon branch) = one PR with a signed-in Vercel preview; `main` mirrors prod; no full prod credentials on any local machine, and no copy can reach real people or live files.

**Architecture:** Neon branch lifecycle moves from `scripts/dispatch.sh` into a small TypeScript CLI (`pnpm wt:db`); the lane-linking plan (WF13) calls it from lane creation and Orca's archive hook. Production is a protected Neon branch, so every copy gets its own password. Schema changes become Drizzle migrations applied by a `vercel-build` script under an advisory lock (prod on production deploys; previews on their lane copy arrive with the lane-linking plan). Prod is reached in full only by Vercel production and an owner-approved `workflow_dispatch` Action; locally `DRIZZLE_TARGET=prod` reaches prod only as the `photos_writer` login. Sign-in on any host goes through better-auth's `oAuthProxy` via the one registered prod callback.

**Tech Stack:** Next.js 15 on Vercel, Neon API v2 (Launch plan), drizzle-kit 0.31.8 / drizzle-orm 0.45.1, better-auth 1.6.9, GitHub Actions, Orca (`orca.yaml`), tsx scripts with `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-01-worktree-pr-flow-design.md` (amended 2026-11-02 after `/stress-test-plan`)

## Global Constraints

- Package manager `pnpm`; path alias `@/` → `src/`. Never `pnpm build` locally. Verify with `pnpm lint && pnpm tsc`, plus `pnpm exec eslint <each new or edited file under scripts/ or at the repo root>`: `pnpm lint` is `next lint`, which never lints `scripts/` or `drizzle.config.ts`.
- Tests follow the repo idiom: `scripts/verify-*.ts` using `node:assert/strict`, run with `pnpm tsx scripts/verify-<name>.ts`, printing one `✅ …` line on success.
- Scripts import `./lib/load-env` FIRST, inside the reasoned `perfectionist/sort-imports` disable block (memory `feedback-scripts-load-env.md`).
- Comments say why, never what. No new `DOCS.md` files.
- Stage and commit by explicit path only (`git add -- <paths>`; `git commit -- <paths>`); never `git add -A`, `stash`, `reset --hard`, `checkout .`, `--amend`. `drizzle.config.ts` is CRLF: edit it with the Edit tool and check `git diff --shortstat` stays small. The Claude pre-commit hook takes ~110 s of a 120 s budget: batch commits.
- Every outward action (GitHub settings, repo visibility, Vercel settings, Google Cloud, Neon console, running the prod-script Action) is confirmed with the owner first, each time. Every step that creates, resets or deletes a Neon branch, or runs SQL against any database, runs only after the owner says "run" for that step ("go ahead" on the plan is not that). Resetting the owner's dev data (`db:refresh:dev`) needs its own explicit OK: their hand-edited dev fixtures go with it.
- Each phase ships as its own branch + PR off `origin/main`. Scripts, CI and docs tasks (T2–T4, T7, T9, T10, T15) branch in the main checkout with `git switch -c <type>/<slug>`, no worktree (memory `feedback-no-worktree-for-non-app-work`); app tasks (T5, T6) take a worktree via Orca. Merge `origin/main` into the branch, never rebase or force-push.
- Agents never merge a PR and never push to `main`; the owner squash-merges. Only Oliver starts a dev server: any step that needs one names him as the actor. No DB writes for visual testing.
- App tasks pass the preview Playwright check from CLAUDE.md ("Verify on the preview") before they reach the owner.
- Full prod writes only from: Vercel production deploys (migrations) and the prod-script Action. Locally `DRIZZLE_TARGET=prod` reaches prod only as `photos_writer`. Unset never means prod.
- Neon branch names: lane copies `wt/<slug>`. Migrations, scrubs and the advisory lock use the unpooled URL (`unpooledUrl`, Task 2); the pooled URL is only for the running app.
- Scrub is fail-closed: a branch whose scrub fails is deleted and the command exits non-zero.
- Migrations run through `migrateDb(url)` (Task 9), never `drizzle-kit migrate`: `drizzle.config.ts` loads `.env.local` with `override: true`, which beats any URL passed in.

## Review Focus

1. **Scrub fails partway** (bad statement, dropped connection) → branch deleted, `wt:db create` exits 1, no `DATABASE_DEV_URL` written, and the app in that worktree refuses to boot. Test in Tasks 3 and 5.
2. **Setup re-run on a half-made copy** (setup killed after the fork, before the scrub) → the copy has no scrub marker, so it is deleted and forked again; a clean copy is reused and still migrated; a lane whose `.env.local` already names a live copy keeps it. Test in Task 3.
3. **A database with no baseline** (prod before T9 Step 5, a hand-made copy) → `migrateDb` refuses with a plain message and runs no SQL file. Test in Task 9.
4. **Two PRs' migrations merged out of order** (an added journal entry older than `main`'s newest) → CI fails with a plain message; nothing reaches prod. Test in Task 10.
5. **Odd git branch names** (`feat/Filters_Grouping`, `feat/a_b` vs `feat/a-b`, 80+ chars, detached HEAD) → distinct, valid Neon names; an empty name is refused. Test in Task 2.
6. **CI with the boot check on** (no `VERCEL_ENV`, no `DATABASE_DEV_URL` in `.env.ci`) → the PR Checks build stays green. Check in Task 5.

---

### Task 0: Transition — drain local main (owner-led)

**Files:** none created; working tree only.

- [ ] **Step 1:** Run `/pre-ship` on the 177 local commits plus the dirty tree. Owner decides per item: ships, moves to a branch, or is dropped. Dirty today: `.claude/agents/knowledge/convention-auditor-ledger.md`, `.claude/settings.json`, `.claude/skills/pre-ship/*`, `CLAUDE.md`, `docs/adr/0006-…`, two modified plans/epics, `scope-phase-list.tsx`, and untracked `orca.yaml`, `.worktreeinclude`, four specs/plans (this spec and plan included).
- [ ] **Step 2:** Push the approved result to `origin/main` (owner confirms the push). Verify `git rev-list --count origin/main..main` → `0` and `git status --short` is empty (or holds only items the owner moved aside).
- [ ] **Step 3:** For each existing worktree (`edit-proposal-layout`, `filter-grouping-fields`, `issue-285`, `trade-scenes`, `perf-baseline`, `perf-profile`, `stress-prod`, `prod`, `media-before`, `perf-tools`), print branch (or "detached"), commits ahead of `origin/main`, last commit date, and Neon branch if any. Owner picks: open PR / push and park / delete. Execute the picks.
- [ ] **Step 4:** Verify `git worktree list` shows only the kept worktrees, and `pnpm dispatch neon-prune` (still present) reports no orphans.

### Task 1: Lock the doors (console steps, owner-confirmed)

**Files:** owner's local `.env` (not committed). Record findings in the PR body of Task 2.

- [ ] **Step 1: Neon.** Plan is Launch (verified 2026-11-02). Mark `production` **protected**. Set the project default suspend timeout so non-prod computes scale to zero. Verify via Neon API `GET /branches` → production `"protected": true`.
- [ ] **Step 2: Prove copies get new passwords.** In the Neon console, create a throwaway child of production, copy its connection string, and try that password against the prod host. **Expected: authentication fails.** Delete the child. If it connects, stop and tell the owner (Tasks 2 and 11 assume new passwords).
- [ ] **Step 3: Prod endpoint id everywhere it is needed.** Owner adds `NEON_PROD_ENDPOINT_ID=<prod endpoint id>` to local `.env` and to Vercel Preview and Production.
- [ ] **Step 4: Vercel env audit, per scope (Production, Preview).** List which of these are set, and for DB URLs which Neon endpoint they point at: `DATABASE_URL`, `DATABASE_DEV_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BASE_URL`, `NGROK_URL`, `EMAIL_DEV_OVERRIDE`, `VOIP_DEV_OVERRIDE_NUMBER`, `META_TEST_EVENT_CODE`, `QSTASH_*`, `ABLY_*`, `R2_*`, `ZOHO_*`. **Report to the owner immediately if any Preview DB URL points at the prod endpoint.** If `EMAIL_DEV_OVERRIDE` or `VOIP_DEV_OVERRIDE_NUMBER` is missing in Preview, add them (owner supplies values).
- [ ] **Step 5: Canonical prod host.** `curl -sI https://triprosremodeling.com https://www.triprosremodeling.com` → note which one answers 200 without redirecting; compare with the redirect URI registered on the Google OAuth client. Record it; Task 12 uses it as `productionURL`.
- [ ] **Step 6: Repo private.** Before flipping, list what depends on the repo being public (Vercel Git integration access, public links to the repo, Actions minutes). Then the owner upgrades to GitHub Pro and sets `OlisDevSpot/tri-pros-website` private. Verify `gh repo view --json visibility` → `PRIVATE`, and Vercel still deploys (push an empty commit on a scratch branch, see a preview build start).
- [ ] **Step 7: Preview protection.** Enable Vercel Deployment Protection → Vercel Authentication for Preview, plus **Protection Bypass for Automation** (QStash/Twilio callbacks). Verify a preview URL in a logged-out browser shows the Vercel login.

### Task 2: Neon client additions and branch naming

**Files:**
- Modify: `scripts/lib/neon-api.ts` (add methods to `NeonClient`; rewrite the "(dispatch uses the same two)" comment at line 27)
- Modify: `scripts/lib/neon-refresh.ts` (add `updated_at: string` to `NeonBranch`; add `unpooledUrl` next to `endpointIdFromUrl`)
- Create: `scripts/lib/neon-worktree.ts`
- Test: `scripts/verify-neon-worktree.ts`

**Interfaces:**
- Produces (`neon-api.ts`, on `NeonClient`; reuse `waitForOperations`):
  - `createBranch(name: string, parentId: string): Promise<{ branch: NeonBranch, operations: NeonOperation[] }>` — `POST /branches` with `{ branch: { name, parent_id }, endpoints: [{ type: 'read_write' }] }`
  - `deleteBranch(branchId: string): Promise<NeonOperation[]>` — treats 404 as `[]`
  - `connectionUri(branchId: string, opts: { pooled: boolean, prodBranchId: string }): Promise<string>` — refuses `Refusing: <id> is the production branch` when `branchId === prodBranchId`, BEFORE any request (spec Residual risks: the scripts never fetch prod's address); then `GET /connection_uri?branch_id=…&database_name=neondb&role_name=neondb_owner&pooled=…`
- Produces (`neon-refresh.ts`, pure): `unpooledUrl(url: string): string` — strips `-pooler` from the host; migrations and the advisory lock need a session connection, which Neon's pooler (PgBouncer, transaction mode) does not hold.
- Produces (`neon-worktree.ts`, pure):
  - `neonBranchName(gitBranch: string): string` — throws on an empty or whitespace name; `wt/` + `slugify(gitBranch, { maxLen })` (`src/shared/lib/slugify.ts:5`, no parallel slug rule); appends `-<6-char hash of the raw name>` only when the slug differs from `gitBranch.toLowerCase().replaceAll('/', '-')` (so `feat/a_b` and `feat/a-b` part ways) or was truncated
  - `prodBranchId(endpoints: NeonEndpoint[], prodEndpointId: string): string` — throws if not found
  - `assertNotProdEndpoint(url: string, prodEndpointId: string | undefined): void` — built on `endpointIdFromUrl` (`neon-refresh.ts:20-26`); throws `Refusing: NEON_PROD_ENDPOINT_ID is not set` when the id is empty, and `Refusing: <host> is the production endpoint` on a match (pooled or direct host)
  - `prunePlan(input: { branches: NeonBranch[], liveBranchIds: string[], now: Date, idleDays: number }): { orphans: NeonBranch[], idle: NeonBranch[] }` — only `wt/*` branches considered; liveness by Neon branch id (read from each worktree's `.env.local`)

- [ ] **Step 1: Write the failing test** `scripts/verify-neon-worktree.ts`:

```ts
assert.equal(neonBranchName('feat/filters-grouping'), 'wt/feat-filters-grouping')
assert.match(neonBranchName('feat/Filters_Grouping/'), /^wt\/feat-filters-grouping-[a-z0-9]{6}$/)
assert.notEqual(neonBranchName('feat/a_b'), neonBranchName('feat/a-b'))
assert.equal(neonBranchName(`feat/${'x'.repeat(100)}`).length <= 63, true)
assert.notEqual(neonBranchName(`feat/${'x'.repeat(100)}a`), neonBranchName(`feat/${'x'.repeat(100)}b`))
assert.throws(() => neonBranchName(''), /branch name/)
assert.throws(() => assertNotProdEndpoint('postgres://u:p@ep-prod-123-pooler.x.neon.tech/db', 'ep-prod-123'), /production endpoint/)
assert.throws(() => assertNotProdEndpoint('postgres://u:p@ep-prod-123.x.neon.tech/db', 'ep-prod-123'), /production endpoint/)
assert.throws(() => assertNotProdEndpoint('postgres://u:p@ep-dev-9.x.neon.tech/db', undefined), /not set/)
assert.doesNotThrow(() => assertNotProdEndpoint('postgres://u:p@ep-dev-9.x.neon.tech/db', 'ep-prod-123'))
assert.equal(prodBranchId([{ id: 'ep-prod-123', host: 'h', branch_id: 'br-prod' }], 'ep-prod-123'), 'br-prod')
assert.equal(unpooledUrl('postgres://u:p@ep-dev-9-pooler.x.neon.tech/db?sslmode=require'), 'postgres://u:p@ep-dev-9.x.neon.tech/db?sslmode=require')
// connectionUri('br-prod', { pooled: false, prodBranchId: 'br-prod' }) rejects /production branch/ and the fake fetch saw no request
// prunePlan: wt/a live (id in liveBranchIds), wt/b orphan, preview/x ignored, wt/a idle when updated 20 days ago with idleDays 14
```

- [ ] **Step 2:** `pnpm tsx scripts/verify-neon-worktree.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement the three `NeonClient` methods and the pure module.
- [ ] **Step 4:** Test → `✅ neon-worktree verified`. `pnpm tsc` and `pnpm exec eslint scripts/lib/neon-api.ts scripts/lib/neon-refresh.ts scripts/lib/neon-worktree.ts scripts/verify-neon-worktree.ts` clean.
- [ ] **Step 5:** Commit `feat(scripts): neon branch client and worktree naming`.

### Task 3: `pnpm wt:db` — create, delete, prune (fail-closed)

Runs after T9 Step 5 (WF9): prod carries the baseline row, so every fork inherits it and `migrateDb` applies only newer files.

**Files:**
- Create: `scripts/lib/scrub.ts` (move `scrub()` out of `refresh-dev-from-prod.ts`)
- Create: `scripts/lib/worktree-db.ts` (orchestration with injected deps)
- Create: `scripts/lib/env-file.ts` — `upsertEnvKeys(text, entries)` built from `slotEnvLocal`'s drop-and-append (`scripts/lib/review-slot.ts:83-88`, which then imports it); reads go through `dotenv.parse`, no new hand parser
- Create: `scripts/worktree-db.ts` (CLI)
- Modify: `scripts/lib/neon-refresh.ts` — audit `SCRUB_STATEMENTS`
- Modify: `scripts/refresh-dev-from-prod.ts` — import `scrub` from `scripts/lib/scrub.ts`
- Modify: `package.json` — `"wt:db": "tsx scripts/worktree-db.ts"`
- Test: `scripts/verify-worktree-db.ts`

**Interfaces:**
- Consumes: Task 2 `NeonClient` methods, `neonBranchName`, `prodBranchId`, `assertNotProdEndpoint`, `prunePlan`, `unpooledUrl`; Task 9 `migrateDb`.
- Produces:
  - `scrub(connectionString: string): Promise<void>` in `scripts/lib/scrub.ts` — runs `SCRUB_STATEMENTS` and, in the same transaction, creates `drizzle.__scrubbed (at timestamptz)` with one row. Prod never has this table.
  - `isScrubbed(connectionString: string): Promise<boolean>` — true when `drizzle.__scrubbed` exists
  - `createWorktreeDb(deps: WorktreeDbDeps, input: { gitBranch: string, knownBranchId?: string }): Promise<{ branchId: string, url: string, reused: boolean }>`
  - `deleteWorktreeDb(deps: WorktreeDbDeps, target: { branchId?: string, gitBranch?: string }): Promise<void>`
  - `WorktreeDbDeps = { neon: NeonClient, scrub: (url: string) => Promise<void>, isScrubbed: (url: string) => Promise<boolean>, migrate: (url: string) => Promise<unknown>, prodEndpointId: string }`. The lane-linking plan adds its Vercel dependency here; this plan builds no Vercel call (WF12).
  - CLI: `pnpm wt:db create` (git branch from `git branch --show-current`; `knownBranchId` from `NEON_BRANCH_ID` in `./.env.local`; writes `DATABASE_DEV_URL=` (pooled) and `NEON_BRANCH_ID=` through `upsertEnvKeys`), `pnpm wt:db delete` (by `NEON_BRANCH_ID` from `.env.local`, falling back to the name; missing `NEON_API_KEY` or nothing to delete → prints why and exits 0, so an archive hook never blocks), `pnpm wt:db prune [--apply]` (lists orphans and copies idle 14+ days; `--apply` deletes orphans only, never an idle copy a live worktree names). Reads `NEON_PROD_ENDPOINT_ID` from env.

Create order: `knownBranchId` names a live Neon branch → reuse it (whatever its name), `migrate`. Else name → if `wt/<slug>` exists: `isScrubbed` (unpooled) → true: reuse, then `migrate` · false: delete it and continue as new. New: fork from the prod branch → wait → `connectionUri` (unpooled; refuses the prod branch before fetching) → `assertNotProdEndpoint` → `scrub` → `migrate` → return pooled URL. Any failure after the fork deletes the branch and rethrows.

- [ ] **Step 1: Write the failing test** with a fake `NeonClient` recording calls:

```ts
// scrub throws → deleteBranch called with the new id, createWorktreeDb rejects, migrate never called
// existing 'wt/feat-x' scrubbed → { reused: true }, createBranch not called, scrub not called, migrate called once
// existing 'wt/feat-x' NOT scrubbed → deleteBranch(old id), createBranch called, scrub called, { reused: false }
// knownBranchId of a live branch named 'wt/legacy' → { reused: true, branchId: that id }, createBranch not called
// knownBranchId Neon no longer has → falls through to the name path
// prune: orphan wt/a deleted with --apply; idle wt/b named by a live worktree listed, not deleted; preview/x and development untouched
// deleteWorktreeDb with an id Neon no longer has → resolves (404 path)
// deleteWorktreeDb with neither id nor matching name → resolves, deleteBranch not called
// connectionUri returning a prod-endpoint URL → rejects /production endpoint/, branch deleted
// prodEndpointId '' → rejects /not set/ before createBranch
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. **Scrub audit:** check every table holding tokens, webhook secrets, device subscriptions or send triggers. `voip_dids` is the visit-SMS gate: check its FK closure (`pg_constraint`, `confrelid`) before choosing `DELETE` vs `UPDATE`; never `TRUNCATE … CASCADE`. List each addition in the PR body with its reason. Rewrite the docblock at `refresh-dev-from-prod.ts:7-24` (line 19 still describes `wt/issue-N ← development`) and move its `./lib/load-env` import to the top.
- [ ] **Step 4:** Test → `✅ worktree-db verified`. `pnpm tsc` and `pnpm exec eslint` on the new files clean.
- [ ] **Step 5 (owner says "run"; after T9 Step 5):** In a scratch worktree, `pnpm wt:db create` → branch `wt/<slug>` appears; `.env.local` has `DATABASE_DEV_URL` whose host ≠ prod and `NEON_BRANCH_ID`; `select count(*) from session` → 0; `select count(*) from drizzle.__scrubbed` → 1. Run `pnpm wt:db create` again → "reused". `pnpm wt:db delete` → branch gone; rerun delete → exits 0.
- [ ] **Step 6:** Commit `feat(scripts): wt:db creates, scrubs, migrates and deletes per-worktree Neon branches`.

### Task 3a: Re-fork the four lane copies (WF11)

**Files:** each lane's `src/shared/db/migrations/` (one generated migration per lane with schema changes) and its `.env.local` (not committed).

Lanes: `feat/data-views` (`wt/data-views`), `feat/proposal-page` (`wt/proposal-page`), `feat/home-visit-messages` (`wt/home-visit-messages`), `feat/office-tv-mode` (`wt/office-tv-mode`). All four fork `development` and carry schema pushed by hand; while they exist, `db:refresh:dev` refuses (`refresh-dev-from-prod.ts:83-93`). Their Vercel Preview `DATABASE_DEV_URL` entries (set 2026-11-21) point at these copies.

- [ ] **Step 1:** In each lane, `git merge origin/main` (brings the baseline), then `pnpm db:generate --name <lane-slug>`: the generated file is the lane's schema on top of prod. Owner reads each migration's plain-English summary. Commit by path on the lane branch.
- [ ] **Step 2 (owner says "run", per lane):** `pnpm wt:db delete` in the lane (deletes the old copy by `NEON_BRANCH_ID`), then `pnpm wt:db create` → a new `wt/feat-<slug>` copy forked from prod, scrubbed, migrated with baseline + the lane migration. Verify `migrateDb` reported `applied: 1` (or 0 for a lane with no schema change) and the lane's own tables exist.
- [ ] **Step 3 (owner, console):** delete or repoint the lane's Preview `DATABASE_DEV_URL` in Vercel (the old copy is gone, so the preview would fail to connect). The lane-linking plan's `wt:db link` replaces this step for every later lane.
- [ ] **Step 4:** `pnpm wt:db prune` lists no orphans; `pnpm db:refresh:dev --dry-run` no longer reports children of `development`. Ask the owner before the real refresh (it resets their dev data), then T9 Step 5's dev half runs.

### Task 4: `db:refresh:dev` without prod's URL

**Files:**
- Modify: `scripts/refresh-dev-from-prod.ts`

**Interfaces:**
- Consumes: env `NEON_PROD_ENDPOINT_ID` (Task 1 Step 3), replacing `endpointIdFromUrl(DATABASE_URL)` as the `prodEndpointId` passed to `resolveTarget`.

- [ ] **Step 1:** Replace the `DATABASE_URL` read with `NEON_PROD_ENDPOINT_ID` (fail with a clear message if unset). Replace the `pnpm dispatch …` hints in the has-children error with `pnpm wt:db prune` / `pnpm wt:db delete`.
- [ ] **Step 2:** `pnpm db:refresh:dev --dry-run` with `DATABASE_URL` unset in the shell → prints target `development`, parent `production`, the scrub plan, touches nothing.
- [ ] **Step 3:** Commit `refactor(scripts): db:refresh:dev identifies prod by endpoint id, not its URL`.

### Task 5: Local runs need their own database; unset never means prod

**Files:**
- Create: `src/shared/config/local-dev-database.ts` — `localDevDatabaseMissing(env)`, pure, no imports (`data-target.ts:3` imports `server-env`, so the check cannot live there without a cycle)
- Modify: `src/shared/config/server-env.ts` — one gate in the existing `VERCEL_ENV` gate block (`:196-223`), reading `DRIZZLE_TARGET` from `process.env` (it is not in the Zod schema)
- Modify: `.github/workflows/pr-checks.yml` — Build step env gains `DATABASE_DEV_URL: ${{ secrets.DATABASE_URL }}` (CI has no `VERCEL_ENV`, and `.env.ci` has no `DATABASE_DEV_URL`, so without it the gate fails every PR; after T8 Step 3 that secret is the development branch)
- Modify: `scripts/backfill-lead-source-fk.ts:8`, `scripts/seed-lead-sources.ts:10-11`, `scripts/migrate-notes-to-activities.ts:26`, `scripts/dump-failed-sow.ts:8`, `scripts/match-before-after.ts:37` — drop each script's own `Pool`/`Client` on `DATABASE_URL` and use `db` from `@/shared/db` (it already follows `isProductionData()`), with `./lib/load-env` imported first
- Test: `scripts/verify-data-target.ts`

**Interfaces:**
- Produces: `localDevDatabaseMissing(env: { VERCEL_ENV?: string, DRIZZLE_TARGET?: string, DATABASE_DEV_URL?: string }): boolean` — true only when `VERCEL_ENV` is unset, `DRIZZLE_TARGET !== 'prod'`, and `DATABASE_DEV_URL` is empty. The server-env gate throws `DATABASE_DEV_URL is not set. Outside Vercel the app runs only on a lane or dev database (run: pnpm wt:db create).`
- The gate has teeth only after T8 Step 4 moves `DATABASE_DEV_URL` out of `.env`; until then every worktree's copied `.env` still carries shared dev.

- [ ] **Step 1: Failing test:** cases — local + no dev URL → true; local + dev URL → false; local + `DRIZZLE_TARGET=prod` → false; `VERCEL_ENV=preview` + no dev URL → false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; move the five scripts onto `@/shared/db`.
- [ ] **Step 4:** Test passes; `pnpm lint && pnpm tsc` clean; in a scratch shell with `DATABASE_DEV_URL=` and `DRIZZLE_TARGET` unset, `pnpm tsx scripts/send-push.ts --help` exits with the message. The PR's own PR Checks build is green.
- [ ] **Step 5:** Commit `feat(config): a local run without its own database refuses to boot`.

### Task 6: Copies never reach real people or live files

**Files:**
- Modify: `src/shared/services/providers/r2/client.ts` — `deleteObject` (`:103`) returns early with a warning unless `isProductionData()`; no wrapper function
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/assemble-envelope.ts:197-200` — homeowner recipient through `applyDevRecipientOverride` (`resend/lib/dev-recipients.ts:13`), reading `env.EMAIL_DEV_OVERRIDE` and `env.VERCEL_ENV` directly (never `getResendConfig()`: providers are leaves)
- Create: `src/shared/modules/meetings/core/lib/meeting-channel.ts` — pure, no imports. Not under `providers/upstash/`: realtime there is Ably, `realtime-client.ts` is `'use client'` and opens a socket on import, `realtime.ts` pulls server config, and a channel name is meeting policy. Used by `src/trpc/routers/meeting-flow.router.ts:34`, `src/features/meeting-flow/ui/components/realtime/meeting-realtime-sync.tsx:20`, `src/features/meeting-flow/hooks/use-meeting-sync.ts:23`
- Test: `scripts/verify-side-effect-guards.ts`

**Interfaces:**
- Produces:
  - `deleteObject` skip: logs `Skipped R2 delete of <bucket>/<key>: not the production data target`
  - Zoho homeowner signer: `applyDevRecipientOverride({ to: customerEmail }, { isProduction: env.VERCEL_ENV === 'production', override: env.EMAIL_DEV_OVERRIDE }).to`; unset override throws the existing Resend wording
  - `meetingChannel(meetingId: string, env: { isProduction: boolean }): string` — `meeting:<id>` in production, `dev:meeting:<id>` otherwise; the server passes `VERCEL_ENV === 'production'`, the client `process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'` (read nowhere today)

- [ ] **Step 1: Failing test:** `meetingChannel` both branches; the Zoho recipient both branches plus the unset-override throw.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement and wire the call sites.
- [ ] **Step 4:** Test passes; `pnpm lint && pnpm tsc` clean. On the PR's preview, the client bundle carries `NEXT_PUBLIC_VERCEL_ENV` (Playwright: subscribe on a preview meeting and see the `dev:` channel). If Vercel does not expose it, stop: server and client would name different channels and live sync dies without an error.
- [ ] **Step 5:** Commit `feat(providers): copies skip storage deletes, contract homeowners and live meeting channels`.

### Task 7: Prod-script Action and a real prod probe

**Files:**
- Create: `.github/workflows/prod-script.yml`
- Create: `scripts/prod-db-ping.ts`

**Interfaces:**
- Produces: `workflow_dispatch` with inputs `script` (path under `scripts/`, required) and `args` (string, optional). Job uses `environment: production`, checks out `main`, reuses the setup lines of `pr-checks.yml:12-23`, writes `${{ secrets.PROD_ENV_FILE }}` to `.env`, validates `script` matches `^scripts/[a-z0-9/_-]+\.ts$` and exists, passes `args` through `env:` (never interpolated into `run:`), runs `DRIZZLE_TARGET=prod NODE_OPTIONS="--conditions=react-server" pnpm tsx "$SCRIPT" $ARGS`.
- Produces: `scripts/prod-db-ping.ts` — read-only; starts from `describeTargetDb()` (`scripts/lib/describe-target-db.ts`) for the endpoint id, adds `current_user` and `select count(*) from drizzle.__drizzle_migrations` (or "no migrations table"). Runs before T9 (WF9), so its first output on prod is "no migrations table".

- [ ] **Step 1:** Write both.
- [ ] **Step 2 (owner, console):** Create GitHub environment `production`: required reviewer = owner, deployment branches = `main` only, secret `PROD_ENV_FILE` = Vercel Production's env (not the local `.env`: it carries `NGROK_URL` and a localhost base URL).
- [ ] **Step 3:** After merge, owner runs it with `scripts/verify-business-time.ts` (no DB) → approval → green. Then with `scripts/prod-db-ping.ts` → prints the prod endpoint id.
- [ ] **Step 4:** Commit `ci: owner-approved prod-script workflow and a read-only prod probe`.

### Task 8: Credentials leave the machine (owner-run, agent-guided)

**Files:**
- Create: `scripts/grant-photos-writer.ts` (run only through the prod-script Action)
- Owner's `.env` / `.env.local` (not committed)

**Interfaces:**
- Produces: `grant-photos-writer.ts` — idempotent SQL: `GRANT CONNECT`, `USAGE ON SCHEMA public`, and on exactly the tables the two photo workflows touch (read from `scripts/add-during-media.ts`, `scripts/portfolio-scraper/import-project.ts`, `projectMediaCrud`, `projectMediaStore`): `SELECT, INSERT, UPDATE` on `projects`, `x_project_scopes`, `project_media_files`, `SELECT` on the lookups they read, `USAGE` on their sequences. No `DELETE`, no other table, no DDL. `--dry-run` prints the statements.

- [ ] **Step 1: Rehearse on a copy (owner says "run").** In a scratch worktree, create role `photos_writer` on its copy (Neon console), run the grant script against the copy, then run each photo workflow's dry path as `photos_writer` against the copy → works; `select count(*) from customers` as `photos_writer` → permission denied. Also on the copy: create role `app_prod`, `GRANT neondb_owner TO app_prod`, connect as `app_prod`, run `migrateDb` with a no-op and one insert/delete on a scratch table → works. If Neon refuses the `GRANT neondb_owner` (the console role may lack admin on it), stop and tell the owner; the fallback is a planned quiet-hour window: reset, update Vercel, redeploy (a few minutes of prod DB errors).
- [ ] **Step 2 (owner, console + Action):** On production create roles `photos_writer` and `app_prod`; run the prod-script Action with `scripts/grant-photos-writer.ts` and with a one-line `GRANT neondb_owner TO app_prod` script (same file, `--app-prod` flag).
- [ ] **Step 3 (owner, console): switch the app, then rotate.** Set Vercel Production `DATABASE_URL` (type **Sensitive**, so no token can read it back; check its `type` afterwards) and `PROD_ENV_FILE` to the `app_prod` URL, set the GitHub secret `DATABASE_URL` (used by `pr-checks.yml:39`) to the development branch's URL, redeploy production, verify the site loads and `prod-db-ping` shows `current_user = app_prod`. Only then reset `neondb_owner`'s password on production (kills every old URL in `.worktrees/*/.env`, shell history and this session's transcript). Also rotate `NEON_API_KEY` (spec Residual risks).
- [ ] **Step 4 (owner): local env reshuffle.** In `.env`: `DATABASE_URL` = the `photos_writer` prod URL; move `EMAIL_DEV_OVERRIDE`, `VOIP_DEV_OVERRIDE_NUMBER`, `DEV_LOGIN_SECRET`, `VERCEL_AUTOMATION_BYPASS_SECRET` (the preview Playwright check needs it in every lane), `VOIP_WEBHOOK_BASE_URL`, `X_BEARER_TOKEN` from `.env.local` into `.env`; move `DATABASE_DEV_URL` (development branch) out of `.env` into the main checkout's `.env.local`; new `NEON_API_KEY`. `VERCEL_TOKEN` stays out until WF12 is decided.
- [ ] **Step 4a (owner says "run"): re-sync the lanes.** Every existing worktree holds a stale copy of `.env` (old prod URL, old shared-dev password). Copy the new `.env` into each `.worktrees/*/`; a lane on shared dev gets `DATABASE_DEV_URL` (development) in its own `.env.local`.
- [ ] **Step 5:** Verify: no prod `neondb_owner` or `app_prod` URL in `.env`, `.env.local`, `.worktrees/*/.env*` (grep the prod endpoint id, then check each hit's user is `photos_writer`); Oliver's `pnpm dev` in main works against dev; `DRIZZLE_TARGET=prod pnpm tsx scripts/prod-db-ping.ts` → `current_user = photos_writer`; `pnpm db:refresh:dev --dry-run` works.
- [ ] **Step 6:** Commit `feat(scripts): photos_writer grants for the local photo workflows`.

### Task 9: Migrations baseline (before `wt:db`, WF9)

Runs after T1 (production protected, so a copy gets its own password) and T7 (the prod-script Action). Prod has no `drizzle.__drizzle_migrations` today, so nothing may call drizzle's `migrate()` on a prod copy until this task's baseline row exists there.

**Files:**
- Delete: `src/shared/db/migrations/0000_*`, `0001_*`, `0002_*`, `meta/*` (FIRST, before generating; otherwise drizzle writes a `0003` diff)
- Create: `src/shared/db/migrations/0000_baseline.sql` + `meta/` (generated)
- Create: `scripts/lib/migrate-db.ts` (moved here from Task 3)
- Create: `scripts/record-migration-baseline.ts`
- Modify: `package.json` — keep `"db:generate": "drizzle-kit generate"`; add `"db:migrate:dev": "tsx scripts/migrate-dev.ts"` (calls `migrateDb(unpooledUrl(DATABASE_DEV_URL))`); remove `db:push:dev`
- Create: `scripts/migrate-dev.ts`
- Modify: `scripts/refresh-dev-from-prod.ts` — closing hint `pnpm db:push:dev` → `pnpm db:migrate:dev`
- Test: `scripts/verify-migrate-db.ts`

**Interfaces:**
- Consumes: the prod-script Action (Task 7).
- Produces: `migrateDb(connectionString: string): Promise<{ applied: number }>` in `scripts/lib/migrate-db.ts` — one `pg` client on the given (unpooled) URL; `select pg_advisory_lock(<fixed key>)`; refuses `No migration baseline recorded on <endpoint id>: run scripts/record-migration-baseline.ts first` when `drizzle.__drizzle_migrations` is missing or empty, before any SQL file runs; then drizzle-orm's `migrate()` from `drizzle-orm/node-postgres/migrator` with `migrationsFolder: './src/shared/db/migrations'`; `applied` = row count after minus before; unlock in `finally`.
- Produces: `record-migration-baseline.ts` — ensures schema `drizzle` and `drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)` exist, then inserts the baseline row (`hash` and `folderMillis` from drizzle's own `readMigrationFiles`, `drizzle-orm/migrator.js`, never a hand-rolled sha256) only if no row with that hash exists. Idempotent; `--dry-run` prints the row.

- [ ] **Step 1:** Delete the old files, then `pnpm db:generate --name baseline`. Expect exactly `0000_baseline.sql`, `meta/0000_snapshot.json`, `meta/_journal.json`. Write `migrate-db.ts` and its test (`verify-migrate-db.ts`: the refusal is a pure check on the row count, tested without a database).
- [ ] **Step 2: Prove it (owner says "run").** The owner makes a throwaway child of production in the Neon console (the "copy"); its URL goes only into a scratch shell variable, never into an app's env, and the copy is deleted at the end of this task.
  - (a) `pnpm drizzle-kit push --strict --verbose` against it (in a scratch worktree whose `.env.local` sets `DATABASE_DEV_URL` to the copy, `DRIZZLE_TARGET=dev`; never the main checkout's `.env.local`) → "No changes detected"; answer **No** to any prompt. Any planned statement is drift.
  - (b) Create a child of the copy, `drop schema public cascade; create schema public;` on the child only, `record-migration-baseline.ts` is NOT run there; instead apply `0000_baseline.sql` with drizzle's `migrate()` directly (the one place the no-baseline refusal is bypassed, on purpose, on an empty schema), then Neon Schema Diff (MCP `compare_database_schema`) child vs copy → no differences beyond column order and the `drizzle` schema; list any column-order-only lines in the PR body. Delete the child.
  - If prod has drift, prod wins: edit the Drizzle schema files, regenerate the baseline, repeat; list every drift item in the PR body.
- [ ] **Step 3:** On the copy: `migrateDb(<copy url>)` → refuses (no baseline); `record-migration-baseline.ts` → one row; `migrateDb(<copy url>)` → `{ applied: 0 }`. Owner deletes the copy.
- [ ] **Step 4:** Commit `feat(db): adopt drizzle migrations with a baseline proven equal to prod`. Open the PR; the owner squash-merges.
- [ ] **Step 5 (owner-approved):** Run the prod-script Action with `scripts/record-migration-baseline.ts`, then `scripts/prod-db-ping.ts` → count 1. Every fork from here inherits the row. Dev gets it through `pnpm db:refresh:dev` after Task 3a frees `development` of children (ask the owner first: it resets their dev data).

### Task 10: Migrations on production deploy + CI checks

**Files:**
- Create: `scripts/vercel-build.ts`
- Create: `scripts/verify-migration-order.ts` (run in CI, not a unit test)
- Modify: `package.json` — `"vercel-build": "tsx scripts/vercel-build.ts"`; remove `db:push:prod`, `db:reset:prod`, `db:seed:prod`, `backfill:phones`, `backfill:proposal-media`, `rebuild:gcal`, `gcal:cron:setup` (their scripts run through the prod-script Action by path)
- Modify: `.github/workflows/pr-checks.yml`
- Test: `scripts/verify-vercel-build.ts`

**Interfaces:**
- Produces: `buildPlan(env: { VERCEL_ENV?: string }): { migrate: 'prod' | 'none' }` — production → `prod`; anything else → `none` (previews arrive with the lane-linking plan, WF13). Then `migrateDb(<unpooled prod URL>)` for `prod`, then `next build`. Any failure exits non-zero, which cancels the deploy.
- Produces: `verify-migration-order.ts` — reads `src/shared/db/migrations/meta/_journal.json` and `git show origin/main:src/shared/db/migrations/meta/_journal.json`; fails when `idx` is not `0..n-1` in order, when `when` does not strictly increase, or when any entry the branch adds has `when` ≤ the newest on `main`. Message: `Migration <tag> is older than main's newest. Regenerate it (pnpm db:generate) instead of merging the journal by hand.`

- [ ] **Step 1: Failing tests:** `buildPlan` (production → prod; preview → none; unset → none) and `verify-migration-order` fixtures (in order → pass; hand-merged older entry → fail; duplicate idx → fail).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Confirm the Vercel project has no Build Command override that would bypass `vercel-build`.
- [ ] **Step 4: CI.** In `pr-checks.yml` (keep Node 20): add `pnpm tsc`; add `pnpm drizzle-kit check`; add `pnpm tsx scripts/verify-migration-order.ts` (needs `fetch-depth: 0` or a fetch of `origin/main`); add `pnpm drizzle-kit generate --name ci-check` with `timeout-minutes: 3` followed by `test -z "$(git status --porcelain src/shared/db/migrations)"` (a rename prompt hangs and times out, which correctly fails the PR). The build keeps the `DATABASE_URL` secret, now the development branch (Task 8 Step 3).
- [ ] **Step 5:** Tests pass; `pnpm lint && pnpm tsc`. Commit `feat(deploy): production migrations under a lock in vercel-build; CI checks tsc and migrations`.
- [ ] **Step 6:** After merge, the production deploy log shows `applied: 0` and the site works.

### Task 11: Moved to the lane-linking plan (WF13)

Previews on their lane copy (WF7, WF8) are built by the lane-linking plan. `buildPlan` keeps `preview → none` until then. Handed over as requirements, under "Handed to the lane-linking plan" at the end of this plan.

### Task 12: Google sign-in through the proxy (Steps 1–3 shipped in #293, #294)

Built differently from the original text: no `APP_HOSTS.preview` vercel.app pattern; previews are trusted through `VERCEL_URL`/`VERCEL_BRANCH_URL`, `APP_HOSTS.dev` is `['localhost:*', '*.localhost:*']` (`roots.ts:8-13`), `oAuthProxy` is at `server.ts:123`, the `OAUTH_PROXY_SECRET` gate at `server-env.ts:221`, and ngrok skips the relay by header (#294).

- [x] **Steps 1–3:** shipped (#293, #294).
- [ ] **Step 4:** Verify in a real browser (local Playwright script per memory, or the owner on the iPad): sign in on a protected preview → signed in on the preview; on `localhost:3007` and `kitchens.localhost:3007` → signed in; through the ngrok tunnel on the iPad → signed in; prod `session` table gained no rows from these sign-ins (`prod-db-ping`-style count through the prod-script Action).
- [ ] **Step 5 (owner, console):** Remove all `localhost` redirect URIs from the Google OAuth client. Re-verify one local port.
- [ ] **Step 6:** Commit `feat(auth): google sign-in on any local port and preview via oAuthProxy`.

### Task 13: Moved to the lane-linking plan (WF13)

Done here: the port claim in `orca.yaml` (setup = install + port). The rest (archive hook, `.worktreeinclude` dropping `.env.local`) is handed over below.

### Task 14: Agent git duties (gate and lane rules shipped in #295, #296)

Done here: the per-checkout pre-commit gate (`.claude/hooks/pre-commit-gate.sh`), `/pre-ship` retired, lane rules in CLAUDE.md. The ship skill is handed over below. No repo setting change (WF3).

### Task 15: Retire the old system

**Files:**
- Delete: `scripts/dispatch.sh`, `docs/workflow.md` (stale: wildcard redirect URI, "PRs can't merge without green checks"). (`.worktrees/prod` is already gone.)
- Rewrite (WF4): `scripts/hotfix.sh` — `start <slug>` makes a `fix/<slug>` worktree from `origin/main` with deps and env files; `pr` runs `pnpm lint && pnpm tsc`, pushes and opens the PR. The workbench commands (`sync`, `backup`, `ship`, `.worktrees/prod`) go.
- Modify: `package.json` — remove `dispatch`
- Modify: `CLAUDE.md` — one edit for this plan's commands: `wt:db`, `db:generate`, `db:migrate:dev`, no `db:push:*`; line 25's "only via DRIZZLE_TARGET=prod" now true and naming `photos_writer`; the prod-script Action. Lane workflow lines belong to the lane-linking plan.
- Modify: `docs/codebase-conventions/environment.md` (line 19's gate list lacks `OAUTH_PROXY_SECRET`, `EMAIL_DEV_OVERRIDE` and Task 5's check; line 20's "scripts follow the same rule"; line 21's prod-prefixed package scripts; line 32 names a `client-env.ts` that does not exist), `drizzle.config.ts:7-14` comment (dispatch worktrees), the dispatch comments at `scripts/lib/load-env.ts:8` and `src/shared/config/server-env.ts:18`
- Modify: pending docs that gate on deleted commands — `docs/superpowers/plans/2026-10-21-proposal-energy-impact-foundation.md:36,48,713,767,925`, `docs/plans/2026-10-21-proposal-energy-impact-epic.md:44,162`, `docs/superpowers/specs/2026-09-24-proposal-applications-design.md:217`, `docs/superpowers/specs/2026-10-20-r2-storage-design.md:48-49` (Q-A database side superseded) → "migration in the PR" / prod-script Action
- Memory: rewrite `feedback-work-on-main`, `reference-dispatch-system`, `reference-git-workflow-playbook`, `reference-orca-ade`, `reference-neon-branching`, `reference-db-refresh`, `feedback-runtime-db-env` (drop `seed:bina-contacts`), `feedback-db-push-dev-only`, `feedback-db-push-wt`; add the prod-script Action as the only full prod path

- [ ] **Step 1:** `git grep -nE "pnpm dispatch|dispatch\.sh|db:(push|reset|seed):prod|db:push:dev|DRIZZLE_TARGET=prod" -- '*.md' '*.ts' '*.json' '*.sh' '*.yml'` (tracked files only: a recursive grep walks the 14 checkouts under `.worktrees/`) → fix or delete every hit except the expected keepers: `DRIZZLE_TARGET=prod` in `.github/workflows/prod-script.yml`, `CLAUDE.md`, `drizzle.config.ts`, `src/shared/config/data-target.ts`, and every `hotfix` mention (WF4 keeps it). The meeting "dispatcher" and `workflow_dispatch` are unrelated and not in this pattern.
- [ ] **Step 2:** `pnpm lint && pnpm tsc`. **Step 3:** Commit.

### Task 16: Branch protection on

- [ ] **Step 1 (owner-confirmed):** Ruleset on `main`: require PR, require the `check` job (PR Checks) to pass, block force-push and deletion, apply to admins. Merge buttons stay as they are (WF3: squash is a convention). PR Checks runs only on PRs into `main` (`pr-checks.yml:5`), so stacked slice PRs are checked when they reach `main`; widen the trigger only if the owner asks.
- [ ] **Step 2:** Verify with `gh api repos/OlisDevSpot/tri-pros-website/rulesets` (rules present, enforcement active, no bypass actors) and a PR that merges after checks pass. No test push to `main`.
- [ ] **Step 3:** Owner notes the break-glass: Settings → Rules → disable, push, re-enable.

---

## Handed to the lane-linking plan (WF13)

Requirements found by the 2026-11-22 stress test; the new plan must carry each one.

1. **Lane creation (WF10):** `/new-lane` skill + `pnpm lane`. Asks "own database or shared dev?"; makes the worktree (orca CLI); pushes the branch first (Vercel refuses a branch variable for a branch GitHub does not have); runs `wt:db create` + `wt:db link` when chosen; links or opens the GitHub issue; adds the board row. `pnpm wt:db create` in an existing lane also links.
2. **`wt:db link`:** `scripts/lib/vercel-api.ts` on the `createNeonClient` pattern (`request<T>`, errors), injected into `WorktreeDbDeps`. Port from `~/claude-archive/2026-11-21-lane-preview-db/set-lane-preview-db.mjs`: project-name check, refusal when `DRIZZLE_TARGET` is set on Preview, refusal of an unscoped Preview/Production `DATABASE_DEV_URL`, protocol/password/`sslmode` checks, redaction of token, URL and both password forms, the 2xx-with-`failed` check, the re-read check (one entry, Sensitive, target `["preview"]`, nothing on Production). Replace its hardcoded endpoint lists with "the URL's endpoint is this copy's endpoint"; project and team ids from env; follow env-list pagination. **Update** the entry when the copy changes (Sensitive values cannot be read back, so a skip leaves a dead URL). Redeploy the preview after a change. `delete` and `prune --apply` remove the entry. Test with a fake Vercel client. Blocked on WF12 (token home).
3. **Preview build (old T11):** `buildPlan` migrates a preview only when `DATABASE_DEV_URL` is set and its endpoint is neither prod nor shared dev; otherwise it skips the migration and says why (a lane's first build, a hotfix branch from the main checkout and a shared-dev lane all resolve to shared dev, and must never apply an unmerged migration there). Migrate through `unpooledUrl`. No scrub in the build: a lane copy is scrubbed at `wt:db create`.
4. **Orca (old T13):** `scripts.archive: pnpm wt:db delete` (removes the Vercel entry too; exits 0 when there is nothing to do); `.worktreeinclude` drops `.env.local` only after T8 Step 4 has moved every shared secret (incl. `VERCEL_AUTOMATION_BYPASS_SECRET`) into `.env`. Steps that need a running app name Oliver as the actor.
5. **Ship skill (old T14 skill), named for lanes (`ship-lane`):** merge `origin/main` in, never rebase; on a `_journal.json` conflict regenerate this branch's migration, then `wt:db delete && wt:db create` (which re-links); `db:migrate:dev`; lint, tsc, `ponytail-review`, `merge-risk` overlap report; push; PR with the migration's plain-English summary. After a squash-merge the branch and worktree stay (WF6): `git merge origin/main` into the branch before the next commit. No repo setting change (WF3).
6. **Vocabulary:** Lane, Lane copy and Review slot go into `GLOSSARY.md` Planning terms once the owner agrees them (`GLOSSARY.md:155` lists "lane" under _Avoid_ for pipeline Stage only).
