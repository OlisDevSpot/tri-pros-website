# Remodel ROI Calculator Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stale chart tooltips (mouse and touch), move every chart onto recharts 3 with the shadcn `chart` component, stop the heavy fake-looking bold, and ship the owner's new default rate rises.

**Architecture:** Recharts 3 keeps tooltip state in a store that a data change never resets. That removes the root cause of the stuck item tooltips, and its `shape` `isActive` flag replaces our hand-made hover state. Every chart sits in shadcn's `ChartContainer` with a `ChartConfig`. `ChartTooltipCard` stays the single tooltip content, and `usePinnedChartTooltip` stays the touch layer. The two hand-rolled HTML charts become recharts charts. Type weight comes from one base rule and a lint ban, not from per-component patches.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn/ui (`components.json`, alias `@/shared/components/ui`), recharts `^3.10.1`, Playwright (local regression scripts), `tsx` goldens.

**Spec:** the owner's rulings are **R18** in `docs/plans/2026-09-26-sales-calculators-epic.md`, with **D4** and **I4** closed. Read R18 before any task.

## Global Constraints

- recharts is pinned to `^3.10.1` in `package.json`. The shadcn CLI writes `3.8.0`, so re-pin after running it.
- The recharts 3 install and the migration of all 8 existing recharts files land in **one commit** (Task 2), so `main` never fails `pnpm tsc`.
- `package.json` has another session's uncommitted edit (`db:snapshot` → `db:refresh:dev`). Stage **only our hunk** with `git add -p package.json`, never the whole file. `pnpm-lock.yaml` is staged whole.
- Commit by explicit path only. Never `git add -A`, `git stash`, `git reset` or `--amend`. Other sessions commit to `main` at the same time.
- **Do not commit until the owner says to.** The commit steps below are prepared, not auto-run: stop at each and ask.
- Gates: `pnpm tsc`, `pnpm exec eslint <touched paths>`, `pnpm tsx scripts/verify-remodel-roi.ts`. **Never `pnpm build`.**
- Dev server: check `ss -ltnp` first and use the server that is already up (port 3000 today). **Never kill or restart another session's server, and never clear `.next`.**
- Weights: Syne **500/600 only**. Nunito **400** body, **600** labels and UI emphasis, **700** eyebrows and tooltip values. **No 800 or 900 anywhere.** Chart SVG labels are Nunito 600 with no stroke halo.
- Rates: electric **7.57**, water **8.9**, gas **9.1** %/yr. Provenance: the team's estimate from thousands of customer bills analysed over the years.
- Colours: the app's palette only (R16.6). Paths are `--primary` (Upgrade now) and `--warning` (Wait and replace). Bills use Tailwind yellow/sky/violet/emerald-600 and `--muted-foreground`.
- Comments say why, never what, and never cite plans or specs (CLAUDE.md).
- **Conventions the code blocks below already follow; keep them when adapting.**
  - No constant at the top of a component file (Rule 2). A static `ChartConfig` lives in `constants/`: the ROI charts' configs in `remodel-roi-calculator/constants/chart-configs.ts` (one `*_CHART_CONFIG` export per chart), the bills config in `constants/bill-colors.ts`, and the lead-source one in `lead-sources-admin/constants/trend-chart-config.ts`. A config derived from props (`trend-bars`) is built inside the component.
  - One component per file, with an `interface Props` (Rules 1, 5). The file name matches the component.
  - Every file that calls a hook starts with `'use client'`, like the existing chart files.
  - Pure derivations (row building, sums, scales) live in `lib/`, and their row types in `types/index.ts` (Rules 7, 25). Components only render.
  - Each series' label and colour has one source: its `ChartConfig`. `LegendSwatches` reads the config; nothing restates a label or colour next to it.

## Review Focus

1. **Touch, second tap on another point:** each tap shows *that* point's tooltip. Today a second tap on a line chart shows an empty tooltip (measured 2026-09-29). Pinned by `charts.cjs touch` in Task 2.
2. **Tap outside a pinned chart:** the tooltip and the segment dimming both clear. Pinned by the `unpinned` check in `charts.cjs touch`, Task 2.
3. **Hover across stacked segments in the same bar:** each segment shows its own tooltip, and only that segment stays undimmed. Pinned by `charts.cjs mouse` (distinct count equals hovered count) in Task 2, plus a screenshot step.
4. **A trade with no replacement inside the look-ahead, and a job with no negative return parts:** `cost-of-waiting` renders nothing (as today) and the waterfall has no negative bars and no crash. Pinned by the `buildCostOfWaiting` / `buildReturnWaterfall` goldens in `verify-remodel-roi.ts` (Tasks 3–4), plus Task 3 Step 6 and Task 4 Step 6 on screen.
5. **`<b>` inside semibold text anywhere in the app** no longer escalates to 900. Pinned by `fonts.cjs` in Task 5, and by the base rule applying app-wide.

---

## Regression scripts (already written, local only)

These live in the gitignored `.superpowers/sdd/2026-09-29-remodel-roi-fixes/` and only read from the dev server:

- `open-story.cjs`: logs in through `/api/dev/playwright-session` and fills the smoke's inputs (HVAC 15 years old, Attic & Basement, $32,000, electric $380, gas $90).
- `charts.cjs [port] [mouse|touch]`: for each chart in the today, monthly (both views), waiting, value and total chapters:
  - Bar charts: hovers or taps every segment. Each segment must show its own non-empty tooltip.
  - Line and area charts: the first and last x positions must differ.
  - Touch also requires a tap outside the chart to clear the tooltip.
  - A chapter with no recharts chart fails.
  - Exit code 0 means pass.
- `fonts.cjs [port]`: fails if any text renders above 700, or Syne above 600.

Baseline on 2026-09-29 (all failing):

| Check | Result |
|---|---|
| `charts.cjs mouse` | today 1 distinct of 6 segments; breakdown 1 of 7; waiting has no recharts chart |
| `charts.cjs touch` | the same, plus an empty tooltip on the second tap of every line and area chart |
| `fonts.cjs` | Syne 900 `<b>` ×10, Syne 800 ×1, Nunito 800 ×16 |

---

### Task 1: New default rate rises, with goldens

**Files:**
- Modify: `src/features/calculators/remodel-roi-calculator/constants/config-defaults.ts:5-6`
- Modify: `scripts/verify-remodel-roi.ts` (the 13 lines listed below)
- Modify: `docs/plans/2026-09-26-remodel-roi-calculator-fields-handoff.md:139,205`

**Interfaces:**
- Consumes: nothing.
- Produces: `REMODEL_ROI_CONFIG_DEFAULTS.defaultRatesPercent = { electric: 7.57, water: 8.9, gas: 9.1, gardening: 5, misc: 0 }`.

- [ ] **Step 1: Update the goldens first (the failing test).** In `scripts/verify-remodel-roi.ts`, change exactly these, measured 2026-09-29 by running the script against the new rates:

