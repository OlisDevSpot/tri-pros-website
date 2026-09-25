# Presentation Config, Step Entrance and Critique Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the scroll presentation a shared home, `src/shared/components/presentation/`, as a typed engine (slides that carry a heading, an optional background and feature content; two frames; runs derived from the frames), rebuild meeting-flow step 1 (Who We Are) on it as the engine's first consumer, open the meeting with the branded splash held until the agent presses it, and land the round-2 critique fixes.

**Architecture:** Every slide is `{ id, frame?, heading, background?, content }` (`PresentationSlide<TContent>`). A pure `groupSlides` turns a slide list into `full` slides and runs of consecutive `column` slides, and is the one place `frame` defaults; each run is a grid whose first column is the sticky, fading heading column, and which turns into a top band below a 56rem presentation. One `Slide` component owns the `<section>` box and places the heading by its resolved frame. The scroller is the named `presentation` size container, scroll padding is 0, and every slide carries its own `scroll-margin-top: var(--band-h, 0px)`. The engine keeps its copy clear of whatever the host floats over it through one seam, `clearBottom` → `--presentation-clear-b`; meeting-flow passes `var(--stage-clear-b)`, which `StageFrame` publishes, and the engine never reads a `--stage-*` variable. Type and spacing come from rem-bounded role tokens in `globals.css`, owned by the engine. The splash is a controlled `SplashScreen` primitive (timed or on press); each feature composes its own and owns its visibility policy; the meeting composition mounts in the meeting-flow view outside the stage.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4.1.18 (`@theme inline` tokens, named container queries `[container:presentation/size]`, `@max-[56rem]/presentation:`, `@container/comparison`), `motion/react` v12 (`useInView` with `margin`, `AnimatePresence mode="wait"`, `useReducedMotion`), `next/image`, shadcn `Button`/`Dialog`, lucide icons, Playwright (verification scripts only), `tsx` (pure-function checks).

**Spec:** `docs/superpowers/specs/2026-09-20-presentation-config-and-critique-design.md` (spec C, revised 2026-09-22 with the CSS review, §11, and with the semantics grilling, §12). **§12 "Semantics and homes" is binding** over §2, §4, §5 and §8 wherever they differ; the vocabulary is `CONTEXT.md#presentation-terms`. Tracker: `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` (IDs C33–C46, L1–L9, U1–U14, E1–E8, S1–S18).

## Global Constraints

- Package manager is **pnpm**. Path alias `@/` maps to `src/`, `@public/` to `public/`. **Never run `pnpm build`.** Verification is `pnpm tsc` and `pnpm exec eslint <files>` (and `pnpm lint` once at the end).
- The working tree is **shared with the user's live editor**. `git stash`, `git checkout <ref> -- .`, `git restore` beyond your own task's files, `git reset`, `git add -A`, `git add .` and `git add -u` are forbidden.
- Work happens **on `main`**. Commit steps run only if the owner confirmed per-task commits at execution start; otherwise stop before the commit step and report the paths.
- **Commit recipe (exact).** (1) `git diff --cached --name-status | wc -l`, note N; (2) `git add -- <only the NEW files you created>`; (3) `git commit -m "…" -- <every path of your task: new, modified, deleted>`; (4) `git show --stat HEAD` lists only your paths and `git diff --cached --name-status | wc -l` prints N again. If either check fails, stop and report BLOCKED; do not repair git state. Messages end with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. **Never `git mv`:** it pre-stages the rename and breaks check (4). A move is: write the new file, `rm` the old one, list both paths in step (3); git reports the rename by similarity on its own.
- **Foreign uncommitted work.** Before editing any file, run `git diff --stat -- <file>`. If it shows changes you did not make, stop and report BLOCKED with the file name. Known exception, settled at pre-flight: `src/features/meeting-flow/ui/components/presentation/scrim.tsx` carries another session's one-line doc comment (see "Before Task 1").
- **Files off limits:** `src/trpc/**`, `src/shared/entities/**`, `src/shared/modules/**`, `src/shared/db/**`, `src/shared/services/**`, `src/shared/dal/**`, `docs/design-system/**`, seeds, `scripts/**`. If a task seems to need one, stop and report BLOCKED. (`src/shared/components/**` is in scope: the splash folder always was, and the engine's new home is there.)
- **Owner rule.** Anything outside a task's brief, or touching a shared component or the realtime/data path beyond what the task names, goes to the owner as a question. Never a controller ruling.
- Coding conventions (repo memory `coding-conventions`): one React component per file; no file-level constants or helpers in component, view, hook or context files (feature constants go to `constants/`, feature pure functions to `lib/`; the engine keeps its constants in `PE/motion.ts` and its pure functions in their own sibling `.ts` files, `group-slides.ts` and `slide-scroll-top.ts`, following the sibling-file precedent of `src/shared/components/splash-screen/`, with no nested `lib/`); named exports only; prop interfaces stay in the component file; `import type` for type-only imports; explicit `{ }` on every `if`; memoize every context value; `'use client'` on every component that uses hooks or motion, and on every `PE/*.tsx` component for consistency. Run `pnpm exec eslint --fix <files>` after writing a file.
- **Vocabulary (spec §12.1, `CONTEXT.md#presentation-terms`).** Code says *presentation*, *slide*, *frame* (`column` | `full`), *run*, *heading column*, *content*, *subheading*. "Beat" is the story word in `docs/sales/` and appears nowhere in code, not in a comment, not in the keyboard hint. "Stage" is the shell's word (`StageFrame`, `data-stage`, `--stage-inset-b`, `--stage-clear-b`) and the engine never uses it: the engine reads `var(--presentation-clear-b, 0px)`, never `--stage-clear-b`. Tools under `$WS/` may keep any name (they are git-ignored, not code).
- **Type:** no `font-medium` (weight 500, DESIGN.md) in any file this plan creates or touches. Titles `font-sans font-semibold` (Syne), figures `font-bold`, body inherits Nunito at normal weight. No serif italic (DESIGN.md "No serif-italic accent words"); the one serif left is the heading column's decorative numeral.
- **Sizes:** in the presentation, text sizes come only from the six role tokens (`text-presentation-{display,title,figure,lead,body,label}`) created in Task 2, with one exception: the heading column's decorative, `aria-hidden` numeral (`text-[11cqw]`). Spacing between groups uses `gap-presentation-{tight,group,zone}` / `p*-presentation-*`. No viewport `lg:`/`sm:`/`md:` variants in `PE/**` or `MF/ui/components/steps/who-we-are/**` once Task 6 lands (U7); mode changes use `@max-[56rem]/presentation:` (never `/stage:`) and the table uses `@max-[44rem]/comparison:`.
- **Colour:** no new colour literals. Accent is `text-(--presentation-accent)`, ground `bg-(--presentation-ground)`, scrim `oklch(var(--presentation-scrim) / <alpha>)`, white ink `text-white/NN`.
- Tailwind v4 content scanning does not reliably pick up classes that appear only in `.ts` files (repo memory `reference-tailwind-ts-classmap-scan-gap`): keep every utility class literal inside `.tsx` files.
- Motion: `motion/react` only. The flow wraps the stage in `MotionConfig reducedMotion="user"`, and `Presentation` has its own. Presentation easing is `BRAND_EASE` from `src/shared/constants/motion.ts` (Task 2), never `var(--ease-brand)` (declared only inside `.funnel-light`).
- **Smooth scrolling under reduced motion is out of scope (C44).** Do not add `motion-reduce:scroll-auto` and do not touch the global `* { scroll-behavior: smooth }` rule.
- **Dev server on port 3000 is the owner's.** Never start, stop or restart it; never touch `.next`. It compiled its CSS at boot, so classes added since render as nothing: every browser script injects a fresh build (`buildCss()` in `$WS/tools/common.mjs`) with `page.addStyleTag({ path })` before judging any style.
- **Browser.** Standalone Node scripts in `$WS/tools/`, importing Playwright from `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/node_modules/playwright/index.mjs`, headless. `setup()` in `$WS/tools/common.mjs` logs in through `/api/dev/playwright-session`, reading `DEV_LOGIN_SECRET` from `.env.local` at runtime; never print it or write it to a file. Dev meeting: `2069fa85-0357-4550-8eb5-6ae40eacf5a9`, step 1 (`?step=1`). Step 1 writes nothing to the meeting; scripts touch only `sessionStorage`.
- **Pure functions** get a throwaway assertion script in `$WS/checks/`, run with `pnpm exec tsx <script>` from the repo root; write it first, watch it fail, then implement.
- `$WS` = `.superpowers/sdd/2026-09-22-presentation-config-and-critique` (git-ignored). `MF` = `src/features/meeting-flow`. `PE` = `src/shared/components/presentation` (the engine; created in Task 3).

---

## File Structure

Every file the ten tasks create, modify or delete, with the task that touches it. `…/` under the feature rows is `MF/ui/components/steps/who-we-are/`.

**The engine, `PE = src/shared/components/presentation/`**

| File | Responsibility | Task |
|---|---|---|
| `PE/types.ts` (create) | `PresentationFrame`, `PresentationBackground`, `PresentationHeading`, `PresentationSlide<TContent>`, `IndexedSlide`, `PresentationGroup`, `SlideProps`, `PresentationHandle` | 3 |
| `PE/group-slides.ts` (create) | slides → `full` items and runs; the one place `frame` defaults to `'column'` | 3 |
| `PE/context.tsx` (create; `MF/contexts/presentation-context.tsx` moved) | `PresentationContext`, `usePresentation`, `SlideInViewContext`, `useSlideInView` | 4 |
| `PE/motion.ts` (create; `MF/constants/presentation-motion.ts` moved) | reveal, settle and heading-swap motion constants on `BRAND_EASE` | 4 |
| `PE/slide-scroll-top.ts` (create) | rect-delta jump target (F9) | 4 |
| `PE/presentation.tsx` (create; `snap-presentation.tsx` moved) | the scroller: `presentation` container, scroll padding 0, the shell seam (`rootAttributes`, `keyShortcuts`, `clearBottom`), rect-delta jumps | 4 |
| `PE/slide.tsx` (create; `snap-section.tsx` moved) | one slide: the `<section>` box, centre-line in-view, `--band-h`, the heading in its frame | 4 |
| `PE/slide-run.tsx` (create) | a run: grid, band mode, heading column + stack | 4 |
| `PE/heading-column.tsx` (create; `pinned-column.tsx` moved) | run-clamped heading, `aria-hidden`, band mode, tokens | 4 |
| `PE/slide-background.tsx` (create) | photo + scrim per frame | 4 |
| `PE/slide-image.tsx` (create; `section-image.tsx` moved) | photo with a required `sizes` | 4 |
| `PE/reveal.tsx` (create; `reveal.tsx` moved) | staggered reveal on the slide's in-view flag | 4 |
| `PE/scrim.tsx` (create; `scrim.tsx` moved) | `radial` / `center`, scrim variable; `heavy` gone | 4 |
| `PE/DOCS.md` (create) | engine rules: frames, runs, named containers, snap arithmetic, the centre-line rule, tokens, the seam (K8, S12) | 9 |

**The feature, `MF = src/features/meeting-flow/`**

| File | Responsibility | Task |
|---|---|---|
| `MF/ui/components/presentation/snap-section.tsx` (modify, then delete) | centre-line in-view (Task 1); moved to `PE/slide.tsx` | 1, 4 |
| `MF/ui/components/presentation/{snap-presentation,pinned-column,section-image,reveal,scrim}.tsx` (delete) | moved to `PE/` | 4 |
| `MF/contexts/presentation-context.tsx` (delete) | moved to `PE/context.tsx` | 4 |
| `MF/constants/presentation-motion.ts` (modify, then delete) | reveals on `BRAND_EASE`, `PRESENTATION_EASE` deleted (Task 2); moved to `PE/motion.ts` | 2, 4 |
| `MF/types/index.ts` (modify) | `WhoWeAreContent`, `WhoWeAreContentOf`, `WhoWeAreSlide`, `BeforeAfterMedia`, `PresentationPartner` added (Task 3); `PresentationHandle`, `PointMedia`, `PinnedSummary`, `WhoWeAreSection` deleted (Task 4) | 3, 4 |
| `MF/constants/due-diligence.ts` (modify) | sentence-case stat labels (U13) | 3 |
| `MF/constants/who-we-are-sections.ts` (modify, then delete) | `WHO_WE_ARE_SLIDES`, `WHO_WE_ARE_GROUPS`, `PROOF_POINT_COUNT` beside the old arrays (Task 3); renamed to `who-we-are-slides.ts` without them (Task 4) | 3, 4 |
| `MF/constants/who-we-are-slides.ts` (create) | the ten slides, grouped once at module scope; `COMPARISON_COLUMNS` | 4 |
| `MF/constants/keyboard-hints.ts` (modify) | hint label "Previous / next slide in the presentation"; `KEY_SHORTCUTS` unchanged | 4 |
| `MF/hooks/use-meeting-flow-keys.ts` (modify) | `PresentationHandle` imported from the engine | 4 |
| `MF/ui/views/meeting-flow.tsx` (modify) | `PresentationHandle` imported from the engine (Task 4); splash state, mount, focus handback (Task 8) | 4, 8 |
| `MF/lib/to-presentation-agent.ts` (modify) | "slide" in its doc comment (Task 4); headshot only, no account photo (U10) | 4, 6 |
| `…/index.tsx` (rewrite) | `Presentation` + groups → `Slide` / `SlideRun`; the inline, exhaustive kind switch | 4 |
| `…/{credentials,sample,point,agent,team,comparison}-section.tsx` (modify) | `SlideProps<WhoWeAreContentOf<K>>`, `<Slide>` around the content, no heading in the content, tokens | 4, 5, 6 |
| `…/closing-section.tsx` (create) | slide 10: quote + CTA (U3) | 4 |
| `…/before-after-pair.tsx` (create) | performance pair at true proportions (U12) | 4 |
| `…/check-list.tsx` (create) | one list style for agent and team (U13) | 4 |
| `…/{point-layout,proof-figure}.tsx` (modify) | `--presentation-clear-b`, tokens | 4 |
| `…/{credential-documents,document-stack}.tsx` (modify) | `Reveal` from the engine (Task 4); tap cues, no rotation (Task 6) | 4, 6 |
| `…/{hook-section,point-heading,point-media-layer,truth-section,placeholder-slot}.tsx` (delete) | replaced by `Slide`'s frames, `BeforeAfterPair`, `ClosingSection` | 4 |
| `…/comparison-table.tsx` (modify, then delete) | `density` deleted (C42); replaced by the sheets | 4, 5 |
| `…/comparison-sheet.tsx`, `…/comparison-sheets.tsx` (create) | C2's two sheets, `comparison` container (U4, F8) | 5 |
| `public/meeting-flow/placeholders/sample-scope-page.jpg` (modify) | no developer text (U10) | 6 |
| `…/agent-card.tsx` (modify) | monogram, sized to content, unrotated, tokens (U10, U13) | 6 |
| `…/tap-cue.tsx` (create) | "Tap to view" (U11) | 6 |
| `…/{document-card,document-dialog,reputation-mark}.tsx` (modify) | tap cues, no rotation, 44px close, scrim variable, tokens | 6 |
| `MF/DOCS.md` (create) | the Who We Are deck, the kind switch, the splash use (K8, S12) | 9 |

**Shell and tokens**

| File | Responsibility | Task |
|---|---|---|
| `src/app/(frontend)/globals.css` (modify) | six text role tokens and three spacing tokens in `@theme inline`; the presentation palette moves from `[data-stage]` to `:root`, with the new `--presentation-accent` value and `--presentation-scrim`; a comment naming `PE/` as the owner | 2 |
| `MF/ui/components/shell/stage-frame.tsx` (modify) | publishes `--stage-clear-b` (C45); `inert` while the splash is open (E4) | 2, 8 |
| `src/shared/constants/motion.ts` (modify) | `BRAND_EASE` | 2 |

**The splash**

| File | Responsibility | Task |
|---|---|---|
| `src/shared/components/splash-screen/splash-timing.ts` (create) | the mark's timing and everything derived from it (S3, C40) | 7 |
| `src/shared/components/splash-screen/is-splash-press.ts` (create) | press predicate: which keys dismiss (E4) | 7 |
| `src/shared/components/splash-screen/splash-copy.ts` (create) | the primitive's own press cue, "Press to begin" (S14) | 7 |
| `src/shared/components/splash-screen/splash-screen.tsx` (create; replaces `splash-overlay.tsx`) | controlled `SplashScreen({ open, onDismiss, dismiss, title?, subheading?, ease?, motionKey })`, `data-splash` root (S14) | 7 |
| `src/shared/components/splash-screen/splash-mark.tsx` (create; replaces `splash-animation.tsx`) | the animated brand mark, at rest under reduced motion (E7) | 7 |
| `src/shared/components/splash-screen/splash-caption.tsx` (create) | title + subheading under the mark, after it lands (E2, E3) | 7 |
| `src/shared/components/splash-screen/{splash-overlay,splash-animation,proposal-splash-screen}.tsx`, `use-splash-visibility.ts` (delete) | replaced by the primitive, `useSessionOnce` and the feature compositions (S15, S17) | 7 |
| `src/shared/hooks/use-session-once.ts` (create) | `useSessionOnce(key, enabled) → [open, dismiss]` (S15) | 7 |
| `src/shared/constants/storage-keys.ts` (modify) | `sessionStorageKey(...parts)`; `STORAGE_KEYS` untouched (S16) | 7 |
| `src/features/proposal-flow/ui/components/proposal-splash-screen.tsx` (create), `src/features/proposal-flow/constants/` (`PROPOSAL_SPLASH_KEY`), `src/app/(frontend)/proposal-flow/layout.tsx` (modify) | the proposal composition and its key move with the feature (S17) | 7 |
| `src/shared/components/splash-screen/pwa-splash-screen.tsx` (modify) | `SplashScreen` in timed mode + `useSessionOnce`; behaviour unchanged, still no callers | 7 |
| `MF/ui/components/meeting-splash-screen.tsx` (create) | the meeting composition: press mode, the step's title and subheading (E1–E7, S17) | 8 |
| `MF/hooks/use-meeting-splash.ts` (create) | once per meeting: `useSessionOnce(meetingSplashKey(meetingId), …)` (E5) | 8 |
| `MF/constants/splash.ts` (create) | `MEETING_SPLASH_COPY` and `meetingSplashKey` (S16, S17) | 8 |
| `MF/constants/` splash copy and `meetingSplashKey(meetingId)` (create) | the press label and the session key beside the hook that uses them (S16) | 8 |
| `MF/constants/step-config.ts` (modify) | `subheading?` on `MeetingStepConfig`, set on step 1 (E6, S18) | 8 |

**Docs and verification**

| File | Responsibility | Task |
|---|---|---|
| `docs/superpowers/specs/2026-09-20-presentation-config-and-critique-design.md`, `docs/superpowers/specs/2026-09-12-who-we-are-scroll-presentation-design.md`, `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md`, `memory/project-who-we-are-presentation.md` + `MEMORY.md` (modify) | status lines, tracker rows, C23's reversal | 9 |
| `$WS/tools/*.mjs`, `$WS/checks/*.ts` (git-ignored) | browser scripts and pure-function checks; never committed | 1–8, 10 |

---

## Rulings made while planning

Each is recorded so the owner can see it; none widens scope.

1. **`point` content's `media` is optional and is a before/after pair only** (`BeforeAfterMedia`). Spec §2 lists `media: PointMedia` as required, but spec §3 gives the supervision slide a `background` photo and no media. The `photo` arm of today's `PointMedia` moves to `background`. Cost if wrong: one type edit.
2. **`teamPhotoLabel` is dropped from the `team` content.** Spec §2 lists it, but U10 removes the only place it renders (the "to be shot" slot). Cost if wrong: one field.
3. **`credentials` content gains `openLabel`**, as `sample` already has, for U11's "Tap to view" cue.
4. **The splash timing constants live in `splash-timing.ts`**, the sibling module spec §5.1 names; recorded here because it is also what convention rule 2 requires (a component file holds no file-level constants). Same single source.
5. **`ProjectPhase` in spec §2 does not exist.** The type is `MediaPhase` (`src/shared/constants/enums/media.ts`). Moot since S8 keeps the `portfolio` background out of this spec, but recorded for spec D.
6. **The performance pair uses the tracked bathroom photos** `public/funnels/bathrooms/{before,after}-1.webp` (both 1280×714, used by the bathrooms funnel). The Riviera pair is gitignored and broken in production (U12).
7. **The splash opens the first time the flow is on step 1 in a browser session**, and the session key is written on the press, not on show, so a reload before the press shows it again (E5).
8. **The splash mounts in the outer `MeetingFlowView`**, beside the inner view, so it stays mounted while the meeting loads and is not remounted when the inner view swaps its loading tree for the ready tree. That would replay the mark. Focus returns to the step root when the splash closes (inner effect), not from `onExitComplete`: the splash sits outside the inner view's tree, and a state-driven handback does not race the autofocus the way the reviewer's timer did (F5).
9. **`Scrim`'s unused `heavy` variant is removed** when `center` is added. It has no callers.
10. **`N4` is not adopted** (spec §4.5): `activeIndex` stays on `PresentationContext`.
11. **The presentation palette moves from `[data-stage]` to `:root`.** U8 puts the document dialog's background on `--presentation-scrim`, and the dialog portals out of the stage, where a `[data-stage]` variable does not reach. The three tokens are theme-independent and have no other readers outside the flow. Cost if wrong: one selector.
12. **Spec §7.1 is taken as recommended, (c):** the heading column keeps shell correction C2's centring, and U1's alignment clause is recorded as superseded (Task 9).
13. **Semantics and homes: spec §12 (2026-09-22) is binding; vocabulary in `CONTEXT.md#presentation-terms`.** The engine lives in `src/shared/components/presentation/` with sibling `.ts` files and its own `DOCS.md`; beats are slides, `split` is `column`, `content` is `content`, `line`/`lineAccent` is `subheading: { text, accent? }`, the pinned column is the heading column, and the shell reaches the engine only through named props (`rootAttributes`, `keyShortcuts`, `clearBottom`). Where this plan and spec §2/§4/§5/§8 disagree, §12 wins and the plan follows it.

---

## Before Task 1 (controller, with the owner)

Owner answers, 2026-09-22. Copy them into the ledger before dispatching Task 1.

- [x] **H1: released 2026-09-22.** Step 2's V1 failures are fixed and re-run at `77c30a9f`: 28 PASS / 3 FAIL / 0 NOT RUN (`.superpowers/sdd/2026-09-14-specialties-stage-and-rail/task-v1-rerun-report.md`). Product fixes `725954a9` (focus handoff when unticking a trade's last item) and `77c30a9f` (top bar tabs hidden below a 42rem bar); G1, G3, W2 and the image check were harness bugs, now fixed. The 3 remaining FAILs are contrast on shared colour tokens — **owner: follow-ups, not part of this run** (runbook §7). Task 1 may be dispatched.
- [x] **Naming authority.** `CONTEXT.md#presentation-terms` is written and spec §12 is the naming authority for every identifier, file and token this plan creates. A worker who finds a name in this plan that contradicts §12 follows §12 and reports the line.
- [ ] **U8 reaches step 2: change it everywhere.** `--presentation-accent` moves from indigo `oklch(0.8 0.12 259.8)` to brand blue `#5cc6f2`. Step 2 reads the same variable at `showcase-text.tsx:42` and `showcase-fallback.tsx:18`, and the owner accepts that its accent changes too. Task 2 as written.
- [ ] **scrim.tsx: commit the foreign line on its own first.** Before Task 4, commit the other session's one-line doc comment in `src/features/meeting-flow/ui/components/presentation/scrim.tsx` as its own `docs(who-we-are): scrim doc comment` commit (path-only, commit recipe above). Task 4 then moves the file to `PE/scrim.tsx` on top of it, doc line kept verbatim.
- [x] **Execution (owner, 2026-09-22):** subagent-driven development in a fresh session after a compact. **One commit per task** on `main`, unpushed. **Owner gates after Tasks 2, 4, 6 and 8, plus the final report** — see the runbook §3; between gates the controller rules and keeps going. Verification injects a CSS build made from source that run; the owner restarts the dev server when they want to look.
- [ ] **Read `docs/superpowers/plans/2026-09-22-presentation-config-and-critique-runbook.md` first** — pre-flight checklist, the task loop, the gates, the anti-slop guards and the stop conditions.
- [ ] Create `$WS/tools/` and `$WS/checks/`.

---

## Phase 1: Layout

### Task 1: A slide is active when it crosses the presentation's centre line (F2)

Lands first: it is one line, independent of the restructure, and probably live on iPad portrait today (spec C §4.5). The code still lives at today's path, `MF/ui/components/presentation/snap-section.tsx`; Task 4 moves it to `PE/slide.tsx` and carries this rule with it. Only the `useInView` line and the doc comment change here; the component keeps its name until the move.

**Files:**
- Modify: `src/features/meeting-flow/ui/components/presentation/snap-section.tsx:19-32`
- Create: `$WS/tools/build-css.mjs`, `$WS/tools/common.mjs`, `$WS/tools/nudge-release.mjs`

**Interfaces:**
- Produces: `$WS/tools/common.mjs` exports `REPO`, `WS`, `MEETING_ID`, `STEP1_URL`, `setup({ width, height, reducedMotion })` → `{ browser, context, page }`, `buildCss()` → path of a fresh CSS build, `openStep1(page, { css })`, `dismissSplash(page)`, `deckState(page)` → `{ scrollTop, at, column }`. Every later browser script imports these. Its selectors, `[role="region"][data-step-root] section[id]` and `aside`, stay valid after Task 4: the engine keeps `role="region"`, the feature passes `data-step-root` through `rootAttributes`, `Slide` renders a `<section id>`, and `HeadingColumn` renders an `<aside>`.

- [ ] **Step 1: Write the tools**

`$WS/tools/build-css.mjs`:

```js
import fs from 'node:fs'
import { createRequire } from 'node:module'

const REPO = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
const require = createRequire(`${REPO}/package.json`)
const postcss = require(`${REPO}/node_modules/.pnpm/postcss@8.4.31/node_modules/postcss`)
const tw = require('@tailwindcss/postcss')
const from = `${REPO}/src/app/(frontend)/globals.css`
const out = await postcss([tw({ base: REPO })]).process(fs.readFileSync(from, 'utf8'), { from })
fs.writeFileSync(process.argv[2], out.css)
console.log('bytes', out.css.length)
```

`$WS/tools/common.mjs`:

```js
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/node_modules/playwright/index.mjs'

export const REPO = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
export const WS = path.join(REPO, '.superpowers/sdd/2026-09-22-presentation-config-and-critique')
export const MEETING_ID = '2069fa85-0357-4550-8eb5-6ae40eacf5a9'
export const STEP1_URL = `http://localhost:3000/dashboard/meetings/${MEETING_ID}?step=1`

/** Reads DEV_LOGIN_SECRET at runtime. Never printed, never written to a file. */
function readSecret() {
  const line = fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n').find(l => l.startsWith('DEV_LOGIN_SECRET='))
  let value = line.slice('DEV_LOGIN_SECRET='.length).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    value = value.slice(1, -1)
  }
  return value
}

/** A logged-in browser context. `reducedMotion: 'reduce'` emulates the OS setting. */
export async function setup({ width = 1440, height = 900, reducedMotion = 'no-preference', cookies = [] } = {}) {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion })
  if (cookies.length) {
    await context.addCookies(cookies)
  }
  const login = await context.newPage()
  // The secret must never reach an error message: Playwright puts the failing URL in its errors.
  try {
    await login.goto(`http://localhost:3000/api/dev/playwright-session?secret=${encodeURIComponent(readSecret())}&redirect=/dashboard/meetings`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  }
  catch (error) {
    await browser.close()
    throw new Error(`dev login failed (${String(error).split('\n')[0].replace(/secret=[^&\s]+/g, 'secret=REDACTED')}) — is the dev server running on :3000?`)
  }
  await login.waitForTimeout(800)
  await login.close()
  const page = await context.newPage()
  return { browser, context, page }
}

/** The dev server compiled its CSS at boot and misses classes added since: build the current CSS. */
export function buildCss() {
  const out = path.join(WS, 'tools/fresh.css')
  execFileSync('node', [path.join(WS, 'tools/build-css.mjs'), out], { cwd: REPO, stdio: 'inherit' })
  return out
}

/** Presses through the meeting splash if it comes up (Task 8 onward); a no-op before it exists. */
export async function dismissSplash(page) {
  const splash = await page.waitForSelector('[data-splash]', { timeout: 2000 }).catch(() => null)
  if (splash) {
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-splash]', { state: 'detached', timeout: 5000 })
  }
}

/** Opens step 1, injects `css` when given, and settles on the first slide. */
export async function openStep1(page, { css } = {}) {
  await page.goto(STEP1_URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('[role="region"][data-step-root] section[id]', { timeout: 90000 })
  if (css) {
    await page.addStyleTag({ path: css })
  }
  await dismissSplash(page)
  await page.waitForTimeout(800)
}

/** Where the presentation rests: scrollTop, the slide under a probe at 75% of the height, and the visible heading column's text. */
export async function deckState(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector('[role="region"][data-step-root]')
    const box = scroller.getBoundingClientRect()
    const probe = box.top + box.height * 0.75
    const at = [...scroller.querySelectorAll('section[id]')].find((section) => {
      const rect = section.getBoundingClientRect()
      return rect.top <= probe && rect.bottom > probe
    })
    const column = [...scroller.querySelectorAll('aside')].find((aside) => {
      const rect = aside.getBoundingClientRect()
      return rect.bottom > box.top && rect.top < box.bottom
    })
    return { scrollTop: Math.round(scroller.scrollTop), at: at?.id ?? null, column: column?.textContent ?? null }
  })
}
```

`$WS/tools/nudge-release.mjs`:

```js
// Spec C §4.5 (review F2): in band mode, nudge up from `communication` and let go. The
// presentation snaps back; the column must still name Communication, and ↓ must move on to `team`.
import { deckState, openStep1, setup } from './common.mjs'

