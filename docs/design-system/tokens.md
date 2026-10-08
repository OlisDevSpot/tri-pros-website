# Design Tokens

Three-tier CSS custom property architecture. All tokens live in `src/app/(frontend)/globals.css`.

**See also:** [DESIGN.md](./DESIGN.md) · [anti-slop-checklist.md](./anti-slop-checklist.md)

---

## Architecture — Three Tiers

```
Tier 1: Primitive tokens    raw named values, theme-agnostic (brand blue, spacing scale)
Tier 2: Semantic tokens     per-theme remappings of primitives (--background, --accent)
Tier 3: Component tokens    component-specific aliases (--shadow-card, --cred-gap)
```

Components consume **semantic tokens** (Tier 2) via Tailwind utilities (`bg-card`, `text-foreground`) or **component tokens** (Tier 3) via `var(--x)` inline. They never reference a raw hex value directly — that would bypass the theme layer.

---

## App Tokens — The Command Desk (`:root, .funnel-light` / `.dark`)

The app world (dashboard, public site, proposal-flow, intake, auth — everything that reads `:root` and is not wrapped in `.theme-marketing`) is the Navy Rail theme: a navy anchor, one logo-derived action blue, and seven semantic status tones. Every pair below is proven, not asserted: `pnpm theme:check` (`scripts/check-theme-contrast.ts`) parses the `:root` and `.dark` blocks straight out of `globals.css` and fails the build if any text/fill/border pair drops below its required ratio (4.5:1 for text, 3:1 for large fills, borders and rings). Run it instead of trusting a ratio written in this file.

### Tier 1 — Brand Primitives

Theme-agnostic; declared once in `:root, .funnel-light` and reused by both modes via `var()`.

| Token | Value | Role |
|---|---|---|
| `--brand-cyan` | `#03afed` | The raw logo color. Identity only (logo, browser `theme-color`) — never text on light; it fails contrast. |
| `--brand-cyan-bright` | `oklch(0.80 0.12 228)` | The rail's active icon (`--sidebar-active-icon`) and focus ring (`--sidebar-ring`), both modes. |
| `--brand-blue` | `oklch(0.50 0.15 243)` | Light-mode `--primary` — the action fill. |
| `--brand-navy` / `--brand-navy-deep` | `oklch(0.215 0.072 262)` / `oklch(0.13 0.05 262)` | Declared, read by nothing today. |

### The elevation ladder (Tier 1 knobs)

Every app surface colour is one hue at a lightness set by its rung, so the surface tokens below have no fixed value: they are formulas over these knobs. Light values sit in `:root, .funnel-light`, dark values in `.dark`. Retune them with the `elevation-ladder` skill, never by hand-editing a surface token.

| Knob | Light | Dark | Meaning |
|---|---|---|---|
| `--surface-h` | `253` | = light | Hue of every rung |
| `--surface-c` | `0.017` | `0.04` | Chroma of every rung |
| `--canvas-l` | `0.894` | `0.125` | Lightness of rung 0, the page |
| `--step` | `0.024` | `0.047` | Lightness added per rung |
| `--lift` | `0` | `0.034` | Extra lightness on the first step off the page only |
| `--edge` | `0.048` | `0.07` | How far a hairline sits from its surface |
| `--edge-dir` | `-1` | `1` | Edges go darker in light, lighter in dark |
| `--depth` | set by nesting | same | Rung count: `bg-card`/`surface` nested 1–3 deep, `bg-popover`/`surface-overlay` 4, `surface-beneath` −1 |
| `--control-edge` | `4.3` | `2.85` | Edges between a field's fill and its border |
| `--control-border-edge` | `2.2` | `1.2` | Edges between a button's fill and its border |
| `--control-selected-mix` | `14%` | `24%` | Primary mixed into an "on" control |
| `--tab-lift` | `2` | `1.5` | Rungs an active tab climbs above its surface |
| `--overlay-hover-mix` / `--overlay-selected-mix` | `14%` / `20%` | `8%` / `12%` | Primary mixed into hovered / selected rows inside overlays |

`here` below is the lightness of the rung a token is read on: `--canvas-l + --lift + max(--depth, 1) × --step`. Every surface class re-declares the relative tokens, so a `bg-card` inside a `bg-card` gets the next rung's answer. Read on the page itself, they describe a card placed on it (rung 1).

### Tier 2 — Semantic Tokens (shadcn roles)

These are the same names every `bg-card` / `text-muted-foreground` consumer already reads. ✚ marks a role shadcn does not have.

