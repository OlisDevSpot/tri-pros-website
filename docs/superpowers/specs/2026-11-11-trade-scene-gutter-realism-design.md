# Trade scene gutters, round 2: a real gutter, and rain that shows why it matters

**Status:** decided with the owner in a brainstorm 2026-11-11 (R316, puddles later as R317). Builds on R284 (`docs/superpowers/specs/2026-11-07-trade-scene-gutters-design.md`, built `ced985eee`..`7a4e95def`). Mockups the owner approved: `.superpowers/brainstorm/1033110-1794459079/content/gutter-profile.html` (picked B) and `rain-story.html`. Epic: `docs/plans/2026-10-16-trade-scenes-epic.md`.

## Intent

The rep should be able to show, in the rain, **why good gutters and downspouts protect the house**:
- a working gutter carries the roof's water to a downspout, and the downspout throws it out onto the lawn;
- without one, the water drops off the roof edge right beside the wall and soaks the foundation, which is how foundations get damaged.

The owner's rule: **a failing gutter should feel like having no gutter, in the part that has failed.**

Today none of that reads:
- the gutter is a square bar;
- a failing run shows four or five joins where its boxes meet;
- the front has no downspouts;
- the rain never touches the roof;
- with no gutter, nothing at the eave shows where the water goes.

## Goals

1. **A gutter that reads as a gutter.** A K-style profile in place of the square box.
2. **One piece per run.** No visible joins along a run, whatever its condition. A sag is a smooth dip; the failing end bends away in the same piece.
3. **Front downspouts that visibly divert water.** One at each front corner. Each ends in an elbow and an extension that throws the water out onto the lawn.
4. **Rain that follows the water from the roof down.**
   - **Working gutter:** water runs down the roof into the gutter, along it to the downspouts, and out onto the lawn.
   - **No gutter:** it falls off the roof edge close to the wall.
   - **Failing section:** that part behaves exactly like no gutter.
5. **A wet band on the foundation, only while it rains,** wherever water lands at the wall.

## Non-goals

- **Puddles.** These come later (R317), after the layout lab (`feat/scene-layout-lab`) merges. Its landscaping squares let only the squares touching the home take puddles, and only where there is no gutter or a failing one.
- Other gutter styles (half-round, box) or sizes.
- Gutters on the garage. That is 6-B's work, which takes this work's gutter.
- Front gutters on the flat-roof home: its water drains to the back scuppers.
- Any savings, card or control change. This is drawing only, and no new pick is added.

## Anti-goals (a failure even if it works)

- A visible join anywhere along a run, including where the near slope's fade groups split the front run.
- Water from a failed section reaching a downspout, or a dry foundation under a failed section in the rain.
- A wet band, a curtain or roof water showing in dry weather.
- A gutter that still reads as a plank from the opening view.
- A mesh per drop, streak or stain: frame cost must stay close to today's (see Constraints).

## What the owner decided (2026-11-11)

- **Shape: K-style.**
  - It has a flat back on the fascia, a flat bottom, the curved front face and a rolled top lip.
  - The top is open, with hidden hangers.
  - Chosen over half-round, and over today's box, from the mockup.
- **One piece per run.**
  - This covers ask 2: "as close to a single gutter piece as possible (to mimic real life)".
  - Real aluminium gutters are formed seamless on site.
- **A failing section is no gutter.**
  - Where the run has failed, the roof's water falls past it to the foundation.
  - The sound part of the run still drains to its downspout.
- **Downspouts at both front corners,** each with a bottom elbow and an extension out onto the lawn.
  - The water comes out at the extension's end, away from the house.
  - The foundation stays dry under a working gutter.
- **No gutter:** a curtain of water off the whole roof edge, landing at the foundation.
- **The wet band on the foundation shows only while it rains.**
- **Roof water:** a thin, moving sheen of water slides down each roof slope and tips over the edge, into the gutter's open top where there is one and straight down past the edge where there isn't. The owner approved this over separate little streams.
- **Puddles go on the tracker for after the layout lab merges** (see Non-goals).

## Claude's calls (the owner can overturn any)

- **The torn corner's downspout runs dry.**
  - At Failing, the pulled end is the right front corner, the rake end of the kept run beside the garage.
  - Its downspout, cut off from the gutter, carries no water.
  - Only the left front downspout runs, fed by the sound part.
