# Tri Pros — Context

Domain glossary. Terms here are the canonical names used in code, schema, and docs.
When a term in code drifts from the definition below, fix one of them (and ping the user).

## Lifecycle

A **customer** moves through two distinct phases. Different systems own each phase.

### Phase 1 — Lead-to-meeting (conversion)

From "we got a phone number from a marketing campaign" to "this person has a meeting booked." Owned by a **lead-conversion provider** (currently CloudTalk; pluggable). Our app does NOT place these calls or send these texts — the provider does. Our app's role is:

- Push: enroll / unenroll a customer in a campaign, configure which `lead_source` routes to which provider campaign.
- Pull: parse the provider's webhooks for 2-way sync (status changes, DNC events, graduation when a meeting is booked).
- **Not** mirrored in our DB: per-contact call recordings, SMS thread history, AI agent transcripts. Those live in the provider's system. Our DB carries the configuration + the lifecycle status only.

### Phase 2 — Agent comms (post-conversion)

From "meeting booked" forward — proposal sent, project scheduled, ongoing customer relationship. Owned by **voip-in-house** (Twilio-backed). Every agent and every office worker gets a clean company-branded DID. All calls, SMS, and voicemails between Tri Pros staff and a known customer go through it. Provides the in-app communication surface: dialer, SMS thread, voicemail inbox.

The boundary is sharp. voip-in-house does **not** handle lead-conversion outreach. The lead-conversion provider does **not** handle post-conversion comms.

## VoIP terms

- **voip-in-house** — Twilio-backed in-app communication layer for Phase 2. Owns `voip_*` tables. Clean DIDs assigned 1:1 to humans.
- **voip-campaigns** — Integration surface to whichever lead-conversion provider is wired in (currently CloudTalk). Owns the config + webhook parsing, NOT the call/SMS data.
- **DID** — A phone number provisioned on Twilio. In voip-in-house, every DID is `agent_personal` (sticky to a sales agent), `office_worker` (sticky to a non-sales user), or `main_line` (the inbound reception number).
- **Lead-conversion provider** — The external system that handles Phase 1. Today: CloudTalk. Pluggable.

## DNC (Do-Not-Call)

A **shared canonical registry** of phone numbers that must NOT be contacted. TCPA-load-bearing. Lives outside both voip-in-house and voip-campaigns. Both systems INSERT into it, both systems gate against it on outbound. No `source` field on the row — the registry is reason-tagged (`customer_request | ftc | admin | ...`), not origin-tagged.

## Funnel terms

- **Funnel** — a marketing landing-page + multi-step lead-capture flow for one remodeling vertical (kitchens, bathrooms, complete-interior, …). Identified by a `FunnelSlug` that doubles as subdomain label, route segment, and registry key. Authored as a `FunnelSpec` (hero + landing marketing blocks + ordered steps).
- **Trade** — the construction vertical a funnel sells (the Notion "All Construction Trades" entity). **1:1 with a funnel** (a funnel's slug is its trade key); A/B variation happens *within* a funnel via `spec.variants`, not by mapping two funnels to one trade. The component-free **trade-facts** module is the single source of a trade's facts: display name (`"Kitchen Renovation"`), Notion trade UUID, and SEO/OG meta. (`pixel.contentCategory` is measurement config and stays on the `FunnelSpec`, not a trade fact.)
- **Step / Dimension** — one screen of a funnel flow. A `card-select` step is a **dimension** (layout, age, scope, timeline, …); its **options** are the tappable answers. A step's answer can **enrich** the lead (a self-describing label/value captured into `leadMetaJSON`).
- **Marketing block** — a composable trust section on the funnel landing (reviews, portfolio, guarantee, process, faq, …), rendered via the `MarketingRegistry`.
