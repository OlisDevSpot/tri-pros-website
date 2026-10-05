---
name: Tri Pros Remodeling
description: A two-world design system — an operational "Command Desk" for the CRM and "Blueprint Authority" for marketing & funnels.
colors:
  # The Command Desk (app / dashboard) — oklch is the normative source. Light
  # values; dark-mode pairs are in the Colors section below and docs/design-system/tokens.md.
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
- **Cool Paper** (`oklch(0.965 0.009 246)`): the app page background — a faintly
  cool near-white.
- **Slate Ink** (`oklch(0.235 0.045 258)`): primary text; a soft blue-slate, never
  pure black.
- **Card White** (`oklch(1 0 0)`): raised card / popover / input-background
  surface, one step brighter than the page.
- **Surface Raised** (`oklch(0.978 0.006 250)`): column bodies, table heads and
  hover rows — a step between the page and Card White.
- **Quiet Steel** (`oklch(0.47 0.03 256)`): muted-foreground for secondary text
  and captions.
- **Hairline** (`oklch(0.905 0.012 252)`): borders and dividers. **Border Strong**
  (`oklch(0.84 0.015 252)`) is the emphasized variant, for dashed empty states and
  dividers that need to read as more than a hairline.
- **Control Border** (`oklch(0.62 0.03 255)`, 3:1 against the card): the border on
  inputs, textareas and other form controls — deliberately stronger than Hairline,
  because a control needs a visible edge a divider doesn't.
- **Navy Rail** (`oklch(0.215 0.072 262)` light / `oklch(0.13 0.05 262)` dark): the
  sidebar fill — see Sidebar, below.

### Neutral — Blueprint Authority (marketing)
- **Warm Concrete** (`#faf7f1` page, `#f4efe6` panel, `#efe7d7` raised): the poured-
  concrete-and-paper base the whole marketing world stands on. Panels sit a touch
  deeper than the page — the "loved callout tone."
- **Warm Ink** (`#2a2520`): headline text; a warm near-black.
- **Concrete Body** (`#5f574b`) / **Warm Muted** (`#8a7c6a`): body copy and muted
  microcopy.
- **Concrete Hairline** (`#ddd4c4`): borders and inputs.

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
- **Outline:** hairline border + `backdrop-blur-sm`, hover `bg-hover`; the label
  keeps its colour.
- **Ghost:** transparent at rest, hover `bg-hover`. Blue stays for "act here",
  so an icon button never turns into a blue chip on hover.
- **Link:** underline-on-hover, text shifting to `--link`.
- **Status pills** (`toneClasses().fill`) carry a hairline in their tone, because
  the idle and info fills sit about 1.01:1 on the light rungs.

### Cards / Containers
- **Corner Style:** `lg` (8px app) / 6px (marketing panel).
- **Background:** Card White (app) or Warm Panel `#f4efe6` (marketing), one step off
  the page.
- **Shadow Strategy:** the tinted ramp from Elevation & Depth — resting cards use the
  low end; never a flat gray drop.
- **Border:** 1px world-neutral hairline.
- **Internal Padding:** ~24px, tightening on compact variants via `--block-pad-compact`.

### Inputs / Fields
- **Style:** solid fill (Card White / warm), 1px hairline, `rounded-md`.
- **Focus:** a 3px `ring-ring/50` in the world's accent plus a border shift — crisp,
  not a glow. `aria-invalid` swaps the ring to destructive.

### Navigation (app sidebar) — the Navy Rail
- **Shell:** a floating panel (`<Sidebar variant="floating">`), not a flush-edge
  bar — 18px corner radius, `--shadow-lg`, and a `--sidebar-border` hairline. It
  sits inset from the viewport edge on iPad and desktop, in both modes.
- **Fill:** `--sidebar` — a navy anchor, `oklch(0.215 0.072 262)` in light,
  `oklch(0.13 0.05 262)` in dark (one step deeper, so dark mode's rail still reads
  darker than its own cards). Labels sit in `--sidebar-foreground`; group labels
  and at-rest icons use the dimmer `--sidebar-muted`.
- **Active state:** a solid cyan pill, `--sidebar-accent` (`oklch(0.80 0.12 228)`,
  the same value in both modes), with a navy label, `--sidebar-accent-foreground`.
  The active icon uses `--sidebar-primary`, the same navy as the label — never the
  rail's own navy fill, or the icon would vanish against it.
- **Hover:** `--sidebar-hover`, a near-transparent white wash (6% light / 5% dark)
  — no border, no shadow. It hints interactivity without mimicking the active pill
  (icon + label rows, `SIDEBAR_NAV_ITEM_CLASS`).
- **Ring/focus:** `--sidebar-ring`, the same cyan as the active pill.

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
