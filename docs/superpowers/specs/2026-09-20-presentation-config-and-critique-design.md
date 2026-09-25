# Presentation Config, Step Entrance and Critique Fixes — Spec C

**Date:** 2026-09-20
**Status:** Decisions locked in the grilling session 2026-09-20. Revised 2026-09-22 with an independent CSS review of the prototype (§11, decisions C44–C46). Revised 2026-09-22 with the semantics grilling (§12): the engine moves to shared, beats become slides. Not built.
**Owns:** spec **C** of `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` — L1–L9, U1–U14, K8 (frame rules), V4, V7 — plus the step entrance (E1–E7), which is new scope decided 2026-09-20.
**Baseline:** `main` at `37a8a0e8`. `src/features/meeting-flow/` is clean apart from an uncommitted doc-comment in `presentation/scrim.tsx`; this work rebases onto it.
**Amends:** **C23 is reversed** (§1). The layout half of `2026-09-12-who-we-are-scroll-presentation-design.md` is superseded where they differ; round 1 (`2026-09-13-who-we-are-corrections-design.md`) stands on content.

Every claim about current behaviour below was read from code at the baseline, with the
file and line given. Where the epic tracker and the code disagree, the code is quoted
and the tracker line is called out for correction.

---

## 0. Scope

In: the slide config shape, the two frames, the sticky column's new extent, snap
arithmetic, container queries, the branded step entrance, the critique's
type/spacing/colour fixes, and the engine's home and vocabulary (§12).

Not in, owned elsewhere, do not touch: the trade-matched photo background (spec **D**,
B1–B11) · the projects read model and the public projection (spec **B**, R/S items) ·
trade and scope catalog helpers (construction epic) · `PwaSplashScreen`, which has no
callers and stays as it is by owner decision 2026-09-20.

---

## 1. Decisions from the 2026-09-20 session

| ID | Decision |
|---|---|
| **C33** | Frames are a **closed set of two named frames**, `'split' | 'full'`, not composable knobs. A frame has a name the critique pass can grade; adding a third later is a one-line union edit. Confirms L2. → §12: frames are `'column' \| 'full'`. |
| **C34** | **`full` = the hook and the closing.** Everything else is `split`. Corrected mid-session: the owner first chose "hook, truth, closing", but `truth` in code is the **extras table** (§3), which cannot sit centred over a photo and stay readable, so it stays `split`. → §12: `split` is `column`. |
| **C35** | `background` is valid on **either frame**. On a `split` beat it fills that beat's own box, which is the stage column — not the column beside it. → §12: a `column` slide's own box, not the `HeadingColumn`. |
| **C36** | 🔁 **C23 is reversed. There is no sticky overlay.** The heading column stays a real grid column. The overlay was built in a live prototype and rejected: on a split beat an opaque full-height panel hides the full-bleed background completely, so the only visible gain was a wider photo crop, bought with an `offsetTop` hazard, seven content-padding rewrites and a panel that fades in and out at frame changes. → §12: the column is `HeadingColumn`. |
| **C37** | The sticky column is scoped to a **run of consecutive `split` beats**, derived from `frame` — not to the whole deck. This is what lets a `full` beat be genuinely full-bleed while split beats keep today's sticky-and-fade feel. No grouping field in the config. → §12: the column is `HeadingColumn`, the run is `SlideRun`. |
| **C38** | `scroll-padding-top` on the scroller becomes a **constant `0`**. Beats that rest below a band carry their own `scroll-margin-top`. The snap offset becomes per-beat and declarative; `--pin-h` retires. → §12: per-slide, on `Slide`. |
| **C39** | The step opens with the existing **branded splash** (`src/shared/components/splash-screen/`), extended to carry the step's title and line. It **holds until the agent presses it** — any click or key — so the presentation loads behind it and the agent controls the reveal. Fires **once per meeting**, keyed by `meetingId`. Stays `fixed inset-0 z-9999`, covering the window. → §12: `MeetingSplashScreen` lives in meeting-flow, the primitive is `SplashScreen`. |
| **C40** | `SPLASH_VISIBLE_MS` **1100 → 1500** so the timed splash stops clipping its own brand mark (§5.1). Shared component; approved by the owner 2026-09-20. |
| **C41** | A `full` beat **centres** its heading. Today's hook is bottom-anchored (`hook-section.tsx:21`); this is a change, not a restoration. → §12: a `full` slide, centred by `Slide` itself (S4). |
| **C42** | `density: 'compact'` on the comparison table is **deleted** (§3.2). |

### 1.1 Decisions from the 2026-09-22 CSS review

| ID | Decision |
|---|---|
| **C44** | **No action on smooth scrolling under reduced motion** (review F3). The base-layer rule `* { scroll-behavior: smooth }` (`globals.css:466-471`) reaches the presentation scroller and `motion-safe:scroll-smooth` (`snap-presentation.tsx:114`) cannot switch it off, so reduced-motion users still get smooth keyboard jumps. Owner ruling 2026-09-22: neither the global rule nor a local `motion-reduce:scroll-auto` override is part of this work. |
| **C45** | **`StageFrame` publishes `--stage-clear-b`** (review S2): the one bottom offset that keeps presentation copy ≥40px clear of the capsule (U6). Shared shell component; approved by the owner 2026-09-22. |
| **C46** | The heading column's fade **keeps its opacity under reduced motion**, as `MotionConfig reducedMotion="user"` already does across the flow. The prototype swapped instantly; the app does not follow it. Controller ruling, raised with the owner 2026-09-22 and not objected to. |

---

## 2. The slide model

`pinned` becomes `heading`: nothing is pinned to the viewport any more, and a field
name that says otherwise is a lie in the type. `heading` is required on every slide —
once each slide owns its heading, the only remaining question is *where it sits*, which
is what `frame` answers. The engine types live in
`src/shared/components/presentation/types.ts` (S1, S3); the feature types live in
`src/features/meeting-flow/types/index.ts` (S13).

```ts
// src/shared/components/presentation/types.ts — the engine

/** Where a slide's heading sits. Defaults to 'column'; groupSlides applies the default (S5). */
export type PresentationFrame = 'column' | 'full'

/** Image only. The `portfolio` arm and its fallback branch arrive with spec D (S8). */
export type PresentationBackground = { kind: 'image', src: string, alt: string }

export interface PresentationHeading {
  title: string
  /** The second line under the title; `accent` is its accent-coloured tail — 'due diligence.' */
  subheading?: { text: string, accent?: string }
  /** Position in the numbered proof sequence; absent on unnumbered slides. */
  number?: number
}

/** Generic over the content, so the Program and Portfolio steps reuse it (L9). */
export interface PresentationSlide<TContent> {
  id: string
  frame?: PresentationFrame
  heading: PresentationHeading
  background?: PresentationBackground
  content: TContent
}

/** A slide with its deck index and its frame resolved; `groupSlides` builds these (S5). */
export type IndexedSlide<TContent> = { slide: PresentationSlide<TContent>, index: number, frame: PresentationFrame }

/** Groups carry only `items`; a run is consecutive `column` slides (S5). */
export type PresentationGroup<TContent>
  = | { kind: 'full', item: IndexedSlide<TContent> }
    | { kind: 'run', items: IndexedSlide<TContent>[] }

/** What a section component spreads into <Slide>: the fields, the resolved frame, the deck index (S6). */
export type SlideProps<TContent> = Omit<PresentationSlide<TContent>, 'frame'> & { index: number, frame: PresentationFrame }
```

