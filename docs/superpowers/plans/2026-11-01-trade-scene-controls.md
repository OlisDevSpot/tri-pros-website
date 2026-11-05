# Trade scene controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the trade scene's side/bottom card with the approved bottom group (Home facts, Systems, Modify, the Today ⇄ Build toggle, Benefits, Recenter), one non-modal shell for three of them, the Systems rail with a card beside the system in focus, and Modify as a search for one change.

**Architecture:** UI state lives in a new `SceneControlsProvider`; the system in focus lives in the inputs store's `cameraFocus`, which the camera rig frames inside a visible area that now has a `top` and excludes the system card. Every write from every control goes through one pure `applySceneChange` behind `useApplySceneChange`, over the existing patch functions. Pure libs (`sceneChangeSlots`, `searchSceneChanges`, `missingFacts`, `eraCodeLine`, `sceneVisibleAreaFor`) carry the logic and are pinned by the existing `pnpm tsx scripts/verify-*.ts` assertion scripts; the UI is pinned by one Playwright check, grown one slice per task from Task 5 on, while the old card stays mounted until the switch-over (Task 10).

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn, zustand vanilla store (`createSceneInputs`), `@radix-ui/react-dialog` and `@radix-ui/react-popover` primitives, `motion`, lucide icons, three.js via the shared `CameraRig`.

**Spec:** `docs/superpowers/specs/2026-11-01-trade-scene-controls-design.md` (approved 2026-11-01).
**The mock it must match:** `docs/plans/assets/2026-11-01-trade-scene-controls/studies.html` (open with `assets.js` beside it; version **B** leads). Line numbers below cite that file as `mock:NNN`.

## Global Constraints

- **Owner's plan rules:** build it to match the approved studies page as closely as possible (sizes, spacing, motion, copy, behaviour), and write **no defensive code**: no fallbacks for states the types rule out, no `?.` on values that are always there, no try/catch around our own code, no "just in case" branches.
- **No build until the owner says build/execute/run**, and not before Task 0's preconditions hold (two other sessions edit these files today: the blueprint load and paint wear).
- **Build order (owner, 2026-11-01):** Controls builds **before** TS3b.4b (up close on a system). TS3b.4b's plan is written against the card this plan deletes, so it is re-planned on this plan's head (Task 11).
- **pnpm only.** Static checks are `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.** No DB writes for testing, dev included.
- **Shared working tree.**
  - No `git stash`, `git checkout .`, `git restore`, `git reset`, `git commit --amend` in any form, or `git add -A`/`git add .`/`git add -u <dir>`.
  - Commit only if the owner answered yes to committing per task.
  - **`git commit -- <path>` commits the path's whole working-tree file**, not your staged hunks. Before committing, run `git diff <path>` on every path: if a file holds another session's hunks (`types.ts`, `home-scene-copy.ts`, `CONTEXT.md`, the tracker are likely), stage only your hunks with `git apply --cached <patch>`, check `git diff --cached --stat` lists only your paths, then run a bare `git commit`. Otherwise `git add <paths>` and `git commit -- <paths>`.
  - Check `git show --stat HEAD` after every commit. If a commit comes out wrong, stop and tell the owner.
  - After any scripted edit, check `git diff --shortstat` (no target file is CRLF today).
- **Conventions:**
  - One component per file and named exports.
  - No file-level constants in component or view files; they go in `constants/` or `lib/`.
  - Contexts go in `contexts/`.
  - Types go in the feature's `types.ts`.
  - Comments say why, never what. No banners, and no plan, spec or task citations in code.
  - Match the surrounding code's idiom (see `scene-card.tsx`, `recenter-chip.tsx`).
- **Copy:** every new string lives in one new `CONTROLS_COPY` object in `constants/home-scene-copy.ts`, under the comment `// Placeholder copy until the owner's copy pass.` Use the mock's words exactly. Existing strings come from the existing constants (spec §3).
- **Company facts** come only from `src/shared/constants/company/`. No solar, anywhere.
- **Design tokens only, by the theme rules (owner, 2026-11-01).** Use the stage's dark tokens; the stage is `dark`-scoped (`SCENE_STAGE_CLASS`). Never write a literal colour; the token map in the Mock reference below gives them. Where the mock's fill breaks `docs/design-system/theme-conventions.md`, the theme rule wins (fields on `input-background`, menus on `popover`). Read that file before the first class string. States: `hover:bg-hover`, `pressed:` (never `active:`), the shared focus ring.
- **Names (owner, 2026-11-01):** the glossary terms in `CONTEXT.md` (Controls, Controls window, Today ⇄ Build toggle, Home facts, Missing fact, Systems rail, System in focus, System card, Modify, change slot, Scene change, Benefits, Close-up card). In code, the two sides are `existing` / `proposed`, never `today` / `build` (`existing-chip.tsx`, `proposed-chip.tsx`, `ProposedTint`); "Today" and "Tri Pros build" are on-screen copy only. Modify's on-screen groups are `SlotGroup`, not a scope.
- **Motion:**
  - Every transition uses `cubic-bezier(.2,.8,.2,1)` (`CONTROLS_EASE`, Task 3) unless the Mock reference names another curve.
  - Under `prefers-reduced-motion: reduce`, every one of them jumps (`duration: 0`, or `motion-reduce:transition-none` on CSS transitions), and the camera cuts.
- **Accessibility:**
  - Every hit target is at least 40 × 40 px; 44 on wide shapes.
  - Everything is reachable by keyboard and has an accessible name.
  - Value menus are radio groups.
- **Files off limits:**
  - `src/shared/db/**`, `src/trpc/**`, any `dal/`, `services/` or `schemas/` under `src/shared/modules/**`, seeds, and `src/shared/components/ui/**`.
  - Everything under `src/shared/` except the three scene files Task 3 names and `src/shared/components/scene/lib/create-tap-tracker.ts` (Task 7).
  - The blueprint files: `ui/components/blueprint/*` and `constants/scene-load.ts`.
- **Verification recipe:**
  - Logic: `pnpm tsx scripts/verify-trade-scene-layout.ts`, `verify-trade-scene.ts`, `verify-trade-scene-load.ts`, `verify-scene-inputs.ts`, `verify-scene-primitives.ts` (pins `pan-scale.ts` and the tap tracker) and `verify-trade-scene-lot.ts` (reads `HOME_ANCHORS`), each through `pnpm tsx scripts/<name>`.
  - UI: `node .superpowers/sdd/2026-11-01-trade-scene-controls/controls-check.mjs` against the worktree's dev server (the port is `PORT` in `.env.local`, default 3000).
  - Auth: `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard/labs/trade-scene`.
  - Before judging rendered CSS on a long-running dev server: check `ss -ltnp`, stop the server, `rm -rf .next`, then restart.

## Rulings (where the spec, the mock and the code disagreed, and what the plan does)

