# Construction Catalog — Centralization Design (PRELIMINARY)

> **Status:** preliminary design, NOT scheduled. Produced 2026-09-14 from four parallel read-only research passes (server/data inventory, client consumer inventory, conventions compile, meeting-flow specialties placement review).
> **Owner decisions (2026-09-14):** D1 ✅ module home, provider-only for now · D2 ✅ stored slug · D5 ✅ zero-scope trades are valid data in general; meeting-flow's specialties write path drops them (callsite rule, not a catalog/entity rule) · D6 ✅ let the specialties build finish, then migrate non-defensively · D4 ⏸ deferred to a grill session · D3, D7, D8 open. See §11.
> **Artifacts:** this design + requirements (§12) exist. **No spec and no implementation plan yet** — next: resolve D3 → spec (`docs/superpowers/specs/`) → plan (`docs/superpowers/plans/`), per phase.
> **Not part of** the in-flight specialties UI task (`docs/superpowers/plans/2026-09-13-specialties-trade-sheet.md`). That task ships on the current structure; this design migrates it afterwards (D6).
> **Relationship to EPIC #195** (construction data in-house): this design is the missing **Phase 0 seam** that turns #195's cutover into a one-line source binding swap. #195 predates ADR-0003, the shipped tRPC standardization, and `modules/`; §9 lists the amendments it needs.

---

## 1. Problem

Trades, scopes/add-ons, SOW templates, and pain points ("construction catalog") are consumed by ~10 surfaces — meeting-flow, landing SEO pages + sitemap, intake, project-management/portfolio, proposal-flow SOW editor, funnels, customer-pipelines, agent-dashboard, applications, VoIP campaigns, AI persona, PDFs — but have **no home**:

- **The provider is the domain.** `construction-data.service.ts` returns Notion types; ~26 files outside the provider import `providers/notion/**` types, and the provider folder even hosts React Query hooks that import tRPC (provider → router dependency inversion). Every call site says `trpc.notionRouter.*`.
- **Rules are copy-pasted and have drifted.** `groupScopesByTrade` ×9 implementations (two exported with the same name, different signatures); trade-pairings ×4 sources that disagree on *which* trades pair; outcome copy ×3 sources that disagree on *text*; category taxonomy ×5; trade id→name resolution ×9 with different fallbacks; the trade+scope picker row built ×3 (`TradeScopeRow`, `MeetingScopesPicker`, `SOWSection`) each emitting a different shape.
- **Identity is unstable.** Rules, copy, photos, and **public SEO URLs** are keyed by a slug *derived from the Notion display name* (`slugifyTradeName`). Notion renames already broke things silently (`electricals` → `electricals-rough`/`-finish` orphaned 4 landing copy entries; funnel `TRADE_FACTS.name` says "Kitchen Renovation", Notion says "Kitchen Remodel"). Persona maps key by display name; energy-program logic keys by a Postgres-seed accessor.
- **Seven persisted "picked trades/scopes" shapes** (meetings `tradeSelections`, lead `requestedTrades`, project flat `scopeIds`, PM `TradeRow`, proposal SOW `{trade, scopes}`, `interestedTradesRaw` names, applications `{tradeId, tradeName}`), none recording scope-vs-add-on kind.
- **Runtime hazards:** Notion list queries never paginate (silent 100-row cap — `query-notion-database.ts:47-58`; `pageToTiptapJson` likewise caps SOW blocks at 100); scope/SOW/pain-point adapters `throw` on one bad row (fails whole lists, incl. the specialties step); all Notion tRPC reads are **public `baseProcedure`s with no server cache** (every funnel visitor = live Notion call); `revalidateNotionCache` can't reach that path.
- **Postgres catalog graph** (`trades`, `scopes`, `addons`, `x_*_benefits`…) is seeded-only, **zero runtime reads**, serial int PKs, and shape-incompatible with Notion.

Full evidence: Appendix A–C.

---

## 2. Design principles

1. **One home, entity-tier.** Identity, types, reads, rules, and shared UI for the catalog live in one aggregate in the entity tier — never in a feature, never in the provider.
2. **Neutral seam, single binding** (mirror `DialerProvider`, `services/voip/dialer/{types,index}.ts`). Everything above the seam speaks domain types; the Notion→Postgres move swaps one binding. No dual runtime, no registry.
3. **Identity is data, not derivation.** A catalog item's `id` never changes across the migration; its `slug` is stored, not computed from the name.
4. **Read the whole catalog once, index it, share it.** ~27 trades / low-hundreds of scopes: one cached whole-catalog read beats per-trade-row queries everywhere.
5. **Rules defined once, documented in `DOCS.md`, keyed by stable slug, validated against the live catalog.**
6. **Entities own their columns; callsites own their write policies.** The shape and validity of `tradeSelections` is a *meetings* concern; the catalog module supplies reconciliation helpers, not selection policy. A policy that applies to one writer (e.g. meeting-flow dropping zero-scope trades) stays with that writer and is never promoted into an entity or catalog invariant.
7. **Incremental, each phase shippable.** No big-bang JSONB rewrite.

---

## 3. Home & structure

### Decided (D1): `src/shared/modules/construction/`

