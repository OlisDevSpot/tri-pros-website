# Remodel ROI charts and story canvas: research

Date: 2026-09-27. Scope: the Remodel ROI Calculator tab (`src/features/calculators/ui/views/calculators-view.tsx` → `remodel-roi-calculator/ui/views/remodel-roi-calculator.tsx`).
Installed (read from `node_modules/*/package.json`): `recharts` 2.15.4, `tailwindcss` 4.1.18, `react` 19.2.4, `motion` 12.31.0, `react-resizable-panels` 3.0.6, `typescript` 5.9.3.

## Question

The calculator becomes a left inputs panel you can collapse, next to a scrolling story canvas. The canvas has a sticky top bar, about 8 chapters and a dot rail. What is the correct way, on the installed versions, to build: (1) stacked and paired-stacked bars where hovering one segment shows only that segment, with a hatched segment and a 2px gap between segments; (2) line/area annotations and an area filled one colour above zero and another below; (3) theme colours; (4) container queries for the top bar; (5) scroll-spy inside a nested scroller; (6) the collapsible panel?

## What the code does today

- `TabsContent` is the scroller: `min-h-0 flex-1 overflow-y-auto`, `forceMount`, `data-[state=inactive]:hidden` (calculators-view.tsx:27). The ROI view is a plain two-column `lg:` grid inside it (remodel-roi-calculator.tsx:37). Nothing is sticky yet.
- Chart precedent: raw recharts, no wrapper. `ResponsiveContainer` sits in an `h-56` div. Colours are CSS variables passed straight to SVG props (`stroke="var(--chart-1)"`, `stroke="var(--border)"`, `stroke="var(--muted-foreground)"`). `lead-source-trend-chart.tsx` has a custom `content` tooltip styled with `bg-popover border-border`.
- **`src/shared/components/ui/chart.tsx` (shadcn chart) does not exist.** Only those two files import `recharts`.
- `src/app/(frontend)/globals.css:594-599`: `@layer base { * { scroll-behavior: smooth; scroll-margin-top: 80px; } }`. The Who We Are presentation already had to override it inline (`src/shared/components/presentation/slide.tsx:29-31,62`). Memory `project-who-we-are-presentation` lists narrowing that rule to the marketing site as an open follow-up. The owner ruled "F3 (global smooth-scroll vs reduced motion) = no action", so work around it locally and do not edit the rule.

## Recommendation

### 1. Stacked bars: hover shows one segment

