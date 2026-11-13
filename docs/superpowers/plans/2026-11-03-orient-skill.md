# `/orient` Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A project skill, `/orient`, that verifies a plan or epic tracker against the tree and git, shows the owner one lean page, asks the decisions only the owner can make, and writes the rulings and a structured status block back.

**Architecture:** Three files under `.claude/skills/orient/`: `SKILL.md` (trigger, inputs, workflow checklist, rules), `REFERENCE.md` (the status block shape, the three checks and verdict tags, the decision sheet, write-back, the two page layouts, the cold-start ranking), and two page templates in `templates/` rendered with the visual-explainer kit's generic renderer. Three one-line wirings: `CLAUDE.md`, `CONTEXT.md`, and the user-level `session-capture` skill. Skills are process documents, so each task's test is a pressure scenario run by a fresh subagent: baseline without the file, then with it (superpowers:writing-skills).

**Tech Stack:** Markdown skills (Claude Code project skills), the visual-explainer kit at `~/.claude/skills/visual-explainer/` (`kit/render.mjs`), git plumbing (`git ls-tree`, `git grep <ref>`, `git log`), the Artifact tool for publishing.

**Spec:** `docs/superpowers/specs/2026-11-03-orient-skill-design.md` (APPROVED 2026-11-03; §10 holds the owner's rulings and Claude's calls).

## Global Constraints

- The skill uses agent reasoning with ordinary tool calls. **No helper script** under the skill, no `scripts/` folder (spec §3, owner ruling 2026-11-03).
- The skill is read-only toward app code. Its edit allowlist is exactly: the status block of the tracker and of every plan it orients on; the tracker's rulings table, or the plan's `## Rulings` table when there is no tracker; the memory `project-*` pointer line. **The spec is never edited** (spec §3).
- Stage words, verbatim: `brainstorm · spec · plan · building · built · shipped` (spec §7, owner ruling).
- Decisions are asked through `AskUserQuestion`, one item at a time, recommended option first, at most four items (spec §9, owner ruling). The page shows the sheet; it never collects answers.
- Verification runs against one named ref per run through `git ls-tree` and `git grep <ref>`; no checkout, no touching another worktree. `shipped` = reachable from `origin/main`; `built` = on the named ref only (spec §5).
- Verdict tags are exactly `verified` or `inferred` (spec §5).
- Never `pnpm build`, never DB writes. Shared working tree on `main`: commit only as `git commit -m "…" -- <explicit paths>`; no `git add -A`, `.` or `-u`; no stash, checkout or reset. The Claude pre-commit hook takes about 110 s, so batch each task's files into one commit.
- Comments and prose say why, never what. No file banners. No new `DOCS.md`.
- Pressure-scenario subagents are read-only toward the repo and must be told so; before each commit check `git status` shows nothing they left behind.

## Review Focus

1. A plan task names a path that no longer exists (an `entities/` path that moved to `modules/`): the task row reads `not started · path gone` with the grep as evidence, and the run continues. Pinned in Task 1, scenario B.
2. The status block's `Verified at` SHA is unreachable from the named ref after a squash merge: the baseline falls back to the plan file's first commit and the page says so. Pinned in Task 2, step 4.
3. The tracker has no rulings table: a `## Rulings` table is added with `| # | Ruling | Date |`, and the ID series continues from the highest ID found anywhere in that tracker, never from 1. Pinned in Task 2, step 4.
4. Words match several targets: the candidates are listed with their status lines and the owner picks; the skill never opens one on its own. Pinned in Task 1, scenario C.
5. The Artifact tool is absent from the session: the local rendered file is opened and its path goes in the status block flagged `(local)`. Pinned in Task 3, step 5.

---

### Task 1: `SKILL.md`

**Files:**
- Create: `.claude/skills/orient/SKILL.md`
- Scratch: `<scratchpad>/orient-scenarios/A-cold-start.md`, `B-plan.md`, `C-words.md` (pressure prompts, not committed)

**Interfaces:**
- Consumes: nothing yet; cites `REFERENCE.md` sections by heading (Task 2 must create those headings: `## Status block`, `## Checks`, `## Speed discipline`, `## Decision sheet`, `## Write-back`, `## Pages`, `## Cold-start ranking`).
- Produces: the trigger phrases and the eight-step workflow every later task's scenario exercises.

- [ ] **Step 1: Write the three pressure prompts** in the scratch folder. Each tells a fresh general-purpose subagent it is a Claude Code session in this repo, read-only, and gives it one input exactly as the owner would type it:
  - A: `/orient` with nothing, and the sentence "I know we worked on something proposal-related last week and lost it."
  - B: `/orient docs/superpowers/plans/2026-10-23-proposal-scope-chapter.md`. The prompt also asks it to treat one task's named path as if it had moved (pick a real task; the subagent is told the path is `src/entities/...` instead of its true `src/shared/modules/...`), to exercise Review Focus 1.
  - C: `/orient the proposal thing` (matches at least the energy impact, scope chapter, editor, page redesign and applications files).
  Each prompt ends: "Stop before any file edit. Report what you showed the owner and what you would write."

