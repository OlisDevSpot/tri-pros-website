# Anti-Slop Checklist

Run this before any marketing block ships. Adapted from the 16-point slop fingerprint + project-specific additions.

**Source:** [DESIGN.md §3](./DESIGN.md#3-negative-constraints--the-banned-slop-fingerprint) · [Spec §8](../superpowers/specs/2026-06-22-anti-slop-design-system-design.md)

---

## Gate

- [ ] **Typography** — Fonts are Syne (display) and Nunito (text) only. No monospace anywhere. Weight and size extremes are used (not 400-vs-600 mush).
- [ ] **Accent** — Accent color is brand blue `#03AFED` only. No purple, no indigo, no teal. No ubiquitous gradients, no colored glows.
- [ ] **Layout anti-patterns** — No centered icon-in-circle stack. No pill checklist. No colored left-border card (`border-l-4`). No 1-2-3 stat banner row.
- [ ] **Radius + elevation** — Radius values are from the scale (`3px` / `6px` / `999px`), not uniform `8px`. Shadows are warm and intentional (`--shadow-card`), not flat `0.05` opacity.
- [ ] **Layout consistency** — One layout primitive repeated. Card content is left-aligned.
- [ ] **Atmosphere** — Decor (`<Decor>`) is present on hero surfaces. Anchored top-right. Parent has `overflow:hidden; isolation:isolate`.
- [ ] **Motion** — Entrance animation present. `useReducedMotion()` gate implemented (final state shown, no movement, for reduced-motion users).
- [ ] **Trust / data** — All credential data sourced from `src/shared/constants/company/`. No hardcoded numbers. No false claims. Experience phrased as "40+ years **combined**" (never implies founded before 2021).
- [ ] **Contrast** — WCAG AA met for all text. Small text on light backgrounds uses `--accent-ink: #0784b3`, not `#03AFED`. Check dark mode if `.theme-marketing.theme-dark` is used.
- [ ] **Mobile** — Checked at 375px. Credential strip wraps gracefully. Decor does not overflow or crowd content. Touch targets ≥44px.

---

## Scoring

| Triggers | Result |
|---|---|
| 0–1 | Clean — ship it |
| 2–3 | Mild — fix before shipping |
| 4+ | Reject — this component carries the slop fingerprint; redesign before review |
