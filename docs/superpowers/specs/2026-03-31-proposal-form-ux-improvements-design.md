# Proposal Form UX Improvements — Collapsible SOW + Funding Redesign

**Issue:** #26
**Branch:** `feat/26-ui-ux-improve-proposal-form-with-collaps`
**Date:** 2026-03-31

## Problem

1. SOW sections in the proposal form are always expanded, causing excessive scrolling when multiple sections exist.
2. The funding section uses a flat `flex gap-12` side-by-side layout that breaks on mobile — incentive inputs overflow and become too narrow.

## Solution Overview

Two changes to `src/features/proposal-flow/ui/components/form/`:

1. **Collapsible SOW sections** — wrap each SOW section in a shadcn `Collapsible` with a summary header.
2. **Funding layout restructure** — vertical flow with clear visual separation between funding fields and incentives.

---

## Part 1: Collapsible SOW Sections

### Component: `project-fields.tsx`

Replace the flat `SOWSection` rendering with collapsible wrappers.

**State management:**
- `useState<Set<number>>` tracks which section indices are open.
- On mount (edit mode): all collapsed except index 0.
- On mount (create mode): index 0 expanded (only section).
- On `append()`: new section index is added to the open set.
- Toggle: clicking the trigger header adds/removes the index from the set.

### Collapsed Header Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Section Title (or "Untitled Section")             $12,000  ▼  │
│  [Roofing]  [3 scopes]                                        │
└──────────────────────────────────────────────────────────────┘
```

- **Row 1 (flex justify-between):** Title text (left), price + chevron (right)
  - Price only shown when `pricingMode === 'breakdown'` and `price > 0`
  - Chevron: `ChevronDown` icon from lucide-react, rotates via `transition-transform` — `rotate-0` when open, `-rotate-90` when collapsed
- **Row 2:** Badges below the title
  - Trade badge: shows `trade.label` (e.g. "Roofing") — `bg-primary/10 text-primary` pill style
  - Scope count badge: shows "N scopes" — `bg-muted text-muted-foreground` pill style
  - Both badges hidden if their data is empty (no trade selected, no scopes)

### Expanded State

When open, the full `SOWSection` component renders below the header inside `CollapsibleContent`. The existing `SOWSection` component is unchanged — it stays as-is.

### Interaction Details

- Header is the `CollapsibleTrigger` — full-width clickable area
- Header has `cursor-pointer` and subtle hover state (`hover:bg-muted/50`)
- Delete button sits inside the header row (right side, before price) — uses `e.stopPropagation()` to prevent toggle
- Smooth open/close animation using existing `data-[state=open]:animate-accordion-down` / `data-[state=closed]:animate-accordion-up` patterns from shadcn

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `ProjectFields` | `project-fields.tsx` | Manages open state set, renders collapsible wrappers |
| `SOWCollapsibleHeader` | `sow-collapsible-header.tsx` | New component — the trigger/summary bar |
| `SOWSection` | `sow-field.tsx` | Unchanged — renders inside `CollapsibleContent` |

### shadcn Components Used

- `Collapsible` from `@/shared/components/ui/collapsible`
- `CollapsibleTrigger` from `@/shared/components/ui/collapsible`
- `CollapsibleContent` from `@/shared/components/ui/collapsible`

---

## Part 2: Funding Layout Redesign

### Component: `funding-fields.tsx`

Replace the `flex gap-12 justify-between items-start` layout with a vertical flow.

### New Structure

```
┌─ Outer card (existing border/shadow/rounded-xl) ─────────────┐
│                                                                │
│  Funding (h3 heading, full-width row)                          │
│                                                                │
│  ┌──────────┐  ┌────────────────┐  ┌──────────┐               │
│  │ Misc     │  │ Total TCP      │  │ Deposit  │  ← grid       │
│  └──────────┘  └────────────────┘  └──────────┘               │
│                                                                │
│  ── Incentives ──────────────────────────── [+ Add] ────────── │
│                                                                │
│  ┌ Incentives container (dashed border, subtle bg) ──────────┐ │
│  │                                                            │ │
│  │  ┌ Incentive 1 (card: border + bg-muted/30 + rounded) ──┐ │ │
│  │  │  Desktop: 2-col grid                                  │ │ │
│  │  │  [Type] [Amount]        row 1                         │ │ │
│  │  │  [Notes]  [Expires]     row 2                         │ │ │
│  │  │                                           [Delete]    │ │ │
│  │  └───────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  ┌ Incentive 2 (card) ───────────────────────────────────┐ │ │
│  │  │  Mobile: full vertical stack                          │ │ │
│  │  │  [Type]                                               │ │ │
│  │  │  [Offer]                                              │ │ │
│  │  │  [Notes]                                              │ │ │
│  │  │  [Expires]                                            │ │ │
│  │  │                                           [Delete]    │ │ │
│  │  └───────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  [PricingBreakdown — if showPricingBreakdown, stays here]      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Funding Fields (top section)

