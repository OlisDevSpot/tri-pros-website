---
name: Tri Pros Remodeling
description: A two-world design system — an operational "Command Desk" for the CRM and "Blueprint Authority" for marketing & funnels.
colors:
  # The Command Desk (app / dashboard) — oklch is the normative source. Light
  # values; dark-mode pairs are in the Colors section below and globals.css.
  harbor-blue: "oklch(0.50 0.15 243)"
  app-background: "oklch(0.965 0.009 246)"
  app-foreground: "oklch(0.235 0.045 258)"
  app-card: "oklch(1 0 0)"
  app-secondary: "oklch(0.955 0.008 250)"
  app-muted-foreground: "oklch(0.47 0.03 256)"
  app-border: "oklch(0.905 0.012 252)"
  app-input: "oklch(1 0 0)"
  destructive: "oklch(0.53 0.19 27)"
  success: "oklch(0.45 0.11 152)"
  warning: "oklch(0.46 0.095 72)"
  # Blueprint Authority (marketing / funnels) — hex is the normative source
  blueprint-blue: "#03afed"
  blueprint-ink: "#0784b3"
  warm-concrete-bg: "#faf7f1"
  warm-ink: "#2a2520"
  warm-panel: "#f4efe6"
  warm-raised: "#efe7d7"
  warm-muted-fg: "#8a7c6a"
  warm-body-text: "#5f574b"
  warm-hairline: "#ddd4c4"
typography:
  display:
    fontFamily: "Syne, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Syne, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.15
  title:
    fontFamily: "Syne, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  serif-accent:
    fontFamily: "Playfair Display, Georgia, serif"
    fontWeight: 500
    lineHeight: 1.1
  eyebrow:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    letterSpacing: "0.2em"
rounded:
  chip: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  base: "4px"
  block-gap: "24px"
  block-pad: "36px"
components:
  button-primary:
    backgroundColor: "{colors.harbor-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.app-secondary}"
    textColor: "{colors.app-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  card:
    backgroundColor: "{colors.app-card}"
    textColor: "{colors.app-foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.app-input}"
    textColor: "{colors.app-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  button-blueprint-cta:
    backgroundColor: "{colors.blueprint-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "16px 24px"
---

# Design System: Tri Pros Remodeling

This file lists the tokens. For which one to use, with do/don't examples and a pre-commit self-check, read [`docs/design-system/theme-conventions.md`](docs/design-system/theme-conventions.md).

## Overview

**Creative North Star: two worlds — "The Command Desk" and "Blueprint Authority"**

Tri Pros runs one brand across two jobs, so it runs two documented visual worlds
that share a bloodline (blue accent, real depth, no slop) but never blur into a
single averaged look. **The Command Desk** is the internal CRM — a premium,
cinematic operating cockpit where a lean sales team moves leads from call to
signed contract. It is calm, dense-where-it-counts, and quietly luxurious:
near-white neutrals, a navy rail, a single **Harbor Blue** accent reserved for
action, and a signature frosted-glass surface for floating UI. **Blueprint
Authority** is the marketing and funnel world — warm poured-concrete neutrals, a
bright **Blueprint Blue** drafting-line accent, and drafting-paper textures that
say "licensed, engineered, built to last" before a word is read.

The shared personality is **premium and cinematic**: luxury restraint over
decoration, big honest imagery over clip-art, editorial spacing over cramped
density. Depth is earned, never sprayed on. Where the two worlds differ is
temperature and texture — the Command Desk is cool paper and glass; Blueprint
Authority is warm concrete and blueprint grid — and that difference is
intentional, not drift. Components in both worlds feel **tactile and
engineered**: crisp edges, layered brand-tinted shadows, surfaces that respond to
touch rather than sitting inert.

The confirmed anti-reference is **"slop"** — the generic AI-SaaS look this
codebase was explicitly built against (see the in-repo anti-slop design spec):
8px-radius-on-everything, gradient text, glowing neon accents on dark, evenly-gray
palettes, and the cheap-contractor-flyer aesthetic that Tri Pros' whole
positioning rejects. Trust is the product; the design must read as substantial,
not flashy.

**Key Characteristics:**
- Two worlds, one bloodline: cool glass (app) vs. warm concrete (marketing), never averaged.
- One accent per world, used sparingly, always meaning "act here" or "this is ours."
- Real, layered, brand-tinted depth — frosted glass in the app, blueprint-blue-lifted shadows in marketing.
- Editorial restraint: generous space, big imagery, a disciplined type scale.
- Engineered texture: blueprint grids and drafting-paper motifs earn their place in the marketing world only.