| Line (today) | Old | New |
|---|---|---|
| 115 `A +10 yrs (pinned)` | `26733.45` | `23379.77` |
| 116 `A +20 yrs (pinned)` | `123385.65` | `95699.35` |
| 124 `D milestones (pinned)` | `{ paysForItselfYear: 8, costsLessMonthlyYear: 10, payoffYear: 15 }` | `{ paysForItselfYear: 8, costsLessMonthlyYear: 12, payoffYear: 15 }` |
| 125 `D +20 yrs (pinned)` | `32606.77` | `30805.51` |
| `B +10 yrs` | `27492.19` | `24138.33` |
| 135 `C milestones` | `{ paysForItselfYear: 10, costsLessMonthlyYear: 14, payoffYear: 15 }` | `{ paysForItselfYear: 10, costsLessMonthlyYear: 16, payoffYear: 15 }` |
| `C +10 yrs` | `2155.61` | `272.54` |
| 163 `cash A +10 yrs (pinned)` | `39218.93` | `35865.25` |
| 175 `costs less monthly only from the year it stays cheaper` | `7` | `9` |
| 192 `blank rate → working` | `{ value: 9.4, source: 'working' }` | `{ value: 7.57, source: 'working' }` |
| 268 `A headline figures` | `['Year 3', 'Year 4', '+$27,000']` | `['Year 3', 'Year 4', '+$23,000']` |
| 269 `the look-ahead moves only the amount` | `['Year 3', 'Year 4', '+$123,000']` | `['Year 3', 'Year 4', '+$96,000']` |
| 271 `A monthly answer` | `… $266 less by year 10.'` | `… $196 less by year 10.'` (rest unchanged) |

Line numbers can drift; find each check by its message string.

- [ ] **Step 2: Run it and confirm it fails.**

Run: `pnpm tsx scripts/verify-remodel-roi.ts`
Expected: an `AssertionError` on `A +10 yrs (pinned)` (expected 23379.77, got 26733.45).

- [ ] **Step 3: Change the defaults.** In `config-defaults.ts`, replace lines 5–6 with:

```ts
  // The team's estimate from thousands of customer bills analysed over the years; they stay visible and editable on screen.
  defaultRatesPercent: { electric: 7.57, water: 8.9, gas: 9.1, gardening: 5, misc: 0 },
```

- [ ] **Step 4: Run the goldens.**

Run: `pnpm tsx scripts/verify-remodel-roi.ts`
Expected: `✅ verify-remodel-roi: all checks passed`. If a value differs in the last decimal from the table, the tolerance on `near` is 0.01; use the printed value.

- [ ] **Step 5: Update the handoff's defaults lines.** At `:139`, change `source rates 9.4 / 13.1 / 10.3` to `rates 7.57 / 9.1 / 8.9 (team bill analysis, R18.8)`. At `:205`, change `rates 4 / 9.4 / 13.1 / 10.3 / 5 / 0` to `rates 4 / 7.57 / 9.1 / 8.9 / 5 / 0`. Leave `:57` and `:164` alone: they describe the historical worked run on the old source's numbers.

- [ ] **Step 6: Gates.**

Run: `pnpm tsc && pnpm exec eslint src/features/calculators scripts/verify-remodel-roi.ts`
Expected: no errors.

- [ ] **Step 7: Commit (ask the owner first).**

```bash
git add src/features/calculators/remodel-roi-calculator/constants/config-defaults.ts scripts/verify-remodel-roi.ts docs/plans/2026-09-26-remodel-roi-calculator-fields-handoff.md
git commit -m "feat(calculators): default rate rises 7.57 / 8.9 / 9.1 from the team's bill analysis

Goldens moved (old -> new): A +10y 26733.45 -> 23379.77, A +20y 123385.65 -> 95699.35,
D costs-less 10 -> 12, D +20y 32606.77 -> 30805.51, B +10y 27492.19 -> 24138.33,
C costs-less 14 -> 16, C +10y 2155.61 -> 272.54, cash A +10y 39218.93 -> 35865.25,
flip-back costs-less 7 -> 9, headline +\$27,000 -> +\$23,000 (10y), +\$123,000 -> +\$96,000 (20y),
monthly answer \$266 -> \$196 less by year 10.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: recharts 3 + shadcn `chart`, all 8 recharts files migrated

One commit, because the install breaks `tsc` until every file is migrated.

**Files:**
- Modify: `package.json` (recharts only), `pnpm-lock.yaml`
- Create: `src/shared/components/ui/chart.tsx` (shadcn CLI, plus a `debounce` pass-through)
- Modify: `src/shared/hooks/use-pinned-chart-tooltip.ts`
- Modify: `src/shared/components/charts/legend-swatches.tsx` (reads a `ChartConfig`)
- Create: `src/features/calculators/remodel-roi-calculator/constants/chart-configs.ts`
- Modify: `src/features/calculators/remodel-roi-calculator/constants/bill-colors.ts`
- Modify: `src/features/calculators/remodel-roi-calculator/ui/components/charts/segment-rect.tsx`
- Modify: `…/charts/bills-by-category-chart.tsx`, `…/charts/monthly-breakdown-chart.tsx`, `…/charts/monthly-trend-chart.tsx`, `…/charts/home-value-chart.tsx`, `…/charts/pay-for-itself-chart.tsx`, `…/charts/monthly-cost-chart.tsx` (legend only)
- Modify: `src/features/analytics/ui/components/report/trend-bars.tsx`, `…/report/trend-axis.tsx`
- Modify: `src/features/lead-sources-admin/ui/components/lead-source-trend-chart.tsx`
- Create: `src/features/lead-sources-admin/constants/trend-chart-config.ts`, `src/features/lead-sources-admin/ui/components/lead-source-trend-tooltip.tsx` (the `TrendTooltip` that today sits as a second component in the chart file, Rule 1), `src/features/lead-sources-admin/types/index.ts` (`TrendPoint`)
- Modify: `src/features/lead-sources-admin/ui/components/analytics-content.tsx` (imports `TrendPoint` instead of redeclaring it)
- Test: `.superpowers/sdd/2026-09-29-remodel-roi-fixes/charts.cjs` (mouse and touch)

**Interfaces:**
- Produces:
  - `ChartContainer`, `ChartConfig`, `ChartTooltip` from `@/shared/components/ui/chart`. `ChartContainer` also takes `debounce?: number`, forwarded to its `ResponsiveContainer`.
  - `SegmentRect(props: BarShapeProps & { fill: string })`: dims itself while any tooltip is active and it isn't the active segment.
  - `LegendSwatches({ config, keys }: { config: ChartConfig, keys?: readonly string[] })`: one swatch per key (default: every key), coloured from `config[key].color`, labelled `config[key].label`.
  - `usePinnedChartTooltip()`: unchanged API, `{ pinned, containerProps, tooltipActive }`.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Confirm the failing baseline.**

Run: `ss -ltnp | grep -E ':300[0-9]'`, then `node .superpowers/sdd/2026-09-29-remodel-roi-fixes/charts.cjs 3000 mouse; echo $?`
Expected: exit 1. `roi-chapter-today#0` shows distinct 1 of 6, and `roi-chapter-monthly#breakdown` shows distinct 1.

- [ ] **Step 2: Install.**

```bash
pnpm dlx shadcn@latest add chart
pnpm add recharts@^3.10.1
git diff package.json
```

Expected: the diff shows the recharts line at `^3.10.1`, plus the other session's `db:refresh:dev` hunk, which you **leave unstaged**. `src/shared/components/ui/chart.tsx` exists. If the CLI asks to overwrite any existing file, answer **no**.

