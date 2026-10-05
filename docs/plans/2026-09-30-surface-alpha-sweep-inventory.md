# Surface alpha sweep — inventory

Date: 2026-09-30 · read-only inventory for the lightness-ramp sweep (canvas / muted / band / card / raised / border / border-strong / row-hover). Nothing under `src/` was edited.

Scan: `src/**/*.{tsx,ts,css}`, opacity modifiers (`/NN`, `/[0.NN]`) on surface tokens `background card popover secondary muted accent border input sidebar* foreground` with utilities `bg border(-side) divide ring stroke from via to`. `text-*` and `decoration-*` are excluded (not surfaces). Line numbers are as of this scan; a line with two classes appears twice.

Markers: `DIRTY` = file has uncommitted changes in the shared tree right now (other sessions; do not sweep without coordinating). `SIX` = one of the six files `docs/plans/2026-09-29-dashboard-theme-follow-ups.md` says carry uncommitted theme edits.

> ⚠️ Stale ref — `docs/plans/2026-09-29-dashboard-theme-follow-ups.md` (line "Six files carry theme edits that are NOT committed…") says those six files are uncommitted, but commit `6065c2ab` ("fix(theme): commit the type-ramp swaps left pending in six files") committed all six and none is dirty now. The follow-up line can be deleted.

Files dirty in the tree now that hold in-scope hits: `shared/components/data-table/ui/data-table.tsx`, `shared/components/pwa-install-prompt.tsx`, `shared/components/ui/drawer.tsx`, `shared/components/ui/sidebar-mobile-drawer.tsx`. Other dirty files (`ui/sidebar.tsx`, `app-sidebar.tsx`, mobile dock files, etc.) have no alpha-surface hits.

## 1. Totals

**488 surface-alpha usages** across 206 files.

| Class family | Count |
|---|---:|
| `border-border/NN` | 116 |
| `bg-muted/NN` | 110 |
| `bg-background/NN` | 64 |
| `bg-foreground/NN` | 58 |
| `border-foreground/NN` | 37 |
| `gradient-background/NN` | 22 |
| `bg-card/NN` | 16 |
| `bg-accent/NN` | 16 |
| `bg-secondary/NN` | 15 |
| `gradient-secondary/NN` | 6 |
| `border-secondary/NN` | 4 |
| `divide-border/NN` | 3 |
| `gradient-card/NN` | 3 |
| `bg-border/NN` | 3 |
| `gradient-foreground/NN` | 3 |
| `border-background/NN` | 2 |
| `ring-foreground/NN` | 1 |
| `ring-background/NN` | 1 |
| `border-sidebar-primary/NN` | 1 |
| `border-sidebar-accent/NN` | 1 |
| `divide-foreground/NN` | 1 |
| `bg-popover/NN` | 1 |
| `bg-sidebar/NN` | 1 |
| `bg-sidebar-muted/NN` | 1 |
| `stroke-border/NN` | 1 |
| `ring-border/NN` | 1 |

By area: app 197 · public-site 183 · meeting-flow 51 · proposal-flow 41 · funnel/test 16. "public-site" = `(site)` pages and the public portfolio/story components; they read the same `:root`/`.dark` tokens as the app, so the ramp reaches them unless scoped out (see ambiguous A1).

Proposed targets: **border** 136 · **keep (translucent by design)** 120 · **muted** 119 · **n/a (not a surface)** 26 · **row-hover** 24 · **border-strong** 15 · **card** 15 · **raised** 8 · **band** 7 · **keep or muted** 6 · **canvas** 3 · **card (drop gradient)** 2 · **border / muted** 2 · **border-strong (skeleton tone)** 2 · **border (skeleton block tone)** 2 · **keep or sidebar-border (sidebar palette is outside the ramp)** 1.

## 2. Summary mapping (class → count → proposed target)

Where one class splits across targets, each split is its own row.

| Class | Count | Proposed target | Roles seen |
|---|---:|---|---|
| `bg-muted/30` | 34 | muted | well / inset, hover, skeleton |
| `border-border/50` | 33 | border | border / divider, popover border (glass menu), table frame border |
| `border-border/40` | 31 | border | border / divider, hero border, skeleton frame border |
| `border-border/60` | 29 | border | border / divider, gap-px grid lines |
| `bg-muted/40` | 15 | muted | well / inset, hover, skeleton |
| `border-border/30` | 15 | border | border / divider |
| `bg-muted/50` | 14 | muted | hover, well / inset, table footer strip |
| `bg-accent/50` | 11 | muted | hover, inset well (variant), open trigger |
| `bg-muted/20` | 11 | muted | section band, well / inset, selected / open state |
| `bg-muted/50` | 11 | row-hover | hover, hover/focus (row) |
| `border-foreground/10` | 11 | border | border / divider, gap-px grid lines |
| `bg-background/50` | 10 | keep (translucent by design) | modal backdrop scrim, overlay/scrim over media, glass control over media |
| `bg-muted/60` | 9 | muted | hover, well / inset, progress track |
| `bg-background/80` | 8 | keep (translucent by design) | glass control over media, overlay/scrim over media, caption bar over lightbox |
| `bg-foreground/10` | 8 | keep (translucent by design) | glass chip over hero, tile on dark band (glass), hover on lightbox control |
| `bg-foreground/5` | 8 | keep (translucent by design) | glass chip over hero |
| `bg-background/60` | 7 | keep (translucent by design) | overlay/scrim over media, chip/label over media, loading veil over editor |
| `border-foreground/20` | 6 | keep (translucent by design) | glass chip over hero |
| `bg-background/20` | 5 | keep (translucent by design) | hover on navbar icon over hero, overlay/scrim over media |
| `bg-card/50` | 5 | card | card surface |
| `bg-foreground/20` | 5 | keep (translucent by design) | tile on dark band (glass), chip/label over media |
| `bg-muted/60` | 5 | row-hover | hover, hover/focus (row) |
| `bg-background/60` | 4 | card | card on muted section, unselected chip, hover-reveal chip |
| `bg-background/70` | 4 | keep (translucent by design) | glass control over media, chip/label over media, full-screen mobile nav (glass) |
| `bg-foreground/40` | 4 | keep or muted | nav tab hover/active, nav trigger hover/open |
| `bg-foreground/5` | 4 | muted | hover, hover on split-button segment, outline button hover |
| `border-foreground/20` | 4 | border-strong | border (emphasis), hover border |
| `from-background/70` | 4 | keep (translucent by design) | photo gradient |
| `bg-background/30` | 3 | keep (translucent by design) | overlay/scrim over media |
| `bg-background/40` | 3 | keep (translucent by design) | overlay/scrim over media, icon tile on status-tinted row |
| `bg-background/45` | 3 | keep (translucent by design) | overlay/scrim over media |
| `bg-foreground/10` | 3 | muted | done-step tab fill, hover on icon button (glass), hover |
| `bg-foreground/20` | 3 | muted | avatar fill, navbar ground |
| `bg-secondary/15` | 3 | n/a (not a surface) | icon tile tint, blurred colour blob |
| `bg-secondary/20` | 3 | n/a (not a surface) | icon tile tint, callout tint |
| `bg-secondary/70` | 3 | n/a (not a surface) | eyebrow rule in secondary colour |
| `bg-secondary/80` | 3 | band | secondary button hover, secondary badge hover, secondary chip hover |
| `divide-border/60` | 3 | border | border / divider |
| `via-background/10` | 3 | keep (translucent by design) | photo gradient |
| `via-foreground/30` | 3 | keep (translucent by design) | fading hairline on hero |
| `bg-accent/50` | 2 | row-hover | hover |
| `bg-background/40` | 2 | muted | inset well |
| `bg-background/80` | 2 | raised | floating capsule (glass), dropdown panel (glass) |
| `bg-background/90` | 2 | keep (translucent by design) | lightbox dialog ground, checkbox ground on thumbnail |
| `bg-border/40` | 2 | border | divider (1px fill) |
| `bg-card/40` | 2 | card | card surface |
| `bg-card/50` | 2 | keep or muted | pressed/open trigger on navbar |
| `bg-card/60` | 2 | card | glass card, card surface |
| `bg-card/80` | 2 | keep (translucent by design) | floating badge over photo (glass) |
| `bg-card/95` | 2 | keep (translucent by design) | floating badge over photo (glass) |
| `bg-foreground/10` | 2 | border | divider (1px fill), gap-px grid lines |
| `bg-foreground/20` | 2 | border-strong | separator dot, drag handle |
| `bg-foreground/[0.02]` | 2 | muted | well / tint |
| `bg-foreground/[0.05]` | 2 | muted | hover |
| `bg-muted/70` | 2 | row-hover | hover/focus (row), hover |
| `bg-muted/80` | 2 | band | filled chip hover |
| `border-border/60` | 2 | keep (translucent by design) | floating badge over photo (glass) |
| `border-border/70` | 2 | border | border / divider |
| `border-border/70` | 2 | border / muted | outline button border/hover |
| `border-foreground/10` | 2 | keep (translucent by design) | glass chip over hero, caption bar over lightbox |
| `border-foreground/15` | 2 | border | button border |
| `border-foreground/15` | 2 | keep (translucent by design) | glass chip over hero |
| `border-foreground/30` | 2 | border-strong | hover card border, border (emphasis) |
| `border-foreground/60` | 2 | border-strong | active-filter trigger border, active trigger border |
| `from-background/30` | 2 | keep (translucent by design) | photo gradient |
| `from-background/60` | 2 | keep (translucent by design) | photo gradient |
| `from-background/80` | 2 | keep (translucent by design) | photo gradient |
| `to-background/40` | 2 | keep (translucent by design) | photo gradient |
| `to-secondary/5` | 2 | n/a (not a surface) | hero card gradient, tile gradient |
| `via-background/30` | 2 | keep (translucent by design) | photo gradient |
| `bg-accent/30` | 1 | muted | inset well (variant) |
| `bg-accent/30` | 1 | row-hover | hover |
| `bg-accent/60` | 1 | muted | selected (current) option in menu |
| `bg-background/0` | 1 | keep (translucent by design) | overlay/scrim over media |
| `bg-background/10` | 1 | keep (translucent by design) | glass card on dark band |
| `bg-background/50` | 1 | muted | inset well |
| `bg-background/50` | 1 | row-hover | hover (draft row) |
| `bg-background/60` | 1 | muted | inset well |
| `bg-background/80` | 1 | canvas | sticky header (glass) |
| `bg-background/80` | 1 | card | grid tile (glass over gap-px) |
| `bg-background/85` | 1 | canvas | sticky header (glass) |
| `bg-background/95` | 1 | canvas | sticky site navbar (scrolled) |
| `bg-background/95` | 1 | keep (translucent by design) | lightbox backdrop over media |
| `bg-background/95` | 1 | raised | floating action bar (glass) |
| `bg-border/60` | 1 | border | gap-px grid lines |
| `bg-card/60` | 1 | muted | empty-state well |
| `bg-foreground/10` | 1 | border (skeleton block tone) | skeleton (block) |
| `bg-foreground/10` | 1 | border-strong (skeleton tone) | skeleton |
| `bg-foreground/10` | 1 | raised | selected segment |
| `bg-foreground/15` | 1 | border-strong (skeleton tone) | skeleton |
| `bg-foreground/2` | 1 | muted | banner well |
| `bg-foreground/3` | 1 | muted | hover |
| `bg-foreground/30` | 1 | n/a (not a surface) | progress fill (non-last) |
| `bg-foreground/40` | 1 | border-strong | loading shimmer bar |
| `bg-foreground/5` | 1 | raised | selected chip |
| `bg-foreground/5` | 1 | row-hover | hover |
| `bg-foreground/6` | 1 | border (skeleton block tone) | skeleton (block) |
| `bg-foreground/60` | 1 | keep (translucent by design) | chip/label over media |
| `bg-foreground/70` | 1 | keep (translucent by design) | scroll cue on hero |
| `bg-foreground/8` | 1 | muted | open trigger |
| `bg-foreground/[0.03]` | 1 | muted | tile hover |
| `bg-muted/20` | 1 | band | skeleton empty bucket |
| `bg-muted/20` | 1 | raised | expanded row panel |
| `bg-muted/40` | 1 | row-hover | hover |
| `bg-muted/50` | 1 | raised | expanded row |
| `bg-muted/60` | 1 | card | unselected chip |
| `bg-muted/60` | 1 | n/a (not a surface) | comment |
| `bg-muted/80` | 1 | keep (translucent by design) | chip/label over media |
| `bg-popover/95` | 1 | raised | floating prompt |
| `bg-secondary/10` | 1 | n/a (not a surface) | tag tint |
| `bg-secondary/90` | 1 | band | secondary badge hover |
| `bg-secondary/90` | 1 | n/a (not a surface) | secondary button hover |
| `bg-sidebar-muted/50` | 1 | keep or sidebar-border (sidebar palette is outside the ramp) | drag handle |
| `bg-sidebar/40` | 1 | keep (translucent by design) | modal backdrop scrim |
| `border-background/20` | 1 | keep (translucent by design) | glass card on dark band |
| `border-background/40` | 1 | keep (translucent by design) | glass chip over hero |
| `border-border/20` | 1 | border | border / divider |
| `border-border/60` | 1 | n/a (not a surface) | hero card gradient |
| `border-foreground/25` | 1 | border-strong | selected toggle border |
| `border-foreground/50` | 1 | border-strong | selected card border |
| `border-foreground/50` | 1 | keep (translucent by design) | scroll cue on hero |
| `border-foreground/70` | 1 | keep (translucent by design) | chip/label over media |
| `border-foreground/[0.06]` | 1 | border | border / divider |
| `border-foreground/[0.12]` | 1 | border-strong | hover border |
| `border-secondary/30` | 1 | n/a (not a surface) | callout tint |
| `border-secondary/40` | 1 | n/a (not a surface) | decorative frame border |
| `border-secondary/60` | 1 | n/a (not a surface) | accent border |
| `border-secondary/70` | 1 | n/a (not a surface) | corner bracket |
| `border-sidebar-accent/30` | 1 | n/a (not a surface) | badge border in sidebar |
| `border-sidebar-primary/30` | 1 | n/a (not a surface) | badge border in sidebar |
| `divide-foreground/10` | 1 | border | border / divider |
| `from-background/25` | 1 | keep (translucent by design) | photo gradient |
| `from-background/50` | 1 | keep (translucent by design) | photo gradient |
| `from-background/85` | 1 | keep (translucent by design) | photo gradient |
| `from-card/50` | 1 | keep (translucent by design) | overlay/scrim over media |
| `from-card/80` | 1 | card (drop gradient) | glass card gradient |
| `from-secondary/15` | 1 | n/a (not a surface) | tile gradient |
| `ring-background/10` | 1 | keep (translucent by design) | ring on media frame |
| `ring-border/60` | 1 | border | border / divider |
| `ring-foreground/20` | 1 | border-strong | selected card border |
| `stroke-border/50` | 1 | border | chart grid lines |
| `to-background/0` | 1 | keep (translucent by design) | photo gradient |
| `to-card/40` | 1 | card (drop gradient) | glass card gradient |
| `to-secondary/10` | 1 | n/a (not a surface) | tile gradient |
| `to-secondary/25` | 1 | n/a (not a surface) | tile gradient |
| `to-secondary/50` | 1 | n/a (not a surface) | decorative accent line |
| `via-background/0` | 1 | keep (translucent by design) | photo gradient |