- [ ] **Step 2: Run the baseline** (RED): dispatch the three prompts without the skill existing. Record in `<scratchpad>/orient-scenarios/baseline.md` the exact behaviours: did A list candidates or ask a vague question; did B paraphrase the plan or check the tree; did B trust checkboxes; did C pick a target on its own; did any end with one recommendation and no decision sheet. Expected: at least B paraphrases and ends with a recommendation, and C guesses.

- [ ] **Step 3: Write `SKILL.md`** in the house style of `.claude/skills/stress-test-plan/SKILL.md`. Frontmatter `name: orient`; `description` lists the triggers: "/orient", "where are we with <plan>", "orient me on <epic>", "what did we leave half done", "recap this plan", "pick up <plan> again", "what's the state of <epic>", and "before resuming any plan or epic tracker under docs/plans or docs/superpowers". Body sections, in order:
  1. One paragraph: the verified delta, read-only, the owner decides (spec §1 in six lines).
  2. **Inputs**: the three-row table from spec §4 and the climb chain; the one-line target confirmation is step 1 of the workflow.
  3. **Workflow**, "Copy this checklist into the todo list and work it in order", eight steps: resolve and confirm the target in one line · read the checkpoint and only the allowed sources (`REFERENCE.md §Speed discipline`) · run the three checks against the named ref (`§Checks`) · build the page from the template and publish (`§Pages`) · show the page link and the "Claude's calls" list · ask the decision sheet one item at a time (`§Decision sheet`) · write back (`§Write-back`) · say in one line what changed, and stop.
  4. **Altitudes**: spec §6 in two short paragraphs, with the child definition.
  5. **Rules**: the Global Constraints of this plan that bind the skill at run time, one line each, plus "a stale doc is reported as `⚠️ Stale ref — …`, never worked around" and "subagents only above about twelve tasks, at most three, read-only".
  Target length: under 120 lines. Every rule that needs a table or a shape lives in `REFERENCE.md`, not here.

