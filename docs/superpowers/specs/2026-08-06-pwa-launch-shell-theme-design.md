# PWA Launch Shell & Theme Consistency — Design (Domain A)

**Date:** 2026-08-06
**Status:** Approved design, pending spec review
**Scope:** Presentation/shell only. Cold-start/performance work (Domain B) is a separate spec.

## Problem

Launching the installed iOS home-screen PWA produces a three-stage sequence that feels slow and off-brand:

1. **White blank screen** hangs for seconds before anything paints.
2. A **dark TPR splash animation** plays, and feels too long.
3. The **dashboard** finally loads.

Two distinct complaints:

- **The white hang** — the native iOS launch surface is white while the web view cold-boots.
- **Theme inconsistency** — the launch background is white and the splash is hardcoded dark, neither of which respects the app's dark/light toggle. A light-mode user gets a dark→light flip.

This spec (Domain A) fixes the *presentation* causes: the white native launch surface, the theme flash (FOUC), and the over-long splash. It does **not** address the underlying cold-start latency (DB driver, forced-dynamic rendering, session dedup) — that is Domain B.

## Decisions (locked during brainstorming)

- **Effort split:** Domain A (presentation) first; Domain B (performance) is a later, separate spec.
- **Launch theme:** an intentional **always-dark branded moment**. The native launch surface, the splash, and the boot canvas are all dark; the dashboard then resolves to the user's real theme underneath the splash. One dark asset set, no light variants.
- **iOS launch mechanism:** `pwa-asset-generator` producing a **committed dark PNG startup-image matrix** (correct from the very first launch, zero runtime dependency). Chosen over the `iosPWASplash` runtime injector, which would avoid committed assets but can flash white once on the first-ever cold launch.
- **Splash timing:** simply **shorten the fixed timer** (no event-driven coupling in Domain A, which could backfire while cold-start is unfixed).
- **Splash black `#09090b`:** kept as the intentional premium splash color even though `.dark --background` is a lighter `oklch(0.24…)`; the 300 ms fade masks the handoff.

## Research basis (why "just set a color" isn't available on iOS)

Confirmed against Apple docs, web.dev/Firtman, and MDN (current through iOS 18, 2025–2026):

- iOS **ignores** `manifest.background_color` for the standalone launch screen (unlike Android). Unchanged in recent iOS/WebKit.
- `theme-color` and `apple-mobile-web-app-status-bar-style` only affect the **status bar**, never the launch surface. Under `black-translucent`, `theme-color` is ignored entirely.
- CSS/meta cannot reach the native launch surface — it paints **before** any HTML/CSS parses.
- A single non-matching `apple-touch-startup-image` falls back to **white**; iOS selects by exact device media-query match and does not stretch/letterbox.
- Service workers do **not** touch the launch surface (separate concern from app-shell precache).

∴ The per-device startup-image matrix is the only reliable mechanism; the accepted lightweight path is to **generate** it from one color rather than hand-author it.

## Components

### A1 — iOS startup images (kill the white hang)

**Goal:** replace the white native launch surface with a dark `#09090b` surface that visually matches the splash's resting composition, so native launch → JS splash animation is continuous.

- **Generate** a dark startup-image set with `pwa-asset-generator` (run via `npx`, one-time; not added as a runtime dependency):
  - Source: the TPR logo/house mark (reuse the same mark the splash SVG renders, or `public/pwa/icon-512.png`) centered on a `#09090b` background.
  - Background flag: `--background "#09090b"`, splash-only (icons already exist in `public/pwa/`).
  - Output PNGs into `public/pwa/splash/`.
- **Wire** the generated `<link rel="apple-touch-startup-image">` tags into Next's metadata via `appleWebApp.startupImage` (array of `{ url, media }`) in `src/app/(frontend)/layout.tsx` (`appleWebApp` block, currently lines 61–65, which has no `startupImage`).
- **Keep** `appleWebApp.capable: true` (emits `apple-mobile-web-app-capable`, required for startup images to apply).

**Interface:** the launch surface is driven entirely by the static `<link>` tags in the document head — no runtime code, correct from first launch.

**Depends on:** the generated PNGs existing in `public/pwa/splash/` and the metadata wiring; nothing else.

### A2 — Theme-aware dark boot + kill the FOUC

**Goal:** stop the hardcoded-dark markup from fighting next-themes, so the resolved theme is applied before paint and the underlying canvas matches it.

Current culprits in `src/app/(frontend)/layout.tsx` (`<html>`, lines 124–130):

- `className="dark"` — hardcoded, forces dark server markup; a light user then flips to light after next-themes runs.
- `style={{ backgroundColor: '#09090b' }}` — a fixed near-black on `<html>` that next-themes never manages (it manages `class` + `color-scheme`, not `background-color`), so in light mode `<html>` stays near-black behind the light `<body>`. This is the visible "white/dark disagreement."

Changes:

- **Remove** `className="dark"` from `<html>`. `suppressHydrationWarning` is already present (line 127) and stays. Let next-themes' pre-hydration script set the class before paint.
- **Remove** the inline `style={{ backgroundColor: '#09090b' }}`.
- **Add** `color-scheme` declarations in `src/app/(frontend)/globals.css` as the durable UA-canvas fallback: `:root { color-scheme: light }` and `.dark { color-scheme: dark }`. (next-themes' `enableColorScheme` default also sets this inline pre-paint; the CSS is the static belt-and-suspenders so overscroll gutters / first frame never default white.)
- **No change** to `Providers` / `ThemeProvider` config (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) — it is correct; the markup was the problem.

**Result:** In the PWA, the dark splash overlay masks theme resolution, so when it fades the dashboard is already at the correct theme (no flip). In a plain browser, next-themes resolves before paint, so there is no flash for anyone.

**Depends on:** next-themes already in place (it is).

### A3 — Splash timing

**Goal:** shorten the perceived splash.

- In `src/shared/components/splash-screen/use-splash-visibility.ts` (line 6), change `SPLASH_VISIBLE_MS` from `2000` to **`1100`**.
  - Rationale for 1100 (not 1000): the splash SVG kicks the blue "R" spring at `delay: 0.9s`, so a 1000 ms hold clips it right as it lands. 1100 ms lets the animation resolve. **1000 is acceptable if a slightly clipped landing is fine** — final number confirmed in review.
- Keep the 300 ms exit fade (`splash-overlay.tsx`). Keep the once-per-session gate and standalone-only rendering.
- Perceived splash drops from ≈2.3 s to ≈1.4 s. Additive to (not overlapping) the native launch, which A1 addresses separately.

**Out of scope here:** event-driven "dismiss when interactive" dismissal — deferred to Domain B, where it is safe once the dashboard is actually fast.

### A4 — Color consistency (no change, documented)

The splash/launch `#09090b` is darker than the dashboard's `.dark --background` (`oklch(0.24…)`), so there is a subtle brightness step at handoff. **Decision: leave `#09090b`** as the intentional premium splash black; the 300 ms fade covers the step. Manifest `background_color` (`#09090b`) and `theme_color` (`#03AFED`) are unchanged and remain correct for Android / status-bar tint.

### A5 — Doc fix (stale reference)

`docs/codebase-conventions/app-shell.md` cites `src/app/layout.tsx` (lines 11, 27, 47, 141) as the shell reference, but that file does not exist — the real root layout is `src/app/(frontend)/layout.tsx`. Update those references. (Flagged per the trust-but-verify / ping-on-staleness rule.)

## Files touched

| File | Change |
|---|---|
| `public/pwa/splash/*` | New generated dark startup-image PNGs (A1) |
| `src/app/(frontend)/layout.tsx` | Add `appleWebApp.startupImage` (A1); remove `className="dark"` + inline `backgroundColor` (A2) |
| `src/app/(frontend)/globals.css` | Add `color-scheme` to `:root` / `.dark` (A2) |
| `src/shared/components/splash-screen/use-splash-visibility.ts` | `SPLASH_VISIBLE_MS` 2000 → 1100 (A3) |
| `docs/codebase-conventions/app-shell.md` | Fix stale `src/app/layout.tsx` refs (A5) |

## Testing & verification

- `pnpm lint` + `pnpm tsc` pass (never `pnpm build`).
- **Manual PWA check on a real iOS device** (headless/simulator won't faithfully reproduce the native launch surface):
  1. Re-add the app to the home screen (startup images are read at install time).
  2. Cold launch → the native launch surface is **dark `#09090b`**, not white.
  3. Splash animation completes and dismisses at ~1.1 s.
  4. Toggle app to **light** mode, close, relaunch → no dark→light flip when the splash fades; dashboard is light.
  5. Toggle to **dark** → consistent dark throughout.
- **Plain browser (desktop/mobile Safari & Chrome):** load `/dashboard` in light mode → no dark flash of `<html>`; `color-scheme` matches theme; overscroll gutters match theme.
- Confirm the once-per-session splash gate still holds (no splash on in-session soft navigation).

## Risks & mitigations

- **Startup images only refresh on re-install.** Existing installed users keep the white launch until they re-add to home screen. Acceptable; note in rollout.
- **Startup-image asset volume** (~20–40 PNGs) in `public/pwa/splash/`. Accepted tradeoff for first-launch correctness and zero runtime dependency.
- **Device-matrix coverage gaps** — a device with no matching media query falls back to white. Mitigation: use the generator's current full matrix; spot-check the primary team devices.
- **Removing hardcoded `dark`** could regress if any code relied on `<html class="dark">` being present at SSR. Mitigation: next-themes sets it pre-paint; verify no server code reads the class, and check the first-frame canvas via the browser test above.

## Explicitly out of scope (Domain B or later)

- Neon serverless driver swap / connection pooling / cold-start mitigation.
- Forced-dynamic → static-shell + PPR / `loading.tsx` skeletons.
- `getSession` de-duplication via React `cache()`.
- Service-worker app-shell precaching (Serwist).
- True event-driven splash dismissal.