| # | What | Ruling | Why |
|---|---|---|---|
| P1 | The visible area's `top` | Add an optional `top` to the shared `VisibleArea`, `frameVisibleArea` and `visibleHeight` in `src/shared/components/scene/` | Owner, 2026-11-01. The phone frames the system below its card. The meeting cutaway passes no area, so nothing else changes. |
| P2 | The phone system card | Full width (`left/right: 10`), `top: 12`, drawn above the dock column | Owner, 2026-11-01: "the way the current phone shows it in the artifact looks good". The real phone dock is a column centred lower on the right, so the card clears it on phones. The spec's "12 where the dock is beside" is that number. |
| P3 | The band (how far above the group modals and the rail stop) | Use the mock's numbers: modal bottom 80 (portrait 76), rail bottom 80 (portrait 72), group bottom 16 (portrait 10), group height 56 | Spec §4.3 says "group top + 12" with no reason; the owner's rule makes the mock win (`mock:117,120,224,225,234`). |
| P4 | The modal's and the card's rise | 10 px rise and fade over 220 ms (rail: 8 px) | `@keyframes rise` (`mock:170`) is 10 px; spec §4.3 says 8 with no reason. |
| P5 | The iPad and desktop system card's `left` | Right-aligned 10 px from the dock region: `right = dock.width + dock.gap + 10` (104), `width: 440`, `top: 140` | At 1180 this equals the mock's `left: 636` (`mock:239`). The spec's "centre + 46" overflows narrow stages; this rule doesn't. |
| P6 | Home facts fields | A new `ChoicePill` (the mock's `.m-seg`, with Not sure inside the pill), not `SegmentedField size="slim"`. Age group stays the existing `ScaleField`. `ShingleColors`'s line picker inside the menu uses it too. | The mock's fact rows put Not sure in the pill and show "Missing" at the right (`.m-field`, `.m-seg`: `mock:263-272,390-391`). `SegmentedField` slim drops Not sure into a label link. |
| P7 | The portal | Compose the shared `Dialog`, `DialogPortal container={stageElement}` (it passes props through, `dialog.tsx:41-45`), `DialogTitle`, `Popover` and `PopoverTrigger`. Import the primitives only for the two Contents (`DialogPrimitive.Content`, `PopoverPrimitive.Portal`/`Content`), and carry over the shared content's `isToastTarget` guard (`dialog.tsx:99-123`). Popovers pass `collisionBoundary={stageElement}`. | The shared `DialogContent` and `PopoverContent` always portal to `document.body`, and `isUnclaimedKey` drops keys from outside the stage (`is-unclaimed-key.ts:24`). No feature imports these primitives today; this is the first, kept to the two Contents. No shared ui edit. |
| P8 | The close-up card on wide shapes | `top: 16`, `left: 16`, width 372 (narrow 320), **bottom at the modal band (80)** | Otherwise its bottom corner sits under the group once a name opens. |
| P9 | Mock behaviours the spec leaves out | Build the toast "Showing the Tri Pros build" when Benefits flips from Today (`mock:159-160,1052,1118`), and the focus ping (`mock:251-253`) at the visible area's centre when a system takes focus | The owner's rule: match the behaviour. |
| P10 | Recenter while a modal is open | Hidden while Home facts, Modify or Benefits is open; shown with Systems open | `mock:896`. |
| P11 | `HomeMaterialChange` | Removed. `homeMaterialPatch` takes `Extract<SceneChange, { kind: 'wear' \| 'option' \| 'era-guess' \| 'fact' }>` directly; no alias is kept | The spec moves it into `SceneChange`; the owner's migration rule keeps no aliases. |
| P12 | A slot's `change` | `change: (value: string) => SceneChange` | One slot offers many values; spec §4.5's single `change` can't express that. |
| P13 | The visible area's input | `sceneVisibleAreaFor({ shape, width, height, zoomed, focusCardBottom })`; `focusCardBottom` is the system card's measured bottom (stage px) while a system holds the camera, else `null` | The phone card's height depends on its content. |
| P14 | Zooming with a window open | A part-pin tap is a tap outside the window, so the window closes and the zoom happens. Spec §6's "zooming while a modal is open keeps the modal" is dropped. | Owner, 2026-11-01. |
| P15 | Roof form's Not sure | Roof form has no Not sure (Pitched, Flat), as the mock draws it (`mock:740`) | Spec §3.3 keeps `withUnknown` with no reason, so the mock wins. A home always has a form; the missing fact is the unset value. |
| P16 | Use code and the per-material "Back to era guess" | Use code replaces the per-material link; `HOME_MATERIALS_COPY.backToEraGuess` goes with `material-choices.tsx` | R171: "Use code resets them". |
| P17 | One window shell | One `ControlsModal`, open while a section other than Systems is open; a section switch swaps the body and the placement, never the Radix root | One root per section would close and reopen the shell on a switch, replaying its rise and racing the focus hand-offs. |

## Mock reference

**Token map.** The mock's `--m-*` values (`mock:20-34`) were drawn from the stage's dark tokens. Where the mock breaks a theme rule, the theme rule wins (owner, 2026-11-01); those rows are marked.

- Task 4's first step reads each token below with `getComputedStyle` **inside the open window and inside an open menu** (a nested `bg-card` climbs a rung, `globals.css:652`), records the values in the task report, and records the class strings once in `constants/controls-classes.ts`; every component uses those strings.

| Mock | Value | Token |
|---|---|---|
| `--m-ground` (fields, chips, money, era block) | `oklch(0.125 0.04 253)` | **`bg-input-background`** (theme rule: the canvas is "a hole", `theme-conventions.md:68`; `--presentation-ground` is 0.2, not this) |
| `--m-card` (window, system card) | `oklch(0.206 0.04 253)` | `bg-card` |
| Choice pill track inside the window | `--m-card` | `bg-(--card)`, so it doesn't climb a rung |
| `--m-raised` (pressed fill, open section, icon tiles) | `oklch(0.253 0.04 253)` | `bg-muted` (`--control-selected` is mixed with primary) |
| Value menu surface | `--m-raised` | **`bg-popover`** (theme rule: menus are the top rung, `theme-conventions.md:24,67`) |
| `--m-edge` | `oklch(0.276 0.04 253)` | `border-border` |
| `--m-pop` (pop edges, dashed tiles) | `oklch(0.347 0.04 253)` | `border-border-strong` |
| `--m-fg` / `--m-fg-2` | | `text-foreground` / `text-muted-foreground` |
| `--m-primary` / `--m-on-primary` | | `primary` / `primary-foreground` |
| `--m-attention` | | `toneClasses('attention')` (`.text`, `.dot`, `.border`, `.wash`) |
| `--m-glass` + `.glass` | | the dock's surface: `border bg-card shadow-lg` (`scene-dock.tsx:31`) |
| Scrim (`.m-scrim`, `mock:163`) | | a plain `absolute inset-0` div inside the stage portal, `bg-[oklch(var(--presentation-scrim)/…)]` at the mock's alpha, fading in over 160 ms; a tap on it closes. Radix renders no `DialogOverlay` when `modal={false}` (`@radix-ui/react-dialog` `dist/index.mjs:96`), and the shared overlay is `fixed`, which would cover the sidebar. |

**Mock line numbers** below were checked on 2026-11-01. When one looks wrong, grep the selector the row names (`.chip`, `.m-seg`, `.sr`, `.utab`, `.soon-list`, `.m-money`, `.soonx`).

**Sizes** (native px; "portrait" is the phone placement):

| Part | Numbers | Mock |
|---|---|---|
| Group | `bottom: 16` (portrait 10); `padding: 5`; `gap: 2`; full radius (portrait 26); `width: max-content`; centred on the stage | 117–120 |
| Section button | `h-44`, `min-w-44`, `px-12`, 13.5 px / 800 (portrait: `min-w-40`, `px-10`, 13 px); muted text. Open: raised fill, `inset 0 0 0 1px` pop, foreground text. | 122–124, 145 |
| Name slide | inline grid, `grid-template-columns` 0fr → 1fr over 300 ms; opacity over 180 ms, delayed 80 ms on open; `margin-left` 0 → 8 (portrait 6) | 126–128, 146 |
| Divider | 1 × 22, edge colour, `margin: 0 3px`, either side of the toggle; none on portrait | 132–133 |
| Toggle | `h-44`, `pl-12 pr-16`, `gap-8`, 13.5 / 800. Today: raised fill and pop inset. Build: primary fill, on-primary text. Names stacked in one cell (`grid-area: 1/1`); the outgoing name fades over 180 ms and drops 7 px; the arrows turn 180° over 350 ms. Portrait: `pl-10 pr-12`, `gap-6`, 13 px | 136–144 |
| Recenter wrap | `max-width` 0 → 60 over 300 ms, opacity over 180 ms | 149–150 |
| Home facts dot | 8 px attention dot at `top: 9`, `left: 26`, ringed 2 px in the group's surface | 129 |
| Build tint | `inset 0 0 0 3px` primary at opacity 0.55, fading over 250 ms | 108–109 |
| Modal | card fill, 1 px edge, radius 16 (portrait 20), shadow `0 24px 60px` deep | 164–165 |
| Modal head | `px-14 py-12`, `gap-10`, `min-h-67`, bottom edge. Icon tile 42, radius 12, raised fill. Title in the display face, 18 / 700. x button 42, radius 12, raised, `ml-auto`. Tag 10.5 / 800, `tracking-[.08em]`, uppercase, 1 px edge, `px-8 py-2`, full radius (Benefits: primary fill). | 172–176, 196 |
| Modal body / foot | Body: `pt-4 px-16 pb-16`, scrolls inside (keep `PANEL_SCROLL_CLASS`'s fade mask). Foot: `px-14 py-10`, top edge, `gap-10`, 12.5 px muted; row `min-h-40`, `gap-12`; link primary 800, `px-4 py-8`. | 197–202 |
| Search field | `h-44`, radius 12, ground fill, 1 px edge, `pl-12 pr-6`, `gap-10`; input 15 px. Focus within: pop edge plus a 3 px primary ring at 18%. Clear 32 × 32, radius 8, 15 px icon. Modify's head has no bottom edge and no min height. | 177–187 |
| Collapse region | `grid-template-rows` 0fr → 1fr over 260 ms, opacity over 200 ms; inner body gets a top edge | 190–194 |
| Rail | `bottom: 80`, centred, `padding: 5`, `gap: 4`, full radius, rises 8 px over 220 ms. Portrait: `left/right: 10`, `bottom: 72`, radius 22, `overflow-x: auto`, no scrollbar, no edge fades. | 224–226 |
| Rail chip | `h-40`, `px-14`, `gap-7`, 13 / 800, muted. Pressed: raised fill, inset 1 px primary, foreground. Build dot 6 px primary. Year built chip: foreground, its key muted 700 (unset: the key in attention). Separator 1 × 22, `margin: 0 2px`. | 227–234 |
| System card | card fill, edge, radius 16 (portrait 20), deep shadow, rise 10 px over 220 ms. Head: `py-10 pr-10 pl-12`, `gap-10`, bottom edge; icon tile 36 r10; title 16; x 36 r10. Body: `pt-12 px-14 pb-14`, `gap-10`. Row: one column, `gap-6`, label 11 / 800, `tracking-[.12em]`, uppercase, muted. Dimmed row's chips: opacity 0.45 (0.85 on hover and focus). | 235–250 |
| Chip | `h-34`, `px-11`, `gap-6`, full radius, 1 px edge, ground fill, 13 / 700. Tone dot 7 px. Caret at opacity 0.7, `-mr-3`. Open: primary edge plus inset 1 px primary. Picked build (`on`): raised fill, pop edge, 13 px check in primary. To add (`add`): dashed, muted, no fill. Missing (`miss`): attention edge at 60%, its key in attention. | `.chip` 290–301, 360–361, 395–396 |
| Value menu | `min-w-210`, `max-w-320`, raised fill, pop edge, radius 12, shadow `0 16px 40px`, `p-6`, `gap-1`; drops 4 px over 140 ms ease-out. Header 10.5 / 800, `tracking-[.14em]`, uppercase, muted, `px-10 pt-6 pb-4`. Item `min-h-40`, `px-10`, radius 8, 700, `gap-10`; check column 16 px in primary; unchecked muted; a picked build item's text in primary. Separator 1 px pop, `my-4 mx-2`. Row `px-10 py-6`, `gap-8`. | 303–313 |
| Fact row | `py-10`, bottom edge (none on the last), `gap-8`. Label 11 / 800, `tracking-[.12em]`, uppercase, muted. Value 13.5 / 700. Missing: the label in attention with a 6 px dot before it, and the value "Missing" in attention. | `.m-field` 263–268, 390–391 |
| Choice pill | inline-flex, wraps, `gap-2`, `p-3`, full radius (in the era block on portrait: 18), card fill, 1 px edge. Item `px-13 py-6`, full radius, 13 / 700, muted, `min-h-34`. Pressed: raised fill, inset pop, foreground. | `.m-seg` 269–272 |
| Home facts tabs | the panel's underline tabs: `gap-5.5` (portrait 16), trigger `min-h-11`, 14 / 700, 15 px icons, `gap-7`, primary underline. In the head: `ml-18`, `min-h-42`, centred on the title's line. Missing count: 18 high, `px-5`, full radius, 10.5 / 800, attention wash and text. Soon mark: 9.5 / 800 uppercase, dashed muted edge, `px-5`, `leading-15` (portrait: a 7 px dot with no text). On portrait the tabs show no icons. | `.utab` 256–257, 345–357 |
| Soon tiles | grid, `gap-8`, `pt-10`; each tile has a dashed pop edge, radius 10, `px-12 py-10`, `gap-2`; title 13.5 bold, hint 12 muted | `.soon-list` 392–394 |
| Era block | `p-12`, radius 12, ground fill, edge, `gap-10`. Line: 12.5 muted, `gap-x-10 gap-y-6`, codes bold in foreground; the kept note in attention 700. | 215–219 |
| Result row | `py-10`, bottom edge, `gap-8`. Scope tag 10 / 800 uppercase, edge, `px-7` (Build: primary text, primary edge at 45%). Name 14 / 800, truncates. Current value 13 muted at the right (Missing: attention 700). Enter mark 10.5 / 800, raised, radius 5 (hidden on portrait). Option 34 high, `px-11`, radius 8, edge, ground, 13 / 700, muted; current: raised, pop, foreground, check; Enter target: primary edge plus inset. A row just applied flashes a success wash over 1.1 s. | `.sr`, `.opt`, `.enter` 370–389 |
| Money field | `h-38`, `w-118`, radius 10, ground, edge, `px-10`, `gap-4`; input 800 with tabular numbers; `$` and `/mo` 12 muted | `.m-money` 280–282 |
| Benefits soon | centred grid, `gap-10`, `py-32`; title display 22; tag 10 / 800 uppercase, dashed muted, `px-7 py-2`; text 40ch | `.soonx` 258–260, `.soon-tag` 397 |
| Toast | top 14, centred, `px-14 py-8`, full radius, 13 / 800, primary fill; in 12%, holds to 80%, out over 1.9 s | `.toast` 159–160 |
| Focus ping | 120 px ring, 2 px primary; from scale 0.5 at opacity 0.9 to scale 1.15 at opacity 0, over 1.1 s, after 0.5 s | 251–252 |

**Placements** (stage px):

| Part | Wide (landscape and narrow) | Portrait |
|---|---|---|
| Modify | `top: 24`, centred, `width: min(780, stage − 48)`, `max-height: stage − 24 − 80` | `top: 12`, `left/right: 10`, `max-height: stage − 12 − 76` |
| Home facts | `bottom: 80`, centred, same width and max height | `left/right: 10`, `bottom: 76` |
| Benefits | `top: 24`, `left/right: 24`, `bottom: 80` | `top: 12`, `left/right: 10`, `bottom: 76` |
| System card | `top: 140`, `right: 104`, `width: 440` (P5) | `top: 12`, `left/right: 10` (P2) |
| Close-up card | `top: 16`, `left: 16`, `bottom: 80`, width 372 / 320 (P8) | `left/right: 12`, `bottom: 76`, `height: round(h × 0.46)` |

iPad portrait (820 × 1180) takes the portrait placements, with each modal capped at 780 wide and centred.

## Review Focus

1. **A pick inside the system card replays its entrance or jumps the camera.** Expect the card to stay mounted, keyed by the focus. A pick changes only the chips. Pinned in Task 7's slice: the card's element handle survives a chip pick.
2. **Escape order with a menu open inside Systems.**
   - The first press closes the menu only.
   - The second lets the system go.
   - The third closes Systems.
   - None of them leaves a close-up behind the rail.
   - Pinned in Task 9's `switch` slice.
3. **Typing in Modify triggers the scene's keys.** Typing "bmrtv4" must change nothing but the query. Pinned in Task 8's `modify` slice.
4. **A drag or a pinch on the scene closes Systems.** Turning or zooming the camera with a system in focus keeps the card; only a one-finger tap closes it. Pinned in Task 7's slice: a 40 px drag keeps the card, a two-pointer press keeps it, a tap closes it; and in `verify-scene-primitives.ts` (Task 7) for the tracker's `'tap'`.
5. **Flipping to Today with Benefits open leaves an empty modal.** Expect Benefits to close; the B key does the same. Pinned in Task 8's slice.
6. **Use code erases a hand-set Condition.** Use code resets only materials with an era guess; the roof's Worn survives. Pinned in Task 2's assertions.
7. **Tapping the picked choice again writes an empty value.** A single `ToggleGroup` sends `''` on a second tap of the pressed item; the pick stays. Pinned in Task 6's slice (tap Raised twice: Foundation still reads Raised).

---

## Task 0: Preconditions (controller only)

- [ ] **Step 1:** The owner has said build, execute or run in words.
- [ ] **Step 2:** Ask the owner whether the blueprint-load session and the paint-wear session are finished. A clean tree at one moment proves nothing; both committed or edited on 2026-11-01.
- [ ] **Step 3:** Run `git status --short` on every path this plan creates, modifies or deletes, plus `src/shared/components/scene/` and `CONTEXT.md`. On 2026-11-01 these held other sessions' edits: `scene-stage.tsx`, `trade-scene-view.tsx`, `use-scene-shortcuts.ts`, `home-scene-canvas.tsx`, `home-scene-copy.ts`, `ui/components/panel/material-choices.tsx`, `ui/components/panel/paint-wear-fields.tsx` (new), `ui/lib/compile-scene.ts`, `ui/components/blueprint/*`, `src/shared/components/scene/ui/scene-shell.tsx`. If any is still dirty with someone else's work, stop and tell the owner.
- [ ] **Step 4:** Confirm TS3b.4b (`docs/superpowers/plans/2026-10-30-up-close-on-a-system.md`) has not started. It builds after this plan, re-planned on this head.
- [ ] **Step 5:** Ask the owner whether each task commits when it passes. Create `.superpowers/sdd/2026-11-01-trade-scene-controls/` (gitignored) for reports.

## Task 1: Nullable climate, default bills, and the system focus type

**Files:**
- Create: `src/features/trade-scenes/constants/climate-bills.ts`
- Modify:
  - `src/features/trade-scenes/types.ts`: `climate`, `cameraFocus`, `SceneResolveInputs`, `HomeKitInputs`, `AssemblyKitProps.climate` stays `Climate`
  - `src/features/trade-scenes/constants/home-scene-defaults.ts`
  - `src/features/trade-scenes/lib/resolve-scene.ts`, `lib/scene-savings.ts`, `lib/scene-resolve-inputs.ts`
  - `ui/components/assembly-kits/assembly-kit-host.tsx:29`, `ui/components/home-scene-canvas.tsx:51`
  - `ui/components/panel/structure-section.tsx`: its climate pill reads the fallback until the section is deleted in Task 10
  - `hooks/use-crawl-camera-focus.ts`: writes `'foundation'`
  - `ui/components/home-kit/home-camera-rig.tsx:48`: reads `'foundation'`
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-load.ts`

**Interfaces:**
- Produces:
  - `CLIMATE_FALLBACK: Climate` (`'inland'`)
  - `CLIMATE_DEFAULT_BILLS: Record<Climate, Record<SavingsCategory, number>>`
  - `TradeSceneInputs.climate: Climate | null`
  - `TradeSceneInputs.cameraFocus: HomeSystemId | null`
  - `HomeKitInputs` keeps `climate: Climate`, resolved at the selector

- [ ] **Step 1: Write the failing assertions** in `scripts/verify-trade-scene.ts`, beside the existing `sceneSavings` assertions:

```ts
assert.equal(HOME_SCENE_DEFAULTS.climate, null, 'coastal or inland is missing until set')
assert.deepEqual(CLIMATE_DEFAULT_BILLS, { inland: { electric: 200, gas: 100 }, coastal: { electric: 155, gas: 110 } })
const billsOf = (climate: Climate | null, electric: number | null) => resolveScene({ ...HOME_SCENE_DEFAULTS, climate, view: 'proposed', bills: { ...HOME_SCENE_DEFAULTS.bills, electric: { ...HOME_SCENE_DEFAULTS.bills.electric, now: electric } } }, cuts).savings.cuts
assert.equal(billsOf(null, null).electric.bill, 200, 'no climate bills as inland')
assert.equal(billsOf(null, null).gas.bill, 100)
assert.equal(billsOf('coastal', null).electric.bill, 155)
assert.equal(billsOf('coastal', null).gas.bill, 110)
assert.equal(billsOf('coastal', 240).electric.bill, 240, 'a typed bill wins')
```

`cuts` is the script's existing `resolveTradeBillCuts()` (`verify-trade-scene.ts:147`); `resolveScene` takes `TradeSceneInputs` directly, as line 162 does. The existing `unknown.savings.cuts.electric.bill === 0` assertion (`:168`, "no bill typed") becomes 200 with the message "no bill typed: the inland default". `verify-trade-scene-load.ts` has no climate assertion; add `assert.equal(HOME_SCENE_DEFAULTS.climate, null)` beside its other defaults (`:44-46`).

- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: it fails on the climate default.
- [ ] **Step 3: Implement.**
  - `resolveScene` resolves `inputs.climate ?? CLIMATE_FALLBACK` once at its top, and that value feeds `homeHeat`, the comfort setpoint (`CLIMATE_PRESETS[climate]`) and `sceneSavings`. `sceneSavings` takes `climate: Climate` in its input and uses `bill.now ?? CLIMATE_DEFAULT_BILLS[climate][category]` inside `cutOf`.
  - The selection (`selectResolveInputs`, `lib/scene-resolve-inputs.ts`) keeps the raw nullable value.
  - `selectHomeKitInputs` and `selectKitScene` resolve the fallback.
  - The crawl hook and the rig switch `'under-floor'` to `'foundation'`; the rig's under-floor framing condition is otherwise unchanged.
  - Fix whatever else `pnpm tsc` reports by resolving at that callsite, never by widening a consumer to `Climate | null`.
- [ ] **Step 4:** Run `pnpm tsc`, `pnpm lint`, then the six verify scripts. Expected: all pass.
- [ ] **Step 5: Commit** (if the owner said yes), by pathspec: `feat(trade-scenes): coastal or inland is missing until set, and the bills default from it`.

## Task 2: One write vocabulary, and the pure libs Modify and Home facts read

**Files:**
- Create:
  - `src/features/trade-scenes/lib/apply-scene-change.ts`, `lib/missing-facts.ts`, `lib/era-code-line.ts`, `lib/scene-change-slots.ts`, `lib/search-scene-changes.ts`
  - `lib/material-option-choices.ts`: the option rules that today live inside `material-choices.tsx` (`EXISTING_DUCTS` `:49`, the roof types filtered by form `:58-62`, `hasAc` `:66` with the package unit, equipment shown when central **or unknown** `:113-118`)
  - `lib/upgrade-row-state.ts`: the rules inline in `scope-or-addon-row.tsx` (cool roof and R-8 on, cool shingles installed `:59-66`, the existing-state line for a metal or unset roof `:72-74`, the blocked reason vs `'base-included'`'s `baseIncludedLabel` `:247-250`)
  - `src/features/trade-scenes/constants/scene-change-words.ts`
  - `src/features/trade-scenes/hooks/use-apply-scene-change.ts`
- Modify:
  - `types.ts`: add `SceneChange`, `SceneChangeSlot`, `SlotGroup`, `HomeFactId`, `FactsTab`; remove `HomeMaterialChange` (P11)
  - `lib/home-material-patch.ts`: its parameter becomes the `Extract<SceneChange, …>` (P11)
  - `constants/home-scene-copy.ts`: add `CONTROLS_COPY` with every new string of spec §3 and the mock (list below); `SCOPES_AND_ADDONS_COPY.blocked['roof-not-set']` stops pointing at the deleted "Today › Home" tab ("Set the roof under Home facts")
  - `ui/components/panel/material-choices.tsx`, `scope-or-addon-row.tsx`: read the two new libs (they live until Task 10)
  - `ui/components/panel/wear-dots.tsx`, `ui/components/panel/shingle-colors.tsx`, `ui/components/panel/paint-wear-fields.tsx` (paint wear's, landed before this plan): write through `useApplySceneChange`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:

```ts
export type SceneChange
  = | { kind: 'property', patch: Partial<PropertyProfile> }
    | { kind: 'roof-form', form: RoofForm | null }
    | { kind: 'wear', id: HomeMaterialId, wear: Wear }
    | { kind: 'option', field: ReplaceableField, value: string | null }
    | { kind: 'era-guess', id: HomeMaterialId }
    | { kind: 'era-code' }
    | { kind: 'fact', patch: Partial<Pick<HomeMaterialFacts, 'gutters' | 'acTons' | 'shingleColor' | 'paintWear'>> }
    | { kind: 'scope', offer: PartOffer, scopeId: ScopeId | null }
    | { kind: 'efficiency-upgrade', upgrade: EfficiencyUpgradeId, on: boolean }
    | { kind: 'household', patch: Partial<TradeSceneInputs['household']> }
    | { kind: 'climate', climate: Climate }
    | { kind: 'bill', category: SavingsCategory, now: number | null }

export type SlotGroup = 'facts' | 'area' | 'systems' | 'existing' | 'proposed' | 'bills'
export type HomeFactId = 'foundation' | 'roof-form' | 'household' | 'age-group' | 'climate'
export type FactsTab = 'main' | 'household' | 'area' | 'lot'

export interface SceneChangeSlot {
  id: string
  group: SlotGroup
  name: string
  words: string
  options: readonly { value: string, label: string }[]
  current: string | null
  isFact: boolean
  // Set only on the two bill slots, which hold a money field instead of options.
  bill: SavingsCategory | null
  change: (value: string) => SceneChange
}
```

- Functions:
  - `applySceneChange(state: TradeSceneInputs, change: SceneChange, year: number): Partial<TradeSceneInputs>`
  - `useApplySceneChange(): (change: SceneChange) => void`, which calls `store.setState(state => applySceneChange(state, change, currentYear()))`. R153's saving attaches here later.
  - `HOME_FACTS: readonly { id: HomeFactId, tab: FactsTab, read: (state: TradeSceneInputs) => string | null }[]`, in tab order: foundation, roof-form, household, age-group, climate.
  - `missingFacts(state: TradeSceneInputs): HomeFactId[]`
  - `eraCodeLine(input: { property: PropertyProfile, home: ResolvedHomeMaterials }): { era: YearBuiltRange, guessed: boolean, codes: string[], kept: HomeMaterialId[] }`
  - `sceneChangeSlots(state: TradeSceneInputs, targets: SceneTargets, year: number): SceneChangeSlot[]`. **Modify and the system card both read it** (Task 7 looks slots up by id), so an option list is worked out once.
  - `searchSceneChanges(slots: readonly SceneChangeSlot[], query: string): { slot: SceneChangeSlot, hit: string | null }[]`
  - From `lib/material-option-choices.ts` and `lib/upgrade-row-state.ts`: the functions the two components' inline rules become, named for what they return (e.g. `roofTypeChoices(form)`, `existingDuctChoices`, `hasAcUnit(property)`, `showsEquipment(property)`, `upgradeRowState(row, state)`). The implementer names them; the slots, the chips and the old components all call them.

**`CONTROLS_COPY`:**
- Group:
  - names: Home facts, Systems, Modify, Benefits
  - "Scene controls"
  - `factsMissing(n)`: "Home facts, N missing"
  - `toggleName(build)`: "Showing the Tri Pros build; tap to show today" and its mirror
- Facts:
  - tabs: Main home, Household, Area, Lot
  - "Roof form", "Coastal or inland", "Missing", "soon"
  - the four soon tiles (spec §3.3)
- Systems:
  - "Systems", "Year built", "Sets today's materials"; the rail's "Built" is `PROFILE_COPY.yearBuilt` (`home-scene-copy.ts:88`), not new
  - "Showing today" / "Showing the build"
  - The row labels "Today" and "Tri Pros build" come from `SCENE_VIEW_LABELS` (`home-scene-copy.ts:61`), not new strings
  - "Nothing to add on a slab", "Condition"
  - `eraAttic`: `{ none: 'No attic insulation', low: 'R-11 attic', medium: 'R-19 attic', high: 'R-30 attic' }`, and `eraDucts`: `{ 'original-flex': 'Original ducts', 'r6-silver-flex': 'R-6 ducts' }` (`DUCT_LABELS` reads "Original", which loses the noun in the line). Both typed `as const satisfies Record<…>`, the file's idiom.
  - `eraLine(eraLabel, guessed)`: "`<era>` code:" or "Not sure, so `<era>`:"
  - `kept(names, count)`: "`<names>` kept as you set it." / "… kept as you set them." (`mock:731`; names joined with " and ")
  - "Use code"
- Modify:
  - field placeholders, wide and phone
  - "Search a change", "Clear search"
  - group tags `{ facts: 'Home facts', area: 'Area', systems: 'Systems', existing: 'Today', proposed: 'Build', bills: 'Bills' }`, typed `as const satisfies Record<SlotGroup, string>`
  - "Enter"
  - `noResults(q)`
  - `matches(n)`: "N changes match"
  - "Modify: search a change"
- Benefits:
  - "What the build brings", "Coming soon", the body sentence, "Tri Pros build"
  - `basedOn`: "Based on"
  - "Area missing"
  - `billsLine(climateLabel, electric, gas)`: "`<x>` · $200 electric · $100 gas"
  - "Edit bills" / "Close bills"
  - `billSource(category, typed, climateLabel)`: "Electric from the inland defaults" / "Electric as typed"
  - toast "Showing the Tri Pros build"

- [ ] **Step 1: Write the failing assertions** (spec §7):

```ts
const base = { ...HOME_SCENE_DEFAULTS }
const targetsOf = (state: TradeSceneInputs) => resolveScene(state, cuts, ASSEMBLY_KITS, YEAR)
const slotsOf = (state: TradeSceneInputs) => sceneChangeSlots(state, targetsOf(state), YEAR)
const top = (state: TradeSceneInputs, q: string) => searchSceneChanges(slotsOf(state), q)[0]
assert.equal(top(base, 'tile')?.slot.id, 'roof'); assert.equal(top(base, 'tile')?.hit, 'tile')
assert.equal(top({ ...base, property: { ...base.property, hvacType: 'central', hvacComponents: 'both' } }, '4')?.hit, '4', '"4" finds 4 ton')
assert.ok(slotsOf({ ...base, property: { ...base.property, hvacType: 'package-unit' } }).some(s => s.id === 'ac-tons'), 'a package unit has an AC size')
assert.ok(slotsOf({ ...base, property: { ...base.property, hvacType: null } }).some(s => s.id === 'hvac-components'), 'an unknown HVAC type still offers its equipment')
assert.deepEqual(searchSceneChanges(slotsOf(base), 'worn').map(r => r.slot.id).sort(), slotsOf(base).filter(s => s.id.startsWith('wear:')).map(s => s.id).sort())
assert.equal(top(base, 'attic fan')?.slot.group, 'proposed')
assert.equal(searchSceneChanges(slotsOf(base), 'zzqx').length, 0)
assert.equal(missingFacts(base).length, 5)
assert.equal(missingFacts(applyAll(base, [{ kind: 'property', patch: { foundationType: null } }])).length, 5, 'Not sure keeps a fact missing')
assert.deepEqual(missingFacts(applyAll(base, [{ kind: 'climate', climate: 'coastal' }])), ['foundation', 'roof-form', 'household', 'age-group'])
const line = eraCodeLine({ property: base.property, home: targetsOf(base).home })
assert.deepEqual(line, { era: '1950-1978', guessed: true, codes: ['R-11 attic', 'Single pane', 'Original ducts'], kept: [] })
assert.deepEqual(applySceneChange(base, { kind: 'roof-form', form: 'low-slope' }, YEAR).property?.roofType, 'flat')
const handSet = applyAll(base, [{ kind: 'property', patch: { roofType: 'shingle' } }, { kind: 'wear', id: 'roof', wear: 'worn' }, { kind: 'option', field: 'windowsType', value: 'double' }])
const coded = applyAll(handSet, [{ kind: 'era-code' }])
assert.equal(coded.homeMaterials.wear.roof, 'worn', 'Use code keeps the roof\'s Condition: the roof has no era code')
assert.equal(coded.property.roofType, 'shingle', 'Use code never touches the roof type')
assert.equal(coded.property.windowsType, null, 'Use code returns the windows to the era guess')
assert.deepEqual(eraCodeLine({ property: handSet.property, home: targetsOf(handSet).home }).kept, ['windows'])
```

`applyAll` is a two-line local helper folding `applySceneChange` over the list (it returns the full state). `cuts` and `ASSEMBLY_KITS` are the script's existing imports. Slot ids are as follows:
- facts: `household`, `age-group`, `foundation`, `roof-form`, `climate`
- `year-built`
- one per present material, by its `HomeMaterialId` (`roof` is the covering)
- `ac-tons`, `hvac-components`, `gutters`
- `wear:<HomeMaterialId>`
- `build:<partId>`
- `upgrade:<EfficiencyUpgradeId>`
- `bill:electric`, `bill:gas`

- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene.ts`. Expected: it fails, because the functions are not defined.
- [ ] **Step 3: Implement.**
  - `applySceneChange` dispatches each change to its function:

    | Kind | Writes through |
    |---|---|
    | `property` | `propertyPatch` |
    | `wear`, `option`, `era-guess`, `fact` | `homeMaterialPatch` |
    | `era-code` | `era-guess` for every material with `HOME_MATERIALS[id].eraGuess !== null` **and** `optionBasis === 'recorded'`, chained in one write. The roof is recorded but has no era code, and `era-guess` on it would clear its wear (`home-material-patch.ts:51-58`). |
    | `scope` | `scopePick` |
    | `efficiency-upgrade` | `efficiencyUpgradePatch` |
    | `household` | merge |
    | `climate` | set |
    | `bill` | `bills[category].now` |
    | `roof-form` | `structure-section.tsx`'s `setRoofForm` rule: `null` → roofType `null`; low-slope → `'flat'`; pitched keeps a pitched type, else `'shingle'`. The rule moves here, then through `propertyPatch`. |

  - First move the inline rules into `lib/material-option-choices.ts` and `lib/upgrade-row-state.ts`, point `material-choices.tsx` and `scope-or-addon-row.tsx` at them, and assert each rule (package unit has AC; unknown HVAC shows equipment; no R-8 among existing ducts; roof types by form; the blocked vs base-included reason).
  - Slots, in this order: facts, `year-built`, existing materials (`HOME_MATERIAL_IDS` present in `targets.home`, each followed by its wear slot; `ac-tons` after heating-cooling when the AC-unit rule says so; `hvac-components` when the equipment rule says so; `gutters` after roof), proposed rows from `upgradeRows`, efficiency upgrades, `climate`, then bills. Paint wear has no slot (it is set in the system card only).
  - Option sources are the two new libs: roof types filtered by form; a flat roof has one option, Torch down; a proposed slot's options are "No change" plus each scope's verb.
  - The era line's `codes` are attic, windows and ducts (the mock's line); `kept` lists every material with an era guess that is recorded (attic insulation, windows, exterior paint, ducts, crawl insulation).
  - Synonyms live in `SCENE_CHANGE_WORDS: Record<string, string>`, keyed by slot id. They are the mock's `SYN` and `SYS_SYN` and the slot words (`mock:757-777`), and they name the thing, never its values.
  - Search rules (spec §4.5):
    - Tokens split on whitespace.
    - A slot matches when every token prefixes a word of its name, its group tag, its words, or an option label.
    - A token that picks out exactly one option makes that option the hit.
    - A condition word (any `WEAR_LABELS` label) matches every `wear:` slot.
    - Ranking: an exact name match, then a value hit, then slot order. At most 8 results (`mock:800`).
  - `paint-wear-fields.tsx`, `wear-dots.tsx` and `shingle-colors.tsx` write through `useApplySceneChange` (`{ kind: 'fact', patch: { paintWear } }` for paint wear).
- [ ] **Step 4:** Run `pnpm tsc`, `pnpm lint` and the six verify scripts. Expected: all pass.
- [ ] **Step 5: Commit:** `feat(trade-scenes): one write vocabulary for every control, and the search, missing facts and era line it reads`.

## Task 3: Geometry, the camera's top, and a camera view per system

**Files:**
- Create: `src/features/trade-scenes/constants/system-camera-views.ts`
- Modify:
  - `src/shared/components/scene/types.ts`: `VisibleArea.top: number`, **required** (the only caller is `home-camera-rig.tsx:55`; the meeting cutaway has its own rig, `cutaway-canvas.tsx:40`)
  - `src/shared/components/scene/ui/camera-rig.tsx`: `AreaFractions` gains top; the all-zero early return includes top (`:53`); `frameVisibleArea` uses `setViewOffset(visibleW, visibleH, -left*width, -top*height, width, height)`; `panBy` reads top plus bottom, not only `applied.current[2]` (`:187`)
  - `src/shared/components/scene/lib/pan-scale.ts`: `panSpeedFor` and `visibleHeight` take `top + bottom`
  - `src/features/trade-scenes/constants/scene-layout.ts`: add `controls`, `systemCard`, `closeUp` and `CONTROLS_EASE`. Keep `card`, `bottomCard`, `buildSwitch`, `knob` and `recenter` until Task 10 deletes their last readers.
  - `types.ts`: `SceneVisibleArea.top`
  - `lib/scene-visible-area-for.ts`: new input (P13)
  - `lib/dock-layout-for.ts`: `dockRegionFor(shape, stage): { top, bottom }` for **every** shape, and it is `dockLayoutFor`'s only room input (today the wide shapes take their room from `SCENE_LAYOUT.buildSwitch`, `:33-34`). Portrait: `top: 16`, `bottom` above the keys button's corner as today's `dockRegionBottom` keeps it (`:23-27`), measured from the band
  - `ui/components/dock/scene-dock.tsx`: its `BUILD_SWITCH_CLEAR` (`:11-12`) reads `dockRegionFor`
  - `ui/views/trade-scene-view.tsx`: the dock region `div` (`:39,100`) reads `dockRegionFor`; `dockRegionBottom`'s import goes (`:16`)
  - `ui/components/scene-stage.tsx`: the interim visible-area input (below)
  - `ui/components/home-kit/home-camera-rig.tsx`: passes `top`; frames `SYSTEM_CAMERA_VIEWS` for `cameraFocus`
- Test: `scripts/verify-trade-scene-layout.ts`, `scripts/verify-scene-primitives.ts` (its `panSpeedFor`/`visibleHeight` lines, `:90-96`, gain a top case)

**Interfaces:**
- Produces:
  - `SCENE_LAYOUT.controls`: `{ groupBottom: { wide: 16, portrait: 10 }, groupHeight: 56, modalBottom: { wide: 80, portrait: 76 }, railBottom: { wide: 80, portrait: 72 }, modalTop: { wide: 24, portrait: 12 }, modalSide: { wide: 24, portrait: 10 }, modalWidth: 780 }`
  - `SCENE_LAYOUT.systemCard`: `{ top: 140, width: 440, dockGap: 10, portraitTop: 12, portraitSide: 10, visibleGap: 12 }`
  - `SCENE_LAYOUT.closeUp`: `{ gap: 16, width: 372, narrowWidth: 320, padding: 18, portrait: { side: 12, share: 0.46, gap: 12, padding: 20 } }`
  - `CONTROLS_EASE = [0.2, 0.8, 0.2, 1] as const`, plus the CSS string `CONTROLS_EASE_CSS`
  - `sceneVisibleAreaFor({ shape, width, height, zoomed, focusCardBottom }): SceneVisibleArea` with `{ left, right, bottom, top }`
  - `dockRegionFor(shape, stage): { top: number, bottom: number }` replaces `dockRegionBottom`
  - `SYSTEM_CAMERA_VIEWS: Record<HomeSystemId, (form: RoofForm, lift: number) => CameraFraming>`

- [ ] **Step 1: Write the failing assertions.** In `verify-trade-scene-layout.ts`, replace the `sceneVisibleAreaFor({ … collapsed … })` lines (the seven after the `stageShapeOf` lines, about `:355-361`) and the two `dockRegionBottom` lines (about `:371-372`). **Keep everything else**: the `propertyPatch` and `upgradeRows` assertions before the panel block are live (about `:298-328`), and the panel/build-switch block (`OPENING_PANEL_TABS` … `SCENE_LAYOUT.card.width`, about `:329-347`) and the `buildSwitchCompact` lines go in Task 10, with their code. Find each block by its first line, not by number.

```ts
const area = (shape: StageShape, width: number, height: number, zoomed = false, focusCardBottom: number | null = null) => sceneVisibleAreaFor({ shape, width, height, zoomed, focusCardBottom })
assert.deepEqual(area('landscape', 1180, 820), { left: 0, right: 94, bottom: 80, top: 0 })
assert.deepEqual(area('landscape', 1180, 820, true), { left: 388, right: 94, bottom: 80, top: 0 })
assert.deepEqual(area('narrow', 768, 700, true), { left: 336, right: 94, bottom: 80, top: 0 })
assert.deepEqual(area('portrait', 390, 844), { left: 0, right: 94, bottom: 76, top: 0 })
assert.deepEqual(area('portrait', 390, 844, true), { left: 0, right: 94, bottom: 76 + Math.round(844 * 0.46) + 12, top: 0 })
assert.deepEqual(area('landscape', 1180, 820, false, 400), { left: 0, right: 94 + 10 + 440, bottom: 80, top: 0 }, 'the card beside the system')
assert.deepEqual(area('portrait', 390, 844, false, 260), { left: 0, right: 94, bottom: 76, top: 260 + 12 }, 'the system below its card')
assert.deepEqual(area('portrait', 0, 0), { left: 0, right: 0, bottom: 0, top: 0 })
const { keysButton } = SCENE_LAYOUT
assert.deepEqual(dockRegionFor('portrait', { width: 390, height: 844 }), { top: 16, bottom: 76 + keysButton.gap + keysButton.size + keysButton.spacing }, 'above the keys button, which sits on the band')
assert.deepEqual(dockRegionFor('landscape', { width: 1440, height: 900 }), { top: 16, bottom: 80 }, 'the build switch\'s room is freed; the dock stays above the band')
```

The portrait line keeps today's rule (`555 + 16 + 44 + 8`, the region stops above the keys button's corner), now measured from the band.

