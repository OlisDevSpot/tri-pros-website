# Funnels architecture refactor — deepening backlog

Started 2026-06-24. Scope: the **API surface** of `src/shared/domains/funnels` —
`constants/`, `lib/`, `schemas/`. Hooks + UI are consumers, out of scope for now.

Goal: DRY, layered, factory/initialization patterns; collapse the sprawl of
ad-hoc single-export constant files; make adding the next funnel (bathrooms,
complete-interior, roofing) a small, mechanical act against a centralized source.

`types.ts` is intentionally **not** in scope to rewrite — discriminated unions +
`ContentByKind`/`AnswerByKind` + completeness-guarded registries are sound.

## Candidates

| # | Title | Theme | Status |
|---|-------|-------|--------|
| 1 | Trade registry — collapse the parallel slug-keyed maps (Notion id, trade name, SEO/OG meta) into one component-free per-trade module | consolidate per-trade data | **✅ shipped** |
| 2 | Card-select option factory — derive asset path + alt from convention; kill per-option boilerplate | factor out mechanical authoring | **✅ shipped** |
| 3 | Dynamic zip-check sequence — `buildZipCheckSequence({city,zip,trade}) => {label,duration}[]` in `lib/`; delete `zip-check.ts` arrays | factor out mechanical authoring | **✅ shipped** |
| 4 | Dissolve one-value "default" constant files | dissolve ad-hoc files | **resolved — no change** (audit; user keeps `utm.ts` + `cta-copy.ts`) |
| 5 | Unify prebuilt step definitions | consolidate | **dropped** (user) |
| 6 | Derive enrichment dimensions from steps | dissolve ad-hoc + in-flight | **dropped** (user) |
| 7 | Single source of CA-ZIP truth — relocate curated resolver to company/ + drift guard | consolidate | **✅ shipped** (relocate done; drift guard still deferred) |

## Implementation log (2026-06-24)

All four shipped on `main` (uncommitted, staged-as-you-go). `pnpm tsc` clean, `pnpm lint` clean for all touched files (the one remaining lint error is a pre-existing prettier nit in `app/(frontend)/globals.css` — unrelated WIP, not touched).

- **1:** new `constants/trade-facts.ts` (`TRADE_FACTS`/`getTradeFacts`); `types.ts` `FunnelMeta`→`TradeMeta` + `TradeFacts`; deleted `funnel-meta.ts` + `trade-by-slug.ts`; repointed `page.tsx`, `opengraph-image.tsx`, `portfolio-block.tsx`, `funnel-project-carousel.tsx`, `build-lead-input.ts`; updated `DOCS.md` + `CONTEXT.md` (Trade/Funnel glossary).
- **2:** new `lib/card-options.ts` (`img`/`icon`/`text` + `cardOptions`); `types.ts` `OptionContent`→`CardOption` (id folded in), `options: CardOption[]`, dropped `optionIds`; rewrote `kitchens.ts`, `bathrooms.ts`, `lib/steps/home-type-step.ts` via the factory; updated `card-select-step.tsx` + `build-lead-enrichment.ts`. **Note:** option `alt` now defaults to `label` (the bespoke per-option alt text was dropped per the locked decision — override via `img(id, label, { alt })` where richer alt matters).
- **3:** new `lib/build-zip-check-sequence.ts` (paired `{label,duration}[]`, city+trade labels, random cadence w/ lingering final tick); `ZipCheckProgress` now takes `input` + builds once per mount; `zip-step.tsx` passes `ctx`-derived trade; inlined `RESOLVE_DEBOUNCE_MS` into `use-live-zip-resolve.ts`; deleted `constants/zip-check.ts`.
- **7:** `git mv` `constants/ca-zip-cities.ts` → `shared/constants/company/service-area-cities.ts`; `CA_ZIP_CITIES`→`SERVICE_AREA_CITIES`; repointed `resolve-zip.ts`. Drift guard deferred (lean: `scripts/check-zip-integrity.ts`).

**Discovered during impl:** candidates 5 (prebuilt steps → `lib/steps/`) and 6 (`spec.enrichment` declared on kitchens+bathrooms) were already implemented in the committed tree by parallel funnel work — good that we dropped them. `bathrooms.ts` had also gained full steps; rewrote it via the factory too.

### Candidate 3 — Dynamic zip-check (LOCKED)
- New pure `lib/build-zip-check-sequence.ts`: `buildZipCheckSequence({ city, zip, trade }) => { label, duration }[]` — **paired** array (kills the parallel `steps[]`/`durations[]` + the `durations[done] ?? 450` desync guard in `ZipCheckProgress`).
- **Labels: city + trade** interpolated (trade noun from `getTradeFacts(slug).name` → **depends on candidate 1**; generator itself takes `trade: string`, coupling is at the call site):
  `Locating ${zip}…` / `Checking service radius near ${city}…` / `Confirming ${trade} crew availability…` / `Reserving your spot in ${city}…`
