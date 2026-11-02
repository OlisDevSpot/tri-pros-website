# Exterior paint wear kinds: design

> **Status:** written 2026-10-30 from the owner's brainstorm and field photos; builder-checked the same day (calls 7–9 in §6 came from it); the owner's answers folded in (§3.6, §3.7, §10); approved by the owner 2026-10-30 (`4206462ab`). Plan `docs/superpowers/plans/2026-10-30-exterior-paint-wear-kinds.md` stress-tested the same day; its rulings are §10.4–§10.5 and the amended §6.2, §6.6, §7. No code yet.
> **Branch:** `feat/trade-scenes-foundation` (worktree `.worktrees/trade-scenes`). Builds after the TS3b.4a fixes (`docs/superpowers/specs/2026-10-30-ts3b4a-fixes-design.md`), which give walls, gables and parapets one paint look (`ui/lib/paint-look.ts`) and touch `house-shell.tsx`.
> **Requirement:** R121 in `docs/plans/2026-10-16-trade-scenes-epic.md`.
> **Binds:** `CONTEXT.md` for vocabulary.

`F` = `src/features/trade-scenes/`.

## 1. Why

The trade scene is the meeting's product-benefits presentation (R118). Worn exterior paint today shows two things: a chalky fade (`WEAR_LOOKS.paint.chalk`) and hairline stress cracks from Worn on (`lib/stucco-cracks.ts`). The owner likes the cracks. But real worn paint also stains and peels, and homes differ in the mix: one has heavy sprinkler stains, another peels at every sill. A homeowner who sees *their own* walls in the scene believes the paint pitch. The rep needs to make the walls match the house they are sitting in, quickly, without the scene turning into a haunted house.

## 2. Goals, non-goals, anti-goals

**Goals**
- Worn paint shows three kinds of wear besides the fade: **Cracks**, **Stains** and **Peeling**.
- Each kind has its own amount, which the rep can set on its own.
- Condition still sets the overall picture: it sets the fade, and it gives each kind a starting amount that worsens step by step from Good to Failing.
- What shows from whole-house distance looks like the owner's field photos (§4).