## Colors

Two role-complete palettes. The app world is built on cool near-white neutrals in
OKLCH; the marketing world is built on warm concrete neutrals in hex. Each has
exactly one accent, and its rarity is the point.

### Primary
- **Harbor Blue** (light `oklch(0.50 0.15 243)` / dark `oklch(0.76 0.13 230)`): the
  app world's single accent. It does one job — "act here": primary buttons, active
  nav, focus rings, selected states, links on hover. In light mode it is a deep
  logo-derived blue carrying a white label; in dark mode it brightens to a
  logo-cyan and its label flips to navy (`--primary-foreground`), because a white
  label on that bright a fill would fail contrast.
- **Blueprint Blue** (`#03afed`): the marketing world's single accent — the drafting
  line on warm concrete. CTAs, eyebrows, decor strokes, the blueprint grid, credential
  emphasis. **Blueprint Ink** (`#0784b3`) is the same hue value-darkened for small
  text and hairlines where the bright blue would fail contrast on light.

### Neutral — The Command Desk (app)
- **The elevation ladder** (`globals.css`, knobs in `:root, .funnel-light` and `.dark`):
  every app surface is one hue (`--surface-h`/`--surface-c`) at a lightness set by its
  rung. The canvas (`--background`, rung 0) is the darkest; each surface stacked over
  another sits one `--step` lighter, in both schemes. Dark mode widens only the first
  step (`--lift`): near black an equal step reads weaker than the ones above it. A nested `bg-card` climbs a rung
  by itself (it counts the surfaces it sits in, up to three); `bg-(--card)` paints the
  current rung without climbing; `bg-muted` is always one rung above wherever it is read.
  Menus, selects and popovers (`bg-popover`, `surface-overlay`) sit on the top rung; a
  dialog is a portaled `bg-card`, so it starts at rung 1 and its contents climb from
  there. The public footer (`surface-beneath`) sits one rung below the page. Retune it with
  the `elevation-ladder` skill; `pnpm theme:check` guards every pair on every rung.
- **Slate Ink** (`oklch(0.235 0.045 258)`): primary text; a soft blue-slate, never
  pure black.
- **Bands** (`--band`): striped rows, skeleton rows and an opened row's panel — half a
  step above their surface. A table head paints its surface (`bg-(--card)`), not a band.
  Hovered and selected rows mix primary into the surface
  (`--row-hover`, `--row-selected`); selected always sits further from it than hover.
- **Quiet Steel** (`oklch(0.47 0.03 256)`): muted-foreground for secondary text
  and captions.
- **Hairline** (`--border`, one `--edge` off its surface: darker in light, lighter in
  dark): borders and dividers. **Border Strong** (`--border-strong`, two edges off) is
  the emphasized variant, for dashed empty states and
  dividers that need to read as more than a hairline. Chart and calendar grids use
  **Grid Line** (`--grid-line`, one and a half edges off) and the axis baseline uses
  **Axis** (`--axis`, = Border Strong). Dark edges sit further out than light ones.
- **Field Edge** (`--input`): `--control-edge` edges (4.3 light, 2.85 dark; about 2:1)
  off the field's own fill. A field is filled with the surface it sits on, so its edge
  alone marks it. A hovered field firms it to **Field Edge Hover** (`--input-hover`,
  `--input-hover-edge` more edges: 1.2 light, 0.6 dark), about 2.3–2.8:1, never the
  indicator's 3:1, which boxes a whole field in.
- **Control Border** (`--control-border`: outline buttons and toggles, segmented and tab
  tracks, button capsules): `--control-border-edge` edges (2.2 light, 1.2 dark) off the
  rung above, about 1.3–1.45:1 against a button's fill. Softer than a field's, because a
  control's lighter fill and `shadow-xs` already lift it; at 2:1 a toolbar reads as a row
  of boxes.
  **Indicator** (`--indicator`, 3:1 against the card) edges checkboxes and radios and
  fills the off switch track.
- **Navy Rail** (`oklch(0.215 0.072 262)` light / `oklch(0.13 0.05 262)` dark): the
  sidebar fill — see Sidebar, below.

### Neutral — Blueprint Authority (marketing)
- **Warm Concrete** (`#faf7f1` page, `#f4efe6` panel, `#efe7d7` raised): the poured-
  concrete-and-paper base the whole marketing world stands on. Panels sit a touch
  deeper than the page — the "loved callout tone."
