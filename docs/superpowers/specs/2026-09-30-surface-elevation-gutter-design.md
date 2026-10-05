# Surface elevation and gutter line — design

Status: draft for owner review · 2026-09-30
Studies: https://claude.ai/artifact/Ge9tUZsxMu5iTrQF7pEnNE (v4: Round 3 + Option D corrected)
Research: `docs/plans/2026-09-30-surface-ramp-research.md` · Sweep inventory: `docs/plans/2026-09-30-surface-alpha-sweep-inventory.md`
Builds on the Navy Rail theme (`docs/superpowers/specs/2026-09-29-dashboard-navy-rail-theme-design.md`, built on local main, unpushed). Token names from that work are kept.

## 1. Goal

"Sunlight from above": the page background is the lowest, darkest layer, and everything that sits on it (sidebar, cards, records tables, schedule) is slightly lighter, in light and dark mode alike. Surfaces come from one hue and a lightness ramp, not from a pile of hand-picked and see-through colours. On the records pages you can see where the table ends and where each row ends. The gap around the floating sidebar becomes the line the whole dashboard is laid out on.

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| D1 | Direction **D · One gutter**: separate cards per section (dashboard and analytics read "almost like a kanban"), not one page sheet. | Warm-up rounds 1–2 |
| D2 | One gutter `G` = the floating sidebar's inset = the page's top, right and bottom margin = every gap between section cards. **G starts at 8px.** | Round 2 + owner |
| D3 | Section headings stay inside their cards (today's `DashboardModule` shape). | Round 2 (D over E/F) |
| D4 | Rows are told apart by **bands** (every other row a slightly different solid fill), no row lines, in tables **and** dashboard lists. | Round 3 |
| D5 | Sidebar **1 · Deep navy, quiet active**: navy kept but muted; active item is a darker navy pill with only its icon in cyan; in dark mode the sidebar sits level with the cards. | Round 3 |
| D6 | Surfaces derive from four settings per mode: hue, tint strength, page lightness, one step size ("lift"). | Round 1 (B), kept under D |
| D7 | Sweep **every** see-through surface class, whole app (dashboard, meeting-flow, proposal-flow, public site, funnels) in this change. Scrims and glass over photos stay see-through. | Owner, Phase 3 |
| D8 | Keep frosted glass on popovers, dropdowns, tooltips and sticky headers, through the one existing `--popover-glass` token: the single named exception to the no-alpha rule. | Owner, Phase 3 |
| D9 | New `row-selected` token (stronger than hover). | Owner, Phase 3 |
| D10 | Skeletons use a solid border-level fill; `ui/skeleton.tsx` reads the same constant. | Owner, Phase 3 |
| D11 | Formulas are plain `oklch(calc(var(--…)))` channels, declared on **`:root, .dark`** together; `oklch(from …)` is not used. `@theme inline` stays. | Research R1–R5 |
| D12 | Bands are set from React (`data-band` by rendered position), not `:nth-child`. | Research R6 |

## 3. Content

No copy, data or company facts change. Every page renders the same content it does today.

## 4. Architecture

### 4.1 The ramp (globals.css)

Four settings per mode, plus the direction borders take:

| Setting | Light | Dark |
|---|---|---|
| `--surface-h` | 255 | 255 |
| `--surface-c` | 0.012 | 0.045 |
| `--canvas-l` | 0.945 | 0.16 |
| `--lift` | 0.055 | 0.045 |
| `--edge-dir` | -1 (borders darker than card) | 1 (borders lighter) |

The derived surface tokens are declared once, on the selector list `:root, .dark` (research R2: `var()` resolves on the element that declares the property, so a nested `.dark` wrapper such as `customer-profile-modal-content.tsx:48` needs the formulas on `.dark` too). `:root` and `.dark` blocks keep only the settings and the non-surface tokens.

| Token | Formula (L) | Light | Dark | Used for |
|---|---|---|---|---|
| `--background` | canvas | 0.945 | 0.16 | page, gutter lines |
| `--muted`, `--secondary`, `--accent` | canvas + ½ lift | 0.9725 | 0.1825 | wells, tabs, header strips, control hover |
| `--band` (new) | light canvas + 0.7 lift · dark canvas + 1.5 lift | 0.9835 | 0.2275 | every other row |
| `--card`, `--input-background` | canvas + lift | 1.0 | 0.205 | section cards, tables |
| `--surface-raised`, `--popover` | canvas + 2 lift (clamps to 1) | 1.0 + shadow | 0.25 | popovers, expanded row panel, floating bars |
| `--border` | card + edge-dir × 2 lift | 0.89 | 0.295 | every edge and header rule |
| `--border-strong` | card + edge-dir × 3 lift | 0.835 | 0.34 | emphasis, active edges |
| `--row-hover` (new) | `color-mix(in oklab, var(--primary) 8%, var(--card))` | — | — | row / list hover |
| `--row-selected` (new) | same at 12% | — | — | checked or open row |
| `--skeleton` (new) | = border | 0.89 | 0.295 | skeleton bars |
| `--skeleton-soft` (new) | card + edge-dir × 1.5 lift | 0.9175 | 0.2725 | skeleton chips and avatars |

`--band` sits between card and border in both modes so it reads as present but quiet. `--row-hover` and `--row-selected` mix onto an opaque card, so they are solid. Each new token gets a `--color-*` line in `@theme inline`. The band factors (0.7, 1.5) live in the formulas, not as more settings.

In light mode nothing can be lighter than the card, so the step above the card is carried by shadow (`shadow-sm` on cards, `shadow-lg` on popovers). That is the written rule.

`--input` (the form-control outline) keeps its literal value: it is a contrast token checked by `theme:check`, not a surface.

### 4.2 Sidebar (D5)

| Token | Light | Dark |
|---|---|---|
| `--sidebar` | oklch(0.22 0.06 262) | card level: oklch(calc(canvas + lift) 0.05 262) |
| `--sidebar-foreground` | oklch(0.86 0.02 250) | oklch(0.82 0.02 252) |
| `--sidebar-border` | oklch(0.27 0.06 262) | oklch(calc(canvas + 2 lift) 0.05 262) |
| `--sidebar-accent` (active pill) | oklch(0.3 0.065 262) | oklch(calc(canvas + 2.2 lift) 0.055 262) |
| `--sidebar-accent-foreground` | oklch(0.97 0.01 250) | oklch(0.96 0.01 250) |
| `--sidebar-active-icon` (new) | `var(--brand-cyan-bright)` | same |
| `--sidebar-hover` | solid oklch(0.26 0.06 262) (was white 6%) | solid oklch(calc(canvas + 1.6 lift) 0.05 262) |

The active menu button adds `[&>svg]:text-sidebar-active-icon` under `data-[active=true]`. The mobile dock and the user avatar read `--sidebar-accent` too, so they follow the calmer pill; the logo tile keeps brand cyan.

### 4.3 Gutter line (D2)

- `--gutter: 0.5rem` on `:root` (8px).
- `ui/sidebar.tsx` floating/inset container: `p-2` → `p-(--gutter)`, and the icon-collapsed widths `(--spacing(4))` → `calc(var(--gutter) * 2)` in both the gap div and the container.
- `DASHBOARD_MAIN_CLASS` from `md:px-6 md:py-6 md:pb-6` → `md:pt-(--gutter) md:pr-(--gutter) md:pb-(--gutter) md:pl-0`. The sidebar's own right margin is the left gutter. Mobile padding (below `md`) is unchanged, since the phone has no rail.
- Section gaps: `dashboard-view.tsx` `gap-6` → `gap-(--gutter)` (both grids and the right column); analytics and records-page shells use the same gap between cards. The records shell's `gap-3` between header, toolbar and table stays; that is spacing inside one section, not between cards.

### 4.4 Section cards and lists

- `DashboardModule`: `bg-card border shadow-sm` stays; the tinted `shadow-primary/5` goes (plain `shadow-sm`).
- Module list items (`dashboard-proposal-card`, `dashboard-meeting-card`, `dashboard-project-card`, their skeletons) drop their own border, radius and card fill and become rows: full-width, banded by position, `hover:bg-row-hover`. This removes the card-in-card nesting. The list wrapper passes the index so the band is by rendered position.

### 4.5 DataTable (records pages)

- Wrapper (`data-table.tsx:121`): `rounded-xl border border-border bg-card shadow-sm overflow-hidden`.
- Sticky header (`:139`) and header frozen cell (`:156`): `bg-card`, one `border-b border-border`.
- Rows (`data-table-body.tsx`): `rows.map((row, i) =>` sets `data-band={i % 2 ? 'odd' : 'even'}` on the data `TableRow` only (never the expanded detail row). Odd rows fill `bg-band`; cells lose `CELL_BORDER` except the last header rule. `CELL_BORDER` is deleted if nothing else reads it.
- Frozen column fill div (`:178`, `absolute inset-0 bg-background`) → `bg-card`, `group-data-[band=odd]:bg-band`, `group-hover:bg-row-hover`, all solid so scrolled content never shows through.
- Hover `hover:bg-row-hover`; `data-[state=selected]` and the open row `bg-row-selected`.
- Expanded row panel: `bg-muted` well, inner panes `bg-surface-raised` + border.
- `ui/table.tsx` base `TableRow` hover and selected classes change to the same tokens so plain shadcn tables match.

### 4.6 Skeletons (D10)

`skeleton-tone.ts`: bar tone → `bg-skeleton`, block tone → `bg-skeleton-soft`, frame tone → `border-border` (the dark-only override goes). `ui/skeleton.tsx`'s default `bg-muted/60`-style tone reads `SKELETON_TONE_CLASS`. The sidebar skeleton blobs use `bg-sidebar-hover` (now solid).

### 4.7 The sweep (D7)

The inventory maps every one of 488 usages to a step. The build follows its mapping, with these defaults for the items it flagged (owner can overrule at spec review):

| Flagged item | Default |
|---|---|
| Menu item highlight | `row-hover` (same as list rows) |
| Hover on filled controls (`hover:bg-secondary/80`, `hover:bg-muted/80`) | `hover:bg-border` (one step darker in light, lighter in dark, same direction as borders) |
| Sticky blur headers | `--popover-glass` (glass, D8) |
| Proposal-flow navbar (`bg-foreground/20`, tabs `/40`) | kept as-is in this change, listed as a follow-up for a visual check |
| Public site `secondary` used as a brand accent (22 hits, renders grey today) | left untouched (not a surface); follow-up |
| Selected state | `row-selected` (D9) |
| Scrims, photo overlays, lightbox chrome, hero glass chips (120 + 91 raw white/black) | kept translucent by design |

`--popover-glass` and the dropdown's inline `oklch(from var(--popover) … / 0.8)` are folded into one `--popover-glass` token (the inline relative-colour form goes, research R5).

### 4.8 Guards

- ESLint `theme-tokens/surface-alpha` (new rule in the existing `project/theme-tokens` block): bans `/NN` opacity modifiers on `background|card|muted|secondary|accent|popover|border|foreground|sidebar*` in class strings. Files that keep translucent-by-design classes list them in a `SURFACE_ALPHA_IGNORES` array next to `THEME_TOKEN_IGNORES`, each with a one-line reason comment.
- `scripts/check-theme-contrast.ts` learns to evaluate the ramp: resolve `var()` against the block's settings (with `.dark` inheriting `:root`), evaluate `calc()`/`min()`, and `color-mix(in oklab, A p%, B)`. Existing pairs keep passing; new pairs: foreground on band, muted-foreground on band, foreground on row-hover and row-selected, sidebar-foreground on sidebar and sidebar-accent, sidebar-accent-foreground on sidebar-accent, skeleton on card (≥ 1.3:1), skeleton-soft on card (≥ 1.15:1), border on card (≥ 1.3:1 non-text).

### 4.9 Responsive

- `md` (768) and up: the floating rail and the gutter padding apply. Below `md` the phone layout is unchanged (bottom dock, `px-4` page padding).
- iPad portrait (820): rail collapsed to icons by cookie or expanded; both keep the G gutter.
- Dashboard grid: 12 columns at `lg`, stacked below, gaps G throughout.

### 4.10 Motion and accessibility

No new motion. Row hover keeps its colour transition, which is dropped under reduced motion (already the case). Bands are decoration; focus rings stay `ring-ring`. Contrast is guarded by §4.8.

## 5. Data access

None. This change reads and writes nothing new: no DAL, tRPC, schema, seed or service change.

## 6. Edge cases

- Nested `.dark` scope (customer profile hero): formulas on `.dark` (D11). Verify it renders dark in light mode.
- `.funnel-light` and `.theme-marketing` redefine `--background`, `--card` and others with literals: they keep working because their literal declarations win over the `:root, .dark` formulas on those wrappers. The funnel shares the `:root` block, so it gets the settings but overrides the surfaces; verify one funnel page.
- Rows tinted by `getRowClassName` (status-tinted rows) layer over the band as today; the tint div sits above the band fill.
- Expanded rows do not shift banding: `data-band` counts data rows only.
- Pull-to-refresh spinner and resize handles keep `bg-background` and `bg-border` (solid already).
- Light-mode lightness above 1 clamps to 1 (research R4). `min(1, …)` is kept in the formulas so the intent reads.

## 7. Verification

- `pnpm theme:check` (extended), `pnpm lint` (with the new rule at zero violations), `pnpm tsc`.
- Stop the dev server, `rm -rf .next`, restart before any rendered check.
- Playwright (auth via `/api/dev/playwright-session`, `&role=agent`), both color schemes, at 1440×900, 1024×768, 820×1180 and 390×844:
  - `/dashboard`: gutter measured (rail top and bottom offset = main top and bottom offset = gap between cards = 8px); list rows banded, no nested card borders.
  - `/dashboard/meetings`, `/proposals`, `/customers`, `/projects`: table wrapper `background-color` = `--card`; odd rows = `--band`; frozen column matches its row while scrolled sideways; an expanded row does not shift the bands; header rule present.
  - `/dashboard/analytics`: headline figures, trend and breakdown each a card on the canvas.
  - Sidebar expanded, collapsed and mobile sheet; active item pill + cyan icon; dark rail at card level.
  - Customer profile modal hero (nested `.dark`) in light mode.
  - One popover, dialog, sheet, toast and the Filters glass popover.
  - `/`, one funnel page, one `/proposal-flow` page, one meeting-flow step.
- Owner's hands-on check on the iPad in daylight closes the work.

## 8. Files

Modify:
- `src/app/(frontend)/globals.css` — settings, `:root, .dark` formulas, new tokens, sidebar tokens, `--gutter`, `@theme inline` lines.
- `src/shared/components/ui/sidebar.tsx` — gutter inset and collapsed widths; active icon colour.
- `src/features/agent-dashboard/constants/dashboard-main.ts` — main padding.
- `src/features/agent-dashboard/ui/views/dashboard-view.tsx` — gaps.
- `src/features/agent-dashboard/ui/components/dashboard-module.tsx`, `dashboard-proposal-card.tsx`, `dashboard-meeting-card.tsx`, `dashboard-project-card.tsx` (+ their skeletons and section lists) — rows, bands.
- `src/features/analytics/ui/views/analytics-view.tsx` and report components — card gaps.
- `src/shared/components/records-page-shell.tsx` (only if a gap between cards lives there).
- `src/shared/components/data-table/ui/data-table.tsx`, `data-table-body.tsx`, `constants/cell-border.ts` (delete if unused), `src/shared/components/ui/table.tsx`.
- `src/shared/constants/skeleton-tone.ts`, `src/shared/components/ui/skeleton.tsx`.
- The 206 files in the sweep inventory.
- `eslint.config.js` — `surface-alpha` rule + `SURFACE_ALPHA_IGNORES`.
- `scripts/check-theme-contrast.ts` — evaluate formulas; new pairs.
- `DESIGN.md` — the ramp, the gutter rule, bands, the shadow-above-card rule.
- `docs/plans/2026-09-29-dashboard-theme-follow-ups.md` — delete the stale "six files" line (commit `6065c2ab` shipped them).

Delete: `constants/cell-border.ts` if nothing reads it after the table change.
Create: none in `src/`.

Dirty in the shared tree today (coordinate before editing): `data-table.tsx`, `pwa-install-prompt.tsx`, `ui/drawer.tsx`, `ui/sidebar-mobile-drawer.tsx` (untracked).

## 9. Out of scope and follow-ups

- Proposal-flow navbar translucency: needs a visual check first.
- Public-site `secondary` used as a brand accent (renders grey): pick an accent token.
- Accent and status alpha (`bg-primary/NN` and status tints, 286 usages): a separate sweep with its own tokens.
- Categorical chart palette (already on the Navy Rail follow-ups list).
- Tuning the four settings after the iPad check: values are one-line changes by design.
- Phone dock (Navy Rail Part B) inherits the sidebar tokens; its own spec stays separate.
