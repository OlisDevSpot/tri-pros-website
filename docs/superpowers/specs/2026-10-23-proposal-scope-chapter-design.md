# Proposal page: Scope chapter, sticky headings and the phase well

Status: APPROVED by the owner 2026-10-23, with K11. UI-only: no DAL, tRPC, schema or seed change.
Mock (frozen): `.superpowers/sdd/2026-10-23-proposal-scope-sticky/mock/scope-studies.html`, artifact https://claude.ai/artifact/2vL6ywByp8LhSfu4kfxbou (v5). Direction A with the rung-1 well leads it.

## 1. Goal

The homeowner, and the agent presenting on an iPad, read every step of the scope without opening anything, and always know which part and phase they are in while a long scope scrolls. The steps get more width, and "How we'll do it" reads as its own region of the part.

## 2. Decisions already made (owner, 2026-10-23)

| # | Decision |
|---|---|
| K1 | Every phase in every part opens expanded on load. |
| K2 | A small expand/collapse-all button sits right of the "How we'll do it" label and acts on that part only. The "· N phases" suffix goes. |
| K3 | The "We've done this before: …" chip goes. |
| K4 | The bordered box around the phase list goes. "How we'll do it" gets its own background, running the card's full width and ending before Notes. |
| K5 | The part header sticks until its part has scrolled through. Open phase rows stick under it, each pushed out by the next. Nothing in a part stays stuck once the part ends. |
| K6 | The chapter label (04 Scope) sticks on top of the stack for the whole chapter. The H2 and lede scroll normally. |
| K7 | Step text starts under the phase number below 700 px of page width; at 700 px and up it stays under the phase title as today. |
| K8 | On phone the bullet dot keeps a gap from the left edge: text 34 px in from the well's edge, the dot under the phase number. |
| K9 | Direction A: the part header sticks at full size (number, title, trade, price). B (slim bar) and C (breadcrumb) are rejected. |
| K10 | The recessed look is a new ladder token, a **well** one rung below the surface it sits in, never `bg-background` inside the card (`docs/design-system/theme-conventions.md` §1). |
| K11 | The expand/collapse-all control reads clearly as a button (the shared outline button, small), not a quiet text link. Spec approved with this amendment; §10 choices 1, 2 and 4 approved as recommended, and choice 3 keeps the button at one phase. |
| K12 | The toggle's text is smaller (12 px, 28 px tall) so the button is not "in your face". |
| K13 | The well is **one rung below its card** (relative), not the page canvas. The part card is rung 2 in the DOM (`main.surface` → the chapter wrapper's `bg-background` → `bg-card`), so here the well is rung 1: light 0.918, dark 0.206 (the card is 0.942 / 0.253). The mock (v5) shows these values. |

## 3. Content

Nothing new is written. Every string comes from the parsed SOW (`parseSowSection` in `src/features/proposal-flow/lib/parse-sow-section.ts`) and `proposalSteps` (`src/features/proposal-flow/constants/proposal-steps.ts`), as today. New labels: "Collapse all" and "Expand all" (button text), "Collapse all phases" and "Expand all phases" (accessible names).

## 4. Architecture

### 4.1 Stacking model

The page scroller is `#proposal-container` (inside `index.tsx`, below the top bar and the phone tab row), so `top-0` means the scroller's top on every viewport. Three sticky layers, each confined by its own containing block:

| Layer | Element | Containing block (where it stops) | `top` | z |
|---|---|---|---|---|
| 1 | Chapter eyebrow "04 Scope" | the Scope chapter wrapper | `0` | 3 |
| 2 | Part header | the part `<article>` | `var(--scope-eyebrow-h)` | 2 |
| 3 | Phase row (open phases only) | its phase `<li>` | `calc(var(--scope-eyebrow-h) + var(--scope-part-head-h))` | 1 |

- `--scope-eyebrow-h` is a fixed height (2.25rem) declared on the chapter wrapper; the eyebrow is sized from it, so nothing is measured.
- `--scope-part-head-h` is the part header's measured height, set on the `<article>` by a ResizeObserver. It changes when a long title wraps. A small hook in `src/features/proposal-flow/hooks/` returns an element's border-box height; no such hook exists in the repo yet.
- The `<article>` changes `overflow-hidden` to `overflow-clip`. Clip keeps the rounded corners and does not create a scroll container, so sticky still works (verified in the mock).
- Every sticky layer paints an opaque fill: the eyebrow paints the chapter's own background, the part header paints `bg-card`, and the phase row paints the well. Hover on a phase row must not swap the fill for the translucent `--hover` wash, or steps show through a stuck row. Hover draws as an overlay (pseudo-element) on top of the opaque fill.
- Stuck hairlines, as in the mock: the eyebrow and a stuck phase row show a bottom hairline only while stuck (the part header keeps its permanent `border-b`). Stuck state comes from one shared hook built on IntersectionObserver against the scroll root (the element observed with a negative top `rootMargin` equal to its `top`), never a scroll listener per row.

### 4.2 The chapter eyebrow leaves the header (K6)

Sticky works only against the element's parent, and today the eyebrow is a child of `ChapterHeader`'s small grid. The eyebrow becomes its own component, `chapter-eyebrow.tsx`, which `ChapterHeader` renders by default. In `ScopeOfWork` only:

- the chapter wrapper (`div.bg-background`, the chapter-wide block) renders the top spacer, then the sticky `ChapterEyebrow`, then `ChapterInner` with its top padding removed;
- `ChapterHeader` renders without its eyebrow (an explicit prop; every other chapter keeps today's markup).

The eyebrow-to-H2 distance stays as it is today (about 10 px). The eyebrow's horizontal padding matches `ChapterInner` (`px-4.5`, `@min-[700px]/proposal:px-10`) inside the same `max-w-230` column.

### 4.3 Part card (`scope-spec-card.tsx`)

- The header becomes the sticky layer 2. It is unchanged visually.
- `ScopeDoneBeforeChip` is removed, and `scope-done-before-chip.tsx` is deleted (its only caller). `usePortfolioMatch` stays: Results still reads it.
- "How we'll do it" moves into the phases component (4.4); Notes, Not included and Optional add-ons stay as they are.
- `scroll-mt-0` becomes `scroll-mt-(--scope-eyebrow-h)`, so the Overview "parts" jump (`overview-parts.tsx` → `select('scope-part-N')`) lands the part header just below the stuck eyebrow.

### 4.4 Phases (`scope-phase-list.tsx`, K1, K2, K4, K7, K8)

The component owns the whole "How we'll do it" region:

- **Well:** the region bleeds to the card's edges (`-mx-5`, the card body's padding), paints the well token, and has a hairline top and bottom from the well's own edge token. It starts at the label and ends before Notes.
- **Label row:** the "How we'll do it" label (the existing `Block` label style) on the left, and on the right the expand/collapse-all button in its own file, `scope-phases-toggle.tsx`. Per K11 it must read clearly as a button: the shared `Button` primitive (`src/shared/components/ui/button.tsx`), `variant="outline" size="sm"`, with a chevrons icon before the label. Per K12 it is toned down from `sm`: `h-7 gap-1 px-2.5 text-xs`, icon `size-3.5`. On coarse pointers an invisible hit area brings the target to about 36 px, the way `ThemeToggleButton` does in `top-bar.tsx`. Inside the well, its `--control` fill re-derives one rung above the well, so it stands on the well as a control. It reads "Collapse all" when every phase is open and "Expand all" otherwise.
- **State:** the open set starts with every index (K1). Toggle-all opens all or closes all.
- **Rows:** no box, a hairline between phases from the well's edge token, row padding `px-5` so the phase number lines up with the card's content edge. The grid stays as it is (`26px · title · N steps · chevron`, gap 10 px).
- **Steps:** `pl-[34px]` below 700 px (dot under the number, text 34 px in) and `@min-[700px]/proposal:pl-14` (56 px, text under the title, today's alignment), with `pr-5` and the existing `gap-1.5 pb-3.5`.
- **Folding a stuck phase:** when a phase is collapsed while its row is stuck, the scroller moves up by the row's distance past its sticky line, so the next phase arrives under the headers instead of leaving the reader in the following content. The same applies to "Collapse all" when the region's top is above the viewport. This uses the scroll root from `useScrollRoot()`.
- Expand and collapse keep today's grid-rows transition and `motion-reduce:transition-none`.

### 4.5 The well token (K10)

Added per `docs/design-system/theme-conventions.md` §11:

- **`surface-well`**, a class in the relative-token block of `src/app/(frontend)/globals.css`. It sets `--here-l` one rung **below** the surface it sits in, so every relative token re-derives from it (`--card` as its fill, `--border` and `--band` off it, and text checks against it). Formula intent: depth 1 → `--canvas-l`; depth n > 1 → rung n − 1; on the page itself → the rung beneath (matching `surface-beneath`). This is the same "one rung below" lightness `--tab-track` already computes (`--canvas-l + min(max(--depth − 1, 0), 1) × --lift + (--depth − 1) × --step`). In the Scope chapter the card is rung 2, so the well is rung 1 (K13).
- Added to the marketing `inherit` list.
- `scripts/check-theme-contrast.ts`: body text and muted text on the well (min 4.5) on every card rung, both schemes; a climb entry asserting the well sits below its card; the well's border inside the edge floor and cap.
- Documented in `DESIGN.md` (Neutral section, beside Bands) and in theme-conventions §0 and §1. The banned-patterns row "`bg-background` inside a surface" gains `surface-well` as the recessed alternative.
- Why it is not just `bg-background`: the mock's literal canvas made the light-mode phase dividers vanish (the card's border token equals the canvas there). A well with its own edge token keeps those dividers in both schemes.

### 4.6 Responsive

Breakpoints are the page's existing container queries on `@container/proposal`: 700 px for the step indent (K7, K8) and 1100 px for the rail and tab row (unchanged). The sticky model is the same at every width. The stuck stack measured in the mock: about 190 px at 390 px wide (29% of the scroll area) and about 165 px on iPad portrait (17%).

### 4.7 Accessibility

- The toggle-all button has a name that matches its action and updates when it flips. Phase rows keep `aria-expanded` and `inert` on closed bodies.
- Stuck headers are the real headings, not duplicates, so the reading order and heading outline do not change.
- Reduced motion: no new motion. The fold-compensation scroll is instant.

## 5. Data access

None. Reads used as-is: `useProposalDocument().proposal.projectJSON.data.sow` (unchanged). Removing the chip drops the Scope chapter's only `usePortfolioMatch` read; the provider stays for Results.

## 6. Error handling and edge cases

- SOW that fails to parse keeps today's sanitized-HTML fallback: no well and no phase stickiness, but the part header still sticks.
- A part with no phases: no well rendered.
- A single phase: the toggle-all button still shows (it flips that one phase). If you'd rather hide it at one phase, that's in §10.
- A part header taller than half the scroll area (a long title on phone): it still sticks. Accepted; the mock shows two lines at 390 px.
- Price hidden (`priceDisplayMode !== 'breakdown'`): the header has no price column; the measured height covers it.
- The media gallery after the parts sits inside the chapter, so the eyebrow stays stuck over it and lets go at the chapter end.

## 7. Verification

`pnpm theme:check`, `pnpm lint` and `pnpm tsc`; never `pnpm build`. Clear `.next` before judging rendered CSS. Playwright on the dev proposal `5876b363-bc8c-4c47-ae3e-4bce1cbd9f82` (auth via `/api/dev/playwright-session`), at 1440×900, 1024×768, 820×1180 and 390×844, light and dark:

1. On load, every phase in every part is open.
2. Sweep the scroller through the chapter in 40 px steps and measure at each stop:
   - eyebrow top = scroller top while inside the chapter;
   - part header top = eyebrow bottom while inside its part;
   - the stuck phase row top = part header bottom;
   - at most one phase row stuck per part;
   - nothing stuck once Funding starts.
3. Step text inset from the well's edge: 34 px below 700 px, 56 px at 700 px and up. Phase number inset: 20 px.
4. Folding a stuck phase leaves the next phase row directly under the part header.
5. Toggle-all flips its label, its name and every phase.
6. The Overview "parts" jump to part 2 puts its header right under the eyebrow.
7. Phase dividers and the well's edges are visible in both schemes. No horizontal overflow.
8. Screenshots of each stuck state in both schemes go to the owner (token change gate, §11.6).

The owner checks the result by hand on an iPad.

## 8. Files

- **Create:**
  - `src/features/proposal-flow/ui/components/proposal/chapter-eyebrow.tsx`
  - `src/features/proposal-flow/ui/components/proposal/scope-phases-toggle.tsx`
  - an element-height hook and a stuck-state hook in `src/features/proposal-flow/hooks/`
- **Modify:**
  - `src/features/proposal-flow/ui/components/proposal/` `chapter-header.tsx`, `scope-of-work.tsx`, `scope-spec-card.tsx` and `scope-phase-list.tsx`
  - `src/app/(frontend)/globals.css`
  - `scripts/check-theme-contrast.ts`
  - `DESIGN.md`
  - `docs/design-system/theme-conventions.md`
- **Delete:** `src/features/proposal-flow/ui/components/proposal/scope-done-before-chip.tsx`.
- **Off limits:** everything under `src/shared/modules/`, `src/shared/db/`, `src/trpc/`, `src/shared/dal/`, and `parse-sow-section.ts` (its LAZY replacement is separate work).

## 9. Out of scope and follow-ups

- The structured scope view model that replaces `parseSowSection` (existing follow-up F1).
- Sticky headings in other chapters.
- Using `surface-well` anywhere else (it is available; adoption elsewhere is a separate ask).
- **Chapter-wrapper hole (follow-up):** every proposal chapter paints `bg-background` over `main.surface`, so cards count rung 2 while they sit visually on the canvas. Fixing that changes every chapter's colours, so it belongs with the proposal ladder rethink, shown to the owner in both schemes.

## 10. Choices worth your eye

1. **Stuck hairlines:** the eyebrow and a stuck phase row get a bottom line only while stuck, as in the mock. It needs one small observer hook. The alternative is no line at all, which is simpler but lets steps slide under the rows with no edge.
2. **Well edges in light mode:** the well gets its own hairlines (top, bottom, between phases). In the mock's light scheme those dividers vanished because the border token equalled the canvas. The well fixes that, so light mode will show the phase dividers the mock did not.
3. **Toggle-all with one phase:** shown (it flips that phase). It could be hidden when a part has a single phase.
4. **The well token's reach:** I'm defining it generally (one rung below any surface) and documenting it, rather than as a Scope-only class, so the next "recessed region" request reuses it.
