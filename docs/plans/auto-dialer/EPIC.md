# Auto-Dialer Epic — Living Context

> **What this is:** The front door for the auto-dialer initiative. Tracks vision, phase status, inter-phase decisions made *during* implementation (vs. up-front design choices, which live in the spec), open questions still to resolve, and links to all related artifacts. Updated as phases ship.
>
> **Distinction from related docs:**
> - **Spec** (`docs/superpowers/specs/2026-05-21-ai-dialer-design.md`) — immutable design snapshot from brainstorming. Source of truth for "why we made these decisions on 2026-05-21." Updated only with explicit rationale + Git history.
> - **ADRs** (`docs/adr/`) — single-decision records, one per architectural call. The auto-dialer references existing ADR-0002 (entity server system) and ADR-0003 (service/provider architecture).
> - **Phase plans** (`./phase-N-*.md`) — actionable, task-by-task implementation plans for each phase.
> - **This EPIC** — living glue. The thing you read first to understand "where are we, why."

---

## Vision

Tri Pros Remodeling needs to handle thousands of weekly lead-dial attempts with a single human (eventually a small team + VAs). Manual dialing caps the human at ~100 conversations/day; an AI-first dialer that warm-transfers only live, willing leads to the human gets that number to 300-500/day at the same labor cost. The system is built natively into our Next.js + tRPC + Postgres app — no off-the-shelf dialer suite — because the orchestration logic (cadence, compliance, DID rotation, integration with customer entities) is where the long-term competitive value lives.

## Strategic decisions (immutable; see spec for rationale)

- **Custom orchestrator over CloudTalk** — our app owns cadence, compliance, DID pool, transfer routing. CloudTalk revisit-trigger: hiring 3rd VA AND queue/coaching becomes blocking.
- **Vendor stack** — Twilio (backbone) + Retell (AI voice) + Sendblue (iMessage) + Hiya (Phase-2 branded calling).
- **Vendor abstraction** — every external vendor sits behind an interface in `services/{voip,ai-voice,branded-calling,messaging}/`. Swap = concrete impl swap, no caller changes.
- **Mobile = cellular routing, not browser WebRTC** — PSTN call to human's cell, PWA only handles dashboard/dispositions.
- **AI script content is owner-managed** — the system does NOT enforce specific disclosure language. Per-source AI greeting + warm-intro template editable via UI.

---

## Phase status

| Phase | Status | Plan | Spec section | Estimated effort |
|---|---|---|---|---|
| 0 — External setup (Trust Hub, 10DLC, accounts, DIDs) | Not started | [phase-0-setup.md](./phase-0-setup.md) | §9 Phase 0 | 1-2 weeks (mostly waiting) |
| 1 — MVP end-to-end transfer + messaging foundation | Not started | [phase-1-mvp.md](./phase-1-mvp.md) | §9 Phase 1 | 2 weeks |
| 2 — Cadence + compliance + lifecycle branches + auto messaging | Not started | _Pending — written after Phase 1 lands_ | §9 Phase 2 | 1 week |
| 3 — DID pool + spam mitigation | Not started | _Pending — written after Phase 2 lands_ | §9 Phase 3 | 1 week |
| 4 — Super-admin config + dashboards + chat UI + mobile mode | Not started | _Pending — written after Phase 3 lands_ | §9 Phase 4 | 1-1.5 weeks |
| 5 — Customer-side integration + observability | Not started | _Pending — written after Phase 4 lands_ | §9 Phase 5 | 1-2 weeks |
| 6+ — Triggered optimizations (Hiya, Telnyx, Retell Enterprise, CloudTalk, Inngest, Ably) | Future | _Triggered ad-hoc per observed conditions_ | §9 Phase 6+ | n/a |

---

## Inter-phase dependencies

