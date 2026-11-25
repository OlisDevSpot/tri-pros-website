# Handoff: the trade scene's Benefits interior (brainstorm → build)

Paste the block below into a fresh session started in `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`.

---

You are picking up the **Benefits interior** of the 3D trade scene: the large section the rep opens from the Controls to show a homeowner everything the Tri Pros build brings them. Today the section is a "coming soon" placeholder over the bills. Your job:
1. Design its interior with the owner, through the full UI process.
2. Write the spec and the plan.
3. Build it once the owner says **build**.

## Run it with `/ui-exploration`

The tracker names this as its own `/ui-exploration` session (R188). The skill runs every phase in order: baseline, critique with three directions, a studies page the owner can open, spec, plan, subagent build, Playwright verify, then `/impeccable` polish.
- Before the first study, load `/impeccable` (shape and layout) and read the methodology memories: `feedback-ui-work-methodology.md`, `feedback-mockups-use-real-tokens.md`, `feedback-iterations-carry-approved-elements.md`, `feedback-show-concept-split-concretely.md`.
- Open each round with the checklist of what the owner has already approved, and carry every approved element into the next round.

## Read first (in this order)

1. **The tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`.
   - Rows **Benefits** and **Product proof** in §2.
   - Requirements **R118, R127, R128, R155, R157, R166, R172, R185, R188, R189**. They carry the owner's rulings, so treat them as binding.
   - R114–R117 are context (yard sign, documents, colours).
2. **The paused brainstorm:** `docs/superpowers/handoff/2026-10-30-benefits-and-upgrade-registry-handoff.md`. It records:
   - the registry rulings;
   - the manufacturer list;
   - how documents open (the shared `PhotoLightbox`, page images in the `CompanyDocument` shape);
   - **two rejected rounds of layouts.** Don't repeat them. The mockups are in `.superpowers/brainstorm/1509949-1793400812/content/` (git-ignored, local).
3. **The Controls design:**
   - the spec, `docs/superpowers/specs/2026-11-01-trade-scene-controls-design.md`;
   - the frozen studies page, `docs/plans/assets/2026-11-01-trade-scene-controls/studies.html`. It is the visual floor and the starting point; the approved matrix is study A, round 1 (R157).
   - Memory `project-trade-scene-layout-exploration.md`. The owner's bar there is "as crisp as the artifact, if not more".
4. **Glossary:** `CONTEXT.md`, the entries **Benefits**, **Controls**, **Controls window**, **Efficiency upgrade option**, **Bill-cutting scope** and **Upkeep**. Before you name anything new (for example the kinds of benefit), check it here. The owner agrees every new term.
5. **Memory:**
   - `project-3d-trade-scenes.md`;
   - `project-proposal-energy-impact.md` (bill cuts);
   - `project-no-solar.md`. Never mention solar.

## What the owner has ruled (from the tracker; verify each against the code)

- **Benefits is the build's alone.** Under Today it shows nothing; tapping it flips the scene to the build first (R166). It opens in the Controls window, like Modify (R172).
- **It is the summary of the whole page.** It is large and stable, like an eye-catching interactive brochure: the artifact that the Today-vs-build configuration produces (R185).
- **The starting direction is a matrix (R157):** systems down, kinds of benefit across, a dot per benefit. Tapping a dot, a system or a kind opens its benefits as a large statement. The kinds and their names are still a draft.
- **Savings is one kind of benefit among many (R127).**
  - The other kinds: warranty; problems gone (no roof leak); passive heating and cooling (the HVAC runs less and lasts longer); structure protection; environmental figures (may say "coming soon" at first); looks and function; a longer material life.
  - The view is global and per system: roof, attic, windows, walls, heating & cooling, foundation.
  - Lifespan-type benefits are plain statements, with no figures.
- **The bills stay in Benefits' footer (R155, R189).** That covers coastal or inland, electric and gas, which are also reachable from Modify. Coastal or inland is one shared value with Home facts → Area (R184).
- **Every benefit lives in one upgrade registry (R128).**
  - It sits in `src/shared/modules/construction/` and absorbs the scene's product data instead of copying it.
  - Each entry is one upgrade. A branded upgrade has one default manufacturer and at most one switchable alternative.
  - The Tri Pros workmanship warranty belongs to every upgrade.

## What the code holds today (verify; don't trust this list)

`F/` = `src/features/trade-scenes/`.

- **The placeholder:** `F/ui/components/controls/benefits-body.tsx`. It sits beside `benefits-head.tsx`, `bills-footer.tsx` and `controls-modal.tsx`. Its copy is `CONTROLS_COPY.benefits` in `F/constants/home-scene-copy.ts`.
- **The savings data** already exists and is live. `F/lib/scene-savings.ts`, `savings-figures.ts`, `repairs-figure.ts`, `repairs-rows.ts`, `cut-source-label.ts` and `climate-default-bill.ts` produce `scene.savings` (bill cuts per category and source, repairs per trade).
- **Every savings figure in copy goes through one claim helper.** Commit `648e398da` added `src/shared/modules/construction/core/lib/bill-cut-claims.ts` and its constants file. Its phrasing: "up to about N%" in a sentence, "Up to ~N%" on a tile. A verify script fails on any literal bill percentage in the copy files.
- **Efficiency upgrades** (`EFFICIENCY_UPGRADE_IDS`: cool roof, R-8 ducts, and now Cool Life paint, built 2026-11-02) change what a scope saves. The upgrade scope pair (`UPGRADE_SCOPES`) means a picked repaint is either water-based (like-for-like, no bill cut) or Cool Life. Benefits must read the picks as they are.
- ⚠️ **Stale ref.** `docs/plans/2026-10-16-trade-scenes-epic.md` R189 says the parked savings bars, cut overrides and repairs list "stay in the code, unmounted". But commit `e21caa6f1` deleted those eleven `F/ui/components/panel/` files on 2026-11-02 ("Git keeps them for the Benefits build"). Recover any you want to re-home with `git show e21caa6f1^:<path>`. Tell the owner, and propose fixing the R189 cell.

## Scope questions to settle with the owner first (one at a time)

1. **Registry or not.** The non-savings kinds need the upgrade registry (R128), which is paused. Two options:
   - (a) this work builds the registry's first slice: benefits only, no documents yet;
   - (b) Benefits ships on the savings and upkeep data first, with the other kinds marked as coming.

   Recommend one, with your reasons.
2. **The kinds of benefit and their names.** The 2026-10-30 draft (Savings, Protection, Lasts longer, Warranties, Planet, Looks & use) was never agreed. Settle them in `CONTEXT.md` with the owner.
3. **Documents.** Do manufacturer documents (R115) join this work, or wait? Their storage waits on the R2 storage reform.
4. **Colour and savings (R117).** The rule is that colours never show savings they can't deliver. This matters only once colour picks exist.

## Rules that bind (owner standing rules)

- **Branch and server.**
  - Work on `feat/trade-scenes-foundation` in this worktree, unless the owner says otherwise. First check whether the extraction branch `feat/trade-scene-ship` has merged, because that may change where new work starts. Ask the owner.
  - The dev server on :3002 is the owner's. Never start, stop or restart it. Ask before clearing `.next`, and run `ss -ltnp` first.
  - Never run `pnpm build`. Run `pnpm tsc` and eslint under `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock`.
- **Data and sign-in.**
  - No DB writes, not even for testing.
  - Browser sign-in goes only through `/api/dev/playwright-session?secret=…&as=info%40triprosremodeling.com`. Never use `role=`, and never print the secret, the URL or a token. The scene is at `/dashboard/trade-scene`.
- **Git.**
  - Commit by explicit path. Never stage `docs/**` or `CONTEXT.md`.
  - No `git add -A`, stash, reset, `checkout --`, amend, merge or push.
  - Run `git diff --cached` before every commit and every dispatch.
  - Other sessions commit on this branch. Never stage, revert or "fix" their hunks.
- **Protected files.** Don't touch `package.json`, eslint or tsconfig, `src/shared/components/scene/**` or `globals.css`. Ask before editing any file the spec doesn't name.
- **Execution.** A plan executes only when the owner says build, execute or run. "Go ahead" is not execute. After a plan is written, run `/stress-test-plan` before offering execution.
- **Code style.**
  - Comments say why, never what, and never cite plans or tracker ids.
  - One component per file. Constants go in `constants/`, pure helpers in `lib/`. Copy strings go only in `home-scene-copy.ts`.
  - Copy never says "your" and never mentions solar.
  - Colours use tokens only. Read `docs/design-system/theme-conventions.md` before any colour or surface work.
  - Check every screen in light and dark, at 1280 and at 390, with your own screenshots.
- **Tracker.** Log each owner ruling as a new R-row in the tracker, in that file's style, the same day.

## Start

Tell the owner in two lines what you read and the one scope question you want settled first (question 1). Then begin `/ui-exploration` with the baseline: screenshot today's Benefits modal at 1280 and 390, light and dark.
