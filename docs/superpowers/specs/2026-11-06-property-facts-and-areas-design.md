# Property facts and Areas — design

**Status:** written and approved by the owner 2026-11-06; stress-tested the same day, three rulings added as calls 21–23 · **Plan:** `docs/superpowers/plans/2026-11-06-property-facts-and-areas.md` · **Project:** 2 of the scene layout lab's four correction projects (tracker row 2026-11-03; rulings R149, R230, R233–R236) · **Builds on:** `docs/superpowers/specs/2026-11-03-lot-fences-design.md` (fences as drawn lengths, built `a4f9dc8f4..26a0e7629`) · **Branch:** `feat/scene-layout-lab`, worktree `.worktrees/scene-layout-lab`, route `/dashboard/labs/scene-layout` · **Mockups (throwaway, git-ignored):** `.superpowers/brainstorm/380280-1793947083/content/fence-flow.html` (frames 1–4) and `areas-flow.html` (frames 9–12)

## 1. Intent

The scene is opened in two moments: walking the home with a phone or tablet, and presenting to the homeowner at the table. On the walk the rep records what stands today. At the table the rep picks what Tri Pros builds.

The lot's fences and ground can be drawn today, but only from the lab's own side panel, with brush rows and two cards that exist nowhere else in the scene. The owner's look on 2026-11-05 liked the fences and corrected how they are reached. This project moves the lot into the scene's own Controls: the walk's facts go under Property facts, and the build is picked from Areas, the way a roof upgrade is picked.

Owner's words:
- "We open this through walking the home (on our phone or tablet while walking), as well as while presenting to the homeowner. I like what we have for setting each side of the fence as a whole."
- "Landscaping should be per zone (backyard/frontyard/left right sideyards). We should have grass condition as well."
- "Way too many inputs that look the same (drowning in inputs). We should aim to reuse our other inputs. Also we're assuming too many things (that the yards are landscaping and driveway/entrance is hardscaping) … this is something that is configured in the 'lot' backyard/frontyard areas (where we can draw the landscaping/hardscaping and give each section a wear rating). The Property facts should serve as 'what is the base of the area', could be landscaping or hardscaping as well as choose a starting condition (this 'fills' the initial area's canvas)."
- "The hierarchy should be Area -> systems -> individual upgrades, and area groups should be home exterior / home interior / lot … the systems are applied per area, so 'lot' is too general for the landscape system (as we often do 'only backyard' or 'only frontyard')."
- "I do want a predictable standard for ALL our systems … We don't end up with 5, 6, 7 different types of cards that all reimplement the same logic."
- 2026-11-06, closing the brainstorm: "Let's forget the idea of the tabs for now and build what we have. We'll tweak it as we go."

## 2. Goals, non-goals, anti-goals

**Goals**
- Home facts becomes **Property facts**. Its Lot tab holds, per yard, the yard's base ground and starting wear, and the four whole-side fence pickers the owner likes.
- Systems becomes **Areas**. The rail gets three groups: Exterior, Interior, Lot. Exterior holds today's six systems, unchanged. Interior is empty and shown as coming. Lot holds the four yards.
- A yard has a card with the system card's shape: a Today row and a Tri Pros build row, one chip per system present. The systems of a yard are Landscaping, Hardscaping, Fencing and Patio cover (a placeholder here).
- Ground carries **wear**, on the home's five steps (New, Good, Fair, Worn, Failing), set per yard base and per drawn region, and drawn in the scene at every step.
- Drawing starts from the yard card and is steered from a bar on the scene, not from the lab panel's brush rows (R235).
- A press near a lot line while drawing a fence lands on the lot line and the drag runs along it. No press in draw mode ever turns the camera (R234). A fence inside the lot is still drawn on any grid line.
- A fence or a drawn region is removed in one action that clears it from Today and from the build (R233).
- The default lot still draws exactly as it does now. The parity shots hold; the right side yard's lower rail is the one known, measured difference from before the fences work.