- **Warm Ink** (`#2a2520`): headline text; a warm near-black.
- **Concrete Body** (`#5f574b`) / **Warm Muted** (`#8a7c6a`): body copy and muted
  microcopy.
- **Concrete Hairline** (`#ddd4c4`): borders. **Concrete Field Edge** (`#c6bba9`,
  about 1.8:1 on the page) edges inputs, selects and textareas; checkboxes and radios
  take `#928674` (3:1 on a panel). A hovered field edge sits halfway between the two.
- **Marketing-only tokens** (`.theme-marketing`; read with `var()` or `-(--x)`, e.g.
  `text-(--accent-ink)`, `shadow-(--shadow-card)`, since none is in `@theme`):

| Token | Value | Role |
|---|---|---|
| `--accent-ink` | `#0784b3` (`#5cc6f2` in `.theme-dark`) | Blueprint Ink: brand blue for small text and hairlines on light |
| `--body-text` | `#5f574b` (`#c4bbac`) | Body copy inside a panel |
| `--cred-ink` | `#4a443c` (`#d8cfbf`) | Credential strip text |
| `--cred-gap` | `24px` | Gap between credential items; never stretched to full width |
| `--radius-chip` | `3px` | Chips, diamonds, tags |
| `--shadow-card` | see Shadow Vocabulary | Resting card lift |
| `--ease-brand` | `cubic-bezier(0.32, 0.72, 0, 1)` | The one easing curve |
| `--dur-fast` / `--dur-base` / `--dur-draw` | `0.18s` / `0.4s` / `1.4s` | Micro-interaction, transition, decor draw-in |
| `--decor-stroke` | `#03afed` | `<Decor>` arc stroke |
| `--decor-gradient-alpha` | `0.34` | Opacity at the decor atmosphere's origin |

### Over Media
A photo, video or map looks the same in both schemes and on every rung, so these two
tokens never change with light/dark, the ladder or the marketing theme.
- **On Media** (`--on-media`, `oklch(0.98 0 0)`; `--on-media-muted` is it at 80%):
  text and icons over a photo. `text-on-media`, `text-on-media-muted`.
- **Scrim** (`--scrim`, navy-black `oklch(0.15 0.02 258)`): the veil behind that ink,
  always used with an alpha — `bg-scrim/60`, `from-scrim/30 to-scrim/90`.
- **Rule:** never raw `white`/`black` utilities over a photo. Assume the photo is white
  where the ink sits: body ink needs a veil of at least 60%, muted ink 70%, icons,
  large text and control glyphs 50%. A gradient veil meets the floor under the text,
  not at its faint end. `backdrop-blur` adds nothing to contrast. `theme:check` holds
  these floors.
- Marketing's light hero plate (`--hero-scrim`, dark ink on a warm veil) is the other
  way round and keeps its own token.

### Status
- **Destructive** (`oklch(0.53 0.19 27)`), **Success** (`oklch(0.45 0.11 152)`),
  **Warning** (`oklch(0.46 0.095 72)`): functional shadcn fills. Destructive's
  `-foreground` label is white in both modes; Success and Warning flip their
  `-foreground` label from white in light to navy in dark, matching Primary. For
  pipeline and entity UI, use the seven Stage-Color tones below instead — they
  carry the meaning.

### Named Rules
**The One Voice Rule.** Each world has exactly one accent (Harbor Blue in the app,
Blueprint Blue in marketing). It lands on ≤10% of any screen. Its scarcity is what
makes it read as "act here." Never introduce a second decorative accent hue.

**The Stage-Color Rule.** In pipeline and entity UI, status color is semantic and
fixed, never restyled for taste. Seven tones carry the meaning — `info`, `pending`,
`attention`, `action`, `success`, `danger`, `idle` — each with a `fg` (text), `bg`
(fill) and `dot` (marker) value in both light and dark. They live in
`src/shared/constants/status-tones.ts`: pipeline stage objects keep their
`color: '<key>'` field, and `STAGE_COLOR_TONE` in that module maps each key to its
tone. The rule's original meanings still hold — red = bad (`danger`),
yellow = in-progress (`pending`), green = converted (`success`),
purple = action (`action`) — except the **blue** stage, which now renders as a
muted steel (`info`) instead of a saturated blue, so it stops competing with
Harbor Blue.