```ts
// src/features/meeting-flow/types/index.ts — the feature

export type WhoWeAreContent
  = | { kind: 'hero' }
    | { kind: 'credentials', documents: PresentationDocument[], protection: ProofFigure[], reputation: ReputationMark[], openLabel: string }
    | { kind: 'sample', proof: ProofFigure, document: PresentationDocument, openLabel: string }
    | { kind: 'point', proof: ProofFigure, media?: BeforeAfterMedia }
    | { kind: 'agent', cardRole: string, commitments: string[] }
    | { kind: 'team', proof: ProofFigure, partner: PresentationPartner }
    // PresentationPartner is new: today's inline `{ name, title, image, points }`, named.
    | { kind: 'comparison', rows: ComparisonRow[] }
    | { kind: 'closing', quote: string, cta: { label: string } }

export type WhoWeAreContentOf<K extends WhoWeAreContent['kind']> = Extract<WhoWeAreContent, { kind: K }>

export type WhoWeAreSlide = PresentationSlide<WhoWeAreContent>
```

**Amended while planning (2026-09-22):** `MediaPhase` is the real name of the phase type
(`src/shared/constants/enums/media.ts`); there is no `ProjectPhase`. `point`'s `media` is
optional and is only a before/after pair (`BeforeAfterMedia`: `before`, `after`, `alt`,
`width`, `height`), because §3 gives the supervision slide a `background` photo and no media.
`teamPhotoLabel` is dropped, since U10 removes the only place it rendered. `credentials` gains
`openLabel` for U11's cue. **Amended again after the grilling (§12):** `content` stays `content` (owner, 2026-09-22; `body` was proposed and declined)
(S13), `line`/`lineAccent` are now `subheading: { text, accent? }` (S7), and the `portfolio`
background arm is deferred to spec D (S8), so `MediaPhase` is no longer imported here.

Requirements met, with what each replaces:

- **L1** — the entry is `{ id, frame?, heading, background?, content }`; `content` keeps the
  kind union behind the exhaustive `satisfies never` switch already at `steps/who-we-are/index.tsx:52`.
- **L2** — `frame` defaults to `'column'` in **one** place, `groupSlides`, per
  defaults-with-override (S5). `IndexedSlide.frame` is always resolved, so no renderer
  re-applies the default.
- **L3** — `WHO_WE_ARE_PINNED` (`constants/who-we-are-sections.ts:188`) is **deleted**: an
  index-matched parallel array that could silently drift out of alignment with the slides.
  `PROOF_POINT_COUNT` becomes `slides.filter(s => s.heading.number !== undefined).length`,
  replacing `WHO_WE_ARE_SECTIONS.filter(section => 'number' in section)` at `:186` — a
  declared field instead of union-arm sniffing that shifts the total the moment a new arm
  happens to carry `number`.
- **L4** — `background` is a discriminated union, **absent** rather than `kind: 'none'`, so
  there is no dead branch at the render sites. One arm today (S8).
- **L8** — `PresentationFrame` stays a layout-only literal union in the engine's
  `types.ts`, no enum pipeline, like `MeetingStepLayout`.
- **L9** — `PresentationSlide<TContent>` is what makes the primitive genuinely reusable by
  the Program and Portfolio steps instead of aspirationally so.

`count` is gone from the heading type. Today `PinnedSummary.count` is a pre-baked
`"3 of 6"` string built at module scope; `HeadingColumn` now composes it from `number` and
its `numberedTotal` prop (S5), which meeting-flow passes as `PROOF_POINT_COUNT`, so the
label cannot disagree with the numbering.

**Judgment call, flagged not buried:** `{ kind: 'hero' }` is an empty arm. It names a
renderer and keeps the switch exhaustive with no null branch, at the cost of carrying no
information. The alternative is `content?: WhoWeAreContent` with absent meaning
heading-only. Owner preferred the empty arm 2026-09-20; S7 confirms it.

**Accessible names (review F10).** Today `SnapSection` takes `labelledBy` (`snap-section.tsx:13-14,47`)
and each section points it at the visible `PointHeading` its own content renders
(`agent-section.tsx:20-30`, `team-section.tsx:24-45`). U1 moves the heading out of the content
into the run's `HeadingColumn`, which renders only the active slide's heading, so every other
column slide would be labelled by an id that does not exist. `Slide` therefore labels itself and
takes no `labelledBy` prop (S4): it renders its own `<h2 id="<id>-title">` from `heading`, visible on a
`full` slide and `sr-only` on a `column` slide, and points `aria-labelledby` at it. `HeadingColumn` is
`aria-hidden`: it repeats what the slide already names.

---

## 3. The deck

Ten slides. Runs are derived by `groupSlides` (S5): slides 2–9 are consecutive `column`
slides and therefore form one run sharing one heading column.

| # | id | frame | heading (title / subheading) | content | background |
|---|---|---|---|---|---|
| 1 | `hook` | **full** | A successful project doesn't start on demolition day. / It starts when you do your *due diligence.* (the accent tail, S7) | `hero` | image, dusk exterior |
| 2 | `licensing` | column | 1 · Proper licensing and permits | `credentials` | — |
| 3 | `scope` | column | 2 · A clear scope of work | `sample` | — |
| 4 | `supervision` | column | 3 · Proper supervision | `point` | image, construction stage |
| 5 | `communication` | column | 4 · Communication | `agent` | — |
| 6 | `team` | column | 5 · Team and support staff | `team` | — |
| 7 | `performance` | column | 6 · Proof of performance | `point` | — |
| 8 | `comparison` | column | Tri Pros vs other contractors / The six, side by side. | `comparison`, the six rows | — |
| 9 | `extras` | column | today's `truth.tableTitle` | `comparison`, the extras rows | — |
| 10 | `closing` | **full** | Success isn't about the finishes. | `closing` | image, dusk exterior |

Every column slide carries a `subheading: { text }` (S7); where the table shows only a title,
the subheading copy comes from today's `line` on that entry, not restated here.

### 3.1 Splitting today's `truth` slide (C3)

Today `{ kind: 'truth' }` is `{ id, tableTitle, rows, title, quote, ctaLabel }` — one arm
carrying a **table** and **the closing**, and `TruthSection` renders both
(`truth-section.tsx:36` the table, `:39-51` the closing and CTA). That is the SRP problem
C3 names. It splits into slide 9 (`comparison`) and slide 10 (`closing`).

Consequences:

- `ComparisonSection` serves slides 8 **and** 9 — the duplicated table rendering collapses
  into one renderer.
- `TruthSection` is **deleted**. A new `ClosingSection` renders slide 10.
- The `truth` arm and the `tableTitle`/`ctaLabel` field names disappear.

### 3.2 `density` is deleted (C42)

`comparison-table.tsx:9` documents `compact` as tightening rows *"so the table shares its
beat with the closing truth"* (the code comment's own words). Once the closing has its own
slide, nothing shares, both tables get a full screen, and both render at `regular`. The prop, its two-branch `cell`
expression at `:18-20`, and the `compact` call site all go.

---

## 4. Layout mechanics

### 4.1 The run

```
scroller                          ← the `presentation` size container (§4.3)
  ├─ section.slide[full]          hook
  ├─ div.run (SlideRun) ─────────────────────────────────────
  │    ├─ aside (HeadingColumn)   sticky, fades 1 → 6
  │    └─ div.stack               slides 2 … 9
  └─ section.slide[full]          closing
```

`run` is a `grid` of `minmax(16rem, 38%) minmax(0, 1fr)`; `column` is `position: sticky;
top: 0; align-self: start; height: 100cqh`. Because the grid row is as tall as `stack`, the
column sticks across the run and slides out at its edges instead of appearing and
vanishing. The stack track is `minmax(0, 1fr)`, not `1fr`, whose `auto` minimum would let
a wide table push the track past its share (review N2).

Load-bearing, do not tidy away: `align-self: start` (a stretched column is as tall as the
row and has nowhere to stick) · an explicit column height, never a percentage · the
column's ground background and `z-10` · no `overflow` on `run` or `stack` (`hidden`
re-scopes sticky to that box; `clip` would be safe).

