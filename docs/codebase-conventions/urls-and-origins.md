# URLs & origins

**Rule:** paths come from `ROOTS.*`; absolute URLs come from `mainSiteUrl` (client) or `publicUrl` (server); subdomain URLs come from `ROOTS.subdomainUrl`. Never hardcode an origin or a path segment.

## Paths — `src/shared/config/roots.ts`
Every addressable route has one builder. Builders derive from their parent, so renaming a segment is a single edit that cascades. Never concatenate onto a builder (`` `${ROOTS.x()}/y` `` is a bug — add a builder) and never write a path literal in `href`/`push`/`redirect`/`window.open` (the ESLint `no-restricted-syntax` guard enforces this).

## Absolute URLs
- **Client** (a link the user clicks): `mainSiteUrl(ROOTS.x())` — derives the apex origin from the live `window.location`, stripping a registered subdomain label. Correct in dev, any worktree port, the https tunnel, and prod.
- **Server** (a link an email/webhook/push/calendar must reach): `publicUrl(ROOTS.x())` — env/tunnel-aware, server-only.
- Decision: if a reachable link is built during SSR, it's a server concern → `publicUrl`.

## Subdomains
Registry: `SUBDOMAIN_ROUTES` (label → rewrite path) in `subdomains.ts`; `SUBDOMAIN_LABELS` is its key set. Middleware adds a label (rewrite); `mainSiteUrl` removes one (strip to apex). Outbound subdomain URLs: `ROOTS.subdomainUrl(label)`. Funnels and voip are both just labels.
