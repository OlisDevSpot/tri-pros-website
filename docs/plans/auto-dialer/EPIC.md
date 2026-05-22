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
- **Vendor stack** — Twilio (backbone, including all Phase-1 messaging) + Retell (AI voice) + ~~Sendblue (iMessage)~~ (deferred post-launch) + Hiya (Phase-2 branded calling).
- **Vendor abstraction** — every external vendor sits behind an interface in `services/{voip,ai-voice,branded-calling,messaging}/`. Swap = concrete impl swap, no caller changes.
- **Mobile = cellular routing, not browser WebRTC** — PSTN call to human's cell, PWA only handles dashboard/dispositions.
- **AI script content is owner-managed** — the system does NOT enforce specific disclosure language. Per-source AI greeting + warm-intro template editable via UI.

---

## Spam mitigation strategy (LAYERED)

**Carrier "Spam Likely" labeling is the #1 risk to dialer effectiveness.** Discovered 2026-05-21 during Phase 0 testing: a fresh Twilio DID with STIR/SHAKEN A-attestation **APPROVED** still rendered as "Spam Likely" on iPhone. STIR/SHAKEN proves *who* is calling (not spoofed) but says nothing about whether the call is *wanted*. The actual verdict comes from three independent carrier analytics engines layered on top:

| Engine | Carriers Using It |
|---|---|
| **Hiya** | AT&T native + Samsung devices + Hiya app |
| **TNS** | Verizon native |
| **First Orion** | T-Mobile / Sprint native |

Each engine vets registrations independently and scores reputation by behavior (call duration, hangup rate, complaint rate, volume patterns). Brand-new DIDs with zero history default to skeptical treatment.

**Mitigation is a layered stack, deployed progressively:**

| Layer | When | Cost | Effort | Triggers |
|---|---|---|---|---|
| **L1 — Free baseline**: CNAM + FreeCallerRegistry + Nomorobo + behavioral hygiene | Phase 0 | Free | 1hr setup + 2-4 week vetting clock | Mandatory; do TODAY |
| **L2 — DID pool + warming + per-DID health**: 7-10 DIDs in rotation, ≤75 attempts/DID/day, warm-up cadence (week 1: 10-20 → week 3: 75), auto-retire flagged DIDs | Phase 1 (schema) → Phase 2 (orchestrator) | Free (just DID cost ~$1.15/mo each) | Built into `dialer_dids` schema | Mandatory before any production volume |
| **L3 — Cheap insurance**: Twilio Voice Integrity (managed registration + monitoring) + FCC Reassigned Numbers Database scrub | Phase 1-2 | ~$5-15/DID/mo Voice Integrity + ~$1,300/yr RND | 1 hour | Enable Voice Integrity if FCR alone doesn't clear "Spam Likely" within 4 weeks; RND mandatory for TCPA safe harbor |
| **L4 — Branded display**: Hiya Connect (AT&T+T-Mobile+Samsung) + Verizon BCID via Numeracle or First Orion as OSP | Phase 2-3 | $29-500/mo Hiya self-serve → $300-800/mo Verizon BCID OSP | 1-2 weeks setup | Volume >3K conversations/mo |
| **L5 — Continuous monitoring at scale**: Caller ID Reputation (CIDR) + Hiya Reputation API (programmatic spam-status checks baked into dialer) | Phase 3+ | ~$64/mo CIDR + Hiya API quoted | dev integration | DID pool >10 OR sustained answer-rate drop >25% |

**Behavior matters more than registration.** All registration in the world won't save a DID that bursts 200 calls in 30 min with <10s avg duration. The data model bakes this in:
- `dialer_dids` table tracks per-DID daily call count, complaint count, "spam_likely" detection
- `dialer_attempts` captures duration, hangup pattern, vendor flags
- Dispatcher service enforces ≤75 attempts/DID/day cap with rotation
- Auto-retire flow parks DIDs that cross thresholds (drops >25% week-over-week, or 2-of-3 engines flag) for 60-90 days

**Forward-looking signal:** Verizon BCID went live Sept 2025. By Phase 3, full national branded-calling coverage will require *two* vendors (Hiya for AT&T + Numeracle/First Orion as OSP for Verizon BCID) OR Twilio Branded Calling (currently Public Beta; covers T-Mobile + Verizon, NOT AT&T). Twilio's offering may consolidate this by Phase 3 — revisit then.

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

### 2026-05-22 — TCPA attorney consult deferred to end of epic

**Phase:** 0 → end-of-epic
**Context:** Phase 0 spec listed TCPA attorney consult as "recommended" during procurement. User decision (2026-05-22) to defer all real-world professional/legal consultations to the absolute last task of the auto-dialer epic instead.
**Decision:** TCPA attorney consult moves from Phase 0 Task 7 to "end of epic, after Phase 5." All other Phase 0 work proceeds without legal sign-off. Existing opt-in language on web forms + Meta lead ads is treated as adequate consent basis for the pilot.
**Alternative considered:** Standard "upfront legal review before any outbound" approach. Rejected: pilot risk surface is low (only opted-in leads, small volume, owner-managed AI script); consulting once with real operational data is more efficient than hypothetical advice. Treat as deferred risk accepted by ownership.
**Impact:** Phase 0 gate criteria updated. `phase-0-setup.md` Task 7 marked DEFERRED. If a TCPA-related issue surfaces mid-epic (e.g., a complaint), revisit immediately rather than waiting for end-of-epic.
**Link:** (this commit)

### 2026-05-21 — Sendblue (iMessage) deferred from Phase 1 to "post-launch enhancement"

