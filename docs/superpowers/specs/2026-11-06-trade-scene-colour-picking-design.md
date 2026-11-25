# Trade scene colour picking: roof, paint, window frames

**Status:** approved by the owner 2026-11-06; plan `docs/superpowers/plans/2026-11-06-trade-scene-colour-picking.md`. Brainstormed 2026-11-06 (R267). Epic: `docs/plans/2026-10-16-trade-scenes-epic.md`.

## Intent

In the in-home meeting the rep dives into one system of the house (the roof, the paint, the windows) and says "look, here are the colours we can pick from". The scene repaints as they tap. Today only the cool roof has colours, and the picker gets lost: picking "tear-off" closes the roof menu, and the rep has to know to reopen it. Its colours are also wrong for a standard tear-off. Duration COOL and COOL Plus are the cool roof line, but with the cool roof switched off Tri Pros installs generic asphalt shingles from its distributor.

This work gives the roof, the exterior paint and the vinyl window frames a colour pick each. They live where the rep already is, inside the menu of the work, shown the moment the work is picked.

**For now a pick is a showcase:** "look at everything you'll get to choose". Nothing is saved, and nothing reaches a proposal. That comes later (tracker T21, after the saved Build of TS4).

## Goals

1. Picking a piece of work that has colours shows its colours at once, in one place, with no added tap. The rep never reopens anything to find them.
2. The efficiency switch that changes the colours moves into those details, beside them: the cool roof with the roof covering, Cool Life with the repaint.
3. The roof shows the right shingle line for the switch:
   - cool roof on: Duration COOL and COOL Plus, as today;
   - cool roof off: the three standard colours.
4. Paint takes two colours, **body** and **trim**. The rep gets there by a popular combo, by customising a combo, or by picking each part freely.
5. Window frames take one of three vinyl colours.
6. The Today side can take the home's actual current paint colours (body and trim), so the before and after look like their home.

## Non-goals

