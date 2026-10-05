# Press feedback: one engine for every tap and click

Status: draft for owner review (2026-10-05). Approach A chosen by the owner on 2026-10-05.

## 1. Goal

Every press in the app reads as a press, on desktop, iPad and phone: the control reacts the instant a finger or mouse goes down and settles back smoothly when it lifts. One engine drives it, every control opts in by tier, and nothing re-renders React.

**Success looks like:**
- a 30 ms mouse click on any Button produces a visible, smooth dip and spring-back, with no frame where the button jumps;
- a scroll that starts on a table row or a card does not light it up;
- pressing the ⋯ inside a row presses the ⋯, not the row;
- the owner taps through records, menus, tabs and the dock on the iPad and calls it smooth.

## 2. What exists today (local main, `d51c9e55` + `b4dc54f2`)

- A global listener (`src/shared/hooks/use-press-feedback.ts`, mounted by `PressFeedbackProvider` in `src/shared/components/providers/index.tsx`) puts `data-pressed` on the innermost pressable under the pointer and holds it at least 140 ms.
- `globals.css`: the `pressed:` variant (`&:is([data-pressed], #press)`), the `press-motion` utility (CSS `scale` transition with an overshoot curve), and the `--press` / `--row-press` washes.
- `button.tsx` uses `press-motion`, `pressed:brightness-85|90` on solid variants, `pressed:bg-press` on outline/ghost, `[--press-scale:0.9]` on `size="icon"`.
- Rows, dropdown/context/menubar/select/command items, tabs and toggle use `pressed:bg-*`.
- 9 files carry their own `whileTap` (landing home/about, app-sidebar, funnel cta, card-select-step, multi-step card-option, /test).

**Why it feels janky (owner, 2026-10-02):** `filter: brightness` repaints the button on every frame; the overshoot curve wobbles on a 4% shrink; the 140 ms hold makes the button rise after the finger has lifted; and `transition` switches between 70 ms and 280 ms in mid-flight. `b4dc54f2` removed the `all` transition and fixed nothing else.

## 3. The tiers (owner-approved 2026-10-02)

| Tier | What happens | Who gets it |
|---|---|---|
| `full` | spring shrink + colour press | every `<Button>` except `link`; icon buttons (deeper shrink); chips and filter pills; dock and floating buttons; marketing CTAs |
| `tint` | colour press only, never moves | table rows, list items, menu/select/command items, tabs and segmented toggles, sidebar nav items, big clickable cards (overview, meeting, project, proposal cards) |
| `none` | nothing | `link` variant and inline text links, form-field triggers (select, date), checkbox/switch/slider, drag handles and draggable kanban cards, disabled controls |

Rule for anything not listed: a control that is small and discrete gets `full`; a control that is wide (a row, a card, an item that spans its container) gets `tint`; a control that is part of a form value, a drag, or prose gets `none`.

## 4. Design

### 4.1 The engine: `usePress`

`src/shared/hooks/use-press.ts`

```ts
type PressTier = 'full' | 'tint' | 'none'
function usePress(options?: { tier?: PressTier, scale?: number }): React.RefCallback<HTMLElement>
```

- Returns a ref callback. Built on motion's vanilla `press()` gesture and `animate()` (both exported by `motion/react` 12.43), so there is no `motion.*` component and no React state. Nothing it does re-renders.
- On attach it marks the element `data-press="<tier>"` and registers `press(el, onStart)`. `tier: 'none'` registers nothing.
- **Innermost only:** `onStart` ignores the press when `startEvent.target.closest('[data-press]')` is not this element, so a row never presses with the button inside it. This replaces the `:has()` / global-listener logic.
- **Press start:** sets `data-pressed`; for `full`, `animate(el, { scale }, PRESS_IN)`. Touch waits `PRESS_TOUCH_DELAY_MS` (50) before starting and drops the press if the gesture is cancelled (scroll) first; a tap shorter than the delay still plays the press on release.
- **Press end** (lift, cancel or leave): removes `data-pressed`; for `full`, `animate(el, { scale: 1 }, PRESS_OUT)` from wherever the spring got to. No minimum hold: a spring started on press-down produces a visible dip on a fast click and settles back without lagging behind the finger.
- **Scale:** default `PRESS_SCALE` (0.96); `size="icon"` and other ≤40 px controls pass `PRESS_SCALE_ICON` (0.9). `prefers-reduced-motion` is read at press time; when set, `full` behaves as `tint`.
- **Disabled:** a press on an element matching `:disabled, [aria-disabled="true"], [data-disabled]` is ignored.
- **The asChild trap:** Radix `Slot` hands a new composed ref every render, so React detaches and re-attaches the same node each render (the motion ≥12.43 `asChild` replay trap). A naive cleanup would cancel the gesture mid-press and leave the button stuck at 0.96. Registration is therefore keyed by element in a module `WeakMap`: a re-attach of an already-registered node with the same tier keeps the existing gesture; teardown is deferred one microtask and runs only if the node was not re-attached, and it resets `scale` and clears `data-pressed`.
- **Transforms:** motion writes `style.transform`; Tailwind v4's `translate-*`, `scale-*` and `rotate-*` utilities use the separate `translate`/`scale`/`rotate` properties, so they compose. An element that is itself a `motion.*` component must not use the hook (two writers on `transform`); it takes `whileTap={PRESS_TAP}` from the same constants instead.