**Surfaces and edges (ladder-derived; same formula in both modes, the knobs differ):**

| Token | Formula | Role |
|---|---|---|
| `--background` | `oklch(--canvas-l …)` | Page canvas, rung 0 |
| `--card` | `oklch(here …)` | The rung it is read on; a nested `bg-card` climbs, `bg-(--card)` paints the current rung |
| `--popover` | `--canvas-l + --lift + 4 × --step` | Menus, selects, popovers: the top rung |
| `--muted` / `--secondary` / `--accent` | one rung above the surface it is read on (on the page: rung 1, the same as `--card`) | Neutral raised fill; `--accent` is no longer a hover colour |
| ✚ `--band` | `here + 0.5 × --step` | Column bodies, table heads, striped rows |
| `--border` | `here + --edge-dir × --edge` | Hairline: dividers, card edges |
| ✚ `--border-strong` / `--axis` | `here + --edge-dir × 2 × --edge` | Dashed empties, emphasized dividers, the chart baseline |
| ✚ `--grid-line` | `here + --edge-dir × 1.5 × --edge` | Chart and calendar grids |
| `--input` | `here + --edge-dir × --control-edge × --edge` | **Field border** (≥1.9 vs its surface) |
| ✚ `--input-background` | `= --card` | Field fill: the rung it sits on, so a field sinks |
| ✚ `--control` | `= --muted` | Outline-button fill, one rung up |
| ✚ `--control-border` | `--muted`'s lightness `+ --edge-dir × --control-border-edge × --edge` | Outline buttons, toggles, segmented and tab tracks, button capsules |
| ✚ `--tab-track` / `--tab-active` | a rung below `here` / `--tab-lift` rungs above it (capped at white) | Segmented and pill-tab track and active item |
| ✚ `--skeleton` / `--skeleton-soft` | `= --border` / `here + --edge-dir × 0.75 × --edge` | Loading placeholders |

**State tokens (mixes over the ladder):**

| Token | Value | Role |
|---|---|---|
| ✚ `--hover` / `--press` | `--foreground` at 6% / 10% over transparent | Hover and press wash on transparent controls (ghost, tabs, menu triggers) |
| ✚ `--control-hover` | `--foreground` 6% into `--control` | Outline-button hover, solid |
| ✚ `--secondary-hover` | `--foreground` 6% into `--secondary` | Secondary-button hover, solid |
| ✚ `--control-selected` | `--primary` at `--control-selected-mix` into `--control` | A control that is on (filters applied, pressed toggle) |
| ✚ `--row-hover` / `--row-selected` | `--primary` 8% / 12% into `--card` (overlays: the `--overlay-*-mix` knobs) | Hovered and selected rows and menu items |
| ✚ `--row-press` | `--foreground` 6% into `--row-hover` | Pressed row |
| ✚ `--primary-hover` / `--destructive-hover` | the fill mixed toward black: 12% (dark `--primary`: 8%) | Filled-button hover, solid |

**Fixed values:**

| Token | Light | Dark | Role |
|---|---|---|---|
| `--foreground` | `oklch(0.235 0.045 258)` | `oklch(0.955 0.008 250)` | Body text |
| `--card-foreground` / `--popover-foreground` / `--secondary-foreground` / `--accent-foreground` | = foreground | = foreground | |
| `--muted-foreground` | `oklch(0.47 0.03 256)` | `oklch(0.77 0.03 252)` | De-emphasized text |
| `--primary` | `oklch(0.50 0.15 243)` (`--brand-blue`) | `oklch(0.76 0.13 230)` | The one action accent — "act here" |
| `--primary-foreground` | `oklch(1 0 0)` (white) | `oklch(0.19 0.045 258)` (navy) | Label on the accent |
| ✚ `--link` | `oklch(0.47 0.14 243)` | `oklch(0.81 0.11 228)` | `--primary` as text |
| `--ring` | `oklch(0.575 0.15 238)` | `oklch(0.78 0.12 228)` | Focus ring |
| ✚ `--indicator` | `oklch(0.60 0.03 255)` | `oklch(0.62 0.04 256)` | Checkbox and radio edges, off switch track (3:1) |
| `--destructive` | `oklch(0.53 0.19 27)` | `oklch(0.53 0.19 27)` | Destructive fill (white label) |
| ✚ `--destructive-text` | `oklch(0.49 0.17 27)` | `oklch(0.83 0.10 25)` | Destructive as text |
| `--success` / `--warning` | = `--status-success-fg` / `--status-pending-fg` | same | Fills, aliasing the status tones below |
| `--sidebar` | `oklch(0.22 0.06 262)` | ladder: `--canvas-l + --lift + 2 × --step` | Rail fill |
| `--sidebar-foreground` | `oklch(0.86 0.02 250)` | `oklch(0.82 0.02 252)` | Rail label |
| ✚ `--sidebar-muted` | `oklch(0.74 0.05 250)` | `oklch(0.68 0.03 252)` | Group labels, icons at rest |
| `--sidebar-accent` | `oklch(0.30 0.065 262)` | ladder: `… + 4.2 × --step` | Active nav pill fill (a lighter navy, not cyan) |
| `--sidebar-accent-foreground` | `oklch(0.97 0.01 250)` | `oklch(0.96 0.01 250)` | Label on the pill |
| ✚ `--sidebar-active-icon` | `--brand-cyan-bright` | same | The active item's icon: the rail's one brand colour |
| ✚ `--sidebar-hover` | `oklch(0.26 0.06 262)` | ladder: `… + 2.6 × --step` | Hover fill, no border or shadow |
| `--sidebar-border` | `oklch(0.27 0.06 262)` | ladder: `… + 3 × --step` | Floating panel edge |
| `--sidebar-ring` | `--brand-cyan-bright` | same | |
| `--popover-glass` | `--popover` 78% into transparent | 62% | Frosted-glass fill |