- **Worn trickles at the sag.** With no seams left to drip from, the water pools in the sag and trickles over the front lip at its lowest point. Today's sag drip already sits there.
- **Extensions are about 1.2 m long,** angled down onto the lawn. This is a working number, set by shot.
- **Downspouts are rectangular (2 × 3 in).**
  - An elbow pair at the top takes the gutter's outlet back to the wall.
  - One elbow at the foot leads into the extension.
  - Front and back match, so the back downspouts gain elbows and extensions too.
- **The back gutter stays straight and drains at every condition.** Its wear shows as tone only, as today. The story is told at the front, and the back has no pulled section.
  - With no gutter, the back gets the curtain and the wet band too.
- **The up-close cutaway follows the same rule.**
  - When the cut runs through a failing section, the water misses the gutter and falls to the foundation, as it does with no gutter.
  - It replaces today's "spills over the front".
- **The existing overflow stains stay.**
  - The Failing stains on the fascia and wall (R284) are lasting marks, independent of the weather, and keep their clearing rule: a repaint or a new fascia.
  - The wet band is new, separate and rain-only.
- **The wet band sits on the foundation and the bottom of the wall's face,** under each span where water lands. It is a darker, wetter tone, a working height set by shot, and it sits under the curtain's span only.
- **Rain on a flat roof is unchanged.** The flat-roof home gets no roof sheen; its scuppers and back downspouts keep today's flow, with elbows and extensions added for consistency.

## Settled at the builder check (Claude's calls unless marked as code)

- **Failed span.**
  - At Failing, the failed section is the pulled span. Its water falls straight down from the roof edge, the drip edge's line, past the hanging gutter.
  - The Failing sag behaves like Worn's: it pools and trickles at its low point.
  - The overflow stains on the fascia and wall stay at the pulled span (code: `OVERFLOW_ALONG` in `gutter-marks.ts`).
- **Draining.**
  - The front run drains to both front corners at New through Worn. The roof sheen falls into the open top all along the sound part.
  - The water inside the gutter isn't drawn moving along it. Where the water goes shows at the downspouts' outlets.
  - Worn still drains to every downspout, and adds the trickle (code: `'dripping'` keeps the spouts in `home-rain.tsx`).
  - At Failing only the left front downspout runs. The right one is cut off by the pulled end.
- **No gutter, no downspouts.** Code: the downspouts are part of the gutter's boxes in `gableGutterBoxes`, so a home without gutters draws neither. The back then gets the curtain and the wet band too.
- **Fade groups.**
  - The left front downspout, its elbows and its extension stand left of `HOUSE.cutX`, so they belong to the Complete group, with the front wall and the near slope's Complete gutter.
  - The right front set belongs with the kept gutter.
  - A front curtain splits at the cut the same way.
  - The front wall's wet band joins `stains.front` in `HouseShell`, as the overflow stain does. The front wall exists only in the Complete group.
- **Frame-cost tolerance.**
  - In dry weather, the draw count may rise only by the grounded downspout feet (owner, 2026-11-12, below): one mesh per fade group, +2 on a gable with gutters and +1 on a flat roof with gutters. Everything else merges into the gutter's meshes.
  - In Rain, the count may rise by at most 6 over the same scene before this work.
  - Report the table for: not set, Good, Worn, Failing and flat, each dry and in Rain.
- **Marks on the K-profile.** The Fair streaks stay, laid on the curved front face. They still read as seams per the owner's open look item, which now gets a fresh look on the new shape.

## Owner rulings at the plan's stress test (2026-11-12)

- **Up close at Failing follows the rule.** The cutaway's rain lands near the cut, which never reaches the pulled span, so up close at Failing the rain goes into the sound part of the gutter and drains, as at Worn. The failure is told in the full view (the torn end, the curtain, the wet band). This replaces today's up-close spill at Failing.
- **The downspout feet stay on the lawn while the floor eases** between slab and raised. The foot elbows, extensions and outlets draw at ground level, outside the lifting house, at a dry cost of one mesh per fade group. Chosen over a half-second float of up to 0.6 m.
- **The eave water reuses the scene's rain component.** `RainField` (shared, `src/shared/components/scene/ui/rain-field.tsx`) is generalised to draw a list of columns in one mesh; the sky's six fields become one.

## Constraints

