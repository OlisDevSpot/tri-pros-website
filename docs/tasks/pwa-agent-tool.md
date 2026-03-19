# Task: PWA Agent Tool

**Status:** 🟢 SPEC ONLY — no plan yet; partially implemented
**Branch:** `main`
**Spec:** `docs/superpowers/specs/2026-03-19-pwa-agent-tool-design.md`
**Plan:** _Not yet written_
**Date Designed:** 2026-03-19

---

## One-liner

Convert the app to a PWA (Add to Home Screen on iPhone) with branded splash screen animation — no service worker, agent-only, standalone shell experience.

---

## Current State

Some work has been merged (commits reference a splash screen fix), but the full spec has not been executed yet. The spec is finalized — needs a plan then implementation.

---

## How to Resume

Start a new Claude Code session and say:
> "I want to implement the PWA agent tool feature. The spec is at `docs/superpowers/specs/2026-03-19-pwa-agent-tool-design.md`. First invoke the `writing-plans` skill to create the implementation plan, then we'll execute it."

---

## Key Changes Per Spec

| Action | File |
|--------|------|
| Create | `src/app/manifest.ts` |
| Create | `src/shared/components/pwa-splash-screen.tsx` |
| Create | `scripts/generate-pwa-icons.ts` |
| Create | `public/pwa/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` |
| Modify | `src/app/(frontend)/layout.tsx` — Apple meta tags + splash component |

**What's NOT included:** No service worker, no push notifications, no `next-pwa` library, no maskable icons.

---

## Splash Screen Notes

- Detect standalone mode via `window.matchMedia('(display-mode: standalone)')`
- Show once per launch (`sessionStorage` key `pwa-splash-shown`)
- Animate SVG logo paths using `motion/react` (already installed)
- Multiple variants will be presented for user to choose from

---

## Dependencies

- **Blocks:** Nothing
- **Blocked by:** Nothing
