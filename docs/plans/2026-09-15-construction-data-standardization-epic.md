# Construction Data Standardization — Epic Tracker

> **Status:** requirements and decisions locked. **P0 shipped 2026-09-20** — all 8 tasks complete (pagination, non-throwing adapters, id normalization, dead-code deletion, energy-trade fix, `providers/notion/DOCS.md` updated); D9 decided (delete the scratch page with `getScopesByTrade`).
> **P1 shipped 2026-09-22** — 9 tasks, commits `616465a7`..`086148e2` plus this docs commit. The module, the seam, the cached service, `constructionRouter`, the shared read model and the scraper's move onto the seam all landed; see §3 for the per-requirement state and the amendments below. **Owner escalations:** P0 #1 (public uncached catalog reads) and #4 (`sortBy` admitting relation properties) **close with P1**; #2 (IRA 25C claim accuracy in `programs.ts:22,113,139`) and #3 (`program-step.tsx`'s missing loading gate) stay **open and owner-owned**. **Next: P2, then P3 — per the owner's 2026-09-22 directive (C7), features stop re-implementing catalog logic and consume the module's primitives instead.**
> **Started:** 2026-09-15, from the preliminary design of 2026-09-14. **This file is the live index** — decisions, requirements, phase/spec status and pointers. Update it as decisions land and items ship; IDs are stable, cite them in specs, plans and commits.
> **Design & evidence (rationale, not status):** `docs/plans/2026-09-14-construction-catalog-centralization-design.md` — §1 problem, §2 principles, §3–§9 design detail, Appendix A bugs, Appendix B stale refs, Appendix C inventory. Produced from four parallel read-only research passes (server/data inventory, client consumer inventory, conventions compile, meeting-flow specialties placement review).
> **Baseline:** `main` at `dd2ba19d`.
> **Goal in one line:** trades, scopes/add-ons, SOW templates and pain points get ONE home (`src/shared/modules/construction/`) behind ONE source seam, so the Notion→Postgres move (EPIC #195) becomes a one-line binding swap.

**Adjacent, owned elsewhere — do not duplicate:**
- `docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` — projects/media modules, projects read model. Its **C22** defers trade→scope resolution and `filterProjectsByTrade` to this epic; its **§4** lists the catalog items it is explicitly not doing.
- **EPIC #195** (construction data in-house) — becomes **P5** of this epic. §7 lists the amendments it needs before it can run.
- **Epic #248** (provider boundaries) — the translator-home spec this epic applies. See A1.
- **#285 permissions** — the visibility stance for public catalog reads (A14).
- The in-flight specialties build (`docs/superpowers/plans/2026-09-14-specialties-stage-and-rail.md`) — ships on the **current** structure; this epic migrates it afterwards (C4).

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⚠️ blocked on a §2 decision.

---

## 0. Epic structure

Six phases, each its own spec → plan → build. A phase closes when every requirement ID it owns is `[x]`. Specs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.

| Phase | Scope | Owns | Blocked by | Spec | Plan | Status |
|---|---|---|---|---|---|---|
| **P0** | **Provider hardening** — bug fixes only, no moves, no renames. Pagination, non-throwing adapters, id normalization, dead-code deletion, energy-trade fix | F3, F4, F5 · B1–B4, B14–B18 · A3 | — | [spec](../superpowers/specs/2026-09-15-construction-p0-provider-hardening-design.md) | [plan](../superpowers/plans/2026-09-15-construction-p0-provider-hardening.md) — 8 tasks, complete | [x] |
| **P1** | **Seam + read model** — domain schemas, `ConstructionCatalogSource` + `sources/notion/`, provider reduced to `client.ts` + `types.ts` + `lib/config.ts`, `constructionService` (cached), `notionRouter`→`constructionRouter`, `buildCatalogIndex`, `useConstructionCatalog`, hooks out of the provider | C1, C6 · F1, F2, F6, F7, F16 · A1, A2, A3, A4 | P0 | [spec](../superpowers/specs/2026-09-20-construction-p1-catalog-seam-design.md) | [plan](../superpowers/plans/2026-09-20-construction-p1-catalog-seam.md) — 9 tasks, complete | [x] |
| **P2** | **Rules + identity** — taxonomy/energy/primary-trade consolidated + `DOCS.md`; Notion `Slug` property, backfill, required-slug adapter; slug-key validation; `TRADE_FACTS` name drift | C2, C5 · F9, F10, F11, F12, F17, F18 · A5, A8, A11, A12 · B5, B6 | P1 | not written | — | [ ] |
| **P3** | **Consumers** — after the specialties build lands. meeting-flow first, then PM/portfolio, intake, funnels, proposal-flow, landing. Shared `TradeScopeRow` / `TradeBadges` / `TemplatesModal`; delete every duplicate | C4 · F13 · A6, A7 · B8, B10, B11, B12 | P1, P2, specialties build | not written | — | [ ] |
| **P4** | **Stored references** — ref schemas composed into entity schemas; selection reducers → meetings entity; one meeting→SOW mapper carrying `kind`; lead-trade derivation → customers; pain-point vocabularies → one | C3 · F14, F15 · A9, A10 · B7, B9 | P3, D8 | not written | — | [ ] |
| **P5** | **EPIC #195** — Postgres tables (uuid PK = Notion id, stored slug, `kind`), import, swap the binding, delete the Notion construction code | A13, A14, A15 · §7 amendments | P1–P4, D7, amended #195 | not written | — | [ ] |

**Order:** strictly P0 → P1 → P2 → P3 → P4 → P5. P0 is independent of everything (including the specialties build) and can ship immediately. V1 (`pnpm tsc` + `pnpm lint`) gates every phase.

**Spec-time details** (decided inside the spec that owns them, not here): P1 — cache TTL and tag names, service method names, router leaf names, whether `getCatalog` splits trades/scopes. P2 — the `Slug` Notion property type and the backfill script's dry-run shape, where the slug-key check runs (lint vs script vs CI). P3 — the `TradeScopeRow` value-adapter prop shape. P4 — `_v` bumps per entity schema.

---

## 1. Decided (owner)

| ID | Decision | Date |
|---|---|---|
| **D1** | **Home is `src/shared/modules/construction/`**, not `entities/{trades,scopes,sow-templates}`. The catalog is an aggregate family (Trade → Scope/Add-on → SOW template), and `modules/` is the grouping construct (`modules/proposals` is the precedent). **Provider-only for now:** no tables, no DAL, no `server-spec.ts`, no CRUD router until P5. | 2026-09-14 |
| **D2** | **Trade slug is stored data**, not derived from the display name. A `Slug` property on the Notion trades data source, backfilled once from each trade's *current* derived slug (so no live URL changes), then **required** by the adapter with no name-derived fallback. | 2026-09-14 |
| **D3** | **Notion→domain translators live in the module**, per the translator-home spec (`docs/superpowers/specs/2026-08-20-provider-boundary-translator-home-design.md` §2). `modules/construction/sources/notion/` owns data-source ids, property maps, page→domain translators, extractors and blocks→TipTap. `providers/notion/` shrinks to a generic leaf: `client.ts` + `types.ts` + provider-internal config. Owner's framing: *the module houses the common business logic, requirements, configs and rules for working with and querying construction data — through Notion today, through its own entities later.* | 2026-09-14 |
| **D5** | **Zero-scope trade selections split by level.** At the entity/catalog level a trade selection with no scopes or add-ons is **valid data** — the meetings schema and every reader must tolerate it, and the catalog module carries no "at least one scope" invariant. At the **meeting-flow specialties callsite** the write path applies its own normalization, and that policy stays in meeting-flow. Never generalized; other writers pick their own policy. *(The callsite rule's exact shape was corrected 2026-09-15 against the shipped code — see C3.)* | 2026-09-14 |
| **D9** | **The `tests/[label]` scratch page goes with `getScopesByTrade`.** `app/(frontend)/(site)/tests/[label]/page.tsx:17` was the procedure's only consumer — a "Run Notion Test" button using a hardcoded **undashed** trade id, so it already returned empty. P0 deletes the page, the tRPC procedure and the service function together. | 2026-09-15 |
| **D6** | **The specialties build finishes first**, on the current structure. Then its code migrates **non-defensively**: each change moves consumers and deletes the superseded code together — no type aliases, no re-export shims, no compat wrappers, no old+new paths, no feature flags. Only *persisted* data gets compatibility handling. | 2026-09-14 |
| **D-a…D-e** | **Post-spec shape decisions taken while executing P1** (2026-09-22), recorded so this tracker matches what shipped. **D-a:** the module gets a **`core/` unit** (`core/{schemas,constants,lib,hooks}`), not flat files — `service-architecture.md#modules`, and every other module has one. **D-b:** **plural `sources/`**, which `provider-boundaries.md` already names as the target, not singular `source/`. **D-c:** the service is **`service.ts`** at the module root, like all seven other module services, not `construction.service.ts`. **D-d:** `tradeCategories` moves into the module and the duplicate `TRADE_CATEGORY_ORDER` is **deleted, not kept** (owner: "do NOT keep both copies"). **D-e:** `scripts/portfolio-scraper/fetch-scopes.ts` is **reduced to `fuzzy-match-scopes.ts`**, not deleted — it also owns `fuzzyMatchScopes` and the Levenshtein helpers the scraper needs. | 2026-09-22 |

## 2. Open decisions

| ID | Question | Needed by | Recommendation |
|---|---|---|---|
| **D4** | **Canonical pairing + outcome copy.** The in-home playbook, the landing copy and `docs/proposal/scope-presentation.md` disagree on roof/HVAC; Bathroom→Flooring and Solar are missing from meeting-flow's pairings. Landing has 26 outcome entries incl. dead keys; meeting-flow has 5. | P2 ships the *structure*; the copy lands whenever D4 resolves | ⏸ **Deferred to a dedicated grill session.** Structural recommendation stands: ONE registry keyed by slug with `reason` (spoken/short, meeting) + `story` (web/long, landing). Start the grill from design §6 + Appendix A. |
| **D7** | **Postgres catalog PK = the existing Notion UUID** (amends #195, which assumes serial ints). | Before P5; amend #195 when decided | **Yes.** Every persisted reference (meetings, proposals, projects, applications, lead attribution, `TRADE_FACTS`, URL params) stays valid with zero JSONB remap. Matches `database-schema.md#uuid-primary-keys`. |
| **D8** | **Pain points** — fold into the module at P4, or leave to #195's deferred follow-up? Five vocabularies exist today. | Before P4 | **P4.** They already flow through the same Notion path and the same 100-row/throwing-adapter hazards. |
| **D10** | **`RequestRecipientViewed`** — `docs/zoho-sign/webhook-notes.md:23` claims both the documented and observed event names are mapped, but `modules/proposals/core/lib/contract-events.ts:16-22` has only `RequestViewed`; `RequestRecipientViewed` is absent there and from `constants/enums/zoho-sign.ts:37-49`. Low impact (unknown ops return 200), but a real viewed-event gap if Zoho ever sends the documented name. **Not part of this epic** — surfaced by its stale-ref sweep. | whenever | **Add the key to the map** (one line, makes the doc true), or correct the doc to say only `RequestViewed` is handled. Owner's call which. |

---

## 3. Requirements

The checklist every spec, plan and phase PR is held to. IDs are stable. Convention rules cite `doc#anchor`, verified against code 2026-09-14. `[P5]` = applies only once the Postgres source lands.

### 3.1 Owner constraints (decided — §1)

- [x] **C1** Home is `src/shared/modules/construction/`. No tables, DAL, `server-spec.ts` or CRUD router until P5. (D1)
- [ ] **C2** Trade slug is stored data: Notion `Slug` property, backfilled once from the current derived slug (no live URL changes), then required by the adapter with no name-derived fallback. (D2)
- [ ] **C3** Zero-scope trade selections are valid at the entity/catalog level. Meeting-flow keeps its own write policy, verified against the shipped `meeting-flow/lib/trade-selection.ts:41-56` on 2026-09-15: `normalizeForWrite` keeps an entry that has **any** content (item, reason **or** non-whitespace note) **or** that the server already holds, and drops only a completely-empty, server-absent entry. Round 2 adds a UI rule — unticking a trade's last item calls `removeTrade`, so the next write deletes it. Net: *rep-emptied → removed; server-held zero-item → kept.* `isTradeSelected` is a display predicate (≥1 item), not the write gate. All three helpers stay in meeting-flow and are never generalized. (D5)
- [ ] **C4** The specialties build finishes on the current structure first. Migration is non-defensive: each change moves consumers and deletes the superseded code; no aliases, shims, wrappers, dual paths or flags. Only persisted data gets compatibility handling. (D6)
- [ ] **C5** Canonical pairing/outcome copy is out of scope until the D4 grill; the registry *structure* may consolidate earlier.
- [x] **C6** Notion→domain translation, property maps, data-source ids and extractors live in `modules/construction/sources/notion/`. **Amended 2026-09-22 (P1):** the provider keeps `client.ts`, `types.ts` **and `lib/config.ts`** — as written this item was unachievable, because `provider-boundaries.md#provider-lib-is-provider-internal` sanctions the config fragment and all ten providers use that shape via `shared/config/server-env.ts:8-16`. `types.ts` was also split: its construction-bound half (`NotionDatabaseName`) moved to `sources/notion/databases.ts`, leaving four generic types. (D3)
- [ ] **C7** **Features consume the module's primitives; they never re-implement them.** A feature may hold presentation and choreography. Catalog shapes, rules, resolvers, classifiers and reads come from `modules/construction` — `useConstructionCatalog`/`buildCatalogIndex` for reads, the module's schemas for types, the module's rules for behaviour. A new trade/scope helper inside `features/` is a defect, not a shortcut. **Owner directive, 2026-09-22**, after P1 landed the home: measured that day, 30+ files under `features/` still carry trade/scope logic (26 in meeting-flow, the rest in landing) while only ~32 files import the module. **P2 owns the rules (F9–F12, F17, F18); P3 owns the UI (F13, A6, A7) and F8's three remaining per-row queries.**

### 3.2 Functional

- [x] **F1** Neutral domain types (`Trade`, `Scope` with `kind`, `SowTemplate`, `PainPoint`) live in the module's `core/schemas/`. Nothing above the seam imports Notion types or uses Notion property names (`entryType`, `relatedTrade`, `homeOrLot`, `type`) — `homeOrLot` left the property map entirely, nothing read it. **Amended 2026-09-22 (P1):** `CatalogRef` and `ScopeRef` are **dropped from P1** — they describe *persisted* references, which is **P4** (F14, A9), and they had zero call sites.
- [x] **F2** A `ConstructionCatalogSource` interface with exactly one binding; the Notion implementation is the only code that knows Notion. *(P1 — `sources/types.ts`, bound once in `sources/index.ts`.)*
- [x] **F3** The Notion implementation paginates every data-source query and every block-children read — no 100-row cap. *(P0)*
- [x] **F4** Adapters return the entity or `null` per row and never throw on one row; disabled rows drop at extraction, and no consumer re-filters `disabled`. *(P0)*
- [x] **F5** Ids are normalized (dashed, lowercase) at the adapter. *(P0)*
- [x] **F6** One server-cached whole-catalog read with domain-named tags (no `notion-*` tags) and one `revalidate`. Public reads never hit Notion per request. *(P1 — `service.ts`: four cached reads, one `CONSTRUCTION_CATALOG_TAG`, 600s. This closes owner escalation #1.)*
- [x] **F7** `constructionRouter` replaces `notionRouter` in one change, every call site repointed. Dead procedures deleted — **corrected 2026-09-15 against the code:** only `getTradesByQuery` is truly dead (its sole caller is the dead `useGetTrades` hook). `getScopesByTrade` has one consumer, the scratch page `app/(frontend)/(site)/tests/[label]/page.tsx:17`, which goes with it. **`getScopesByQuery` is LIVE** — `useGetScopes` feeds `sow-field.tsx`, `shared/components/trade-scope-row.tsx` and `meeting-scopes-picker.tsx`; it can only be deleted at **P3**, when the shared `CatalogIndex` replaces per-row scope queries. **Amended 2026-09-22 (P1):** it was *reshaped*, not kept — `scopes.byTrade({ tradeId })` replaces the query-string procedure at P1 and those same three call sites; **deletion stays P3**.
- [ ] **F8** `useConstructionCatalog()` + `buildCatalogIndex` is the only client read of the catalog; no per-trade-row scope queries; RSC consumers call the service directly. **P1 landed the hook and the index** (`core/hooks/use-construction-catalog.ts`, `core/lib/build-catalog-index.ts`) and RSC paths call the service; the three remaining per-row `scopes.byTrade` call sites are **P3** (C4, F13).
- [ ] **F9** One trade/scope id→label resolver (replaces 9). Unknown ids surface as orphans, never silently dropped.
- [ ] **F10** One scope-vs-add-on classifier: `kind` set at the adapter (replaces 3 disagreeing classifiers).
- [ ] **F11** Taxonomy, energy-efficient classification (by category) and the primary-trade rule are each defined once in the module and documented in its `DOCS.md`.
- [ ] **F12** A slug-key validation check fails when any slug-keyed rule, copy map, photo map or persona map references a slug that is not in the live catalog.
- [ ] **F13** One `TradeScopeRow` picker replaces `TradeScopeRow` / the `MeetingScopesPicker` row / the `SOWSection` picker; one `TradeBadges`; `TemplatesModal` without per-scope query fan-out.
- [ ] **F14** Shared selection reducers live in `entities/meetings/lib/` + DOCS; one meeting→SOW mapper, carrying `kind`.
- [ ] **F15** Lead-trade derivation lives in the customers entity and resolves both `requestedTrades` ids and `interestedTradesRaw` names.
- [x] **F16** No React hooks in `providers/notion` (both DAL hooks deleted, their two call sites inlined); pain points read through the cached service and the portfolio scraper reads `catalogSource` — no second Notion client, no feature→provider DAL calls. *(P1)*
- [ ] **F17** Landing-only page copy stays in landing, keyed by slug and covered by F12.
- [ ] **F18** Funnel `TRADE_FACTS` stops hardcoding trade names; names resolve from the catalog.

### 3.3 Architecture & conventions

- [x] **A1** Providers are leaves with no domain types or business logic — `service-architecture.md#dependency-direction-is-one-way`, `#providers-have-no-domain-types-in-signatures`, `#provider-directory-shape`, **as amended by** `docs/superpowers/specs/2026-08-20-provider-boundary-translator-home-design.md` §2 (translators live in domain-land; external consumers import only a provider's `client.ts` + `types.ts`).
- [x] **A2** Services orchestrate and never import `db` — `service-architecture.md#services-never-import-db`.
- [x] **A3** Adapter behavior. **Moved 2026-09-22 (P1):** these rules now live in `modules/construction/DOCS.md` — `#adapter-returns-entity-or-null`, `#disabled-checkbox-is-extraction-time-gate`, `#source-select-is-source-of-truth-for-enums` (renamed from `#notion-select-…`, since the rule is about whichever source supplies the rows) and `#one-cache-tag` (replacing `#cache-invalidation-after-notion-edits` and its three tags). `providers/notion/DOCS.md` keeps only leaf rules.
- [x] **A4** tRPC: routers are named for a real entity/domain, never a vendor — `src/trpc/DOCS.md#procedures-defined-once`, `#one-leaf-shape`, `#pure-composition-index`, `#dal-to-trpc-bridge`.
- [ ] **A5** Enums — `enum-standardization.md#const-array-source-of-truth`, `#type-derived-from-const`, `#text-with-enum`. The category/kind/pricing-unit arrays are the single source; the Notion Zod enums import them. **Corrected 2026-09-22 (P1):** none of those arrays existed — `entryType` and `unitOfPricing` were bare `z.string()`. P1 creates `tradeCategories` and `scopeKinds` in `core/schemas/index.ts` (and deletes the duplicate `TRADE_CATEGORY_ORDER`); **`unitOfPricing` is still a bare string and remains A5's work at P2**, alongside the `constructionTypes`/`tradeCategories` drift recorded at `modules/construction/DOCS.md#category-taxonomy`.
- [ ] **A6** Frontend — `frontend-stack.md#views-own-data-fetching`, `#server-prefetch-two-tiers`, `#one-react-component-per-file`, `#named-exports-only`, `#no-component-file-constants-or-helpers`, `#no-barrel-files-in-ui`; plus the memory coding-conventions rules.
- [ ] **A7** Shared components live in the module's `components/`, never in a feature. `shared/` never imports `features/`; cross-feature imports only through public entrypoints.
- [ ] **A8** Business rules are defined once and documented with slug anchors in `modules/construction/DOCS.md`. Proposed anchors: `#catalog-identity` · `#slug-is-stored` · `#scope-vs-addon` · `#category-taxonomy` · `#energy-efficient-trades` · `#trade-pairings` · `#trade-outcomes` · `#stored-references` · `#catalog-read-and-cache`.
- [ ] **A9** Persisted catalog references store the external id as text plus a label snapshot — never an FK to the seeded `trades.id`. `entities/applications/DOCS.md`; memory `reference-trades-notion-vs-postgres`.
- [ ] **A10** JSONB shape changes follow `jsonb-columns.md#zod-parse-at-write-boundary`, `#mandatory-schema-version`, `#evolution-playbook`. New persisted fields (e.g. `kind`) are optional because prod rows lack them.
- [ ] **A11** The stored slug follows `derived-values.md#snapshot-discipline` — stored, not recomputed.
- [ ] **A12** Terms per `docs/ubiquitous-language.md` (Trade, Scope, Addon, SOW); one domain `Trade` type name.
- [ ] **A13 [P5]** DAL-only `db` access and the module DAL allowlist — `dal-conventions.md`; `createCrudDal` + `DalReturn`, ctx-first; no DAL barrels.
- [ ] **A14 [P5]** `server-spec.ts` is pure data with an explicit visibility stance for public reads + admin writes, coordinated with #285.
- [ ] **A15 [P5]** uuid primary keys (`database-schema.md`); placement per ADR-0005 / `jsonb-columns.md#placement-rule-column-vs-jsonb-vs-child`; cover images via `media_files` FK.

### 3.4 Verification (per phase)

- [ ] **V1** `pnpm tsc` + `pnpm lint` clean. Never `pnpm build`.
- [ ] **V2** Grep gates after the owning phase: zero `trpc.notionRouter`; zero `providers/notion` imports outside the Notion source implementation; zero feature-local `groupScopesByTrade` / pairing / outcome / category copies; zero `useGetScopes` per-row queries.
- [ ] **V3** Slug backfill: the sitemap URL set is byte-identical before and after.
- [ ] **V4** Energy Saver qualifies for a selection containing an energy-efficient trade.
- [ ] **V5** Pagination: a catalog read returns more than 100 rows when the source has them.
- [ ] **V6** P3 surfaces verified in a browser (Playwright): meeting-flow specialties (including C3 — a rep-emptied trade is removed, a server-held zero-item entry is preserved), PM project form, intake picker, proposal SOW picker + templates, landing trade/pillar pages, funnel portfolio blocks.
- [ ] **V7** Every doc a phase touches (module DOCS, notion DOCS, UL, conventions) is updated in the same change; no stale refs left behind.

### 3.5 Out of scope

Postgres catalog tables and admin UI (EPIC #195 / P5) · canonical pairing and outcome copy (D4) · visual redesign of any picker or page · pain-point data-model changes beyond vocabulary consolidation (pending D8).

---

## 4. Bugs & hazards (stable IDs — cite these in plans)

Found during the 2026-09-14 research passes. Full evidence in design Appendix A.

| ID | Bug | Phase |
|---|---|---|
| **B1** | **Energy Saver never qualifies.** `meeting-flow/constants/energy-trades.ts:3-5` compares `tradeId` (a Notion UUID) to `['insulation','hvac','windows','solar']` (`shared/constants/enums/meetings.ts:146`); called at `programs.ts:15`. | P0 ✅ |
| **B2** | **Silent 100-row cap.** `providers/notion/dal/query-notion-database.ts:47-58,61-68` has no `start_cursor` loop; `page-to-tiptap-json` caps SOW blocks at `page_size: 100`. | P0 ✅ |
| **B3** | **One bad Notion row fails a whole list.** `scopes/adapter.ts:39` (and the SOW and pain-point adapters) throw. The specialties step depends on `scopes.getAll`. | P0 ✅ |
| **B4** | **Dead code** (verified 2026-09-15). Zero consumers: `notion/lib/page-to-html.ts`, `notion/lib/blocks-to-html.ts` (orphaned — `page-to-html` imports `blocksToHtml` from the npm package, not this file), `notion/lib/page-to-blocks.ts` (0 bytes). Delete the `useGetTrades` **export only** — its file also exports the live `useGetAllTrades`. Procedures: `getTradesByQuery` dead; `getScopesByTrade` has one scratch-page consumer; **`getScopesByQuery` is live** (see F7). | P0 ✅ |
| **B5** | **Orphaned slug keys.** Landing `electricals` entries in `trade-before-after.ts`, `trade-benefits.ts`, `trade-pain-headlines.ts`, `trade-outcome-statements.ts`; "Demo & Hauling" has no copy. | P2 |
| **B6** | **Inconsistent `interestedTradesRaw` names.** Funnels and Bina write `TRADE_FACTS.name` ("Kitchen Renovation"); intake writes the live Notion name ("Kitchen Remodel"). | P2 |
| **B7** | **Add-ons land in proposal SOW `scopes`** — `build-proposal-defaults.ts:23`, because `kind` is not persisted. | P4 |
| **B8** | **`sow-field.tsx:95-102` silently drops scope ids** that are not in the current trade's result list. | P3 |
| **B9** | **`MeetingScopesPicker` can persist empty-`tradeId` rows** — `meeting-scopes-picker.tsx:137`. | P4 |
| **B10** | **`profile-benefits.ts:26-29` `'painting'` substring** never matches "Patch & Interior Paint". | P3 |
| **B11** | **`getTradesByPillar` → `getTradeImages`** runs uncached DB queries per trade per render; `getTradeBySlug` computes the whole pillar and is called twice per page (metadata + page). | P3 |
| **B12** | **`getPortfolioProjects`** selects all `x_project_scopes` rows unfiltered — `entities/projects/dal/server/queries.ts:46-52`. | P3 |
| **B13** | **Whole-document write race (pre-existing, not catalog-specific).** `meeting-flow.tsx` `handleFlowStateChange` spreads render-time `flowStateJSON`; concurrent step writes are last-writer-wins. | tracked, not owned here |
| **B14** | **`query-notion-database.ts:40-46` casts a `pages.retrieve` result to `PageObjectResponse[]` unchecked** — it can be a `PartialPageObjectResponse`. | P0 ✅ |
| **B15** | **`query-notion-database.ts:61-68` silently drops `sorts`** on the filtered path, though `propertyToSortBy` is computed at `:38`. A caller passing `sortBy` with a filter gets unsorted results. | P0 ✅ |
| **B16** | **`query-notion-database.ts:75` throws `new Error('ERROR QUERYING FOR DATA!')`, discarding the cause.** | P0 ✅ |
| **B17** | **Scopes with no trade relation throw.** `scopes/adapter.ts:30` reads `relationIds(...)[0]`, which can be `undefined`, while `scopeOrAddonSchema.relatedTrade` is a required `z.string()`. Folded into B3's fix. | P0 ✅ |
| **B18** | **`disabled` exists only on trades.** Scopes, SOWs and pain points have no `disabled` property or schema field, so F4's "drop disabled rows at extraction" applies to trades alone today. `use-trade-catalog.ts:16` re-filtered `disabled` client-side. | P0 ✅ / **P1 ✅ — satisfied by *deleting* `Trade.disabled`**, not by moving the filter: the checkbox survives only in `TRADE_PROPERTIES_MAP` (typed via `TradePropertySource`), so no consumer can re-filter it. `use-trade-catalog.ts` is gone. See `modules/construction/DOCS.md#disabled-checkbox-is-extraction-time-gate`. |

**Security note:** all Notion tRPC reads are public `baseProcedure`s with **no server cache** (`notion.router/{trades,scopes}.router.ts`), so every funnel visitor triggers a live Notion call and `revalidateNotionCache` cannot reach that path. Fixed by F6 at P1.

---

## 5. Pointers

**Where the code is today**
*(Rewritten 2026-09-22 after P1. The pre-P1 shape — 7-function `construction-data.service.ts`, `notion.router`, four cache bypasses, provider-held adapters and hooks — is history; read the P1 plan for it.)*
- **Module:** `src/shared/modules/construction/` — `core/{schemas,constants,lib,hooks}`, `service.ts`, `sources/{types,index}.ts`, `sources/notion/**`, `DOCS.md`.
- **Seam:** `sources/types.ts` (`ConstructionCatalogSource`: `getTrades`, `getScopes`, `getSowTemplatesByScope`, `getSowContent`, `getPainPoints`), bound once in `sources/index.ts` as `catalogSource`.
- **Service:** `modules/construction/service.ts` — four `unstable_cache` reads (`getCatalog`, `getPainPoints`, `getSowTemplatesByScope`, `getSowContent`) under one tag, 600s.
- **Provider:** `src/shared/services/providers/notion/` — `client.ts`, `types.ts`, `lib/config.ts` only.
- **Router:** `src/trpc/routers/construction.router/{index,trades,scopes,sow}.router.ts` — reads the cached service; `revalidateCatalog` (agent-only) clears the tag.
- **Read model:** `core/lib/build-catalog-index.ts` + `core/hooks/use-construction-catalog.ts`; three per-row `scopes.byTrade` call sites remain for P3 (F8).
- **Scripts:** `scripts/verify-catalog-seam.ts` and `scripts/portfolio-scraper/` read `catalogSource` — never `service.ts` (`unstable_cache` needs a Next request context).
- **Enums:** `modules/construction/core/constants/enums.ts` — property-profile vocabulary (house attributes), *not* catalog enums; its `constructionTypes` drift from `Trade.category` is recorded at `modules/construction/DOCS.md#category-taxonomy` for P2.
- **Postgres catalog (seed-only, zero runtime reads):** `trades`, `scopes`, `addons`, `benefits`, `benefit_categories`, `materials`, `variables`, `x_trade_benefits`, `x_scope_benefits`, `x_scope_materials`, `x_scope_variables`, `x_material_benefits`. Serial PKs, 18 seeded trades, shape-incompatible with Notion. **Never FK to `trades.id`** (memory `reference-trades-notion-vs-postgres`).

**Where catalog references are persisted** (seven shapes, none recording scope-vs-add-on kind)
`meetings.flow_state_json.tradeSelections[]` · `proposals.project_JSON.data.sow[]` (+ `costLines[].relatedScopeId`) · `x_project_scopes.scope_id` · `x_application_trades.{trade_id,trade_name}` · `customer_lead_attribution.capture_json.{requestedTrades,interestedTradesRaw}` · `customer_profiles.{main_pain_accessor,additional_pain_points}` · `user.trade_specialties` · URL params `?trades=&scopes=` / `?trade=` · hardcoded `TRADE_FACTS.notionTradeId`.

**Duplication to collapse** (design Appendix C)
scopes-by-trade ×9 · scope/add-on classifier ×3 · category taxonomy ×5 · pairings ×4 · outcomes ×3 · trade images ×6 mechanisms · trade id→name ×9 · scope id→label ×4 · meeting→SOW ×2 · primary trade ×5 · picker row ×3 · `TradeRow` type ×3 · `TradeWithScopes` ×3 · `TradeBadges` ×2 · `Trade` type-name clash (Notion vs Postgres) · `SOW` type-name clash (Notion vs proposals).

**Picker UIs** (P3 consolidation targets)
specialties step (meeting-flow) · `MeetingScopesPicker` (create-meeting form) · `TradeScopeRow` via intake + PM project form · `SOWSection` (proposal-flow) · `PortfolioFilterBar` (filter) · applications trades step (no UI yet) · funnels (fixed per funnel).

**Governing conventions**
`docs/superpowers/specs/2026-08-20-provider-boundary-translator-home-design.md` (translator home, D3) · `docs/codebase-conventions/service-architecture.md` · `dal-conventions.md` · `enum-standardization.md` · `jsonb-columns.md` · `src/trpc/DOCS.md` · ADR-0003 · `docs/ubiquitous-language.md`.

**Memory**
`project-construction-catalog-centralization` · `reference-trades-notion-vs-postgres` · `feedback-non-defensive-migrations` · `feedback-callsite-rules-not-domain-invariants`.

---

## 6. Docs to update (per phase)

- [x] **K1** `service-architecture.md` — translator-home amendment **landed 2026-09-15**: `:32` dependency table now bans `provider lib/` and allows type-only `types.ts`; `#providers-have-no-domain-types-in-signatures` rewritten to put translators in domain-land, with the ratification cite. A known-non-compliance note under `#dependency-direction-is-one-way` lists gohighlevel and google-calendar, whose spec'd redirects never landed.
- [x] **K2** `docs/codebase-conventions/provider-boundaries.md` **created 2026-09-15** (the #255 doc) with four rules — `#external-consumers-import-client-and-types-only`, `#provider-lib-is-provider-internal`, `#translators-live-in-domain-land`, `#providers-are-leaves` — plus a tracked non-compliance table. Registered in the conventions README. The ESLint rule remains a later #248 task.
- [x] **K3** `providers/notion/DOCS.md` — **rewritten 2026-09-22 (P1)** down to the leaf it now describes (lazy client, env fragment, four generic types). The database list, the TTL split and every construction rule moved to `modules/construction/DOCS.md`.
- [~] **K4** `src/shared/modules/construction/DOCS.md` **created 2026-09-22 (P1)**. Its anchors are the ones the code cites by slug — `#neutral-schemas`, `#the-seam`, `#one-cache-tag`, `#scripts-bypass-the-cache`, `#one-read-model`, `#reads-paginate`, `#adapter-returns-entity-or-null`, `#disabled-checkbox-is-extraction-time-gate`, `#ids-are-normalized-at-the-adapter`, `#extractors-throw-by-design-adapters-recover`, `#source-select-is-source-of-truth-for-enums`, `#category-taxonomy` — rather than A8's proposed list. Of that list only `#category-taxonomy` exists so far (recorded, not fixed); `#catalog-identity`, `#slug-is-stored`, `#scope-vs-addon`, `#energy-efficient-trades`, `#trade-pairings`, `#trade-outcomes`, `#stored-references` are **P2 rules**.
- [x] **K5** `enum-standardization.md` — **reconciled 2026-09-15.** `#const-array-source-of-truth` now carries a co-location exception naming the live `domains/construction/constants/enums.ts` and its five consumers, and notes that the file folds into the module at P1.
- [ ] **K6** `docs/ubiquitous-language.md` — Trade/Scope/Addon hierarchy and the catalog's source of truth, as the module lands.
- [ ] **K7** EPIC #195 GitHub body — apply the §7 amendments once D7 is decided. **Outward-facing: needs an explicit go.**
- [ ] **K8** `entities/meetings/DOCS.md#trade-selections-shape` (P4) and `entities/customers/DOCS.md` lead-trade rule (P4).
- [ ] **K9** When each phase ships: update this tracker, the design doc's status header, and the `project-construction-catalog-centralization` memory.
- [x] **K10** Stale refs swept 2026-09-15 (verification pass over the 2026-09-14 sweep): **fixed** — K1, K2, K5 above; `funnels/types.ts:253` + `CONTEXT.md:38` `TradeFacts.name` now say the hardcoded names have drifted from Notion instead of calling them canonical (B6/F18 still fixes the values at P2); ADR-0002 `:17,:171` now point at their own Amendment for the deleted `createEntityRouter`. **Verified already fixed** — `ubiquitous-language.md`, `notion/DOCS.md`, `environment.md`, `trpc-procedures.md`, `applications/lib/constants.ts`, the cover-image R2 plan, the ESLint caveat, `CLAUDE.md:40`. **Left alone deliberately** — historical plans/specs keep their point-in-time paths; the EPIC #195 body is outward-facing (K7); `TRADE_FACTS` *values* are live funnel data (P2). **Surfaced, needs an owner call** — D10.

---

## 7. Amendments EPIC #195 needs (K7)

1. **PKs = the existing Notion UUIDs**, not serial ints — avoids remapping every stored reference. (D7)
2. **A `kind` enum** instead of an `isAddon` boolean — matches the domain type and leaves room for future kinds.
3. **A stored, unique `slug`** on trades and scopes, with a rename-stable URL policy. (D2)
4. **Cutover = swapping the `catalogSource` binding** to a DAL-backed implementation. No "UI reads the new tables" rewrite, because consumers already read domain types through the service and the hook.
5. **Re-home it on the current architecture:** `modules/construction` DAL + `server-spec.ts`, `procedures.ts` routers (the tRPC epic shipped; `createEntityRouter` is gone), and a CASL visibility stance for public reads + admin writes (#285 D-09/D-13).
6. **Correct its premise.** It says "Notion holds SOW content; everything else is in our DB." In code, trades, scopes **and** pain points are also read from Notion at runtime, and the Postgres catalog has zero runtime reads.
7. **Its planned "ADR-0003" number is taken** — `0003-service-provider-architecture.md`.
8. **Keep the cover-image migration** to R2/`media_files` (`docs/plans/construction-data-cover-image-r2-migration.md`), but refresh that doc's stale render-site paths first.