**Non-goals**
- Changing any heat figure, reading, load or bill cut. Wear never changes a heat figure (CONTEXT.md, Wear).
- Wear kinds for any other material (roof, windows, ducts). Paint only.
- Rust, scuffs, efflorescence, grime in the texture, corner-bead splits, impact gouges: real, but close-up only in the photos (§4.3). Not drawn this round.
- Up close on the walls system (TS3b.4b). The look must be reusable there (R120: up close draws the home's own state), but building that view is not this project.
- Storm or time-lapse wear (TS3b.7, home stress).

**Anti-goals**
- **Overdone.** Heavy on every kind must still read as a neglected house, not a ruin. Peeling comes in small clusters, never whole sheets.
- **Lever soup.** At most three settings for paint wear, never one per stain type (owner: "up to 3 should suffice").
- **Marks that move.** A stain or flake never jumps when an unrelated input changes (weather, view, another material).
- **Wear on new paint.** The Tri Pros build's paint is clean, whatever the old amounts were.

## 3. Owner decisions

1. **Three kinds, each its own amount.** Cracks, Stains, Peeling. "Discoloration" is split by cause into the stains in §4.1, all under one Stains setting.
2. **Independent amounts with starting values.** Condition sets a starting amount for each kind. The amounts get progressively worse with Condition. The rep can change any kind on its own (a Fair home can carry heavy stains).
3. **Peeling goes on the stucco too**, not only on painted wood.
4. **Condition stays the one main pick**, on the Current materials tab's Exterior paint row, as today.
5. **The cracks as drawn today are good.** They are the Cracks kind; keep their look.
6. **The raised foundation wall is painted wall.** It always takes the wall's colour and the wall's wear, the way the gables do (one paint look, `ui/lib/paint-look.ts`): the fade, and all three kinds, so the splash band sits at grade where the sprinklers hit. A paint job paints it with the walls and the Tri Pros build draws it clean. This replaces the foundation wall's own tan (`HOME_PALETTE.crawlSkirt`, which then has no use; the grey tried on 2026-10-30 was reverted before this ruling). The slab edge and the steps stay concrete.
7. **The rep's own settings are never reset** by a Condition change. Only the rep changes them.

## 4. What the field photos show

Seven photos of worn SoCal stucco homes (owner, 2026-10-30), read by three reviewers. Every finding below was seen in at least one photo.

### 4.1 Reads from whole-house distance (draw these)

| Kind | Wear | Where | Look |
|---|---|---|---|
| Fade (Condition) | Chalking, uneven fade | Every wall, palest on the sun side | Flat, dusty, paler; some walls blotchy, soft cloud-shaped patches up to ~1 m, no edge |
| Stains | Splash band | Bottom 15–60 cm of every wall, heaviest near planters, sprinklers and yard-facing corners | Warm muddy ochre-brown, darkest at grade, fading upward with no line; a thin dark grime line right at grade |
| Stains | Runoff streaks | Below window sills, ledges, caps; faintly below the eave | Vertical brown-orange streaks 10–30 cm wide, feathered edges, fading out top and bottom |
| Stains | Dirty ledges | Top faces of sills, bands and ledges | Grey and dusty, or bleached paler than the wall |
| Peeling | Peeling at the foot of trim | Door jamb and posts, lowest 30–40 cm, at the slab | Paint gone, grey-brown weathered wood, ragged crisp edges, flakes lifting; from afar a small dark patch |

### 4.2 Close-up only in real life, drawn a touch larger so they read

- **Cracks**: thin dark lines wandering off window and door corners, and splits along outside corners. Already drawn (`stuccoCracks`), already exaggerated; the owner likes it.
- **Chipping**: thin strips of paint lost on sharp trim edges; small chips at the base and corners.
- **Peeling on stucco**: none in the photos. The owner wants it. It belongs where water gets behind the paint: the base of the wall, just under window sills, and the outside corners.

### 4.3 Seen but not drawn

Rust spots on the steel door, scuffs, grime caught in the texture, white powdery patches (efflorescence), fist-sized impact gouges at the base.

### 4.4 Not wear (never copy)

Roof and patio shadows; the speckle of raking sun on the stucco texture; reveal shadows; fixture holes from removed lights (only the drips under them are staining); reflections; stains on the slab or paving rather than the wall.

## 5. How it behaves

- **Condition → starting amounts.** Each kind has a starting amount for each Condition step. A draft (my call, to tune by eye):

  | Condition | Cracks | Stains | Peeling |
  |---|---|---|---|
  | New | none | none | none |
  | Good | none | light | none |
  | Fair | light | light | none |
  | Worn | moderate | moderate | light |
  | Failing | heavy | heavy | moderate |

  Worn's moderate cracks are today's look at Worn. Failing's peeling stops at moderate on purpose: heavy peeling is a rep's call for a house that really looks like that.
- **Rep override.** Each kind can be set to its own amount. Unset kinds follow Condition.
- **Fade follows Condition only**, as today. It is not one of the three settings.
- **The Tri Pros build** (any paint scope installed, regular or Cool Life) draws clean paint: no fade, no cracks, no stains, no peeling.
- **Stable placement.** Every mark is placed from a fixed seed per surface, like the cracks today, so a mark at Moderate stays put at Heavy and more join it.

## 6. My calls (the owner can overrule while reading)

1. **Amounts are four steps, None / Light / Moderate / Heavy**, not a free slider. Four steps are quick to tap and easy to say out loud to a homeowner.
2. **The controls sit under Condition on the Exterior paint row**, three rows of the stops-on-a-track control the panel already uses for ordered choices (`ScaleField`, as Insulation level; owner, 2026-10-30, over the slim pill first proposed here). They show only when Condition is past New.
3. **Which surfaces each kind touches.** Cracks: walls, gables, parapets and the raised foundation wall (as today, now also Fair). Stains: walls and the raised foundation wall (splash and runoff are wall-height things; on a raised home the splash band sits on the foundation wall at grade), plus sill tops. Peeling: walls and the raised foundation wall (base, under sills, outside corners), the door frame, and the fascia. **Window frames never peel**: SoCal frames are aluminium or vinyl, unpainted; their wear stays with the Windows material.
4. **The fascia and door frame follow the paint's Peeling**, not the roof's or the windows' condition: an exterior paint job paints the trim and fascia.
5. **Stored as overrides beside the wear.** `HomeMaterialFacts` (`src/shared/modules/construction/core/types.ts`) gains a record of the kinds the rep has set; a kind that is not recorded follows Condition. This matches how `wear` itself works: unrecorded means the era's guess.
6. **Under the Thermal lens the marks step aside**: the lens paints temperatures, and a stain is not a temperature. They are hidden while the lens is on, not repainted: the lens turns a see-through textured mesh into a flat decal in its zone's colour (`ui/lib/thermal-paint-set.ts`), so a stain left to it would still show as a pale cloud.
7. **Sill tops and the streaks under them belong to the paint**, not the windows. In SoCal the sill under a window is stucco or foam, painted with the wall (field photo 2). The drawn sill ledge stays in the window's `frames` mesh (`windowBoxes`, `SILL_LEDGE`); its dirt is a paint mark laid on top and merged with the paint's marks. New windows over old paint keep the dirty sill and the streak; a paint job cleans both.
8. **Placement is pure and per wall.** Marks are placed by a pure function of the wall (or other surface), its seed and the level, in the pure tier like `stuccoCracks`, so a later up-close slice of a wall can draw the same marks in the same places (R120). The walls are not in R119's first up-close round, so only the placement has to be reusable now, not a drawing path for up close.
9. **Only the rep's own reset clears the kinds** (owner decision 7). A Condition tap, Condition set to New, a Year built change, and switching the existing paint between Regular and Cool all keep them. At New they are kept but neither drawn nor shown (§5: New shows nothing), and come back if the rep steps Condition up again. Going back to the era guess is the rep asking for a reset, so it clears them with the recorded Condition (`home-material-patch.ts`).

## 7. Constraints from the code

- **Walls are flat-colour merged boxes** (`MergedBoxes` in `house-shell.tsx`; colour from `paintLook`). Soft gradients (the splash band, streaks, blotchy fade) need something the boxes do not have today: vertex colour, a small generated texture, or a shader term. Whatever is used must stay matte and in the warm palette (`constants/home-palette.ts` header).
- **The Thermal lens repaints materials** by thermal tag (`thermalTag`, `ui/lib/thermal-paint-*`), and **view fades** run Complete ↔ Partly open as one sheet (`ui/lib/fade-sheets.ts`, `HOME_FADE_TAGS`). New marks must fade with their wall and must not break either.
- **The front wall** is drawn separately and only in Complete (`FRONT_STUCCO`, `HOME_FADE_TAGS.complete`); its marks follow it.
- **Frame time.** TS3b.3 brought draw calls from 145 to 63 and the frame-time check on iPad is still owed. **Draw calls (owner, 2026-10-30):** marks merge per fade group, not per kind or per surface: one marks mesh and one stains mesh per fade group, and one marks mesh per fascia. The stress test first set a 10% cap; the owner then accepted the estimated overage on the raised pitched home (about +9 calls on 63, roughly 14%) for now. The build measures and records the worst case (Failing, every kind Heavy, Complete) against its base commit and does not stop on it; if performance degrades, the owner revisits it.
- **View fades own each material's opacity.** `applyGhost` records a material's first opacity and writes it back on every scan, at rest too (`ui/lib/apply-ghost.ts`), so a mark's strength cannot ride on its material's opacity.
- **Seeded placement** exists (`lib/seeded-random.ts`). `stuccoCracks`'s opening margin reads `wall.openings` only, and `FRONT_WALL.openings` leaves out the front door (it joins in `house-shell.tsx`'s `FRONT_OPENINGS`), so marks on the front wall must be given the door.
- **Wear tiers** live in `constants/wear-looks.ts` (`WEAR_AMOUNT`, `WEAR_LOOKS.paint`); the paint look in `ui/lib/paint-look.ts`; the pure tier is guarded by `verify-trade-scene`.
- **Write rules** for materials live in `lib/home-material-patch.ts`; a kind override is one more change kind there.

