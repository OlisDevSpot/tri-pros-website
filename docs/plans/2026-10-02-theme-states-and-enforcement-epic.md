# Theme states, tokens and enforcement — epic tracker

Started 2026-10-02, right after the elevation ladder shipped. Goal: every colour on screen comes from a token chosen by meaning, hover/press/selected states come from state tokens instead of ad-hoc `primary/NN` mixes, and the rules are enforced by lint and checks rather than by memory. Delete each line when it ships; delete the file when the epic is done.

**Read first:** `src/app/(frontend)/globals.css` (the ladder knobs sit in `:root, .funnel-light` and `.dark`), the `elevation-ladder` skill (`.claude/skills/elevation-ladder/`: retune flow, `shoot.mjs` screenshots, `measure.mjs`), `pnpm theme:check` (`scripts/check-theme-contrast.ts`), and the `theme-tokens/*` block in `eslint.config.js`. `DESIGN.md` describes the ladder and the hover/press tokens (E5 done); still trust the code over it.

**Process rules carried over:** surfaces are judged by eye on dashboard + records + proposal + public site, both schemes, with an owner screenshot gate before each commit; no mechanical sweeps; no DB writes for visual tests; never `pnpm build`.

---

## 1. What enforces the theme today

| Guard | Catches | Runs |
|---|---|---|
| The tokens themselves | A nested `bg-card` climbs a rung, `bg-popover` is the top rung, `bg-(--card)` paints the current rung. New code that uses them gets the ladder for free. | Always |
| `theme-tokens/palette` (lint) | Tailwind palette classes (`bg-blue-500`, …) | `src/features/**` + `src/shared/**` only, minus 9 ignored files. **`src/app/**` is not covered.** |
| `theme-tokens/type-ramp`, `no-heavy-font-weight` (lint) | `text-[13px]`, `font-black` | Same scope |
| Claude pre-commit hook (`.claude/settings.json`) | `pnpm tsc`, `pnpm lint` or `pnpm theme:check` fail → commit blocked | Claude sessions' `git commit` only |
| CI `pr-checks.yml` | lint + build | Pull requests only. Direct pushes to main (the normal path) skip it. |
| `pnpm theme:check` | Contrast pairs on every rung, both schemes; rungs climb; tab track → active climbs; selected row outranks hover | The Claude hook; not in CI |
| impeccable hook | Design-detector findings | Advisory, Claude sessions only |