- [ ] **Step 4: Run the scenarios with the skill** (GREEN): dispatch A, B and C again with "Follow `.claude/skills/orient/SKILL.md` and its `REFERENCE.md`" (Task 2's file may not exist yet; for this step a stub with the seven headings and the status block from spec §7 is acceptable and is replaced in Task 2). Expected: A lists at most ten candidates ranked and asks; B opens with the one-line confirmation, produces a task table with `done/partial/not started` plus evidence and a `verified/inferred` tag per row, marks the moved path `not started · path gone`, and ends with a decision sheet of at most four items, each with options; C lists the candidates with their status lines and asks. Record the run in `<scratchpad>/orient-scenarios/green.md`. Fix any loophole in `SKILL.md` and re-run only the failing scenario.

- [ ] **Step 5: Commit**

```bash
git -C /home/olis-solutions/olis-v3/nextjs/tri-pros-website commit -m "feat(skills): /orient skill entry point" -- .claude/skills/orient/SKILL.md
```

### Task 2: `REFERENCE.md`

**Files:**
- Create: `.claude/skills/orient/REFERENCE.md`

**Interfaces:**
- Consumes: the seven headings Task 1 cites.
- Produces: the status block shape (also consumed by Task 4's session-capture line) and the page section names Task 3's templates use (`stage`, `tasks`, `decided`, `open`, `stale`, `sheet`; epic: `lanes`, `relations`, `sheet`).

- [ ] **Step 1: Write `## Status block`**: the block from spec §7 verbatim as the example, then the field rules: one line per field; `Stage:` one of the six words plus an optional qualifier and date; `Built on:` a ref; `Verified at:` `ref@sha (date)`; `page:` a URL, or a local path followed by `(local)`; `Done`, `Next`, `Open`, `Blocked` as IDs and short phrases. Where it lives: directly under the title of every tracker and every plan, replacing the `> **Status:**` paragraph on first touch, keeping `> **Goal:**` and `> **Design:**` lines. Which block is the checkpoint for which altitude (spec §7).

- [ ] **Step 2: Write `## Checks`**: the three checks of spec §5 as three sub-sections, each with: inputs, the exact git form (`git ls-tree -r --name-only <ref> -- <path>`, `git grep -n -e '<name>' <ref> -- <path-or-dir>`, `git log --oneline <baseline>..<ref> -- <files>`, `git diff --stat <baseline>..<ref> -- <files>`), the verdict words, and the evidence column format (`path` · `grep hit file:line` · `sha`). The baseline rule and the unreachable-SHA fallback (Review Focus 2). The `shipped`/`built` definitions. The verdict tag rule: `verified` only when a path, grep hit or commit was seen in this run.

- [ ] **Step 3: Write `## Speed discipline`** (spec §5.1, one bullet each) and `## Cold-start ranking`: candidate rule and rank from spec §4.1, with the two git commands that give the dates (`git log -1 --format=%cs -- <plan>` and the newest `git log -1 --format=%cs <ref> -- <named files>`), cap ten.

- [ ] **Step 4: Write `## Decision sheet` and `## Write-back`**: the four fixed categories, "at most four items", the `AskUserQuestion` form (question, options, cost or unblock per option, recommended first), the "Claude's calls" list. Write-back: a dated row in the rulings table in the owner's words; the next ID = highest ID in that tracker's series + 1, where the series prefix is read from the existing table (EI-D, R, K, C …); when the tracker or tracker-less plan has no table, insert `## Rulings` with `| # | Ruling | Date |` after the status block, continuing from the highest ID found anywhere in the file (Review Focus 3); then regenerate the status block from verified state plus the rulings; then refresh the memory `project-*` file's one-line status; then one line in chat and stop.

- [ ] **Step 5: Write `## Pages`**: the plan page and epic page layouts from spec §9 as two section lists with the section ids above, the one-screen cap, the republish-to-same-URL rule, the Artifact fallback (Review Focus 5), and the render command: `node ~/.claude/skills/visual-explainer/kit/render.mjs <src> -o <out> --lint` with the source at `~/.agent/diagrams/orient-<slug>.src.html`.

- [ ] **Step 6: Verify the headings**

Run: `grep -c '^## ' .claude/skills/orient/REFERENCE.md && grep -o '§[A-Z][a-z -]*' .claude/skills/orient/SKILL.md | sort -u`
Expected: 7 headings, and every `§Name` cited by `SKILL.md` matches a heading.

- [ ] **Step 7: Re-run scenario B** from Task 1 with the real `REFERENCE.md`. Expected: same GREEN result, and the reported "would write" status block has every field from step 1 in order.

- [ ] **Step 8: Commit**

```bash
git -C /home/olis-solutions/olis-v3/nextjs/tri-pros-website commit -m "feat(skills): /orient reference: status block, checks, sheet, write-back, pages" -- .claude/skills/orient/REFERENCE.md
```

### Task 3: Page templates

**Files:**
- Create: `.claude/skills/orient/templates/plan-page.src.html`
- Create: `.claude/skills/orient/templates/epic-page.src.html`

**Interfaces:**
- Consumes: `REFERENCE.md §Pages` section ids; the kit tags from `~/.claude/skills/visual-explainer/references/kit.md` (`.chip ok|warn|risk`, `.kpis`, `.cases`, `<ve-flow>`, `.ve-table`) and `<ve-ask>`/`<ve-opt>` from `references/plans.md` for the displayed sheet.
- Produces: two source files the skill copies and fills; placeholders are `{{…}}` tokens the skill replaces.

- [ ] **Step 1: Write `plan-page.src.html`** with the kit marker (`<link rel="stylesheet" href="kit.css" data-ve-kit>`), register `instrument`, and these sections in order with the ids from §Pages: header (eyebrow `{{epic}}`, h1 `{{plan}}`, lead `{{what_why}}`, meta `{{stage}} · verified {{ref}}@{{sha}} {{date}}`); `#stage` a six-step `.ve-steps`-style ribbon with the current stage marked; `#tasks` a row of chips, one per task, class by verdict, `title` = evidence; a three-column grid `#decided` `#open` `#stale` each a compact `.ve-table`; `#sheet` listing the items as `<ve-ask>` blocks with a visible note "answer in the session". Fill the placeholders once with real values from `docs/superpowers/plans/2026-10-23-proposal-scope-chapter.md` so the render shows a real page.

- [ ] **Step 2: Write `epic-page.src.html`**: header as above with h1 `{{epic}}`; `#lanes` three `.cases` lanes Done · In flight · Ahead, one `.case` per child with its stage chip and one-line verified state; `#relations` a `<ve-flow>` of children with blocking edges labelled `blocks` and a boundary around the parallel-safe group; `#sheet` as in step 1. Fill once with the energy impact epic's EI0–EI6.

- [ ] **Step 3: Render both with lint**

Run: `for f in plan epic; do node ~/.claude/skills/visual-explainer/kit/render.mjs .claude/skills/orient/templates/$f-page.src.html -o /tmp/claude-1000/orient-$f.html --lint; done`
Expected: no `✗` lines; each page fits one 1440×900 viewport without scrolling when opened.

- [ ] **Step 4: Publish the epic page once as an Artifact** (title "Orient · Proposal Energy Impact", icon `map`) to prove the rendered file is self-contained; expected: the page renders at the URL with fonts, chips and the flow intact. Keep it: Task 5's real run republishes to this same URL, so the artifact becomes the epic's page and the URL goes in its status block. Record the URL in `<scratchpad>/orient-scenarios/urls.md`.

- [ ] **Step 5: Pin Review Focus 5**: add to `REFERENCE.md §Pages` the fallback sentence if Task 2 left it generic, and re-run scenario B with the instruction "the Artifact tool is unavailable in this session". Expected: the reported status block carries the local path followed by `(local)`.

- [ ] **Step 6: Commit**

```bash
git -C /home/olis-solutions/olis-v3/nextjs/tri-pros-website commit -m "feat(skills): /orient page templates" -- .claude/skills/orient/templates/plan-page.src.html .claude/skills/orient/templates/epic-page.src.html .claude/skills/orient/REFERENCE.md
```

### Task 4: Wiring

**Files:**
- Modify: `CLAUDE.md:43-44` (Planning block)
- Modify: `CONTEXT.md` (new section before `## Flagged ambiguities`, line 210)
- Modify: `/home/olis-solutions/.claude/skills/session-capture/SKILL.md:34`

**Interfaces:**
- Consumes: `REFERENCE.md §Status block`.

- [ ] **Step 1: `CLAUDE.md`**: add one line under **Planning**: ``- `/orient <path|words>` — verified orientation on a plan or epic tracker, decision sheet, status block write-back; `session-capture` writes the same block at session end.``

- [ ] **Step 2: `CONTEXT.md`**: add `## Planning terms` with: the six **stages** and one clause each; **orientation** (the verified delta between a plan's intent, the tree and git); **status block** (the structured header every tracker and plan carries; checkpoint for `/orient`, hand-off for `session-capture`); **child** (a plan file, or a plan-less phase row, under an epic). Avoid list: "handoff mode", "resume block".

- [ ] **Step 3: `session-capture/SKILL.md:34`**: extend the routing row to: "the spec/plan file and its tracker; when the repo has `.claude/skills/orient/`, rewrite that file's status block in the shape of `orient/REFERENCE.md §Status block` so `/orient <path>` is the successor's whole prompt; it gets deleted when it ships (git keeps the history)".

- [ ] **Step 4: Verify**

Run: `grep -n '/orient' CLAUDE.md CONTEXT.md /home/olis-solutions/.claude/skills/session-capture/SKILL.md`
Expected: one hit in each file.

- [ ] **Step 5: Commit the repo files** (the session-capture edit is outside the repo and has no commit)

```bash
git -C /home/olis-solutions/olis-v3/nextjs/tri-pros-website commit -m "docs: wire /orient into CLAUDE.md and CONTEXT.md" -- CLAUDE.md CONTEXT.md
```

### Task 5: End-to-end dry run and first real run

**Files:**
- None created. Possible edits by the real run: the energy impact tracker and its memory file (owner-approved at run time).

- [ ] **Step 1: Dry run, epic altitude**: a fresh subagent follows the skill on `docs/plans/2026-10-21-proposal-energy-impact-epic.md`, read-only, stopping before write-back, with a two-minute wall-clock note. Expected: one-line confirmation; EI0–EI2 verified from the foundation plan against the ref the tracker names, EI3–EI6 in Ahead unverified; a rendered epic page; a decision sheet of at most four items; the status block it would write; elapsed time reported.

- [ ] **Step 2: Dry run, plan altitude**: same on `docs/superpowers/plans/2026-10-21-proposal-energy-impact-foundation.md`. Expected: task table with evidence and tags; divergence list from git since the tracker's baseline; requirement verdicts for EI-D1–D25 as `still holds / holds, path stale / invalidated`.

- [ ] **Step 3: Check the two reports** against the tree yourself: open three `verified` rows and confirm the evidence; find one `inferred` row and confirm nothing in the tree contradicts it. Any wrong verdict is a loophole: fix `REFERENCE.md §Checks`, re-run that dry run, commit the fix by explicit path.

- [ ] **Step 4: First real run, by the owner**: the owner runs `/orient docs/plans/2026-10-21-proposal-energy-impact-epic.md` in their own session and answers the sheet. Expected: the tracker's status paragraph becomes the block, new EI-D rows carry today's date, the memory index line is refreshed, and the block carries the URL from Task 3 step 4, republished with real data.

- [ ] **Step 5: Close the plan**: on the owner's go, delete `docs/superpowers/plans/2026-11-03-orient-skill.md` and `docs/superpowers/specs/2026-11-03-orient-skill-design.md` (git keeps them) and commit by explicit path with `chore(skills): /orient shipped; plan and spec retired`.