Variant prefixes (`hover:`, `dark:`, `data-[state=open]:` …) are folded into the base class above; the per-file table keeps the full class.

## 3. Arbitrary values, inline styles and token-level translucency

| Where | What | Role | Proposed |
|---|---|---|---|
| `app/(frontend)/globals.css:50, :347` | `--sidebar-hover: oklch(1 0 0 / 0.06)` (light) / `0.05` (dark) | sidebar item hover/active, used by `bg-sidebar-hover` (sidebar.tsx, app-sidebar, dock, search bar, skeletons) | AMBIG: sidebar rail is its own navy palette, outside the ramp — solid `sidebar-hover` step or keep |
| `app/(frontend)/globals.css:113, :410` | `--popover-glass` (78% light, 62% dark) + overlay + shadow | glass popover/tooltip/chart tooltip via `GLASS_SURFACE_STYLE` (`ui/popover.tsx`, `ui/tooltip.tsx`, `charts/chart-tooltip-card.tsx`) | AMBIG: ramp says popovers = `raised`; glass is a deliberate spec decision — owner ruling |
| `shared/components/ui/dropdown-menu.tsx:48, :238` | inline `backgroundColor: oklch(from var(--popover) l c h / 0.8)` + `backdrop-blur-xl` | dropdown + sub-menu panel (glass) | same ruling as popover-glass; if solid → `raised` |
| `features/proposal-flow/ui/components/form/project-fields.tsx:107, funding-fields.tsx:198; features/project-management/ui/components/form/{homeowner,basic-info,story-content}-fields.tsx:14` | `bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]` | form section panel (card nudged 3% toward foreground) | `band` (solid already; replace the hand-mix with the named step) |
| `features/landing/ui/components/home/home-hero.tsx:47` | inline gradient `color-mix(var(--background) 80%/50%, transparent)` over `url(...)` | hero scrim over photo | keep (translucent by design) |
| `app/(frontend)/globals.css:220-222` | `color-mix(var(--background) 95/82/45%, transparent)` gradient stops | fade scrim (utility class) | keep (translucent by design) — verify consumer |
| `shared/components/states/coming-soon-state.tsx:90` | `oklch(from var(--card) l c h/0.06)` gradient stop + `backdrop-filter:blur(2px)` | decorative coming-soon panel | keep (decorative, primary-tinted); low priority |
| `features/meeting-flow/ui/components/shell/step-capsule.tsx:36` | `bg-(--presentation-ground)/70` (presentation tone) | floating step capsule over presentation | keep — presentation tokens are outside the app ramp |
| `features/meeting-flow/ui/components/steps/portfolio/project-list-card.tsx:20,23` | `bg-[oklch(var(--presentation-scrim)/0.6|0.85)]` | list card over presentation ground | keep — presentation scrim |

### Shadow alpha (counted separately)

| file:line | class | note |
|---|---|---|
| `features/meeting-flow/ui/components/steps/who-we-are/document-card.tsx:21` | `shadow-black/60` | black drop shadow on presentation |
| `features/meeting-flow/ui/components/steps/who-we-are/agent-card.tsx:22` | `shadow-black/60` | black drop shadow on presentation |
| `features/meeting-flow/ui/components/steps/who-we-are/document-stack.tsx:45` | `shadow-black/60` | black drop shadow on presentation |
| `features/agent-dashboard/ui/components/dashboard-module.tsx:22` | `shadow-primary/5` | primary-tinted glow (accent) |
| `shared/components/navigation/site-navbar.tsx:296` | `shadow-foreground/30` | foreground shadow |

Total 5 (`shadow-black/60` ×3 presentation, `shadow-primary/5` ×1, `shadow-foreground/30` ×1). Theme-level shadow tokens (`--shadow-card`, `--popover-glass-shadow`, `--shadow-2xs…`) use alpha by nature and are not part of this sweep. Arbitrary `shadow-[…rgb(0_0_0/0.45)]` / `[box-shadow:…oklch(0 0 0/.45)]` exist in `block-variants.ts:36-37` and `coming-soon-state.tsx:271`.

## 4. Not in scope — accent/status alpha (for the owner to see)

286 usages. `bg-primary/NN` alone: 62 (50 static tints, 9 hover, 3 data-state). The static `bg-primary/5–10` tints are the de-facto selected/active surface today — relevant when naming `row-hover` / a possible `row-selected`.

| Family | Count |
|---|---:|
| `bg-primary/NN` | 62 |
| `ring-ring/NN` | 36 |
| `border-status-*/NN` | 34 |
| `border-primary/NN` | 29 |
| `bg-destructive/NN` | 28 |
| `ring-destructive/NN` | 27 |
| `bg-status-*/NN` | 23 |
| `border-destructive/NN` | 11 |
| `from-primary/NN` | 8 |
| `ring-primary/NN` | 7 |
| `via-primary/NN` | 7 |
| `bg-warning/NN` | 6 |
| `border-warning/NN` | 3 |
| `bg-success/NN` | 3 |
| `shadow-primary/NN` | 1 |
| `ring-success/NN` | 1 |

`bg-primary/NN` breakdown: `bg-primary/5` 24, `bg-primary/10` 17, `bg-primary/8` 5, `bg-primary/20` 5, `bg-primary/15` 3, `bg-primary/40` 2, `bg-primary/90` 2, `bg-primary/80` 1, `bg-primary/50` 1, `bg-primary/70` 1, `bg-primary/14` 1. Existing hover tints on primary: `customer-kanban-card.tsx:105 hover:bg-primary/5`, `step-tabs.tsx:37 hover:bg-primary/15`, `story-solution.tsx:138 hover:bg-primary/10`, `navbar-menu.tsx:114 hover:bg-primary/20` (plus button/badge `hover:bg-primary/70–90` = filled-button hover, a different thing).

## 5. Raw `white`/`black` alpha (scrims, overlays, on-photo chrome)

91 usages: `border-white/NN` 27, `bg-white/NN` 27, `bg-black/NN` 13, `ring-white/NN` 9, `from-black/NN` 4, `via-black/NN` 3, `ring-black/NN` 2, `via-white/NN` 2, `divide-white/NN` 1, `from-white/NN` 1, `to-white/NN` 1, `to-black/NN` 1. All sit on photos, on the presentation ground (meeting-flow Who-we-are / Portfolio / Specialties), or on the customer profile hero (dark photo/gradient hero). **Proposed: keep all** (translucent by design; not surface tokens). Two to eyeball:

- `shared/entities/customers/components/profile/customer-profile-modal.tsx:105-113` — loading skeleton for the hero (`from-black/85…`, `bg-white/10`). Keep, it mirrors the hero it replaces.
- `features/agent-settings/ui/components/headshot-upload.tsx:88 bg-black/50` — upload veil over a headshot. Keep.