Spec §7's `right = stage width − the card's left` comes to 544 by P5's rule.

- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene-layout.ts`. Expected: it fails.
- [ ] **Step 3: Implement.**
  - `dockLayoutFor` takes its portrait room from `dockRegionFor`.
  - `SYSTEM_CAMERA_VIEWS` targets come from the home's own points, each lifted by `homeLift(foundationType)` (see `liftedFraming`):

    | System | Target |
    |---|---|
    | roof | `HOME_ANCHORS[form].roof.position` |
    | attic | `HOME_ANCHORS[form].attic.position` |
    | windows | `READING_ANCHORS[form].window` |
    | walls | `READING_ANCHORS[form]['exterior-wall']` |
    | heating-cooling | `EQUIPMENT.condenser.position` (`constants/home-geometry.ts`) |
    | foundation | `HOME_ANCHORS[form]['under-floor'].position` |

  - Every view's camera sits at target + `SYSTEM_VIEW_OFFSET`, **derived** from `HOME_FRAMINGS.wide` (`home-geometry.ts:314`): its camera-minus-target direction at 1/`SYSTEM_VIEW_ZOOM` of its distance, with `SYSTEM_VIEW_ZOOM = 1.8`, the mock's iPad zoom (`mock:996`), and `fov: 34`. Comment the zoom and fov as working numbers tuned by eye. Each view is lifted with `liftedFraming`.
  - Heating & cooling aims at the condenser pad for every HVAC type; a package or wall unit draws no pad there, which is acceptable until TS3b.4b's system views (note it in the follow-ups file).
  - Foundation keeps today's `liftedFraming(HOME_ANCHORS.pitched['under-floor'].framing, lift)` when the home is partly open and raised.
  - The rig's framing order is: zoom framing, then the focus framing, then `homeFramingFor(aspect)`.
  - `visibleArea.top = area.top / stage.height`.
  - Until Task 10 the old card is still mounted and open by default, so `SceneStage` maps it as `zoomed: !collapsed, focusCardBottom: null`. On wide shapes that reproduces today's 388 / 336 left. On portrait the bottom becomes the close-up's `76 + round(h × 0.46) + 12` instead of the old card's `round(h × share) + gap`, a small upward shift that lasts until Task 10.
