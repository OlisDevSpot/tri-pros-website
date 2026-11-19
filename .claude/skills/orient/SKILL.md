---
name: orient
description: Use when the owner says "/orient", "where are we with <plan>", "orient me on <epic>", "what did we leave half done", "recap this plan", "pick up <plan> again", "what's the state of <epic>", "what was this plan about", or before resuming any plan or epic tracker under docs/plans or docs/superpowers. Applies the owner's answers from the ship board, verifies the plan against the tree and git, writes the lane's briefing and decisions to its page on the ship board, and writes the rulings and a structured status block back. `--dry` writes the would-be briefing to a file instead.
---

# Orient

A plan's requirements usually outlive its tasks. `/orient` finds the **verified delta** between what a plan intended, what the tree and git show was done, and what moved underneath it since, and writes it as the lane's **briefing** on the Parallel Ship Flow board: the lane's `brief` plus decision docs the owner answers on the page. The board draws it; there is no separate page. The skill is read-only toward app code. It never rewrites a plan or spec, never recommends in place of asking, and never ends with "proceed with task 4". The owner decides ordering, re-planning, retiring requirements and dispatch; the skill supplies evidence and options.

Board, schema, vocabulary and the apply-answers rules live in `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.claude/skills/ship-board/SKILL.md` (below: `<ship-board>`). Read it before the first board read or write. The hand-off from a hot session is `session-capture`, which writes the same status block at session end so `/orient <path>` is the successor's whole prompt.

## Inputs