## 8. Vocabulary (agreed, in CONTEXT.md)

- **Paint wear**: the three kinds of wear on exterior paint besides the fade: `cracks | stains | peeling`. On screen: Cracks, Stains, Peeling. _Avoid_: damage, defects, condition (Part condition owns it), wear alone (Wear is the five-step Condition).
- **Paint wear level**: how much of one kind a home shows: `none | light | moderate | heavy`. _Avoid_: amount in code (`WEAR_AMOUNT` is the numeric Condition share), severity.

## 9. Left to the builder

- How the gradients are drawn (§7), and the colours and sizes of each mark, tuned by eye against the field photos in both schemes.
- Mark counts per level, and how a level maps to them.
- The exact placement rules inside the zones in §6.3.
- Screenshots at the four lab sizes in both schemes, each kind alone at Heavy and the defaults at each Condition, before the owner's look.

## 10. Owner answers (2026-10-30)

1. The raised foundation wall takes the wall's paint and wear (§3.6).
2. The rep's own settings are never reset by a Condition change (§3.7, §6.9).
3. The words in §8 are agreed and in `CONTEXT.md`.
4. The level rows use the stops-on-a-track control (§6.2), from the plan's stress test.
5. Draw calls (§7): the stress test set a 10% cap; the owner then accepted the estimated overage on the raised pitched home for now. Measure and record; revisit if performance degrades.
