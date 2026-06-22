# Unified URL / origin routing system

**Date:** 2026-06-22
**Supersedes:** the Fix-1 (carousel URL) portion of `2026-06-22-funnel-ui-fixes-design.md`. (That doc's Fix-2, question max-width, is unrelated and already shipped.)
**Trigger:** the funnel confirmation carousel linked to `/portfolio/projects/<accessor>` as a *relative* path. On a funnel subdomain (`kitchens.localhost:3000`) the browser resolved it against the subdomain origin, which middleware rewrites to `/funnels/kitchens/...` → 404. Investigating the robust fix surfaced two systemic gaps: (a) no env-aware way to build an absolute URL back to the main site from a subdomain, and (b) `roots.ts` is an incomplete, non-composing, inconsistently-adopted path map.

## Goals

1. **One way to reference a path** — every addressable route has a single builder in `roots.ts`; no call site concatenates segments or writes a path literal; renaming a segment is one edit that cascades.
2. **One way to make an absolute URL** — exactly two resolvers, named for intent, correct in every environment (dev, dev+tunnel, prod, worktree ports) without guessing.
3. **Subdomain-generic** — funnels are one *kind* of subdomain; voip will be another. Nothing in the system is funnel-specific.
4. **Non-regressing** — an ESLint guard + a convention doc keep it from drifting.

## Vocabulary

| Term | Means |
|---|---|
| **origin** | `scheme://host[:port]`, no path |
| **path** | a relative app route, always from `ROOTS.*` (e.g. `/portfolio/projects/acme`) |
| **main site** | the apex app (marketing + dashboard) — what *any* subdomain links back to |
| **subdomain** | a registered vanity host (label → rewrite base path); funnels & voip are instances, not the concept |
| **public** | reachable from the public internet (tunnel-aware) — for links external systems must hit |

---

## Layer 1 — Path layer (`src/shared/config/roots.ts`)

**Principle:** every addressable route — static, dynamic, nested, query-param — has exactly one builder. Children derive from parents, so a parent-segment rename cascades. Call sites never concatenate or write literals.

**Composition pattern** (flat keys preserved to minimize call-site churn; compose internally via lazy self-reference — safe because builders run after the module const is assigned):

```ts
const APP_ROOTS = {
  landing: {
    portfolio:             (o?) => generateUrl('/portfolio', o),
    portfolioProjects:     (o?) => generateUrl(`${APP_ROOTS.landing.portfolio()}/projects`, o),
    portfolioProject:      (accessor, o?) => generateUrl(`${APP_ROOTS.landing.portfolioProjects()}/${accessor}`, o),   // NEW
    portfolioTestimonials: (o?) => generateUrl(`${APP_ROOTS.landing.portfolio()}/testimonials`, o),
    services:              (o?) => generateUrl('/services', o),
    servicesPillar:        (p, o?) => generateUrl(`${APP_ROOTS.landing.services()}/${p}`, o),
    servicesTrade:         (p, t, o?) => generateUrl(`${APP_ROOTS.landing.servicesPillar(p)}/${t}`, o),
    // …existing landing routes, each composing from its parent
  },
  public: {
    proposals:      (o?) => generateUrl('/proposal-flow', o),
    proposalReview: (id, { token, ...o } = {}) =>                                                                      // NEW
      generateUrl(`${APP_ROOTS.public.proposals()}/proposal/${id}${token ? `?token=${token}` : ''}`, o),
  },
  // …dashboard.*, funnels.* likewise compose
}
```

Rules for the composition:
- A child calls its parent **without options** to obtain the relative segment, then wraps the *full* path with its own `options`. Only the outermost call applies `{ absolute }`.
- `options` continues to thread through `generateUrl` **until Phase 5** (so absolute callers keep working mid-migration). Phase 5 deletes `options`/`{ absolute }` once no caller passes it.

**Cascade guarantee (the property we're buying):** changing `portfolio: () => '/showcase'` moves `portfolioProjects`, `portfolioProject`, `portfolioTestimonials` automatically — zero call-site edits, nothing breaks.

### Builders to ADD (from audit — each removes a class of concatenation)
- `landing.portfolioProject(accessor, o?)` → replaces **6** `${portfolioProjects()}/${accessor}` concatenations.
- `public.proposalReview(id, { token, ...options }?)` → replaces **7** `${proposals()}/proposal/${id}` concatenations (and the manual `?token=`). Single options object: `token` is the query param, remaining keys (`absolute`, until Phase 5) thread to `generateUrl`.

### Call sites to MIGRATE (the full audit — 20)

Project-detail concatenations → `ROOTS.landing.portfolioProject(...)`:
1. `src/features/project-management/ui/components/project-detail-sheet.tsx:129`
2. `src/features/landing/ui/components/portfolio/project-card.tsx:24`
3. `src/features/project-management/ui/views/edit-project-view.tsx:153`
4. `src/features/project-management/ui/components/portfolio-project-card.tsx:44`
5. `src/shared/entities/projects/hooks/use-project-action-configs.ts:29`
6. `src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx:62` *(also gets the origin wrapper in Phase 2)*

Proposal-review concatenations → `ROOTS.public.proposalReview(...)`:
7. `src/features/proposal-flow/ui/components/table/index.tsx:57`
8. `src/features/proposal-flow/ui/views/edit-proposal-view.tsx:102`
9. `src/features/proposal-flow/ui/views/edit-proposal-view.tsx:115`
10. `src/shared/entities/proposals/components/overview-card.tsx:88`
11. `src/shared/entities/proposals/hooks/use-proposal-action-configs.ts:42` *(plus a sibling `{absolute:true}` share link → Phase 3)*
12. `src/shared/entities/customers/components/lists/proposal-row.tsx:20`
13. `src/shared/entities/customers/components/lists/meeting-proposal-row.tsx:20`

Raw path literals → existing builders:
14–16. `lead-source-detail-header.tsx:48`, `danger-zone.tsx:52`, `danger-zone.tsx:60` → `ROOTS.dashboard.leadSources()`
17–18. `dashboard/pipeline/page.tsx:5`, `dashboard/pipelines/page.tsx:5` → `ROOTS.dashboard.pipeline()`
19–20. `dashboard/campaigns/page.tsx:13`, `dashboard/lead-sources/page.tsx:13` → `ROOTS.dashboard.root`

---

## Layer 2 — Origin layer (two resolvers, identical shape)

```ts
// CLIENT — src/shared/lib/main-site-url.ts
mainSiteUrl(path?: string): string     // "where the user navigates" — apex, from the live origin
// SERVER — src/shared/config/public-url.ts  (rename getPublicBaseUrl → publicUrl)
publicUrl(path?: string): string       // "where outsiders reach us" — env-aware, tunnel-aware
```

**Exact resolution logic — the only origin logic that exists:**

```
mainSiteUrl(path?)
  if window is undefined:                       origin = NEXT_PUBLIC_BASE_URL           // SSR fallback
  else:
     [label, ...rest] = location.host.split('.')
     apexHost = SUBDOMAIN_LABELS.includes(label) ? rest.join('.') : location.host
     origin   = `${location.protocol}//${apexHost}`
  return path ? origin + path : origin

publicUrl(path?)
  origin = NGROK_URL ?? NEXT_PUBLIC_BASE_URL
  return path ? origin + path : origin
```

`SUBDOMAIN_LABELS = Object.keys(SUBDOMAIN_ROUTES)` (added in `src/shared/config/subdomains.ts`) → today `['kitchens','bathrooms','complete-interior']`, `+ 'voip'` when registered. **Middleware adds a label (rewrite); `mainSiteUrl` removes a label (strip to apex). Same registry, inverse operations — they cannot disagree.**

**Decision table — which to call:**

| I need… | Context | Use |
|---|---|---|
| a link the **user clicks** to reach the main site (from any subdomain) | client | `mainSiteUrl(ROOTS.x())` |
| a link an **email / webhook / push / calendar** must reach | server | `publicUrl(ROOTS.x())` |
| an in-app route, same origin | anywhere | `ROOTS.x()` (relative) |
| to **advertise a subdomain** (Meta, SMS) | anywhere | `ROOTS.subdomainUrl(label)` |

---

## Layer 3 — Outbound subdomain URL (`roots.ts`, pure)

```ts
ROOTS.subdomainUrl(label: string, { rootDomain = APP_HOSTS.prod[0], protocol = 'https' } = {})
  => `${protocol}://${label}.${rootDomain}`
```
Generic; no funnel typing. Replaces the prod-hardcoded `ROOTS.funnels.subdomain`. The one current caller (Meta funnel link) → `ROOTS.subdomainUrl(slug)`; voip later → `ROOTS.subdomainUrl('voip')`; dev-only local funnel URL → `ROOTS.subdomainUrl('kitchens', { rootDomain: 'localhost:3000', protocol: 'http' })`.

---

## Scenario matrix (traced, no guessing)

### Client — `mainSiteUrl`
| # | Where you are | Call | Resolution | Result |
|---|---|---|---|---|
| C1 | dev landing `localhost:3000` | `mainSiteUrl(ROOTS.landing.portfolio())` | label ∉ labels → no strip | `http://localhost:3000/portfolio` |
| C2 | dev `kitchens.localhost:3000` *(the bug)* | `mainSiteUrl(ROOTS.landing.portfolioProject(a))` | `kitchens` ∈ labels → strip | `http://localhost:3000/portfolio/projects/a` |
| C3 | worktree `kitchens.localhost:3001` | `mainSiteUrl(ROOTS.landing.portfolioProject(a))` | strip; port preserved | `http://localhost:3001/portfolio/projects/a` |
| C4 | prod `kitchens.triprosremodeling.com` | `mainSiteUrl(ROOTS.landing.portfolio())` | strip | `https://triprosremodeling.com/portfolio` |
| C5 | tunnel apex `…ngrok-free.app` | `mainSiteUrl(ROOTS.landing.portfolio())` | label ∉ labels; protocol `https:` | `https://destined-emu-bold.ngrok-free.app/portfolio` |
| C6 | future `voip.triprosremodeling.com` | `mainSiteUrl(ROOTS.dashboard.root)` | `voip` ∈ labels → strip | `https://triprosremodeling.com/dashboard` |
| C7 | paid multi-sub tunnel `kitchens.myapp.ngrok.app` | `mainSiteUrl(ROOTS.landing.portfolio())` | strip → `myapp.ngrok.app` | `https://myapp.ngrok.app/portfolio` |

### Server — `publicUrl`
| # | Context | Call | Resolution | Result |
|---|---|---|---|---|
| S1 | prod proposal email | `publicUrl(ROOTS.public.proposalReview(id, { token }))` | NGROK unset → `NEXT_PUBLIC_BASE_URL` | `https://triprosremodeling.com/proposal-flow/proposal/123?token=x` (= today) |
| S2 | tunnel proposal email | same | NGROK set → ngrok | `https://destined-emu-bold.ngrok-free.app/proposal-flow/proposal/123?token=x` (reachable) |
| S3 | dev no-tunnel email | same | `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000/proposal-flow/proposal/123?token=x` (dev opens it) |
| S4 | tunnel push deep link | `new URL(navigate, publicUrl())` | origin = ngrok | resolves against ngrok |
| S5 | prod GCal deep link | `publicUrl(ROOTS.dashboard.scheduleWithMeetingHighlight(id, when))` | `NEXT_PUBLIC_BASE_URL` | `https://triprosremodeling.com/dashboard/schedule?…` |
| S6 | worktree :3001 webhook | `publicUrl('/api/…')` | `NEXT_PUBLIC_BASE_URL`=`…:${PORT}` | `http://localhost:3001/api/…` |

### Outbound — `subdomainUrl`
| # | Context | Call | Result |
|---|---|---|---|
| O1 | Meta ad → kitchens (any env) | `ROOTS.subdomainUrl('kitchens')` | `https://kitchens.triprosremodeling.com` (advertise prod, never localhost) |
| O2 | future voip outbound | `ROOTS.subdomainUrl('voip')` | `https://voip.triprosremodeling.com` |

---

## Known limitations (stated, not hidden)
- **SSR of a `mainSiteUrl` link over the tunnel** falls back to `NEXT_PUBLIC_BASE_URL` (localhost), not ngrok — the client can't read server-only `NGROK_URL`. Near-zero impact: the carousel/"See our work" render client-side (`window` present). Convention rule: *a reachable link built during SSR is a server concern → use `publicUrl`.*
- **`www.`** is treated as apex (not stripped); links from `www` stay on `www` (same app). Acceptable.
- **Free-plan tunnel = apex only**; funnel subdomains aren't tunneled today (mobile funnel testing uses localhost or Vercel Preview). `mainSiteUrl` already handles a hypothetical paid multi-subdomain tunnel generically (C7).

---

## Enforcement
**ESLint** (flat config) — forbid raw app-path string literals outside `roots.ts`:
```
'no-restricted-syntax': ['error', {
  selector: "Literal[value=/^\\/(dashboard|portfolio|services|proposal-flow|funnels|intake|about|contact|blog|community|experience)(\\/|$)/]",
  message: 'Build app paths with ROOTS.* (see docs/codebase-conventions/urls-and-origins.md), not string literals.',
}]
```
- Override OFF for `src/shared/config/roots.ts` (the canonical definitions) and `src/app/sitemap.ts` if needed.
- Selector is prefix-based and approximate; tune false positives (e.g. non-route strings) with targeted disables during Phase 6. Start strict, relax as needed.

**Convention doc** — `docs/codebase-conventions/urls-and-origins.md`, one-line rule: *paths from `ROOTS`; absolute URLs only via `mainSiteUrl` (client) / `publicUrl` (server); subdomain URLs via `ROOTS.subdomainUrl`; never hardcode an origin or a path segment.* Add `// see ../../config/roots.ts` style refs at the two resolvers and the registry. Register the doc per `docs/codebase-conventions/README.md`.

---

## Phased plan (each phase independently verifiable; `pnpm lint && pnpm tsc` between)

1. **Path layer.** Add `portfolioProject` + `proposalReview`; refactor all builders to parent-derived composition (options still threaded). Migrate all 20 audit violators. *Pure refactor — zero behavior change; verified by grep (no `${ROOTS…}/` or raw literals remain) + tsc.*
2. **Client origin + the bug.** Add `mainSiteUrl` + `SUBDOMAIN_LABELS`; rewire `funnel-project-carousel.tsx` → `mainSiteUrl(ROOTS.landing.portfolioProject(accessor))` and the "See our work" link (`confirmation-step.tsx:109`) → `mainSiteUrl(ROOTS.landing.portfolio())`; reword middleware comment (subdomain-generic; fix `/funnels/kitchen` typo). *Verify scenarios C1–C7; the carousel resolves to the apex on a funnel subdomain.*
3. **Server origin.** Rename `getPublicBaseUrl → publicUrl` (collapse origin/url); migrate its ~4 callers and the ~14 `{ absolute: true }` sites to `publicUrl()` (server) / `mainSiteUrl()` (the client proposal share link). *Verify S1–S6; prod parity confirmed (NEXT_PUBLIC_BASE_URL=prod).*
4. **Generic subdomain URL.** Replace `ROOTS.funnels.subdomain` with `ROOTS.subdomainUrl`; migrate the Meta caller. *Verify O1–O2.*
5. **Purify `roots.ts`.** No callers pass `{ absolute }` → delete `UrlOptions`, the `absolute` branch (and `generateUrl` if it reduces to identity), and `PROD_BASE_URL`. Builders return pure relative paths. *Compiler-verified: no remaining references.*
6. **Enforcement.** Add the ESLint rule + overrides; write & register the convention doc; add in-code `// see` refs. *Verify lint passes clean repo-wide.*

## Files touched (by phase)
- **roots.ts** (1, 4, 5), **subdomains.ts** (2), **middleware.ts** (2), **public-url.ts** (3), new **lib/main-site-url.ts** (2), ~20 call sites (1), ~14 absolute sites + ~4 getPublicBaseUrl callers (3), **eslint config** + **docs/codebase-conventions/urls-and-origins.md** (6).

## Conventions honored
- One component per file; constants in `constants/`; helpers in `lib/`; named exports.
- `roots.ts` stays type-only-importable (no value/env imports — origin env-awareness lives in `public-url.ts` server-side and `main-site-url.ts` via `window`/`NEXT_PUBLIC_*`).
- Staged explicitly on `main` per repo working style; `pnpm tsc` + `pnpm lint` (never `pnpm build`).