| file:line | class |
|---|---|
| `features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx:35` | `@4xl/specialties:from-black/55` |
| `features/meeting-flow/ui/components/steps/specialties/showcase-text.tsx:50` | `border-white/15` |
| `features/meeting-flow/ui/components/steps/specialties/project-proof-strip.tsx:36` | `border-white/50` |
| `features/meeting-flow/ui/components/steps/specialties/showcase-fallback.tsx:15` | `bg-white/[0.04]` |
| `features/meeting-flow/ui/components/steps/who-we-are/before-after-compare.tsx:60` | `bg-black/60` |
| `features/meeting-flow/ui/components/steps/who-we-are/before-after-compare.tsx:63` | `bg-white/90` |
| `features/meeting-flow/ui/components/steps/who-we-are/proof-rail.tsx:22` | `divide-white/10` |
| `features/meeting-flow/ui/components/steps/who-we-are/proof-rail.tsx:22` | `border-white/15` |
| `features/meeting-flow/ui/components/steps/who-we-are/comparison-table.tsx:27` | `border-white/20` |
| `features/meeting-flow/ui/components/steps/who-we-are/comparison-table.tsx:31` | `bg-white/[0.08]` |
| `features/meeting-flow/ui/components/steps/who-we-are/comparison-table.tsx:37` | `border-white/10` |
| `features/meeting-flow/ui/components/steps/who-we-are/comparison-table.tsx:41` | `bg-white/[0.08]` |
| `features/meeting-flow/ui/components/steps/who-we-are/document-card.tsx:24` | `ring-white/25` |
| `features/meeting-flow/ui/components/steps/who-we-are/reputation-mark.tsx:20` | `border-white/12` |
| `features/meeting-flow/ui/components/steps/who-we-are/reputation-mark.tsx:20` | `bg-white/[0.04]` |
| `features/meeting-flow/ui/components/steps/who-we-are/reputation-mark.tsx:20` | `hover:border-white/25` |
| `features/meeting-flow/ui/components/steps/who-we-are/reputation-mark.tsx:20` | `hover:bg-white/[0.08]` |
| `features/meeting-flow/ui/components/steps/who-we-are/reputation-mark.tsx:20` | `active:bg-white/[0.12]` |
| `features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot.tsx:13` | `border-white/30` |
| `features/meeting-flow/ui/components/steps/who-we-are/document-stack.tsx:47` | `ring-white/25` |
| `features/meeting-flow/ui/components/steps/who-we-are/document-dialog.tsx:45` | `*:data-[slot=dialog-close]:bg-black/60` |
| `features/meeting-flow/ui/components/steps/who-we-are/document-dialog.tsx:52` | `bg-black/60` |
| `features/meeting-flow/ui/components/steps/portfolio/project-list-sheet.tsx:23` | `border-white/35` |
| `features/meeting-flow/ui/components/steps/portfolio/project-list-sheet.tsx:28` | `border-white/10` |
| `features/meeting-flow/ui/components/steps/portfolio/index.tsx:46` | `bg-white/10` |
| `features/meeting-flow/ui/components/steps/portfolio/index.tsx:51` | `bg-white/10` |
| `features/meeting-flow/ui/components/steps/portfolio/index.tsx:61` | `border-white/15` |
| `features/meeting-flow/ui/components/steps/portfolio/index.tsx:62` | `border-white/35` |
| `features/meeting-flow/ui/components/steps/portfolio/index.tsx:62` | `hover:bg-white/10` |
| `features/meeting-flow/ui/components/steps/portfolio/index.tsx:81` | `border-white/20` |
| `features/meeting-flow/ui/components/steps/portfolio/project-list-card.tsx:20` | `border-white/12` |
| `features/meeting-flow/ui/components/steps/portfolio/project-list-card.tsx:41` | `bg-white/15` |
| `features/meeting-flow/ui/components/steps/portfolio/space-cue.tsx:12` | `border-white/40` |
| `features/meeting-flow/ui/components/steps/portfolio/story-phase-photos.tsx:30` | `border-white/30` |
| `features/meeting-flow/ui/components/steps/portfolio/story-phase-bar.tsx:15` | `bg-white/10` |
| `features/meeting-flow/ui/components/steps/portfolio/story-phase-bar.tsx:29` | `bg-white/12` |
| `features/meeting-flow/ui/components/steps/portfolio/story-phase-bar.tsx:31` | `ring-white/50` |
| `features/meeting-flow/ui/components/shell/step-capsule.tsx:36` | `border-white/15` |
| `features/agent-settings/ui/components/headshot-upload.tsx:88` | `bg-black/50` |
| `features/landing/ui/components/about/about-hero.tsx:138` | `ring-black/5` |
| `features/landing/ui/components/about/about-hero.tsx:138` | `dark:ring-white/10` |
| `features/landing/ui/components/about/partner-story.tsx:39` | `ring-black/5` |
| `features/landing/ui/components/about/partner-story.tsx:39` | `dark:ring-white/10` |
| `features/project-management/ui/components/portfolio-hero.tsx:124` | `ring-white/10` |
| `shared/components/optimized-image.tsx:127` | `bg-black/50` |
| `shared/components/presentation/heading-column.tsx:36` | `@max-[56rem]/presentation:border-white/15` |
| `shared/components/dialogs/modals/base-modal.tsx:65` | `has-data-modal-hero:**:data-modal-close:border-white/15` |
| `shared/components/dialogs/modals/base-modal.tsx:66` | `has-data-modal-hero:**:data-modal-close:bg-black/40` |
| `shared/components/dialogs/modals/base-modal.tsx:69` | `has-data-modal-hero:**:data-modal-close:hover:bg-black/60` |
| `shared/domains/funnels/ui/funnel-cta.tsx:58` | `via-white/20` |
| `shared/domains/funnels/ui/funnel-hero-entry.tsx:35` | `ring-white/10` |
| `shared/domains/funnels/ui/funnel-hero-entry.tsx:49` | `border-white/15` |
| `shared/domains/funnels/ui/funnel-hero-entry.tsx:49` | `hover:border-white/40` |
| `shared/domains/funnels/ui/funnel-hero-entry.tsx:59` | `hover:bg-white/90` |
| `shared/domains/funnels/ui/steps/address-preview.tsx:30` | `bg-black/55` |
| `shared/entities/customers/components/profile/customer-profile-modal.tsx:105` | `from-black/85` |
| `shared/entities/customers/components/profile/customer-profile-modal.tsx:105` | `via-black/75` |
| `shared/entities/customers/components/profile/customer-profile-modal.tsx:107` | `bg-white/10` |
| `shared/entities/customers/components/profile/customer-profile-modal.tsx:108` | `bg-white/10` |
| `shared/entities/customers/components/profile/customer-profile-modal.tsx:110` | `bg-white/10` |
| `shared/entities/customers/components/profile/customer-profile-modal.tsx:111` | `bg-white/10` |
| `shared/entities/customers/components/profile/customer-profile-modal.tsx:113` | `bg-black/40` |
| `shared/entities/customers/components/profile/address-edit-dialog.tsx:163` | `bg-black/55` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:29` | `border-white/15` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:29` | `bg-white/10` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:29` | `hover:bg-white/15` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:50` | `from-white/25` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:50` | `via-white/10` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:50` | `to-white/5` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:50` | `ring-white/25` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:50` | `before:ring-white/10` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:68` | `bg-white/10` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:198` | `hover:bg-white/10` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:250` | `hover:bg-white/10` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:296` | `border-white/25` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:296` | `hover:border-white/40` |
| `shared/entities/customers/components/profile/customer-hero-header.tsx:296` | `hover:bg-white/5` |
| `shared/entities/customers/components/profile/customer-address-hero.tsx:47` | `from-black/85` |
| `shared/entities/customers/components/profile/customer-address-hero.tsx:47` | `via-black/75` |
| `shared/entities/customers/components/profile/customer-address-hero.tsx:76` | `from-black/30` |
| `shared/entities/customers/components/profile/customer-address-hero.tsx:76` | `via-black/55` |
| `shared/entities/customers/components/profile/customer-address-hero.tsx:76` | `to-black/90` |
| `shared/entities/customers/components/profile/customer-profile-modal-content.tsx:90` | `border-white/10` |
| `shared/entities/customers/components/profile/customer-profile-modal-content.tsx:90` | `bg-black/40` |
| `shared/entities/customers/components/profile/customer-hero-actions.tsx:50` | `border-white/15` |
| `shared/entities/customers/components/profile/customer-hero-actions.tsx:50` | `bg-black/40` |
| `shared/entities/customers/components/profile/customer-hero-actions.tsx:51` | `hover:bg-white/10` |
| `shared/entities/customers/components/profile/customer-hero-actions.tsx:130` | `hover:bg-white/10` |
| `shared/entities/customers/components/profile/hero-view-toggle.tsx:27` | `border-white/15` |
| `shared/entities/customers/components/profile/hero-view-toggle.tsx:27` | `bg-black/40` |
| `shared/entities/customers/components/profile/hero-view-toggle.tsx:41` | `hover:bg-white/10` |

## 6. Ambiguous — owner ruling needed

Cross-cutting questions first, then the per-line list.

- **A1. Public site scope.** 183 hits are on `(site)` pages / public portfolio stories, which share `:root`/`.dark` tokens with the app. Sweep them in this pass, or scope the ramp to the dashboard and leave the site for its own pass? (16 more in funnels/`/test`, which use `.funnel-light`/`.theme-marketing` scopes that redefine the surface tokens; the ramp needs values there too or those classes stay.)
- **A2. `secondary` on the public site is a brand accent, not a surface** (`text-secondary`, `bg-secondary/15` icon tiles, `border-secondary/60` rules, `decorative-line.tsx`). In `:root` today `--secondary` = `--muted` (neutral), so these render as neutral greys. 22 hits marked "n/a". Decide: re-point them to an accent token, or accept neutral.
- **A3. Glass popovers/menus/tooltips** (`--popover-glass`, dropdown inline oklch) vs the ramp's `raised` = solid. Same question for sticky blur headers (ROI calculator top bar, story scopes bar, public navbar) and floating capsules/bars (meeting step capsule, project-media bulk bar, PWA prompt).
- **A4. Selected state.** Rows/options/chips/segments that are "selected" or "current" today use `bg-muted/NN`, `bg-accent/60`, `bg-foreground/10` or `bg-primary/5–10`. The ramp names `row-hover` but no selected step. Options: selected = `raised` (tab-on-track), = `row-hover`, or add `row-selected` (stronger primary tint).
- **A5. Filled-control hover** (`hover:bg-secondary/80` on secondary Button/Badge/chips, `hover:bg-muted/80` on filled filter chips): the control sits on `muted`/`secondary`, so hover needs a step darker/lighter than muted. Proposed `band`, but band sits between muted and card (lighter than muted in light mode), which may read as "lighter on hover". Owner call: `band`, `border`, or a dedicated `control-hover`.
- **A6. Skeleton tone.** `skeleton-tone.ts` raised skeletons to `foreground/15` because `muted/60` measured 1.06:1 on card. A solid `muted` skeleton on `card` inherits the same weak contrast in light mode (card = white, muted = 0.955 L). Proposed `border`/`border-strong`-level solid for skeletons; fold `ui/skeleton.tsx` default into the same constant.
- **A7. Menu item highlight** (dropdown `focus:bg-muted/50`) — `row-hover` (primary tint) or `muted`.
- **A8. Proposal-flow navbar** (`navbar-frame.tsx:14 bg-foreground/20` + tab hovers `bg-foreground/40`) — a grey band whose look depends on what is beneath; needs a look before choosing `muted` or keep.
- **A9. Sidebar rail** (`--sidebar-hover`, `bg-sidebar/40`, `bg-sidebar-muted/50`, `border-sidebar-*/30`) — the navy rail is its own palette; confirm it is outside the ramp.

| file:line | class | role | proposed | question |
|---|---|---|---|---|
| `features/meeting-flow/ui/components/steps/program-card.tsx:119`  | `border-foreground/50` | selected card border | border-strong | selected state emphasis — border-strong or primary |
| `features/meeting-flow/ui/components/steps/program-card.tsx:119`  | `ring-foreground/20` | selected card border | border-strong | selected state emphasis — border-strong or primary |
| `features/meeting-flow/ui/components/shell/step-capsule.tsx:37`  | `bg-background/80` | floating capsule (glass) | raised | floating capsule over content; presentation tone keeps its own token |
| `features/proposal-flow/ui/components/proposal/pdf-fallback-card.tsx:26`  | `bg-card/60` | glass card | card | customer-facing proposal; glass card + gradient |
| `features/proposal-flow/ui/components/proposal/pdf-fallback-card.tsx:27`  | `from-card/80` | glass card gradient | card (drop gradient) | same |
| `features/proposal-flow/ui/components/proposal/pdf-fallback-card.tsx:27`  | `to-card/40` | glass card gradient | card (drop gradient) | same |
| `features/proposal-flow/ui/components/navbar/navbar.tsx:62`  | `hover:bg-foreground/40` | nav tab hover/active | keep or muted | sits on navbar-frame foreground/20; decide with the frame |
| `features/proposal-flow/ui/components/navbar/navbar.tsx:62`  | `data-[active=true]:bg-foreground/40` | nav tab hover/active | keep or muted | sits on navbar-frame foreground/20; decide with the frame |
| `features/proposal-flow/ui/components/navbar/navbar-frame.tsx:14`  | `bg-foreground/20` | navbar ground | muted | proposal-flow navbar ground is foreground/20 (a grey band over a photo?) — confirm what sits beneath |
| `features/proposal-flow/ui/components/navbar/navbar-menu.tsx:58`  | `hover:bg-foreground/40` | nav trigger hover/open | keep or muted | same |
| `features/proposal-flow/ui/components/navbar/navbar-menu.tsx:58`  | `data-[state=open]:bg-foreground/40` | nav trigger hover/open | keep or muted | same |
| `features/proposal-flow/ui/components/navbar/navbar-menu.tsx:59`  | `active:bg-card/50` | pressed/open trigger on navbar | keep or muted | sits on navbar-frame foreground/20; decide with the frame |
| `features/proposal-flow/ui/components/navbar/navbar-menu.tsx:59`  | `data-[state=open]:bg-card/50` | pressed/open trigger on navbar | keep or muted | sits on navbar-frame foreground/20; decide with the frame |
| `features/customer-pipelines/ui/components/customer-kanban-card.tsx:211`  | `bg-accent/50` | inset well (variant) | muted | accent/50 vs muted/30 twin wells on the same card — collapse to one step or keep a distinction |
| `features/customer-pipelines/ui/components/customer-kanban-card.tsx:211`  | `dark:bg-accent/30` | inset well (variant) | muted | accent/50 vs muted/30 twin wells on the same card — collapse to one step or keep a distinction |
| `features/lead-sources-admin/ui/components/time-range-chips.tsx:39`  | `bg-foreground/5` | selected chip | raised | selected chip — raised or primary tint (row-selected) |
| `features/lead-sources-admin/ui/components/lead-source-funnel.tsx:45`  | `bg-foreground/30` | progress fill (non-last) | n/a: data mark | bar-chart fill, not a surface — belongs to series/chart tokens |
| `features/agent-dashboard/ui/components/sidebar-pipeline-item.tsx:90`  | `border-sidebar-primary/30` | badge border in sidebar | n/a: sidebar accent tint | sidebar-primary/accent are accents on the rail, not surfaces |
| `features/agent-dashboard/ui/components/sidebar-pipeline-item.tsx:90`  | `border-sidebar-accent/30` | badge border in sidebar | n/a: sidebar accent tint | sidebar-primary/accent are accents on the rail, not surfaces |
| `features/landing/ui/components/contact/contact-info.tsx:97`  | `bg-secondary/20` | callout tint | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/contact/contact-info.tsx:97`  | `border-secondary/30` | callout tint | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/company-story.tsx:49`  | `bg-secondary/70` | eyebrow rule in secondary colour | n/a: secondary used as an accent colour | public site uses `secondary` as a brand accent, not a surface |
| `features/landing/ui/components/about/company-story.tsx:51`  | `bg-secondary/70` | eyebrow rule in secondary colour | n/a: secondary used as an accent colour | public site uses `secondary` as a brand accent, not a surface |
| `features/landing/ui/components/about/company-story.tsx:101`  | `border-border/60` | hero card gradient | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/company-story.tsx:101`  | `to-secondary/5` | hero card gradient | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/company-story.tsx:105`  | `bg-secondary/15` | blurred colour blob | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/company-story.tsx:131`  | `bg-background/80` | grid tile (glass over gap-px) | card | blur over bg-border/60 gap-px grid; solid card is the intent |
| `features/landing/ui/components/about/company-story.tsx:133`  | `bg-secondary/15` | icon tile tint | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/about-hero.tsx:50`  | `bg-secondary/70` | eyebrow rule in secondary colour | n/a: secondary used as an accent colour | public site uses `secondary` as a brand accent, not a surface |
| `features/landing/ui/components/about/about-hero.tsx:134`  | `border-secondary/40` | decorative frame border | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/about-hero.tsx:158`  | `bg-secondary/15` | icon tile tint | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/process-overview.tsx:267`  | `to-secondary/5` | tile gradient | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/process-overview.tsx:267`  | `hover:to-secondary/10` | tile gradient | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/process-overview.tsx:269`  | `bg-secondary/20` | icon tile tint | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/partner-story.tsx:61`  | `border-secondary/70` | corner bracket | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/credentials.tsx:56`  | `from-secondary/15` | tile gradient | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/credentials.tsx:56`  | `to-secondary/25` | tile gradient | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/credentials.tsx:83`  | `bg-secondary/20` | icon tile tint | n/a: secondary used as accent | secondary as brand accent |
| `features/landing/ui/components/about/credentials.tsx:148`  | `bg-foreground/10` | tile on dark band (glass) | keep: translucent | verify the band is a colour band, not canvas |
| `features/landing/ui/components/about/credentials.tsx:148`  | `hover:bg-foreground/20` | tile on dark band (glass) | keep: translucent | verify the band is a colour band, not canvas |
| `features/landing/ui/components/about/credentials.tsx:161`  | `bg-foreground/10` | tile on dark band (glass) | keep: translucent | verify the band is a colour band, not canvas |
| `features/landing/ui/components/about/credentials.tsx:161`  | `hover:bg-foreground/20` | tile on dark band (glass) | keep: translucent | verify the band is a colour band, not canvas |
| `features/landing/ui/components/about/credentials.tsx:174`  | `bg-foreground/10` | tile on dark band (glass) | keep: translucent | verify the band is a colour band, not canvas |
| `features/landing/ui/components/about/credentials.tsx:174`  | `hover:bg-foreground/20` | tile on dark band (glass) | keep: translucent | verify the band is a colour band, not canvas |
| `features/landing/ui/components/about/team.tsx:81`  | `hover:bg-secondary/90` | secondary button hover | n/a: secondary used as accent | secondary as brand accent (text-secondary-foreground on bg-secondary CTA) |
| `features/landing/ui/components/about/team.tsx:121`  | `bg-secondary/10` | tag tint | n/a: secondary used as accent | secondary as brand accent |
| `features/calculators/remodel-roi-calculator/ui/components/story/top-bar.tsx:28`  | `bg-background/85` | sticky header (glass) | canvas | sticky blur bar over scrolling content — solid canvas or keep glass |
| `features/project-management/ui/components/story-scopes-bar.tsx:21`  | `bg-background/80` | sticky header (glass) | canvas | sticky blur bar over scrolling content — solid canvas or keep glass |
| `features/project-management/ui/components/form/project-media-manager.tsx:361`  | `bg-background/95` | floating action bar (glass) | raised | floating bulk bar over a media grid — solid raised or keep glass |
| `shared/components/decorative-line.tsx:18`  | `to-secondary/50` | decorative accent line | n/a: secondary used as accent | secondary as brand accent |
| `shared/components/loading-hairline.tsx:35`  | `bg-foreground/40` | loading shimmer bar | border-strong | animated progress fill, arguably an accent |
| `shared/components/navigation/popover-nav.tsx:55`  | `bg-background/70` | full-screen mobile nav (glass) | keep: translucent (glass nav) | public site |
| `shared/components/navigation/site-navbar.tsx:146`  | `bg-background/95` | sticky site navbar (scrolled) | canvas | public navbar; solid canvas or keep 95% |
| `shared/components/navigation/site-navbar.tsx:215`  | `bg-background/80` | dropdown panel (glass) | raised | public nav mega-menu glass |
| `shared/components/navigation/site-navbar.tsx:316`  | `hover:bg-background/20` | hover on navbar icon over hero | keep: translucent (navbar over hero) | text-neutral-300 means it sits on a dark hero |
| `shared/components/navigation/site-navbar.tsx:332`  | `hover:bg-background/20` | hover on navbar icon over hero | keep: translucent (navbar over hero) | text-neutral-300 means it sits on a dark hero |
| `shared/components/navigation/site-navbar.tsx:362`  | `hover:bg-background/20` | hover on navbar icon over hero | keep: translucent (navbar over hero) | text-neutral-300 means it sits on a dark hero |
| `shared/components/navigation/site-navbar.tsx:385`  | `hover:bg-background/20` | hover on navbar icon over hero | keep: translucent (navbar over hero) | text-neutral-300 means it sits on a dark hero |
| `shared/components/data-table/ui/status-dropdown-cell.tsx:82`  | `bg-accent/60` | selected (current) option in menu | muted | selected option — muted, or a primary-tint row-selected step |
| `shared/components/ui/dropdown-menu.tsx:78`  | `'focus:bg-muted/50` | hover/focus (row) | row-hover | menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `shared/components/ui/dropdown-menu.tsx:96`  | `'focus:bg-muted/50` | hover/focus (row) | row-hover | menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `shared/components/ui/dropdown-menu.tsx:132`  | `'focus:bg-muted/50` | hover/focus (row) | row-hover | menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `shared/components/ui/dropdown-menu.tsx:215`  | `'focus:bg-muted/50` | hover/focus (row) | row-hover | menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `shared/components/ui/dropdown-menu.tsx:215`  | `data-[state=open]:bg-muted/50` | hover/focus (row) | row-hover | menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `shared/components/ui/sidebar-mobile-drawer.tsx:31` `DIRTY` | `bg-sidebar-muted/50` | drag handle | keep or sidebar-border (sidebar palette is outside the ramp) | sidebar rail tokens not in the ramp |
| `shared/components/ui/skeleton.tsx:8`  | `bg-muted/60` | skeleton (primitive default) | muted | primitive default is the faint tone skeleton-tone.ts works around; fold the two |
| `shared/components/ui/badge.tsx:16`  | `[a&]:hover:bg-secondary/90` | secondary badge hover | band | same |
| `shared/components/ui/button.tsx:18`  | `border-border/70` | outline button border/hover | border / muted | outline variant is backdrop-blur-sm glass; also dark:hover:bg-accent already solid |
| `shared/components/ui/button.tsx:18`  | `hover:bg-foreground/5` | outline button hover | muted | outline variant hover; dark already uses solid accent |
| `shared/components/ui/button.tsx:18`  | `dark:border-border/70` | outline button border/hover | border / muted | outline variant is backdrop-blur-sm glass; also dark:hover:bg-accent already solid |
| `shared/components/ui/button.tsx:20`  | `hover:bg-secondary/80` | secondary button hover | band | filled control hover needs a step between muted and card; secondary==muted today |
| `shared/components/buttons/user-button.tsx:24`  | `bg-foreground/20` | avatar fill | muted | avatar placeholder; public navbar over hero? |
| `shared/components/buttons/user-button.tsx:26`  | `bg-foreground/20` | avatar fill | muted | same |
| `shared/components/buttons/inline-edit-button.tsx:32`  | `hover:bg-foreground/10` | hover on icon button (glass) | muted | backdrop-blur suggests it is also used over the customer hero photo — check callers |
| `shared/components/query-toolbar/ui/filter-trigger.tsx:37`  | `border-foreground/60` | active-filter trigger border | border-strong | /60 is an emphasis state; border-strong may be too quiet |
| `shared/components/query-toolbar/ui/columns-trigger.tsx:33`  | `border-foreground/60` | active trigger border | border-strong | same |
| `shared/components/query-toolbar/ui/page-size-segmented.tsx:27`  | `bg-foreground/10` | selected segment | raised | selected segment in a segmented control — raised (tab-on-track) or row-hover tint |
| `shared/modules/proposals/core/components/overview-card.tsx:202`  | `bg-background/40` | icon tile on status-tinted row | keep: translucent (sits on a status tint via border-current) | tile over a status-coloured row |
| `shared/constants/skeleton-tone.ts:3`  | `bg-foreground/15` | skeleton | border-strong (skeleton tone) | skeleton tone was raised to foreground/15 for contrast (1.06:1 otherwise) — needs a solid step with enough contrast on card; muted is too faint |
| `shared/constants/skeleton-tone.ts:3`  | `dark:bg-foreground/10` | skeleton | border-strong (skeleton tone) | skeleton tone was raised to foreground/15 for contrast (1.06:1 otherwise) — needs a solid step with enough contrast on card; muted is too faint |
| `shared/constants/skeleton-tone.ts:6`  | `bg-foreground/10` | skeleton (block) | border (skeleton block tone) | same as above |
| `shared/constants/skeleton-tone.ts:6`  | `dark:bg-foreground/6` | skeleton (block) | border (skeleton block tone) | same as above |
| `shared/entities/meetings/components/overview-card.tsx:395`  | `hover:bg-secondary/80` | secondary badge hover | band | same |
| `shared/entities/customers/components/timeline/timeline-filter-chips.tsx:30`  | `hover:bg-secondary/80` | secondary chip hover | band | same |

## 7. Per-directory detail

Role vocabulary: hover · hover/focus (row) · selected / open state · well / inset · header/footer strip · section band · card surface · floating panel · border / divider · overlay/scrim over media · glass … · skeleton · gradient fade · n/a (accent, not a surface). Target `keep` = translucent by design (reason in brackets).

### `src/app/(frontend)` (3)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `test/page.tsx:346`  | `bg-muted/40` | well / inset | muted |  |
| `test/page.tsx:411`  | `bg-muted/40` | well / inset | muted |  |
| `test/page.tsx:507`  | `bg-muted/40` | well / inset | muted |  |

### `src/features/agent-dashboard` (11)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/action-card.tsx:33`  | `hover:bg-accent/50` | hover | row-hover |  |
| `ui/components/dashboard-action-queue.tsx:44`  | `hover:bg-accent/50` | hover | muted |  |
| `ui/components/dashboard-day-agenda.tsx:34`  | `hover:bg-accent/50` | hover | muted |  |
| `ui/components/dashboard-meeting-card.tsx:40`  | `hover:bg-accent/30` | hover | row-hover |  |
| `ui/components/dashboard-meetings-calendar.tsx:70`  | `dark:bg-border/40` | divider (1px fill) | border |  |
| `ui/components/dashboard-meetings-hub.tsx:60`  | `hover:bg-accent/50` | hover | muted |  |
| `ui/components/dashboard-projects.tsx:26`  | `hover:bg-accent/50` | hover | muted |  |
| `ui/components/dashboard-proposals.tsx:25`  | `hover:bg-accent/50` | hover | muted |  |
| `ui/components/dashboard-snapshot-chips.tsx:28` `SIX` | `hover:bg-accent/50` | hover | muted |  |
| `ui/components/sidebar-pipeline-item.tsx:90`  | `border-sidebar-primary/30` | badge border in sidebar | n/a: sidebar accent tint | ⚑ sidebar-primary/accent are accents on the rail, not surfaces |
| `ui/components/sidebar-pipeline-item.tsx:90`  | `border-sidebar-accent/30` | badge border in sidebar | n/a: sidebar accent tint | ⚑ sidebar-primary/accent are accents on the rail, not surfaces |

