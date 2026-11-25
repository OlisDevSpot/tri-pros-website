# Proposal Scope chapter: follow-ups

The Scope chapter rework (spec `docs/superpowers/specs/2026-10-23-proposal-scope-chapter-design.md`, K1–K13) is built on local main. These are the issues it left open, written for a grilling session. Each one gives what it is, why it matters, and the ideal fix. None of them blocks the build.

## F1. The chapter-wrapper hole and the well are linked

**What.** Every proposal chapter paints `bg-background` over `main.surface`. A part card therefore counts as ladder rung 2 even though it sits visually on the page canvas. The new `surface-well` is "one rung below its card", so in the Scope chapter the well is rung 1 (light 0.918, dark 0.206).

**Why it matters.** Fixing the hole makes the cards rung 1. The well then drops to canvas lightness, and that is exactly the place where control edges fail the contrast floor (F2). The collapse-all button's outline and the muted-on-hover text would fall below floor. `pnpm theme:check` cannot catch this, because it checks ladder places, not the DOM.

**Ideal fix.** Treat the two as one change: the proposal ladder rethink that removes the wrapper hole also decides where the well sits after it. Either the ladder gets retuned so controls pass at canvas lightness (F2), or the well becomes "the canvas, with its own stronger edges". Show the result to the owner in both schemes.

## F2. The ladder never checked controls at canvas lightness

**What.** A well inside a rung-1 surface lands at canvas lightness. There, 4 of the theme check's pairs fail: light checkbox/radio/switch edge, light muted text on the hover wash, dark field edge, and dark hovered field edge. The build documents `surface-well` as rung-2+ only and leaves the `well 0` place out of the on-surface checks (ruling R5). No ladder knob was retuned.

**Why it matters.** Any future "recessed region" inside a plain card, the obvious next use, would ship under-contrast controls if someone ignores the doc note.

**Ideal fix.** Decide with the elevation-ladder skill whether to firm the control-edge tokens so they pass at canvas lightness. Then add `well 0` back to the checks.

## F3. iOS Safari is unverified

**What.** Every browser check ran in Chromium. WebKit would not launch on the dev machine.

**Why it matters.** Agents present on iPads. Three things to look at:
- whether sticky inside the `overflow-clip` card behaves;
- whether the rounded corners clip the stuck header;
- whether the stuck hairlines appear after a quick flick back and forth.

**Ideal fix.** The owner's hands-on iPad check, pending. Anything it finds becomes a ruling.

## F4. Step lines run long on desktop

**What.** On wide screens a step line runs to about 100 characters. The spec asked for more width for the steps.

**Why it matters.** Around 65–75 characters reads more comfortably when a homeowner reads every step.

**Ideal fix.** The owner chooses: keep the full width, or cap steps, Notes and Not included at about 72ch.

## F5. The light-mode well is a gentle step

**What.** In light mode the well (0.918) sits one rung below the card (0.942). Dark mode reads clearly.

**Why it matters.** On an iPad in daylight the recess may not read.

**Ideal fix.** The owner judges it on the iPad. If it is too faint, it becomes a ladder-step decision (it ties into F1 and F2), never a one-off colour.

## F6. Small behaviours the build accepted

- **The Overview "parts" jump is still smooth under reduced motion.** `select()` passes `'auto'`, which picks up the global `* { scroll-behavior: smooth }`. This predates the build. The fix is `behavior: 'instant'` when the user prefers reduced motion.
- **The stuck eyebrow's hairline spans the scroller width**, not the text column. It follows from the full-width opaque row that hides content scrolling under it.
- **The collapse-all button is not sticky.** Mid-well, the reader folds phases one row at a time.
- **Open state is seeded once per mount.** If the SOW changes while the page is open (a refetch after an edit in another tab), new phases start closed. `isEveryPhaseOpen` is exact, so the button label stays right. A `key` on the phase count would reset it if wanted.

## Decisions the build made on the owner's behalf (rulings R1–R9)

1. **R1.** The measured part-header height reaches the phase list as a prop, not through a DOM read during render.
2. **R2.** The "How we'll do it" label was missing for one intermediate commit (local only).
3. **R3.** The verification sweep, the polish pass and the owner gate ran as separate steps.
4. **R4.** The dev server on :3000 was restarted after clearing `.next`.
5. **R5.** `surface-well` is rung-2+ only. `well 0` is out of the on-surface checks, and no knobs were retuned (see F2).
6. **R6.** The well's edge has no cap check, because the ladder has none for cards either. The edge-direction guard covers it.
7. **R7/R8.** After folding a stuck phase, the folded row stays at the sticky line and the next phase settles directly below it once the 200 ms collapse ends. The pull-back itself is instant.
8. **R9.** A well inside an overlay is documented as "not in overlays"; no CSS rule was added for it.