### 4.2 Constants

Added to `src/shared/constants/motion.ts` (the existing motion-token file):

- `PRESS_SCALE = 0.96`, `PRESS_SCALE_ICON = 0.9`, `PRESS_TOUCH_DELAY_MS = 50`
- `PRESS_IN = { type: 'spring', visualDuration: 0.1, bounce: 0 }`
- `PRESS_OUT = { type: 'spring', visualDuration: 0.25, bounce: 0.2 }`
- `PRESS_TAP = { scale: PRESS_SCALE, transition: PRESS_IN }` for `motion.*` components

The two springs are starting values; the owner tunes them at the iPad gate (§6) and they live only here.

### 4.3 Colour

- Colour stays in CSS, driven by `data-pressed`. The `pressed:` variant stays as written (`&:is([data-pressed], #press)`: id specificity so a press beats hover in any order).
- `press-motion` is replaced by `press-tint`: transitions `color, background-color, border-color, box-shadow` over 150 ms ease; while pressed the duration is 0, so the colour lands instantly and fades out on release. It no longer touches `scale` or `filter`.
- `filter: brightness` goes. Solid variants get solid pressed tokens, defined like the hover ones (mixed toward black, `theme:check` pairs on every rung, both schemes): `--primary-press`, `--destructive-press`, `--secondary-press`. Outline and ghost keep `--press`; rows and items keep `--row-press`.
- New tokens change what the owner sees, so they go through the screenshot gate (colour changes are judged by eye, both schemes, before committing) before the commit.

### 4.4 `<Button>`

- `button.tsx` gains `'use client'` (it is imported from server components today; that stays legal) and a `press?: PressTier` prop. Default: `full`, except `variant="link"` → `none`; `size="icon"` → `PRESS_SCALE_ICON`.
- The ref from `usePress` is merged with the caller's ref and given to `Comp` (`button` or `Slot`), so `asChild` presses the slotted child.
- `press-motion` and `[--press-scale:…]` leave the cva strings; `press-tint` joins the base; `pressed:brightness-*` becomes `pressed:bg-primary-press` / `-destructive-press` / `-secondary-press`.
- `MotionButton` (`motion.create(Button)`) passes `press="none"` and uses `whileTap={PRESS_TAP}`, so motion is the only writer on its transform.

### 4.5 `<Pressable>`

`src/shared/components/pressable.tsx`: `<Pressable asChild tier="full|tint">` wraps one child through `Slot` and gives it the `usePress` ref plus `press-tint`. No DOM of its own. This is how raw `<button>`s, clickable cards and `role="button"` elements opt in.

### 4.6 Primitives

- `data-table-row.tsx`: `usePress({ tier: 'tint' })` on the row (replaces `data-press`).
- dropdown-menu, context-menu, menubar, select, command items; tabs triggers; toggle: `tint` via the hook (each primitive file is client already), keeping their existing `pressed:bg-*` classes.
- The sidebar menu button and the mobile dock keep their own `active:` styles today; the dock moves to `full` through `Pressable`, the sidebar items to `tint`.

### 4.7 Removed in the same change (no shims: consumers move and the old path goes in one change)

`use-press-feedback.ts`, `press-feedback-provider.tsx` and its line in `providers/index.tsx`, the `press-motion` utility, every `pressed:brightness-*` and `[--press-scale:*]` class.

## 5. Migration

1. Engine, constants, tokens, `press-tint`, Button, Pressable, the primitives in 4.6; delete what 4.7 lists. Owner gate (screenshots + iPad).
2. The 9 `whileTap` files move to `PRESS_TAP` (or to the hook when the element is not a `motion.*` component).
3. Raw buttons and cards by area, using the §3 rule: dashboard + sidebar + dock → records (cells, kanban cards stay `none`) → meeting flow → proposal flow → customer profile → public site and funnels. Each area is one commit with an owner check. The plan lists every file per area from the inventory (126 raw `<button>`s in 96 files, ~30 clickable `div`/`li`/`Card` and `role="button"` elements).

## 6. Verification

- `pnpm tsc` + `pnpm lint` per commit; `pnpm theme:check` covers the new tokens.
- **Smoothness probe** (local Playwright script sampling per animation frame): press a Button for 30 ms and for 300 ms, sample `getComputedStyle(el).transform` every animation frame, and fail on any non-monotonic step during press-in or a frame gap over 32 ms. Also assert: the row stays unpressed when its ⋯ is pressed; a vertical touch drag on a row never sets `data-pressed`; an `asChild` Button that re-renders mid-press returns to scale 1.
- Screenshots, pressed versus rest, of a solid, outline, ghost and icon Button, a row and a menu item, light and dark, at 1440 and 820 wide.
- **Owner gate:** owner taps on the iPad and clicks on the desktop before each area's commit. The spring values in 4.2 are tuned here.

## 7. Out of scope

Hover colours (theme-states epic, done in `17d04dac`); haptics (iOS Safari has no `navigator.vibrate`); press sounds; the `link` variant's hover.
