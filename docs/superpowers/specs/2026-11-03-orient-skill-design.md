# `/orient` — plan and epic orientation skill

> **Status:** design written 2026-11-03 from the owner's grill session; builder check done the same day (five questions, settled as Claude's calls in §10); owner answered Q1 and Q2 the same day (§10); **design APPROVED pending the owner's read of §10 calls**; next step `superpowers:writing-plans`; nothing built.
> **Owner's words:** "help me recap and orient myself in what this plan is about, what it's part of, what we have done so far, and where we are going with it … so that I can be part of the decision-making process without simply telling you to proceed with the recommendation."

## 1. Intent

Plans in this repo are Markdown files: epic trackers under `docs/plans/`, specs under `docs/superpowers/specs/`, implementation plans under `docs/superpowers/plans/`. Several are in flight at once. A plan gets brainstormed, specced, planned, sometimes half built, and then the owner moves on. The code diverges. When the owner returns, the plan's requirements and rulings are usually still right, but its tasks, paths and ordering no longer match the tree. Today the owner asks a session "where are we with this?", gets a paraphrase of the file, and is handed one recommendation.

`/orient` replaces that with a **verified delta**: what the plan intended, what the code and git show was actually done, and what moved underneath it since. It puts that in front of the owner as one lean visual page, asks the handful of decisions only the owner can make, and writes the answers back into the tracker so the next session starts from them.

Orientation is the **reading** side. Writing a hand-off for a successor session is a separate process and belongs to the existing `session-capture` skill (§8). The two meet at one shared artifact: the tracker's structured status block (§7).

## 2. Goals, non-goals, anti-goals

**Goals**
- A cold start on any plan or epic in about two minutes of wall time, accurate enough to act on.
- Every status claim backed by evidence from the tree or git, and tagged `verified` or `inferred`.
- The owner decides ordering, re-planning, retiring requirements and dispatch. The skill never substitutes a recommendation for those decisions.
- One lean visual page per plan or epic, the register of the roadmap and DCO artifacts: glanceable, no essay.
- A durable checkpoint in the tracker, so the next run only re-verifies what moved.

**Non-goals**
- Rewriting a plan or spec. A stale plan is handed to `stress-test-plan` or a re-plan on the owner's say-so.
- Portfolio views across every epic. That is the living roadmap artifact.
- Writing the hand-off from a hot session. That is `session-capture`.
- Replacing GitHub issues. The owner intends to move to an issue tracker later; this skill works on the Markdown files that exist now.

**Anti-goals (failure even if it "works")**
- A five-to-ten-minute cold start. Accuracy outranks speed, but "99% in two minutes beats 100% in five" (owner).
- A wall of text. If the owner has to read a block of prose to find the stage, the page failed.
- A status that trusts checkboxes or status lines without checking the tree.
- Ending with "I recommend task 4" and no decision sheet.
- Silent guesses. A choice the skill makes is listed as its call; a choice the owner must make is asked.

## 3. Constraints

- Agent reasoning with ordinary tool calls (`ls`, `grep`, `git log`, reads). **No helper script** for the checks (owner ruling 2026-11-03). Speed comes from discipline about what is read, not from automation.
- Read-only toward app code. The only files the skill edits are: the status block of the tracker and of every plan it orients on; the rulings table of the tracker, or of the plan when there is no tracker (added under `## Rulings` the first time, same three columns); and the memory `project-*` pointer line. The spec is never edited.
- Never `pnpm build`, never DB writes, never commits of app code. It may commit the tracker edit by explicit path if the owner asks.
- Respects the repo's working principles: the code is the source of truth; stale references are flagged as `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y`, never worked around.
- Lives at `.claude/skills/orient/` (project skill, like `pre-ship` and `stress-test-plan`), because it depends on this repo's tracker and plan conventions. `CLAUDE.md` gets one address-book line.

## 4. Invocation and target resolution

One command, `/orient`, with an optional argument. No sub-commands.

| Input | Behaviour |
|---|---|
| nothing | **Cold start.** List candidate lost plans (§4.1), ask the owner to pick one. |
| a path to a tracker, spec or plan | Orient on it at the altitude the file implies (tracker = epic, plan or spec = plan). |
| words ("the energy impact thing") | Grep trackers, specs, plans, the memory index and roadmap node titles for the phrase. Show matches with their status lines; ask the owner to pick. Never guess on an ambiguous match. |

In every mode the first thing the owner sees is **one line** confirming the target and altitude, so a wrong resolution costs one word.

Resolution climbs the chain from whatever was given: plan → spec (from the plan's header) → tracker row (from the plan's header or a grep for the plan path in `docs/plans/`) → memory `project-*` file (from the `MEMORY.md` index) → roadmap node (title match). Missing links are fine: a standalone plan has no tracker and says so.

### 4.1 Cold-start candidate list

