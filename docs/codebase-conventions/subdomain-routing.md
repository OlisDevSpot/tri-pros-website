# Subdomain routing

Subdomains of `triprosremodeling.com` are served by the **same Next.js app**
via a generic host dispatcher in `src/middleware.ts`.

## How it works

1. `src/middleware.ts` reads the request `Host` header and takes the first
   label (`kitchens.triprosremodeling.com` → `kitchens`).
2. It looks that label up in `SUBDOMAIN_ROUTES`
   (`src/shared/config/subdomains.ts`), which derives from the canonical
   `FUNNEL_SLUGS` (`src/shared/domains/funnels/constants/slugs.ts`).
3. If found, it `rewrite()`s to the mapped internal base path (URL bar
   unchanged). If not found, it falls through (`next()`) — apex and `www`
   behave normally.

## Adding a subdomain

For a **funnel** subdomain:

1. Add one slug to `FUNNEL_SLUGS` (`src/shared/domains/funnels/constants/slugs.ts`)
   and a matching `FunnelSpec` in `src/shared/domains/funnels/constants/`
   (registered in `lib/registry.ts`).
2. `SUBDOMAIN_ROUTES` and `next.config.ts`'s `allowedDevOrigins` derive from
   `FUNNEL_SLUGS` automatically — no edit needed.
3. Add the dev hosts to `APP_HOSTS.dev` (`src/shared/config/roots.ts`):
   `<slug>.localhost:3000/3001/3002`. **This is a manual literal** — `roots.ts`
   is loaded by `next.config.ts` in a CommonJS transpile that can't resolve
   `@/` aliases for runtime imports, so it cannot `import { FUNNEL_SLUGS }`.
   Keep it in sync with `slugs.ts` (the comment in `roots.ts` says so).
4. Add the prod subdomain to the Vercel wildcard domain
   (`*.triprosremodeling.com`) — one-time wildcard covers all of them.

For a **non-funnel** subdomain (e.g. `voip`):

1. Make sure the internal route exists under `src/app/(frontend)/`.
2. Add a path generator to `ROOTS` in `src/shared/config/roots.ts`.
3. Add one line to `SUBDOMAIN_ROUTES`.
4. Add the dev host to `APP_HOSTS.dev` and `allowedDevOrigins`
   (`next.config.ts`) so `<label>.localhost:3000` works locally.
5. Add the prod subdomain to the Vercel wildcard domain.

## Current registry

- `kitchens` / `bathrooms` / `complete-interior` → `funnels/[trade]` (Showcase funnels). Note: `funnels` is a real path segment, not a `(funnels)` route group — a group is stripped from the URL, so the `/funnels/[slug]` rewrite would 404.
- `voip` → planned (`/voip`), not yet registered (route group does not exist)

## Rewrite, never redirect

The visitor stays on the subdomain; the internal path is hidden. This keeps
the subdomain canonical for SEO and avoids an extra round-trip.
