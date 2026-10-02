# Elevation ladder tokens: design

**Status:** draft for owner review (2026-10-01)
**Replaces:** the token half of `2026-09-30-surface-elevation-gutter-design.md` (its sweep was reverted in `6af35af2`; its gutter, sidebar and analytics work stays).
**Values:** picked by the owner on the `elevation-ladder` skill page; `.claude/skills/elevation-ladder/ladder.json` is the record.

## 1. The rule

One base hue. The canvas is the darkest layer. Every surface stacked over another ("over" = higher z-index) is one rung lighter, in light and dark. The public site follows the same ladder (owner, 2026-10-01). A surface knows its rung by nesting, not by a hand-picked class (owner, 2026-10-01).

| Rung | Role | Light L | Dark L |
|---|---|---|---|
| −1 | beneath the page (public footer) | 0.870 | 0.112 |
| 0 | canvas | 0.894 | 0.159 |
| 1 | section, module, table sheet, dialog, sheet | 0.918 | 0.206 |
| 2 | card in a section | 0.942 | 0.253 |
| 3 | card on a card, note, nested panel | 0.966 | 0.300 |
| 4 | menu, popover, select, tooltip-like overlays | 0.990 | 0.347 |

Knobs: light canvas 0.894, step 0.024, chroma 0.017 · dark canvas 0.159, step 0.047, chroma 0.059 · hue 253 (both) · edge 0.048 (darker than the surface in light, lighter in dark). Hairline edges stay on.

Relative steps, all computed from the nearest surface:

- **step up** (+1 rung): chips, secondary buttons, hovers (`muted`, `accent`, `secondary`).
- **half step** (+½ rung): striped table rows (`band`).
- **edge**: the surface's own lightness ± 0.048 (`border`); `border-strong` doubles it.
- **row hover / selected**: primary mixed 8% / 12% over the surface (unchanged recipe).

## 2. How nesting works (CSS only)

Per mode, `:root` and `.dark` declare the knobs: `--surface-h`, `--surface-c`, `--canvas-l`, `--step`, `--edge`, `--edge-dir`, plus `--depth: 0`.

A **surface** is any element with `bg-card` (114 uses today, including the shadcn `Card`) or the new `surface` utility. Surfaces count their own depth with a capped descendant chain in `@layer base`:

```css
:is(.bg-card, .surface) { --depth: 1; }
:is(.bg-card, .surface) :is(.bg-card, .surface) { --depth: 2; }
:is(.bg-card, .surface) :is(.bg-card, .surface) :is(.bg-card, .surface) { --depth: 3; }
/* depth 4 is reserved for overlays; nesting deeper than 3 stays at 3 */
```

The relative tokens (`--card`, `--muted`, `--accent`, `--secondary`, `--border`, `--border-strong`, `--band`, `--row-hover`, `--row-selected`, `--input-background`, `--skeleton*`) are declared on `:root, .dark` **and** on every surface, so each surface resolves them against its own `--depth`. On a surface, `--card` is the surface's own rung and `--border` its own edge; on `:root` (not a surface) they describe a card placed directly on the canvas (rung 1), and `--muted` is one step up from wherever you are (rung 1 on the canvas, depth + 1 inside a surface). A non-surface descendant (a chip, a hover, a divider) inherits the values its nearest surface computed. That is what makes a chip lift off whatever card it sits in without the chip knowing where it is.

Why on the surfaces and not only on `:root`: a custom property that uses `var()` is resolved where it is declared and then inherited as a finished colour. Declared only on `:root`, every `bg-card` would get the depth-0 answer, which is exactly the "card on card in the same colour" bug.

Fixed rungs:

- `--background` = rung 0, absolute.
- `--popover` = rung 4, absolute. Menus, selects, command palettes and context menus render in portals, so nesting can't reach them. Their item highlight uses the row-hover tint, since nothing sits above the top rung.
- New `surface-beneath` utility = rung −1, for the public footer.
- Dialogs, sheets and drawers get the `surface` utility on their content element (rung 1), so cards inside them climb from there.
- Dark sidebar rail = rung 1; light rail stays the navy token. Nested `.dark` (customer profile hero) resets to depth 0 and climbs with the dark knobs.

