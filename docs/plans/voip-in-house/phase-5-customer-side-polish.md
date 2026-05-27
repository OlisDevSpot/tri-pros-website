# Phase 5 — Customer-Side Integration Polish

> **Parent EPIC:** [EPIC.md](./EPIC.md)
> **Prerequisite:** Phase 4 complete (depends on Phase 4 admin components for some shared visualizations).
> **Status:** Not started.

## What Phase 5 ships

Earlier phases stand up the voip infrastructure as its own surface (`/dashboard/voip-in-house/*`). Phase 5 weaves voip data into the existing **customer profile + timeline + pipeline** surfaces so agents see it in context, not as a separate destination.

Concretely: on the customer profile modal/page, a new **Conversation thread** tab shows the full SMS history (in-house + cloudtalk unioned via the `source` discriminator). The existing customer timeline gets voip events folded in (calls placed, calls received, SMS sent, SMS received, DNC entries, link-token mints). The customer-pipelines kanban cards surface "last interaction" + a quick-action menu (call now, send SMS) on hover. And the meeting/proposal lifecycle UIs gain inline send-SMS shortcuts pre-filled with templates from `voipConfigJSON.inHouse.transactionalSmsTemplates`.

The customer-side polish closes the loop on **why this EPIC exists in the first place** — agents stop reaching for their personal cell because the in-app surface gives them everything: clean DID, audit trail, customer context, threading, push notifications. Phase 5 is the conversion-of-habit phase.

## Task categories (sketch)

1. **Customer profile — Conversation tab**
   - New tab/panel in the existing customer profile modal (search `src/shared/entities/customers/components/profile/` for the modal compound structure).
   - Lists SMS thread (union over `voip_messages` where `customer_id = $1`) — chronological, source-badged ('in-house' / 'cloudtalk').
   - Inline compose at the top (reuses `SendMessageButton`).
   - Per-message status icons (queued/sent/delivered/failed).
2. **Timeline integration**
   - Extend the existing customer timeline component (`shared/entities/customers/components/timeline/`) to render voip events alongside meetings/proposals/projects.
   - Event types: `call_placed`, `call_received`, `voicemail_received`, `sms_sent`, `sms_received`, `dnc_added`, `link_minted`, `link_consumed`.
   - Visual treatment matches existing timeline rhythm.
3. **Pipeline card quick actions**
   - On the kanban customer card, add a hover-revealed menu: "Call now", "Send SMS", "Last interaction: <relative time>".
   - Shared component (`shared/components/voip/quick-actions.tsx`?) — promoted from `features/voip-in-house` if 2+ features consume per Rule 21.
4. **Meeting + proposal inline shortcuts**
   - On the meeting detail view: "Confirm meeting via SMS" button — picks the right template, opens send-SMS dialog pre-filled.
   - On the proposal detail view: "Send proposal link via SMS" — pre-fills with the proposal share URL.
   - On a project detail view: "Send status update" — template-driven.
5. **Recording playback widget** (shared)
   - Reusable `<RecordingPlayer voipCallId={...} />` component — checks CASL `view_recording` then signs a fresh URL.
   - Used by the call detail drawer (Phase 4) AND by the customer profile's Conversation tab when a call has an attached recording.
6. **Tokenized link UX (Phase 5 polish on top of Phase 1 plumbing)**
   - Phase 2 builds the actual L-DOC upload UI; Phase 5 polishes the agent-side experience: a "Send doc upload link" button on customer profile that mints the token + queues a SMS in one click. Confirmation toast shows the URL + expiry.

## Manual verification gate

A super-admin opens a customer with mixed in-house + cloudtalk history. The Conversation tab shows the full thread, color-coded by source. The timeline shows interleaved meeting + call + SMS events in correct chronological order. From the kanban view, hovering a card shows "Last call: 3 days ago"; clicking "Send SMS" opens the dialog pre-loaded with the customer's name. The meeting detail page's "Confirm via SMS" button sends a SMS matching the lead source's template. Each rendered voip event deep-links into the call/message detail.