The tones are `--status-<tone>-{fg,bg,dot}` (utilities `text-status-<tone>-fg`,
`bg-status-<tone>-bg`, …). A tile filled with `attention`, `success` or `danger` hovers
`--status-<tone>-hover`, a solid step off its fill.

| Tone | Light `fg` / `bg` / `dot` | Dark `fg` / `bg` / `dot` |
|---|---|---|
| `info` | `oklch(0.44 0.08 252)` / `oklch(0.945 0.02 250)` / `oklch(0.6 0.09 250)` | `oklch(0.84 0.06 245)` / `oklch(0.3 0.045 250)` / `oklch(0.72 0.08 245)` |
| `pending` | `oklch(0.46 0.095 72)` / `oklch(0.955 0.05 88)` / `oklch(0.76 0.15 82)` | `oklch(0.87 0.11 88)` / `oklch(0.31 0.05 80)` / `oklch(0.82 0.14 85)` |
| `attention` | `oklch(0.49 0.14 45)` / `oklch(0.95 0.035 55)` / `oklch(0.67 0.17 48)` | `oklch(0.84 0.1 55)` / `oklch(0.31 0.06 45)` / `oklch(0.74 0.15 50)` |
| `action` | `oklch(0.46 0.16 300)` / `oklch(0.95 0.03 300)` / `oklch(0.6 0.18 300)` | `oklch(0.84 0.09 300)` / `oklch(0.31 0.07 300)` / `oklch(0.72 0.15 300)` |
| `success` | `oklch(0.45 0.11 152)` / `oklch(0.95 0.04 152)` / `oklch(0.64 0.15 152)` | `oklch(0.84 0.11 155)` / `oklch(0.3 0.06 155)` / `oklch(0.74 0.15 152)` |
| `danger` | `oklch(0.49 0.17 27)` / `oklch(0.95 0.025 25)` / `oklch(0.61 0.2 27)` | `oklch(0.83 0.1 25)` / `oklch(0.31 0.08 25)` / `oklch(0.7 0.17 27)` |
| `idle` | `oklch(0.46 0.02 255)` / `oklch(0.94 0.008 255)` / `oklch(0.66 0.02 255)` | `oklch(0.82 0.02 255)` / `oklch(0.3 0.02 258)` / `oklch(0.66 0.02 255)` |

### Charts
- **Series** (`--series-*`): the ordinal lead-chain ramp
  (`features/analytics/constants/chart-series.ts`), cyan → navy on purpose, not a
  categorical palette. Read as `var(--series-leads)` or `bg-(--series-leads)`.
