# Funnels — Domain & Config Architecture

**Status:** Design approved (brainstorm 2026-06-18). Ready for implementation plan.
**Owner:** Oliver P
**Scope:** Establish the *architecture* for funnel configuration — where funnels live, the canonical slug vocabulary, the per-funnel spec contract, and the registry — plus fix the convention violations introduced by the Plan 1 skeleton. Does **not** build the multi-step engine or step library (that is "Plan 2", captured here as forward-context).

**Predecessors:**
- `docs/superpowers/specs/2026-06-17-showcase-funnel-system-design.md` — the funnel product/system spec (offer, UX, measurement). Still authoritative for *what* funnels do.
- `docs/superpowers/plans/2026-06-17-showcase-funnel-plan-1-subdomain-skeleton.md` — Plan 1, which shipped the subdomain dispatcher + route skeleton. This design corrects placement/naming decisions made there.

---

## 0. Why this exists

A post-implementation review of the Plan 1 skeleton surfaced one architectural root cause and one naming decision that, left alone, would make funnels hard to scale and hard to read six months out:

1. **A `shared → features` import violation.** `src/shared/config/subdomains.ts` value-imports `FUNNEL_SUBDOMAINS` from `src/features/funnels/`, and `src/shared/config/roots.ts` type-imports from the same place. Both violate the directionality rule (*shared never imports from features*). Root cause: the funnel constant was filed in `features/` but consumed exclusively by shared code (middleware, roots, subdomains).
2. **A redundant two-vocabulary map.** `FUNNEL_SUBDOMAINS = { kitchens: 'kitchen', bathrooms: 'bathroom', interiors: 'interior' }` invented a plural subdomain label *and* a singular "trade slug" for one concept, then spent machinery translating between them. Nothing required the singular form.

This design resolves both by **(a) promoting `funnels` to a shared domain** and **(b) unifying on a single canonical slug**, then layers in the config architecture the funnel engine will implement.

It also folds in three smaller review findings (see §6).

---

## 1. Core decision: funnels are a shared **domain**, config lives in **code**

### 1.1 `funnels` is a domain, not a feature

A funnel is an *inherent* part of a complete construction-solutions codebase — like `auth`, `construction`, `permissions`, and `pipelines`. It is therefore a **shared domain** (`src/shared/domains/funnels/`), not a `features/` product surface and not an `entities/` data model (no CRUD-owned table). Precedent: `shared/domains/pipelines/` already owns `constants/`, `hooks/`, `lib/`, `types/`, and `ui/` — a domain can own its engine and components.

Consequence: every funnel consumer (`middleware.ts`, `roots.ts`, `subdomains.ts`, the route `page.tsx`) imports from `shared/` — so all imports are `shared → shared`. The Plan 1 directionality violation dissolves with no workarounds.

### 1.2 Configuration is code, with a content seam for later

**Decision: per-funnel configuration is a typed TypeScript spec object (config-as-code), authored by developers via PR — modeled on the EntityServerSpec pattern.** A database-backed `funnels` table is explicitly **not** the first move.

Rationale (from brainstorm):
- Funnels share the same *step types* but vary in step **count, order, and branching logic** (e.g. "tap answer X in the bathrooms funnel → reveal step Y"). Branching is genuinely *logic*, not data.
- Authoring model is **"devs build, marketers tweak copy"**: developers own structure + logic + step composition in code; only pure **copy** needs an eventual no-deploy edit path.
- A DB table now would force a serializable rules-DSL to express branching — an inner-platform anti-pattern — for zero near-term benefit, since branching is not marketer-editable anyway.
- The escape hatch is preserved by isolating **content** as a distinct slot in the spec (§3): a later migration can swap content's *source* (code object → DB/CMS row) without touching the engine, steps, or logic. This matches the original funnel spec §4 ("No CMS… the config shape makes lifting just copy into a data source a clean later migration").

---

## 2. Canonical slug unification

**One vocabulary, used identically as: subdomain label = route segment = registry key = spec key.** The singular/plural translation is removed.

```ts
// src/shared/domains/funnels/constants/slugs.ts  — PURE LEAF (imports nothing)
export const FUNNEL_SLUGS = ['kitchens', 'bathrooms', 'complete-interior'] as const
export type FunnelSlug = (typeof FUNNEL_SLUGS)[number]

export function isFunnelSlug(value: string): value is FunnelSlug {
  return (FUNNEL_SLUGS as readonly string[]).includes(value)
}
```

