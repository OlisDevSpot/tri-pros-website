# Remodel ROI Calculator: clarity and shared-component follow-ups

> **Status:** open, 2026-09-27. Owner-requested follow-up to the v1 spec (`docs/superpowers/specs/2026-09-27-remodel-roi-calculator-design.md`) and its plan.
> **Delete this file** once both parts ship; move lasting decisions into the tracker (`docs/plans/2026-09-26-sales-calculators-epic.md`, R16).
> **Owner rule for both parts:** use the app's existing colors. Add a new one only when there is no other way, and ask first.

The owner asked for two things to follow v1:

1. **Clarity improvements:** a brainstorm, chapter by chapter, on making the presentation clearer and easier for a homeowner to follow.
2. **Shared components:** look at the meeting-flow tabs and layout, and move components that both features can use into `src/shared/components`.

## Part 1: Clarity brainstorm (chapter by chapter)

**Why it matters.** The owner said v2 of the studies page "looks much better" but still needs "a few corrections for the clarity of the calculator's presentation and easier comprehension by the homeowner." v1 ships the spine and the chapter pattern as approved. This session sharpens what each chapter says and shows.

**How to run it.** Grill one chapter at a time, in spine order (01 → 08), on the live page. Record each correction as a line in the owner's words, then batch them into one mock round and one spec amendment.

Questions to open each chapter with:

| Chapter | Starter questions |
|---|---|
| **01 Two ways forward** | Is the headline question the right first thing a homeowner reads? Are the two path descriptions short enough to take in at a glance? |
| **02 The answer** | Is the order of the three figures right? Does "pays for itself" before "costs less monthly" confuse, even with the note? |
| **03 Today** | Are three bars (today, year 5, look-ahead) the right points? Should the loans line sit here or in its own place? |
| **04 Monthly** | Trend or "What makes it up" as the default view? Does the early shaded band need a label? Is the one-line math readable, or too dense? |
| **05 Waiting** | Should the cost of waiting be shown per system or as one total? |
| **06 Home value** | Is 80% of the price explained well enough to be believed? |
| **07 Adding up** | Are the breakdown labels plain enough ("Interest you skip", "Replacement you skip")? Does the ahead / behind shading need a legend? Where should net worth sit? |
| **08 Based on** | Is it useful to a homeowner, or mostly for the rep? |
| **Throughout** | Font sizes for older eyes; how rounded the numbers are; the "Show the math" vs info-icon split; the chapter rail's discoverability. |

**Ideal outcome:** a short, ranked list of corrections the owner agrees to, applied in one pass to the mock and then the build.

## Part 2: Meeting-flow components that could be shared

**Why it matters.** The calculator and the meeting flow both need:
- collapsible sections with a done mark;
- stat tiles;
- money fields;
- segmented toggles;
- chip multi-selects;
- a numbered step or chapter marker;
- section scroll-spy.

Today the meeting flow builds these inline or bound to meeting data. v1 of the calculator builds its own feature-local versions, as the owner sequenced it. This part merges the two into shared components, so both features use one version of each.

Source: a read-only survey of `src/features/meeting-flow/**` and `src/shared/components/**` (2026-09-27). Line references are from that date; verify them against the code before acting.

### 2.1 Generalize now (low coupling, clear reuse)

- **Step / chapter marker.**
  - Source: the numbered roundel with active / done / pending styles in `src/features/meeting-flow/ui/components/shell/step-tabs.tsx` (about lines 46–55).
  - Proposal: a shared `StepMarker { number, state }`.
  - Calculator use: the chapter rail and the panel's done marks.
- **Collapsible section.**
  - Source: `src/features/meeting-flow/ui/components/context-panel-section.tsx`. It uses Radix `Collapsible` and `AnimatedCollapsibleContent`, with a filled/total badge and a chevron.
  - Proposal: a shared `CollapsibleSection { title, summary?, status, defaultOpen, children }`. Its only coupling today is a `fields` prop.
  - Calculator use: the inputs accordion.
  - `persona-profile-section.tsx` hand-rolls the same thing and would move onto it.