- **Chart** (`--chart-1..5`, `bg-chart-1`…): the categorical set for non-ordinal charts
  (the ROI calculator's `bill-colors.ts`). Still an open item on the dataviz validator;
  see `docs/plans/2026-09-29-dashboard-theme-follow-ups.md`.

| Token | Light | Dark |
|---|---|---|
| `--series-leads` | `oklch(0.59 0.12 228)` | `oklch(0.58 0.1 240)` |
| `--series-booked` | `oklch(0.51 0.14 236)` | `oklch(0.68 0.12 234)` |
| `--series-sits` | `oklch(0.43 0.14 245)` | `oklch(0.79 0.11 228)` |
| `--series-sales` | `oklch(0.3 0.075 258)` | `oklch(0.91 0.05 222)` |
| `--series-neutral-strong` | `oklch(0.4 0.03 256)` | `oklch(0.85 0.02 250)` |
| `--series-neutral-soft` | `oklch(0.66 0.02 255)` | `oklch(0.55 0.03 255)` |
| `--chart-1` (blue) | `oklch(0.52 0.15 243)` | `oklch(0.64 0.15 243)` |
| `--chart-2` (teal) | `oklch(0.58 0.1 190)` | `oklch(0.7 0.1 190)` |
| `--chart-3` (amber) | `oklch(0.7 0.14 72)` | `oklch(0.82 0.14 72)` |
| `--chart-4` (violet) | `oklch(0.55 0.16 300)` | `oklch(0.67 0.16 300)` |
| `--chart-5` (slate) | `oklch(0.55 0.03 255)` | `oklch(0.67 0.03 255)` |

### Identity
`shared/entities/users/lib/get-user-color.ts` hashes a person to one of eight hues, so
the same person keeps the same hue in both schemes: `--identity-<1..8>-{bg,fg,ring}`
(`bg-identity-1-bg`, …). Hues 25, 70, 115, 155, 200, 245, 290, 335.

| Part | Light | Dark |
|---|---|---|
| `bg` | `oklch(0.93 0.045 H)` | `oklch(0.33 0.06 H)` |
| `fg` | `oklch(0.43 0.11 H)` | `oklch(0.88 0.07 H)` |
| `ring` | `oklch(0.66 0.13 H)` | same |

**The Warm-Cool Border Rule.** Never paste an app-world cool neutral into a
marketing surface or vice versa. Warm concrete belongs to Blueprint Authority; cool
paper and glass belong to the Command Desk. Mixing them is the tell of a drifted
screen.

## Typography

**Display / Headline Font:** Syne (with system-ui, sans-serif) — powers `--font-sans`
and every `h1`–`h6`.
**Body Font:** Nunito (with system-ui, sans-serif) — the document default, applied
on `body`.
**Serif Accent:** Playfair Display (with Georgia, serif) — `--font-serif`, reserved
for cinematic/editorial moments.
**Mono:** Space Mono (with ui-monospace) — `--font-mono`. Not for eyebrows: eyebrows
are Nunito 700 (`BlockEyebrow`).
**Script:** Dancing Script — `--font-script`, a rare signature flourish only.

**Character:** Syne is a geometric, slightly architectural sans — confident and a
little engineered, which is exactly the brand. Pairing it with Nunito's rounded
warmth keeps long body copy friendly and legible for a homeowner audience, while
Syne carries the authority in headings. Playfair supplies the occasional cinematic
serif accent.

### Hierarchy
- **Display** (Syne 500, `clamp(2.25rem, 5vw, 3.75rem)` — the `h1` `text-4xl → 6xl`
  ramp, `line-height` ~1.05, `-0.01em`): hero and page titles.
- **Headline** (Syne 500, `1.75rem`, `line-height` 1.15): the `h2` — section titles.
- **Title** (Syne 600, `~1.125rem`): card titles, list headers, sub-sections.
- **Body** (Nunito 400, `1rem`, `line-height` 1.6): all reading copy. Cap prose at
  the marketing `--measure-prose` of **60ch**.
- **Eyebrow / Label** (Nunito 700, `--fs-eyebrow`, `--tracking-eyebrow`, uppercase; `BlockEyebrow`):
  kickers, credential labels, the funnel `--fs-eyebrow` voice.

### Named Rules
**The Syne-Heads / Nunito-Reads Rule.** Headings are Syne; running text is Nunito.
Do not set long body passages in Syne (it tires the eye) and do not set headings in
Nunito (it drops the architectural authority). Playfair and Dancing Script are
accents, never a paragraph face.

**The Eyebrow-Only Uppercase Rule.** All-caps + wide tracking is reserved for short
eyebrows and labels (`BlockEyebrow`). Never uppercase a sentence of body copy.

**The 2px Rule (app).** Every dashboard font size is an even number of pixels,
almost always a multiple of 4 — Tailwind's default steps (and their bundled
line-heights) are the ramp, and nothing else — `text-xs` 12px is the floor, up
through `text-3xl` 30px and the `text-4xl`+ steps (36/48/60/72/96/128px). No
bespoke `--text-*` step is added for the app world: `eslint.config.js`'s
`theme-tokens/type-ramp` guard rejects any fixed `text-[Npx]` / `text-[Nrem]`
literal under `src/features/**` and `src/shared/**`, and `pnpm theme:check`
rejects any new fixed `--text-*` step in `globals.css` whose pixel size isn't
even. (The fluid `--text-presentation-*` clamps used by the meeting-flow
presentation are exempt from both guards — the follow-ups doc has the reason.)

## Layout

The app world uses a shadcn app-shell: a full-height collapsible sidebar
(`data-slot=sidebar-*`) plus a content column, with PWA safe-area insets baked into
header/footer padding. Content sits inside a `.container` (`max-w-7xl`, responsive
`px-4 / sm:px-6 / lg:px-8`). Density is comfortable, not cramped — tables and boards
breathe.

The marketing world is built from the **`<Block>` compound system**: a vertical
rhythm driven by tokens — `--block-gap` (1.5rem between content children),
`--block-pad` (1.25rem mobile → 2.25rem ≥640), and a media column with
`--block-media-min-h` of 22rem. The funnel type scale is tokenized separately
(`--fs-headline`, `--fs-body`, `--fs-display`, `--fs-eyebrow`) so blocks stay in
proportion across breakpoints.

Spacing everywhere derives from a **4px base** (`--spacing: 0.25rem`). The single
breakpoint that matters most is **640px** (`sm`), where marketing padding and the
headline scale step up.

