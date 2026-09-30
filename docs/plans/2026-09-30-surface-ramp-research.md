# Surface ramp tokens — research note (2026-09-30)

## Question

We want to rewrite the app's surface colour tokens (`--background`, `--card`, `--muted`, `--border`, …) as a
lightness ramp computed from four knobs per mode (`--surface-h`, `--surface-c`, `--canvas-l`, `--lift`,
plus `--edge-dir`), with the knobs overridden on `.dark`. Before building it:

1. Are `calc()` / `min()` valid inside `oklch()` channels, and do derived tokens declared on `:root` pick up
   knobs overridden on `.dark`?
2. Do Tailwind v4 opacity modifiers (`bg-card/50`) still work through `@theme inline`?
3. Relative colour syntax (`oklch(from …)`) vs the channel-variable approach?
4. How to band table rows when every data row may be followed by an expanded-detail row, including the
   sticky first column?
5. What is the `color-mix()` floor?

Stack: Tailwind **4.1.18** (`node_modules/tailwindcss/package.json`), `@tailwindcss/postcss` 4.1.18,
lightningcss 1.30.2. Devices: iPad Safari in the field and desktop Chrome.

## Recommendation

1. **Use the channel-variable approach** (plain `oklch(calc(var(--canvas-l) + var(--lift)) var(--surface-c) var(--surface-h))`).
   It works in Chromium 145 and WebKit (Safari 26) as tested, and its support floor is `oklch()` itself
   (Safari 15.4 / Chrome 111), which is below Tailwind v4's own floor (Safari 16.4 / Chrome 111).
2. **Declare the derived formulas on every selector that sets knobs.** Do not write them on `:root` alone.
   Write `:root, .dark { --background: …; --card: …; --muted: …; --border: … }` and keep only the knob
   values in the separate `:root {}` / `.dark {}` blocks. A custom property's `var()` is substituted on the
   element where the declaration matches. Descendants inherit the *result*, not the formula. Today
   `.dark` sits on `<html>`, the same element as `:root`, so it works there by accident. The nested
   `<div className="dark …">` in
   `src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx:48` would render
   **light** surfaces in light mode unless the formulas are repeated on `.dark` (reproduced in both engines).
   The same applies to any future scope that sets knobs, e.g. a `.funnel-light` that sets knobs rather than literals.
3. **Keep `@theme inline { --color-card: var(--card); }`**, which is already in `globals.css` line 431. Opacity
   modifiers keep working. Tailwind emits an opaque `var(--card)` fallback and then
   `color-mix(in oklab, var(--card) 50%, transparent)` inside `@supports`. Do not move these to plain `@theme`,
   because the utility would then reference `--color-card`, which is resolved once on `:root` and hits the same
   nested-scope problem.
4. **`min(1, …)` is optional.** Lightness above 1 from `calc()` is clamped to 1 in both engines (tested:
   `oklch(calc(.9 + .3) 0 0)` → `oklch(1 0 0)`). You can keep it as documentation of intent. It costs nothing.
5. **Do not use relative colour syntax for the ramp.** Safari needs 18 for spec-conformant behaviour (16.4–17.x
   is partial), Chrome needs 122 (119–121 is partial), there is an open WebKit bug about var()-origin RCS
   computing to transparent, and it gives no scoping advantage (same substitution rule).
6. **Row banding: stamp `data-band` from React, and do not rely on `:nth-child`.** In
   `data-table-body.tsx:112` change `rows.map((row) =>` to `rows.map((row, i) =>` and put
   `data-band={i % 2 ? 'even' : undefined}` on the data `TableRow` only. Then style the `tr` and the sticky
   cell's fill overlay (`div.absolute.inset-0.bg-background`, line 178) from that one attribute, e.g.
   `group-data-[band=even]:bg-(--row-band)`. Make `--row-band` an **opaque** ramp step, not an alpha tint,
   so the sticky overlay stays opaque over content scrolled beneath it.
   The pure-CSS fallback `tr:nth-child(even of [data-slot=table-row]:not([data-expanded-row]))` also
   works in both engines (Safari 9+ / Chrome 111+). Note that the plain `[data-slot=table-row]` form is
   **wrong** here, because expanded rows are also rendered through `TableRow` and therefore carry
   `data-slot="table-row"`.
