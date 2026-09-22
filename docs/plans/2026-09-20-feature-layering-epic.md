# Feature Layering — Epic Tracker

> **Status:** 🔍 **EXPLORATION.** Nothing decided, nothing specced, nothing built. **This file is the grilling agenda** — §2 is the point of it. Requirements in §3 are *proposals* that only become real once the decision they hang off is settled in §2.
> **Started:** 2026-09-20. **This file is the live index** once decisions land — update it, cite its IDs in specs, plans and commits.
> **Baseline:** `main` at `12cd3ab3` (94 commits ahead of `origin/main`, unpushed).
> **Goal in one line:** the older `features/` (meeting-flow first) stop owning logic that belongs to a module or an entity, so a concern is defined once, co-located with the data it describes, and a feature is only presentation + choreography.
> **Evidence:** five parallel read-only audits, 2026-09-18 — specialties ownership inventory, target-module surface survey, non-specialties meeting-flow audit, cross-codebase duplication hunt, meeting-flow server-path audit. Findings with file:line are in §5; nothing in this file rests on a claim that isn't there.

**Adjacent, owned elsewhere — do not duplicate:**
- `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` — **spec B** owns the projects read model, the public projection (**S1**), the `scopeIds` filter (**R3**), the cover-image rule (**R7/C21**) and the portfolio-primitive relocation (**R13**). Its requirements froze 2026-09-14; the specialties showcase machinery landed 2026-09-15/16 and is **not** in them. See **D5**.
- `docs/plans/2026-09-15-construction-data-standardization-epic.md` — owns trades/scopes/pairings/outcomes/taxonomy/pain points, the `TradeScopeRow` consolidation (**F13**), slug identity (**C2/D2**), and the Energy Saver fix (**P0**, **V4**). Its **C4** says the specialties build finishes on the current structure and migrates afterwards — this epic is part of that "afterwards".
- **#285 permissions** — the public-read stance. **#195** — construction data in Postgres.
- The specialties round-2 build (`docs/superpowers/plans/2026-09-14-specialties-stage-and-rail.md`) — **not closed out**; see **H1**.

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⚠️ blocked on a §2 decision · 🆕 not covered by any existing epic.

---

## 0. Epic structure (proposed — **D5** decides whether this epic exists at all)

| Phase | Scope | Owns | Blocked by |
|---|---|---|---|
| **L0** | **Free wins** — delete dead code, collapse byte-identical duplicates, fix the shallow pass-throughs. No new abstractions, no moves between layers. | B1–B5 · F14 | — |
| **L1** | **Display-media seam** 🆕 — the one piece of architecture `modules/media` is missing. Retires the feature-local `ShowcaseMedia` union and the branch repeated at three render sites. | F1–F4 · A1, A2 | D1, D2 |
| **L2** | **Showcase read model** — fold the specialties consumer into spec B rather than duplicating it. | F5–F7 | D3, D5 · spec B |
| **L3** | **Media-selection policy** 🆕 — separate catalog lookup / projects lookup / sales precedence so the precedence rule is verifiable. | F8–F10 | D4 · L1, L2 |
| **L4** | **Co-location & structure** 🆕 — `types/index.ts`, `trade-selection.ts`, feature-boundary hygiene. | F11–F16 · A3–A5 | D7, D8 |

**Order:** L0 anytime (independent). Then L1 → L3; L2 runs inside spec B, not here. L4 anywhere after L0. **V1** (`pnpm tsc` + `pnpm lint`) gates every phase.

---

## 1. Decided (owner)

| ID | Decision | Date |
|---|---|---|
| **D11** | **Energy Saver fix ships in construction P0, not here** — option (a). P0 already owned it and its **V4** already asserted the fix; it shipped in the P0 plan's Task 6, commit `c4d733c0` ("fix(meeting-flow): Energy Saver+ can qualify again"). | 2026-09-20 |

The rest of this epic has not been grilled yet. Every other row moves here from §2 with a date once settled.

---

## 2. Open decisions — **the grilling agenda**

