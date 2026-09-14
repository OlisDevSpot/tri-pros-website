# Who We Are — Scroll Presentation Design

**Date:** 2026-09-12
**Status:** Draft for review
**Scope:** Meeting flow, step 1 (`who-we-are`). Replaces the reading-page layout with a
choreographed, snapping scroll presentation and introduces a reusable presentation
primitive the other customer-facing steps can adopt later.

Related: `docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md` (snap recipe,
cited), `docs/sales/due-diligence-story.md` (the narrative this step tells),
`docs/design-system/DESIGN.md` (Command Desk world), mock at
https://claude.ai/code/artifact/6cdf383f-ad15-4cc8-b212-55575f9ad193 (the chosen
"choreographed scroll" study is the visual reference).

---

## 1. Goal

The agent is talking at the kitchen table, five to ten minutes into the
trusted-contractor phase, right after the Circle of Pain. The screen is the picture
behind the story, not a page to read. The step must:

- show one beat per screen, nine beats total, each the full height of the step's
  scroll area, snapping cleanly on every wheel gesture or swipe;
- keep a pinned column that names the current point, so the agent and the homeowner
  always know where they are in the six-point framework;
- carry one image, one line, and one proof figure per beat, with the paragraph copy
  left to the agent's mouth;
- let the homeowner read the license and the certificate of insurance when they
  reach for the screen;
- work on a laptop (trackpad, wheel, keyboard) and on a tablet in both orientations,
  and degrade honestly on a phone;
- use the same page padding as every records page (already fixed in the shell, see §7).

## 2. Decisions already made

| Decision | Choice | Where it was made |
|---|---|---|
| Direction | Choreographed scroll (study B), not a deck or chapters | User, 2026-09-11 |
| Snap mechanism | CSS scroll snap on the step scroller; `useInView` with `root` for reveals; no JS scrolling except native `scrollTo` for buttons | Research note |
| Section height | `100cqh` against the scroller as a size container, not percentage height | Research note §4 |
| Pinned column | `position: sticky` inside the snap container, `self-start` with explicit height | Research note §2 |
| Reduced motion | `MotionConfig reducedMotion="user"` plus `motion-safe:` gating on smooth scroll | Research note |
| Header | No "Step x of y" title bar; step title is a visually hidden `h1` | Shipped 2026-09-11 |
| Facts | All figures from `src/shared/constants/company/` or the existing `DUE_DILIGENCE_ITEMS`; the warranty tile is dropped because no constant carries the term | Critique 2026-09-11 |

## 3. Content: the nine beats

Order and copy are fixed by the due-diligence story. Copy lives in constants, never in
components.

| # | Kind | Title | Line under the title | Proof | Media |
|---|---|---|---|---|---|
| 1 | hook | A successful project doesn't start on demolition day. | It starts when you do your due diligence. | none | `/hero-photos/modern-house-5.jpg` (stand-in) |
| 2 | credentials | Licensed. Insured. Verifiable. | none | strip: license number, general-liability coverage, project count | the two real documents from the company-docs bucket |
| 3 | point 1 | Proper licensing and permits | `DUE_DILIGENCE_ITEMS[0].short` | `stat` / `statLabel` | `/process/pre-construction-stage.jpeg` (stand-in) |
| 4 | point 2 | A clear scope of work | `[1].short` | `[1].stat` | `/process/design-stage.jpeg` (stand-in) |
| 5 | point 3 | Proper supervision | `[2].short` | `[2].stat` | `/process/construction-stage.jpeg` (stand-in) |
| 6 | point 4 | Communication | `[3].short` | founder name and title from `teamInfo.owners[0]` | `teamInfo.owners[0].image` (real, portrait) |
| 7 | point 5 | Office support | `[4].short` | `[4].stat` | placeholder slot, labeled |
| 8 | point 6 | Proof of performance | `[5].short` | `[5].stat` | `/portfolio-photos/projects/Riviera/hero-before.jpeg` and `hero-after.jpeg` (real) |
| 9 | truth | Success isn't about the finishes. | the closing quote from the story | none | `/process/handover-stage.jpeg` under a heavy scrim |

Point titles are the existing `DUE_DILIGENCE_ITEMS[n].title` values, lightly recast
in the constants file where the mock changed them (e.g. "Clear Scope of Work" reads
"A clear scope of work"). The `description` paragraphs are not rendered.