Then run `git diff --stat -- "src/app/(frontend)/globals.css" components.json`. The CLI may add chart colour variables; if it changed either file, revert only its hunks there (`git checkout -p -- <file>`, answering `y` only to the CLI's hunks) and note it at the checkpoint. The app's `--chart-*` variables already exist.

Then give `ChartContainer` a `debounce?: number` prop and pass it to its `RechartsPrimitive.ResponsiveContainer`. Every ROI chart passes `debounce={150}`, as it does today: collapsing the inputs panel otherwise redraws each chart on every animation frame.

- [ ] **Step 3: See the breakage.**

Run: `pnpm tsc 2>&1 | grep -c "error TS"`
Expected: errors in the 8 recharts files. Note the count.

- [ ] **Step 4: `SegmentRect` reads recharts' own active state.** Replace `segment-rect.tsx` with:

```tsx
'use client'

import type { BarShapeProps } from 'recharts'

import { useIsTooltipActive } from 'recharts'

import { cn } from '@/shared/lib/utils'

type Props = BarShapeProps & {
  fill: string
}

// Passed as a <Bar> shape function; recharts hands each segment its geometry and whether it is the active one.
// recharts has no gap prop between stacked segments, so each segment insets itself by 1px top and bottom.
export function SegmentRect({ fill, x, y, width, height, isActive }: Props) {
  const anyActive = useIsTooltipActive()
  const inset = height > 3 ? 1 : 0
  return (
    <rect
      className={cn('transition-opacity', anyActive && !isActive && 'opacity-40')}
      height={Math.max(0, height - inset * 2)}
      style={{ fill }}
      width={width}
      x={x}
      y={y + inset}
    />
  )
}
```

- [ ] **Step 4b: `LegendSwatches` reads the config.** Replace its `items` prop with `config: ChartConfig` and optional `keys?: readonly string[]` (default `Object.keys(config)`). Each swatch keeps its `<i aria-hidden className="inline-block h-1 w-3.5 rounded-sm">` and gets `style={{ background: config[key].color }}`; the text is `config[key].label`, and the React key is the config key. Its four callers are all ROI charts, migrated in Steps 5–7.

- [ ] **Step 4c: The ROI chart configs.** Create `constants/chart-configs.ts` with one `satisfies ChartConfig` export per chart. Colours are CSS colours, not classes, and each matches today's legend swatch exactly (`bg-muted-foreground/35` → `color-mix(in oklab, var(--muted-foreground) 35%, transparent)`, `bg-warning/40` → the same mix at 40%):

```ts
import type { ChartConfig } from '@/shared/components/ui/chart'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'

export const PATHS_CHART_CONFIG = {
  now: { label: STORY_COPY.paths.now, color: 'var(--primary)' },
  wait: { label: STORY_COPY.paths.wait, color: 'var(--warning)' },
} satisfies ChartConfig

export const MONTHLY_TREND_CHART_CONFIG = {
  monthlyNow: PATHS_CHART_CONFIG.now,
  monthlyWait: PATHS_CHART_CONFIG.wait,
} satisfies ChartConfig

export const HOME_VALUE_CHART_CONFIG = {
  valueNow: PATHS_CHART_CONFIG.now,
  valueWait: PATHS_CHART_CONFIG.wait,
} satisfies ChartConfig

export const PAY_FOR_ITSELF_CHART_CONFIG = {
  benefit: { label: 'Ahead of waiting', color: 'var(--primary)' },
} satisfies ChartConfig

export const MONTHLY_BREAKDOWN_CHART_CONFIG = {
  nowBills: { label: 'Bills', color: 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)' },
  nowLoan: { label: 'Project loan', color: 'var(--primary)' },
  waitBills: { label: 'Bills', color: 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)' },
  waitRepairs: { label: 'Repairs', color: 'color-mix(in oklab, var(--warning) 40%, transparent)' },
  waitLoan: { label: 'Replacement loans', color: 'var(--warning)' },
} satisfies ChartConfig
```

Tasks 3 and 4 add `COST_OF_WAITING_CHART_CONFIG` and `RETURN_BREAKDOWN_CHART_CONFIG` to this file. `waitRepairs`'s colour is its legend swatch; its bar keeps the hatch pattern as an explicit `fill`.

- [ ] **Step 5: Migrate `monthly-breakdown-chart.tsx`.** Remove `useState`, `setActive`, `onMouseEnter`, `onMouseLeave` and the `onUnpin` option. Wrap the chart in `ChartContainer` and type the tooltip content with `TooltipContentProps`. The full component body:

```tsx
export function MonthlyBreakdownChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const hatchId = useId()
  const tooltip = usePinnedChartTooltip()
  const used = BILL_CATEGORIES.filter(category => projection.cuts[category].bill > 0)
  const data = projection.years.slice(1, lookAhead + 1).map(year => ({
    t: year.t,
    nowBills: year.billsAfter,
    nowLoan: year.projectPayment,
    waitBills: year.billsNow,
    waitRepairs: year.repairsMonthly,
    waitLoan: year.replacementPayments,
  }))
  const segments: { key: SegmentKey, stack: 'now' | 'wait', fill: string }[] = [
    { key: 'nowBills', stack: 'now', fill: 'var(--color-nowBills)' },
    { key: 'nowLoan', stack: 'now', fill: 'var(--color-nowLoan)' },
    { key: 'waitBills', stack: 'wait', fill: 'var(--color-waitBills)' },
    { key: 'waitRepairs', stack: 'wait', fill: `url(#${hatchId})` },
    { key: 'waitLoan', stack: 'wait', fill: 'var(--color-waitLoan)' },
  ]
  const content = ({ active, payload }: TooltipContentProps<number, string>) => {
    const item = payload?.[0]
    if (!active || !item) {
      return null
    }
    const key = item.dataKey as SegmentKey
    const year = projection.years[Number(item.payload.t)]
    const isNow = key.startsWith('now')
    const byCategory = isNow ? year.billsAfterByCategory : year.billsNowByCategory
    const rows = key === 'nowBills' || key === 'waitBills'
      ? used.map(category => ({ label: BILL_CATEGORY_LABELS[category], value: `${formatMoney(byCategory[category])}/mo`, swatch: BILL_SWATCH_CLASSES[category] }))
      : [{ label: MONTHLY_BREAKDOWN_CHART_CONFIG[key].label, value: `${formatMoney(Number(item.value))}/mo` }]
    return <ChartTooltipCard rows={[...rows, { label: 'Month total', value: formatMoney(isNow ? year.monthlyNow : year.monthlyWait) }]} title={`Year ${year.t} · ${isNow ? STORY_COPY.paths.now : STORY_COPY.paths.wait}`} />
  }

  return (
    <ChartContainer aria-label="Monthly cost by year and what makes it up, upgrade now next to wait and replace" className="aspect-auto h-72 w-full" config={MONTHLY_BREAKDOWN_CHART_CONFIG} debounce={150} role="img" {...tooltip.containerProps}>
      <BarChart barCategoryGap="18%" barGap={3} data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <pattern height="6" id={hatchId} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width="6">
            <rect fill="var(--warning)" fillOpacity={0.22} height="6" width="6" />
            <line stroke="var(--warning)" strokeWidth="2" x1="0" x2="0" y1="0" y2="6" />
          </pattern>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis axisLine={false} dataKey="t" tickFormatter={t => `Yr ${t}`} tickLine={false} />
        <YAxis axisLine={false} tickFormatter={value => formatMoney(Number(value))} tickLine={false} width={72} />
        <ChartTooltip active={tooltip.tooltipActive} content={content} cursor={false} shared={false} />
        {segments.map(segment => (
          <Bar
            dataKey={segment.key}
            isAnimationActive={!reduceMotion}
            key={segment.key}
            maxBarSize={30}
            name={MONTHLY_BREAKDOWN_CHART_CONFIG[segment.key].label}
            shape={props => <SegmentRect {...props} fill={segment.fill} />}
            stackId={segment.stack}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
```

Imports: add `import type { TooltipContentProps } from 'recharts'`, `import { ChartContainer, ChartTooltip } from '@/shared/components/ui/chart'` and `MONTHLY_BREAKDOWN_CHART_CONFIG` from `constants/chart-configs`. Drop `ResponsiveContainer`, `Tooltip` and `useState` from the imports. The axis `stroke` props go away because `ChartContainer` themes the tick text. The grid keeps `stroke="var(--border)"`: `ChartContainer` would otherwise draw it at `border/50`, lighter than today.

In `monthly-cost-chart.tsx`, the legend becomes `<LegendSwatches config={view === 'trend' ? MONTHLY_TREND_CHART_CONFIG : MONTHLY_BREAKDOWN_CHART_CONFIG} keys={…} />`. Trend keys: `['monthlyNow', 'monthlyWait']`. Breakdown keys: `nowBills`, then `nowLoan` if `projection.project.hasLoan`, then `waitRepairs`, then `waitLoan` if any shown year has `replacementPayments > 0` (the same conditions as today; `waitBills` is left out, since `nowBills` already says Bills).

- [ ] **Step 6: Migrate `bills-by-category-chart.tsx` the same way.**
  - In `constants/bill-colors.ts`, replace `BILL_FILL_CLASSES` with `BILL_CHART_CONFIG`, built from `BILL_CATEGORIES` and `BILL_CATEGORY_LABELS` so there's one source: `Object.fromEntries(BILL_CATEGORIES.map(category => [category, { label: BILL_CATEGORY_LABELS[category], color: BILL_COLORS[category] }])) as Record<BillCategory, { label: string, color: string }>`, where `BILL_COLORS` holds the colours: `electric: 'var(--color-yellow-600)'`, `water: 'var(--color-sky-600)'`, `gas: 'var(--color-violet-600)'`, `gardening: 'var(--color-emerald-600)'`, `misc: 'var(--muted-foreground)'`. Keep the file's why-comment on the hue order.
  - `BILL_SWATCH_CLASSES` stays: the tooltip rows use it. It is also what keeps Tailwind emitting `--color-yellow-600` and the rest, since v4 only emits theme variables a used class needs; say so in a comment above `BILL_COLORS`.
  - Check first that nothing else reads `BILL_FILL_CLASSES`: `grep -rn BILL_FILL_CLASSES src`.
  - The legend becomes `<LegendSwatches config={BILL_CHART_CONFIG} keys={used} />`.
  - Each `Bar` gets `shape={props => <SegmentRect {...props} fill={`var(--color-${category})`} />}`.
  - `ChartContainer` gets `debounce={150}`; the grid keeps `stroke="var(--border)"`.
  - Delete the `useState` block and the `onMouseEnter`/`onMouseLeave` props.
  - `LabelList` keeps `dataKey="total"` and `position="top"`, with `formatter={value => formatMoney(Number(value))}` (v3's `LabelFormatter` takes `RenderableText`).

- [ ] **Step 7: Migrate the line and area charts** (`monthly-trend-chart.tsx`, `home-value-chart.tsx`, `pay-for-itself-chart.tsx`):
  - Replace `ResponsiveContainer` + wrapper `div` with `ChartContainer` (same `aria-label`, `role="img"`, `{...tooltip.containerProps}`, `debounce={150}`, and `className="aspect-auto h-72 w-full"`, keeping each chart's own height).
  - Configs come from Step 4c: `MONTHLY_TREND_CHART_CONFIG`, `HOME_VALUE_CHART_CONFIG`, `PAY_FOR_ITSELF_CHART_CONFIG`. Lines use `stroke="var(--color-<dataKey>)"`, for example `stroke="var(--color-monthlyNow)"`. The pay-for-itself gradient stops keep their `var(--primary)` / `var(--warning)`: they split the fill at zero, not by series.
  - `home-value-chart`'s legend becomes `<LegendSwatches config={HOME_VALUE_CHART_CONFIG} keys={waits ? ['valueNow', 'valueWait'] : ['valueNow']} />`.
  - `Tooltip` → `ChartTooltip`, with the `content` function typed `({ active, label }: TooltipContentProps<number, string>)`.
  - Drop the axis `stroke` props. The grid keeps `stroke="var(--border)"`.
  - Leave the label `className`s in place. Task 5 owns weights.
  - v3 layers by JSX order, so keep each `ReferenceArea` before the lines and each `ReferenceDot`/`ReferenceLine` after them (the current order).

- [ ] **Step 8: Migrate analytics and lead sources.**
  - `trend-bars.tsx`:
    - Wrap in `ChartContainer` with `config` built inside the component from the `series` prop: `Object.fromEntries(series.map(key => [key, { label: METRICS[key].label, color: SERIES_COLORS[key].fill }]))`. The grid keeps its `stroke` and `strokeOpacity`.
    - `ChartContainer` renders its own `ResponsiveContainer`, so the `onResize` width measurement moves to a `ResizeObserver` on the outer `div` (`ref={measure}`), feeding the existing `plotWidth` state:

```tsx
const measure = useRef<HTMLDivElement>(null)
useLayoutEffect(() => {
  const el = measure.current
  if (!el) {
    return
  }
  const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width))
  observer.observe(el)
  return () => observer.disconnect()
}, [])
```

    - `onClick`: `activeTooltipIndex` is now `number | string | null | undefined`, so read it as `const index = chart?.activeTooltipIndex == null ? undefined : Number(chart.activeTooltipIndex)`, and use `rows[index]` when `index !== undefined`.
    - `Tooltip` → `ChartTooltip`, with the content typed `TooltipContentProps<number, string>`.
  - `trend-axis.tsx`: wrap in `ChartContainer config={{}}` with `className="aspect-auto w-full"`, `style={{ height }}`, and `aria-hidden`.
  - `lead-source-trend-chart.tsx`:
    - `ChartContainer` with `LEAD_SOURCE_TREND_CHART_CONFIG` from the new `lead-sources-admin/constants/trend-chart-config.ts`: `{ leads: { label: 'Leads', color: 'var(--foreground)' }, meetings: { label: 'Meetings', color: 'var(--muted-foreground)' }, signed: { label: 'Signatures', color: 'var(--chart-1)' } } satisfies ChartConfig`.
    - Lines use `stroke="var(--color-<key>)"` and `name={LEAD_SOURCE_TREND_CHART_CONFIG.<key>.label}`. The grid keeps its dashed `stroke`.
    - `TrendTooltip` moves to its own file, `lead-source-trend-tooltip.tsx`, as `LeadSourceTrendTooltip`, with `type Props = TooltipContentProps<number, string> & { bucket: Bucket }`. Its labels read from the config. `TrendPoint` is then used by three files (the chart, the tooltip, and `analytics-content.tsx`, which declares its own identical copy today), so it moves to a new `lead-sources-admin/types/index.ts` and all three import it.
    - `Legend` stays.

- [ ] **Step 9: The pinned hook on v3.** v3's `Tooltip` `active={true}` means "always displayed once an activeIndex is set". Keep the hook's API. Remove only the `onUnpin` option, which no caller uses after Steps 5–6. Then run the touch check:

Run: `pnpm tsc` (must be clean first), then `node .superpowers/sdd/2026-09-29-remodel-roi-fixes/charts.cjs 3000 touch; echo $?`

- If it passes, the hook is done.
- If the second-tap-empty case still fails: v3 selects on `touchmove` only and the tap's emulated `mouseleave` clears the item index. Control the index yourself:
  1. Add `const [index, setIndex] = useState<string | null>(null)` to the hook.
  2. Return `tooltipIndex: pinned ? index : undefined` and an `onChartClick: (state: MouseHandlerDataParam) => setIndex(state.activeTooltipIndex == null ? null : String(state.activeTooltipIndex))`.
  3. Each chart passes `onClick={tooltip.onChartClick}` to its chart root, and `defaultIndex={tooltip.tooltipIndex ?? undefined}` plus `active={tooltip.tooltipActive}` to `ChartTooltip`.
  4. Clear `index` on outside release, next to `setPinned(false)`.
  5. Re-run until it passes.

- [ ] **Step 10: The mouse check.**

Run: `node .superpowers/sdd/2026-09-29-remodel-roi-fixes/charts.cjs 3000 mouse; echo $?`
Expected: every chart except `roi-chapter-waiting` is `ok: true`. `roi-chapter-waiting` still fails until Task 3, and `roi-chapter-total#1` is absent until Task 4. Nothing else may fail.

- [ ] **Step 11: Look at it.** Take a screenshot of the monthly breakdown with the mouse on one segment of year 3's wait bar. Only that segment is at full opacity, and every other segment is at 40%. Compare the colours with the pre-migration screenshots in `.superpowers/sdd/2026-09-27-remodel-roi-calculator/shots/post-polish/`: they must match, in both light and dark, gridlines and legend swatches included.

- [ ] **Step 12: Analytics and lead sources still work.** With `/api/dev/playwright-session`, open `/dashboard/analytics` and `/dashboard/lead-sources` (then open one source's activity chart).
  - Hover two different buckets: each shows its own tooltip.
  - On analytics, double-click a bucket: it still zooms (`onBucket`).
  - The console shows no errors, and no `width(-1)` warnings.

- [ ] **Step 13: Gates.**

Run: `pnpm tsc && pnpm exec eslint src/shared/components/ui/chart.tsx src/shared/components/charts src/shared/hooks/use-pinned-chart-tooltip.ts src/features/calculators src/features/analytics/ui/components/report src/features/lead-sources-admin scripts/verify-remodel-roi.ts && pnpm tsx scripts/verify-remodel-roi.ts`
Expected: all clean. If eslint flags the generated `chart.tsx`, run `pnpm exec eslint --fix` on it only.

- [ ] **Step 14: Commit (ask the owner first).**

```bash
git add -p package.json   # stage only the recharts line
git add pnpm-lock.yaml src/shared/components/ui/chart.tsx src/shared/components/charts/legend-swatches.tsx src/shared/hooks/use-pinned-chart-tooltip.ts src/features/calculators/remodel-roi-calculator/ui/components/charts src/features/calculators/remodel-roi-calculator/constants/bill-colors.ts src/features/calculators/remodel-roi-calculator/constants/chart-configs.ts src/features/analytics/ui/components/report/trend-bars.tsx src/features/analytics/ui/components/report/trend-axis.tsx src/features/lead-sources-admin/ui/components/lead-source-trend-chart.tsx src/features/lead-sources-admin/ui/components/lead-source-trend-tooltip.tsx src/features/lead-sources-admin/ui/components/analytics-content.tsx src/features/lead-sources-admin/constants/trend-chart-config.ts src/features/lead-sources-admin/types/index.ts
git diff --cached --stat   # confirm no db:refresh:dev hunk and nothing from other sessions
git commit -m "feat(charts): recharts 3 and the shadcn chart container; item tooltips follow the pointer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `cost-of-waiting` on recharts

**Files:**
- Modify: `src/features/calculators/remodel-roi-calculator/types/index.ts` (`CostOfWaitingRow`, `CostOfWaitingTrade`, `CostOfWaiting`)
- Create: `src/features/calculators/remodel-roi-calculator/lib/build-cost-of-waiting.ts`
- Modify: `src/features/calculators/remodel-roi-calculator/constants/chart-configs.ts` (`COST_OF_WAITING_CHART_CONFIG`)
- Modify: `src/features/calculators/remodel-roi-calculator/ui/components/charts/cost-of-waiting-chart.tsx`
- Create: `src/features/calculators/remodel-roi-calculator/ui/components/charts/cost-of-waiting-rows.tsx`
- Modify: `scripts/verify-remodel-roi.ts` (goldens)
- Test: `charts.cjs` (mouse and touch), screenshots

**Interfaces:**
- Consumes: `ChartContainer`, `ChartTooltip`, `ChartConfig`, `SegmentRect` and the config-driven `LegendSwatches` (Task 2); `usePinnedChartTooltip`.
- Produces:
  - `buildCostOfWaiting(projection: RemodelRoiProjection): CostOfWaiting`.
  - `CostOfWaitingChart({ projection })`, same signature.
  - `CostOfWaitingRows({ trade, growth, max }: { trade: CostOfWaitingTrade, growth: number, max: number })`.

- [ ] **Step 1: Confirm the failing check.** `charts.cjs 3000 mouse` shows `roi-chapter-waiting: no recharts chart in this chapter`.

- [ ] **Step 2: The types.** Append to `types/index.ts`:

```ts
export interface CostOfWaitingRow {
  name: string
  year: number
  today: number
  price: number
  repairs: number
  total: number
}

export interface CostOfWaitingTrade {
  trade: AgingTradeKey
  label: string
  givesOutYear: number
  likeForLikePrice: number
  rows: CostOfWaitingRow[]
}

export interface CostOfWaiting {
  growth: number
  /** One scale for every trade, so their bars compare. */
  max: number
  trades: CostOfWaitingTrade[]
}
```

- [ ] **Step 3: The goldens first (failing).** In `verify-remodel-roi.ts`, next to the job A checks, add:

```ts
{
  const waiting = buildCostOfWaiting(run(JOB_A))
  const hvac = waiting.trades[0]
  assert.deepEqual(hvac.rows.map(row => row.name).slice(0, 2), ['Today', 'Year 3'], 'cost of waiting: today, then the year it gives out')
  near(hvac.rows[1].total, 18522 + 1891.5, 'cost of waiting: the give-out row adds the repairs until then')
  assert.ok(hvac.rows.slice(2).every(row => row.repairs === 0), 'cost of waiting: repairs only on the first give-out')
  assert.ok(waiting.trades.every(trade => trade.rows.every(row => row.total <= waiting.max)), 'cost of waiting: one scale fits every row')
}
```

Plus one job whose picked trade has no current age, so `projection.replacements` is empty. Build it with the file's `job()` helper, the way the existing jobs set trades: `assert.deepEqual(buildCostOfWaiting(run(<that job>)).trades, [], 'cost of waiting: nothing to wait for → no trades')`.

Run: `pnpm tsx scripts/verify-remodel-roi.ts`. Expected: it fails to resolve `build-cost-of-waiting`.

- [ ] **Step 4: `lib/build-cost-of-waiting.ts`.** It moves today's derivations out of the component unchanged. `growth = 1 + projection.assumptions.constructionPercent.value / 100`. Per replacement: `label = CURRENT_LABELS[replacement.trade]`, `givesOutYear = replacement.installs[0].year`, `likeForLikePrice = replacement.likeForLikePrice.value`, and the rows:

```ts
const rows: CostOfWaitingRow[] = [
  { name: 'Today', year: 0, today: likeForLikePrice, price: 0, repairs: 0, total: likeForLikePrice },
  ...replacement.installs.map((install, index) => {
    const repairs = index === 0 ? replacement.repairsUntil : 0
    return { name: `Year ${install.year}`, year: install.year, today: 0, price: install.price, repairs, total: install.price + repairs }
  }),
]
```

`max` is the largest `total` across every trade's rows (today's rows included; they never exceed a later one, but a shared scale must hold them). Run the goldens: they pass.

- [ ] **Step 5: The config.** Add to `constants/chart-configs.ts`:

```ts
export const COST_OF_WAITING_CHART_CONFIG = {
  today: { label: 'Price today', color: 'color-mix(in oklab, var(--muted-foreground) 40%, transparent)' },
  price: { label: 'Price when it gives out', color: 'var(--warning)' },
  repairs: { label: 'Repairs until then', color: 'color-mix(in oklab, var(--warning) 40%, transparent)' },
} satisfies ChartConfig
```

- [ ] **Step 6: `cost-of-waiting-rows.tsx`**, one horizontal stacked bar chart per trade:

```tsx
'use client'

import type { TooltipContentProps } from 'recharts'

import type { CostOfWaitingRow, CostOfWaitingTrade } from '@/features/calculators/remodel-roi-calculator/types'

import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'

import { COST_OF_WAITING_CHART_CONFIG } from '@/features/calculators/remodel-roi-calculator/constants/chart-configs'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { SegmentRect } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/segment-rect'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { ChartContainer, ChartTooltip } from '@/shared/components/ui/chart'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  trade: CostOfWaitingTrade
  growth: number
  max: number
}

export function CostOfWaitingRows({ trade, growth, max }: Props) {
  const tooltip = usePinnedChartTooltip()
  const { label, likeForLikePrice, rows } = trade
  const content = ({ active, payload }: TooltipContentProps<number, string>) => {
    const item = payload?.[0]
    if (!active || !item) {
      return null
    }
    const row = item.payload as CostOfWaitingRow
    if (item.dataKey === 'today') {
      return <ChartTooltipCard rows={[{ label: 'Same kind, installed today', value: formatMoney(row.today) }]} title={`${label} · today`} />
    }
    if (item.dataKey === 'repairs') {
      return <ChartTooltipCard rows={[{ label: `Repairs, years 1–${row.year}`, value: formatMoney(row.repairs) }]} title={`${label} · repairs`} />
    }
    return <ChartTooltipCard rows={[{ label: 'Price when it gives out', value: formatMoney(row.price) }, { label: `${formatMoney(likeForLikePrice)} × ${(growth ** row.year).toFixed(3)}`, value: '' }]} title={`${label} · year ${row.year}`} />
  }
  return (
    <ChartContainer aria-label={`${label}: ${rows.map(row => `${row.name} ${formatMoney(row.total)}`).join(', ')}`} className="aspect-auto w-full" config={COST_OF_WAITING_CHART_CONFIG} debounce={150} role="img" style={{ height: rows.length * 34 + 8 }} {...tooltip.containerProps}>
      <BarChart barCategoryGap={6} data={rows} layout="vertical" margin={{ top: 4, right: 88, left: 0, bottom: 4 }}>
        <XAxis domain={[0, max || 1]} hide type="number" />
        <YAxis axisLine={false} dataKey="name" tickLine={false} type="category" width={64} />
        <ChartTooltip active={tooltip.tooltipActive} content={content} cursor={false} shared={false} />
        <Bar dataKey="today" shape={props => <SegmentRect {...props} fill="var(--color-today)" />} stackId="row" />
        <Bar dataKey="price" shape={props => <SegmentRect {...props} fill="var(--color-price)" />} stackId="row" />
        <Bar dataKey="repairs" shape={props => <SegmentRect {...props} fill="var(--color-repairs)" />} stackId="row">
          <LabelList className="fill-foreground text-[15px] font-semibold tabular-nums" dataKey="total" formatter={value => formatMoney(Number(value))} position="right" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
```

`CostOfWaitingChart` calls `buildCostOfWaiting(projection)` and returns `null` when `trades` is empty (as today). It renders `<LegendSwatches config={COST_OF_WAITING_CHART_CONFIG} />`, then per trade the heading `<p>` (label, then "gives out in about {formatYears(trade.givesOutYear)}") and `<CostOfWaitingRows growth={growth} max={max} trade={trade} />`. It has no hooks of its own, so it needs no `'use client'`. `SegmentRect`'s vertical inset suits horizontal bars too. `formatYears` stays imported in the chart; `TipSegment` is no longer imported here.

- [ ] **Step 7: Check it.** Run `charts.cjs 3000 mouse` and then `charts.cjs 3000 touch`: `roi-chapter-waiting#*` must be `ok: true`, with each segment distinct.

- [ ] **Step 8: Screenshot at 1440×900 and 820×1180, light and dark.** Rows read Today, then Year N, with the total at the right. The warning colour and hatch-free repairs match the old legend. Nothing is clipped at 820.

- [ ] **Step 9: Keyboard.** Tab into the chart and press the arrow keys: the tooltip walks the rows (`accessibilityLayer` is on by default in v3).

- [ ] **Step 10: Edge case on screen.** In the inputs, set the HVAC's current age so it doesn't give out inside the look-ahead (for example age 1 at look-ahead 10). The chapter renders without the chart, as before, and without console errors.

- [ ] **Step 11: Gates, then commit (ask the owner first).**

```bash
pnpm tsc && pnpm exec eslint src/features/calculators scripts/verify-remodel-roi.ts && pnpm tsx scripts/verify-remodel-roi.ts
git add src/features/calculators/remodel-roi-calculator/types/index.ts src/features/calculators/remodel-roi-calculator/lib/build-cost-of-waiting.ts src/features/calculators/remodel-roi-calculator/constants/chart-configs.ts src/features/calculators/remodel-roi-calculator/ui/components/charts/cost-of-waiting-chart.tsx src/features/calculators/remodel-roi-calculator/ui/components/charts/cost-of-waiting-rows.tsx scripts/verify-remodel-roi.ts
git commit -m "feat(calculators): cost of waiting drawn with recharts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `return-breakdown` as a recharts waterfall; delete `TipSegment`

**Files:**
- Modify: `src/features/calculators/remodel-roi-calculator/types/index.ts` (`ReturnWaterfallRow`, `ReturnWaterfall`)
- Create: `src/features/calculators/remodel-roi-calculator/lib/build-return-waterfall.ts`
- Modify: `src/features/calculators/remodel-roi-calculator/constants/chart-configs.ts` (`RETURN_BREAKDOWN_CHART_CONFIG`)
- Modify: `src/features/calculators/remodel-roi-calculator/ui/components/charts/return-breakdown.tsx`
- Delete: `src/features/calculators/remodel-roi-calculator/ui/components/charts/tip-segment.tsx`
- Modify: `scripts/verify-remodel-roi.ts` (goldens)
- Test: `charts.cjs`, screenshots

**Interfaces:**
- Consumes: Task 2's container, tooltip, `SegmentRect` and hook.
- Produces:
  - `buildReturnWaterfall(projection: RemodelRoiProjection, lookAhead: LookAheadYears): ReturnWaterfall`.
  - `ReturnBreakdown({ projection, lookAhead })`, same signature.

- [ ] **Step 1: The types.** Append to `types/index.ts`:

```ts
export interface ReturnWaterfallRow {
  label: string
  detail: string
  value: number
  /** The running total after this row. */
  to: number
  /** Where the bar starts and ends on the axis, low end first. */
  range: [number, number]
  kind: 'gain' | 'cost' | 'total'
}

export interface ReturnWaterfall {
  rows: ReturnWaterfallRow[]
  low: number
  high: number
}
```

- [ ] **Step 2: The goldens first (failing).** In `verify-remodel-roi.ts`, next to the job A checks:

```ts
{
  const p = run(JOB_A)
  const waterfall = buildReturnWaterfall(p, 10)
  const total = waterfall.rows.at(-1)!
  assert.equal(total.kind, 'total', 'waterfall ends with where you stand')
  near(total.value, p.years[10].benefit, 'waterfall total is the year-10 benefit', 1e-6)
  assert.ok(waterfall.rows.slice(0, -1).every(row => row.kind === (row.value >= 0 ? 'gain' : 'cost')), 'waterfall: gains and costs by sign')
  assert.ok(waterfall.rows.every(row => row.range[0] <= row.range[1] && row.range[0] >= waterfall.low && row.range[1] <= waterfall.high), 'waterfall: every bar inside the axis')
  assert.ok(waterfall.low <= 0 && waterfall.high >= 0, 'waterfall: the axis includes zero')
}
assert.ok(!buildReturnWaterfall(run(cash(JOB_A)), 10).rows.some(row => row.label === 'Interest on your loan'), 'cash job: no loan-interest row')
```

Run: `pnpm tsx scripts/verify-remodel-roi.ts`. Expected: it fails to resolve `build-return-waterfall`.

- [ ] **Step 3: `lib/build-return-waterfall.ts`.** Move today's `rows` (labels and details verbatim), the `> 0.5` filter and the running `spans` out of the component. Each part becomes `{ label, detail, value, to, range: [Math.min(from, to), Math.max(from, to)], kind: value >= 0 ? 'gain' : 'cost' }`. Then append the total: `{ label: `Where you stand in year ${lookAhead}`, detail: 'All the parts above', value: running, to: running, range: [Math.min(0, running), Math.max(0, running)], kind: 'total' }`. `low` and `high` are the min and max over 0 and every range end. Run the goldens: they pass.

- [ ] **Step 4: The config.** Add to `constants/chart-configs.ts`:

```ts
export const RETURN_BREAKDOWN_CHART_CONFIG = {
  gain: { label: 'Adds to the return', color: 'var(--primary)' },
  cost: { label: 'Takes from it', color: 'color-mix(in oklab, var(--muted-foreground) 50%, transparent)' },
  total: { label: 'Where you stand', color: 'var(--foreground)' },
} satisfies ChartConfig
```

- [ ] **Step 5: Render it.** `return-breakdown.tsx` gets `'use client'`, calls `const { rows, low, high } = buildReturnWaterfall(projection, lookAhead)` and `usePinnedChartTooltip()`, and keeps the heading `<p>` ("Where the return comes from, by year N") as HTML above the chart:

```tsx
<ChartContainer aria-label={`Where the return comes from by year ${lookAhead}: ${rows.map(row => `${row.label} ${signedMoney(row.value)}`).join(', ')}`} className="aspect-auto w-full" config={RETURN_BREAKDOWN_CHART_CONFIG} debounce={150} role="img" style={{ height: rows.length * 34 + 16 }} {...tooltip.containerProps}>
  <BarChart barCategoryGap={8} data={rows} layout="vertical" margin={{ top: 4, right: 96, left: 0, bottom: 4 }}>
    <XAxis domain={[low, high]} hide type="number" />
    <YAxis axisLine={false} dataKey="label" tickLine={false} type="category" width={152} />
    <ReferenceLine stroke="var(--muted-foreground)" x={0} />
    <ChartTooltip active={tooltip.tooltipActive} content={content} cursor={false} shared={false} />
    <Bar dataKey="range" shape={props => <SegmentRect {...props} fill={`var(--color-${(props.payload as ReturnWaterfallRow).kind})`} />}>
      <LabelList className="fill-foreground text-[14.5px] font-semibold tabular-nums" dataKey="value" formatter={value => signedMoney(Number(value))} position="right" />
    </Bar>
  </BarChart>
</ChartContainer>
```

`content` returns `<ChartTooltipCard rows={[{ label: row.detail, value: signedMoney(row.value) }, ...(row.kind === 'total' ? [] : [{ label: 'Running total', value: formatMoney(row.to) }])]} title={row.label} />`, where `row` is `payload[0].payload as ReturnWaterfallRow`. `LabelList position="right"` puts the label at the bar's end. If a negative bar's label lands inside the plot, pass `position="insideRight"` for `kind === 'cost'` through a `content` function, and screenshot to check.

- [ ] **Step 6: Delete `tip-segment.tsx`.** Run `grep -rn "tip-segment\|TipSegment" src`: expect no hits.

- [ ] **Step 7: Check it.** `charts.cjs 3000 mouse` and `charts.cjs 3000 touch` both exit 0. `roi-chapter-total#1` shows 8 distinct tooltips.

- [ ] **Step 8: Screenshot at 1440 and 820, light and dark.** The bars float from the running total, gains are primary, costs are grey, the total is foreground, the zero line is visible, and labels are signed and not clipped.

- [ ] **Step 9: Edge case on screen.** Set the project price to `1` with no loan (cash). The waterfall has no project-interest row, nothing crashes, and every label stays inside the card.

- [ ] **Step 10: Gates, then commit (ask the owner first).**

```bash
pnpm tsc && pnpm exec eslint src/features/calculators scripts/verify-remodel-roi.ts && pnpm tsx scripts/verify-remodel-roi.ts
git add src/features/calculators/remodel-roi-calculator/types/index.ts src/features/calculators/remodel-roi-calculator/lib/build-return-waterfall.ts src/features/calculators/remodel-roi-calculator/constants/chart-configs.ts src/features/calculators/remodel-roi-calculator/ui/components/charts/return-breakdown.tsx src/features/calculators/remodel-roi-calculator/ui/components/charts/tip-segment.tsx scripts/verify-remodel-roi.ts
git commit -m "feat(calculators): return breakdown as a recharts waterfall; one tooltip path for every chart

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Canonical type weights, enforced

**Files:**
- Modify: `src/app/(frontend)/globals.css` (base layer, near the `h1…h6` rule at ~`:646`)
- Modify: `eslint.config.js` (append one aliased rule)
- Modify: every `font-extrabold` / `font-black` site (list in Step 4)
- Modify: the chart SVG label classNames in `monthly-trend-chart.tsx` and `pay-for-itself-chart.tsx`
- Test: `.superpowers/sdd/2026-09-29-remodel-roi-fixes/fonts.cjs`

**Interfaces:** none.

- [ ] **Step 1: The failing check.** Run `node .superpowers/sdd/2026-09-29-remodel-roi-fixes/fonts.cjs 3000; echo $?`. Expected: exit 1, with Syne 900 `<b>` ×10 and Nunito 800 among the offenders.

- [ ] **Step 2: The lint ban (failing test for the classes).** Append to `eslint.config.js`, after the `project/no-inline-table-config` block. It gets its own alias, because a second `no-restricted-syntax` block would silently replace the nav-path one; see the comment already in that file.

```js
}).append({
  // Syne tops out at 800 and turns wide and heavy there; Nunito past 700 reads as a different face beside the rest of the app.
  name: 'project/no-heavy-font-weight',
  plugins: {
    project: {
      rules: {
        'no-heavy-font-weight': builtinRules.get('no-restricted-syntax'),
      },
    },
  },
  rules: {
    'project/no-heavy-font-weight': [
      'error',
      { selector: 'Literal[value=/\\bfont-(extrabold|black)\\b/]', message: 'Weights stop at font-bold (700); Syne stops at font-semibold (600).' },
      { selector: 'TemplateElement[value.raw=/\\bfont-(extrabold|black)\\b/]', message: 'Weights stop at font-bold (700); Syne stops at font-semibold (600).' },
    ],
  },
})
```

The existing chain ends with `})` for the table-config block. Replace that final `})` with the block above, whose own closing `})` ends the chain.

Run: `pnpm exec eslint src 2>&1 | grep -c no-heavy-font-weight`
Expected: the same number as `grep -rn "font-extrabold\|font-black" src | wc -l` (15 once Tasks 3–4 have landed; the rule must catch every one).

- [ ] **Step 3: The base rule.** In `globals.css`, inside the same `@layer base` block as the `h1…h6` rule, add the rule below. The weight token is Tailwind's own `--font-weight-bold` (700), already emitted because `font-bold` is in use; no new variable. Inside Syne, emphasis takes the surrounding weight (600 in semibold sentences, 500 in `h1`/`h2`), since R18 has colour carry it there:

```css
  /* The UA's `bolder` turns emphasis inside semibold text into 900, past both faces' comfortable range. */
  b,
  strong {
    font-weight: var(--font-weight-bold);
  }

  /* Emphasis inside Syne stays at the surrounding weight; colour carries it. */
  :is(h1, h2, h3, h4, h5, h6, .font-sans) :is(b, strong) {
    font-weight: inherit;
  }