const { browser, page } = await setup({ width: 820, height: 1180 })
const result = {}
try {
  await openStep1(page)
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(1000)
  }
  result.before = await deckState(page)
  const box = await page.locator('[role="region"][data-step-root]').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6)
  await page.mouse.wheel(0, -Math.round(box.height * 0.08))
  await page.waitForTimeout(1500)
  result.settled = await deckState(page)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(1200)
  result.after = await deckState(page)
  result.checks = {
    startedOnCommunication: result.before.at === 'communication',
    snappedBack: Math.abs(result.settled.scrollTop - result.before.scrollTop) <= 2,
    columnNamesCommunication: (result.settled.column ?? '').includes('Communication'),
    downMovesOn: result.after.scrollTop > result.settled.scrollTop + 100 && result.after.at === 'team',
  }
}
finally {
  await browser.close()
}
console.log(JSON.stringify(result, null, 2))
const failed = Object.entries(result.checks ?? {}).filter(([, ok]) => !ok).map(([name]) => name)
console.log(failed.length ? `FAIL: ${failed.join(', ')}` : 'PASS')
process.exitCode = failed.length ? 1 : 0
```

- [ ] **Step 2: Run it against today's build and watch it fail**

Run: `node $WS/tools/nudge-release.mjs`
Expected: `FAIL: columnNamesCommunication, downMovesOn` (the column says "Proper supervision"; ↓ targets the slide already shown). `startedOnCommunication` and `snappedBack` are `true`. If every check passes, the bug is not live on today's build: record that in the report and continue, because the spec keeps the fix either way.

- [ ] **Step 3: Switch `useInView` to the centre line**

In `snap-section.tsx`, replace the doc comment and the `useInView` line. The doc comment becomes (the only prose change is the new second paragraph, in the engine's vocabulary):

```tsx
/**
 * One snap target. The <section> box is never transformed: snap areas are computed
 * from the transformed border box, so every reveal lives on an inner element.
 *
 * In view means crossing the presentation's centre line, not showing half its height.
 * Slides are contiguous, so exactly one crosses at a time, and a slide that never left
 * the view never needs to report again; a slide under a band, or taller than two
 * screens, still reports (spec C §4.5, review F2).
 *
 * `scrollMarginTop: 0` is load-bearing: `src/app/(frontend)/globals.css` sets a
 * global `* { scroll-margin-top: 80px }` rule for the marketing site's fixed-header
 * anchors, which would otherwise shift every snap position by 80px. This inline
 * override is deliberate so it can't be lost to Tailwind's class-merge or
 * clobbered by a caller-supplied `className`.
 */
```

and line 32 becomes:

```tsx
  const inView = useInView(ref, { root: scrollerRef, margin: '-50% 0px -50% 0px' })
```

- [ ] **Step 4: Run it again and watch it pass**

Run: `node $WS/tools/nudge-release.mjs`
Expected: `PASS`.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint src/features/meeting-flow/ui/components/presentation/snap-section.tsx`
Expected: no output from either.

- [ ] **Step 6: Commit**

`fix(who-we-are): a slide is active when it crosses the presentation's centre line` — path: `src/features/meeting-flow/ui/components/presentation/snap-section.tsx`. The `$WS` tools are git-ignored.

---

### Task 2: Role tokens, presentation palette, capsule clearance and the brand ease (U5, U6, U8, C45, U14, S11)

**Files:**
- Modify: `src/app/(frontend)/globals.css` (the `@theme inline` block that starts near line 395; the `[data-stage]` palette block near line 1696)
- Modify: `src/features/meeting-flow/ui/components/shell/stage-frame.tsx`
- Modify: `src/shared/constants/motion.ts`
- Modify: `src/features/meeting-flow/constants/presentation-motion.ts` (at its current path; Task 4 moves it to `PE/motion.ts` and renames `PIN_SWAP_TRANSITION` there)
- Create: `$WS/tools/tw-build.mjs`, `$WS/tools/check-tokens.mjs`

**Interfaces:**
- Produces: utilities `text-presentation-{display,title,figure,lead,body,label}` and every spacing utility with `presentation-{tight,group,zone}` (`gap-presentation-group`, `pt-presentation-zone`, `py-presentation-tight`, `gap-x-presentation-tight`, …); at `:root` (moved from `[data-stage]`): `--presentation-ground` (unchanged), `--presentation-accent: #5cc6f2` and `--presentation-scrim: 0.14 0.03 257` (oklch **channels**, used as `oklch(var(--presentation-scrim) / 0.9)`); on `StageFrame`: `--stage-clear-b`, which only the feature reads (it hands it to the engine as `clearBottom` in Task 4); `BRAND_EASE: [number, number, number, number]` exported from `@/shared/constants/motion`. `PRESENTATION_EASE` no longer exists. `PIN_SWAP_TRANSITION` keeps its name and value until Task 4.

- [ ] **Step 1: Write the token check**

`$WS/tools/tw-build.mjs`:

```js
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const REPO = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
const GLOBALS = path.join(REPO, 'src/app/(frontend)/globals.css')

/** Compiles the named classes against the repo's real globals.css with the repo's Tailwind (4.1.18). */
export async function buildClasses(candidates) {
  const require = createRequire(path.join(REPO, 'package.json'))
  const fromPostcss = createRequire(require.resolve('@tailwindcss/postcss'))
  const { compile } = await import(fromPostcss.resolve('@tailwindcss/node'))
  const compiler = await compile(fs.readFileSync(GLOBALS, 'utf8'), { base: path.dirname(GLOBALS), onDependency: () => {} })
  return compiler.build(candidates)
}
```

`$WS/tools/check-tokens.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'
import { buildClasses } from './tw-build.mjs'

const REPO = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
const EXPECT = {
  'text-presentation-display': 'font-size: clamp(2.5rem, 4.3cqw, 5rem);',
  'text-presentation-title': 'font-size: clamp(1.75rem, 3.05cqw, 3.5rem);',
  'text-presentation-figure': 'font-size: clamp(1.5rem, 2.45cqw, 3rem);',
  'text-presentation-lead': 'font-size: clamp(1.25rem, 1.6cqw, 2.5rem);',
  'text-presentation-body': 'font-size: clamp(1.0625rem, 1.25cqw, 2.125rem);',
  'text-presentation-label': 'font-size: clamp(0.8125rem, 0.975cqw, 1.625rem);',
  'gap-presentation-tight': 'gap: 0.5rem;',
  'gap-presentation-group': 'gap: clamp(1.25rem, 3.3cqh, 2.5rem);',
  'pt-presentation-zone': 'padding-top: clamp(2rem, 5.7cqh, 4rem);',
}
const css = await buildClasses(Object.keys(EXPECT))
const failures = Object.entries(EXPECT).filter(([, declaration]) => !css.includes(declaration)).map(([name]) => name)
const read = file => fs.readFileSync(path.join(REPO, file), 'utf8')
if (!read('src/app/(frontend)/globals.css').includes('--presentation-accent: #5cc6f2;')) {
  failures.push('--presentation-accent')
}
if (!read('src/app/(frontend)/globals.css').includes('--presentation-scrim: 0.14 0.03 257;')) {
  failures.push('--presentation-scrim')
}
if (!read('src/features/meeting-flow/ui/components/shell/stage-frame.tsx').includes('[--stage-clear-b:calc(max(1rem,env(safe-area-inset-bottom))_+_5.5rem)]')) {
  failures.push('--stage-clear-b')
}
if (!read('src/shared/constants/motion.ts').includes('export const BRAND_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]')) {
  failures.push('BRAND_EASE')
}
console.log(failures.length ? `FAIL: ${failures.join(', ')}` : 'PASS')
process.exitCode = failures.length ? 1 : 0
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node $WS/tools/check-tokens.mjs`
Expected: `FAIL:` listing all nine utilities, `--presentation-accent`, `--presentation-scrim`, `--stage-clear-b`, `BRAND_EASE`.

- [ ] **Step 3: Add the tokens and the palette to `globals.css`**

Inside `@theme inline { … }`, directly after the line `  --font-serif: var(--font-serif);`, insert:

```css

  /* Presentation engine tokens. Owner: src/shared/components/presentation/ (spec C U5, U6, S11).
     Role scale: one clamp per role serves the heading column, the band and the comparison
     sheets, so nothing jumps at a threshold. The rem bounds give a floor and let browser zoom
     scale the text (max = 2 × min). `cqw` resolves at the element, against its nearest
     container: the presentation scroller, or the table inside `@container/comparison`. */
  --text-presentation-display: clamp(2.5rem, 4.3cqw, 5rem);
  --text-presentation-title: clamp(1.75rem, 3.05cqw, 3.5rem);
  --text-presentation-figure: clamp(1.5rem, 2.45cqw, 3rem);
  --text-presentation-lead: clamp(1.25rem, 1.6cqw, 2.5rem);
  --text-presentation-body: clamp(1.0625rem, 1.25cqw, 2.125rem);
  --text-presentation-label: clamp(0.8125rem, 0.975cqw, 1.625rem);

  /* Presentation spacing: tight ≈8, group ≈30, zone ≈51 px on a 900px-tall presentation. */
  --spacing-presentation-tight: 0.5rem;
  --spacing-presentation-group: clamp(1.25rem, 3.3cqh, 2.5rem);
  --spacing-presentation-zone: clamp(2rem, 5.7cqh, 4rem);
```

Replace the `[data-stage]` palette block and its comment (near line 1696) with:

```css
/* Presentation palette. Owner: src/shared/components/presentation/ (spec C U8, S11). One source
   for the presentation scroller, the floating step capsule and the document dialog. Declared at
   the root, not on the stage, because the dialog portals out of the stage and reads the scrim.
   The values were previously inline on the scroller in snap-presentation.tsx.
   `--presentation-accent` is brand blue on dark: the marketing dark theme's `--accent-ink`,
   which is scoped to `.theme-marketing.theme-dark` and not readable here.
   `--presentation-scrim` holds oklch channels, not a colour, so each caller adds its own
   alpha: `oklch(var(--presentation-scrim) / 0.9)`. */
:root {
  --presentation-ground: oklch(0.2 0.028 257);
  --presentation-accent: #5cc6f2;
  --presentation-scrim: 0.14 0.03 257;
}
```


- [ ] **Step 4: Publish `--stage-clear-b` from `StageFrame`**

Replace the doc comment and the returned element in `stage-frame.tsx`:

```tsx
/**
 * The meeting-flow root. `data-stage` opts the route out of the dashboard
 * template's padding and hides the mobile nav (app-shell.md,
 * `stage-routes-opt-out-with-data-stage`). `--stage-inset-b` is the strip the
 * floating capsule covers: capsule 48px + 16px offset + 16px breathing.
 * `--stage-clear-b` is where a step's copy may end: the capsule's own bottom
 * offset (`step-capsule.tsx`), its 48px height and 40px of clearance (spec C U6, C45).
 * A presentation step hands it to the engine as `clearBottom`; the engine itself
 * never reads a `--stage-*` variable.
 */
export function StageFrame({ ref, children }: StageFrameProps) {
  return (
    <div
      ref={ref}
      className="relative flex h-full min-w-0 flex-col [--stage-clear-b:calc(max(1rem,env(safe-area-inset-bottom))_+_5.5rem)] [--stage-inset-b:5rem]"
      data-stage
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Add `BRAND_EASE` and move the reveals onto it**

Append to `src/shared/constants/motion.ts`:

```ts

/**
 * The brand curve (DESIGN.md, `--ease-brand`). The CSS variable is declared only inside
 * `.funnel-light` in `globals.css`, so motion outside the funnels takes it from here.
 */
export const BRAND_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]
```

Replace `src/features/meeting-flow/constants/presentation-motion.ts` with:

```ts
import type { Transition, Variants } from 'motion/react'
import { BRAND_EASE } from '@/shared/constants/motion'

/** Every presentation reveal rides the brand curve (C29). */
export const REVEAL_TRANSITION: Transition = { duration: 0.5, ease: BRAND_EASE }

/**
 * Text groups rise into place. Transitions are set on the <Reveal> component, not
 * here, so a per-element stagger delay can be merged in.
 */
export const REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

/** Delay between sibling reveals inside one slide, in seconds. */
export const REVEAL_STAGGER_S = 0.09

/** Images settle from a slight zoom on first reveal. Applied to an inner wrapper only. */
export const IMAGE_SETTLE_VARIANTS: Variants = {
  hidden: { scale: 1.06 },
  visible: { scale: 1, transition: { duration: 1.8, ease: BRAND_EASE } },
}

/** The heading column's swap between slides: a plain ease-out, as approved in the prototype. */
export const PIN_SWAP_TRANSITION: Transition = { duration: 0.18, ease: 'easeOut' }
```

- [ ] **Step 6: Run the check and watch it pass**

Run: `node $WS/tools/check-tokens.mjs`
Expected: `PASS`.

- [ ] **Step 7: Type-check and lint**

Run: `grep -rn "PRESENTATION_EASE" src` — expected: no output.
Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow/ui/components/shell/stage-frame.tsx src/shared/constants/motion.ts src/features/meeting-flow/constants/presentation-motion.ts`
Expected: no output. If `--fix` reorders the classes on `StageFrame`, re-run `check-tokens.mjs`; it looks for the arbitrary property, not its position.

- [ ] **Step 8: Commit**

`feat(presentation): role tokens, palette at the root, capsule clearance, brand ease` — paths: `src/app/(frontend)/globals.css`, `src/features/meeting-flow/ui/components/shell/stage-frame.tsx`, `src/shared/constants/motion.ts`, `src/features/meeting-flow/constants/presentation-motion.ts`.

---

### Task 3: The engine's types, the ten slides and `groupSlides` (L1–L4, L8, L9, C3, C33–C35, C37, S1, S3, S5–S8, S13, U13 labels)

The engine folder is born with its two pure modules, `types.ts` and `group-slides.ts`; nothing renders from it yet. The feature's slide types and the ten slides land beside today's section array and section types. Task 4 switches every consumer over and deletes the old array and types in one change.

**Files:**
- Create: `src/shared/components/presentation/types.ts`
- Create: `src/shared/components/presentation/group-slides.ts`
- Modify: `src/features/meeting-flow/types/index.ts` (one import at the top; insert after `ComparisonRow`, near line 142)
- Modify: `src/features/meeting-flow/constants/due-diligence.ts` (the six `statLabel` values)
- Modify: `src/features/meeting-flow/constants/who-we-are-sections.ts`
- Create: `$WS/checks/group-slides.ts`

**Interfaces:**
- Produces (engine types, `@/shared/components/presentation/types`): `PresentationFrame` (`'column' | 'full'`), `PresentationBackground` (`{ kind: 'image', src, alt }`), `PresentationHeading` (`{ title, subheading?: { text, accent? }, number? }`), `PresentationSlide<TContent>` (`{ id, frame?, heading, background?, content }`), `IndexedSlide<TContent>` (`{ slide, index, frame }`, frame resolved), `PresentationGroup<TContent>` (`{ kind: 'full', item } | { kind: 'run', items }`), `SlideProps<TContent>` (`Omit<PresentationSlide<TContent>, 'frame'> & { index, frame }`), `PresentationHandle` (`{ next, prev }`; the feature's copy is deleted in Task 4).
- Produces: `groupSlides<TContent>(slides: PresentationSlide<TContent>[]): PresentationGroup<TContent>[]` from `@/shared/components/presentation/group-slides`, the one place `frame` defaults to `'column'`.
- Produces (feature types, `@/features/meeting-flow/types`): `WhoWeAreContent` (arms `hero`, `credentials`, `sample`, `point`, `agent`, `team`, `comparison`, `closing`), `WhoWeAreContentOf<K>`, `WhoWeAreSlide = PresentationSlide<WhoWeAreContent>`, `BeforeAfterMedia`, `PresentationPartner`.
- Produces (constants, `@/features/meeting-flow/constants/who-we-are-sections`): `WHO_WE_ARE_SLIDES: WhoWeAreSlide[]` (ten slides: `hook`, `licensing`, `scope`, `supervision`, `communication`, `team`, `performance`, `comparison`, `extras`, `closing`), `WHO_WE_ARE_GROUPS = groupSlides(WHO_WE_ARE_SLIDES)`, `PROOF_POINT_COUNT` (6). `COMPARISON_COLUMNS` unchanged. (Task 4 renames the file to `who-we-are-slides.ts`.)

- [ ] **Step 1: Write the failing check**

`$WS/checks/group-slides.ts`:

```ts
import assert from 'node:assert/strict'
import { groupSlides } from '@/shared/components/presentation/group-slides'

const heading = (title: string) => ({ title })
const slides = [
  { id: 'a', frame: 'full' as const, heading: heading('A'), content: 0 },
  { id: 'b', heading: heading('B'), content: 1 },
  { id: 'c', frame: 'column' as const, heading: heading('C'), content: 2 },
  { id: 'd', frame: 'full' as const, heading: heading('D'), content: 3 },
  { id: 'e', heading: heading('E'), content: 4 },
]

const groups = groupSlides(slides)
assert.deepEqual(groups.map(group => group.kind), ['full', 'run', 'full', 'run'])

const [first, run, , tail] = groups
assert.ok(first?.kind === 'full')
assert.deepEqual(first.item, { slide: slides[0], index: 0, frame: 'full' })
assert.ok(run?.kind === 'run')
assert.deepEqual(run.items.map(item => item.index), [1, 2])
// An undeclared frame resolves to 'column' here and nowhere else.
assert.deepEqual(run.items.map(item => item.frame), ['column', 'column'])
assert.deepEqual(run.items.map(item => item.slide.heading.title), ['B', 'C'])
assert.ok(tail?.kind === 'run')
assert.deepEqual(tail.items.map(item => item.index), [4])
assert.deepEqual(groupSlides([]), [])

console.log('group-slides: ok')
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec tsx $WS/checks/group-slides.ts`
Expected: FAIL with `Cannot find module '@/shared/components/presentation/group-slides'`.

- [ ] **Step 3: The engine's types**

Create the folder and `src/shared/components/presentation/types.ts`:

```ts
/**
 * The presentation engine's public types. Vocabulary: CONTEXT.md#presentation-terms.
 * Rules: see ./DOCS.md#frames and ./DOCS.md#runs
 */

/** Where a slide's heading sits: in its run's heading column (the default) or centred over the slide. */
export type PresentationFrame = 'column' | 'full'

/** The photo behind a slide. Image only; the trade-matched `portfolio` kind arrives with spec D. */
export interface PresentationBackground {
  kind: 'image'
  src: string
  alt: string
}

/** A slide's heading: shown in its run's column (`column`) or centred on the slide (`full`). */
export interface PresentationHeading {
  title: string
  /** The second line under the title; `accent` is its accent-coloured tail, e.g. 'due diligence.' */
  subheading?: {
    text: string
    accent?: string
  }
  /** Position in the numbered sequence; absent on unnumbered slides. */
  number?: number
}

/** One screen of a presentation. Generic over its content, so each feature authors its own slides (L9). */
export interface PresentationSlide<TContent> {
  id: string
  /** Defaults to `'column'`, resolved once by `groupSlides`. */
  frame?: PresentationFrame
  heading: PresentationHeading
  background?: PresentationBackground
  content: TContent
}

/** A slide with its position in the presentation and its resolved frame. */
export interface IndexedSlide<TContent> {
  slide: PresentationSlide<TContent>
  index: number
  frame: PresentationFrame
}

/** The presentation grouped for layout: a `full` slide alone, or a run of consecutive `column` slides sharing one heading column. */
export type PresentationGroup<TContent>
  = | { kind: 'full', item: IndexedSlide<TContent> }
    | { kind: 'run', items: IndexedSlide<TContent>[] }

/** What a slide component receives: the slide's fields with its resolved frame and its index, derived, never restated. */
export type SlideProps<TContent> = Omit<PresentationSlide<TContent>, 'frame'> & { index: number, frame: PresentationFrame }

/** Imperative surface a presentation exposes to its host's key map. */
export interface PresentationHandle {
  next: () => void
  prev: () => void
}
```

- [ ] **Step 4: Write `groupSlides`**

`src/shared/components/presentation/group-slides.ts`:

```ts
import type { PresentationGroup, PresentationSlide } from '@/shared/components/presentation/types'

/**
 * Groups slides for layout. A `full` slide stands alone; consecutive `column` slides form one
 * run that shares a sticky heading column (C37). `frame` defaults to `'column'` here and
 * nowhere else (L2): every item carries the resolved frame. See ./DOCS.md#runs
 */
export function groupSlides<TContent>(slides: PresentationSlide<TContent>[]): PresentationGroup<TContent>[] {
  const groups: PresentationGroup<TContent>[] = []
  for (const [index, slide] of slides.entries()) {
    const frame = slide.frame ?? 'column'
    const item = { slide, index, frame }
    if (frame === 'full') {
      groups.push({ kind: 'full', item })
      continue
    }
    const last = groups.at(-1)
    if (last?.kind === 'run') {
      last.items.push(item)
      continue
    }
    groups.push({ kind: 'run', items: [item] })
  }
  return groups
}
```

- [ ] **Step 5: Run the check and watch it pass**

Run: `pnpm exec tsx $WS/checks/group-slides.ts`
Expected: `group-slides: ok`.

- [ ] **Step 6: The feature's slide types**

In `src/features/meeting-flow/types/index.ts`, add one type import, in path order between the calendar and enums imports:

```ts
import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { PresentationSlide } from '@/shared/components/presentation/types'
import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums'
```

and insert directly after the `ComparisonRow` interface:

```ts

/** A before/after pair shown side by side at the photos' own proportions. */
export interface BeforeAfterMedia {
  before: string
  after: string
  alt: string
  width: number
  height: number
}

/** The senior partner introduced on the Team slide. */
export interface PresentationPartner {
  name: string
  title: string
  image: string
  points: string[]
}

/**
 * The feature-specific content of each Who We Are slide, by kind. `hero` is empty: the hook is
 * its heading and photo alone (owner, 2026-09-20). Deck rules: see ../DOCS.md#who-we-are-deck
 */
export type WhoWeAreContent
  = | { kind: 'hero' }
    | { kind: 'credentials', documents: PresentationDocument[], protection: ProofFigure[], reputation: ReputationMark[], openLabel: string }
    | { kind: 'sample', proof: ProofFigure, document: PresentationDocument, openLabel: string }
    | { kind: 'point', proof: ProofFigure, media?: BeforeAfterMedia }
    | { kind: 'agent', cardRole: string, commitments: string[] }
    | { kind: 'team', proof: ProofFigure, partner: PresentationPartner }
    | { kind: 'comparison', rows: ComparisonRow[] }
    | { kind: 'closing', quote: string, cta: { label: string } }

/** One arm of `WhoWeAreContent`, e.g. `WhoWeAreContentOf<'point'>`. */
export type WhoWeAreContentOf<K extends WhoWeAreContent['kind']> = Extract<WhoWeAreContent, { kind: K }>

export type WhoWeAreSlide = PresentationSlide<WhoWeAreContent>
```

The old `PointMedia`, `PinnedSummary` and `WhoWeAreSection` stay for one task; Task 4 deletes them.

- [ ] **Step 7: Sentence-case the stat labels (U13)**

In `constants/due-diligence.ts`, change only the six `statLabel` values: `'CA License'` → `'CA license'`, `'Written & Detailed'` → `'Written & detailed'`, `'Supervisors Per Job'` → `'Supervisors per job'`, `'Dedicated Contact'` → `'Dedicated contact'`, `'Support Staff'` → `'Support staff'`, `'Projects Completed'` → `'Projects completed'`. Its only consumer is `who-we-are-sections.ts` (`grep -rn "DUE_DILIGENCE_ITEMS" src` shows two lines, both in that file).

- [ ] **Step 8: Add the slides**

In `constants/who-we-are-sections.ts`:

Change the type import to:

```ts
import type { PinnedSummary, PresentationDocument, WhoWeAreSection, WhoWeAreSlide } from '@/features/meeting-flow/types'
```

add this import between the `due-diligence` and `company` imports:

```ts
import { groupSlides } from '@/shared/components/presentation/group-slides'
```

add two keys to `IMAGES`, after `after`:

```ts
  // Tracked, unlike the Riviera pair above, which is gitignored and missing in production (U12).
  bathroomBefore: '/funnels/bathrooms/before-1.webp',
  bathroomAfter: '/funnels/bathrooms/after-1.webp',
```

add after `COMPARISON_COLUMNS`:

```ts

/** The visible cue on documents the homeowner can open (U11). */
const TAP_TO_VIEW = 'Tap to view'
```

and append at the end of the file:

```ts

/**
 * The Who We Are slides (spec C §3). The hook and the closing are `full`; the eight slides
 * between them are `column` and so form one run with one heading column.
 */
export const WHO_WE_ARE_SLIDES: WhoWeAreSlide[] = [
  {
    id: 'hook',
    frame: 'full',
    heading: {
      title: 'A successful project doesn’t start on demolition day.',
      subheading: { text: 'It starts when you do your', accent: 'due diligence.' },
    },
    background: { kind: 'image', src: IMAGES.hook, alt: 'Finished home exterior at dusk' },
    content: { kind: 'hero' },
  },
  {
    id: 'licensing',
    heading: { number: 1, title: 'Proper licensing and permits', subheading: { text: licensing.short } },
    content: {
      kind: 'credentials',
      documents: [
        {
          title: 'Contractor license',
          alt: `${companyInfo.name} contractor license`,
          pages: [`${DOCS_BASE}/tpr-license.jpg`],
          width: 1800,
          height: 1200,
        },
        {
          title: 'Certificate of insurance',
          alt: `${companyInfo.name} certificate of liability insurance`,
          pages: [`${DOCS_BASE}/tpr-coi-2026.jpg`],
          width: 2550,
          height: 3300,
        },
      ],
      protection: [
        { value: `#${license.licenseNumber}`, label: 'CA contractor license' },
        { value: liabilityCoverage, label: 'Insurance per project' },
        { value: 'Bonded', label: 'Most contractors aren’t' },
      ],
      reputation: [
        { kind: 'fact', value: companyInfo.ownership, label: `${companyInfo.generations} generations` },
        { kind: 'rating', platform: reviews.google.platform, rating: reviews.google.rating.toFixed(1), count: reviews.google.count },
        { kind: 'rating', platform: reviews.yelp.platform, rating: reviews.yelp.rating.toFixed(1), count: reviews.yelp.count },
        { kind: 'fact', value: reviews.bbb.rating, label: `${reviews.bbb.platform} rating` },
      ],
      openLabel: TAP_TO_VIEW,
    },
  },
  {
    id: 'scope',
    heading: { number: 2, title: 'A clear scope of work', subheading: { text: scope.short } },
    content: { kind: 'sample', proof: { value: scope.stat, label: scope.statLabel }, document: SAMPLE_SCOPE, openLabel: TAP_TO_VIEW },
  },
  {
    id: 'supervision',
    heading: { number: 3, title: 'Proper supervision', subheading: { text: supervision.short } },
    background: { kind: 'image', src: IMAGES.supervision, alt: 'Crew pouring a driveway while a supervisor watches' },
    content: { kind: 'point', proof: { value: supervision.stat, label: supervision.statLabel } },
  },
  {
    id: 'communication',
    heading: { number: 4, title: 'Communication', subheading: { text: communication.short } },
    content: {
      kind: 'agent',
      cardRole: 'Your point of contact',
      commitments: [
        'Calls and texts answered the same business day',
        'A progress update with photos, every week of the job',
        'A walk through the job with you before work starts',
      ],
    },
  },
  {
    id: 'team',
    heading: { number: 5, title: 'Team and support staff', subheading: { text: office.short } },
    content: {
      kind: 'team',
      proof: { value: supportStaff, label: 'Support staff behind every project' },
      partner: {
        name: partner.name,
        title: partner.title,
        image: `/${partner.image}`,
        points: [
          `${partnerFirstName} reviews every scope before it reaches you`,
          `You can reach ${partnerFirstName} directly if something isn’t right`,
          `${partnerFirstName} puts a licensed contractor’s eyes on your project`,
        ],
      },
    },
  },
  {
    id: 'performance',
    heading: { number: 6, title: 'Proof of performance', subheading: { text: performance.short } },
    content: {
      kind: 'point',
      proof: { value: performance.stat, label: performance.statLabel },
      media: { before: IMAGES.bathroomBefore, after: IMAGES.bathroomAfter, alt: 'Bathroom remodel', width: 1280, height: 714 },
    },
  },
  {
    id: 'comparison',
    heading: { title: `${COMPARISON_COLUMNS.triPros} vs other contractors`, subheading: { text: 'The six, side by side.' } },
    content: {
      kind: 'comparison',
      rows: [
        {
          label: 'Licensing and insurance',
          triPros: `CA #${license.licenseNumber} · ${liabilityCoverage} per project · bonded`,
          others: 'Unlicensed or underinsured, and you carry the risk',
        },
        { label: 'Scope of work', triPros: 'Detailed and in writing before work starts', others: 'A one-line estimate or a handshake' },
        { label: 'Supervision', triPros: `${supervision.stat} sets of eyes on every job`, others: 'The crew, unsupervised' },
        { label: 'Communication', triPros: 'One direct contact · same-day replies · weekly updates', others: 'Chasing calls for days' },
        { label: 'Team and support', triPros: `A senior partner and ${supportStaff} support staff`, others: 'One person and a truck' },
        {
          label: 'Proof of performance',
          triPros: `${companyInfo.numProjects}+ projects · Google ${reviews.google.rating.toFixed(1)} · ${reviews.bbb.platform} ${reviews.bbb.rating}`,
          others: '“Trust me”',
        },
      ],
    },
  },
  {
    id: 'extras',
    heading: { title: '…and what most homeowners never think to ask.' },
    content: {
      kind: 'comparison',
      rows: [
        { label: 'Product warranties', triPros: 'Lifetime warranties on many of our products', others: 'Whatever the box says, if it’s still valid' },
        { label: 'Experience', triPros: `${companyInfo.combinedYearsExperience}+ years of combined experience`, others: 'Learning on your house' },
        { label: 'Operations', triPros: 'Office, field crew, and you on one live system', others: 'Lost paperwork and “let me check with the guys”' },
        { label: 'Progress', triPros: 'Every phase photographed and on record', others: 'You drive by to check' },
        { label: 'Financing', triPros: 'Financing and payment programs', others: 'Cash or check up front' },
        { label: 'Change orders', triPros: 'Any change is priced and signed before it happens', others: 'A surprise bill at the end' },
        { label: 'Payments', triPros: 'You pay as work is completed', others: 'A big deposit, then silence' },
        { label: 'Rebates', triPros: 'We find and file your energy rebates and tax credits', others: 'You’re on your own' },
      ],
    },
  },
  {
    id: 'closing',
    frame: 'full',
    heading: { title: 'Success isn’t about the finishes.' },
    background: { kind: 'image', src: IMAGES.hook, alt: 'Finished home exterior at dusk' },
    content: {
      kind: 'closing',
      quote: 'Many times it boils down to communication, supervision, leadership, and accountability. That is what makes it the real deal.',
      cta: { label: 'Continue to Specialties' },
    },
  },
]