7. **The effective browser floor is Safari/iPadOS 16.4 and Chrome 111**, set by Tailwind v4, not by the ramp.
   Everything above (oklch 15.4, color-mix 16.2, `:nth-child(of)` 9) is at or below that floor.
8. Before shipping, check the table in Findings Q1 on a real iPad (nested `.dark` + a banded expanded table).
   The Docker WebKit run was Playwright's WebKit reporting Safari 26, not a field device.

## Findings

### Q1 — calc()/min() in oklch() channels, and scoping of derived tokens

- **Grammar.** CSS Color 4 §9.4: oklch `L` and `C` accept `<number> | <percentage> | none`, and `H` accepts
  `<hue> | none`. Math functions (`calc()`, `min()`) are valid wherever a `<number>` is (CSS Values 4 math
  functions), so `oklch(min(1, calc(...)) …)` is grammatical.
- **Clamping.** CSS Color 4 §4.2: L outside [0,1] is "not invalid, but clamped". Verified empirically:
  Chromium 145 and WebKit (Safari 26) both compute `oklch(calc(.9 + .3) 0 0)` to `oklch(1 0 0)`.
- **Substitution rule (the key one).** CSS Variables 1 §2: a custom property's computed value is "specified
  value with variables substituted". Custom properties are inherited (§2), and the inherited value is that
  computed value. §3: "Variables always draw from the computed value of the associated custom property on
  the same element." So `--card: oklch(calc(var(--canvas-l) + …))` on `:root` is resolved **on `:root`**
  with `:root`'s knobs. A `.dark` descendant that only changes `--canvas-l` inherits the already-resolved
  `--card` and does not recompute it. Tailwind's own docs show the same trap (theme docs, "Referencing
  other variables", the `--font-sans`/`--font-inter` parent/child example).
- **Empirical probe** (same HTML in both engines; Chromium 145 local, WebKit/Safari 26 via
  `mcr.microsoft.com/playwright:v1.58.2-noble`):

  | case | Chromium 145 | WebKit (Safari 26) |
  |---|---|---|
  | `--card` on `:root`, light knobs | `oklch(1 0.012 255)` | same |
  | `.dark` on `<html>` (= `:root`) | `oklch(0.205 0.045 255)` | same |
  | nested `<div class="dark">`, formula only on `:root` | `oklch(1 0.012 255)` ✗ still light | same ✗ |
  | nested `.dark`, formula repeated on `.dark` | `oklch(0.205 0.045 255)` ✓ | same ✓ |
  | `--border` with `var(--edge-dir) * 2 * var(--lift)` | `oklch(0.89 0.012 255)` | same |
  | `color-mix(in oklab, var(--card) 50%, transparent)` | `oklab(1 … / 0.5)` | same |

- **Where `.dark` lives today:** next-themes with `attribute="class"` (`src/shared/components/providers/index.tsx:18`)
  puts it on `<html>`. There is one nested `.dark` (the customer profile modal header). `.funnel-light`,
  `.theme-marketing` and `.theme-marketing.theme-dark` override surface tokens with **literals**, so they are
  unaffected unless they are converted to knobs.
- **Floor:** there is no separate BCD entry for math functions inside absolute colour channels. The floor is
  `oklch()` itself: Chrome 111, Safari 15.4, Firefox 113 (BCD `css.types.color.oklch`). `calc()` has
  applied to numbers since Safari 6 / Chrome 31 (BCD `css.types.calc.number_values`).

### Q2 — Tailwind v4 opacity modifiers through `@theme inline`

