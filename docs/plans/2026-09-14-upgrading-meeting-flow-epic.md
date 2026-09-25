# Upgrading Meeting Flow — Epic Tracker

> **Status:** requirements decided (every §2 question resolved 2026-09-14; the #285 public-read stance handed over, C28). Split into four specs, §0 (2026-09-14). Spec A shipped 2026-09-17 (6 tasks: module moves, media module, hooks, docs — see §0 row A). Spec B/D not written. **Spec C written 2026-09-20** (`docs/superpowers/specs/2026-09-20-presentation-config-and-critique-design.md`) after a grilling session that reversed C23 and added the step entrance E1–E7; not built.
> **Started:** 2026-09-14 (session `de65fd4d`) as the Who We Are round 2 requirements tracker (`2026-09-14-who-we-are-round-2-requirements.md`, renamed). Update this file as decisions land and items ship; IDs are stable, reference them in the specs, plans and commits.
> **Sources:** critique snapshot `.impeccable/critique/2026-09-13T21-12-06Z__atures-meeting-flow-ui-components-steps-who-we-are.md` (16/32) and its follow-up answers (session `0c0415de`) · round 1 spec `docs/superpowers/specs/2026-09-13-who-we-are-corrections-design.md` (committed `34a2aa28`) · research passes 2026-09-14 (presentation layout, portfolio hero, trade→photo data path, conventions audit, service/modules architecture, DAL query toolkit, projects read inventory).
> **Baseline:** `main` at `dd2ba19d` (proposals module move `187f8a00` + service layer `94bcf6d4` landed).
> **Adjacent, owned elsewhere — do not duplicate:** `docs/plans/2026-09-14-construction-catalog-centralization-design.md` (trade/scope catalog, `CatalogIndex`, `filterProjectsByTrade`; being edited by another session) · permissions epic #285 (`.worktrees/issue-285`).

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⚠️ needs a decision in §2 before it can be specced.

---

## 0. Epic structure

Four specs (owner, 2026-09-14), each with its own spec → plan → build. A spec closes when every ID it owns is `[x]`. Specs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.

| Spec | Scope | Owns | Blocked by | Spec | Plan | Status |
|---|---|---|---|---|---|---|
| **A** | Projects and media modules restructure: the path-only projects move first (C20), then the media module and the project media unit | M1–M8 · MD1–MD11, MD13, MD14 · K2, K6, K7, K10 · C31, C32 | — | `docs/superpowers/specs/2026-09-15-projects-media-modules-design.md` (2026-09-15) | `docs/superpowers/plans/2026-09-15-projects-media-modules.md` | [x] shipped (tasks 1–6 landed; docs task 2026-09-17) |
| **B** | Projects read model and public API: list read with `scopeIds`, list mode without count, media by project ids, cover rule, projects service, public projection, every public consumer moved onto it | R1–R15 · S1, S2 · K3–K5 · V2 (cover rule, `groupMediaByPhase`), V3, V6 | A | not written | — | [ ] |
| **C** | Presentation config, **step entrance** and critique fixes: beat shape, the two frames, the sticky column scoped to a derived run, container queries, type/spacing/colour, closing and comparison beats, brand ease | L1–L9 · U1–U14 · **E1–E7** · C33–C42, C44–C46 · K8 (frame rules) · V4, V7 | — (can run alongside A and B) | `docs/superpowers/specs/2026-09-20-presentation-config-and-critique-design.md` (2026-09-20) | `docs/superpowers/plans/2026-09-22-presentation-config-and-critique.md` (2026-09-22). ⏸ H1: step 2's V1 fails fixed 2026-09-22 (`725954a9`, `77c30a9f`; re-run 28 PASS / 3 FAIL, the 3 = contrast on shared tokens, owner's call); runbook `docs/superpowers/plans/2026-09-22-presentation-config-and-critique-runbook.md` (gates after Tasks 2/4/6/8, per-task commits); ready to run | [ ] |
| **D** | Hook background: trade mix lib, padding, generalized photo grid, portfolio page hero recomposed on it | B1–B11 · U14 (grid takes the brand ease) · K8 (trade source, mix, fallback) · V2 (mixer), V5 · K9 | B, C | not written | — | [ ] |

**Order:** A → B → D, with C anywhere before D. V1 (`pnpm tsc` + `pnpm lint`) gates every spec.

**Spec-time details** (decided inside the spec that owns them, not here): B — public projection columns, cache tags and TTL (R11), public procedure leaf name (R10), list-without-count option name (R5). D — grid cell count, per-project photo cap, padding order (B11), grid component name (B7).

**Overlap to watch:** B's R13 removes meeting-flow's imports into project-management internals (the portfolio step); C edits the presentation primitive in the same feature. Different files, but whichever lands second rebases onto the first.

---

## 1. Decided (owner)

