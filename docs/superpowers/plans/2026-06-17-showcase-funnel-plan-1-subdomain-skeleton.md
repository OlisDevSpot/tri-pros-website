# Showcase Funnel — Plan 1: Subdomain Dispatcher + `(funnels)` Skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `kitchens.localhost:3000` (and the prod subdomains) render a dedicated funnel route via a generic, registry-driven middleware dispatcher — without touching the marketing site or the app.

**Architecture:** A single `src/middleware.ts` reads the request host, looks the subdomain label up in a `SUBDOMAIN_ROUTES` registry, and `rewrite()`s to an internal path under a new `(funnels)` route group. Unregistered hosts (apex, `www`, `localhost`) fall through untouched. All internal paths are generated from `roots.ts`.

**Tech Stack:** Next.js 15.5.9 (App Router, `src/` dir), TypeScript, Vercel.

**Spec:** `docs/superpowers/specs/2026-06-17-showcase-funnel-system-design.md` (§3 Technical architecture).

## Global Constraints

- **Named exports only** — never `export default` (except Next.js `page.tsx`/`layout.tsx`, which require a default export by framework convention).
- **No unit-test runner exists.** Verification = `pnpm tsc` (type-check) + `pnpm lint` + runtime smoke. Do NOT add vitest/jest.
- **Imports must be sorted** (`perfectionist/sort-imports`: external before internal, alphabetical within groups) and named imports alphabetical. Run `pnpm lint:fix` to auto-fix.
- **`if` bodies need braces + newline** (`antfu/if-newline`) — no single-line `if`.
- **Path alias:** `@/` → `src/`.
- **Middleware lives at `src/middleware.ts`** (the repo uses a `src/` dir).
- **No hardcoded route paths** — all internal paths come from `ROOTS`.
- **`voip` is NOT registered yet** — the `/voip` route group does not exist. Register only the three funnel subdomains; document the voip extension pattern.

---

### Task 1: Funnel host map + `roots.ts` funnel paths

**Files:**
- Create: `src/features/funnels/constants/funnel-hosts.ts`
- Modify: `src/shared/config/roots.ts` (add a `funnels` key inside `APP_ROOTS`, after the `public` block ~line 86)

**Interfaces:**
- Produces: `FUNNEL_SUBDOMAINS` (`Record<'kitchens'|'bathrooms'|'interiors', 'kitchen'|'bathroom'|'interior'>`), types `FunnelSubdomain`, `FunnelTrade`; `ROOTS.funnels.trade(trade: FunnelTrade, options?: UrlOptions): string` and `ROOTS.funnels.subdomain(sub: FunnelSubdomain): string`.

- [ ] **Step 1: Create the funnel host map**

```ts
// src/features/funnels/constants/funnel-hosts.ts

/**
 * Subdomain label → internal trade slug. Single source of truth for which
 * funnel subdomains exist. Consumed by the subdomain registry
 * (src/shared/config/subdomains.ts) and the `(funnels)/[trade]` route.
 */
export const FUNNEL_SUBDOMAINS = {
  kitchens: 'kitchen',
  bathrooms: 'bathroom',
  interiors: 'interior',
} as const

export type FunnelSubdomain = keyof typeof FUNNEL_SUBDOMAINS
export type FunnelTrade = (typeof FUNNEL_SUBDOMAINS)[FunnelSubdomain]

/** The three valid trade slugs, derived from the map (for runtime validation). */
export const FUNNEL_TRADES = Object.values(FUNNEL_SUBDOMAINS) as FunnelTrade[]
```

- [ ] **Step 2: Add funnel paths to `roots.ts`**

In `src/shared/config/roots.ts`, add a top-level import (sorted with the existing type import) and a `funnels` block inside `APP_ROOTS` immediately after the `public: {...}` block. The `FunnelTrade`/`FunnelSubdomain` import is type-only (erased at build → safe for edge runtime / no cycle):

