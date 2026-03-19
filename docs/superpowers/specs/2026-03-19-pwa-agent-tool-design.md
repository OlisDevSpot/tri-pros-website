# PWA Agent Tool — Design Spec

**Date:** 2026-03-19
**Scope:** Convert the Tri Pros Remodeling app into a PWA for agent use (Add to Home Screen on iPhone)
**Audience:** Internal agents only (not customer-facing)

---

## Overview

Turn the Next.js app into a Progressive Web App so agents can "Add to Home Screen" on their iPhones and get a native-app-like experience — no browser chrome, standalone shell, branded splash screen with logo animation.

No libraries (`next-pwa`, `serwist`, etc.). Manual implementation only.

## 1. Web App Manifest

**File:** `src/app/manifest.ts` (Next.js auto-generates `/manifest.webmanifest`)

```ts
{
  name: "Tri Pros Remodeling",
  short_name: "TPR",
  start_url: "/dashboard",  // Auth redirect handled by better-auth — expired sessions redirect to /sign-in, which works fine in standalone mode
  display: "standalone",
  background_color: "#09090b",   // zinc-950, matches dark theme
  theme_color: "#03AFED",        // brand blue
  orientation: "portrait",       // Note: iOS ignores this field; harmless on Android
  icons: [
    { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
  ]
}
```

## 2. Apple Meta Tags

**File:** `src/app/(frontend)/layout.tsx` — added via the Next.js `metadata` export.

```ts
// In the metadata export:
appleWebApp: {
  capable: true,
  title: 'TPR',
  statusBarStyle: 'black-translucent',
},
icons: {
  // ...existing favicon icons
  apple: '/pwa/apple-touch-icon.png',
},
```

This uses the typed `Metadata.appleWebApp` field — no raw `<meta>` tags needed.

## 3. Icon Generation

**Script:** `scripts/generate-pwa-icons.ts` — one-time Node script using `sharp`.

**Source:** `public/company/logo/logo-dark.svg` (white logo on transparent)

**Outputs:**
- `public/pwa/icon-192.png` (192x192) — logo centered at ~60% of icon area on `#09090b` background
- `public/pwa/icon-512.png` (512x512) — same treatment
- `public/pwa/apple-touch-icon.png` (180x180) — same treatment

No maskable icons — the logo shape doesn't fit the maskable safe zone well. Android PWA installation is out of scope; agents use iPhones.

**Dependency strategy:** Install `sharp` as a `devDependency` (`pnpm add -D sharp`), run the script once to generate the PNGs, commit the outputs. `sharp` can remain as a devDep since Next.js uses it for image optimization anyway.

## 4. Splash Screen Animation

**File:** `src/shared/components/pwa-splash-screen.tsx` (client component)

### Behavior
- **Only shows in standalone mode** — detected via `window.matchMedia('(display-mode: standalone)')`
- **Shows once per app launch** — `sessionStorage` key `pwa-splash-shown` prevents replay on navigation
- **Duration:** ~2 seconds total animation + ~300ms fade-out
- **Renders above everything** — fixed overlay, `z-[9999]`, dark background matching app

### Animation Concept
- Full-screen `#09090b` background
- SVG logo rendered inline (paths, not `<img>`) so individual parts can animate
- House shape paths animate in first (draw-on or fade-in), then the blue R
- After completion, overlay fades out and unmounts
- Uses `motion/react` (already installed)

### Implementation Note
Multiple animation variants will be built for the user to choose from. The number of variants will be confirmed before implementation begins.

### Placement
Rendered in `src/app/(frontend)/layout.tsx` inside `<Providers>`, as the first child before `{children}`. This ensures access to any React context if needed in the future.

## 5. Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/app/manifest.ts` |
| Create | `src/shared/components/pwa-splash-screen.tsx` |
| Create | `scripts/generate-pwa-icons.ts` |
| Create | `public/pwa/icon-192.png` |
| Create | `public/pwa/icon-512.png` |
| Create | `public/pwa/apple-touch-icon.png` |
| Modify | `src/app/(frontend)/layout.tsx` (Apple meta tags + splash component) |

## 6. What's NOT Included

- No service worker / offline caching (data-driven app, stale cache is dangerous)
- No push notifications
- No `next-pwa` or `serwist` library
- No maskable icons
- No customer-facing PWA experience