**Not caught by anything:** `bg-white`/`text-black`, hex and `[oklch(..)]` arbitrary values, `dark:` colour patches, primary used as a hover/active fill, `bg-background` holes inside surfaces, faded text (`text-foreground/60`) contrast, primary coverage per screen (DESIGN.md's ≤10% "One Voice" rule).

## 2. The tally (scan 2026-10-02, `src/**/*.ts{,x}`)

### 2a. Systemic, from the code

- **Primitives still off the state tokens:** `navigation-menu` (`hover:bg-accent` ×4), the `select` and `multi-select` triggers (`hover:bg-accent`), the dialog and sheet close buttons (`hover:opacity-100`). Button, badge, toggle and calendar moved in `17d04dac`; menus, tabs and selects got press washes in `d51c9e55`.
- **Primary overuse:** 436 `*-primary` utilities in 170 files. 45 hover/active/focus states paint primary in 32 files. Top files (scan predates `17d04dac`, which took the primary hovers out of `button.tsx`): `footer.tsx` 3, `nav-item.tsx`, `navbar-menu.tsx`, `step-tabs.tsx`, `contact-info.tsx`, `story-solution.tsx`, `dashboard-meetings-hub.tsx` 2 each. Static-heavy files: `coming-soon-state.tsx` 15, `company-story.tsx` 13, `homeowner-contract-view.tsx` 10, `agreement-timeline.tsx` 8, `calendar.tsx` 8.
- **`bg-background`: 120 hits in 82 files.** Most are page shells or marketing sections (fine). The ones inside a surface are ladder holes and need triage (the three known ones closed in `dbeccb4e`). Top: `site-navbar.tsx` 7, `photo-lightbox.tsx` 6, `media-card.tsx` 5, `schedule-today-view.tsx` 5, `sidebar.tsx` 3.
- **White/black utilities: 186 hits in 63 files.** Many are text or scrims over photos, and there is no token for that. Top: `reputation-mark.tsx` 11, `who-we-are/comparison-table.tsx` 10, `portfolio/index.tsx` 10, `funnel-hero-entry.tsx` 8, `contact-action-trigger-variants.ts` 8, the customer-profile hero files (`hero-view-toggle` 7, `loading-skeleton` 6, `address-hero` 6, `hero-header` 5), `base-modal.tsx` 5.
- **`dark:` colour patches: 55 hits in 23 files.** Tokens already carry both schemes, so each patch hides a light-only value. Top: `program-card.tsx` 13, `socials.ts` 6, `process-overview.tsx` 4, proposal-flow `navbar.tsx` 3, `closing-step.tsx` 3, `input-group.tsx`, both contract views, `customer-kanban-card.tsx`, `tabs.tsx`.
- **Arbitrary colour values: 24 hits in 15 files.** `coming-soon-state.tsx` 5, `portfolio-step-layout.tsx` 3, `reputation-mark.tsx`, `project-list-card.tsx`, `sidebar-theme-switch.tsx` 2 each, and five proposal/project form-field files 1 each.
- **Faded text `text-<colour>/NN`: 177 hits in 100 files.** This is a readability risk on rungs 2–3, and `theme:check` has no alpha-text pairs.
- **Raw palette classes: 151 hits in 19 files.** All of them sit inside the lint ignore list (meeting-flow program/benefit accents, landing marketing, socials) and are already tracked in `docs/plans/2026-09-29-dashboard-theme-follow-ups.md`.
- **Hex and inline style colours: 80 hits in 13 files.** Mostly legitimate, because emails, PDFs, the OG card and the manifest cannot read CSS variables. Check the outliers: `address-autocomplete.tsx` (4), `splash-screen.tsx`, `before-after-compare.tsx`.

The marketing world (landing, funnels, `site-navbar.tsx`) keeps its own Blueprint palette and is lint-exempt. The public-site transformation epic owns it: read that memory before touching marketing tokens.

## 3. Plan: tokens and primitives, then the backlog by area, then lint

- **E1. Remaining state tokens** in `globals.css`, picked by the owner at a screenshot gate (`--hover`, `--press`, `--secondary-hover`, `--primary-hover`, `--destructive-hover` landed in `17d04dac`; `--overlay-selected-mix` in `dbeccb4e`):
  - `--selected`, generalised from `--row-selected`;
  - `--on-media` and `--scrim`, for text and veils over photos.

  Each token gets `theme:check` pairs on every rung in both schemes, plus alpha-text pairs (M2).
- **E2. Primitives on the state tokens: done.** Shipped in `17d04dac` (button, badge, toggle, calendar), `12514bbf` (navigation-menu, dialog/sheet close, menu items, select in a control group) and `78c5e0a8` (select and multi-select triggers hover with `--input-hover`).
- **E3. Lint rules (after Phase 1, per §5.4),** in the `theme-tokens/*` block, with scope extended to `src/app/**`. They ban:
  - `bg|text|border-(white|black)`; use `--on-media`/`--scrim` instead;
  - arbitrary colour values `-[#..]`, `-[rgb(..)]`, `-[oklch(..)]`;
  - `dark:` colour patches;
  - `hover:|active:|focus:` primary fills outside `src/shared/components/ui/**`;
  - `bg-background` outside an allowlist of page shells.

  No suppressions ratchet: each rule turns on once Phase 1 has cleaned its hits.
- **E6 (optional). Primary-coverage probe:** `shoot.mjs` reports the share of pixels in the primary hue per screen, against the ≤10% One Voice rule.
- **Phase 1. Backlog by area:** sign-in → dashboard → records → proposal → meeting-flow → customer profile → public site. Owner gate per area, both schemes, desktop + phone.

## 4. Carried over from the elevation ladder (on prod 2026-10-02)

Shipped from this list: I3 (tone hairline on pills, `17d04dac`); M3, M6, M7, M9 (`dbeccb4e`); the plan + spec deletion (`a7034b17`); the plan workspace is closed.

- **Owner hand-check:** on a records table scrolled sideways, the frozen first column stays solid.
- **Deferred minors:**
  - M2: `theme:check` still lacks fill-vs-surface and page-level edge/skeleton pairs, and alpha-text pairs (→ E1). Hover-vs-surface pairs landed in `17d04dac`.
  - M4b: the shoot REPORT ignores overlays and the footer.
  - M4c: a failed shoot attempt leaks a popup.
  - M5: a nested `.dark` wrapper would break the depth count (latent).
  - M8: the Task 7 recipe needs a line saying page-level `bg-(--card)` paints rung 1.
- The 22 rulings made during the ladder build (the deleted workspace's ledger held the full text):

<details><summary>Rulings made during the ladder build (22)</summary>

Changed what you see:
- footer dividers → `border-border` (dark navy at 20% vanished on the darker rung);
- skeleton rows drop the cell border and stripe by row index, so they no longer change height when data lands;
- pull-to-refresh bubble `bg-background` → `bg-muted`;
- timeline icon disc → `bg-(--card)`;
- dashboard meetings calendar climbs to rung 2 (`+bg-card`);
- `--overlay-hover-mix` knob added (14% light / 8% dark);
- I3 left to you.

Declined on purpose:
- reviewer's "ladder values" (your pick stands);
- "WebKit max() inside oklch(calc())" (shipped before, renders on iOS; your iPad would catch it);
- "portaled overlays in funnels" (predates the ladder).

Coverage gaps accepted:
- phone "before" shots skipped after 4 dev-server OOMs;
- touch emulation dropped (hover-less tablets not shot).

Harness and test choices, no cost:
- shoot viewports flag and per-screen viewports;
- one load per screen;
- visible-dialog wait;
- popup resize;
- `tr[data-band]` selector;
- `rowClassName` rename;
- grep-count wording;
- prettier one-liner;
- Task 2 partial-hunk commit;
- Task 6 precondition;
- combined T3–5 gate;
- skill files pulled forward;
- static RED for I1/I2;
- M1 run with the clock set 30 days back;
- I2 opened by meeting id.
</details>

## 5. Owner rulings (2026-10-02)

1. **Ghost hover:** a neutral wash. Primary stays for "act here".
2. **`cta` variant:** flat brand blue with a solid, darker hover, tuned separately for light and dark. No gradient.
3. **Sign-in screen:** follows the rungs. The canvas holds a card, and the button sits on the card one rung above it (button over card over page, the same model as a modal).
4. **Lint:** afterwards. Clean each area first and enable the rules after (no suppressions ratchet). E3 moves after Phase 1.
5. **I3 pills:** a thin tone border.
6. Cut-off message: dropped.
7. **Hero CTA quieter:** owner rejected the warm-up approach 2026-10-05; on 2026-10-07 ruled to leave it as is (closed). (The navbar pill's dark-mode hover bug was fixed separately in `5c3e4a74`, without restyling the pill.)
8. **Control group marker (2026-10-07):** `data-slot="control-group"` on a capsule that groups controls; a segmented or pill-tab track inside it drops its own edge, fill and padding.
9. **E1 photo tokens (2026-10-07):** add `--on-media` and `--scrim` now; areas adopt them during Phase 1.
10. **Phase 1 review pace (2026-10-07):** two areas per owner review, in the order sign-in + dashboard, records + proposal, meeting-flow + customer profile, public site.
11. **Dashboard round (2026-10-07):**
    - clickable cards hover with `bg-row-hover` and never take a blue hover border;
    - the calendar's today marker is `bg-row-selected`, with no outline;
    - the snapshot counts use foreground ink;
    - a declined proposal leaves the "Out for signature" list;
    - the agenda time badge is `bg-muted`;
    - the dock's gloss values move into tokens unchanged;
    - the Google button keeps its hairline;
    - the project card's ⋯ menu is not dimmed at rest.
12. **Records + proposal round (2026-10-07):**
    - Records:
      - proposal tiles keep solid status-tone fills;
      - upcoming-meeting rows take a solid `bg-status-pending-bg`;
      - filter chips are filled like the toolbar buttons;
      - the opened-row panel is `bg-band`;
      - the frozen-column shadow becomes a `--shadow-frozen` token;
      - the refetch `opacity-60` stays.
    - Proposal:
      - the whole customer proposal page is cleaned now, including files the unbuilt redesign replaces;
      - agreement callouts take the info tone;
      - the active timeline step is a `bg-row-selected` disc with no ping;
      - "Viewing as" becomes a segmented control;
      - form section cards are nested `bg-card`;
      - the offer badge is secondary.
13. **Live check (2026-10-09):** the owner checked the shipped Phase 1 work live and accepted it with no corrections. That covers rounds 1–5, the gutter/radius pass, controls, segmented/tabs, E1, E2, the sign-in + dashboard, records + proposal pairs, and the 2026-10-08 follow-ups. Still open: the meeting-flow + customer-profile pair, the public site, E3 lint and E6.