```
Phase 0 (procurement) ──► Phase 1 (MVP)
                                  │
                                  ├──► Phase 2 (cadence + compliance)
                                  │             │
                                  │             ├──► Phase 3 (DID pool) ─┐
                                  │             │                        │
                                  │             └──► Phase 4 ─────────┐  │
                                  │                  (admin + chat +  │  │
                                  │                   mobile mode)    │  │
                                  │                                   │  │
                                  └────────────────────────────────► Phase 5
                                                                     (customer-side
                                                                      integration +
                                                                      polish)
```

- **Phase 0 → Phase 1**: hard gate. Need Trust Hub approved, 10DLC approved, Retell test call works, 6 DIDs purchased before Phase 1 code is useful.
- **Phase 1 → Phase 2**: hard gate. MVP must work end-to-end with a single button before automating the lead-selection loop.
- **Phase 2 → Phase 3**: soft. Phase 3 (DID pool sophistication) could in theory start in parallel after Phase 2's compliance gates are in place — but practically, want one phase to be stable before adding sophistication.
- **Phase 3 → Phase 4**: soft. Phase 4 (admin UI) reflects what Phase 3 added; minor coupling but mostly independent.
- **Phase 4 → Phase 5**: soft. Phase 5 (customer integration) imports components built in Phase 4 (`shared/components/dialer/*`).

**Parallelization opportunity:** Phase 3 + Phase 4 can largely run in parallel (different parts of the stack) once Phase 2 lands.

---

## Cross-cutting code touchpoints (the "watch these places" list)

| Area | Why it matters | Where changes accumulate |
|---|---|---|
| `entities/customers/` | Customer is the FK target for everything; add `lib/calling-hours.ts`, `lib/phone.ts`; profile/timeline UI gains dialer integration in Phase 5 | Phase 2 adds entity lib; Phase 5 adds UI consumers |
| `entities/lead-sources/` | `dialerConfigJSON` added in Phase 1 migration; per-source override UI in Phase 4 | Phase 1 (schema), Phase 4 (UI) |
| `db/schema/meta.ts` | 9 new pgEnums added in Phase 1 single migration | Phase 1 |
| `domains/permissions/abilities.ts` | New entity name constants registered for CASL | Phase 1, and incrementally each new entity |
| `src/app/(frontend)/(dashboard)/layout.tsx` | Softphone widget mounted globally — Phase 4 | Phase 4 |
| `src/services/` | New directories: voip/, ai-voice/, branded-calling/, messaging/, dialer/{queue,cadence,dispatcher,transfer-router,disposition,did-pool,compliance,messaging} | All phases |
| `src/app/api/` | New external webhook endpoints under `dialer/ai/*`, `voip/twilio/*`, `messaging/twilio/*`, `messaging/sendblue/*` | Phase 1 (foundation), Phase 2 (lifecycle), Phase 3 (DID health) |
| `src/trpc/routers/` | 7 new routers: `dialer-attempts`, `dialer-dids`, `dialer-lead-states`, `dialer-dnc`, `dialer-user-availability`, `dialer-settings`, `dialer-messages` | Phase 1 (minimal) → Phase 4 (full) |
| Push notification pipeline | Reuses existing infra; new push types: disposition-needed, opt-out, did-flagged, inbound-message, kill-switch-toggled | Phase 1 (disposition-needed); Phase 2-4 (others) |

---

## Migration roadmap (`@migration` annotations to watch)

Every `@migration` comment in the dialer code points to a future swap. Searchable via `grep -r "@migration:" src/services/dialer src/services/{voip,ai-voice,branded-calling,messaging} src/entities/dialer-* src/app/api/{dialer,voip,messaging}`.

