# Handoff: TS4, the trade scene joins the meeting, and the property configures itself

**Written:** 2026-11-03. **Updated:** 2026-11-05 with the owner's property enrichment requirements (§3, tracker R237–R241 and R244–R246) and today's state (§5).
**For:** a fresh session that starts the TS4 brainstorm.
**Your job in that session:** the design stage only: brainstorm (superpowers:brainstorming), the spec, the builder check, then the plan (superpowers:writing-plans) and `/stress-test-plan`. **Build nothing** until the owner approves the spec and then says "build" or "execute". "Go ahead" does not count as permission to build.
**Branch and worktree:** design in `feat/trade-scenes-foundation` (`.worktrees/trade-scenes`), where the tracker lives. The build gets its own worktree off `origin/main` (§5).

---

## 1. What the owner wants

The trade scene is **the meeting's product-benefits presentation** (R118). It sits beside the company presentation the meeting flow already has, and it is where the rep:

- sells each upgrade;
- wins Tri Pros more of the build;
- leaves the homeowner with a picture that sticks.

Today it is a standalone page, `/dashboard/trade-scene`, for every dashboard user. Its inputs live in the page's store and the URL (R95). TS4 makes it part of the in-home meeting:

- **The home's specs are saved** (R153), so a rep walking the job on a phone sets up the scene the iPad shows at the table. Omni Modify writes through the one place every input writes, so saving plugs in there.
- **The layout belongs to the customer** (R210): one address, one layout, a JSONB column on `customer_profiles` (ADR 0005), once the scene joins the meeting flow. The layout lab keeps it in the store and the URL until then.
- **Bills and overrides** are saved with the meeting (tally T14). Benefits' today's-costs editor (R220) is where the rep enters them now.
- **It must hold up in a living room:** loading, no WebGL, a Wi-Fi drop, and an iPad that loses its WebGL context.
- **The property configures itself from its address** (new 2026-11-05, §3). Once the scene belongs to a customer it has an address, and an address answers many of the facts a rep picks by hand today.

## 2. ⚠️ The old TS4 design is stale

The tracker row cites the foundation spec §5.1 and §5.5 (`docs/superpowers/specs/2026-10-15-3d-presentation-scenes-and-assembly-cutaway-design.md`). That design assumed:

- a "See inside" button on the Specialties showcase;
- a `?assembly=roof-attic` param with push history;
- a full-screen cutaway overlay beside `StageFrame`, keyed by assembly.

Since then:

- the scene became a full page with its own Controls: the bottom group with Home facts, Systems, Modify, the Today ⇄ Build toggle and Benefits;
- up close is moving to one system view on the home's own model (TS3b.4b, R119, R228), and the assembly kit retires;
- Home facts becomes **Property facts** and Systems becomes **Areas** in the layout lab's project 2 (R230, R236), not yet brainstormed.

Carry over the parts of §5 that still hold:

- push history, so the iPad back gesture closes the scene;
- `inset-0`, never a height;
- the key hooks stand down while the scene is open;
- no Radix modal;
- reading the live trade selection, not the debounced flow state;
- prefetch on meeting open (D20).

Redesign the rest, and record in the spec which §5 lines it replaces.

## 3. Property enrichment (owner, 2026-11-05)

The owner's words, condensed: "Since we know the address, we should know the utility. … The property enrichment should really help us auto-configure a lot of the aspects of the home and keep track of what these aspects are. … We should just really use the property data to our advantage."

### 3.1 The requirements (tracker R237–R241, R244–R246)

- **R237. Auto-configure from the address.** Any fact the address can answer is looked up, not picked by the rep. The rep corrects what is wrong. The system keeps track of which aspects it configured.
- **R238. The electric utility is detected.** Two utilities cover about 99% of homes: **LADWP** and **Southern California Edison (SCE)**. The third, extremely rare but listed for completeness, is **PG&E** (owner, 2026-11-05).
  - **Amended 2026-11-05:** the city-run utilities are legitimate answers too (Burbank, Glendale, Pasadena, Riverside, Anaheim and the others the lookup returns). The detected utility is whichever one serves the address, not one of three.
  - This sharpens R156 (Location: the utility "read from maps Tri Pros keeps").
