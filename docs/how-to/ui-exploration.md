# How to Run a UI Exploration

Options page → user picks → spec → plan → build → polish. The process that turned the meeting-flow "Who We Are" step into a scroll presentation in one pass (2026-09-11 → 09-13, commits `eac8670e..fee570dc`), written down so the next step runs the same way.

**Read first**: [`docs/ui-design-playbook.md`](../ui-design-playbook.md) owns *how we judge UI* (user-flow questions, the three-skill audit, banned patterns). This document owns *how an exploration runs*: the phases, the artifacts each phase produces, the gates where the user decides, and the commands that drive each phase. Invoke it with `/ui-exploration <step or surface>`.

---

## When this applies

Use it when a surface is being **re-conceived**, not tuned: a meeting-flow step, a customer-facing page, a whole admin screen. Signs: the user asks for directions or inspiration, the information architecture changes, a new primitive gets introduced, or more than one file's worth of layout moves.

Do not use it for a bounded fix inside an existing flow. The playbook's three phases cover that on their own.

---

## Ground rules (bind every phase)

1. **No code before the user picks a direction and approves the spec.** The brainstorming skill's hard gate applies to the whole exploration. Mocks are throwaway HTML, never app code.
2. **UI only.** An exploration changes `ui/`, `constants/`, `contexts/`, feature-local `types/`, and edge mappers in `lib/`. It never touches DAL, `src/trpc/`, schema, seeds, or entity services. Every data-access change the new UI needs is **aggregated** in the spec's "Data access" section and **run by the user first**; build tasks that depend on it sit behind a user gate. Where the current API's shape does not fit the new UI, the UI adapts at the edge (a mapper in `lib/`) or renders a labeled placeholder, and the gap is listed. No invented fields in mocks.
3. **Root cause, never per-instance.** If a symptom repeats (padding on every row, text at the top of every section), find the one cause (a template that already pads, a stylesheet that never regenerated) and fix that. Fixing each instance is a failed exploration step.
4. **Company facts come only from `src/shared/constants/company/` or an existing typed constant.** Anything inline (a count, a promise, a warranty term) is excluded from mocks and the build, and listed as a follow-up. Verified as recently as the Who We Are build: the workmanship warranty must not appear.
5. **Shared tree.** The working tree is Oliver's live editor. No `git stash`, `git checkout <ref> -- .`, `git restore` beyond a task's own files, `git reset`, `git add -A`, `git add .`, or `git add -u`. Every commit is `git commit -m "…" -- <explicit paths>` and is confirmed with `git show --stat HEAD`. Memory: `feedback-subagent-shared-tree-safety`.
6. **Verification is `pnpm tsc` + `pnpm lint` + a rendered Playwright check.** Never `pnpm build`.
7. **Docs and mocks are not auto-committed.** Specs, plans, research notes, and follow-up docs stay uncommitted until the user says otherwise. Code commits happen only after the user answers the commit question in Phase 5.

---

## Phase 0 — Frame and baseline

**Skills to load, in this order:** `/impeccable layout <target dir>` (or `critique` when the ask is evaluate-only), then `superpowers:brainstorming`. Run the impeccable `context.mjs` once with `--target` on the step's directory; follow its directives.

**Read before forming an opinion:**
- The playbook's Phase 1 user-flow questions (who, when, what they need this moment, most probable scenario, what makes their life easier, where the eye lands). Answer them in text.
- `docs/design-system/DESIGN.md` and the feature's `DOCS.md`.
- The sales narrative behind the step (`docs/sales/`, `docs/company/`) so the surface serves the meeting, not the reader.
- The existing constants the step renders from, and the current motion docs via context7 when motion is in scope.

**Capture the baseline with Playwright** (auth: `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard/meetings`; a dev meeting: `http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9?step=<n>`):
- Full-page screenshots at desktop 1440 and phone 390, both color schemes.
- A "what renders today" table: page height, what is visible when the step opens, the size of any document or image, in each viewport.

**Classify out loud** as the brainstorming skill requires: spike, bounded, or architectural. An exploration is almost always architectural (new information architecture, new primitive), which means spec and plan, not a design in chat.

