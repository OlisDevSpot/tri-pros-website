# Funnel Meta Pixel — Dev/Test Isolation Implementation Plan

> **For agentic workers:** small, surgical change. No test runner exists in this
> repo (no vitest/jest) — verification is `pnpm tsc` + `pnpm lint` (the project's
> documented standard, per CLAUDE.md), not TDD. Steps use checkbox syntax.

**Goal:** Stop dev/staging/preview funnel testing from firing the live Meta Pixel,
while keeping production firing + browser↔CAPI dedup intact.

**Architecture:** Gate the browser Pixel **base-code loader** on a host check
(`isProductionHost`) derived from the canonical `APP_HOSTS.prod`. Because every
funnel event goes through `firePixel()`, which already no-ops when `window.fbq`
is undefined, gating the loader alone silences PageView/ViewContent/Lead/
CompleteRegistration everywhere outside production — no other tracking files
change. CAPI isolation is already solved (server `test_event_code` + prod boot
gate); we document the unified model rather than refactor it.

**Tech Stack:** Next.js 15 App Router (server layout + `next/headers`), TypeScript.

## Global Constraints

- Production funnel hosts are subdomains of `triprosremodeling.com` (Vercel
  wildcard). Dev = `*.localhost:3000/1/2`. Preview = `*.vercel.app`. ngrok tunnel
  = `destined-emu-bold.ngrok-free.app`. Only the first class is production.
- **Do NOT gate on `NODE_ENV`**: `process.env.NODE_ENV` is `'production'` for
  Vercel **preview** builds too, so it cannot distinguish preview from prod. The
  request host can.
- `APP_HOSTS.prod` (`src/shared/config/roots.ts`) is the single source of truth
  for production hosts. Derive from it; never hardcode the domain elsewhere.
- Coding conventions: one component per file, named exports only, no helper
  functions in component files (host helper lives in `src/shared/config/`).
- Don't touch the just-shipped CAPI `test_event_code` path — it works.

---

### Task 1: Host-based production gate for the browser Pixel

**Files:**
- Create: `src/shared/config/is-production-host.ts`
- Modify: `src/app/(frontend)/funnels/layout.tsx`
- Modify: `src/shared/domains/funnels/lib/tracking/pixel-loader.tsx` (comment only)

**Interfaces:**
- Produces: `isProductionHost(host: string | null | undefined): boolean` — true
  only when `host` is the apex, `www`, or any subdomain of a `APP_HOSTS.prod`
  entry (port-insensitive, case-insensitive).

- [ ] **Step 1: Create the helper**

```ts
// src/shared/config/is-production-host.ts
import { APP_HOSTS } from '@/shared/config/roots'

/**
 * True only when the request is served from the real production domain — the
 * apex, `www`, or any funnel subdomain of a `APP_HOSTS.prod` entry.
 *
 * Host-based on purpose: `process.env.NODE_ENV` is `'production'` for Vercel
 * PREVIEW builds too, so it cannot tell preview from prod. The request host can.
 * `localhost`, `*.localhost`, the ngrok tunnel, and `*.vercel.app` previews all
 * return false. `APP_HOSTS.prod` (roots.ts) is the single source of truth — add
 * a new production registrable domain there, not here.
 */
export function isProductionHost(host: string | null | undefined): boolean {
  if (!host) {
    return false
  }
  const hostname = host.split(':')[0].toLowerCase()
  return APP_HOSTS.prod.some(
    prod => hostname === prod || hostname.endsWith(`.${prod}`),
  )
}
```

- [ ] **Step 2: Gate the loader in the funnel layout**

Make the server layout `async`, read the host, render `<PixelLoader />` only on
a production host. (The page under this layout is already `async`/dynamic, so no
static→dynamic regression.)

