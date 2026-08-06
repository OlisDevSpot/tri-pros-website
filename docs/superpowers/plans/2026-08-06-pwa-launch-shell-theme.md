# PWA Launch Shell & Theme Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the iOS PWA white launch hang, the dark→light theme flip (FOUC), and the over-long splash — making app open feel instant and on-brand.

**Architecture:** Presentation/shell only (Domain A). Fix the hardcoded-dark markup so next-themes resolves the theme before paint; add a committed dark `apple-touch-startup-image` matrix so the native iOS launch surface is dark from first launch; shorten the splash timer. No backend/cold-start changes (Domain B, separate plan).

**Tech Stack:** Next.js 15 App Router, `next/font`, next-themes, Tailwind v4, `motion/react`, `pwa-asset-generator` (npx, build-time only — not a runtime dependency).

## Global Constraints

- Verify with `pnpm tsc` + `pnpm lint` ONLY. NEVER run `pnpm build`.
- Work on `main`; stage explicitly by path. NEVER `git add -A`.
- Company data comes from `src/shared/constants/company/`; never hardcode new company data.
- Splash color is the intentional premium black `#09090b`; do not "align" it to `.dark --background` (A4 decision).
- Launch experience is an intentional **always-dark** branded moment; no light-variant startup images.
- Path alias `@/` → `src/`.
- End every commit message with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.

---

### Task 1: Theme-aware boot + kill the FOUC (A2)

Removes the hardcoded-dark markup that fights next-themes, so a light-mode user no longer sees a dark→light flip and `<html>` no longer stays near-black behind a light `<body>`. Independently testable in a plain desktop browser — no assets required. Do this first: biggest visible theme win, lowest risk.

**Files:**
- Modify: `src/app/(frontend)/layout.tsx` (`<html>` element, currently lines 124–130)
- Modify: `src/app/(frontend)/globals.css` (`:root` block and `.dark` block)

**Interfaces:**
- Consumes: existing `Providers` → `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) — unchanged.
- Produces: an `<html>` with no hardcoded theme class and no inline background; theme class + `color-scheme` set by next-themes' pre-paint script, with CSS `color-scheme` as static fallback.

- [ ] **Step 1: Remove the hardcoded dark class and inline background from `<html>`**

In `src/app/(frontend)/layout.tsx`, change the opening `<html>` tag from:

```tsx
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      style={{ backgroundColor: '#09090b' }}
    >
```

to:

```tsx
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
```

(Keep `suppressHydrationWarning` — next-themes needs it since the server renders no theme class.)

- [ ] **Step 2: Add `color-scheme` fallbacks in globals.css**

In `src/app/(frontend)/globals.css`, add `color-scheme: light;` inside the existing `:root { … }` block and `color-scheme: dark;` inside the existing `.dark { … }` block. These are the static UA-canvas fallback so overscroll gutters / the first paint frame match the theme even before next-themes' inline `color-scheme` applies. Do NOT touch the existing `color-scheme: light` on `.theme-marketing` / `.funnel-light`.

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (no errors introduced).

- [ ] **Step 4: Manual browser verification (light-mode FOUC)**

Run `pnpm dev`. In a browser set to **light** system theme (or toggle the app to light), hard-reload `/dashboard`:
- The page must NOT flash dark then switch to light.
- Inspect `<html>`: it must have `class="light"` (or no `dark`) and `style="color-scheme: light"` set by next-themes — NOT a near-black inline `background-color`.
- Overscroll/rubber-band gutters match the light theme (not white/black mismatch).
Then toggle to **dark**: `<html>` gets `class="dark"`, background is dark, consistent throughout.
Expected: no flip in either direction.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(frontend\)/layout.tsx src/app/\(frontend\)/globals.css
git commit -m "$(cat <<'EOF'
fix(pwa): resolve theme before paint to kill launch FOUC

Remove hardcoded className="dark" + inline #09090b background on <html>
that fought next-themes and left <html> near-black behind a light <body>.
Add color-scheme to :root/.dark as static UA-canvas fallback.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Shorten the splash timer (A3)

Cuts the fixed splash hold so the branded moment feels quick. Trivial, isolated, independently testable.

**Files:**
- Modify: `src/shared/components/splash-screen/use-splash-visibility.ts:6`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SPLASH_VISIBLE_MS = 1100` (was `2000`); all other splash behavior (300 ms fade, once-per-session gate, standalone-only) unchanged.