```ts
// add near the top, with the existing `import type { ServiceSlug }` line
import type { FunnelSubdomain, FunnelTrade } from '@/features/funnels/constants/funnel-hosts'
```

```ts
// inside APP_ROOTS, after `public: { ... },`
  funnels: {
    // Internal rewrite TARGET — middleware rewrites a funnel host to this path.
    trade: (trade: FunnelTrade, options?: UrlOptions) => generateUrl(`/funnels/${trade}`, options),
    // Public subdomain URL — what we hand to Meta / link externally.
    subdomain: (sub: FunnelSubdomain) => `https://${sub}.${APP_HOSTS.prod[0]}`,
  },
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (If lint flags import order, run `pnpm lint:fix`.)

- [ ] **Step 4: Commit**

```bash
git add src/features/funnels/constants/funnel-hosts.ts src/shared/config/roots.ts
git commit -m "feat(funnels): funnel host map + roots.ts funnel paths"
```

---

### Task 2: Subdomain registry

**Files:**
- Create: `src/shared/config/subdomains.ts`

**Interfaces:**
- Consumes: `FUNNEL_SUBDOMAINS` (Task 1), `ROOTS.funnels.trade` (Task 1).
- Produces: `SUBDOMAIN_ROUTES: Record<string, string>` — subdomain label → internal base path.

- [ ] **Step 1: Create the registry**

```ts
// src/shared/config/subdomains.ts
import { FUNNEL_SUBDOMAINS } from '@/features/funnels/constants/funnel-hosts'
import { ROOTS } from '@/shared/config/roots'

/**
 * Single source of truth: subdomain label → internal base path the
 * middleware rewrites to. Adding a new subdomain = one entry here.
 *
 * `voip` is intentionally NOT registered yet — the `/voip` route group does
 * not exist. When it does, add: `voip: ROOTS.voip.root(),`
 */
export const SUBDOMAIN_ROUTES: Record<string, string> = Object.fromEntries(
  Object.entries(FUNNEL_SUBDOMAINS).map(([sub, trade]) => [sub, ROOTS.funnels.trade(trade)]),
)
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Sanity-check the registry resolves correctly**

Run: `pnpm tsx -e "import('./src/shared/config/subdomains.ts').then(m => console.log(m.SUBDOMAIN_ROUTES))"`
Expected output: `{ kitchens: '/funnels/kitchen', bathrooms: '/funnels/bathroom', interiors: '/funnels/interior' }`

- [ ] **Step 4: Commit**

```bash
git add src/shared/config/subdomains.ts
git commit -m "feat(funnels): subdomain → path registry"
```

---

### Task 3: Middleware dispatcher + dev hosts

**Files:**
- Create: `src/middleware.ts`
- Modify: `src/shared/config/roots.ts` (`APP_HOSTS.dev` — add funnel dev hosts)
- Modify: `next.config.ts` (`allowedDevOrigins` — add funnel dev origins)

**Interfaces:**
- Consumes: `SUBDOMAIN_ROUTES` (Task 2).
- Produces: host-based rewrite behavior. No exported symbols other than Next's `middleware` + `config`.

- [ ] **Step 1: Create the middleware**

```ts
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SUBDOMAIN_ROUTES } from '@/shared/config/subdomains'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const subdomain = host.split('.')[0]
  const basePath = SUBDOMAIN_ROUTES[subdomain]

  // Apex, www, localhost, or any unregistered host → untouched.
  if (!basePath) {
    return NextResponse.next()
  }

  // Registered subdomain → rewrite, preserving any sub-path. URL bar unchanged.
  //   kitchens.tripros.com/        → /funnels/kitchen
  //   kitchens.tripros.com/thanks  → /funnels/kitchen/thanks
  const url = request.nextUrl.clone()
  url.pathname = `${basePath}${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Page requests only — skip API, static assets, image optimizer, SW.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)'],
}
```

- [ ] **Step 2: Add funnel dev hosts to `APP_HOSTS.dev`**

In `src/shared/config/roots.ts`, extend the `dev` array so the funnel subdomains are recognized in development (browsers resolve `*.localhost` to loopback automatically):