### `src/features/agent-settings` (1)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/integrations-section.tsx:118`  | `bg-muted/50` | well / inset | muted |  |

### `src/features/analytics` (2)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/report/headline-figure.tsx:34`  | `'hover:bg-muted/60` | hover | muted |  |
| `ui/components/report/series-toggle.tsx:30`  | `border-foreground/25` | selected toggle border | border-strong |  |

### `src/features/calculators` (4)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `remodel-roi-calculator/ui/components/inputs-panel/liability-row.tsx:23`  | `bg-muted/60` | well / inset | muted |  |
| `remodel-roi-calculator/ui/components/inputs-panel/trade-row.tsx:33`  | `bg-muted/60` | well / inset | muted |  |
| `remodel-roi-calculator/ui/components/story/chapter-math.tsx:26`  | `bg-card/60` | card surface | card |  |
| `remodel-roi-calculator/ui/components/story/top-bar.tsx:28`  | `bg-background/85` | sticky header (glass) | canvas | ⚑ sticky blur bar over scrolling content — solid canvas or keep glass |

### `src/features/campaigns-admin` (6)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/overview/idle-sources-list.tsx:17`  | `divide-border/60` | border / divider | border |  |
| `ui/components/overview/overview-summary-bar.tsx:19`  | `bg-muted/40` | well / inset | muted |  |
| `ui/components/overview/overview-summary-bar.tsx:25`  | `border-border/60` | border / divider | border |  |
| `ui/components/setup/cadence-message-row.tsx:125`  | `border-border/60` | border / divider | border |  |
| `ui/components/setup/cadence-message-row.tsx:125`  | `hover:bg-muted/40` | hover | muted |  |
| `ui/components/setup/contact-fields-readout.tsx:39`  | `divide-border/60` | border / divider | border |  |

### `src/features/customer-pipelines` (8)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/create-project-form.tsx:163`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/create-project-form.tsx:214`  | `hover:bg-muted/60` | hover | muted |  |
| `ui/components/customer-kanban-card.tsx:114`  | `border-border/60` | border / divider | border |  |
| `ui/components/customer-kanban-card.tsx:114`  | `bg-muted/30` | inset well | muted |  |
| `ui/components/customer-kanban-card.tsx:114`  | `dark:bg-muted/20` | inset well | muted |  |
| `ui/components/customer-kanban-card.tsx:211`  | `border-border/50` | border / divider | border |  |
| `ui/components/customer-kanban-card.tsx:211`  | `bg-accent/50` | inset well (variant) | muted | ⚑ accent/50 vs muted/30 twin wells on the same card — collapse to one step or keep a distinction |
| `ui/components/customer-kanban-card.tsx:211`  | `dark:bg-accent/30` | inset well (variant) | muted | ⚑ accent/50 vs muted/30 twin wells on the same card — collapse to one step or keep a distinction |