- **Frame cost.**
  - Measure against the commit before this work, as R284 did. The draw counts are measured again at the build's start: the 159, 145 and 161 recorded for R284 predate the flat-roof dirt (`859915e10`).
  - Each gutter run is one merged geometry per fade group. Today that is front Complete, front kept, back, and the downspouts merged in.
  - New meshes are allowed only per effect: one roof sheen per slope and fade group, one curtain per span kind, and one wet-band mark list.
  - Nothing is drawn per drop or per streak. Animation runs in the shaders or a frame callback, never through React re-renders.
- **The split at the cut must not show.**
  - The front run is drawn in two pieces because the near slope's Complete fade group (`HOME_FADE_TAGS.complete`) ends at `HOUSE.cutX`.
  - The two pieces must meet flush with flat ends, so the Complete view reads as one run. Rounded or capped ends belong only at a run's true ends.
- **The Fair streaks and the Failing overflow stains** must lie on the new curved face, not float off it. The streaks no longer need a segment's end margin, because no segments are left.
- **Weather.** Every rain effect runs only when the weather is Rain (`HomeRain`'s `running`). Dry weathers draw none of it.
- **The probe renders in software.** Render one case per process, under `.superpowers/heavy.lock`. A multi-case sweep crashed the owner's machine.
- **Nothing else changes.** Nothing moves savings, the resolver or the controls. `verify-trade-scene` and the other verify scripts must still pass.

## What the code does today (verified 2026-11-11, at `e4e6a3dc6`)

- **The runs.** In `F/lib/gable-gutter-boxes.ts`:
  - the back run is one box;
  - the front is split at `HOUSE.cutX` into a Complete box and kept segments, drawn as three or four boxes at Worn or Failing (`segment`, `gutterFrontRun`);
  - `gutterRunSpans` gives the sag and pulled spans.
  - They draw as `MergedBoxes` with `radius 0.03`, in `F/ui/components/home-kit/gable-roof.tsx`. That rounding is what makes every segment's end read as a join.
- **Section.** `ROOF_TRIM.gutter` is `{ size: 0.13, standoff: 0.01, drop: 0.05 }`, in `F/constants/home-details.ts`. `GUTTER_Y` and `GUTTER_OUT` are in `F/constants/home-geometry.ts`.
- **Wear looks.** `WEAR_LOOKS.gutter` in `F/constants/wear-looks.ts`:
  - `sag` is 0.04 at Worn and 0.07 at Failing;
  - `pulled` is `{ length: 1.2, drop: 0.18, out: 0.06, tilt: 0.2 }`;
  - plus streaks and overflow stains.
- **Marks.** In `F/lib/gutter-marks.ts`: the streaks sit on the segments' front faces, and the overflow stains go on the fascia and the front wall.
- **Downspouts.**
  - `DOWNSPOUTS` in `F/constants/home-geometry.ts` sets the gable's at its two back corners and the flat roof's at its two back scuppers.
  - The square boxes come from `F/lib/downspout-boxes.ts`. They run down to the raised floor's ground line.
- **Rain.** `F/ui/components/home-kit/home-rain.tsx` draws:
  - the weather's `RainField`s;
  - one short stream at each downspout's foot;
  - a drip column at the sag when `flow` is `'dripping'`;
  - an overflow column in front of the pulled end when `flow` is `'overflowing'`.
  - With no gutter it draws nothing at the eave.
- **Flow.** `F/lib/gutter-flow.ts` maps the gutter's wear to `'none' | 'draining' | 'dripping' | 'overflowing'`. A flat roof always drains.
- **Up close.** `F/lib/cutaway-rain-path.ts` already branches on whether there is a gutter and on its drawn wear.
- **Garage.** It stands at the right front corner. The camera's opening view runs from x −6.3 to 12.7.

(`F/` = `src/features/trade-scenes/`.)

## Left to the builder

- How the profile is built and bent. For example, a K-style shape extruded along a path that follows the sag and the pulled end, merged per fade group.
- How the roof sheen is drawn. For example, a scrolling streak texture on a thin plane over each slope, masked to rain.
- How the curtain is drawn. For example, today's `RainField` columns along a span at the eave line.
- How the wet band is drawn. For example, a mark list on the foundation and the wall's foot, in the stain system.
- Every working number: the profile's proportions, extension length, sheen speed and strength, curtain density, and the band's height and tone. All are set by shot, with the shots shown to the owner.
- Whether `GutterFlow`'s values are renamed, for example `'overflowing'` → `'failing'`, now that Failing no longer spills over the front.
- Where exactly the front downspouts stand. They need to clear the garage at the right front corner, the front door and the windows.