- Subdomain → `kitchens.triprosremodeling.com`; route → `/funnels/kitchens`; key → `kitchens`. One string end-to-end.
- `complete-interior` adopts the product spec's own term ("Complete-Interior Showcase"), resolving the prior `interiors`/`interior` drift. It is a valid subdomain label and URL segment.
- `ROOTS.funnels.trade(slug)` and `ROOTS.funnels.subdomain(slug)` both take the same `FunnelSlug`. The `FunnelSubdomain` + `FunnelTrade` type split is deleted.
- The route page validates with `isFunnelSlug(trade)` — removing the `as FunnelTrade` cast.
- Human-facing labels ("Complete-Interior Showcase") come from spec **content**, never from `capitalize()` on the slug.

> The retired `funnel-hosts.ts` (in `features/funnels/`) and its `FUNNEL_SUBDOMAINS` / `FUNNEL_TRADES` / `FunnelTrade` / `FunnelSubdomain` exports are replaced by `slugs.ts`. The `src/features/funnels/` directory is removed (its only file moves into the domain).

---

## 3. The four layers

Built **now**: routing facts + spec contract + registry + three spec stubs. Marked **Plan 2**: the engine and step library.

```
src/shared/domains/funnels/
├── constants/
│   ├── slugs.ts             FUNNEL_SLUGS, FunnelSlug, isFunnelSlug          [now]  (pure leaf)
│   ├── kitchens.ts          kitchensFunnel: FunnelSpec                       [now: stub]
│   ├── bathrooms.ts         bathroomsFunnel: FunnelSpec                      [now: stub]
│   └── complete-interior.ts completeInteriorFunnel: FunnelSpec              [now: stub]
├── lib/
│   └── registry.ts          slug → FunnelSpec; registerFunnel / getFunnel    [now]
├── types.ts                 FunnelSpec / FunnelStep / FunnelContent / FunnelTheme  [now]
├── hooks/                   engine state: nav, persistence, branching eval   [Plan 2]
└── ui/
    ├── steps/               reusable typed step library (Step contract)      [Plan 2]
    └── …                    engine shell components                          [Plan 2]
```

| Layer | Home | Built | Purpose |
|---|---|---|---|
| Routing facts | `constants/slugs.ts` | now | slug list/type/guard. The only funnel file middleware/roots/subdomains import. |
| Funnel spec + registry | `constants/*.ts` + `lib/registry.ts` | now (contract + stubs) | one declarative `FunnelSpec` per funnel; registry resolves `slug → spec`. |
| Step library | `ui/steps/` | Plan 2 | reusable, props-driven, typed step components implementing a shared `Step` contract. |
| Engine | `ui/` + `hooks/` | Plan 2 | shared runtime: back/forward nav, state persistence + refresh-resume, branching evaluation, pixel/CAPI + UTM capture. Funnel-agnostic. |

**Load-bearing boundary rule:** `constants/slugs.ts` imports nothing and is the *only* funnel module imported by `middleware.ts` / `roots.ts` / `subdomains.ts`. The registry and specs (which transitively reach UI in Plan 2) are imported **only** by the route `page.tsx`. This keeps the edge/middleware bundle free of React step components.

**The seam that matters:** the engine and steps know nothing about a specific trade; the **spec is the only trade-aware object**; **content is a separable slot inside the spec**. That is what lets copy later move to a DB/CMS without touching engine, steps, or logic.

---

## 4. The `FunnelSpec` contract (`types.ts`)

The centralized per-funnel declaration — the EntityServerSpec analog. Illustrative shape (Plan 2 finalizes `FunnelStep`/`FunnelContent` internals):

```ts
interface FunnelSpec {
  slug: FunnelSlug
  content: FunnelContent              // ← lift-to-DB-later seam: pure copy / media / labels
  theme: FunnelTheme                  // per-trade accent tokens
  steps: FunnelStep[]                 // ordered; each a typed step from the library (variable count/order)
  flow: (answers: FunnelAnswers) => StepId | null  // branching as CODE (tap X → reveal Y)
  pixel: { contentCategory: string }  // trade param carried on the shared Meta dataset
}
```

- **`steps`** compose from the shared step library; count and order vary per funnel.
- **`flow`** holds per-funnel branching **as a function, in code, permanently** — deliberately not serialized data, so no rules-DSL is needed.
- **`content`** is isolated so its *source* can later change (code → DB) transparently to the engine.
- **`pixel.contentCategory`** carries the trade on the single shared Pixel/dataset (per product spec §6.1).

**Registry** (`lib/registry.ts`), mirroring `registerEntity`:
- `registerFunnel(spec)` called at module load by each spec file; duplicate slug throws immediately.
- `getFunnel(slug: FunnelSlug): FunnelSpec` — the route page's single entry point.