### `src/features/intake` (1)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/mp3-upload-field.tsx:65`  | `bg-muted/30` | well / inset | muted |  |

### `src/features/landing` (132)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/about/about-hero.tsx:50`  | `bg-secondary/70` | eyebrow rule in secondary colour | n/a: secondary used as an accent colour | ⚑ public site uses `secondary` as a brand accent, not a surface |
| `ui/components/about/about-hero.tsx:82`  | `divide-border/60` | border / divider | border |  |
| `ui/components/about/about-hero.tsx:82`  | `border-border/60` | border / divider | border |  |
| `ui/components/about/about-hero.tsx:134`  | `border-secondary/40` | decorative frame border | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/about-hero.tsx:148`  | `from-background/30` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/about/about-hero.tsx:148`  | `via-background/0` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/about/about-hero.tsx:148`  | `to-background/0` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/about/about-hero.tsx:156`  | `bg-card/95` | floating badge over photo (glass) | keep: translucent (on photo) |  |
| `ui/components/about/about-hero.tsx:156`  | `supports-backdrop-filter:bg-card/80` | floating badge over photo (glass) | keep: translucent (on photo) |  |
| `ui/components/about/about-hero.tsx:156`  | `border-border/60` | floating badge over photo (glass) | keep: translucent (on photo) |  |
| `ui/components/about/about-hero.tsx:158`  | `bg-secondary/15` | icon tile tint | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/about-hero.tsx:172`  | `bg-card/95` | floating badge over photo (glass) | keep: translucent (on photo) |  |
| `ui/components/about/about-hero.tsx:172`  | `supports-backdrop-filter:bg-card/80` | floating badge over photo (glass) | keep: translucent (on photo) |  |
| `ui/components/about/about-hero.tsx:172`  | `border-border/60` | floating badge over photo (glass) | keep: translucent (on photo) |  |
| `ui/components/about/company-story.tsx:49`  | `bg-secondary/70` | eyebrow rule in secondary colour | n/a: secondary used as an accent colour | ⚑ public site uses `secondary` as a brand accent, not a surface |
| `ui/components/about/company-story.tsx:51`  | `bg-secondary/70` | eyebrow rule in secondary colour | n/a: secondary used as an accent colour | ⚑ public site uses `secondary` as a brand accent, not a surface |
| `ui/components/about/company-story.tsx:66`  | `border-secondary/60` | accent border | n/a: secondary used as accent |  |
| `ui/components/about/company-story.tsx:101`  | `border-border/60` | hero card gradient | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/company-story.tsx:101`  | `to-secondary/5` | hero card gradient | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/company-story.tsx:105`  | `bg-secondary/15` | blurred colour blob | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/company-story.tsx:124`  | `bg-border/60` | gap-px grid lines | border |  |
| `ui/components/about/company-story.tsx:124`  | `border-border/60` | gap-px grid lines | border |  |
| `ui/components/about/company-story.tsx:131`  | `bg-background/80` | grid tile (glass over gap-px) | card | ⚑ blur over bg-border/60 gap-px grid; solid card is the intent |
| `ui/components/about/company-story.tsx:133`  | `bg-secondary/15` | icon tile tint | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/credentials.tsx:56`  | `from-secondary/15` | tile gradient | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/credentials.tsx:56`  | `to-secondary/25` | tile gradient | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/credentials.tsx:79`  | `border-border/20` | border / divider | border |  |
| `ui/components/about/credentials.tsx:83`  | `bg-secondary/20` | icon tile tint | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/credentials.tsx:148`  | `bg-foreground/10` | tile on dark band (glass) | keep: translucent | ⚑ verify the band is a colour band, not canvas |
| `ui/components/about/credentials.tsx:148`  | `hover:bg-foreground/20` | tile on dark band (glass) | keep: translucent | ⚑ verify the band is a colour band, not canvas |
| `ui/components/about/credentials.tsx:161`  | `bg-foreground/10` | tile on dark band (glass) | keep: translucent | ⚑ verify the band is a colour band, not canvas |
| `ui/components/about/credentials.tsx:161`  | `hover:bg-foreground/20` | tile on dark band (glass) | keep: translucent | ⚑ verify the band is a colour band, not canvas |
| `ui/components/about/credentials.tsx:174`  | `bg-foreground/10` | tile on dark band (glass) | keep: translucent | ⚑ verify the band is a colour band, not canvas |
| `ui/components/about/credentials.tsx:174`  | `hover:bg-foreground/20` | tile on dark band (glass) | keep: translucent | ⚑ verify the band is a colour band, not canvas |
| `ui/components/about/partner-story.tsx:56`  | `from-background/85` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/about/partner-story.tsx:56`  | `via-background/10` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/about/partner-story.tsx:61`  | `border-secondary/70` | corner bracket | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/process-overview.tsx:267`  | `to-secondary/5` | tile gradient | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/process-overview.tsx:267`  | `hover:to-secondary/10` | tile gradient | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/process-overview.tsx:269`  | `bg-secondary/20` | icon tile tint | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/about/team.tsx:70`  | `from-background/50` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/about/team.tsx:81`  | `hover:bg-secondary/90` | secondary button hover | n/a: secondary used as accent | ⚑ secondary as brand accent (text-secondary-foreground on bg-secondary CTA) |
| `ui/components/about/team.tsx:121`  | `bg-secondary/10` | tag tint | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/blog/blog-hero.tsx:58`  | `group-hover:bg-background/30` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/blog/blogpost-card-small.tsx:37`  | `bg-background/50` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/blog/blogpost-card.tsx:163`  | `bg-background/80` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/blog/blogpost-card.tsx:163`  | `hover:bg-background/50` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/contact/contact-info.tsx:50`  | `bg-background/10` | glass card on dark band | keep: translucent (glass on hero band) | verify ground |
| `ui/components/contact/contact-info.tsx:50`  | `border-background/20` | glass card on dark band | keep: translucent (glass on hero band) | verify ground |
| `ui/components/contact/contact-info.tsx:97`  | `bg-secondary/20` | callout tint | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/contact/contact-info.tsx:97`  | `border-secondary/30` | callout tint | n/a: secondary used as accent | ⚑ secondary as brand accent |
| `ui/components/experience/accreditations-strip.tsx:10`  | `bg-foreground/20` | separator dot | border-strong |  |
| `ui/components/experience/hero.tsx:29`  | `from-background/60` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/experience/hero.tsx:29`  | `dark:from-background/70` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/experience/hero.tsx:57`  | `from-background/60` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/experience/hero.tsx:58`  | `to-background/40` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/experience/hero.tsx:142`  | `to-background/40` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/experience/inquiry-section.tsx:38`  | `border-foreground/10` | border / divider | border |  |
| `ui/components/experience/inquiry-section.tsx:38`  | `bg-foreground/[0.02]` | well / tint | muted |  |
| `ui/components/experience/inquiry-section.tsx:54`  | `border-foreground/10` | border / divider | border |  |
| `ui/components/experience/project-stories.tsx:121`  | `bg-foreground/10` | divider (1px fill) | border |  |
| `ui/components/experience/project-stories.tsx:135`  | `border-foreground/10` | border / divider | border |  |
| `ui/components/experience/project-stories.tsx:135`  | `hover:bg-foreground/[0.05]` | hover | muted |  |
| `ui/components/experience/project-stories.tsx:135`  | `hover:border-foreground/20` | hover border | border-strong |  |
| `ui/components/experience/project-stories.tsx:147`  | `border-foreground/10` | border / divider | border |  |
| `ui/components/experience/project-stories.tsx:147`  | `hover:bg-foreground/[0.05]` | hover | muted |  |
| `ui/components/experience/project-stories.tsx:147`  | `hover:border-foreground/20` | hover border | border-strong |  |
| `ui/components/experience/project-story-card.tsx:23`  | `bg-foreground/[0.02]` | well / tint | muted |  |
| `ui/components/experience/project-story-card.tsx:23`  | `border-foreground/[0.06]` | border / divider | border |  |
| `ui/components/experience/project-story-card.tsx:23`  | `hover:border-foreground/[0.12]` | hover border | border-strong |  |
| `ui/components/experience/project-story-card.tsx:39`  | `from-background/30` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/experience/project-story-card.tsx:40`  | `from-background/25` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/experience/service-tile.tsx:24`  | `hover:bg-foreground/[0.03]` | tile hover | muted |  |
| `ui/components/experience/services-grid.tsx:28`  | `bg-foreground/10` | gap-px grid lines | border |  |
| `ui/components/experience/services-grid.tsx:28`  | `border-foreground/10` | gap-px grid lines | border |  |
| `ui/components/experience/stats-row.tsx:16`  | `border-foreground/10` | border / divider | border |  |
| `ui/components/experience/stats-row.tsx:27`  | `divide-foreground/10` | border / divider | border |  |
| `ui/components/experience/stats-row.tsx:27`  | `border-foreground/10` | border / divider | border |  |
| `ui/components/forms/general-inquiry-form.tsx:92`  | `border-border/30` | border / divider | border |  |
| `ui/components/forms/general-inquiry-form.tsx:171`  | `border-border/40` | border / divider | border |  |
| `ui/components/forms/inquiry-success-card.tsx:34`  | `border-border/30` | border / divider | border |  |
| `ui/components/forms/inquiry-success-card.tsx:57`  | `border-border/40` | border / divider | border |  |
| `ui/components/forms/inquiry-success-card.tsx:90`  | `border-border/40` | border / divider | border |  |
| `ui/components/forms/inquiry-success-card.tsx:94`  | `border-border/30` | border / divider | border |  |
| `ui/components/forms/inquiry-success-card.tsx:94`  | `bg-muted/20` | well / inset | muted |  |
| `ui/components/forms/inquiry-success-card.tsx:108`  | `border-border/40` | border / divider | border |  |
| `ui/components/forms/schedule-consultation-form.tsx:96`  | `border-border/30` | border / divider | border |  |
| `ui/components/forms/schedule-consultation-form.tsx:263`  | `border-border/40` | border / divider | border |  |
| `ui/components/home/home-hero.tsx:104`  | `border-background/40` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/home/home-hero.tsx:104`  | `bg-foreground/10` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/home/home-hero.tsx:185`  | `border-foreground/50` | scroll cue on hero | keep: translucent (on hero image) |  |
| `ui/components/home/home-hero.tsx:189`  | `bg-foreground/70` | scroll cue on hero | keep: translucent (on hero image) |  |
| `ui/components/home/photo-card.tsx:27`  | `bg-background/30` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/home/services-preview.tsx:62`  | `border-border/50` | border / divider | border |  |
| `ui/components/home/services-preview.tsx:78`  | `from-card/50` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/home/testimonials.tsx:115`  | `border-border/50` | border / divider | border |  |
| `ui/components/portfolio/portfolio-hero.tsx:30`  | `bg-background/30` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/portfolio/project-card.tsx:49`  | `from-background/70` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/portfolio/project-card.tsx:49`  | `via-background/10` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/portfolio/project-card.tsx:69`  | `bg-background/60` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/portfolio/project/before-after-gallery.tsx:25`  | `bg-muted/20` | section band | muted |  |
| `ui/components/portfolio/project/progress-gallery.tsx:65`  | `bg-background/90` | lightbox dialog ground | keep: translucent (lightbox) |  |
| `ui/components/portfolio/project/project-hero.tsx:41`  | `from-background/80` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/portfolio/project/project-hero.tsx:41`  | `via-background/30` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/portfolio/project/project-videos-gallery.tsx:20`  | `bg-muted/20` | section band | muted |  |
| `ui/components/portfolio/project/stat.tsx:8`  | `bg-muted/40` | well / inset | muted |  |
| `ui/components/portfolio/projects-grid.tsx:66`  | `hover:bg-muted/80` | filled chip hover | band |  |
| `ui/components/services/pillar-card-secondary.tsx:15`  | `border-border/50` | border / divider | border |  |
| `ui/components/services/pillar-card-secondary.tsx:15`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/services/pillar-card-secondary.tsx:15`  | `hover:bg-muted/50` | hover | muted |  |
| `ui/components/services/scopes-grid.tsx:28`  | `bg-muted/40` | section band | muted |  |
| `ui/components/services/scopes-grid.tsx:66`  | `bg-background/60` | inset well | muted |  |
| `ui/components/services/services-hero.tsx:40`  | `bg-background/45` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/services/services-hero.tsx:50`  | `border-foreground/20` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/services-hero.tsx:50`  | `bg-foreground/5` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/services-hero.tsx:98`  | `border-foreground/15` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/services-hero.tsx:98`  | `bg-foreground/5` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/services-hero.tsx:111`  | `via-foreground/30` | fading hairline on hero | keep: translucent (gradient rule on image) |  |
| `ui/components/services/services-hero.tsx:128`  | `border-foreground/20` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/services-hero.tsx:128`  | `bg-foreground/5` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/services-hero.tsx:128`  | `hover:bg-foreground/10` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/trade-hero.tsx:59`  | `bg-background/45` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/services/trade-hero.tsx:98`  | `border-foreground/20` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/trade-hero.tsx:98`  | `bg-foreground/5` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/trade-hero.tsx:145`  | `border-foreground/10` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/services/trade-hero.tsx:145`  | `bg-foreground/5` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/views/pillar-view.tsx:57`  | `bg-background/45` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/views/pillar-view.tsx:67`  | `border-foreground/20` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/views/pillar-view.tsx:67`  | `bg-foreground/5` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/views/pillar-view.tsx:108`  | `border-foreground/15` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/views/pillar-view.tsx:108`  | `bg-foreground/5` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/views/pillar-view.tsx:121`  | `via-foreground/30` | fading hairline on hero | keep: translucent (gradient rule on image) |  |

### `src/features/lead-sources-admin` (28)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/add-customer-sheet.tsx:106`  | `border-border/40` | border / divider | border |  |
| `ui/components/all-detail.tsx:146` `SIX` | `border-border/40` | border / divider | border |  |
| `ui/components/danger-zone.tsx:87`  | `border-border/40` | border / divider | border |  |
| `ui/components/form-config-editor.tsx:157`  | `border-border/60` | border / divider | border |  |
| `ui/components/form-config-editor.tsx:157`  | `bg-background/40` | inset well | muted |  |
| `ui/components/intake-url-card.tsx:70`  | `border-border/60` | border / divider | border |  |
| `ui/components/intake-url-card.tsx:70`  | `bg-background/50` | inset well | muted |  |
| `ui/components/lead-source-funnel.tsx:43`  | `bg-muted/60` | progress track | muted |  |
| `ui/components/lead-source-funnel.tsx:45`  | `bg-foreground/30` | progress fill (non-last) | n/a: data mark | ⚑ bar-chart fill, not a surface — belongs to series/chart tokens |
| `ui/components/lead-source-list.tsx:96`  | `bg-border/40` | divider (1px fill) | border |  |
| `ui/components/lead-source-list.tsx:117`  | `border-border/50` | border / divider | border |  |
| `ui/components/lead-source-list.tsx:163`  | `'hover:bg-muted/60` | hover | row-hover |  |
| `ui/components/lead-source-list.tsx:163`  | `focus-visible:bg-muted/60` | hover/focus (row) | row-hover |  |
| `ui/components/lead-source-list.tsx:183`  | `border-border/60` | border / divider | border |  |
| `ui/components/lead-source-settings-panel.tsx:36`  | `border-border/40` | border / divider | border |  |
| `ui/components/lead-source-settings-panel.tsx:40`  | `border-border/40` | border / divider | border |  |
| `ui/components/lead-source-settings-panel.tsx:44`  | `border-border/40` | border / divider | border |  |
| `ui/components/new-lead-source-sheet.tsx:87`  | `border-border/40` | border / divider | border |  |
| `ui/components/new-lead-source-sheet.tsx:169`  | `border-border/40` | border / divider | border |  |
| `ui/components/source-detail.tsx:100` `SIX` | `border-border/40` | border / divider | border |  |
| `ui/components/source-detail.tsx:106` `SIX` | `border-border/40` | border / divider | border |  |
| `ui/components/time-range-chips.tsx:39`  | `border-foreground/20` | border (emphasis) | border-strong |  |
| `ui/components/time-range-chips.tsx:39`  | `bg-foreground/5` | selected chip | raised | ⚑ selected chip — raised or primary tint (row-selected) |
| `ui/components/time-range-chips.tsx:40`  | `border-border/60` | border / divider | border |  |
| `ui/components/time-range-chips.tsx:40`  | `bg-background/60` | unselected chip | card |  |
| `ui/components/time-range-chips.tsx:40`  | `hover:bg-muted/60` | unselected chip | card |  |
| `ui/views/lead-sources-view.tsx:105`  | `lg:border-border/40` | border / divider | border |  |
| `ui/views/lead-sources-view.tsx:136`  | `hover:bg-muted/60` | hover | muted |  |