| ID | Decision | Date |
|---|---|---|
| C1 | The pinned (left) column owns the headline. The stage side of a beat carries only media, stats and lists. | 2026-09-13 |
| C2 | Comparison beats use concept C, two quotes side by side: a detailed Tri Pros sheet next to a thin generic "typical quote" (no logo, no letterhead, nothing resembling a real company). Rows reveal one topic (pair) at a time. | 2026-09-13 |
| C3 | The closing gets its own beat (deck becomes 10 beats): the extras table keeps its beat; a final beat carries the closing over the dusk house photo. | 2026-09-13 |
| C4 | "Other contractors" copy stays as grilled in round 1; only the visual treatment changes. | 2026-09-13 |
| C5 | Round 1 decisions (beat order, figures, company-wide corrections) stand. | 2026-09-13 |
| C6 | The section config supports a single full-width column (full-bleed background) as well as the pinned split. More per-section control. | 2026-09-14 |
| C7 | The config rework lands before the `/impeccable layout` pass. | 2026-09-14 |
| C8 | Trade-matched project photo background on the **hook only** for now. The current static image is the fallback. | 2026-09-14 |
| C9 | Background trades = the **first two picked** (order of `flowState.tradeSelections`), equal-parts mix. | 2026-09-14 |
| C10 | Photo phases are a **parameter** passed from config; all phases for now. | 2026-09-14 |
| C11 | Background animates with a **one-time staggered reveal**. | 2026-09-14 |
| C12 | The services `[tradeSlug]` pages move onto the same project read path. | 2026-09-14 |
| C13 | Portfolio projects are projects, owned by the projects entity. A **projects service** built on the projects DAL/CRUD fetches projects for every surface. | 2026-09-14 |
| C14 | Reads are generic and composable: "projects with scope X" is a filter on the projects list read (query toolkit), never a hyper-specific read. | 2026-09-14 |
| C15 | Project-specific primitives relocate from `src/features/` to `src/shared/`. | 2026-09-14 |
| C16 | The projects service lives in **`src/shared/modules/projects/`** (was Q1): today's projects entity and its media child become units of one module with a root `service.ts`, mirroring `modules/proposals`. | 2026-09-14 |
| C17 | **The entity/module service is the one server API** (was Q2): CRUD slots spread + verbs + child services. Routers, RSC, jobs and webhooks are thin adapters over it. Reads stay in DAL `queries.ts`. `service-architecture.md#the-deciding-question` is amended to match. | 2026-09-14 |
| C18 | The two-trade photo mix happens **caller-side in a pure lib** (was Q4): the projects API stays trade-agnostic; the meeting-flow hook and RSC trade pages call generic reads per trade and share the mixer. | 2026-09-14 |
| C19 | This round consolidates **all public project read consumers** (was Q5): portfolio list and detail, sitemap, services pillar and trade pages, experience page, portfolio proof, funnel blocks, meeting-flow portfolio step, and the duplicate landing read path. | 2026-09-14 |
| C20 | The projects module move **lands first** (was Q12), path-only like the proposals move; the main ↔ #285 sync absorbs it. | 2026-09-14 |
| C21 | **One cover-image rule** everywhere (was Q7): the marked hero; else the first `after`, then `during`, then `uncategorized` photo. A `before` photo is never a cover. | 2026-09-14 |
| C22 | **Catalog coordination** (was Q6): projects code only takes scope ids; trade → scope resolution comes from today's catalog reads (`useTradeCatalog`, `constructionDataService`) until the construction catalog module lands; portfolio trade filtering (`filterProjectsByTrade`) stays with that design. | 2026-09-14 |
| ~~C23~~ | 🔁 **REVERSED by C36 (2026-09-20) — do not build this.** Was: pinned column = sticky overlay above full-width sections. Rejected after a live prototype: an opaque full-height panel hides the full-bleed background entirely, so the only visible gain on a split beat was a wider photo crop, bought with an `offsetTop` hazard, seven content-padding rewrites and a panel that fades in and out at frame changes. The column stays a real grid column, scoped to a run (C37). | 2026-09-14, reversed 2026-09-20 |
| C24 | **Media is a generalized module** (was Q11) that exposes THE media service. Owner media entities consume it — dependency direction owner unit → media module. Today's `entities/media-files` is the **project media** entity (`project-media-files`, parallel to `proposal-media-files`) and becomes a unit of `modules/projects`. The owner stated this is the structure "for now, until we think of a better strategy"; details in §3.4c. | 2026-09-14 |
| C25 | **Hook grid pads with other work** (was Q8): the meeting's trade photos fill cells first (C9 mix); remaining cells take cover photos (C21) from other public projects, so the grid is always full. | 2026-09-14 |
| C26 | **Code-only rename** of the project media entity (was Q13): `projectMediaFiles = pgTable('media_files', …)`. No DDL this round; a table rename and dropping `x_project_media_files` are a separate reviewed migration. | 2026-09-14 |
| C27 | **The optimization job file composes the owner stores** (was Q14): it maps `ownerKind` → `projectMediaStore` / `proposalMediaStore`; the payload `{ ownerKind, mediaId }` is unchanged. | 2026-09-14 |
| C28 | **Public reads now: `SYSTEM_CONTEXT` + explicit `visibility: 'public'` + the public projection (S1)** (was Q3). The #285 stance — (a) `systemContext('public:portfolio')` or (b) an anonymous `can('read','Project',{ isPublic: true })` rule — is handed to the #285 owner, not picked here (recorded in memory `project-permissions-casl-compiler`). | 2026-09-14 |
| C29 | **Reveals switch to `--ease-brand`** `cubic-bezier(0.32, 0.72, 0, 1)` (was Q10, after the side-by-side comparison): one approved curve, as DESIGN.md requires. Covers the presentation motion constants and the generalized photo grid (B7), so the portfolio page hero changes curve too. | 2026-09-14 |
| C30 | **Media business rules stay as they are** (was Q15): (1) proposal delete does **not** purge R2 (rows cascade, objects stay); (2) `importFromProposal` does **not** check proposal media `visibility`. The owner called this a rushed, keep-it-simple decision that may not reflect the intended rules; a note sits where the proposal delete hook would go (`modules/proposals/core/dal/server/crud.ts`). | 2026-09-14 |
| C31 | **The R2 purge on project delete stays in the `projectCrud` `delete.before` hook** (spec A fork). A DAL may not import a service, so the hook reads the project's media rows through the media module's table-generic DAL and purges through a provider-level helper that takes the store's variant list — not through the media service. Keeps the purge firing on every delete path, including a bare `projectCrud.delete`. Amends MD7. | 2026-09-15 |
| C32 | **Media row-lifecycle side effects are CRUD hooks, not service overrides.** Optimize-on-create and purge-on-delete move from `mediaService.createRecord`/`removeRecord` into `create.after`/`delete.before` on BOTH media units, so they fire on every origin — the same rule as C31, applied one level down. The media service keeps only what no owner can own (upload target, table-generic list/reorder, the two optimization entry points); `createRecord`/`removeRecord` are deleted, and with them the project media `create`/`delete` overrides and the proposal `delete` override. The proposal `create` override survives, holding only its parent-visibility probe (authorization stays in a service). Consequence: deleting an already-deleted media row now returns `not-found` instead of succeeding silently, so `bulkDelete` must tolerate it per id. Owner call, 2026-09-15: "why are we overriding crud's `create` instead of using our create.after/before hook?" | 2026-09-15 |
| C33 | **Frames are a closed set of two**, `'split' \| 'full'` — named frames the critique pass can grade, not composable knobs. Confirms L2. | 2026-09-20 |
| C34 | **`full` = the hook and the closing only.** Everything else is `split`. Corrected mid-session: `truth` in code is the **extras table**, which cannot sit centred over a photo and stay readable. | 2026-09-20 |
| C35 | `background` is valid on **either frame**. On a `split` beat it fills that beat's own box — the stage column, not the column beside it. | 2026-09-20 |
| C36 | 🔁 **Reverses C23. No sticky overlay.** The heading column stays a real grid column. | 2026-09-20 |
| C37 | The sticky column is scoped to a **run of consecutive `split` beats, derived from `frame`** — not to the whole deck. This is what lets a `full` beat be genuinely full-bleed (today's hook is not: `section-image.tsx:36` says `62vw`) while split beats keep today's sticky-and-fade feel. No grouping field in the config. | 2026-09-20 |
| C38 | The scroller's `scroll-padding-top` becomes a **constant `0`**; beats under a band carry their own `scroll-margin-top: var(--band-h)`. `--pin-h` retires. Satisfies L6 more strictly than L6's own wording — the offset is per-beat and declarative. | 2026-09-20 |
| C39 | The step opens with the existing **branded splash** (`src/shared/components/splash-screen/`) extended to carry the step's title and line, so the presentation loads behind it. **Holds until the agent presses it** (any click or key). Fires **once per meeting**, keyed by `meetingId`. Stays `fixed inset-0 z-9999`. A `cover` field on the beat was considered and rejected — the entrance is step-level, not a beat property. | 2026-09-20 |
| C40 | `SPLASH_VISIBLE_MS` **1100 → 1500**: the blue `R` lands at 1.4s (`splash-animation.tsx:35-38`) but the overlay starts fading at 1.1s, so every timed splash clips its own brand mark. Affects the **proposal** splash; the meeting splash has no timer. Shared component, owner-approved. | 2026-09-20 |
| C41 | A `full` beat **centres** its heading. Today's hook is bottom-anchored (`hook-section.tsx:21`) — this is a change, not a restoration. | 2026-09-20 |
| C42 | **`density: 'compact'` is deleted** from the comparison table. It exists only "so the table shares its beat with the closing truth" (`comparison-table.tsx:9`); C3 gives the closing its own beat, so both tables render `regular`. | 2026-09-20 |
| C43 | **`PwaSplashScreen` stays** as it is, despite having no callers. Not this round's cleanup. | 2026-09-20 |
| C44 | **No action on smooth scrolling under reduced motion.** The global `* { scroll-behavior: smooth }` (`globals.css:466-471`) defeats `motion-safe:scroll-smooth` on the presentation scroller; neither the global rule nor a local `motion-reduce:scroll-auto` override is part of this work. From the CSS review (spec C §11, F3). | 2026-09-22 |
| C45 | **`StageFrame` publishes `--stage-clear-b`**: the capsule's offset + its 48px + U6's 40px (~104px). Presentation content floors its bottom padding at it; `--stage-inset-b` is unchanged for other consumers. Shared shell component, owner-approved (spec C §6, S2). | 2026-09-22 |
| C46 | The heading column's fade **keeps its opacity under reduced motion**, as `MotionConfig reducedMotion="user"` does across the flow (controller ruling, not objected to). | 2026-09-22 |

## 2. Open decisions

| ID | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | Home of the projects service | — | ✅ Resolved → C16 |
| Q2 | Service-architecture rule conflict | — | ✅ Resolved → C17 |
| Q3 | Authorization of public reads, now and under #285 | — | ✅ Resolved → C28 ((a)/(b) handed to #285) |
| Q4 | Where the 2-trade mix happens | — | ✅ Resolved → C18 |
| Q5 | Consolidation boundary this round | — | ✅ Resolved → C19 |
| Q6 | Coordination with the construction catalog design | — | ✅ Resolved → C22 |
| Q7 | One cover-image rule | — | ✅ Resolved → C21 |
| Q8 | Background tuning | Dev data kept in `scripts/tmp-trade-photo-density.ts` output: most-picked trades have 1–3 public projects; Kitchen/Bathroom 13; several trades 0. | ✅ Resolved → C25 (cell count, per-project cap and padding order settle in the spec) |
| Q9 | Pinned column mechanics | — | ✅ Resolved → C23 |
| Q11 | Splitting today's `entities/media-files` | — | ✅ Resolved → C24 |
| Q12 | Sequencing against the main ↔ #285 sync | — | ✅ Resolved → C20 |
| Q13 | Rename the DB table too? | — | ✅ Resolved → C26 |
| Q14 | Optimization job owner lookup | — | ✅ Resolved → C27 |
| Q15 | Media business rules found while mapping | — | ✅ Resolved → C30 (rushed; revisit) |
| Q10 | Easing curve | Compared side by side (artifact "Hook Reveal Easing", 2026-09-14). | ✅ Resolved → C29 |

---

## 3. Requirements

### 3.1 Presentation UI (critique round 2)

- [ ] **U1** One headline per beat, owned by the pinned column (C1). Point beats render no title/line on the stage; hook and comparison headline copy moves into the pinned title. Pinned block and stage content align (no centred-vs-bottom eye ping-pong).
- [ ] **U2** Heading numerals use lining figures that don't descend into the title. ⚠️ **First clause struck 2026-09-20** — it read "the pinned 'N of 6' and the capsule '1 / 7' don't both show", on the assumption they duplicate. They do not: `step-capsule.tsx:54` renders `stepCounter(currentStep, TOTAL_STEPS)` where `TOTAL_STEPS = MEETING_STEPS.length` = **7 meeting steps** (`step-config.ts:71`), so "1 / 7" means "Who We Are is step 1 of 7 in this meeting" while "3 of 6" means "third of six proof points". Removing either loses real information.
- [ ] **U3** Closing beat (C3): quote at the Lead size in Nunito (no italic serif); CTA at least 40px clear of the capsule in present mode at 1440 and 1180, and at 1024 and 820.
- [ ] **U4** Comparison beats per C2: two sheets on the desk, rows revealed pair by pair, copy per C4. No mid-word breaks at 1024; layout switches on the container.
- [ ] **U5** Six-role type scale with rem floors — display ≈62, title ≈44, figure ≈35, lead ≈23, body ≈18, label ≈14 (present-mode px); body never below 17px on iPad. One figure size across all beats. No weight 500.
- [ ] **U6** Spacing tokens: tight ≈8, group ≈30, zone ≈51 (px at present mode). Media bottom-anchored so the media→copy gap is identical on every beat. Copy clears the capsule by ≥40px.
- [ ] **U7** Layout breakpoints are container queries on the presentation area, not viewport `lg:`.
- [ ] **U8** Colour: accent is brand blue on dark (`#5cc6f2`), not the indigo hue; the CTA uses the accent and passes 4.5:1; the scrim and dialog overlay `oklch(0.14 0.03 257 …)` literals become one shared variable consistent with `--presentation-ground`.
- [ ] **U9** Hook: headline ≈62px on three lines; plain subtitle, no serif-italic accent word (DESIGN.md ban); headline stays legible over bright photo areas.
- [ ] **U10** No unfinished content reaches the homeowner: sample scope placeholder carries no developer text; agent card shows a brand monogram when no headshot (not the Google letter avatar) and sizes to its content; team beat shows Sean's portrait beside the 12+ figure until the team photo exists (no visible "to be shot" slot).
- [ ] **U11** Touch affordance: "Tap to view" cue on credential documents and the scope stack; dialog close target ≥44px.
- [ ] **U12** Performance beat shows before/after at true proportions in the media row. ⚠️ Its images (`/portfolio-photos/projects/Riviera/hero-*.jpeg`, `who-we-are-sections.ts:19-20`) are gitignored and **broken in production**; source them from tracked assets or project media.
- [ ] **U13** Minor: sentence-case stat labels (`due-diligence.ts` uses Title Case); reputation marks don't orphan Yelp; agent and team list sizes match; no rotated text that blurs on low-DPI screens.
- [ ] **U14** Easing (C29): `PRESENTATION_EASE` becomes the brand curve; the generalized photo grid (B7) takes the same curve instead of the portfolio hero's `[0.25, 0.46, 0.45, 0.94]`. There is no shared JS mirror of `--ease-brand` today (the literal is copied in six places, §4): add one in `src/shared/constants/` and have both consume it. Durations and stagger stay as built. ⚠️ The CSS variable `--ease-brand` is declared only inside `.funnel-light` (`globals.css:200`), so it resolves to nothing in the meeting flow: presentation easing goes through the JS constant, never `var(--ease-brand)` (spec C §6).

### 3.2 Section config and layout

> **Amended 2026-09-20 by C33–C38, C41.** `pinned` is renamed `heading` and is required on
> every beat (nothing is pinned to the viewport). L5's sticky-overlay clause is void — see
> the C23 reversal. Full mechanics, types and the snap arithmetic live in spec C §2 and §4.


- [ ] **L1** Section entry shape `{ id, frame, pinned?, background?, content }`; `content` keeps the existing kind union with an exhaustive `satisfies never` switch.
- [ ] **L2** `frame: 'split' | 'full'`, defaulting to `split` in one place (defaults-with-override).
- [ ] **L3** The pinned summary lives on the section; the index-matched `WHO_WE_ARE_PINNED` array is deleted. `full` beats render their own headline. The point count derives from an explicit field, not `'number' in section`.
- [ ] **L4** `background` is a discriminated union: `none` · `image { src, alt }` · `portfolio { phases, fallback: { src, alt } }`.
- [ ] **L5** `SnapPresentation` stops hard-coding the `minmax(16rem,38%)_1fr` grid and the required `aside`; backgrounds span the whole stage for every frame; the pinned column is a sticky overlay (C23).
- [ ] **L6** Snap invariants kept: `SnapSection` never transformed; inline `scrollMarginTop: 0`; scroll padding stable across frames; keyboard next/prev and `scrollToIndex` unchanged.
- [ ] **L7** `SectionImage` `sizes` matches the full-bleed extent; which container `cqw`/`cqh` measure against is documented.
- [ ] **L8** Layout-only literal unions stay in `features/meeting-flow/types/` (no enum pipeline), like `MeetingStepLayout`.
- [ ] **L9** The presentation primitive stays feature-local and reusable by the Program and Portfolio steps.

### 3.2b Step entrance (new 2026-09-20, C39/C40)

- [ ] **E1** A `MeetingSplashScreen` in `src/shared/components/splash-screen/` — a third entry point beside the proposal and PWA ones, composing the existing `SplashOverlay` + `SplashAnimation`. No fork of the animation.
- [ ] **E2** `SplashOverlay` gains optional `title` and `line` under the mark. Absent = today's behaviour exactly, so the proposal and PWA callers are untouched.
- [ ] **E3** The caption animates **after** the brand mark lands, then the press cue after the caption. Nothing overlaps the `R`'s spring.
- [ ] **E4** Dismiss is **agent-pressed**: the overlay is a real `<button>` filling it, focused on mount, so a click anywhere, `Enter` or `Space` all begin. `Tab` and modifier keys must NOT dismiss it, or focus is trapped on the splash. *Amended 2026-09-22 (spec C §5, review F5/F11):* `F1`–`F12` are not presses either; a capture-phase `window` listener consumes presses before the shell key map; `StageFrame` is `inert` while open; focus returns in `onExitComplete`; the splash mounts beside `StageFrame`, outside the `isolate` wrappers.
- [ ] **E5** Shown **once per meeting**: session key `meeting-splash:<meetingId>`, never the global `app-splash-shown` (`use-splash-visibility.ts:5`), which is one-shot per browser session and would give a second meeting in the same session no splash at all.
- [ ] **E6** Title and line come from `MEETING_STEPS` (`step-config.ts:16`), not restated, so retitling a step cannot leave the splash stale.
- [ ] **E7** Respects `prefers-reduced-motion`: no entrance animation, caption and cue at rest, still dismissed by a press. *Amended 2026-09-22 (review F4):* via `useReducedMotion()` + `initial={false}`; the view's `MotionConfig reducedMotion="user"` alone keeps opacity fades and their delays.
- [ ] **E8** `useSplashVisibility` is **not** reused for this path — it is a timer and E4 is not timed. The meeting splash owns its visibility: `sessionStorage` plus a press.

### 3.3 Hook background

- [ ] **B1** The hook's `background: portfolio` reads the first two `tradeSelections` live through `useTradeSelection()` (set at meeting creation, editable in Specialties).
- [ ] **B2** Trade → scope ids resolve through the construction catalog (today `useTradeCatalog`; later `CatalogIndex`), never inside projects code (C22).
- [ ] **B3** Equal-parts mix of up to two trades in a pure lib: alternate trades, every project's first photo before any second, dedupe (a project in both trades appears once), backfill from the other trade. Caller-side (C18).
- [ ] **B4** Phases come from the section config (C10); default all phases.
- [ ] **B5** The static fallback renders immediately; the grid fades in once its photos have loaded. A failed query, or fewer public cover photos than cells in total, keeps the static image.
- [ ] **B11** Padding (C25): cells the trades can't fill take cover photos (C21) from other public projects, without repeating a project already shown; with zero trades the whole grid is padding. Padding order is settled in the spec. Test projects must not appear (see §4 portfolio data).
- [ ] **B6** One-time staggered reveal (C11); reduced motion respected.
- [ ] **B7** The photo grid is generalized out of `features/project-management/ui/components/portfolio-hero.tsx` into `src/shared/components/` (name at spec time): photos in as props, cell layout in `constants/`, no copy, no window-scroll parallax (inert inside the presentation scroller; opt-in only), gates reduced motion itself. The portfolio page hero is recomposed on it; its copy stays in project-management.
- [ ] **B8** Photos render through `OptimizedImage` (srcSet + blur); no hardcoded R2 domain.
- [ ] **B9** A scrim keeps the hook headline at AA contrast over the grid.
- [ ] **B10** Photo data carries the project `accessor` so a photo can link to `ROOTS.landing.portfolioProject(accessor)` later.

### 3.4 Projects read model and service

- [ ] **R1** The projects entity owns every project read (C13). No project DAL or project SQL in `src/features/`: delete `features/landing/dal/server/projects.ts` and `features/landing/lib/get-trade-images.ts` (inline `db`, `TODO(1f)`).
- [ ] **R2** One list read: `listProjects(ctx, input)` with an exported `projectListFiltersSchema` + `paginatedQueryInput(...)` in `queries.ts` (meetings/proposals pattern); the router imports it; the hand-mirrored `ProjectListInput` interface is deleted.
- [ ] **R3** New generic filter `scopeIds` (any-of, `EXISTS` on `x_project_scopes`) via `buildFilterWhere`. Existing `visibility: 'public' | 'draft'` covers `isPublic`. SQL fragments live in `entities/projects/lib/*-sql.ts` mirroring `customers/lib/derived-pipeline-sql.ts` (no `db` import in `lib/`).
- [ ] **R4** "Projects exclusive to the given scopes first" (today's single-trade priority) is a JIT SQL sort/select fragment (derived-values rule 3), not JS count-matching.
- [ ] **R5** Query toolkit gains a list mode without the count query (`listQueryInput` or `withTotal: false`) in `src/shared/dal/server/lib/query/`, usable by every entity; `query-toolkit.md` updated.
- [ ] **R6** Media read by many projects in the media-files DAL: `listMediaByProjectIds(ctx, { projectIds, phases?, kind: 'image' | 'video' | 'all', perProject? })`, ordered hero → `sortOrder`; the per-project cap uses `row_number()` (first use in the repo — documented).
- [ ] **R7** One cover-image rule (C21) and one `groupMediaByPhase` in entity lib, replacing the four divergent hero choices and the two inline phase groupings.
- [ ] **R8** Projects service `modules/projects/service.ts` (C16, C17): spreads `projectCrud`; verbs compose DAL reads (e.g. list with media); media child service via getter; ctx-first, forwards ctx untouched, returns `DalReturn`, never imports `db`, never reads `ctx.scope`/`ctx.session`, no ctx-dependent caching — so the signature survives #285.
- [ ] **R9** Retire duplicates and dead reads in one non-defensive change: `getPortfolioProjects`, `getPortfolioProjectDetail`, `getAllProjects` + `crud.getAll`, `getProjectScopeCountsByScopeIds`, landing `getPublicProjects` / `getProjectByAccessor` + `landingRouter.projectsRouter` (only consumer is dead UI), `PublicProject` / `ProjectDetail` duplicate types, and the dead `features/landing/ui/components/portfolio/**` + `features/landing/ui/views/portfolio-projects-view.tsx`. Invalidation targets (`use-invalidation.ts:34-35`) repointed.
- [ ] **R10** One public procedure leaf for public project reads on the projects router (replaces `showroomDisplay` + the landing router), a thin `dalToTrpc` adapter over the service.
- [ ] **R11** RSC callers (portfolio detail page, sitemap, services pillar/trade pages, experience view, portfolio proof) call the service. Public, ctx-independent reads may be cached in the service (tags + TTL decided at spec time); `getTradeBySlug` stops computing the whole pillar twice per page.
- [ ] **R12** One trade-matching rule for project reads: catalog-resolved scope ids + exclusive-first ordering. `portfolio-proof.tsx`'s substring match on `hoRequirements` is removed.
- [ ] **R13** Project primitives move out of `features/` into `modules/projects/core/{components,hooks,lib,constants}` (C16): `PortfolioGrid`, `PortfolioProjectCard`, `PortfolioPagination`, `usePortfolioFilters` (URL state becomes a parameter), and the story/media primitives used across surfaces (`StoryGallery`, `PhaseCarousel`, `PhotoLightbox`, `PHASE_LABELS`). Meeting-flow's five imports into project-management internals are gone. The generic photo grid (B7) goes to `src/shared/components/`.
- [ ] **R14** Reads touched by this work are ctx-first + `DalReturn` + explicit return types (`dal-conventions.md`).
- [ ] **R15** Hard-coded portfolio URLs touched by this work use `ROOTS`: `portfolio-proof.tsx:99,113` (`/portfolio/${accessor}` — **404s today**), `experience-project-stories.ts:38`, `sitemap.ts:60`.

### 3.4b Module relocation (C16)

- [x] **M1** `src/shared/entities/projects/` → `src/shared/modules/projects/core/`. `server-spec.ts` moves from `lib/` to the unit root (proposals precedent, ADR-0002 amendment); `DOCS.md` → `modules/projects/core/DOCS.md`.
- [x] **M2** Project media unit → `src/shared/modules/projects/media/` with its own `service.ts`; the cross-owner media plumbing goes to the media module (C24, §3.4c). Entity renamed in code: `media-files` → project media (Q13 decides the table).
- [x] **M3** Root `modules/projects/service.ts` = `{ ...projectCrud, <verbs>, get media() }` `satisfies SpecCrudHandlers<typeof projectServerSpec>`; imported services referenced only at call time (getters / method bodies), per the proposals cycle rule.
- [x] **M4** Every caller goes through the service or unit DAL at the new paths: `projects.router/*` (crud, business, media, the public leaf), `services/media/stores.ts`, `accounting.service.ts`, `upstash/jobs/create-qb-records.ts`, RSC pages, sitemap.
- [x] **M5** All importers of `@/shared/entities/projects` and `@/shared/entities/media-files` (60 files in `src/` + `scripts/` at `dd2ba19d`) repointed in the same change; no re-export shims, aliases or dual paths (non-defensive).
- [x] **M6** The move commit is proven path-only (path-normalized diff against its parent), compiles, and passes `pnpm tsc` + `pnpm lint`; behavior changes (read model, S1 projection, consumer migrations) land in separate commits — the proposals move recipe in memory `project-proposals-module-move-audit`.
- [x] **M7** Land the move before the main ↔ #285 sync (C20); record the four #285-edited files (`media-ops.ts`, projects `queries.ts`, `server-spec.ts`, `visibility.ts`) in `docs/plans/2026-09-13-main-285-sync-plan.md` so the sync resolves them at their new paths.
- [x] **M8** Path references updated wherever `entities/projects` / `entities/media-files` are cited (grep at `dd2ba19d`): `docs/codebase-conventions/dal-conventions.md`, `docs/permissions/visibility-rules-catalog.md`, `src/shared/entities/projects/DOCS.md` (moves with M1), `src/shared/services/media/DOCS.md`, `src/shared/lib/file-optimization/DOCS.md`; memory `project-entity-model`, `project-media-service-dal-compliance`, `project-agent-dashboard`, `project-projects-standardization-epic`, `project-media-foundation-epic`, `pattern-visibility-scoping`, and `coding-conventions.md` Rule 20. Dated specs and plans stay as written. The construction catalog design is another session's document: report its references, don't edit them.

### 3.4c Media module (C24)

**Target shape**

```
src/shared/modules/media/                 generic media capability, owns no table
├── service.ts                            THE media service (moved from services/media/media.service.ts)
├── DOCS.md                               moved from services/media/DOCS.md, rewritten
└── core/                                 unit so its DAL sits on the modules/*/*/dal allowlist
    ├── types.ts                          MediaStore — an open owner descriptor, no owner imports
    ├── dal/server/media-ops.ts           listMediaByOwner, reorderMedia (table-generic)
    ├── dal/server/optimization.ts        optimization status setters (table-generic)
    └── lib/                              image-variants.ts, process-image-variants.ts, optimize-media.ts
src/shared/modules/projects/media/        project media unit (today's entities/media-files)
├── service.ts                            spreads projectMediaCrud; generic ops via the media service; phase, hero, importFromProposal
├── store.ts                              projectMediaStore (table, ownerColumn, bucket, crud, buildPathKey, variants)
├── server-spec.ts                        projectMediaServerSpec (parent: projectServerSpec)
├── dal/server/{crud,mutations,queries}.ts
└── lib/                                  cover-image rule (C21), groupMediaByPhase (R7)
src/shared/modules/proposals/media/store.ts   proposalMediaStore moves here from services/media/stores.ts
```

- [x] **MD1** Create `src/shared/modules/media/` as above. Its root `service.ts` is the moved `mediaService` (`buildUploadTarget`, `createRecord`, `removeRecord`, `reorder`, `list`, `retryOptimization`, `optimizeNow`); every method takes the owner's `MediaStore`. `services/media/` is deleted.
- [x] **MD2** Dependency direction is owner → media only. The media module imports no owner table, CRUD, or owner-kind union: the closed `MediaOwnerKind` union, `services/media/stores.ts` and `services/media/optimization-target.ts` are deleted (the latter also removes a raw `db` import from the service layer).
- [x] **MD3** Each owner unit exports its own store: `modules/projects/media/store.ts`, `modules/proposals/media/store.ts`. Owner-keyed variant lists (`VARIANT_REGISTRY.project` / `.proposal`) move onto the store as `variants`; the media module keeps only the generic `VARIANT_OPTIONS`, `VARIANT_WIDTH` and fallback list.
- [x] **MD4** The optimization job (`upstash/jobs/optimize-media.ts`) is the composition root (C27): it maps `ownerKind` → owner store and passes the store to the media module; payload unchanged.
- [x] **MD5** The media service owns only cross-owner concerns: upload targets and path keys (via `store.buildPathKey`), R2 object + variant cleanup, optimization dispatch and status, reorder, list. Plain CRUD (rename, get) comes from the owner service's spread CRUD slots; `mediaService.rename` is removed.
- [x] **MD6** Project-only operations live in the project media unit, never the media service: `moveMediaPhase`, `setHeroImage`, `importFromProposal`, `listMediaByProjectIds` (R6), cover-image rule (C21), `groupMediaByPhase` (R7).
- [x] **MD7** Every media R2 cleanup and path key goes through one owner-agnostic helper that takes the owner store's variant list (`modules/media/core/lib/purge.ts`, a leaf importing only `r2Client`). Its callers are the two media units' `delete.before` hooks (C32) and the project delete hook (`entities/projects/dal/server/crud.ts:25-35`, moving to `modules/projects/core/dal/server/crud.ts`) keeps purging inside `delete.before` (C31) but calls the same helper and reads its rows through the media module's table-generic DAL instead of inline `db`. `projects.router/media.router.ts:141` stops hard-coding the `projects/<id>/uncategorized/` key; the google-drive router and scripts (`add-during-media.ts`, `portfolio-scraper/import-project.ts`) build keys from `projectMediaStore`.
- [x] **MD8** Bug: `r2/client.ts:63` `VARIANT_SUFFIXES = ['sm','md','lg']` has no `xs` (`VARIANT_REGISTRY.proposal` writes `xs`), so deleting proposal media orphans `-xs.webp` objects. The provider is a leaf and can't import app variant lists: the media service passes the store's `variants` into the R2 delete call, so the provider deletes exactly the suffixes that owner writes.
- [x] **MD9** Code rename of the project media entity: `mediaFiles` → `projectMediaFiles`, `MediaFile` → `ProjectMediaFile`, `insertMediaFilesSchema` / `InsertMediaFilesSchema` → project names, `mediaFileCrud` → `projectMediaCrud`, `mediaFileServerSpec` → `projectMediaServerSpec`, `MEDIA_FILE` → `PROJECT_MEDIA_FILE` (no CASL grant references it), schema file `media-files.ts` → `project-media-files.ts`. Table name stays `media_files` (C26). tRPC paths (`projectsRouter.media.*`) unchanged.
- [x] **MD10** Shared libs point at the module: `shared/lib/file-optimization/*` and `shared/lib/get-optimized-urls.ts` import variants from `modules/media/core/lib`. `OptimizedImage`, `shared/components/media/*` and `get-optimized-urls.ts` stay where they are (already neutral).
- [x] **MD11** #285 alignment: #285 adds table-generic `movePhase` / `setHero` to `media-ops.ts` and the media service, which C24 rules out. The sync takes main's shape (project media unit) and ports #285's scoping (`requireResolvedScope`, `inArray` update, bounded unset) into `modules/projects/media/dal`. Record this in `docs/plans/2026-09-13-main-285-sync-plan.md` (conflict #10). #285 references `mediaFileServerSpec` by name (MD9 rename).
- [x] **MD12** Media business rules (C30): no behavior change. Proposal delete keeps not purging R2; `importFromProposal` keeps not checking visibility. Note added where the proposal delete hook would go (2026-09-14). The media module must not make a purge-on-delete for proposals look intended (MD5, MD7 cover project delete only).
- [x] **MD13** Deprecated project-bound media code is deleted with the move: `shared/hooks/use-media-upload.ts`, `shared/components/portfolio/*` (no importers).
- [x] **MD14** Media row lifecycle on hooks (C32): `create.after` dispatches the optimize job, `delete.before` purges through the MD7 helper, on both media units; each unit's `ownerKind` + `variants` live in a leaf constants module the store also reads, so a hook never imports its store. `MediaStore.crud` becomes a getter — the hook makes the unit's CRUD import the optimize job, which imports the stores, which import the CRUD, and a plain property is read during module init (TDZ `ReferenceError`). Precedent for both halves: `entities/meetings/dal/server/crud.ts` dispatches five jobs from `create.after`/`update.after`; `modules/proposals/service.ts` already uses the getter for the same TDZ reason. Record the pre-commit caveat (a threaded `ctx.tx` makes the dispatch fire before commit) in each unit's DOCS, as meetings does.

### 3.5 Security

- [ ] **S1** 🚨 Public procedures (`showroomDisplay.getAll`/`getDetail`, `landingRouter.projectsRouter.*`) return full `projects` rows to anonymous visitors — `address`, `zip`, `customerId`, `ownerId`, `qbSubCustomerId`, `pipelineStage`. One entity-owned public projection; every public read selects only it.
- [ ] **S2** Public reads run on `SYSTEM_CONTEXT` and apply `visibility: 'public'` explicitly, never relying on scoping (C28).

### 3.6 Docs

- [x] **K1** Stale references fixed 2026-09-14: `environment.md` (`publicUrl`), `ubiquitous-language.md` (derived project status), `projects/DOCS.md#migration-status`, `visibility-rules-catalog.md` (sub-entity specs), `DESIGN.md` + `anti-slop-checklist.md` (reduced-motion gate), `llm-citation-strategy.md` (author template), `scrim.tsx` comment; memory: url helpers, push notifications, company data ref, projects standardization, CASL compiler, MEMORY.md index, who-we-are presentation.
- [x] **K2** `service-architecture.md`: amend `#the-deciding-question` per C17. Write the definition of `modules/` (C16, C24) — it must cover three kinds seen so far: a module with its own tables (proposals, projects), a provider-backed module with no tables yet (construction), and a capability module generic over other modules' tables (media, whose DAL takes the table as a parameter): what a module and a unit are, root vs unit `service.ts`, `server-spec.ts` at the unit root, the getter/call-time rule for child services, `modules/*/*/dal` on the `db` allowlist (`dal-conventions.md`), and the entities-vs-modules choice. Today it exists only as the `modules/proposals/service.ts:1-36` comment and one line in `ubiquitous-language.md`.
- [ ] **K3** `query-toolkit.md:64-71` shows `paginate({ query: db.select()… })`; code requires thunks. Document R5.
- [ ] **K4** `dal-conventions.md`: `:170` says `after` hooks return `Promise<void>` (they thread the row, `types.ts:83`); `:171` "never naked `db` in hooks" vs `projects/dal/server/crud.ts:26`; `:58` calls `buildUserContext()` future (exists, `helpers.ts:98`).
- [ ] **K5** `projects/DOCS.md`: `:124` puts the `excludePortfolio` predicate in `crud.router.ts` (it's `queries.ts:218`); `:58,63,191-192` link `../proposals/DOCS.md` (now `modules/proposals/core/DOCS.md`). Add public reads, projection, scope filters, cover-image rule, media read.
- [x] **K6** ADR-0003: `:25` "Receive `AuthedContext`" (code: `ScopedContext`); `:56` two-way deciding question (doc has four branches + router carve-out); `:95` classification list omits newer services/providers and module services. ADR-0002 `:195` cites `buildSessionContext(spec)` (doesn't exist).
- [x] **K7** Memory `coding-conventions.md`: Rule 12 (entities import only enums — they import `db`, DAL, other specs), Rules 15/19 (`modules/*/*/dal` missing from the `db` allowlist; cite `entities/proposals/dal`), Rule 19 (`accounting.service` listed as a violation — fixed 2026-08-20), Rule 20 (proposals listed as an entity). `feedback-entity-organization.md:12` cites `entities/proposals/core/`. `project-permissions-casl-compiler.md` describes `actor` on `ScopedContext` as if on main (worktree only).
- [ ] **K8** Create `src/features/meeting-flow/DOCS.md`: trade source for the hook, 2-trade mix, fallback, section frame rules.
- [x] **K10** Media docs: `services/media/DOCS.md` moves into the module and is rewritten — today `:37-43` omits the store's `crud` field and types `ownerColumn` as `any` (code: `PgColumn`), `:5-7` says a new owner is "store + DAL" (code also needs `optimization-target.ts`, `VARIANT_REGISTRY`, the owner-kind union), `:96` shows `optimizeFile(buffer, mimeType)` (code takes a third `variantSuffixes` arg). `service-architecture.md:281` shows `optimizeImageJob.dispatch({ mediaFileId })` (code: `optimizeMediaJob.dispatch({ ownerKind, mediaId })`). `modules/proposals/core/DOCS.md:390` cites `dal/server/authz.ts` (doesn't exist). Memory: `project-media-service-dal-compliance` (claims the service layer is `db`-free; `optimization-target.ts:4` imports `db`), `project-proposal-media-subsystem` (old `entities/proposal-media-files` paths, `assertProposalMediaInScope` → `assertParentVisible`), `project-r2-cdn-domain-swap` (`tpr-portfolio-projects` domain key gone), `project-media-foundation-epic` (`xs` never added to the R2 delete list).
- [ ] **K9** When round 2 ships: update the round 1 spec status, `project-who-we-are-presentation` memory, entity DOCS for R-items.

### 3.7 Verification

- [ ] **V1** `pnpm tsc` and `pnpm lint` clean (no `pnpm build`).
- [ ] **V2** Pure libs (mixer, exclusive-first ordering, cover-image rule, `groupMediaByPhase`) verified with a scratch script against fixed inputs — the repo has no unit test runner.
- [ ] **V3** DAL reads checked against the dev DB: `scopeIds` + exclusive-first returns the same ranking as today's `getTradeImages` for sample trades; the public projection contains no S1 columns.
- [ ] **V4** Screenshots of every beat at 1440×900, 1280×800, 1024×768 (sidebar open), 820×1180, and present mode at 1440 and 1180, with freshly compiled CSS (restart `pnpm dev`).
- [ ] **V5** Hook background with meetings holding 0, 1, 2 and 3 trades, a trade with few photos, and reduced motion on.
- [ ] **V6** Public surface regression: portfolio list and detail, services pillar and trade pages, sitemap, experience page, funnel portfolio block and carousel, meeting-flow portfolio step.
- [ ] **V7** Re-run `/impeccable critique` on Who We Are; compare against 16/32.

---

## 4. Adjacent — tracked elsewhere, not this round

- **Construction catalog design** (`docs/plans/2026-09-14-construction-catalog-centralization-design.md`): `constructionService` + `CatalogIndex`; `filterProjectsByTrade`; the three copies of trade-name resolution in project components; `TRADE_PHOTOS` / `SCOPE_PHOTOS` retirement (#243, #244); `notionRouter` public reads uncached.
- **#285 permissions**: public read stance (C28: pick (a) `systemContext('public:portfolio')` or (b) an anonymous `isPublic` rule; the 2026-08-11 ruling that `isPublic` is a display filter, not authz, points to (a)); main ↔ #285 sync ordering (C20); `crud.getForEdit` unscoped; project media router still on bare `agentProcedure`; `get-customer-pipeline-items.ts:344-371` hand-rolled project visibility (`ownerId OR isPublic OR participant`) vs `projectVisibility`.
- **Inline `db` outside a DAL**: `customer-pipelines.router.ts:106-109` + `get-customer-profile.ts:211-221` (duplicate project reads), `lead-sources.router.ts` analytics (also counts pure-portfolio projects), `upstash/jobs/create-qb-records.ts:10` (duplicates `projectCrud.getById`), copied `EXISTS projects` SQL in `customers/lib/{signed-customer-sql,derived-pipeline-sql}.ts`.
- **`--ease-brand` literal copies** (U14 adds the shared constant; moving these onto it is a follow-up): `shared/components/decor/decor.tsx:64`, `shared/domains/funnels/constants/funnel-motion.ts:11`, `shared/domains/funnels/ui/steps/confirmation-step.tsx:27`, `shared/domains/multi-step-flow/constants/step-motion.ts:4`, `app/(frontend)/test/page.tsx` (three).
- **Media business rules (C30)**: revisit proposal-delete R2 purge and import visibility; both were ruled in a hurry.
- **Dead code outside R9**: deprecated `src/shared/components/portfolio/*` + `src/shared/hooks/use-media-upload.ts`; `proposal-flow/.../related-projects.tsx` reads seed data instead of projects.
- **Owner tasks**: sample scope PDF → R2 (round 1 spec §4); team photo shoot; `team-members.ts` headshots (four point at a nonexistent `/company-info/` folder with mismatched names); `warranties-and-trust.md` / `competitive-advantage.md` placeholders; `post-signing-sequence.md` Day-1 PM handoff.
- **Portfolio data (owner tasks, found 2026-09-14 on the dev DB)**: two test projects, `🧪 Crucible` and `🧪 Alchemy`, are `is_public = true` with no scopes — check prod before any public portfolio work ships. The photo sets named in `TRADE_PHOTOS` / `SCOPE_PHOTOS` alt text (Monique, Riviera, Olympia, Atlas, Altura, Bliss) are not projects in the database, so trades like Pool Remodel and Tile have zero tagged projects. Most-picked trades (Exterior Upgrades, Roof, Exterior Paint) have 1–3 public projects — importing or tagging more portfolio projects is what makes a trade-matched background rich (see Q8).
- **Round 1 follow-ups**: narrow the global `* { scroll-margin-top: 80px }` rule to the marketing site; header crowding ≤1024 on meeting-flow steps.
