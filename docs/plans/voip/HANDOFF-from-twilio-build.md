# Handoff — pivot from custom Twilio+Retell build to dual VoIP architecture

> ## Status: Historical context — superseded by the dual-EPIC architecture (2026-05-23)
>
> The 2026-05-23 grilling session that followed this handoff resolved the pivot into a **two-system architecture**:
> - [voip-in-house EPIC](../voip-in-house/EPIC.md) (formerly `docs/plans/auto-dialer/`) — Twilio for agent-mediated comms, inbound IVR, lifecycle SMS, tokenized links, internal-comm push pipeline
> - [voip-campaigns EPIC](../voip-campaigns/EPIC.md) — CloudTalk for lead-to-meeting conversion (the high-volume AI dialing piece only)
>
> **Cross-system contract:** [INTEGRATION-SEAM.md](./INTEGRATION-SEAM.md)
>
> **This handoff doc is preserved as historical context for *why* the split happened.** The architectural choices it sketches (CloudTalk-as-wholesale-replacement, single VoIP EPIC) are no longer the live plan — but the business decisions it preserves (manual mode deferred, AI script content owner-managed, A2-A7 grilling questions, idempotency keys, `voip_*` naming convention) carry forward to both EPICs.
>
> ---
>
> **Original status banner (frozen 2026-05-23):**
> Handoff complete (2026-05-23). Awaited a new `/grill-with-docs` session to architect the CloudTalk EPIC.
> **Previous EPIC at time of handoff:** `docs/plans/auto-dialer/EPIC.md` (since renamed to [`docs/plans/voip-in-house/EPIC.md`](../voip-in-house/EPIC.md) per the 2026-05-23 grilling session output).
> **Design spec (frozen historical):** [`docs/superpowers/specs/2026-05-21-ai-dialer-design.md`](../../superpowers/specs/2026-05-21-ai-dialer-design.md)

---

## Why this handoff exists

Mid-grilling-session on Phase 1A implementation of the custom Twilio+Retell+Sendblue auto-dialer, the user decided to pivot the entire VoIP layer to **CloudTalk**. CloudTalk replaces:

| Old (custom build) | New (CloudTalk) |
|---|---|
| Twilio (telephony backbone) | CloudTalk |
| Retell (AI voice agent) | CloudTalk's built-in AI voice agents |
| Custom orchestrator (`services/dialer/`) | CloudTalk dashboard workflows + API/webhooks where we need to extend |
| 7 dialer-specific Postgres tables | TBD — CloudTalk owns some state; we own integration state |
| Custom DID pool management | CloudTalk DID pool features |
| Custom warming / spam mitigation stack | CloudTalk's built-ins where applicable |

**Why:** CloudTalk already provides much of what we were planning to custom-build (AI voice agents, auto-dialing, batch dialing, routing logic, workflow logic via UI, HTTP surface for two-way sync, webhooks). The user wants to lean on CloudTalk for infrastructure and focus our custom code on the integration + business-logic glue that's specific to Tri Pros' sales workflow.

**The core idea:** CloudTalk takes the role of Twilio + Retell. Our app integrates via CloudTalk's API + webhooks, configures behavior via the CloudTalk dashboard, and adds business logic (lead-state machine, customer pipeline integration, push notifications, etc.) on top.

---

## What carries over (preserved decisions, reusable for CloudTalk EPIC)

### Strategic / business decisions (from previous sessions + EPIC)