Each ✚ role is exposed in `@theme inline` as `--color-<name>`, so it is a Tailwind utility: `bg-band`, `bg-hover`, `bg-control`, `border-control-border`, `bg-tab-track`, `bg-row-selected`, `text-link`, `border-border-strong`, `bg-input-background`, `border-indicator`, `text-destructive-text`, `text-sidebar-muted`, `bg-sidebar-hover`.

### Status Tones (Tier 2, new)

Seven semantic tones replace every raw status/stage palette class. Each has `fg` (text), `bg` (pill/badge fill) and `dot` (dots, column markers, borders) in both modes, emitted as `--status-<tone>-<part>` / `--color-status-<tone>-<part>` — a utility reads `text-status-attention-fg bg-status-attention-bg`. The mapping from a pipeline stage's `color` key to its tone lives in `src/shared/constants/status-tones.ts` (`STAGE_COLOR_TONE`, `toneClasses()`); the Stage-Color Rule's meanings are unchanged, except `blue` now renders as the `info` tone's muted steel.

| Tone | Stage-Color meaning | Light `fg` / `bg` / `dot` | Dark `fg` / `bg` / `dot` |
|---|---|---|---|
| `info` | blue — neutral (was a saturated blue; now muted steel) | `oklch(0.44 0.08 252)` / `oklch(0.945 0.02 250)` / `oklch(0.60 0.09 250)` | `oklch(0.84 0.06 245)` / `oklch(0.30 0.045 250)` / `oklch(0.72 0.08 245)` |
| `pending` | yellow — in progress | `oklch(0.46 0.095 72)` / `oklch(0.955 0.05 88)` / `oklch(0.76 0.15 82)` | `oklch(0.87 0.11 88)` / `oklch(0.31 0.05 80)` / `oklch(0.82 0.14 85)` |
| `attention` | orange | `oklch(0.49 0.14 45)` / `oklch(0.95 0.035 55)` / `oklch(0.67 0.17 48)` | `oklch(0.84 0.10 55)` / `oklch(0.31 0.06 45)` / `oklch(0.74 0.15 50)` |
| `action` | purple | `oklch(0.46 0.16 300)` / `oklch(0.95 0.03 300)` / `oklch(0.60 0.18 300)` | `oklch(0.84 0.09 300)` / `oklch(0.31 0.07 300)` / `oklch(0.72 0.15 300)` |
| `success` | green — converted | `oklch(0.45 0.11 152)` / `oklch(0.95 0.04 152)` / `oklch(0.64 0.15 152)` | `oklch(0.84 0.11 155)` / `oklch(0.30 0.06 155)` / `oklch(0.74 0.15 152)` |
| `danger` | red — bad | `oklch(0.49 0.17 27)` / `oklch(0.95 0.025 25)` / `oklch(0.61 0.20 27)` | `oklch(0.83 0.10 25)` / `oklch(0.31 0.08 25)` / `oklch(0.70 0.17 27)` |
| `idle` | slate | `oklch(0.46 0.02 255)` / `oklch(0.94 0.008 255)` / `oklch(0.66 0.02 255)` | `oklch(0.82 0.02 255)` / `oklch(0.30 0.02 258)` / `oklch(0.66 0.02 255)` |