The credentials strip is derived, not typed: `companyInfo.licenses[0].licenseNumber`,
the General Liability entry in `companyInfo.insurances`, and `companyInfo.numProjects`.

The truth beat ends with a "Continue to Specialties" action that advances the step.

**Follow-up, out of scope here:** "2+ supervisors", "1 dedicated contact", and "100%
written" are typed inline in `due-diligence.ts`. They render as-is in this build and
get a proper home in the company constants in a separate issue. The workmanship
warranty stays out of the UI until `docs/company/warranties-and-trust.md` carries a
real term.

## 4. Architecture

### 4.1 Step layout modes

`MeetingStepConfig` gains `layout: 'page' | 'presentation'`. `who-we-are` is
`presentation`; every other step stays `page`.

In `meeting-flow.tsx` the step area branches once on that flag:

- `page`: unchanged, the existing `min-h-0 flex-1 overflow-y-auto py-6` scroller.
- `presentation`: the step component is rendered directly as the flex child and owns
  its own scroller, with no vertical padding, because `100cqh` measures the content
  box and the sections must fill it exactly.

The visually hidden `h1` stays in both modes. Header and footer are untouched.

### 4.2 Presentation primitive (feature-local, reusable)

`src/features/meeting-flow/ui/components/presentation/`

- **`snap-presentation.tsx`** — the scroller. Classes:
  `relative min-h-0 flex-1 overflow-y-auto overscroll-contain snap-y snap-mandatory
  motion-safe:scroll-smooth [container-type:size]`, plus `scroll-pt-(--pin-h)` and
  `[--pin-h:30cqh] lg:[--pin-h:0px]` so the mobile top band is respected by snap
  positions. `tabIndex={0}` and an `aria-label` so keyboard users can focus it and
  page through with the arrow keys natively. Wraps children in
  `<MotionConfig reducedMotion="user">`. Provides `PresentationContext`
  (`scrollerRef`, `activeIndex`, `reportInView(index, inView)`). Renders a grid:
  `grid grid-cols-1 lg:grid-cols-[minmax(16rem,38%)_1fr]`; the `aside` slot is the
  first child, the sections follow.
- **`snap-section.tsx`** — one `<section>` per beat:
  `relative snap-start snap-always overflow-hidden min-h-[calc(100cqh-var(--pin-h))]`.
  Calls `useInView(ref, { root: scrollerRef, amount: 0.5 })`, reports to the
  presentation context, and exposes its own `SectionInViewContext`. Static media is
  a normal child; nothing on the section itself is ever transformed.
- **`reveal.tsx`** — `motion.div` that reads `SectionInViewContext` and animates
  `hidden → visible` with a stagger index prop. Text and proof figures sit inside
  `Reveal`; images do not. `initial={false}` so no pre-mount animation runs; every section reveals the
  first time the in-view observer fires, including the first section on load.
- **`pinned-column.tsx`** — reads `activeIndex` and a `PinnedSummary[]`
  (`{ number?, title, line, count? }` per beat). Desktop (`lg+`): first grid column,
  `sticky top-0 self-start h-[100cqh]`, content bottom-aligned, large Playfair numeral
  at 26% opacity, Syne title, Nunito line, "n of 6". Below `lg`: `sticky top-0
  h-[30cqh]` band with a hairline underneath, numeral hidden. Content swaps with a
  short crossfade keyed on `activeIndex` (`AnimatePresence mode="wait"`).

Active section = the last section that reported `inView: true`. With `amount: 0.5`
and full-height sections only one section can pass the threshold at rest.

### 4.3 Who We Are step

`src/features/meeting-flow/ui/components/steps/who-we-are/`

- **`index.tsx`** — `WhoWeAreStep({ onContinue })`. Composes `SnapPresentation`,
  `PinnedColumn`, and one section component per beat from `WHO_WE_ARE_SECTIONS`.
  Replaces `steps/who-we-are-step.tsx`, which is deleted.
- **`hook-section.tsx`** — full-bleed photo, radial scrim (the design system's
  scrim-not-blur rule), title and subtitle bottom-left, subtitle in Playfair italic
  with the accent on "due diligence".