- Saving picks, or carrying them into a proposal (T21; depends on TS4's Build, R260–R271).
- Colour changing the bill cut. Amended R117: the Cool Life rep puts the difference within about 1%, so it is not modelled until there is better information.
- Moving the R-8 ducts or R-38 insulation switches into their menus. The owner may decide that later.
- Colours for torch down (cool or not).
- A painted trim band around windows. Some homes have paintable wooden window frames; ignored for now.
- Changing the envelope material (stucco, wood siding; tracker T22). The paint pick is written for stucco today and should not block T22.
- Entering a colour from the Cool Life fan deck into the scene. The fan deck is a link to show the full range, nothing more.
- Today-side colours for the roof or the window frames (builder's call below; ask the owner if it looks wrong).

## Anti-goals (a failure even if it works)

- A colour pick the rep can lose again: hidden behind a closed menu, or shown only after a second tap.
- Brand names on the standard shingles. The distributor's line is generic; we only match Owens Corning's colours.
- Cool roof colours shown on a roof whose cool roof is off, or the reverse.
- Pickers that look bolted on. They must use the trade-scene controls' own chips, menus, pills and tokens (`CONTROLS_CLASSES`, `ChoicePill`, `ValueMenu`, the design-system tokens). The brainstorm sketches only settled the approach, not the look.
- Dark paint trim turning the window frames dark. Paint trim and vinyl frames are separate colours.

## What the owner decided

### Where the details appear (owner, 2026-11-06: "go with rec")

The Build side has two kinds of chip for a piece of work. A **menu** is used when a row has two or more scopes: today only a shingle roof, with overlay and tear-off. A **one-tap toggle** is used when it has one: repaint, window replacement, tear-off on a wood-shake roof, torch down on a flat roof (`system-card-body.tsx`, `row.scopeIds.length === 1`). Both kinds get the details, and neither gains a tap:

- **Toggle chips:** turning the chip on opens a small details panel under it, holding the colours and the switch. The chip stays one tap.
- **The shingle roof menu:** picking overlay or tear-off keeps the menu open, and the details appear under the pick, below the menu's existing separator.
- **Work without details** behaves as it does today. Picks close the menu and toggles only toggle.
- **Same look in every place:** the details panel and the in-menu details are one shared piece, so the rep sees the same thing whichever chip it was.
- **The switches move.** The cool roof switch moves from its own chip into the roof covering's details. The Cool Life switch moves from its own chip into the repaint's details. Each sits with the colours it governs.

### Roof

- **Cool roof on:** the current picker. The Duration COOL / COOL Plus line pill, the swatches, and the aged SRI line under the swatch.
- **Cool roof off:** three standard colours, no line pill and no SRI line:

  | Name | Hex | Matches |
  |---|---|---|
  | Dark brown | `#685347` | Owens Corning Forest Brown |
  | Grey brown | `#686359` | Owens Corning Summerwood |
  | Light brown | `#8D7D6B` | Owens Corning Sand Castle |

  The distributor's bundles are only "very similar" to these, so the swatches are screen approximations, as the Owens Corning ones already are.
- **Flipping the switch keeps a sensible colour:**
  - Forest Brown ↔ Dark brown, Summerwood ↔ Grey brown, Sand Castle ↔ Light brown;
  - any other cool colour falls back to nothing picked.

### Paint

- **What gets picked:** two colours, body and trim. A combo is a shortcut that sets both; it is not a third colour. Which combo the colours came from is remembered for the open scene, so "Custom, from Light & dark" survives closing the details (owner, 2026-11-06, at the plan's stress test).
  - **Body:** the walls, gables, parapets, raised foundation wall (crawl skirt), and the garage walls.
  - **Trim:** the fascia and rake, the low-slope coping and front fascia, the front door frame, and the garage door trim and fascia.
- **Popular combos (four):**

  | Combo | Body | Trim |
  |---|---|---|
  | Light & dark | Cotton Ball `#f4eedf` | Black Licorice `#474848` |
  | Tan & dark | Tailored Tan `#bea182` | Brown Suede `#62584c` |
  | Dark & light | Deep Space `#4f5d5d` | Sugar Dust `#f6f4ea` |
  | Colourful | In the Blue `#a0b2bc` | Sugar Dust `#f6f4ea` |

  The owner approved the four kinds of combo. The exact colours in each are a starting point he can change at the iPad look.
- **Customising and the header line:**
  - After a combo, the rep can change the body or the trim on its own.
  - The menu then says where the colours came from ("Custom, from Light & dark") rather than marking the combo picked.
  - Without a combo, it reads as each part picked.
- **Colour lists:** each part shows a short row of about ten quick colours. "More colours" opens a fuller list of about 40, grouped by Cool Life family. At the foot of the fuller list is a link to the official fan deck, `https://coollifepalette.lifetimepluscoatings.com/#/colors`.
- **Where the colours come from:** Cool Life's own palette, which is a subset (Cool Life matches any paint it is given). The page loads `https://coollifepalette.lifetimepluscoatings.com/tenants/lifecoatings/colors.json`:
  - 769 colours with name, code and hex;
  - 661 tagged "Cool Life - Heat Reflective Colors";
  - families: Whites, Neutrals, Earth Tones, Blue Green Gray, Peaches Pinks Yellows, and an 18-colour Signature set.

  Use heat-reflective colours only. The owner said a starting set is fine; he trims it later.
- **Cool Life on or off: same colours.** Colour does not move savings, and Cool Life matches anything.
- **Starting colour:** the Build side starts from the home's Today colours. Picking a repaint with no colour chosen shows the house as it is, repainted fresh.

### Today side

- The rep can set the home's current body and trim colours on the Today side, in the existing paint chip's menu (the Today paint chip is already a menu). That menu already holds the paint wear fields (`ExistingChip` → `PaintWearFields`).
- Unset, Today keeps today's neutral house colours.

### Window frames

- Turning on the window replacement opens its details with the frame colour: white, black, or black outside with white inside (R116). Default white.
- "White inside" shows only where the camera sees the frame from inside: Partly open, and up close.
- No efficiency switch here.

## Constraints

- **One truth for product data (R128).** Shingle lines, the Cool Life list and combos, and the frame colours are construction product constants. They live in `src/shared/modules/construction/`, beside `owens-corning-shingles.ts` and the upgrade registry. Nothing is copied into the scene feature.
- **The canvas reads hex, not CSS.** Swatch fills and scene colours are physical colours (see the `HOME_PALETTE` comment), the one place the panel paints a non-token colour (`shingle-colors.tsx` already says so). Everything else in the pickers uses tokens.
- **Touch targets on the iPad:** swatches keep the existing 40 px reach (`shingle-colors.tsx`).
- **Wear still applies.** Today's colours, and anything not freshly painted, still go through `wornColor` with the chalk and wear looks. A Tri Pros repaint shows no wear (`paintLook`).
- **The Benefits copy already switches on the cool roof** (`UPGRADE_REGISTRY`: the Duration COOL warranty `onlyWith: 'cool-roof'`). Nothing here should break that.
- **Repo rules:** comments say why, never what, and never cite this doc. Named exports, one component per file. Product names come from the data, not hardcoded copy.

## What the code does today (verified 2026-11-06)

- **The menu closes on every click pick.** `ValueMenu` closes on a pick made by click or tap (`value-menu.tsx`, `closedByPick` then `setOpen(false)`); only an arrow-key move keeps it open.
- **Repaint is a toggle, not a menu.** It is one scope at a time: `unnamedUpgradeScopes` (`lib/upgrade-scopes.ts`, used in `part-offers.ts`) hides whichever of water-based or Cool Life repaint the switch does not name. Window replacement is one scope too.
- **Modify lists the same slots.** The Modify search lists the same `build:*` and upgrade slots (`modify-result-row.tsx`), so a pick made there must reach the same details.
- **Shingle colours show only with the cool roof on.** `ProposedChip kind="menu"` passes `ShingleColors` as `extra` only when `installsCoolShingle` (`upgrade-row-state.ts`) is true, so with the cool roof off the colours disappear.
- **The efficiency switches are separate chips.** The cool roof and Cool Life render as their own `ProposedChip kind="toggle"` beside the menu (`system-card-body.tsx`, `upgrade()`).
- **Cool Life is a scope swap, not a material swap.** `UPGRADE_SCOPES['cool-paint']` picks between `waterBasedRepaint` and `coolLifeRepaint`. The switch inside the menu flips between those two scopes.
- **One paint colour for the whole house.** `paintLook` gives one colour for every painted surface: `HOME_PALETTE.stucco`, or `paintCool` for a Cool Life or repainted wall. Once colour is a pick, that brighter Cool Life look goes away (the colour is the colour).
- **Painted trim and vinyl frames share one constant.** Both use `HOME_PALETTE.trim`: the door frame, garage trim and fascia, low-slope coping and front fascia, and the vinyl window frame look (`system-part-looks.ts`, `FRAME_LOOKS.vinyl`). That link must be cut.
- **Shingle colours are a scene fact, not a saved one.** `shingleColor` lives in `HomeMaterialFacts` (`OwensCorningColorId`), applied through `useApplySceneChange({ kind: 'fact' })`. Scene inputs are not persisted anywhere today.

## Left to the builder

- The exact quick and fuller paint lists, drawn from the heat-reflective set as described. The session's 20-colour draft and the sketch are in `.superpowers/brainstorm/936990-1793989485/content/` (gitignored).
- How the colour ids and types are named and shaped, and whether the standard shingles share a type with the Owens Corning ones (`ShingleColor.line` today is `'cool' | 'cool-plus'`).
- Where the paint body, paint trim, Today colours and frame colour sit in the scene inputs, following how `shingleColor` is held now.
- The pitched-roof fascia and rake already read `HOME_PALETTE.trim` (`roof-slope.tsx`), so they take the trim colour with the rest.
- Where "More colours" opens (inline in the details, or a step deeper), within the controls' patterns.
- The detail layout inside each menu, by the trade-scene controls' own patterns, judged by eye in both colour schemes on the iPad.

### Calls made in the brainstorm (not the owner's words)

- Today-side colours cover paint only. The roof and window frames keep their current Today looks.
- Today's paint picker has no combos, only body and trim, because the rep is matching what is there.
- Window frame default is white. Existing vinyl frames on the Today side stay white once trim and frames are split.
- No colours for torch down. Its details hold only the cool roof switch.
- **Where the switches sit before a pick.** Before any covering is picked, the cool roof stays the "why not yet" reason chip it is today. Cool Life stays as it is today until a repaint is picked, then moves into the repaint's details.
- **The combo is remembered** (since ruled by the owner, under Paint). If the colours shown match a combo, whether picked or the home's own, that combo shows as picked.
- **Today's trim fades with the paint.** It goes through the same chalk and wear tint as the body, since trim is painted. The fascia's existing paint marks stay as drawn; no new wear marks are added to trim. This visibly changes an approved Today look, so check it at the iPad look.
- **The details work from Modify too.** A pick made in the Modify search reaches the same shared details, so the colours are not lost there either. Modify shows the colours without the efficiency switch, which it already lists as a row of its own.
- **A home already on Cool Life paint has no Cool Life switch** (as today: the repaint uses Cool Life whatever the switch says). Its repaint details show the colours alone.
