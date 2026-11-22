# Parallel Lanes Foundation: Design

> **Status**
> - Stage: spec · stress-tested 2026-11-15, amended 2026-11-18, re-scoped to the lean cut 2026-11-18
> - Built on: `chore/dev-flow-foundation` (stacked on `release/2026-11-13-drain`, PR #289) · Verified at: — · page: https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS (lane `foundation`)
> - Done: lean cut F1, F2 and K2 built 2026-11-18; K3 hook edit landed; K1 audit step done
> - Next: plan `docs/superpowers/plans/2026-11-18-parallel-lanes-lean-cut.md` status block
> - Open: none
> - Blocked: none (this branch stacks on #289)

**Goal:** Several lanes move at once without a dev server per lane. Oliver reviews lanes on previews in end-of-day sittings, runs one dev server for hands-on looks (more when he chooses), and each lane's board row stays current.

## Lean cut (2026-11-18)

Oliver agreed on 2026-11-18 that the full design is overbuilt for one owner. Build only this, in order; the rest waits until 1–2 weeks of lanes running through the cut show a real need.

| # | Kept | Section |
|---|---|---|
| 1 | Parent plan Task 1, Steps 4 and 7, plus `DEV_LOGIN_SECRET` in Vercel Preview: agents verify on previews through `/api/dev/playwright-session` | K1 |
| 2 | Habits, not tooling: draft PRs, squash-merge, stacked slices from an epic worktree | K2 |
| 3 | `pnpm review <lane>` (review slot) with every stress-test fix | F1 |
| 4 | Dev server sleeps after 5 idle minutes, `dev.mjs` lint, two `CLAUDE.md` lines | F2 |
| 5 | Lane status, minimal: the session finds its row by `branch` and updates stage / next / move | K3 |
| 6 | B2 only as far as Google sign-in on previews: parent Task 12 | K4 |

Deferred, each with its reason: F3 (needs parent Task 11), F4 (the git-setting registry needs the B1 grill, and finding the row by `branch` works today), live data (waits for the GitHub connector), F7 (Doppler is its own design, B4), F8 (Oliver sees and agrees each term first), the rest of B2, and B3.

F5 and F6 are no longer deferred. Oliver had them built separately on 2026-11-18 by `docs/superpowers/plans/2026-11-15-orient-lane-briefing.md`, a different design: `/orient` writes a briefing into the lane row, and the board's lane page draws it. Their sections below are history, not the design.

## K1. Agents verify on previews (R3.4) · KEPT

Parent plan Task 1, two steps, each an outward action Oliver confirms first:

- **Step 4, Vercel env audit.** Which DB URL each Preview variable points at; stop and tell Oliver if any reaches the prod endpoint. The test sign-in route mints a session in whatever database the preview uses, so this audit comes first.
- **Step 7, preview protection.** Vercel Authentication on Preview plus Protection Bypass for Automation. Agents send the bypass secret as the `x-vercel-protection-bypass` header; the secret goes in the main checkout's `.env.local`, which `.worktreeinclude` copies.
- **`DEV_LOGIN_SECRET` in Vercel Preview**, the same value as local.

Then an agent's check on a lane is: `pnpm tsc`, `pnpm lint`, tests, then a Playwright script against the lane's preview that signs in through `/api/dev/playwright-session` with the bypass header. No dev server, no Task 12.

## K2. Habits, not tooling (R1.1, R2.1, R5.1) · KEPT

Written into `CLAUDE.md`'s GitHub workflow section; no scripts.

- One draft PR per lane, opened at the first working screen; every push rebuilds its preview.
- Squash-merge only. No rebase, no force-push.
- **Stacked slices from one epic worktree.** The epic worktree is the workbench and never opens a PR itself. Each shippable slice gets its own new worktree and branch, from `origin/main` or from the previous slice's branch; it takes its files from the epic branch (`git checkout <epic-branch> -- <paths>` inside the new slice worktree), opens a draft PR targeting its parent, and slices merge in order. After a slice squash-merges, `git merge origin/main` into the epic branch. The slice branch and worktree are deleted; a squashed branch is never reused.

Requirement 1.1 stays open (B3 may still prefer disposable worktrees); this is the practice until then.

## K3. Lane status, minimal (R4.1, R4.3) · KEPT

`~/.claude/hooks/lane-context.sh` already finds the row by `branch` and asks for stage / next / move updates. The orient-lane-briefing plan's Task 6 makes the one edit to it; this section only checks the result:

- Keep the `session` stamp step: the board reads `session.lastSeen` for its session chips (ruled 2026-11-18; an earlier draft dropped it).
- Keep: silent outside the repo and on `main`; query `lanes` where `branch` equals the current branch; no match → ask Oliver before adding a row; read the row's tracker status block if it names one; update `stage`, `next`, `move`, `updated` on each real change, pinned with `if_version`, one write per change.

User-level file, edited in place, no PR. Checked by piping three fixtures (main, a lane branch, a path outside the repo) into it.

## K4. Google sign-in on previews (R2.2, partly) · KEPT

Parent plan Task 12 as written (`oAuthProxy`, `APP_HOSTS.preview`, `localhost:*`), its own PR off `origin/main`. It needs Task 1 Step 5 (the canonical prod host) first. One substitution: Task 12 Step 4 checks that prod's `session` table gained no rows through the prod-script Action (parent Task 7), which does not exist yet; until then Oliver reads the count in the Neon console. After Task 12, any local port signs in, so the review slot's port stops mattering.

**Requirements:** R0–R7 in the board's `requirements` collection (owner agreed 2026-11-17) are the yardstick; each section names the requirement it serves. Open there: 1.1 (epic branch reuse, B3), 2.2 (a stable address per lane, B2), 6.3 (Doppler + Vercel env design, B4).

**Parent:** `docs/superpowers/plans/2026-11-01-worktree-pr-flow.md` (Tasks 0–16). This spec adds the review and visibility layer on top of it. It touches the parent in two places: F2 edits the `CLAUDE.md` lines that parent Tasks 14 and 15 also rewrite (whichever lands second merges the other's line), and F3 waits for Task 11.

## Owner rulings this spec obeys (board `decisions`)

| Date | Ruling |
|---|---|
| 2026-11-14 | Draft PR at the first working screen; review sittings 2–3 times a week, mostly end of day; iPad notes go in Vercel preview comments. |
| 2026-11-14 | No AI reviewer for now. The parallel-lane skills come after plan Tasks 1–16, each with its own brainstorm, so nothing here is a skill. |
| 2026-11-14 | The board holds active work and lane status; GitHub issues are the backlog; trackers keep rulings. |
| 2026-11-14 | No size budget per lane; hiding unfinished work behind a switch is decided per lane, default no. |
| 2026-11-15 | `preview/today` (F3) waits until plan Task 11 ships. |
| 2026-11-15 | `pnpm review <lane>` goes in `package.json`. |
| 2026-11-18 | The registry is a git setting on each branch, **after a grill with Oliver on how it works** (B1). |
| 2026-11-18 | One local dev server at a time, the rest on previews, **without blocking several dev servers when he wants them**; preview addresses must be stable enough for Google sign-in, QStash and the other vendors (B2). |
| 2026-11-18 | Keep the epic branch going after a slice ships, **pending a brainstorm on whether worktrees should be disposable instead** (B3). |
| 2026-11-18 | The status block stays in the tracker file and is copied to the board. |
| 2026-11-18 | Add a dev flow block to `CONTEXT.md`, **after Oliver sees what the terms look like in use** (F8). |
| 2026-11-18 | The F2 PR also fixes `scripts/dev.mjs`'s lint errors. |

## What already exists (verified 2026-11-18)

| Piece | Where | State |
|---|---|---|
| Lane board v5 | artifact `7D8kgccA7iy6f8ATWzLdqS`, db collections `lanes`, `requirements`, `decisions`, `setup`, `skills`, `flow_nodes`, `flow_changes`, `snapshots/collisions` | Tabs Now · Merge · Flow · Setup · Decisions · Reference. No view of `requirements` yet. Lane `stage` values in use: idea · spec · plan · build · review · preview · ready · shipped |
| Session ↔ lane hook | `~/.claude/hooks/lane-context.sh`, `SessionStart` in `~/.claude/settings.json` | Hardcodes the repo's `.git` path; queries `lanes` by `branch`. No row has ever received a session stamp |
| Dev router | `scripts/dev.mjs`, `scripts/lib/dev-router.mjs`, `scripts/lib/get-port.mjs` | On #289 only. `DEV_IDLE_MIN` defaults to 30. `dev.mjs` has 20 eslint errors (19 auto-fixable); `pnpm lint` skips `scripts/`. `getPort()` reads `process.cwd()`'s `.env.local` only |
| `/orient` | `.claude/skills/orient/` | On #289 only. Writes the status block into the tracker or plan |
| `session-capture` | `~/.claude/skills/session-capture/SKILL.md` | User-level, not in the repo. Runs in every project |
| Test sign-in | `src/app/api/dev/playwright-session/route.ts` | On prod. 404 when `VERCEL_ENV=production` or on a production host, otherwise mints a session for `DEV_LOGIN_SECRET`. Works on a preview once `DEV_LOGIN_SECRET` is set in Vercel Preview |
| DB selection | `src/shared/db/index.ts:9-11` | `DATABASE_DEV_URL ?? DATABASE_URL` unless `DRIZZLE_TARGET=prod`. Pool is module-level: a new DB needs a restart. **With no `DATABASE_DEV_URL` the app falls to `DATABASE_URL`, prod** |
| Advertised address | `src/shared/config/public-url.ts` | `NGROK_URL ?? NEXT_PUBLIC_BASE_URL`, both in the shared `.env`: every worktree tells vendors the same address |
| Sign-in hosts | `src/shared/config/roots.ts`, `src/shared/domains/auth/server.ts:62-63` | Google sign-in accepts localhost 3000–3002 and the one ngrok host |
| Ports | each worktree's `.env.local` `PORT=` | 3002 claimed twice (office-tv-mode, trade-scenes), 3003 twice (scene-layout-lab, issue-285). Main checkout: none (3000) |
| Git config | repo `.git/config` | `extensions.worktreeConfig` unset, so `branch.<b>.*` keys are shared by every worktree. Verified on a scratch repo: `git branch -m` carries them over, `git branch -D` removes them |

## Not in this spec, and why

- **Item 1, one draft PR per lane.** A practice the lane sessions follow now and `/lane-open` encodes later.
- **Item 2, agents verify on previews.** Needs parent Task 1 Step 4 (Preview database audit: the test sign-in route mints a session in whatever database the preview uses) and Step 7 (preview protection + automation bypass), plus `DEV_LOGIN_SECRET` in Vercel Preview (board setup item). It does not need Task 12: agents sign in through the test route; only Oliver's Google sign-in on a preview waits for the proxy.
- **Item 9, live GitHub/Vercel data on the board.** Vercel is connected on claude.ai; GitHub is not. Wired only after Oliver connects GitHub and the real tool names are read from the `mcp` capability.

## F1. Review slot (R3) · KEPT

One extra worktree, `.worktrees/review`, always detached. Oliver's hands-on dev server runs there. Lane worktrees may still run one when Oliver chooses (ruling 2026-11-18); the slot is the default, not a lock.

**Command.** `pnpm review <branch | worktree folder>` (`"review": "tsx scripts/review-slot.ts"` in `package.json`, the repo's usual way to run a tool script), run from any checkout. The script lives in the repo, not in the slot, because the slot holds lane commits that may not contain it.

**Behaviour, in order:**

1. **Resolve the branch.** From `git worktree list --porcelain`: an argument that is a branch is used as given; otherwise it is matched against the worktree folder names (`data-views` → `.worktrees/data-views` → its branch). No match → exit 1 listing the worktrees and their branches. (No lane ids: the registry is deferred with F4.)
2. **Target.** sha = `git rev-parse refs/heads/<branch>` (all worktrees share refs, so unpushed commits count). The lane's worktree path comes from `git worktree list --porcelain`, never from a naming guess.
3. **Refuse a dirty slot.** `git status --porcelain` in the slot not empty → print the files, exit 1. Never discard Oliver's edits.
4. **Move.** `git -C .worktrees/review checkout --detach <sha>`. The slot is no agent's tree; moving it is its purpose.
5. **Packages.** `git config lanes.reviewInstalled` holds the hash of `package.json` + `pnpm-lock.yaml` at the slot's last *successful* install (git config, so no new ignored file). The hash differs from the target's → install is needed. If the slot's port answers (`ss -ltn`), refuse: "stop the dev server, then run `pnpm review <branch>` again" (an install under a running server corrupts `.next`). Otherwise `pnpm install --frozen-lockfile`, and write the hash only when it exits 0, so a failed install is retried next time.
6. **Env.** The slot's `.env.local` is rebuilt each run from the main checkout's `.env.local` (secrets, overrides, `DEV_LOGIN_SECRET`) with two lines set by the script: `PORT=<slot port>` and `DATABASE_DEV_URL=`:
   - the lane worktree's `DATABASE_DEV_URL` when its `.env.local` has one (the lane's Neon copy);
   - otherwise the main checkout's `DATABASE_DEV_URL` (shared dev; after parent Task 8 it lives in the main checkout's `.env.local`).
   - Neither found → exit 1. The slot never runs without an explicit dev URL, because `db/index.ts` would fall back to prod.
   - `NEON_BRANCH_ID` is never copied: `wt:db delete` in the slot would delete the lane's copy.
   - The URL is never printed; the script names the branch it chose ("lane copy" or "shared dev").
   - A lane that changes `src/shared/db/schema/` or `src/shared/constants/enums/` against `origin/main` (three-dot diff) but has no copy → warn: "this lane changes the schema but runs on shared dev; its pages may fail".
7. **Print** one block: branch, sha + subject, slot URL, database chosen, and either "hot reload picks it up" or "restart the dev server (only you start it)". A database change adds "you will be signed out: sessions live in the database".

**Port.** 3001 (Q1, answered 2026-11-18). The script writes `PORT=3001` into the slot's `.env.local` itself, so it never needs to read the port back and `getPort()` stays unchanged.

**One-time setup (board setup items, each waits for Oliver).** `git worktree add --detach .worktrees/review origin/main`, `pnpm install`, a copy of `.env`, first `pnpm review` run to write `.env.local`.

**DB fallback today.** Until parent Task 8, the shared dev URL lives in the main checkout's `.env`, not `.env.local`. So the order is: lane `.env.local` → main `.env.local` → main `.env`; whichever answers is written into the slot's `.env.local` explicitly.

**Tests.** Pure decisions in `scripts/lib/review-slot.ts`: `resolveBranch(worktrees, arg)` (not `resolveTarget`, which `scripts/neon-refresh.ts:33` already uses), `installNeeded(stamp, target)`, `slotEnvLocal(mainEnvLocal, laneEnvLocal, port)`, `schemaChanged(paths)` (one helper, shared with F3 later). Covered by `scripts/verify-review-slot.ts` (`node:assert/strict`, one ✅ line). The git and file side is run by hand once with Oliver.

## F2. Dev server sleeps after 5 idle minutes (R0) · KEPT

`scripts/dev.mjs`: default `DEV_IDLE_MIN` 30 → 5 (constant and header comment); fix its 20 eslint errors in the same PR (`pnpm exec eslint scripts/dev.mjs`, since `pnpm lint` skips `scripts/`; the other `scripts/lib/*.mjs` files have errors too and stay out of scope). `CLAUDE.md`: Commands line `(30)` → `(5)`, and the "Board / issues" line moves status to the lane board (GitHub project stays the backlog). Cost: ~15 s wake plus compile after a 5-minute gap.

## F3. `preview/today` (R3) · DEFERRED: needs parent Task 11

Kept here so the stress-test findings are not lost when it comes back:

- Name it `chore/preview-today` (branch types rule; Neon would otherwise name its copy `preview/preview/today`).
- Exclude a lane whose three-dot diff against `origin/main` touches `src/shared/db/schema/` or `src/shared/constants/enums/` until each preview has its own database. On 2026-11-15 that excluded five of nine lanes.
- Combine with `git merge-tree --write-tree` (no temp worktree, no scratch dir in the repo); publish only when at least one lane merged.
- Publish by deleting the remote branch and pushing it fresh (no force-push); each publish is an outward action Oliver approves until a ruling says otherwise; then read the Vercel build state, never assume it built.

## F4. Lane registry and the session hook (R4) · DEFERRED: finding the row by `branch` works today (K3); the registry needs the B1 grill

**Gate:** before this is built, a short grill with Oliver on how the git setting works in worktrees (ruling 2026-11-18). The facts below are verified; the grill decides whether they are enough.

**Registry.** Git config in the repo's shared `.git/config`:

```
[lanes]
    board = https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS
    reviewLane = data-views
    reviewSha = a6548d2
[branch "feat/data-views"]
    lane = data-views
    laneTracker = docs/plans/2026-10-12-data-views-epic.md
```

- Every worktree reads the same keys (no `extensions.worktreeConfig` in this repo).
- Set with `git config branch.<b>.lane <id>`; renaming the branch carries it, deleting the branch removes it. No file to keep in step, no stale entry after a branch is gone.
- A lane with no branch yet (`dev-flow`, `meta-ads`) has no key; the hook says so.
- Seeded at build time from the board's `lanes` rows (`branch` → `id`, `brief.tracker`), each key shown to Oliver first.

**Hook.** `~/.claude/hooks/lane-context.sh` is rewritten:

- Active only where `git config lanes.board` is set (paths via `git rev-parse --path-format=absolute`). Replaces the hardcoded repo path; silent in every other repo.
- On `main` → silent.
- At the review slot path → "This is the review slot, showing lane X at sha. Oliver's hands-on view: do not commit here."
- Branch with a `lane` key → lane id, tracker path, board URL, and the steps: load `ArtifactData`; `get lanes/<id>`; then by `source`:
  - `startup` or `clear`: stamp `session {id, started, lastSeen, cwd}`, pinned with `if_version`.
  - `resume` or `compact`: update `session.lastSeen` only.
  - On each real change of stage, next step or whose move it is, update `stage`, `next`, `move`, `updated`, `session.lastSeen`. One write per change, never per turn.
- Branch without a key → "No lane is registered for `<branch>`. Ask Oliver before adding a board row and a registry key."

**Tests.** `~/.claude/hooks/test-lane-context.sh` builds a scratch repo and pipes six fixtures (main, registered branch × startup, registered branch × resume, unknown branch, review slot, a repo without `lanes.board`) into the hook, comparing each output.

## F5. `/orient` and `session-capture` copy the status block to the lane row (R4) · DEFERRED: visibility tooling waits for a felt need

The status block stays in the tracker file (ruling 2026-11-18) and is copied:

- **Which lane:** the `lane` key of the current branch. On `main`, every lane whose `laneTracker` equals the file being oriented on (`trade-scenes` and `scene-lab` share one tracker; both get the brief).
- **What:** `brief.statusBlock {stage, done, next, open, blocked}`, `brief.phases[{id, name, status}]`, `brief.decided[{date, text}]` (the rulings table), `briefAt`. Pinned with `if_version`; a clash means re-read and redo.
- **What not:** the row's top-level `stage`, `next`, `move`. Those are shipping state the plan's block does not know; the lane session owns them (F4).

`/orient`: `.claude/skills/orient/REFERENCE.md` §Write-back gains the step between Status block and Memory, and the `SKILL.md` allowlist line gains the lane row. Its own small PR, stacked on #289.

`session-capture` (user-level, edited in place, no PR): the step runs only when `git config lanes.board` is set, so other projects are untouched; if `ArtifactData` cannot be loaded it says so in its summary and skips, never fails the capture.

## F6. Board redesign (R4) · DEFERRED: visibility tooling waits for a felt need; live GitHub/Vercel data waits for the GitHub connector too

Built on the published v5 page, read back with the `Artifact` read action at build time. The data model stays; only the page changes.

- **Map (first view).** Live lanes (stage ≠ shipped) as nodes: name, stage chip, who has the move (you · agent · parked). Solid arrow = builds on (`stackedOn`), dashed = waits on (`blockedBy`), with the `blockReason` line under a blocked node. Columns by stage, left to right. Under ~600 px: today's indented tree, same data.
- **Waiting on you.** PRs whose move is yours, open decisions, todo setup items, in that order.
- **Lane overview** (`#lane-<id>`): what it ships; phases with status; decisions made and open; facts grid (branch, worktree, port, Neon, tracker, orient page, PR, checks, preview, last commit); the linked session (`session.id`, last seen). Checks and preview come from row fields until item 9.
- **Requirements** view of the `requirements` collection: R0–R7, each item's status and source.
- **Reference tab:** bottlenecks, tools, skills, the flow diagram, the flow change log.
- **Less text.** A heading and at most one line under it.
- **States:** no live lanes; a lane with no session yet; a lane with no tracker; db read failure; a pinned write refused (re-read, show the newer value). A fixture set of lane rows covering each, rendered before it is called done.

Built under the `artifact-design` skill; screenshots at phone and desktop width, light and dark.

## F7. Env flow: Doppler + Vercel (R6) · DEFERRED: its own design, brainstorm B4

Placeholder until B4: shared env variables come from Doppler, synced to Vercel; per-worktree overrides stay local. It touches parent Tasks 1, 7, 8 and 13 and the no-prod-credentials-on-the-laptop rule.

## F8. Dev flow terms in `CONTEXT.md` (R7) · DEFERRED: Oliver sees and agrees each term first

A `## Dev flow terms` block, each term agreed by Oliver after he sees it in use. Draft terms: **Lane**, **Lane stage** (the board's shipping stage, distinct from a plan's **Stage**), **Review slot**, **Lane preview**, **Lane registry**. Two existing entries change: Pipeline **Stage**'s Avoid list names "lane" (kanban column) and gains a pointer to the dev flow sense; Planning **Stage** gains "not the lane stage". `CONTEXT.md` merge rule (ruling 2026-11-14): reconcile duplicates and out-of-order entries first.

## Brainstorms, all after the lean cut has run 1–2 weeks

- **B1. Registry grill** (gates F4 build, not the plan).
- **B2. Stable lane addresses** (req 2.2). Google sign-in is pulled forward as K4; the rest waits. Each lane's preview needs an address vendors accept: Vercel's branch alias is stable per branch, but Google rejects wildcard redirect URIs (parent Task 12's proxy), `publicUrl()` advertises one shared address to QStash, Twilio, Resend and calendar links, and Twilio numbers point at one webhook each. Several local servers stay possible; their ports must be unique (3002 and 3003 are claimed twice today).
- **B3. Epic branch: keep or dispose** (req 1.1). One draft PR per worktree, shipped in slices, against worktrees as disposable per slice.
- **B4. Doppler + Vercel** (F7).

## Failure modes this design must handle

1. **The slot has Oliver's unsaved edits** → refuse, list them (F1 step 3).
2. **An install while the server runs** → refuse, ask Oliver to stop it (F1 step 5).
3. **A failed install** → stamp unchanged, retried next run.
4. **No dev URL anywhere** → exit 1; the slot never falls back to prod (F1 step 6).
5. **The lane's Neon copy is asleep or deleted** → slow first request, or a connection error; the script printed which database it chose.
6. **Registry and board disagree** (a row renamed, a key not set) → the hook says "not registered" instead of guessing; the board stays the truth for status.
7. **Two sessions write the same lane row** → every write pinned with `if_version`; the loser re-reads.

## Answered questions

- **Q1 (2026-11-18).** The review slot takes port 3001.
- **Q2 (2026-11-18).** One PR `chore/dev-flow-foundation` with F1 + F2 + the `CLAUDE.md` lines, stacked on #289; parent Task 12 (K4) as its own PR off `origin/main`.