- **`credentials-section.tsx`** — dark ground with the faint drafting grid, the two
  `DocumentCard`s laid like paper (offset, slight rotation), proof strip along the
  bottom with a hairline above it. Zones never overlap: documents box ends above the
  strip.
- **`document-card.tsx`** — white-bordered `next/image` with a tinted shadow; click
  opens `DocumentDialog`.
- **`document-dialog.tsx`** — shadcn `Dialog` showing the document at `object-contain`
  on the dark ground with a `DialogTitle`; closes on click, Escape, or the close
  button.

  **Deliberately lazy.** The existing `PhotoLightbox`
  (`src/features/project-management/ui/components/photo-lightbox.tsx`) is bound to
  `MediaFile` records, so this first pass ships a minimal dialog instead of extending
  it. When the lightbox is generalized into a shared container that accepts plain
  image sources, this dialog is migrated onto it and deleted. The file carries a
  `// LAZY:` header comment pointing at this section so the debt is visible in code.
- **`point-section.tsx`** — media by `media.type`: `photo` (full bleed + scrim),
  `portrait` (right 46% column with a left fade on desktop; top 62% with a bottom
  fade below `lg`), `pair` (before/after halves with labels and a seam; halves stack
  below `lg`), `placeholder` (dashed slot with the label). Then the numeral, title,
  line, and proof inside `Reveal`s.
- **`truth-section.tsx`** — photo under an 86% scrim, title, quote in Playfair
  italic, and the continue `Button` (primary) calling `onContinue`.
- **`placeholder-slot.tsx`** — the labeled dashed slot.

Type sizes use container-query units against the scroller so the same component
holds its proportions on a 1280px laptop and a 768px tablet, mirroring the mock.

### 4.4 Data and types

- `src/features/meeting-flow/types/index.ts` adds:

```ts
export type PointMedia =
  | { type: 'photo', src: string, alt: string }
  | { type: 'portrait', src: string, alt: string }
  | { type: 'pair', before: string, after: string, alt: string }
  | { type: 'placeholder', label: string }

export interface PinnedSummary {
  number?: number
  title: string
  line: string
  count?: string
}

export type WhoWeAreSection =
  | { kind: 'hook', id: string, title: string, subtitle: string, image: string }
  | { kind: 'credentials', id: string, title: string,
      documents: { title: string, src: string, alt: string }[],
      proof: { value: string, label: string }[] }
  | { kind: 'point', id: string, number: number, title: string, line: string,
      proof: string, proofLabel: string, media: PointMedia }
  | { kind: 'truth', id: string, title: string, quote: string, ctaLabel: string }
```

- `src/features/meeting-flow/constants/who-we-are-sections.ts` exports
  `WHO_WE_ARE_SECTIONS: WhoWeAreSection[]` and `WHO_WE_ARE_PINNED: PinnedSummary[]`
  (derived from the sections). Document sources reuse the `R2_PUBLIC_DOMAINS`
  company-docs base already used today; an empty base renders the credentials media
  as a placeholder slot instead of a broken image.
- `src/features/meeting-flow/constants/presentation-motion.ts` exports
  `REVEAL_VARIANTS`, `REVEAL_TRANSITION` (exponential ease-out, ~0.5s),
  `REVEAL_STAGGER_MS`, and `PIN_SWAP_TRANSITION`. Feature-local because the timings
  are presentation-specific; the shared `src/shared/constants/motion.ts` stays the
  home for collapse tokens.
- `CREDENTIAL_ITEMS` in `due-diligence.ts` loses its only consumer and is removed.

### 4.5 Responsive behavior

| Width | Pinned column | Sections | Media |
|---|---|---|---|
| `lg` and up (laptop, tablet landscape) | left column, sticky, full height | right column, `100cqh` each | full bleed in the right column |
| below `lg` (tablet portrait, phone) | top band, sticky, `30cqh` | `100cqh − 30cqh` each, snap padded by the band | full bleed, text bottom-anchored |

Touch targets: the document cards and the continue button are at least 44px tall.
The mobile bottom nav is cleared by the dashboard template's bottom padding, as it is
for every page.

### 4.6 Motion

- Section reveal: opacity and `y` on text groups only, staggered by ~90ms, from an
  already-rendered state when the section is in view on mount.
- Pinned column swap: ~180ms crossfade.
- Images settle from a 1.06 scale to 1 over ~1.8s on first reveal (inner `motion.img`
  wrapper, never the section box).