### `src/features/meeting-flow` (51)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/context-panel-section.tsx:43`  | `hover:bg-muted/50` | hover | muted |  |
| `ui/components/persona-profile-panel.tsx:25`  | `border-border/50` | border / divider | border |  |
| `ui/components/persona-profile-panel.tsx:25`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/persona-profile-panel.tsx:41`  | `border-border/50` | border / divider | border |  |
| `ui/components/persona-profile-panel.tsx:41`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/persona-profile-panel.tsx:58`  | `border-border/50` | border / divider | border |  |
| `ui/components/persona-profile-panel.tsx:58`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/persona-profile-panel.tsx:74`  | `border-border/50` | border / divider | border |  |
| `ui/components/persona-profile-panel.tsx:74`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/persona-profile-panel.tsx:90`  | `border-border/50` | border / divider | border |  |
| `ui/components/persona-profile-panel.tsx:90`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/persona-profile-panel.tsx:109`  | `border-border/50` | border / divider | border |  |
| `ui/components/persona-profile-panel.tsx:109`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/persona-profile-section.tsx:47`  | `border-border/40` | border / divider | border |  |
| `ui/components/persona-profile-section.tsx:49`  | `hover:bg-muted/50` | hover | muted |  |
| `ui/components/project-section/project-row.tsx:59`  | `hover:bg-muted/60` | hover | row-hover |  |
| `ui/components/shell/inspector-rail.tsx:51`  | `border-border/40` | border / divider | border |  |
| `ui/components/shell/meeting-panel-header.tsx:24`  | `border-border/40` | border / divider | border |  |
| `ui/components/shell/meeting-panel.tsx:58`  | `border-border/40` | border / divider | border |  |
| `ui/components/shell/meeting-section.tsx:70`  | `border-border/70` | border / divider | border |  |
| `ui/components/shell/step-capsule.tsx:37`  | `bg-background/80` | floating capsule (glass) | raised | ⚑ floating capsule over content; presentation tone keeps its own token |
| `ui/components/shell/step-tabs.tsx:50`  | `bg-foreground/10` | done-step tab fill | muted |  |
| `ui/components/shell/top-bar.tsx:40`  | `border-border/40` | border / divider | border |  |
| `ui/components/steps/closing-scope-card.tsx:16`  | `border-border/60` | border / divider | border |  |
| `ui/components/steps/closing-scope-card.tsx:55`  | `border-border/40` | border / divider | border |  |
| `ui/components/steps/closing-step.tsx:72`  | `border-border/60` | border / divider | border |  |
| `ui/components/steps/closing-step.tsx:72`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/steps/closing-step.tsx:125`  | `border-border/60` | border / divider | border |  |
| `ui/components/steps/closing-step.tsx:184`  | `border-border/60` | border / divider | border |  |
| `ui/components/steps/closing-step.tsx:184`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/steps/deal-structure-fields.tsx:111`  | `border-border/60` | border / divider | border |  |
| `ui/components/steps/deal-structure-fields.tsx:111`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/steps/deal-structure-fields.tsx:207`  | `border-border/60` | border / divider | border |  |
| `ui/components/steps/deal-structure-fields.tsx:207`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/steps/deal-structure-fields.tsx:255`  | `border-border/60` | border / divider | border |  |
| `ui/components/steps/deal-structure-fields.tsx:255`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/steps/program-card.tsx:119`  | `border-foreground/50` | selected card border | border-strong | ⚑ selected state emphasis — border-strong or primary |
| `ui/components/steps/program-card.tsx:119`  | `ring-foreground/20` | selected card border | border-strong | ⚑ selected state emphasis — border-strong or primary |
| `ui/components/steps/program-card.tsx:120`  | `hover:border-foreground/30` | hover card border | border-strong |  |
| `ui/components/steps/program-presentation.tsx:27`  | `border-border/40` | border / divider | border |  |
| `ui/components/steps/program-presentation.tsx:27`  | `bg-card/50` | card surface | card |  |
| `ui/components/steps/program-presentation.tsx:51`  | `border-border/40` | border / divider | border |  |
| `ui/components/steps/program-presentation.tsx:51`  | `bg-card/50` | card surface | card |  |
| `ui/components/steps/program-presentation.tsx:89`  | `border-border/40` | border / divider | border |  |
| `ui/components/steps/program-presentation.tsx:89`  | `bg-card/50` | card surface | card |  |
| `ui/components/steps/program-presentation.tsx:91`  | `hover:bg-muted/30` | hover | muted |  |
| `ui/components/steps/program-presentation.tsx:91`  | `data-[state=open]:bg-muted/20` | selected / open state | muted |  |
| `ui/components/steps/program-step.tsx:99`  | `border-border/60` | border / divider | border |  |
| `ui/components/steps/program-step.tsx:99`  | `bg-muted/20` | well / inset | muted |  |
| `ui/components/steps/program-step.tsx:114`  | `border-border/40` | hero border | border |  |
| `ui/components/steps/specialties/work-column.tsx:17`  | `bg-muted/30` | well / inset | muted |  |

### `src/features/project-management` (43)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/form/basic-info-fields.tsx:14`  | `border-border/30` | border / divider | border |  |
| `ui/components/form/homeowner-fields.tsx:14`  | `border-border/30` | border / divider | border |  |
| `ui/components/form/import-from-proposal-dialog.tsx:82`  | `bg-background/90` | checkbox ground on thumbnail | keep: translucent (sits on a photo) | verify it sits on a thumbnail |
| `ui/components/form/project-media-manager.tsx:361`  | `bg-background/95` | floating action bar (glass) | raised | ⚑ floating bulk bar over a media grid — solid raised or keep glass |
| `ui/components/form/story-content-fields.tsx:14`  | `border-border/30` | border / divider | border |  |
| `ui/components/phase-carousel.tsx:77`  | `bg-background/80` | glass control over media | keep: translucent (carousel arrow on photo) |  |
| `ui/components/phase-carousel.tsx:78`  | `bg-background/80` | glass control over media | keep: translucent (carousel arrow on photo) |  |
| `ui/components/photo-lightbox.tsx:70`  | `bg-background/95` | lightbox backdrop over media | keep: translucent (lightbox scrim) |  |
| `ui/components/photo-lightbox.tsx:87`  | `hover:bg-foreground/10` | hover on lightbox control | keep: translucent (lightbox chrome) |  |
| `ui/components/photo-lightbox.tsx:101`  | `bg-background/50` | glass control over media | keep: translucent (control on photo) |  |
| `ui/components/photo-lightbox.tsx:101`  | `hover:bg-background/70` | glass control over media | keep: translucent (control on photo) |  |
| `ui/components/photo-lightbox.tsx:132`  | `bg-background/50` | glass control over media | keep: translucent (control on photo) |  |
| `ui/components/photo-lightbox.tsx:132`  | `hover:bg-background/70` | glass control over media | keep: translucent (control on photo) |  |
| `ui/components/photo-lightbox.tsx:142`  | `border-foreground/10` | caption bar over lightbox | keep: translucent (lightbox chrome) |  |
| `ui/components/photo-lightbox.tsx:142`  | `bg-background/80` | caption bar over lightbox | keep: translucent (lightbox chrome) |  |
| `ui/components/portfolio-filter-bar.tsx:128`  | `hover:bg-muted/80` | filled chip hover | band |  |
| `ui/components/portfolio-hero.tsx:133`  | `bg-background/50` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/portfolio-hero.tsx:147`  | `border-foreground/20` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/portfolio-hero.tsx:147`  | `bg-foreground/5` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/portfolio-hero.tsx:181`  | `via-foreground/30` | fading hairline on hero | keep: translucent (gradient rule on image) |  |
| `ui/components/portfolio-project-card.tsx:74`  | `from-background/70` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/portfolio-project-card.tsx:74`  | `via-background/10` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/portfolio-project-card.tsx:86`  | `bg-foreground/20` | chip/label over media | keep: translucent (sits on a photo) |  |
| `ui/components/portfolio-project-card.tsx:91`  | `bg-foreground/20` | chip/label over media | keep: translucent (sits on a photo) |  |
| `ui/components/portfolio-project-card.tsx:111`  | `bg-background/60` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/story-before-after.tsx:17`  | `bg-muted/30` | skeleton | muted |  |
| `ui/components/story-before-after.tsx:208`  | `bg-foreground/60` | chip/label over media | keep: translucent (sits on a photo) |  |
| `ui/components/story-before-after.tsx:211`  | `bg-muted/80` | chip/label over media | keep: translucent (sits on a photo) |  |
| `ui/components/story-challenge.tsx:50`  | `bg-muted/50` | well / inset | muted |  |
| `ui/components/story-gallery.tsx:53`  | `bg-muted/30` | section band | muted |  |
| `ui/components/story-gallery.tsx:132`  | `bg-background/0` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/story-gallery.tsx:132`  | `group-hover:bg-background/20` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `ui/components/story-hero.tsx:61`  | `from-background/70` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/story-hero.tsx:62`  | `from-background/80` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/story-hero.tsx:62`  | `via-background/30` | photo gradient | keep: translucent (gradient on image) |  |
| `ui/components/story-hero.tsx:109`  | `border-foreground/20` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/story-hero.tsx:109`  | `bg-foreground/10` | glass chip over hero | keep: translucent (on hero image) |  |
| `ui/components/story-scopes-bar.tsx:21`  | `bg-background/80` | sticky header (glass) | canvas | ⚑ sticky blur bar over scrolling content — solid canvas or keep glass |
| `ui/components/story-solution.tsx:44`  | `bg-muted/20` | section band | muted |  |
| `ui/components/story-solution.tsx:94`  | `bg-background/60` | card on muted section | card |  |
| `ui/components/story-solution.tsx:117`  | `bg-background/60` | card on muted section | card |  |
| `ui/components/story-timeline.tsx:56`  | `bg-muted/20` | section band | muted |  |
| `ui/components/story-transformation.tsx:32`  | `bg-muted/20` | section band | muted |  |