- [ ] **Step 4:** Run `pnpm tsc`, `pnpm lint` and the six verify scripts. Then open `/dashboard/labs/trade-scene` at 1180 × 820 and 390 × 844 with a throwaway Playwright screenshot: on 1180 the home frames as it did before the task (compare a shot taken before the edit); on 390 the home sits above the bottom card; the crawl view still looks under the floor.
- [ ] **Step 5: Commit:** `feat(trade-scenes): the camera keeps clear of a top cover, and each system has a view to glide to`.

## Task 4: Primitives: the provider, the shell, the menu, the pill, the collapse

**Files:**
- Create:
  - `src/features/trade-scenes/contexts/scene-controls-context.tsx`
  - `src/features/trade-scenes/contexts/system-card-bottom-context.tsx`: the card's measured bottom, apart from the controls' state, so a Modify keystroke never re-renders `SceneStage` (which reads the bottom) and with it `HomeSceneCanvas`
  - `src/features/trade-scenes/lib/controls-press.ts`: the section rules as pure functions over `{ open, focus, view }` (the shape of today's `lib/panel-tab-press.ts`, which a verify script pins)
  - `src/features/trade-scenes/constants/controls-classes.ts`
  - `ui/components/controls/controls-modal.tsx`, `controls-modal-head.tsx`, `controls-scrim.tsx`, `value-menu.tsx`, `choice-pill.tsx`, `controls-chip.tsx`, `collapse-region.tsx`, `controls-toast.tsx`
- Modify:
  - `contexts/scene-visible-area-context.tsx`: `SceneVisibleAreaValue.stageElement: HTMLDivElement | null`
  - `ui/components/scene-stage.tsx`: sets it from its ref in a layout effect
- Test: `scripts/verify-trade-scene-layout.ts` (the press rules)

**Interfaces:**
- Produces:

```ts
export type ControlsSection = 'facts' | 'systems' | 'modify' | 'benefits'
export type SystemsFocus = HomeSystemId | 'year-built' | null
interface SceneControlsValue {
  open: ControlsSection | null
  factsTab: FactsTab
  query: string
  billsOpen: boolean
  focus: SystemsFocus            // 'year-built' is provider state; a system is the store's cameraFocus
  toast: number                  // bumps to replay the toast
  openSection: (section: ControlsSection) => void
  close: () => void
  flip: () => void
  focusSystem: (focus: SystemsFocus) => void
  setQuery: (query: string) => void
  setFactsTab: (tab: FactsTab) => void
  toggleBills: () => void
}
export function SceneControlsProvider({ children }: { children: ReactNode })
export function useSceneControls(): SceneControlsValue
export function SystemCardBottomProvider({ children }: { children: ReactNode })
export function useSystemCardBottom(): { bottom: number | null, setBottom: (bottom: number | null) => void }
```

  The two types go in `types.ts`. The provider is the `panel-tabs-context.tsx` shape; read it first. Its actions call `lib/controls-press.ts`:

```ts
interface ControlsPressState { open: ControlsSection | null, focus: SystemsFocus, view: TradeSceneInputs['view'] }
interface ControlsPressResult extends ControlsPressState { toast: boolean }
export function pressSection(state: ControlsPressState, section: ControlsSection): ControlsPressResult
export function flipView(state: ControlsPressState): ControlsPressResult
export function pressFocus(state: ControlsPressState, focus: SystemsFocus): ControlsPressResult
```

  The provider writes `focus` (when a system) to the store's `cameraFocus` and `view` to the store's `view`, and bumps `toast` when `toast` is true.

- [ ] **Step 1: Write the failing press assertions** in `verify-trade-scene-layout.ts`:

```ts
const at = (open: ControlsSection | null, focus: SystemsFocus = null, view: 'existing' | 'proposed' = 'existing') => ({ open, focus, view })
assert.deepEqual(pressSection(at('facts'), 'facts'), { ...at(null), toast: false }, 'pressing the open section closes it')
assert.deepEqual(pressSection(at('systems', 'roof'), 'modify'), { ...at('modify'), toast: false }, 'leaving Systems lets the system go')
assert.deepEqual(pressSection(at(null), 'benefits'), { ...at('benefits', null, 'proposed'), toast: true }, 'Benefits on Today flips first')
assert.deepEqual(pressSection(at(null, null, 'proposed'), 'benefits'), { ...at('benefits', null, 'proposed'), toast: false })
assert.deepEqual(flipView(at('benefits', null, 'proposed')), { ...at(null), toast: false }, 'flipping to Today closes Benefits')
assert.deepEqual(flipView(at('systems', 'roof')), { ...at('systems', 'roof', 'proposed'), toast: false }, 'a flip keeps the system in focus')
assert.deepEqual(pressFocus(at('systems', 'roof'), 'roof'), { ...at('systems'), toast: false }, 'the same system again lets it go')
assert.deepEqual(pressFocus(at('systems', 'roof'), 'attic'), { ...at('systems', 'attic'), toast: false })
```

- [ ] **Step 2:** Run `pnpm tsx scripts/verify-trade-scene-layout.ts`. Expected: it fails, because the functions are not defined.

- Component props:
  - `ControlsModal({ children })`: **one** shell for the three sections (P17). The shared `Dialog` root, `open` set while `open` is facts, modify or benefits, `modal={false}`; `ControlsScrim`; `DialogPortal container={stageElement}` around `DialogPrimitive.Content` carrying the shared content's `isToastTarget` guard (P7). The section's head, body and foot come from the section components (Tasks 6 and 8) through a `SECTION_BODIES`-style switch in the shell's one consumer, `ControlsWindow` (Task 5).
    - `onInteractOutside` calls `preventDefault()` for targets inside `[data-scene-controls]` or `[data-value-menu]`; any other outside press, a part pin included, closes (P14).
    - `onOpenAutoFocus` sends focus to the body's first control (Modify: the input).
    - `onCloseAutoFocus` returns focus to the section's button (`[data-section-button="<section>"]`).
    - The content sets `--panel-padding` (today only `scene-card.tsx:47` sets it, and `PANEL_SCROLL_CLASS` reads it).
    - Placement follows the Placements table, per section. On open it rises; a section switch keeps the shell, moves it to the new placement, and cross-fades the body over 160 ms (`mock:167-168`).
    - It names itself by its section (`DialogTitle`, visually hidden for Modify, which has no head).
  - `ControlsScrim()`: an `absolute inset-0` div inside the stage portal, the scrim token of the Mock reference, fading in over 160 ms; a press on it closes.
  - `ValueMenu({ trigger, label, options, value, onPick, extra })`: the shared `Popover` and `PopoverTrigger`, with `PopoverPrimitive.Portal container={stageElement}` and `Content` (`collisionBoundary={stageElement}`, collision-aware), `data-value-menu`. The list is the shared `RadioGroup` (`src/shared/components/ui/radio-group`, as `wear-dots.tsx` and `scale-field.tsx` use it), with a check icon on the current one. `extra` takes the wear dots, paint wear, the AC size pill or the blocked reason. A pick closes the menu.
  - `ChoicePill<T extends string>({ label, value, options, labels, onChange })`: the `ChoiceFieldProps` shape (`types.ts`). A `ToggleGroup type="single"` styled as the Choice pill row, with Not sure inside. Its `onValueChange` keeps `SegmentedField`'s guard (`segmented-field.tsx:38-43`), with a comment saying why: a single toggle group sends `''` when the pressed item is tapped again, and that must not write.
  - `ControlsChip`: `variant: 'value' | 'on' | 'add' | 'miss'`, plus `tone?: StatusTone`, `icon?`, `keyLabel?`, `caret?`, `open?`. A button usable as a Popover trigger; it takes `ref` as a prop, as `button.tsx:50` does (the codebase has no `forwardRef`).
  - `CollapseRegion({ children })`: shows its children while they are truthy; while shutting it keeps its last children and clears them on `transitionend`. It leaves no padding or border behind.
  - `ControlsToast()` replays on each `toast` bump.

- [ ] **Step 3: Write `CONTROLS_CLASSES`** (`chip`, `chipOn`, `chipAdd`, `chipMiss`, `chipOpen`, `menu`, `menuItem`, `menuHeader`, `pill`, `pillItem`, `tile`, `closeButton`, `capsLabel`, `tag`, `field`) from the token map as written. The measurement happens in Task 6's slice (the first window on screen) and Task 7's (the first menu); each corrects `CONTROLS_CLASSES` if a value is off and writes the measured values into its report.
- [ ] **Step 4: Implement** the files above, sized from the Mock reference rows (Modal, Modal head, Value menu, Chip, Choice pill, Collapse region, Toast).
- [ ] **Step 5:** Run `pnpm tsc`, `pnpm lint` and `pnpm tsx scripts/verify-trade-scene-layout.ts`. Expected: they pass. The primitives mount in Task 5.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the controls' shell, value menu, pill, chip and collapse`.

## Task 5: The group

**Files:**
- Create:
  - `ui/components/controls/scene-controls.tsx`, `controls-section-button.tsx`, `build-toggle.tsx`, `controls-recenter.tsx`, `proposed-tint.tsx`, `controls-window.tsx` (the one `ControlsModal` and the switch that picks the open section's head, body and foot; Tasks 6 and 8 add their sections to it)
  - `.superpowers/sdd/2026-11-01-trade-scene-controls/controls-check.mjs` (gitignored): the Playwright check's harness and this task's slice
- Modify: `ui/views/trade-scene-view.tsx`: wrap the stage in `SceneControlsProvider` and `SystemCardBottomProvider` **inside** the existing `PanelTabsProvider`, and mount `SceneControls` and `ControlsWindow` beside the old card. The old card, build switch and Recenter chip stay mounted until Task 10; for Tasks 5–9 both show on the lab page.

**Interfaces:**
- Consumes: `useSceneControls` (Task 4), `SCENE_LAYOUT.controls` (Task 3), `missingFacts` (Task 2), `CONTROLS_COPY`.
- Produces: `SceneControls()`, which renders the proposed tint, then the toolbar `[data-scene-controls]`, with `role="toolbar"`, `aria-label`, and arrow-key roving; `ControlsWindow()`.

- [ ] **Step 1: Write the check's harness and the group slice** (failing). The harness:
  - uses `playwright` from the repo's node_modules and logs in through the session URL;
  - takes `--slice <name>` (run one slice) or none (run all);
  - runs each viewport: 1180 × 820, 820 × 1180, 390 × 844, and 1440 × 900 with the sidebar;
  - waits for `[data-load-phase="live"]`, measures with `evaluate`, saves screenshots to `.playwright-mcp/controls-<viewport>-<slice>-<step>.png`;
  - prints JSON and exits non-zero on the first failed check.

  The `group` slice, at each viewport:
  - the toolbar's centre is within 1 px of the stage's centre, and `document.scrollingElement.scrollWidth <= innerWidth`;
  - each section button and the toggle measure at least 40 × 40 by `elementFromPoint` at their edges (44 on wide shapes);
  - pressing a section grows its name's box from 0; on portrait the toggle's x moves 0 px, on wide shapes half the name's width, ±1;
  - the toggle's width is the same on Today and Build, its `aria-pressed` follows the view, and the proposed tint shows only on Build;
  - with the camera moved (a drag on the canvas), Recenter shows; pressing it hides it, and focus lands on the Modify button;
  - Home facts' accessible name is "Home facts, 5 missing" and its dot shows.
- [ ] **Step 2:** Run `node .superpowers/sdd/2026-11-01-trade-scene-controls/controls-check.mjs --slice group`. Expected: it fails, because the toolbar is not mounted.
- [ ] **Step 3: Implement**, sizes from the Group, Section button, Name slide, Divider, Toggle, Recenter wrap, Home facts dot and Build tint rows.
  - Order: Home facts (`House`), Systems (`Layers`), Modify (`SlidersHorizontal`), divider, the toggle (`ArrowLeftRight`), divider, Benefits (`Sparkles`), Recenter (`LocateFixed`).
  - Each section button carries `aria-expanded`, `aria-controls` and `data-section-button`. Modify's open state uses the primary fill (R162).
  - The toggle carries `aria-pressed` (build), the toggle name copy, and keycap `B` on fine pointers (`Keycap` and `keycapLabel`, as `recenter-chip.tsx` does).
  - Recenter shows when the camera is `moved` or a system holds the camera, and no section other than Systems is open (P10). A press with a focus clears it as well as recentring. When it hides under its own focus, focus goes to the Modify button (the `useLayoutEffect` in `recenter-chip.tsx`). Keycap `R`.
  - During the blueprint load (`useSceneLoad(state => state.phase !== 'live')`) the toolbar sits at opacity 0.6. The stage is already `inert` until `live` (`scene-stage.tsx`), so the toolbar adds no `inert` of its own.
  - The group never re-renders its siblings for a name: the name is pure CSS on `aria-expanded`.
- [ ] **Step 4:** Run `pnpm tsc`, `pnpm lint` and the `group` slice. Expected: they pass.
- [ ] **Step 5: Commit:** `feat(trade-scenes): the bottom group: sections, the one-size toggle and Recenter that comes and goes`.

## Task 6: Home facts

**Files:**
- Create: `ui/components/controls/home-facts-head.tsx`, `home-facts-body.tsx`, `home-facts-tabs.tsx`, `fact-row.tsx`
- Modify:
  - `constants/panel-layout.ts`: add `UNDERLINE_TAB_TRIGGER_CLASS`, the inline trigger string at `panel-sub-tabs.tsx:38`
  - `ui/components/panel/panel-sub-tabs.tsx`: reads the constant (until Task 10 deletes it)
  - `ui/components/controls/controls-window.tsx`: the facts section
  - `controls-check.mjs`: the `facts` slice

**Interfaces:**
- Consumes: `ControlsWindow` (Task 5), `ChoicePill`, `ScaleField` (`ui/components/fields/scale-field.tsx`), `missingFacts`/`HOME_FACTS`, `useApplySceneChange`.
- Produces: `HomeFactsHead()`, `HomeFactsBody()`, which `ControlsWindow` shows while `open === 'facts'`.

- [ ] **Step 1: Write the `facts` slice** (failing), at each viewport:
  - Home facts opens above the group at its Placements row; no element anywhere has the accessible name "Done";
  - **token measurement:** read the computed background and border of the window, a choice pill track, a pressed pill item and a soon tile, and compare them with the token map (record them in the report; fix `CONTROLS_CLASSES` if one is off);
  - wide shapes: the selected tab's label centre is within 1 px of the title's; portrait: the tabs sit in the body with no icons;
  - each tab's accessible name carries its missing count (Main home 2, Household 2, Area 1; Lot "soon");
  - picking Raised fills Foundation; the count drops to 1 and the group's name to "Home facts, 4 missing"; tapping Raised again keeps it (Review Focus 7); Not sure leaves Household missing (R191);
  - picking Coastal on the Area tab drops the Area count to 0 (Benefits' bills read the same value, Task 8).
- [ ] **Step 2:** Run the `facts` slice. Expected: it fails.
- [ ] **Step 3: Implement**, from the Fact row, Choice pill, Home facts tabs and Soon tiles rows, and `mock:735-741`.

  | Tab | Contents |
  |---|---|
  | Main home | Foundation (`HOME_PROFILE_CHOICES.foundationType`, Not sure in the pill); Roof form (`ROOF_FORMS`/`ROOF_FORM_LABELS`, **no** Not sure, P15) |
  | Household | Household (pill with Not sure); Age group (`ScaleField`) |
  | Area | Coastal or inland (`CLIMATES`/`CLIMATE_LABELS`, no Not sure), then two soon tiles |
  | Lot | Two soon tiles |

  - Each tab shows its missing count, or "soon" for Lot.
  - The tabs sit in the head on wide shapes (`align-self: center`, 18 px after the title, triggers 42 px tall). On portrait they take their own row at the top of the body, without icons.
  - Not sure writes `null`, and the fact stays missing (R191).
- [ ] **Step 4:** Run `pnpm tsc`, `pnpm lint`, and the `group` and `facts` slices. Expected: they pass.
- [ ] **Step 5: Commit:** `feat(trade-scenes): Home facts: four tabs, each with what it is missing`.

## Task 7: Systems: the rail, the card, the camera

**Files:**
- Create:
  - `ui/components/controls/systems-section.tsx`, `systems-rail.tsx`, `system-card.tsx`, `system-card-body.tsx`, `year-built-card-body.tsx`, `existing-chip.tsx`, `proposed-chip.tsx`, `focus-ping.tsx`
  - `hooks/use-scene-tap-away.ts`
- Modify:
  - `src/shared/components/scene/lib/create-tap-tracker.ts`: `up` returns `'tap' | 'double' | null`; a single tap that passes the tracker's own rules (one pointer, within `pressTravelPx`, within `tapMs`, not cancelled) returns `'tap'`. Its existing callers ignore `'tap'`.
  - `scripts/verify-scene-primitives.ts`: assert `'tap'` for one quick press, `null` for a two-pointer press, a long press and a 40 px drag
  - `constants/scene-control-icons.ts`: add `HOME_SYSTEM_ICONS` (the feature's icon maps live here)
  - `ui/components/panel/shingle-colors.tsx`: its line picker becomes `ChoicePill` (P6)
  - `ui/views/trade-scene-view.tsx`: `data-scene-canvas` on the canvas wrapper `div`; mount `SystemsSection`
  - `controls-check.mjs`: the `systems` slice

**Interfaces:**
- Consumes:
  - `useSceneControls().focus` and `focusSystem`, `useSystemCardBottom().setBottom`
  - `sceneChangeSlots` (the chips look slots up by id: `roof`, `wear:<id>`, `ac-tons`, `hvac-components`, `gutters`, `build:<partId>`, `upgrade:<id>`), `upgradeRowState`, `upgradeRows` (its `HomeSystemRow.material`, `types.ts:468-472`), `HOME_SYSTEM_LABELS`, `eraCodeLine`, `useApplySceneChange`, `ValueMenu`, `ControlsChip`, `WearDots`, `PaintWearFields`, `ShingleColors`
- Produces:
  - `SystemsSection()`: rail, card and ping, rendered while `open === 'systems'`
  - `useSceneTapAway(enabled: boolean, onTapAway: () => void): void`, built on `createTapTracker`
  - `HOME_SYSTEM_ICONS: Record<HomeSystemId, LucideIcon>`: roof `House`, attic `Layers`, windows `Square`, walls `Sparkle`, heating-cooling `Thermometer`, foundation `Layers` (`mock:515`)

- [ ] **Step 1: Write the `systems` slice** (failing), at each viewport:
  - the rail shows and no card; the Year built chip reads "Year built · Not sure" in attention;
  - Roof & gutters: on wide shapes the card's `right` equals stage width − 104, on portrait its `top` is 12; the camera frames the roof inside the visible area (project `HOME_ANCHORS.pitched.roof.position` to screen in `evaluate` through the rig's exposed camera, or compare a screenshot crop: the roof's centre lies left of the card and within the visible area);
  - **token measurement** inside an open value menu (its surface, an item, the check), recorded in the report;
  - a chip pick keeps the same card element (Review Focus 1); the menu is a `radiogroup` with `aria-checked` on the current item;
  - on Today, a pick on the dimmed Tri Pros build row applies and the view stays `existing`;
  - a flip swaps the tag and the dimmed row;
  - Heating & cooling swaps the card; on a package unit the card shows an AC size, as Modify does;
  - Year built: picking 1950–1978 shows "1950–1978 code: R-11 attic · Single pane · Original ducts"; with windows set by hand the line adds "Windows kept as you set it." and Use code clears it;
  - a 40 px drag and a two-pointer press on the canvas keep the card; a tap closes Systems (Review Focus 4); the ping played once per new system focus.
- [ ] **Step 2:** Run the `systems` slice. Expected: it fails.
- [ ] **Step 3: Implement**, from the Rail, Rail chip, System card, Chip, Value menu and Era block rows, and `mock:1014-1041`, spec §3.4.
  - **Rail:** Year built first (calendar icon, "Built" plus the range, or "Year built · Not sure" in attention), a separator, then one chip per `HOME_SYSTEM_IDS` with a primary dot when the build changes that system. The chip in focus is raised with a primary ring; on portrait it scrolls into the middle. `role="toolbar"`, arrow keys rove.
  - **Card:** keyed by the focus; a pick inside never remounts it. It measures its bottom with a `ResizeObserver` and calls `useSystemCardBottom().setBottom` while a system holds the camera, `null` otherwise.
    - Head: the system's icon tile, its name, the tag (primary on the build; hidden on portrait), the x.
    - Body: the "Today" and "Tri Pros build" rows (`SCENE_VIEW_LABELS`). The side the scene is not showing is dimmed, and its chips still work. A pick never flips the view.
  - **Existing chips:**
    - One per present material of the system: the system's `upgradeRows` rows' `material` (each `HomeSystemRow` carries it, looked up by `materialOfPart`), de-duplicated and kept only where present in `targets.home`; never a hand-written map.
    - Text: the slot's current option label, plus AC tons on heating-cooling, then " · " and the wear label. Gutters is its own chip after roof.
    - A slab foundation shows no existing chip; its build row shows the slab hint.
    - Each chip opens `ValueMenu` with its slot's options. Heating-cooling adds the `hvac-components` slot's list and the `ac-tons` slot's pill whenever those slots exist. A material with bands adds `WearDots` under "Condition"; exterior paint adds `PaintWearFields` under it.
  - **Proposed chips:**
    - One per upgrade row's scopes, read from the `build:<partId>` slot and `upgradeRowState`. A picked scope is `on` with a check; with nothing picked the chip is `add` with a plus and the row's verb.
    - A two-option row (No change or one scope) toggles on tap. A row with several scopes opens a menu of the verbs; a picked tear-off with cool shingles adds `ShingleColors` as `extra`.
    - Efficiency upgrades are their own chips (Cool roof; Step up to R-8). A disabled hint chip carries its reason in its menu (`PANEL_COPY.efficiencyUpgradeHints`).
    - A blocked row is a disabled dashed chip whose menu shows `upgradeRowState`'s reason (`SCOPES_AND_ADDONS_COPY.blocked` or `unitBlocked`; `'base-included'` shows `baseIncludedLabel`).
    - A system with no rows shows "Nothing to add on a slab".
  - **Year built card:** calendar tile, "Year built", the tag "Sets today's materials" (hidden on portrait), then the era block: a `ChoicePill` over `HOME_PROFILE_CHOICES.yearBuilt`, then the era line. Kept materials read in attention, followed by the **Use code** link (`{ kind: 'era-code' }`). It never moves the camera.
  - **Exits:**
    - The same chip again, the x, Escape (Task 10), Recenter, opening another section, and zooming into a close-up all release the focus.
    - `useSceneTapAway` feeds `[data-scene-canvas]`'s pointer events to a `createTapTracker` and closes Systems on `'tap'`. A drag, a pinch or a long press does nothing.
  - **Focus ping:** plays once per new system focus at the visible area's centre, after the glide (P9). It marks itself `data-ping` with a play count the slice reads.
- [ ] **Step 4:** Run `pnpm tsc`, `pnpm lint`, the six verify scripts, and the `group`, `facts` and `systems` slices. Expected: they pass.
- [ ] **Step 5: Commit:** `feat(trade-scenes): Systems: a rail, and the system in focus beside its card`.

## Task 8: Modify and Benefits

**Files:**
- Create: `ui/components/controls/modify-body.tsx`, `modify-search-row.tsx`, `missing-chips.tsx`, `modify-results.tsx`, `modify-result-row.tsx`, `benefits-head.tsx`, `benefits-body.tsx`, `bills-footer.tsx`
- Modify: `ui/components/controls/controls-window.tsx` (the modify and benefits sections), `controls-check.mjs` (the `modify` and `benefits` slices)

**Interfaces:**
- Consumes: `sceneChangeSlots`, `searchSceneChanges`, `missingFacts`, `ControlsWindow`, `CollapseRegion`, `ValueMenu`, `ChoicePill`, `UnitMoneyField` (`ui/components/fields/unit-money-field.tsx`), `useApplySceneChange`, `ControlsToast`.
- Produces: the Modify and Benefits heads, bodies and foot that `ControlsWindow` shows.

- [ ] **Step 1: Write the `modify` and `benefits` slices** (failing), at each viewport:
  - Modify: the input is focused on open; typing `bmrtv4` changes only the query (Review Focus 3); a polite live region announces "`N` changes match"; `tile` then Enter sets the roof covering and focus returns to the input; with all five facts filled through the missing chips, the region collapses to height 0 with no children; Escape clears, then closes;
  - Benefits: on Today it flips the view to the build and shows the toast "Showing the Tri Pros build"; the footer reads "Area missing · $200 electric · $100 gas"; with Coastal picked it reads "Coastal · $155 electric · $110 gas" (R184: the value Home facts set); Edit bills shows "Electric from the coastal defaults", typing 240 shows "Electric as typed", clearing it returns to 155; its box is identical before and after; flipping back closes Benefits (Review Focus 5).
- [ ] **Step 2:** Run the two slices. Expected: they fail.
- [ ] **Step 3: Implement Modify**, from the Search field, Collapse region and Result row rows, and `mock:163-195`. It has no head and no footer.
  - The search row is `InputGroup` (`@/shared/components/ui/input-group`): a Search icon, the input, and a clear button shown only with text. It has the placeholder copy (wide and phone) and is autofocused.
  - Empty query: a "Missing" group of `miss` chips, one per missing fact, each opening that fact's `ValueMenu`. With none missing, the collapse region shuts and the modal is the search row alone.
  - With text: the result rows, or the no-results line, plus a polite live region announcing "`N` changes match".
    - The top row shows the Enter mark when its hit differs from the current value.
    - A bill row holds a `UnitMoneyField` with `/mo`.
  - Enter applies the top hit. Escape with text clears it (`onEscapeKeyDown`: `preventDefault`, `setQuery('')`); Escape on an empty field closes. After any change, focus returns to the input unless a value menu is open.
- [ ] **Step 4: Implement Benefits**, from the Benefits soon and Modal foot rows, and `mock:756` (its body), `mock:862` (its tag).
  - The head carries the "Tri Pros build" tag.
  - The body is the coming-soon state.
  - The footer reads "Based on **`<Coastal|Inland|Area missing>` · $N electric · $N gas**", using each bill as typed or the climate default. It has an Edit bills / Close bills link.
  - Open bills shows a row: the climate `ChoicePill` (the same control as the Area tab), then the electric and gas money fields, then the source hint. Clearing a bill writes `now: null`, which goes back to the default.
  - The box never resizes: it is fixed by its Placements row.
- [ ] **Step 5:** Run `pnpm tsc`, `pnpm lint`, and all four slices so far. Expected: they pass.
- [ ] **Step 6: Commit:** `feat(trade-scenes): Modify as a search for one change, and Benefits coming soon over the bills`.

## Task 9: The cross-cutting checks (written before the switch-over)

**Files:**
- Modify: `.superpowers/sdd/2026-11-01-trade-scene-controls/controls-check.mjs`: the `switch` slice

- [ ] **Step 1: Write the `switch` slice** (spec §7, plus the Review Focus), at each viewport:
  1. The old card, build switch, knob and Recenter chip are gone; no element has the accessible name "Done".
  2. M opens Modify with an empty field (no M typed); `/` does nothing; the keys sheet lists M.
  3. Escape order with a menu open in Systems: the menu, then the focus, then Systems; no close-up is left behind the rail (Review Focus 2). With Home facts open, Escape closes it.
  4. B with Benefits open flips to Today and closes Benefits (Review Focus 5).
  5. A part pin with Home facts open closes the window and opens the close-up card (left on wide shapes, above the group on portrait) (P14); the group stays; opening a section on portrait hides the close-up card under the window and it reappears on close.
  6. Portrait: the keys button (when shown) sits above the band and clear of the rail.
  7. Under `emulateMedia({ reducedMotion: 'reduce' })`, the group's, the window's and the rail's computed `transition-duration` and `animation-duration` are `0s`.
  8. The `group` and `systems` slices repeated with the app in light and in dark (stored theme cleared, `emulateMedia({ colorScheme })`). The stage looks the same.
- [ ] **Step 2:** Run the `switch` slice. Expected: it fails at check 1, because the old card is still mounted.

## Task 10: Compose, shortcuts, the close-up card, and retiring the old card

**Files:**
- Create: `ui/components/panel/close-up-card.tsx`
- Modify:
  - `ui/views/trade-scene-view.tsx`: remove `PanelTabsProvider` (the controls' providers have wrapped the stage since Task 5); mount `CloseUpCard`; unmount the old card, knob, build switch and Recenter chip
  - `ui/components/scene-stage.tsx`: the visible area takes `zoomed` from the store and `focusCardBottom` from `useSystemCardBottom` (while `cameraFocus !== null`); add the `--scene-visible-top` var
  - `ui/components/home-scene-fallback.tsx`: it places by the `--scene-visible-*` vars with `top-0` hard-coded (`:23`); it reads `--scene-visible-top` (tsc never flags a CSS var)
  - `constants/scene-shortcuts.ts`, `hooks/use-scene-shortcuts.ts`, `ui/components/scene-keys-button.tsx`, `ui/components/shortcut-keys-dialog.tsx`
  - `constants/scene-layout.ts`: delete `bottomCard`, `buildSwitch`, `knob`, `recenter`, `shadowReach` and `card`; their readers are gone (Task 3 moved the dock's), and `closeUp` replaces `card`
  - `constants/scene-control-icons.ts`: delete `PANEL_TAB_ICONS`, `SUB_TAB_ICONS`, `BUILD_END_ICONS` and `PANEL_COLLAPSE_ICONS` and the `PanelTab`/`PanelSubTab` import (`:2`); no reader is left
  - `ui/components/panel/assembly-screen.tsx`: unchanged, but it is `PanelHeader`'s surviving importer, so `panel-header.tsx` stays
  - `types.ts`, `constants/home-scene-copy.ts`: removals below
  - `thermal-legend.tsx`, `callout-pin.tsx`, and whatever else `pnpm tsc` names: read `area.top` where they place by the area. `blueprint-paper.tsx` is off limits and needs nothing: it centres on left and right only (`:12,60`).
  - `scripts/verify-trade-scene-layout.ts`
- Delete (spec §8):
  - `ui/components/build-switch/` (6 files)
  - in `ui/components/panel/`: `scene-card.tsx`, `scene-panel.tsx`, `panel-knob.tsx`, `panel-sub-tabs.tsx`, `living-tab.tsx`, `home-tab.tsx`, `household-section.tsx`, `structure-section.tsx`, `materials-section.tsx`, `material-row.tsx`, `material-choices.tsx`, `wear-header.tsx`, `scopes-and-addons.tsx`, `scope-or-addon-row.tsx`, `efficiency-upgrade-chip.tsx`, `offer-kind-mark.tsx` (its one importer is `scope-or-addon-row.tsx`)
  - in `ui/components/fields/`: `tray-field.tsx`, `tray-group.tsx`, `slim-pair-value.tsx`, `glyphs/household-glyph.tsx`, `glyphs/hvac-glyph.tsx`, `glyphs/part-glyph.tsx`, `glyphs/roof-glyph.tsx` (their importers are all on this list; Step 1 confirms)
  - `contexts/tray-group-context.tsx`
  - `ui/components/recenter-chip.tsx`
  - `contexts/panel-tabs-context.tsx`
  - `hooks/use-panel-collapsed.ts`, `hooks/use-set-property.ts`, `hooks/use-set-home-material.ts`, `hooks/use-crawl-camera-focus.ts`
  - `constants/panel-tabs.ts`, `constants/panel-storage.ts`, `constants/build-switch.ts`
  - `lib/panel-tab-press.ts`, `lib/sub-tabs-of.ts`, `lib/build-switch-compact.ts`
  - `ui/lib/panel-fold-focus.ts`
- Keep unmounted with a `// LAZY:` first line ("Parked for the Benefits interior; re-homed or deleted there."):
  - `savings-tab.tsx`, `savings-bars.tsx`, `savings-bar.tsx`, `savings-figure.tsx`, `savings-read-amounts.tsx`, `counted-dollars.tsx`, `estimate-disclosure.tsx`, `cut-override.tsx`, `repairs-section.tsx`, `repairs-row-field.tsx`
  - None of them imports a file on the delete list (checked 2026-11-01); if Step 1 finds one, keep that export and list it.

- [ ] **Step 1: Inventory before deleting.** Run `rg -n "from '<path>'"` for every file in the delete list. Write each import still used outside the delete list into the task report, and keep that export. Run `rg` again for each copy key to remove:
  - `PANEL_TAB_LABELS`, `SUB_TAB_LABELS`, `STRUCTURE_COPY`
  - `PANEL_COPY.collapse` and `.expand`
  - `BUILD_SWITCH_COPY` except `.compact`
  - `HOME_MATERIALS_COPY.tapHint`, `HOME_MATERIALS_COPY.backToEraGuess` (P16)
  - `PROFILE_COPY.climate`
  - `SHORTCUT_COPY.lines.panel`

  Remove `PanelTab`, `PanelSubTab` and `PanelTabsState` from `types.ts`.
- [ ] **Step 2: Shortcuts.**
  - `SCENE_SHORTCUTS` drops `'/'` and adds `'m': 'modify'`; the sheet rows follow, with the new Modify line.
  - `useSceneShortcuts` reads `useSceneControls()`. It **keeps the blueprint load's gate** (no shortcut until the phase is `live`), which that session added to this file:
    - `b` → `flip()`, with the toggle as the focus fallback;
    - `m` → `openSection('modify')`, with the event already prevented, so no M is typed;
    - `r` → recenter when moved or a system holds the camera, clearing the focus;
    - `escape`: with Systems open, release the focus, else close Systems; otherwise leave the close-up only while nothing is open.
  - Radix layers prevent Escape first, so a menu and a modal take it before this handler (Review Focus 2).
  - `SceneKeysButton` on portrait sits at `bottom: band + keysButton.gap`; while the Systems rail or a window is open on portrait it hides (the rail spans the band's full width), and returns when they close.
- [ ] **Step 3: `CloseUpCard`.**
  - The card shell from `scene-card.tsx` (no fold, no knob), holding `<AssemblyScreen zoom={zoom} headerAction={<BackToHomeButton onBack={() => store.setState(LEAVE_CLOSE_UP)} />} />`. It renders only while `zoom !== null`, placed by the Close-up card row.
  - First line: `// LAZY: replaced by the general system view (TS3b.4b).`
  - It sets `--panel-padding`, as `scene-card.tsx:47` does today.
  - Zooming closes Systems; a part-pin tap with a window open closes the window first (P14).
  - On portrait, while a section window is open, the card is hidden under the window.
- [ ] **Step 4:** Rewrite the remaining `verify-trade-scene-layout.ts` assertions:
  - The sheet covers every key, `m` included and `/` not.
  - `SCENE_SHORTCUTS.m === 'modify'`.
  - `SHORTCUT_COPY.lines.modify === 'Modify: search a change'`.
  - Drop the panel/build-switch block (`OPENING_PANEL_TABS` … `SCENE_LAYOUT.card.width`), `buildSwitchCompact` and `SCENE_LAYOUT.recenter`.
- [ ] **Step 5:** Run `pnpm tsc`, `pnpm lint`, the six verify scripts, and the whole Playwright check (every slice). Expected: everything passes. Fix what fails in the task that owns the code, and re-run.
- [ ] **Step 6: Commit:** `feat(trade-scenes): the bottom group replaces the scene card; the close-up keeps a card until the system view`.

## Task 11: Responsive pass and polish

- [ ] **Step 1: Restart clean.** `ss -ltnp` to find the dev server, stop it, `rm -rf .next`, restart.
- [ ] **Step 2: Compare against the mock.** Run the Playwright check at every viewport. Put each screenshot beside the mock's frame at the same state; capture those with `node` and Playwright on `studies.html`, iPad and phone frames. List every visible difference in size, spacing, motion or copy.
- [ ] **Step 3:** Run `/impeccable polish src/features/trade-scenes/ui/components/controls`: one batched inspection round, desktop and mobile together. Fix every difference from Step 2 in one batch, at the narrowest correct level (token, class constant, or component). At most one confirmation round.
- [ ] **Step 4:** Run `pnpm tsc`, `pnpm lint`, the six verify scripts, and the whole Playwright check. Expected: everything passes.
- [ ] **Step 5: Commit**, then hand the owner the device check: the real iPad and the phone, through `pnpm dev:mobile`.
- [ ] **Step 6: Close out.**
  - Update the tracker's Controls row to "built" with the commit range, and its TS3b.4b row to "re-plan on the Controls head: its plan cites the scene card, panel, build switch and `'under-floor'` focus this build removed".
  - In `CONTEXT.md`, delete the Scene panel, Build switch and Knob entries (marked "goes when the Controls build ships"), and update Assembly screen ("what the close-up card shows up close").
  - Update the session memory `project-trade-scene-layout-exploration.md` (under `~/.claude/projects/…/memory/`, not the repo).
  - Write `docs/plans/2026-11-01-trade-scene-controls-follow-ups.md` for any decision the build made on the owner's behalf, plus: the Heating & cooling camera aims at the condenser pad for every HVAC type (TS3b.4b's system views).
  - Delete this plan and the spec once the owner says it shipped.

---

## Self-review against the spec

- **§2 decisions:** each one maps to a task.

  | Decision | Task |
  |---|---|
  | The group, R160–R180 | 5 |
  | The modals, R172 and R193 | 4, 6, 8 |
  | Home facts, R174–R192 | 6 |
  | Systems, R194, R171 and R179 | 7 |
  | Menus, R161 | 4 |
  | Modify, R178–R187 | 8 |
  | Climate and bills, R148 and R184 | 1, 8 |
  | Benefits, R166 and R188 | 8 |
  | Parked components, R189 | 10 |
  | The close-up card, R190 | 10 |
  | Not sure keeps a fact missing, R191 | 2, 6 |
  | The era guesses | 2 |
  | Persistence, R153 | 2, through the hook's single write |

- **§3 content:** the copy goes in `CONTROLS_COPY` (Task 2); the labels and choices come from the existing constants named in Tasks 6–8.
- **§4 architecture:**

  | Section | Task |
  |---|---|
  | §4.1 | 4, 10 |
  | §4.2 | 5 |
  | §4.3 | 4, with P7 and P4 |
  | §4.4 | 6–8 |
  | §4.5 | 2, 8 |
  | §4.6 | 1, 3 |
  | §4.7 | 10 |
  | §4.8 | 10 |
  | §4.9 | 3, 11 |
  | §4.10 | Global Constraints, 11 |
  | §4.11 | 4, 5, 8 |

- **§6 edge cases:**
  - Flat roof form: Task 2's `roof-form` change.
  - The HVAC shape: Task 2's slots and Task 7's chips.
  - Use code: Task 2's `era-code` change.
  - Clearing a bill: Task 8.
  - Systems exits: Tasks 7 and 10.
  - Benefits flips: Task 4 (`pressSection`, `flipView`, asserted).
  - The close-up with a modal open: Task 10, under P14 (a pin tap closes the window).
  - The load: Task 5.
  - Keys while typing: Task 9, check 5.
- **§7 verification:** Tasks 1–4 add the assertions; Tasks 5–8 each add and run their Playwright slice; Task 9 the cross-cutting slice; Task 11 the device check.
- **§8 files:** Tasks 1–10 cover every created, modified and deleted file. Added beyond the spec's list, each for a reason:
  - The shared rig's top (P1) and the tap tracker's `'tap'` (Task 7, under P1's permission for shared scene files).
  - `controls-classes.ts`: one place for the token map.
  - `controls-modal-head.tsx`, `controls-scrim.tsx`, `controls-window.tsx` (P17), `controls-chip.tsx`, `choice-pill.tsx` (P6), `controls-toast.tsx` and `focus-ping.tsx` (P9), the section heads.
  - `proposed-tint.tsx`, `systems-section.tsx`: one component per file.
  - `lib/controls-press.ts`, `lib/material-option-choices.ts`, `lib/upgrade-row-state.ts`: rules out of components, asserted.
  - `contexts/system-card-bottom-context.tsx`: keeps keystrokes from re-rendering the stage.
  - `use-scene-tap-away.ts` and `scene-change-words.ts`: no constants in components. `HOME_SYSTEM_ICONS` goes in the existing `scene-control-icons.ts`.
  - Orphans the spec's delete list missed (tray fields, glyphs, `slim-pair-value`, `offer-kind-mark`, `tray-group-context`), and `panel-header.tsx` kept (the close-up's `AssemblyScreen` imports it).
- **Type consistency:**
  - `SceneChange`, `SceneChangeSlot`, `SlotGroup`, `ControlsSection`, `SystemsFocus` and `FactsTab` are defined once (Tasks 2 and 4) and used by those names after.
  - `sceneVisibleAreaFor`'s input is the same in Tasks 3 and 10.
  - `dockRegionFor` replaces `dockRegionBottom` everywhere in Task 3.
