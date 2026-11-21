# Worktree → PR Flow Implementation Plan

> **Status**
> - Stage: plan · stress-tested 2026-11-02 · owner said execute in order 2026-11-06
> - Built on: `main` (plan and spec untracked) · Verified at: `main@dc1a2d7a3` (2026-11-06) · page: https://claude.ai/artifact/1zmUgoWD6NQKsmJvJJR138
> - Done: none (T0–T16 unstarted; CLAUDE.md already carries the squash-merge flow and PR #287 shipped by branch + PR on 11-04)
> - Next: T0 drain in one /pre-ship session this week, owner present → T1 lock the doors → T2–T3 wt:db → T4–T8 → T9 baseline (after T0: main's schema is 9 files ahead of origin/main) → T10–T16
> - Open: Neon console state unread 2026-11-06 (connector reconnect) · roadmap q367 still open though answered 11-01 · trade-scenes R282/T23 wait on T2–T3 and T9–T10
> - Blocked: T1–T16 on T0 (phases ship as PRs off origin/main once main is drained)

## Rulings

| # | Ruling | Date |
|---|---|---|
| WF1 | Execute the plan in order, Task 0 first. The orient page (above) is the living tracker for this plan: what is built, files affected, key code facts, infra and patterns, so the owner has visibility into the new structure as it lands. | owner, 2026-11-06 |
| WF2 | Task 0 runs as one `/pre-ship` session this week with the owner present: sort the 189 commits and the dirty tree into ship / move to a branch / drop, then one push to `origin/main`. | owner, 2026-11-06 |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One idea = one Orca worktree (own port, own scrubbed Neon branch) = one PR with a signed-in Vercel preview; `main` mirrors prod; no full prod credentials on any local machine, and no copy can reach real people or live files.

**Architecture:** Neon branch lifecycle moves from `scripts/dispatch.sh` into a small TypeScript CLI (`pnpm wt:db`) that Orca's `setup`/`archive` hooks call. Production is a protected Neon branch, so every copy gets its own password. Schema changes become Drizzle migrations applied by a `vercel-build` script under an advisory lock (prod on production deploys; the preview's own copy on previews, once the Neon–Vercel integration is on). Prod is reached in full only by Vercel production and an owner-approved `workflow_dispatch` Action; locally `DRIZZLE_TARGET=prod` reaches prod only as the `photos_writer` login. Sign-in on any host goes through better-auth's `oAuthProxy` via the one registered prod callback.

**Tech Stack:** Next.js 15 on Vercel, Neon API v2 (Launch plan), drizzle-kit 0.31.8 / drizzle-orm 0.45.1, better-auth 1.6.9, GitHub Actions, Orca (`orca.yaml`), tsx scripts with `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-01-worktree-pr-flow-design.md` (amended 2026-11-02 after `/stress-test-plan`)

## Global Constraints

- Package manager `pnpm`; path alias `@/` → `src/`. Never `pnpm build` locally. Verify with `pnpm lint && pnpm tsc`, plus `pnpm exec eslint <each new or edited file under scripts/ or at the repo root>`: `pnpm lint` is `next lint`, which never lints `scripts/` or `drizzle.config.ts`.
- Tests follow the repo idiom: `scripts/verify-*.ts` using `node:assert/strict`, run with `pnpm tsx scripts/verify-<name>.ts`, printing one `✅ …` line on success.
- Scripts import `./lib/load-env` FIRST, inside the reasoned `perfectionist/sort-imports` disable block (memory `feedback-scripts-load-env.md`).
- Comments say why, never what. No new `DOCS.md` files.
- Stage and commit by explicit path only (`git add -- <paths>`; `git commit -- <paths>`); never `git add -A`, `stash`, `reset --hard`, `checkout .`, `--amend`. `drizzle.config.ts` is CRLF: edit it with the Edit tool and check `git diff --shortstat` stays small. The Claude pre-commit hook takes ~110 s of a 120 s budget: batch commits.
- Every outward action (GitHub settings, repo visibility, Vercel settings, Google Cloud, Neon console, running the prod-script Action) is confirmed with the owner first, each time. Every step that creates, resets or deletes a Neon branch, or runs SQL against any database, runs only after the owner says "run" for that step ("go ahead" on the plan is not that). Resetting the owner's dev data (`db:refresh:dev`) needs its own explicit OK: their hand-edited dev fixtures go with it.
- Each phase ships as its own branch + PR off `origin/main` once Task 0 is done. Until Task 13 wires Orca, create worktrees with `git worktree add .worktrees/<slug> -b <type>/<slug> origin/main`.
- Full prod writes only from: Vercel production deploys (migrations) and the prod-script Action. Locally `DRIZZLE_TARGET=prod` reaches prod only as `photos_writer`. Unset never means prod.
- Neon branch names: worktrees `wt/<slug>`, previews `preview/<git-branch>` (integration's naming). Migrations and scrubs use the unpooled URL.
- Scrub is fail-closed: a branch whose scrub fails is deleted and the command exits non-zero.
- Migrations run through `migrateDb(url)` (Task 3), never `drizzle-kit migrate`: `drizzle.config.ts` loads `.env.local` with `override: true`, which beats any URL passed in.

## Review Focus

1. **Scrub fails partway** (bad statement, dropped connection) → branch deleted, `wt:db create` exits 1, no `DATABASE_DEV_URL` written, and the app in that worktree refuses to boot. Test in Tasks 3 and 5.
2. **Setup re-run on a half-made copy** (setup killed after the fork, before the scrub) → the copy has no scrub marker, so it is deleted and forked again; a clean copy is reused and still migrated. Test in Task 3.
3. **A preview build that cannot tell prod apart** (`NEON_PROD_ENDPOINT_ID` unset, or the preview's address is prod) → the build refuses before any SQL. Test in Task 11.
4. **Two PRs' migrations merged out of order** (an added journal entry older than `main`'s newest) → CI fails with a plain message; nothing reaches prod. Test in Task 10.
5. **Odd git branch names** (`feat/Filters_Grouping`, `feat/a_b` vs `feat/a-b`, 80+ chars, detached HEAD) → distinct, valid Neon names; an empty name is refused. Test in Task 2.

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
- Modify: `scripts/lib/neon-api.ts` (add methods to `NeonClient`; rewrite the "(dispatch uses the same two)" comment at line 24)
- Modify: `scripts/lib/neon-refresh.ts` (add `updated_at: string` to `NeonBranch`)
- Create: `scripts/lib/neon-worktree.ts`
- Test: `scripts/verify-neon-worktree.ts`

**Interfaces:**
- Produces (`neon-api.ts`, on `NeonClient`; reuse `waitForOperations`):
  - `createBranch(name: string, parentId: string): Promise<{ branch: NeonBranch, operations: NeonOperation[] }>` — `POST /branches` with `{ branch: { name, parent_id }, endpoints: [{ type: 'read_write' }] }`
  - `deleteBranch(branchId: string): Promise<NeonOperation[]>` — treats 404 as `[]`
  - `connectionUri(branchId: string, opts: { pooled: boolean }): Promise<string>` — `GET /connection_uri?branch_id=…&database_name=neondb&role_name=neondb_owner&pooled=…`
- Produces (`neon-worktree.ts`, pure):
  - `neonBranchName(gitBranch: string): string` — throws on an empty or whitespace name; lowercases, maps runs of non-`[a-z0-9]` to `-`, trims dashes; appends `-<6-char hash of the raw name>` whenever normalising changed the name or it was truncated, so distinct git names never share a copy
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
// prunePlan: wt/a live (id in liveBranchIds), wt/b orphan, preview/x ignored, wt/a idle when updated 20 days ago with idleDays 14
```

- [ ] **Step 2:** `pnpm tsx scripts/verify-neon-worktree.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement the three `NeonClient` methods and the pure module.
- [ ] **Step 4:** Test → `✅ neon-worktree verified`. `pnpm tsc` and `pnpm exec eslint scripts/lib/neon-api.ts scripts/lib/neon-worktree.ts scripts/verify-neon-worktree.ts` clean.
- [ ] **Step 5:** Commit `feat(scripts): neon branch client and worktree naming`.

### Task 3: `pnpm wt:db` — create, delete, prune (fail-closed) and `migrateDb`

**Files:**
- Create: `scripts/lib/scrub.ts` (move `scrub()` out of `refresh-dev-from-prod.ts`)
- Create: `scripts/lib/migrate-db.ts`
- Create: `scripts/lib/worktree-db.ts` (orchestration with injected deps)
- Create: `scripts/worktree-db.ts` (CLI)
- Modify: `scripts/lib/neon-refresh.ts` — audit `SCRUB_STATEMENTS`
- Modify: `scripts/refresh-dev-from-prod.ts` — import `scrub` from `scripts/lib/scrub.ts`
- Modify: `package.json` — `"wt:db": "tsx scripts/worktree-db.ts"`
- Test: `scripts/verify-worktree-db.ts`

**Interfaces:**
- Consumes: Task 2 `NeonClient` methods, `neonBranchName`, `prodBranchId`, `assertNotProdEndpoint`, `prunePlan`.
- Produces:
  - `scrub(connectionString: string): Promise<void>` in `scripts/lib/scrub.ts` — runs `SCRUB_STATEMENTS` and, in the same transaction, creates `drizzle.__scrubbed (at timestamptz)` with one row. Prod never has this table.
  - `isScrubbed(connectionString: string): Promise<boolean>` — true when `drizzle.__scrubbed` exists
  - `migrateDb(connectionString: string): Promise<{ applied: number }>` in `scripts/lib/migrate-db.ts` — one `pg` client on the given URL; `select pg_advisory_lock(<fixed key>)`; drizzle-orm's `migrate()` from `drizzle-orm/node-postgres/migrator` with `migrationsFolder: './src/shared/db/migrations'`; `applied` = row count of `drizzle.__drizzle_migrations` after minus before; unlock in `finally`. No migrations folder content → `{ applied: 0 }`.
  - `createWorktreeDb(deps: WorktreeDbDeps, gitBranch: string): Promise<{ branchId: string, url: string, reused: boolean }>`
  - `deleteWorktreeDb(deps: WorktreeDbDeps, target: { branchId?: string, gitBranch?: string }): Promise<void>`
  - `WorktreeDbDeps = { neon: NeonClient, scrub: (url: string) => Promise<void>, isScrubbed: (url: string) => Promise<boolean>, migrate: (url: string) => Promise<unknown>, prodEndpointId: string }`
  - CLI: `pnpm wt:db create` (git branch from `git branch --show-current`; writes/replaces `DATABASE_DEV_URL=` (pooled) and `NEON_BRANCH_ID=` in `./.env.local`), `pnpm wt:db delete [--preview]` (by `NEON_BRANCH_ID` from `.env.local`, falling back to the name; `--preview` deletes `preview/<git-branch>` instead; missing `NEON_API_KEY` or nothing to delete → prints why and exits 0, so Orca's archive never blocks), `pnpm wt:db prune [--apply]`. Reads `NEON_PROD_ENDPOINT_ID` from env.

Create order: name → if `wt/<slug>` exists: `isScrubbed` (unpooled) → true: reuse, then `migrate` · false: delete it and continue as new. New: fork from the prod branch → wait → `connectionUri` (unpooled) → `assertNotProdEndpoint` → `scrub` → `migrate` → return pooled URL. Any failure after the fork deletes the branch and rethrows.

- [ ] **Step 1: Write the failing test** with a fake `NeonClient` recording calls:

```ts
// scrub throws → deleteBranch called with the new id, createWorktreeDb rejects, migrate never called
// existing 'wt/feat-x' scrubbed → { reused: true }, createBranch not called, scrub not called, migrate called once
// existing 'wt/feat-x' NOT scrubbed → deleteBranch(old id), createBranch called, scrub called, { reused: false }
// deleteWorktreeDb with an id Neon no longer has → resolves (404 path)
// deleteWorktreeDb with neither id nor matching name → resolves, deleteBranch not called
// connectionUri returning a prod-endpoint URL → rejects /production endpoint/, branch deleted
// prodEndpointId '' → rejects /not set/ before createBranch
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. **Scrub audit:** check every table holding tokens, webhook secrets, device subscriptions or send triggers. `voip_dids` is the visit-SMS gate: check its FK closure (`pg_constraint`, `confrelid`) before choosing `DELETE` vs `UPDATE`; never `TRUNCATE … CASCADE`. List each addition in the PR body with its reason. Rewrite the docblock at `refresh-dev-from-prod.ts:17-23` (it still describes `wt/issue-N ← development`).
- [ ] **Step 4:** Test → `✅ worktree-db verified`. `pnpm tsc` and `pnpm exec eslint` on the new files clean.
- [ ] **Step 5 (owner says "run"):** In a scratch worktree, `pnpm wt:db create` → branch `wt/<slug>` appears; `.env.local` has `DATABASE_DEV_URL` whose host ≠ prod and `NEON_BRANCH_ID`; `select count(*) from session` → 0; `select count(*) from drizzle.__scrubbed` → 1. Run `pnpm wt:db create` again → "reused". `pnpm wt:db delete` → branch gone; rerun delete → exits 0.
- [ ] **Step 6:** Commit `feat(scripts): wt:db creates, scrubs, migrates and deletes per-worktree Neon branches`.

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
- Modify: `src/shared/config/data-target.ts` — add `localDevDatabaseMissing(env)`
- Modify: `src/shared/config/server-env.ts` — one gate in the existing `VERCEL_ENV` gate block
- Modify: `scripts/backfill-lead-source-fk.ts:8`, `scripts/seed-lead-sources.ts:11`, `scripts/migrate-notes-to-activities.ts:26` — unset target → `DATABASE_DEV_URL`, never `DATABASE_URL`
- Test: `scripts/verify-data-target.ts`

**Interfaces:**
- Produces: `localDevDatabaseMissing(env: { VERCEL_ENV?: string, DRIZZLE_TARGET?: string, DATABASE_DEV_URL?: string }): boolean` — true only when `VERCEL_ENV` is unset, `DRIZZLE_TARGET !== 'prod'`, and `DATABASE_DEV_URL` is empty. The server-env gate throws `DATABASE_DEV_URL is not set. Outside Vercel the app runs only on a worktree or dev database (run: pnpm wt:db create).`

- [ ] **Step 1: Failing test:** cases — local + no dev URL → true; local + dev URL → false; local + `DRIZZLE_TARGET=prod` → false; `VERCEL_ENV=preview` + no dev URL → false.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; fix the three scripts' defaults.
- [ ] **Step 4:** Test passes; `pnpm lint && pnpm tsc` clean; in a scratch shell with `DATABASE_DEV_URL=` and `DRIZZLE_TARGET` unset, `pnpm tsx scripts/send-push.ts --help` exits with the message.
- [ ] **Step 5:** Commit `feat(config): a local run without its own database refuses to boot`.

### Task 6: Copies never reach real people or live files

**Files:**
- Modify: `src/shared/services/providers/r2/client.ts` — `deleteObject` gate
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/assemble-envelope.ts:198-201` — homeowner recipient
- Create: the meeting channel helper next to the realtime provider (`src/shared/services/providers/upstash/`), used by `src/trpc/routers/meeting-flow.router.ts:34`, `src/features/meeting-flow/ui/components/realtime/meeting-realtime-sync.tsx:20`, `src/features/meeting-flow/hooks/use-meeting-sync.ts:23`
- Test: `scripts/verify-side-effect-guards.ts`

**Interfaces:**
- Produces:
  - `shouldDeleteStoredObject(env: { isProductionData: boolean }): boolean` — `deleteObject` logs `Skipped R2 delete of <bucket>/<key>: not the production data target` and returns when false
  - `homeownerSignerEmail(customerEmail: string, env: { isProduction: boolean, override: string | undefined }): string` — production → `customerEmail`; otherwise the override, or throws `EMAIL_DEV_OVERRIDE is not set. Outside production a contract goes to that address, so nothing was sent.` (same rule and wording style as `resend/lib/dev-recipients.ts`)
  - `meetingChannel(meetingId: string, env: { isProduction: boolean }): string` — `meeting:<id>` in production, `dev:meeting:<id>` otherwise; the client side reads production from `NEXT_PUBLIC_VERCEL_ENV`

- [ ] **Step 1: Failing test:** the three functions, both branches each, plus the unset-override throw.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement and wire the call sites.
- [ ] **Step 4:** Test passes; `pnpm lint && pnpm tsc` clean. Confirm with the owner that Vercel exposes `NEXT_PUBLIC_VERCEL_ENV` (System Environment Variables) on Production.
- [ ] **Step 5:** Commit `feat(providers): copies skip storage deletes, contract homeowners and live meeting channels`.

### Task 7: Prod-script Action and a real prod probe

**Files:**
- Create: `.github/workflows/prod-script.yml`
- Create: `scripts/prod-db-ping.ts`

**Interfaces:**
- Produces: `workflow_dispatch` with inputs `script` (path under `scripts/`, required) and `args` (string, optional). Job uses `environment: production`, checks out `main`, reuses the setup lines of `pr-checks.yml:12-23`, writes `${{ secrets.PROD_ENV_FILE }}` to `.env`, validates `script` matches `^scripts/[a-z0-9/_-]+\.ts$` and exists, passes `args` through `env:` (never interpolated into `run:`), runs `DRIZZLE_TARGET=prod NODE_OPTIONS="--conditions=react-server" pnpm tsx "$SCRIPT" $ARGS`.
- Produces: `scripts/prod-db-ping.ts` — read-only; prints the target's endpoint id (via `endpointIdFromUrl`), `current_user`, and `select count(*) from drizzle.__drizzle_migrations` (or "no migrations table").

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
- [ ] **Step 3 (owner, console): switch the app, then rotate.** Set Vercel Production `DATABASE_URL` and `PROD_ENV_FILE` to the `app_prod` URL, set the GitHub secret `DATABASE_URL` (used by `pr-checks.yml:39`) to the development branch's URL, redeploy production, verify the site loads and `prod-db-ping` shows `current_user = app_prod`. Only then reset `neondb_owner`'s password on production (kills every old URL in `.worktrees/*/.env`, shell history and this session's transcript). Also rotate `NEON_API_KEY` (spec Residual risks).
- [ ] **Step 4 (owner): local env reshuffle.** In `.env`: `DATABASE_URL` = the `photos_writer` prod URL; move `EMAIL_DEV_OVERRIDE`, `VOIP_DEV_OVERRIDE_NUMBER`, `DEV_LOGIN_SECRET`, `VOIP_WEBHOOK_BASE_URL`, `X_BEARER_TOKEN` from `.env.local` into `.env`; move `DATABASE_DEV_URL` (development branch) out of `.env` into the main checkout's `.env.local`; new `NEON_API_KEY`.
- [ ] **Step 5:** Verify: no prod `neondb_owner` or `app_prod` URL in `.env`, `.env.local`, `.worktrees/*/.env*` (grep the prod endpoint id, then check each hit's user is `photos_writer`); `pnpm dev` in main works against dev; `DRIZZLE_TARGET=prod pnpm tsx scripts/prod-db-ping.ts` → `current_user = photos_writer`; `pnpm db:refresh:dev --dry-run` works.
- [ ] **Step 6:** Commit `feat(scripts): photos_writer grants for the local photo workflows`.

### Task 9: Migrations baseline

**Files:**
- Delete: `src/shared/db/migrations/0000_*`, `0001_*`, `0002_*`, `meta/*` (FIRST, before generating; otherwise drizzle writes a `0003` diff)
- Create: `src/shared/db/migrations/0000_baseline.sql` + `meta/` (generated)
- Create: `scripts/record-migration-baseline.ts`
- Modify: `package.json` — keep `"db:generate": "drizzle-kit generate"`; add `"db:migrate:dev": "tsx scripts/migrate-dev.ts"` (calls `migrateDb(DATABASE_DEV_URL)`); remove `db:push:dev`
- Create: `scripts/migrate-dev.ts`
- Modify: `scripts/refresh-dev-from-prod.ts` — closing hint `pnpm db:push:dev` → `pnpm db:migrate:dev`

**Interfaces:**
- Consumes: `migrateDb` (Task 3), the prod-script Action (Task 7).
- Produces: `record-migration-baseline.ts` — ensures schema `drizzle` and `drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)` exist, then inserts the baseline row (`hash` = sha256 of the whole SQL file, `created_at` = the journal entry's `when`; recipe at `drizzle-orm/migrator.js:20-23`) only if no row with that hash exists. Idempotent; `--dry-run` prints the row.

- [ ] **Step 1:** Delete the old files, then `pnpm db:generate --name baseline`. Expect exactly `0000_baseline.sql`, `meta/0000_snapshot.json`, `meta/_journal.json`.
- [ ] **Step 2: Prove it (owner says "run").** `pnpm wt:db create` in a scratch worktree gives a scrubbed prod copy.
  - (a) `pnpm drizzle-kit push --strict --verbose` against it (its `.env.local` targets the copy) → "No changes detected"; answer **No** to any prompt. Any planned statement is drift.
  - (b) Create a child of the copy, `drop schema public cascade; create schema public;` on the child only, `migrateDb(<child url>)`, then Neon Schema Diff (MCP `compare_database_schema`) child vs copy → no differences beyond column order and the `drizzle` schema; list any column-order-only lines in the PR body. Delete the child.
  - If prod has drift, prod wins: edit the Drizzle schema files, regenerate the baseline, repeat; list every drift item in the PR body.
- [ ] **Step 3:** On the copy: `record-migration-baseline.ts` → one row; `migrateDb(<copy url>)` → `{ applied: 0 }`.
- [ ] **Step 4:** Commit `feat(db): adopt drizzle migrations with a baseline proven equal to prod`. Merge.
- [ ] **Step 5 (owner-approved):** Run the prod-script Action with `scripts/record-migration-baseline.ts`, then `scripts/prod-db-ping.ts` → count 1. Ask the owner before `pnpm db:refresh:dev` (it resets their dev data) so dev carries the row.

### Task 10: Migrations on production deploy + CI checks

**Files:**
- Create: `scripts/vercel-build.ts`
- Create: `scripts/verify-migration-order.ts` (run in CI, not a unit test)
- Modify: `package.json` — `"vercel-build": "tsx scripts/vercel-build.ts"`; remove `db:push:prod`, `db:reset:prod`, `db:seed:prod`, `backfill:phones`, `backfill:proposal-media`, `rebuild:gcal`, `gcal:cron:setup` (their scripts run through the prod-script Action by path)
- Modify: `.github/workflows/pr-checks.yml`
- Test: `scripts/verify-vercel-build.ts`

**Interfaces:**
- Produces: `buildPlan(env: { VERCEL_ENV?: string }): { migrate: 'prod' | 'none' }` — production → `prod`; anything else → `none` (previews arrive in Task 11). Then `migrateDb(<unpooled prod URL>)` for `prod`, then `next build`. Any failure exits non-zero, which cancels the deploy.
- Produces: `verify-migration-order.ts` — reads `src/shared/db/migrations/meta/_journal.json` and `git show origin/main:src/shared/db/migrations/meta/_journal.json`; fails when `idx` is not `0..n-1` in order, when `when` does not strictly increase, or when any entry the branch adds has `when` ≤ the newest on `main`. Message: `Migration <tag> is older than main's newest. Regenerate it (pnpm db:generate) instead of merging the journal by hand.`

- [ ] **Step 1: Failing tests:** `buildPlan` (production → prod; preview → none; unset → none) and `verify-migration-order` fixtures (in order → pass; hand-merged older entry → fail; duplicate idx → fail).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Confirm the Vercel project has no Build Command override that would bypass `vercel-build`.
- [ ] **Step 4: CI.** In `pr-checks.yml` (keep Node 20): add `pnpm tsc`; add `pnpm drizzle-kit check`; add `pnpm tsx scripts/verify-migration-order.ts` (needs `fetch-depth: 0` or a fetch of `origin/main`); add `pnpm drizzle-kit generate --name ci-check` with `timeout-minutes: 3` followed by `test -z "$(git status --porcelain src/shared/db/migrations)"` (a rename prompt hangs and times out, which correctly fails the PR). The build keeps the `DATABASE_URL` secret, now the development branch (Task 8 Step 3).
- [ ] **Step 5:** Tests pass; `pnpm lint && pnpm tsc`. Commit `feat(deploy): production migrations under a lock in vercel-build; CI checks tsc and migrations`.
- [ ] **Step 6:** After merge, the production deploy log shows `applied: 0` and the site works.

### Task 11: Preview databases (integration first, then the preview build path)

**Files:**
- Modify: `scripts/vercel-build.ts` — preview path
- Modify: `scripts/verify-vercel-build.ts`

**Interfaces:**
- Consumes: `assertNotProdEndpoint`, `scrub`, `isScrubbed`, `migrateDb`.
- Produces: `buildPlan(env: { VERCEL_ENV?: string, DATABASE_URL?: string, DATABASE_DEV_URL?: string, NEON_PROD_ENDPOINT_ID?: string }): { migrate: 'prod' | 'preview' | 'none', url?: string }` — preview resolves the URL exactly as the runtime does (`DATABASE_DEV_URL ?? DATABASE_URL`, `src/shared/db/index.ts:9-11`) and calls `assertNotProdEndpoint(url, NEON_PROD_ENDPOINT_ID)` (throws when the id is unset). Preview run: `scrub` only when `isScrubbed` is false, then `migrateDb`, then `next build`, using the integration's unpooled URL (`DATABASE_URL_UNPOOLED`) for both.

- [ ] **Step 1 (owner, console):** Install the Neon–Vercel integration (Neon-managed, existing project, Preview branching on, delete branches with their git branch). Remove `DATABASE_DEV_URL` from Vercel **Preview** scope. Open no other PR until Step 4 merges: previews built in between would run on unscrubbed copies (protected, owner-only).
- [ ] **Step 2: Failing test:** preview + prod-endpoint URL → throws /production endpoint/; preview + id unset → throws /not set/; preview + other URL → preview; preview with both URLs set → picks `DATABASE_DEV_URL`.
- [ ] **Step 3:** Run → FAIL; implement; test passes; `pnpm tsc`.
- [ ] **Step 4:** Open the PR. Its own preview build is the live check: Neon shows `preview/<branch>`; build log shows the scrub and `applied`; `select count(*) from session` on that copy = 0 before sign-in; that copy's password fails against the prod host (Task 1 Step 2 already proved the rule).
- [ ] **Step 5:** Commit `feat(deploy): preview builds scrub and migrate their own Neon copy`. After merge, delete a scratch branch → its Neon preview branch disappears.

### Task 12: Google sign-in through the proxy

**Files:**
- Modify: `src/shared/config/roots.ts` — `APP_HOSTS.dev` → `['localhost:*', '*.localhost:*']`; add `APP_HOSTS.preview: ['<project>-*-<team>.vercel.app']` (exact pattern read from a real preview URL); rewrite the keep-in-sync comment at lines 10-14
- Modify: `src/shared/domains/auth/server.ts` — `allowedHosts` includes `APP_HOSTS.preview`; add `oAuthProxy({ productionURL: <Task 1 Step 5 host>, secret: env.OAUTH_PROXY_SECRET })` to `plugins`; rewrite the "register every host in Google" comment at lines 20-23
- Modify: `src/shared/config/server-env.ts` — `OAUTH_PROXY_SECRET: z.string().min(32).optional()` plus a gate: `VERCEL_ENV` is `production` or `preview` and the secret is missing → throw
- Modify: `.env.ci` (dummy `OAUTH_PROXY_SECRET`)

- [ ] **Step 1:** Confirm `APP_HOSTS.dev`'s only consumer is the spread at `server.ts:63` (no equality use); `is-production-host.ts`, `next.config.ts:22` and the middleware do not read it.
- [ ] **Step 2:** Implement. Owner adds the same `OAUTH_PROXY_SECRET` to Vercel Production + Preview and local `.env`.
- [ ] **Step 3:** Ship to prod (PR, merge). Prod sign-in still works.
- [ ] **Step 4:** Verify in a real browser (local Playwright script per memory, or the owner on the iPad): sign in on a protected preview → signed in on the preview; on `localhost:3007` and `kitchens.localhost:3007` → signed in; through the ngrok tunnel on the iPad → signed in; prod `session` table gained no rows from these sign-ins (`prod-db-ping`-style count through the prod-script Action).
- [ ] **Step 5 (owner, console):** Remove all `localhost` redirect URIs from the Google OAuth client. Re-verify one local port.
- [ ] **Step 6:** Commit `feat(auth): google sign-in on any local port and preview via oAuthProxy`.

### Task 13: Orca wiring

**Files:**
- Modify: `orca.yaml` — `scripts.setup` keeps install + port claim, then `pnpm wt:db create`; add `scripts.archive: pnpm wt:db delete`
- Modify: `.worktreeinclude` — `.env`, `.claude/settings.local.json` (drop `.env.local`: setup writes each worktree's own)

- [ ] **Step 1:** Edit and commit both files to `main` via PR (Orca reads `.worktreeinclude` from the primary checkout, setup from the new worktree's revision).
- [ ] **Step 2:** Owner, in Orca: base ref `origin/main`; create `chore/orca-smoke`. Verify: setup log shows port and `wt/chore-orca-smoke`; agent starts after setup; `pnpm dev` in it serves on the claimed port with Google sign-in working.
- [ ] **Step 3: Failed setup.** Create `chore/orca-fail` with `NEON_PROD_ENDPOINT_ID` temporarily blanked in that worktree's environment → setup fails; note whether Orca still starts the agent; `pnpm dev` there refuses with the Task 5 message. Report Orca's behaviour to the owner.
- [ ] **Step 4:** Delete both worktrees in Orca → archive hook runs → Neon branches gone; git branch kept only if pushed.

### Task 14: Agent git duties

**Files:**
- Create: `.claude/skills/ship-worktree/SKILL.md`
- Modify: `.claude/settings.json` — the pre-commit hook runs in `git rev-parse --show-toplevel` of the command's directory, not a hardcoded main checkout
- Delete: `.claude/skills/pre-ship/` (retired after Task 0)
- Modify: `CLAUDE.md` — GitHub workflow section

**Interfaces:**
- `ship-worktree` covers, in order: `git fetch` + `git merge origin/main` (never rebase/force-push) → on a `_journal.json` conflict: take `main`'s migrations folder, delete this branch's migration, `pnpm db:generate`, then `pnpm wt:db delete && pnpm wt:db create` and `pnpm wt:db delete --preview` (both copies already ran the old file) → `pnpm db:migrate:dev` → `pnpm lint && pnpm tsc` → `ponytail-review`, fix or list findings → overlap report via the user-level `merge-risk` skill (open PRs whose files intersect this branch's, in plain words) → push → `gh pr create` with summary, preview link, and for a migration a plain-English "what this changes and why it is safe" paragraph → when `main` moves, repeat the merge step → after the owner merges: on local main `git pull --ff-only origin main` (a refusal = stop and look), delete the branch and the worktree. Ends with a plain-English summary for the owner. Reuses `superpowers:finishing-a-development-branch` for the PR path rather than restating it.
- Repo setting: squash-merge only.

- [ ] **Step 1:** Write the skill (use `superpowers:writing-skills`) and the hook change.
- [ ] **Step 2:** Dry-run it in a smoke worktree on a one-line change; PR opens with all sections; a commit there is gated by that worktree's `tsc` (introduce a type error in the worktree only → commit blocked).
- [ ] **Step 3:** Commit.

### Task 15: Retire the old system

**Files:**
- Delete: `scripts/dispatch.sh`, `scripts/hotfix.sh`, `docs/workflow.md` (stale: wildcard redirect URI, "PRs can't merge without green checks"), the `.worktrees/prod` checkout
- Modify: `package.json` — remove `dispatch`, `hotfix`
- Modify: `CLAUDE.md` — Commands (`wt:db`, `db:generate`, `db:migrate:dev`, no `db:push:*`; line 22's "only via DRIZZLE_TARGET=prod" now true and naming `photos_writer`), GitHub workflow (Orca, squash merge, prod-script Action), Mobile testing (ports per worktree, claimed by Orca)
- Modify: `docs/codebase-conventions/environment.md` (line 59 tells you to register each new host with Google; line 57; line 19's gate list), `drizzle.config.ts:7-14` comment (dispatch worktrees)
- Modify: pending docs that gate on deleted commands — `docs/superpowers/plans/2026-10-21-proposal-energy-impact-foundation.md:36,713,925`, `docs/plans/2026-10-21-proposal-energy-impact-epic.md:44,161`, `docs/superpowers/specs/2026-09-24-proposal-applications-design.md:217`, `docs/superpowers/specs/2026-10-20-r2-storage-design.md:48-49` (Q-A database side superseded) → "migration in the PR" / prod-script Action
- Memory: rewrite `feedback-work-on-main`, `reference-dispatch-system`, `reference-git-workflow-playbook`, `reference-orca-ade`, `reference-neon-branching`, `reference-db-refresh`, `feedback-runtime-db-env` (drop `seed:bina-contacts`); add the prod-script Action as the only full prod path

- [ ] **Step 1:** `grep -rnE "pnpm dispatch|dispatch\.sh|pnpm hotfix|hotfix\.sh|db:(push|reset|seed):prod|db:push:dev|DRIZZLE_TARGET=prod" --include=*.md --include=*.ts --include=*.json --include=*.sh --include=*.yml . | grep -v node_modules` → fix or delete every hit (the meeting "dispatcher" and `workflow_dispatch` are unrelated and not in this pattern).
- [ ] **Step 2:** `pnpm lint && pnpm tsc`. **Step 3:** Commit.

### Task 16: Branch protection on

- [ ] **Step 1 (owner-confirmed):** Ruleset on `main`: require PR, require the `check` job (PR Checks) to pass, block force-push and deletion, apply to admins; allow squash merge only.
- [ ] **Step 2:** Verify with `gh api repos/OlisDevSpot/tri-pros-website/rulesets` (rules present, enforcement active, no bypass actors) and a PR that merges after checks pass. No test push to `main`.
- [ ] **Step 3:** Owner notes the break-glass: Settings → Rules → disable, push, re-enable.