- Reduced motion: `MotionConfig reducedMotion="user"` drops every transform, leaving
  opacity; `motion-safe:scroll-smooth` makes the only scripted scroll instant.
- Nothing intercepts wheel or touch. Snap is the browser's.

### 4.7 Accessibility

- Scroller is focusable with a label; Arrow, Page, and Space keys scroll natively and
  snap.
- Each section is a `<section aria-labelledby>` with its title as an `h2`. The hook's
  `h2` is the headline. The step `h1` stays visually hidden in the view.
- Document dialog carries a `DialogTitle`; documents have descriptive `alt`.
- Contrast: all text over photos sits over the scrim; proof figures use the light
  cobalt tint, never raw cobalt on dark.

## 5. Error handling and edge cases

- Missing image source → the placeholder slot, never a broken image.
- Fewer than nine sections (constants edited) → the pinned count follows the data.
- Very small heights (short landscape phone) → sections still `min-h` the scroller;
  text scales with container units; the pinned band collapses to title only under
  `sm`.
- Sync: the step still reports nothing to the meeting sync channel; scroll position
  is device-local by design.

## 6. Verification

There is no unit test runner in this repo, so verification is rendered and
mechanical:

1. `pnpm tsc` and `pnpm lint` clean.
2. Playwright against the dev server, at 1440×900, 1024×768, 768×1024, and 390×844:
   - after a `scrollBy` of one third of a section, `scrollTop` settles on a section's
     `offsetTop` (snap holds);
   - the pinned column shows the right title for each section;
   - the document dialog opens and closes;
   - with `prefers-reduced-motion: reduce` emulated, no transform animations run and
     the layout is identical.
3. The three design audits from `docs/ui-design-playbook.md` run on the built step
   before the PR: `ui-ux-pro-max`, `web-design-guidelines`, and the impeccable
   detector (already hooked on edit). Findings are fixed or listed in the PR.
4. Row padding measured against the records page stays at 24px on desktop and 16px
   on mobile.

## 7. Files

Created:
- `src/features/meeting-flow/constants/who-we-are-sections.ts`
- `src/features/meeting-flow/constants/presentation-motion.ts`
- `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx`
- `src/features/meeting-flow/ui/components/presentation/snap-section.tsx`
- `src/features/meeting-flow/ui/components/presentation/reveal.tsx`
- `src/features/meeting-flow/ui/components/presentation/pinned-column.tsx`
- `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx`
- `src/features/meeting-flow/ui/components/steps/who-we-are/hook-section.tsx`
- `src/features/meeting-flow/ui/components/steps/who-we-are/credentials-section.tsx`
- `src/features/meeting-flow/ui/components/steps/who-we-are/document-card.tsx`
- `src/features/meeting-flow/ui/components/steps/who-we-are/document-dialog.tsx`
- `src/features/meeting-flow/ui/components/steps/who-we-are/point-section.tsx`
- `src/features/meeting-flow/ui/components/steps/who-we-are/truth-section.tsx`
- `src/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot.tsx`

Modified:
- `src/features/meeting-flow/constants/step-config.ts` (add `layout`)
- `src/features/meeting-flow/types/index.ts` (section and media types, `layout` type)
- `src/features/meeting-flow/ui/views/meeting-flow.tsx` (layout branch, `onContinue`)
- `src/features/meeting-flow/constants/due-diligence.ts` (remove `CREDENTIAL_ITEMS`)

Deleted:
- `src/features/meeting-flow/ui/components/steps/who-we-are-step.tsx`

Already shipped on main, uncommitted (2026-09-11): the view's per-row padding removal
and the step title bar removal.

## 8. Out of scope

- Generalizing `PhotoLightbox` into a shared image container. The document dialog
  is a stopgap and migrates onto the lightbox when that work happens (see §4.3).
- Redesign of the other steps; they keep the `page` layout. The primitive is built to
  be adopted by Program and Portfolio next.
- Persisting the section index in the URL, or mirroring it over the meeting sync
  channel.
- Shooting the office and team photo; the slot ships labeled.
- Moving inline claims and the warranty term into company constants (follow-up
  issue).
- A convention note that views must not add horizontal padding because the dashboard
  template owns it (offered separately).