| Decision | Source |
|---|---|
| Auto-dialer's narrow function: convert `customerId` rows in the `leads` pipeline → `fresh` pipeline by booking meetings | This session's brainstorming |
| AI-first now; manual mode (VAs / employees) later — same dialer logic, different "who talks to lead" | This session |
| Recording disclosure + AI script content is **owner-managed**, not system-enforced | Spec + memory `project-auto-dialer.md` |
| TCPA attorney consult deferred to end-of-epic (post-Phase-5) | EPIC decisions log |
| Sendblue (iMessage) deferred to post-launch enhancement; Phase 1 is SMS-only | EPIC decisions log |
| The dialer is a **sub-feature of a broader VoIP / phone system** (yard-sign callbacks, inbound DIDs, general intra-business calls) | This session |
| Multiple call types coexist: AI-mediated outbound (Phase 1), manual outbound (future), inbound from arbitrary sources (future), rep-initiated direct calls (future) | This session |

### Architectural decisions locked in this session

| Topic | Decision | Reusable under CloudTalk? |
|---|---|---|
| **Layer naming** | `voip` is the umbrella name (table prefix, service dir, CASL subject, domain anchor) | ✅ Yes — naming is provider-agnostic |
| **Two-layer architecture** | Horizontal `voip` infrastructure layer + vertical features (auto-dialer being the first) | ✅ Yes — CloudTalk provides the infrastructure layer; we still build features on top |
| **Dialer is a feature, not a service** | `src/features/auto-dialer/` is the UX surface; underlying call/SMS plumbing is shared `voip` | ✅ Yes |
| **AppFeature registry pattern** | Each feature exports a `FEATURE` constant from `lib/constants.ts`; aggregated in `src/features/registry.ts`; subset used by `APP_SETTINGS_SCHEMAS` for type-safe per-feature config | ✅ Yes — applies regardless of VoIP provider |
| **`app_settings` table** (replaces feature-specific singleton tables) | Single table keyed by `feature` (PK); per-feature Zod schemas registered in `APP_SETTINGS_SCHEMAS`; DAL helpers generic over `FeatureWithSettings`; single `parse() as AppSettingsConfig<F>` cast at the seam | ✅ Yes — applies regardless of VoIP provider |
| **Typed config DAL contract** | `getAppSettings<F>(ctx, feature: F): AppSettingsConfig<F> \| null` + `upsertAppSettings<F>(ctx, feature, config, actorUserId)` | ✅ Yes |
| **Idempotency keys** | `idempotencyKey: text NOT NULL UNIQUE` on `dialer_attempts` + `dialer_messages`; client-generated; server-internal callers use natural identifiers (`twilio:${callSid}`, `cron:dialer:${triggerTime}`, etc.) | ✅ Yes — same pattern, key prefixes adapt to CloudTalk (`cloudtalk:${callId}:${eventType}`) |
| **`'available_manual'` enum value** on `dialer_user_availability.manualStatus` (preemptive for future manual mode) | Add preemptively even though Phase 1 doesn't use it | ✅ Yes |

### Schema decisions from grilling (Q1-Q8) — preserved as reusable defaults