| ID | Question | Options | Recommendation |
|---|---|---|---|
| **D1** | Where does the **display-media seam** live? `modules/media` is server-only today (`MediaStore` = table + bucket + crud + variants). The one client primitive, `OptimizedImage`, structurally cannot express a static `public/` path. | (a) a client subpath inside `modules/media/core/` · (b) a new `modules/media/display/` unit · (c) extend `shared/components/media/` (already a DI area with render-props, per `media/DOCS.md#shared-ui-is-dependency-injected`) · (d) don't build it — the union stays in the feature | **(b)** — `shared/components/media/*` is a *management* surface (upload/reorder); this is a *presentation* concern. A named unit keeps `media/DOCS.md`'s "no owner imports" rule intact and gives the third arm (`provider:'stream'`) somewhere to land. |
| **D2** | What **shape** is the display-media reference? | (a) a discriminated union over source kind, like today's `ShowcaseMedia` but shared · (b) the module resolves everything and hands back a flat view-model (`src`/`srcSet`/`blur`/`alt`), so callers never branch · (c) component-only seam, no shared type at all | **(b)** — it removes the branch instead of relocating it, and is the only option where adding a source kind touches zero call sites (OCP). Costs a resolve step and hides `next/image`'s optimizer for static assets — grill that trade. |
| **D3** | Is `ShowcaseProject` just **spec B's public projection** under another name? It flattens `PortfolioProject` to six fields precisely to keep ~40 operational columns out of the render path — which is what **S1** exists to do. | (a) yes — one projection, owned by `modules/projects`, and spec B absorbs this consumer · (b) no — the showcase needs its own narrower type on top of the public projection · (c) the showcase consumes `PortfolioProject` directly and we accept the columns | **(a)** — two types for one job is how they drift. Requires reopening spec B's consumer list, which froze before this consumer existed. |
| **D4** | Who owns **"pick photos for a trade"**? The chain mixes a catalog lookup, a projects lookup, and genuine sales precedence (curated wins; borrow-and-cycle so no two cards repeat). | (a) `modules/projects` owns a trade→photos read, catalog ids passed in · (b) a composition lib in `shared/` · (c) stays in meeting-flow, over injected lookups | **(c)**, for consistency: the meeting-flow epic's **C18** already decided the analogous question for the hook mixer — "the two-trade mix happens caller-side in a pure lib; the projects API stays trade-agnostic." Deciding (a) here would contradict C18 and should be argued as such. |
| **D5** | **Does this epic exist**, or do its items get folded into the two live epics? Roughly half of §5's findings are already owned by spec B or the construction epic. | (a) fold everything in; open nothing new · (b) this epic owns only the genuinely-new items (🆕) and explicitly defers the rest · (c) this epic supersedes and absorbs spec B | **(b)** — spec B and the construction epic are mid-flight with frozen IDs; absorbing them invalidates work. But the 🆕 items have no home and will otherwise rot. |
| **D6** | Do **project / media / showcase** become defined terms in `CONTEXT.md`? The glossary defines Trade and the funnel/VoIP vocabulary but has no entry for any of them, and L1 would name a module after one. | (a) add Project, Media, Showcase · (b) avoid "showcase" — say Portfolio, which the code already uses · (c) leave the glossary alone | **(b)** then **(a)** — the code says `portfolio` on the server and `showcase` in the feature for the same thing. Pick one word before naming a module after it. |
| **D7** | How far does **co-location** go for `types/index.ts` (343 lines, five unrelated domains, imports `ProjectMediaFile` straight from `@/shared/db/schema`)? | (a) split per concern inside the feature · (b) push each type to the module that owns it; keep only feature-local types · (c) leave it | **(b)** for the ~8 types that belong elsewhere, **(a)** for the remainder. (c) is defensible if L1/L2 already remove the worst offenders — grill whether the rest is worth the churn. **Partial via construction P2 (2026-09-22):** `TradePairing` (`types/index.ts:265`) leaves for the module's `core/constants/trade-pairings.ts`; the rest of D7 is untouched. |
| **D8** | How does `trade-selection.ts` split? Note the two live epics **already answer different halves**: construction **F14** puts the shared reducers in `entities/meetings/lib/`, while its **C3** says the write policy and `isTradeSelected` "stay in meeting-flow and are never generalized". Both are right about their own subset; the 127-line file is simply undivided. | (a) split now along the F14/C3 line · (b) leave it to construction P4, which owns F14 · (c) split the file in place without moving anything yet | **(b)** with a pointer from here — P4 owns it, and doing it twice is worse than doing it late. |
| **D9** | Is the **`flowStateJSON` single-blob write path** in scope? `tradeSelections`, `selectedProgram`, `dealStructure`, `closingAdjustments` and `currentStep` share one JSONB column; every write read-modify-merges the whole blob, so two steps writing concurrently race. Same class as the lost-update risk the 2026-09-16 audit caught. | (a) out of scope — data-model question, its own epic · (b) in scope, documented as a hazard only · (c) in scope, split the blob | **(b)** — record it as **H2** so it stops being rediscovered, and don't touch persisted shape in a layering epic. |
| **D10** | Which **features** are in scope? The duplication evidence spans meeting-flow, project-management and landing, which share the portfolio stack three ways. | (a) meeting-flow only · (b) scope by *capability* (portfolio view, display media, trade catalog) across whatever features touch it · (c) every feature | **(b)** — "move it out of meeting-flow" without a destination just relocates the problem; the destination is what the capability's owner module should expose. |