**Non-goals (this project)**
- Tabs on cards. The owner raised them on 2026-11-06 as a later way to hold more per area, then parked them the same day. Nothing here should make them harder.
- Re-cutting the six exterior systems into areas and systems. An exterior system counts as an area that holds one system; its card does not change.
- Anything inside Home interior.
- Patio cover as a drawn rectangle (project 3). It appears here only as an inert "soon" chip and a "soon" tile.
- Persistence beyond the URL (project 4).
- Property enrichment from the address (R237–R241), which fills Lot size later.
- Wear on fences. The fence chip shows the kind only.
- Property stressors (earthquakes, heavy rain, wind, mold) and seasons acting on the landscape. Wear is stored as the baseline; those arrive later as modifiers at draw time and must not need a second stored condition.
- Pricing, proposal lines or new catalog links from lot picks. The catalog links the ground materials and fence kinds already carry stay as they are.
- New fence kinds, heights, diagonals or curves.

**Anti-goals**
- A wall of look-alike inputs. The Lot tab holds eight inputs of two kinds, and every chip, pill and menu is one the Controls already have.
- A second kind of card. The yard card is the system card's shell and rows. If a piece of the system card cannot serve a yard, that piece is widened, not copied.
- Deciding for the rep what a yard is made of. Nothing assumes a yard is lawn or a driveway is concrete; the base and the drawn regions say so.
- A press in draw mode that turns the camera.
- Any change to the default lot's picture.

## 3. Vocabulary (proposed; the owner agrees the words before code uses them)

- **Area** — a place on the property that systems are applied to and that has one card. On the lot the areas are the yards. On the exterior each of today's systems is its own area. ⚠️ `CONTEXT.md:155` lists "area" under Region's _Avoid_, pointing at Home facts' Area tab. With this word agreed, that note changes to "area (a place holding systems, see Area)". _Avoid_: zone, section.
- **Area group** — Exterior, Interior, Lot: the rail's switch. In full: Home exterior, Home interior, Lot.
- **Yard** — a lot area: Front yard, Back yard, Left side yard, Right side yard. Derived from the main mass, never stored (§4).
- **System** — unchanged for the home (`CONTEXT.md:125`). On the lot: Landscaping, Hardscaping, Fencing, Patio cover.
- **Base** — the ground and wear a yard starts from, set in Property facts. Every tile of the yard that no drawn region covers shows the base.
- **Wear** — the existing five-step scale (`Wear`, `WEAR_LABELS`), now also on ground.
- **Region** — keeps its agreed meaning and word (`CONTEXT.md:155`), in code and on screen. The owner said "section" in passing; the glossary lists "section" under _Avoid_, so the screen says Region until the owner rules otherwise (call 3).
- **Fence line**, **Perimeter**, **Fence kind**, **Front yard cap** — unchanged.

Known clash, left for the owner to name: the facts window keeps a tab called "Area" (Coastal or inland, Utility, Wind) beside a Controls section now called "Areas" (call 9).

Second known clash, for project 4: the sibling branch's glossary defines **Property facts** as the facts about a home that never change, one set per customer, and the starting point of every build. This design puts each yard's base ground, starting wear and whole-side fences on the Property facts Lot tab, as the owner asked, because they are the fill a build starts from. Where they are saved, with the property or with the build's layout, is decided when persistence is designed.

## 4. The model

**Yards.** A yard is derived from the layout's main mass and the lot's grid, the same way `isFrontYardCell` already reads the front yard:
- Front yard: tiles in rows nearer the street than the main mass's face.
- Back yard: tiles in rows beyond the main mass's back.
- Left and right side yards: tiles in the main mass's rows, left and right of it.
- A tile under any mass belongs to no yard. A yard with no tiles (a house built to a lot line) has no rail chip and no row in the Lot tab.

**A yard's fences.** A fence belongs to every yard whose tiles it touches, so a fence on a line two yards share belongs to both. A yard's **lot-line fences** are the perimeter cells that run along the yard's tiles, gates left out. The yard's Fencing chips read and write the lot-line fences only. Gates, fences inside a yard and fences on a line between two yards are changed by tapping them or by drawing.

**Regions stop at the yard line.** Two tiles are one region when they share the (today, build) pair, the wear and the yard. A bed that crosses a yard line is two regions, one per yard, so a pick or a Remove in one yard never changes another. This narrows today's rule (`sameRegion` in `lib/lot-regions.ts` knows no yard): the default lot's left mulch bed, which runs one row into the left side yard, becomes two regions with their own square feet. The picture must not change.

**A system is read from the material, never picked.**
- Landscaping: sod, bare dirt, mulch, gravel, artificial turf, decomposed granite, river rock.
- Hardscaping: concrete, pavers, asphalt.
- Pool belongs to neither. It can be drawn and tapped, shows no system chip, and carries no wear.
- Fencing: every fence kind.