| Q# | Decision | Rationale | Notes for CloudTalk EPIC |
|---|---|---|---|
| **Q1** | `dialer_lead_states`: drop UNIQUE on `customerId`, add `endedAt`, partial unique `WHERE ended_at IS NULL` — multi-row engagement-window model | Preserves rehash history; supports multiple campaigns per customer | Same model under CloudTalk |
| **Q2** | DIDs use a `role` pgEnum (not `isTransferTargetDid: boolean`). Phase 1 enum: `['transfer_target', 'dial']`. Expandable to `'inbound_only'`, etc. when phone-system extension lands | Future-proofs DID role semantics | Depends on whether CloudTalk lets us model DID roles, OR if we shadow CloudTalk DIDs in our DB |
| **Q3** | `dialer_attempts.did_id uuid REFERENCES dialer_dids(id) ON DELETE RESTRICT` (was `did_used: text`) | Referential integrity; clean GROUP BY for stats; we never delete DIDs (`status='retired'`) | Same model if we shadow CloudTalk DIDs; CloudTalk-only if they own DID state |
| **Q4** | App-wide settings: `app_settings` table keyed by `feature`, NOT feature-specific singletons; NOT JSONB on SYSTEM_USER. Generic over `FeatureWithSettings`; per-scope Zod via registry | Avoids table proliferation; avoids EAV-on-user anti-pattern; type-safe via subset generic | ✅ Same pattern under CloudTalk |
| **Q5** | Idempotency keys: `NOT NULL UNIQUE`. Client-generated for UI; server-internal callers use natural identifiers. INSERT … ON CONFLICT DO NOTHING + lookup fallback | Race-safe by UNIQUE constraint; covers UI and server-initiated paths | ✅ Same pattern; CloudTalk webhook IDs become the natural-identifier convention |
| **Q6** | `dialer_messages.dialerAttemptId`: nullable FK, `ON DELETE RESTRICT`. Standalone messages OK; conversation threading by `customer_id`, not `conversation_id` (deferred) | Reflects reality (standalone SMS, STOP replies, callback reminders) | Same pattern under CloudTalk |
| **Q7** | `dialer_dnc` (→ `voip_dnc` per rename below): E.164 only; cross-channel later | Simple to start; covers Phase 1 needs (STOP keyword, manual admin add) | Same |
| **Q8** | Dropped Sendblue forward-compat columns. `dialer_messages` ships without `sendblue_message_id`; `dialerMessageChannels` reduced to `['sms']`. When Sendblue (or whoever) is integrated, that implementer adds the column + enum value | Cleaner schema; less speculative bloat | Same — applies to CloudTalk too |

### Table renames locked in for the VoIP layer

| Old name (custom-build plan) | New name | Why |
|---|---|---|
| `dialer_dids` | `voip_dids` | Holds ALL DIDs we own (dialer pool, inbound-only, transfer-target, future intra-business numbers) |
| `dialer_dnc` | `voip_dnc` | Opt-outs apply system-wide, not just dialer |
| `dialer_user_availability` | `voip_user_availability` | Humans take inbound calls too, not just dialer transfers |
| `dialer_attempts` | **keep dialer-prefix** (AI-mediated + outbound-specific) | Has dialer-specific columns; future `inbound_calls` is a separate table |
| `dialer_messages` | **keep dialer-prefix** for now | All current message flows are dialer-related; revisit when general messaging lands |
| `dialer_lead_states` | **keep dialer-prefix** | Cadence is strictly dialer concern |
| `dialer_settings` | **dropped entirely** | Replaced by `app_settings` table keyed by `feature='auto_dialer'` |

CloudTalk may own some of this state (e.g., DIDs registered in CloudTalk dashboard). The question for the new EPIC: which entities do we **shadow** locally (for joining + business-logic) vs. **only-in-CloudTalk** (query their API when needed)?

### Phase 0 procurement state (most of this is moot under CloudTalk — but informs CloudTalk Phase 0 design)

| Item | Status | CloudTalk equivalent? |
|---|---|---|
| Twilio account + 3 DIDs (213/424/626) | ✅ Live, paid for | DIDs can be ported into CloudTalk OR kept in Twilio if CloudTalk supports BYO numbers via SIP. Worth investigating |
| CNAM (`TRI PROS REMODEL`) | ✅ Set on all 3 DIDs | Probably re-configured in CloudTalk if numbers migrate |
| Twilio Trust Hub + SHAKEN/STIR A-attestation | ✅ APPROVED account-wide | CloudTalk handles attestation differently; investigate |
| Twilio Elastic SIP Trunk + Retell SIP origination | ✅ Configured | Obsolete — CloudTalk replaces Retell |
| Retell account + agent | ✅ Test agent working | Obsolete — CloudTalk has built-in AI agents |
| 10DLC Brand + Campaign | ⏳ Brand APPROVED, Campaign vetting | CloudTalk has its own SMS sender registration; investigate whether Twilio 10DLC migrates or we re-register |
| FCC DNC SAN | ⏳ Submitted (1-2 business days) | Still relevant for DNC scrub regardless of provider |
| FreeCallerRegistry (Hiya/TNS/First Orion) | ⏳ Submitted | Still relevant for reputation; not provider-tied |
| Inngest account | ✅ Active, keys saved | Still useful for our orchestration; not provider-tied |
| `voip.triprosremodeling.com` subdomain | ✅ Verified | Still useful as webhook base URL |