```tsx
// src/app/(frontend)/funnels/layout.tsx
import type { ReactNode } from 'react'

import { headers } from 'next/headers'

import { isProductionHost } from '@/shared/config/is-production-host'
import { PixelLoader } from '@/shared/domains/funnels/lib/tracking/pixel-loader'

// Funnel-only chrome. No marketing nav/footer — funnels are deliberately
// isolated from the (site) group. The Meta Pixel base code loads here (Phase 1)
// but ONLY on the production domain: dev/preview/ngrok funnel testing must never
// fire the live pixel (the browser pixel has no test_event_code escape hatch the
// way CAPI does). Gate = host, not NODE_ENV. see isProductionHost + meta/DOCS.md
export default async function FunnelLayout({ children }: { children: ReactNode }) {
  const pixelEnabled = isProductionHost((await headers()).get('host'))
  // `text-foreground` is REQUIRED here, not cosmetic: `body` sets
  // `text-foreground` which computes to the dark-theme (near-white) color under
  // the app-wide `<html class="dark">`. The funnel subtree would inherit that
  // computed near-white `color` and render illegible on the light background.
  // Re-asserting `text-foreground` inside `.funnel-light` re-resolves `color`
  // to the light-theme foreground for everything that doesn't set its own.
  return (
    <div className="funnel-light min-h-dvh bg-background text-foreground">
      {pixelEnabled && <PixelLoader />}
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Refresh the stale PixelLoader comment**

The old comment says the loader stays inert in dev *because the pixel ID is
unset* — no longer the reason (the ID is set in `.env`; the host gate is what
keeps it inert). Update the doc comment; keep the `pixelId` presence check as
defense-in-depth for unprovisioned environments.

```tsx
// src/shared/domains/funnels/lib/tracking/pixel-loader.tsx (lines 6-12)
/**
 * One-time Meta Pixel base-code loader. The funnel layout mounts this ONLY on
 * the production host (see isProductionHost) — so dev/preview/ngrok sessions
 * never define `window.fbq`, and every firePixel() call downstream no-ops.
 * Also renders nothing when NEXT_PUBLIC_META_PIXEL_ID is unset (unprovisioned
 * environments). Standard Meta snippet; the initial PageView fires here, all
 * later events go through firePixel().
 */
```

- [ ] **Step 4: Verify**

```bash
pnpm tsc && pnpm lint
```
Expected: no new errors. (Sanity-check the helper logic against the host classes
in Global Constraints: only `*.triprosremodeling.com` → true.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/config/is-production-host.ts \
  "src/app/(frontend)/funnels/layout.tsx" \
  src/shared/domains/funnels/lib/tracking/pixel-loader.tsx
git commit -m "feat(funnels): gate browser Meta Pixel to production host only"
```

---

### Task 2: Document the isolation model + manual runbooks (B + C)

**Files:**
- Modify: `src/shared/services/providers/meta/DOCS.md`

B (Traffic Permissions allow-list) and C (Test Events QA loop) are Meta Events
Manager dashboard actions — not code. Capture them as a runbook so the model is
discoverable and the manual steps are recorded.

- [ ] **Step 1: Append the isolation section to `meta/DOCS.md`**

Add a `## Test vs live data isolation` section covering:
1. **The unified rule** — "non-production never pollutes optimization":
   - Browser pixel: fires only on the production host (`isProductionHost`); silent
     in dev/preview/ngrok. No browser `test_event_code` exists, so silence is the
     only lever.
   - Server CAPI: always sends, but non-prod carries `META_TEST_EVENT_CODE` →
     Events Manager → Test Events (excluded from optimization); prod carries none
     (`server-env.ts` boot gate forbids the code in `NODE_ENV=production`).
   - Asymmetric inputs (host for browser, env for server) but one concept: "is
     this production?" Documented so it's intentional, not accidental.
2. **(B) Traffic Permissions allow-list** — backstop runbook: Events Manager →
   Data Sources → the dataset → Settings → Traffic Permissions → create an Allow
   List containing only `triprosremodeling.com` (covers subdomains). Meta then
   drops any event whose origin domain isn't allow-listed (localhost can't reach
   it, but `*.vercel.app` previews would be dropped). Note the iframe/redirect
   false-block caveat.
3. **(C) Browser QA loop** — to verify the live pixel without polluting: Events
   Manager → Test Events → enter the funnel URL → "Open Website" (binds that
   session to the Test Events panel) + Meta Pixel Helper extension. This is the
   only supported way to watch browser events; it's session-bound, not automatable.
4. **Why prevention, not cleanup** — events in the live dataset can't be deleted
   per-event; they age out over 30–180 days. The gate is the only real control.

- [ ] **Step 2: Verify + commit**

```bash
pnpm lint
git add src/shared/services/providers/meta/DOCS.md
git commit -m "docs(meta): document pixel/CAPI test-vs-live isolation + runbooks"
```

---

## Out of scope / explicitly not doing

- **Option D (separate test pixel ID per env):** rejected. The shared-pixel +
  shared-`event_id` dedup design would split across two datasets if the browser
  pointed at a test pixel while CAPI kept the prod dataset. Browser silence + CAPI
  Test Events achieves isolation without that risk.
- **Refactoring the CAPI `test_event_code` path:** it shipped and works; touching
  it risks regressing the just-fixed server isolation. YAGNI.

## Self-review notes

- Spec coverage: A = Task 1; B + C = Task 2. ✓
- No `NODE_ENV` browser gate (preview trap avoided). ✓
- Single source of truth (`APP_HOSTS.prod`) reused, not duplicated. ✓
- Type consistency: `isProductionHost(host: string | null | undefined): boolean`
  consumed in the layout with `headers().get('host')` (`string | null`). ✓