`.theme-marketing` and `.funnel-light` keep their own palettes: their scope re-declares the relative tokens on its surfaces with its static values, so the ladder never leaks into funnels or `/test`.

Removed: `--lift`, `--surface-card-l`, `--surface-raised` (2 uses move to `bg-popover` or `surface`).

## 3. Components that change

Kept as small as the rule allows. The token change does most of the work; no class sweep.

| Where | Change | Why |
|---|---|---|
| `ui/dialog`, `ui/sheet`, `ui/drawer` content | add `surface` | portaled, so they start at rung 1 explicitly |
| `ui/dropdown-menu`, `ui/select`, `ui/command`, `ui/context-menu` items | highlight → row-hover tint | rung 4 has nothing above it |
| `components/footer.tsx` | `bg-muted` → `surface-beneath` | footer sits under the page |
| DataTable (`data-table.tsx`, `data-table-body.tsx`, `ui/table.tsx`, `constants/cell-border.ts`) | wrapper `surface`; header and frozen column take the row's colour (`bg-inherit`) instead of `bg-background`; rows striped by React index parity (`data-band`), not `nth-child`; cell rules → edge token | the records tables: the owner's first ask |
| Dashboard module lists (undo the de-carding in `84428499`) | meeting, proposal and project items are cards again | the ladder now makes card-in-module visible |
| `bg-background` used *inside* a surface | reviewed screen by screen as screenshots show them; never by mapping table | it paints a canvas-coloured hole in a lighter card |

## 4. Order of work

1. **Tokens + nesting + `theme:check`**: one commit, after the owner approves the screenshot set in §5. `theme:check` learns rungs: body and muted text on rungs 0–4 (AA), edge vs its rung, step-up vs its rung. If a text token fails on a rung, the fix is proposed to the owner, not slipped in.
2. **Records tables** (§3 DataTable row). Blocked until another session commits its edits to `data-table.tsx`, `data-table-body.tsx`, `primary-cell.tsx`.
3. **Dashboard cards** (undo the de-carding).
4. **Public site**: footer beneath; check navbar, hero and sections on `/`, `/about`, a services page.
5. **Overlays**: dialogs, sheets, menus.
6. Anything else the owner flags, one surface at a time, each with a before/after pair.
7. Update the `elevation-ladder` skill: `measure.map` probes nested surfaces so "Local build now" shows real rungs; record `applied` in `ladder.json`.

## 5. Verification gate (every step)

- `pnpm tsc`, `pnpm lint`, `pnpm theme:check`.
- Screenshots in light and dark, local vs the live site where one exists: `/dashboard`, `/dashboard/meetings` (records table), a proposal-flow page, a customer profile (nested dark hero), one dialog and one dropdown, `/` scrolled under the navbar, the bottom of `/` (footer), `/about`.
- The owner sees the pairs before the commit. No step proceeds on numbers alone.

## 6. Not in this change

- `text-secondary` used as text colour on `/about` ("Master Craftsmanship", "Our story"): invisible on the live site too; separate fix.
- Navbar CTA icons (near-white) on the dark-mode primary (pale cyan from Navy Rail): separate fix.
- The 200-file alpha-class sweep stays reverted. See-through classes that look wrong get fixed where the owner sees them.

## 7. Risks

- **Selector coupling:** nesting keys off the `bg-card` class name. A responsive or state variant (`md:bg-card`, `hover:bg-card`) is not a surface. Acceptable: surfaces don't switch on and off by breakpoint here; any that do get `surface`.
- **Holes:** `bg-background` inside a lighter surface will now read as a sunken hole (130 uses). Most are page wrappers; the rest surface in screenshots and get fixed one by one.
- **Light top rung:** rung 4 is 0.990, so menus barely clear white. Shadow keeps them separate; the owner can retune with the skill.
- **Everything moves at once** when step 1 lands, because the tokens are shared. That is why step 1 waits for the full screenshot set.