- **Cadence: random, final step lingers** — earlier steps `randInt(EARLY_MIN,EARLY_MAX)`, final `randInt(FINAL_MIN,FINAL_MAX)`. Bands as module consts.
- Impure (Math.random) → roll **once per mount**: compute via `useState(() => buildZipCheckSequence(input))` inside `ZipCheckProgress` (pass it the `{city,zip,trade}` input, not the prebuilt array). Delete `constants/zip-check.ts` (`CHECK_STEPS`/`CHECK_DURATIONS`); `RESOLVE_DEBOUNCE_MS` finds a new home (it's debounce config, not pacing — move to the live-resolve hook or funnel-layout).
- Test surface: assert label interpolation + duration count, and that each duration ∈ its band.

### Candidate 4 — Dissolve ad-hoc default files (RESOLVED: no change)
- Audit (deletion test) found the file count mostly justified. **`utm.ts` left untouched per user.** `cta-copy.ts` kept as a content module. `funnel-layout.ts` / `storage-keys.ts` / `default-landing-blocks.ts` earn their seam. `anchors.ts` left as-is.
- Outcome: **no refactor.** Re-open only if per-funnel CTA voice is needed (would promote `cta-copy` onto `FunnelSpec.landing`).

### Candidate 7 — CA-ZIP single source (LOCKED: relocate + guard)
- **No drift today** (verified: all 49 curated ZIPs ⊆ 750-ZIP gate). Preventive + locality, not a bug fix.
- The two-tier design is sound: comprehensive generated gate `Set` (`service-area-zips.ts`, 750) + curated resolver map (49, `{city,county}`) + Zippopotam API fallback for the rest.
- **Relocate** `ca-zip-cities.ts` → `shared/constants/company/` (it's company service-area reference data, mis-homed in funnels). Suggested name `service-area-cities.ts` (parallels `service-area-zips.ts`). Repoint `resolve-zip.ts` import.
- Keep curated `{city,county}` as-is (county is nullable + barely read downstream — not worth single-sourcing via the generator now).
- **Drift guard mechanism: DEFERRED** (user unsure). Decide at implementation. Lean: standalone `scripts/check-zip-integrity.ts` asserting curated ⊆ gate (zero runtime cost, fits existing scripts/ convention; no test runner exists in repo). Fully-generated city map (delete curated) rejected for now — source CSV (`scripts/data/uszips.csv`) lacks a `city` column.

### Candidates 5 & 6 — DROPPED (user, this pass)

## Notes / constraints discovered

- `constants/funnel-meta.ts` and `constants/slugs.ts` MUST stay component-free
  (server metadata + middleware read them without pulling the client step tree;
  importing a component 500s every funnel page). Any consolidated trade module
  inherits this constraint. see `src/shared/domains/funnels/DOCS.md#funnel-metadata`.
- Candidate 6 (`spec.enrichment`) is scaffolded in `types.ts` + `lib/build-lead-enrichment.ts`
  but **declared by zero funnels** as of 2026-06-24 — freshly-added WIP.

## Decisions (filled during grilling)

### Candidate 1 — Trade registry
- **1:1 trade↔funnel**, keyed by `FunnelSlug`. A/B handled by `spec.variants`, not by 2 funnels→1 trade.
- Grow component-free `funnel-meta.ts` into the trade-facts module. Absorbs: Notion trade UUID (kills `trade-by-slug.ts`) + trade display name (kills the `TRADE_NAME` map buried in `build-lead-input.ts`) + SEO/OG meta.
- **`pixel.contentCategory` STAYS on `FunnelSpec`** — treated as measurement config, not a trade fact.
- Consumers to repoint: `build-lead-input.ts` (`name`), `ui/blocks/portfolio-block.tsx` + `funnel-project-carousel.tsx` (`notionTradeId`), server `generateMetadata` + `opengraph-image.tsx` (`meta`).

### Candidate 2 — Card-select option factory
- **alt** = `label` by default, optional per-option override.
- **Collapse `optionIds`** into the options structure (single ordered source of truth). Ripples to `types.ts` (`CardSelectStep`/`CardSelectContent`), `card-select-step.tsx`, and `build-lead-enrichment.ts` — accepted.
- Path convention: `/funnels/{scope}/{dimension}/{id}.webp`, `scope = FunnelSlug | 'common'`.
- Icon `name` defaults to the option `id` (matches existing `OPTION_ICONS` keys: `open`, `not-sure`).

**Final design — locked:**

**1. Trade registry** → new component-free `constants/trade-facts.ts`:
- `TRADE_FACTS: Record<FunnelSlug, TradeFacts>` + `getTradeFacts(slug)`. `TradeFacts = { name, notionTradeId, meta: TradeMeta }` (the old `FunnelMeta` shape nested under `.meta`; rename type → `TradeMeta`).
- Delete `constants/trade-by-slug.ts` → `getTradeFacts(slug).notionTradeId` in `portfolio-block.tsx` + `funnel-project-carousel.tsx`.
- Delete `TRADE_NAME` map in `build-lead-input.ts` → `getTradeFacts(ctx.slug).name`.
- Server metadata (`[trade]/page.tsx`, `opengraph-image.tsx`) → `getTradeFacts(slug).meta`. Update `DOCS.md#funnel-metadata`.
- Stays component-free (constraint preserved). `pixel.contentCategory` untouched on the spec.

**2. Option factory** → new pure `lib/card-options.ts`:
- Entry helpers `img(id, label, alt?)`, `icon(id, label, name?)`, `text(id, label, opts?)`; `cardOptions(scope, dim, entries[])` → `CardOption[]`.
- `scope: FunnelSlug | 'common'`; `src = /funnels/${scope}/${dim}/${id}.webp`; `alt = override ?? label`; icon `name = override ?? id`.
- `types.ts`: `OptionContent` gains `id` (→ `CardOption`); `CardSelectContent.options: CardOption[]`; remove `optionIds` from `CardSelectStep`. `AnswerByKind['card-select']` stays `string`.
- Consumers: `card-select-step.tsx` (`options.map`), `build-lead-enrichment.ts` (`options.find(o => o.id === selectedId)`).
- Rewrite `kitchens.ts` + `home-type-step.ts` options via the factory.
- **New test surface:** `cardOptions` is pure → unit-test path derivation, alt/name defaults, order preservation (today the paths are eyeball-trusted).
- Natural extension (→ candidate 5): a `cardSelectStep(id, header, entries)` step-level factory.