- **Stat tile.**
  - Source: the same `{ value, label, sub? }` markup appears in `steps/program-presentation.tsx` (key stats) and `steps/deal-structure-fields.tsx` (Final price, Monthly Payment).
  - Proposal: a shared `StatTile`.
  - Calculator use: chapter 02 and the top bar.
- **Money field.**
  - Source: `NumberField` (null-safe) plus the `InputGroup` `$` addon.
  - Proposal: a shared `MoneyField`.
  - The inputs in `deal-structure-fields.tsx` that strip non-digits (about lines 91–100 and 237–246) can't hold an empty value and would switch to it.
- **Duplicate formatter.**
  - `formatCurrency` in `src/features/meeting-flow/lib/loan-calc.ts` duplicates `formatAsDollars` (`src/shared/lib/formatters.ts`). Drop it.
- **Horizontal strip hook.**
  - `useScrollStripToActive` (`src/features/meeting-flow/hooks/use-scroll-strip-to-active.ts`) has no coupling; move it to `src/shared/hooks`.
  - Calculator use: a horizontal chapter strip on narrow screens.

### 2.2 Generalize with an adapter

- **Presentation engine** (`src/shared/components/presentation/presentation.tsx`, `slide.tsx`).
  - It already tracks the active slide and scrolls to an index.
  - Blockers: snap, the full-height slide and the dark background are always on.
  - Options: add opt-outs for those, or extract a shared `useSectionSpy` that both it and the calculator use.
  - This also settles the two spy implementations: `slide.tsx` (motion `useInView`) and `src/shared/hooks/use-active-section.ts` (the ratio-based one v1 reuses).
- **Inspector panel.**
  - Source: `meeting-panel.tsx` + `meeting-panel-header.tsx`.
  - Proposal: a generic `InspectorPanel { id, label, sections, openSection }`, for side panels that keep the stage visible.
- **Segmented control.**
  - Source: the `Button`-pair toggles and term picker in `deal-structure-fields.tsx`.
  - Proposal: move them onto `ToggleGroup type="single"` with one shared segment style, plus a react-hook-form adapter.
- **Chip multi-select.**
  - Source: the chip styling in `project-section/reason-picker.tsx` (`ToggleGroupItem` with a check icon, 44px).
  - Proposal: extract it as a shared chip variant; the trade logic stays local.
- **Proof tiles.**
  - Source: `ProofTile` / `ProofFigure` / `ProofRail` in `steps/who-we-are/`.
  - Proposal: fold them into `StatTile` with a "presentation" tone.
- **Also possible, if the calculator needs them:** `InspectorRail` (make the items a prop), `StepCapsule` (take the total and copy as props), `StoryPhaseBar` (take an items prop).

### 2.3 Leave feature-local

- `TopBar`, `CustomerChip`, `SyncStatusIndicator`, `MeetingSection`: meeting and customer identity.
- `StageFrame`, `StepRegion`: tied to the stage layout variables.
- `ContextPanelField`: autosave, not react-hook-form.
- Program and deal content.
- Who-we-are deck pieces.
- Trade pickers.
- `usePresentMode`.

### 2.4 Already shared: use as-is

- **Sheets:** `ResponsiveSheet`, which v1 already uses.
- **Primitives:** `accordion`, `AnimatedCollapsibleContent`, `toggle-group`, `input-group`, `number-field`.
- **Popovers:** `hybridPopoverTooltip`.
- **Line items:** `expandable-line-items`, a possible "show the math" host.
- **States:** empty, loading and error.
- **Hooks:** `use-active-section`, `use-is-below-lg`, `use-match-media`.

**Ideal outcome:** one plan that lands the 2.1 components in `src/shared/components`, moves both the meeting flow and the calculator onto them, and deletes the feature-local copies. The adapter work in 2.2 goes only as far as the calculator needs.

## Open owner decisions

- Which 2.2 adapters are worth doing now, and which wait until a third feature needs them.
- Whether the clarity round (Part 1) comes before the shared-component extraction (Part 2), or runs alongside it.
