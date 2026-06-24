# Funnel Metadata Engine — Design

**Date:** 2026-06-23
**Status:** Approved (design), pending implementation
**Author:** Oliver P + Claude

## Problem

Sharing a funnel link (e.g. `kitchens.triprosremodeling.com`) on WhatsApp / SMS / iMessage
shows a **generic** preview: the apex logo OG image, the title "Tri Pros Remodeling", and the
generic site description. The funnel never feels like a native, branded page.

**Root cause:** [`src/app/(frontend)/funnels/[trade]/page.tsx`](../../../src/app/(frontend)/funnels/[trade]/page.tsx)
has no `generateMetadata`, so every funnel inherits the root layout's metadata verbatim
([`src/app/(frontend)/layout.tsx`](../../../src/app/(frontend)/layout.tsx)). Two consequences:

1. **No per-funnel OG image** — every share uses `/company/logo/opengraph-image.png`.
2. **No per-funnel tab title / description** — every tab reads "Tri Pros Remodeling".

Secondary issue: the root layout hard-codes `openGraph.url` and `alternates.canonical` to the
apex, so even the link identity of a funnel points back to `triprosremodeling.com` rather than
its own subdomain.

## Goals

- Every funnel (kitchens, bathrooms, complete-interior, and any future funnel) gets its own
  tab title, meta description, and share image — authored once, in one typed place.
- Share previews feel native: photographic OG image generated dynamically from the funnel's spec.
- Adding metadata to a new funnel is a compile-time-enforced part of authoring the funnel.

## Non-goals (YAGNI)

- Static per-funnel OG art files.
- A static/dynamic hybrid OG pipeline.
- Changing the root layout's apex metadata. Only the funnel route changes.

## Design

### 1. Data model — one typed `meta` block per funnel

Add to [`src/shared/domains/funnels/types.ts`](../../../src/shared/domains/funnels/types.ts):

```ts
export interface FunnelMeta {
  /** Tab title + og:title base. The root layout's title template appends
   *  " | Tri Pros Remodeling". e.g. "Kitchen Remodels". */
  title: string
  /** Meta description + og:description. Aim ~150–160 chars. */
  description: string
  /** OG image headline override. Defaults to `hero.headline`. */
  ogHeadline?: string
  /** OG background image override (absolute public path). Defaults to
   *  `hero.media.src`. REQUIRED in practice for funnels without hero media
   *  (bathrooms, complete-interior) or they fall back to the brand gradient. */
  ogImage?: string
}
```

`FunnelSpec` gains a required field:

```ts
export interface FunnelSpec {
  // ...existing...
  meta: FunnelMeta
  // ...
}
```

Making `meta` **required** means `tsc` errors at [`registry.ts`](../../../src/shared/domains/funnels/lib/registry.ts)
if a funnel omits it — the same completeness guarantee the rest of the engine uses.

The existing `FunnelSpec.title` (e.g. "Kitchen Showcase") stays as the internal label; `meta.title`
is the public-facing SEO title.

### 2. Page metadata — `generateMetadata` on the funnel page

[`src/app/(frontend)/funnels/[trade]/page.tsx`](../../../src/app/(frontend)/funnels/[trade]/page.tsx)
gains:

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const { trade } = await params
  if (!isFunnelSlug(trade)) return {}
  const spec = getFunnel(trade)
  const url = subdomainUrl(trade)  // from roots config → https://kitchens.triprosremodeling.com
  return {
    title: spec.meta.title,            // root template → "<title> | Tri Pros Remodeling"
    description: spec.meta.description,
    openGraph: {
      title: spec.meta.title,
      description: spec.meta.description,
      url,
      type: 'website',
      // images: auto-merged from opengraph-image.tsx in this segment
    },
    twitter: {
      card: 'summary_large_image',
      title: spec.meta.title,
      description: spec.meta.description,
    },
    alternates: { canonical: url },
  }
}
```

Notes:
- The funnel subdomain URL is built with the existing `subdomainUrl(label)` helper
  (`src/shared/config/roots.ts:41`) → `https://<slug>.triprosremodeling.com`.
- We do **not** set `openGraph.images` here — Next.js automatically wires the segment's
  `opengraph-image.tsx` (below) into `og:image`. The image URL resolves against the root
  `metadataBase` (apex), which is reachable both at apex and via subdomain rewrite, so the
  crawler can always fetch it.
- `notFound()` handling stays in the page component; `generateMetadata` returns `{}` for unknown
  slugs to avoid throwing during metadata generation.

### 3. OG image — dynamic `opengraph-image.tsx`

New file: `src/app/(frontend)/funnels/[trade]/opengraph-image.tsx`, using `next/og`'s
`ImageResponse`.