**Use `<Tooltip shared={false} content={<SegmentTooltip />} />`.** Verified in the installed source (`lib/chart/generateCategoricalChart.js`):
- `getTooltipEventType()` (l.1669-1676) maps `shared === false` to `'item'`. `BarChart` accepts `'item'` (`lib/chart/BarChart.js:19-20`, `validateTooltipEventTypes: ['axis','item']`).
- In item mode the chart attaches **no** mousemove/enter/leave handlers to the wrapper (`parseEventsOfWrapper`, l.1750-1772, only when `'axis'`). Each Bar is cloned with `onMouseEnter`/`onMouseLeave` combined with `handleItemMouseEnter`/`Leave` (l.1402-1411).
- `handleItemMouseEnter(el)` sets `activePayload: el.tooltipPayload` (l.964-976). For a Bar rectangle that is `[getTooltipItem(item, entry)]`, a **single-element** array (`lib/cartesian/Bar.js:447`). It is anchored at the segment centre (`tooltipPosition`, l.448-451). So `payload[0]` is the hovered segment only: `name`, `value`, `dataKey`, `color` (the Bar's fill), and `payload` (the data row).
- The cursor band does not render in item mode (`lib/component/Cursor.js:45`), which is what we want.

**`activeBar` does NOT help in item mode.** It only renders when `activeTooltipIndex >= 0` (l.1419-1433). Item mode never sets that index (initial state `-1`, l.568). To highlight the hovered segment, keep your own state. The Bar's own `onMouseEnter` still fires, because the handlers are combined, and it receives `(entry, index, event)` (`adaptEventsOfChild`, `lib/util/types.js:119`):

```tsx
const [hot, setHot] = useState<{ key: string, index: number } | null>(null)
// per segment series:
<Bar dataKey="electric" stackId="now" name="Electric" fill="var(--chart-1)" isAnimationActive={false}
  shape={<GapRect />}
  onMouseEnter={(_, index) => setHot({ key: 'electric', index })} onMouseLeave={() => setHot(null)}>
  {rows.map((_, i) => <Cell key={i} fillOpacity={hot && !(hot.key === 'electric' && hot.index === i) ? 0.35 : 1} />)}
</Bar>
<Tooltip shared={false} content={<SegmentTooltip />} />

function SegmentTooltip({ active, payload }: TooltipProps<number, string>) {
  const seg = payload?.[0]
  if (!active || !seg) return null
  return <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">{`${seg.name} · ${formatAsDollars(Number(seg.value))}/mo`}</div>
}
```

**Paired stacks per x.** Give each stack its own `stackId` (`stackId="now"` on the "Upgrade now" series, `stackId="wait"` on the "Wait and replace" series). Recharts lays out one bar group per `stackId` inside each category. Control spacing with the chart-level `barGap` (between the two stacks) and `barCategoryGap` (between years), plus `maxBarSize` (`types/chart/generateCategoricalChart.d.ts:67-70`). A series that appears in both scenarios needs two `<Bar>`s with different `dataKey`s (e.g. `nowElectric`, `waitElectric`), because a Bar belongs to exactly one stack.

**Hatched segment.** Put a **literal `<defs>`** as a direct child of the chart. `renderByOrder` passes through children whose `type` is a string in `SVG_TAGS` (`lib/util/ReactUtils.js:156-158,285-287`, `defs`/`pattern` included). ⚠️ A wrapper component such as `<HatchDefs />` is **silently dropped**: it is not an SVG tag and not in `renderMap`. Either inline the JSX or render it through `<Customized component={…} />`. Make ids unique per chart with `useId()`. React 19.2 produces `_R_…_` ids (`react-dom-client.development.js:9055-9062`), which are safe inside `url(#…)`, unlike React 18's `:r1:`.

```tsx
const hatchId = `hatch-${useId()}`
<BarChart …>
  <defs>
    <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--chart-2)" fillOpacity={0.18} />
      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-2)" strokeWidth="2" />
    </pattern>
  </defs>
  <Bar dataKey="waitReplacement" stackId="wait" fill={`url(#${hatchId})`} … />
```

In item mode, `seg.color` for that series is the `url(#…)` string. Pass an explicit swatch colour into the custom tooltip and legend rather than using `seg.color`.

**2px gap between segments.** Recharts has no segment-gap prop. Use a custom `shape` that insets each rectangle (`Rectangle` is exported, `types/index.d.ts:29`). In 2.15.4 a positive value has `y` at its top and a positive `height` (`Bar.js:396-399`):

```tsx
const GAP = 2
function GapRect(props: RectangleProps) {
  const { y = 0, height = 0 } = props
  return <Rectangle {...props} y={y + GAP} height={Math.max(0, height - GAP)} />
}
```

This takes 2px off the top of every segment, including the top one. That is fine visually at these magnitudes. The cheaper alternative is `stroke="var(--card)" strokeWidth={2}` on every Bar: it draws a gap in the card colour, but it also eats 1px from the outer edges and breaks on hatched fills. Set `isAnimationActive={false}` or keep the default. Either works with `shape`.

### 2. Line annotations and a zero-split area

- **Marked point:** `<ReferenceDot x={breakEvenYear} y={value} r={5} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} ifOverflow="extendDomain" label={{ value: 'Pays for itself', position: 'top', fill: 'var(--foreground)', fontSize: 12 }} />`. `x` must equal the category value on a category axis. Label positions: `types/component/Label.d.ts:4`.
- **Vertical marker:** `<ReferenceLine x={year} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: 'Loan paid off', position: 'insideTopRight' }} />`.
- **Shaded x-band:** `<ReferenceArea x1={3} x2={7} fill="var(--chart-1)" fillOpacity={0.08} ifOverflow="hidden" label={{ value: 'Loan years', position: 'insideTop' }} />`. On a BarChart (band scale) it covers the whole bands. On a LineChart (point scale) it runs point to point. Render it before the `<Line>`s, or leave `isFront` false (the default), so it sits behind them.
- **Crosshair breakdown:** keep the default `shared` (axis) tooltip on LineChart. `cursor={{ stroke: 'var(--border)' }}` draws the vertical crosshair. A custom `content` reads every series from `payload` (same pattern as `TrendTooltip`). Add `activeDot={{ r: 4 }}` per Line.
- **Area above/below zero: use the gradient-offset trick with a hard stop, not two split Areas.** Splitting into `max(v,0)`/`min(v,0)` series is wrong whenever the sign flips between two samples. Each half is drawn to the next point's clamped 0, not to the real crossing, so the shape bends at the wrong x. The recharts site's current `AreaChartFillByValue` uses `useYAxisScale`/`useChartHeight`. Those are **v3 hooks and are absent from 2.15.4** (`types/index.d.ts` exports no hooks). For 2.x, compute the offset from the data (objectBoundingBox):

```tsx
const max = Math.max(...vals), min = Math.min(...vals)
const off = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min)
<defs><linearGradient id={splitId} x1="0" y1="0" x2="0" y2="1">
  <stop offset={off} stopColor="var(--success)" stopOpacity={0.25} />
  <stop offset={off} stopColor="var(--destructive)" stopOpacity={0.25} />
</linearGradient></defs>
<Area type="monotone" dataKey="net" fill={`url(#${splitId})`} stroke={`url(#${strokeId})`} baseValue={0} />
```

This holds because the area's bounding box spans exactly [min, max] once the data crosses 0 (baseline 0). `monotone` never overshoots, so the path extremes equal the data extremes. Do not use `natural`/`basis`. Use a second gradient with opacity 1 for the stroke. Edge case: a perfectly flat line has a zero-height bbox, so objectBoundingBox gradients do not paint (SVG spec). If that can happen, use `gradientUnits="userSpaceOnUse"` with `y` from the axis scale. `<Customized component={Fn} />` receives the chart's props and state, including `yAxisMap` and `offset` (`generateCategoricalChart.js:1471-1475`): `const s = Object.values(yAxisMap)[0].scale; s(0)`.

### 3. Theme colours

- Keep the precedent: pass `var(--token)` straight into SVG presentation props (`fill`, `stroke`, `stopColor`). It already ships in both charts and switches with `.dark` because the variables are redefined under `.dark` (globals.css:252). Tailwind also exposes `--color-chart-1..5` (globals.css:346-350).
- ⚠️ **The chart tokens are a single-hue blue ramp, and they are identical in light and dark.** `--chart-1..5` have hue ≈251-260 and L 0.62→0.93 in both `:root` (l.50-54) and `.dark` (l.292-296). They are sequential, not categorical. `--chart-4/5` (L 0.88/0.93) have almost no contrast on the light `--card` (white). For segments that must be told apart (Electric/Gas/Water…), do not use `chart-1..5` as categories. Either ask the owner for a categorical set of `--chart-*` tokens with dark overrides (a new token = owner call, `feedback-domain-vocabulary-before-naming`), or use `chart-1` plus hatch/opacity steps and the semantic `--success`/`--destructive`/`--warning`/`--muted-foreground`, which do have dark values.
- Do not add shadcn `chart.tsx` just for colours. Its `ChartContainer` only injects `--color-<key>` variables from a config, and it would be a new shared file (scope rule). The raw-recharts precedent covers everything above.

### 4. Tailwind v4 container queries (4.1.18, verified in `dist/lib.js`)

- `@container` → `container-type: inline-size`. `@container/name` also sets `container-name: name`. `@container-normal` and `@container-[size]` exist too.
- Variants: `@min-{size}` / `@{size}` → `@container (width >= X)`; `@max-{size}` → `(width < X)`; with `/name` → `@container name (…)`. Arbitrary values: `@max-[40rem]/story:`. Stackable ranges: `@sm:@max-md:`. Sizes come from `--container-*` (`theme.css:285-297`, `3xs` 16rem … `7xl` 80rem). The repo already uses `@max-[30rem]/presentation:` and `@min-[600px]:`.
- An element cannot query itself. Declare the container on the **canvas** (the element whose width changes when the inputs panel collapses), not on the sticky bar:

```tsx
<div ref={canvasRef} className="@container/story min-h-0 overflow-y-auto scroll-pt-(--bar-h)" style={{ '--bar-h': '3.5rem' } as CSSProperties}>
  <header className="sticky top-0 z-10 flex h-(--bar-h) items-center gap-3 bg-background/90 backdrop-blur">
    <span className="@max-2xl/story:hidden">Long label</span>
    <span className="hidden @max-2xl/story:inline">Short</span>
  </header>
```

### 5. Scroll-spy inside the nested scroller

- **Make the story canvas its own scroller.** Use a `h-full` grid inside `TabsContent`, with the canvas `min-h-0 overflow-y-auto`, so the inputs panel scrolls on its own and the observer root is the canvas. `sticky top-0` sticks to the nearest scrolling ancestor, which is then the canvas.
- Use motion's `useInView(ref, { root: canvasRef, margin })`, the repo precedent (`slide.tsx:44`); `root` is a `RefObject<Element | null>` (`framer-motion/dist/types/index.d.ts:1335-1339`). A raw `IntersectionObserver({ root: canvasEl, rootMargin })` works the same way. **Margin:** `'-40% 0px -59% 0px'` gives a 1%-high line 40% down the canvas, so exactly one chapter owns it even when chapters are taller than the screen. That is the same idea as the presentation's centre line `'-50% 0px -50% 0px'`, which fixed a stale-band bug there. Percentages resolve against the root. Report `(index, inView)` up to the rail and keep the last true index.
- **Scroll offset under the sticky bar:** set `scroll-pt-(--bar-h)` on the scroller and **`scroll-mt-0` on each chapter**. Otherwise the global `* { scroll-margin-top: 80px }` adds 80px on top of the padding. `scroll-mt-0` is enough because `@layer utilities` beats `@layer base`. Inline `style={{ scrollMarginTop: 0 }}` is also safe against `cn` merges (the slide.tsx reason). Prefer padding on the scroller over margin on the chapter: WebKit bug 323808 ("`scroll-margin` is not applied in scroll container coordinate space"), cited in `2026-09-13-meeting-flow-keyboard-focus-research.md:89`.
- **Rail click:** `el.scrollIntoView({ block: 'start', behavior: reduce ? 'instant' : 'smooth' })`, where `reduce = matchMedia('(prefers-reduced-motion: reduce)').matches` is read at click time. Pass `behavior` explicitly. With `'auto'` the global `scroll-behavior: smooth` makes it smooth even under reduced motion (CSSOM "perform a scroll", cited in the same research note:82). TS 5.9 `ScrollBehavior` includes `'instant'` (lib.dom.d.ts:39401). Do not gate on motion's `useReducedMotion()`: it captures the value once (same note:84). `scrollIntoView` scrolls every scrolling ancestor. Here the outer `TabsContent` has nothing to scroll, but if the page shell scrolls you'll see it move; the fallback is `canvas.scrollTo({ top: rectDelta + canvas.scrollTop - barH, behavior })` (the `slide-scroll-top.ts` recipe).
- Rail state during a programmatic scroll: set the active index on click and ignore observer reports until `scrollend` (or a 600ms timeout) so the dots don't flicker through intermediate chapters. `scrollend` support in Safari is unverified.

### 6. Collapsible side panel

Present in `src/shared/components/ui`: `accordion`, `collapsible`, `resizable`, `sheet`, `sidebar`, `drawer`, `scroll-area`, `tabs`.
- **`sidebar.tsx` — no.** It is the app shell: it writes the `sidebar_state` cookie (l.29,88) and binds a global ⌘/Ctrl+B `keydown` (l.34,102-110). A second `SidebarProvider` would share both.
- **`collapsible.tsx` — only for the open state and ARIA wiring.** Its `AnimatedCollapsibleContent` animates **height** (`COLLAPSE_HEIGHT_VARIANTS`, `constants/motion.ts:18-22`), not width.
- **`resizable.tsx` (react-resizable-panels 3.0.6) — possible but unused anywhere in `src`.** Panels support `collapsible`, `collapsedSize`, `onCollapse`/`onExpand` and an imperative `collapse()/expand()/isCollapsed()` (`Panel.d.ts`). Sizes are percentages, and it adds a drag handle nobody asked for.
- **Recommended:** a CSS grid whose first track toggles, driven by a boolean. `grid-cols-[minmax(0,22rem)_minmax(0,1fr)]` ↔ `grid-cols-[0_minmax(0,1fr)]`, with `transition-[grid-template-columns] motion-reduce:transition-none`, plus `inert` and `aria-hidden` on the collapsed panel and an `aria-expanded`/`aria-controls` toggle button in the sticky bar. On narrow widths (`@max-3xl/…` or below `lg`), render the same inputs inside `Sheet side="left"` (sheet.tsx:51-70 supports `left`). React context crosses the portal, so RHF `FormProvider` still works. The fields leave the DOM `<form>`, which is harmless here (`noValidate`, submit prevented). Use `accordion` inside the panel for the input groups if they need collapsing. While the width animates, `ResponsiveContainer` re-measures every frame. Pass `debounce={50}` (`types/component/ResponsiveContainer.d.ts:14`) or disable chart animation.

## Unverified

- The browser behaviour of item-mode tooltips on touch (iPad). Taps fire compat `mouseenter` in WebKit, so the tooltip should open. With `trigger="click"`, item mode only binds `onClick → handleItemMouseEnter` (l.1402-1405) and never closes. The robust touch path is the own-state `hot` segment above, driving an HTML readout. Needs a device test.
- `grid-template-columns` interpolation between `0` and `minmax(0,22rem)` in Safari (the spec allows it when track counts match). Test before committing, or fall back to animating the panel's `width`.
- `scrollend` event support in Safari. BCD was not checked.
- The zero-height-bbox gradient failure is from the SVG spec's objectBoundingBox rule. It was not reproduced in a browser.
- The pixel output of `GapRect` for negative values (not needed if every stacked value is ≥ 0).

## Sources

- recharts 2.15.4, installed: `lib/chart/generateCategoricalChart.js` (l.221-243, 568, 964-986, 1258-1289, 1377-1433, 1471-1475, 1669-1676, 1750-1772), `lib/chart/BarChart.js:19-20`, `lib/cartesian/Bar.js:82-110,396-451`, `lib/util/ChartUtils.js:1058-1080`, `lib/util/ReactUtils.js:156-158,282-301`, `lib/util/types.js:119`, `lib/component/Cursor.js:45`, `types/component/Tooltip.d.ts`, `types/cartesian/{Bar,Area,ReferenceArea,ReferenceLine,ReferenceDot}.d.ts`, `types/component/{Label,Customized,ResponsiveContainer}.d.ts`, `types/index.d.ts`.
- Recharts docs via context7 `/websites/recharts_github_io`: https://recharts.github.io/examples/AreaChartFillByValue (the v3 hook version, used here only to confirm the split-gradient technique).
- Tailwind 4.1.18, installed: `dist/lib.js` (`@container`, `@min`, `@max`, `@` variants), `theme.css:285-297`. Docs via context7 `/websites/tailwindcss`: https://tailwindcss.com/docs/responsive-design (container queries).
- motion 12.31.0: `framer-motion/dist/types/index.d.ts:564-569,1335-1339`. React 19.2.4: `react-dom/cjs/react-dom-client.development.js:9055-9062`. TypeScript 5.9.3: `lib/lib.dom.d.ts:39401`. react-resizable-panels 3.0.6: `dist/declarations/src/Panel.d.ts`.
- Repo: `src/app/(frontend)/globals.css` (l.4, 50-54, 252, 292-296, 346-350, 594-599), `src/shared/components/presentation/slide.tsx`, `slide-scroll-top.ts`, `src/shared/components/ui/{collapsible,resizable,sheet,sidebar}.tsx`, `src/shared/constants/motion.ts`, `docs/plans/2026-09-13-meeting-flow-keyboard-focus-research.md` (l.82-89: CSSOM View, WebKit 323808).