---

## 3. Requirements (proposed — each is ⚠️ until its §2 decision lands)

### 3.1 Display media (L1) ⚠️ D1, D2 🆕

- [ ] **F1** One shared way to reference an image that may be either a managed media row or a static asset. Nothing above the seam branches on which it is.
- [ ] **F2** The `kind === 'project' ? <OptimizedImage> : <Image>` branch exists in exactly zero feature files (today: three — §5.1).
- [ ] **F3** `ShowcaseMedia`, `TradePhoto`, `curatedMedia()` and `projectMedia()` are deleted from the feature, not re-exported. Non-defensive, per `feedback-non-defensive-migrations`.
- [ ] **F4** The seam accommodates a `provider: 'stream'` row (null `pathKey`/`bucket` by design, per `media/DOCS.md`) without a new branch at any call site.

### 3.2 Showcase read model (L2 — inside spec B) ⚠️ D3, D5

- [ ] **F5** One project projection for public/homeowner-facing surfaces, owned by `modules/projects`, reused by the showcase. Folds into **S1**.
- [ ] **F6** The trade/scope project index is a server read model, not browser work over the full portfolio. Folds into **R3**.
- [ ] **F7** The specialties step and the portfolio step stop issuing two separate full-portfolio reads. Spec B's **R10** consumer list is amended to include both.

### 3.3 Media-selection policy (L3) ⚠️ D4 🆕

- [ ] **F8** The borrow-and-cycle precedence rule is a pure function over injected lookups — drivable from fixed inputs by a scratch script (the **V2** pattern; no test runner in this repo).
- [ ] **F9** "A cover photo for this trade" is a distinct lookup from "every photo for this trade". `TradeThumb` stops building the full de-duplicated list to render a 40px square (§5.4).
- [ ] **F10** Curated-photo lookup is keyed on a stable identifier, never a display name (§5.6). Coordinates with construction **C2/F12**.

### 3.4 Co-location & structure (L4) ⚠️ D7, D8 🆕