```

- [ ] **Step 4: Replace the heavy classes.**

| File:line | Now | Change to |
|---|---|---|
| `story/top-bar.tsx:62` | `font-extrabold` | `font-bold` |
| `story/chapter-math.tsx:31` | `font-extrabold` | `font-bold` |
| `story/uses-list.tsx:19` | `font-extrabold` | `font-bold` |
| `story/net-worth-summary.tsx:21` | `font-extrabold` | `font-bold` |
| `story/net-worth-summary.tsx:31` | `font-extrabold` | `font-bold` |
| `charts/cost-of-waiting-chart.tsx` (trade heading) | `font-extrabold` | `font-bold` |
| `charts/return-breakdown.tsx` (heading) | `font-extrabold` | `font-bold` |
| `src/shared/components/charts/chart-tooltip-rows.tsx:17` | `font-extrabold` | `font-bold` |
| `src/shared/components/stat-tile.tsx:14` | `font-extrabold` | `font-bold` |
| chart SVG labels: `monthly-trend-chart.tsx` ×3, `pay-for-itself-chart.tsx` ×1 | `fill-foreground stroke-card stroke-3 text-xs font-extrabold [paint-order:stroke] [stroke-linejoin:round]` | `fill-foreground text-xs font-semibold` |
| `landing/.../home-hero.tsx:72` | `font-extrabold` | unchanged; add `// eslint-disable-next-line project/no-heavy-font-weight -- public hero, weight reviewed separately` above it |
| `meeting-flow/.../reputation-mark.tsx:28` | `font-black` | unchanged; add `{/* eslint-disable-next-line project/no-heavy-font-weight -- copies the BBB logotype */}` above it |

