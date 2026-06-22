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

## Tier 2: Semantic Tokens — `.theme-marketing` Block

The marketing theme is applied by adding the `.theme-marketing` class to a wrapper element. It remaps the shadcn semantic variables to the warm-concrete palette and brand blue.

### Shadcn Semantic Remaps

| Token | Value | Meaning |
|---|---|---|
| `--background` | `#e9e2d6` | Sand — the page/section background |
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
| `--input` | `#ddd4c4` | Input borders (same as hairline) |
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
| `--shadow-card` | `0 44px 64px -42px rgb(60 40 15 / 0.5)` | The warm card drop shadow — long, soft, tinted |
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

The `.theme-marketing` tokens currently use hex values (`#03afed`, `#e9e2d6`, etc.). The rest of `globals.css` uses OKLCH throughout. Converting the marketing palette to OKLCH is a deferred follow-up (spec §13) — it does not affect rendering, only consistency with the existing convention.

Until that conversion happens, do not mix OKLCH computed values with the hex tokens in the same expression.