/** How many slides carry a number: the "of 6" in the heading column's "3 of 6". */
export const PROOF_POINT_COUNT = WHO_WE_ARE_SLIDES.filter(slide => slide.heading.number !== undefined).length

/** The slides grouped once, at module scope: the hook, one run of eight, the closing. */
export const WHO_WE_ARE_GROUPS = groupSlides(WHO_WE_ARE_SLIDES)
```

The comparison and extras rows repeat today's `WHO_WE_ARE_SECTIONS` rows character for character (C4): copy them from the `comparison` and `truth` entries rather than retyping, and diff the two blocks before moving on.

- [ ] **Step 9: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/components/presentation/types.ts src/shared/components/presentation/group-slides.ts src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/due-diligence.ts src/features/meeting-flow/constants/who-we-are-sections.ts`
Expected: no output. The new exports are unused until Task 4; that is expected.

- [ ] **Step 10: Commit**

`feat(presentation): the engine's types, groupSlides and the ten Who We Are slides` — paths: `src/shared/components/presentation/types.ts`, `src/shared/components/presentation/group-slides.ts`, `src/features/meeting-flow/types/index.ts`, `src/features/meeting-flow/constants/due-diligence.ts`, `src/features/meeting-flow/constants/who-we-are-sections.ts` (the check script is git-ignored).

---

### Task 4: The engine moves to shared; Who We Are renders slides in frames (L1–L7, C34–C38, C41, U1, U3, U9, U10 team slot, U13 lists, F1, F6, F8, F9, F10, F12, N1, N2, S1–S6, S9, S10, S13)

The one atomic switch. The six presentation components, the context and the motion constants move from the feature to `PE/`, renamed per spec §12 (`SnapPresentation` → `Presentation`, `SnapSection` → `Slide`, `PinnedColumn` → `HeadingColumn`, `SectionImage` → `SlideImage`, `PIN_SWAP_TRANSITION` → `HEADING_SWAP_TRANSITION`, `useSectionInView` → `useSlideInView`), and the engine gains what the spec adds (`SlideRun`, `SlideBackground`, `groupSlides` consumers, the shell seam). Every feature consumer moves onto the slide model, and the old section array, pinned array, section types and the feature copies of the moved files are deleted in the same change. Text and spacing land on the Task 2 tokens as each file is rewritten. Task 1's centre-line rule is carried into `Slide`. No `git mv` anywhere: write the new file, `rm` the old.

**Files:**
- Create: `$WS/tools/verify-deck.mjs`
- Create (engine): `src/shared/components/presentation/context.tsx`, `motion.ts`, `slide-scroll-top.ts`, `presentation.tsx`, `slide.tsx`, `slide-run.tsx`, `heading-column.tsx`, `slide-background.tsx`, `slide-image.tsx`, `reveal.tsx`, `scrim.tsx`
- Delete (moved to the engine): `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx`, `snap-section.tsx`, `pinned-column.tsx`, `section-image.tsx`, `reveal.tsx`, `scrim.tsx`; `src/features/meeting-flow/contexts/presentation-context.tsx`; `src/features/meeting-flow/constants/presentation-motion.ts`
- Create (feature): `src/features/meeting-flow/constants/who-we-are-slides.ts`; `src/features/meeting-flow/ui/components/steps/who-we-are/check-list.tsx`, `before-after-pair.tsx`, `closing-section.tsx`
- Modify (feature): `src/features/meeting-flow/types/index.ts`, `src/features/meeting-flow/constants/keyboard-hints.ts`, `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts`, `src/features/meeting-flow/ui/views/meeting-flow.tsx` (one import each), `src/features/meeting-flow/lib/to-presentation-agent.ts` (one word); `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx` (rewrite), `credentials-section.tsx`, `sample-section.tsx`, `point-section.tsx`, `agent-section.tsx`, `team-section.tsx`, `comparison-section.tsx`, `comparison-table.tsx`, `point-layout.tsx`, `proof-figure.tsx`, `credential-documents.tsx`, `document-stack.tsx` (import path)
- Delete (feature): `src/features/meeting-flow/constants/who-we-are-sections.ts`; `src/features/meeting-flow/ui/components/steps/who-we-are/hook-section.tsx`, `point-heading.tsx`, `point-media-layer.tsx`, `truth-section.tsx`, `placeholder-slot.tsx`

**Interfaces:**
- Consumes (Task 3): `PresentationFrame`, `PresentationBackground`, `PresentationHeading`, `PresentationSlide`, `IndexedSlide`, `PresentationGroup`, `SlideProps`, `PresentationHandle` from `@/shared/components/presentation/types`; `groupSlides`; `WhoWeAreContent`, `WhoWeAreContentOf`, `WhoWeAreSlide`, `BeforeAfterMedia`, `PresentationPartner` from `@/features/meeting-flow/types`; the ten slides. (Task 2): the role and spacing utilities, `--stage-clear-b` (feature side only), `--presentation-scrim`, `BRAND_EASE`.
- Produces (engine, `@/shared/components/presentation/<file>`):
  - `presentation.tsx`: `Presentation({ label, rootAttributes?, keyShortcuts?, clearBottom?, className?, ref?, children })`. Owns `role="region"`, `tabIndex={0}`, `aria-label`, the class merge, `MotionConfig reducedMotion="user"`, the size-container wrapper and the `[container:presentation/size]` scroller; `keyShortcuts` → `aria-keyshortcuts`; `clearBottom` → inline `--presentation-clear-b` on the scroller; `rootAttributes` spread onto the scroller (host markers such as `data-step-root`). No `aside` prop, no `data-step-root`, no `KEY_SHORTCUTS` import.
  - `slide.tsx`: `Slide({ index, id, frame, heading, background?, children? })` — the `<section>` box, centre-line in-view, `--band-h` height and scroll margin, registers itself, provides `SlideInViewContext`; `full` renders the centred heading with `Reveal` then `children`; `column` renders a `sr-only` `<h2>` then `children`; `aria-labelledby` → `${id}-title` in both.
  - `slide-run.tsx`: `SlideRun({ items: IndexedSlide<unknown>[], numberedTotal, children })`.
  - `heading-column.tsx`: `HeadingColumn({ items: IndexedSlide<unknown>[], numberedTotal })`, an `aria-hidden` sticky `<aside>`.
  - `slide-background.tsx`: `SlideBackground({ background, frame, priority? })`.
  - `slide-image.tsx`: `SlideImage({ src, alt, sizes, priority?, className?, imageClassName? })` (`sizes` required).
  - `reveal.tsx`: `Reveal({ order?, ...HTMLMotionProps<'div'> })`.
  - `scrim.tsx`: `Scrim({ variant?: 'radial' | 'center', className? })`; `heavy` is gone.
  - `context.tsx`: `PresentationContext`, `PresentationContextValue` (`{ scrollerRef, activeIndex, reportInView, registerSlide }`), `usePresentation()`, `SlideInViewContext`, `useSlideInView()`.
  - `motion.ts`: `REVEAL_STAGGER_S`, `REVEAL_TRANSITION`, `REVEAL_VARIANTS`, `IMAGE_SETTLE_VARIANTS`, `HEADING_SWAP_TRANSITION` (today's `PIN_SWAP_TRANSITION`, value unchanged).
  - `slide-scroll-top.ts`: `slideScrollTop(section: HTMLElement, scroller: HTMLElement): number`.
- Produces (feature): `WHO_WE_ARE_SLIDES`, `WHO_WE_ARE_GROUPS`, `PROOF_POINT_COUNT`, `COMPARISON_COLUMNS` from `@/features/meeting-flow/constants/who-we-are-slides`; `WhoWeAreStep({ agent, onContinue, ref })` with unchanged props (its `ref` is now the engine's `PresentationHandle`), so the view's call site is untouched; `CredentialsSection`, `SampleSection`, `PointSection`, `TeamSection`, `ComparisonSection` take `SlideProps<WhoWeAreContentOf<K>>`, `AgentSection` adds `agent`, `ClosingSection` adds `onContinue`; `CheckList({ items })`; `BeforeAfterPair({ media })`; `PointLayout({ media, children })`; `ProofFigure({ proof, order })`; `ComparisonTable({ rows })` (no `density`; replaced in Task 5). `KEY_SHORTCUTS` stays in `keyboard-hints.ts`.
- Gone after this task: everything under `MF/ui/components/presentation/`, `MF/contexts/presentation-context.tsx`, `MF/constants/presentation-motion.ts`, `MF/constants/who-we-are-sections.ts`; `PresentationHandle`, `PointMedia`, `PinnedSummary`, `WhoWeAreSection` from `MF/types`; `WHO_WE_ARE_SECTIONS`, `WHO_WE_ARE_PINNED`; `HookSection`, `PointHeading`, `PointMediaLayer`, `TruthSection`, `PlaceholderSlot`; the word "beat" anywhere in `src/features/meeting-flow` or `PE/`.

- [ ] **Step 1: Write the presentation check**

`$WS/tools/verify-deck.mjs`:

```js
// Spec C §3–§4 and §12 (Task 4): the slides' shape, runs, frames, labels, the shell seam,
// keyboard landing and type tokens, at four presentation sizes. Read-only.
import { buildCss, deckState, openStep1, setup } from './common.mjs'

const IDS = ['hook', 'licensing', 'scope', 'supervision', 'communication', 'team', 'performance', 'comparison', 'extras', 'closing']
const COLUMN_TITLES = {
  licensing: 'Proper licensing and permits',
  scope: 'A clear scope of work',
  supervision: 'Proper supervision',
  communication: 'Communication',
  team: 'Team and support staff',
  performance: 'Proof of performance',
  comparison: 'vs other contractors',
  extras: 'never think to ask',
}
const SIZES = [[1440, 900], [1280, 800], [1024, 768], [820, 1180]]
const css = buildCss()
const failures = []
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
  if (!ok) {
    failures.push(label)
  }
}
const near = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance
const clampPx = (min, cqw, max, width) => Math.min(Math.max(min, (cqw / 100) * width), max)

async function restOffset(page, id) {
  return page.evaluate((target) => {
    const scroller = document.querySelector('[role="region"][data-step-root]')
    const section = document.getElementById(target)
    const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop)
    return section.getBoundingClientRect().top - scroller.getBoundingClientRect().top - margin
  }, id)
}

for (const [width, height] of SIZES) {
  const tag = `${width}x${height}`
  const { browser, page } = await setup({ width, height })
  try {
    await openStep1(page, { css })
    const shape = await page.evaluate(() => {
      const scroller = document.querySelector('[role="region"][data-step-root]')
      const sections = [...scroller.querySelectorAll('section[id]')]
      const asides = [...scroller.querySelectorAll('aside')]
      const title = asides[0]?.querySelector('p.text-presentation-title')
      const proof = scroller.querySelector('section#scope .text-presentation-figure')
      return {
        box: { w: scroller.clientWidth, h: scroller.clientHeight },
        ids: sections.map(section => section.id),
        asides: asides.length,
        asideHidden: asides[0]?.getAttribute('aria-hidden') ?? null,
        asideH: asides[0]?.getBoundingClientRect().height ?? 0,
        runDisplay: asides[0] ? getComputedStyle(asides[0].parentElement).display : null,
        unlabelled: sections.filter(section => !document.getElementById(section.getAttribute('aria-labelledby') ?? '')?.textContent?.trim()).map(section => section.id),
        margins: Object.fromEntries(sections.map(section => [section.id, Number.parseFloat(getComputedStyle(section).scrollMarginTop)])),
        minHeights: Object.fromEntries(sections.map(section => [section.id, Number.parseFloat(getComputedStyle(section).minHeight)])),
        hookWidth: scroller.querySelector('section#hook')?.getBoundingClientRect().width ?? 0,
        hookSizes: scroller.querySelector('section#hook img')?.getAttribute('sizes') ?? null,
        titlePx: title ? Number.parseFloat(getComputedStyle(title).fontSize) : 0,
        proofColor: proof ? getComputedStyle(proof).color : null,
        scrollPaddingTop: getComputedStyle(scroller).scrollPaddingTop,
        clearB: scroller.style.getPropertyValue('--presentation-clear-b').trim(),
        keyShortcuts: scroller.getAttribute('aria-keyshortcuts'),
      }
    })
    const band = shape.box.w < 896
    const bandH = 0.3 * shape.box.h
    check(`${tag} ten slides in order`, JSON.stringify(shape.ids) === JSON.stringify(IDS), shape.ids)
    check(`${tag} one run, one heading column`, shape.asides === 1, shape.asides)
    check(`${tag} heading column is aria-hidden`, shape.asideHidden === 'true', shape.asideHidden)
    check(`${tag} every slide is labelled`, shape.unlabelled.length === 0, shape.unlabelled)
    check(`${tag} scroll padding is 0`, ['0px', 'auto'].includes(shape.scrollPaddingTop), shape.scrollPaddingTop)
    check(`${tag} the shell seam reaches the scroller`, shape.clearB === 'var(--stage-clear-b)' && shape.keyShortcuts === 'ArrowUp ArrowDown A Z', { clearB: shape.clearB, keyShortcuts: shape.keyShortcuts })
    check(`${tag} hook is full-bleed`, near(shape.hookWidth, shape.box.w) && shape.hookSizes === '100vw', { width: shape.hookWidth, box: shape.box.w, sizes: shape.hookSizes })
    check(`${tag} full slides: no band offset, one screen tall`, ['hook', 'closing'].every(id => shape.margins[id] === 0 && near(shape.minHeights[id], shape.box.h)), { margins: shape.margins, minHeights: shape.minHeights })
    check(`${tag} ${band ? 'band' : 'side'} column height`, near(shape.asideH, band ? bandH : shape.box.h), { asideH: shape.asideH })
    check(`${tag} run display`, shape.runDisplay === (band ? 'block' : 'grid'), shape.runDisplay)
    check(`${tag} column slides snap ${band ? 'below the band' : 'to the top'}`, IDS.slice(1, 9).every(id => near(shape.margins[id], band ? bandH : 0) && near(shape.minHeights[id], shape.box.h - (band ? bandH : 0))), { margins: shape.margins, minHeights: shape.minHeights })
    check(`${tag} column title uses the title token`, near(shape.titlePx, clampPx(28, 3.05, 56, shape.box.w), 0.6), { px: shape.titlePx, expected: clampPx(28, 3.05, 56, shape.box.w) })
    check(`${tag} accent is the presentation accent`, shape.proofColor === 'rgb(92, 198, 242)', shape.proofColor)

    const atHook = await page.evaluate(() => document.querySelector('[role="region"][data-step-root] aside')?.textContent ?? '')
    check(`${tag} column shows the run's first heading before the run (F1)`, atHook.includes(COLUMN_TITLES.licensing), atHook)

    for (let i = 1; i < IDS.length; i++) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(1000)
      const offset = await restOffset(page, IDS[i])
      check(`${tag} ↓ lands on ${IDS[i]}`, Math.abs(offset) <= 2, { offset })
      if (COLUMN_TITLES[IDS[i]]) {
        const { column } = await deckState(page)
        check(`${tag} column names ${IDS[i]}`, (column ?? '').includes(COLUMN_TITLES[IDS[i]]), column)
      }
    }
    const atClosing = await page.evaluate(() => document.querySelector('[role="region"][data-step-root] aside')?.textContent ?? '')
    check(`${tag} column keeps the run's last heading after the run (F1)`, atClosing.includes(COLUMN_TITLES.extras), atClosing)
    for (let i = IDS.length - 2; i >= 0; i--) {
      await page.keyboard.press('ArrowUp')
      await page.waitForTimeout(1000)
      const offset = await restOffset(page, IDS[i])
      check(`${tag} ↑ lands on ${IDS[i]}`, Math.abs(offset) <= 2, { offset })
    }
  }
  finally {
    await browser.close()
  }
}
console.log(failures.length ? `\n${failures.length} FAIL` : '\nALL PASS')
process.exitCode = failures.length ? 1 : 0
```


- [ ] **Step 2: Run it against the current build and watch it fail**

Run: `node $WS/tools/verify-deck.mjs`
Expected: FAIL lines, among them `ten slides in order` (today's ids end in `truth`), `heading column is aria-hidden`, `the shell seam reaches the scroller` (no inline variable today), `hook is full-bleed` (`sizes` is `(min-width: 1024px) 62vw, 100vw`) and `column title uses the title token`.

- [ ] **Step 3: The engine's context, motion and jump target**

`src/shared/components/presentation/context.tsx` (today's `MF/contexts/presentation-context.tsx`, moved and renamed; the in-view context is now the slide's):

```tsx
'use client'

import type { RefObject } from 'react'
import { createContext, use } from 'react'

export interface PresentationContextValue {
  /** The snapping scroll container. Pass as `root` to every `useInView` inside. */
  scrollerRef: RefObject<HTMLDivElement | null>
  /** Index of the slide crossing the presentation's centre line. See ./DOCS.md#active-slide */
  activeIndex: number
  reportInView: (index: number, inView: boolean) => void
  /** Slides register their element so the scroller can scroll to an index. */
  registerSlide: (index: number, el: HTMLElement | null) => void
}

export const PresentationContext = createContext<PresentationContextValue | null>(null)

export function usePresentation(): PresentationContextValue {
  const ctx = use(PresentationContext)
  if (!ctx) {
    throw new Error('usePresentation must be used inside <Presentation>')
  }
  return ctx
}

/** Whether the enclosing <Slide> is in view. Drives <Reveal> and <SlideImage>. */
export const SlideInViewContext = createContext(false)

export function useSlideInView(): boolean {
  return use(SlideInViewContext)
}
```

`src/shared/components/presentation/motion.ts` (today's `MF/constants/presentation-motion.ts` as Task 2 left it, moved; `PIN_SWAP_TRANSITION` renamed, value unchanged):

```ts
import type { Transition, Variants } from 'motion/react'
import { BRAND_EASE } from '@/shared/constants/motion'

/** Every presentation reveal rides the brand curve (spec C U14). */
export const REVEAL_TRANSITION: Transition = { duration: 0.5, ease: BRAND_EASE }

/**
 * Text groups rise into place. Transitions are set on the <Reveal> component, not
 * here, so a per-element stagger delay can be merged in.
 */
export const REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

/** Delay between sibling reveals inside one slide, in seconds. */
export const REVEAL_STAGGER_S = 0.09

/** Images settle from a slight zoom on first reveal. Applied to an inner wrapper only. */
export const IMAGE_SETTLE_VARIANTS: Variants = {
  hidden: { scale: 1.06 },
  visible: { scale: 1, transition: { duration: 1.8, ease: BRAND_EASE } },
}

/**
 * The heading column's swap between slides: a plain ease-out, as approved in the prototype.
 * It keeps its opacity fade under reduced motion, as `MotionConfig reducedMotion="user"` does (C46).
 */
export const HEADING_SWAP_TRANSITION: Transition = { duration: 0.18, ease: 'easeOut' }
```

`src/shared/components/presentation/slide-scroll-top.ts`:

```ts
/**
 * The scrollTop that rests `section` at its snap position: its top relative to the scroller,
 * minus its scroll margin. Measured from rects, so it does not depend on which ancestor is
 * positioned, unlike `offsetTop` (spec C §4.1, review F9). See ./DOCS.md#keyboard-jumps
 */
export function slideScrollTop(section: HTMLElement, scroller: HTMLElement): number {
  const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0
  return section.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - margin
}
```

- [ ] **Step 4: `Presentation`, the scroller and the shell seam**

`src/shared/components/presentation/presentation.tsx` (today's `snap-presentation.tsx`, moved; no `aside`, no grid, no `data-step-root`, no `KEY_SHORTCUTS`):

```tsx
'use client'

import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react'
import type { PresentationHandle } from '@/shared/components/presentation/types'
import { MotionConfig } from 'motion/react'
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { PresentationContext } from '@/shared/components/presentation/context'
import { slideScrollTop } from '@/shared/components/presentation/slide-scroll-top'
import { cn } from '@/shared/lib/utils'

/** Host markers for the scroller, e.g. `{ 'data-step-root': true }`. `HTMLAttributes` alone rejects a hyphenated key in an object literal. */
type RootAttributes = HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | boolean | undefined>

interface PresentationProps {
  /** Accessible name for the scroll region, e.g. "Who we are presentation". */
  label: string
  /** Attributes the host needs on the scroller, such as the marker its focus management looks for. */
  rootAttributes?: RootAttributes
  /** `aria-keyshortcuts` for the keys the host's key map sends to `ref`. */
  keyShortcuts?: string
  /**
   * A CSS length every engine layer keeps clear at the bottom, e.g. `var(--stage-clear-b)`
   * under a host's floating control. Becomes `--presentation-clear-b` on the scroller.
   */
  clearBottom?: string
  className?: string
  /** Imperative `next` / `prev` for the host's key map. */
  ref?: Ref<PresentationHandle>
  /** The slides: `full` slides and runs (`SlideRun`), in order. */
  children: ReactNode
}

/**
 * Full-height, slide-snapping scroller: the presentation engine's root. Snap is the
 * browser's (CSS scroll-snap); the JS is in-view tracking plus an absolute `scrollTo` for
 * keyboard slide navigation. Rules: see ./DOCS.md#presentation
 * Recipes and citations: docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md,
 * docs/plans/2026-09-13-meeting-flow-keyboard-focus-research.md §4.3.
 *
 * The scroller is the `presentation` size container. Descendants size with `cqw`/`cqh` and
 * switch layout with `@max-[56rem]/presentation:`; the name keeps a query bound to the
 * presentation even when a nearer container sits in between. Scroll padding is 0: each slide
 * carries its own scroll margin (`Slide`). The host reaches in only through named props:
 * `clearBottom` becomes `--presentation-clear-b`, which every engine layer reads as
 * `var(--presentation-clear-b, 0px)`; the engine does not know what the host floats there.
 *
 * The wrapper is a size container of the same box because an element cannot query itself: a
 * property of the scroller written in `cq` units would resolve against the nearest ancestor
 * container, which without the wrapper is the viewport. No property of the scroller uses
 * `cq` units today; the wrapper keeps that safe to add.
 */
export function Presentation({ label, rootAttributes, keyShortcuts, clearBottom, className, ref, children }: PresentationProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const slidesRef = useRef(new Map<number, HTMLElement>())
  const pendingIndexRef = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const reportInView = useCallback((index: number, inView: boolean) => {
    if (inView) {
      setActiveIndex(index)
    }
  }, [])

  const registerSlide = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      slidesRef.current.set(index, el)
    }
    else {
      slidesRef.current.delete(index)
    }
  }, [])

  // The pending target only matters while a smooth scroll is in flight.
  useEffect(() => {
    if (pendingIndexRef.current === activeIndex) {
      pendingIndexRef.current = null
    }
  }, [activeIndex])

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current
    const section = slidesRef.current.get(index)
    if (!scroller || !section) {
      return
    }
    // An absolute scroll snaps in any direction and is not trapped by `snap-always`. The
    // target is a rect delta, so a positioned wrapper cannot redirect it (review F9).
    pendingIndexRef.current = index
    scroller.scrollTo({ top: slideScrollTop(section, scroller) })
  }, [])

  useImperativeHandle(ref, () => ({
    next: () => {
      const from = pendingIndexRef.current ?? activeIndex
      scrollToIndex(Math.min(slidesRef.current.size - 1, from + 1))
    },
    prev: () => {
      const from = pendingIndexRef.current ?? activeIndex
      scrollToIndex(Math.max(0, from - 1))
    },
  }), [activeIndex, scrollToIndex])

  const value = useMemo(
    () => ({ scrollerRef, activeIndex, reportInView, registerSlide }),
    [activeIndex, reportInView, registerSlide],
  )

  return (
    <MotionConfig reducedMotion="user">
      <PresentationContext value={value}>
        <div className="relative isolate min-h-0 flex-1 [container-type:size]">
          <div
            ref={scrollerRef}
            {...rootAttributes}
            aria-keyshortcuts={keyShortcuts}
            aria-label={label}
            className={cn(
              'absolute inset-0 overflow-y-auto overscroll-contain',
              'snap-y snap-mandatory scroll-pt-0 motion-safe:scroll-smooth [container:presentation/size]',
              'bg-(--presentation-ground) text-white',
              'outline-none',
              className,
            )}
            role="region"
            style={{ '--presentation-clear-b': clearBottom } as CSSProperties}
            tabIndex={0}
          >
            {children}
          </div>
        </div>
      </PresentationContext>
    </MotionConfig>
  )
}
```

The `as CSSProperties` cast is the repo's pattern for custom properties in a style object (`proposal-flow-shell.tsx:28`, `sidebar.tsx:141`). An undefined `clearBottom` sets nothing, and the fallback in `var(--presentation-clear-b, 0px)` takes over. `rootAttributes` is spread before the engine's own attributes so the engine's `role`, `aria-label` and `tabIndex` win; `eslint --fix` settles prop order around the spread.

- [ ] **Step 5: `Slide`, one component for both frames**

`src/shared/components/presentation/slide.tsx` (today's `snap-section.tsx` moved and grown: it carries Task 1's centre-line rule, the `--band-h` height and margin, and the heading in its frame; there is no per-frame wrapper, S4):

```tsx
'use client'

import type { ReactNode } from 'react'
import type { SlideProps } from '@/shared/components/presentation/types'
import { useInView } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'
import { SlideInViewContext, usePresentation } from '@/shared/components/presentation/context'
import { Reveal } from '@/shared/components/presentation/reveal'
import { SlideBackground } from '@/shared/components/presentation/slide-background'

/** What `Slide` takes: a slide component's `SlideProps` minus the content, which arrives as children. */
interface SlideOwnProps extends Omit<SlideProps<unknown>, 'content'> {
  /** The content. On a `column` slide it is everything visible; on a `full` slide it follows the centred heading (reveal from order 2). */
  children?: ReactNode
}

/**
 * One slide: the snap target, the in-view report and the heading in its frame. The
 * <section> box is never transformed: snap areas are computed from the transformed border
 * box, so every reveal lives on an inner element. Rules: see ./DOCS.md#frames
 *
 * In view means crossing the presentation's centre line, not showing half its height.
 * Slides are contiguous, so exactly one crosses at a time, and a slide that never left the
 * view never needs to report again; a slide under a band, or taller than two screens, still
 * reports (spec C §4.5, review F2). See ./DOCS.md#active-slide
 *
 * Height and snap offset both read `--band-h`, which a run publishes only while its heading
 * column is a band; everywhere else, and on every `full` slide, it falls back to 0 (spec C
 * §4.2). The scroll margin is inline on purpose: it also overrides the global
 * `* { scroll-margin-top: 80px }` rule in `src/app/(frontend)/globals.css`, and inline it
 * cannot be lost to Tailwind's class-merge.
 *
 * `full`: the heading centres over the slide (C41), with `safe` centring so a screen too
 * short for the copy clips at the end, never the title (review F6); the accent is colour on
 * a plain line, never serif italic (U9). `column`: the heading shows in the run's column, so
 * the slide renders only a visually hidden <h2> that keeps the section labelled for
 * assistive tech (U1, review F10). `frame` arrives resolved from `groupSlides`; it is never
 * defaulted here.
 */
