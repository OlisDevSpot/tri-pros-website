# Theme conventions: how to colour anything in the app

How to choose a colour, surface, edge or state in the Command Desk (dashboard, records, proposal, meeting flow, customer profile). Read this before you add or change any class that paints something.

- **This file** tells you which token to use and why, with do/don't examples.
- **[`DESIGN.md`](../../DESIGN.md)** (root) lists every token and its values.
- **`src/app/(frontend)/globals.css`** is the source of truth. If this file and the code disagree, the code wins: stop and flag the stale line.

These rules are not lint-enforced on purpose (owner ruling 2026-10-09). Follow them by hand, then run the self-check in §12 on your diff.

The marketing world (`.theme-marketing`, `.funnel-light`: landing, funnels, `site-navbar`) keeps its own Blueprint palette. Most rules here don't apply there; read the public-site epic memory before touching it.

---

## 0. Quick lookup: "I need…"

| I need… | Use | Never |
|---|---|---|
| A panel on the page | `bg-card` (or `surface`) + `border rounded-xl` | `bg-white`, `bg-background` |
| A panel inside a panel | another `bg-card`: it climbs a rung by itself | `bg-gray-50`, `bg-muted/50` |
| The current rung's fill, without climbing | `bg-(--card)` (table heads, sticky cells, timeline discs) | a second `bg-card` |
| A quiet fill one rung up (chips, badges, tracks) | `bg-muted` / `bg-secondary` | `bg-foreground/5` |
| Striped rows, skeleton rows, an opened-row panel | `bg-band` | `bg-muted/40` |
| A menu, select or popover | the primitive (`bg-popover`, top rung) | a custom `bg-card` dropdown |
| Page title and toolbar | `<PageBar>` | a bare `<div>` on the canvas |
| Space between page surfaces | the container's `gap-(--gutter)` | `mt-4`/`mb-6` on the surfaces |
| A divider or card edge | `border` / `border-border` | `border-gray-200`, `border-foreground/10` |
| An emphasised divider or dashed empty state | `border-border-strong` | `border-2` |
| Chart grid / axis | `--grid-line` / `--axis` (`ChartContainer` already wires them) | `stroke="#e5e7eb"` |
| A text field, select or date trigger | the `Input` / `Select` primitive (`border-input`, sinks) | a custom border colour |
| A standalone toolbar button | `<Button variant="outline">` | `variant="ghost"` with a border |
| A filled neutral button on a card or dialog | `variant="secondary"` | `variant="outline"` |
| The one main action | `variant="default"` or `cta` | a second blue button |
| A button whose filter or toggle is on | `bg-control-selected` | `border-primary`, `bg-primary/10` |
| An icon button's hover | `variant="ghost"` (`hover:bg-hover`) | `hover:bg-primary/10`, `hover:text-primary` |
| A clickable card or row hover | `hover:bg-row-hover` + `data-press pressed:bg-row-press` | `hover:border-primary`, `hover:shadow-lg` |
| A selected row, or today on a calendar | `bg-row-selected` | `ring-2 ring-primary` |
| One-of-N switch (view, period, page size) | `ToggleGroup variant="segmented"` or a pill `TabsList` | a row of outline buttons with one tinted |
| A status (stage, outcome, proposal state) | `toneClasses(tone)` from `src/shared/constants/status-tones.ts` | `bg-green-100 text-green-700` |
| Text or icons over a photo | `text-on-media` / `text-on-media-muted` on a `bg-scrim/NN` veil | `text-white`, `bg-black/40` |
| Secondary text | `text-muted-foreground` | `text-foreground/60`, `opacity-60` on text |
| A per-person colour | `getUserColorToken` → `identity-<n>-*` | a hand-picked hue |

---

## 1. Surfaces climb the ladder

Every app surface is one hue at a lightness set by its **rung**. The canvas (`--background`) is rung 0. Each surface stacked on another is one `--step` lighter, in both schemes. The CSS counts nesting for you: `:is(.bg-card, .surface)` sets `--depth` 1, 2 or 3, and every relative token (`--card`, `--muted`, `--border`, `--input`, `--row-hover`, …) is declared again on each surface, so it resolves against the rung it sits on.

```tsx
// ✅ Nesting does the work. The inner card is rung 2 and its border is taken off rung 2.
<section className="bg-card rounded-xl border p-4">
  <div className="bg-card rounded-lg border p-3">…</div>
</section>

// ✅ A table head or sticky cell paints the rung it is on and must not climb.
<th className="sticky top-0 bg-(--card)">…</th>

// ❌ Holes and literals. They ignore the rung and break dark mode.
<div className="bg-background rounded-lg">…</div>   // a hole down to the canvas
<div className="bg-white dark:bg-slate-900">…</div> // a literal plus a dark patch
<div className="bg-muted/50">…</div>                 // alpha shows whatever sits underneath
```

