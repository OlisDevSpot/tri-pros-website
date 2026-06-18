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

- `kitchens` / `bathrooms` / `interiors` → `funnels/[trade]` (Showcase funnels). Note: `funnels` is a real path segment, not a `(funnels)` route group — a group is stripped from the URL, so the `/funnels/[trade]` rewrite would 404.
- `voip` → planned (`/voip`), not yet registered (route group does not exist)

## Rewrite, never redirect

The visitor stays on the subdomain; the internal path is hidden. This keeps
the subdomain canonical for SEO and avoids an extra round-trip.