### App-wide patterns introduced this session (reusable beyond dialer)

These are infrastructure-level patterns. They're NOT tied to VoIP provider — they apply to any feature with app-wide config.

1. **AppFeature registry** — `src/features/registry.ts` aggregates per-feature `FEATURE` constants exported from `src/features/<feature>/lib/constants.ts`. Compile-time forcing function: features must declare themselves to participate.
2. **`app_settings` table + DAL** — Generic over `FeatureWithSettings` (subset of `AppFeature` that has registered a Zod schema). DAL helpers `getAppSettings` + `upsertAppSettings` are type-safe via generics. No `any`, no string lookups, no untyped JSONB consumption. Single cast at the seam (after `parse()` validates).
3. **Idempotency-key convention** — `NOT NULL UNIQUE` on mutation-target tables; client generates UUIDs; server-internal callers use natural identifiers (`provider:resourceId:eventType`, `cron:job:triggerTime`, `inngest:taskId`).
4. **`voip` naming convention** — `voip_*` for phone-system-wide tables; feature-specific tables keep their feature prefix (`dialer_*`).

---

## What does NOT carry over (Twilio+Retell-specific work, now abandoned)

### Branch + commits
- **Branch `archive/twilio-build-aborted`** (was `feat/229-dialer-phase-1a-schema`) — kept as archive. 5 commits, NOT merged, NOT for use. Contains:
  - `301b433b` feat(dialer): Twilio + Retell SDKs + env scaffolding
  - `31730b4b` chore(dialer): Twilio Voice SDK React wrapper spike (custom-wrapper decision)
  - `4c0ccca9` feat(dialer): 10 dialer enum const arrays + matching pgEnums
  - `c784b7f9` feat(dialer): 7 dialer_* table schemas + dialer-settings config Zod
  - `ef83e6b6` wip(dialer): task 12 abandoned mid-flight — pivot to CloudTalk

### Concrete code abandoned (per archive branch)
- `src/shared/constants/enums/dialer.ts` (10 enum const arrays)
- `src/shared/db/schema/dialer-*.ts` (7 table files)
- `src/shared/db/schema/meta.ts` dialer pgEnum additions
- `src/shared/entities/dialer-settings/schemas/config-schema.ts`
- `scripts/lib/check-prod-env.ts` (Twilio-specific `DIALER_DEV_OVERRIDE_NUMBER` gate)
- `docs/plans/auto-dialer/env-vars-reference.md` (Twilio + Retell + Sendblue env vars)
- `docs/plans/auto-dialer/spike-twilio-voice-react-wrapper.md`
- npm packages: `twilio`, `@twilio/voice-sdk`, `retell-sdk` (uninstalled)

### Vendor-specific things that don't transfer
- Twilio SIP Trunking setup (`tripros.pstn.twilio.com` Elastic Trunk, Retell SIP origination)
- Retell agent configuration (templates, prompts, voice settings)
- Retell webhook signature verification approach
- Twilio Voice SDK browser softphone integration (`@twilio/voice-sdk` React wrapper plan)
- Twilio Voice JWT access-token issuance route
- Twilio-specific webhook signing (`X-Twilio-Signature` HMAC verification)
- Twilio Messaging API integration (Programmable Messaging, 10DLC routing)
- All `services/voip/twilio.voip-provider.ts`, `services/ai-voice/retell.ai-voice-agent.ts` etc. — these were planned but never built

