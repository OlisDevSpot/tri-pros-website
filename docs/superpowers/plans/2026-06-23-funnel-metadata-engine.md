# Funnel Metadata Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every funnel its own tab title, meta description, and a dynamically-generated hero-photo OG image so shared links feel native on WhatsApp/SMS/iMessage.

**Architecture:** Add one typed `meta` block to `FunnelSpec` (authored per funnel). A `generateMetadata` on the funnel page maps `meta` → Next.js `Metadata` (title/description/og/twitter/canonical, with `og:url`+canonical pointing at the funnel's own subdomain). A `next/og` `opengraph-image.tsx` route renders a 1200×630 PNG from the spec: hero photo + scrim + logo + headline + trust line, with a brand-gradient fallback.

**Tech Stack:** Next.js 15.5 App Router, `next/og` (`ImageResponse`, Satori), TypeScript, Tailwind v4 (app only — the OG card uses inline styles, not Tailwind).

## Global Constraints

- **Branch:** Work directly on `main`. Do NOT create a branch or worktree.
- **Staging:** The repo has unrelated WIP. Every commit stages **exact paths only** — never `git add -A`/`.`.
- **Verification:** Use `pnpm tsc` and `pnpm lint`. **NEVER run `pnpm build`.** No unit-test runner exists in this repo; runtime verification is `curl` + the Playwright MCP.
- **Dev DB / server:** `pnpm dev` (honors per-worktree `PORT` in `.env.local`). This feature touches no DB.
- **OG image sources must be JPEG/PNG, never WebP** — Satori's webp decoding is unreliable. kitchens uses its `.jpeg` hero; bathrooms/complete-interior set `meta.ogImage` to a `.jpeg` portfolio photo.
- **Funnel subdomain URL:** `ROOTS.subdomainUrl(slug)` → `https://<slug>.triprosremodeling.com` (from `src/shared/config/roots.ts`).
- **Public absolute URL (server-only):** `publicUrl(path)` from `src/shared/config/public-url.ts`.

---

### Task 1: Add `FunnelMeta` type and author `meta` on all three funnels

**Files:**
- Modify: `src/shared/domains/funnels/types.ts` (add `FunnelMeta`; add `meta` to `FunnelSpec` near line 221)
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`
- Modify: `src/shared/domains/funnels/constants/bathrooms.ts`
- Modify: `src/shared/domains/funnels/constants/complete-interior.ts`

**Interfaces:**
- Produces: `FunnelMeta { title: string; description: string; ogHeadline?: string; ogImage?: string }` and `FunnelSpec.meta: FunnelMeta`. Consumed by Tasks 2 and 3.

- [ ] **Step 1 (RED): add the required `meta` field and its type, then prove the funnels fail to compile**

In `src/shared/domains/funnels/types.ts`, add the interface directly above `export interface FunnelPixel` (~line 220):

```ts
export interface FunnelMeta {
  /** Tab title + og:title base. The root layout title template appends
   *  " | Tri Pros Remodeling". e.g. "Kitchen Remodels". */
  title: string
  /** Meta description + og:description. Aim ~150–160 chars. */
  description: string
  /** OG image headline override. Defaults to `hero.headline`. */
  ogHeadline?: string
  /** OG background image (absolute public path, JPEG/PNG). Defaults to
   *  `hero.media.src`. Required for funnels without `hero.media`. */
  ogImage?: string
}
```

Then add `meta` to `FunnelSpec` (right after `title: string`):

```ts
export interface FunnelSpec {
  slug: FunnelSlug
  offer: string
  title: string
  meta: FunnelMeta
  hero: HeroContent
  // ...rest unchanged
```

- [ ] **Step 2 (RED): run tsc, expect failures on the three funnel constants**

Run: `pnpm tsc`
Expected: FAIL — three errors of the form `Property 'meta' is missing in type '{ ... }' but required in type 'FunnelSpec'` at `kitchens.ts`, `bathrooms.ts`, `complete-interior.ts`. This proves the completeness guard works.

- [ ] **Step 3 (GREEN): author `meta` on kitchens**

In `src/shared/domains/funnels/constants/kitchens.ts`, add after the `title:` line:

```ts
  meta: {
    title: 'Kitchen Remodels',
    description: 'AAA-grade kitchen remodels at a showcase price for Southern California homeowners. See if your home qualifies — licensed, bonded & insured.',
  },
```
(kitchens omits `ogImage` — it falls back to its `.jpeg` hero `/portfolio-photos/modern-kitchen-1.jpeg`.)

- [ ] **Step 4 (GREEN): author `meta` on bathrooms**

In `src/shared/domains/funnels/constants/bathrooms.ts`, add after the `title:` line:

```ts
  meta: {
    title: 'Bathroom Remodels',
    description: 'Showcase-quality bathroom remodels at a showcase price across Southern California. See if your home qualifies — licensed, bonded & insured.',
    ogImage: '/portfolio-photos/modern-bathroom-1.jpeg',
  },
```
(bathrooms has no `hero.media`, so `ogImage` is required to avoid the gradient fallback.)

- [ ] **Step 5 (GREEN): author `meta` on complete-interior**

In `src/shared/domains/funnels/constants/complete-interior.ts`, add after the `title:` line:

```ts
  meta: {
    title: 'Complete Interior Remodels',
    description: 'Whole-home interior remodels at a showcase price for SoCal homeowners. See if your home qualifies — licensed, bonded & insured.',
    ogImage: '/portfolio-photos/modern-staircase-1.jpeg',
  },
```

- [ ] **Step 6 (GREEN): verify tsc + lint pass**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (no errors).

- [ ] **Step 7: Commit (exact paths only)**

```bash
git add src/shared/domains/funnels/types.ts \
  src/shared/domains/funnels/constants/kitchens.ts \
  src/shared/domains/funnels/constants/bathrooms.ts \
  src/shared/domains/funnels/constants/complete-interior.ts
git commit -m "feat(funnels): add typed per-funnel meta (title/description/og)"
```

---

### Task 2: `generateMetadata` on the funnel page

**Files:**
- Modify: `src/app/(frontend)/funnels/[trade]/page.tsx`

**Interfaces:**
- Consumes: `getFunnel`, `isFunnelSlug`, `FunnelSpec.meta` (Task 1), `ROOTS.subdomainUrl`.
- Produces: per-funnel page `<title>`, `<meta name="description">`, `og:*`, `twitter:*`, and `<link rel="canonical">`. The `og:image` is auto-wired by Task 3's file convention.

- [ ] **Step 1: Add `generateMetadata` to the page**

Replace the contents of `src/app/(frontend)/funnels/[trade]/page.tsx` with:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ROOTS } from '@/shared/config/roots'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { FunnelEngine } from '@/shared/domains/funnels/ui/funnel-engine'

interface Props {
  params: Promise<{ trade: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { trade } = await params
  if (!isFunnelSlug(trade)) {
    return {}
  }
  const spec = getFunnel(trade)
  const url = ROOTS.subdomainUrl(trade)
  return {
    title: spec.meta.title,
    description: spec.meta.description,
    openGraph: {
      title: spec.meta.title,
      description: spec.meta.description,
      url,
      type: 'website',
      siteName: 'Tri Pros Remodeling',
    },
    twitter: {
      card: 'summary_large_image',
      title: spec.meta.title,
      description: spec.meta.description,
    },
    alternates: { canonical: url },
  }
}

export default async function FunnelTradePage({ params }: Props) {
  const { trade } = await params
  if (!isFunnelSlug(trade)) {
    notFound()
  }
  return <FunnelEngine slug={trade} />
}
```

- [ ] **Step 2: Verify tsc + lint pass**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 3 (runtime RED→GREEN): start dev and inspect the rendered head**

Run (background): `pnpm dev`
Then: `curl -s http://localhost:3000/funnels/kitchens | grep -iE '<title>|og:title|og:url|og:description|name="description"|rel="canonical"'`
Expected, all present:
- `<title>Kitchen Remodels | Tri Pros Remodeling</title>` (the ` | Tri Pros Remodeling` suffix comes from the root layout title template)
- `og:title` content `Kitchen Remodels`
- `og:url` content `https://kitchens.triprosremodeling.com`
- canonical href `https://kitchens.triprosremodeling.com`
- description contains "AAA-grade kitchen remodels"

Repeat the curl for `bathrooms` and `complete-interior`, expecting their respective titles/descriptions and subdomain URLs.

- [ ] **Step 4: Commit (exact paths only)**

```bash
git add "src/app/(frontend)/funnels/[trade]/page.tsx"
git commit -m "feat(funnels): per-funnel page metadata + subdomain canonical/og:url"
```

---

### Task 3: Dynamic OG image route (`opengraph-image.tsx`) + template

**Files:**
- Create: `src/shared/domains/funnels/lib/og/fetch-as-data-uri.ts`
- Create: `src/shared/domains/funnels/lib/og/load-og-fonts.ts`
- Create: `src/shared/domains/funnels/lib/og/fonts/PlayfairDisplay-Bold.ttf` (downloaded)
- Create: `src/shared/domains/funnels/ui/og/funnel-og-card.tsx`
- Create: `src/app/(frontend)/funnels/[trade]/opengraph-image.tsx`

**Interfaces:**
- Consumes: `getFunnel`, `isFunnelSlug`, `FunnelSpec.meta`/`hero` (Task 1), `publicUrl`.
- Produces: a 1200×630 `image/png` at `/funnels/<slug>/opengraph-image`, auto-merged into the page's `og:image` by Next's file convention (so Task 2 didn't need to reference it).

- [ ] **Step 1: Download the OG headline font (committed TTF, loaded via `import.meta.url`)**

Run:
```bash
mkdir -p src/shared/domains/funnels/lib/og/fonts
curl -L -o src/shared/domains/funnels/lib/og/fonts/PlayfairDisplay-Bold.ttf \
  "https://github.com/google/fonts/raw/main/ofl/playfairdisplay/static/PlayfairDisplay-Bold.ttf"
```
Expected: a ~250–400KB `.ttf` file. Verify: `file src/shared/domains/funnels/lib/og/fonts/PlayfairDisplay-Bold.ttf` → reports "TrueType Font data". (Satori needs TTF/OTF/WOFF — not WOFF2.)

- [ ] **Step 2: Create the data-URI fetch helper**

`src/shared/domains/funnels/lib/og/fetch-as-data-uri.ts`:
```ts
import { Buffer } from 'node:buffer'
import 'server-only'

/**
 * Fetch an absolute image URL and return a base64 data URI Satori can embed.
 * Throws on non-2xx so callers can fall back to the brand gradient.
 */
export async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`OG asset ${url} → ${res.status}`)
  }
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
  return `data:${contentType};base64,${base64}`
}
```

- [ ] **Step 3: Create the font loader**

`src/shared/domains/funnels/lib/og/load-og-fonts.ts`:
```ts
import 'server-only'

export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal'
}

/** Load brand fonts for the OG renderer from a committed TTF (traced via import.meta.url). */
export async function loadOgFonts(): Promise<OgFont[]> {
  const serif = await fetch(
    new URL('./fonts/PlayfairDisplay-Bold.ttf', import.meta.url),
  ).then(r => r.arrayBuffer())
  return [{ name: 'Playfair Display', data: serif, weight: 700, style: 'normal' }]
}
```

- [ ] **Step 4: Create the presentational OG card (inline styles — Satori, not Tailwind)**

`src/shared/domains/funnels/ui/og/funnel-og-card.tsx` (the file-level eslint-disable is required — these `<img>` tags are Satori render nodes, never DOM, so `next/image` does not apply):
```tsx
/* eslint-disable @next/next/no-img-element */
interface FunnelOgCardProps {
  background: string | null
  logo: string | null
  headline: string
  trustLine: string
}

/**
 * Satori render tree for the funnel OG image. Inline styles only — Satori does
 * not read Tailwind. Every container with >1 child sets `display: flex`.
 */
export function FunnelOgCard({ background, logo, headline, trustLine }: FunnelOgCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        width: '100%',
        height: '100%',
        position: 'relative',
        background: background ? '#0b1220' : 'linear-gradient(135deg, #03AFED 0%, #0b1220 100%)',
        fontFamily: 'Playfair Display',
      }}
    >
      {background
        ? (
            <img
              src={background}
              width={1200}
              height={630}
              style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }}
            />
          )
        : null}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: 'flex',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.82) 100%)',
        }}
      />
      {logo
        ? (
            <img
              src={logo}
              width={190}
              height={56}
              style={{ position: 'absolute', top: 56, left: 64, objectFit: 'contain' }}
            />
          )
        : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          padding: '0 64px 72px',
          position: 'relative',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', fontSize: 62, fontWeight: 700, lineHeight: 1.05, maxWidth: 1000 }}>
          {headline}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30 }}>
          <span style={{ color: '#ffd54a' }}>★★★★★</span>
          <span style={{ color: 'white', marginLeft: 14 }}>{trustLine}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create the OG route**

`src/app/(frontend)/funnels/[trade]/opengraph-image.tsx`:
```tsx
import { ImageResponse } from 'next/og'
import { publicUrl } from '@/shared/config/public-url'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { fetchAsDataUri } from '@/shared/domains/funnels/lib/og/fetch-as-data-uri'
import { loadOgFonts } from '@/shared/domains/funnels/lib/og/load-og-fonts'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { FunnelOgCard } from '@/shared/domains/funnels/ui/og/funnel-og-card'

export const runtime = 'nodejs'
export const alt = 'Tri Pros Remodeling — see if your home qualifies'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function Image({ params }: Props) {
  const { trade } = await params
  const spec = isFunnelSlug(trade) ? getFunnel(trade) : null

  const bgPath = spec?.meta.ogImage ?? spec?.hero.media?.src ?? null
  const background = bgPath
    ? await fetchAsDataUri(publicUrl(bgPath)).catch(() => null)
    : null
  const logo = await fetchAsDataUri(publicUrl('/company/logo/logo-light-512.png')).catch(() => null)
  const fonts = await loadOgFonts()
  const headline = spec?.meta.ogHeadline ?? spec?.hero.headline ?? 'Tri Pros Remodeling'

  return new ImageResponse(
    (
      <FunnelOgCard
        background={background}
        logo={logo}
        headline={headline}
        trustLine="Licensed, Bonded & Insured"
      />
    ),
    { ...size, fonts },
  )
}
```

- [ ] **Step 6: Verify tsc + lint pass**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 7 (runtime): confirm the OG route returns a PNG for each funnel**

With `pnpm dev` running:
```bash
for s in kitchens bathrooms complete-interior; do
  echo "== $s =="; curl -s -o "/tmp/og-$s.png" -w "%{content_type} %{size_download}\n" \
    "http://localhost:3000/funnels/$s/opengraph-image"
done
```
Expected: each line prints `image/png` and a non-trivial byte size (> 20000). `file /tmp/og-kitchens.png` → "PNG image data, 1200 x 630".

- [ ] **Step 8 (runtime): eyeball the rendered images via Playwright MCP**

Use the Playwright MCP to navigate to `http://localhost:3000/funnels/kitchens/opengraph-image` and take a screenshot. Confirm visually: hero photo background, dark scrim, light logo top-left, white serif headline, gold stars + "Licensed, Bonded & Insured". Repeat for `bathrooms` (modern-bathroom photo) and `complete-interior` (staircase photo). If a background is missing, confirm the brand-gradient fallback renders the text cleanly.

- [ ] **Step 9: Commit (exact paths only)**

```bash
git add src/shared/domains/funnels/lib/og/fetch-as-data-uri.ts \
  src/shared/domains/funnels/lib/og/load-og-fonts.ts \
  src/shared/domains/funnels/lib/og/fonts/PlayfairDisplay-Bold.ttf \
  src/shared/domains/funnels/ui/og/funnel-og-card.tsx \
  "src/app/(frontend)/funnels/[trade]/opengraph-image.tsx"
git commit -m "feat(funnels): dynamic per-funnel OG image (hero + scrim + brand)"
```

---

### Task 4: Document the metadata engine + final cross-funnel verification

**Files:**
- Modify: `src/shared/domains/funnels/DOCS.md` (add a slug-anchored metadata section)

**Interfaces:**
- Consumes: everything above. Produces: authoring guidance for future funnels.

- [ ] **Step 1: Add a metadata section to the funnels DOCS**

Append to `src/shared/domains/funnels/DOCS.md`:
```markdown
## Funnel metadata & share images {#funnel-metadata}

Every funnel authors a required `meta` block on its `FunnelSpec`
(`title`, `description`, optional `ogHeadline`, optional `ogImage`). Omitting it
is a compile error in `lib/registry.ts` — the completeness guard.

- **Tab title / `og:title`:** `meta.title`. The root layout title template appends
  ` | Tri Pros Remodeling`, so author the bare label (e.g. `Kitchen Remodels`).
- **Description:** `meta.description` (~150–160 chars) → meta description + `og:description`.
- **Share image:** generated at `/funnels/<slug>/opengraph-image` by
  `app/(frontend)/funnels/[trade]/opengraph-image.tsx`. Background = `meta.ogImage`
  ?? `hero.media.src`; headline = `meta.ogHeadline` ?? `hero.headline`. No background
  → on-brand gradient fallback.
- **OG images MUST be JPEG/PNG, never WebP** — Satori's webp decoding is unreliable.
  Funnels without a `hero.media` photo (bathrooms, complete-interior) MUST set
  `meta.ogImage` to a `.jpeg`/`.png` or they render the gradient fallback.
- **`og:url` + canonical** point at the funnel's own subdomain via
  `ROOTS.subdomainUrl(slug)`, not the apex.
```

- [ ] **Step 2: Full cross-funnel verification pass**

With `pnpm dev` running, confirm for all three slugs (`kitchens`, `bathrooms`, `complete-interior`):
- `curl -s http://localhost:3000/funnels/<slug> | grep -iE '<title>|og:title|og:url|name="description"|rel="canonical"'` → funnel-specific title (with suffix), subdomain `og:url`+canonical, funnel description.
- `curl -s -o /dev/null -w "%{content_type}\n" http://localhost:3000/funnels/<slug>/opengraph-image` → `image/png`.

Run final: `pnpm tsc && pnpm lint` → PASS.

- [ ] **Step 3: Commit (exact paths only)**

```bash
git add src/shared/domains/funnels/DOCS.md
git commit -m "docs(funnels): document the funnel metadata + OG engine"
```

---

## Notes & risk log

- **Satori positioning quirks:** if the scrim/logo don't position as expected, Satori supports
  `position: absolute` with explicit `top/left/right/bottom` (used above instead of `inset`).
- **Font:** if the GitHub `static/PlayfairDisplay-Bold.ttf` path 404s, fall back to the variable
  font at `ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf` (Satori renders it at default weight).
- **Font tracing:** `load-og-fonts.ts` loads the TTF via `new URL('./fonts/...', import.meta.url)`.
  If the route 500s at Step 7 with a missing-font/file error (rare tracing edge case for a lib
  module), move the `fetch(new URL(...))` font load inline into `opengraph-image.tsx` — the Next
  docs pattern — keeping the file next to the route.
- **WebP:** every OG background path resolves to a committed `.jpeg`, so Satori never decodes webp.
  If a future funnel points `ogImage`/`hero.media` at a `.webp`, expect a blank background → the
  gradient fallback fires; convert to jpg/png instead.
- **Real-world preview** (WhatsApp/iMessage) can only be confirmed post-deploy, since crawlers fetch
  the public subdomain URL. The local curl/Playwright checks confirm the markup and image render.
```