- `bg-muted` is always one rung above wherever it is read. It suits chips, badges and quiet fills, not panels.
- Variants such as `md:bg-card` or `bg-card/50` are different class names, so they are **not** surfaces and don't climb. Use them only when that is what you want.
- A dialog is a portaled `bg-card`, so it starts at rung 1. Menus, selects and popovers are `bg-popover` / `surface-overlay`, the top rung.
- `bg-background` belongs only on page shells (the dashboard `main`, a full-page route). Inside a surface it punches a hole.
- To change how far apart the rungs sit, retune the knobs (`--canvas-l`, `--step`, `--edge`, `--lift`) with the `elevation-ladder` skill. Never patch a single surface.

## 2. Page layout: PageBar, gutter, radius

```tsx
// ✅ Title + toolbar share one surface. Page surfaces are rounded-xl, 8px apart, spaced by the container.
<div className="flex flex-col gap-(--gutter)">
  <PageBar>
    <h1 className="text-lg font-semibold">Customers</h1>
    <QueryToolbar … />
  </PageBar>
  <section className="surface rounded-xl border">…</section>
</div>

// ❌ A bare title on the canvas, margins on the surfaces, mixed radii.
<h1 className="mb-6">Customers</h1>
<section className="mt-4 rounded-2xl bg-card">…</section>
```

- `--gutter` (8px) is the only gap between page-level surfaces. The container owns it, and the surfaces carry no outer margins.
- Page surfaces are `rounded-xl` (12px). Things inside them step down: `rounded-lg` for nested cards and tracks, `rounded-md` for controls.

## 3. Edges stay quiet

The owner's standing taste: strong borders on fields and buttons look "hideous/obnoxious". Every edge is a token taken a measured distance off its own fill, and `pnpm theme:check` caps each one (`max`) as well as floors it.

| Edge | Token | Contrast | Where |
|---|---|---|---|
| Hairline | `--border` | ~1.1–1.2:1 | cards, dividers |
| Strong | `--border-strong` | 2 edges | dashed empty states, emphasised dividers, axis |
| Control | `--control-border` | ~1.3–1.45:1 vs the button fill | outline buttons, toggles, segmented and tab tracks, capsules |
| Field | `--input` | ~2:1 | inputs, selects, date and multi-select triggers |
| Field hover | `--input-hover` | ~2.3–2.8:1, capped below 2.95 | hovered field triggers |
| Indicator | `--indicator` | 3:1 | checkbox and radio edge, off switch track |

```tsx
// ❌ Never thicken or darken an edge to make something "pop".
<Button variant="outline" className="border-2 border-foreground/30">Filter</Button>
// ✅ It already stands: filled a rung up, quiet edge, shadow-xs.
<Button variant="outline">Filter</Button>
```

## 4. Fields sink, buttons stand

- **A field** (`Input`, `Textarea`, `SelectTrigger`, date picker, multi-select) is filled with the rung it sits on (`bg-input-background`) and marked by its `border-input` edge alone. A trigger that hovers takes `hover:border-input-hover`.
- **An outline button** is filled one rung up (`bg-control`), edged `border-control-border`, with `shadow-xs`. It hovers to `bg-control-hover`, a solid step, because a wash would replace the fill.

Which button variant to use:

| Situation | Variant |
|---|---|
| A standalone toolbar action (Filter, Columns, Export) | `outline` |
| Items inside a grouped capsule | `ghost`; the capsule (`bg-card border border-control-border shadow-xs`) is the raised control |
| A filled neutral action on a card or dialog (e.g. the Google sign-in button) | `secondary`, which climbs with its surface |
| The one main action on the screen | `default` / `cta` (flat blue, solid darker hover, never a gradient) |
| An icon button | `ghost` |

## 5. Blue means "act here"

Harbor Blue (`--primary`) is the app's only accent, on ≤10% of any screen (the One Voice rule). It marks primary buttons, active nav, focus rings, links and selection. It is **never a hover**.

| State | Transparent control | Filled control | Row / card |
|---|---|---|---|
| Hover | `hover:bg-hover` (6% foreground wash) | `hover:bg-control-hover` / `bg-secondary-hover` / `bg-primary-hover` | `hover:bg-row-hover` |
| Press | `pressed:bg-press` | `pressed:brightness-85` (primary) / `pressed:bg-press` | `pressed:bg-row-press` |
| On / selected | `data-[state=on]:bg-tab-active` (segmented) | `bg-control-selected` | `bg-row-selected` |

```tsx
// ❌ Primary as a hover, an alpha fill or an outline.
<button className="hover:bg-primary/10 hover:text-primary">⋯</button>
<Card className="hover:border-primary hover:shadow-lg">…</Card>

// ✅ Neutral hover on controls; the faint row tint on clickable cards.
<Button variant="ghost" size="icon">⋯</Button>
<MeetingOverviewCard
  meeting={row}
  data-press
  className="cursor-pointer rounded-lg border bg-card p-2.5 hover:bg-row-hover pressed:bg-row-press"
/>
```