### Named Rules
**The 60ch Measure Rule.** Reading copy never exceeds `--measure-prose` (60ch). Wide
homeowner-facing paragraphs get a max-width, not the full column.

## Elevation & Depth

This is a **layered, brand-tinted** depth system — never flat, never generic gray.
Both worlds tint their shadows toward blue so elevation reads as "ours."

- **The Command Desk** carries a signature **frosted-glass** surface for popovers and
  floating UI: a semi-transparent fill (`--popover-glass`, ~78% alpha in light, ~62%
  in dark) over a `backdrop-filter` blur, finished with a four-layer shadow — an inset
  top-edge sheen (the lit glass rim), a 1px hairline, a close proximity drop, and a
  far elevation drop (`--popover-glass-shadow`). This is the most recognizable detail
  in the app; treat it as a brand asset, not a default.
- **The Command Desk's card/dialog shadow ramp** (`--shadow-xs` … `--shadow-2xl`) is
  navy-tinted, not flat gray. In light mode every step is a soft
  `oklch(0.25 0.05 258 / …)` drop that widens and deepens through the ramp; in dark
  mode the two lowest steps (`--shadow-2xs`, `--shadow-xs`) stay a flat
  `oklch(0 0 0 / 0.4)` drop with no highlight, and from `--shadow-sm` up an inset
  top highlight (`inset 0 1px 0 white / 0.04–0.06`) joins a drop that grows to
  `oklch(0 0 0 / 0.6–0.7)` — dark surfaces need a lit top edge to read as raised
  rather than sunken. `--radius` stays `0.5rem`.
- **Blueprint Authority** uses a warm elevation ramp where every shadow pairs a black
  drop for honest depth with a faint **Blueprint-Blue** accent layer underneath
  (`--shadow-card` … `--shadow-xl`), so panels lift with a subtle blue cast rather
  than muddy gray.

### Shadow Vocabulary (marketing)
- **Card lift** (`--shadow-card`: `0 20px 40px -28px oklch(0 0 0 / 0.16), 0 10px 24px -18px rgb(3 175 237 / 0.08)`): default resting card.
- **Hero frame** (`--shadow-hero`): the light hero plate over a photo (paired with the radial `--hero-scrim`, not backdrop-blur).
- **CTA ring** (`--cta-ring`: `0 0 0 1px rgb(3 175 237 / 0.3), 0 10px 24px -12px rgb(0 0 0 / 0.45)`): a faint brand hairline over a neutral drop — deliberately **not** a glow halo.

### Named Rules
**The Tinted-Depth Rule.** Shadows always carry a trace of the world's blue. A pure
neutral-gray drop shadow is a slop tell — replace it with the tokenized ramp.

**The No-Glow Rule.** Rings and CTA outlines are hairlines for edge definition, never
neon glow halos. `--cta-ring` and `focus-visible` use crisp 1–3px definition, not
blur-bloom.

**The Scrim-Not-Blur Rule.** Hero legibility over photography comes from the radial
`--hero-scrim` gradient, not `backdrop-filter` — animated/transformed layers sever
backdrop-filter from siblings and the blur collapses. Use the scrim.

## Shapes

Corners are **modest and engineered**, never the slop 8px-on-everything. The app
world runs a `--radius` of `0.5rem` with a computed scale — `sm` 4px, `md` 6px, `lg`
8px, `xl` 12px. The marketing world tightens to `--radius: 0.375rem` (6px) precisely
to avoid the over-rounded look, and uses a **3px chip** radius (`--radius-chip`) for
credential pills. Pills and progress bars use full `999px` rounding where a
capsule is intentional (eyebrows, scarcity pills, meters).

Borders are hairlines (1px, world-appropriate neutral). Textures are geometric and
technical: the **blueprint grid** (in `funnel-engine.tsx` — a fine 32px minor grid + a
heavier 160px major line in Blueprint Blue at ~5% opacity) appears behind funnel
question steps only, and the "coming soon" state renders a full drafting-paper
construction scene from pure CSS.

### Named Rules
**The 6px-Not-8px Rule.** Marketing surfaces round to 6px, chips to 3px. Reserve 8px+
for the app world. Rounding everything to a soft 8px is the exact look this system
rejects.

## Components

Components feel **tactile and engineered**: solid fills, crisp edges, honest
responsive depth.