The catalog is an **aggregate family** (Trade → Scope/Add-on → SOW template; later Materials, Benefits, Pain points). `entities/` has no grouping construct; `modules/` (`modules/proposals/{core,incentives,media,views}` with one root `service.ts` as the sole server API) is exactly that construct. `domains/` is ruled out: it's not on the `db` import allowlist, and the catalog gains a DAL at cutover.

**Provider-only for now.** Until EPIC #195 there are **no tables, no DAL, no `server-spec.ts`, no CRUD router** in the module. It holds domain types, the source seam, the service, rules, the read-model hook, and shared components; the data comes from Notion through the seam. `dal/server/` + `server-spec.ts` are added only at P5.

```
src/shared/modules/construction/
├── DOCS.md                          # business rules, slug-anchored (§6)
├── service.ts                       # THE server API (catalog reads, SOW content, resolvers, revalidate)
├── source.ts                        # ConstructionCatalogSource interface + single binding (§4)
├── trades/
│   ├── schemas/index.ts             # tradeSchema (neutral), tradeRefSchema
│   ├── constants/                   # trade-categories.ts, trade-pairings.ts, trade-outcomes.ts, energy-categories.ts
│   ├── lib/                         # group-trades-by-category.ts, resolve-trade-names.ts, is-energy-efficient-trade.ts
│   └── components/                  # trade-badges.tsx, trade-select.tsx
├── scopes/                          # scopes AND add-ons (kind discriminator)
│   ├── schemas/index.ts             # scopeSchema, scopeRefSchema (id,label,kind?)
│   ├── constants/                   # scope-kinds.ts, pricing-units.ts (labels)
│   ├── lib/                         # reconcile-selected-items.ts (orphans), …
│   └── components/                  # trade-scope-row.tsx (the ONE picker row), scope-kind-badge.tsx
├── sow-templates/
│   ├── schemas/index.ts
│   └── components/                  # templates-modal (moved from shared/components/dialogs)
├── catalog/                         # the cross-sub-unit read model
│   ├── types.ts                     # ConstructionCatalog, CatalogIndex
│   ├── lib/build-catalog-index.ts   # the ONE groupScopesByTrade / tradeByScopeId / bySlug builder
│   └── hooks/use-construction-catalog.ts
└── pain-points/                     # phase 4+ (five vocabularies today → one)
```

`src/shared/domains/construction/constants/enums.ts` folds into the module (`trades/constants/…`) or `constants/enums/construction.ts` per enum pipeline rules.

**Prerequisite (not a blocker for P0–P4):** `modules/` still needs a written definition (today only the `modules/proposals/service.ts:1-36` code comment). Because this module has no DAL until P5, the `db` allowlist and `server-spec.ts` placement questions only bite at P5; the proposals module needs them resolved sooner.

---

## 4. The seam

### Domain types (neutral — no Notion vocabulary)

```ts
// trades/schemas
Trade = {
  id: string            // stable; Notion page UUID today, SAME uuid PK in Postgres tomorrow
  slug: string          // stored identity for URLs + rule keys (§5)
  name: string
  category: TradeCategory       // was Notion `type`
  siteArea: 'home' | 'lot' | null // was Notion `homeOrLot`; replaces UL's stale `location`
  coverImage: CatalogImage | null
}
// scopes/schemas
Scope = {
  id: string
  tradeId: string       // was `relatedTrade`
  name: string
  kind: 'scope' | 'addon'        // was free-string `entryType`; enum'd, one classification rule
  pricingUnit: PricingUnit       // was `unitOfPricing` select string
  sowTemplateIds: string[]       // was `relatedScopesOfWork`
}
// sow-templates/schemas
SowTemplate = { id: string; name: string; scopeIds: string[] }
// catalog/types
ConstructionCatalog = { trades: Trade[]; scopes: Scope[] }
CatalogIndex = {
  tradesById, tradesBySlug, scopesById,
  scopesByTrade: Map<tradeId, { scopes: Scope[]; addons: Scope[] }>,
  tradeByScopeId,
}
// persisted snapshot refs (composed by entity schemas over time, §7)
CatalogRef = { id: string; label: string }
ScopeRef  = CatalogRef & { kind?: 'scope' | 'addon' }   // optional: prod rows lack it
```

### Source interface + binding

```ts
// modules/construction/source.ts
export interface ConstructionCatalogSource {
  listTrades: () => Promise<Trade[]>
  listScopes: () => Promise<Scope[]>
  listSowTemplates: (scopeId: string) => Promise<SowTemplate[]>
  getSowContent: (sowTemplateId: string) => Promise<string /* TipTap JSON */>
  listPainPoints: () => Promise<PainPoint[]>          // phase 4
}
export const catalogSource: ConstructionCatalogSource = notionCatalogSource   // ← the ONE line #195 swaps
```