- [ ] **Step 1: Change the constant**

In `src/shared/components/splash-screen/use-splash-visibility.ts`, line 6, change:

```ts
const SPLASH_VISIBLE_MS = 2000
```

to:

```ts
const SPLASH_VISIBLE_MS = 1100
```

(1100 ms lets the splash SVG's blue "R" spring — `delay: 0.9s` — land before dismissal. If a slightly clipped landing is acceptable, 1000 is fine; 1100 is the chosen default.)

- [ ] **Step 2: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Manual verification (standalone PWA)**

On an installed iOS PWA (or Chrome DevTools → toggle `display-mode: standalone` emulation, then clear `sessionStorage['app-splash-shown']`), cold-open the app:
- Splash appears, the house + blue "R" animation completes, and it fades out at ~1.1 s total (down from ~2.3 s).
- The animation's "R" is not visibly cut off mid-spring.
Expected: noticeably shorter, animation still resolves.

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/splash-screen/use-splash-visibility.ts
git commit -m "$(cat <<'EOF'
fix(pwa): shorten splash hold 2000ms -> 1100ms

1100ms still lets the "R" spring (delay 0.9s) land; perceived splash
drops from ~2.3s to ~1.4s.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Dark iOS startup-image matrix (A1)

Replaces the white native iOS launch surface with a dark `#09090b` surface, correct from the very first launch. This is the fix for the multi-second white hang's *appearance* (the hang's duration is Domain B; this makes the surface dark instead of white while it happens).

**Files:**
- Create: `public/pwa/splash/*.png` (generated dark startup images, ~20–40 files)
- Modify: `src/app/(frontend)/layout.tsx` (`metadata.appleWebApp`, currently lines 61–65)

**Interfaces:**
- Consumes: an existing TPR logo source (`public/company/logo/logo-dark.svg`) and `#09090b`.
- Produces: `metadata.appleWebApp.startupImage: Array<{ url: string; media: string }>` wired into Next's metadata (Next renders these as `<link rel="apple-touch-startup-image" media="…" href="…">`).

- [ ] **Step 1: Generate the dark startup-image set**

From the repo root, run (uses npx — do NOT add `pwa-asset-generator` to `package.json`):

```bash
npx pwa-asset-generator public/company/logo/logo-dark.svg public/pwa/splash \
  --background "#09090b" \
  --splash-only \
  --type png \
  --path "/pwa/splash" \
  --log true
```