The `return-breakdown` total row that was `font-sans font-extrabold` in the old HTML is now a `LabelList` at `font-semibold` (Task 4), so it has no row here. If Task 4 left a `font-sans` on any figure, it's `font-semibold`, since Syne stops at 600.

- [ ] **Step 5: Check the labels without the halo.** Screenshot the monthly-trend chart ("Year 4: costs less from here", "HVAC replaced", "Loan paid off") and pay-for-itself ("Pays for itself · year 3") in both themes. Each label must stay legible where it crosses a line. If one isn't, give that label a card-coloured backdrop through the `label` `content` prop (a `<rect>` sized to the text, `fill="var(--card)"`) rather than a stroke.

- [ ] **Step 6: Run the checks.**

Run: `node .superpowers/sdd/2026-09-29-remodel-roi-fixes/fonts.cjs 3000; echo $?` → exit 0, `offenders: {}`.
Run: `pnpm exec eslint src 2>&1 | grep -c no-heavy-font-weight` → 0.
Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 7: Look at it.** Screenshot the answer chapter and the total chapter at 1440, light. "$23,000 ahead" and "year 3" render in Syne 600 in `text-primary`, the same width as the sentence around them. Compare with `.superpowers/sdd/2026-09-29-remodel-roi-fixes/shots/before-font-total.png` (before): the wide, heavy glyphs are gone. Also spot-check one other app page that uses `<b>` inside body text (for example `/dashboard/meetings`) for unintended change.