- **R239. The aspects the owner named** (not a closed list):
  - the utility;
  - lot size;
  - the type of roof;
  - the type of fence;
  - satellite or aerial imagery of the property, cross-referenced with the data, to deduce more, e.g. where the garage sits on the lot;
  - area facts: average temperature, average precipitation, highs, lows, ultraviolet radiation, and others like them.
- **R240. Easiest first.** Order the work from what is easiest to get to what is most complex. The owner's own read: a lookup from an address (UV, temperature) is easy; anything that changes the 3D model's shape or layout is harder, and it waits on the composable layout in the other worktree.
- **R241. Budget: $1 per address for now**, every source added together. The owner will raise it for a stated reason.
- **R244. A paid lookup is allowed, and it runs only when asked** (owner, later on 2026-11-05). It never runs by default. The scene always starts the same; on its first load for a customer it offers to fetch the data, and the offer stays while the fetch has not run for that customer.
  - ⚠️ Open: whether the free lookups (map point, utility, climate) also wait for that tap. The owner's words cover the paid lookup; the tracker's log under R243 says "the lookup has run before the visit".
- **R245. The provider is swappable; the stored fields never change.** RentCast first. Only the provider, and what it can fill, may change.
- **R246. The storage pattern is brainstormed, not assumed.** The owner leans to JSONB and is unsure. Per customer, since a customer has one address.
- Research for every rung, with costs and terms: `docs/plans/2026-11-05-property-data-sources-research.md`.

### 3.2 This is not a new idea: three planned pieces already overlap

Fold them into one design. Never build a second pipeline.

| Piece | What it holds | Where |
|---|---|---|
| **ATTOM property data handoff** (2026-10-16, never started) | A property lookup per lead: building facts, ownership, value, permits. Trigger, cost guard, storage shape, observed data versus the rep's entries, geocoding. Its §3 owner decisions are still open and most apply here unchanged. | main checkout: `docs/plans/2026-10-16-attom-property-data-handoff.md` |
| **Layout draft, L5** (R208, spec approved, not planned) | Address → parcel → footprint → masses → one vision grid pass for the yard. Three data stacks with costs, and the Google terms gate. | `docs/plans/2026-11-02-trade-scene-layout-research.md` §4; `docs/superpowers/specs/2026-11-02-scene-layout-design.md` |
| **R156, Location** | Coastal or inland, the utility, wind, "read from maps Tri Pros keeps". Today only the Area tab with coastal or inland. | tracker §3; `FACTS_TABS` in `src/features/trade-scenes/constants/facts-tabs.ts` |

Also touching it: tally **T13** (sun and energy on their lot: sun arc, roof segments, climate zone), **T19** (a typical day per season), and the lab's project 2, whose Lot tab shows read-only lot facts that "a rep never types" (lot size, garage attached or detached).

### 3.3 A starting ladder, easiest to hardest (verify, then re-order with the owner)

This is my first sort, not a ruling. The brainstorm's research pass confirms each source, its cost and its fill rate on real Tri Pros addresses.

| Rung | Aspects | How | What it sets in the scene | Expected cost |
|---|---|---|---|---|
| **0. A point on the map** | latitude, longitude | Geocode once per address. Everything below needs it. | `SCENE_ATTRIBUTES.latitude/longitude` is one constant (34, −118) today | cents or free |
| **1. Which area the point falls in** | electric utility; coastal or inland; the state's building climate zone | Point-in-area against boundary maps kept in the repo or a table. No per-address vendor call. | `climate` (`CLIMATES` in construction core); a new utility fact | $0 |
| **2. Area facts** | average temperature, highs, lows, precipitation, UV or sun strength, wind | Public climate normals for the point or its zone | `CLIMATE_PRESETS` holds two hand-set presets marked "working numbers, sourced before release"; T19's average high per season | $0 |
| **3. Parcel and assessor facts** | lot size, year built, living area, stories, pool, garage type, roof material where the county records it | County GIS (free, one schema per county) or one paid lookup (Realie, ATTOM) | `PropertyProfile.yearBuilt` and `roofType`; project 2's read-only lot facts | $0 to cents |
| **4. Read from imagery, shape unchanged** | roof covering and colour, pool, ground materials, fence kind per side | One vision pass over aerial imagery, answers as grid cells | home materials; the lot's `existing` layer; fence kinds | cents |
| **5. Shape and layout** | footprint, masses, roof form, where the garage sits, which way the home faces | The Layout L5 draft | `PropertyLayout`; `SCENE_ATTRIBUTES.frontBearing` | cents |

