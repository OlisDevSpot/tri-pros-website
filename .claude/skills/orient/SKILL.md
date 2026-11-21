---
name: orient
description: Use when the owner says "/orient", "where are we with <plan>", "orient me on <epic>", "what did we leave half done", "recap this plan", "pick up <plan> again", "what's the state of <epic>", "what was this plan about", or before resuming any plan or epic tracker under docs/plans or docs/superpowers. Verifies the plan against the tree and git, shows one lean page, asks the owner the decisions only they can make, and writes the rulings and a structured status block back.
---

# Orient

A plan's requirements usually outlive its tasks. `/orient` shows the owner the **verified delta** between what a plan intended, what the tree and git show was done, and what moved underneath it since, then puts the owner in the decision seat. It is read-only toward app code. It never rewrites a plan or spec, never recommends in place of asking, and never ends with "proceed with task 4". The owner decides ordering, re-planning, retiring requirements and dispatch; the skill supplies evidence and options.

The reading side lives here. The hand-off from a hot session is `session-capture`, which writes the same status block at session end so `/orient <path>` is the successor's whole prompt. There is no hand-off mode in this skill.

## Inputs

| Input | Behaviour |
|---|---|
| nothing | Cold start: list lost plans per [REFERENCE.md §Cold-start ranking](REFERENCE.md#cold-start-ranking), at most ten, and ask the owner to pick one. |
| a path to a tracker, spec or plan | Orient at the altitude the file implies: tracker = epic, plan or spec = plan. |
| words ("the energy impact thing") | Grep `docs/plans`, `docs/superpowers/specs`, `docs/superpowers/plans` and the memory `MEMORY.md` index for the phrase; not the roadmap, which costs half a minute and adds nothing before a pick. List the matches trackers first, then standalone plans and specs, parked work last, each with its status line and last-moved date (git date, or the file's mtime when untracked). A time hint ("last week") narrows the list to files that moved in that window. Ask for a pick. Never open one on your own, even when one match looks obvious. |

"Lost", "half done" and "what were we doing" mean **lost plan files**, not lost git objects. No reflog, no `fsck`, no stash archaeology, no worktree sweep. Candidates are plan files, and the cold-start list verifies nothing.

Resolution climbs from whatever was given: plan → spec (the plan's header) → tracker row (the plan's header, or a grep for the plan path under `docs/plans/`) → memory `project-*` file (the `MEMORY.md` index) → roadmap node (title match). A missing link is fine; a standalone plan has no tracker and the page says so.

## Workflow

Copy this checklist into the todo list and work it in order.

1. **Resolve and confirm in one line**: `Orienting on <path> · <plan|epic> altitude · ref <ref>`. A wrong resolution must cost the owner one word, so nothing is read deeply before this line.
2. **Read the checkpoint and only the allowed sources** ([§Speed discipline](REFERENCE.md#speed-discipline)): the target's status block, the plan, the spec's decision list, the tracker's rulings table and open questions, the one memory file the index marks "READ before" for this area, and the roadmap's answered `decisions` and `edits` for the node. Not the whole tracker, not the named files.
3. **Run the three checks** against the one named ref ([§Checks](REFERENCE.md#checks)): tasks against the tree, plan against git since the baseline, requirements against the delta. Every verdict carries `verified` or `inferred`. Plan altitude runs all three on the target; epic altitude runs checks 1 and 2 on every child with a plan and check 3 only on a child with divergence or an open ruling.
4. **Build the page** from the matching template and publish it to the target's existing URL, or a new one on first run ([§Pages](REFERENCE.md#pages)). One screen. Detail goes in the page's evidence, not in chat.
5. **Show the link and Claude's calls**: the page URL, then the choices the code settled, one line each. No narrative recap in chat; the page is the recap.
6. **Ask the decision sheet**, one item at a time through `AskUserQuestion`, recommended option first, at most four items, only from the four fixed categories ([§Decision sheet](REFERENCE.md#decision-sheet)). Anything the code can settle is not asked; housekeeping such as committing or deleting docs is not a decision item and goes under Claude's calls or Open.
7. **Write back** ([§Write-back](REFERENCE.md#write-back)): a dated ruling row per answer in the owner's words, the regenerated status block ([§Status block](REFERENCE.md#status-block)), the memory pointer line.
8. **Say what changed in one line and stop.** Building, re-planning or stress-testing is a new instruction from the owner.

## Altitudes

**Plan altitude** (a plan or spec, or a child picked from an epic): the three checks on that plan, deep. The page places the plan in its parent epic in one or two lines: which siblings it waits on and which wait on it, from the tracker's relation notes and shared files.

**Epic altitude** (a tracker): the overview of what was done, what is in flight and what comes later, across every child, with the relations between them. A **child** is a plan file where one exists, else a phase row in the tracker with no plan yet; plan-less phases land in Ahead at stage `brainstorm` or `spec`, unverified. The reader looks at the whole, not at tasks. A child that looks wrong gets one line and an offer to drop to plan altitude. The two altitudes are never mixed in one pass.

## Rules

- **Agent reasoning, ordinary tool calls.** `ls`, `grep`, `git log`, `git ls-tree`, `git grep <ref>`, `git diff --stat`, reads. No helper script lives in or beside this skill.
- **One named ref per run**, through `git ls-tree` and `git grep <ref>`; no checkout, and another session's worktree is never entered. `shipped` means reachable from `origin/main`; `built` means on the named ref only.
- **Read-only toward app code.** The edit allowlist is exactly: the status block of the tracker and of every plan oriented on; the tracker's rulings table, or the plan's `## Rulings` table when there is no tracker; the memory `project-*` pointer line. The spec is never edited. Nothing else, including other sessions' uncommitted files, is touched or offered for commit.
- **Checkboxes and status lines are read, never trusted.** A task is `done` only with a path, grep hit or commit seen in this run.
- **Stale references are reported, never worked around**: `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y`.
- **Budget**: about two minutes of wall time for a plan. Accuracy outranks speed, and a verdict the run cannot verify is tagged `inferred` rather than researched for five more minutes. Subagents only when a plan has more than about twelve tasks, then at most three in parallel, read-only, each returning its slice of the task table.
- **Lean output.** Chat carries the confirmation line, the link, Claude's calls, the questions and the closing line. Everything else belongs on the page or in the status block.
- Never `pnpm build`, never DB writes, never commits of app code. A tracker edit may be committed by explicit path when the owner asks.