export function Slide({ index, id, frame, heading, background, children }: SlideOwnProps) {
  const ref = useRef<HTMLElement>(null)
  const { scrollerRef, reportInView, registerSlide } = usePresentation()
  const inView = useInView(ref, { root: scrollerRef, margin: '-50% 0px -50% 0px' })
  const headingId = `${id}-title`

  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el
    registerSlide(index, el)
  }, [index, registerSlide])

  useEffect(() => {
    reportInView(index, inView)
  }, [index, inView, reportInView])

  return (
    <SlideInViewContext value={inView}>
      <section
        ref={setRef}
        aria-labelledby={headingId}
        className="relative min-h-[calc(100cqh-var(--band-h,0px))] snap-start snap-always overflow-hidden"
        id={id}
        style={{ scrollMarginTop: 'var(--band-h, 0px)' }}
      >
        {background && <SlideBackground background={background} frame={frame} priority={index === 0} />}
        {frame === 'full'
          ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center-safe gap-presentation-group px-[8cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))] text-center">
                <Reveal order={0}>
                  <h2 className="max-w-[18ch] font-sans text-presentation-display leading-[1.04] font-semibold tracking-tight text-balance" id={headingId}>
                    {heading.title}
                  </h2>
                </Reveal>
                {heading.subheading && (
                  <Reveal order={1}>
                    <p className="max-w-[40ch] text-presentation-lead text-balance text-white/85">
                      {heading.subheading.text}
                      {heading.subheading.accent && (
                        <>
                          {' '}
                          <span className="font-semibold text-(--presentation-accent)">{heading.subheading.accent}</span>
                        </>
                      )}
                    </p>
                  </Reveal>
                )}
                {children}
              </div>
            )
          : (
              <>
                <h2 className="sr-only" id={headingId}>{heading.title}</h2>
                {children}
              </>
            )}
      </section>
    </SlideInViewContext>
  )
}
```

- [ ] **Step 6: The run and its heading column**

`src/shared/components/presentation/slide-run.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import type { IndexedSlide } from '@/shared/components/presentation/types'
import { HeadingColumn } from '@/shared/components/presentation/heading-column'

interface SlideRunProps {
  /** The run's slides, in order, as `groupSlides` produced them. */
  items: IndexedSlide<unknown>[]
  /** How many slides in the whole presentation carry a number: the "6" in "3 of 6". */
  numberedTotal: number
  /** The run's rendered slides. */
  children: ReactNode
}

/**
 * Consecutive `column` slides and the heading column they share (C37). Side by side, the
 * column is sticky for the height of the run and slides out at its edges. Below a 56rem
 * presentation it becomes a band above the slides: the run switches to `block` (a grid
 * would leave the band alone in a row that bounds its stickiness, review F12) and publishes
 * `--band-h`, which the slides subtract and snap below. No `overflow` here or on the stack:
 * `hidden` would re-scope sticky to that box. See ./DOCS.md#runs
 */
export function SlideRun({ items, numberedTotal, children }: SlideRunProps) {
  return (
    <div className="grid grid-cols-[minmax(16rem,38%)_minmax(0,1fr)] @max-[56rem]/presentation:block @max-[56rem]/presentation:[--band-h:30cqh]">
      <HeadingColumn items={items} numberedTotal={numberedTotal} />
      <div>{children}</div>
    </div>
  )
}
```

`src/shared/components/presentation/heading-column.tsx` (today's `pinned-column.tsx`, moved; derives everything from `items`, S5):

```tsx
'use client'

import type { IndexedSlide } from '@/shared/components/presentation/types'
import { AnimatePresence, motion } from 'motion/react'
import { usePresentation } from '@/shared/components/presentation/context'
import { HEADING_SWAP_TRANSITION } from '@/shared/components/presentation/motion'

interface HeadingColumnProps {
  /** The run's slides, in order. Only their headings and indexes are read. */
  items: IndexedSlide<unknown>[]
  /** How many slides in the whole presentation carry a number. */
  numberedTotal: number
}

/**
 * A run's heading column: names the active slide and fades between slides. Sticky inside a
 * snap container is fine; it carries no snap alignment itself, and `self-start` is what
 * lets it stick (a stretched column has nowhere to go). The presentation's active index is
 * clamped to the run, so the column already shows the run's first heading while the run
 * scrolls in, and keeps its last as the run leaves (review F1). Centred content per shell
 * correction C2. `aria-hidden`: every slide labels itself with its own heading (review F10).
 * See ./DOCS.md#heading-column
 */
export function HeadingColumn({ items, numberedTotal }: HeadingColumnProps) {
  const { activeIndex } = usePresentation()
  const first = items[0]?.index ?? 0
  const headings = items.map(item => item.slide.heading)
  const shownIndex = Math.min(Math.max(activeIndex, first), first + headings.length - 1)
  const heading = headings[shownIndex - first]
  if (!heading) {
    return null
  }

  return (
    <aside
      aria-hidden
      className="sticky top-0 z-10 grid h-[100cqh] content-center self-start bg-(--presentation-ground) px-[5cqw] pt-presentation-zone pb-[max(5cqh,var(--presentation-clear-b,0px))] @max-[56rem]/presentation:h-(--band-h) @max-[56rem]/presentation:border-b @max-[56rem]/presentation:border-white/15 @max-[56rem]/presentation:px-[6cqw] @max-[56rem]/presentation:py-presentation-tight"
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={shownIndex}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-presentation-tight"
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 8 }}
          transition={HEADING_SWAP_TRANSITION}
        >
          {heading.number !== undefined && (
            <span className="font-serif text-[11cqw] leading-[0.9] tracking-tight text-white/25 lining-nums @max-[56rem]/presentation:hidden">
              {heading.number}
            </span>
          )}
          <p className="font-sans text-presentation-title leading-[1.08] font-semibold tracking-tight text-balance">{heading.title}</p>
          {heading.subheading && (
            <p className="text-presentation-lead text-white/70">
              {heading.subheading.text}
              {heading.subheading.accent && (
                <>
                  {' '}
                  <span className="text-(--presentation-accent)">{heading.subheading.accent}</span>
                </>
              )}
            </p>
          )}
          {heading.number !== undefined && (
            <p className="text-presentation-label text-white/60 tabular-nums lining-nums">{`${heading.number} of ${numberedTotal}`}</p>
          )}
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}
```

`items` is `IndexedSlide<unknown>[]` on both components: `IndexedSlide<WhoWeAreContent>[]` is assignable to it (property types are read-covariant), checked against the repo's TypeScript while planning, so the run needs no generic.

- [ ] **Step 7: Backgrounds, the scrim and the reveal**

`src/shared/components/presentation/scrim.tsx` (today's `scrim.tsx`, moved; `heavy` gone, `center` added, colours on the variable; the `Scrim` doc line is the other session's text, kept verbatim):

```tsx
'use client'

import { cn } from '@/shared/lib/utils'

interface ScrimProps {
  /** `radial` lights the lower left, where a column slide's figure sits; `center` darkens the middle, under a full slide's centred heading. */
  variant?: 'radial' | 'center'
  className?: string
}

/** Legibility over photography: a gradient scrim keeps the photo sharp where a backdrop blur would soften it. */
export function Scrim({ variant = 'radial', className }: ScrimProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: variant === 'center'
          ? 'radial-gradient(95% 80% at 50% 50%, oklch(var(--presentation-scrim) / 0.9), oklch(var(--presentation-scrim) / 0.52) 60%, oklch(var(--presentation-scrim) / 0.3) 100%)'
          : 'radial-gradient(130% 95% at 18% 100%, oklch(var(--presentation-scrim) / 0.94), oklch(var(--presentation-scrim) / 0.42) 52%, transparent 82%), linear-gradient(to top, oklch(var(--presentation-scrim) / 0.85), transparent 58%)',
      }}
    />
  )
}
```

`src/shared/components/presentation/slide-image.tsx` (today's `section-image.tsx`, moved; `sizes` is required):

```tsx
'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import { useSlideInView } from '@/shared/components/presentation/context'
import { IMAGE_SETTLE_VARIANTS } from '@/shared/components/presentation/motion'
import { cn } from '@/shared/lib/utils'

interface SlideImageProps {
  src: string
  alt: string
  /** The `sizes` hint: a `full` slide's photo spans the whole presentation, a `column` slide's only its own box (L7). */
  sizes: string
  /** Set on the first slide so its image is fetched eagerly. */
  priority?: boolean
  /** Position/size overrides for the wrapper (defaults to full bleed). */
  className?: string
  /** `object-position` and similar overrides for the image. */
  imageClassName?: string
}

/** Full-bleed photo that settles from a slight zoom when its slide comes into view. */
export function SlideImage({ src, alt, sizes, priority = false, className, imageClassName }: SlideImageProps) {
  const inView = useSlideInView()
  return (
    <motion.div
      animate={inView ? 'visible' : 'hidden'}
      className={cn('absolute inset-0', className)}
      initial={false}
      variants={IMAGE_SETTLE_VARIANTS}
    >
      <Image
        alt={alt}
        className={cn('object-cover', imageClassName)}
        draggable={false}
        fill
        priority={priority}
        sizes={sizes}
        src={src}
      />
    </motion.div>
  )
}
```

`src/shared/components/presentation/slide-background.tsx`:

```tsx
'use client'

import type { PresentationBackground, PresentationFrame } from '@/shared/components/presentation/types'
import { Scrim } from '@/shared/components/presentation/scrim'
import { SlideImage } from '@/shared/components/presentation/slide-image'

interface SlideBackgroundProps {
  background: PresentationBackground
  frame: PresentationFrame
  /** Fetch eagerly; set on the presentation's first slide. */
  priority?: boolean
}

/**
 * The photo behind a slide and the scrim that keeps its copy legible. A `full` slide's photo
 * spans the presentation; a `column` slide's fills only its own box beside the heading
 * column (C35), so `sizes` and the scrim follow the frame (L7, U9).
 */
export function SlideBackground({ background, frame, priority = false }: SlideBackgroundProps) {
  return (
    <>
      <SlideImage
        alt={background.alt}
        priority={priority}
        sizes={frame === 'full' ? '100vw' : '(min-width: 1024px) 62vw, 100vw'}
        src={background.src}
      />
      <Scrim variant={frame === 'full' ? 'center' : 'radial'} />
    </>
  )
}
```

`src/shared/components/presentation/reveal.tsx` (today's `reveal.tsx`, moved; imports from the engine):

```tsx
'use client'

import type { HTMLMotionProps } from 'motion/react'
import { motion } from 'motion/react'
import { useSlideInView } from '@/shared/components/presentation/context'
import { REVEAL_STAGGER_S, REVEAL_TRANSITION, REVEAL_VARIANTS } from '@/shared/components/presentation/motion'

interface RevealProps extends HTMLMotionProps<'div'> {
  /** Position in the slide's stagger order; 0 animates first. */
  order?: number
}

/**
 * Text and proof groups rise in when their slide is in view. Never wrap media or the
 * slide itself. `initial={false}` renders a slide that is already in view at rest instead
 * of parking it at opacity 0.
 */
export function Reveal({ order = 0, transition, ...props }: RevealProps) {
  const inView = useSlideInView()
  return (
    <motion.div
      animate={inView ? 'visible' : 'hidden'}
      initial={false}
      transition={{ ...REVEAL_TRANSITION, delay: order * REVEAL_STAGGER_S, ...transition }}
      variants={REVEAL_VARIANTS}
      {...props}
    />
  )
}
```

- [ ] **Step 8: Delete the feature's copies of what moved**

Run, from the repo root (plain `rm`, never `git mv` or `git rm`):

```
rm src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx src/features/meeting-flow/ui/components/presentation/snap-section.tsx src/features/meeting-flow/ui/components/presentation/pinned-column.tsx src/features/meeting-flow/ui/components/presentation/section-image.tsx src/features/meeting-flow/ui/components/presentation/reveal.tsx src/features/meeting-flow/ui/components/presentation/scrim.tsx src/features/meeting-flow/contexts/presentation-context.tsx src/features/meeting-flow/constants/presentation-motion.ts
rmdir src/features/meeting-flow/ui/components/presentation
```

`tsc` is red from here until Step 13; that is expected.

- [ ] **Step 9: The feature's constants**

Write `src/features/meeting-flow/constants/who-we-are-slides.ts` (Task 3's `who-we-are-sections.ts` without the old arrays, the old types and the Riviera pair), then `rm src/features/meeting-flow/constants/who-we-are-sections.ts`:

```ts
import type { PresentationDocument, WhoWeAreSlide } from '@/features/meeting-flow/types'
import { DUE_DILIGENCE_ITEMS } from '@/features/meeting-flow/constants/due-diligence'
import { groupSlides } from '@/shared/components/presentation/group-slides'
import { companyInfo, insurances, reviews } from '@/shared/constants/company'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

const DOCS_BASE = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs]!
const license = companyInfo.licenses[0]
const partner = companyInfo.teamInfo.owners[0]
const partnerFirstName = partner.name.split(' ')[0]
const supportStaff = `${companyInfo.teamInfo.numSupportStaff}+`
// e.g. '$2M per project' -> '$2M'
const liabilityCoverage = insurances.find(i => i.label === 'General Liability Insurance')!.coverage.split(' ')[0]
const [licensing, scope, supervision, communication, office, performance] = DUE_DILIGENCE_ITEMS

/** Stand-in imagery from the public site until the step gets its own shoot. */
const IMAGES = {
  hook: '/hero-photos/modern-house-5.jpg',
  supervision: '/process/construction-stage.jpeg',
  // Tracked, unlike the Riviera pair this replaced, which is gitignored and missing in production (U12).
  bathroomBefore: '/funnels/bathrooms/before-1.webp',
  bathroomAfter: '/funnels/bathrooms/after-1.webp',
} as const

/**
 * Placeholder until the real sample scope is uploaded to R2 at
 * `sample-scope-of-work/page-N.jpg`; the steps are in
 * docs/superpowers/specs/2026-09-13-who-we-are-corrections-design.md §4.
 */
const SAMPLE_SCOPE: PresentationDocument = {
  title: 'Sample scope of work',
  alt: `${companyInfo.name} sample scope of work`,
  pages: Array.from({ length: 6 }, () => '/meeting-flow/placeholders/sample-scope-page.jpg'),
  width: 1700,
  height: 2200,
}

export const COMPARISON_COLUMNS = {
  triPros: companyInfo.nickname,
  others: 'Other contractors',
} as const

/** The visible cue on documents the homeowner can open (U11). */
const TAP_TO_VIEW = 'Tap to view'

/**
 * The Who We Are slides (spec C §3). The hook and the closing are `full`; the eight slides
 * between them are `column` and so form one run with one heading column.
 * Deck rules: see src/features/meeting-flow/DOCS.md#who-we-are-deck
 */
export const WHO_WE_ARE_SLIDES: WhoWeAreSlide[] = [
  {
    id: 'hook',
    frame: 'full',
    heading: {
      title: 'A successful project doesn’t start on demolition day.',
      subheading: { text: 'It starts when you do your', accent: 'due diligence.' },
    },
    background: { kind: 'image', src: IMAGES.hook, alt: 'Finished home exterior at dusk' },
    content: { kind: 'hero' },
  },
  {
    id: 'licensing',
    heading: { number: 1, title: 'Proper licensing and permits', subheading: { text: licensing.short } },
    content: {
      kind: 'credentials',
      documents: [
        {
          title: 'Contractor license',
          alt: `${companyInfo.name} contractor license`,
          pages: [`${DOCS_BASE}/tpr-license.jpg`],
          width: 1800,
          height: 1200,
        },
        {
          title: 'Certificate of insurance',
          alt: `${companyInfo.name} certificate of liability insurance`,
          pages: [`${DOCS_BASE}/tpr-coi-2026.jpg`],
          width: 2550,
          height: 3300,
        },
      ],
      protection: [
        { value: `#${license.licenseNumber}`, label: 'CA contractor license' },
        { value: liabilityCoverage, label: 'Insurance per project' },
        { value: 'Bonded', label: 'Most contractors aren’t' },
      ],
      reputation: [
        { kind: 'fact', value: companyInfo.ownership, label: `${companyInfo.generations} generations` },
        { kind: 'rating', platform: reviews.google.platform, rating: reviews.google.rating.toFixed(1), count: reviews.google.count },
        { kind: 'rating', platform: reviews.yelp.platform, rating: reviews.yelp.rating.toFixed(1), count: reviews.yelp.count },
        { kind: 'fact', value: reviews.bbb.rating, label: `${reviews.bbb.platform} rating` },
      ],
      openLabel: TAP_TO_VIEW,
    },
  },
  {
    id: 'scope',
    heading: { number: 2, title: 'A clear scope of work', subheading: { text: scope.short } },
    content: { kind: 'sample', proof: { value: scope.stat, label: scope.statLabel }, document: SAMPLE_SCOPE, openLabel: TAP_TO_VIEW },
  },
  {
    id: 'supervision',
    heading: { number: 3, title: 'Proper supervision', subheading: { text: supervision.short } },
    background: { kind: 'image', src: IMAGES.supervision, alt: 'Crew pouring a driveway while a supervisor watches' },
    content: { kind: 'point', proof: { value: supervision.stat, label: supervision.statLabel } },
  },
  {
    id: 'communication',
    heading: { number: 4, title: 'Communication', subheading: { text: communication.short } },
    content: {
      kind: 'agent',
      cardRole: 'Your point of contact',
      commitments: [
        'Calls and texts answered the same business day',
        'A progress update with photos, every week of the job',
        'A walk through the job with you before work starts',
      ],
    },
  },
  {
    id: 'team',
    heading: { number: 5, title: 'Team and support staff', subheading: { text: office.short } },
    content: {
      kind: 'team',
      proof: { value: supportStaff, label: 'Support staff behind every project' },
      partner: {
        name: partner.name,
        title: partner.title,
        image: `/${partner.image}`,
        points: [
          `${partnerFirstName} reviews every scope before it reaches you`,
          `You can reach ${partnerFirstName} directly if something isn’t right`,
          `${partnerFirstName} puts a licensed contractor’s eyes on your project`,
        ],
      },
    },
  },
  {
    id: 'performance',
    heading: { number: 6, title: 'Proof of performance', subheading: { text: performance.short } },
    content: {
      kind: 'point',
      proof: { value: performance.stat, label: performance.statLabel },
      media: { before: IMAGES.bathroomBefore, after: IMAGES.bathroomAfter, alt: 'Bathroom remodel', width: 1280, height: 714 },
    },
  },
  {
    id: 'comparison',
    heading: { title: `${COMPARISON_COLUMNS.triPros} vs other contractors`, subheading: { text: 'The six, side by side.' } },
    content: {
      kind: 'comparison',
      rows: [
        {
          label: 'Licensing and insurance',
          triPros: `CA #${license.licenseNumber} · ${liabilityCoverage} per project · bonded`,
          others: 'Unlicensed or underinsured, and you carry the risk',
        },
        { label: 'Scope of work', triPros: 'Detailed and in writing before work starts', others: 'A one-line estimate or a handshake' },
        { label: 'Supervision', triPros: `${supervision.stat} sets of eyes on every job`, others: 'The crew, unsupervised' },
        { label: 'Communication', triPros: 'One direct contact · same-day replies · weekly updates', others: 'Chasing calls for days' },
        { label: 'Team and support', triPros: `A senior partner and ${supportStaff} support staff`, others: 'One person and a truck' },
        {
          label: 'Proof of performance',
          triPros: `${companyInfo.numProjects}+ projects · Google ${reviews.google.rating.toFixed(1)} · ${reviews.bbb.platform} ${reviews.bbb.rating}`,
          others: '“Trust me”',
        },
      ],
    },
  },
  {
    id: 'extras',
    heading: { title: '…and what most homeowners never think to ask.' },
    content: {
      kind: 'comparison',
      rows: [
        { label: 'Product warranties', triPros: 'Lifetime warranties on many of our products', others: 'Whatever the box says, if it’s still valid' },
        { label: 'Experience', triPros: `${companyInfo.combinedYearsExperience}+ years of combined experience`, others: 'Learning on your house' },
        { label: 'Operations', triPros: 'Office, field crew, and you on one live system', others: 'Lost paperwork and “let me check with the guys”' },
        { label: 'Progress', triPros: 'Every phase photographed and on record', others: 'You drive by to check' },
        { label: 'Financing', triPros: 'Financing and payment programs', others: 'Cash or check up front' },
        { label: 'Change orders', triPros: 'Any change is priced and signed before it happens', others: 'A surprise bill at the end' },
        { label: 'Payments', triPros: 'You pay as work is completed', others: 'A big deposit, then silence' },
        { label: 'Rebates', triPros: 'We find and file your energy rebates and tax credits', others: 'You’re on your own' },
      ],
    },
  },
  {
    id: 'closing',
    frame: 'full',
    heading: { title: 'Success isn’t about the finishes.' },
    background: { kind: 'image', src: IMAGES.hook, alt: 'Finished home exterior at dusk' },
    content: {
      kind: 'closing',
      quote: 'Many times it boils down to communication, supervision, leadership, and accountability. That is what makes it the real deal.',
      cta: { label: 'Continue to Specialties' },
    },
  },
]

/** How many slides carry a number: the "of 6" in the heading column's "3 of 6". */
export const PROOF_POINT_COUNT = WHO_WE_ARE_SLIDES.filter(slide => slide.heading.number !== undefined).length

/** The slides grouped once, at module scope: the hook, one run of eight, the closing. */
export const WHO_WE_ARE_GROUPS = groupSlides(WHO_WE_ARE_SLIDES)
```

`diff` the `WHO_WE_ARE_SLIDES` block against Task 3's before deleting the old file: the two must be identical.

In `src/features/meeting-flow/constants/keyboard-hints.ts`, line 6 becomes:

```ts
  { keys: ['↑', '↓', 'A', 'Z'], label: 'Previous / next slide in the presentation' },
```

`KEY_SHORTCUTS` is unchanged; the step passes `KEY_SHORTCUTS.presentation` to the engine.

- [ ] **Step 10: Shared slide pieces**

`src/features/meeting-flow/ui/components/steps/who-we-are/check-list.tsx`:

```tsx
import { CheckIcon } from 'lucide-react'

interface CheckListProps {
  items: string[]
}

/** What the homeowner can count on, one accent check per line. The agent and team slides share it, so their lists match (U13). */
export function CheckList({ items }: CheckListProps) {
  return (
    <ul className="grid gap-presentation-tight text-presentation-body text-white/85">
      {items.map(item => (
        <li key={item} className="flex items-start gap-[0.6em]">
          <CheckIcon aria-hidden className="mt-[0.2em] size-[1em] shrink-0 text-(--presentation-accent)" />
          {item}
        </li>
      ))}
    </ul>
  )
}
```

`src/features/meeting-flow/ui/components/steps/who-we-are/before-after-pair.tsx`:

```tsx
import type { BeforeAfterMedia } from '@/features/meeting-flow/types'
import Image from 'next/image'

interface BeforeAfterPairProps {
  media: BeforeAfterMedia
}

/**
 * The same room before and after, side by side at the photos' own proportions and
 * bottom-aligned in the media row, so nothing is cropped (U12).
 */