**Phase:** 0 → 1 boundary
**Context:** After completing Retell + Twilio Voice integration (Phase 0 Step 7) and reviewing Sendblue's Phase 0 setup requirements, user decided to defer iMessage entirely and ship Phase 1 with Twilio-only messaging. Rationale: validate the core call+SMS pipeline first; add iMessage premium experience as an upgrade when there's signal it moves conversion.
**Decision:** Sendblue setup deferred indefinitely (~1-2 weeks post Phase 1 launch, user-initiated). Phase 1 ships with Twilio Programmable Messaging as the sole concrete `MessagingProvider` impl. The `services/messaging/` vendor abstraction stays — Sendblue can drop in later as `sendblue.messaging.ts` with routing logic in `messaging-provider-router.ts` that picks Sendblue for iMessage-capable recipients, falls back to Twilio for everyone else.
**Alternative considered:** Build Sendblue now to land the full messaging UX at Phase 1 launch. Rejected: adds 1-2 weeks of additional setup + verification + integration time for what is a UX enhancement, not a core capability. SMS via Twilio is sufficient to validate the pipeline.
**Impact:**
- `docs/plans/auto-dialer/phase-0-setup.md`: Task 3 (Sendblue) marked DEFERRED
- `docs/plans/auto-dialer/phase-1-mvp.md`: Sendblue-specific tasks (provider impl, webhooks, routing) marked DEFERRED; Twilio messaging provider becomes sole impl; "iMessage vs SMS" UI distinction in chat UI deferred to post-launch
- Phase 1 chat UI renders all messages as SMS-style (no blue/green bubble distinction yet — placeholder/future enhancement)
- **10DLC vetting is now even more critical-path** — it gates ALL Phase 1 messaging, not just SMS fallback. Watch the Campaign approval clock closely.
**Link:** (this commit)

### 2026-05-21 — Layered spam mitigation promoted to Phase 0

**Phase:** 0 (procurement)
**Context:** First Phase-0 test call from a fresh Twilio DID (424 area code) with STIR/SHAKEN A-attestation APPROVED rendered as **"Spam Likely"** on iPhone. Research confirmed STIR/SHAKEN is necessary-but-not-sufficient — carriers run independent reputation engines (Hiya/AT&T, TNS/Verizon, First Orion/T-Mobile) on top with their own behavioral models. Brand-new DIDs default to skeptical treatment.
**Decision:** Add a 5-layer spam mitigation strategy to EPIC (see "Spam mitigation strategy" section above) and promote L1 (free baseline: CNAM + FreeCallerRegistry + Nomorobo + reputation baseline) into Phase 0 as new **Task 1.5**. L2 (DID pool warming + per-DID health) stays in Phase 1-2 as already designed. L3-L5 (Voice Integrity, Hiya Connect, Verizon BCID, CIDR monitoring) deferred to Phase 2-3 with explicit triggers.
**Alternative considered:** Skip free baseline, go straight to Hiya Connect ($29/mo entry). Rejected: Hiya doesn't cover Verizon, and free baseline must process for 2-4 weeks regardless — starting it on Day 1 means it's complete by the time we're ready to dial production volume. Spending money in Phase 0 before validating that free baseline alone clears the flag is wasteful.
**Impact:** Phase 0 plan extended with Task 1.5 (~1 hour user effort). Phase 0 gate criteria updated. DID pool plan revised from "5 dial + 1 transfer = 6 numbers" to "3 pilot now, expand to 7-10 before scaling >150 attempts/day". `@migration: → Hiya Connect` trigger condition now formally written as "answer rate <15% sustained AND/OR sustained Spam Likely after 4 weeks of FCR vetting."
**Link:** (this commit)

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
| 8 | **iPhone Live Voicemail handling** — AI must respond when iPhone's call-screening asks "please state your name and reason for calling" | User + Phase 1 implementer | Phase 1 (agent prompt design) | See "Known production challenges" below |

---

## Known production challenges (surfaced during Phase 0 testing)

### iPhone Live Voicemail (iOS 17+) call screening

**Discovered:** 2026-05-21, Phase 0 Step 7 outbound test from 626 DID to user's iPhone.

**What it is:** iPhone's on-device call screening intercepts unknown callers and plays "Please state your name and reason for calling." It transcribes the response and presents it to the user as a screening prompt. If the caller doesn't respond intelligibly within a few seconds, the call routes to voicemail.

**Why it matters:** Layered on TOP of carrier "Spam Likely" labeling. Even if FCR clears our reputation, individual recipients with Live Voicemail enabled will still screen unknown callers. Estimated impact: 20-40% of iPhone recipients have it enabled.

**Phase 1 implementation requirements** (capture in agent prompt design task):

1. **Front-load identification in welcome message.** First sentence MUST include business name + reason, so even if the AI is interrupted by the screening prompt, the answer is in the first words:
   > "Hi, this is the Tri Pros Remodeling assistant calling about your recent remodeling inquiry."

2. **Detect the screening prompt pattern.** Retell agent prompt should include behavior: "If you hear a prompt asking you to state your name and reason for calling, respond clearly with: 'This is the Tri Pros Remodeling assistant calling about [customer name]'s recent remodeling inquiry. May I speak with [customer name]?' Then wait for a human response before continuing your script."

3. **Voicemail detection (AMD).** Twilio + Retell support Answering Machine Detection — when detected, hang up rather than leave a long AI message (better for reputation + cost). Configure via Retell's voicemail detection settings.

4. **Test against Live Voicemail explicitly.** Phase 1 manual verification step: place test call to an iPhone with Live Voicemail enabled and confirm the AI passes screening.

**Spec reference:** Update `docs/superpowers/specs/2026-05-21-ai-dialer-design.md` §6 "AI script invariants" to add Live Voicemail handling as an invariant during Phase 1 implementation review.

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