**Press feedback** comes from `usePressFeedback` (mounted once by `PressFeedbackProvider`). It sets `data-pressed` on the innermost pressable element under the pointer and holds it at least 140ms. Style it with the `pressed:` variant, never `active:`. `active:` vanishes before a quick click is seen, and it lights up every ancestor. Buttons, links, tabs, menu items and options are pressable already. A clickable `div` opts in with `data-press`. Add `press-motion` for the scale-down; it skips anything that opens a popover.

Overview cards accept extra `div` props (`data-press`, aria) but not `onClick`, because the root owns the click.

## 6. Segmented controls and tabs

There is one model for every one-of-N switch: a **sunken track**, a **lifted active option**, and **dim inactive options**.

```tsx
// ✅ Segmented
<ToggleGroup type="single" variant="segmented" value={view} onValueChange={setView}>
  <ToggleGroupItem value="meetings">Meetings</ToggleGroupItem>
  <ToggleGroupItem value="activities">Activities</ToggleGroupItem>
</ToggleGroup>

// ✅ Pill tabs (the default TabsList): the same track and active treatment
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>…<TabsTrigger value="roi">ROI</TabsTrigger></TabsList>
</Tabs>

// ❌ A row of outline buttons with the active one tinted, or a list given a fixed height
<div className="flex gap-1">{opts.map(o => <Button variant={o === v ? 'default' : 'outline'} …/>)}</div>
<TabsList className="h-9">…</TabsList>   // the list grows with its triggers; a fixed height clips taller ones
```

- Track: `bg-tab-track` + `border-control-border`, one rung below the surface. Active: `bg-tab-active`, `--tab-lift` rungs above, with foreground text and `shadow-xs`. Inactive: no fill, `text-muted-foreground`, hover `bg-hover`.
- **Control group:** when a track sits inside a capsule marked `data-slot="control-group"` (e.g. the analytics filter bar), it drops its own edge, fill and padding through `in-data-[slot=control-group]:` variants, so the capsule draws the only edge. Mark any capsule that groups controls this way. Never strip the track's border by hand.
- **Underline tabs** (`variant="underline"`) suit page-level navigation, such as the proposal navbar. They have no fills.
- Multi-select chips (trades, series) are toggles, not switches, so they keep their own on-state (`bg-control-selected`).

## 7. Over media (photos, video, maps)

A photo looks the same in both schemes, so the ink and veils over it never change with the theme.

```tsx
// ✅
<div className="absolute inset-x-0 bottom-0 bg-linear-to-b from-scrim/30 to-scrim/90 p-4">
  <p className="text-on-media">{title}</p>
  <p className="text-on-media-muted text-sm">{subtitle}</p>
</div>
<button className="bg-scrim/50 text-on-media rounded-full …"><XIcon /></button>

// ❌
<p className="text-white drop-shadow">{title}</p>
<div className="bg-black/40 backdrop-blur">…</div>
```

Veil floors, assuming the photo is white where the ink sits:

| Content | Minimum veil |
|---|---|
| Body text (`text-on-media`) | 60% |
| Muted text (`text-on-media-muted`) | 70% |
| Icons, large text, control glyphs | 50% |

A gradient must meet the floor **under the text**, not at its faint end. `backdrop-blur` adds nothing to contrast. Marketing's light hero plate (`--hero-scrim`, dark ink on a warm veil) is the reverse case and keeps its own token.

## 8. Status, identity and charts carry meaning

- **Status:** use `toneClasses(tone)` (`.fill`, `.text`, `.dot`, `.border`, `.bar`, `.wash`) from `src/shared/constants/status-tones.ts`. Pipeline stages map through `STAGE_COLOR_TONE`. The meaning is fixed: red = bad, yellow = in progress, green = converted, purple = action, steel = info. Never restyle a tone for taste. Solid tiles (`attention`/`success`/`danger`) hover with `--status-<tone>-hover`.
- **People:** `getUserColorToken` (`shared/entities/users/lib/get-user-color.ts`) → `identity-<1..8>-{bg,fg,ring}`.
- **Charts:** `--series-*` for the lead chain (an ordinal ramp, cyan → navy), `--chart-1..5` for categorical data. Build charts on `ChartContainer`, which already wires the grid and axis tokens.

## 9. Things that never appear in app code