**L5** — `Presentation` stops hard-coding `grid-cols-[minmax(16rem,38%)_1fr]`
(`snap-presentation.tsx:124`) and stops requiring `aside` (`:15`). It renders the groups its
consumer passes as children; the grid moves onto `.run`, which is `SlideRun` (S5). Runs are
derived once at module scope by `groupSlides` from the slide list (`WHO_WE_ARE_GROUPS`,
S13), not on every render.

**The column while its run scrolls in and out (review F1).** `activeIndex` is a deck-wide
index. With one column per run, `summaries[activeIndex] ?? summaries[0]`
(`pinned-column.tsx:20`) indexes the wrong list. The prototype showed the other half of the
failure: while the hook is active the column is empty as the run scrolls into view
(measured 479px in, no content), then pops in without a fade. `HeadingColumn` derives
`shownIndex = clamp(activeIndex, first, last)` from its `items` (S5) during render and keys
`AnimatePresence` by it, so the column shows the run's first heading before the run and its
last heading after it.

**Band mode is `display: block` (review F12).** Below the presentation threshold the column
stacks above the slides as a band. As a grid, it would be alone in grid row 1, and a grid
item's sticky containing block is its grid area, so the spec allows the band to stop
sticking at the end of row 1. Chromium sticks anyway. WebKit was not tested, and today's
build has the same structure below `lg`. `.run` switches to `block` in band mode
(`@max-[56rem]/presentation:block`), which measured identical geometry in Chromium and makes the
stickiness spec-guaranteed. Confirmed on a real iPad at V4.

**Keyboard jumps use a rect delta, not `offsetTop` (review F9).** `scrollToIndex` computes
`section.offsetTop` (`snap-presentation.tsx:85`), which resolves against the nearest
*positioned* ancestor: adding `relative` to `run` or `stack` sends every ↓ to slide 0
(measured). The helper is `slideScrollTop` in
`src/shared/components/presentation/slide-scroll-top.ts` (S1). The target becomes

```ts
section.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  + scroller.scrollTop - Number.parseFloat(getComputedStyle(section).scrollMarginTop)
```

which does not depend on positioning (measured correct with `.run` relative). The
static-wrapper rule an earlier draft of this spec carried is dropped. The rewritten comment
at `:79-82` no longer claims that `motion-safe:scroll-smooth` decides the scroll behaviour,
which is untrue (C44). The behaviour itself does not change.

### 4.2 Snap arithmetic (C38, L6)

| | today | after |
|---|---|---|
| scroller | `scroll-pt-(--pin-h)`, `--pin-h: 30cqh` / `lg:0px` | `scroll-padding-top: 0`, always |
| slide height | `min-h-[calc(100cqh-var(--pin-h))]` | `calc(100cqh - var(--band-h, 0px))` |
| snap offset | global scroll padding | per-slide `scroll-margin-top: var(--band-h, 0px)` |

`--band-h` is `0` while the column is a side column and the band height once it stacks.

**Both rows above need only one expression, because `--band-h` is declared only on
`.run`** (§4.3) **and every consumer reads it as `var(--band-h, 0px)`.** A `full` slide sits
outside every run, so the fallback applies and it resolves to `100cqh` and a zero snap
offset without a frame-specific rule, and no root declaration is needed (review N1). One
value that is correct for both frames is what keeps the inline style viable: an inline
`scrollMarginTop` cannot be overridden by a class.

`Slide` keeps that inline override — it is load-bearing against the global
`* { scroll-margin-top: 80px }` marketing rule (`snap-section.tsx:23-27`) — but the value
becomes `var(--band-h, 0px)` instead of the literal `0`, still inline so a caller's `className`
cannot clobber it. `Slide` is never transformed, and keyboard next/prev and
`scrollToIndex` keep their signatures.

`scrollToIndex` reads `scrollMarginTop` off the slide rather than `scrollPaddingTop` off the
scroller (§4.1). Sanity check: with `scroll-snap-align: start`, the snap area is the border
box expanded by the scroll margin, so the resting position is the slide's top minus its
margin, which is what the rect delta computes. `snap-mandatory` and `snap-always` stay.

### 4.3 Container queries (L7, U7)

**Every query names its container (review F8).** An unnamed `@container` or `@max-*`
query binds to the *nearest* container, and that silently changes when another container
appears between the element and the scroller. This section adds one. Two named containers:

| Container | Declared on | Tailwind 4.1.18 form |
|---|---|---|
| `presentation` | the scroller | `[container:presentation/size]`. `@container-size` appears in the Tailwind docs, but 4.1.18 does not emit it. |
| `comparison` | the comparison table's wrapper | `@container/comparison` (inline-size) |

Two thresholds:

| Threshold | Query | Switches |
|---|---|---|
| presentation `< 56rem` | `@max-[56rem]/presentation:` on `.run` | side column → top band (`[--band-h:30cqh]`, plus `block` per §4.1); slides stack |
| table `< 44rem` | `@max-[44rem]/comparison:` inside the table | table columns → stacked rows |

The engine never uses the word "stage": it belongs to the shell (`StageFrame`,
`--stage-inset-b`, `--stage-clear-b`), and the engine's container, tokens and queries are all
named `presentation` (S10, S11).

⚠️ **`--band-h` is declared on `.run`, never on the scroller.** The scroller *is* the
`presentation` container, and an element cannot query itself: a rule on the scroller resolves
against an ancestor and silently yields a zero band. That is the trap already documented at
`snap-presentation.tsx:38-43`. The main reason is scoping, though: declared on `.run`, the
band exists only inside runs, which is what gives `full` slides their zero offset (§4.2).

**Why the table needs its own container.** The table's width does not follow from the
presentation width alone. In side mode it gets about 62% of the presentation; in band mode it
gets all of it. No single presentation width marks the point where six columns stop fitting.
Without the `comparison` container the query reaches `presentation`, and the side-mode table
(~34.7rem, measured) never stacks.

**The cost.** Inside `@container/comparison`, `cqw` measures the table, not the presentation
(measured: `cqw` resolves against the inner container, `cqh` against `presentation`). So table
text is set with the U5 role tokens (§6), whose rem floors keep it legible whatever `cqw`
resolves to. A bare `cqw` size never goes inside the table.

Both values are starting points, confirmed or moved at V4. `56rem` derives from the
column's own floor: 38% stops being at least 16rem at about `674px`, so the switch must
happen above that. `44rem` is the width the six-column table needs. **The comparison slide
is the binding constraint, not the column**: it needs the most width, so measurement
settles the final pair (§7.3).

Outside the table, `cqw` and `cqh` resolve against the scroller (`presentation`).
`Presentation`'s wrapper keeps its own size container. With `scroll-pt-(--pin-h)` gone
(C38), no property of the scroller itself uses `cq` units, so the comment at `:38-43` is
rewritten to describe the wrapper as a guard for such a property, not as a live fix.
Document all of this in `src/shared/components/presentation/DOCS.md` (K8, S12).

