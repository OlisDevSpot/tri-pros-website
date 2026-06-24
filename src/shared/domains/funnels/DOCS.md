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

## Adding a new funnel <!-- #adding-a-new-funnel -->

A new funnel is "author one spec + drop assets":

1. **Spec:** create `constants/<slug>.ts` exporting `<slug>Funnel: FunnelSpec`.
   Reuse prebuilt steps (`ZIP_STEP`, `PII_STEP`, `HOME_TYPE_STEP`,
   `ADDRESS_STEP`, `CONFIRMATION_STEP`) — import their **configs from
   `lib/steps/<step>`** (config-only modules), NOT from `ui/steps/*` (the
   components). Co-locating a step config with its component would drag the
   component's import graph into the spec and can close a registry→spec→config
   import cycle. Add card-select steps for trade-native questions. Declare `enrichment: { stepId, label }[]` for every dimension that
   should reach the CRM (it renders in the customer Funnel Intake panel + the
   creation-time intake note automatically). Set `pixel.contentCategory`.
2. **Register:** add the slug to `constants/slugs.ts`, the spec to
   `lib/registry.ts`, the trade UUID to `constants/trade-by-slug.ts`, and the
   lead name to `lib/build-lead-input.ts`.
3. **Assets:** vertical-specific images live under
   `public/funnels/<slug>/<dimension>/<option>.webp`; shared assets live under
   `public/funnels/common/...`. Generate with an image model and run them
   through the `optimize-image-assets` skill (convert→webp, crop, resize,
   organize, delete source PNGs) before committing.
4. **Variants (optional):** add `variants: { <name>: { blocks } }` for alternate
   landing positioning, reachable at `/funnels/<slug>?v=<name>`. Steps + pixel
   are unchanged.

Measurement, ZIP gating, phone validation, lead submission, and enrichment are
all funnel-agnostic — no backend wiring is needed for a new funnel.