### Buttons
- **Shape:** `rounded-md` (6px). Sizes run `sm` (h-8) → `default` (h-9) → `lg` (h-10)
  → `xl` (h-12) → `xll` (h-14), padding scaling with height.
- **Hover states are solid or a neutral wash, never a see-through fill and never a
  dimmed label.** Tokens: `--hover` (6% foreground wash, for transparent controls),
  `--press` (10%), `--primary-hover` / `--destructive-hover` (the fill mixed toward
  black: 12% light, 8% for the pale dark-mode blue), `--secondary-hover`.
  `pnpm theme:check` holds each one's contrast on every rung in both schemes.
- **Primary / default:** `bg-primary` (Harbor Blue) + `text-primary-foreground`
  (white in light, navy in dark) + `shadow-xs`; hover `bg-primary-hover`.
- **CTA (`cta`):** flat `bg-primary` with the same solid `bg-primary-hover`. The
  deepened gradient (`--cta-from` → `--cta-to`, `--cta-ring`) belongs to the funnels'
  `FunnelCta` only. Never a glow.
- **Secondary:** `bg-secondary`, one rung above whatever holds it, + dark text;
  hover `bg-secondary-hover`. A button sitting on a card or a dialog is
  `secondary` so it climbs the ladder with them (the Google sign-in button).
- **Outline:** filled `bg-control` (one rung above whatever holds it) with a
  `border-control-border` edge taken off that fill, so it stands on the surface; hover
  `bg-control-hover`, a solid step off the fill. The marketing scopes
  set `--control: transparent`, and the public hero and navbar pass `bg-transparent`,
  so outlines over photos stay see-through.
- **Which variant in a toolbar:** a standalone action is `outline`; the items inside a
  grouped capsule are `ghost`, and the capsule (`bg-card border-control-border`) is the raised
  control; a filled neutral action in a card or dialog is `secondary`; the one main
  action is `default` / `cta`.
- **On / selected** (filters applied, a pressed toggle): `bg-control-selected`, the
  primary mixed into the control fill, never a darker edge or a foreground alpha.
- **Page Bar** (`PageBar`): a page's title and toolbar share one `surface` strip, so
  the chrome sits on rung 1 like the content and the controls in it climb a rung.
- **Ghost:** transparent at rest, hover `bg-hover`. Blue stays for "act here",
  so an icon button never turns into a blue chip on hover.
- **Link:** underline-on-hover, text shifting to `--link`.
- **Status pills** (`toneClasses().fill`) carry a hairline in their tone, because
  the idle and info fills sit about 1.01:1 on the light rungs.

### Segmented & Tabs
- **One-of-N switches** (a view, a period, a page size) are a segmented `ToggleGroup`
  or pill `TabsList`, never a row of outline buttons with a tinted one.
- **Track:** `bg-tab-track` edged `border-control-border`: it sinks a rung below the
  surface, so the options that are off read dimmer than the surface around them, and it
  takes a button's quiet edge, not a field's, because it is a control.
- **Active:** `bg-tab-active` (`--tab-lift` rungs above the surface: 2 light, 1.5 dark),
  foreground text, `shadow-xs`. At least 1.15:1 against the track on every rung.
- **Inactive:** no fill, `text-muted-foreground`; hover `bg-hover` + foreground text,
  press `bg-press`.
- **Inside a control group** (a capsule marked `data-slot="control-group"`, like the analytics
  filter bar): the track drops its edge, fill and padding, so the group draws the one edge.
  A track sitting straight on a card, a popover or the Page Bar is not nested and keeps its own.
- **Underline tabs** (`TabsList variant="underline"`): active is foreground text on a
  foreground underline; inactive is muted text. No fills.
- Multi-select chips (trades, series, filters) are toggles, not switches: they keep
  their own on-state.

### Cards / Containers
- **Corner Style:** `xl` (12px app) / 6px (marketing panel).
- **Spacing between page surfaces:** page-level surfaces sit `--gutter` (8px) apart,
  owned by the page container's `gap-(--gutter)`; the surfaces carry no outer margins.
- **Background:** a ladder rung (app: `bg-card`, one rung above whatever it sits on)
  or Warm Panel `#f4efe6` (marketing), one step off the page.
- **Shadow Strategy:** the tinted ramp from Elevation & Depth — resting cards use the
  low end; never a flat gray drop.
- **Border:** 1px world-neutral hairline.
- **Internal Padding:** ~24px, tightening on compact variants via `--block-pad-compact`.