```ts
  dev: [
    'localhost:3000',
    'localhost:3001',
    'localhost:3002',
    'kitchens.localhost:3000',
    'bathrooms.localhost:3000',
    'interiors.localhost:3000',
  ],
```

- [ ] **Step 3: Allow funnel dev origins in `next.config.ts`**

Prevent Next's dev-mode cross-origin asset warning for the funnel hosts. In `next.config.ts`, change `allowedDevOrigins` to include them:

```ts
  allowedDevOrigins: [
    ...APP_HOSTS.tunnel,
    'kitchens.localhost',
    'bathrooms.localhost',
    'interiors.localhost',
  ],
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Runtime smoke — apex + unknown host fall through (no funnel route yet → behaves as today)**

Start the dev server (`pnpm dev`) in a separate terminal, then:

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/`
Expected: `200` (apex home page renders — middleware did NOT interfere).

Run: `curl -s -o /dev/null -w "%{http_code}\n" -H "Host: kitchens.localhost:3000" http://127.0.0.1:3000/`
Expected: `404` (host IS registered → rewrites to `/funnels/kitchen`, which does not exist *yet*. This 404 confirms the rewrite fired; Task 4 makes it `200`.)

- [ ] **Step 6: Commit**

```bash
git add src/middleware.ts src/shared/config/roots.ts next.config.ts
git commit -m "feat(funnels): generic subdomain dispatcher middleware + dev hosts"
```

---

### Task 4: `funnels/` route segment — layout + `[trade]` page shell

> **CORRECTION (post-implementation):** `funnels` must be a REAL path segment, NOT a parenthesized route group `(funnels)`. A route group is stripped from the URL, so `(funnels)/[trade]` serves at `/[trade]` (e.g. `/kitchen`), which the middleware's `/funnels/[trade]` rewrite never matches → every subdomain 404s. Use a real `funnels/` directory so `/funnels/[trade]` is the actual URL. Its own `funnels/layout.tsx` preserves the funnel/app boundary.

**Files:**
- Create: `src/app/(frontend)/funnels/layout.tsx`
- Create: `src/app/(frontend)/funnels/[trade]/page.tsx`

**Interfaces:**
- Consumes: `FUNNEL_TRADES`, `FunnelTrade` (Task 1).
- Produces: a rendered funnel shell at internal path `/funnels/[trade]`. `notFound()` for any unknown trade.

- [ ] **Step 1: Create the funnel-only layout**

This is a NESTED layout under `(frontend)/layout.tsx` (which already provides `<html>`/`<body>`/fonts/Providers). It deliberately renders NO marketing nav/footer — this is the codebase boundary between "funnel" and "app". The Meta Pixel will be injected here in Plan 3 (placeholder comment now).

```tsx
// src/app/(frontend)/funnels/layout.tsx
import type { ReactNode } from 'react'

// Funnel-only chrome. No marketing nav/footer — funnels are deliberately
// isolated from the (site) group. Meta Pixel mounts here in Plan 3.
export default function FunnelLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>
}
```

- [ ] **Step 2: Create the `[trade]` page shell with trade validation**

```tsx
// src/app/(frontend)/funnels/[trade]/page.tsx
import { notFound } from 'next/navigation'
import { FUNNEL_TRADES } from '@/features/funnels/constants/funnel-hosts'
import type { FunnelTrade } from '@/features/funnels/constants/funnel-hosts'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function FunnelTradePage({ params }: Props) {
  const { trade } = await params

  // Only the three known trades resolve; anything else 404s.
  if (!FUNNEL_TRADES.includes(trade as FunnelTrade)) {
    notFound()
  }

  // Plan 2 replaces this shell with the multi-step funnel engine.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold capitalize" data-funnel-trade={trade}>
        {trade} Showcase
      </h1>
      <p className="text-muted-foreground mt-2">Funnel shell — engine lands in Plan 2.</p>
    </main>
  )
}
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Runtime smoke — subdomain now renders the trade shell**

With `pnpm dev` running:

Run: `curl -s -H "Host: kitchens.localhost:3000" http://127.0.0.1:3000/ | grep -o 'data-funnel-trade="kitchen"'`
Expected: `data-funnel-trade="kitchen"` (kitchens subdomain renders the kitchen shell — full dispatch working end-to-end).