This writes PNGs into `public/pwa/splash/` and prints `<link rel="apple-touch-startup-image" …>` tags to stdout. **Copy the printed tags** — you need their `media` and `href` values for Step 2. (If the logo source path differs, use the current dark TPR logo asset; the mark should sit centered on the `#09090b` field so the static launch image matches the splash's resting composition.)

- [ ] **Step 2: Wire the tags into Next metadata as `startupImage`**

In `src/app/(frontend)/layout.tsx`, extend the `appleWebApp` block. Transcribe EACH printed `<link>` into one `{ url, media }` entry (url = the `href`, media = the `media` string), e.g.:

```tsx
  appleWebApp: {
    capable: true,
    title: 'TPR',
    statusBarStyle: 'black-translucent',
    startupImage: [
      {
        url: '/pwa/splash/apple-splash-1290-2796.png',
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      // …one entry per generated device/orientation, transcribed verbatim from Step 1 output…
    ],
  },
```

Keep `capable: true` (emits `apple-mobile-web-app-capable`, required for startup images to apply) and `statusBarStyle: 'black-translucent'` unchanged.

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (`startupImage` is a valid `Metadata.appleWebApp` field; TS will catch a malformed array.)

- [ ] **Step 4: Verify the tags render**

Run `pnpm dev`, then:

```bash
curl -s http://localhost:3000/dashboard | grep -o 'apple-touch-startup-image' | head
```

Expected: at least one match — Next is emitting the `<link rel="apple-touch-startup-image">` tags into the document head.

- [ ] **Step 5: Manual device verification (REQUIRED — cannot be emulated)**

On a real iOS device: remove the existing home-screen PWA, re-add `/dashboard` via Safari → "Add to Home Screen" (startup images are read at install time), then cold-launch:
- The native launch surface is **dark `#09090b`**, NOT white.
- Transition from the native launch surface into the dark JS splash animation is visually continuous.
Spot-check on the primary team device(s). Note: devices with no matching media query fall back to white — if a team device flashes white, capture its `screen.width`/`height`/`devicePixelRatio` and confirm the generated matrix covers it.

- [ ] **Step 6: Commit**

```bash
git add public/pwa/splash src/app/\(frontend\)/layout.tsx
git commit -m "$(cat <<'EOF'
feat(pwa): dark iOS startup-image matrix to kill white launch surface

Generate a #09090b apple-touch-startup-image set (pwa-asset-generator,
build-time) and wire it via metadata.appleWebApp.startupImage so the
native iOS launch surface is dark from first launch instead of white.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Fix stale app-shell doc reference (A5)

`docs/codebase-conventions/app-shell.md` points to `src/app/layout.tsx`, which does not exist; the real root layout is `src/app/(frontend)/layout.tsx`. Flagged per the trust-but-verify / ping-on-staleness rule.

**Files:**
- Modify: `docs/codebase-conventions/app-shell.md` (references at lines 11, 27, 47, 141 — verify exact lines when editing)

**Interfaces:**
- Consumes: nothing.
- Produces: corrected doc references.

- [ ] **Step 1: Find every stale reference**

Run:

```bash
grep -n 'src/app/layout.tsx' docs/codebase-conventions/app-shell.md
```

Expected: the occurrences to fix (research cited lines 11, 27, 47, 141 — trust the grep output).

- [ ] **Step 2: Replace each occurrence**

Change every `src/app/layout.tsx` → `src/app/(frontend)/layout.tsx` in that file (use `replace_all` on the exact string).

- [ ] **Step 3: Verify no stale refs remain**

Run:

```bash
grep -n 'src/app/layout.tsx' docs/codebase-conventions/app-shell.md
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add docs/codebase-conventions/app-shell.md
git commit -m "$(cat <<'EOF'
docs(app-shell): fix stale root-layout path refs

Root layout is src/app/(frontend)/layout.tsx, not src/app/layout.tsx.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Notes for the implementer

- **A4 (color consistency) is intentionally a no-op** — `#09090b` splash black stays; the 300 ms fade covers the step to `.dark --background`. No task.
- **Existing installed users** keep the white launch until they re-add the PWA to their home screen. Expected; mention at rollout.
- If any device flashes white on launch after Task 3, that's a startup-image matrix coverage gap — regenerate covering that device's dimensions, not a code bug.
- Domain B (cold start: Neon driver, PPR/static shell, `getSession` dedup, event-driven splash dismissal) is a separate spec/plan — do not pull it in here.

## Self-review

- **Spec coverage:** A1 → Task 3; A2 → Task 1; A3 → Task 2; A4 → no-op (noted); A5 → Task 4. All spec sections covered.
- **Placeholder scan:** the only "…one entry per generated device…" is inherent (filenames/media strings are produced by the generator at run time) and the step specifies exactly how to obtain and transcribe them — not a placeholder for undefined behavior.
- **Type consistency:** `SPLASH_VISIBLE_MS`, `appleWebApp.startupImage: Array<{ url, media }>` used consistently; matches Next's `Metadata` type.