**This session ships:** the `types.ts` contract, the registry, and three minimal spec **stubs** (`slug` + `content` + `theme`; `steps: []`, `flow` returning the linear next step). The route page renders trade-correct content (title/label from `content`) immediately; Plan 2 fills `steps` and `flow`.

---

## 5. Route + middleware after the change

- `src/app/(frontend)/funnels/[trade]/page.tsx` — `await params`, `if (!isFunnelSlug(trade)) notFound()`, then `getFunnel(trade)` and render from spec content. No casts; label from content.
- `src/app/(frontend)/funnels/layout.tsx` — unchanged (funnel-only chrome; Pixel mounts here in Plan 3).
- `src/middleware.ts` — unchanged logic; `subdomains.ts` now resolves slugs from the domain leaf.
- `src/shared/config/subdomains.ts` — `SUBDOMAIN_ROUTES` built from `FUNNEL_SLUGS` (slug → `ROOTS.funnels.trade(slug)`), importing the slug list from `shared/domains/funnels/constants/slugs` (shared→shared).

---

## 6. Smaller findings folded in

- **Finding 3 (slug drift):** resolved by §2 — code adopts `complete-interior`, matching the product spec.
- **Finding 4 (dev hosts hardcoded in 3 places):** derive funnel dev hosts and `next.config.ts` `allowedDevOrigins` from `FUNNEL_SLUGS` instead of literal strings, so adding a funnel touches one source. `APP_HOSTS.dev` funnel entries and `allowedDevOrigins` funnel entries both map from `FUNNEL_SLUGS`.
- **Finding 5 (worktree port gap):** funnel dev hosts are registered for every dev port already in `APP_HOSTS.dev` (`:3000/:3001/:3002`), not just `:3000`, so funnels are testable in worktrees. (Derivation from §finding-4 makes this a cartesian product of slugs × ports.)
- **Minor:** `isFunnelSlug` guard removes the `as FunnelTrade` cast in the route page; display label comes from content, fixing the `capitalize('complete-interior')` rendering.

The convention doc `docs/codebase-conventions/subdomain-routing.md` is updated: registry references the domain leaf; "current registry" lists `kitchens` / `bathrooms` / `complete-interior`.

---

## 7. Scope boundaries

**In scope (this session → one plan):**
- Create `shared/domains/funnels/` with `constants/slugs.ts`, `types.ts` (`FunnelSpec` contract), `lib/registry.ts`, and three spec stubs.
- Rewire `roots.ts`, `subdomains.ts`, `middleware` consumers, and the route page to the domain + canonical slug.
- Delete `src/features/funnels/` (`funnel-hosts.ts`).
- Findings 4 + 5: derive dev hosts / `allowedDevOrigins` from `FUNNEL_SLUGS`.
- Update the subdomain-routing convention doc.
- Verify: `pnpm tsc` + `pnpm lint` + runtime smoke (subdomain renders trade-correct content; apex unaffected).

**Out of scope (Plan 2 — forward-context below):**
- The multi-step engine, step library, `Step` contract internals, branching evaluation, state persistence/refresh-resume, UTM capture.
- Pixel/CAPI wiring (Plan 3).
- DB/CMS content source (future, behind the content seam).
- A non-technical funnel-builder UI (explicitly deferred; would revisit the DB question then).

---

## 8. Forward-context for Plan 2 (the funnel engine)

Captured from the brainstorm so the next session starts warm. The engine is **shared, funnel-agnostic infrastructure**, built once and reused by all funnels:

- **Reusable step library** with a shared `Step` contract — card-select, multi-select, slider, PII form, confirmation, etc. Funnels compose steps; they do not hand-roll them.
- **Navigation** — back/forward with answers preserved when stepping back (product spec §7.2).
- **State persistence + refresh-resume** — autosave keyed by a session id (localStorage pre-lead; server draft once the lead exists); refresh/return resumes on the same step, never resets (product spec §7.3). Also enables abandonment retargeting.
- **Branching** — the engine *evaluates* `spec.flow(answers)`; the per-funnel logic lives in the spec (§4). Engine stays trade-agnostic.
- **Pixel/CAPI + UTM** — fire-and-forget measurement; lead creation never blocked by a measurement failure (product spec §5, §6). Trade carried via `spec.pixel.contentCategory`.
- **Content seam** — engine reads `spec.content`; whether content originates in code or (later) a DB row is invisible to the engine.

These belong in `shared/domains/funnels/ui/` + `hooks/`, alongside the specs that drive them.