- Heading: `Funding` as `h3` in its own row
- Fields arranged in responsive grid:
  - Desktop: `grid grid-cols-3 gap-4` — Misc Price, Total TCP, Deposit side by side
  - Mobile: `grid-cols-1` — stacked vertically
- Remove `max-w-62.5` constraint on inputs — let them fill grid cells
- Misc Price field only renders when `pricingMode === 'breakdown'` (existing behavior)

### Incentives Divider

- Visual separator between funding fields and incentives
- "Incentives" label left-aligned, `[+ Add]` button right-aligned
- Implemented as `flex justify-between items-center` with a subtle horizontal rule or border-top

### Incentives Container

- Outer wrapper: `border border-dashed border-border/50 rounded-xl p-4 bg-muted/10`
- Empty state: "No incentives added" muted text centered

### Individual Incentive Cards

- Each incentive: `border border-border/40 rounded-lg p-4 bg-muted/30`
- Spacing between cards: `space-y-4`
- **Desktop layout (lg+):** `grid grid-cols-2 gap-4`
  - Row 1: Type + Amount/Offer
  - Row 2: Notes + Expiration
  - Delete button: bottom-right, `justify-self-end`
- **Mobile layout (<lg):** `flex flex-col gap-4`
  - Each field full-width, stacked vertically
  - Delete button: bottom-right

### Delete Button

- Stays `variant="destructive"` `size="sm"`
- Positioned at bottom-right of each incentive card
- Adequate spacing from form fields (separated by its own row)

### UX Rules Applied

| Rule | Application |
|------|-------------|
| `field-grouping` | Funding fields grouped at top, incentives clearly below a labeled divider |
| `whitespace-balance` | Generous spacing between incentive cards (`space-y-4`) |
| `progressive-disclosure` | Incentives section is visually subordinate to primary funding fields |
| `touch-friendly-input` | All inputs adequate height on mobile |
| `horizontal-scroll` | No overflow — inputs use `w-full` on mobile |
| `destructive-emphasis` | Delete button red, separated from form fields |
| `mobile-first` | Stack vertically first, expand to grid on desktop |
| `spacing-scale` | Consistent 4/8px spacing system throughout |

---

## Files Changed

| File | Change |
|------|--------|
| `form/project-fields.tsx` | Add collapsible wrapper, open state management |
| `form/sow-collapsible-header.tsx` | **New** — collapsed summary header component |
| `form/funding-fields.tsx` | Restructure to vertical layout with incentive cards |

## Files NOT Changed

- `form/sow-field.tsx` — the inner SOW form section stays as-is
- `form/index.tsx` — the parent form wrapper stays as-is
- `proposal/scope-of-work.tsx` — the preview accordion is unrelated
- `pricing-breakdown.tsx` — stays at bottom of funding card as helper

## Out of Scope

- Auto-save / draft functionality
- SOW section reordering (drag-and-drop)
- Funding preview component changes
- PricingBreakdown visual changes
