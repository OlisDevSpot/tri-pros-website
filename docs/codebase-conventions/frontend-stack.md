# Frontend Stack & Patterns

Tailwind v4, shadcn/ui (Radix), lucide-react, motion/react. Next.js 15 App Router. Two route groups: `(frontend)/(site)/` for marketing, `(frontend)/proposal-flow/` for the customer proposal flow, `(frontend)/dashboard/` for agent-facing surfaces. Component config at `components.json`.

## Rules

### use-client-pushed-to-leaves

`'use client'` lives as deep in the tree as possible — on the leaf components that need hooks or interactivity. Pages are server components. Views that fetch via tRPC are client components; their *data* may already be server-prefetched and hydrated (see `server-prefetch-two-tiers`).

**Why**: server components keep the bundle smaller and let RSC stream. Lifting `'use client'` to a page boundary unnecessarily ships hooks to clients that don't need them.
**Reference impl**: any page in `src/app/(frontend)/`
**Enforced by**: convention

### views-own-data-fetching

Views (`ui/views/<x>-view.tsx`) own data fetching and layout. Components (`ui/components/`) are props-driven and reusable — never call tRPC. Two fetching tiers (see `server-prefetch-two-tiers`):

- **Tier 1 (suspense views)**: static-input queries → `useSuspenseQuery` / `useSuspenseQueries` (plural for 2+ queries — sequential singular calls waterfall); no isLoading branches; loading/error UI lives at the page seam.
- **Tier 2 (paginated tables)**: nuqs-driven keys via `usePaginatedQuery` → stays `useQuery` + `keepPreviousData` (suspense is incompatible with placeholderData).

**Why**: server components keep the bundle smaller and let RSC stream. Views stay the integration point; the page decides prefetch strategy.
**Reference impl**: `src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx` (Tier 1), `src/shared/entities/customers/components/customers-table.tsx` (Tier 2)
**Enforced by**: convention

### server-prefetch-two-tiers

Dashboard pages prefetch their view's queries server-side and wrap children in `<HydrateClient>` (`src/trpc/components/hydrate-client.tsx`). All server prefetches are fire-and-forget — one export, no tier split at the call site:

- `prefetch(trpc.x.y.queryOptions(input))` — never awaited. Awaiting a prefetch re-blocks the route on every soft navigation (Next 15 re-runs dynamic pages each nav), which regresses cached revisits back to a DB-blocked spinner even with a warm client cache — that's canonical per the tRPC docs and reference implementations, not a shortcut.
- The tier distinction lives ONLY in the view hook: **Tier 1** (suspense views) use `useSuspenseQuery` / `useSuspenseQueries` — the pending query dehydrates and streams; the view resolves it with no client roundtrip. Put a layout-matched `<Suspense fallback>` close to the view; `HydrateClient`'s built-in boundary is the safety net. **Tier 2** (paginated tables) use `useQuery` + `placeholderData: keepPreviousData` via `usePaginatedQuery` (TanStack Paginated Queries canonical — suspense has no `placeholderData`, and tables must keep prior rows visible across page/filter changes). Build the input with `loadPaginatedQueryInput(searchParams, CONFIG)` using the table's shared config object (see query-toolkit.md#shared-table-config). Either way, the client adopts the streamed promise — no client roundtrip on cold load.
- Prefetch routes must NOT ship a route-level `loading.tsx`. Without one, Next keeps the OLD page visible and interactive until the new payload commits — warm revisits paint cached rows instantly, with the streamed prefetch revalidating in the background. A `loading.tsx` replaces the screen immediately on every soft nav, reintroducing the flash — that is the regression, not a fix.

Never import `@/trpc/server` (or `prefetch`/`HydrateClient`) into a client component.

All prefetch calls happen in the page function body, BEFORE returning JSX — a prefetch inside a server component nested under `HydrateClient` renders after the dehydrate snapshot and is silently wasted. An input is prefetchable iff every field derives from searchParams/route params + shared constants — `Date.now()`, localStorage, and session-derived defaults disqualify (or must be quantized server-readably).

In dev, a config/extra drift between the server prefetch and the client's first-mount input surfaces as a `[prefetch drift]` console error (see `src/shared/lib/hydration-drift.ts`) instead of silently wasting the prefetch.

**Why**: pages already block on `protectDashboardPage()`'s session read; prefetching piggybacks on a round-trip the server is already making, removing the client's mount→fetch waterfall.
**Reference impl**: `src/app/(frontend)/dashboard/customers/page.tsx` (Tier 2), `src/app/(frontend)/dashboard/campaigns/page.tsx` (Tier 1 + tab-conditional prefetch)
**Enforced by**: `server-only` package (bundle boundary) + convention

### error-and-loading-states

- **Full-page views** → `<ErrorState />` / `<LoadingState />` from `src/shared/components/states/`.
- **Inline grids/lists** → `animate-pulse` skeleton elements matching the final layout.

**Why**: uniform empty/error/loading affordances across the app.
**Reference impl**: `src/shared/components/states/`
**Enforced by**: convention

### one-react-component-per-file

Every `.tsx` file exports one React component. No "while I'm here, let me add a `StepHeader` to this view file." Extract to its own file in `components/` first.

**Why**: search, refactor, grep, IDE peek — every one of these breaks when files multi-export.
**Enforced by**: convention (lint rule is a candidate)

### named-exports-only

`export const X = ...` or `export function X() { ... }`. Never `export default`.

**Why**: explicit named imports survive refactors; default imports rename silently and obscure provenance.
**Enforced by**: convention

### no-component-file-constants-or-helpers

A component file does not have top-level `const X = [...]` or `function helper() { ... }` outside the component. Constants go to `constants/<scope>.ts`. Helpers go to `lib/<scope>.ts`.

**Why**: keeps each file single-responsibility. Constants and helpers are independently reusable + testable.
**Enforced by**: convention

### no-barrel-files-in-ui

`ui/components/`, `ui/views/`, `constants/`, `hooks/`, `lib/`, `dal/` do not have `index.ts` barrels. Always import the file directly.

**Why**: barrels create implicit re-exports + bundling-cycle risk. Direct paths are greppable + refactor-safe.
**Reference impl**: any of these directories — no `index.ts` present
**Enforced by**: convention

## Tailwind v4 / shadcn / motion

### shadcn-add-via-cli

Add new components via `pnpm dlx shadcn add <component>`. Don't hand-copy from the registry — the CLI manages versioning + dependencies.

### motion-not-framer

Animations use `motion/react`, never `framer-motion`. Keep subtle: `scale: 1.02`, `y: 20–30`. Hero animations on mount; everything else uses `useInView`. Stagger grid children with small delays.

**Reference impl**: any feature view with motion in `src/features/*/ui/`

### icons-lucide-only

Icons are `lucide-react`. Don't introduce a second icon library.

### never-co-locate-shadow-and-overflow

**Hard rule — do not violate.** `box-shadow` and `overflow-hidden`/`overflow-clip` must NEVER live on the same element. A shadow paints *outside* the box; overflow clips everything outside the box — so the element's own shadow (and every descendant's shadow) gets sliced at a hard edge. This is the single most common shadow bug: a soft shadow with a hard, straight cut. No shadow/blur tuning fixes it; the conflict is definitional.