**Data-access inventory** (mandatory when the step reads or writes, which every step after Who We Are does):
- Grep the step's directory for `useQuery`, `useMutation`, `useSuspenseQuery`, `trpc.`, and feature hooks. List every read and write: procedure, the fields the UI uses, the mutation the UI triggers, and the invalidations.
- Record the exact shapes (from the router output types or a Playwright network capture on the dev meeting). Mocks use these shapes.
- Write down what the new UI will want that the API does not give. This list becomes the spec's "Data access" section and the user's to-do.

---

## Phase 1 — Critique and three directions (one message)

Deliver, in a single message, with no code:

1. **Verdict** in two sentences: what the surface is today versus what the moment needs (for Who We Are: "a well-written reading page; the meeting needs a presentation").
2. **What renders today** table from Phase 0.
3. **Layout findings** from the impeccable lens, squint test first: reading order, grouping, rhythm, hierarchy, then contrast and touch targets. For an Operate surface (anything the agent clicks through, like selecting trades and scopes), also run the playbook's three-skill audit here and fold its ranked list in.
4. **Three directions, A/B/C.** Each gets a name, a one-paragraph pitch, what it costs, what it gives up, and how it would reuse or introduce a primitive. Name a recommendation and say why.
5. **Ask** with `AskUserQuestion`, three questions maximum, recommended option first:
   - Direction (A/B/C, with the option to "show me first").
   - The usage-scene question that changes proportions and input priority (for meetings: laptop, tablet, or a mix; touch vs keyboard).
   - The assets question (real where it exists vs placeholders everywhere).

When the user answers "show me the layouts first," go to Phase 2 before they choose.

---

## Phase 2 — The studies page

One HTML page, three working mocks, one private link. Load the `artifact-design` skill before writing it.

**Build:**
- File: `<scratchpad>/<surface>-studies.html`, published with the Artifact tool. Republish to the same path to keep the URL.
- Every direction is a **working** mock (scrolls, taps, keyboard), not a picture. Each sits in a **laptop frame and a tablet-portrait frame** side by side, driven by the **same real content**: copy from the existing constants, the real data shapes from the Phase 0 inventory, real images where they exist.
- Real assets are embedded as data URIs. The pattern: a `build-assets.cjs` script in the scratchpad reads the images (public bucket, `public/`) and writes `assets.js` that sets `window.<PROJECT>_ASSETS`; the page loads it as a supporting file. The artifact sandbox blocks external images, so there is no other way.
- Frame chrome mirrors the real shell (back link, step dots, mark, footer triggers) so the user judges the mock in context.
- Motion is in the mock: transitions, staggers, image settle, and a reduced-motion path. Confirm the API shape against the current motion docs (context7) so the mock is the shape the build will take.

**Below the mocks:** "how to drive the mocks," a side-by-side table (control in the room, cost, reuse), the recommendation, and a **legend of real versus stand-in** that names every placeholder and every fact deliberately left out (inline claims, unverified terms).

**Deliver** the link with a short paragraph per study on how to drive it, and ask for the pick plus corrections.

**After the pick:** apply the user's corrections in the mock and republish with the chosen direction leading and the other two kept below for reference. The spec must describe what the user last saw, so the mock is corrected before the spec is written.

---

## Phase 3 — Parallel lanes: research, root causes, mock corrections

Once a direction is chosen, run the independent lanes at once (`superpowers:dispatching-parallel-agents`):

