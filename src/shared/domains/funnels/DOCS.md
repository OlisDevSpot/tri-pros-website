# Funnels domain — business & UX rules

## Measurement (Meta Pixel + CAPI)

The funnel auto-fires Meta events by CONVENTION — see
`src/shared/domains/funnels/lib/tracking/`. New funnels need NO Meta wiring:
they declare `pixel.contentCategory` in their FunnelSpec and the engine fires
`PageView` / `ViewContent` / `Lead` / `CompleteRegistration` automatically.

- `PageView` — the pixel loader (`lib/tracking/pixel-loader.tsx`, mounted in the
  funnel layout) fires it once on load.
- `ViewContent` / `CompleteRegistration` — the convention emitter
  (`lib/tracking/use-funnel-tracking.ts`) fires them by step KIND, not step id.
- `Lead` — dual-fire: the PII step fires the browser pixel with a fresh
  `event_id` and threads the SAME id into `submitLead`, whose server CAPI twin
  (the `meta-capi-event` QStash job) dedupes against it. Hashing of phone/
  `external_id` happens server-side in the `meta` provider; the browser sends no PII.
- `Schedule` — dormant until a `datetime` step exists (the `trackFunnelEvent`
  router seam is the future entry point).

Design: `docs/superpowers/specs/2026-06-23-meta-pixel-capi-measurement-design.md`.
Provider: `src/shared/services/providers/meta/`.

## Funnel metadata & share images {#funnel-metadata}

Every funnel gets a per-funnel tab title, meta description, and a dynamically
generated Open Graph share image (so a link pasted into WhatsApp/SMS/iMessage
renders a branded preview, not the generic apex card).

**Authoring (one place, data-only):** `constants/funnel-meta.ts` exports
`FUNNEL_META: Record<FunnelSlug, FunnelMeta>` — `title`, `description`,
`ogHeadline?`, `ogImage?`. `Record<FunnelSlug, …>` is the completeness guard:
omit a slug and tsc errors. `meta.title` is the bare label; the root layout
title template appends ` | Tri Pros Remodeling` (so `'Kitchen Remodels'` →
`Kitchen Remodels | Tri Pros Remodeling`).

**Why a separate registry, NOT a field on `FunnelSpec`:** `FunnelSpec` imports
the client step components. Server-side metadata code (`page.tsx`
`generateMetadata`, `opengraph-image.tsx`) must read funnel data WITHOUT pulling
that client tree into the server module graph — doing so 500s every funnel page
(funnel modules use React hooks without `'use client'`, relying on the ambient
`FunnelEngine` client boundary). So `funnel-meta.ts` imports ONLY types. Keep it
that way: never import a component (or anything that does) into this file.

**Page metadata:** `funnels/[trade]/page.tsx` `generateMetadata` reads
`getFunnelMeta(slug)` and sets title/description/openGraph/twitter, with
`og:url` + `alternates.canonical` pointing at the funnel's OWN subdomain
(`ROOTS.subdomainUrl(slug)`), not the apex.

**OG image:** `funnels/[trade]/opengraph-image.tsx` (`next/og`, Node runtime)
renders 1200×630 from `FUNNEL_META` — hero photo (`ogImage`) + scrim + logo +
`ogHeadline` + trust line, with a brand-gradient fallback when `ogImage` is
absent. Next auto-wires it into `og:image`. Rules:
- `ogImage` MUST be JPEG/PNG, never WebP (Satori's webp decoding is unreliable).
- Assets (font, photo, logo) are read from `public/` via fs in `lib/og/og-assets.ts`
  — NOT self-fetched over HTTP (a self-fetch stalls the dev process). Any new
  asset the route reads MUST be added to `outputFileTracingIncludes` for
  `/funnels/[trade]/opengraph-image` in `next.config.ts`, or it is pruned from
  the serverless function and prod 500s (font) / loses the photo.
- The OG card (`ui/og/funnel-og-card.tsx`) is a Satori render tree: inline styles
  only (no Tailwind), every multi-child container sets `display: flex`, its
  `<img>` are Satori nodes (not DOM — `next/image` does not apply).

Design: `docs/superpowers/specs/2026-06-23-funnel-metadata-engine-design.md`.