A plan is a candidate when it is under `docs/superpowers/plans/` or `docs/plans/` and any of: its status block says a stage before `shipped`; it has no status block at all; the newest commit touching a file it names is newer than the newest commit touching the plan file itself. Rank by the gap between those two dates, largest first. Show at most ten, each as: path, stage, last plan edit, last code movement. This list is built from `git log` dates and header reads only, no deep reads.

## 5. The verification (plan altitude)

Three checks, always all three, never deeper. The baseline is the status block's `Verified at` commit when present, else the tracker's `Baseline` line, else the plan file's first commit.

**Which tree.** This repo runs many worktrees and several plans are built only on a branch. Every check runs against one named ref: the `Built on` ref in the status block, else the branch the tracker names for that plan, else the current worktree's HEAD. Existence and export checks use `git ls-tree` and `git grep <ref>` so no checkout happens and another session's worktree is never touched. `Verified at` records `ref@sha`. `shipped` means reachable from `origin/main`, which is prod under the worktree-PR flow; `built` means on the named ref but not on `origin/main`. A baseline SHA unreachable from the named ref (a squash merge happened) falls back to the plan file's first commit and says so.

1. **Tasks against the tree.** For each `### Task N` in the plan: do the files it names exist, do the exports, tables, columns, components or constants it names exist (one `grep` per name). Verdict per task: `done`, `partial`, `not started`, with the evidence (path or grep hit) in the row. Checkboxes in the plan are read but never trusted alone.
2. **Plan against git.** `git log --oneline <baseline>..HEAD -- <every file the plan names>`. Group commits into: made by this plan's tasks (message or files match a task), and made by something else. The second group is the **divergence list**.
3. **Requirements against the delta.** For each spec decision or requirement ID (D1, K7, EI-D12, M3…) and each owner ruling in the tracker: `still holds`, `holds, path stale` (the requirement stands but the plan's tasks to reach it no longer match the tree), or `invalidated` (a newer ruling, in the tracker, memory or roadmap `decisions`, or a shipped change contradicts it). Evidence per verdict.

Every verdict carries `verified` (a path, grep hit or commit was seen) or `inferred` (judged from names and messages only).

### 5.1 Speed discipline

- Read the plan, the spec's decision list and the tracker's status block, rulings table and open questions. Do not read the whole tracker.
- Read **diffs, not files**: `git show --stat` and `git diff <baseline>..HEAD -- <file>` for the divergence list only. Never read a file the plan names in full unless a verdict cannot be reached otherwise.
- Read the roadmap's `decisions` (answered) and `edits` for the node only; these are owner rulings that may be newer than the tracker.
- Memory: read the `project-*` file the index marks "READ before" for this area, nothing else.
- Subagents only when the plan has more than about twelve tasks; then at most three in parallel, each owning a slice of the task list, each returning the task table rows for its slice. Small plans run inline.
- The checkpoint makes repeat runs cheap: a tree that has not moved since `Verified at` needs only check 3 against new rulings.

## 6. Altitudes

**Plan altitude** (plan or spec given, or a child picked from an epic): the three checks on that plan, deep. Places the plan in its parent epic in one or two lines: which siblings it waits on, which wait on it, from the tracker's relation notes and shared files.

**Epic altitude** (tracker given): the overview. What was done, what is in flight, what is planned ahead, across every child, with the relations between them. A **child** is a plan file where one exists, else a phase row in the tracker (EI3–EI6 style) with no plan yet; the latter land in **Ahead** at stage `brainstorm` or `spec`, unverified, since there are no tasks to check. Children with a plan and not marked shipped get checks 1 and 2 (cheap); check 3 runs only on a child that shows divergence or an open ruling. Relations come from the tracker's phase prose and `Blocked`/`Next` lines plus files shared between plans. The reader looks at the whole, not at tasks. A child that looks wrong gets one line and an offer to drop to plan altitude.

The two altitudes are never mixed in one pass.

## 7. The status block (shared with `session-capture`)

Every tracker today carries a `> **Status:**` paragraph. `/orient` replaces it, the first time it touches a tracker, with a short structured block and rewrites that block at the end of every run. **Every plan file gets its own block** under its title as well, so a plan-altitude run on child B never overwrites the checkpoint of child A or of the epic: the tracker's block is the epic-altitude checkpoint and each plan's block is its own. The `> **Goal:**` and `> **Design:**` sibling lines stay. Old trackers and plans keep their paragraph until touched; no migration sweep.

```md
> **Status**
> - Stage: plan · stress-tested 2026-10-22
> - Built on: `feat/proposal-energy-impact` · Verified at: `feat/proposal-energy-impact@abc1234` (2026-11-03) · page: https://claude.ai/artifact/…
> - Done: EI0 lift; customer_utility_bills table
> - Next: EI1 sliders → EI2 chapter shell (EI1 first: EI2 reads its hook)
> - Open: Q-L (owner) · EI0 cool-roof fold (scenes branch)
> - Blocked: EI0 on feat/trade-scenes-foundation
```

Rules: one line per field, no sentences longer than a line, IDs over prose, dates on stage and verification. `Stage` vocabulary is one of `brainstorm · spec · plan · building · built · shipped` plus a qualifier (`stress-tested`, `awaiting iPad check`, `unmerged`). Owner agreed these six words 2026-11-03; `CONTEXT.md` gets them when the skill is built. The block is the checkpoint `/orient` reads first and the hand-off `session-capture` writes last.

## 8. Relation to `session-capture`

`session-capture` (user-level skill, `~/.claude/skills/session-capture/`) already routes "a pending design or plan" to the plan file and its tracker. It gains **one line**: when the session worked on a plan or epic in a repo that has an `orient` skill, write that tracker's status block in the shape `orient`'s reference defines. That is the whole hand-off. The successor's prompt becomes `/orient <path>`. No `/orient handoff` mode exists.

## 9. The page and the decision sheet

One page per plan or epic, republished to the **same URL** each run; the URL lives in the status block. The page is built from the `visual-explainer` kit (installed at `~/.claude/skills/visual-explainer/`) with the generic renderer `kit/render.mjs` and the layout below, not the claim-tree plan page (`plan/render.mjs` requires a `<ve-plan>` claim tree, which is the wrong shape here). `references/plans.md` is consulted only for the evidence and `<ve-ask>` conventions. The rendered self-contained HTML is published as a claude.ai Artifact so it opens on any device and keeps its URL; in a session without the Artifact tool the skill opens the local rendered file and writes that path in the status block instead, flagged as local. Not the roadmap artifact: the roadmap is a bulk-refreshed portfolio view; `/orient` reads its rulings and never writes there.

**Plan page, one screen:**
- Header: eyebrow with the epic name, title = the plan, lead = two sentences of what and why lifted from the spec.
- Stage ribbon: the six stages with the current one lit and the date.
- Task strip: one chip per task, `done / partial / not started`, hover or tap shows the evidence.
- Three columns: **Decided** (rulings, IDs only, newest first), **Open** (questions and blockers), **Stale** (invalidated or stale-path requirements and the divergence list, each with its commit).
- Decision sheet (below).

**Epic page, one screen:**
- Header as above, title = the epic.
- Three lanes: **Done · In flight · Ahead**, one chip per child plan with its verified one-liner.
- Relations: a small flow of children with blocking edges, parallel-safe children grouped.
- Decision sheet.

**Decision sheet.** At most four items, fixed categories: which next step and in what order; whether a stale task is re-planned or dropped; whether an invalidated requirement is retired or re-argued; which sibling (epic altitude: which children run next, in parallel or not). Each item is a question with the real options and what each costs or unblocks. Anything the code can settle is settled by the skill and listed under "Claude's calls", never asked. The owner answers through `AskUserQuestion`, one item at a time, recommended option first; the page shows the same items so the owner reads the picture while answering (owner ruling 2026-11-03: in the session, not pasted from the page).

**Write-back.** Each answer becomes a dated row in the tracker's rulings table, in the owner's words, with the next free ID in that tracker's series (EI-D26, R232, …). The status block is regenerated from the verified state plus the new rulings. The memory `project-*` file's one-line status is refreshed. Then the skill says in one line what changed and stops; building or re-planning is a new instruction.

## 10. Left to the builder, and open owner questions

**Settled after the builder check (Claude's calls, 2026-11-03)**
- One named ref per run, `git grep`/`git ls-tree` without checkout, `shipped` = on `origin/main` (§5).
- Epic children = plan files, plus plan-less phase rows shown in Ahead unverified (§6).
- A status block in every plan and in the tracker; each is its own checkpoint (§7).
- Rulings with no table: a `## Rulings` table is added to the tracker, or to the plan when there is no tracker; the spec is never edited (§3, §9).
- Generic kit renderer with the §9 layout; `<ve-ask>` for the sheet (§9).
- The `session-capture` edit is a second, out-of-repo change made in the same build.

**Builder's calls**
- Exact grep patterns for exports per layer (table, column, DAL function, tRPC procedure, hook, component, constant).
- How the page's register and tokens map onto the kit (`DESIGN.md` is for app surfaces, not required here; the DCO and roadmap artifacts are the visual reference).
- The subagent brief for large plans.
- Where the rendered source lives (`~/.agent/diagrams/orient-<slug>.src.html` per the kit's default is acceptable).
- The rank formula details for §4.1 beyond "largest date gap first".

**Owner rulings 2026-11-03**
- Q1 Stage vocabulary (§7): `brainstorm · spec · plan · building · built · shipped`.
- Q2 Decision mechanics (§9): answers in the session through `AskUserQuestion`, one at a time; the page only shows the sheet.