- Compiled with the installed Tailwind 4.1.18 `compile()` API, using `--card` set to the ramp expression:
  ```css
  .bg-card\/50 {
    background-color: var(--card);
    @supports (color: color-mix(in lab, red, red)) {
      background-color: color-mix(in oklab, var(--card) 50%, transparent);
    }
  }
  ```
  With `@theme inline`, the utility references `var(--card)` directly and resolves it on the element that
  uses it. With plain `@theme`, it emits `var(--color-card2)`, a token declared once on `:root`. That
  reintroduces the Q1 scoping problem for nested scopes. The Tailwind docs (theme and colours pages) say to use
  `inline` when a theme variable references another variable.
- The pre-`color-mix` fallback is the **opaque** colour. It only matters below Safari 16.2, which is under the floor.
- Production optimisation: `@tailwindcss/postcss` runs Lightning CSS when `NODE_ENV=production`, with targets
  read from `@tailwindcss/node` dist of `safari 16.4, ios_saf 16.4, chrome 111`. Running that `optimize()` on the
  ramp tokens leaves `oklch(min(1, calc(var(...)...)))` untouched. It can't resolve `var()`, and it adds no
  fallbacks at these targets. It only hoists the nested `@supports`.

### Q3 — Relative colour syntax vs channel variables

- BCD `css.types.color.oklch.relative_syntax`: Safari **18** full, and 16.4 partial ("based on older spec…
  `h` calculations require `deg`"). Chrome **122** full, and 119 partial (`l` resolves as 0–100). Firefox 128.
  BCD `css.types.calc.color_component` (calc on channel keywords): Chrome 119, Safari 16.4, Firefox 128.
- WebKit bug 267647 (unitless hue in RCS) was resolved in Safari 18.0. WebKit bug 288070 (Safari 17.6:
  `oklch(from var(--x) calc(l - 0.02) c h)` computes to `rgba(0,0,0,0)`) is still NEW. A later comment suggests
  it may be fixed in newer Safari.
- RCS origin `var(--x)` follows the same substitution rule, so it doesn't avoid the Q1 scoping trap and still needs
  per-scope redeclaration. It also moves the floor from Safari 15.4 to 18 for correct results.
- **Verdict:** use channel variables. They are simpler, have a lower floor, and are tested in both engines.

### Q4 — Row banding with expandable rows and a sticky first column

- DOM (`src/shared/components/data-table/ui/data-table-body.tsx`):
  - An optional pull-to-refresh spacer `<tr aria-hidden>` comes first (a raw `tr`, not `TableRow`).
  - Then each data row is `TableRow` (`data-slot="table-row"`), followed by a `TableRow data-expanded-row`
    when `renderExpandedRow` is set (line 195). That row stays in the DOM when collapsed.
  - Skeleton rows are also `TableRow`.
  - Plain `:nth-child(even)` breaks from both the spacer and the detail rows.
- `:nth-child(An+B of S)` (Selectors 4) has BCD `css.selectors.nth-child.of_syntax` support in Chrome 111,
  **Safari 9**, and Firefox 113. Verified in both engines:
  `tr:nth-child(even of [data-slot=table-row]:not([data-expanded-row])) > td` bands rows 2 and 4 correctly
  with detail rows and the spacer interleaved. Because detail rows also carry `data-slot="table-row"`, the
  `:not([data-expanded-row])` is required.
- Sticky column: the frozen first cell paints its own `absolute inset-0 bg-background` overlay (line 178),
  so a band on the `tr` is **hidden** under it. The overlay needs the same band fill. With `data-band` on
  the row (the row already has `group`, given `group-hover:`), that is one Tailwind variant on the overlay.
  With the CSS-only route it is one more descendant selector that has to know the overlay's shape.
- Why `data-band`: it is explicit and owned by the one component that renders rows. It is immune to future
  non-data rows (group headers, spacers, skeletons). It drives the `tr` and the sticky overlay through the same
  attribute. It needs no DOM-shape coupling in CSS. The cost is one `i` in the map. Parity follows the
  rendered `rows` order (sorted/paginated view), which is what the eye sees. Don't use `row.index`, which is
  the original data index.
- Observation (not verified visually): the sticky overlay's `group-hover:bg-muted/50` swaps an opaque fill
  for a 50% one on hover, so content scrolled under the frozen column may show through while hovered.
  An opaque band/hover step avoids this.

### Q5 — `color-mix()` floor

- BCD `css.types.color.color-mix`: Chrome 111, **Safari 16.2**, Firefox 113. Tailwind v4 officially requires
  Chrome 111 / Safari 16.4 / Firefox 128, and names `color-mix()` among the reasons (tailwindcss.com/docs/compatibility).
  Variadic (3+ colour) `color-mix` is Safari 27 / Firefox 150 / not Chrome, so don't use it (Tailwind doesn't emit it).