**Base.** Each yard has a base: one existing ground material and one wear. Changing the base changes every tile of the yard that is not part of a drawn region, and leaves drawn regions alone. Removing a drawn region returns its tiles to the base. A base can be any existing ground material except pool. Nothing marks a tile as drawn: a tile is base when its material and wear equal the yard's base, and a drawn region otherwise (call 23). Known limit: a region that comes to equal the base, because the base was set to match it, is base from then on and follows the next base change; Undo covers the step.

**Wear on ground.** One wear per yard base and one per drawn region, describing the Today ground. Ground the build keeps shows that wear in both views, as a kept part of the home does. Only what the build installs draws New. Bare dirt and pool carry none. The default layout carries the step whose look is today's picture, so parity holds (call 6 names it Good).

**One truth per fact.** The four whole-side pickers and the yard's fence chips write the same fence maps. The Lot tab's base chip and the yard card's base chip write the same base. Nothing is stored twice.

**Storage is the builder's**, inside these limits: the layout stays one `PropertyLayout` carried by the URL codec within `LAYOUT_URL_MAX`; a link made before this project still opens and draws as it did; regions stay derived, never stored; undo, re-tile and Reset cover the new data as they cover tiles and fences. A stored per-yard base with tiles that either follow it or override it is the shape this design assumes, but any shape that gives the behaviour above is acceptable.

## 5. Property facts

- The Controls section `facts` reads **Property facts** everywhere it is named, including the missing-facts count.
- The **Lot tab** stops being two "soon" tiles and holds:
  1. **Yards today** — one row per yard: the yard's name, and one chip showing the base ground and its wear. The chip is the one a home material uses; its menu lists the existing ground materials grouped Landscaping and Hardscaping, then Condition with the wear dots. (Frame 11.)
  2. **Fences today** — the four whole-side pickers (`LotPerimeterFields`), moved here as they are, with the front-yard cap rules they already have. They leave the lab panel.
  3. Two "soon" tiles: Patio cover, Lot size.
- The other three tabs do not change.

## 6. Areas

**The rail.** A three-way switch, Exterior, Interior, Lot, then that group's chips.
- Exterior: the Year built chip and the six system chips, behaving as today.
- Interior: shown, dimmed, not selectable.
- Lot: one chip per yard, in the order Front yard, Back yard, Left side yard, Right side yard. A yard's chip carries the build dot when the build changes anything in that yard, the same dot a system chip carries.
- Choosing a yard outlines it in the scene and opens its card. (Frame 10.)