Run: `curl -s -o /dev/null -w "%{http_code}\n" -H "Host: bathrooms.localhost:3000" http://127.0.0.1:3000/`
Expected: `200` (bathroom funnel resolves too).

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/`
Expected: `200` (apex marketing home STILL works — funnels are additive).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/funnels/layout.tsx" "src/app/(frontend)/funnels/[trade]/page.tsx"
git commit -m "feat(funnels): (funnels) route group layout + [trade] page shell"
```

---

### Task 5: Subdomain-routing convention doc

**Files:**
- Create: `docs/codebase-conventions/subdomain-routing.md`

- [ ] **Step 1: Write the convention doc**

```markdown
# Subdomain routing

Subdomains of `triprosremodeling.com` are served by the **same Next.js app**
via a generic host dispatcher in `src/middleware.ts`.

## How it works

1. `src/middleware.ts` reads the request `Host` header and takes the first
   label (`kitchens.triprosremodeling.com` → `kitchens`).
2. It looks that label up in `SUBDOMAIN_ROUTES`
   (`src/shared/config/subdomains.ts`).
3. If found, it `rewrite()`s to the mapped internal base path (URL bar
   unchanged). If not found, it falls through (`next()`) — apex and `www`
   behave normally.

## Adding a subdomain

1. Make sure the internal route exists (e.g. a route group under
   `src/app/(frontend)/`).
2. Add a path generator to `ROOTS` in `src/shared/config/roots.ts`.
3. Add one line to `SUBDOMAIN_ROUTES`.
4. Add the dev host to `APP_HOSTS.dev` and `allowedDevOrigins`
   (`next.config.ts`) so `<label>.localhost:3000` works locally.
5. Add the prod subdomain to the Vercel wildcard domain
   (`*.triprosremodeling.com`) — one-time wildcard covers all of them.

## Current registry

- `kitchens` / `bathrooms` / `interiors` → `(funnels)/[trade]` (Showcase funnels)
- `voip` → planned (`/voip`), not yet registered (route group does not exist)

## Rewrite, never redirect

The visitor stays on the subdomain; the internal path is hidden. This keeps
the subdomain canonical for SEO and avoids an extra round-trip.
```

- [ ] **Step 2: Commit**

```bash
git add docs/codebase-conventions/subdomain-routing.md
git commit -m "docs(funnels): subdomain-routing convention"
```

---

## Out of scope for Plan 1 (handled later)

- Host-aware `getPublicBaseUrl()` — Plan 3 (needed when funnels emit URLs/pixel).
- The multi-step funnel engine, content config, lead plumbing — Plan 2.
- Vercel wildcard domain + DNS — one-time infra (coordination item §11), not code.
- Registering `voip` — when the `/voip` route group exists.

## Self-Review

- **Spec coverage (§3):** generic dispatcher (Task 3) ✅; `SUBDOMAIN_ROUTES` registry, one-line extensibility (Task 2) ✅; `(funnels)` group + own layout, Pixel-only-here noted (Task 4) ✅; `roots.ts`-owned paths (Task 1) ✅; `*.localhost` dev hosts (Task 3) ✅; convention doc (Task 5) ✅; `rewrite` not `redirect` (Task 3) ✅. Deferred-with-note: host-aware `getPublicBaseUrl`, Vercel wildcard, voip registration.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `FUNNEL_SUBDOMAINS`/`FunnelTrade`/`FUNNEL_TRADES` (Task 1) used identically in Tasks 2 & 4; `SUBDOMAIN_ROUTES` (Task 2) consumed in Task 3; `ROOTS.funnels.trade` defined Task 1, used Task 2.