- **Notion implementation** maps pages → domain types, normalizes id format (dashed UUID), drops disabled rows, **returns null per bad row** (never throws), and **paginates** (`start_cursor` loop) for both `dataSources.query` and block children.
- **Service signatures** are shaped for the DB future now — `(ctx, input) => DalReturn<T>`-compatible at the service boundary — so call sites don't change at swap time.
- React Query hooks leave `providers/notion/dal/**/hooks` entirely (→ `catalog/hooks`). The provider becomes a leaf again (`service-architecture.md:12,250-256`).
- `get-cached-pain-points.ts` (feature calling provider DAL directly) and `scripts/portfolio-scraper/fetch-scopes.ts` (second Notion client) route through the service.

### Server API & caching

- `constructionService.getCatalog()` — whole catalog, server-cached (`unstable_cache`, domain tags `construction:catalog`, `construction:sow-templates`, `construction:pain-points` — no vendor names). One TTL policy for all reads.
- `constructionService.resolveTradeNames(ids)` / `resolveCatalogRefs(...)` — the ONE id→label resolver (replaces 9).
- `constructionService.revalidate()` — replaces `revalidateNotionCache`; at DB cutover, invalidation fires on write.
- **tRPC:** rename `notionRouter` → `constructionRouter` (tRPC epic R4: routers attach to real entities, not vendors), built on the shipped `procedures.ts` pattern: `catalog.get`, `sowTemplates.list({scopeId})`, `sowTemplates.getContent({id})`, `revalidate`. Reads stay public (funnels need them) but are now server-cached. Delete dead `getTradesByQuery`, `getScopesByTrade`, `getScopesByQuery` (the per-row picker query disappears with the shared index).
- **Client:** `useConstructionCatalog()` → one `catalog.get` query, `select: buildCatalogIndex`, long `staleTime`. RSC consumers (landing, sitemap) call `constructionService` directly; views needing it on first paint use server prefetch.

---

## 5. Identity: ids and slugs

| Concern | Decision (recommended) | Why |
|---|---|---|
| **Primary id** | Notion page UUID now; **same value as the `uuid` PK** of the future Postgres rows | Every persisted reference (meetings, proposals, projects, applications, lead attribution, `TRADE_FACTS`, URL params) stays valid with **zero JSONB remap**. Matches `database-schema.md#uuid-primary-keys`. **Amends #195** (which assumes serial ids). |
| **Id format** | Normalized to dashed lowercase at the adapter | Client joins compare with `===`; dashed vs undashed ids exist today. |
| **Slug** (D2 ✅) | **Stored data**, not derived. Add a `Slug` property to the Notion trades data source; a one-time script writes each trade's *current* derived slug into it (preserves every live URL; Notion write → run with explicit go). After that the adapter **requires** the stored slug — no name-derived fallback (non-defensive); a row without one is dropped + logged per the adapter-returns-null rule. Becomes a unique column at cutover | Public URLs and every rule key survive renames. Marketing can rename "Kitchen Renovation" ↔ "Kitchen Remodel" without breaking SEO or copy. |
| **Rule keys** | Slug | Readable in code and docs; stable because stored. |
| **Key validation** | A check (script or test, run in `pnpm lint`/CI or on demand) asserting every slug key in pairings/outcomes/photos/landing copy/persona maps resolves to a live trade | Converts today's *silent* orphaning (`electricals`, "Demo & Hauling" with no copy) into a visible failure. |
| **Names** | Display only; always resolved via catalog, snapshotted as `label` where persisted | Kills name-keyed logic (`persona-profile-maps` `byTrade`, `profile-benefits` substring matching, `portfolio-proof` substring matching). |

---

## 6. Business rules (constants + lib + `DOCS.md`)

`modules/construction/DOCS.md` anchors (proposed): `#catalog-identity` · `#slug-is-stored` · `#scope-vs-addon` · `#category-taxonomy` · `#energy-efficient-trades` · `#trade-pairings` · `#trade-outcomes` · `#stored-references` · `#catalog-read-and-cache`.

