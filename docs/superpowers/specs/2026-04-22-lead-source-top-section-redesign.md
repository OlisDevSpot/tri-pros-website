# Lead Source — Top Section Redesign

**Date:** 2026-04-22
**Scope:** `LeadSourceDetailHeader` + `PerformanceStrip` + the Overview tab's first section wrapper in both `source-detail.tsx` (per-source pane) and `all-detail.tsx` (aggregate pane).
**Out of scope:** Intake URL card, form configuration editor, customer tables, left-rail picker.

## Problem

The current top section suffers four confirmed issues:

1. **Generic/templated.** Three equal-weight stat tiles — the "hero-metric" pattern explicitly banned by the design playbook. The header is an anonymous "pill + h2 + slug" stack that could belong to any admin page.
2. **Redundant signal.** `ALL-TIME LEADS` and `LEADS (ALL TIME)` show identical numbers with near-identical labels when the page-level range is "all".
3. **Missing operational story.** 9 leads, 0 signed proposals = 0% conversion. The signal that matters most to an agent asking *"is this source earning its slot in my week?"* is never surfaced.
4. **Hierarchy mush.** Five uppercase-tracked labels visible at once (PERFORMANCE + 3 stat labels + INTAKE URL). Nothing pulls the eye.

The playbook rule "one uppercase-tracked label per section max" is currently violated.

## Design

Two-band composition: editorial masthead, then an asymmetric performance signal.

```
LEAD SOURCE · /quoteme                         • Active   ⋯
QuoteMe

Overview    Customers

0 of 9 signed                           3 in the last 7 days
0% conversion rate

                             ─────
[Intake URL section — untouched]
```

### Masthead — `LeadSourceDetailHeader`

- **Eyebrow** (the single uppercase-tracked label of the header section): `LEAD SOURCE · /{slug}` at 11px, `tracking-[0.18em]`, `text-muted-foreground`, slug in tabular-nums.
- **Display name**: `text-3xl font-semibold tracking-tight text-foreground`.
- **Right cluster**: compact 6px emerald dot + `Active` in `text-xs text-muted-foreground` (no pill bg, no border) + kebab menu `size-9` (`size-11` on mobile for ≥44px touch target).
- When inactive: gray dot + `Inactive`, same shape.

No divider under the header. The tabs row below it provides the only horizontal rule in the top band.

### Performance signal — `PerformanceStrip`

Retires the 3-equal-stats grid. Replaces it with a single asymmetric row.

- Drop the `<h3>Performance</h3>` section-label wrapper entirely (in both `source-detail.tsx` and `all-detail.tsx`). The signal is the signal.
- **Hero (left)**: `{signed} of {total} signed`
  - `{signed}` in `text-3xl font-semibold tabular-nums text-foreground`.
  - `of {total} signed` inline, `text-base text-muted-foreground`, baseline-aligned.
- **Subline (left)**: `{rate}% conversion rate` in `text-xs text-muted-foreground tabular-nums`. Computed client-side from `signedProposals / total`. When `total === 0`, subline reads `No leads yet` in the same style.
- **Context (right, conditional)**: `{range} in the last {chip.label}`
  - `{range}` in tabular-nums foreground.
  - Renders only when `chip.kind !== 'all'`. When range equals all, this column is absent — no duplicate, no conditional dimming.
  - Right-aligned desktop; stacked below hero on mobile (`flex-col sm:flex-row sm:items-baseline sm:justify-between`).

### Color budget

- Primary: zero primary-color moments in either band at rest. The existing "Copy" button on the Intake URL section below remains the page's one primary moment. 60-30-10 preserved.
- Status dot: `bg-emerald-500` (active) / `bg-muted-foreground/40` (inactive).
- Numbers: `text-foreground`. Labels and connectives: `text-muted-foreground`. No destructive color on the zero — moralizing is out.

### Motion

Entrance only, on mount. Wrapped in `motion-safe:*` via Tailwind + `motion/react` stagger.

1. Eyebrow: fade + 4px translate-up, 180ms.
2. Display name: fade + 8px translate-up, 220ms (delay +40ms).
3. Hero ratio + subline: fade + 12px translate-up, 260ms (delay +100ms).
4. Right context (if rendered): fade only, 200ms (delay +180ms).

No hover choreography on numbers. No count-up.

### "All" pane (`all-detail.tsx`)

Same pattern applied to the aggregate:

- Masthead eyebrow: `LEAD SOURCES — AGGREGATE` (uppercase, same tracking).
- Display name: `All sources`.
- Right: the existing "Add customer" primary button stays; it is the page-level primary action for the All pane (takes the primary color slot). Note: this is different from the per-source pane (which has a kebab on the right) — intentional, since the All pane has no per-entity menu.
- Performance signal: same `PerformanceStrip` redesign. Caption below: `Aggregate across {sourceCount} sources`.

The All pane previously passed a `totalLabel` prop to `PerformanceStrip` to override "All-time leads". With the new design, labels don't exist in the strip anymore — the prop is dropped from the component API.

### Component API changes

- `LeadSourceDetailHeader({ source })` — unchanged prop shape; internal markup rewritten.
- `PerformanceStrip({ stats, chip, isLoading })` — **`totalLabel` removed** (no callers after this PR).
- `SourceDetail` / `AllDetail` — drop the `<h3>Performance</h3>` wrappers; keep the `<section aria-label="Performance">` for accessibility.

## Non-goals (explicitly deferred)

- Optional `description` field on lead sources (would pair well with the masthead — follow-up).
- Sparkline / weekly trend bars (YAGNI without data).
- "Review customers" action link on stalled conversion (YAGNI until we know what the agent should do).
- Monogram / avatar tiles (YAGNI, introduces a pattern we don't use elsewhere).
- Mobile responsiveness beyond the one flex-direction swap — the broader lead-sources mobile pass is a separate PR.
- `all-customers-section` / `lead-source-customers-section` tables — the `DataTable` migration is its own PR.

## Verification

- `pnpm tsc` clean, `pnpm lint` clean.
- Manual dev verification on a source with leads > 0 and signed = 0 (the QuoteMe case in the screenshot): hero reads `0 of 9 signed`, subline `0% conversion rate`, right column hidden when range=all, right column `3 in the last 7 days` when range=7d.
- Active vs Inactive source visual.
- All pane rendering with the same treatment.
- Playbook self-audit: one uppercase label per section, no nested cards, flat surfaces, tabular-nums on all numbers, motion-safe transitions, semantic tokens only.

## Risk

Low. Single feature, no shared component changes beyond `PerformanceStrip`'s internal markup + dropping the one `totalLabel` prop. Prop removal is caught by `tsc` if any other callsite exists.