### Inputs / Fields
- **Style:** filled with the rung it sits on (`bg-input-background`) so it sinks into
  the surface, edged with `border-input` (`--control-edge` edges off that rung, about
  2:1), `rounded-md`. A field trigger that hovers (select, multi-select) takes
  `hover:border-input-hover`, a firmer edge short of 3:1. Select, date and multi-select triggers are fields too. Fields sink,
  buttons stand: an outline button is filled a rung up and takes the softer
  `--control-border` off that rung. Checkbox, radio and switch keep a 3:1 `--indicator`.
- **Focus:** a 3px `ring-ring/50` in the world's accent plus a border shift — crisp,
  not a glow. `aria-invalid` swaps the ring to destructive.

### Navigation (app sidebar) — the Navy Rail
- **Shell:** a floating panel (`<Sidebar variant="floating">`), not a flush-edge
  bar — 18px corner radius, `--shadow-lg`, and a `--sidebar-border` hairline. It
  sits inset from the viewport edge on iPad and desktop, in both modes.
- **Fill:** `--sidebar`. In light it is a fixed navy anchor, `oklch(0.22 0.06 262)`.
  In dark it is a ladder rung: rung 2 of the surface hue, one step above a section,
  so the rail still stands off the page. Labels sit in `--sidebar-foreground`; group
  labels and at-rest icons use the dimmer `--sidebar-muted`.
- **Active state:** a navy lift, not a cyan pill. `--sidebar-accent` is a lighter
  navy than the rail (`oklch(0.3 0.065 262)` in light; rung 4.2 in dark), with
  `--sidebar-accent-foreground` for the label. Only the icon carries the brand
  colour: `--sidebar-active-icon`, the bright cyan.
- **Hover:** `--sidebar-hover`, a solid step between the rail and the active lift
  (`oklch(0.26 0.06 262)` in light; rung 2.6 in dark). No border, no shadow
  (icon + label rows, `SIDEBAR_NAV_ITEM_CLASS`). `theme:check` keeps the climb
  rail → hover → active in dark.
- **Gloss:** the rail's material keeps its own light in both schemes. The phone
  dock and its menu puck take `--sidebar-sheen` / `--sidebar-sheen-radial` and the
  `--shadow-dock-*` shadows; the theme switch sits in `--sidebar-groove` with
  `--shadow-sidebar-groove` and a `--shadow-sidebar-thumb` thumb.
- **Ring/focus:** `--sidebar-ring`, the bright cyan of the active icon.

### Frosted-Glass Popover (signature)
- The Command Desk's signature surface: `--popover-glass` fill over `backdrop-filter`
  blur, `--popover-glass-overlay` top sheen, `--popover-glass-shadow` four-layer
  shadow. Use for floating menus, command palettes, and overlays — the detail that
  makes the app feel premium rather than templated.

### Credential Strip / Blueprint Eyebrow (signature, marketing)
- `BlockEyebrow` (Nunito uppercase, `--fs-eyebrow`, `--tracking-eyebrow`) in Blueprint Ink,
  often paired with a capsule pill (3px/999px) and `<Decor>` strokes — the drafting-
  label voice that signals licensed authority.

## Do's and Don'ts

### Do:
- **Do** keep each world's accent to one hue on ≤10% of a screen (The One Voice Rule).
- **Do** tint every shadow toward the world's blue; use the tokenized ramps, not ad-hoc gray drops.
- **Do** set headings in Syne and body in Nunito; cap reading measure at 60ch.
- **Do** use the frosted-glass popover for floating app UI — it is a brand asset.
- **Do** reach for the blueprint grid and drafting-paper motifs in the marketing world, where they mean "engineered and licensed."
- **Do** derive all spacing/radius from the tokens (4px base; 6px marketing / 8px app corners).
- **Do** treat stage colors (red/yellow/green/purple/blue) as fixed semantics, never restyled for taste.

### Don't:
- **Don't** ship the slop look this system rejects: 8px-on-everything, gradient text, neon glow-on-dark, evenly-gray palettes.
- **Don't** use a glow halo for rings or CTAs — hairline definition only (The No-Glow Rule).
- **Don't** rely on `backdrop-filter` for hero-over-photo legibility; use the `--hero-scrim` radial gradient (The Scrim-Not-Blur Rule).
- **Don't** mix warm-concrete and cool-paper/glass neutrals across worlds (The Warm-Cool Border Rule).
- **Don't** set body copy in uppercase or in Syne; keep all-caps to short eyebrows/labels.
- **Don't** introduce a second decorative accent hue in either world.
