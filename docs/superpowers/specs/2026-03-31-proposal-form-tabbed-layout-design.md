# Proposal Form Tabbed Layout Redesign

**Issue:** #26
**Branch:** `feat/26-ui-ux-improve-proposal-form-with-collaps`
**Date:** 2026-03-31

## Problem

The proposal form renders all sections (project metadata, SOW, funding) in one long scrollable card. This causes excessive scrolling and makes the form feel dense.

## Solution

Replace the single-card layout with a centered tab bar: **General** | **Scope of Work** | **Funding**. Each tab renders its own card. Tab state persisted via nuqs query param (`?formTab=`). Directional slide animation between tabs using motion/react.

---

## Tab Structure

### State Management
- `useQueryState('formTab')` from nuqs — values: `'general'` | `'sow'` | `'funding'`, default `'general'`
- Track previous tab index in a ref to compute slide direction (left-to-right or right-to-left)
- Tab index mapping: general=0, sow=1, funding=2

### Tab Bar
- Centered horizontally above the content card
- Three tabs with underline-style active indicator
- Use shadcn `Tabs` / `TabsList` / `TabsTrigger` for the trigger bar only — content rendering is manual (for motion animation control)

### Animation
- `AnimatePresence` with `mode="wait"` wraps the active tab content
- `motion.div` per tab with directional slide:
  - `initial={{ x: direction > 0 ? 100 : -100, opacity: 0 }}`
  - `animate={{ x: 0, opacity: 1 }}`
  - `exit={{ x: direction > 0 ? -100 : 100, opacity: 0 }}`
- Shared transition: `{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }`
- `key` on the motion.div set to the tab value so AnimatePresence detects changes

---

## General Tab

Fields extracted from the current `ProjectFields` and `form/index.tsx`:

- **Project Name** — text input (currently in `form/index.tsx` CardHeader)
- **Pricing Mode** — breakdown/total toggle switch (currently in `form/index.tsx` CardHeader)
- **Project Type** — select dropdown
- **Time Allocated** — text input
- **Valid Through Timeframe** — select dropdown

Layout: Project Name full-width, pricing toggle below it, then a 3-col responsive grid for type/time/timeframe.

### Component
- **New file:** `form/general-fields.tsx`
- Exports `GeneralFields` component
- Receives `pricingMode` as prop (or reads from form context)
- All fields use existing `useFormContext<ProposalFormSchema>()`

---

## Scope of Work Tab

Renders the existing SOW accordion UI plus Agreement Notes:

- "Complete Scope of Work" heading + add button
- SOW collapsible accordions (existing `Collapsible` + `motion.div` + `SOWCollapsibleHeader` + `SOWSection`)
- Agreement Notes textarea + Templates button (below the accordions)

### Component
- **Modified:** `form/project-fields.tsx`
- Remove: Project Type, Time Allocated, Valid Through Timeframe fields (moved to General)
- Keep: SOW field array management, collapsible logic, Agreement Notes

---

## Funding Tab

Two sub-sections with a border-top divider between them:

### Base Pricing
- Heading: "Base Pricing"
- Fields: Misc Price (breakdown mode only), Total Contract Price, Deposit
- Responsive grid: 3-col desktop, stacked mobile
- Settings popover (show pricing breakdown toggle) moves here — sits next to the heading

### Incentives
- Heading: "Incentives" + Add button
- Collapsible accordion per incentive (existing pattern)
- **Incentive header updates:**
  - Add expiry badge: if `expiresAt` is set, show a badge with formatted date (e.g. "Expires Apr 15")
  - Existing: type label, amount/offer badge, notes preview
- **Delete confirmation:** wrap `remove(index)` in `useConfirm` (same pattern as SOW delete)
- Newly added incentives auto-expand
- PricingBreakdown renders at the bottom (when `showPricingBreakdown` enabled)

### Component
- **Modified:** `form/funding-fields.tsx`
- Add `useConfirm` for incentive delete
- Move settings popover from `form/index.tsx` into this component

---

## Agreement Notes on Proposal Preview

- **Modified:** `proposal/scope-of-work.tsx`
- After the Accordion component, if `agreementNotes` has content, render it in a styled block
- Simple: heading "Agreement Notes" + paragraph with the notes text
- Uses the same card/section styling as the rest of the preview

---

## Form Index Rewrite

**Modified:** `form/index.tsx`

The current file renders a single `Card` with `CardHeader`/`CardContent` sections. Replace with:

1. Tab bar (centered, using shadcn Tabs trigger only)
2. `AnimatePresence` wrapper
3. Active tab content inside `motion.div` with directional slide
4. Submit button stays below the tab content (always visible)
5. Error display stays below the tab content

The form element and `useFormContext` stay at this level — tabs are purely visual grouping.

Remove from this file:
- Project Name field (moves to GeneralFields)
- Pricing Mode toggle (moves to GeneralFields)
- "Project Information" / "Funding Information" CardHeaders (replaced by tabs)
- Settings popover (moves to FundingFields)

---

## Files Summary

| File | Action | What |
|------|--------|------|
| `form/index.tsx` | **Rewrite** | Tab container + AnimatePresence + submit/error |
| `form/general-fields.tsx` | **New** | Project name, pricing toggle, type, time, timeframe |
| `form/project-fields.tsx` | **Modify** | Remove 3 fields (moved to General), keep SOW + Agreement Notes |
| `form/funding-fields.tsx` | **Modify** | Add useConfirm to incentive delete, absorb settings popover |
| `form/incentive-collapsible-header.tsx` | **Modify** | Add expiry badge |
| `proposal/scope-of-work.tsx` | **Modify** | Render agreement notes below accordion |

## Out of Scope
- Tab validation indicators (red dot on tabs with errors)
- Auto-advance to next tab on completion
- Keyboard arrow navigation between tabs