### Env vars no longer needed (CloudTalk likely has different setup)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_*`, `TWILIO_TWIML_APP_SID`
- `TWILIO_TRUST_PROFILE_SID`, `TWILIO_10DLC_CAMPAIGN_SID`
- `TWILIO_TRANSFER_TARGET_DID_E164/SID`, `TWILIO_DID_424_E164/SID`, `TWILIO_DID_626_E164/SID`
- `TWILIO_SIP_TRUNK_DOMAIN`, `TWILIO_SIP_TRUNK_USERNAME`, `TWILIO_SIP_TRUNK_PASSWORD`
- `RETELL_API_KEY`, `RETELL_TEST_AGENT_ID`, `RETELL_WEBHOOK_SIGNING_SECRET`

(They're still in the user's `.env` from Phase 0 procurement. **Don't delete yet** — Twilio numbers may be ported to CloudTalk, and Retell can be quickly resumed if CloudTalk doesn't work out. Treat as "warm spare" until CloudTalk EPIC validates the alternative path.)

---

## What's unresolved / open (carry into new session)

### Open architecture questions from this session

These were the next-up grilling questions when we pivoted. Most translate directly to CloudTalk; some need re-asking in CloudTalk-shaped form.

| # | Question | Translates to CloudTalk EPIC? |
|---|---|---|
| **A2** | One polymorphic `voip_calls` table vs separate `dialer_attempts` + `inbound_calls` + `manual_calls`. My recommendation in this session: option **γ** (base + side tables) | ✅ Still relevant — applies to whatever calls we shadow locally |
| **A3** | Is "auto-dialer" one feature with two modes (AI/manual), or two features sharing services? | ✅ Still relevant |
| **A4** | Are inbound calls part of auto-dialer or strictly phone-system? | ✅ Still relevant |
| **A5** | Customer timeline model — unified or per-feature streams? | ✅ Still relevant |
| **A6** | CASL ability split — `Voip:Dial` vs `AutoDialer:Dispatch` | ✅ Still relevant |
| **A7** | Manual-dialer cadence — reuse `dialer_lead_states` machinery or skip it? | ✅ Still relevant |

### Two flavors of "manual mode" to disambiguate (also from this session)

| Flavor | Description | Decide later |
|---|---|---|
| **1. Click-to-dial** | Rep clicks "dial this lead" → system dials → rep is talker from t=0. Rep-driven cadence | Resolve when manual mode lands |
| **2. Continuous loop** | Rep toggles "manual mode ON" → system continuously dials, connects to rep as they answer. System-driven cadence; rep is endpoint | Resolve when manual mode lands |

### Open grilling questions never reached (would have come after A2 in this session)

Q9-Q16 from the grill territory list. ALL of these were vendor-specific (Twilio/Retell-shaped); reframe for CloudTalk:

| Old Q# | Old framing (Twilio/Retell) | CloudTalk-shaped reframing |
|---|---|---|
| Q9 | Vendor abstraction interface shape (`services/voip`, `services/ai-voice`, `services/messaging`, etc.) | What does our integration boundary with CloudTalk look like? Single `services/cloudtalk/` wrapper? Or do we still abstract for future provider swaps? |
| Q10 | Retell agent lifecycle per lead source | How do CloudTalk AI agents get scoped per lead source? Through CloudTalk's UI, our API, or a hybrid? |
| Q11 | Dispatcher state machine | What does the dispatcher look like when CloudTalk owns most of the workflow execution? |
| Q12 | Transfer routing algorithm | Does CloudTalk handle transfer routing internally, or do we still own that logic? |
| Q13 | Webhook idempotency + signing (Twilio HMAC + Retell signing secret) | How does CloudTalk sign webhooks? What's the idempotency model? |
| Q14 | Softphone widget always-on vs gated | Does CloudTalk provide a browser softphone, or do we build one (React wrapper)? |
| Q15 | Disposition picker required vs skippable | Same product question; agnostic to provider |
| Q16 | Phone E.164 normalization boundary | Same engineering question; agnostic to provider |

---