- **Research lane** for any technique with a wrong way to do it (scroll snap, drag-and-drop, virtualization, gesture handling): `mattpocock-skills:research` with a precise question naming the stack ("React 19 + Next.js 15 + motion/react v12"). The agent writes `docs/plans/YYYY-MM-DD-<topic>-research.md` from primary sources (spec, MDN, the library's docs via context7) with a Recommendation, an Unverified list, and Sources. Before relaying it, verify its one framework-specific claim against the installed version (the Tailwind utility, the motion export).
- **Root-cause lane** for any shell symptom the user reported alongside the ask (padding, chrome, title bars). Trace the layout chain from the app template down; fix the cause in the shell, measure before and after, leave it uncommitted for the user.
- **Mock lane**: the corrections from Phase 2.

Report all lanes in one message, each with its evidence.

---

## Phase 4 — Spec

Write `docs/superpowers/specs/YYYY-MM-DD-<surface>-design.md` with these sections, in this order:

1. **Goal**: the moment the surface serves, in the user's words.
2. **Decisions already made**: every answer from Phases 1 to 3, so they are not re-litigated.
3. **Content**: the beats or items, each with its exact copy source (constant path and field).
4. **Architecture**: layout modes on the step config, the primitive (feature-local first, promoted later), the step's components, data and types, responsive behavior with the exact breakpoint, motion and reduced motion, accessibility.
5. **Data access** (new, mandatory for steps that read or write): reads used as-is, writes used as-is, **required changes the user runs first** (DAL, tRPC, schema, seed, each with the reason), and UI adaptations at the edge. This section is the single hand-off for backend work.
6. **Error handling and edge cases**.
7. **Verification**: the Playwright checks the plan will run, by viewport and scheme.
8. **Files**: create, modify, delete.
9. **Out of scope** and **follow-ups** (inline claims to move, temporary implementations to generalize).

Temporary implementations get both a spec note and a code comment header (`// LAZY:` with the migration target) so the shortcut cannot hide.

Present the spec with "choices worth your eye" (three to five bullets) and wait for approval. Apply the user's amendments before the plan.

---

## Phase 5 — Plan and execution choice

`superpowers:writing-plans` → `docs/superpowers/plans/YYYY-MM-DD-<surface>.md`.

**Global Constraints block** (copy and adapt the Who We Are plan's): pnpm and no build; shared-tree rules; work on `main` with pathspec commits; coding conventions (one component per file, no file-level constants in component or view files, named exports, contexts in `contexts/`); company facts rule; the design system's binding choices; the research note's technique rules; reduced motion; the verification recipe with the Playwright auth URL and the dev meeting URL. Add a **"Files off limits"** line listing the DAL, tRPC, schema, and service paths the tasks may not touch.

**Task order that worked:** foundation (types, config flag, tokens, data) → primitive → atoms → sections → compose and wire the view, retire the old step → responsive pass and audits. Tasks that depend on a user-run data change go **last, behind a "USER GATE" heading**, and the plan says what the user must run before they start.

End with a self-review against the spec.

**Ask** with `AskUserQuestion`: execution mode (subagent-driven vs inline) and whether each task commits to `main` when it passes.

---

## Phase 6 — Build

`superpowers:subagent-driven-development` with the plan. Fresh implementer per task, a spec-plus-quality reviewer per task, re-review after each fix round, a whole-branch review at the end followed by a fix wave and its re-review, then `superpowers:finishing-a-development-branch`.

**Every dispatch, implementer and reviewer, carries:**
- The task brief path and a "resolutions of things the brief cannot know" list (facts the controller verified in the repo).
- The shared-tree block and the pathspec-commit rule from Ground rule 5, plus the never-touch file list from the plan.
- "You do not dispatch subagents" and "report BLOCKED or NEEDS_CONTEXT rather than guessing."
- A report path under `.superpowers/sdd/<plan>/`.

Reviewers get the base and head commits and a diff file, plus the global constraints that bind the task.

The controller keeps a ledger of rulings (`Ruling: what — why — cost if wrong`) and reports them in the final message.

---

## Phase 7 — Verify and polish

**Before judging any rendered CSS on a long-running dev server: stop it, `rm -rf .next`, restart.** Next's persistent cache does not treat `.tsx` as a dependency of the CSS module, so classes added after the first compile are missing from the served stylesheet across restarts. Production analogue: Vercel "Redeploy without build cache." Three of the four Who We Are symptoms the user reported were this. Memory: `project-tailwind-content-detection-gap`.

**Capture script** (Playwright `browser_run_code_unsafe`), the shape that worked:
- Set the viewport, load the step, wait for the surface's `aria-label`.
- Clear the stored theme, then for each of `light` and `dark`: `emulateMedia({ colorScheme })`, reload, wait.
- For each section or item: scroll it into place with scroll behavior forced to `auto`, wait, then measure with one `evaluate` call: bounding boxes of the text block, headings, pinned or sticky elements, and the footer triggers, plus the body background and the root class.
- Screenshot to `.playwright-mcp/<surface>-<scheme>-<i>.png` (gitignored).
- Return the measurements as JSON and read them before looking at the pictures. Numbers find overlap; screenshots confirm it.

Viewports: 1440×900, 1024×768, tablet portrait 820×1180, phone 390×844.

Then `/impeccable polish <target dir>`: one batched inspection round (desktop and mobile together), fix everything it shows in one batch, at most one confirmation round. Classify each drift (missing token, one-off, conceptual mismatch, local defect) and fix at the narrowest correct level. Stop polishing after the second round.

The user verifies by hand on the device the surface is for. That check is the only one that closes the phase.

---

## Phase 8 — Close out

- **Follow-up issues document**: `docs/plans/YYYY-MM-DD-<surface>-follow-ups.md`. An introduction per issue (what it is, why it matters, the ideal solution), no code, written for a grilling session. Include the open user decisions the build made on their behalf.
- **Memory**: a `project-<surface>` memory with the shipped range, the open decisions, and the follow-ups, plus one line in `MEMORY.md`.
- **Docs**: spec, plan, research note, and follow-ups stay uncommitted until the user says to commit them.

---

## Gates (the user decides; nothing proceeds without the answer)

| Gate | Phase | Question |
|---|---|---|
| Direction | 1 → 2 | A, B, or C, plus scene and assets. "Show me first" routes through the studies page. |
| Mock corrections | 2 | Named study, named change. Republished before the spec. |
| Spec | 4 | Approve or amend the "choices worth your eye." |
| Execution | 5 | Subagent-driven or inline; commit per task or stage only. |
| Data access | 5 → 6 | The user runs the aggregated DAL, tRPC, schema, or seed changes before the gated tasks start. |
| Hands-on | 7 | The user verifies on the real device. |

---

## Command cheat sheet

| Moment | Command or skill |
|---|---|
| Frame the critique | `/impeccable layout <dir>` or `/impeccable critique <dir>` |
| Run the exploration | `superpowers:brainstorming` (classify out loud) |
| Operate-surface audit | playbook Phase 2: `ui-ux-pro-max` → `web-design-guidelines` → `impeccable` |
| Studies page | `artifact-design`, then the Artifact tool |
| Technique research | `mattpocock-skills:research` + context7 for library docs |
| Independent lanes | `superpowers:dispatching-parallel-agents` |
| Spec | written by hand from the brainstorm, sections above |
| Plan | `superpowers:writing-plans <spec path>` |
| Build | `superpowers:subagent-driven-development <plan path>` |
| Finish | `superpowers:finishing-a-development-branch` |
| Polish | `/impeccable polish <dir>` |
| Verify | `pnpm tsc`, `pnpm lint`, Playwright capture script |

---

## Worked example

Who We Are, 2026-09-11 → 09-13. Spec: `docs/superpowers/specs/2026-09-12-who-we-are-scroll-presentation-design.md`. Plan: `docs/superpowers/plans/2026-09-12-who-we-are-scroll-presentation.md`. Research: `docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md`. Memory: `project-who-we-are-presentation`.

What the phases produced there: a baseline table (2992 px desktop page, hook slab and proof bar visible on open, unreadable insurance certificate on mobile); three directions (deck of scenes, choreographed scroll, hybrid chapters) as working mocks in laptop and tablet frames; the user picked B with four corrections; a research note that set the scroll-snap recipe and found two real defects later (a global `scroll-margin-top` rule and container units on the scroller itself); a spec with nine beats and a data-and-types section; seven tasks built by subagents with per-task review and pathspec commits; a polish pass whose three reported symptoms had one cause, a stale generated stylesheet.

---

## Changelog

- **2026-09-13** — Initial version, distilled from the Who We Are presentation build. Adds the UI-only and data-access aggregation rule for steps that read or write.