export function BeforeAfterPair({ media }: BeforeAfterPairProps) {
  const aspectRatio = `${media.width} / ${media.height}`
  return (
    <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-[2cqw]">
      <figure className="relative overflow-hidden rounded-md" style={{ aspectRatio }}>
        <Image alt={`${media.alt}, before`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 30vw, 50vw" src={media.before} />
        <figcaption className="absolute top-presentation-tight left-presentation-tight rounded-sm bg-black/60 px-2 py-0.5 font-sans text-presentation-label font-semibold">
          Before
        </figcaption>
      </figure>
      <figure className="relative overflow-hidden rounded-md" style={{ aspectRatio }}>
        <Image alt={`${media.alt}, after`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 30vw, 50vw" src={media.after} />
        <figcaption className="absolute top-presentation-tight left-presentation-tight rounded-sm bg-white/90 px-2 py-0.5 font-sans text-presentation-label font-semibold text-(--presentation-ground)">
          After
        </figcaption>
      </figure>
    </div>
  )
}
```

Replace `src/features/meeting-flow/ui/components/steps/who-we-are/proof-figure.tsx` with:

```tsx
'use client'

import type { ProofFigure as ProofFigureData } from '@/features/meeting-flow/types'
import { Reveal } from '@/shared/components/presentation/reveal'

interface ProofFigureProps {
  proof: ProofFigureData
  order: number
}

/** The point's one big figure, in the accent, with what it means beside it. One size on every slide (U5). */
export function ProofFigure({ proof, order }: ProofFigureProps) {
  return (
    <Reveal className="flex flex-wrap items-baseline gap-x-presentation-tight gap-y-1" order={order}>
      <span className="font-sans text-presentation-figure leading-none font-bold tracking-tight text-(--presentation-accent) tabular-nums lining-nums">
        {proof.value}
      </span>
      <span className="max-w-[30ch] text-presentation-label text-white/65">{proof.label}</span>
    </Reveal>
  )
}
```

Replace `src/features/meeting-flow/ui/components/steps/who-we-are/point-layout.tsx` with:

```tsx
import type { ReactNode } from 'react'

interface PointLayoutProps {
  /** In-flow media (documents, cards, frames); `null` when the slide's background is the media. */
  media: ReactNode
  /** Figures and lists, anchored to the bottom of the slide. */
  children: ReactNode
}

/**
 * The content of a column slide: a media row that takes whatever height the copy leaves, then
 * the copy. One grid instead of independently positioned zones, so media and copy cannot
 * overlap at any aspect ratio. Copy ends `--presentation-clear-b` above the bottom edge,
 * clear of the floating capsule the shell hands the engine through `clearBottom` (U6).
 */
export function PointLayout({ media, children }: PointLayoutProps) {
  return (
    <div className="absolute inset-0 grid grid-rows-[minmax(0,1fr)_auto] gap-presentation-zone px-[6cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))]">
      <div className="relative min-h-0">{media}</div>
      <div className="grid gap-presentation-group">{children}</div>
    </div>
  )
}
```

- [ ] **Step 11: The column slides**

Each section takes `SlideProps<WhoWeAreContentOf<K>>`, peels off `content`, and spreads the rest into `<Slide>`: the frame comes from the config through `groupSlides`, never from the component (S6).

Replace `credentials-section.tsx` with:

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { CredentialDocuments } from '@/features/meeting-flow/ui/components/steps/who-we-are/credential-documents'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ReputationMark } from '@/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type CredentialsSectionProps = SlideProps<WhoWeAreContentOf<'credentials'>>

/**
 * Point 1: the license and certificate of insurance on the desk, then two tiers of
 * proof. Protection figures lead (what covers the homeowner); reputation follows,
 * smaller, under a hairline. The heading is the run's column's; the content carries none (U1).
 */
export function CredentialsSection({ content, ...slide }: CredentialsSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={<CredentialDocuments documents={content.documents} />}>
        <Reveal order={0}>
          <dl className="flex flex-wrap gap-x-[4cqw] gap-y-presentation-tight">
            {content.protection.map(figure => (
              <div key={figure.label} className="grid">
                <dt className="order-last text-presentation-label text-white/60">{figure.label}</dt>
                <dd className="font-sans text-presentation-figure leading-tight font-bold tracking-tight text-white tabular-nums lining-nums">
                  {figure.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal order={1}>
          <ul className="flex flex-wrap items-center gap-x-[3cqw] gap-y-presentation-tight border-t border-white/15 pt-presentation-tight text-presentation-body">
            {content.reputation.map(mark => (
              <ReputationMark key={mark.kind === 'fact' ? mark.value : mark.platform} mark={mark} />
            ))}
          </ul>
        </Reveal>
      </PointLayout>
    </Slide>
  )
}
```

Replace `sample-section.tsx` with:

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { DocumentStack } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-stack'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'
import { Slide } from '@/shared/components/presentation/slide'

type SampleSectionProps = SlideProps<WhoWeAreContentOf<'sample'>>

/** Point 2: a sample scope of work fanned on the desk as a showcase of the detail, then its figure. */
export function SampleSection({ content, ...slide }: SampleSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={<DocumentStack document={content.document} openLabel={content.openLabel} />}>
        <ProofFigure order={0} proof={content.proof} />
      </PointLayout>
    </Slide>
  )
}
```

Replace `point-section.tsx` with:

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { BeforeAfterPair } from '@/features/meeting-flow/ui/components/steps/who-we-are/before-after-pair'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'
import { Slide } from '@/shared/components/presentation/slide'

type PointSectionProps = SlideProps<WhoWeAreContentOf<'point'>>

/** A due-diligence point: its figure, over the slide's photo or under a before/after pair. */
export function PointSection({ content, ...slide }: PointSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={content.media ? <BeforeAfterPair media={content.media} /> : null}>
        <ProofFigure order={0} proof={content.proof} />
      </PointLayout>
    </Slide>
  )
}
```

Replace `agent-section.tsx` with:

```tsx
'use client'

import type { PresentationAgent, WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { AgentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/agent-card'
import { CheckList } from '@/features/meeting-flow/ui/components/steps/who-we-are/check-list'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

interface AgentSectionProps extends SlideProps<WhoWeAreContentOf<'agent'>> {
  /** The meeting owner: the homeowner's point of contact. */
  agent: PresentationAgent
}

/** Point 4: the agent in the room is the homeowner's line; their card, then what to expect from them. */
export function AgentSection({ content, agent, ...slide }: AgentSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout
        media={(
          <Reveal className="absolute inset-0 flex items-center" order={0}>
            <AgentCard agent={agent} role={content.cardRole} />
          </Reveal>
        )}
      >
        <Reveal order={1}>
          <CheckList items={content.commitments} />
        </Reveal>
      </PointLayout>
    </Slide>
  )
}
```

Replace `team-section.tsx` with:

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import Image from 'next/image'
import { CheckList } from '@/features/meeting-flow/ui/components/steps/who-we-are/check-list'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type TeamSectionProps = SlideProps<WhoWeAreContentOf<'team'>>

/**
 * Point 5: the senior partner who stays hands-on, and the office behind the partner. The
 * partner's portrait fills the media row; their commitments and the support staff figure sit
 * side by side under it. No team-photo slot until the photo exists (U10).
 */
export function TeamSection({ content, ...slide }: TeamSectionProps) {
  const { partner } = content
  return (
    <Slide {...slide}>
      <PointLayout
        media={(
          <figure className="absolute inset-y-0 left-0 aspect-[3/4] overflow-hidden rounded-md">
            <Image alt={`${partner.name}, ${partner.title}`} className="object-cover object-[50%_15%]" draggable={false} fill sizes="(min-width: 1024px) 24vw, 40vw" src={partner.image} />
            <figcaption
              className="absolute inset-x-0 bottom-0 grid gap-1 px-presentation-tight pt-presentation-zone pb-presentation-tight"
              style={{ background: 'linear-gradient(to top, var(--presentation-ground), transparent)' }}
            >
              <span className="font-sans text-presentation-body leading-tight font-semibold">{partner.name}</span>
              <span className="text-presentation-label text-white/70">{partner.title}</span>
            </figcaption>
          </figure>
        )}
      >
        <div className="flex flex-wrap items-end justify-between gap-x-[4cqw] gap-y-presentation-group">
          <Reveal order={0}>
            <CheckList items={partner.points} />
          </Reveal>
          <ProofFigure order={1} proof={content.proof} />
        </div>
      </PointLayout>
    </Slide>
  )
}
```

Replace `comparison-section.tsx` with:

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { ComparisonTable } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-table'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type ComparisonSectionProps = SlideProps<WhoWeAreContentOf<'comparison'>>

/**
 * Tri Pros against other contractors: the six points, and the extras. A growth slide: the
 * content stays in flow with a one-screen minimum, so a comparison taller than the screen
 * makes the slide taller instead of being clipped (spec C §4.4, review F6).
 */
export function ComparisonSection({ content, ...slide }: ComparisonSectionProps) {
  return (
    <Slide {...slide}>
      <div className="grid min-h-[calc(100cqh-var(--band-h,0px))] content-center px-[6cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))]">
        <Reveal order={0}>
          <ComparisonTable rows={content.rows} />
        </Reveal>
      </div>
    </Slide>
  )
}
```

Replace `comparison-table.tsx` with (`density` deleted, C42; the import moves to `who-we-are-slides`; `font-medium` gone; replaced whole by the sheets in Task 5):

```tsx
import type { ComparisonRow } from '@/features/meeting-flow/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { COMPARISON_COLUMNS } from '@/features/meeting-flow/constants/who-we-are-slides'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

interface ComparisonTableProps {
  rows: ComparisonRow[]
}

/**
 * Tri Pros against other contractors, one topic per row. The Tri Pros column carries
 * a light band and accent checks; the other column recedes. Both comparison slides render
 * it at one density: each has a whole screen (C42).
 */
export function ComparisonTable({ rows }: ComparisonTableProps) {
  const cell = 'px-[1.4cqw] py-presentation-tight text-presentation-body'

  return (
    <Table className="table-fixed text-white">
      <colgroup>
        <col className="w-[26%]" />
        <col className="w-[39%]" />
        <col className="w-[35%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="border-white/20 hover:bg-transparent">
          <TableHead className={cn(cell, 'h-auto')}>
            <span className="sr-only">Topic</span>
          </TableHead>
          <TableHead className={cn(cell, 'h-auto bg-white/[0.08] font-semibold text-white')}>{COMPARISON_COLUMNS.triPros}</TableHead>
          <TableHead className={cn(cell, 'h-auto font-normal text-white/60')}>{COMPARISON_COLUMNS.others}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.label} className="border-white/10 hover:bg-transparent">
            <TableHead className={cn(cell, 'h-auto align-top font-semibold break-words hyphens-auto whitespace-normal text-white/80')} scope="row">
              {row.label}
            </TableHead>
            <TableCell className={cn(cell, 'bg-white/[0.08] align-top whitespace-normal')}>
              <span className="flex items-start gap-[0.6em]">
                <CheckIcon aria-hidden className="mt-[0.2em] size-[1em] shrink-0 text-(--presentation-accent)" />
                <span>
                  <span className="sr-only">
                    {COMPARISON_COLUMNS.triPros}
                    :
                    {' '}
                  </span>
                  {row.triPros}
                </span>
              </span>
            </TableCell>
            <TableCell className={cn(cell, 'align-top whitespace-normal text-white/55')}>
              <span className="flex items-start gap-[0.6em]">
                <XIcon aria-hidden className="mt-[0.2em] size-[1em] shrink-0 text-white/35" />
                <span>
                  <span className="sr-only">
                    {COMPARISON_COLUMNS.others}
                    :
                    {' '}
                  </span>
                  {row.others}
                </span>
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 12: The closing and the step**

`src/features/meeting-flow/ui/components/steps/who-we-are/closing-section.tsx`:

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { ArrowRightIcon } from 'lucide-react'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'
import { Button } from '@/shared/components/ui/button'

interface ClosingSectionProps extends SlideProps<WhoWeAreContentOf<'closing'>> {
  /** Advances the meeting flow to the next step. */
  onContinue: () => void
}

/**
 * The last slide (C3): the closing truth over the dusk photo, the quote at the lead size in
 * the body face (never serif italic), and the hand-off to the next step in the accent (U3, U8).
 * `Slide` renders the centred heading at orders 0 and 1; the quote and the button follow.
 */
export function ClosingSection({ content, onContinue, ...slide }: ClosingSectionProps) {
  return (
    <Slide {...slide}>
      <Reveal order={2}>
        <p className="max-w-[52ch] text-presentation-lead text-white/90">{content.quote}</p>
      </Reveal>
      <Reveal order={3}>
        <Button
          className="min-h-11 bg-(--presentation-accent) font-semibold text-(--presentation-ground) hover:bg-(--presentation-accent)/90"
          size="lg"
          onClick={onContinue}
        >
          {content.cta.label}
          <ArrowRightIcon />
        </Button>
      </Reveal>
    </Slide>
  )
}
```

Replace `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx` with (the kind switch stays inline, as a closure in the component body, S13; there is no dispatcher component):

```tsx
'use client'

import type { Ref } from 'react'
import type { PresentationAgent, WhoWeAreContent } from '@/features/meeting-flow/types'
import type { IndexedSlide, PresentationHandle } from '@/shared/components/presentation/types'
import { KEY_SHORTCUTS } from '@/features/meeting-flow/constants/keyboard-hints'
import { PROOF_POINT_COUNT, WHO_WE_ARE_GROUPS } from '@/features/meeting-flow/constants/who-we-are-slides'
import { AgentSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/agent-section'
import { ClosingSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/closing-section'
import { ComparisonSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-section'
import { CredentialsSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/credentials-section'
import { PointSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-section'
import { SampleSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/sample-section'
import { TeamSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/team-section'
import { Presentation } from '@/shared/components/presentation/presentation'
import { Slide } from '@/shared/components/presentation/slide'
import { SlideRun } from '@/shared/components/presentation/slide-run'

interface WhoWeAreStepProps {
  /** The meeting owner, introduced as the homeowner's point of contact. */
  agent: PresentationAgent
  /** Advances the meeting flow to the Specialties step. */
  onContinue: () => void
  /** Slide navigation for the shell's key map; forwarded to the presentation. */
  ref?: Ref<PresentationHandle>
}

/**
 * Step 1 of the meeting flow: the due-diligence story (docs/sales/due-diligence-story.md)
 * as a presentation. The hook, one run of eight column slides sharing a heading column, and
 * the closing. The kind switch is exhaustive (L1); the `hero` slide is its heading and photo
 * alone. The shell reaches the engine only through its named props: the step-root marker
 * for focus, the key shortcuts, and the capsule clearance (spec C S9).
 * Deck rules: see src/features/meeting-flow/DOCS.md#who-we-are-deck
 */
export function WhoWeAreStep({ agent, onContinue, ref }: WhoWeAreStepProps) {
  const renderSlide = ({ slide, index, frame }: IndexedSlide<WhoWeAreContent>) => {
    const { content } = slide
    const props = { index, frame, id: slide.id, heading: slide.heading, background: slide.background }
    switch (content.kind) {
      case 'hero':
        return <Slide key={slide.id} {...props} />
      case 'credentials':
        return <CredentialsSection key={slide.id} {...props} content={content} />
      case 'sample':
        return <SampleSection key={slide.id} {...props} content={content} />
      case 'point':
        return <PointSection key={slide.id} {...props} content={content} />
      case 'agent':
        return <AgentSection key={slide.id} {...props} agent={agent} content={content} />
      case 'team':
        return <TeamSection key={slide.id} {...props} content={content} />
      case 'comparison':
        return <ComparisonSection key={slide.id} {...props} content={content} />
      case 'closing':
        return <ClosingSection key={slide.id} {...props} content={content} onContinue={onContinue} />
      default:
        throw new Error(`Unknown slide kind: ${content satisfies never}`)
    }
  }

  return (
    <Presentation
      ref={ref}
      clearBottom="var(--stage-clear-b)"
      keyShortcuts={KEY_SHORTCUTS.presentation}
      label="Who we are presentation"
      rootAttributes={{ 'data-step-root': true }}
    >
      {WHO_WE_ARE_GROUPS.map(group => group.kind === 'full'
        ? renderSlide(group.item)
        : (
            <SlideRun key={`run-${group.items[0].index}`} items={group.items} numberedTotal={PROOF_POINT_COUNT}>
              {group.items.map(renderSlide)}
            </SlideRun>
          ))}
    </Presentation>
  )
}
```

`WhoWeAreStep`'s props are unchanged, so the view's call site (`meeting-flow.tsx:304`) is untouched; only its `PresentationHandle` import moves (Step 13).

- [ ] **Step 13: Delete what the slide model replaced, and repoint the last imports**

Delete the files (plain `rm`): `hook-section.tsx`, `point-heading.tsx`, `point-media-layer.tsx`, `truth-section.tsx`, `placeholder-slot.tsx` (all in `steps/who-we-are/`).

In `src/features/meeting-flow/types/index.ts`: delete the `PresentationHandle` interface and its doc comment (near line 91; the engine's `types.ts` owns it now), the `PointMedia` union (near line 103), `PinnedSummary` (near line 143) and `WhoWeAreSection` (near line 151). Two doc comments change one word: `/** One mark in the licensing slide's reputation line. */` and `/** The meeting owner, introduced on the Communication slide. */`. The `// ── Shell` section keeps `PanelSection` and `KeyHint`.

In `src/features/meeting-flow/ui/views/meeting-flow.tsx`, line 3 splits into:

```ts
import type { MeetingFlowContext, PanelSection } from '@/features/meeting-flow/types'
import type { PresentationHandle } from '@/shared/components/presentation/types'
```

(`eslint --fix` places the second line among the type imports.) Nothing else in the view changes in this task; Task 8 owns its splash edits.

In `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts`, line 4 becomes:

```ts
import type { PresentationHandle } from '@/shared/components/presentation/types'
```

In `src/features/meeting-flow/ui/components/steps/who-we-are/credential-documents.tsx`, line 5 becomes `import { Reveal } from '@/shared/components/presentation/reveal'` (`eslint --fix` moves it after the feature imports), and the doc comment's "the media row of the licensing beat" becomes "the media row of the licensing slide". In `document-stack.tsx`, line 7 becomes the same `Reveal` import. Task 6 rewrites both files further; this task touches only those lines.

In `src/features/meeting-flow/lib/to-presentation-agent.ts`, line 7's doc comment becomes `/** The meeting owner as the Communication slide introduces them; the cropped headshot wins over the account photo. */`.

Run: `grep -rnE "WHO_WE_ARE_SECTIONS|WHO_WE_ARE_PINNED|PinnedSummary|WhoWeAreSection|\bPointMedia\b|--pin-h|PointHeading|PointMediaLayer|TruthSection|HookSection|PlaceholderSlot|SnapPresentation|SnapSection|PinnedColumn|SectionImage|SectionInViewContext|useSectionInView|PIN_SWAP_TRANSITION|BeatRun|toBeatGroups|who-we-are-sections|meeting-flow/contexts/presentation-context|meeting-flow/constants/presentation-motion|meeting-flow/ui/components/presentation" src`
Expected: no output.
Run: `grep -rniwE "beat|beats" src/features/meeting-flow src/shared/components/presentation`
Expected: no output. (The funnels' "anticipation beat" under `src/shared/domains/funnels/` is another domain's word and stays.)
Run: `grep -rniE "stage|lg:|sm:|md:" src/shared/components/presentation`
Expected: no output: the engine never says "stage" and has no viewport variants.
Run: `grep -rnE "density|Riviera" src/features/meeting-flow/ui/components/steps/who-we-are src/features/meeting-flow/constants/who-we-are-slides.ts`
Expected: no output. (Both words occur elsewhere in `src`, in files this plan does not own.)
Run: `ls src/features/meeting-flow/ui/components/presentation src/features/meeting-flow/contexts/presentation-context.tsx src/features/meeting-flow/constants/presentation-motion.ts src/features/meeting-flow/constants/who-we-are-sections.ts 2>&1 | grep -c "No such file"`
Expected: `4`.

- [ ] **Step 14: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/components/presentation src/features/meeting-flow`
Expected: no output.

- [ ] **Step 15: Run the checks and watch them pass**

Run: `node $WS/tools/verify-deck.mjs`
Expected: `ALL PASS`.
Run: `node $WS/tools/nudge-release.mjs`
Expected: `PASS`.
Run: `pnpm exec tsx $WS/checks/group-slides.ts`
Expected: `group-slides: ok` (unchanged; confirms the engine folder still resolves after the moves).

- [ ] **Step 16: Commit**

`refactor(presentation): the engine moves to shared; Who We Are renders slides in frames` — every path listed under **Files** above: the eleven engine files, the eight moved-away feature files, the four new feature files, the seventeen modified feature files and the six deleted feature files (and `MF/ui/components/presentation/scrim.tsx`'s foreign comment line if the owner chose to let this commit carry it). Path-only `git add` of the new files, then `git commit -m … -- <all paths>`; `git show --stat HEAD` should report the six presentation components, the context and the motion constants as renames.

---

### Task 5: The comparison as two quotes on the desk (U4, C2, F8 comparison container)

**Files:**
- Create: `$WS/tools/verify-comparison.mjs`
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/comparison-sheet.tsx`, `comparison-sheets.tsx`
- Modify: `src/features/meeting-flow/ui/components/steps/who-we-are/comparison-section.tsx`
- Delete: `src/features/meeting-flow/ui/components/steps/who-we-are/comparison-table.tsx`

**Interfaces:**
- Consumes: `ComparisonRow` (`@/features/meeting-flow/types`), `COMPARISON_COLUMNS` (`{ triPros, others }`, `@/features/meeting-flow/constants/who-we-are-slides`), `Reveal` (`@/shared/components/presentation/reveal`), the `text-presentation-*` and `gap-presentation-*` tokens. The section is `SlideProps<WhoWeAreContentOf<'comparison'>>` since Task 4 and renders `<Slide {...props}>` around its content; this task changes only what sits inside.
- Produces: `ComparisonSheets({ rows })`; `ComparisonSheet({ rows, side: 'triPros' | 'others' })`, which renders `data-sheet={side}`.

- [ ] **Step 1: Write the check**

`$WS/tools/verify-comparison.mjs`:

```js
// U4 / C2 / spec C §4.3–§4.4: two sheets that sit side by side on a table at least 44rem wide
// and stack below it, rows in step, nothing clipped, body text on the role token. The sheets'
// wrapper is the `comparison` container (its own, not the `presentation` one), so `cqw`
// inside it measures the table.
import { buildCss, openStep1, setup } from './common.mjs'

const SIZES = [[1440, 900], [1280, 800], [1024, 768], [820, 1180]]
const ROWS = { comparison: 6, extras: 8 }
const css = buildCss()
const failures = []
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
  if (!ok) {
    failures.push(label)
  }
}

for (const [width, height] of SIZES) {
  const { browser, page } = await setup({ width, height })
  try {
    await openStep1(page, { css })
    for (const id of Object.keys(ROWS)) {
      const tag = `${width}x${height} ${id}`
      const state = await page.evaluate((slideId) => {
        const section = document.getElementById(slideId)
        const container = section.querySelector('[class~="@container/comparison"]')
        const sheets = [...section.querySelectorAll('[data-sheet]')]
        const [a, b] = sheets.map(sheet => sheet.getBoundingClientRect())
        const body = sheets[0]?.querySelector('li .text-presentation-body')
        return {
          containerWidth: container?.getBoundingClientRect().width ?? 0,
          sheets: sheets.map(sheet => sheet.getAttribute('data-sheet')),
          rows: sheets.map(sheet => sheet.querySelectorAll('li').length),
          sideBySide: a && b ? Math.abs(a.top - b.top) <= 2 : null,
          stacked: a && b ? b.top >= a.bottom - 1 : null,
          clipped: section.scrollHeight > section.clientHeight + 1,
          overflowX: sheets.some(sheet => sheet.scrollWidth > sheet.clientWidth + 1),
          bodyPx: body ? Number.parseFloat(getComputedStyle(body).fontSize) : 0,
          table: section.querySelector('table') !== null,
        }
      }, id)
      const wide = state.containerWidth >= 704
      check(`${tag} two sheets, Tri Pros first`, JSON.stringify(state.sheets) === '["triPros","others"]', state.sheets)
      check(`${tag} ${ROWS[id]} rows on each sheet`, state.rows.every(count => count === ROWS[id]), state.rows)
      check(`${tag} ${wide ? 'side by side' : 'stacked'} at a ${Math.round(state.containerWidth)}px table`, wide ? state.sideBySide : state.stacked, state)
      check(`${tag} nothing clipped`, !state.clipped, state)
      check(`${tag} no horizontal overflow`, !state.overflowX, state)
      // `text-presentation-body` is clamp(1.0625rem, 1.25cqw, 2.125rem); inside the sheets `cqw` is the table.
      const expected = Math.min(Math.max(17, 0.0125 * state.containerWidth), 34)
      check(`${tag} body text on the role token`, Math.abs(state.bodyPx - expected) <= 0.6, { px: state.bodyPx, expected })
      check(`${tag} no table`, !state.table, state.table)
    }
  }
  finally {
    await browser.close()
  }
}
console.log(failures.length ? `\n${failures.length} FAIL` : '\nALL PASS')
process.exitCode = failures.length ? 1 : 0
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node $WS/tools/verify-comparison.mjs`
Expected: FAIL on `two sheets` and `no table` at every size (the slide still renders the table).

- [ ] **Step 3: One sheet**

`src/features/meeting-flow/ui/components/steps/who-we-are/comparison-sheet.tsx`:

```tsx
'use client'

import type { ComparisonRow } from '@/features/meeting-flow/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { COMPARISON_COLUMNS } from '@/features/meeting-flow/constants/who-we-are-slides'
import { Reveal } from '@/shared/components/presentation/reveal'
import { cn } from '@/shared/lib/utils'

interface ComparisonSheetProps {
  rows: ComparisonRow[]
  /** Which column of each row this sheet quotes. */
  side: 'triPros' | 'others'
}

/**
 * One quote on the desk: the detailed Tri Pros sheet, or the thin generic one with no
 * letterhead (C2). Row N reveals at stagger N on both sheets, so the pair lands together.
 */
export function ComparisonSheet({ rows, side }: ComparisonSheetProps) {
  const detailed = side === 'triPros'
  const Icon = detailed ? CheckIcon : XIcon
  return (
    <div
      className={cn(
        'grid gap-presentation-group rounded-md p-6 text-(--presentation-ground)',
        detailed ? 'bg-white shadow-2xl shadow-black/50' : 'bg-white/75',
      )}
      data-sheet={side}
    >
      <h3 className="font-sans text-presentation-label font-semibold tracking-[0.08em] uppercase">{COMPARISON_COLUMNS[side]}</h3>
      <ul className="grid gap-presentation-tight">
        {rows.map((row, position) => (
          <li key={row.label}>
            <Reveal className="grid gap-0.5" order={position}>
              <span className="text-presentation-label font-semibold text-(--presentation-ground)/70">{row.label}</span>
              <span className={cn('flex items-start gap-[0.6em] text-presentation-body', !detailed && 'text-(--presentation-ground)/80')}>
                <Icon aria-hidden className={cn('mt-[0.2em] size-[1em] shrink-0', !detailed && 'opacity-50')} />
                {row[side]}
              </span>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: The pair, in its own container**

`src/features/meeting-flow/ui/components/steps/who-we-are/comparison-sheets.tsx`:

```tsx
import type { ComparisonRow } from '@/features/meeting-flow/types'
import { ComparisonSheet } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-sheet'

interface ComparisonSheetsProps {
  rows: ComparisonRow[]
}

/**
 * Tri Pros' sheet beside a typical quote (C2). The wrapper is the `comparison` container,
 * so the sheets stack when the table itself is narrower than 44rem, whatever the
 * presentation is doing: in column mode the table has about 62% of the scroller, in band
 * mode all of it (spec C §4.3, §12 S10). Inside it `cqw` measures the table, so every size
 * here is a role token or rem. This is the one container the engine does not own.
 */
export function ComparisonSheets({ rows }: ComparisonSheetsProps) {
  return (
    <div className="@container/comparison">
      <div className="grid grid-cols-[3fr_2fr] items-start gap-presentation-group @max-[44rem]/comparison:grid-cols-1">
        <ComparisonSheet rows={rows} side="triPros" />
        <ComparisonSheet rows={rows} side="others" />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Swap the table out**

In `comparison-section.tsx` (Task 4's version: `SlideProps<WhoWeAreContentOf<'comparison'>>`, `<Slide {...props}>`, a growth-slide wrapper in flow), make exactly two changes: the import line `import { ComparisonTable } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-table'` becomes `import { ComparisonSheets } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-sheets'`, and the element `<ComparisonTable rows={…} />` becomes `<ComparisonSheets rows={…} />` with the same `rows` expression Task 4 wrote (`content.rows`). The wrapper, the `Reveal` around it and the `Slide` spread stay as Task 4 left them.

Delete the table: `rm src/features/meeting-flow/ui/components/steps/who-we-are/comparison-table.tsx`.

Run: `grep -rn "ComparisonTable\|comparison-table" src` — expected: no output.

- [ ] **Step 6: Type-check, lint, run the check**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow/ui/components/steps/who-we-are`
Expected: no output.
Run: `node $WS/tools/verify-comparison.mjs`
Expected: `ALL PASS`. Record each size's table width and layout in the report: they are the §7.3 evidence (whether 44rem holds, and whether the comparison slides fit a `column` frame).

- [ ] **Step 7: Commit**

`feat(who-we-are): the comparison as two quotes on the desk` — paths: the two new files, `comparison-section.tsx`, and the deleted `comparison-table.tsx`.

---

### Task 6: Nothing unfinished, everything tappable, nothing tilted (U7 remainder, U10, U11, U13)

**Files:**
- Create: `$WS/tools/verify-content.mjs`, `$WS/tools/scrub-placeholder.py`
- Modify: `public/meeting-flow/placeholders/sample-scope-page.jpg`
- Modify: `src/features/meeting-flow/lib/to-presentation-agent.ts`
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/tap-cue.tsx`
- Modify: `src/features/meeting-flow/ui/components/steps/who-we-are/agent-card.tsx`, `credential-documents.tsx`, `document-card.tsx`, `document-stack.tsx`, `document-dialog.tsx`, `credentials-section.tsx`

**Interfaces:**
- Consumes: `content.openLabel` on the `credentials` and `sample` bodies (Task 3, `'Tap to view'`); `--presentation-scrim` at `:root` (Task 2); `Reveal` from `@/shared/components/presentation/reveal` (Task 4 already moved these files' imports).
- Produces: `TapCue({ label })`; `CredentialDocuments({ documents, openLabel })`; `DocumentCard({ document, onOpen })` (no `className`); `toPresentationAgent` returns `image: meeting.ownerHeadshotUrl ?? null`.

- [ ] **Step 1: Write the check**

`$WS/tools/verify-content.mjs`:

```js
// U10, U11, U13: no developer text, a brand mark instead of a letter avatar, tap cues, a 44px
// dialog close, no rotated text, no orphaned reputation mark, matching list sizes.
import { buildCss, openStep1, setup } from './common.mjs'

const css = buildCss()
const failures = []
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
  if (!ok) {
    failures.push(label)
  }
}

for (const [width, height] of [[1440, 900], [820, 1180]]) {
  const tag = `${width}x${height}`
  const { browser, page } = await setup({ width, height })
  try {
    await openStep1(page, { css })
    const state = await page.evaluate(() => {
      const scroller = document.querySelector('[role="region"][data-step-root]')
      const rotated = [...scroller.querySelectorAll('*')].filter((element) => {
        const style = getComputedStyle(element)
        const matrix = style.transform.startsWith('matrix(') ? style.transform.slice(7, -1).split(',').map(Number) : null
        return (style.rotate !== 'none' && style.rotate !== '0deg') || (matrix !== null && Math.abs(matrix[1]) > 0.0001)
      }).map(element => element.className.toString().slice(0, 80))
      const reputation = scroller.querySelector('section#licensing ul')
      const listPx = id => Number.parseFloat(getComputedStyle(scroller.querySelector(`section#${id} ul li`)).fontSize)
      const card = scroller.querySelector('section#communication .shadow-2xl')
      return {
        rotated,
        tapCues: ['licensing', 'scope'].filter(id => scroller.querySelector(`section#${id}`)?.textContent?.includes('Tap to view')),
        reputationColumns: reputation ? getComputedStyle(reputation).gridTemplateColumns.split(' ').length : 0,
        agentListPx: listPx('communication'),
        teamListPx: listPx('team'),
        teamSlot: scroller.querySelector('section#team')?.textContent?.includes('to be shot') ?? false,
        cardImages: card ? [...card.querySelectorAll('img')].map(img => img.getAttribute('src') ?? '') : [],
      }
    })
    check(`${tag} no rotated elements in the presentation`, state.rotated.length === 0, state.rotated)
    check(`${tag} tap cues on the documents`, state.tapCues.length === 2, state.tapCues)
    check(`${tag} reputation marks in two columns`, state.reputationColumns === 2, state.reputationColumns)
    check(`${tag} agent and team lists match`, state.agentListPx === state.teamListPx, state)
    check(`${tag} no team-photo slot`, !state.teamSlot, state.teamSlot)
    check(`${tag} no account photo on the agent card`, state.cardImages.length === 1 && !state.cardImages[0].includes('googleusercontent'), state.cardImages)

    await page.locator('section#licensing button').first().click()
    const close = page.locator('[role="dialog"] [data-slot="dialog-close"]')
    await close.waitFor({ timeout: 5000 })
    const box = await close.boundingBox()
    check(`${tag} dialog close is at least 44px`, box.width >= 44 && box.height >= 44, box)
    await page.keyboard.press('Escape')
  }
  finally {
    await browser.close()
  }
}
console.log(failures.length ? `\n${failures.length} FAIL` : '\nALL PASS')
process.exitCode = failures.length ? 1 : 0
```

`$WS/tools/scrub-placeholder.py`:

```python
# U10: the sample-scope placeholder must carry no developer text. Paints the subtitle band
# ("Placeholder page. The real pages upload to R2.", rows 352-387 of 2200) in the page colour,
# then prints the remaining text bands between the title and the rule.
import sys
from PIL import Image, ImageDraw

path = 'public/meeting-flow/placeholders/sample-scope-page.jpg'
image = Image.open(path).convert('RGB')
if '--check' not in sys.argv:
    page = image.getpixel((60, 370))
    ImageDraw.Draw(image).rectangle([0, 340, image.width, 400], fill=page)
    image.save(path, quality=90)
gray = image.convert('L')
bands, start = [], None
for y in range(200, 470):
    ink = any(gray.getpixel((x, y)) < 200 for x in range(140, 1600, 2))
    if ink and start is None:
        start = y
    if not ink and start is not None:
        bands.append((start, y - 1))
        start = None
print(bands)
```

- [ ] **Step 2: Run the check and watch it fail**

Run: `node $WS/tools/verify-content.mjs`
Expected: FAIL on `no rotated elements`, `tap cues` (the stack says "Tap to view" but the credentials do not: 1 of 2), `reputation marks in two columns`, `dialog close is at least 44px`, and on `no account photo` if the dev meeting's owner has an account photo.
Run: `python3 $WS/tools/scrub-placeholder.py --check`
Expected: `[(253, 313), (352, 387), (440, 443)]`: title, the developer line, the rule.

- [ ] **Step 3: Scrub the placeholder page**

Run: `python3 $WS/tools/scrub-placeholder.py`
Expected: `[(253, 313), (440, 443)]`. Then view the file with the Read tool: the title "Sample scope of work" and the grey lines remain; the sentence is gone.

- [ ] **Step 4: The agent card**

Replace `src/features/meeting-flow/lib/to-presentation-agent.ts` with:

```ts
import type { inferRouterOutputs } from '@trpc/server'
import type { PresentationAgent } from '@/features/meeting-flow/types'
import type { AppRouter } from '@/trpc/routers/app'

type MeetingWithJoins = NonNullable<inferRouterOutputs<AppRouter>['meetingsRouter']['reads']['getByIdWithJoins']>

/**
 * The meeting owner as the Communication slide introduces them. Only the cropped headshot is
 * used: an account photo can be a generated letter avatar, and without a headshot the card
 * shows the brand mark instead (U10).
 */
export function toPresentationAgent(meeting: MeetingWithJoins): PresentationAgent {
  return {
    name: meeting.ownerName,
    image: meeting.ownerHeadshotUrl ?? null,
    email: meeting.ownerEmail,
    phone: meeting.ownerPhone,
    yearsOfExperience: meeting.ownerYearsOfExperience,
  }
}
```

Replace `agent-card.tsx` with:

```tsx
import type { PresentationAgent } from '@/features/meeting-flow/types'
import LogoDarkIcon from '@public/company/logo/logo-dark.svg'
import { HardHatIcon, MailIcon, PhoneIcon } from 'lucide-react'
import Image from 'next/image'
import { ContactLine } from '@/features/meeting-flow/ui/components/steps/who-we-are/contact-line'
import { companyInfo } from '@/shared/constants/company'
import { formatPhone } from '@/shared/lib/phone'

interface AgentCardProps {
  agent: PresentationAgent
  /** The agent's role for this homeowner, e.g. "Your point of contact". */
  role: string
}

/**
 * The agent's business card on the desk: headshot, or the brand mark when there is none;
 * name, role and the contact lines the agent's profile has filled in. The card sizes to its
 * content (U10) and sits square: rotated type blurs on low-DPI screens (U13).
 */
export function AgentCard({ agent, role }: AgentCardProps) {
  return (
    <div className="flex w-fit max-w-full overflow-hidden bg-white text-(--presentation-ground) shadow-2xl shadow-black/60">
      <div className="relative w-[clamp(6rem,11cqw,10rem)] shrink-0 bg-(--presentation-ground)">
        {agent.image
          ? <Image alt={agent.name} className="object-cover object-top" draggable={false} fill sizes="10rem" src={agent.image} />
          : <Image alt="" className="object-contain p-[18%]" draggable={false} fill src={LogoDarkIcon} />}
      </div>
      <div className="grid min-w-0 content-between gap-presentation-group p-presentation-group">
        <div className="grid gap-1">
          <p className="font-sans text-presentation-lead leading-tight font-semibold tracking-tight text-balance">{agent.name}</p>
          <p className="text-presentation-label text-(--presentation-ground)/70">
            {role}
            {' · '}
            {companyInfo.name}
          </p>
        </div>
        <dl className="grid gap-presentation-tight text-presentation-body">
          {agent.phone && <ContactLine icon={PhoneIcon} label="Phone" value={formatPhone(agent.phone)} />}
          <ContactLine icon={MailIcon} label="Email" value={agent.email} />
          {agent.yearsOfExperience !== null && (
            <ContactLine icon={HardHatIcon} label="Experience" value={`${agent.yearsOfExperience} years in construction`} />
          )}
        </dl>
      </div>
    </div>
  )
}
```

(`logo-dark.svg` is the white house and blue R, the same mark as the splash, for dark grounds; `Logo` in `src/shared/components/logo.tsx` imports it the same way.)

- [ ] **Step 5: Tap cues and square documents**

`src/features/meeting-flow/ui/components/steps/who-we-are/tap-cue.tsx`:

```tsx
import { ZoomInIcon } from 'lucide-react'

interface TapCueProps {
  label: string
}

/** The visible "Tap to view" on a document the homeowner can open (U11). Decorative: every opener carries its own accessible name. */
export function TapCue({ label }: TapCueProps) {
  return (
    <span aria-hidden className="inline-flex items-center gap-2 rounded-md bg-(--presentation-ground)/90 px-3 py-1.5 font-sans text-presentation-label font-semibold text-white">
      <ZoomInIcon className="size-[1.1em] shrink-0" />
      {label}
    </span>
  )
}
```

Replace `document-card.tsx` with (the `className` prop existed only to rotate the card):

```tsx
'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { cn } from '@/shared/lib/utils'

interface DocumentCardProps {
  document: PresentationDocument
  onOpen: () => void
}

/** The first page of a document laid on the desk at its true proportions, square to the slide (U13). Tap to read it. */
export function DocumentCard({ document, onOpen }: DocumentCardProps) {
  return (
    <button
      aria-label={`Open ${document.title}`}
      className={cn(
        'block h-full max-w-full cursor-zoom-in bg-white p-[0.8cqw] shadow-2xl shadow-black/60 outline-none',
        // Ring colour sits at zero width until hover, so the card answers a pointer
        // without moving: a transform would shift a snap area's border box.
        'ring-white/25 hover:ring-4',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
      style={{ aspectRatio: `${document.width} / ${document.height}` }}
      type="button"
      onClick={onOpen}
    >
      <span className="relative block h-full w-full">
        <Image
          alt={document.alt}
          className="object-cover object-top"
          draggable={false}
          fill
          sizes="(min-width: 1024px) 30vw, 60vw"
          src={document.pages[0]}
        />
      </span>
    </button>
  )
}
```

Replace `credential-documents.tsx` with:

```tsx
'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { DocumentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-card'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { TapCue } from '@/features/meeting-flow/ui/components/steps/who-we-are/tap-cue'
import { Reveal } from '@/shared/components/presentation/reveal'

interface CredentialDocumentsProps {
  /** The contractor license, then the certificate of insurance. */
  documents: PresentationDocument[]
  /** The visible cue under the documents, e.g. "Tap to view". */
  openLabel: string
}

/**
 * The license and the certificate of insurance laid like paper on the desk, filling
 * the media row of the licensing slide. Both cards size from the row's height at
 * their true proportions; the license overlaps the certificate when the row is narrow.
 * Square to the slide: rotated type blurs on low-DPI screens (U13).
 */
export function CredentialDocuments({ documents, openLabel }: CredentialDocumentsProps) {
  const [openDocument, setOpenDocument] = useState<PresentationDocument | null>(null)

  return (
    <>
      {documents.map((document, position) => (
        <Reveal
          key={document.title}
          className={position === 0
            ? 'absolute top-[12%] left-0 z-10 h-[62%] max-w-[72%]'
            : 'absolute top-0 right-0 h-full max-w-[56%]'}
          order={position}
        >
          <DocumentCard document={document} onOpen={() => setOpenDocument(document)} />
        </Reveal>
      ))}
      <Reveal className="absolute bottom-0 left-0 z-20" order={documents.length}>
        <TapCue label={openLabel} />
      </Reveal>

      <DocumentDialog document={openDocument} onClose={() => setOpenDocument(null)} />
    </>
  )
}
```

Replace `document-stack.tsx` with:

```tsx
'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { useState } from 'react'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { TapCue } from '@/features/meeting-flow/ui/components/steps/who-we-are/tap-cue'
import { Reveal } from '@/shared/components/presentation/reveal'
import { cn } from '@/shared/lib/utils'

interface DocumentStackProps {
  document: PresentationDocument
  /** The visible cue on the front page, e.g. "Tap to view". */
  openLabel: string
}

/**
 * A multi-page document fanned on the desk: the first three pages, front page on
 * top. The whole stack is one button that opens every page in the dialog. The fan is
 * offsets only, never rotation: a rotated page of text blurs on low-DPI screens (U13).
 */
export function DocumentStack({ document, openLabel }: DocumentStackProps) {
  const [open, setOpen] = useState(false)
  // Back to front: the last fanned page renders first so the front page paints on top.
  const fanned = document.pages.slice(0, 3).reverse()
  const fan = ['translate-x-[12%] -translate-y-[4%]', 'translate-x-[6%] -translate-y-[2%]', ''].slice(-fanned.length)

  return (
    <>
      <Reveal className="absolute inset-y-0 left-0 w-full" order={0}>
        <button
          aria-label={`Open ${document.title}, ${document.pages.length} pages`}
          className="group relative block h-[92%] max-w-[64%] cursor-zoom-in outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          style={{ aspectRatio: `${document.width} / ${document.height}` }}
          type="button"
          onClick={() => setOpen(true)}
        >
          {fanned.map((page, position) => (
            <span
              // Placeholder documents reuse one image for every page, so the position is the identity.
              // eslint-disable-next-line react/no-array-index-key
              key={position}
              aria-hidden
              className={cn(
                'absolute inset-0 bg-white p-[0.7cqw] shadow-2xl shadow-black/60',
                // Ring colour sits at zero width until hover, so the stack answers a pointer without moving.
                'ring-white/25 group-hover:ring-4',
                fan[position],
              )}
            >
              <span className="relative block h-full w-full">
                <Image alt="" className="object-cover object-top" draggable={false} fill sizes="(min-width: 1024px) 26vw, 50vw" src={page} />
              </span>
            </span>
          ))}
          <span className="absolute inset-x-0 bottom-[6%] flex justify-center">
            <TapCue label={openLabel} />
          </span>
        </button>
      </Reveal>

      <DocumentDialog document={open ? document : null} onClose={() => setOpen(false)} />
    </>
  )
}
```

In `document-dialog.tsx`, the `DialogContent` `className` becomes:

```tsx
        className="h-[92dvh] w-[min(96vw,1100px)] max-w-none grid-rows-[minmax(0,1fr)] border-0 bg-[oklch(var(--presentation-scrim))] p-2 text-white sm:max-w-none *:data-[slot=dialog-close]:inline-flex *:data-[slot=dialog-close]:size-11 *:data-[slot=dialog-close]:items-center *:data-[slot=dialog-close]:justify-center *:data-[slot=dialog-close]:rounded-full *:data-[slot=dialog-close]:bg-black/60 *:data-[slot=dialog-close]:opacity-100"
```

(`sm:max-w-none` overrides the shadcn primitive's own `sm:max-w-lg`; it is the one viewport variant allowed in these folders. The dialog portals out of the stage, which is why the palette is declared at `:root`.)

- [ ] **Step 6: Credentials: the cue, and no orphaned mark**

In `credentials-section.tsx` (Task 4's version, `SlideProps<WhoWeAreContentOf<'credentials'>>` with the body in `content`), two edits: the media element `<CredentialDocuments documents={content.documents} />` becomes `<CredentialDocuments documents={content.documents} openLabel={content.openLabel} />`; and the reputation `ul`'s class, `flex flex-wrap items-center gap-x-[3cqw] gap-y-presentation-tight border-t border-white/15 pt-presentation-tight text-presentation-body`, becomes `grid grid-cols-2 items-center gap-x-[3cqw] gap-y-presentation-tight border-t border-white/15 pt-presentation-tight text-presentation-body`. With four marks, two columns always make two full rows, so Yelp can never sit alone (U13).

- [ ] **Step 7: Sweep the folders**

Run: `grep -rnE "\b(lg|md|sm):" src/shared/components/presentation src/features/meeting-flow/ui/components/steps/who-we-are`
Expected: one line, `document-dialog.tsx` with `sm:max-w-none`.
Run: `grep -rnE "font-medium|italic|rotate" src/shared/components/presentation src/features/meeting-flow/ui/components/steps/who-we-are`
Expected: no output.
Run: `grep -rnE "beat-(tight|group|zone)|--stage-clear-b" src/shared/components/presentation src/features/meeting-flow/ui/components/steps/who-we-are`
Expected: one line, `steps/who-we-are/index.tsx` passing `clearBottom="var(--stage-clear-b)"` (the consumer's bridge, spec C §12 S9). No `beat-*` token anywhere; the engine never reads `--stage-clear-b`.

- [ ] **Step 8: Type-check, lint, run the check**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow/lib/to-presentation-agent.ts src/features/meeting-flow/ui/components/steps/who-we-are`
Expected: no output.
Run: `node $WS/tools/verify-content.mjs`
Expected: `ALL PASS`. Note in the report whether the dev owner has a headshot (card shows it) or not (card shows the mark).

- [ ] **Step 9: Commit**

`fix(who-we-are): no unfinished content, tap cues, square documents` — paths: the image, `to-presentation-agent.ts`, `tap-cue.tsx`, and the six modified components.

---

## Phase 2: The step entrance

The splash lands in two tasks along the seam spec C §12.3 draws. Task 7 builds the **primitive**: one `SplashScreen` that owns both ways of dismissing (timed, or held until pressed), gates reduced motion itself, and reads its timing from one source; visibility policy leaves the primitive for a shared `useSessionOnce` hook and feature-owned keys, and the proposal composition moves into its feature. Task 8 is the **meeting's use** of it: the key, the copy, the hook, the composition, the mount in the view and the focus handback. Spec §5's E1–E8 are met across the two, with the shell wiring in Task 8.

### Task 7: The splash primitive: one timing source, two ways to dismiss (S3, C40, S14–S17)

**Files:**
- Create: `src/shared/components/splash-screen/splash-timing.ts`, `splash-copy.ts`, `is-splash-press.ts`, `splash-mark.tsx`, `splash-caption.tsx`, `splash-screen.tsx`
- Create: `src/shared/hooks/use-session-once.ts`
- Modify: `src/shared/constants/storage-keys.ts` (`sessionStorageKey`)
- Modify: `src/shared/components/splash-screen/pwa-splash-screen.tsx` (minimal: the primitive change only)
- Create: `src/features/proposal-flow/constants/splash.ts`, `src/features/proposal-flow/ui/components/proposal-splash-screen.tsx`
- Modify: `src/app/(frontend)/proposal-flow/layout.tsx` (import path)
- Delete: `src/shared/components/splash-screen/splash-overlay.tsx`, `splash-animation.tsx`, `use-splash-visibility.ts`, `proposal-splash-screen.tsx`
- Create: `$WS/checks/splash-timing.ts`, `$WS/checks/is-splash-press.ts`, `$WS/tools/proposal-splash.mjs`

**Interfaces:**
- Consumes: `BRAND_EASE` (`@/shared/constants/motion`, Task 2); `useAutoFocus` (`@/shared/hooks/use-auto-focus`); `STORAGE_KEY_PREFIX`; `--presentation-accent` at `:root` (Task 2) for the press button's focus ring.
- Produces (`@/shared/components/splash-screen/splash-timing`): `SPLASH_HOUSE_DELAY_S`, `SPLASH_HOUSE_STAGGER_S`, `SPLASH_HOUSE_DURATION_S`, `SPLASH_MARK_DELAY_S`, `SPLASH_MARK_DURATION_S`, `SPLASH_MARK_LANDS_S` (1.4), `SPLASH_CAPTION_DELAY_S` (1.4), `SPLASH_CAPTION_DURATION_S` (0.42), `SPLASH_CUE_DELAY_S` (2.0), `SPLASH_CUE_DURATION_S` (0.5), `SPLASH_VISIBLE_MS` (1500). No `SPLASH_EASE`: easing is a prop that defaults to `BRAND_EASE` (S14).
- Produces: `isSplashPress(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean` (its key set lives in the same file); `SPLASH_COPY.pressCue`; `SplashMark({ animate, ease })`; `SplashCaption({ id, title, subheading?, showCue, animate, ease })`; `SplashScreen({ open, onDismiss, dismiss: { mode: 'timed' } | { mode: 'press', label }, title?, subheading?, ease?, motionKey })`, whose root carries `data-splash`; `useSessionOnce(key, enabled): [open, dismiss]`; `sessionStorageKey(...parts): string`; `PROPOSAL_SPLASH_KEY`; `ProposalSplashScreen({ isAuthenticated })` at its new home.
- Behaviour change to note in the report: the proposal key's stored value gains the namespace prefix (`app-splash-shown` → `tri-pros:app-splash-shown`), so anyone mid-session at deploy sees the proposal splash once more (S16). `PwaSplashScreen` still has zero callers (owner decision C43); it inherits the primitive change and nothing else.

- [ ] **Step 1: Write the checks**

`$WS/checks/splash-timing.ts`:

```ts
import assert from 'node:assert/strict'
import {
  SPLASH_CAPTION_DELAY_S,
  SPLASH_CUE_DELAY_S,
  SPLASH_MARK_LANDS_S,
  SPLASH_VISIBLE_MS,
} from '@/shared/components/splash-screen/splash-timing'

assert.ok(Math.abs(SPLASH_MARK_LANDS_S - 1.4) < 1e-9, `mark lands at ${SPLASH_MARK_LANDS_S}`)
assert.equal(SPLASH_VISIBLE_MS, 1500)
assert.ok(SPLASH_VISIBLE_MS / 1000 > SPLASH_MARK_LANDS_S, 'a timed splash outlasts its mark (C40)')
assert.ok(Math.abs(SPLASH_CAPTION_DELAY_S - SPLASH_MARK_LANDS_S) < 1e-9, 'the caption waits for the mark (E3)')
assert.ok(Math.abs(SPLASH_CUE_DELAY_S - 2) < 1e-9, `the cue follows the caption at ${SPLASH_CUE_DELAY_S}`)
console.log('splash-timing: ok')
```

`$WS/checks/is-splash-press.ts`:

```ts
import assert from 'node:assert/strict'
import { isSplashPress } from '@/shared/components/splash-screen/is-splash-press'

type Modifiers = Partial<Record<'metaKey' | 'ctrlKey' | 'altKey', boolean>>
const press = (key: string, modifiers: Modifiers = {}) => isSplashPress({ key, metaKey: false, ctrlKey: false, altKey: false, ...modifiers })

for (const key of ['Enter', ' ', 'ArrowDown', 'PageDown', 'z', 'p', 'a', '3']) {
  assert.equal(press(key), true, `${key} begins`)
}
for (const key of ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'CapsLock', 'F1', 'F5', 'F11', 'F12']) {
  assert.equal(press(key), false, `${key} is not a press`)
}
assert.equal(press('r', { metaKey: true }), false, 'Cmd+R is a browser shortcut')
assert.equal(press('r', { ctrlKey: true }), false, 'Ctrl+R is a browser shortcut')
assert.equal(press('ArrowLeft', { altKey: true }), false, 'Alt+← is browser back')
console.log('is-splash-press: ok')
```

`$WS/tools/proposal-splash.mjs`:

```js
// C40: the timed (proposal) splash must not start fading before its blue R has landed.
// Unauthenticated, as a homeowner opening a proposal link sees it. The layout renders the
// splash whatever the proposal id resolves to, so a placeholder id is enough.
import { chromium } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/node_modules/playwright/index.mjs'

const browser = await chromium.launch({ headless: true })
let result
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('http://localhost:3000/proposal-flow/proposal/00000000-0000-0000-0000-000000000000', { waitUntil: 'commit', timeout: 90000 })
  const shown = await page.waitForSelector('[data-splash]', { timeout: 30000 }).catch(() => null)
  if (!shown) {
    result = { status: 'NOT RUN', reason: `no splash at ${page.url()}` }
  }
  else {
    result = await page.evaluate(async () => {
      const start = performance.now()
      let markLanded = null
      let fadeStarted = null
      while (performance.now() - start < 3000) {
        const overlay = document.querySelector('[data-splash]')
        const mark = overlay?.querySelector('path[fill="#03AFED"]')
        const t = Math.round(performance.now() - start)
        if (markLanded === null && mark && Number(getComputedStyle(mark).opacity) >= 0.95) {
          markLanded = t
        }
        if (fadeStarted === null && (!overlay || Number(getComputedStyle(overlay).opacity) < 0.999)) {
          fadeStarted = t
        }
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
      return { markLanded, fadeStarted, status: markLanded !== null && fadeStarted !== null && markLanded < fadeStarted ? 'PASS' : 'FAIL' }
    })
  }
}
finally {
  await browser.close()
}
console.log(JSON.stringify(result))
process.exitCode = result.status === 'FAIL' ? 1 : 0
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm exec tsx $WS/checks/splash-timing.ts`
Expected: FAIL with `Cannot find module '@/shared/components/splash-screen/splash-timing'`.
Run: `pnpm exec tsx $WS/checks/is-splash-press.ts`
Expected: FAIL with `Cannot find module '@/shared/components/splash-screen/is-splash-press'`.
Run: `node $WS/tools/proposal-splash.mjs`
Expected: `{"status":"NOT RUN","reason":"no splash …"}`. There is no `data-splash` attribute yet, so this run only proves the script works. If the route redirects to a login page, report it; the timing check alone then carries C40.

- [ ] **Step 3: The timing module and the press predicate**

`src/shared/components/splash-screen/splash-timing.ts`:

```ts
/**
 * The splash's choreography in one place (spec C §5.1, review S3). Everything after the blue R
 * is timed from the moment it lands, so retuning the spring moves the caption, the cue and the
 * timed splash's hold together. Easing is not here: `SplashScreen` takes an `ease` prop that
 * defaults to `BRAND_EASE` (§12 S14).
 */

/** The house paths rise one after another. */
export const SPLASH_HOUSE_DELAY_S = 0.1
export const SPLASH_HOUSE_STAGGER_S = 0.12
export const SPLASH_HOUSE_DURATION_S = 0.35

/** The blue R springs in last. */
export const SPLASH_MARK_DELAY_S = 0.9
export const SPLASH_MARK_DURATION_S = 0.5

/** When the R has landed. */
export const SPLASH_MARK_LANDS_S = SPLASH_MARK_DELAY_S + SPLASH_MARK_DURATION_S

/** The caption rises once the mark has landed (E3); the press cue follows it. */
export const SPLASH_CAPTION_DELAY_S = SPLASH_MARK_LANDS_S
export const SPLASH_CAPTION_DURATION_S = 0.42
export const SPLASH_CUE_DELAY_S = SPLASH_CAPTION_DELAY_S + SPLASH_CAPTION_DURATION_S + 0.18
export const SPLASH_CUE_DURATION_S = 0.5

/** How long a timed splash holds: until the mark has landed, plus 100 ms of rest (C40). */
export const SPLASH_VISIBLE_MS = Math.round(SPLASH_MARK_LANDS_S * 1000) + 100
```

`src/shared/components/splash-screen/splash-copy.ts`:

```ts
/** The primitive's own words. A caller names the press button (`dismiss.label`); the cue under the caption is the primitive's. */
export const SPLASH_COPY = {
  /** The visible cue under the caption while a splash is held for a press. */
  pressCue: 'Press to begin',
} as const
```

`src/shared/components/splash-screen/is-splash-press.ts`:

```ts
/**
 * Keys that never count as a press: Tab must move focus on (E4 does not trap it), modifiers
 * are halves of shortcuts, Escape is not a "go". Function keys are matched by pattern below.
 */
const NOT_A_PRESS_KEYS: ReadonlySet<string> = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'CapsLock', 'Fn', 'ContextMenu'])

/**
 * Whether a key dismisses a held splash: any key except Tab, modifiers, Escape, function keys
 * and browser shortcuts. Only presses are consumed, so reload and devtools still work (review F5).
 */
export function isSplashPress(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }
  return !NOT_A_PRESS_KEYS.has(event.key) && !/^F\d{1,2}$/.test(event.key)
}
```

- [ ] **Step 4: Run the two checks and watch them pass**

Run: `pnpm exec tsx $WS/checks/splash-timing.ts && pnpm exec tsx $WS/checks/is-splash-press.ts`
Expected: `splash-timing: ok`, then `is-splash-press: ok`.

- [ ] **Step 5: The session key namespace and the once-per-session hook**

In `src/shared/constants/storage-keys.ts`, append after the `STORAGE_KEYS` object (which is untouched):

```ts
/**
 * A `sessionStorage` key under the shared namespace, e.g. `sessionStorageKey('meeting-splash', id)`
 * → `tri-pros:meeting-splash:<id>`. Features declare their keys beside the hook that reads them
 * (spec C §12 S16); nothing shared decides when a key is written.
 */
export function sessionStorageKey(...parts: string[]): string {
  return `${STORAGE_KEY_PREFIX}${parts.join(':')}`
}
```

`src/shared/hooks/use-session-once.ts`:

```ts
'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Show something once per browser session. `open` turns true, in an effect, when `enabled` and
 * `sessionStorage` holds nothing under `key`; `dismiss` writes the key and closes. The key is
 * written on dismiss, not on show, so a reload before the dismissal shows it again (spec C §12
 * S15). Whether to show at all is the caller's policy: a primitive never decides to appear.
 */
export function useSessionOnce(key: string, enabled: boolean): [open: boolean, dismiss: () => void] {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled || sessionStorage.getItem(key) !== null) {
      return
    }
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setOpen(true)
  }, [enabled, key])

  const dismiss = useCallback(() => {
    sessionStorage.setItem(key, '1')
    setOpen(false)
  }, [key])

  return [open, dismiss]
}
```

- [ ] **Step 6: The mark and the caption**

`src/shared/components/splash-screen/splash-mark.tsx` (today's `splash-animation.tsx`, renamed and reading the timing module):

```tsx
'use client'

import { motion } from 'motion/react'
import { HOUSE_PATHS, R_PATH } from '@/shared/components/splash-screen/splash-paths'
import {
  SPLASH_HOUSE_DELAY_S,
  SPLASH_HOUSE_DURATION_S,
  SPLASH_HOUSE_STAGGER_S,
  SPLASH_MARK_DELAY_S,
  SPLASH_MARK_DURATION_S,
} from '@/shared/components/splash-screen/splash-timing'

interface SplashMarkProps {
  /** Play the entrance; `false` renders the finished mark at rest (reduced motion, E7). */
  animate: boolean
  /** The house paths' rise. */
  ease: [number, number, number, number]
}

/** The brand mark: the white house paths rise one after another, then the blue R springs in last. */
export function SplashMark({ animate, ease }: SplashMarkProps) {
  return (
    <svg
      className="h-auto w-48 sm:w-56"
      fill="none"
      height="463"
      viewBox="0 0 589 463"
      width="589"
    >
      {HOUSE_PATHS.map((d, i) => (
        <motion.path
          key={d.slice(0, 20)}
          animate={{ opacity: 1, y: 0 }}
          d={d}
          fill="white"
          initial={animate ? { opacity: 0, y: 12 } : false}
          transition={{
            duration: SPLASH_HOUSE_DURATION_S,
            delay: SPLASH_HOUSE_DELAY_S + i * SPLASH_HOUSE_STAGGER_S,
            ease,
          }}
        />
      ))}
      <motion.path
        animate={{ opacity: 1, scale: 1 }}
        d={R_PATH}
        fill="#03AFED"
        initial={animate ? { opacity: 0, scale: 0.8 } : false}
        transition={{
          duration: SPLASH_MARK_DURATION_S,
          delay: SPLASH_MARK_DELAY_S,
          type: 'spring',
          bounce: 0.3,
        }}
      />
    </svg>
  )
}
```

`src/shared/components/splash-screen/splash-caption.tsx`:

```tsx
'use client'

import { motion } from 'motion/react'
import { SPLASH_COPY } from '@/shared/components/splash-screen/splash-copy'
import {
  SPLASH_CAPTION_DELAY_S,
  SPLASH_CAPTION_DURATION_S,
  SPLASH_CUE_DELAY_S,
  SPLASH_CUE_DURATION_S,
} from '@/shared/components/splash-screen/splash-timing'

interface SplashCaptionProps {
  /** Referenced by the press button's `aria-describedby`. */
  id: string
  title: string
  subheading?: string
  /** Show the press cue under the caption (a splash held for a press). */
  showCue: boolean
  /** Play the entrance; `false` renders at rest (reduced motion). */
  animate: boolean
  ease: [number, number, number, number]
}

/**
 * The title and subheading, rising once the brand mark has landed, then the press cue (E3).
 * Sized in `vw`, not `cqw`: the splash is fixed with no container above it, where `cqw`
 * would silently fall back to small-viewport units (review F11). Spans only: in press mode
 * it sits inside the button.
 */
export function SplashCaption({ id, title, subheading, showCue, animate, ease }: SplashCaptionProps) {
  return (
    <>
      <motion.span
        animate={{ opacity: 1, y: 0 }}
        className="grid max-w-[44ch] justify-items-center gap-2.5 text-center text-white"
        id={id}
        initial={animate ? { opacity: 0, y: 12 } : false}
        transition={{ duration: SPLASH_CAPTION_DURATION_S, delay: SPLASH_CAPTION_DELAY_S, ease }}
      >
        <span className="max-w-[22ch] font-sans text-[clamp(1.375rem,3.4vw,2.75rem)] leading-[1.1] font-semibold tracking-tight text-balance">
          {title}
        </span>
        {subheading && <span className="text-[clamp(0.9375rem,1.5vw,1.25rem)] leading-normal text-white/70">{subheading}</span>}
      </motion.span>
      {showCue && (
        <motion.span
          animate={{ opacity: 1 }}
          aria-hidden
          className="font-sans text-xs tracking-[0.18em] text-white/60 uppercase"
          initial={animate ? { opacity: 0 } : false}
          transition={{ duration: SPLASH_CUE_DURATION_S, delay: SPLASH_CUE_DELAY_S, ease: 'easeOut' }}
        >
          {SPLASH_COPY.pressCue}
        </motion.span>
      )}
    </>
  )
}
```

- [ ] **Step 7: The primitive**

`src/shared/components/splash-screen/splash-screen.tsx` (replaces `splash-overlay.tsx`):

```tsx
'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId } from 'react'
import { isSplashPress } from '@/shared/components/splash-screen/is-splash-press'
import { SplashCaption } from '@/shared/components/splash-screen/splash-caption'
import { SplashMark } from '@/shared/components/splash-screen/splash-mark'
import { SPLASH_VISIBLE_MS } from '@/shared/components/splash-screen/splash-timing'
import { BRAND_EASE } from '@/shared/constants/motion'
import { useAutoFocus } from '@/shared/hooks/use-auto-focus'

/** `timed` fades on its own after `SPLASH_VISIBLE_MS`; `press` holds until the viewer presses, `label` naming the button. */
type SplashDismiss = { mode: 'timed' } | { mode: 'press', label: string }

interface SplashScreenProps {
  /** Controlled: the caller decides when it shows (once per session, once per meeting). */
  open: boolean
  onDismiss: () => void
  dismiss: SplashDismiss
  /** Caption under the mark. The timed proposal and PWA splashes have none. */
  title?: string
  subheading?: string
  /** The mark's and caption's rise. */
  ease?: [number, number, number, number]
  /** `AnimatePresence` key; one per splash use. */
  motionKey: string
}

/**
 * The branded splash over the whole window: the mark, optionally a caption, dismissed either
 * on a timer or by a press (spec C §12 S14). In press mode the whole overlay is one `<button>`
 * whose accessible name is the action and whose caption is its description (review N3); it
 * takes focus on open, and a capture-phase `window` listener consumes presses before any
 * host key map can see them, without preventing Tab, modifiers, Escape or function keys (E4,
 * review F5). Reduced motion is gated here with `useReducedMotion()`: a host's
 * `MotionConfig reducedMotion="user"` would keep opacity fades and their delays (review F4),
 * and this component mounts wherever the host puts it. Visibility is the caller's policy.
 */
export function SplashScreen({ open, onDismiss, dismiss, title, subheading, ease = BRAND_EASE, motionKey }: SplashScreenProps) {
  const captionId = useId()
  const reduced = useReducedMotion() ?? false
  const animate = !reduced
  const pressRef = useAutoFocus<HTMLButtonElement>({ enabled: open && dismiss.mode === 'press' })

  useEffect(() => {
    if (!open || dismiss.mode !== 'timed') {
      return
    }
    const timer = window.setTimeout(onDismiss, SPLASH_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [open, dismiss.mode, onDismiss])

  useEffect(() => {
    if (!open || dismiss.mode !== 'press') {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!isSplashPress(event)) {
        return
      }
      event.preventDefault()
      onDismiss()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [open, dismiss.mode, onDismiss])

  const content = (
    <>
      <SplashMark animate={animate} ease={ease} />
      {title && (
        <SplashCaption animate={animate} ease={ease} id={captionId} showCue={dismiss.mode === 'press'} subheading={subheading} title={title} />
      )}
    </>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={motionKey}
          className="fixed inset-0 z-9999 flex flex-col items-center justify-center"
          data-splash
          exit={{ opacity: 0 }}
          style={{ backgroundColor: '#09090b' }}
          transition={{ duration: animate ? 0.3 : 0, ease: 'easeOut' }}
        >
          {dismiss.mode === 'press'
            ? (
                <button
                  ref={pressRef}
                  aria-describedby={title ? captionId : undefined}
                  aria-label={dismiss.label}
                  className="flex size-full cursor-pointer flex-col items-center justify-center gap-8 p-10 outline-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-(--presentation-accent)"
                  type="button"
                  onClick={onDismiss}
                >
                  {content}
                </button>
              )
            : <div className="flex flex-col items-center justify-center gap-8 p-10">{content}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

(`#09090b` is the ground the overlay has always painted; `#03AFED` on the R and `sm:w-56` on the mark are likewise carried over, not new. The focus ring is the presentation accent, never `outline-primary`.)

- [ ] **Step 8: The proposal composition moves into its feature; the PWA one takes the primitive change only**

`src/features/proposal-flow/constants/splash.ts`:

```ts
import { sessionStorageKey } from '@/shared/constants/storage-keys'

/**
 * Once per browser session (`tri-pros:app-splash-shown`). The PWA splash writes the same key,
 * so an installed launch and a proposal link share one showing per session, as before.
 */
export const PROPOSAL_SPLASH_KEY = sessionStorageKey('app-splash-shown')
```

`src/features/proposal-flow/ui/components/proposal-splash-screen.tsx`:

```tsx
'use client'

import { PROPOSAL_SPLASH_KEY } from '@/features/proposal-flow/constants/splash'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'
import { useSessionOnce } from '@/shared/hooks/use-session-once'

interface ProposalSplashScreenProps {
  isAuthenticated: boolean
}

/** The timed brand splash a homeowner sees once per session when opening a proposal link; a signed-in agent never does. */
export function ProposalSplashScreen({ isAuthenticated }: ProposalSplashScreenProps) {
  const [open, onDismiss] = useSessionOnce(PROPOSAL_SPLASH_KEY, !isAuthenticated)
  return <SplashScreen dismiss={{ mode: 'timed' }} motionKey="proposal-splash" open={open} onDismiss={onDismiss} />
}
```

In `src/app/(frontend)/proposal-flow/layout.tsx`, the import `import { ProposalSplashScreen } from '@/shared/components/splash-screen/proposal-splash-screen'` becomes `import { ProposalSplashScreen } from '@/features/proposal-flow/ui/components/proposal-splash-screen'` (let `eslint --fix` place it among the other `@/features/proposal-flow` imports). Nothing else in the layout changes.

Replace `src/shared/components/splash-screen/pwa-splash-screen.tsx` with (the only edits are the primitive's: `SplashScreen` in timed mode and `useSessionOnce`; behaviour unchanged; still no callers, C43):

```tsx
'use client'

import { useEffect, useState } from 'react'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'
import { sessionStorageKey } from '@/shared/constants/storage-keys'
import { useSessionOnce } from '@/shared/hooks/use-session-once'

export function PwaSplashScreen() {
  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
  }, [])

  const [open, onDismiss] = useSessionOnce(sessionStorageKey('app-splash-shown'), isStandalone)
  return <SplashScreen dismiss={{ mode: 'timed' }} motionKey="pwa-splash" open={open} onDismiss={onDismiss} />
}
```

- [ ] **Step 9: Delete what the primitive replaced**

Run: `rm src/shared/components/splash-screen/splash-overlay.tsx src/shared/components/splash-screen/splash-animation.tsx src/shared/components/splash-screen/use-splash-visibility.ts src/shared/components/splash-screen/proposal-splash-screen.tsx`

Run: `grep -rn "SplashOverlay\|SplashAnimation\|useSplashVisibility\|splash-overlay\|splash-animation\|use-splash-visibility\|splash-screen/proposal-splash-screen\|SPLASH_EASE" src`
Expected: no output.
Run: `ls src/shared/components/splash-screen`
Expected: `is-splash-press.ts  pwa-splash-screen.tsx  splash-caption.tsx  splash-copy.ts  splash-mark.tsx  splash-paths.ts  splash-screen.tsx  splash-timing.ts`.

- [ ] **Step 10: Type-check, lint, run the checks**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/components/splash-screen src/shared/hooks/use-session-once.ts src/shared/constants/storage-keys.ts src/features/proposal-flow/constants/splash.ts src/features/proposal-flow/ui/components/proposal-splash-screen.tsx "src/app/(frontend)/proposal-flow/layout.tsx"`
Expected: no output.
Run: `pnpm exec tsx $WS/checks/splash-timing.ts && pnpm exec tsx $WS/checks/is-splash-press.ts`
Expected: `ok` twice.
Run: `node $WS/tools/proposal-splash.mjs`
Expected: `"status":"PASS"`, with `markLanded` below `fadeStarted` (about 1.3 s against 1.5 s), or the NOT RUN reason from Step 2. Reload the same page in the script's browser is not needed: the key is now written when the timer fires, so a homeowner who reloads inside the 1.5 s sees it once more, by design (S15).

- [ ] **Step 11: Commit**

`refactor(splash): one SplashScreen primitive — timed or pressed, reduced motion gated inside, visibility left to the caller` — paths: the six new files under `splash-screen/`, `use-session-once.ts`, `storage-keys.ts`, `pwa-splash-screen.tsx`, the two new proposal-flow files, `layout.tsx`, and the four deleted files.

---

### Task 8: The meeting's use of the splash (E1–E8, C39, F4, F5, F11, N3, S17, S18)

**Files:**
- Create: `src/features/meeting-flow/constants/splash.ts`
- Create: `src/features/meeting-flow/hooks/use-meeting-splash.ts`
- Create: `src/features/meeting-flow/ui/components/meeting-splash-screen.tsx`
- Modify: `src/features/meeting-flow/constants/step-config.ts`
- Modify: `src/features/meeting-flow/ui/components/shell/stage-frame.tsx`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx`
- Create: `$WS/tools/verify-splash.mjs`

**Interfaces:**
- Consumes (Task 7): `SplashScreen`, `useSessionOnce`, `sessionStorageKey`, `data-splash`, `isSplashPress` (through the primitive). `MEETING_STEPS` (E6).
- Produces: `MEETING_SPLASH_COPY.pressLabel`; `meetingSplashKey(meetingId)` → `tri-pros:meeting-splash:<meetingId>`; `useMeetingSplash({ meetingId, currentStep })` → `{ open, dismiss }`; `MeetingSplashScreen({ open, onDismiss })`; `StageFrame({ ref?, inert?, children })`; `MeetingStepConfig.subheading?: string`.

- [ ] **Step 1: Write the browser check**

`$WS/tools/verify-splash.mjs`:

```js
// Spec C §5 (E1–E8, review F4/F5/F11/N3) and §12.3 (S14–S18): the meeting splash.
import { buildCss, MEETING_ID, setup, STEP1_URL } from './common.mjs'

const KEY = `tri-pros:meeting-splash:${MEETING_ID}`
const TITLE = 'Navigating the Construction Industry'
const SUBHEADING = 'What a legitimate project actually requires.'
const css = buildCss()
const failures = []
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
  if (!ok) {
    failures.push(label)
  }
}

async function openWithSplash(options = {}) {
  const env = await setup({ width: 1440, height: 900, ...options })
  await env.page.goto(STEP1_URL, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await env.page.waitForSelector('[data-splash] button', { timeout: 90000 })
  await env.page.addStyleTag({ path: css })
  return env
}

const scrollerState = page => page.evaluate(() => ({
  step: new URLSearchParams(location.search).get('step'),
  scrollTop: document.querySelector('[role="region"][data-step-root]')?.scrollTop ?? null,
  fullscreen: document.fullscreenElement !== null,
  splash: document.querySelectorAll('[data-splash]').length,
}))

// G first: reduced motion must show everything at rest on the first frames (E7, F4).
{
  const { browser, page } = await openWithSplash({ reducedMotion: 'reduce' })
  try {
    const rest = await page.evaluate(() => {
      const overlay = document.querySelector('[data-splash]')
      const button = overlay.querySelector('button')
      const mark = overlay.querySelector('path[fill="#03AFED"]')
      const caption = document.getElementById(button.getAttribute('aria-describedby') ?? '')
      const cue = button.querySelector(':scope > span[aria-hidden="true"]')
      return {
        mark: getComputedStyle(mark).opacity,
        caption: caption ? getComputedStyle(caption).opacity : null,
        cue: cue ? getComputedStyle(cue).opacity : null,
      }
    })
    check('G reduced motion: mark, caption and cue at rest', rest.mark === '1' && rest.caption === '1' && rest.cue === '1', rest)
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-splash]', { state: 'detached', timeout: 5000 })
    check('G reduced motion: still dismissed by a press', (await page.locator('[data-splash]').count()) === 0)
  }
  finally {
    await browser.close()
  }
}

// A, B, D, E, F, I on one page.
{
  const { browser, page } = await openWithSplash()
  try {
    const state = await page.evaluate(() => {
      const overlay = document.querySelector('[data-splash]')
      const button = overlay.querySelector('button')
      const rect = overlay.getBoundingClientRect()
      const described = document.getElementById(button.getAttribute('aria-describedby') ?? '')
      return {
        covers: rect.left === 0 && rect.top === 0 && rect.width === window.innerWidth && rect.height === window.innerHeight,
        coversSidebar: Boolean(document.elementFromPoint(10, window.innerHeight / 2)?.closest('[data-splash]')),
        focused: document.activeElement === button,
        stageInert: document.querySelector('[data-stage]')?.hasAttribute('inert') ?? false,
        name: button.getAttribute('aria-label'),
        description: described?.textContent ?? '',
        titlePx: described ? Number.parseFloat(getComputedStyle(described.firstElementChild).fontSize) : 0,
        focusOutline: getComputedStyle(button, ':focus-visible').outlineColor,
      }
    })
    check('A covers the whole window (C39)', state.covers, state)
    check('A covers the sidebar', state.coversSidebar, state)
    check('A the splash button has focus (E4)', state.focused, state)
    check('A the stage is inert (F5)', state.stageInert, state)
    check('A its name is the action (N3)', state.name === 'Begin the presentation', state.name)
    check('A the caption describes it: step 1 title and subheading (E2, E6, S18)', state.description.includes(TITLE) && state.description.includes(SUBHEADING), state.description)
    check('A caption sized in vw (F11)', Math.abs(state.titlePx - Math.min(Math.max(22, 0.034 * 1440), 44)) <= 0.6, state.titlePx)
    console.log(`INFO focus-visible outline colour: ${state.focusOutline} (must be the presentation accent, not the primary)`)

    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)
    check('B Tab does not dismiss (E4)', (await page.locator('[data-splash]').count()) === 1)

    // D is INFO, not a check: Playwright's synthetic F5 never triggers a browser reload, so
    // "not prevented" passes vacuously here. The evidence for F5 is $WS/checks/is-splash-press.ts
    // (F1–F12 are not presses) and the reload-before-press case H below.
    await page.evaluate(() => {
      window.__f5Prevented = null
      window.addEventListener('keydown', (event) => {
        if (event.key === 'F5') {
          window.__f5Prevented = event.defaultPrevented
        }
      })
    })
    await page.keyboard.press('F5')
    await page.waitForTimeout(400)
    console.log(`INFO D F5 defaultPrevented under Playwright: ${await page.evaluate(() => window.__f5Prevented)} (vacuous; not evidence)`)

    await page.waitForSelector('[data-splash] button', { timeout: 30000 })
    await page.mouse.click(720, 450)
    await page.waitForSelector('[data-splash]', { state: 'detached', timeout: 5000 })
    await page.waitForTimeout(300)
    const after = await page.evaluate(key => ({
      focusOnStepRoot: document.activeElement?.hasAttribute('data-step-root') ?? false,
      stageInert: document.querySelector('[data-stage]')?.hasAttribute('inert') ?? true,
      stored: sessionStorage.getItem(key),
      bareKey: sessionStorage.getItem(key.replace('tri-pros:', '')),
    }), KEY)
    check('E a click dismisses; focus returns to the step root (state-driven)', after.focusOnStepRoot, after)
    check('E the stage is no longer inert', !after.stageInert, after)
    check('E remembered for this meeting under the namespaced key (E5, S16)', after.stored === '1' && after.bareKey === null, after)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[role="region"][data-step-root] section[id]', { timeout: 90000 })
    await page.waitForTimeout(1500)
    check('F no splash after a reload once pressed (E5)', (await page.locator('[data-splash]').count()) === 0)

    // I: a second meeting in the same session still opens with it (E5). Same tab, so the same
    // sessionStorage. Picks any other meeting off the list; NOT RUN if the list has none.
    await page.goto('http://localhost:3000/dashboard/meetings', { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForTimeout(2000)
    const other = await page.evaluate((current) => {
      const hrefs = [...document.querySelectorAll('a[href*="/dashboard/meetings/"]')].map(a => a.getAttribute('href') ?? '')
      return hrefs.find(href => /\/dashboard\/meetings\/[0-9a-f-]{36}/.test(href) && !href.includes(current)) ?? null
    }, MEETING_ID)
    if (other) {
      const url = new URL(other, 'http://localhost:3000')
      url.searchParams.set('step', '1')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 90000 })
      const shown = await page.waitForSelector('[data-splash] button', { timeout: 30000 }).catch(() => null)
      check('I a second meeting in the same session shows the splash (E5)', shown !== null, other)
    }
    else {
      console.log('NOT RUN I second meeting: no other meeting link on /dashboard/meetings')
    }
  }
  finally {
    await browser.close()
  }
}

// H: a reload before the press shows it again (S15: the key is written on dismiss).
{
  const { browser, page } = await openWithSplash()
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    const again = await page.waitForSelector('[data-splash] button', { timeout: 90000 }).catch(() => null)
    const stored = await page.evaluate(key => sessionStorage.getItem(key), KEY)
    check('H reload before the press shows it again; nothing stored yet (S15)', again !== null && stored === null, { stored })
  }
  finally {
    await browser.close()
  }
}

// C: a press with focus on <body> dismisses the splash, and nothing behind it moves (F5).
for (const key of ['ArrowDown', 'z', 'p', '3']) {
  const { browser, page } = await openWithSplash()
  try {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    })
    const before = await scrollerState(page)
    await page.keyboard.press(key)
    await page.waitForSelector('[data-splash]', { state: 'detached', timeout: 5000 }).catch(() => null)
    await page.waitForTimeout(800)
    const after = await scrollerState(page)
    check(`C ${key} dismisses the splash`, after.splash === 0, after)
    check(`C ${key} moves nothing behind it`, after.step === before.step && after.scrollTop === before.scrollTop && !after.fullscreen, { before, after })
  }
  finally {
    await browser.close()
  }
}
console.log(failures.length ? `\n${failures.length} FAIL` : '\nALL PASS')
process.exitCode = failures.length ? 1 : 0
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node $WS/tools/verify-splash.mjs`
Expected: it stops in `openWithSplash` with a timeout on `[data-splash] button`: no meeting splash exists yet.

- [ ] **Step 3: The key, the copy and step 1's subheading**

`src/features/meeting-flow/constants/splash.ts`:

```ts
import { sessionStorageKey } from '@/shared/constants/storage-keys'

export const MEETING_SPLASH_COPY = {
  /** The press button's accessible name: its action. The caption is its description (review N3). */
  pressLabel: 'Begin the presentation',
} as const

/** Once per meeting per browser session (E5): `tri-pros:meeting-splash:<meetingId>`, written on the press. */
export function meetingSplashKey(meetingId: string): string {
  return sessionStorageKey('meeting-splash', meetingId)
}
```

In `constants/step-config.ts`, add to `MeetingStepConfig` after `title: string`:

```ts
  /** One line under the title where the step is introduced: the meeting splash's caption (E6, S18). */
  subheading?: string
```

and to the `who-we-are` entry, after its `title`: `subheading: 'What a legitimate project actually requires.',` (the line today's `WHO_WE_ARE_PINNED[0]` carried for the hook before Task 3 deleted that array).

- [ ] **Step 4: The hook**

`src/features/meeting-flow/hooks/use-meeting-splash.ts`:

```ts
'use client'

import { meetingSplashKey } from '@/features/meeting-flow/constants/splash'
import { MEETING_STEPS } from '@/features/meeting-flow/constants/step-config'
import { useSessionOnce } from '@/shared/hooks/use-session-once'

interface UseMeetingSplashArgs {
  meetingId: string
  currentStep: number
}

/**
 * When the meeting splash shows (C39, E5, E8): the first time the flow is on its opening step in
 * a browser session, once per meeting, so a second meeting in the same session still opens with
 * it. `useSessionOnce` writes the key on the press, so a reload before the press shows it again.
 * Not a timer: E4 is a press.
 */
export function useMeetingSplash({ meetingId, currentStep }: UseMeetingSplashArgs) {
  const [open, dismiss] = useSessionOnce(meetingSplashKey(meetingId), currentStep === MEETING_STEPS[0].stepNumber)
  return { open, dismiss }
}
```

- [ ] **Step 5: The composition**

`src/features/meeting-flow/ui/components/meeting-splash-screen.tsx`:

```tsx
'use client'

import { MEETING_SPLASH_COPY } from '@/features/meeting-flow/constants/splash'
import { MEETING_STEPS } from '@/features/meeting-flow/constants/step-config'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'

interface MeetingSplashScreenProps {
  open: boolean
  onDismiss: () => void
}

/**
 * The curtain-up for a meeting (E1): the brand mark, then the opening step's title and
 * subheading from `MEETING_STEPS` (E6), held until the agent presses (E4). The primitive owns
 * the press surface, the key handling and the reduced-motion gate; this component only says
 * which words and which step.
 */
export function MeetingSplashScreen({ open, onDismiss }: MeetingSplashScreenProps) {
  const opening = MEETING_STEPS[0]
  return (
    <SplashScreen
      dismiss={{ mode: 'press', label: MEETING_SPLASH_COPY.pressLabel }}
      motionKey="meeting-splash"
      open={open}
      subheading={opening.subheading}
      title={opening.title}
      onDismiss={onDismiss}
    />
  )
}
```

- [ ] **Step 6: An inert stage**

In `stage-frame.tsx` (Task 2's version, which publishes `--stage-clear-b`), the props interface becomes:

```tsx
interface StageFrameProps {
  ref?: Ref<HTMLDivElement>
  /** Set while the meeting splash covers the flow, so neither focus nor a click reaches behind it (E4, review F5). */
  inert?: boolean
  children: ReactNode
}
```

the signature becomes `export function StageFrame({ ref, inert, children }: StageFrameProps)`, and the root `<div>` gains `inert={inert}` after `data-stage`. The class string is untouched.

- [ ] **Step 7: Mount it from the view**

In `ui/views/meeting-flow.tsx`:

Add imports:

```tsx
import { useMeetingSplash } from '@/features/meeting-flow/hooks/use-meeting-splash'
import { MeetingSplashScreen } from '@/features/meeting-flow/ui/components/meeting-splash-screen'
```

Replace `MeetingFlowView` and add the inner view's props:

```tsx
interface MeetingFlowViewInnerProps extends MeetingFlowViewProps {
  /** The meeting splash covers the flow; the stage is inert until it is pressed. */
  splashOpen: boolean
}

export function MeetingFlowView({ meetingId }: MeetingFlowViewProps) {
  const [currentStep] = useQueryState('step', stepParser)
  const splash = useMeetingSplash({ meetingId, currentStep })
  return (
    <ChannelProvider channelName={`meeting:${meetingId}`}>
      <MeetingFlowViewInner meetingId={meetingId} splashOpen={splash.open} />
      {/* Beside the inner view, not inside it: the inner view swaps its loading tree for the
          ready tree, which would remount the splash and replay the mark; and outside the
          stage's `isolate` wrappers, which would trap `z-9999` under the capsule (review F11).
          It is also outside the inner view's `MotionConfig`: the primitive gates reduced
          motion itself. */}
      <MeetingSplashScreen open={splash.open} onDismiss={splash.dismiss} />
    </ChannelProvider>
  )
}
```

The inner view's signature becomes `function MeetingFlowViewInner({ meetingId, splashOpen }: MeetingFlowViewInnerProps)`. Each of its four `<StageFrame ref={rootRef}>` (the loading, not-found, invalid-step and ready trees) becomes `<StageFrame ref={rootRef} inert={splashOpen}>`. After the `useEffect` that calls `focusStepRoot()` on `[currentStep, isReady, focusStepRoot]`, add:

```tsx
  // The splash held the stage inert; when it closes, focus returns to the step (E4), driven by
  // state, not by a timer or `onExitComplete`: the splash sits outside this tree. An inert
  // element cannot take focus, so the step-change focus above cannot steal it from the splash.
  useEffect(() => {
    if (!splashOpen) {
      focusStepRoot()
    }
  }, [splashOpen, focusStepRoot])
```

- [ ] **Step 8: Type-check, lint, run the checks**

Run: `pnpm tsc && pnpm exec eslint --fix src/features/meeting-flow/constants/splash.ts src/features/meeting-flow/constants/step-config.ts src/features/meeting-flow/hooks/use-meeting-splash.ts src/features/meeting-flow/ui/components/meeting-splash-screen.tsx src/features/meeting-flow/ui/components/shell/stage-frame.tsx src/features/meeting-flow/ui/views/meeting-flow.tsx`
Expected: no output.
Run: `node $WS/tools/verify-splash.mjs`
Expected: `ALL PASS`, plus the two `INFO` lines and, if the list has no second meeting, one `NOT RUN I` line. Report the focus-outline colour (must be the accent `#5cc6f2`, i.e. `rgb(92, 198, 242)`). Do not count D as evidence: it passes vacuously under Playwright; the `is-splash-press` check and H carry F5.
Run: `node $WS/tools/proposal-splash.mjs`
Expected: `"status":"PASS"` (or the Task 7 NOT RUN reason): the timed splash is unchanged by the meeting use.
Run: `node $WS/tools/verify-deck.mjs && node $WS/tools/nudge-release.mjs`
Expected: `ALL PASS`, then `PASS`. `openStep1` presses through the splash now.

- [ ] **Step 9: Commit**

`feat(meeting-flow): open the meeting with the branded splash, held until pressed` — paths: `constants/splash.ts`, `hooks/use-meeting-splash.ts`, `ui/components/meeting-splash-screen.tsx`, `step-config.ts`, `stage-frame.tsx`, `meeting-flow.tsx`.

---

## Phase 3: Docs and verification

### Task 9: The engine's DOCS.md, the meeting-flow DOCS.md and the trackers (K8, S12, spec §10)

**Files:**
- Create: `src/shared/components/presentation/DOCS.md`
- Create: `src/features/meeting-flow/DOCS.md`
- Modify: `docs/superpowers/specs/2026-09-20-presentation-config-and-critique-design.md` (status line)
- Modify: `docs/superpowers/specs/2026-09-12-who-we-are-scroll-presentation-design.md` (status line)
- Modify: `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` (header status, §0 row C, §1 C33, §3.1, §3.2, §3.2b, §3.6 K8)
- Modify: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-who-we-are-presentation.md` and `MEMORY.md` (the index line)
- Already done, nothing to write: `CONTEXT.md#presentation-terms` holds the glossary (Presentation, Slide, Frame, Run, Heading column, Content, Subheading, Splash screen). Both DOCS files point at it rather than restating it.

**Interfaces:**
- Produces: the slug anchors the engine's code cites as `// see ./DOCS.md#<slug>` and the feature's code cites as `// see ./DOCS.md#<slug>` or `// see src/shared/components/presentation/DOCS.md#<slug>`. Step 6 reconciles the headings below with whatever slugs Tasks 1–8 actually cited: the code's citation wins, and the heading here is renamed to match it.

- [ ] **Step 1: The engine's rules**

`src/shared/components/presentation/DOCS.md`:

```markdown
# Presentation

The engine behind a `presentation`-layout step: a full-height scroll surface that shows one
slide per screen. Meeting-flow step 1 (Who We Are) is the first consumer; Program and
Portfolio are next. The words (presentation, slide, frame, run, heading column, content,
subheading, splash screen) are defined once in `CONTEXT.md#presentation-terms`; "beat" and
"stage" never appear in this folder. Design: spec C,
`docs/superpowers/specs/2026-09-20-presentation-config-and-critique-design.md` (§4 mechanics,
§12 semantics and homes).

Cite a rule from code as `// see ./DOCS.md#<slug>` inside this folder, or
`// see src/shared/components/presentation/DOCS.md#<slug>` from a consumer. Slugs are the
headings below, lower-cased and hyphenated; they survive reordering.

## The seam

- `Presentation({ label, rootAttributes?, keyShortcuts?, clearBottom?, className?, ref?, children })`
  (`presentation.tsx`). The engine owns `role="region"`, `tabIndex={0}`, `aria-label` and the class
  merge on the scroller. `rootAttributes` carries host markers (meeting-flow passes
  `{ 'data-step-root': true }`); `keyShortcuts` sets `aria-keyshortcuts`; `clearBottom` is any CSS
  length and sets `--presentation-clear-b` inline (meeting-flow passes `var(--stage-clear-b)`,
  the shell's capsule clearance). `ref` receives `PresentationHandle` (`next`, `prev`) from
  `types.ts`.
- **Generalise the seam, never thin the feature.** When a consumer needs more than the engine
  offers, the engine's interface grows; a feature never wraps, forks or patches around it.
- **Names.** `Presentation` prefixes every exported type (`PresentationSlide`,
  `PresentationHeading`, `PresentationBackground`, `PresentationFrame`, `PresentationGroup`,
  `PresentationHandle`) and the root component. Child components carry `Slide` names
  (`Slide`, `SlideRun`, `SlideBackground`, `SlideImage`); `HeadingColumn`, `Reveal` and `Scrim`
  are unprefixed. Files are the component names in kebab case; sibling `.ts` files hold the
  types, the motion constants and the pure functions (`group-slides.ts`, `slide-scroll-top.ts`).
  No nested `lib/`.

## Slides and frames

- A slide is `PresentationSlide<TContent> = { id, frame?, heading, background?, content }`. The engine
  never reads `content`; the consumer renders it as `Slide`'s children.
- `heading` is `{ title, subheading?: { text, accent? }, number? }`. `background` is
  `{ kind: 'image', src, alt }` only; a `portfolio` arm arrives with spec D.
- **Two frames, a closed set.** `column` (the default): the heading shows in the run's heading
  column and the slide's own box carries only the content. `full`: the heading is centred over the
  whole slide, `Reveal`ed, above the content. `frame` defaults to `column` in `groupSlides` and
  nowhere else; `IndexedSlide.frame` is the resolved value, so nothing downstream re-defaults.
- **One `Slide` component.** It owns the `<section>` box (snap target, in-view report, scroll
  margin) and switches on `frame`: `full` renders the centred heading, `column` renders a
  visually hidden `<h2>` and nothing else above the content. There is no base box component and no
  per-frame wrapper. A section component spreads its `SlideProps` into `<Slide {...props}>`
  and never hard-codes a frame; the config is the only source of where a heading sits.
- Every slide is labelled: a `full` slide by its visible `<h2>`, a `column` slide by its hidden
  `<h2>`. The heading column is `aria-hidden`.
- The `<section>` is never transformed: snap areas are computed from the transformed border
  box, so every reveal lives on an inner element.

## Runs

- Consecutive `column` slides form a run. There is no grouping field: runs follow from
  `frame`, derived once at module scope by `groupSlides`, never declared. Groups carry only
  `items` (`IndexedSlide[]`); `SlideRun` and `HeadingColumn` derive the headings, the first
  index and the numbered total from them, so nothing is stored twice.
- A run is a grid of `minmax(16rem, 38%) minmax(0, 1fr)`: the heading column (sticky,
  `top: 0`, `align-self: start`, one presentation tall), then the stack of slides. Because the
  grid row is as tall as the stack, the column sticks across the run and slides out at its
  edges. Load-bearing, do not tidy away: `align-self: start`; an explicit column height, never
  a percentage; the column's ground background and `z-10`; no `overflow` on the run or the
  stack (`hidden` re-scopes sticky to that box).
- The column shows the active index clamped to the run, so it already holds the run's first
  heading while the run scrolls in and its last as the run leaves (review F1). It fades
  between headings with `HEADING_SWAP_TRANSITION` (`motion.ts`).
- Below a 56rem presentation the column becomes a band above the slides: the run switches to
  `display: block` (`@max-[56rem]/presentation:block`; a lone grid row would let the band stop
  sticking, review F12) and publishes `--band-h: 30cqh`.

## Containers and units

- The scroller is the named `presentation` size container (`[container:presentation/size]`).
  Every engine query is `@max-[56rem]/presentation:`, always named: an unnamed query binds to
  the nearest container, and that changes when a consumer puts another container in between.
- Inside the scroller, `cqw` and `cqh` resolve against the presentation. A consumer that
  declares its own container (the Who We Are comparison sheets are `@container/comparison`)
  changes what `cqw` measures inside it, so sizes there use the role tokens, never bare `cqw`.
- Never write a container-query-driven property on the scroller itself: an element cannot
  query itself. `--band-h` lives on the run for that reason, and because declaring it only
  there is what gives `full` slides a zero offset.

## Snap arithmetic

- Scroll padding is 0. Each slide carries `scroll-margin-top: var(--band-h, 0px)` inline and a
  `min-height` of `calc(100cqh - var(--band-h, 0px))`. One expression serves both frames: a
  `full` slide sits outside every run, so the fallback applies. The inline margin also overrides
  the global `* { scroll-margin-top: 80px }` marketing rule in `globals.css`; an inline value
  cannot be clobbered by a caller's `className`.
- Keyboard jumps scroll to a rect delta (`slide-scroll-top.ts`): the slide's top minus the
  scroller's top, plus `scrollTop`, minus the slide's computed `scrollMarginTop`. It does not
  depend on which ancestor is positioned, so wrappers may be `relative` (review F9).
- `snap-mandatory` and `snap-always` stay. Smooth scrolling ignores reduced motion here: the
  global `* { scroll-behavior: smooth }` rule is a known gap, left as is by owner decision (C44).

## The centre line

- A slide is active while it crosses the presentation's centre line
  (`useInView(ref, { root: scrollerRef, margin: '-50% 0px -50% 0px' })`), not when half of it
  shows. Slides are contiguous, so exactly one crosses at a time; `reportInView` acts only on
  `true`; a slide under a band, or taller than two presentations, still reports (review F2).
- `activeIndex` stays on `PresentationContext`; `useSlideInView` exposes the same flag to
  reveals, so they also fire on the centre line.

## Content

- **Fixed-canvas slides** (one presentation tall) lay their content in an `absolute inset-0` layer
  against the relatively positioned `Slide`. Never a percentage height: the slide has only a
  `min-height`, so `height: 100%` collapses to the content.
- **Growth slides** (a table taller than the presentation) stay in flow, as
  `grid min-h-[calc(100cqh-var(--band-h,0px))] content-center`, so the slide grows instead of
  clipping. An absolute layer cannot make its slide taller.
- `full` slides centre with `justify-center-safe`: an overflow clips at the end, never the title.
- Every slide's content floors its bottom padding at `var(--presentation-clear-b, 0px)`, for example
  `pb-[max(6cqh,var(--presentation-clear-b,0px))]`; the heading column does the same in column
  mode. The engine never reads a host variable such as `--stage-clear-b`; the host bridges it
  through `clearBottom`.

## Tokens

- Text: `text-presentation-{display,title,figure,lead,body,label}` (`globals.css`,
  `@theme inline`), one rem-bounded `clamp()` per role for every mode, so nothing jumps at a
  threshold and the sizes grow with browser zoom. The one exception is the heading column's
  decorative, `aria-hidden` numeral in bare `cqw`.
- Spacing: `gap-presentation-{tight,group,zone}` and `p*-presentation-*`.
- Palette: `--presentation-ground`, `--presentation-accent` (brand blue on dark) and
  `--presentation-scrim` (oklch channels; add alpha at the call site,
  `oklch(var(--presentation-scrim) / 0.9)`), declared at `:root` because portaled dialogs
  read them. All three groups live in `globals.css` under a comment naming this folder as the
  owner.
- No viewport variants (`sm:`/`md:`/`lg:`) in this folder; mode changes go through
  `@max-[56rem]/presentation:`. No `font-medium`; titles `font-sans font-semibold`, figures
  `font-bold`.

## Motion

- `motion/react` only. Reveals rise on `REVEAL_VARIANTS` with `REVEAL_TRANSITION` and
  `REVEAL_STAGGER_S` (`motion.ts`), eased on `BRAND_EASE` from `src/shared/constants/motion.ts`.
  Never `var(--ease-brand)`: it is declared only inside `.funnel-light`.
- `Reveal` renders `initial={false}` so a slide already in view is at rest, not parked at
  opacity 0. Never wrap media or the slide itself in a `Reveal`.
- `Presentation` wraps its tree in `MotionConfig reducedMotion="user"`.
```

- [ ] **Step 2: The feature's rules**

`src/features/meeting-flow/DOCS.md`:

```markdown
# Meeting flow

Rules the meeting-flow UI relies on that the code alone does not make obvious. Meeting
business rules live in `src/shared/entities/meetings/DOCS.md`; the presentation engine's
rules live in `src/shared/components/presentation/DOCS.md`; the vocabulary in
`CONTEXT.md#presentation-terms`.

## Who We Are

Step 1 is a `presentation`-layout step (`MeetingStepLayout`): `WhoWeAreStep`
(`ui/components/steps/who-we-are/index.tsx`) renders the shared `Presentation` with the deck
below. Design: spec C, `docs/superpowers/specs/2026-09-20-presentation-config-and-critique-design.md`.

### The deck

- `WHO_WE_ARE_SLIDES: WhoWeAreSlide[]` in `constants/who-we-are-slides.ts`, where
  `WhoWeAreSlide = PresentationSlide<WhoWeAreContent>` and `WhoWeAreContent` is the kind union
  (`hero | credentials | sample | point | agent | team | comparison | closing`, `types/index.ts`).
  `WHO_WE_ARE_GROUPS` is `groupSlides(WHO_WE_ARE_SLIDES)`, derived once at module scope, and
  `PROOF_POINT_COUNT` counts the numbered slides.
- Ten slides: the hero (`full`), six proof points (`column`, numbered 1–6), the comparison and
  the extras (`column`, growth slides), the closing (`full`). Runs follow from the frames; the
  six points, the comparison and the extras form one run with one heading column.
- Every `column` slide writes `subheading: { text }`; the hero writes
  `subheading: { text: 'It starts when you do your', accent: 'due diligence.' }` and an empty
  content arm. The trade-matched hero background belongs to spec D (below).
- The keyboard hint for ↑ ↓ A Z reads "Previous / next slide in the presentation"
  (`constants/keyboard-hints.ts`); "beat" is the story word in `docs/sales/` and never appears
  in code.

### The kind switch

- `WhoWeAreStep` switches on `slide.content.kind` inline, per `IndexedSlide` inside each group,
  with an exhaustive `satisfies never` default. There is no dispatcher component, so no name
  competes with the `WhoWeAreSlide` type.
- Section components (`credentials-section.tsx`, `sample-section.tsx`, `point-section.tsx`,
  `agent-section.tsx`, `team-section.tsx`, `comparison-section.tsx`, `closing-section.tsx`)
  take `SlideProps<WhoWeAreContentOf<K>>`, spread it into `<Slide {...props}>` and put their content
  as children. None hard-codes a frame. The `hero` case renders `<Slide {...props} />` with no
  children.
- The step passes the shell's markers through the seam: `rootAttributes={{ 'data-step-root': true }}`
  (the view focuses it after a step change), `keyShortcuts={KEY_SHORTCUTS.presentation}` and
  `clearBottom="var(--stage-clear-b)"`, the capsule clearance `StageFrame` publishes. The
  engine reads only `--presentation-clear-b`; `--stage-clear-b` and `--stage-inset-b` are the
  shell's.

### Bodies

- Fixed-canvas: the hero, the six points (`PointLayout`, `grid-rows-[minmax(0,1fr)_auto]`,
  media above copy so the media→copy gap is identical on every point, U6) and the closing.
  Growth: the comparison and the extras, in flow with a one-presentation minimum.
- The comparison sheets (`comparison-sheets.tsx`) are the one container the engine does not
  own: `@container/comparison`, switching to stacked sheets at `@max-[44rem]/comparison:`.
  Inside it `cqw` measures the table, so its type is on the role tokens only.
- Documents on the desk sit square: no rotation, offsets only (rotated type blurs on low-DPI
  screens, U13). Every opener carries its own accessible name; the "Tap to view" cue is
  decorative (`tap-cue.tsx`).
- The agent card shows the meeting owner's cropped headshot or, without one, the brand mark;
  never the account photo (`lib/to-presentation-agent.ts`, U10).
- The document dialog portals out of the stage and reads `--presentation-scrim` from `:root`;
  its `sm:max-w-none` is the one viewport variant allowed in these folders.

## Meeting splash

- Opening a meeting on step 1 shows the branded splash held until the agent presses
  (`MeetingSplashScreen`, `ui/components/`), captioned with step 1's `title` and `subheading`
  from `MEETING_STEPS` (`constants/step-config.ts`, E6): retitling the step retitles the splash.
  The words the feature owns are `MEETING_SPLASH_COPY` (`constants/splash.ts`); the press
  surface, the key handling, the timing and the reduced-motion gate are the shared primitive's
  (`src/shared/components/splash-screen/splash-screen.tsx`).
- Once per meeting per browser session: `useMeetingSplash` (`hooks/`) is
  `useSessionOnce(meetingSplashKey(meetingId), currentStep === MEETING_STEPS[0].stepNumber)`;
  the key is `tri-pros:meeting-splash:<meetingId>` (`constants/splash.ts`), written on the
  press, so a reload before the press shows it again and a second meeting in the same session
  still opens with it.
- `MeetingFlowView` mounts it beside the inner view, outside `StageFrame`, the stage's
  `isolate` wrappers and the inner view's `MotionConfig`, so it stays up while the meeting
  loads and is never remounted. While it is open `StageFrame` is `inert`; when `splashOpen`
  turns false the inner view focuses `[data-step-root]` (state-driven, not `onExitComplete`).
  A press is any click, or any key except Tab, modifiers, Escape, function keys and browser
  shortcuts; Tab still moves focus to the dashboard sidebar behind it, by design.
- With reduced motion, the mark, caption and cue render at rest and a press still dismisses.

## Hook background (not built)

The trade-matched photo grid behind the hero belongs to spec D
(`docs/plans/2026-09-14-upgrading-meeting-flow-epic.md`, B1–B11), along with the `portfolio`
background arm. Until then the hero shows its static photo.
```

- [ ] **Step 3: Mark the specs**

Take the date and the commit range of Tasks 1–8 from the ledger. In spec C (line 4), the `**Status:**` line's final sentence `Not built.` becomes: `Built <YYYY-MM-DD> (<first commit>..<last commit>), plan \`docs/superpowers/plans/2026-09-22-presentation-config-and-critique.md\`; the engine's rules are in \`src/shared/components/presentation/DOCS.md\`, the deck's in \`src/features/meeting-flow/DOCS.md\`.` The rest of the line stays.

In `2026-09-12-who-we-are-scroll-presentation-design.md`, line 4 `**Status:** Draft for review` becomes: `**Status:** Built 2026-09-13. Layout (the pinned grid, \`--pin-h\`, section shapes, the feature-local primitive) superseded 2026-09-22 by spec C, \`2026-09-20-presentation-config-and-critique-design.md\`: the engine now lives in \`src/shared/components/presentation/\` (rules in its \`DOCS.md\`) and the deck in \`src/features/meeting-flow/DOCS.md#who-we-are\`.`

- [ ] **Step 4: The tracker**

In `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md`:
- Line 3 (the `> **Status:**` header): the clause `**Spec C written 2026-09-20** (…) after a grilling session that reversed C23 and added the step entrance E1–E7; not built.` keeps everything up to the semicolon and its tail becomes `; **built <date> (<first>..<last>)** on the semantics of spec C §12 (engine in \`src/shared/components/presentation/\`, beats → slides, \`split\` → \`column\`).`
- §0, row **C**: only the last column changes, `[ ]` → `[x] built (<first>..<last>)`. The plan and runbook paths in the row are already there.
- §1, row **C33**: `'split' \| 'full'` becomes `'column' \| 'full'`, and the cell ends with ` *Renamed 2026-09-22 (spec C §12.1): \`column\` replaces \`split\`; the heading sits in the run's heading column or centred over the full slide.*`
- §3.2b, the **E4** line: `focus returns in \`onExitComplete\`;` becomes `focus returns to \`[data-step-root]\` when \`splashOpen\` turns false (state-driven, not \`onExitComplete\`);`.
- §3.1: tick U2, U3, U5, U6, U7, U8, U9, U10, U11, U12, U13, U14, each followed by ` — spec C, built <date>`. Tick **U1** with ` — built; the alignment clause is superseded by C2 (spec C §7.1 (c))`. Tick **U4** with ` — built; §7.3 evidence in the Task 5 report`, and paste the per-size table widths and layouts from that report under it.
- §3.2: tick L1–L8 with ` — spec C, built <date>`; L5 with ` — built without the sticky-overlay clause (C23 reversed, C36)`; **L9** with ` — superseded by spec C §12 S1: the engine lives in \`src/shared/components/presentation/\`, feature-independent, and Program and Portfolio consume it from there`.
- §3.2b: tick E1–E8 with ` — spec C, built <date>`; **E1** and **E2** add ` — as amended by spec C §12.3: the primitive is \`SplashScreen\` (timed or pressed), \`MeetingSplashScreen\` lives in \`src/features/meeting-flow/ui/components/\`, and the caption props are \`title\`/\`subheading\``; **E8** adds ` — \`useSplashVisibility\` is deleted; visibility is \`useSessionOnce\` + the feature's key (S15, S16)`.
- §3.6: tick **K8** with ` — split per spec C §12 S12: \`src/shared/components/presentation/DOCS.md\` (engine) and \`src/features/meeting-flow/DOCS.md\` (deck, kind switch, splash); the hook's trade source, mix and fallback stay open for spec D`.

- [ ] **Step 5: Memory**

In `project-who-we-are-presentation.md` (read it first; these are its current strings):
- `⚠️ SPEC C IS WRITTEN (2026-09-20):` becomes `⚠️ SPEC C IS BUILT (<date>, <first>..<last>; plan docs/superpowers/plans/2026-09-22-presentation-config-and-critique.md):`.
- `**NOT EXECUTED — BLOCKED on H1:**` becomes `**EXECUTED <date> (H1 was released 2026-09-22; the note that follows is history):**`.
- Append a final paragraph after the "Execution runbook" paragraph:

  `**Semantics and homes (spec C §12, built <date>):** the engine is \`src/shared/components/presentation/\` (\`Presentation\`, one \`Slide\` switching on \`frame: 'column' | 'full'\`, \`SlideRun\`, \`HeadingColumn\`, \`Reveal\`, \`Scrim\`, \`SlideImage\`; sibling \`types.ts\`, \`context.tsx\`, \`motion.ts\`, \`group-slides.ts\`, \`slide-scroll-top.ts\`), with its rules in its own \`DOCS.md\`. "Beat" → "slide", \`split\` → \`column\`, \`line\`/\`lineAccent\` → \`subheading: { text, accent? }\`; the scroller is the \`presentation\` container and the tokens are \`text-presentation-*\` / \`gap-presentation-*\`; the engine reads \`--presentation-clear-b\`, never the shell's \`--stage-clear-b\`. The deck (\`WHO_WE_ARE_SLIDES\`, inline kind switch) and the splash use live in \`src/features/meeting-flow/DOCS.md\`. The splash is one shared \`SplashScreen\` (\`dismiss: { mode: 'timed' } | { mode: 'press', label }\`, reduced motion gated inside); visibility is \`useSessionOnce\` + feature-owned keys via \`sessionStorageKey\`; \`useSplashVisibility\`, \`SplashOverlay\` and \`SplashAnimation\` are gone. Glossary: \`CONTEXT.md#presentation-terms\`. READ the two DOCS files, not this note, before touching the presentation or the splash.`

In `MEMORY.md`, the Who We Are line's `**C written + PLANNED + RUNBOOK 2026-09-22 (plan \`2026-09-22-presentation-config-and-critique.md\` + \`…-runbook.md\` — READ THE RUNBOOK FIRST; H1 released, SDD ready to run: per-task commits, gates after Tasks 2/4/6/8)**` becomes `**C BUILT <date> — engine in \`src/shared/components/presentation/\` (rules in its DOCS.md), deck + splash rules in \`src/features/meeting-flow/DOCS.md\`; "beat" → "slide", \`split\` → \`column\`**`.

- [ ] **Step 6: Reconcile the slugs and check the links**

Run: `grep -rnoE "DOCS\.md#[a-z0-9-]+" src/shared/components/presentation src/features/meeting-flow src/shared/components/splash-screen | sort -u`
For each cited slug, the heading must exist in the file the path names (a slug is the heading lower-cased with spaces as hyphens and punctuation dropped). If Tasks 1–8 cited a slug this task's headings do not produce (say `#snap-arithmetic` is cited as `#snap`), rename the heading here to produce the cited slug; the code's citation wins over the doc's wording. Then re-run the grep and confirm every slug resolves. Expected at minimum: the engine's `presentation.tsx` and `slide.tsx` cite this folder's `DOCS.md`, and the feature's `steps/who-we-are/index.tsx` cites `src/features/meeting-flow/DOCS.md#who-we-are` or one of its subsections.

Run: `grep -n "presentation-terms" CONTEXT.md src/shared/components/presentation/DOCS.md src/features/meeting-flow/DOCS.md`
Expected: the `## Presentation terms` heading in `CONTEXT.md` and one reference in each DOCS file.

- [ ] **Step 7: Commit**

`docs(presentation): engine rules in shared, deck and splash rules in meeting-flow; spec C built` — paths: `src/shared/components/presentation/DOCS.md`, `src/features/meeting-flow/DOCS.md`, the two specs, the tracker. Memory files are outside the repo: not committed.

---

### Task 10: Verification (V1, V4, V7, H3)

Verification only: no product changes. Every failure goes back to the owner with evidence; nothing is fixed inside this task.

**Files:**
- Create: `$WS/tools/screens.mjs`, `$WS/tools/zoom.mjs`

- [ ] **Step 1: Write the V4 pass**

`$WS/tools/screens.mjs`:

```js
// V4 (spec C §9): every slide at the spec's sizes, plus present mode (sidebar collapsed; the
// headless viewport stands in for the fullscreen screen). Screenshots to $WS/screens/, and
// the measurements U3, U5, U6 and U9 name.
import fs from 'node:fs'
import path from 'node:path'
import { buildCss, openStep1, setup, WS } from './common.mjs'

const IDS = ['hook', 'licensing', 'scope', 'supervision', 'communication', 'team', 'performance', 'comparison', 'extras', 'closing']
const SIZES = [
  { tag: '1440x900', width: 1440, height: 900 },
  { tag: '1280x800', width: 1280, height: 800 },
  { tag: '1024x768', width: 1024, height: 768 },
  { tag: '820x1180', width: 820, height: 1180 },
  { tag: 'present-1440', width: 1440, height: 900, present: true },
  { tag: 'present-1180', width: 1180, height: 820, present: true },
]
const out = path.join(WS, 'screens')
fs.mkdirSync(out, { recursive: true })
const css = buildCss()
const failures = []
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
  if (!ok) {
    failures.push(label)
  }
}

for (const size of SIZES) {
  const cookies = size.present ? [{ name: 'sidebar_state', value: 'false', domain: 'localhost', path: '/' }] : []
  const { browser, page } = await setup({ width: size.width, height: size.height, cookies })
  try {
    await openStep1(page, { css })
    const floors = await page.evaluate(() => {
      const sizes = selector => [...document.querySelectorAll(`[role="region"][data-step-root] ${selector}`)].map(element => Number.parseFloat(getComputedStyle(element).fontSize))
      return { body: Math.min(...sizes('.text-presentation-body')), label: Math.min(...sizes('.text-presentation-label')) }
    })
    check(`${size.tag} body text never below 17px (U5)`, floors.body >= 17, floors)
    check(`${size.tag} labels never below 13px (U5)`, floors.label >= 13, floors)
    if (size.tag === 'present-1440') {
      const lines = await page.evaluate(() => {
        const title = document.querySelector('section#hook h2')
        return Math.round(title.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(title).lineHeight))
      })
      check('present-1440 hook headline on three lines (U9)', lines === 3, lines)
    }
    for (const [position, id] of IDS.entries()) {
      if (position > 0) {
        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(1100)
      }
      await page.screenshot({ path: path.join(out, `${size.tag}-${String(position + 1).padStart(2, '0')}-${id}.png`) })
      const clearance = await page.evaluate((slideId) => {
        const scroller = document.querySelector('[role="region"][data-step-root]').getBoundingClientRect()
        const capsule = document.querySelector('[data-stage] .absolute.h-12.rounded-full')
        const section = document.getElementById(slideId)
        if (section.getBoundingClientRect().height > scroller.height + 1) {
          return { grows: true }
        }
        let lowest = Number.NEGATIVE_INFINITY
        const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent.trim() || node.parentElement.closest('.sr-only')) {
            continue
          }
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const rect of range.getClientRects()) {
            if (rect.width > 0 && rect.top >= scroller.top && rect.bottom <= scroller.bottom) {
              lowest = Math.max(lowest, rect.bottom)
            }
          }
        }
        return { gap: capsule ? Math.round(capsule.getBoundingClientRect().top - lowest) : null }
      }, id)
      if (clearance.grows) {
        console.log(`INFO ${size.tag} ${id}: taller than the presentation (a growth slide); clearance applies at its end`)
      }
      else {
        check(`${size.tag} ${id}: copy clears the capsule by ≥40px (U3, U6)`, clearance.gap === null || clearance.gap >= 40, clearance)
      }
    }
  }
  finally {
    await browser.close()
  }
}
console.log(failures.length ? `\n${failures.length} FAIL` : '\nALL PASS')
process.exitCode = failures.length ? 1 : 0
```

`$WS/tools/zoom.mjs`:

```js
// U5 / WCAG 1.4.4 (review F7): presentation text must grow with browser zoom. A 1440×900
// window at 200% zoom lays out as a 720×450 CSS-pixel viewport, and each CSS pixel shows as
// two on screen. Bare `cqw` text would stay the same size on screen; the rem floors make it grow.
// The heading column is the run's `aside`.
import { buildCss, openStep1, setup } from './common.mjs'

const css = buildCss()
async function measure(width, height) {
  const { browser, page } = await setup({ width, height })
  try {
    await openStep1(page, { css })
    return await page.evaluate(() => {
      const px = selector => Number.parseFloat(getComputedStyle(document.querySelector(`[role="region"][data-step-root] ${selector}`)).fontSize)
      return { body: px('.text-presentation-body'), title: px('aside .text-presentation-title') }
    })
  }
  finally {
    await browser.close()
  }
}
const at100 = await measure(1440, 900)
const at200 = await measure(720, 450)
const growth = { body: (2 * at200.body) / at100.body, title: (2 * at200.title) / at100.title }
console.log(JSON.stringify({ at100, at200, growth }))
const ok = growth.body >= 1.5 && growth.title >= 1.5
console.log(ok ? 'PASS' : 'FAIL')
process.exitCode = ok ? 0 : 1
```

- [ ] **Step 2: Run everything**

Run, in order, and keep every output for the report:
- `pnpm tsc && pnpm lint` (V1): no errors.
- `node $WS/tools/screens.mjs` (V4): `ALL PASS`; 60 screenshots in `$WS/screens/`.
- `node $WS/tools/zoom.mjs` (U5 zoom): `PASS`; body and column title at least 1.5× larger on screen at 200%.
- `node $WS/tools/verify-deck.mjs`, `node $WS/tools/nudge-release.mjs`, `node $WS/tools/verify-comparison.mjs`, `node $WS/tools/verify-content.mjs`, `node $WS/tools/verify-splash.mjs`, `node $WS/tools/proposal-splash.mjs`, `node $WS/tools/check-tokens.mjs` (Task 2's token check, which covers the six `text-presentation-*` roles, `gap-presentation-{tight,group}`, `pt-presentation-zone`, the `:root` palette, `--stage-clear-b` on `StageFrame` and `BRAND_EASE`): all pass (or the proposal route's recorded NOT RUN, and `verify-splash.mjs`'s `NOT RUN I` if the dev list has one meeting).
- `pnpm exec tsx $WS/checks/group-slides.ts`, `pnpm exec tsx $WS/checks/splash-timing.ts`, `pnpm exec tsx $WS/checks/is-splash-press.ts`: `ok` each.
- H3: `node .superpowers/sdd/2026-09-14-specialties-stage-and-rail/tools/measure-stage.mjs` (step 2's render budget: it writes the dev meeting and restores it). Expected: `restored: true`, `withinRegressionBaseline` true (immediate totals ≤ 110/81/496/369), and the other budget lines as in the **re-run** report `.superpowers/sdd/2026-09-14-specialties-stage-and-rail/task-v1-rerun-report.md` (28 PASS / 3 FAIL, the 3 being contrast on shared tokens, owner's follow-ups), not the superseded `task-v1-report.md`. Any change from the re-run report is a regression to report, not to fix here.

**On the F5 check (review F5).** `verify-splash.mjs` prints F5's `defaultPrevented` as `INFO`, not as a PASS: Playwright's synthetic key never triggers a browser reload, so "F5 is not prevented" passes vacuously under Playwright and is not evidence. The evidence that F5 survives the splash is (a) `is-splash-press.ts`, which asserts `F1`–`F12` are not presses, so the capture listener never calls `preventDefault()` on them, and (b) case H, a real `page.reload()` before the press that brings the splash back. A manual F5 in a real browser belongs on the NOT RUN list below.

- [ ] **Step 3: Look at the screens**

View, with the Read tool, at least the hook, a `column` slide, the comparison and the closing at `1440x900`, `820x1180` and `present-1180`. Check against the spec: the hook and the closing centred and full-bleed; the heading column fading between titles, as a band at 820; no heading inside a `column` slide's own box; the sheets side by side or stacked as `verify-comparison.mjs` reported; the splash absent (dismissed).

- [ ] **Step 4: What the scripts cannot reach**

List these as NOT RUN, for the owner or a device session:
- A real iPad in Safari, portrait: the band stays pinned across the run (F12), and whether a re-anchor after resize is needed (N5).
- True present mode (fullscreen) at 1440 and 1180; the headless runs stand in with a collapsed sidebar.
- A real-browser F5 with the meeting splash open: the page reloads and the splash returns (the Playwright check is vacuous, above).
- A second meeting in the same session, if `verify-splash.mjs` printed `NOT RUN I`.

- [ ] **Step 5: V7 (controller)**

Run `/impeccable critique` on Who We Are at present mode and compare the score with round 1's 16/32 (`.impeccable/critique/2026-09-13T21-12-06Z__atures-meeting-flow-ui-components-steps-who-we-are.md`).

- [ ] **Step 6: Report**

To the owner: every script's result, the screens folder, the §7.3 evidence from Task 5, the H3 numbers against the re-run report, the NOT RUN list, the V7 score, and the two behaviour notes from Task 7 (the proposal key's value changed, so one extra proposal splash for anyone mid-session at deploy; `PwaSplashScreen` inherited the primitive change and still has no callers). No commit: this task writes only git-ignored files.
