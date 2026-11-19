# Parallel Lanes Lean Cut Implementation Plan

> **Status**
> - Stage: build · Tasks 2–5 and 7 built 2026-11-18; final branch review passed
> - Built on: `chore/dev-flow-foundation` (stacked on `release/2026-11-13-drain`, PR #289) · Verified at: `chore/dev-flow-foundation@4f6488b4a` 2026-11-18 · page: https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS (lane `foundation`)
> - Done: `pnpm review` (slot `.worktrees/review` set up, hand run on `data-views` passed), dev server idles at 5 min + `dev.mjs` lint, `CLAUDE.md` lines (minus "Verify on the preview"), lane hook edit (orient spec §4.7, owner chose to land it here), Task 1 Step 1 (Preview `DATABASE_URL` = dev endpoint `ep-mute-sunset`)
> - Next: Oliver does Task 1 Steps 2–3 (Vercel console); then push + draft PR (Task 6, on his OK); then Task 1 Steps 4–5 on this branch's preview and the held `CLAUDE.md` bullet
> - Open: add "(run it from the main checkout)" to the `pnpm review` line? (owner); deferred minors: atomic `.env.local` write, failed install keeps the previous `.env.local`, `git diff origin/main` throw hides the summary, dirty listing `trimEnd`
> - Blocked: Task 1 Step 4 on Steps 2–3 + this branch's preview; Task 8 is a new session

> **Shared with the ship-board build (2026-11-18):** the session building `docs/superpowers/plans/2026-11-15-orient-lane-briefing.md` on local main owns `~/.claude/hooks/lane-context.sh`, `session-capture`, `/orient`, the board page, and every lane's `brief`. This plan writes only `pr`, `stage`, `next`, `move` on `lanes/foundation`. Its `CLAUDE.md` edits leave the `/orient` line to that plan. Oliver keeps Task 1's Vercel steps and that plan's board backfill in separate sittings. A handoff that says to write `brief.statusBlock` is overridden here.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents verify lanes on Vercel previews instead of dev servers, Oliver points one review slot at any lane with `pnpm review <branch>`, the dev server sleeps after 5 idle minutes, the lane habits are written down, lane rows stay current, and Google sign-in works on previews.

**Architecture:** Mostly console steps and written habits. The only new code is `pnpm review`: a small tsx CLI (`scripts/review-slot.ts`) over pure decision functions (`scripts/lib/review-slot.ts`) that moves a detached worktree (`.worktrees/review`) to a lane's commit and rebuilds its `.env.local`. The lane hook is a user-level shell script trimmed in place. Google sign-in on previews is parent plan Task 12, unchanged.

**Tech Stack:** tsx scripts with `node:assert/strict`, git worktrees, Vercel Deployment Protection, better-auth `oAuthProxy` (parent Task 12), POSIX sh + jq (hook).

**Spec:** `docs/superpowers/specs/2026-11-14-parallel-lanes-foundation-design.md` (sections Lean cut, K1–K4, F1, F2). Parent: `docs/superpowers/plans/2026-11-01-worktree-pr-flow.md`.

## Global Constraints

- Never start a dev server (`pnpm dev`, `dev:mobile`, `next dev`), never `pnpm build`, never source `.env`, no DB writes for testing.
- Verify with `pnpm lint && pnpm tsc`, plus `pnpm exec eslint <each new or edited file under scripts/>` (`pnpm lint` skips `scripts/`).
- Tests: `scripts/verify-*.ts`, `node:assert/strict`, run with `pnpm tsx scripts/verify-<name>.ts`, one `✅ …` line on success.
- Comments say why, never what. No new `DOCS.md`.
- Stage and commit by explicit path (`git add -- <paths>`, `git commit -- <paths>`); no `stash`, `reset`, `checkout .`, `--amend`. The pre-commit hook takes ~110 s: batch commits.
- Every outward action (Vercel settings or env, GitHub, Google Cloud, pushes, opening PRs) waits for Oliver's OK, each time. Every Neon or SQL step waits for Oliver saying "run".
- Agents never merge or push to `main`. No rebase, no force-push.
- Review slot: `.worktrees/review`, port **3001**. Branch resolution never guesses from names alone; it reads `git worktree list --porcelain`.
- The slot never runs without an explicit `DATABASE_DEV_URL` in its `.env.local` (without one, `src/shared/db/index.ts:9-11` falls back to prod's `DATABASE_URL`). `NEON_BRANCH_ID` is never copied into the slot.

## Review Focus

1. **The shared dev URL lives only in the main checkout's `.env`** (true until parent Task 8): the slot still gets an explicit `DATABASE_DEV_URL` line, taken from `.env`. Test in Task 2.
2. **The lane's `.env.local` carries `NEON_BRANCH_ID`, its own `PORT` and a quoted URL**: the URL line is copied verbatim, `NEON_BRANCH_ID` and the lane's `PORT` never are, and the slot's `PORT` is 3001. Test in Task 2.
3. **`pnpm review review`, or a detached worktree's folder name** (`prod`, `perf-*`): no branch to resolve → `null`, and the CLI lists what it can resolve. Test in Task 2.
4. **A branch with no worktree** (pushed or local only): resolves with `path: null`, and the slot runs on shared dev. Test in Task 2.
5. **The slot does not exist yet**: the CLI exits 1 printing the one-time setup commands, before any git command. Checked by hand in Task 3.

---

### Task 1: Agents verify on previews (K1, owner console steps)

**Files:** none in the repo. Main checkout's `.env.local` (not committed). Memory `reference-playwright-auth.md`.

Tasks 2–5 do not wait on this task.

- [x] **Step 1: Vercel env audit (parent Task 1 Step 4).** With Oliver's OK, read the Preview and Production scopes through the Vercel connector (read only) and list, for each of `DATABASE_URL`, `DATABASE_DEV_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BASE_URL`, `NGROK_URL`, `EMAIL_DEV_OVERRIDE`, `VOIP_DEV_OVERRIDE_NUMBER`, `DEV_LOGIN_SECRET`, `QSTASH_*`, whether it is set and, for DB URLs, which Neon endpoint it points at (never print a value). **Any Preview DB URL on the prod endpoint → stop and tell Oliver.** Missing `EMAIL_DEV_OVERRIDE` / `VOIP_DEV_OVERRIDE_NUMBER` in Preview → Oliver adds them.
- [ ] **Step 2: `DEV_LOGIN_SECRET` in Vercel Preview** (Preview scope only, never Production). Oliver adds it, same value as local.
- [ ] **Step 3: Preview protection (parent Task 1 Step 7).** Oliver enables Vercel Authentication for Preview and Protection Bypass for Automation, and copies the bypass secret into the main checkout's `.env.local` as `VERCEL_AUTOMATION_BYPASS_SECRET` (`.worktreeinclude` copies it to new worktrees). Verify: a preview URL in a logged-out browser shows the Vercel login.
- [ ] **Step 4: First agent check on a real preview** (PR #289's preview, or this branch's once Task 6 opens it). In a Playwright browser, navigate once to `<preview>/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&x-vercel-protection-bypass=<bypass>&x-vercel-set-bypass-cookie=true`. Expected: lands on `/dashboard` signed in; a second navigation to `/dashboard/customers` stays signed in (the bypass cookie holds). Screenshot both.
- [ ] **Step 5: Memory.** Add the preview ritual from Step 4 to `reference-playwright-auth.md` (the local ritual stays).

### Task 2: Review slot decisions (F1, pure functions)

**Files:**
- Create: `scripts/lib/review-slot.ts`
- Test: `scripts/verify-review-slot.ts`

**Interfaces:**
- Produces:
  - `REVIEW_PORT = 3001`, `REVIEW_SLOT_DIR = '.worktrees/review'`
  - `interface Worktree { path: string, branch: string | null, head: string }` (`branch` without `refs/heads/`; `null` when detached)
  - `parseWorktrees(porcelain: string): Worktree[]` — parses `git worktree list --porcelain`; the first entry is the main checkout.
  - `resolveBranch(worktrees: Worktree[], branches: string[], arg: string): { branch: string, path: string | null } | null` — `branches` are the local branch names (`git for-each-ref --format='%(refname:short)' refs/heads`). An `arg` in `branches` → that branch, with the path of the worktree holding it or `null`. Else an `arg` equal to the folder name of exactly one worktree that has a branch → that branch and path. Else `null`.
  - `installNeeded(installedHash: string | null, targetHash: string): boolean`
  - `slotEnvLocal(input: { mainEnvLocal: string, mainEnv: string, laneEnvLocal: string | null }): { text: string, db: 'lane copy' | 'shared dev' }` — throws `/no DATABASE_DEV_URL/` when none of the three has one. `text` = `mainEnvLocal` minus its `PORT`, `DATABASE_DEV_URL` and `NEON_BRANCH_ID` lines, plus `PORT=3001` and the chosen `DATABASE_DEV_URL=` line, copied verbatim. Order: lane `.env.local` (→ `lane copy`), then main `.env.local`, then main `.env` (both → `shared dev`).
  - `schemaChanged(paths: string[]): boolean` — any path under `src/shared/db/schema/` or `src/shared/constants/enums/`.
  - `dbUrlLine(envText: string): string | null` — the `DATABASE_DEV_URL=` line, or `null` (used by Task 3 to tell whether the slot's DB changed).

- [x] **Step 1: Write the failing test** `scripts/verify-review-slot.ts`:

```ts
import assert from 'node:assert/strict'
import { installNeeded, parseWorktrees, resolveBranch, schemaChanged, slotEnvLocal } from './lib/review-slot'

const porcelain = [
  'worktree /repo', 'HEAD aaa', 'branch refs/heads/main', '',
  'worktree /repo/.worktrees/data-views', 'HEAD bbb', 'branch refs/heads/feat/data-views', '',
  'worktree /repo/.worktrees/review', 'HEAD ccc', 'detached', '',
  'worktree /repo/.worktrees/prod', 'HEAD ddd', 'detached', '',
].join('\n')
const wts = parseWorktrees(porcelain)
assert.equal(wts.length, 4)
assert.deepEqual(wts[1], { path: '/repo/.worktrees/data-views', branch: 'feat/data-views', head: 'bbb' })
assert.equal(wts[2].branch, null)

const branches = ['main', 'feat/data-views', 'feat/pushed-only']
assert.deepEqual(resolveBranch(wts, branches, 'feat/data-views'), { branch: 'feat/data-views', path: '/repo/.worktrees/data-views' })
assert.deepEqual(resolveBranch(wts, branches, 'data-views'), { branch: 'feat/data-views', path: '/repo/.worktrees/data-views' })
assert.deepEqual(resolveBranch(wts, branches, 'feat/pushed-only'), { branch: 'feat/pushed-only', path: null })
assert.equal(resolveBranch(wts, branches, 'review'), null)
assert.equal(resolveBranch(wts, branches, 'prod'), null)
assert.equal(resolveBranch(wts, branches, 'nope'), null)

assert.equal(installNeeded(null, 'h1'), true)
assert.equal(installNeeded('h1', 'h1'), false)
assert.equal(installNeeded('h0', 'h1'), true)

const main = 'DEV_LOGIN_SECRET=s\nPORT=3000\nEMAIL_DEV_OVERRIDE=x@y\n'
const lane = 'PORT=3010\nNEON_BRANCH_ID=br-lane\nDATABASE_DEV_URL="postgres://lane"\n'
const fromLane = slotEnvLocal({ mainEnvLocal: main, mainEnv: 'DATABASE_DEV_URL=postgres://shared\n', laneEnvLocal: lane })
assert.equal(fromLane.db, 'lane copy')
assert.match(fromLane.text, /^DATABASE_DEV_URL="postgres:\/\/lane"$/m)
assert.match(fromLane.text, /^PORT=3001$/m)
assert.doesNotMatch(fromLane.text, /PORT=30(00|10)|NEON_BRANCH_ID/)
assert.match(fromLane.text, /^DEV_LOGIN_SECRET=s$/m)

const fromEnv = slotEnvLocal({ mainEnvLocal: main, mainEnv: 'DATABASE_DEV_URL=postgres://shared\n', laneEnvLocal: null })
assert.equal(fromEnv.db, 'shared dev')
assert.match(fromEnv.text, /^DATABASE_DEV_URL=postgres:\/\/shared$/m)

assert.throws(() => slotEnvLocal({ mainEnvLocal: main, mainEnv: 'DATABASE_URL=postgres://prod\n', laneEnvLocal: 'PORT=3010\n' }), /no DATABASE_DEV_URL/)

assert.equal(schemaChanged(['src/shared/db/schema/meetings.ts']), true)
assert.equal(schemaChanged(['src/shared/constants/enums/user.ts']), true)
assert.equal(schemaChanged(['src/app/page.tsx']), false)

console.log('✅ review-slot decisions verified')
```

- [x] **Step 2: Run it.** `pnpm tsx scripts/verify-review-slot.ts` → FAIL (module not found).
- [x] **Step 3: Implement** `scripts/lib/review-slot.ts` per the Interfaces block. Env lines match `^(KEY)\s*=` at line start; the rest of the line is kept verbatim.
- [x] **Step 4: Run it.** `pnpm tsx scripts/verify-review-slot.ts` → `✅ review-slot decisions verified`. `pnpm exec eslint scripts/lib/review-slot.ts scripts/verify-review-slot.ts` → clean. `pnpm tsc` → clean.
- [x] **Step 5: Commit.** `git add -- scripts/lib/review-slot.ts scripts/verify-review-slot.ts` → `feat(dev): review slot decisions for pnpm review`.

### Task 3: `pnpm review <branch | worktree folder>` (F1, CLI)

**Files:**
- Create: `scripts/review-slot.ts`
- Modify: `package.json` (scripts: `"review": "tsx scripts/review-slot.ts"`; approved 2026-11-15)

**Interfaces:**
- Consumes: everything Task 2 produces.

- [x] **Step 1: Implement** `scripts/review-slot.ts`. Git through `execFileSync('git', [...])`, never a shell string. Paths from `git rev-parse --path-format=absolute --git-common-dir` (repo root = its parent) and `parseWorktrees`. In order:
  1. Slot folder missing → exit 1, printing the setup: `git worktree add --detach .worktrees/review origin/main`, `cp .env .worktrees/review/.env`, `pnpm --dir .worktrees/review install`, then `pnpm review <branch>`. No other git command runs first.
  2. `resolveBranch` → `null` → exit 1 listing each worktree folder with its branch (detached ones marked) and saying a branch name works too.
  3. `sha = git rev-parse refs/heads/<branch>`.
  4. `git -C <slot> status --porcelain` not empty → print it, exit 1.
  5. `targetHash` = sha256 of `git show <sha>:package.json` + `git show <sha>:pnpm-lock.yaml`. `installNeeded(git config --get lanes.reviewInstalled || null, targetHash)` → if the slot port answers (a `node:net` connect to `127.0.0.1:3001` within 500 ms) exit 1 with "stop the dev server on :3001, then run pnpm review <branch> again"; otherwise remember to install after the move.
  6. `git -C <slot> checkout --detach <sha>`.
  7. Install if needed: `pnpm install --frozen-lockfile` in the slot, inheriting stdio; only on exit 0 `git config lanes.reviewInstalled <targetHash>`; non-zero → exit 1 saying the next run retries.
  8. Env: read the main checkout's `.env.local` and `.env` and the lane worktree's `.env.local` (if `path` and the file exist) as text; `slotEnvLocal(...)`; compare `dbUrlLine` of the old slot `.env.local` with the new; write the new one.
  9. `git diff --name-only origin/main...<sha>` → `schemaChanged` and `db === 'shared dev'` → print the warning "this lane changes the schema but runs on shared dev; its pages may fail".
  10. Print: branch, short sha + subject, `http://localhost:3001`, `db` (never the URL), then "restart the dev server (only you start it)" if it installed or the DB line changed, else "hot reload picks it up"; a DB change adds "you will be signed out: sessions live in the database".
- [x] **Step 2: Lint and type-check.** `pnpm exec eslint scripts/review-slot.ts` → clean; `pnpm tsc` → clean.
- [x] **Step 3: Refusal checks, no slot needed.** `pnpm review feat/data-views` with no `.worktrees/review` → exit 1 with the setup lines. Then ask Oliver to approve the one-time setup commands and run them. `pnpm review nope` → exit 1 with the list.
- [x] **Step 4: Hand run with Oliver** (his dev server stopped): `pnpm review <a lane folder>` → slot HEAD = the lane's sha (`git -C .worktrees/review rev-parse HEAD`), `.worktrees/review/.env.local` has `PORT=3001`, one `DATABASE_DEV_URL=` line, no `NEON_BRANCH_ID` (`grep -c`). Touch a file in the slot → the next run refuses and lists it; Oliver removes it.
- [x] **Step 5: Commit.** `git add -- scripts/review-slot.ts package.json` → `feat(dev): pnpm review points the review slot at a lane`.

### Task 4: Dev server sleeps after 5 idle minutes (F2)

**Files:**
- Modify: `scripts/dev.mjs` (default `DEV_IDLE_MIN` and its header-comment line; the file's eslint errors)

- [x] **Step 1:** `scripts/dev.mjs:29` `process.env.DEV_IDLE_MIN ?? 30` → `?? 5`; header comment `(default 30; 0 = never)` → `(default 5; 0 = never)`.
- [x] **Step 2:** `pnpm exec eslint --fix scripts/dev.mjs`, then fix what `--fix` leaves by hand without changing behaviour. `pnpm exec eslint scripts/dev.mjs` → clean. Other `scripts/lib/*.mjs` files stay untouched (out of scope).
- [x] **Step 3:** `node --check scripts/dev.mjs` → no output. `git diff --stat scripts/dev.mjs` shows only formatting plus the two lines.
- [x] **Step 4: Commit** with Task 5.

### Task 5: `CLAUDE.md` lines (F2, K2, K1)

**Files:**
- Modify: `CLAUDE.md` (Commands block, GitHub workflow section). Parent Tasks 14 and 15 rewrite lines here too: whichever lands second merges the other's lines.

- [x] **Step 1: Commands.** In the `pnpm dev` line, `DEV_IDLE_MIN idle (30)` → `DEV_IDLE_MIN idle (5)`. Add after it:
  `pnpm review <branch|folder>   # Point the review slot (.worktrees/review, :3001) at a lane's latest commit; Oliver's dev server there shows it`
- [ ] **Step 2: GitHub workflow.** After the **Branch** bullet, add:
  - `- **Draft PR early:** open a draft PR at the first working screen; every push rebuilds its Vercel preview. Oliver's notes arrive as preview comments.`
  - `- **Verify on the preview:** \`pnpm lint && pnpm tsc\`, the lane's tests, then Playwright against the lane's preview: first navigation to \`/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>&x-vercel-set-bypass-cookie=true\` (both secrets in \`.env.local\`). A lane reaches Oliver only after this passes; no dev server needed.` **Only once Task 1 Step 4 passed**; until then leave this bullet out and say so in the PR body.
  - After the **Ship** bullet: `- **Epic worktrees ship in slices:** the epic worktree is the workbench and never opens a PR. Each slice gets a new worktree and branch from \`origin/main\` (or the previous slice's branch when stacked), takes its files with \`git checkout <epic-branch> -- <paths>\`, opens a draft PR targeting its parent, and slices merge in order. After a slice squash-merges, \`git merge origin/main\` into the epic branch.`
- [x] **Step 3: Board line.** Replace the **Board / issues** bullet with:
  `- **Board / issues:** lane status lives on the lane board https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS (each session keeps its row current; the SessionStart hook says how) · backlog: https://github.com/users/OlisDevSpot/projects/3 and https://github.com/OlisDevSpot/tri-pros-website/issues · labels, board IDs, automations: \`memory/reference-github-workflow.md\``
- [x] **Step 4: Show Oliver the `CLAUDE.md` diff** before committing (it is every session's prompt).
- [x] **Step 5: Commit** `git add -- scripts/dev.mjs CLAUDE.md` → `chore(dev): dev server sleeps after 5 idle minutes; lane habits in CLAUDE.md`.

### Task 6: Open the foundation PR

- [x] **Step 1:** `pnpm lint && pnpm tsc`; `pnpm exec eslint scripts/dev.mjs scripts/review-slot.ts scripts/lib/review-slot.ts scripts/verify-review-slot.ts`; `pnpm tsx scripts/verify-review-slot.ts` → all clean, ✅.
- [x] **Step 2:** With Oliver's OK: commit the spec and this plan by path (`docs(dev-flow): lean cut spec and plan`), push `chore/dev-flow-foundation`, open a **draft** PR with base `release/2026-11-13-drain`, using the PR template. Body names #289 as the base and lists what Tasks 1 and 7 still owe.
- [ ] **Step 3:** Board: `lanes/foundation` → `pr`, `stage: review`, `next`, pinned with `if_version`. Never write `brief.*`: the briefing belongs to `/orient`, and `brief.statusBlock` is an old key that the ship board's schema rejects. The status block lives in this plan file only.

### Task 7: Lane hook, check only (K3, user-level, no PR)

The orient-lane-briefing plan (on local main, `docs/superpowers/plans/2026-11-15-orient-lane-briefing.md`, its Task 6) owns the one edit to this hook. That edit makes step 3 read `brief.tracker` (else `brief.plan`), adds the step that applies Oliver's answers, and **keeps the `session` stamp**, because the board reads `session.lastSeen` (the session chip on Now rows, `.claude/skills/ship-board/page.html` `sessionOn`, and the lane page). Ruled 2026-11-18. This task edits the hook only if that plan's Task 6 has not landed yet; in that case, ask Oliver first.

**Files:**
- Check: `~/.claude/hooks/lane-context.sh`

- [x] **Step 1: Fixtures.** In the session scratchpad, a script pipes three inputs into the hook: `{"cwd":"<main checkout>","session_id":"t","source":"startup"}` (expect empty), `{"cwd":"<this worktree>",…}` (expect JSON naming `chore/dev-flow-foundation`), `{"cwd":"/tmp",…}` (expect empty).
- [x] **Step 2:** The worktree output is valid JSON (`jq -e .hookSpecificOutput.additionalContext`) and mentions `brief.tracker`, `session.lastSeen` and `stage`/`next`/`move`. Never remove the session stamp or the apply-answers step.
- [x] **Step 3:** Show Oliver the message text.

### Task 8: Google sign-in on previews (K4 = parent Task 12, its own PR)

Runs in its own worktree off `origin/main`: `git worktree add .worktrees/google-preview-signin -b feat/google-signin-previews origin/main` (ask first).

- [ ] **Step 1:** Parent Task 1 Step 5 (canonical prod host, `curl -sI`), recorded in the PR body.
- [ ] **Step 2:** Parent Task 12 Steps 1–3 and 6 as written there.
- [ ] **Step 3:** Parent Task 12 Step 4, with one substitution: the prod-script Action (parent Task 7) does not exist yet, so Oliver reads prod's `session` row count in the Neon console before and after the test sign-ins (a read; no SQL from the agent).
- [ ] **Step 4:** Parent Task 12 Step 5 (remove localhost redirect URIs) only after Oliver confirms preview and local sign-in work. After this, the review slot's port no longer matters for sign-in.