| Pattern | Why | Instead |
|---|---|---|
| `bg-white`, `text-black`, `bg-black/NN` | Doesn't follow the scheme or the rung | a ladder token, or `on-media`/`scrim` over photos |
| Tailwind palette classes (`bg-blue-500`, `text-slate-600`) | Off-system hue (lint already blocks them in `features/` and `shared/`) | a role token or a status tone |
| Hex / `[oklch(…)]` / `[rgb(…)]` arbitrary colours | Bypasses the tokens and `theme:check` | a token; if none fits, add one (§11) |
| `dark:` colour patches | Tokens already carry both schemes, so a patch hides a light-only value | fix the token choice |
| `text-foreground/60`, `opacity-60` on text | Unchecked contrast on rungs 2–3 | `text-muted-foreground` |
| `hover:`/`active:` primary fills outside `src/shared/components/ui/**` | Blue is for "act here" | §5 state tokens |
| `bg-background` inside a surface | A hole to the canvas | `bg-(--card)` or `bg-band` |
| `active:` for press styling | Fires too briefly and on ancestors | `pressed:` |
| `text-[13px]`, `font-black`, `font-extrabold` | The 2px type ramp; weights stop at 700 (lint-enforced) | Tailwind steps, `font-bold` max |

**Legitimate exceptions:**
- Emails, PDFs, the OG card and the manifest can't read CSS variables, so hex is fine there.
- The marketing world keeps its own palette.
- The `--text-presentation-*` clamps in the meeting-flow presentation are exempt from the type ramp.
- shadcn's stock `dark:aria-invalid:ring-destructive/40` focus ring stays.

## 10. Process: judge it by eye

- **No mechanical sweeps.** Don't find-and-replace a colour across files. Change one area, look at it, then move on.
- **Look at both schemes**, desktop and phone, on the screens you touched. For token changes, look at dashboard, records, proposal and the public site. Screenshot with your own browser (Playwright auth is `/api/dev/playwright-session`).
- **Owner screenshot gate** before any colour commit.
- **Stale dev CSS** often looks like broken work. If a class you added has no effect, ask the owner to stop the server, `rm -rf .next`, and restart. Never do it yourself while the server runs.
- No DB writes to stage a visual test. The owner edits fixtures by hand.

## 11. Adding or changing a token

1. **Decide by meaning, not value.** Ask whether an existing role covers it (§0). Most "I need a new colour" cases are an existing state or rung.
2. **Declare it in `globals.css`:**
   - a fixed value goes in the `:root, .funnel-light` and `.dark` blocks;
   - a value that depends on the rung goes in the relative block, `:root, .dark, :is(.bg-card, .surface, …)`, built from `--here-l` / `--edge` / `--step`, never a literal;
   - map it in `@theme inline` as `--color-<name>: var(--<name>)` to get a utility.
3. **If it is relative**, add it to the marketing `inherit` list (`:is(.theme-marketing, .funnel-light) :is(…)`) so the marketing world keeps its literal palette.
4. **Guard it in `scripts/check-theme-contrast.ts`:** a pair with `min`, and a `max` wherever the owner's taste caps it (edges), on every place it can sit (`page`, the card rungs, overlay), in both schemes. Run `pnpm theme:check`. The Claude pre-commit hook runs it too.
5. **Document it** in `DESIGN.md` (the token and its role) and, if it changes how to choose, in §0 here.
6. **Screenshot gate** with the owner, both schemes (§10).

## 12. Self-check before you commit (the on-demand "lint")

Run these on the files you touched. Every hit needs either a fix or a reason from §9's exceptions.

```bash
# Changed app files (staged + unstaged). xargs -r skips the search when nothing changed.
files() { git diff --name-only HEAD -- src | grep -E '\.tsx?$'; }
check() { files | xargs -r grep -nE "$1"; }

# literals and patches
check '\b(bg|text|border|ring|from|to|via)-(white|black)\b'
check '\-\[(#|rgb|oklch|hsl)'
check 'dark:(bg|text|border|ring|from|to)-'

# blue as a state (primitives in src/shared/components/ui/ are allowed)
check '(hover|active|focus|group-hover):(bg|border|text)-primary' | grep -v 'src/shared/components/ui/'

# holes, faded text, press
check '\bbg-background\b'
check 'text-(foreground|muted-foreground)/[0-9]+'
check '\bactive:(bg|scale|brightness)'

# edges made loud
check 'border-2|border-(foreground|primary)/'

pnpm theme:check && pnpm lint && pnpm tsc
```

Then look at the screens (§10).

## 13. Areas not yet cleaned

Phase 1 of the theme epic (`docs/plans/2026-10-02-theme-states-and-enforcement-epic.md`) cleaned sign-in, dashboard, records and proposal. **Meeting flow, customer profile and the public site** still hold older patterns, notably white-on-navy presentation text (about 87 hits waiting on presentation-ground ink tokens) and photo veils below the floors. Don't copy patterns from those areas; copy from the cleaned ones. When you work in one, clean the lines you touch and ask the owner before sweeping the rest.