### Series & Chart Tokens (Tier 2, new)

`--series-*` is the ordinal lead-chain ramp (`features/analytics/constants/chart-series.ts`); it runs cyan → navy and is intentional, not a categorical palette. `--chart-1..5` is the categorical set for non-ordinal charts, consumed directly (`bill-colors.ts`) or via `bg-chart-1`…`bg-chart-5`.

| Token | Light | Dark |
|---|---|---|
| `--series-leads` | `oklch(0.59 0.12 228)` | `oklch(0.58 0.10 240)` |
| `--series-booked` | `oklch(0.51 0.14 236)` | `oklch(0.68 0.12 234)` |
| `--series-sits` | `oklch(0.43 0.14 245)` | `oklch(0.79 0.11 228)` |
| `--series-sales` | `oklch(0.30 0.075 258)` | `oklch(0.91 0.05 222)` |
| `--series-neutral-strong` | `oklch(0.40 0.03 256)` | `oklch(0.85 0.02 250)` |
| `--series-neutral-soft` | `oklch(0.66 0.02 255)` | `oklch(0.55 0.03 255)` |
| `--chart-1` (blue) | `oklch(0.52 0.15 243)` | `oklch(0.64 0.15 243)` |
| `--chart-2` (teal) | `oklch(0.58 0.10 190)` | `oklch(0.70 0.10 190)` |
| `--chart-3` (amber) | `oklch(0.70 0.14 72)` | `oklch(0.82 0.14 72)` |
| `--chart-4` (violet) | `oklch(0.55 0.16 300)` | `oklch(0.67 0.16 300)` |
| `--chart-5` (slate) | `oklch(0.55 0.03 255)` | `oklch(0.67 0.03 255)` |

The categorical `--chart-1..5` set is a known open item on the dataviz validator — see the follow-ups doc.

### Identity Tokens (Tier 2, new)

`entities/users/lib/get-user-color.ts` hashes a person to one of eight hues (modulo 8), so the same person keeps the same hue in both modes: `bg`, `fg` and `ring` per hue, `--identity-<1..8>-{bg,fg,ring}`. Hues: 25, 70, 115, 155, 200, 245, 290, 335.

| Part | Light formula | Dark formula |
|---|---|---|
| `bg` | `oklch(0.93 0.045 H)` | `oklch(0.33 0.06 H)` |
| `fg` | `oklch(0.43 0.11 H)` | `oklch(0.88 0.07 H)` |
| `ring` | `oklch(0.66 0.13 H)` | same |

### Elevation (Tier 3)

`--radius` is unchanged at `0.5rem`. The card/dialog shadow ramp is navy-tinted, and the frosted-glass popover shadow is a separate four-layer stack.

| Token | Light | Dark |
|---|---|---|
| `--shadow-2xs` / `--shadow-xs` | `0 1px 2px oklch(0.25 0.05 258 / 0.06)` | `0 1px 2px oklch(0 0 0 / 0.4)` |
| `--shadow-sm` / `--shadow` | `0 1px 2px oklch(0.25 0.05 258 / 0.06), 0 4px 12px -6px oklch(0.25 0.05 258 / 0.12)` | `inset 0 1px 0 oklch(1 0 0 / 0.04), 0 6px 18px -10px oklch(0 0 0 / 0.6)` |
| `--shadow-md` | adds `0 10px 24px -12px oklch(0.25 0.05 258 / 0.16)` | `inset 0 1px 0 oklch(1 0 0 / 0.05), 0 10px 24px -12px oklch(0 0 0 / 0.65)` |
| `--shadow-lg` / `--shadow-xl` / `--shadow-2xl` | `0 16px 36px -14px oklch(0.2 0.06 258 / 0.35), 0 4px 10px -4px oklch(0.2 0.06 258 / 0.15)` | `0 18px 40px -12px oklch(0 0 0 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.06)` |
| `--popover-glass-shadow` (4-layer glass, unrelated to the ramp above) | `inset 0 1px 0 white/0.7, inset 0 0 0 1px oklch(0.25 0.05 258 / 0.08), 0 20px 40px -12px oklch(0.2 0.06 258 / 0.25), 0 6px 16px -8px oklch(0.2 0.06 258 / 0.12)` | `inset 0 1px 0 white/0.09, inset 0 0 0 1px white/0.06, 0 24px 48px -12px black/0.6, 0 8px 24px -8px black/0.4` |