| Input | Behaviour |
|---|---|
| nothing | Cold start: list lost plans per [REFERENCE.md: Cold-start ranking](REFERENCE.md#cold-start-ranking), at most ten, and ask the owner to pick one. |
| a path to a tracker, spec or plan | Orient at the altitude the file implies: tracker = epic, plan or spec = plan. |
| words ("the energy impact thing") | Grep `docs/plans`, `docs/superpowers/specs`, `docs/superpowers/plans` and the memory `MEMORY.md` index for the phrase; not the roadmap, which costs half a minute and adds nothing before a pick. List the matches trackers first, then standalone plans and specs, parked work last, each with its status line and last-moved date (git date, or the file's mtime when untracked). A time hint ("last week") narrows the list to files that moved in that window. Ask for a pick. Never open one on your own, even when one match looks obvious. |
| `--dry [<file>]` after any of the above | Steps 1 to 5 only, then the output in [Dry mode](#dry-mode). |

"Lost", "half done" and "what were we doing" mean **lost plan files**, not lost git objects. No reflog, no `fsck`, no stash archaeology, no worktree sweep. Candidates are plan files, and the cold-start list verifies nothing.

Resolution climbs from whatever was given: plan → spec (the plan's header) → tracker row (the plan's header, or a grep for the plan path under `docs/plans/`) → memory `project-*` file (the `MEMORY.md` index) → roadmap node (title match). A missing link is fine; a standalone plan has no tracker and the brief says so.

## Workflow

Copy this checklist into the todo list and work it in order.

1. **Resolve, confirm in one line, find the lane.** `Orienting on <path> · <plan|epic> altitude · ref <ref>`; a wrong resolution must cost the owner one word, so nothing is read deeply before this line. Then read `lanes` and match, first hit wins: `branch` equals the status block's `Built on`; else `brief.tracker`, `brief.plan` or `brief.spec` equals the path. More than one lane matches: ask the owner which. A matched lane with no `branch` gets it from `Built on`. No match: a new lane (name from the tracker or plan title, id the name slugged by [Board write](REFERENCE.md#board-write)'s new-lane rule, `branch` from `Built on` or `null`, `move: "agent"`, `stage` from the status block's Stage by brainstorm→idea, spec→spec, plan→plan, building→build, built→review, shipped→shipped), said in the closing line.
2. **Apply the owner's answers first**, by the "How to apply answers" section of `<ship-board>/SKILL.md` (which docs, ruling target order, which copy, the clean-file guard, closing the loop). Only docs whose `lane` is this lane; a doc with no `lane` is never applied by a lane run. Ruling IDs follow [Write-back](REFERENCE.md#write-back). In `--dry`, compute the ruling rows and patches; write nothing.
3. **Read the checkpoint and only the allowed sources** ([Speed discipline](REFERENCE.md#speed-discipline)): the target's status block, the plan, the spec's decision list, the tracker's rulings table and open questions, the one memory file the index marks "READ before" for this area, and the roadmap's decisions and edits for the node. Not the whole tracker, not the named files.
4. **Run the three checks** against the one named ref ([Checks](REFERENCE.md#checks)): tasks against the tree, plan against git since the baseline, requirements against the delta. Every verdict carries `verified` or `inferred`. Plan altitude runs all three on the target; epic altitude runs checks 1 and 2 on every child with a plan and check 3 only on a child with divergence or an open ruling.
5. **Compute the brief and the pictures' data** ([Brief](REFERENCE.md#brief), [Pictures](REFERENCE.md#pictures)): phases, areas, timeline, `builtOn`, collision pairs against every live lane, and at most four questions ([Questions](#questions)). Run `check-brief.mjs` on the result; fix every problem it prints.
6. **Write in one `ArtifactData` batch** ([Board write](REFERENCE.md#board-write)): the lane's `brief` and `briefAt`, its `stage` and `next` when the checks changed them, the decision docs, the collision pairs. Decision doc ids come from `LaneCore.docId`; open docs on the lane are compared by `ref` and by question text first, so an open question is updated, never added twice. Every write to an existing doc is pinned; a pinned write that fails is re-read and redone once. Then regenerate the status block in the lane's tracker copy, `page:` set to the lane's board URL ([Status block](REFERENCE.md#status-block)), and the memory pointer line ([Write-back](REFERENCE.md#write-back)).
7. **Close with one line and the lane link**: what changed, the lane created if any, `N waiting on you`. No `AskUserQuestion` by default; answers come from the page. When the owner says to answer in chat, ask with `AskUserQuestion` (one question at a time, recommended option first) and write each answer into the same decision doc, so the board stays the record. Building, re-planning or stress-testing is a new instruction from the owner.

### Dry mode

`--dry` runs steps 1 to 5, writes one JSON file and prints its path: the session's scratchpad directory by default, the path after `--dry` when given. It holds the would-be brief, decision docs, ruling rows and decision patches ([Dry output](REFERENCE.md#dry-output)), passes `check-brief.mjs`, and is the only file the run writes: no board, tracker or memory writes. Reads of the board are allowed.

## Questions

At most four decision docs per run, each from one of these categories, in this order of preference:

1. **Next step and order**: which task or child runs next, and what it must wait for.
2. **Stale task**: re-planned or dropped.
3. **Invalidated requirement**: retired or re-argued.
4. **Siblings and children** (epic altitude): which children run next, in parallel or in sequence.

Each is a `kind: "decision"` doc with two to four real options, each option's cost or unblock as its consequence, and `recommended` set. Something only the owner can verify (look at the iPad, check prod) is an owner check (`kind: "check"`) and does not count toward the four. Anything the code can settle is settled by the skill and goes in `brief.agent`, never asked. Housekeeping (committing, deleting or moving docs) is never a decision.

## Altitudes

**Plan altitude** (a plan or spec, or a child picked from an epic): the three checks on that plan, deep. The brief places the plan in its parent epic in one or two lines of `stand`: which siblings it waits on and which wait on it, from the tracker's relation notes and shared files.

**Epic altitude** (a tracker): the overview of what was done, what is in flight and what comes later, across every child, with the relations between them. A **child** is a plan file where one exists, else a phase row in the tracker with no plan yet; plan-less phases are phases at status `idea` or `spec`, unverified. The reader looks at the whole, not at tasks. A child that looks wrong gets one `watch` line and an offer to drop to plan altitude. The two altitudes are never mixed in one pass.

## Rules

- **Agent reasoning, ordinary tools.** `ls`, `grep`, `git log`, `git ls-tree`, `git grep <ref>`, `git diff --stat`, reads. No helper script lives in or beside this skill; the one exception is `<ship-board>/scripts/check-brief.mjs`, which only validates briefs and decision docs.
- **One named ref per run**, through `git ls-tree` and `git grep <ref>`; no checkout. Another session's worktree is never entered, except the rulings table and status block written under the apply rules' clean-file guard. `shipped` means reachable from `origin/main`; `built` means on the named ref only.
- **Read-only toward app code.** The edit allowlist is exactly: the status block of the tracker and of every plan oriented on; the tracker's rulings table, or the plan's `## Rulings` table when there is no tracker; the memory `project-*` pointer line; the `--dry` output file (scratchpad by default). The spec is never edited. Nothing else, including other sessions' uncommitted files, is touched or offered for commit.
- **Checkboxes and status lines are read, never trusted.** A task is `done` only with a path, grep hit or commit seen in this run.
- **Stale references are reported, never worked around**: `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y`, as a `watch` line and in chat.
- **Budget**: about two minutes of wall time for a plan. Accuracy outranks speed, and a verdict the run cannot verify is tagged `inferred` rather than researched for five more minutes. Subagents only when a plan has more than about twelve tasks, then at most three in parallel, read-only, each returning its slice of the task table.
- **Lean output.** Chat carries the confirmation line, any question about which lane, and the closing line. Everything else belongs in the brief or the status block.
- Never `pnpm build`, no app DB writes, never commits of app code. Board writes follow `<ship-board>/SKILL.md`. A tracker edit may be committed by explicit path when the owner asks.