| Rule | Consolidates | Notes |
|---|---|---|
| **Category taxonomy** | Notion zod enum, `meeting-flow/constants/trade-categories.ts`, landing `PILLAR_TYPE_MAP`, `domains/construction` `constructionTypes`, `energyEfficientTradeAccessors` | Const array = single source; Notion schema imports it. Landing's pillar→category mapping is a function in the module; pillar *copy* stays in landing. |
| **Energy-efficient trades** | `energy-trades.ts` + `enums/meetings.ts:146` | Classify by `trade.category` (or explicit slug set). **Fixes live bug:** `programs.ts:15` compares Notion UUIDs to `'hvac'` etc. → Energy Saver never qualifies. |
| **Scope vs add-on** | 3 disagreeing classifiers (`!== 'Addon'`, `=== 'Scope'`, add-ons dropped) | One `kind` enum, set at the adapter. Picker/SOW/closing counts use `kind`. |
| **Trade pairings** | meeting-flow (4, `{pairedSlug, reason}`), landing trade (9, `{…, story}`), landing pillar (3 symmetric), orphan `src/pain-points.ts` | One `TRADE_PAIRINGS: Record<slug, { pairedSlug, reason, story }[]>` — `reason` = spoken/short (meeting), `story` = web/long (landing). Paired *names* resolved from catalog (no hardcoded "Insulation"). **Needs copy decision (D4).** |
| **Trade outcomes** | meeting-flow (5), landing (26 incl. dead keys), Postgres `trades.outcomeStatement` | One registry keyed by slug; possibly two registers (spoken vs web). Playbook and `scope-presentation.md` disagree on roof/HVAC — **D4.** |
| **Primary trade** | `sow[0]` ×4 (2 SQL, 2 TS) + `pick-primary-trade.ts` | One documented rule + helper; SQL sites reference the DOCS anchor. |
| **Funnel ↔ trade** | `TRADE_FACTS.name` + hardcoded `notionTradeId` | Keep the id; drop the hardcoded name (resolve from catalog or store slug). Fixes `interestedTradesRaw` inconsistency across lead sources. |
| **Landing-only page copy** (benefits, symptoms, pain headlines, before/after) | `landing/constants/trade-*.ts` | **Stays in landing** (single-consumer presentation copy), but keys are slug-validated (§5). |
| **Curated photos** | `meeting-flow/constants/trade-photos.ts` (scope photos keyed by *name*) | Stays feature-local until `mediaFiles` replaces it (#243/#244); rekey scope photos by id. |

---

## 7. Stored references & entity-owned selection rules

No big-bang rewrite of prod JSONB. Instead:

1. The module exports `catalogRefSchema` / `scopeRefSchema` (`kind` optional). Entity schemas **compose** them when next touched (meetings `tradeSelectionSchema`, proposals `constructionItemSchema`, applications, lead `requestedTrades`) — following `jsonb-columns.md` `_v` rules where shape changes.
2. **Shared selection reducers move to `entities/meetings/lib/`** (`find/upsert/toggle/withNote/withoutTrade` from `meeting-flow/lib/trade-selection.ts`), documented in `entities/meetings/DOCS.md#trade-selections-shape`. Both writers (specialties step and `MeetingScopesPicker`) use them.
   **D5 ✅ — two levels, deliberately different:**
   - **Entity / construction data (general):** a trade selection with zero scopes/add-ons is **valid data**. The meetings schema and every reader must tolerate it; the catalog module has no "at least one scope" invariant. (Recommendation, not yet decided: reject an empty `tradeId` at the schema — `MeetingScopesPicker` can write one today.)
   - **meeting-flow specialties callsite (specific):** the write path **normalizes** — a trade must have ≥1 scope or add-on to be saved; `normalizeForWrite` drops the rest. This is correct as specced (`docs/superpowers/specs/2026-09-13-specialties-trade-sheet-design.md:23,51,146`). It is a policy of that writer, so `normalizeForWrite` / `isTradeSelected` **stay in meeting-flow** and are NOT moved to the entity or the module.
   - Other writers (`MeetingScopesPicker`, future callsites) choose their own policy; none inherits meeting-flow's.
3. **Selection ↔ catalog reconciliation** (`countSelection`, `orphanItems`) → module `scopes/lib/reconcile-selected-items.ts`; used by closing, proposal defaults, PM. Orphans are shown, never silently dropped (today `sow-field.tsx` drops them).
4. **Meeting → SOW mapping** exists twice (`modules/proposals/core/lib/snap-sow-from-meeting.ts` server, `meeting-flow/lib/build-proposal-defaults.ts` client) → one, owned by proposals; carries `kind` so add-ons stop landing in SOW `scopes`.
5. **Lead-trade derivation** (`requestedTrades` ids + `interestedTradesRaw` names) → `entities/customers/lib`, resolving names via `constructionService.resolveTradeNames` / catalog; rule in customers `DOCS.md`. Today meeting-flow reads only `requestedTrades`, so funnel/Bina leads show "no lead trades".
6. `x_project_scopes` (text `scope_id`) and `x_application_trades` (text `trade_id` + `trade_name`) already follow the string-id rule — unchanged. Dead columns (`scope_material_id`, `variables_data`, `bina_webhook_logs.matched_trades`) → cleanup list.

---

## 8. Shared UI primitives

- **`TradeScopeRow`** (one component, replaces `shared/components/trade-scope-row.tsx`, `entities/meetings/components/meeting-scopes-picker.tsx`'s row, `proposal-flow/.../sow-field.tsx`'s picker): reads the shared `CatalogIndex` (no per-row queries), value-adapter prop (ids-only vs `CatalogRef` snapshots), `onBeforeScopeRemove` guard (SOW cost-line cascade confirm), orphan-item display, kind badges. Consumers: intake, PM project form, create-meeting form, proposal SOW.
- **`TradeBadges`** — copy-pasted between meetings and proposals overview cards.
- **`TemplatesModal`** → `sow-templates/components`, batched (no per-scope `useQueries` fan-out).
- **Portfolio trade/scope filtering** (`use-portfolio-filters`, funnels `portfolio-block` + `funnel-project-carousel` identical logic, `project-detail-sheet`, `project-story-view`) → consume `CatalogIndex.tradeByScopeId`; one `filterProjectsByTrade` helper.

**Stays feature-local:** meeting-flow specialties tiles/sheet/copy, sheet open state + `?trade=` URL param, debounced write orchestration + echo suppression (calling the meetings entity reducers), the callsite write policy `normalizeForWrite` + `isTradeSelected` (≥1 item to save — D5), `diffIds`, `filterTradesByQuery` (UI search over cached list), `format-*` copy helpers; landing pillar config + page copy; PM portfolio filter bar UI.

---

## 9. Amendments EPIC #195 needs

1. **PKs = existing Notion UUIDs** (not serial) — avoids remapping every stored reference.
2. **`kind` enum** instead of `isAddon` boolean (matches domain type; room for future kinds).
3. **Stored unique `slug`** on trades/scopes with a rename-stable URL policy.
4. **Cutover = swap `catalogSource` binding** to a DAL-backed implementation; no "UI reads new tables" rewrite, because consumers already read domain types via the service/hook.
5. Re-home on the current architecture: `modules/construction` DAL + `server-spec.ts`, `procedures.ts` routers (tRPC epic shipped; `createEntityRouter` gone), CASL visibility stance for public reads + admin writes (#285 D-09/D-13).
6. Correct its premise: it says "Notion holds SOW content; everything else is in our DB" — in code, trades, scopes, and pain points are **also** read from Notion at runtime; the Postgres catalog has zero runtime reads.
7. Its planned "ADR-0003" number is taken (`0003-service-provider-architecture.md`).
8. Keep cover images → R2/`media_files` during migration (`construction-data-cover-image-r2-migration.md`), but refresh its stale render-site paths.

---

## 10. Phasing

**Migration stance (D6 ✅): non-defensive.** The specialties build finishes on the current structure; consumers then move onto the module directly. No type aliases, no re-export shims, no compat wrappers, no old+new paths side by side, no feature flags. Each phase moves its consumers and deletes the superseded code in the same change; `pnpm tsc` + `pnpm lint` are the safety net.

| Phase | Content | Depends on | Risk |
|---|---|---|---|
| **P0 — Provider hardening** (bug fixes, no moves) | Pagination for `dataSources.query` + block children; scope/SOW/pain-point adapters return null; id normalization; delete dead code (`page-to-html`, `blocks-to-html`, empty `page-to-blocks`, `useGetTrades`); fix energy-trade classification | nothing | low — ship anytime |
| **P1 — Seam + read model** | Domain schemas, `ConstructionCatalogSource` + Notion impl, `constructionService` (cached, domain tags), `constructionRouter` (rename, codemod all `trpc.notionRouter` call sites in one PR), `buildCatalogIndex`, `useConstructionCatalog`; hooks out of provider; pain points + scraper through service | D3 | medium — wide rename, mechanical |
| **P2 — Rules** | Taxonomy/energy/primary-trade consolidated + `DOCS.md`; Notion `Slug` property + backfill + required-slug adapter; slug-key validation check; funnel `TRADE_FACTS` name drift fix. Pairings + outcomes consolidate structurally now; canonical copy waits on D4 | P1 | medium — Notion backfill write |
| **P3 — Consumers** | After the specialties build completes: meeting-flow first, then PM/portfolio, intake, funnels, proposal-flow, landing; shared `TradeScopeRow`/`TradeBadges`/`TemplatesModal`; delete all duplicates | P1–P2 | medium — UI regressions; verify per surface |
| **P4 — Stored references** | Ref schemas composed into entity schemas; shared selection reducers → meetings entity + DOCS (zero-scope trades valid at entity level; meeting-flow keeps its normalizing write policy); single meeting→SOW mapper carrying `kind`; lead-trade derivation → customers; pain-point vocabularies → one | P3 | medium — prod JSONB compatibility (`kind` optional) |
| **P5 — EPIC #195** | Postgres tables (uuid PK = Notion id, stored slug, `kind`), import, swap binding, delete Notion construction code | P1–P4, amended #195 | high — but isolated to one binding |

---

## 11. Decisions needed (owner)

| # | Decision | Status |
|---|---|---|
| **D1** | Home: `modules/construction` vs `entities/{trades,scopes,sow-templates}` | ✅ **`modules/construction`**, provider-only (no DAL/entities) until #195 |
| **D2** | Trade slug: stored + rename-stable vs derived from name | ✅ **Stored** — Notion `Slug` property, backfilled from current slugs, then required |
| **D3** | Notion→domain translator location: inside `providers/notion` (JustCall dialer precedent, 2026-08-19) vs domain layer (translator-home spec, owner-approved 2026-08-20, not landed) | Open — recommend the newer translator-home spec, decided once for all providers |
| **D4** | Canonical pairing + outcome copy (playbook vs landing vs `docs/proposal/scope-presentation.md` disagree on roof/HVAC; Bathroom→Flooring and Solar missing in meeting-flow) | ⏸ **Deferred** to a dedicated grill session. Structural recommendation stands: one registry with `reason` (spoken) + `story` (web) |
| **D5** | Meeting `tradeSelections`: persist trades with reasons/notes but zero scopes? | ✅ **Split by level** (§7.2): valid data at the entity/construction level; the meeting-flow specialties write path normalizes to ≥1 scope/add-on (its spec is correct). Callsite rule only — never generalized |
| **D6** | Timing vs in-flight specialties build | ✅ **Let it finish everything**; standardize the catalog, then migrate its code **non-defensively** (§10) |
| **D7** | Postgres catalog PK = Notion UUID (amend #195) | Open — recommend yes |
| **D8** | Pain points in the module now (P4) or with #195's deferred follow-up | Open — recommend P4 |

---

## 12. Requirements

The checklist the spec, plan, and every phase PR are held to. IDs are stable — reference them in plans and PRs. Convention rules cite `doc#anchor` (verified against code 2026-09-14). `[P5]` = applies only when the Postgres source lands.

### 12.1 Owner constraints (decided)
- **C1** Home is `src/shared/modules/construction/`. No tables, DAL, `server-spec.ts`, or CRUD router until P5 (D1).
- **C2** Trade slug is stored data: Notion `Slug` property, backfilled once from the current derived slug (no live URL changes), then required by the adapter with no name-derived fallback (D2).
- **C3** Zero-scope trade selections are valid at the entity/catalog level. The meeting-flow specialties write path keeps its normalization (≥1 scope/add-on to save); `normalizeForWrite` + `isTradeSelected` stay in meeting-flow and are never generalized (D5).
- **C4** The specialties build finishes on the current structure first. Migration is non-defensive: each change moves consumers and deletes the superseded code; no aliases, re-export shims, compat wrappers, dual paths, or flags. Only persisted data gets compatibility handling (D6).
- **C5** Canonical pairing/outcome copy is out of scope until the D4 grill; the registry structure may consolidate earlier.
- **C6** D3 (translator location) is decided before P1 starts; D7 (PK = Notion UUID) and D8 (pain points) before P4/P5.

### 12.2 Functional
- **F1** Neutral domain types (`Trade`, `Scope` with `kind`, `SowTemplate`, `CatalogRef`, `ScopeRef`) live in the module's `schemas/`; nothing above the seam imports Notion types or uses Notion property names (`entryType`, `relatedTrade`, `homeOrLot`, `type`).
- **F2** `ConstructionCatalogSource` interface with exactly one binding; the Notion implementation is the only code that knows Notion.
- **F3** The Notion implementation paginates every data-source query and every block-children read (no 100-row cap).
- **F4** Adapters return the entity or `null` per row (never throw on a row), drop disabled rows at extraction; no consumer re-filters `disabled`.
- **F5** Ids are normalized (dashed, lowercase) at the adapter.
- **F6** One server-cached whole-catalog read with domain-named tags (no `notion-*` tags) and one `revalidate`; public reads never hit Notion per request.
- **F7** `constructionRouter` replaces `notionRouter` in one change; every call site repointed; dead procedures (`getTradesByQuery`, `getScopesByQuery`, `getScopesByTrade`) deleted.
- **F8** `useConstructionCatalog()` + `buildCatalogIndex` is the only client read of the catalog; no per-trade-row scope queries; RSC consumers call the service.
- **F9** One trade/scope id→label resolver; unknown ids surface as orphans, never silently dropped.
- **F10** One scope-vs-add-on classifier: `kind` set at the adapter.
- **F11** Taxonomy, energy-efficient classification (by category — fixes Energy Saver never qualifying), and primary-trade rule each defined once in the module and documented in its `DOCS.md`.
- **F12** A slug-key validation check fails when any slug-keyed rule, copy map, photo map, or persona map references a slug not in the live catalog.
- **F13** One `TradeScopeRow` picker replaces `TradeScopeRow` / `MeetingScopesPicker` row / `SOWSection` picker; one `TradeBadges`; `TemplatesModal` without per-scope query fan-out.
- **F14** Shared selection reducers live in `entities/meetings/lib/` + DOCS; one meeting→SOW mapper, carrying `kind`.
- **F15** Lead-trade derivation lives in the customers entity and resolves both `requestedTrades` ids and `interestedTradesRaw` names.
- **F16** No React hooks in `providers/notion`; pain points and the portfolio scraper read through the service (no second Notion client, no feature→provider DAL calls).
- **F17** Landing-only page copy stays in landing, keyed by slug and covered by F12.
- **F18** Funnel `TRADE_FACTS` stops hardcoding trade names; names resolve from the catalog.

### 12.3 Architecture & conventions
- **A1** Providers are leaves with no domain types or business logic — `service-architecture.md#dependency-direction-is-one-way`, `#providers-have-no-domain-types-in-signatures`, `#provider-directory-shape`.
- **A2** Services orchestrate and never import `db` — `service-architecture.md#services-never-import-db`.
- **A3** Adapter behavior — `providers/notion/DOCS.md#adapter-returns-entity-or-null`, `#disabled-checkbox-is-extraction-time-gate`, `#notion-select-is-source-of-truth-for-zod-enums`, `#cache-invalidation-after-notion-edits` (update this DOCS with F3–F6).
- **A4** tRPC: routers named for a real entity/domain, not a vendor; `src/trpc/DOCS.md#procedures-defined-once`, `#one-leaf-shape`, `#pure-composition-index`, `#dal-to-trpc-bridge`.
- **A5** Enums: `enum-standardization.md#const-array-source-of-truth`, `#type-derived-from-const`, `#text-with-enum`; the category/kind/pricing-unit arrays are the single source (Notion Zod enums import them).
- **A6** Frontend: `frontend-stack.md#views-own-data-fetching`, `#server-prefetch-two-tiers`, `#one-react-component-per-file`, `#named-exports-only`, `#no-component-file-constants-or-helpers`, `#no-barrel-files-in-ui`; memory coding-conventions rules.
- **A7** Shared components live in the module's `components/`, never in a feature; `shared/` never imports `features/`; cross-feature imports only through public entrypoints.
- **A8** Business rules defined once and documented with slug anchors in `modules/construction/DOCS.md` (anchors listed in §6).
- **A9** Persisted catalog references store the external id as text + a label snapshot; never an FK to the seeded `trades.id` — `entities/applications/DOCS.md`, memory `reference-trades-notion-vs-postgres`.
- **A10** JSONB shape changes follow `jsonb-columns.md#zod-parse-at-write-boundary`, `#mandatory-schema-version`, `#evolution-playbook`; new persisted fields (e.g. `kind`) are optional because prod rows lack them.
- **A11** Stored slug follows `derived-values.md#snapshot-discipline` (stored, not recomputed).
- **A12** Terms per `docs/ubiquitous-language.md` (Trade, Scope, Addon, SOW); one domain `Trade` type name.
- **A13 [P5]** DAL-only `db` access and module DAL allowlist — `dal-conventions.md`; `createCrudDal` + `DalReturn`, ctx-first; no DAL barrels.
- **A14 [P5]** `server-spec.ts` is pure data with an explicit visibility stance for public reads + admin writes, coordinated with #285.
- **A15 [P5]** uuid primary keys (`database-schema.md`), placement per ADR-0005 / `jsonb-columns.md#placement-rule-column-vs-jsonb-vs-child`, cover images via `media_files` FK.

### 12.4 Verification (per phase)
- **V1** `pnpm tsc` + `pnpm lint` clean; never `pnpm build`.
- **V2** Grep gates after the relevant phase: zero `trpc.notionRouter`; zero `providers/notion` imports outside the Notion source implementation; zero feature-local `groupScopesByTrade` / pairing / outcome / category copies; zero `useGetScopes` per-row queries.
- **V3** Slug backfill: the sitemap URL set is identical before and after.
- **V4** Energy Saver qualifies for a selection containing an energy-efficient trade (test).
- **V5** Pagination: a catalog read returns more than 100 rows when the source has them (test against a fake client or a verified count).
- **V6** P3 surfaces verified in a browser (Playwright): meeting-flow specialties (incl. C3 normalization still dropping zero-item trades), PM project form, intake picker, proposal SOW picker + templates, landing trade/pillar pages, funnel portfolio blocks.
- **V7** Every doc touched by a phase (module DOCS, notion DOCS, UL, conventions) updated in the same change; no stale refs left.

### 12.5 Out of scope
Postgres catalog tables and admin UI (EPIC #195 / P5); canonical pairing/outcome copy (D4); visual redesign of any picker or page; pain-point data model changes beyond vocabulary consolidation (pending D8).

---

## Appendix A — Bugs & hazards found (fix candidates independent of the refactor)

1. **Energy Saver never qualifies** — `meeting-flow/constants/energy-trades.ts:3-5` compares `tradeId` (Notion UUID) to `['insulation','hvac','windows','solar']` (`shared/constants/enums/meetings.ts:146`); called at `programs.ts:15`.
2. **Silent 100-row cap** — `providers/notion/dal/query-notion-database.ts:47-58,61-68` no `start_cursor` loop; `page-to-tiptap-json` `page_size: 100` for SOW blocks.
3. **One bad Notion row fails whole lists** — `scopes/adapter.ts:39` (also SOW, pain-point adapters) throw; specialties step now depends on `scopes.getAll`.
4. **All Notion tRPC reads public + uncached** — `notion.router/{trades,scopes}.router.ts` `baseProcedure`; funnel blocks call them per visitor.
5. **Orphaned slug keys** — landing `electricals` entries in `trade-before-after.ts`, `trade-benefits.ts`, `trade-pain-headlines.ts`, `trade-outcome-statements.ts`; "Demo & Hauling" has no copy.
6. **Inconsistent `interestedTradesRaw` names** — funnels/Bina write `TRADE_FACTS.name` ("Kitchen Renovation"), intake writes live Notion names ("Kitchen Remodel").
7. **Add-ons land in proposal SOW `scopes`** — `build-proposal-defaults.ts:23` (kind not persisted).
8. **`sow-field.tsx:95-102` silently drops scope ids** not in the current trade's result list.
9. **`MeetingScopesPicker` can persist empty-`tradeId` rows** (`meeting-scopes-picker.tsx:137`).
10. **`profile-benefits.ts:26-29` `'painting'` substring** never matches "Patch & Interior Paint".
11. **`getTradesByPillar` → `getTradeImages`** runs uncached DB queries per trade per render; `getTradeBySlug` computes the whole pillar, called twice per page (metadata + page).
12. **`getPortfolioProjects`** selects all `x_project_scopes` rows unfiltered (`entities/projects/dal/server/queries.ts:46-52`).
13. **Pre-existing whole-document write race** — `meeting-flow.tsx` `handleFlowStateChange` spreads render-time `flowStateJSON`; concurrent step writes last-writer-wins.

## Appendix B — Stale references found

> **Swept 2026-09-14** (owner request): everything below is fixed in the living docs/comments EXCEPT — the in-flight specialties spec/plan (`docs/superpowers/**`, owned by the running build session), the EPIC #195 GitHub body (outward-facing; amend together with D3/D7/D8), and the funnel `TRADE_FACTS.name` values (code data on live funnels — fixed in P2, not a doc edit). Historical plans/specs keep their point-in-time paths.

- `CLAUDE.md:40` — per-entity DOCS "proposals/ is the canonical example" at `entities/`; now `src/shared/modules/proposals/core/DOCS.md` (uncommitted move). Plus ~20 `entities/proposals/...` path refs across `dal-conventions.md`, `entity-frontend.md`, `derived-values.md`, `jsonb-columns.md`, `pdf-documents.md`, `add-an-entity.md`, ADR-0004/0005, UL.
- `dal-conventions.md:11` — `db` allowlist excludes `modules/**/dal` (6 files import `db`).
- `ubiquitous-language.md:79` — Trade "has location (exterior/interior/lot)"; runtime has `type` + `homeOrLot`. `:69-74,83` — Addon modeled under Scope; code relates add-ons to trades. `:107` — pain points on `customers.customerProfileJSON`; now `customer_profiles` columns. `:33-38` — `shared/pipelines/`, `shared/auth/` → `shared/domains/*`; `domains/` and `modules/` undefined.
- `shared/domains/funnels/types.ts:253` + `CONTEXT.md:38` — `TradeFacts.name` "canonical Notion trade name, e.g. 'Kitchen Renovation'"; Notion says "Kitchen Remodel".
- `providers/notion/DOCS.md:3` — lists projects/meetings/contacts DBs; only painPoints/trades/scopes/sows exist. `:53` — 180s TTL for all; pain points use 600s.
- `environment.md:107`, `trpc-procedures.md:61-64` — Notion contacts DB/router; removed. `trpc-procedures.md:31-37` still teaches `createEntityRouter` (deleted).
- `enum-standardization.md:7-9` — all option sets in `constants/enums/`; `domains/construction/constants/enums.ts` lives outside.
- `entities/applications/lib/constants.ts:6` — says `tradeId[]`; mutations expect `{tradeId, tradeName}[]`.
- `construction-data-cover-image-r2-migration.md:30-33,50,85` — deleted render sites, moved `process-image-variants`, retired bucket name.
- `service-architecture.md:85-87` + JustCall spec — ESLint provider-seam `no-restricted-imports` rule; not in `eslint.config.js`.
- EPIC #195 body — premise (only SOW content in Notion) and ADR-0003 number are stale.
- `docs/superpowers/specs/2026-09-13-specialties-trade-sheet-design.md:103-104` — pairings "three entries" (code has 4); `TRADE_PHOTOS` type differs.

## Appendix C — Inventory summary

- **Provider/service/router:** `shared/services/providers/notion/**` (client, generic query DAL, 4 adapters, React hooks in `dal/**/hooks`), `shared/services/construction-data.service.ts` (7 fns, Notion types), `trpc/routers/notion.router/{index,trades,scopes}.router.ts` (public, uncached), `features/landing/lib/notion-trade-helpers.ts` (`unstable_cache` 180s), `features/meeting-flow/lib/get-cached-pain-points.ts` (bypass, 600s), `trpc/routers/customers.router/business.router.ts:185-191` (uncached id→name).
- **Persisted refs:** `meetings.flow_state_json.tradeSelections[]` · `proposals.project_JSON.data.sow[]` (+ `costLines[].relatedScopeId`) · `x_project_scopes.scope_id` · `x_application_trades.{trade_id,trade_name}` · `customer_lead_attribution.capture_json.{requestedTrades,interestedTradesRaw}` · `customer_profiles.{main_pain_accessor,additional_pain_points}` · `user.trade_specialties` · URL `?trades=&scopes=` / `?trade=` · hardcoded `TRADE_FACTS.notionTradeId`.
- **Postgres catalog (seed-only):** `trades`, `scopes`, `addons`, `benefits`, `benefit_categories`, `materials`, `variables`, `x_trade_benefits`, `x_scope_benefits`, `x_scope_materials`, `x_scope_variables`, `x_material_benefits` — serial PKs, 18 seeded trades, zero runtime reads.
- **Duplication clusters:** scopes-by-trade ×9 · scope/add-on classifier ×3 · category taxonomy ×5 · pairings ×4 · outcomes ×3 · trade images ×6 mechanisms · trade id→name ×9 · scope id→label ×4 · meeting→SOW ×2 · primary trade ×5 · picker row ×3 · `TradeRow` type ×3 · `TradeWithScopes` ×3 · `TradeBadges` ×2 · `Trade` type name clash (Notion vs Postgres) · `SOW` type name clash (Notion vs proposals).
- **Picker UIs:** specialties step (meeting-flow) · `MeetingScopesPicker` (create-meeting form) · `TradeScopeRow` via intake + PM project form · `SOWSection` (proposal-flow) · `PortfolioFilterBar` (filter) · applications trades step (no UI yet) · funnels (fixed per funnel).