### Type Ramp — the 2px Rule

Every app font size is an even number of pixels, on Tailwind's default steps only — no bespoke `--text-*` step. `text-xs` (12/16px) is the floor. `globals.css` declares no fixed `--text-*` step today (only the fluid `--text-presentation-*` clamps, which are exempt); `theme:check` guards against one being added: it scans `globals.css` for any `--text-*` custom property with a plain px/rem value and fails if its pixel size (at a 16px root) isn't even. For literals in component code, `eslint.config.js`'s `theme-tokens/type-ramp` rule rejects a fixed `text-[Npx]` / `text-[Nrem]` under `src/features/**` and `src/shared/**` — that guard, not `theme:check`, is what keeps the ramp to Tailwind's steps day to day.

---

## Tier 1 Primitives Not Yet Emitted as CSS Variables (marketing)

The token tables below list exactly what is currently emitted in `globals.css` `.theme-marketing` block. However, some design primitives from [DESIGN.md](./DESIGN.md) and the spec are not yet emitted as explicit CSS variables; instead, they are consumed via Tailwind defaults and next/font:

- **`--radius-pill: 999px`** — Spec-defined radius for pill shapes. Currently consumed via Tailwind's `rounded-full` utility, not emitted as a `.theme-marketing` variable.
- **Spacing scale** (`--space-4`, `--space-8`, etc.) — The base spacing system. Currently consumed via Tailwind's default spacing utilities, not emitted as `.theme-marketing` variables.
- **Font families** — Syne (used as `font-sans` in Tailwind) and Nunito (body default) are wired in `src/app/(frontend)/layout.tsx` via `next/font`, not emitted as `.theme-marketing` CSS variables.

Emitting these primitives as explicit CSS variables and converting the entire marketing palette to OKLCH (matching the rest of `globals.css`) is a deferred follow-up (spec §13). Until that conversion happens, components should consume these via Tailwind utilities and font configuration rather than CSS vars.

---

## Tier 2: Semantic Tokens — `.theme-marketing` Block

The marketing theme is applied by adding the `.theme-marketing` class to a wrapper element. It remaps the shadcn semantic variables to the warm-concrete palette and brand blue.

### Shadcn Semantic Remaps

| Token | Value | Meaning |
|---|---|---|
| `--background` | `#faf7f1` | Warm off-white — the page/section background |
| `--foreground` | `#2a2520` | Warm ink — primary text color |
| `--card` | `#f4efe6` | Panel — card background (lighter than sand) |
| `--card-foreground` | `#2a2520` | Same warm ink on cards |
| `--popover` | `#f4efe6` | Same as card |
| `--popover-foreground` | `#2a2520` | Same warm ink |
| `--primary` | `#03afed` | Brand blue — the only accent color |
| `--primary-foreground` | `#ffffff` | White text on brand blue buttons/fills |
| `--secondary` | `#efe7d7` | Raised — slightly elevated surface (between sand and panel) |
| `--secondary-foreground` | `#2a2520` | Warm ink on raised surfaces |
| `--muted` | `#efe7d7` | Same as raised (muted surface) |
| `--muted-foreground` | `#8a7c6a` | Warm muted — de-emphasized text |
| `--accent` | `#03afed` | Brand blue (same as `--primary`) |
| `--accent-foreground` | `#ffffff` | White on accent fills |
| `--border` | `#ddd4c4` | Hairline — card edges on the sand background |
| `--input` | `#c6bba9` | Field edge, about 1.8:1 on the page and 1.65:1 on a panel |
| `--indicator` | `#928674` | Checkbox and radio edge, 3:1 on the panel |
| `--input-background` | `transparent` | Marketing fields keep a transparent fill |
| `--control` / `--control-border` | `transparent` / = `--border` | Outline buttons stay literal outlines over photos and panels |
| `--ring` | `#03afed` | Focus ring — brand blue |
| `--radius` | `0.375rem` | 6px — the panel radius (NOT uniform 8px) |

### New System Tokens (Tier 3)

These tokens do not exist in the base shadcn system. They are consumed via `var(--x)` inline styles or CSS class rules in components.