**L7 also fixes `SlideImage`** (today's `SectionImage`, S3)**:** `sizes="(min-width: 1024px) 62vw, 100vw"`
(`section-image.tsx:36`) encodes the assumption that a photo only ever fills the content
column. A `full` slide's background spans the whole scroller, so `sizes` must reflect the
frame or Next.js under-serves every full-bleed image. This line is also the proof that
today's hook is **not** full-bleed.

### 4.4 Content layers

Two kinds of slide get two layer rules (review F6):

- **Fixed slides**: the hook, the six proof points and the closing. Content layers
  are `position: absolute; inset: 0` against the relatively positioned `Slide`, the
  app's existing idiom (`hook-section.tsx:21`, `point-layout.tsx:17`). The slide is one
  screen tall, and the layer fills it.
- **Growth slides**: `comparison` and `extras`. They stay **in flow**, as
  `grid min-h-[calc(100cqh-var(--band-h,0px))] content-center`, which is how
  `comparison-section.tsx:21` works today. An absolute layer inside the slide's
  `overflow: hidden` cannot make the slide taller, so a table taller than the screen would be
  clipped. §7.3's stacked rows are exactly that case.

**Never a percentage height** on either kind. The slide has only `min-height`, so a
`height: 100%` child resolves against an auto height and collapses to its content height.
That silently breaks centring on a full slide and the bottom anchor on a column slide's
content. The prototype hit this bug and fixed it.

**Full slides centre with `justify-center-safe`** (`safe center` in 4.1.18), not
`justify-center`. When a centred column overflows, plain `center` pushes the overflow past
both ends and clips the title first; `safe` falls back to the start.

**Bottom clearance reaches the content through the seam (S9).** Feature slide content floors
their bottom padding at `var(--presentation-clear-b, 0px)`, which `Presentation` sets
inline from its `clearBottom` prop — never at `--stage-clear-b` directly. Meeting-flow
passes `clearBottom="var(--stage-clear-b)"`; the engine does not know the shell's name for
it.

`PointLayout`'s `grid-rows-[minmax(0,1fr)_auto]` (`point-layout.tsx:17`) stays. It gives
media whatever height the copy leaves and guarantees they cannot overlap at any presentation
aspect ratio — a stronger guarantee than a flex column, and it is what **U6**'s
identical-media-gap requirement actually rests on.

### 4.5 Which slide is active (review F2)

`Slide` asks `useInView(ref, { root: scrollerRef, amount: 0.5 })`
(`snap-section.tsx:32`), and `reportInView` acts only on `true`
(`snap-presentation.tsx:51-55`). In band mode that goes stale. The observer's root is the
whole scroller, including the strip under the band, so a 70cqh slide crosses 0.5 after only
5cqh of travel. From slide 4, nudge up by 8% and release. The scroller snaps back to slide 4,
but slide 3 has already reported. Slide 4 never left the view, so it never reports again. The
column says "supervision", and the next ↓ targets slide 4, where the reader already is, so
the key seems dead. This was measured in the prototype, and the app runs the same algorithm
below `lg`, so it is probably live on iPad portrait today. A second problem: a slide taller
than twice the screen (stacked table rows) can never reach 0.5.

A slide is in view when it **crosses the presentation's centre line**:
`useInView(ref, { root: scrollerRef, margin: '-50% 0px -50% 0px' })`. Slides are contiguous,
so exactly one slide crosses the line at a time, and the rule that `reportInView` acts only
on `true` stays sound. Tested in the prototype: the nudge case recovers, ↑/↓ are unchanged,
and reveal timing is unchanged for 100cqh slides. `SlideInViewContext` uses the same flag,
so reveals also fire on the centre line.

The fix is one line and does not depend on the restructure, so the plan lands it first.

`activeIndex` stays on `PresentationContext`. Review N4 suggested a separate context. A
slide change re-renders each `Slide` shell, but not its children, which arrive as
props, so a second context is not worth adding now.

---

## 5. The step entrance (E1–E7, new scope)

| ID | Requirement |
|---|---|
| **E1** | A `MeetingSplashScreen` in `src/features/meeting-flow/ui/components/`, composing the shared `SplashScreen` primitive from `src/shared/components/splash-screen/` (S14, S17). No fork of the mark. |
| **E2** | `SplashScreen` takes optional `title` and `subheading`, rendered under the mark (S14). Absent = today's behaviour exactly, so the proposal and PWA callers show no caption. The title is sized `text-[clamp(1.375rem,3.4vw,2.75rem)]` and the subheading one step smaller the same way. Use `vw`, not `cqw`: the splash is `fixed` with no container above it, so `cqw` silently falls back to small-viewport units (review F11). The button's accessible name is its action; the title and subheading are attached with `aria-describedby`, because an `aria-label` alone would hide them from assistive tech (review N3). |
| **E3** | The caption animates **after** the brand mark lands, then the press cue after the caption. Nothing overlaps the `R`'s spring. |
| **E4** | Dismiss is **agent-pressed**: the overlay is a real `<button>` filling it, focused on mount, so a click anywhere or a key press begins. `Tab`, modifier keys and `F1`–`F12` are not presses: they neither dismiss it nor get `preventDefault()`, so focus is not trapped and reload and devtools still work. The key wiring, `inert` and focus handback are described below the table (review F5). The press surface and its capture-phase key listener are the primitive's press mode (S14), not the meeting composition's. |
| **E5** | Shown **once per meeting**: the key is `meetingSplashKey(meetingId)` from `src/features/meeting-flow/constants/`, built with `sessionStorageKey` (S16), not the global `app-splash-shown` (`use-splash-visibility.ts:5`), which is one-shot per browser session and would give a second meeting no splash at all. The key is written on dismiss, so a reload mid-splash replays it once (S15). |
| **E6** | Copy is the step's own: title and subheading come from `MEETING_STEPS` (`constants/step-config.ts:16`); `MeetingStepConfig` gains `subheading?: string` for it (S18), since the field does not exist today. Nothing is restated, so retitling a step cannot leave the splash stale. |
| **E7** | Respects `prefers-reduced-motion`: no entrance animation, caption and cue at rest, still dismissed by a press. The primitive gates itself with `useReducedMotion()` (S14) and, when it is true, renders the mark and the caption with `initial={false}`; there is no `still` prop, and `MeetingSplashScreen` does nothing for it. The view's `MotionConfig reducedMotion="user"` (`meeting-flow.tsx:283`) does not reach the splash at all: the splash mounts in the outer view, outside that subtree (E4 wiring), so self-gating is the only gate it has (review F4). |

`useSplashVisibility` is **deleted** (S15). Visibility is `useSessionOnce(key, enabled)`
(S15) plus the primitive's own timer or press (S14): the meeting splash passes
`dismiss: { mode: 'press', label }` through `useMeetingSplash`; the proposal and PWA splashes
pass `{ mode: 'timed' }`.

**E4 wiring (review F5).** The shell's key map listens on `window` in the bubble phase,
bails only on `defaultPrevented`, and ignores targets outside `StageFrame`
(`use-meeting-flow-keys.ts:45,60,149`; `document.body` passes the root check). A key
pressed while focus is on `document.body` therefore reaches the key map and moves the deck
behind the splash. And after a step change the view focuses `[data-step-root]`, racing the
button's autofocus. So:

- The splash registers one `keydown` listener on `window` in the **capture** phase, in an
  effect, so it runs before the key map. It calls `preventDefault()` only for keys it
  consumes as a press. This listener lives in `SplashScreen`'s press mode (S14), so the
  proposal and PWA splashes, which are timed, never register it.
- While the splash is open, `StageFrame` is `inert`. Focus and clicks cannot reach the flow
  behind it; without this, Shift+Tab lands on the hidden scroller.
- Focus returns to `[data-step-root]` when the splash closes, driven by state (the inner view
  reacts to `splashOpen` turning false), not on a timer. The review suggested
  `onExitComplete`; the splash sits outside the inner view's tree (next bullet), and a
  state-driven handback avoids the same race. An inert element cannot take focus, so the
  view's step-change focus cannot steal it from the splash either.
- The splash mounts in `MeetingFlowView`, beside the inner view: outside `StageFrame` and the
  stage's `isolate` wrappers (`meeting-flow.tsx:295`, `snap-presentation.tsx:107`), each a
  stacking context that would trap `z-9999` under the capsule (review F11). Mounting it above
  the inner view also keeps it mounted while the meeting loads; inside, the switch from the
  loading tree to the ready tree would remount it and replay the mark.
- The dashboard sidebar sits outside `StageFrame` and stays tabbable. E4 deliberately does
  not trap focus, so `Tab` can move focus behind the overlay. That is accepted for a screen
  the agent operates.

### 5.1 The clipped brand mark (C40)

`SPLASH_VISIBLE_MS = 1100` (`use-splash-visibility.ts:6`), but the blue `R` starts at
`delay: 0.9` with `duration: 0.5` (`splash-animation.tsx:35-38` today; the mark becomes
`splash-mark.tsx`, S14) and lands at **1.4 s**. The splash begins its 0.3 s fade at 1.1 s,
so every timed splash cuts its own brand mark off mid-spring. `1100 → 1500`. This affects
the **proposal** splash (`app/(frontend)/proposal-flow/layout.tsx:23`, which imports
`ProposalSplashScreen` from `src/features/proposal-flow/ui/components/` after S17); the
meeting splash, in press mode, sidesteps the timer entirely.

**One source for the mark's timing (review S3).** A sibling module, `splash-timing.ts`,
holds the `R` mark's delay and duration (a component file holds no file-level constants). Everything downstream is derived from them:
`SPLASH_VISIBLE_MS` = the mark's landing time + 100 ms (= 1500, C40), the caption's delay
= the landing time, and the cue's delay = the caption's delay + its duration. The prototype
restated the 1.4 s by hand three times (1400 ms, 2000 ms, and C40's 1500 ms). After this,
retuning the spring moves all of them.

---

## 6. Critique fixes

| ID | Lands as | Evidence at baseline |
|---|---|---|
| **U1** | Structural: a column slide's content carries no title or subheading; `heading` renders in the run's `HeadingColumn`. ⚠️ Its alignment clause is an open decision — §7. | — |
| **U2** | ⚠️ **First clause deleted** — see §7.2. Only the lining-figures clause survives; the column composes the count from `number`. | `step-capsule.tsx:54` |
| **U3** | The closing is its own slide (§3.1). Quote at Lead in Nunito, **not** serif italic. CTA ≥40px clear of the capsule at 1440 and 1180. | `truth-section.tsx:42` is `font-serif … italic` |
| **U4** | Comparison per C2, rows revealed pair by pair, no mid-word breaks. Switches on its **own** container threshold (§4.3). ⚠️ Risk — §7.3. | `comparison-table.tsx:19-20` use `lg:` |
| **U5** | Six-role scale with rem floors — display ≈62, title ≈44, figure ≈35, lead ≈23, body ≈18, label ≈14 present-mode px; body never below 17px on iPad; one figure size everywhere; no weight 500. Lands as six tokens, one `clamp()` per role for **both** column modes (review F7), listed below the table. | `pinned-column.tsx:39-48` sizes in bare `cqw` with a different coefficient per mode (`text-[5.5cqw]` → `lg:text-[3.3cqw]`); its only floors are 12–14px, under the 17px body. The prototype did the same, and its sizes jump about 39% at the 900px switch (title 48.6 → 29.7px, figure 45.0 → 24.3px). iPad landscape with the sidebar open (~924px stage) sits right at that drop. |
| **U6** | Spacing tokens `gap-presentation-{tight,group,zone}` (S11), tight ≈8 / group ≈30 / zone ≈51; media bottom-anchored via `PointLayout`; copy clears the capsule by ≥40px through `--stage-clear-b` (C45), read by the engine as `--presentation-clear-b` (S9), below the table. | `point-layout.tsx:17`; `stage-frame.tsx:18` `[--stage-inset-b:5rem]` is the strip the capsule *covers*, not a clearance; the prototype's copy cleared the capsule by 36px through three one-off offsets (+20, +28, +16px) |
| **U7** | Container queries throughout, per §4.3. | `snap-presentation.tsx:115,124`; `comparison-table.tsx:19-20` |
| **U8** | One accent, brand blue on dark: `--presentation-accent` on `[data-stage]` changes value from the indigo `oklch(0.8 0.12 259.8)` to `#5cc6f2`, the brand blue the tracker names, which the marketing dark theme also uses as `--accent-ink` (`globals.css:286`, scoped to `.theme-marketing.theme-dark`, so not readable here). Every accent reads the variable; the prototype's bare `#5cc6f2` literal beside the indigo variable was the "fourth blue" the review flagged (S1). ⚠️ Step 2 reads the same variable (`showcase-text.tsx:42`, `showcase-fallback.tsx:18`), so its accent changes too. The scrim and dialog `oklch` literals become one variable, `--presentation-scrim` (oklch channels, alpha added at the call site). The palette moves from `[data-stage]` to `:root`, because the dialog portals out of the stage. White ink uses `text-white/NN` steps rather than ad-hoc `rgba` alphas (the prototype used seven). | `--presentation-ground: oklch(0.2 0.028 257)` and `--presentation-accent: oklch(0.8 0.12 259.8)` at `globals.css:1700-1701`; `Scrim` washes `oklch(0.14 0.03 257)` at `scrim.tsx:17-18`; `--primary: #03afed` at `globals.css:117`. Three different blues and two different grounds. |
| **U9** | Hook headline ≈62px on three lines; **plain** subtitle, accent by colour not by serif italic; legible over bright photo areas. Now also **centred** (C41) and full-bleed, so `Scrim` needs a centre-weighted variant — its `radial` is composed for copy sitting bottom-left and leaves centred text on the bright part of the photo. It becomes `Scrim variant="center"`. | `hook-section.tsx:31` is `font-serif … italic` |
| **U10** | No unfinished content reaches the homeowner: sample placeholder carries no developer text; brand monogram, not a letter avatar, when there is no headshot; Sean's portrait beside the 12+ figure until the team photo exists. | — |
| **U11** | "Tap to view" on credential documents and the scope stack; dialog close target ≥44px. | — |
| **U12** | Performance slide shows before/after at true proportions. 🚨 Its images are gitignored and **broken in production**; source from tracked assets or project media. | `who-we-are-sections.ts:19-20` |
| **U13** | Sentence-case stat labels; Yelp not orphaned; agent and team list sizes match; no rotated text. | `due-diligence.ts` uses Title Case |
| **U14** | `PRESENTATION_EASE` becomes the brand curve `cubic-bezier(0.32, 0.72, 0, 1)` (C29) through a new shared JS constant in `src/shared/constants/`. None exists today, and the literal is copied in six places. ⚠️ **Not through the CSS variable** (review S1): `--ease-brand` is declared only inside `.funnel-light` (`globals.css:200`), so `var(--ease-brand)` resolves to nothing in the meeting flow. All presentation easing runs through motion with the JS constant. Durations and stagger unchanged. `HEADING_SWAP_TRANSITION` (today's `PIN_SWAP_TRANSITION`, moved to the engine's `motion.ts`, S1) stays `{ duration: 0.18, ease: 'easeOut' }`: it never used `PRESENTATION_EASE`, and it is the fade the owner approved in the prototype. | `presentation-motion.ts:4,26`; `globals.css:200` |

**U5 tokens (review F7).** A size in bare `cqw` has no floor and ignores browser zoom
(WCAG 1.4.4). Each role is bounded in `rem`, with the max at twice the min so zoom still
scales it. The tokens go in the existing `@theme inline` block (`globals.css:395`), which
generates `text-presentation-*` utilities. The same token serves side mode, band mode and
the comparison table, so nothing jumps at a threshold. These are starting values, tuned to
U5's targets at a 1440px stage and confirmed at V4:

| Token | Value | px at 1440 stage | px at 1024 stage |
|---|---|---|---|
| `--text-presentation-display` | `clamp(2.5rem, 4.3cqw, 5rem)` | 62 | 44 |
| `--text-presentation-title` | `clamp(1.75rem, 3.05cqw, 3.5rem)` | 44 | 31 |
| `--text-presentation-figure` | `clamp(1.5rem, 2.45cqw, 3rem)` | 35 | 25 |
| `--text-presentation-lead` | `clamp(1.25rem, 1.6cqw, 2.5rem)` | 23 | 20 (floor) |
| `--text-presentation-body` | `clamp(1.0625rem, 1.25cqw, 2.125rem)` | 18 | 17 (floor) |
| `--text-presentation-label` | `clamp(0.8125rem, 0.975cqw, 1.625rem)` | 14 | 13 (floor) |

**U6 clearance (C45).** `StageFrame` publishes one more custom property beside
`--stage-inset-b`:

```
--stage-clear-b: calc(max(1rem, env(safe-area-inset-bottom)) + 3rem + 2.5rem)
```

That is the capsule's bottom offset (`step-capsule.tsx:34`), plus its 48px height, plus
U6's 40px: about 104px. It follows the pattern the `StageFrame` doc comment already uses
for the inset. Every presentation content layer, and the column in side mode, floors its
bottom padding at it. **The engine never reads `--stage-clear-b` by name (S9):** meeting-flow
passes `clearBottom="var(--stage-clear-b)"` to `Presentation`, which sets
`--presentation-clear-b` inline on the scroller, and every engine layer and feature slide content
reads `var(--presentation-clear-b, 0px)`, for example
`pb-[max(6cqh,var(--presentation-clear-b,0px))]`. This replaces today's `--stage-inset-b`
floors in the presentation and the prototype's three one-off offsets. `--stage-inset-b`
itself is unchanged for its other consumers (`step-region.tsx:25`, the specialties step).

---

## 7. Open decisions

### 7.1 U1's alignment clause vs shell correction C2 ⚠️ owner

U1 asks that the heading block and the slide's content align, "no centred-vs-bottom eye
ping-pong". But the shell round's own user correction **C2** explicitly moved the column
from `content-end` to `content-center`, and the content is bottom-anchored by `PointLayout`.
Satisfying U1 means overriding C2 or un-anchoring the content. Both are owner calls.

- (a) Column bottom-anchored to match the content — satisfies U1, reverses C2.
- (b) Content centred to match the column — satisfies U1, loses U6's identical media gap.
- (c) Keep both as they are — C2 stands, U1's alignment clause is dropped as superseded.

Recommendation: **(c)**. C2 is a later, explicit owner correction made after seeing the
built screen; U1 is a critique note from a generated pass. Record it as superseded rather
than silently unmet.

### 7.2 U2's first clause rests on a misreading ⚠️ correct the tracker

`docs/plans/2026-09-14-upgrading-meeting-flow-epic.md:110` said the pinned `"N of 6"` and
the capsule `"1 / 7"` are duplicate indicators that "don't both show". They are not
duplicates. `step-capsule.tsx:54` renders `stepCounter(currentStep, TOTAL_STEPS)` where
`TOTAL_STEPS = MEETING_STEPS.length` = **7 meeting steps** (`step-config.ts:71`), so
`1 / 7` means *"Who We Are is step 1 of 7 in this meeting"* while `3 of 6` means *"third
of six proof points"*. Removing either loses real information. The first clause is struck
from U2 — the strike is already applied at tracker line 110 (dated 2026-09-20); the
lining-figures clause survives.

### 7.3 U4 without extra width ⚠️ risk

C34 keeps the extras and comparison slides `column`, so both tables live in roughly 62% of
the presentation. U4's no-mid-word-breaks requirement therefore has to be met by type and
container thresholds rather than by width. If measurement shows it cannot be, the options
are: give the comparison slides `frame: 'full'` after all, or accept stacked rows at the
narrow end. Settle at V4, with evidence, not now.

---

## 8. Files

**Added** —
- The engine, `src/shared/components/presentation/` (S1): `presentation.tsx`, `slide.tsx`,
  `slide-run.tsx`, `heading-column.tsx`, `slide-background.tsx`, `slide-image.tsx`,
  `reveal.tsx`, `scrim.tsx`, `types.ts`, `context.tsx`, `motion.ts`, `group-slides.ts`,
  `slide-scroll-top.ts`, `DOCS.md` (S12). No nested `lib/`.
- The feature, `src/features/meeting-flow/`:
  `ui/components/steps/who-we-are/{closing-section,check-list,before-after-pair,comparison-sheet,comparison-sheets,tap-cue}.tsx`
  · `constants/who-we-are-slides.ts` (S13) · `ui/components/meeting-splash-screen.tsx` (S17)
  · `hooks/use-meeting-splash.ts` (S17) · constants for the splash copy and
  `meetingSplashKey` (S16, S17) · `DOCS.md` (K8, S12).
- The shared splash, `src/shared/components/splash-screen/` (S14): `splash-screen.tsx`,
  `splash-mark.tsx`, `splash-caption.tsx`, `splash-timing.ts`, `is-splash-press.ts`.
- `src/shared/hooks/use-session-once.ts` (S15) · `sessionStorageKey` in
  `src/shared/constants/storage-keys.ts` (S16) · `BRAND_EASE` in the existing
  `src/shared/constants/motion.ts` (U14) ·
  `src/features/proposal-flow/ui/components/proposal-splash-screen.tsx` and
  `PROPOSAL_SPLASH_KEY` in `src/features/proposal-flow/constants/` (S16, S17).

Full map: the plan, `docs/superpowers/plans/2026-09-22-presentation-config-and-critique.md`.

**Changed** — `app/(frontend)/globals.css` (six role tokens and `gap-presentation-*` in
`@theme inline`, U5/S11; `--presentation-scrim` at `:root`, U8; the owner comment naming the
engine folder, S11) · `shell/stage-frame.tsx` (`--stage-clear-b`, C45; `inert` while the
splash is open, E4) · `ui/views/meeting-flow.tsx` (mounts the splash beside `StageFrame`,
E4) · `constants/step-config.ts` (`subheading?`, S18) · every `steps/who-we-are/*` section
(takes `SlideProps<WhoWeAreContentOf<K>>` and spreads into `<Slide>`, S6/S13; `index.tsx`
passes `rootAttributes`, `keyShortcuts` and `clearBottom` to `Presentation`, S9) ·
`constants/keyboard-hints.ts` ("Previous / next slide in the presentation", §12.1) ·
`app/(frontend)/proposal-flow/layout.tsx` (import path, S17) ·
`splash-screen/pwa-splash-screen.tsx` (minimal: `SplashScreen` timed plus `useSessionOnce`,
S17).

**Deleted** — `src/features/meeting-flow/ui/components/presentation/` (all six files,
moved to the engine, S1) · `contexts/presentation-context.tsx` (moved to the engine's
`context.tsx`) · `constants/presentation-motion.ts` (moved to the engine's `motion.ts`) ·
`constants/who-we-are-sections.ts` (renamed, S13) · `WHO_WE_ARE_PINNED` (L3) ·
`steps/who-we-are/truth-section.tsx` (§3.1) · `steps/who-we-are/hook-section.tsx`,
`point-heading.tsx`, `point-media-layer.tsx`, `placeholder-slot.tsx`,
`comparison-table.tsx` · the `density` prop and its `compact` branch (C42) · `--pin-h` and
the scroller's scroll padding (C38) · `PinnedSummary.count` ·
`splash-screen/{splash-overlay,splash-animation}.tsx` and
`splash-screen/use-splash-visibility.ts` (S14, S15) · the shared
`splash-screen/proposal-splash-screen.tsx` (moved to proposal-flow, S17).

`HeadingColumn` is `PinnedColumn` renamed and run-scoped — C36 reverses its removal. It
keeps `activeIndex` from the context and clamps it to its run's `items` (§4.1), which is
why `activeIndex` stays on `PresentationContextValue`: it has no other consumer
(`contexts/presentation-context.tsx:10`, `pinned-column.tsx:19`; §4.5 on N4).

---

## 9. Verification

No unit-test runner in this repo by design. Gates:

- **V1** `pnpm tsc` and `pnpm lint` clean. Never `pnpm build`.
- **V4** Screenshots of all ten slides at 1440×900, 1280×800, 1024×768 with the sidebar
  open, 820×1180, and present mode at 1440 and 1180, with freshly compiled CSS — restart
  `pnpm dev`; a long-running dev server does not pick up new Tailwind classes. Plus:
  ↑/↓ land exactly on every slide at every size (§4.1), and the comparison slides set the
  final container thresholds (§4.3, §7.3). Also:
  - **Nudge and release** at 820×1180. From slide 4, scroll up about 8% and let go. The
    column still names slide 4, and ↓ goes to slide 5 (§4.5, F2). Run this on today's build
    first too, to confirm whether the bug is live.
  - **Real iPad, Safari, portrait**: the band stays pinned across the whole run (§4.1, F12).
    Also check whether a re-anchor after resize is needed there (review N5); Chromium
    re-snaps without one.
  - **Browser zoom 200%** at 1440: presentation text grows. At 1024×768 with the sidebar
    open, no role renders below its floor (U5, F7).
  - **A growth slide taller than the screen** (stacked rows at 820 wide) grows instead of
    clipping (§4.4, F6).
- **V7** Re-run `/impeccable critique` on Who We Are; compare against 16/32.
- **H3** Re-measure the stage with
  `.superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools/measure-stage.mjs`.
  Never assume a change is render-neutral.
- Entrance: splash on a cold load and a warm one, a second meeting in the same browser
  session (E5), reduced motion with the mark, caption and cue at rest on first paint (E7),
  and `Tab` not dismissing it (E4). With focus on `document.body`, ↓, Z, P and 1–9 do not
  move the deck behind the splash, and F5 still reloads. Shift+Tab cannot reach the
  scroller, and focus lands on the step root after the fade (E4, F5). The splash covers the
  top bar and the sidebar (C39). Confirm the proposal splash no longer clips the `R` (C40).

**⚠️ H1 is an owner decision before building.** The specialties round-2 SDD ledger ends at
the V1 dispatch (base `9ffe6692`), but V1 did report:
`.superpowers/sdd/2026-09-14-specialties-stage-and-rail/task-v1-report.md` (2026-09-17),
20 PASS, 5 FAIL, 6 NOT RUN, all on step 2. The owner either accepts those results as step 2's
known state or has them fixed first; this work touches step 2 only through `StageFrame` and
the accent value.

---

## 10. Docs to update

- `src/shared/components/presentation/DOCS.md` — **create** (K8, S12): the engine rules —
  the two frames, how runs are derived by `groupSlides`, the two named containers and what
  `cqw`/`cqh` measure in each place (§4.3), snap arithmetic (§4.2), the two content-layer
  rules (§4.4), rect-delta jump targets (§4.1), the centre-line in-view rule (§4.5), the
  role and spacing tokens, and the `Presentation` seam (`rootAttributes`, `keyShortcuts`,
  `clearBottom` → `--presentation-clear-b`, S9).
- `src/features/meeting-flow/DOCS.md` — **create** (K8, S12): the Who We Are deck and when
  each frame is used, the kind switch in `WhoWeAreStep`, `--stage-clear-b` and how it reaches
  the engine (§6), and the splash use (`useMeetingSplash`, `meetingSplashKey`, the entrance
  contract).
- `CONTEXT.md#presentation-terms` — already written; the glossary §12.1 summarises.
- `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` — C33–C42 into §1; C23 marked
  reversed; U2's first clause struck (§7.2); E1–E7 added; spec C's row filled in. Then
  C44–C46 into §1 and the E4/E7 amendments (2026-09-22).
- `memory/project-who-we-are-presentation.md` — round 2 status, and C23's reversal so a
  later session does not rebuild the overlay.
- `docs/superpowers/specs/2026-09-12-who-we-are-scroll-presentation-design.md` — mark its
  layout section superseded.

---

## 11. CSS review ledger (2026-09-22)

A Frontend Developer subagent reviewed the live prototype's CSS and JS before the port,
using the `react-best-practices` and `caveman` skills. It measured in Chromium through
Playwright. WebKit and Firefox were not installed, so every cross-engine claim is
unverified. The controller re-checked the claims that touch app code against the
baseline. One claim was corrected: F4 said the only `MotionConfig` is inside
`SnapPresentation`, but the view has one too (`meeting-flow.tsx:283`). F4's fix still
stands, because `"user"` keeps opacity animations and their delays.

| Finding | Kind | Where it landed |
|---|---|---|
| F1 column empty while its run scrolls in | bug | §4.1 |
| F2 band mode reports a stale active beat | bug, probably live on iPad portrait | §4.5, V4 |
| F3 smooth scroll ignores reduced motion | bug, live | **not addressed** (C44) |
| F4 splash ignores reduced motion | bug | E7 |
| F5 splash keys reach the shell's key map | fragile | E4 wiring |
| F6 absolute layers clip growth beats | fragile | §4.4 |
| F7 type sized in bare `cqw` | fragile | U5 tokens |
| F8 unnamed container queries | fragile | §4.3 |
| F9 jumps measured with `offsetTop` | fragile | §4.1 |
| F10 `labelledBy` targets vanish | fragile | §2 |
| F11 splash sized in `cqw`, mount point | fragile | E2, E4 wiring |
| F12 band stickiness in a lone grid row | fragile, WebKit unverified | §4.1, V4 |
| S1 literals shadow tokens | smell | U8, U14 |
| S2 three one-off capsule offsets | smell | U6, C45 |
| S3 splash timing restated | smell | §5.1 |
| N1 root `--band-h` default | nit | §4.2 |
| N2 `1fr` stack track | nit | §4.1 |
| N3 `aria-label` hides the caption | nit | E2 |
| N4 `activeIndex` in its own context | nit | not adopted, §4.5 |
| N5 re-anchor after resize | nit | V4 |

---

## 12. Semantics and homes (2026-09-22 grilling)

Decided with the owner in a grilling session after the plan was written and before anything was
built. **This section is binding over §2, §4, §5 and §8 where they differ**, and the plan is
revised against it. Glossary entries are in `CONTEXT.md#presentation-terms`.

### 12.1 Vocabulary

| Term | Meaning | Replaces |
|---|---|---|
| **Presentation** | The engine: a full-height scroll surface showing one slide per screen | "snap presentation", "deck" |
| **Slide** | One screen: heading, optional background, feature content. Type `PresentationSlide<TContent>` | "beat", "section" |
| **Frame** | Where the heading sits: `'column'` (default, in the run's heading column) or `'full'` (centred over the slide) | `'split' \| 'full'` |
| **Run** | Consecutive `column` slides sharing one heading column; derived by `groupSlides`, never declared | "run" (kept), "group" |
| **Heading column** | The sticky, fading column of a run | "pinned column" |
| **Content** | A slide's feature-specific content, the `content` field, rendered as `Slide`'s children | "body", "stage", "canvas" |
| **Subheading** | The second line under a title, on a slide heading or a splash caption | `line`, `lineAccent`, "subtitle" |
| **Splash screen** | The branded full-window mark at an entrance; dismisses `timed` or on `press` | "splash overlay" |

"Beat" stays the story word in `docs/sales/` and appears nowhere in code, including the keyboard
hint, which becomes "Previous / next slide in the presentation". "Stage" is the shell's word
(`StageFrame`, `data-stage`, `--stage-inset-b`, `--stage-clear-b`) and the engine never uses it.

### 12.2 Homes and the seam rule

| ID | Decision |
|---|---|
| **S1** | **The engine lives in `src/shared/components/presentation/` now.** Meeting-flow is its first consumer; Program and Portfolio are next. The folder holds its components plus sibling `types.ts`, `context.tsx`, `motion.ts`, `group-slides.ts`, `slide-scroll-top.ts` and its own `DOCS.md`, following the sibling-file precedent of `src/shared/components/splash-screen/`. No nested `lib/`. |
| **S2** | **Generalise the seam, never thin the feature.** When a consumer needs more than the engine offers, the engine's interface grows; a feature never wraps, forks or patches around it. This is the rule for every shared primitive in this spec. |
| **S3** | **Prefix rule.** `Presentation` prefixes every exported type (`PresentationSlide`, `PresentationHeading`, `PresentationBackground`, `PresentationFrame`, `PresentationGroup`, `PresentationHandle`) and the root component `Presentation`. Child components carry `Slide` names (`Slide`, `SlideRun`, `SlideBackground`, `SlideImage`); `HeadingColumn`, `Reveal` and `Scrim` are unprefixed. Files are the component names in kebab case. Pre-existing *feature* types that carry the prefix (`PresentationAgent`, `PresentationDocument`, `PresentationPartner`) are shipped names outside this spec's scope; renaming them is logged as a follow-up. |
| **S4** | **One `Slide` component.** It owns the `<section>` box (snap target, in-view report, scroll margin) and switches heading placement on its `frame` prop: `full` renders the centred heading with `Reveal`; `column` renders a visually hidden `<h2>` and nothing else above the content. There is no base box component and no per-frame wrapper. The kind switch renders `<Slide {...slide} index={index}>` with the content as children. |
| **S5** | **Groups carry only `items`, and `frame` is resolved once.** `IndexedSlide<TContent> = { slide: PresentationSlide<TContent>, index: number, frame: PresentationFrame }` where `frame` is the slide's declared frame or `'column'`; `groupSlides` is the one place that default is applied. `PresentationGroup<TContent> = { kind: 'full', item: IndexedSlide<TContent> } \| { kind: 'run', items: IndexedSlide<TContent>[] }`. `SlideRun({ items, numberedTotal, children })` and `HeadingColumn({ items, numberedTotal })` derive headings and the first index from `items`; nothing is stored twice. |
| **S6** | `SlideProps<TContent> = Omit<PresentationSlide<TContent>, 'frame'> & { index: number, frame: PresentationFrame }`: the slide's fields with the resolved frame and its deck index, derived, never restated. A section component spreads them into `<Slide>` and never hard-codes a frame; the config is the only source of where a heading sits. |
| **S7** | **Heading.** `PresentationHeading = { title: string; subheading?: { text: string; accent?: string }; number?: number }`. Every column slide writes `subheading: { text }`; the hook writes `subheading: { text: 'It starts when you do your', accent: 'due diligence.' }`. The `hero` content arm stays empty (owner, 2026-09-20). |
| **S8** | **Background** is `{ kind: 'image', src, alt }` only. The `portfolio` arm and its fallback branch arrive with spec D, not before. |
| **S9** | **Shell seam, named props.** `Presentation({ label, rootAttributes?, keyShortcuts?, clearBottom?, className?, ref?, children })`. `rootAttributes?: HTMLAttributes<HTMLDivElement>` carries host markers such as `data-step-root`; `keyShortcuts?: string` sets `aria-keyshortcuts`; `clearBottom?: string` is any CSS length and sets `--presentation-clear-b` inline, which every engine layer reads as `var(--presentation-clear-b, 0px)`. The engine owns `role`, `tabIndex`, `aria-label` and the class merge. Meeting-flow passes `rootAttributes={{ 'data-step-root': true }}`, `keyShortcuts={KEY_SHORTCUTS.presentation}` and `clearBottom="var(--stage-clear-b)"`. `PresentationHandle` (`next`, `prev`) moves to the engine's `types.ts`. |
| **S10** | **Container names.** The scroller is `[container:presentation/size]` and every engine query is `@max-[56rem]/presentation:`. The comparison keeps `@container/comparison`. `--band-h` is engine-internal and unchanged. |
| **S11** | **Tokens.** `text-presentation-*` unchanged; spacing becomes `gap-presentation-{tight,group,zone}` (and `p*-presentation-*`); palette stays `--presentation-{ground,accent,scrim}` at `:root`. All live in `globals.css` under a comment naming `src/shared/components/presentation/` as the owner. |
| **S12** | **Docs split.** `src/shared/components/presentation/DOCS.md` holds the engine rules (frames, runs, named containers and what `cqw`/`cqh` measure, snap arithmetic, the centre-line rule, tokens, the seam). `src/features/meeting-flow/DOCS.md` holds the Who We Are deck, the kind switch and the splash use. K8 splits accordingly. |
| **S13** | **Feature names.** `WhoWeAreContent` (the kind union), `WhoWeAreContentOf<K>`, `WhoWeAreSlide = PresentationSlide<WhoWeAreContent>`, `WHO_WE_ARE_SLIDES`, `WHO_WE_ARE_GROUPS`, `PROOF_POINT_COUNT`, in `constants/who-we-are-slides.ts` (renamed from `who-we-are-sections.ts`). The kind switch stays inline in `WhoWeAreStep` (`steps/who-we-are/index.tsx`), as today; there is no dispatcher component, so no name competes with the `WhoWeAreSlide` type. The `hero` case renders `<Slide {...props} />` with no children. Section components take `SlideProps<WhoWeAreContentOf<K>>` and render `<Slide {...props}>` around their content. |

### 12.3 The splash primitive

| ID | Decision |
|---|---|
| **S14** | **`SplashScreen` is controlled and owns both modes.** `SplashScreen({ open, onDismiss, dismiss, title?, subheading?, ease?, motionKey })` with `dismiss: { mode: 'timed' } \| { mode: 'press', label: string }`. Timed mode runs `SPLASH_VISIBLE_MS` then calls `onDismiss`; press mode renders the full-window `<button>` (accessible name `label`, caption attached with `aria-describedby`), auto-focused, dismissing on click or any press per E4, and calls `onDismiss`. The primitive gates itself with `useReducedMotion()`; there is no `still` prop. `ease` defaults to `BRAND_EASE` and `SPLASH_EASE` is not created. Timing stays one source in `splash-timing.ts`. The root carries `data-splash`. `SplashOverlay` → `SplashScreen`, `SplashAnimation` → `SplashMark`, plus `SplashCaption`. |
| **S15** | **Visibility policy is the caller's.** `useSplashVisibility` is deleted. `src/shared/hooks/use-session-once.ts` exports `useSessionOnce(key, enabled) → [open, dismiss]`: `open` is `enabled && !sessionStorage[key]`, `dismiss` writes the key and closes. Writing happens on dismiss, so a reload mid-splash replays it once (E5 as amended by plan ruling 7). |
| **S16** | **Session keys are feature-owned; the namespace is shared.** `src/shared/constants/storage-keys.ts` gains `sessionStorageKey(...parts: string[])`, which joins under `STORAGE_KEY_PREFIX`; the `STORAGE_KEYS` object is untouched. Each feature declares its key beside the hook that uses it: `meetingSplashKey(meetingId)` in `src/features/meeting-flow/constants/`, `PROPOSAL_SPLASH_KEY` in `src/features/proposal-flow/constants/`. The proposal key's value changes (it gains the prefix), which shows the proposal splash once more to anyone mid-session at deploy. |
| **S17** | **Compositions live with their feature.** `MeetingSplashScreen` (`src/features/meeting-flow/ui/components/`), `useMeetingSplash` (`hooks/`) and its copy (`constants/`) move out of shared. `ProposalSplashScreen` moves to `src/features/proposal-flow/ui/components/proposal-splash-screen.tsx` and `app/(frontend)/proposal-flow/layout.tsx` imports it from there. `PwaSplashScreen` keeps its shared home and zero callers; it is edited only as far as the primitive change forces (`SplashScreen` with `dismiss: { mode: 'timed' }` and `useSessionOnce`), behaviour unchanged. |
| **S18** | **Step config.** `MeetingStepConfig` gains `subheading?: string`, read by the meeting splash (E6). |

### 12.4 What this changes in the plan

Every task is touched by the rename; Tasks 3, 4, 7 and 8 are rewritten. Task 1 still lands first
on today's `snap-section.tsx`, which Task 4 then moves to `slide.tsx`. Task 2's spacing tokens
are `gap-presentation-*`. Tasks 5 and 6 change import paths and prop types only. Task 9 writes
two DOCS files. Task 10's selectors follow the new markers. Off-limits paths are unchanged:
`src/shared/components/**` was always in scope (the splash folder already is).