**The yard card** uses the system card's shell: tile, title, the "Showing today" or "Showing the build" tag, close, and the two rows with the dimming rule for the side the scene is not showing.
- **One rule for every yard chip:** a yard chip acts on the yard's whole share of its system; a tap in the scene acts on one thing.
- **Today row.** One chip per system the yard has today, as frame 10 drew it: Landscaping, Hardscaping, Fencing. A ground chip covers every tile of the yard whose Today material is of that system, the base included. It shows the material and wear when they are all the same and "Mixed" when they differ. Its menu lists that system's existing materials and Condition; a pick sets all of that ground at once. The Fencing chip covers the yard's lot-line fences: the kind when they are all one kind, "Mixed" when they differ, an add chip when there are none. A pick sets every lot-line fence standing along the yard; on a yard with none it stands that kind along the yard's lot lines. The front yard offers only the kinds its cap allows.
- **Tri Pros build row.** One chip per system: Landscaping, Hardscaping, Fencing, and an inert Patio cover chip marked soon. A ground chip's menu lists that system's proposed materials and "Keep what is there". A pick writes the build layer of every tile that is of that system today, the base included, so lawn to turf for a whole back yard is one pick. The chip shows the one material the build puts on all of that ground, "Mixed" when the build covers only part of it or differs across it, and an add chip when the build changes none of it. The material shown may belong to the other system: pavers proposed over lawn read "Pavers" on the Landscaping build chip, since Today's material decides the chip, and the chip's menu still offers Landscaping's list. The Fencing chip does the same over the yard's lot-line fences standing today, and shows a kind outside its cap (a block wall drawn on the front yard's line) by name. Nothing is stored for a pick beyond the tile and fence maps.
- A system the yard does not have today shows an add chip in the build row. It starts drawing in the build view with that system's first material or kind on the bar (§7).
- A change of system, such as pavers over lawn, is made on one thing: by drawing a region in the build, or from a focused region's build chip, whose menu lists every proposed material. Today's material decides which yard chip that ground sits under.
- **One action line.** "Draw a region" and "Draw a fence".
- The card holds no "Look inside".

**A tap in the scene.** A lot tap acts only while Areas is open on the Lot group. There, a tap on lot ground or on a fence does not close the section; it opens the card of the yard it is in. A tap anywhere else, the house, the street or a neighbour, closes the section as today. With the Controls closed, or open on anything else, a tap does what it does today, so a stray tap while turning the scene never opens a card. Double-tap keeps its meaning. A tap on a region or on a fence focuses the card on that one thing (frames 12 and 4):
- a line naming it: its system and area for a region, its side and length for a fence;
- its Today chip and its Tri Pros build chip, which change that one thing only;
- **Remove**, which clears it from Today and from the build in one undoable step. A removed region's tiles return to the base. A fence standing on a line two yards share is removed for both;
- **Whole yard**, which returns to the yard card.
- A tap on base ground opens the yard card unfocused. A fence on a line two yards share opens the yard on the tapped side.

**Where it shows.** The Lot group, the Lot tab's inputs and the draw bar need the lot as data, which today only the lab route has. Where the lot is not data, the rail shows no switch and the Lot tab keeps its "soon" tiles. The two renames apply everywhere.

## 7. Drawing

- "Draw a region" and "Draw a fence" on a yard card start drawing. A **draw bar** appears at the top of the scene: the word Drawing, a chip naming what is being drawn with a menu to change it, Undo, and Done. (Frame 3.)
- The bar's menu lists ground materials for a region, and fence kinds with gates for a fence. What it offers and which layer a stroke writes follow the view the scene is showing: Today draws what stands today, the build draws what Tri Pros installs.
- The menu ends with the eraser for that view, so part of a thing can still be cut away as the brush rows allowed. On Today: "Back to base" for ground, which returns the tiles to the yard's base, and "No fence" for a fence, which opens a gap. On the build: "Keep what is there" for both, which clears the build from those tiles or cells.
- A region drawn on Today takes the wear Good until changed.
- While drawing, the camera does not move at all: no press, drag, pinch, wheel or double-tap moves it (owner 2026-11-06, call 22). Done, Escape and the D key end drawing and hand the camera back, and so does leaving Areas by any other door (Property facts, Modify, Benefits, the M key). Escape steps back one layer at a time: a menu, then drawing, then the focused thing, then the yard, then Areas.
- **The lot-line magnet.** With a fence on the bar, a press within about one tile of a lot line, on either side of it, on the fence already standing there or on the ground beside it, starts the stroke on that lot line, and the drag runs along that line only. A press further inside the lot follows the nearest grid line, as today. The band lights while a fence is on the bar.
- Drawing is not limited to the yard it was started from.
- Strokes, undo and the URL write behave as they do now.

## 8. The lab panel

The lab's side panel keeps its title and the Layout section: Undo, Reset, Copy link, and the too-long note. The Mode toggle, the brush picker with its ground and fence rows, the Region card, the Fence card and the Fences section leave it; their jobs are §5, §6 and §7. Components and copy left with no caller are deleted in the same change.

## 9. Wear in the scene

Every existing ground material that carries wear draws all five steps wherever the Today ground shows: on Today, and on the build where the build keeps that ground.
- Sod: New and Good are a full lawn; Fair thins; Worn shows dry and bare patches; Failing is mostly dry with dirt showing.
- Concrete, asphalt and pavers: New and Good are clean; Fair shows light stains; Worn shows cracks and stains; Failing shows heavy cracking and broken patches. Flat marks only, no change to the ground's height.
- Mulch, gravel, artificial turf: at least a visible fade from New to Failing.
- Colours come only from `LOT_PALETTE` and `HOME_PALETTE`; a new colour is added there.
- The Good step of every material is today's look, so the default lot does not change.

## 10. Phones and tablets

The new inputs sit inside the Controls and follow the narrow and portrait behaviour the Controls already have; the yard card docks where a system card docks. The rail scrolls sideways when it is wider than the stage, as it does today. The draw bar fits a 390 px stage: its chip may shorten to the material or kind alone. No new layout system.

## 11. Checks and the owner's look

- `pnpm tsc` and `pnpm lint` clean. Never `pnpm build`. The four check scripts under `scripts/verify-*.ts` that cover the scene pass.
- The default lot's parity shots and draw-call count match a baseline taken on the owner's dev server (port 3003) before the first edit, all pairs.
- On `/dashboard/trade-scene`, where the lot is not data, the rail shows no switch, the Lot tab keeps its soon tiles, and nothing throws.
- Probes in the lab's Playwright style, signed in through `/api/dev/playwright-session`:
  - a press-and-drag along each lot line, from four camera turns, with a fence on the bar: every one a stroke, none a camera turn (the existing `press.mjs` shape);
  - Remove on a fence and on a region: gone from both layers, one Undo brings both back;
  - a base change leaves a drawn region's material and wear alone; Remove region returns its tiles to the base;
  - a link made before this project opens and draws as before.
- Screens captured for the owner at tablet and phone widths: the Lot tab, each yard card on Today and on the build, a focused region, a focused fence, the draw bar with the lit band, and sod and concrete at all five wear steps.
- Only the owner starts the dev server. No database writes.

## 12. Left to the builder

- How the base, the wear and the drawn-or-base distinction are stored and encoded, inside §4's limits.
- How the chips are fed: lot slots shaped like the home's change slots, or the chips' props widened. Either way the chip components are reused, not forked.
- The magnet band's exact width and how the lit band is drawn.
- How each wear step is drawn (texture, decal or shader), inside §9.
- Phasing. A sensible order: yards and the Areas rail with the yard card on existing data; the Lot tab with the moved pickers and the base; wear as data and picture; drawing from the card with the bar, the camera hold and the magnet; the focused card with Remove; the lab panel cut down.

## 13. Calls made in this design (Claude's; the owner can overturn any)

1. Fencing goes per yard, read from "As a starting point, I like this" on frame 10. The whole-side pickers stay as the first fill in Property facts. Frame 2's lot-wide Fencing card is superseded.
2. The yard card and the focused card are one card with two states, as frames 10, 12 and 4 drew them. The tab idea is parked.
3. The screen says Region, the glossary's agreed word, though the owner said "section" in passing.
4. A system is read from the material; nobody picks Landscaping or Hardscaping.
5. Bare dirt and pool carry no wear; pool belongs to no system.
6. Good is the step that looks like today's picture, and the step a newly drawn region starts at.
7. No wear on fences in this project.
8. Drawing writes the layer the scene is showing.
9. The facts tab "Area" keeps its name for now, clash noted in §3.
10. The rail's switch reads Exterior, Interior, Lot.
11. The lab panel shrinks to Undo, Reset and Copy link; Undo is also on the draw bar.
12. On routes where the lot is not data, the Lot group and Lot tab inputs do not show.
13. The D key and Escape end drawing; D no longer starts it, since drawing now starts from a yard card with a thing chosen.

Added after the builder check, 2026-11-06:

14. A yard chip acts on the whole yard's share of its system, base included, on Today and on the build alike. A pick is a repaint of the tile or fence maps; no per-yard pick is stored.
15. The Today row has one chip per system, as frame 10 drew it, reading "Mixed" when that ground differs. It is not one chip per region.
16. Regions stop at the yard line.
17. The yard's Fencing chips cover its lot-line fences only and never touch a gate. Gates, inside fences and fences between two yards are changed by a tap or by drawing. This is the call most worth the owner's eye: it decides what "fence the back yard" does in one pick.
18. The draw bar keeps an eraser per view: Back to base, No fence, Keep what is there.
19. Ground the build keeps shows its Today wear in the build view.
20. A lot tap opens a yard card only while Areas is open on the Lot group.

Owner rulings from the stress test, 2026-11-06:

21. The build merges `feat/trade-scenes-foundation` into the lab branch first (a merge, never a rebase). That branch's tap claim is the mechanism a lot tap uses; the plan's own press tracking is dropped.
22. The camera freezes wholly while drawing: orbit, pan, pinch, wheel and double-tap. On the tweak list for the first look on a phone.
23. No drawn mark is stored; a tile equal to its yard's base is base. The known limit is in §4.

Claude's calls from the stress test:

24. The renames reach every string, the fourth check script `scripts/verify-trade-scene.ts` and the probes' button name. That script joins the plan's file list for its copy and Escape assertions only.
25. A build chip reads "Mixed" when the build covers part of its ground, and a chip names a value outside its own list rather than going blank (§6).