### `src/features/proposal-flow` (41)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/customer-info-header.tsx:24`  | `border-border/50` | border / divider | border |  |
| `ui/components/customer-info-header.tsx:24`  | `bg-muted/30` | well / inset | muted |  |
| `ui/components/form/funding-fields.tsx:161`  | `border-border/30` | border / divider | border |  |
| `ui/components/form/funding-fields.tsx:198`  | `border-border/30` | border / divider | border |  |
| `ui/components/form/incentive-collapsible-header.tsx:29`  | `hover:bg-muted/50` | hover | muted |  |
| `ui/components/form/index.tsx:239`  | `hover:bg-foreground/5` | hover on split-button segment | muted |  |
| `ui/components/form/project-fields.tsx:107`  | `border-border/30` | border / divider | border |  |
| `ui/components/form/proposal-media-manager.tsx:109`  | `bg-background/70` | chip/label over media | keep: translucent (sits on a photo) |  |
| `ui/components/form/sow-collapsible-header.tsx:57`  | `hover:bg-muted/50` | hover | muted |  |
| `ui/components/form/sow-field.tsx:197`  | `hover:bg-muted/50` | hover | muted |  |
| `ui/components/form/sow-field.tsx:207`  | `bg-muted/50` | well / inset | muted |  |
| `ui/components/form/sow-field.tsx:280`  | `border-border/30` | border / divider | border |  |
| `ui/components/form/sow-field.tsx:285`  | `hover:bg-muted/50` | hover | muted |  |
| `ui/components/form/sow-field.tsx:295`  | `bg-muted/50` | well / inset | muted |  |
| `ui/components/form/sow-financials-fields.tsx:135`  | `border-border/30` | border / divider | border |  |
| `ui/components/form/sow-financials-fields.tsx:174`  | `border-border/30` | border / divider | border |  |
| `ui/components/form/sow-financials-fields.tsx:285`  | `border-border/30` | border / divider | border |  |
| `ui/components/navbar/navbar-frame.tsx:14`  | `bg-foreground/20` | navbar ground | muted | ⚑ proposal-flow navbar ground is foreground/20 (a grey band over a photo?) — confirm what sits beneath |
| `ui/components/navbar/navbar-menu.tsx:58`  | `hover:bg-foreground/40` | nav trigger hover/open | keep or muted | ⚑ same |
| `ui/components/navbar/navbar-menu.tsx:58`  | `data-[state=open]:bg-foreground/40` | nav trigger hover/open | keep or muted | ⚑ same |
| `ui/components/navbar/navbar-menu.tsx:59`  | `active:bg-card/50` | pressed/open trigger on navbar | keep or muted | ⚑ sits on navbar-frame foreground/20; decide with the frame |
| `ui/components/navbar/navbar-menu.tsx:59`  | `data-[state=open]:bg-card/50` | pressed/open trigger on navbar | keep or muted | ⚑ sits on navbar-frame foreground/20; decide with the frame |
| `ui/components/navbar/navbar-menu.tsx:115`  | `hover:bg-muted/40` | hover | muted |  |
| `ui/components/navbar/navbar-menu.tsx:134`  | `hover:bg-muted/40` | hover | muted |  |
| `ui/components/navbar/navbar.tsx:62`  | `hover:bg-foreground/40` | nav tab hover/active | keep or muted | ⚑ sits on navbar-frame foreground/20; decide with the frame |
| `ui/components/navbar/navbar.tsx:62`  | `data-[active=true]:bg-foreground/40` | nav tab hover/active | keep or muted | ⚑ sits on navbar-frame foreground/20; decide with the frame |
| `ui/components/pricing-breakdown.tsx:35`  | `border-border/40` | border / divider | border |  |
| `ui/components/pricing-breakdown.tsx:89`  | `border-border/40` | border / divider | border |  |
| `ui/components/pricing-breakdown.tsx:97`  | `border-border/40` | border / divider | border |  |
| `ui/components/pricing-breakdown.tsx:145`  | `border-border/40` | border / divider | border |  |
| `ui/components/pricing-breakdown.tsx:145`  | `bg-muted/30` | header/footer strip | muted |  |
| `ui/components/proposal/pdf-fallback-card.tsx:26`  | `border-border/50` | border / divider | border |  |
| `ui/components/proposal/pdf-fallback-card.tsx:26`  | `bg-card/60` | glass card | card | ⚑ customer-facing proposal; glass card + gradient |
| `ui/components/proposal/pdf-fallback-card.tsx:27`  | `from-card/80` | glass card gradient | card (drop gradient) | ⚑ same |
| `ui/components/proposal/pdf-fallback-card.tsx:27`  | `to-card/40` | glass card gradient | card (drop gradient) | ⚑ same |
| `ui/components/proposal/proposal-media-gallery.tsx:61`  | `hover:bg-muted/50` | hover | muted |  |
| `ui/components/proposal/scope-of-work.tsx:57`  | `border-border/50` | border / divider | border |  |
| `ui/components/proposal/scope-of-work.tsx:59`  | `hover:bg-muted/30` | hover | muted |  |
| `ui/components/proposal/scope-of-work.tsx:59`  | `data-[state=open]:bg-muted/20` | selected / open state | muted |  |
| `ui/components/proposal/scope-of-work.tsx:120`  | `border-border/30` | border / divider | border |  |
| `ui/components/proposal/trusted-contractor.tsx:61`  | `ring-background/10` | ring on media frame | keep: translucent (edge on image) |  |

### `src/features/schedule-management` (2)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/components/schedule-today-view.tsx:157`  | `bg-muted/20` | skeleton empty bucket | band |  |
| `ui/components/schedule-today-view.tsx:238`  | `bg-muted/20` | well / inset | muted |  |

### `src/shared/components/buttons` (3)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `inline-edit-button.tsx:32`  | `hover:bg-foreground/10` | hover on icon button (glass) | muted | ⚑ backdrop-blur suggests it is also used over the customer hero photo — check callers |
| `user-button.tsx:24`  | `bg-foreground/20` | avatar fill | muted | ⚑ avatar placeholder; public navbar over hero? |
| `user-button.tsx:26`  | `bg-foreground/20` | avatar fill | muted | ⚑ same |

### `src/shared/components/collapsible-section.tsx` (1)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `shared/components/collapsible-section.tsx:22`  | `hover:bg-muted/50` | hover | muted |  |

### `src/shared/components/contract-status-panel` (8)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/envelope-card.tsx:154`  | `bg-card/50` | card surface | card |  |
| `ui/envelope-card.tsx:187`  | `bg-muted/30` | well / inset | muted |  |
| `ui/envelope-configuration-section.tsx:118`  | `border-border/60` | border / divider | border |  |
| `ui/envelope-configuration-section.tsx:118`  | `bg-background/40` | inset well | muted |  |
| `ui/envelope-signer-grid.tsx:40`  | `bg-muted/30` | well / inset | muted |  |
| `ui/homeowner-contract-view.tsx:205`  | `bg-muted/30` | well / inset | muted |  |
| `ui/homeowner-contract-view.tsx:221`  | `bg-muted/30` | well / inset | muted |  |
| `ui/proposal-card.tsx:83`  | `bg-card/50` | card surface | card |  |

### `src/shared/components/customer-search.tsx` (2)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `shared/components/customer-search.tsx:63`  | `bg-muted/30` | well / inset | muted |  |
| `shared/components/customer-search.tsx:95`  | `hover:bg-muted/50` | hover | row-hover |  |

### `src/shared/components/data-table` (13)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `constants/cell-border.ts:1`  | `border-border/50` | border / divider | border |  |
| `ui/data-table-body.tsx:73`  | `border-border/50` | border / divider | border |  |
| `ui/data-table-body.tsx:92`  | `border-border/50` | border / divider | border |  |
| `ui/data-table-body.tsx:138`  | `border-border/50` | border / divider | border |  |
| `ui/data-table-body.tsx:171`  | `border-border/50` | border / divider | border |  |
| `ui/data-table-body.tsx:178`  | `group-hover:bg-muted/50` | hover | row-hover |  |
| `ui/data-table-pagination.tsx:37`  | `border-border/50` | border / divider | border |  |
| `ui/data-table.tsx:298` `DIRTY` | `border-border/50` | table frame border | border | uncommitted file (other session) |
| `ui/data-table.tsx:318` `DIRTY` | `border-border/50` | header row border | border | uncommitted file (other session) |
| `ui/data-table.tsx:333` `DIRTY` | `border-border/50` | sticky column border | border | uncommitted file (other session) |
| `ui/expanded-row-panel.tsx:20`  | `bg-muted/20` | expanded row panel | raised |  |
| `ui/status-dropdown-cell.tsx:81`  | `hover:bg-muted/50` | hover | row-hover |  |
| `ui/status-dropdown-cell.tsx:82`  | `bg-accent/60` | selected (current) option in menu | muted | ⚑ selected option — muted, or a primary-tint row-selected step |

### `src/shared/components/decorative-line.tsx` (1)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `shared/components/decorative-line.tsx:18`  | `to-secondary/50` | decorative accent line | n/a: secondary used as accent | ⚑ secondary as brand accent |

### `src/shared/components/image-slider.tsx` (1)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `shared/components/image-slider.tsx:52`  | `bg-background/60` | overlay/scrim over media | keep: translucent (scrim over image) |  |

### `src/shared/components/kanban` (3)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/kanban-column.tsx:47`  | `hover:bg-accent/50` | hover | muted |  |
| `ui/kanban-column.tsx:64`  | `border-border/50` | border / divider | border |  |
| `ui/kanban-column.tsx:64`  | `bg-muted/30` | kanban column ground | muted |  |

### `src/shared/components/loading-hairline.tsx` (1)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `shared/components/loading-hairline.tsx:35`  | `bg-foreground/40` | loading shimmer bar | border-strong | ⚑ animated progress fill, arguably an accent |

### `src/shared/components/media` (6)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `media-card.tsx:102`  | `group-hover:bg-background/40` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `media-card.tsx:102`  | `bg-background/40` | overlay/scrim over media | keep: translucent (scrim over image) |  |
| `media-card.tsx:109`  | `bg-background/60` | chip/label over media | keep: translucent (sits on a photo) |  |
| `media-card.tsx:116`  | `border-foreground/70` | chip/label over media | keep: translucent (sits on a photo) |  |
| `media-card.tsx:125`  | `bg-background/60` | chip/label over media | keep: translucent (sits on a photo) |  |
| `media-card.tsx:168`  | `bg-background/60` | chip/label over media | keep: translucent (sits on a photo) |  |

### `src/shared/components/navigation` (11)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `popover-nav.tsx:55`  | `bg-background/70` | full-screen mobile nav (glass) | keep: translucent (glass nav) | ⚑ public site |
| `site-navbar.tsx:134`  | `bg-background/50` | modal backdrop scrim | keep: translucent (menu scrim) |  |
| `site-navbar.tsx:146`  | `bg-background/95` | sticky site navbar (scrolled) | canvas | ⚑ public navbar; solid canvas or keep 95% |
| `site-navbar.tsx:215`  | `bg-background/80` | dropdown panel (glass) | raised | ⚑ public nav mega-menu glass |
| `site-navbar.tsx:215`  | `border-foreground/30` | border (emphasis) | border-strong |  |
| `site-navbar.tsx:270`  | `border-foreground/15` | button border | border |  |
| `site-navbar.tsx:285`  | `border-foreground/15` | button border | border |  |
| `site-navbar.tsx:316`  | `hover:bg-background/20` | hover on navbar icon over hero | keep: translucent (navbar over hero) | ⚑ text-neutral-300 means it sits on a dark hero |
| `site-navbar.tsx:332`  | `hover:bg-background/20` | hover on navbar icon over hero | keep: translucent (navbar over hero) | ⚑ text-neutral-300 means it sits on a dark hero |
| `site-navbar.tsx:362`  | `hover:bg-background/20` | hover on navbar icon over hero | keep: translucent (navbar over hero) | ⚑ text-neutral-300 means it sits on a dark hero |
| `site-navbar.tsx:385`  | `hover:bg-background/20` | hover on navbar icon over hero | keep: translucent (navbar over hero) | ⚑ text-neutral-300 means it sits on a dark hero |

### `src/shared/components/push-subscription-banner.tsx` (2)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `shared/components/push-subscription-banner.tsx:68`  | `border-foreground/10` | border / divider | border |  |
| `shared/components/push-subscription-banner.tsx:68`  | `bg-foreground/2` | banner well | muted |  |

### `src/shared/components/pwa-install-prompt.tsx` (2)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `shared/components/pwa-install-prompt.tsx:82` `DIRTY` | `border-foreground/10` | border / divider | border |  |
| `shared/components/pwa-install-prompt.tsx:82` `DIRTY` | `bg-popover/95` | floating prompt | raised | uncommitted file (other session) |