- Also relevant: WebKit bug 255939 (still NEW). WebKit's (ok)lch does not force `L=0`/`L=1` to pure black/white
  when chroma is non-zero. With `--surface-c` at 0.045 in dark mode and L clamped at 1 in light mode
  (`--card` = `oklch(1 0.012 255)`), the "white" card is gamut-mapped rather than `#fff`. That is harmless
  but not pure white.

## Unverified

- **Real iPad hardware.** The WebKit probe ran in Playwright's WebKit build reporting `Version/26.0` on Linux.
  No iPadOS device, and no Safari 16.4–17.x engine, was tested. The version floors for older Safari come from
  MDN BCD only.
- **The iPadOS versions actually in the field** (which iPad models and OS versions the team uses). Not checked.
  If any device is stuck below iPadOS 16.4, Tailwind v4 itself is already unsupported there.
- Whether Lightning CSS behaves differently under Next.js's own CSS pipeline, as opposed to the
  `@tailwindcss/node` `optimize()` called directly. The probe used the latter.
- The hover see-through on the sticky overlay (Q4 last bullet) is inferred from the class list and was not observed.
- WebKit bug 288070's current status in Safari 18–26. The thread hints at a fix, but there is no fix version.
- CSS Color 4's exact wording on *when* out-of-range L from `calc()` is clamped (the fetched summary said
  "parsed-value time"). Behaviour was confirmed empirically in both engines instead.

## Sources

- CSS Custom Properties Level 1 — https://www.w3.org/TR/css-variables-1/ (§2 computed value / inheritance, §3 substitution)
- CSS Color 4, oklch — https://www.w3.org/TR/css-color-4/#specifying-oklab-oklch (§9.4 grammar, §4.2 clamping)
- CSS Color 5, relative colours — https://drafts.csswg.org/css-color-5/#relative-colors
- MDN BCD raw data — https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/selectors/nth-child.json ,
  …/css/types/color.json , …/css/types/calc.json
- MDN `:nth-child` — https://developer.mozilla.org/en-US/docs/Web/CSS/:nth-child
- MDN `color-mix()` — https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix
- MDN relative colours — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_colors/Relative_colors
- Tailwind compatibility — https://tailwindcss.com/docs/compatibility
- Tailwind theme, "Referencing other variables" — https://tailwindcss.com/docs/theme (via context7 `/websites/tailwindcss`)
- Tailwind colours, `@theme inline` — https://tailwindcss.com/docs/colors
- WebKit bug 288070 — https://bugs.webkit.org/show_bug.cgi?id=288070
- WebKit bug 267647 — https://bugs.webkit.org/show_bug.cgi?id=267647
- WebKit bug 255939 — https://bugs.webkit.org/show_bug.cgi?id=255939
- Local evidence: Tailwind 4.1.18 `compile()` output and `@tailwindcss/node` `optimize()` targets (scratchpad
  `tw.mjs`, `lc.mjs`), plus Chromium/WebKit probes (`probe.mjs`, `probe2.mjs`). All are session scratchpad files, not committed.
