# Handoff — Ably Realtime Kernel

**Date paused:** 2026-04-19
**Pause reason:** Not pressing. Pick up when an entity beyond meetings needs realtime sync, OR when the multi-user/customer-facing use cases become priorities.
**Continuing engineer:** Future Claude session (or any human).

---

## Read these first, in order

1. **Spec (the contract):** [docs/superpowers/specs/2026-04-19-ably-realtime-kernel-design.md](docs/superpowers/specs/2026-04-19-ably-realtime-kernel-design.md). This is the approved design. Do not re-debate macro decisions — see §15 of that doc for the decisions log.
2. **CLAUDE.md** at repo root — make sure you understand the dispatch system, conventions, and CASL setup.
3. **Existing realtime code (~70 lines total):**
   - [src/shared/services/upstash/realtime.ts](src/shared/services/upstash/realtime.ts) — server publish (will be moved to `services/ably/server.ts`)
   - [src/shared/services/upstash/realtime-client.ts](src/shared/services/upstash/realtime-client.ts) — client (will be replaced; client-side API key DELETED in new design)
   - [src/shared/components/providers/realtime-provider.tsx](src/shared/components/providers/realtime-provider.tsx) — provider wrapper
   - [src/features/meeting-flow/hooks/use-meeting-sync.ts](src/features/meeting-flow/hooks/use-meeting-sync.ts) — only client subscriber today
   - Publish call sites: [src/trpc/routers/meetings.router.ts:211-212](src/trpc/routers/meetings.router.ts#L211-L212) and [:240-242](src/trpc/routers/meetings.router.ts#L240-L242)
4. **CASL (authorization):**
   - [src/shared/domains/permissions/abilities.ts](src/shared/domains/permissions/abilities.ts) — single source of truth
   - [src/shared/domains/permissions/types.ts](src/shared/domains/permissions/types.ts) — `AppActions` and `AppSubjects` enums
   - [src/shared/domains/permissions/lib/validate-share-token.ts](src/shared/domains/permissions/lib/validate-share-token.ts) — parallel customer auth path
5. **Invalidation hub (the contract the new client hooks bind to):**
   - [src/shared/dal/client/use-invalidation.ts](src/shared/dal/client/use-invalidation.ts)

---

## What is settled

- All 6 realtime use cases (multi-device, multi-user collab, dashboard liveness, customer-facing, presence, notifications).
- Entity-oriented convention with central registry — single source of truth for channel naming, events, payload schemas, access rules, and invalidation wiring.
- JWT token auth with capability map (NO shared client API key). Capabilities computed via CASL (class-level) + DAL (row-level) + share tokens (parallel customer path).
- Hybrid event payloads: `ping` (default — refetch) and `patch` (opt-in — apply to React Query cache). Per-event mode declared in registry.
- `rewind: '2m'` on subscribe + React Query `refetchOnWindowFocus` for missed-event recovery.
- Reactor webhooks scaffolded from day 1 with HMAC verification; presence audit log is the day-1 reference handler.
- In-app dev overlay gated on `NEXT_PUBLIC_REALTIME_DEBUG=1`.

These are not up for debate. If a future requirement forces a change, document the trigger in the decisions log (§15).

---

## What is NOT settled (intentional gaps)

- Notification persistence (DB-backed) — out of v1 scope.
- Multi-resource customer share tokens — defer until use case appears.
- Migration of CASL to object subjects — separate refactor; out of scope here.
- Cross-entity ripple publishing — defer until lag is measured.
- WebSocket fallback edge cases — Ably handles automatically; revisit if customers complain.

---

## How to resume

1. Re-read the spec end to end.
2. Verify nothing in the "starting point" (spec §0) has drifted — CASL, `useInvalidation`, the `meetings.router.ts` publish call sites.
3. Run the **`superpowers:writing-plans`** skill against the spec to produce a phased implementation plan. Do NOT skip this — the plan adds checkpoints, file lists, and test stubs that this design doc intentionally does not.
4. Phase 0 first (rename, env, token endpoint, registry skeleton). Stop. Verify `pnpm tsc` + `pnpm lint` clean. Then proceed phase by phase.
5. Each phase must end with the manual two-tab smoke test described in spec §11.

---

## GitHub issues

Tracking issues for each migration phase live on the project board. See spec §11 for the phased breakdown. Each issue:

- Has `claude` label (agent-eligible)
- Linked to this spec via the issue body
- Lives on the GitHub Projects board in `Backlog`
- Will move to `Ready` when prioritized

If issues haven't been created yet at pickup time, create them from the phases in spec §11 before starting work.

---

## Tone for the next session

- This is high-leverage infrastructure. Get it right.
- The user explicitly asked for: "singular entrypoint per required realtime connection, extremely easy to configure, use, and implement." Every API decision should serve that goal.
- "As little ad-hoc logic as possible, as much helper functions, shared factory functions, centralized config objects." The registry IS the centralized config. The publish/subscribe helpers ARE the shared factories. If you find yourself writing channel-name strings or per-feature publish logic, you've drifted — return to the registry pattern.
- Document EVERY non-obvious decision inline. Especially in `capabilities.ts` and `/api/ably/token/route.ts` — those will be re-read by humans during security reviews.