### `src/shared/components/query-toolbar` (18)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/bar.tsx:22`  | `border-border/60` | border / divider | border |  |
| `ui/columns-body.tsx:18`  | `border-foreground/10` | border / divider | border |  |
| `ui/columns-body.tsx:42`  | `hover:bg-foreground/5` | hover | row-hover |  |
| `ui/columns-trigger.tsx:33`  | `border-foreground/60` | active trigger border | border-strong | ⚑ same |
| `ui/filter-chip.tsx:25`  | `border-border/70` | border / divider | border |  |
| `ui/filter-chip.tsx:26`  | `hover:bg-foreground/3` | hover | muted |  |
| `ui/filter-chip.tsx:41`  | `'hover:bg-foreground/10` | hover | muted |  |
| `ui/filter-controls/date-range-filter-control.tsx:80`  | `border-border/50` | border / divider | border |  |
| `ui/filter-controls/number-range-filter-control.tsx:104`  | `border-border/50` | border / divider | border |  |
| `ui/filter-controls/number-range-filter-control.tsx:132`  | `border-border/50` | border / divider | border |  |
| `ui/filter-controls/number-range-filter-control.tsx:148`  | `border-border/50` | border / divider | border |  |
| `ui/filter-popover-body.tsx:17`  | `border-foreground/10` | border / divider | border |  |
| `ui/filter-sheet-body.tsx:48`  | `border-border/60` | border / divider | border |  |
| `ui/filter-trigger.tsx:37`  | `border-foreground/60` | active-filter trigger border | border-strong | ⚑ /60 is an emphasis state; border-strong may be too quiet |
| `ui/page-size-segmented.tsx:13`  | `border-border/60` | border / divider | border |  |
| `ui/page-size-segmented.tsx:27`  | `bg-foreground/10` | selected segment | raised | ⚑ selected segment in a segmented control — raised (tab-on-track) or row-hover tint |
| `ui/page-size-segmented.tsx:28`  | `hover:bg-foreground/5` | hover | muted |  |
| `ui/sheet-drag-handle.tsx:5`  | `bg-foreground/20` | drag handle | border-strong |  |

### `src/shared/components/stat-bar` (3)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/stat-bar-item.tsx:21`  | `border-border/50` | border / divider | border |  |
| `ui/stat-bar.tsx:34`  | `border-border/50` | border / divider | border |  |
| `ui/stat-bar.tsx:34`  | `hover:bg-accent/50` | hover | row-hover |  |

### `src/shared/components/states` (1)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `coming-soon-state.tsx:59`  | `bg-card/60` | empty-state well | muted |  |

### `src/shared/components/tiptap` (1)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `tiptap.tsx:138`  | `bg-background/60` | loading veil over editor | keep: translucent (veil) |  |

### `src/shared/components/ui` (25)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `alert-dialog.tsx:40`  | `bg-background/50` | modal backdrop scrim | keep: translucent (modal scrim) |  |
| `badge.tsx:16`  | `[a&]:hover:bg-secondary/90` | secondary badge hover | band | ⚑ same |
| `button.tsx:18`  | `border-border/70` | outline button border/hover | border / muted | ⚑ outline variant is backdrop-blur-sm glass; also dark:hover:bg-accent already solid |
| `button.tsx:18`  | `hover:bg-foreground/5` | outline button hover | muted | ⚑ outline variant hover; dark already uses solid accent |
| `button.tsx:18`  | `dark:border-border/70` | outline button border/hover | border / muted | ⚑ outline variant is backdrop-blur-sm glass; also dark:hover:bg-accent already solid |
| `button.tsx:20`  | `hover:bg-secondary/80` | secondary button hover | band | ⚑ filled control hover needs a step between muted and card; secondary==muted today |
| `chart.tsx:70`  | `']]:stroke-border/50` | chart grid lines | border |  |
| `chart.tsx:197`  | `border-border/50` | border / divider | border |  |
| `dialog.tsx:62`  | `bg-background/50` | modal backdrop scrim | keep: translucent (modal scrim) |  |
| `drawer.tsx:41` `DIRTY` | `bg-background/50` | modal backdrop scrim | keep: translucent (modal scrim) |  |
| `dropdown-menu.tsx:45`  | `border-border/50` | popover border (glass menu) | border | dropdown menu is glass via inline oklch(from var(--popover) .. / 0.8) |
| `dropdown-menu.tsx:78`  | `'focus:bg-muted/50` | hover/focus (row) | row-hover | ⚑ menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `dropdown-menu.tsx:96`  | `'focus:bg-muted/50` | hover/focus (row) | row-hover | ⚑ menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `dropdown-menu.tsx:132`  | `'focus:bg-muted/50` | hover/focus (row) | row-hover | ⚑ menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `dropdown-menu.tsx:215`  | `'focus:bg-muted/50` | hover/focus (row) | row-hover | ⚑ menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `dropdown-menu.tsx:215`  | `data-[state=open]:bg-muted/50` | hover/focus (row) | row-hover | ⚑ menu item highlight inside a glass menu — row-hover (primary tint) or muted |
| `dropdown-menu.tsx:235`  | `border-border/50` | popover border (glass menu) | border | dropdown sub-menu glass |
| `navigation-menu.tsx:62`  | `data-[state=open]:bg-accent/50` | open trigger | muted | public nav primitive |
| `navigation-menu.tsx:133`  | `data-[active=true]:bg-accent/50` | active link | muted | public nav primitive |
| `sheet.tsx:40`  | `bg-background/50` | modal backdrop scrim | keep: translucent (modal scrim) |  |
| `sidebar-mobile-drawer.tsx:30` `DIRTY` | `bg-sidebar/40` | modal backdrop scrim | keep: translucent (modal scrim) | sidebar palette, uncommitted file |
| `sidebar-mobile-drawer.tsx:31` `DIRTY` | `bg-sidebar-muted/50` | drag handle | keep or sidebar-border (sidebar palette is outside the ramp) | ⚑ sidebar rail tokens not in the ramp |
| `skeleton.tsx:8`  | `bg-muted/60` | skeleton (primitive default) | muted | ⚑ primitive default is the faint tone skeleton-tone.ts works around; fold the two |
| `table.tsx:47`  | `bg-muted/50` | table footer strip | muted |  |
| `table.tsx:60`  | `'hover:bg-muted/50` | hover | row-hover |  |

### `src/shared/constants` (6)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `skeleton-tone.ts:1`  | `bg-muted/60` | comment | n/a (comment text) | comment only |
| `skeleton-tone.ts:3`  | `bg-foreground/15` | skeleton | border-strong (skeleton tone) | ⚑ skeleton tone was raised to foreground/15 for contrast (1.06:1 otherwise) — needs a solid step with enough contrast on card; muted is too faint |
| `skeleton-tone.ts:3`  | `dark:bg-foreground/10` | skeleton | border-strong (skeleton tone) | ⚑ skeleton tone was raised to foreground/15 for contrast (1.06:1 otherwise) — needs a solid step with enough contrast on card; muted is too faint |
| `skeleton-tone.ts:6`  | `bg-foreground/10` | skeleton (block) | border (skeleton block tone) | ⚑ same as above |
| `skeleton-tone.ts:6`  | `dark:bg-foreground/6` | skeleton (block) | border (skeleton block tone) | ⚑ same as above |
| `skeleton-tone.ts:9`  | `'dark:border-border/40` | skeleton frame border | border |  |

### `src/shared/domains/funnels` (13)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `ui/blocks/before-after-showcase.tsx:27`  | `bg-muted/30` | skeleton | muted |  |
| `ui/blocks/before-after-showcase.tsx:102`  | `bg-background/80` | glass control over media | keep: translucent (carousel arrow on photo) |  |
| `ui/blocks/before-after-showcase.tsx:103`  | `bg-background/80` | glass control over media | keep: translucent (carousel arrow on photo) |  |
| `ui/blocks/faq-block.tsx:40`  | `border-foreground/20` | border (emphasis) | border-strong |  |
| `ui/blocks/funnel-project-carousel.tsx:73`  | `bg-muted/40` | skeleton | muted |  |
| `ui/blocks/funnel-project-carousel.tsx:107`  | `bg-background/80` | glass control over media | keep: translucent (carousel arrow on photo) |  |
| `ui/blocks/funnel-project-carousel.tsx:108`  | `bg-background/80` | glass control over media | keep: translucent (carousel arrow on photo) |  |
| `ui/blocks/portfolio-block.tsx:44`  | `bg-muted/40` | skeleton | muted |  |
| `ui/footer/funnel-footer.tsx:23`  | `border-border/60` | border / divider | border |  |
| `ui/steps/address-preview.tsx:36`  | `bg-muted/40` | well / inset | muted |  |
| `ui/steps/address-step.tsx:49`  | `bg-muted/30` | well / inset | muted |  |
| `ui/steps/card-select-step.tsx:60`  | `bg-muted/40` | well / inset | muted |  |
| `ui/steps/card-select-step.tsx:90`  | `bg-muted/40` | well / inset | muted |  |

### `src/shared/entities/customers` (10)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `components/lead-source-picker.tsx:69`  | `hover:bg-foreground/5` | hover | muted |  |
| `components/lead-source-picker.tsx:71`  | `'data-[state=open]:bg-foreground/8` | open trigger | muted |  |
| `components/lists/proposal-row.tsx:35`  | `hover:bg-muted/50` | hover | row-hover |  |
| `components/profile/address-edit-dialog.tsx:139`  | `bg-muted/40` | well / inset | muted |  |
| `components/profile/address-edit-dialog.tsx:172`  | `bg-muted/30` | well / inset | muted |  |
| `components/profile/customer-hero-header.tsx:133`  | `hover:bg-foreground/10` | hover on control over hero | keep: translucent (on hero photo) |  |
| `components/timeline/timeline-event-item.tsx:87`  | `bg-muted/50` | expanded row | raised |  |
| `components/timeline/timeline-event-item.tsx:87`  | `'hover:bg-muted/40` | hover | row-hover |  |
| `components/timeline/timeline-event-item.tsx:124`  | `border-border/60` | border / divider | border |  |
| `components/timeline/timeline-filter-chips.tsx:30`  | `hover:bg-secondary/80` | secondary chip hover | band | ⚑ same |

### `src/shared/entities/lead-sources` (2)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `components/overview-card.tsx:76`  | `'hover:bg-muted/60` | hover | row-hover |  |
| `components/overview-card.tsx:76`  | `focus-visible:bg-muted/60` | hover/focus (row) | row-hover |  |

### `src/shared/entities/meetings` (16)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `components/assign-project-dialog.tsx:107`  | `'hover:bg-muted/50` | hover | row-hover |  |
| `components/assign-project-dialog.tsx:151`  | `bg-muted/30` | well / inset | muted |  |
| `components/overview-card.tsx:395`  | `hover:bg-secondary/80` | secondary badge hover | band | ⚑ same |
| `components/participant-picker/available-participant-row.tsx:53`  | `'data-[selected=true]:bg-muted/70` | hover/focus (row) | row-hover |  |
| `components/participant-picker/available-participant-row.tsx:53`  | `hover:bg-muted/70` | hover | row-hover |  |
| `components/participant-picker/available-participant-row.tsx:67`  | `border-border/60` | border / divider | border |  |
| `components/participant-picker/available-participant-row.tsx:67`  | `bg-background/60` | hover-reveal chip | card |  |
| `components/participant-picker/current-participant-row.tsx:60`  | `border-border/60` | border / divider | border |  |
| `components/participant-picker/current-participant-row.tsx:60`  | `bg-card/40` | card surface | card |  |
| `components/participant-picker/current-participant-row.tsx:91`  | `hover:bg-muted/60` | hover | muted |  |
| `components/participant-picker/participant-picker-content.tsx:139`  | `border-border/60` | border / divider | border |  |
| `components/participant-picker/participant-picker-content.tsx:250`  | `border-border/60` | border / divider | border |  |
| `components/participant-picker/participant-picker-content.tsx:268`  | `border-border/60` | border / divider | border |  |
| `components/participant-picker/participant-picker-content.tsx:305`  | `border-border/60` | border / divider | border |  |
| `components/participant-picker/participant-picker-content.tsx:305`  | `bg-card/40` | card surface | card |  |
| `components/participants-slot.tsx:333`  | `hover:bg-accent/50` | hover | muted |  |

### `src/shared/modules/proposals` (6)

| file:line | class | role | target | note |
|---|---|---|---|---|
| `core/components/overview-card.tsx:202`  | `bg-background/40` | icon tile on status-tinted row | keep: translucent (sits on a status tint via border-current) | ⚑ tile over a status-coloured row |
| `core/components/section-financials-summary.tsx:35`  | `bg-muted/30` | well / inset | muted |  |
| `core/components/section-financials-summary.tsx:61`  | `bg-muted/30` | well / inset | muted |  |
| `core/constants/proposal-row-styles.ts:14`  | `'hover:bg-background/50` | hover (draft row) | row-hover | other status rows use status tints for hover; only draft uses a surface |
| `core/lib/columns-registry.tsx:46`  | `bg-muted/60` | well / inset | muted |  |
| `core/lib/columns-registry.tsx:46`  | `ring-border/60` | border / divider | border |  |

