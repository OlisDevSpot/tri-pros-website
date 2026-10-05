# Dashboard theme: Navy Rail (Harbor, floating), and a floating mobile navbar

**Status:** APPROVED by the owner 2026-09-29 (type ramp amended to the 2px rule, V5) · next: implementation plan
**Surface:** the internal CRM (`/dashboard/**`), light and dark
**Studies page (what the owner last saw):** https://claude.ai/artifact/Ae3E54hrbxKfecBdc8VtGw (round 3, the ★ study "Harbor, floating" leads). Source: session scratchpad `theme-studies/tpr-theme-studies.html`; every value in §A4 is copied from that file's `themes.H` (= `themes.A3` + floating), `status` and `chart` objects.
**Critique that started it:** `.impeccable/critique/2026-09-30T05-09-39Z__src-app-frontend-dashboard.md` (20/32)

This spec has two parts:
- **Part A** is the theme: tokens, surfaces, status colors, charts and the type ramp. It is built first.
- **Part B** is a self-contained brief for a **new session** to rebuild the mobile navbar as a floating dock in the Navy Rail language. It depends on Part A's tokens and nothing else.

---

## Part A — Navy Rail theme

### A1. Goal

In the owner's words: keep "our nice navy blue of TPR" as the main color, and make everything around it more aesthetic and pass real CSS contrast tests, in both light and dark mode.

The dashboard is used **mostly on an iPad or phone in the field, in light mode**. Daylight legibility decides every tie.

### A2. Decisions already made

| # | Decision | Source |
|---|---|---|
| D1 | There was no navy token. The logo is black plus `#03AFED`; today's `--primary` is Tailwind blue-500; today's dark background is Tailwind v1 gray-900. The owner chose **a navy anchor plus one action blue derived from the logo**. | Owner, round 1 question |
| D2 | Usage scene: **mostly iPad/phone in the field, light mode dominant.** | Owner |
| D3 | Scope: **everything.** Core tokens, status/stage tokens (migrating the raw palette classes), chart tokens and the font-size ramp. | Owner |
| D4 | Direction **A · Navy Rail** is the family, in both light and dark (owner, round 2: "looks great on both light and dark mode"). The build uses the **A3 · Harbor** colors: a deeper navy, and a solid logo-cyan pill with navy text for the current page. | Owner, rounds 2–3 (V1) |
| D5 | The **iPad/desktop sidebar floats** like A2: a rounded, inset, shadowed panel. The **phone dock** is A3's split dock, corrected: the round button sits **bottom-left** and **opens the menu**, and the capsule holds the main tabs and ends with the Action Center bolt (Part B). | Owner, round 3 (V2) |
| D6 | Variants A2–A5 were shown. Harbor colors + floating rail were picked, and §A4 is normative for that combination. Appendix 1 keeps the other deltas for reference only. | Owner, round 3 |
| D7 | The Stage-Color Rule keeps its meanings (red bad, yellow in progress, green converted, purple action, blue neutral). The **blue** stage becomes a muted steel so it stops competing with the action blue. | Studies page, shared section |
| D8 | The frosted-glass popover stays. It is the best surface in the app today. | Critique strength, studies |
| D9 | The 35% primary radial glow behind every dashboard page is removed. No study showed it. | Critique P2, studies |
| D10 | **Change `:root`.** The public site, proposal-flow, intake and auth re-skin with the navy set too; the build captures them before and after for the hands-on gate. | Owner (V3) |
| D11 | Pipeline stages **keep `color: 'orange'`**; one map translates each key to a tone. | Owner (V4) |
| D12 | Type ramp follows the **2px rule**: every font size is divisible by 2 (usually a multiple of 4). The ramp is Tailwind's default steps, which all comply, with **no new steps**; `text-meta` (13px) is dropped. | Owner, spec approval (V5) |

### A3. What changes, in one paragraph

- A navy **rail** frames every screen in both modes. On iPad and desktop it is a floating sidebar panel; on the phone it is the floating dock (Part B). The current page is a solid logo-cyan pill.
- Light mode is a cool white canvas with a real surface ramp: page, card, raised, overlay.
- Dark mode is built from the same navy family, with each step lighter than the one below it. Today, cards are darker than the page.
- One action blue from the logo does one job, "act here":
  - light mode: a deep logo blue with a white label, 5.8:1;
  - dark mode: bright logo cyan with a navy label, 8.9:1.
- Borders split into a soft hairline for dividers and a 3:1 control border for inputs.
- Shadows get a navy-tinted ramp.
- Status and stage colors become seven semantic tones, each with text, fill and dot values in both modes.
- The lead-chain chart keeps its ordinal ramp, now running cyan → navy.
- One-off font sizes fold into Tailwind's even-pixel ramp (the 2px rule).

### A4. Tokens (normative values, Direction A)

All tokens live in `src/app/(frontend)/globals.css`, in the three tiers described by `docs/design-system/tokens.md`.

#### A4.1 Tier 1 — brand primitives (new, theme-agnostic)

| Token | Value | Role |
|---|---|---|
| `--brand-cyan` | `#03AFED` | The logo color. Used for identity only (logo, `theme-color`). Never text on light. |
| `--brand-cyan-bright` | `oklch(0.80 0.12 228)` | The active nav pill, dark-mode accents |
| `--brand-blue` | `oklch(0.50 0.15 243)` | Light-mode action fill (≈ `#0069b1`) |
| `--brand-navy` | `oklch(0.215 0.072 262)` | Light-mode rail (≈ `#06173a`) |
| `--brand-navy-deep` | `oklch(0.13 0.05 262)` | Dark-mode rail (≈ `#01061b`) |