Notes that keep the ladder honest:

- **Fence type has no dataset.** It can only come from imagery, and 0.6 m public aerial imagery will rarely show a fence's material. Expect a low yield, measure it, and say so to the owner. It may stay a rep input with a good default.
- **Roof type** has two routes: assessor data (many nulls in California, per the ATTOM handoff) and imagery. Measure the fill rate before promising it.
- **Rung 5 depends on Layout L3** (masses), which is not built. The garage's position is rung 5, not rung 4.
- **The front bearing** (rung 5's last item) is cheap to derive from the parcel edge nearest the street, and it only turns the sun, not the model. It may move up the ladder (R142 already made the bearing a scene attribute).
- **The budget is not the constraint on rungs 0–3.** By the layout research: Realie is $50 a month for 1,250 lookups, the vision pass costs cents, county GIS is free. ATTOM has no published price. The $1 cap bites only if a premium imagery vendor comes in (Nearmap, Hover, EagleView), which the research already ruled out as "not relatively free".

Leads for the research pass, **none verified**: the California Energy Commission's GIS layers for electric utility service areas and for building climate zones; NOAA's 1991–2020 climate normals; NREL's solar resource data; the EPA's UV index; the layout research's county endpoints and NAIP imagery.

### 3.4 Traps already known

- **The word is taken.** The table `customer_enrichment` holds funnel answers (`src/shared/db/schema/customer-enrichment.ts`). "Property enrichment" is the owner's working phrase. Agree the code term with the owner and put it in `CONTEXT.md` before any name is written (memory `feedback-domain-vocabulary-before-naming.md`). "Property facts" is already the agreed name of the scene's tab.
- **Nothing writes the customer's latitude and longitude.** The columns exist (`src/shared/db/schema/customers.ts`), the update hook nulls them on an address change (`src/shared/entities/customers/dal/server/crud.ts`), and Places autocomplete already returns a `location` (`src/shared/lib/google-maps-helpers.ts`). Rung 0 may be nearly free.
- **A utility list exists and nothing reads it.** `electricProviders` in `src/shared/constants/enums/customers.ts` has seven values (LADWP, Edison, Glendale, Burbank, Riverside, PG&E, other) and no importer. Reuse or replace it; never add a second list.
- **The Google terms gate.** Maps Platform terms forbid tracing outlines from satellite tiles and feeding them to a model, and the Solar API is licensed for energy systems only (research §4.1; Tri Pros sells no solar). The owner ruled Google in "for this test despite its terms" (R208). That ruling covered a lab test, not a production pipeline that runs per customer. Ask again.
- **ATTOM's licence is unanswered.** Until the owner has written answers, its data is internal only: shown to reps, never to homeowners (ATTOM handoff §2). The scene is shown to homeowners.
- **Vision models place things badly by pixel.** Ask for grid cells (research §4.3).
- **No DB writes for testing**, dev included. Measuring fill rates on real addresses is read-only against the vendors; the owner picks the addresses.

## 4. Calls the brainstorm must settle

1. **One design or two, and in what order.** The enrichment is a customer capability (providers, a job, a stored record) with three readers: the scene, the rep's view of a lead (the ATTOM handoff), and the layout draft. TS4 is where the scene first gets a customer and so an address. My recommendation: one brainstorm, two specs. Settle the enrichment record first, because call 3 hangs on it, then the meeting integration that reads it. Rungs 0–2 can ship with TS4; rungs 3–5 follow as their own plans. The owner decides.
2. **Where the scene sits in the meeting.** The step list is in `src/features/meeting-flow/constants/step-config.ts`: `who-we-are`, `specialties`, `portfolio`, `deal-structure`, `program`, `closing`, `create-proposal`. Choose between:
   - its own step;
   - an overlay opened from Specialties or from a proposal;
   - both.

   The **multi-proposal meeting flow epic** is redesigning these steps right now (tracker `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`; memory `project-multi-proposal-meeting-flow-epic.md`: tabs renamed Solution, Programs, "Let's build!"). Read it and design with it, not against it.
3. **Whose data is which.** This is the call everything else hangs on.
   - **The home** (facts, materials, wear, the layout) belongs to the customer and outlives a meeting.
   - **What the address told us** belongs to the customer's current address. Decide what happens to it when the address changes.
   - **The Tri Pros build** is the scene's Build side. It may be the selected proposal's scopes, since the multi-proposal epic moves trade, scope and deal data off `flowStateJSON` onto proposals.
   - Decide whether picking an upgrade in the scene changes the proposal, reads from it, or neither; the foundation spec put "changing the meeting's trade selection from inside the cutaway" out of scope.
   - Use ADR 0005 for JSONB, column or child table, and name the owner of every field. The owner leans to JSONB for the looked-up data and wants the pattern brainstormed (R246). House precedents to weigh: `customer_profiles` (a 1:1 table keyed by the customer) and `customer_lead_attribution` (typed columns plus an immutable `capture_json` snapshot of the raw source).
4. **Looked up versus confirmed.** R237 asks to "keep track of what these aspects are". The scene already marks a fact's `Basis` as `recorded`, `era-typical` or `typical` (`src/shared/modules/construction/core/types.ts`). Decide:
   - whether a looked-up fact is a new basis, and what the rep sees for it;
   - whether a lookup fills an empty fact, or only shows beside it. The ATTOM handoff proposed "never overwrite, show beside". The owner now says auto-configure, so the likely rule is: fill what is empty, never overwrite what a rep set, and a rep's correction always wins;
   - what is stored per fact: the source, the date, and how sure the source is;
   - how a missing fact (R191) counts once a lookup has filled it.
5. **When the lookup runs, and the cost guard.** Ruled for the paid lookup (R244): on request only, from an option the scene shows on its first load for a customer; the scene starts the same either way. Still to decide: whether the free lookups run earlier or wait for the same tap, what the rep sees while a fetch runs and when it fails, and how a provider is swapped without the stored fields changing (R245, R246; call 3). Decide once per address or re-run on a schedule, dev versus prod (dev must not burn paid calls; compare memory `project-prod-visit-sends-gate.md`), and how the $1 cap is enforced and reported.
6. **Who reads the utility.** Name each reader before storing it: the bills and their growth in Benefits (R218, R227, `projectBillYears`), programs and rebates (memory `project-proposal-applications-epic.md`), and the sales copy that names the utility. Gas is a separate question (SoCalGas serves nearly every home); ask whether it is wanted.
7. **Bills: one truth.** The energy-impact epic already works with customer bills and bill cuts (memory `project-proposal-energy-impact.md`, "READ before customer bills / bill cuts"). Benefits now holds today's costs and the shared bill projection (`projectBillYears` in construction core, R227). Don't create a second place for a customer's bills.
8. **Phone walk → iPad table.** R153 means two devices on one meeting. Decide whether this is a save-and-reload or something live; ADR 0006 keeps realtime inside the meeting flow only. Tally T12 (a second-screen mirror over Ably) is a separate, later idea. Don't fold it in unless the owner asks.
9. **Graceful paths, re-measured on today's scene.**
   - A 3D chunk that fails or throws already leaves the stills and a live stage (`846730edd`, `constants/home-scene-stills.ts`).
   - The blueprint load is the loading screen.
   - The blueprint ledger (`.superpowers/sdd/2026-11-01-trade-scene-blueprint-load/`) records a context loss on a cold iPad load: the pass holds about 66 MB at 2732×2048.
   - **Prefetch:** design it for the 3D chunk, the HDR sky and the GLB models, so a Wi-Fi drop mid-meeting changes nothing.
   - **A lookup that failed or has not run** leaves the scene exactly as it is today: defaults, and the rep picks.
10. **Who can open it.** Today it is any dashboard user (`ability.can('access','Dashboard')`), with labs super-admin. In a meeting it is the meeting's participants; see memory `project-proposals-belong-to-meeting-participants.md` and the CASL work (`project-permissions-casl-compiler.md`).
11. **Out of scope unless the owner pulls it in:**
    - AI in Omni Modify (R152, its own two designs);
    - the second-screen mirror (T12);
    - the lead-to-meeting outreach that the ATTOM handoff feeds;
    - building rung 5. The layout draft stays Layout L5's plan; this design only makes sure L5 writes into the same record and counts against the same budget.

## 5. Order and what is in flight (2026-11-05)

- **The scene is on prod.** PR #287 squash-merged 2026-11-04 (`origin/main` `eda697387`), with Up close part-built. The feature branch has moved on since; the next release is a new branch off `origin/main` (memory `project-trade-scene-ship-2026-11-04.md`). TS4's build starts in its own worktree off `origin/main`.
- **This worktree carries uncommitted work from other sessions** (41 changed files at writing; TS3b.4b, Look inside, in flight). Never revert or stage it.
- **Benefits:** the tracker row still reads "building". Check the row and the branch before relying on Benefits code.
- **Layout:** L1+L2 and fences as drawn lengths are built on `feat/scene-layout-lab`, unmerged. Next there is the project 2 brainstorm (Property facts + Areas, R236), which owns the Lot tab that shows rung 3's facts. R210's column comes from that work's `PropertyLayout` codec; reuse it, never a second shape. If the two brainstorms run in parallel, agree who owns the "Property facts" tab's shape before either spec is written.
- **TS4 should not depend on TS3b.4b's internals**, only on the scene's public entry: `TradeSceneView` and its inputs store.
- **A schema change** goes to dev with `pnpm db:push:dev` only; prod schema is the owner's step.

## 6. Read first, in this order

1. The trade-scenes tracker (`docs/plans/2026-10-16-trade-scenes-epic.md`):
   - the status line;
   - the §2 rows TS4, Controls, Benefits, Layout, Blueprint load;
   - the §3 rows R95, R118, R142, R151–R153, R156, R191, R208, R210, R218–R222, R230, R236, R237–R246;
   - §5's T12, T13, T14 and T19.
2. The enrichment's three planned pieces (§3.2): the ATTOM handoff in the main checkout, the layout research §4 with its §8 "facts not verified", and the layout spec's draft section.
3. The multi-proposal meeting flow tracker, and `docs/plans/2026-10-30-multi-proposal-page-lessons-from-issue-29.md`.
4. ADR 0003 (service and provider tiers), ADR 0005 (JSONB vs column vs child table) and ADR 0006 (realtime only in the meeting flow).
5. The foundation spec §5 (what carries over, §2 above) and §11 (the backlog).
6. Memory, in two groups:
   - the scene: `project-3d-trade-scenes.md`, `project-trade-scene-layout-exploration.md` (Controls), `project-trade-scene-blueprint-load.md`;
   - the surroundings: `project-proposal-energy-impact.md`, `project-no-solar.md`, `project-pwa-startup-performance.md` (read before any dashboard layout or provider change).
7. The code:
   - the scene: `src/app/(frontend)/dashboard/trade-scene/page.tsx`, `src/features/trade-scenes/ui/views/trade-scene-view.tsx` (the inputs store and the `next/dynamic` canvas), `src/features/trade-scenes/types.ts` (`TradeSceneInputs`), `constants/scene-attributes.ts`, `constants/facts-tabs.ts`;
   - what the facts feed: `src/shared/modules/construction/core/types.ts` (`PropertyProfile`, `Basis`), `core/constants/climate-presets.ts`;
   - the meeting flow: `src/features/meeting-flow/` (`constants/step-config.ts`, `constants/query-parsers.ts`, the trade selection context);
   - the customer: `src/shared/db/schema/customers.ts`, `customer-profiles.ts`, `customer-enrichment.ts`; `src/shared/services/customer-intake.service.ts`; a provider to copy the shape of, e.g. `src/shared/services/providers/google-maps/`.

## 7. Standing rules

- Never run `pnpm build`. Checks run under the lock:
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`
  - `flock … env CI=1 pnpm eslint <files>`
- No DB writes of any kind, not even for screenshots; a meeting fixture is the owner's to make.
- Shots use the owner's dev server on :3002.
  - Never start a dev server, and never `rm -rf .next`. If the port does not answer, stop and ask the owner.
  - Sign in with `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=`.
- Commit by explicit path, or with `git apply --cached` for your own hunks in a file another session also edits; the tracker and `CONTEXT.md` usually are.
  - Never `git add -A`, `git stash`, `git reset` or `git checkout -- <file>`.
  - Use a 300000 ms timeout on commits.
- Tracker R numbers collide across parallel sessions: check the highest R row right before adding one.
- Reuse what exists: the entity's DAL and service, the generic CRUD, the entity's action configs and compound components. Never a thin new procedure where one already covers it.
- Before quoting a doc or memory, check the code. If they disagree, write `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y`, and favour the code.
- Comments in code say why, never what, and never cite a plan or spec.
