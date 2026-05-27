# Phase 3 — Mobile (Cellular) Mode + Inbound IVR + Push Pipeline Integration

> **Parent EPIC:** [EPIC.md](./EPIC.md)
> **Prerequisite:** Phase 2 complete.
> **Status:** Not started.

## What Phase 3 ships

Phase 1's browser softphone covers desktop use. Phase 3 adds **mobile (cellular) mode**: when an agent is away from their computer, warm-transfers land on their cellphone via PSTN dial (not WebRTC). Per the locked EPIC decision, iOS Safari + PWA can't reliably handle WebRTC backgrounded, so mobile = cellular routing, not browser WebRTC. The PWA dashboard handles dispositions and call-history; the call itself rides PSTN.

Phase 3 also adds the **inbound IVR foundation** for the main line — `voip.triprosremodeling.com/api/twilio/voice/inbound` returns TwiML that prompts the caller (Q1 from EPIC open questions: 3-option menu default: 1=sales, 2=active project, 3=billing), routes to the right agent's sticky DID via callback-routing logic, and falls back to voicemail when nobody's reachable. Voicemails get transcribed by Twilio and push-notified to the admin pool.

Finally, this phase wires the **push pipeline integration** for voip events — using the existing `notification.service.ts` + `providers/web-push/` infrastructure (see [pattern-push-notifications.md](../../../memory/pattern-push-notifications.md)). New push types: `voicemail-received`, `customer-sms-reply`, `disposition-needed`, `opt-out`, `kill-switch-toggled`. Each notification uses the declarative pattern (`notification.service.notifyXxx` → `sendPushToUser`) so deep-link navigation works on iOS PWA.

## Task categories (sketch)

1. **Mobile transfer mode**
   - Remove the Phase 1 guard in `voip-user-availability.service.ts::upsertAvailability` that blocks `transfer_mode='mobile'` writes.
   - Implement the mobile dispatch path in `voip-routing.service.ts::findTransferTarget` — when chosen agent has `transfer_mode='mobile'`, return their `cell_phone_e164` instead of the in-house transfer-target DID. Custom parameters carry the warm-intro for the agent to hear on pickup.
   - `services/voip/voip-mobile-transfer.service.ts` — handles Twilio Dial verb composition + warm-intro Say verb prepend.
   - Validation: `cell_phone_e164` is required when `transfer_mode IN ('mobile', 'auto')`. Service-layer + Zod-schema enforced.
2. **Inbound IVR**
   - `src/app/api/twilio/voice/inbound/route.ts` returns TwiML for the 3-option menu (configurable in `app_settings(feature='voip-in-house').configJson.inboundIvr`).
   - Per-option routing: 1 → sticky-DID-for-customer-if-known-else-round-robin-agent; 2 → active-project's project-manager; 3 → office admin pool.
   - Voicemail flow: any unanswered branch falls to `<Record action="/api/twilio/voice/voicemail-received" />` (Phase 3 new route). Webhook transcribes (Twilio built-in), inserts a `voip_calls` row with `status='voicemail'`, fires push to admin pool.
3. **Sticky-DID-callback routing**
   - When a customer calls back the DID we called them from, route to the agent assigned to that DID (`voip_dids.assigned_user_id`). Falls back to admin pool when unassigned or off-shift.
   - Implemented in `voip-routing.service.ts::routeInboundToAgent` + consumed by the inbound TwiML handler.
4. **Push pipeline integration**
   - Extend `notification.service.ts` with `notifyVoicemailReceived`, `notifyCustomerSmsReply`, `notifyDispositionNeeded`, `notifyOptOut`, `notifyKillSwitchToggled`.
   - Webhook hookpoints (inbound SMS → notifyCustomerSmsReply; voicemail-received → notifyVoicemailReceived; etc.).
   - Each notification includes `navigate` field for deep-link (e.g., `/dashboard/voip-in-house/calls/<id>`).

## Manual verification gate

Toggle an agent to `transfer_mode='mobile'` with their real cell in `voip_user_availability`. Dial a customer; the warm-transfer lands on their cell. Call the main DID; hear the 3-option IVR; press 1 → reaches the sticky agent. Leave a voicemail; transcription + push notification arrive. Reply to a voicemail's "callback?" push → opens the customer profile.
