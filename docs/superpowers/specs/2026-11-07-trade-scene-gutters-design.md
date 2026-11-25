# Trade scene gutters: none by default, a colour and a condition of their own

**Status:** decided with the owner in a grilling session 2026-11-07 (R284). Plan: `docs/superpowers/plans/2026-11-09-trade-scene-gutters.md` (2026-11-09, after round 3 landed at `10b3f4cff`), with the black-reads-brown fix (R285) as its Task 1. Stress-tested 2026-11-10; the owner's rulings from it are folded in below (see "Owner rulings, 2026-11-10"). Epic: `docs/plans/2026-10-16-trade-scenes-epic.md`.

## Intent

The rep should be able to show "these are your gutters today: dirty off-white, sagging, overflowing in the rain" and then "these are your new black gutters". Today they can't:
- every home is drawn with gutters unless the rep says otherwise;
- the gutters are always off-white;
- the gutters simply age with the roof.

**For now a pick is a showcase,** as with the colour picking work (R267): nothing is saved and nothing reaches a proposal.

## Goals

1. **No gutters by default.** "Not set" stays a choice on the Gutters row, as today, but it draws and reads as no gutters. Gutters show only when the rep says the home has them, or with the Gutters build.
2. **A gutter colour, before and after,** from one short list.
3. **A gutter condition of its own,** on the five steps every material uses, with looks that worsen up to "not draining".
4. **Downspouts always take the gutter colour.**

## Non-goals

- A supplier's colour chart. There is none for now; the owner may bring one in later, and the list is then copied from it verbatim.
- Gutter styles or sizes (K-style, half-round, 5"/6").
- Saving a pick or carrying it into a proposal (T21).
- Any savings change (see Constraints).
- Gutters on the flat roof's scuppers, beyond taking the colour if the low-slope home draws gutter boxes.

## Anti-goals (a failure even if it works)

- A home showing gutters the rep never said it has.
- A gutter condition that silently changes when the roof's condition changes after the rep set the gutters' own.
- A colour picker that looks bolted on. Use the controls' own chips, menus, `ColorSwatches` and the details panel the roof and paint already use.
- A new gutter drawn anything but New.

## What the owner decided (2026-11-07)

### Default (Q6)
"I like keeping a not decided option as is the case today, but it should default to no gutters."
- The Gutters row keeps three states: Gutters, No gutters, and not set.
- Not set draws no gutters, and the card reads "No gutters".
- A tear-off alone still adds no gutters; only the Gutters build does.
- In the cutaway rain, water runs off the eave with no gutter to catch it.

### Condition (Q7, "Yes for now")
- The Gutters row gets its own five condition dots, New to Failing. Until the rep touches them they follow the roof's condition, so a rep who never sets them sees what they see today.
- The looks build up step by step:
  - **New / Good:** clean and straight in the picked colour.
  - **Fair:** dulled, with a few dirt streaks down the face.
  - **Worn:** a visible sag in one run, a dripping seam, and tiger striping (dark streaks on the face).
  - **Failing:** a section pulled away from the fascia, overflow stains down the fascia and wall, and in Rain the water spills over the front instead of reaching the downspout.
- A new gutter from the Gutters build is drawn New.
- Option not taken: a separate damage setting (None / Some / Heavy) next to the shared condition, the way fascia rot works.

### Colours (Q8, "Yes looks good")
- One list for both Existing and Proposed: **White, Almond (off-white), Clay, Musket Brown, Royal Brown, Dark Bronze, Black**, and possibly a Gray. The hexes are working numbers, settled by screenshot.
- **Existing, nothing picked:** Almond, close to the off-white drawn today. The "dirty off-white" look comes from the colour plus the condition.
- **Proposed, nothing picked:** the existing colour if one was picked, otherwise White. This is the paint rule: a build changes only what the rep picks.

### Where they're picked (Q9, "Agreed")
- **Existing:** the Gutters chip menu in the Today row keeps its three states, gains the condition dots, and, when gutters are present, a colours group like the paint chip's body and trim group.
- **Proposed:** picking **+ Gutters** in the Build row shows a details panel of colour swatches, the panel the roof's shingle colours use. It is a toggle with the panel on its own line, since the row has one scope. The Modify row shows the same swatches.
- **Downspouts** take the gutter colour.

### Owner rulings, 2026-11-10 (stress test)
- **The gutter condition is a home fact.** `gutterWear` reaches the resolver, so the card's part list, the up-close rain path and the drawing agree. It moves no savings and no water, and checks pin both on a proposed home. The two colours stay drawing only.
- **The gutters' own condition decides whether + Gutters is offered,** not the roof's. Failing gutters on a new roof can be sold; gutters set to New are not offered, even on a worn roof.
- **A gutter at Good reads "Gutters" on the card,** since it draws clean. Only Fair and worse read "Old gutters".
- **Gray stays out** of the colour list for now.
- **The build stops after the light fix (R285)** so the owner can look at it before the gutter work goes on.
- **Modify keeps "Missing" for a Gutters row not set;** the Gutters chip reads "No gutters".
- **The gutters' condition is findable in Modify** while the home has gutters, as every material's is.

## Constraints

- **Drawing only. No savings move.** Verified 2026-11-07:
  - the aluminum gutter has no `energyRank`, so `installKind` always counts it like-for-like and it earns no bill cut;
  - the roof's upkeep ends only with a new covering (R225).

  The plan must still run `verify-trade-scene`, `verify-construction-model` and `verify-bill-cut-claims`, because a check may assume gutters are present by default.
- The two colour facts are drawing only and never reach the resolver (`selectResolveInputs` picks its keys by name). The gutter condition does reach it (owner ruling above). The existing `gutters` fact is a resolver input, and its meaning for `null` changes here.
- **Frame cost:**
  - a home with no gutters draws none, which is cheaper than today;
  - the condition's looks (sag, streaks, a pulled section, overflow stains) must merge into the gutters' existing meshes or the paint-stain atlas, not add a mesh per mark;
  - measure the frame cost against the commit before the work.

## What the code does today (verified 2026-11-07)

- **The fact:** `HomeMaterialFacts.gutters` is `'present' | 'none' | null` (`gutterOptions` in CORE `constants/enums.ts`). In `infer-existing-conditions.ts:41`, anything but `'none'` draws aluminum gutters, aged with the roof (`drawnPart('aluminum', home, 'roof')`).
- **The chip:** the Today row's Gutters chip is an `ExistingChip` on the `gutters` slot (`system-card-body.tsx`, `scene-change-slots.ts`). It is labelled by `GUTTER_LABELS`.
- **The colour:** `HOME_PALETTE.gutter` `#efebe3`, wearing toward `gutterWorn` `#b9b1a3` (`gable-roof.tsx`, `low-slope-roof.tsx`).
- **The rain:** `HomeRain` and `cutaway-rain-path.ts` already branch on whether there is a gutter.
- **The Gutters build:** scope `SCOPE_IDS.gutters` installs `{ part: 'gutter', material: 'aluminum' }`.
- **The drip edge:** it now takes the roof's colour, a step darker, on eaves and rakes (R283, commit `64221f283`). The gutter hangs in front of it on the eave.

## Left to the plan

- The fact names and shapes: for example, a gutter condition that is `null` while it follows the roof, plus existing and proposed gutter colours. Add them to `DrawingOnlyMaterialFact`.
- How each step's looks are drawn, within the frame-cost rule above.
- Whether the Failing overflow stains reuse the paint-stain system (`painted-surface-stains.ts`), since they land on the fascia and wall that round 3's fascia rot also marks.
- The copy for the new labels, in `home-scene-copy.ts`.