| Annotation | Now | Target | Trigger |
|---|---|---|---|
| `@migration: → Inngest` | QStash for queued dispatch + delayed messages | Inngest durable workflows | Inngest provider integration complete |
| `@migration: → Ably kernel` | TanStack Query polling for dialing indicator, chat updates, availability | Ably realtime kernel subscriptions | Ably kernel ships (per `project-ably-realtime-kernel.md` memory) |
| `@migration: → Hiya Connect` | `null.branded-calling.ts` no-op | `hiya.branded-calling.ts` concrete impl | Answer rate <15% sustained OR hangup-3s% >25% |
| `@migration: → Telnyx` | `twilio.voip-provider.ts` | `telnyx.voip-provider.ts` | Monthly Twilio voice spend >$300 |
| `@migration: → Retell Enterprise` | Retell PAYG | Retell Enterprise ($3K/mo @ $0.05/min) | Monthly Retell spend >$2K |
| `@migration: → Reassigned Numbers DB` | Skipped in pilot | Add to compliance gate #3 | Lead vintage >12 months |

---

## Decisions log (post-spec, made during implementation)

> Each entry: date, decision, context, link to PR/commit. Append-only. This is where "we decided X mid-Phase-2 because we found Y" gets recorded.

_(Empty — start populating once Phase 0 procurement begins.)_

### Template entry

```
### YYYY-MM-DD — <Short title>

**Phase:** <which phase>
**Context:** <what surfaced this decision>
**Decision:** <what we chose to do>
**Alternative considered:** <what we rejected and why>
**Impact:** <which files / phases affected>
**Link:** <PR/commit SHA>
```

---

## Open questions (cross-phase)

| # | Question | Owner | Decide by | Default |
|---|---|---|---|---|
| 1 | Exact AI script content + per-source variations | User | Phase 0 (alongside attorney consult) | Owner-managed; no system default text |
| 2 | Recording disclosure language | User | Phase 0 | Owner-managed within AI greeting |
| 3 | Specific pilot DID area codes (final 5) | User + research | Phase 0 (after lead geography analysis) | 310, 213, 818, 949, 626 + 1 reserved transfer-target |
| 4 | TCPA attorney consult — go/no-go? | User | Phase 0 | Recommended, not required |
| 5 | Auto-enrollment per lead source | User | Phase 4 | Manual-only in pilot |
| 6 | Multi-seller routing rules when 2nd human onboards | User + product | When 2nd seat added | Round-robin, least-recently-transferred ties broken |
| 7 | Sunday calling | User | Phase 4 (super-admin config) | Excluded by default |

---

## Glossary (quick reference; full glossary in spec §14)

- **DID** — phone number we own and call from
- **STIR/SHAKEN A-attestation** — carrier-level identity verification, highest trust
- **CNAM** — caller ID display name
- **10DLC** — required B2C SMS registration program
- **Warm transfer** — AI announces context before bridging (vs cold dump)
- **Local presence** — caller ID matched to lead's area code
- **Cadence decay** — diminishing dial frequency over time
- **PSTN** — regular phone network (vs WebRTC)
- **CASL** — `@casl/ability` (this codebase's auth lib)

---

## Cross-references

- **Spec:** [`docs/superpowers/specs/2026-05-21-ai-dialer-design.md`](../../superpowers/specs/2026-05-21-ai-dialer-design.md)
- **Phase 0 plan:** [phase-0-setup.md](./phase-0-setup.md)
- **Phase 1 plan:** [phase-1-mvp.md](./phase-1-mvp.md)
- **Phase 2+ plans:** Pending — written after each prior phase ships
- **Related ADRs:**
  - [ADR-0002 — Entity server system](../../adr/0002-entity-server-system.md) — entity-name colocation pattern + tRPC factories used by all dialer entities
  - [ADR-0003 — Service / provider architecture](../../adr/0003-service-provider-architecture.md) — service layer pattern used by `services/voip/`, `services/ai-voice/`, etc.
- **Related memory:**
  - `memory/project-ably-realtime-kernel.md` — future realtime kernel that replaces polling
  - `memory/pattern-push-notifications.md` — existing push pipeline reused by dialer
  - `memory/feedback-defaults-with-override.md` — pattern used by `dialer-settings` + per-source overrides
  - `memory/feedback-entity-organization.md` — flat entity layout enforced for `dialer-*` entities