- [ ] **F11** No file under `src/features/meeting-flow/` imports from another `src/features/*` (today: 6 sites — §5.3).
- [ ] **F12** No UI type file imports from `@/shared/db/schema` (today: `types/index.ts:3`).
- [ ] **F13** `types/index.ts` no longer holds types for five unrelated domains.
- [ ] **F14** Dead and pass-through modules deleted: `deriveLeadTrades` (zero callers, verified), `findStageMedia`, `formatWorkSummary`, `formatProjectCaption`, `isEnergyEfficientTrade`, and `loan-calc.ts::formatCurrency` (byte-identical to `formatAsDollars`). *(L0 — needs no decision.)* **`isEnergyEfficientTrade` → construction P2** (spec `docs/superpowers/specs/2026-09-22-construction-p2-rules-and-identity-design.md` §4.4): the feature copy at `meeting-flow/constants/energy-trades.ts` is deleted and `programs.ts` imports the module's predicate. The other five items stay here.
- [ ] **F15** The proposals invariant at `build-proposal-defaults.ts:49-57` ("only positive incentive amounts become `discount` entries", spec Addendum A #256) lives in `modules/proposals`.
- [ ] **F16** "This customer's pain points" (`build-persona-profile.ts:37-65`) is a derived value on the customers entity, not an accessor→record join re-implemented per caller.

### 3.5 Architecture & conventions

Cite `doc#anchor`; verify against code before quoting (CLAUDE.md trust-but-verify).

- [ ] **A1** `shared/` never imports `features/`; cross-feature imports only through public entrypoints — construction epic **A7**.
- [ ] **A2** The media module takes no direct owner dependency — `modules/media/DOCS.md#media-module-takes-no-direct-owner-dependency`. Any display seam must preserve this.
- [ ] **A3** Frontend rules — `frontend-stack.md#one-react-component-per-file`, `#named-exports-only`, `#no-component-file-constants-or-helpers`, `#no-barrel-files-in-ui`.
- [ ] **A4** The entity/module service is the one server API — meeting-flow epic **C17**, `service-architecture.md#the-deciding-question`.
- [ ] **A5** Business rules documented with slug anchors in the owning module's `DOCS.md`; in-code refs use `// see <path>/DOCS.md#slug`.

**The recurring violations, in the terms the owner asked for:**

| Principle | Violation in evidence | IDs |
|---|---|---|
| **SRP** | `types/index.ts` = 5 domains; `trade-selection.ts` = reducers + predicates + write policy in one file | F13, D8 |
| **OCP** | adding a media source kind edits three render sites | F1, F2 |
| **DIP** | features depend on Notion provider types (a concretion) rather than domain types — 17 sites in the specialties step alone | construction **F1** |
| **ISP** | `TradeThumb` must depend on "all media for a trade" to get one photo | F9 |
| **DRY** | the verified duplication table — §5.5 | construction epic |

### 3.6 Verification

- [ ] **V1** `pnpm tsc` + `pnpm lint` clean. **Never `pnpm build`.**
- [ ] **V2** Pure functions verified by a throwaway `scripts/tmp-*.ts` against fixed inputs — this repo has no unit-test runner by design.
- [ ] **V3** Grep gates per phase: zero `media.kind ===` in `features/` (L1) · zero `@/features/` imports inside meeting-flow (L4) · zero `@/shared/db/schema` imports in a UI type file (L4).
- [ ] **V4** Browser check of the specialties stage and portfolio step after L1–L3: stage photo, work-card photos, proof strip, trade thumbs, fallback — at 1440 and 820, present mode included.
- [ ] **V5** No public payload regression: the projection shipped to an unauthenticated caller contains none of **S1**'s columns.

### 3.7 Out of scope

Visual redesign of any surface · the trade/scope catalog itself (construction epic) · persisted JSONB shape changes (**D9**) · the permissions stance (#285) · `pnpm build` · pushing `main`.

---

## 4. Bugs & hazards (stable IDs — cite these)

- [x] **B1** 🚨 **Energy Saver could never qualify.** `programs.ts:15` filtered via `isEnergyEfficientTrade(t.tradeId)`; `tradeId` was a Notion page UUID (`trade-selection.ts:68`), compared against `['insulation','hvac','windows','solar']` (`enums/meetings.ts:146`) — never matched. The list was *separately* wrong: real seeded accessors are `atticBasement`, `hvac`, `windowsAndDoors`, `solar` — so `'insulation'` and `'windows'` matched nothing in any identifier space. Every meeting showed "Requires at least 1 energy-efficient trade" regardless of selection. Working predicate already existed: `trade.type === 'Energy Efficiency'` (`landing/lib/notion-trade-helpers.ts:15`). **Fixed in construction P0 Task 6, commit `c4d733c0`** — see **D11**.
- [ ] **B2** 🚨 **`showroomDisplay.getAll` is `baseProcedure`** — no auth, no permission check — and `getPortfolioProjects()` selects the whole `projects` row (`customerId`, `ownerId`, `qbSubCustomerId`, `pipelineStage`, `hoRequirements`, `backstory`) with no `LIMIT`. Tracked as **S1**, but the specialties round-2 build raised the exposure: that payload now reaches a screen **turned toward the homeowner during a live in-home meeting**, and is fetched twice.
- [x] **B3** **Notion catalog reads are public, uncached and capped.** `notionRouter.trades.getAll` / `scopes.getAll` are `baseProcedure`; the 180s `unstable_cache` covers only the landing path; `queryNotionDatabase` passes no cursor, so results silently truncate at ~100 rows. A live meeting hits the Notion API directly on every 30s-stale refetch. Construction **F3/F6**. **Closed 2026-09-22 — shipped by construction P0 + P1:** reads paginate (`12cd3ab3..7aadc735`), `notionRouter` is deleted and `constructionRouter` reads through `constructionService`, one `unstable_cache` tag at 600s covering every path (`616465a7..086148e2`; rules at `modules/construction/DOCS.md#one-cache-tag`, `#reads-paginate`). The procedures remain `baseProcedure` by design — public catalog, now cached — so the *exposure* half of this item is resolved, not the auth half; auth was never the ask here.
- [ ] **B4** **Trade-name drift has a live failure.** `persona-profile-maps.ts:54,127` keys templates on the literal `'Kitchen Remodel'`; two lead-ingest paths write `'Kitchen Renovation'` (`funnels/constants/trade-facts.ts:21`, `gohighlevel/lib/normalize-bina-lead.ts:47`). Those leads silently get no persona template. Construction **F18/A11**. **Delivered by construction P2** (spec §4.7-B, §4.7-D, 2026-09-22): persona maps rekey by `TradeSlug`, and lead names resolve from the catalog in `ingestLead` — both ingest paths stop writing `'Kitchen Renovation'`. Tick when P2 ships.
- [ ] **B5** **`SCOPE_PHOTOS` is keyed on `scope.name`** while scopes carry a stable `id` used everywhere else in the same file. A Notion rename drops the photo with no type error and no warning — the card quietly borrows a neighbour's. Construction **F12**. **Delivered by construction P2** (spec §4.7-B): `SCOPE_PHOTOS` rekeys by scope id and `scripts/verify-catalog-keys.ts` asserts every key is live. Tick when P2 ships.
- [ ] **H1** ⚠️ **The specialties round-2 build is not closed out.** Its SDD ledger's last entry dispatches task **V1** (verification gaps E2/E3 + the render-budget gate) at base `9ffe6692`; it never reported. Open checks: G1–G5, W1–W2, `twoGetsPerSave === 2`. **Resolve before refactoring the surface those checks were meant to verify.**
- [ ] **H2** **`flowStateJSON` read-modify-merge.** One JSONB column holds `tradeSelections`, `selectedProgram`, `dealStructure`, `closingAdjustments`, `currentStep`; every write merges the whole blob, so concurrent steps race. Hazard only — see **D9**.
- [ ] **H3** **Render budget.** The specialties surface has a measured behavioural budget (~403 renders/toggle, 2 GETs/save). Any L1–L3 change must be re-measured with `$WS/tools/measure-stage.mjs`, not assumed neutral.

---

## 5. Evidence (file:line — audits of 2026-09-18, verified against `12cd3ab3`)

### 5.1 The display-media branch, three sites
`types/index.ts:302` defines a two-arm union: `{kind:'project', file: ProjectMediaFile}` vs `{kind:'curated', photo: TradePhoto}`. The branch is repeated at `specialties/showcase-media.tsx:30`, `specialties/work-card.tsx:31-32`, `trade-thumb.tsx:22-23`. A repo-wide search for a shared `MediaSource`/`ImageSource` union returns nothing. **Deletion test: delete the union and complexity reappears at three sites — it earns its keep, in the wrong module.**

### 5.2 Four media view-models, hand-adapted
`ProjectMediaFile` (DB row) · `MediaFileInput` (`shared/lib/get-optimized-urls.ts`) · `MediaItem` (`shared/components/media/types.ts`) · `ShowcaseMedia` (feature). Adapters: `toItems()` at `proposal-flow/.../proposal-media-manager.tsx:24`, `toMediaItem()` at `project-management/.../project-media-manager.tsx:223`. `ShowcaseMedia` is the only one that can name a non-R2 image.

### 5.3 Cross-feature imports from meeting-flow (6)
`steps/portfolio-step.tsx:8,9,10` → `project-management/{hooks/use-portfolio-filters,ui/components/portfolio-grid,ui/components/portfolio-pagination}` · `steps/trade-project-grid.tsx:7,8` → the same grid + pagination · `ui/components/table/index.tsx:8,9` → `customer-pipelines/ui/components` · `lib/to-calendar-event.ts:3` → `schedule-management/types`. Transitively pulls in `project-management/lib/filter-projects.ts`. Two independent audits ranked this their #1 finding. Tracked as **R13**, whose scope is narrower than the real graph.

### 5.4 Client-side work a read model should do
`portfolio-step.tsx:43-45` filters the whole portfolio by scope intersection per render · `portfolio-step.tsx:57` → `use-portfolio-filters.ts:101-119` filters *and paginates* the full list on every keystroke, while server-side `listProjects` pagination exists unused at `modules/projects/core/dal/server/queries.ts:197` · `use-showcase-projects.ts:24` → `index-showcase-projects.ts:16-39` builds `byTrade`/`byScope` with hit-ranking over every project × every scope · `trade-thumb.tsx:18` calls `selectStageMedia(trade, [], projects)[0]`, assembling the trade's whole de-duplicated media list to draw one 40px square, in list rows.

### 5.5 Verified duplication counts
Trade display-name resolution **11** (3 drifted) · project hero/cover choice **9** (5 distinct policies) · scope→trade grouping **8** (only 2 share the name; the scope→trade inverse is built 3× independently) · caption/location line **6** (3 null-handling behaviours) · curated trade→image maps **6** (4 key spaces) · project-by-scope indexing **6** · trade pairings **4** (4 disjoint key spaces) · trade→scope picker row **3** (a shared one exists; 2 surfaces don't use it — cheapest win on the list). **Corrections to prior notes:** `groupScopesByTrade` is 8, not 9. **Optimized-URL building is already consolidated behind `OptimizedImage` — keep it out of the argument.**

### 5.6 Identity keyed on display names
`SCOPE_PHOTOS` by `scope.name` (**B5**) · `selectTradeBenefits` by trade name · `persona-profile-maps.ts` by `'Kitchen Remodel'` (**B4**) · `TRADE_BENEFIT_EXCLUSIONS` is a verbatim-string denylist against copy in `persona-profile-maps.ts` and self-documents as a stand-in.

### 5.7 Negative results — do not re-investigate
`who-we-are/**` (21 files), `presentation/**` (6) and `shell/**` (9) are architecturally clean: their images are plain string URLs, so raw `next/image` is correct there (`OptimizedImage` is for managed media rows), and `due-diligence.ts` / `who-we-are-sections.ts` / `persona-profile-maps.ts` correctly *consume* `shared/constants/company` rather than restating it. `closing-step.tsx`, `create-proposal-step.tsx` and `program-step.tsx` correctly delegate derived pricing to `entities/meetings/lib/compute-deal-derived`. One small exception: `who-we-are-sections.ts:6,61,68` hand-builds R2 doc URLs from `R2_PUBLIC_DOMAINS`, the same pattern as two `proposal-flow` files — three sites, one helper.

### 5.8 Target surfaces the proposals must land on
`MediaStore` (`modules/media/core/types.ts:8-27`) — `ownerKind`, `table`, `ownerColumn`, `bucket`, `readonly get crud()`, `buildPathKey`, `variants`. `mediaService` — exactly five methods, each taking a store: `buildUploadTarget`, `list`, `reorder`, `retryOptimization`, `optimizeNow`. `PortfolioProject` (`modules/projects/core/types.ts:17`) = `{ project: Project, heroImage: ProjectMediaFile | null, scopeIds: string[] }`. `OptimizedImage` takes a structural `{url, pathKey, bucket, optimizationStatus, optimizationVariants?}` and renders a plain `<img>`. `shared/components/media/*` is already a DI area with render-props and imports no `OptimizedImage`.

---

## 6. Docs to update (per phase)

- **L1** — `modules/media/DOCS.md`: the display seam, and whether `#adding-a-new-media-owner` changes. `shared/components/media` DOCS if the DI area grows.
- **L2** — `modules/projects/core/DOCS.md`: the public projection. Amend the meeting-flow epic's **R10** consumer list.
- **L3** — `src/features/meeting-flow/DOCS.md` — **does not exist yet**; the meeting-flow epic's **K8** already asks for it. The precedence rule is the first thing it should document.
- **L4** — `CONTEXT.md` per **D6** · `docs/codebase-conventions/frontend-stack.md` if a cross-feature rule is added.
- **Any phase** — ping and fix stale refs found on the way (CLAUDE.md format), and update this file's §1.

---

## 7. What this epic does NOT own

The trade/scope catalog and everything keyed off it (construction epic) · the projects read model and public projection themselves (spec B — this epic only amends the consumer list) · the permissions stance for public reads (#285) · Notion→Postgres (#195) · the presentation critique and layout work (meeting-flow epic spec **C**) · the hook background and photo grid (spec **D**) · visual redesign of anything.