## State of the working tree (as of 2026-05-23)

- **Branch:** `main`
- **Branch is ahead of origin/main by 4 commits** (pre-existing doc commits about Phase 0/Phase 1; will gain a 5th commit for the pivot docs + this handoff)
- **`archive/twilio-build-aborted` branch** exists locally; not pushed to remote; preserves all aborted Phase 1A implementation work
- **node_modules:** reverted to main's state — `twilio`, `@twilio/voice-sdk`, `retell-sdk` uninstalled (`pnpm install` ran cleanly)
- **No DB push happened.** No dialer tables exist in dev or prod databases
- **Unrelated working-tree changes** (pre-existing, NOT touched by pivot): `docs/README.md`, `docs/codebase-conventions/README.md`, `docs/codebase-conventions/app-shell.md`, `docs/codebase-conventions/entity-frontend.md`, `docs/ubiquitous-language.md`, `docs/domain/ubiquitous-language.md` deletion, `src/features/landing/ui/components/experience/count-up-stat.tsx`. These are from prior session work; left alone

### GitHub issues for the deferred EPIC

All four Phase 1 issues closed as "not planned" with a comment pointing to this handoff:

- [#229 — Phase 1A: schema foundation](https://github.com/OlisDevSpot/tri-pros-website/issues/229) — closed
- [#230 — Phase 1B: entity scaffolds + vendor providers](https://github.com/OlisDevSpot/tri-pros-website/issues/230) — closed
- [#231 — Phase 1C: orchestration + webhooks + tRPC](https://github.com/OlisDevSpot/tri-pros-website/issues/231) — closed
- [#232 — Phase 1D: softphone widget + admin UI + e2e verification](https://github.com/OlisDevSpot/tri-pros-website/issues/232) — closed

---

## CloudTalk EPIC — starter sketch for the new session

This is NOT a plan. It's seed material for the new `/grill-with-docs` session to architect.

### Likely EPIC shape

```
docs/plans/voip/
├── HANDOFF-from-twilio-build.md   ← this doc
├── EPIC.md                         ← TO BE WRITTEN in new session
├── phase-0-cloudtalk-setup.md      ← procurement + dashboard config
├── phase-1-integration-mvp.md      ← app-side integration (auth, webhooks, basic API calls)
├── phase-2-...                     ← future phases
```

### Likely Phase 0 contents (CloudTalk procurement + dashboard config)

(User mentioned they'll upload screenshots and we'll work through dashboard setup together — analogous to how Twilio Phase 0 walked through Trust Hub + 10DLC + Elastic SIP Trunk + Retell SIP origination.)

- CloudTalk account creation + plan selection
- DID procurement / number porting from Twilio (if applicable)
- AI voice agent configuration in CloudTalk dashboard
- Routing / workflow configuration in CloudTalk dashboard
- Webhook endpoint configuration (CloudTalk → our `voip.triprosremodeling.com/api/cloudtalk/...`)
- API key generation + storage
- SMS sender registration (CloudTalk equivalent of 10DLC)
- Trust / compliance setup (CloudTalk's equivalent of SHAKEN/STIR, DNC scrubbing)
- Test calls end-to-end via CloudTalk

### Likely Phase 1 contents (app-side integration)

- `services/cloudtalk/` — wrapper around CloudTalk's API
- Webhook routes: `src/app/api/cloudtalk/*/route.ts`
- Local shadow tables: which entities do we mirror from CloudTalk for joining/querying?
- Reuse: `app_settings` table for CloudTalk config, AppFeature registry pattern, idempotency keys
- CASL abilities for VoIP + dialer actions
- Push notifications for relevant CloudTalk events
- Customer-pipeline integration: when CloudTalk reports a successful call → meeting booking, update customer pipeline

### Open architectural questions for new EPIC's grilling session

(Reframed from above, plus CloudTalk-specific ones to add:)

1. **Integration boundary** — Do we abstract behind a generic `VoIPProvider` interface (anticipating future CloudTalk swap) or commit to CloudTalk-specific code? Counter-pressure: CloudTalk's API shape may not fit a generic interface cleanly.
2. **State ownership split** — Which entities does CloudTalk own (DIDs, AI agents, call records, contact lists, SMS history)? Which do we own (customer linkage, lead state, dispositions, push notification triggers)? Where do we shadow CloudTalk state in our DB for joins?
3. **Webhook contract** — What events does CloudTalk emit? Webhook signing scheme? Idempotency keys per event?
4. **Calling-from-our-app** — Does CloudTalk provide a browser softphone widget we can embed, or do we still need a React component? Are there iframes / SDKs?
5. **Auto-dialing vs CloudTalk's native auto-dialing** — CloudTalk has its own auto-dialer. Do we use it (and configure via dashboard) or build our own dispatcher on top of CloudTalk's basic call API?
6. **Cadence / lead-state machinery** — Does CloudTalk handle cadence (retry intervals, max attempts) or do we own that and just tell CloudTalk "place this call now"?
7. **DID rotation / warming** — Does CloudTalk handle this automatically, or do we still pool-rotate?
8. **AI voice agent** — Do we configure agents per lead source in CloudTalk's UI, or via API? How does the AI hand off to a human (transfer)?
9. **Recording + transcription** — Does CloudTalk store recordings + provide transcripts? At what cost? With what retention?
10. **Compliance** — How does CloudTalk handle DNC scrub, opt-out (STOP keyword), TCPA compliance gates?
11. **Cost model** — Per-minute? Per-DID? Per-AI-agent? How do we monitor + alert on cost?
12. **Multi-rep support** — How does CloudTalk model multiple human reps? Per-rep DIDs? Routing rules?
13. **Inbound calls** — Does CloudTalk handle inbound calls cleanly (route by DID, IVR menus, voicemail)? Per the broader VoIP system vision.

---

## How to use this handoff in the new session

1. Read this entire doc end-to-end.
2. Skim [`docs/plans/auto-dialer/EPIC.md`](../auto-dialer/EPIC.md) (DEFERRED banner; reference for business decisions).
3. Skim [`docs/superpowers/specs/2026-05-21-ai-dialer-design.md`](../../superpowers/specs/2026-05-21-ai-dialer-design.md) (design spec; most still valid).
4. Skim memory entry `project-auto-dialer.md` (will be updated to point at this handoff + reflect pivot).
5. Ask the user for CloudTalk dashboard access + screenshots — they offered to upload as needed during config phases.
6. Run `/grill-with-docs` (or whichever brainstorming/architecture skill is right) to **architect the CloudTalk EPIC**. Lead with:
   - Q: Single-provider commitment vs abstract behind `VoIPProvider` interface?
   - Q: State ownership split — what does CloudTalk own vs what we shadow?
   - Then walk into A2-A7 + open Q9-Q16 reframed for CloudTalk.
7. Write the new EPIC at `docs/plans/voip/EPIC.md`.
8. Phase 0 = CloudTalk procurement + dashboard config (work with user + screenshots).
9. Phase 1+ = our app-side integration.

---

## Related references

- **Memory:** `project-auto-dialer.md` (will be updated to reflect pivot)
- **Memory:** `project-ably-realtime-kernel.md` (still relevant — realtime kernel future replaces polling regardless of VoIP provider)
- **Memory:** `pattern-push-notifications.md` (still relevant — push pipeline reused by VoIP feature)
- **Memory:** `feedback-defaults-with-override.md` (still relevant — pattern used by per-feature settings)
- **Memory:** `feedback-entity-organization.md` (still relevant — flat entity layout)
- **ADR-0002** — Entity server system (factories used by future VoIP entities)
- **ADR-0003** — Service / provider architecture (relevant if we abstract behind a `VoIPProvider` interface)
