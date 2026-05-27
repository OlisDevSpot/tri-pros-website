# Phase 4 — Admin / Observability Surface

> **Parent EPIC:** [EPIC.md](./EPIC.md)
> **Prerequisite:** Phase 1 complete (soft dependency on Phase 2 + Phase 3 for fuller UI scope — can land in parallel with Phase 3).
> **Status:** Not started.

## What Phase 4 ships

Earlier phases pile up data and config in the database without a way for super-admins or admins to see or manage it from the UI. Phase 4 closes that gap with a `/dashboard/voip-in-house/admin` surface (gated to super-admin + admin per CASL) that ships five panels:

1. **Call history** — paginated, filterable (source, agent, date range, disposition); recording playback with CASL-gated access; per-call detail showing customer link, transcript summary (when source='cloudtalk'), disposition note.
2. **Message inbox** — threaded SMS conversations per customer; per-customer "compose" reusing Phase 1's `SendMessageButton`; visibility of inbound STOPs and their resulting DNC entries.
3. **DID pool health** — per-DID stats (attempts today/total, last flagged, current status), assignment (sticky-DID-per-agent picker), reputation snapshot (when Phase 6 Hiya integration ships, surfaces real reputation; until then schema-only).
4. **Agent availability dashboard** — who's enrolled, who's available, who's on a call, last-transferred-at; admin can override any agent's status.
5. **Settings + kill switch** — the live `app_settings(feature='voip-in-house')` configJson editor: kill-switch toggle (with confirm modal), calling-hours editor, recording retention slider, IVR config (when Phase 3 ships). Validated against the Zod schema before write.

Also: an **IP allowlist for voip routing endpoints** when CloudTalk publishes their static IPs (the open question from INTEGRATION-SEAM.md §12 — resolved during voip-campaigns Phase 0). Until then, query-string secret remains the only auth.

## Task categories (sketch)

1. **Admin route + layout**
   - `src/app/(frontend)/dashboard/voip-in-house/admin/page.tsx` — gated to `super-admin | admin` via CASL.
   - Tab-based shell (shadcn Tabs) for the 5 panels.
2. **Call history panel** — uses `usePaginatedQuery` (per [pattern-pagination-toolkit](../../../memory/pattern-pagination-toolkit.md)) over a new business sub-router `voipCalls.business.listAdmin` accepting filters; per-row drawer with full call detail; recording playback via signed-URL (CASL `view_recording` gate).
3. **Message inbox panel** — by-customer threading (group by customer, then chronological); reuses `SendMessageButton` for inline reply.
4. **DID pool panel** — table + per-DID actions (assign agent, flag, retire). Per-row status badges. Schema-side already supports everything; UI brings it to life.
5. **Agent availability panel** — table + inline edit for admin override; live updates (until [project-ably-realtime-kernel](../../../memory/project-ably-realtime-kernel.md) ships, polls every 30s).
6. **Settings panel** — kill-switch toggle (with confirm), calling-hours editor, recording retention slider; commits via `appSettings.update` mutation (super-admin only per CASL).
7. **T5 IP allowlist** (deferred sub-task — depends on CloudTalk publishing static IPs)
   - Add Vercel edge middleware that allows `/api/voip/routing/*` only from the configured allowlist (env var `T5_IP_ALLOWLIST` = comma-separated CIDRs). Falls open if env unset (defaults to "deny none beyond the shared-secret check from Phase 1") to avoid breakage when allowlist is empty.

## Manual verification gate

Super-admin can toggle the kill switch from the UI and immediate-next click-to-call is blocked. Admin can view a call recording but agent cannot. DID assignment changes who a customer's sticky-DID routes to (combined with Phase 3 sticky-DID-callback). The message inbox shows a 2026-03-01 STOP reply followed by an admin-recorded DNC + the auto-confirm outbound — all in the right thread.