| Token | Value | Meaning |
|---|---|---|
| `--accent-ink` | `#0784b3` | Darkened brand blue for small text on light backgrounds (WCAG AA) |
| `--body-text` | `#5f574b` | Warm body copy — for paragraph text inside cards |
| `--cred-ink` | `#4a443c` | Credential strip text — slightly lighter than ink, slightly heavier than body |
| `--cred-gap` | `24px` | Fixed gap between credential strip items (never stretch to full width) |
| `--radius-chip` | `3px` | Chip / diamond / tag radius (not the panel radius) |
| `--shadow-card` | `0 20px 40px -28px oklch(0 0 0 / 0.16), 0 10px 24px -18px rgb(3 175 237 / 0.08)` | Card drop: a black layer plus a faint brand-blue layer |
| `--ease-brand` | `cubic-bezier(0.32, 0.72, 0, 1)` | The single approved easing curve |
| `--dur-fast` | `0.18s` | Micro-interaction duration |
| `--dur-base` | `0.4s` | Standard transition duration |
| `--dur-draw` | `1.4s` | Decor draw-in animation duration |
| `--decor-stroke` | `#03afed` | Decor arc stroke color (brand blue) |
| `--decor-gradient-alpha` | `0.34` | Opacity at the origin of the decor radial atmosphere |

---

## Dark Mode Stub — `.theme-marketing.theme-dark`

Dark mode is opt-in only via `.theme-marketing.theme-dark`. It must NOT auto-activate from the app-wide `html.dark` ancestor — the marketing theme is a light showcase by default.

Full dark hardening is a deferred phase (spec §12). The current stub covers background/surface/text/border flips:

| Token | Dark Value | Notes |
|---|---|---|
| `--background` | `#14110e` | Near-black warm |
| `--foreground` | `#ece6d8` | Warm off-white |
| `--card` | `#1c1813` | Dark warm panel |
| `--card-foreground` | `#ece6d8` | |
| `--popover` | `#1c1813` | |
| `--popover-foreground` | `#ece6d8` | |
| `--secondary` | `#221d17` | |
| `--muted` | `#221d17` | |
| `--muted-foreground` | `#9a9082` | |
| `--border` | `#2c2620` | |
| `--input` | `#2c2620` | |
| `--accent-ink` | `#5cc6f2` | Lightened blue for dark backgrounds (WCAG AA) |
| `--body-text` | `#c4bbac` | Warm body on dark |
| `--cred-ink` | `#d8cfbf` | Credential text on dark |

---

## Theme Application Mechanism

```tsx
// Correct — wrap a marketing section
<section className="theme-marketing">
  {/* All children inherit warm-concrete tokens */}
</section>

// Correct — opt into dark explicitly
<section className="theme-marketing theme-dark">
  ...
</section>

// Wrong — do not apply theme-marketing to html or body
// Wrong — do not rely on html.dark to activate dark marketing styles
```

The `.theme-marketing` class overrides the shadcn semantic variables for its subtree. Existing shadcn components (`<Card>`, `<Button>`, etc.) automatically pick up the warm palette because they already consume `bg-card`, `text-foreground`, `bg-primary`, etc.

---

## How Components Consume Tokens

### Tailwind semantic utilities (preferred)

Use standard Tailwind utilities for the shadcn semantic layer — these work because `@theme inline` maps them to the CSS vars:

```tsx
<div className="bg-card text-foreground border border-border rounded-[--radius]">
  <p className="text-muted-foreground">...</p>
  <button className="bg-primary text-primary-foreground">...</button>
</div>
```

### `var(--x)` inline for new tokens

The new system tokens (`--accent-ink`, `--body-text`, `--cred-ink`, `--cred-gap`, `--shadow-card`, `--decor-stroke`, `--decor-gradient-alpha`) are not yet wired into `@theme inline`. Consume them via `var()`:

```tsx
// Body copy inside a marketing card
<p style={{ color: 'var(--body-text)' }}>...</p>

// Credential strip
<div style={{ gap: 'var(--cred-gap)', color: 'var(--cred-ink)' }}>...</div>

// Card shadow
<div style={{ boxShadow: 'var(--shadow-card)' }}>...</div>

// Decor stroke — passed as a prop or used in SVG
<circle stroke="var(--decor-stroke)" />
```

Alternatively, you can reference them in Tailwind arbitrary-value syntax where CSS vars are supported:
```tsx
<div className="shadow-[var(--shadow-card)]">
```

---

## Open: OKLCH Conversion

The `.theme-marketing` tokens currently use hex values (`#03afed`, `#faf7f1`, etc.). The rest of `globals.css` uses OKLCH throughout. Converting the marketing palette to OKLCH is a deferred follow-up (spec §13) — it does not affect rendering, only consistency with the existing convention.

Until that conversion happens, do not mix OKLCH computed values with the hex tokens in the same expression.