#### A4.2 Tier 2 — semantic tokens

These are shadcn names, so every existing `bg-card` / `text-muted-foreground` consumer re-skins with no code change. Four roles are **new** (marked ✚).

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.965 0.009 246)` | `oklch(0.17 0.045 260)` |
| `--foreground` | `oklch(0.235 0.045 258)` | `oklch(0.955 0.008 250)` |
| `--card` / `--popover` | `oklch(1 0 0)` | `oklch(0.21 0.05 260)` |
| `--card-foreground` / `--popover-foreground` | = foreground | = foreground |
| ✚ `--surface-raised` (column bodies, table heads, hover rows) | `oklch(0.978 0.006 250)` | `oklch(0.245 0.055 260)` |
| `--secondary` / `--muted` | `oklch(0.955 0.008 250)` | `oklch(0.245 0.055 260)` |
| `--secondary-foreground` | = foreground | = foreground |
| `--muted-foreground` | `oklch(0.47 0.03 256)` | `oklch(0.75 0.03 252)` |
| `--accent` (neutral hover wash; today it is indigo/primary) | `oklch(0.955 0.012 250)` | `oklch(0.245 0.055 260)` |
| `--accent-foreground` | = foreground | = foreground |
| `--border` (hairline: dividers, card edges) | `oklch(0.905 0.012 252)` | `oklch(0.30 0.04 258)` |
| ✚ `--border-strong` (dashed empties, emphasized dividers) | `oklch(0.84 0.015 252)` | `oklch(0.38 0.04 258)` |
| `--input` (**control border**, 3:1 vs card; shadcn's `border-input`) | `oklch(0.62 0.03 255)` | `oklch(0.53 0.04 256)` |
| ✚ `--input-background` | `oklch(1 0 0)` | `oklch(0.195 0.038 258)` |
| `--primary` | `oklch(0.50 0.15 243)` | `oklch(0.76 0.13 230)` |
| `--primary-foreground` | `oklch(1 0 0)` | `oklch(0.19 0.045 258)` |
| ✚ `--link` (primary as text) | `oklch(0.47 0.14 243)` | `oklch(0.81 0.11 228)` |
| `--ring` | `oklch(0.58 0.15 238)` | `oklch(0.78 0.12 228)` |
| `--destructive` (fill, white label) | `oklch(0.53 0.19 27)` | `oklch(0.53 0.19 27)` |
| ✚ `--destructive-text` | `oklch(0.49 0.17 27)` | `oklch(0.83 0.10 25)` |
| `--success` / `--warning` (fills) | Status `success.fg` / `pending.fg`, with `-foreground` white | Status `success.fg` / `pending.fg`, with `-foreground` `oklch(0.19 0.045 258)` (navy) |
| `--sidebar` | `oklch(0.215 0.072 262)` | `oklch(0.13 0.05 262)` |
| `--sidebar-foreground` | `oklch(0.93 0.015 250)` | `oklch(0.92 0.012 250)` |
| ✚ `--sidebar-muted` (group labels, icons at rest) | `oklch(0.74 0.05 250)` | `oklch(0.68 0.03 252)` |
| `--sidebar-accent` (active pill, solid cyan) | `oklch(0.80 0.12 228)` | `oklch(0.80 0.12 228)` |
| `--sidebar-accent-foreground` (label on the pill) | `oklch(0.20 0.07 262)` | `oklch(0.18 0.06 262)` |
| `--sidebar-primary` (active icon, same navy as its label) | `oklch(0.20 0.07 262)` | `oklch(0.18 0.06 262)` |
| `--sidebar-primary-foreground` | `oklch(0.19 0.045 258)` | `oklch(0.19 0.045 258)` |
| ✚ `--sidebar-hover` | `oklch(1 0 0 / 0.06)` | `oklch(1 0 0 / 0.05)` |
| `--sidebar-border` (floating panel edge) | `oklch(0.29 0.075 262)` | `oklch(0.25 0.06 262)` |
| `--sidebar-ring` | `oklch(0.80 0.12 228)` | `oklch(0.80 0.12 228)` |
| `--popover-glass` | `oklch(from var(--popover) l c h / 0.78)` (unchanged) | `oklch(0.245 0.055 260 / 0.62)` |

The contrast each pair reaches is on the studies page. The ★ study passes all 20 checks in light and dark, including the navy label on the cyan pill.

`--sidebar-ring` stays cyan. On the cyan pill, the ring shows through its 2px offset against the navy rail.

Each new role (✚) is exposed in `@theme inline` as `--color-<name>`, so it is usable as a utility, e.g. `bg-surface-raised`, `text-link`, `border-border-strong`.

#### A4.3 Status tones (new; replace every raw status/stage palette class)

There are seven tones. Each has `fg` (text), `bg` (pill/badge fill) and `dot` (dots, column markers, borders). They are emitted as `--status-<tone>-<part>` and `--color-status-<tone>-<part>`, so a utility reads e.g. `text-status-attention-fg bg-status-attention-bg`.

| Tone | Replaces stage key | Light fg / bg / dot | Dark fg / bg / dot |
|---|---|---|---|
| `info` | blue | `0.44 0.08 252` / `0.945 0.02 250` / `0.60 0.09 250` | `0.84 0.06 245` / `0.30 0.045 250` / `0.72 0.08 245` |
| `pending` | yellow | `0.46 0.095 72` / `0.955 0.05 88` / `0.76 0.15 82` | `0.87 0.11 88` / `0.31 0.05 80` / `0.82 0.14 85` |
| `attention` | orange | `0.49 0.14 45` / `0.95 0.035 55` / `0.67 0.17 48` | `0.84 0.10 55` / `0.31 0.06 45` / `0.74 0.15 50` |
| `action` | purple | `0.46 0.16 300` / `0.95 0.03 300` / `0.60 0.18 300` | `0.84 0.09 300` / `0.31 0.07 300` / `0.72 0.15 300` |
| `success` | green | `0.45 0.11 152` / `0.95 0.04 152` / `0.64 0.15 152` | `0.84 0.11 155` / `0.30 0.06 155` / `0.74 0.15 152` |
| `danger` | red | `0.49 0.17 27` / `0.95 0.025 25` / `0.61 0.20 27` | `0.83 0.10 25` / `0.31 0.08 25` / `0.70 0.17 27` |
| `idle` | slate | `0.46 0.02 255` / `0.94 0.008 255` / `0.66 0.02 255` | `0.82 0.02 255` / `0.30 0.02 258` / `0.66 0.02 255` |

(All values are `oklch(L C H)`.) Every `fg` on its own `bg` clears 4.5:1 in both modes.

`indigo` and `cyan` exist in `kanban/constants/color-maps.ts` but no pipeline uses them. They map to `info` and `action`, and the build confirms there are no other callers.

#### A4.4 Charts

- **Lead-chain series.** These are new tokens, replacing the hex arbitrary properties in `features/analytics/constants/chart-series.ts`. The ordinal ramp is intentional and stays; it now runs cyan → navy, and every step clears 3:1 on a card.

| Token | Light | Dark |
|---|---|---|
| `--series-leads` | `oklch(0.66 0.12 228)` | `oklch(0.58 0.10 240)` |
| `--series-booked` | `oklch(0.56 0.14 236)` | `oklch(0.68 0.12 234)` |
| `--series-sits` | `oklch(0.46 0.14 245)` | `oklch(0.79 0.11 228)` |
| `--series-sales` | `oklch(0.30 0.075 258)` | `oklch(0.91 0.05 222)` |
| `--series-neutral-strong` | `oklch(0.40 0.03 256)` | `oklch(0.85 0.02 250)` |
| `--series-neutral-soft` | `oklch(0.66 0.02 255)` | `oklch(0.55 0.03 255)` |

- **`--chart-1..5`** become the **categorical** set for non-ordinal charts, in both modes:
  - brand blue `0.52 0.15 243`,
  - teal `0.58 0.10 190`,
  - amber `0.70 0.14 72`,
  - violet `0.55 0.16 300`,
  - slate `0.55 0.03 255`.

  Dark mode lifts each L by +0.12. The build runs the dataviz palette validator (the `dataviz` skill ships it) on both sets and records the result in the task report.
- The calculators' `bill-colors.ts` moves onto `--chart-*` or `--status-*` by meaning, not by look.

#### A4.5 Elevation (Tier 3)

The shadow ramp is navy-tinted in light and deep in dark. It replaces the flat 4px/10px ramp.

- **Light:**
  - `--shadow-xs` = `0 1px 2px oklch(0.25 0.05 258 / 0.06)`;
  - `--shadow-sm` = `--shadow` = `0 1px 2px oklch(0.25 0.05 258 / 0.06), 0 4px 12px -6px oklch(0.25 0.05 258 / 0.12)`;
  - `--shadow-md` adds `0 10px 24px -12px … / 0.16`;
  - `--shadow-lg` / `--shadow-xl` = `0 16px 36px -14px oklch(0.2 0.06 258 / 0.35), 0 4px 10px -4px oklch(0.2 0.06 258 / 0.15)`.
- **Dark:**
  - `--shadow-sm` = `inset 0 1px 0 oklch(1 0 0 / 0.04), 0 6px 18px -10px oklch(0 0 0 / 0.6)`;
  - `--shadow-lg` = `0 18px 40px -12px oklch(0 0 0 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.06)`.
- `--popover-glass-shadow` keeps its four layers, re-tinted navy in light (see the studies' `shadowsLight.glass`).

Radius is unchanged (`--radius: 0.5rem`).

#### A4.6 Type ramp (the 2px rule)

**Rule:** every font size is divisible by 2, and usually a multiple of 4. Tailwind's default steps already comply, and so do their line-heights (all on a 4px grid):

| Step | Size / line-height |
|---|---|
| `text-xs` | 12 / 16px (**the floor** for app UI) |
| `text-sm` | 14 / 20px |
| `text-base` | 16 / 24px |
| `text-lg` | 18 / 28px |
| `text-xl` | 20 / 28px |
| `text-2xl` | 24 / 32px |
| `text-3xl` | 30 / 36px |
| `text-4xl` and up | 36, 48, 60, 72, 96, 128px |

**No new steps are added.** The ramp is the one the public site already uses, so nothing there moves.

**How a literal maps.** Every `text-[Npx]` / `text-[Nrem]` goes to the **nearest** step. An exact tie between two steps rounds **up**, because daylight legibility decides ties (D2). Anything under 12px goes to `text-xs`.

| Literal today | Becomes |
|---|---|
| 8, 9, 10, 11, 11.5, 12, 12.5px, `0.72rem`, `0.8rem` | `text-xs` (12px) |
| 13, 13.5, 14, 14.5px | `text-sm` (14px) |
| 15, 15.5px | `text-base` (16px) |
| 17px | `text-lg` (18px) |
| 22, 25px | `text-2xl` (24px) |
| `1.75rem` (28px) | `text-3xl` (30px) |

If a dense layout overflows after rounding up (a kanban card, a chart tooltip), drop it one step to the nearest even size. Never go back to a literal.

The fluid `--text-presentation-*` clamps (meeting-flow presentation) are out of scope here. Two of their minimums are odd (`label` 13px, `body` 17px), so they go to the follow-ups doc (§A12).

### A5. Scope of `:root` (read before building)

The app's light tokens are declared on `:root, .funnel-light`.

- The **public site `(site)`, `proposal-flow`, `intake` and `auth`** also read `:root`. Only the funnels and `/test` wrap themselves in `.theme-marketing`.
- Changing `:root` therefore re-skins the customer-facing proposal flow and the site's shadcn components with the navy/logo-blue set.

**Ruled (D10): change `:root`.** It is the Tri Pros brand either way. The marketing world already scopes itself, and scoping the dashboard to a wrapper breaks Radix portals (dialogs, popovers and sheets mount on `<body>`, outside any wrapper).

The build captures `/`, one `/proposal-flow` page and `/intake` before and after, and the owner rules on them at the hands-on gate. If the owner prefers a dashboard-only scope, the fallback is:
- a `data-surface="command-desk"` attribute on `<html>`, set by the dashboard layout;
- the tokens selected with `:root:has([data-surface="command-desk"])` / `.dark:has(…)`, which portals inherit.

The owner ruled for `:root` (V3). The fallback stays documented in case the hands-on gate reverses it.

### A6. Architecture: where each change lands

1. **`globals.css`.**
   - Rewrite the app `:root` and `.dark` blocks to §A4, add the brand primitives, status tones and series tokens, and extend `@theme inline` with the new `--color-*`. No `--text-*` step is added (§A4.6).
   - Delete the ad-hoc `--shadow-x/-y/-blur/-spread/-opacity/-color` knobs; nothing outside their own blocks reads them (grep verified 2026-09-29).
   - Leave the `.theme-marketing` block alone.
2. **Dashboard shell** (`src/app/(frontend)/dashboard/layout.tsx`): remove the inline radial-gradient `style` on `SidebarInset`. The background is `bg-background`.
3. **Sidebar** (`features/agent-dashboard/constants/sidebar-styles.ts`, `ui/components/app-sidebar.tsx`, `sidebar-pipeline-item.tsx`, `sidebar-records-group.tsx`, `sidebar-search-bar.tsx`, `sidebar-user-button.tsx`):
   - The sidebar becomes `<Sidebar variant="floating">`. The variant already exists in `src/shared/components/ui/sidebar.tsx`, and uses `data-variant` for the inset and `rounded-lg border shadow-sm`. Its radius is raised to 18px, its shadow to `--shadow-lg`, and its border reads `--sidebar-border`.
     - Check the collapsed (icon) state, the mobile sheet, and that `SidebarInset` does not double the inset.
     - The layout's `has-data-[variant=inset]` background rule does not apply to `floating`, so the page behind the panel is `bg-background`.
   - `SIDEBAR_NAV_ACTIVE_STYLE` and `SIDEBAR_NAV_ITEM_CLASS` stop mixing `--primary`. The active state becomes `bg-sidebar-accent text-sidebar-accent-foreground`, with the icon in `text-sidebar-primary`; hover becomes `bg-sidebar-hover`.
   - The logo swaps to `logo-dark-right.svg` in both modes, because the rail is navy in both. The user avatar in the rail footer uses the pill colors, never navy on navy. The collapsed mark uses `logo-dark.svg`.
   - The search bar and pipeline sub-items read the sidebar tokens.
   - The dark-mode "pinned group" slab (critique: "reads as a hole") becomes a `bg-sidebar-hover` inset group.
4. **Status and stage color, fixed once at the root.** Today the color is decided in about 15 map constants and consumed in 88 files.
   - One module, `src/shared/constants/status-tones.ts`, owns:
     - the `StatusTone` union;
     - `STAGE_COLOR_TONE`, the existing stage `color` key → tone;
     - `toneClasses(tone)` → `{ text, fill, dot, border }` Tailwind class strings built from the status utilities. They are string literals, so Tailwind's scanner sees them.
   - Every map below is rewritten to return tones or `toneClasses` output, and its consumers keep their call shape:
     - `kanban/constants/color-maps.ts`;
     - `proposals/core/constants/proposal-status-colors.ts`, `proposal-row-styles.ts`, `multiplier-styles.ts`;
     - `meetings/constants/status-colors.ts`, `meetings/lib/meeting-row-class.ts`;
     - `contract-status-panel/lib/get-status-badge.ts`, `constants/contract-statuses.ts`, `constants/action-impacts.ts`;
     - `agent-dashboard/constants/tier-color-map.ts`;
     - `campaigns-admin/constants/lead-status.ts`;
     - `schedule-management/constants/schedule-calendar-config.ts`;
     - `activities/constants/index.ts`;
     - `customers/components/customer-pipeline-badge.tsx`.
   - Pipeline stage constants keep their `color` field (V4, ruled in §A10); unknown keys, e.g. action tiers' `muted`, fall back to `idle`.
5. **Identity colors** (`entities/users/lib/get-user-color.ts`: today ten raw hues, pastel in light and saturated in dark). An eight-hue identity palette, `--identity-<1..8>-{bg,fg,ring}`, keeps one person the same hue in both modes: hues 25, 70, 115, 155, 200, 245, 290, 335; light bg `oklch(0.93 0.045 H)`, fg `oklch(0.43 0.11 H)`; dark bg `oklch(0.33 0.06 H)`, fg `oklch(0.88 0.07 H)`; ring `oklch(0.66 0.13 H)` in both. `theme:check` proves each fg on its bg ≥ 4.5:1. Because the hash now runs modulo 8, some reps' hues change once.
6. **Remaining raw palette uses.** These are the long tail of the 88-file list, e.g. `section-financials-summary.tsx`, `customer-kanban-card.tsx`, `envelope-signer-grid.tsx`, `sync-status-badge.tsx`, `integrations-section.tsx`, `danger-zone.tsx`, and the calculators' readouts. Each moves to a semantic token by **meaning**:
   - money up/down → `success`/`danger` fg;
   - warnings → `pending`;
   - destructive UI → `destructive`.
   - Decorative uses with no meaning become neutral tokens.
   - `bg-white`/`bg-black` (not palette steps, so the §A6.9 guard does not catch them) in `shared/components/dialogs/modals/base-modal.tsx`, `shared/components/optimized-image.tsx` and `features/agent-settings/ui/components/headshot-upload.tsx` become `bg-card`/`bg-foreground`, unless they sit over a photo, where black scrims are correct; keep those and add a one-line why-comment.
   - The `dark:` overrides whose only job was patching a palette class disappear with it.
7. **Charts:**
   - `chart-series.ts` drops `SERIES_COLOR_VARS` (the hex arbitrary properties) and reads `var(--series-*)` from globals.
   - `ui/chart.tsx` keeps its hex: they are recharts attribute selectors (`[stroke='#ccc']`, `[stroke='#fff']`) matching recharts' own defaults, not colors the app sets.
   - `--chart-1..5` are declared in `:root`/`.dark`, so `bill-colors.ts` reads `var(--chart-*)` directly and no longer needs palette classes to make Tailwind emit variables.
   - `charts/chart-tooltip-rows.tsx` (13px → `text-sm`) and `legend-swatches.tsx` (12.5px → `text-xs`) go on the ramp.
8. **Font sizes:** replace every literal size under the guarded paths (§A6.9) per §A4.6. The build regenerates the list with `grep -rnE 'text-\[[0-9.]+(px|rem)\]' src`; marketing paths on the ignore list (landing, funnels) keep theirs. The top files are `customer-kanban-card.tsx`, `cost-of-waiting-chart.tsx`, `return-breakdown.tsx`, `schedule-controls-bar.tsx`, `number-range-filter-control.tsx` and `coming-soon-state.tsx`.
9. **Guards, so the rules live in code, not in a doc.** Add two `no-restricted-syntax` entries in `eslint.config.js`, following the file's existing aliasing pattern, for files under `src/features/**` and `src/shared/**`:
   - a `Literal`/`TemplateElement` value matching `/\b(bg|text|border|ring|fill|stroke|outline|divide|from|to|via)-(slate|gray|zinc|neutral|stone|blue|sky|indigo|cyan|teal|red|rose|pink|green|emerald|lime|amber|yellow|orange|purple|violet|fuchsia)-\d{2,3}\b/`, with the message "Use a theme token (status-*, chart-*, identity-*)";
   - `/\btext-\[\d/`, with the message "Use the type ramp (2px rule: Tailwind steps only)".

   Marketing paths that legitimately use the palette get an explicit `ignores` entry, listed in the task. This touches the shared ESLint config, which this spec authorizes.
10. **PWA and meta:**
    - `app/manifest.ts` `background_color` changes `#09090b` → `#040f23` (dark `--background`).
    - The inline standalone style in `src/app/(frontend)/layout.tsx` and the splash screen (`src/shared/components/splash-screen/splash-screen.tsx`) use the same hex, with the layout comment updated.
    - `theme_color` / `themeColor` stay `#03AFED`. That is the logo, and the browser chrome tint is the one place the raw logo color belongs.
11. **Docs** (the code is the source of truth; these are updated to match it, not added):
    - root `DESIGN.md` "Command Desk" sections: colors, the Stage-Color Rule with tones, Elevation, Sidebar, and the removal of the "Cobalt Command" name;
    - `docs/design-system/tokens.md` app-token tables.

    Nothing else is written.

### A7. Data access

**None.** This is CSS tokens and UI class maps only. No DAL, tRPC, schema, seed or service change. Stage `color` keys are TypeScript constants, not database values; the build verifies this with a grep of `src/shared/db/schema/` for `color` before relying on it.

### A8. Edge cases

- **Stale CSS on the long-running dev server.** Stop it, `rm -rf .next`, and restart before judging any rendered color (memory `project-tailwind-content-detection-gap`). Check `ss -ltnp` first so the dev server of another worktree is not killed.
- **Portals:** dialogs, sheets, popovers and toasts must render with the new tokens in both modes. Open one of each in verification.
- **Sonner** (`toaster-provider.tsx`) reads `useTheme`. Its rich colors must be checked against the new status tones.
- **Recharts tooltips** keep `usePinnedChartTooltip` (memory `reference-chart-touch-tooltips`); only colors change.
- **Meeting-flow and presentation surfaces** read `:root` too. They are captured in verification but are not redesigned here.
- **Dark primary is light.** `bg-primary` pairs with `text-primary-foreground`, which is navy in dark. Any place that hardcodes `text-white` on `bg-primary` must switch to `text-primary-foreground`, so grep `bg-primary` next to `text-white`.
- **Glass over navy:** in dark mode the popover glass is 62% navy. Confirm the Filters popover over the kanban stays legible.
- **The pinned "FRESH" badge in the sidebar** (`sidebar-pipeline-item.tsx:89`, inline `color-mix` styles on `--primary`) moves to the rail tokens: `text-sidebar-accent` (cyan) at rest on the navy rail, `text-sidebar-primary` (navy) when it sits on the active cyan pill. `--sidebar-primary` alone would be navy on navy.

### A9. Verification

1. `pnpm tsc` and `pnpm lint`, both clean, including the new guards with zero violations under `src/features` and `src/shared` outside the ignore list. Never `pnpm build`.
2. **Contrast guard as a script, not prose:**
   - `scripts/check-theme-contrast.ts` parses the `:root` and `.dark` blocks from `globals.css`, with oklch→sRGB done the same way as the studies page, and asserts the pair table from the studies page:
     - body text, muted text, link and button label: 4.5:1;
     - primary vs page, control border vs card and focus ring: 3:1;
     - the sidebar label and active nav label;
     - the 7 status tones;
     - the 4 series vs card: 3:1.
   - It also enforces the **2px rule**: every `--text-*` token in `globals.css` whose value is a plain length (px or rem, not a `clamp()`) must resolve to an even pixel size at a 16px root.
   - It exits non-zero on a failure, and runs via `pnpm theme:check`. It is added to `package.json` scripts, which this spec authorizes.
3. **Playwright capture** after clearing `.next`:
   - Auth: `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>`.
   - Theme: set by localStorage `theme` and `emulateMedia`.
   - Viewports: 1440×900, iPad portrait 820×1180 and phone 390×844. Modes: light and dark.
   - Pages: `/dashboard`, `/dashboard/pipeline/fresh`, `/dashboard/meetings`, `/dashboard/proposals`, `/dashboard/schedule`, `/dashboard/analytics`, `/dashboard/calculators`, `/dashboard/settings`, plus one open popover, dialog, sheet and toast.
   - Also capture `/`, one `/proposal-flow` page and `/intake` (the §A5 scope check).
   - Save to `.playwright-mcp/theme-<page>-<vp>-<mode>.png`.
4. Re-run the **impeccable detector** on the dashboard feature trees. The browser color audit must show zero off-token palette colors on the five pages Assessment B audited.
5. `/impeccable polish` on the dashboard: one batched round and at most one confirmation round.
6. **Hands-on gate:** the owner checks on the iPad in daylight, in light and dark.

### A10. Owner rulings (spec gate, round 3)

- **V1 — Rail colors:** A3 · Harbor. It is folded into §A4.
- **V2 — Shape:** the iPad/desktop sidebar floats (A2). The phone dock is the A3 split, corrected: the round button sits bottom-left and opens the menu (Part B).
- **V3 — Scope:** change `:root` (§A5).
- **V4 — Stage field:** keep `color` and map it to tones (§A6.4).
- **V5 — Type ramp (spec approval):** the 2px rule. Tailwind's default steps only, `text-meta` dropped, literals round to the nearest step with ties rounding up (§A4.6).

### A11. Files

- **Modify:**
  - `src/shared/components/ui/sidebar.tsx` (floating radius and shadow only, if the variant's defaults are not token-driven)
  - `src/app/(frontend)/globals.css`
  - `src/app/(frontend)/dashboard/layout.tsx`
  - `src/app/(frontend)/layout.tsx` (PWA hex)
  - `src/app/manifest.ts`, `src/shared/components/splash-screen/splash-screen.tsx` (PWA hex)
  - the form-control primitives in `src/shared/components/ui/` (`input`, `textarea`, `input-group`, `input-otp`, `multi-select`, `checkbox`, `tabs`, `switch`, `button`): `dark:bg-input/30` → `bg-input-background`, because `--input` is now the 3:1 control border
  - `eslint.config.js`
  - `package.json` (the `theme:check` script)
  - the sidebar files in §A6.3
  - the maps in §A6.4
  - `get-user-color.ts`
  - `chart-series.ts`, `trend-chart.tsx`, `bill-colors.ts`, `chart-tooltip-rows.tsx`, `legend-swatches.tsx`
  - the long-tail files in §A6.6 (the full list is regenerated at build time with the §A6.9 regex, 88 files today)
  - the literal font sizes under the guarded paths (§A6.8)
  - `DESIGN.md`, `docs/design-system/tokens.md`
- **Create:** `src/shared/constants/status-tones.ts`, `scripts/check-theme-contrast.ts`
- **Delete:** nothing. Maps are rewritten in place, so their importers are untouched.
- **Off limits:** `src/shared/db/**`, `src/trpc/**`, `**/dal/**`, `**/server/**`, entity services, seeds, and the `.theme-marketing` block in `globals.css`.

### A12. Out of scope and follow-ups

- Layout changes of any dashboard page. The studies copied today's layout on purpose.
- Marketing site, funnels and the `.theme-marketing` palette. The marketing oklch conversion stays deferred (tokens.md §13).
- Meeting-flow presentation redesign (it only re-skins via `:root`).
- The odd-pixel minimums of the `--text-presentation-*` clamps (`label` 13px, `body` 17px). The owner's one-screen-per-slide rule makes any size change there a presentation decision, so it goes to the follow-ups doc.
- The detector's non-color findings (nested cards on the kanban, the `side-tab` border in `story-challenge.tsx:50` and `story-solution.tsx:76`, `border-t-2` on rounded kanban columns). They go to a follow-ups doc, `docs/plans/2026-09-29-dashboard-theme-follow-ups.md`, written at close-out.

---

## Part B — Floating mobile navbar (brief for a new session)

> **You are a fresh session.** Read this whole part, then Part A §A2, §A4.2 (sidebar rows) and §A10, then open the studies page (link at the top) and drive the phone frames:
> - **A:** labels;
> - **A2 / A5:** expanding active tab;
> - **A3:** split with an Action Center button;
> - **A4:** labels on a blueprint grid.
>
> **The chosen design is the ★ study "Harbor, floating"** at the top of the page. Tap its round bottom-left button to open the menu sheet. Then follow `docs/how-to/ui-exploration.md` from **Phase 5** (plan) for this surface only: the direction, style and spec are all decided here (§B3). Ask the owner only about things this brief does not settle, one question at a time, recommended option first.
>
> **Precondition:** Part A's tokens are merged (`--sidebar*` in globals.css match §A4.2). If they are not, stop and report BLOCKED. The dock must read the rail tokens, never its own colors.

### B1. Goal

On a phone in the field, the agent reaches the four places they use most in one thumb tap, reaches everything else in two, and the bar looks like part of the brand: a navy floating capsule, the same material as the iPad rail.

### B2. What exists today (verify before building)

- `src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx`:
  - a `fixed bottom-4 left-4 right-4 md:hidden` capsule, `bg-background/80 backdrop-blur-md`;
  - two ghost icon buttons: **Menu**, which opens the shadcn sidebar sheet via `useSidebar().setOpenMobile(true)`, and **Action Center** (the bolt).
- `dashboard-mobile-nav.tsx` owns the Action Center sheet state and renders `MobileBottomNav` + `ActionCenterSheet`.
- `dashboard-session-mobile-nav.tsx` gates it on a session and is mounted in `src/app/(frontend)/dashboard/layout.tsx` inside `SidebarInset`, under `Suspense`.
- The nav **single source** is `getSidebarNav(ability)` in `src/features/agent-dashboard/lib/get-sidebar-nav.ts`. It returns `dashboardItem`, `mainItems` (Pipeline with pipeline children, Schedule, Calculators), `recordsItems` (Customers, Meetings, Proposals, Projects), `adminItems` (admins only) and `footerItems` (Settings), each with `enabled` from CASL.
- `app-sidebar.tsx` has `getIsActive(item)`, with the rules for the dashboard root and for the pipeline prefix. It is duplicated logic the dock must not re-invent; extract it (§B4).

### B3. Design (what the owner liked, made concrete)

- **Layout (owner-ruled, round 3):** there are two floating pieces on one baseline, `bottom: calc(16px + env(safe-area-inset-bottom))`.
  - **Menu button, bottom-left.**
    - A 58px circle at `left: 12px`, `bg-primary text-primary-foreground`, with the `--shadow-lg` ramp.
    - The icon is `MenuIcon`, with `aria-label="Open menu"` and `aria-expanded` bound to the sheet.
    - It opens the menu sheet. It replaces today's ghost Menu button.
  - **Tab capsule, to its right.** `left: 82px; right: 12px`, height 58px, radius 18px.
    - Fill: `bg-sidebar` (Harbor navy in both modes), a 1px `--sidebar-border`, and the `--shadow-lg` ramp.
    - No `backdrop-blur`: the navy is opaque, so glass buys nothing here and costs frames.
- **Tabs in the capsule (one tap):** Dashboard ("Home" on the phone), Pipeline, Schedule, Meetings. They come from `getSidebarNav`, not hardcoded:
  - `dashboardItem`;
  - `mainItems` Pipeline and Schedule;
  - `recordsItems` Meetings.

  A disabled item (CASL) is omitted, not greyed; if fewer than four remain, the capsule shows what remains. The studies page used Proposals and Analytics as stand-ins because the mock has no Schedule or Meetings screen. There is **no More tab**; the round button is the menu.
- **Action Center:** the bolt is the last item inside the capsule, at the right end: a 42px icon button, `aria-label="Action Center"`. It keeps today's `onActionCenterClick` seam.
- **Menu sheet** (two taps to everything else): a **glass bottom sheet** listing every `getSidebarNav` group under its heading (Main, Records, Admin, then Settings and the user row).
  - It uses `--popover-glass` + `--popover-glass-shadow`, a grab handle, radius 22px and 10px side insets.
  - It closes on backdrop tap, Escape, swipe down, and item tap.
  - Build it by restyling the existing mobile sidebar sheet (the shadcn `Sheet` that `setOpenMobile(true)` opens today) as a bottom sheet, rather than writing a second nav list. **One nav list, two presentations.**
- **Tab states:**
  - rest: `text-sidebar-muted`;
  - active: the solid cyan `bg-sidebar-accent` pill with `text-sidebar-accent-foreground` (navy), and the icon in `text-sidebar-primary` (navy);
  - pressed: scale 0.96, 120ms;
  - focus: `ring-sidebar-ring`, 2px offset.

  Targets are ≥44×44px. Labels are `text-xs` (12px floor), Nunito 700, icon above label.
- **Motion:** the active pill moves between tabs with a shared `layoutId` (`motion/react`; confirm the current API via context7). The sheet rises with a spring. `prefers-reduced-motion` makes both instant.
- **Pipeline tab:** navigates to the stored pipeline (`getStoredPipeline()`, same as the sidebar). Its active rule is the `/dashboard/pipeline` prefix.
- **Content clearance:** the page content needs `padding-bottom: calc(58px + 32px + env(safe-area-inset-bottom))` on mobile (58px dock + 16px offset + 16px air), so the last row is never under the dock. Put it once in the dashboard content wrapper, not per page (root cause, not per instance).
- **Keyboard:** when a text input is focused on iOS, the dock hides via the `visualViewport` resize, so it does not ride above the keyboard.

### B4. Architecture

- Extract `getIsActive(item, pathname)` from `app-sidebar.tsx` into `src/features/agent-dashboard/lib/get-nav-item-active.ts`. Both the sidebar and the dock import it.
- Add `getMobileDockNav(config: SidebarNavConfig)` in `src/features/agent-dashboard/lib/` → `{ tabs, overflowGroups }`. It is a pure function over the existing config, with no new nav source.
- Rebuild `mobile-bottom-nav.tsx` into feature-local components, one per file:
  - `mobile-dock.tsx` (positions the two pieces),
  - `mobile-dock-menu-button.tsx` (bottom-left circle),
  - `mobile-dock-capsule.tsx` (tabs + Action Center),
  - `mobile-dock-tab.tsx`,
  - `mobile-dock-menu-sheet.tsx`.

  Dock constants (heights, offsets) go in `constants/mobile-dock.ts`. `dashboard-mobile-nav.tsx` keeps owning the Action Center state.
- `MobileBottomNav` currently takes `onActionCenterClick`. Keep that seam. The dock needs `user` for abilities, so pass the session user down from `DashboardSessionMobileNav`, which already reads the session. Do not add a new session read.
- The component is feature-local (`features/agent-dashboard`). Promote nothing to `shared/` until a second consumer exists.

### B5. Data access

None. Abilities come from the session user already in hand.

### B6. Verification

- `pnpm tsc` and `pnpm lint`.
- Playwright at 390×844 and 430×932, light and dark, with `.next` cleared first:
  - each tab navigates and shows its active state;
  - the bottom-left button opens the sheet with every enabled item, and the sheet closes on backdrop, Escape and item tap;
  - the menu button and capsule sit on one baseline and never overlap at 360px wide;
  - Action Center opens;
  - the last content row clears the dock (measure bounding boxes, not just screenshots);
  - the dock hides on input focus;
  - the `dispatcher` role (`&role=dispatcher`) shows the reduced tab set.
- Contrast: the dock pairs are already covered by Part A's `theme:check`, via the sidebar tokens.
- Hands-on gate: the owner uses it one-handed on their phone.

### B7. Out of scope

iPad/desktop sidebar behavior (Part A re-skins it), new pages, badges or counts on tabs, and swipe gestures.

---

## Appendix 1 — Variant deltas (reference; Harbor is already folded into §A4)

Only differences from A are listed. Values are `oklch(L C H [/ alpha])`.

- **A2 Floating Rail:** A's colors. Structure: shadcn `<Sidebar variant="floating">` (the variant already exists in `ui/sidebar.tsx`), rail radius 18px with an inset of 10px, and `--sidebar-border` light `0.30 0.06 258` / dark `0.28 0.045 258`. Dock style: expanding.
- **A3 Harbor:**
  - Light: `--background 0.965 0.009 246`, `--sidebar 0.215 0.072 262`, `--sidebar-muted 0.74 0.05 250`.
  - Dark: `--background 0.17 0.045 260`, `--card 0.21 0.05 260`, `--surface-raised 0.245 0.055 260`, `--sidebar 0.13 0.05 262`, `--sidebar-border 0.22 0.05 262`.
  - Active pill in both modes: `--sidebar-accent 0.80 0.12 228` (solid cyan), `--sidebar-accent-foreground` light `0.20 0.07 262` / dark `0.18 0.06 262`, and `--sidebar-primary` equal to the accent-foreground (a navy icon on the cyan pill).
  - Dock style: split.
- **A4 Blueprint Rail:** A's colors, plus `--sidebar-border` as a cyan hairline (light `0.80 0.12 228 / 0.45`, dark `/ 0.28`) and a new `--rail-grid` (light `0.80 0.12 228 / 0.07`, dark `/ 0.05`). It is drawn as a 22px grid via `background-image` on the rail and dock only. This amends DESIGN.md's "grids are marketing-only" rule for the rail. Dock style: labels.
- **A5 Slate Rail:**
  - Light: `--sidebar 0.255 0.032 256`, `--primary 0.52 0.14 240`.
  - Dark: `--background 0.185 0.022 256`, `--card 0.225 0.026 256`, `--surface-raised 0.26 0.03 256`, `--input-background 0.20 0.024 256`, `--border 0.31 0.028 256`, `--sidebar 0.155 0.022 258`, `--sidebar-border 0.25 0.028 256`.
  - Dock style: expanding.