- [ ] **Step 8: Commit (ask the owner first).**

```bash
git add "src/app/(frontend)/globals.css" eslint.config.js src/features/calculators/remodel-roi-calculator/ui/components src/shared/components/charts/chart-tooltip-rows.tsx src/shared/components/stat-tile.tsx src/features/landing/ui/components/home/home-hero.tsx src/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark.tsx
git commit -m "fix(type): emphasis stops at 700 and Syne at 600; font-extrabold and font-black banned

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Re-measure the smoke, and close out the docs and memory

**Files:**
- Modify: `.superpowers/sdd/2026-09-27-remodel-roi-calculator/verify.md` (local)
- Modify: `docs/plans/2026-09-26-sales-calculators-epic.md` (R18 status; the follow-ups)
- Modify: memory `reference-chart-touch-tooltips.md` and `project-sales-calculators-port.md`

- [ ] **Step 1: Run the smoke at the checklist's viewports.** Run `node .superpowers/sdd/2026-09-27-remodel-roi-calculator/smoke.cjs 3000 <w> <h> <theme>` for 1440×900, 1180×820, 1024×768 and 820×1180, light and dark. It hovers `.recharts-bar-rectangle rect`, which recharts 3 still renders, so the script needs no change.
  - If it fails on the known hover flake, re-run it once.
  - If `billTooltip` or a selector changed because of the migration, record that and fix the scratch copy, not `smoke.cjs`.

- [ ] **Step 2: Rewrite `verify.md` §1's expectations with the measured values.** Expected, per the goldens: `Year 3pays for itself Year 4costs less monthly +$23,000by year 10` and `+$96,000by year 20`. Take the "$4,400 more expensive" figure from the run, since it depends on construction inflation, not bill rates, so it may be unchanged. Add a dated line: "2026-09-29: rates 7.57 / 8.9 / 9.1 (R18.8); expectations re-measured." Paste the JSON.

- [ ] **Step 3: Read the story copy at the new numbers.** Open the page and read all 8 chapters. The sentences must still read right with smaller figures, for example "$196 less by year 10". Report anything awkward to the owner; don't reword copy without asking.

- [ ] **Step 4: All scripts together.** Run `charts.cjs 3000 mouse`, `charts.cjs 3000 touch` and `fonts.cjs 3000` (all exit 0), plus `pnpm tsx scripts/verify-remodel-roi.ts`, `pnpm tsc` and `pnpm lint`.

- [ ] **Step 5: The tracker.**
  - In R18, add "**Built** <date>, `<first sha>..<last sha>`".
  - Under §2 or the follow-ups, add: "Homepage hero onto Syne 600 (R18.7), its own visual check".
  - Update the status line at the top.

- [ ] **Step 6: Memory.**
  - Rewrite `reference-chart-touch-tooltips.md` for recharts 3:
    - Every chart sits in `ChartContainer` + `ChartConfig` (`@/shared/components/ui/chart`) and renders `ChartTooltipCard` through `ChartTooltip`.
    - `usePinnedChartTooltip` still owns touch, because v3 selects on `touchmove` only and has no outside-tap dismiss. Record whether Step 9's fallback (the controlled index) was needed.
    - Hover dimming uses `shape` `isActive` plus `useIsTooltipActive`, never React state.
    - Static `ChartConfig`s live in `constants/` (ROI: `constants/chart-configs.ts`) and are the one source of each series' label and colour; `LegendSwatches` takes the config. `ChartContainer` takes `debounce`; grids keep an explicit `stroke`, because the container's default draws them at `border/50`.
    - The repro is `.superpowers/sdd/2026-09-29-remodel-roi-fixes/charts.cjs touch`.
  - Update `project-sales-calculators-port.md`: R18 built, rates changed, and the headline is now +$23,000 at 10 years.

- [ ] **Step 7: Commit the tracker (ask the owner first).**

```bash
git add docs/plans/2026-09-26-sales-calculators-epic.md
git commit -m "docs(calculators): R18 built

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