Use the **frame / clip split** (a.k.a. Pattern A): one element is the *frame* (radius + shadow + background, **no overflow**); a separate child is the *clip* (`overflow-hidden` + `rounded-[inherit]`) holding only the media/decor that must be clipped. `rounded-[inherit]` makes the clip match the frame's radius with zero duplication — the scalable half of the rule.

```tsx
<div className="rounded-md bg-card shadow-(--shadow-card)">   {/* frame — shadow breathes */}
  <div className="overflow-hidden rounded-[inherit]">        {/* clip — media/decor only */}
    <Image ... />
  </div>
</div>
```

Corollaries:
- Need to contain bleed on one scroll axis without clipping shadows? Use `overflow-x-clip` (single axis), never `overflow-hidden` (both axes).
- Shadowing an irregular/masked shape? `filter: drop-shadow()` on an *unclipped* ancestor follows the alpha shape — a descendant's overflow can't slice it.
- A shared shell must never bake `overflow-hidden` into the element that consumers give a shadow to. Push the clip down to per-purpose child layers (media, decor) so the shell stays a pure frame.

**Why**: centralizing the frame/clip split means one shell fix lets every consumer's shadow breathe, instead of re-patching the same hard-cut shadow ad-hoc in component after component.
**Reference impl**: the funnel `<Block>` shell — the root is a pure frame (`relative w-full isolate`, no overflow) while `Block.Media` and `Block.Decor` are self-clipping layers. See `src/shared/domains/funnels/ui/block/{block-variants.ts,block-media.tsx,block-decor.tsx}`.
**Enforced by**: convention (code review)

## Lint rules

Run `pnpm lint` before marking any task complete. The non-obvious rules:

- `perfectionist/sort-imports` — external before internal, alphabetical within groups
- `perfectionist/sort-named-imports` — named imports alphabetical
- `antfu/if-newline` — single-line `if` bodies not allowed; always braces + newline
- `import/no-duplicates` — no duplicate import sources

## TypeScript

- Explicit return types on all exported DAL functions and tRPC procedures
- No `any`
- `import type` for type-only imports
- Path alias: `@/` → `src/`

## Anti-patterns

- **`'use client'` at a page boundary that doesn't need it.** Push deeper.
- **A view component prop-drilling state into a deeply-nested presentational tree.** Pull into a context or restructure.
- **Component file with three exported sub-components.** Split.
- **`export default function Page() {}` with a re-named import.** Use named exports.
- **`framer-motion` import.** Use `motion/react`.
- **`overflow-hidden`/`overflow-clip` and `shadow-*` on the same element.** The shadow gets sliced at a hard edge. Split into frame + clip with `rounded-[inherit]` — see `never-co-locate-shadow-and-overflow`.

## See also

- `docs/codebase-conventions/query-toolkit.md` — paginated UI; `#shared-table-config` for the Tier 2 server/client config contract
- `docs/codebase-conventions/database-schema.md` — schema below
- `docs/ui-design-playbook.md` — visual design system + tokens
