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