```ts
export const runtime = 'nodejs'          // de-risks image decoding vs edge
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Tri Pros Remodeling'  // or dynamic via generateImageMetadata

export default async function Image({ params }) {
  const { trade } = await params
  const spec = getFunnel(trade)            // guard unknown slug → gradient fallback
  // background = spec.meta.ogImage ?? spec.hero.media?.src ?? null
  // headline   = spec.meta.ogHeadline ?? spec.hero.headline
  // render: photo bg + dark gradient scrim + logo mark + headline + trust line
  // if background null/unloadable → brand-gradient card with same text
  return new ImageResponse(<OgTemplate ... />, { ...size, fonts })
}
```

**Layout** (matches approved mockup):
- Hero photo as full-bleed background.
- Dark gradient scrim (bottom-heavy) for text legibility.
- Logo mark (top-left).
- Headline (large, Playfair or Syne).
- Trust line: "Licensed, Bonded & Insured" + star rating.
- Brand-gradient fallback when no/failed background image.

**Technical risks to verify during build (do not assume):**
- **WebP support in `next/og`:** Satori's `<img>` webp support is historically unreliable.
  Kitchens' hero is `.jpeg` (safe). Mitigation for any webp source: Node runtime + the
  `meta.ogImage` override (point at a jpg/png) + the gradient fallback. Verify with a real
  fetch of each funnel's `/funnels/<slug>/opengraph-image` during implementation.
- **Fonts:** `next/og` needs fonts as `ArrayBuffer`. Load Syne + Playfair explicitly (local
  font files or fetched), fall back to system fonts if loading is flaky.
- **Logo:** Satori dislikes SVG `<img>`. Use a PNG logo mark (e.g. from `/pwa/` or a small
  exported PNG), not `logo-light.svg`.

### 4. Per-funnel SEO copy (author values)

Draft values for review — final copy is the author's call:

| Funnel | `meta.title` | `meta.description` |
|---|---|---|
| kitchens | Kitchen Remodels | AAA-grade kitchen remodels at a showcase price for Southern California homeowners. See if your home qualifies — licensed, bonded & insured. |
| bathrooms | Bathroom Remodels | Showcase-quality bathroom remodels at a showcase price across Southern California. See if your home qualifies — licensed, bonded & insured. |
| complete-interior | Complete Interior Remodels | Whole-home interior remodels at a showcase price for SoCal homeowners. See if your home qualifies — licensed, bonded & insured. |

`meta.ogImage` for **bathrooms** and **complete-interior** should be set to a strong portfolio
photo (they have no `hero.media`), or they will render the brand-gradient fallback OG.
`meta.ogHeadline` is optional per funnel; defaults to `hero.headline`.

## Units & boundaries

- **`FunnelMeta` / `FunnelSpec.meta`** (types.ts): the authored metadata contract. Depends on
  nothing; consumed by the page + OG route.
- **`generateMetadata`** (page.tsx): pure spec → `Metadata` mapping. Depends on `getFunnel`,
  `subdomainUrl`, `isFunnelSlug`.
- **`opengraph-image.tsx`**: spec → rendered PNG. Depends on `getFunnel`, brand assets/fonts,
  `next/og`. Self-contained; testable by hitting the route.
- **OG template component**: presentational, props-driven (background, headline, trust line).
  Lives in its own file (one component per file). Can swap internals without touching the route.

## Verification

- `pnpm tsc` + `pnpm lint` clean.
- `tsc` errors if a new funnel omits `meta` (completeness check).
- Hit `/funnels/kitchens/opengraph-image` (and bathrooms, complete-interior) locally and confirm
  a 1200×630 PNG renders with the right hero/text, including the gradient fallback path.
- View-source / metadata-debugger on each funnel: tab title is "<Funnel> | Tri Pros Remodeling",
  description is the funnel's, `og:image` points at the segment OG route, `og:url` +
  `canonical` are the funnel's subdomain.
- Real-world: paste each funnel link into WhatsApp / iMessage and confirm a branded preview
  (post-deploy; crawlers need the public URL).

## Files touched

- `src/shared/domains/funnels/types.ts` — add `FunnelMeta`, `FunnelSpec.meta`.
- `src/shared/domains/funnels/constants/{kitchens,bathrooms,complete-interior}.ts` — author `meta`.
- `src/app/(frontend)/funnels/[trade]/page.tsx` — add `generateMetadata`.
- `src/app/(frontend)/funnels/[trade]/opengraph-image.tsx` — new dynamic OG route.
- New OG template component file (co-located or under funnels `ui/`), one component per file.
