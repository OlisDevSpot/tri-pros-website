# Lead Engagement Platform — Build vs Buy Research Findings (2026-07-26)

> Deep-research output + repo ground-truth for the "do we want a GoHighLevel-style experience" question.
> Method: 5-angle web research fan-out, 22 sources fetched, 108 claims extracted, top 25 adversarially
> verified (3-vote refutation panel) → 17 confirmed, 8 refuted. Refuted claims are listed at the bottom —
> do NOT cite them. Plus direct verification of GHL's pricing page and the current state of our own code.

## 0. The decision, framed correctly

The question is NOT "replace our CRM with GoHighLevel." Post-meeting world (proposals, e-sign,
projects, financials) stays in our app — that was never up for debate, and GHL's API only makes sense
*because* our app remains system of record.

The real question re-opens the seam locked in `docs/plans/voip/INTEGRATION-SEAM.md` (2026-05-27:
"lead conversion is permanently delegated to a managed provider — CloudTalk today"), with broader
scope. Three sub-decisions:

1. **Who owns the pre-meeting conversion window** (lead in → meeting booked): CloudTalk (incumbent,
   live), GHL (candidate), or in-house.
2. **Who owns agent ↔ customer comms** (post-meeting calls/SMS): the unshipped in-house Twilio layer,
   or the same vendor as #1.
3. **Where the native iOS experience comes from** — the trigger for this whole re-evaluation.

## 1. Where we actually are (verified in repo 2026-07-26)

| Piece | Status |
|---|---|
| CloudTalk campaign layer | **Live**: enrollment, webhooks, DNC, unenroll; $750/mo cap, 300 dials/day soft cap, 10×3hr cadence |
| Automated SMS drip | **Live in-house**: `services/voip/campaigns/sms-cadence.service.ts` fires cadence SMS off CloudTalk call.ended events, merge tokens, per-campaign config |
| A2P 10DLC | In flight via CloudTalk (2–4 week clock was running) |
| In-house Twilio layer | **Scaffolded, not shipped**: 7 `voip_*` tables + service files exist; NO softphone, NO TwiML routes — no agent can place a call from our app |
| GHL touchpoint | `providers/gohighlevel/` already exists — Bina delivers leads via a GHL workflow webhook (we are already a GHL webhook consumer) |
| Mobile agent calling | Nothing. Repo already concluded iOS PWA can't do backgrounded WebRTC; in-house plan was PSTN-route to agent cell (Phase 3, unbuilt) |
| Dispatcher (VA) | Phase A shipped — leads-pool visibility + ungated phone; still needs a DID/caller-ID |

## 2. Verified findings (all 3-0 adversarial votes unless noted)

### 2.1 The PWA judgment is correct — confirmed at the OS level
A PWA **categorically cannot** deliver inbound VoIP calling on iOS. Receiving calls requires PushKit
VoIP pushes + the `voip` UIBackgroundModes entitlement + an Apple VoIP Services certificate — none
have any web API. iOS Web Push (16.4+) delivers only standard notifications and cannot ring the
device with native call UI. Any in-house path is a native (or React Native) app, full stop.
*(Apple PushKit docs, Twilio voice-quickstart-ios; constraints confirmed current through iOS 18.)*

### 2.2 GHL as a subordinate comms layer — architecturally viable
GHL API v2 (v1 EOL'd 2025-12-31) supports the "GHL in front, our CRM behind" pattern:
- Full contact/lead CRUD + tagging + custom fields (Custom Fields V2 API).
- **Conversations API**: pull SMS/email/call activity programmatically, including
  GET-recording-by-message-ID and GET-transcription, cursor-paginated export per location.
- **50+ webhook event types** (ContactCreate/Update, InboundMessage, OutboundMessage, Opportunity,
  Appointment) with documented retry semantics (up to 12 retries, exponential backoff).
- Rate limits ~100 req/10s burst, ~200K req/day per app per location — ample at our scale.
- Caveat: webhooks require registering a (private) OAuth marketplace app, not just pasting a URL.

### 2.3 GHL pricing — $97 vs $297 (RESOLVED 2026-07-26 second pass; nuanced)
GHL's own materials are internally inconsistent, so this was verified across four of their sources:

- **Pricing page "Core features" block** (lists "API Access") is **platform marketing, not a plan
  feature list** — no text ties it to any plan. The **plan cards on the same page**: Starter's card
  does NOT mention API access; Unlimited's card says **"Basic API Access"**; Pro's says
  **"Advanced API Access"**. No footnote defines the terms.
- GHL's official "How much is GoHighLevel" FAQ page *contradicts* this, describing Starter as having
  "Public API Access" / basic API + Zapier, with Unlimited adding "API Access — Integrate With
  Anything" and Pro adding OAuth 2.0 + sub-account-creation endpoints.
- GHL's help docs on **Private Integration Tokens** and the **MCP server** mention **no plan gating
  at all** (prereq is just "a sub-account + a PIT").
- Third-party 2026 sources split both ways.

**The practically decisive split — two integration surfaces:**

| Surface | Plan needed | Covers |
|---|---|---|
| **Workflow webhooks** — Inbound Webhook premium trigger + Custom Webhook premium action | **All plans incl. $97** (per GHL help docs; premium executions billed ~$0.01/exec, 100 free) | Our funnels → GHL lead intake; GHL events → our CRM push. This is exactly the mechanism Bina uses to send us leads today. |
| **REST API v2 (PITs)** — contact CRUD from our side, Conversations pull, **call recordings/transcripts**, reconciliation/backfill list endpoints | **Contractually $297+** (pricing-page cards); may *technically* work on Starter (undocumented, unpromised) | The system-of-record sync + the mandatory reconciliation cron per our seam doctrine |

**Ruling for our architecture:** the event-push half survives on $97, but recordings retrieval and
reconciliation require the real API — and building the CRM-of-record sync on an entitlement GHL's
pricing page doesn't grant at Starter is a trap (they can enforce it any time). **Plan on $297;
start the trial on $97 and run the 5-minute test: Settings → Private Integrations → create a PIT.**
If it works on Starter, treat it as a bonus, not a foundation.

### 2.4 GHL telephony usage is metered on top (LC Phone, Twilio-cost-plus)
From GHL's official billing guide (updated 2026-07-20):
- Outbound US calls **$0.0166/min** ($0.0126 + $0.004 client minutes); inbound $0.01165/min.
- SMS **$0.00747/segment** + carrier surcharges (AT&T $0.0035, T-Mobile $0.0045 outbound).
- Separately metered add-ons: call recording $0.0025/min, recording storage, answering-machine
  detection $0.0075/call, voicemail drops, transcription. (Competitors like Kixie/Close bundle these per-seat.)
- Fixed 5% markup on pass-through charges.

**Modeled at our volume** (~6,600 dials/mo + drip SMS, assuming ~1 min/dial + ~5K segments/mo —
a derived estimate, not a verified claim): usage ≈ $200–350/mo → **all-in ≈ $500–650/mo** at the
$297 tier. Comparable to the $750 CloudTalk cap — **not** meaningfully cheaper.

### 2.5 LeadConnector iOS app — fills the gap, with a caveat aimed at our exact use case
- 4.5/5, ~4,000 App Store ratings (live fetch 2026-07-26), includes in-app calling. Real native app.
- BUT recurring reviews specifically flag the **VoIP calling experience as subpar** (low-quality
  buzzing/vibration warnings, crashes after iOS updates, random logouts), with a developer response
  acknowledging and a GHL ideas-board thread corroborating. Verifiers note the buzzing is partly a
  false-positive quality-warning UX and complaints are a minority — but they concentrate in exactly
  the softphone function our agents would live in.
- The claim that the app also covers pipeline tracking / campaign management / invoicing was
  **REFUTED (1-2)** — its fitness beyond calling/messaging is unestablished. Needs hands-on trial.

### 2.6 The in-house native path — real, but a sustained commitment
- Twilio Voice iOS SDK is a client library, not a turnkey app: we must run our own Access Token +
  TwiML server; even the minimal official quickstart is a 9-step setup (SDK, serverless deploy,
  TwiML app, token generation, Apple VoIP push credential provisioning) before any custom UI.
- **Cost reducer**: Twilio's **Voice React Native SDK** ships with built-in mandatory CallKit
  integration on iOS — no hand-written CXProvider layer; setup reduces to VoIP cert + push credential
  + bundle ID + Xcode capabilities. Actively maintained (2.x GA, Expo v52 support in 2026).
- Remaining real costs: CallKit edge cases still eat engineering time (e.g. a documented blocking
  bug where `callInvite` is nil on accept across all accept paths), real-device-only debugging,
  App Store review + update treadmill, and the token/TwiML backend. For a 1-developer shop with a
  large active backlog, this is a multi-month sustained commitment competing with revenue work.

### 2.7 A2P 10DLC reaches into OUR funnels — regardless of vendor (a wash)
GHL's rejection-reasons doc (~65 carrier rejection codes, regime effective 2026-03-23, corroborated
by Twilio's changelog) shows approval requires, on the customer's own lead-capture funnels:
- an **unchecked-by-default SMS-consent checkbox** with four disclosures (message type, frequency,
  "message and data rates may apply", STOP instructions),
- a privacy policy explicitly stating mobile data is not shared with third parties for marketing,
- a publicly accessible website mentioning the SMS program.

These are industry-wide TCR/carrier rules — they apply equally to the in-flight CloudTalk
registration and any in-house Twilio build. **Action item for our Meta funnels either way.**

### 2.8 No CloudTalk ↔ GHL bridge exists
CloudTalk has no native GHL integration as of 2026 (Zapier/Make only); neither do Dialpad/Aircall
(medium confidence — negative claim). If GHL is adopted while CloudTalk keeps dialing, the two
stacks are unbridged — our CRM would be the integration hub, or brittle middleware. Practically:
**GHL replaces CloudTalk or doesn't come in at all** — running both long-term is the worst outcome.

### 2.9 Home-services vertical tools — thin fit
Hatch (the strongest vertical candidate) is an AI communication platform (Voice AI answering,
Messaging AI, Journey Builder for aged-lead re-engagement) — **not** a power dialer or agent
softphone, no verified native agent app, and third-party pricing intel puts it at ~$1,150–1,950/mo
tiers (unverified). Could complement as a speed-to-lead layer; does not cover our core requirements.
Podium, Leap, JobNimbus, MarketSharp produced **no surviving verified claims at all** — nothing
suggests they beat GHL/dialer-first tools for our shape (we're not replacing the CRM).

## 3. Requirements matrix (ours × verified capability)

| Requirement | In-house today | GHL ($297 + usage) | Notes |
|---|---|---|---|
| Lead capture via API/webhook | ✅ built (funnels → CRM; Bina via GHL webhook) | ✅ verified (API v2 CRUD + webhooks) | Wash |
| Power dialing ~300/day | ✅ CloudTalk live | ❓ **UNVERIFIED** — claims in both directions refuted | **The #1 open question** |
| Call recording (CA 2-party) | Deferred (#238) | ✅ $0.0025/min add-on | Consent-announcement design needed on ANY path; no surviving claim covered CA specifics |
| SMS automation / drip | ✅ sms-cadence.service live | ✅ workflows | We already built this; GHL version is config-not-code |
| A2P 10DLC | In flight (CloudTalk) | Supported, heavy approval process | Funnel changes required on every path (§2.7) |
| **Native iOS agent app** | ❌ nothing; PWA impossible (§2.1) | ✅ LeadConnector 4.5/5, VoIP-quality caveat | The decisive column |
| Pre-meeting pipeline view | CT-owned lifecycle, read-only in-app | ✅ opportunities/pipelines (app coverage unverified) | |
| Analytics out via API | n/a (we are the DB) | ✅ Conversations API incl. recordings/transcripts | Requires $297 tier |
| Cost @ ~5 seats, our volume | CloudTalk ≤ $750/mo cap + Twilio pennies | ~$500–650/mo modeled | Roughly a wash |

## 4. Recommendation (hybrid)

1. **Do not build the native iOS comms app in-house now.** The verified engineering surface
   (token/TwiML backend, PushKit/CallKit edge cases, App Store lifecycle) against 1-dev capacity and
   the current backlog says buy the mobile experience. Precedent: we already retired the in-house
   auto-dialer and dropped the AI voice agent on exactly this logic. Keep the Twilio RN SDK path in
   the back pocket — it's materially cheaper than raw native if we ever revisit.
2. **Do not rip out CloudTalk mid-epic on today's evidence.** It's live, 10DLC is in flight, the SMS
   cadence works, and GHL at the tier we'd need isn't cheaper. The switching cost includes redoing
   10DLC registration under GHL's ~65-rejection-code regime.
3. **Close the two decision-critical unknowns with a $297, one-month structured GHL trial**
   (see §5). Both refuted-claim clusters (dialer throughput, iOS app fitness) are only answerable
   hands-on. If the trial passes, GHL **replaces** CloudTalk and absorbs the unshipped in-house
   Twilio Phase-1 scope (softphone + agent comms); the Twilio layer shrinks to what GHL can't do
   (tokenized links, deep in-app flows) or is shelved.
4. **In parallel, spec-check the dialer-first competitors with strong native iOS apps** — Kixie,
   JustCall, Aloware, Close. None survived verification (all sourced from competitor marketing), so
   treat them as uninvestigated, not inferior. They bundle per-seat what GHL meters (recording, AMD,
   voicemail drops) and are purpose-built for the dialing+mobile combination. One of them may beat
   GHL for our narrow shape since we don't need GHL's funnel/website/CRM bulk.
5. **Fix the funnels for 10DLC now** (§2.7) — required on every path, currently blocking SMS at the
   carrier layer regardless of which platform wins.
6. **Keep our app as the integration hub + system of record** — the pattern is already proven
   (Bina-GHL webhook in, CloudTalk webhooks in, one seam doc). Whoever wins the comms layer feeds
   the CRM the same way.

## 5. GHL trial protocol (what "passes" means)

Run on $297 Unlimited, one sub-account, our real DIDs NOT ported (use LC test numbers):

| Test | Pass bar |
|---|---|
| Dialer throughput | One agent sustains ≥150 dials/day without per-call manual friction; confirm whether power/parallel dial exists natively or needs an add-on |
| LeadConnector iOS | 2 agents use it for a week of real-pattern calling: call quality acceptable, no daily logouts, pipeline visible enough for field use |
| API on $297 | Confirm "Basic API Access" includes: contacts CRUD, Conversations (incl. recording retrieval), webhook app registration |
| Webhook → CRM | Stand up `/api/webhooks/gohighlevel` (extend existing provider) receiving InboundMessage/OutboundMessage/Opportunity events end-to-end |
| SMS workflow | Rebuild the Bina cadence (10 attempts × 3hr + drip) in GHL workflows; verify DNC/STOP propagation reaches our `customers` DNC fields |
| Recording + CA consent | Verify a pre-call consent announcement is configurable on outbound recorded calls |
| True cost | Read the actual LC Phone meter after the trial month vs the $200–350 model |

## 6. Refuted claims — do not cite

All 0-3 or 1-2 in adversarial verification (mostly affiliate/competitor blogs):
- "GHL $97 Starter includes core toolkit / $297 removes sub-account limit + white-label" (0-3; superseded by direct pricing-page fetch, §2.3)
- "GHL rebills SMS at $0.0079–0.0119/segment, calls ~$0.014/min" (0-3; real rates in §2.4)
- "API access requires the $497 SaaS Pro tier" (1-2; pricing page says Basic API at $297)
- "GHL native dialer caps at 60-80 dials/day, single-line only" (0-3 — but the opposite is also unproven)
- "Third-party power dialers on GHL reach 300-400+ dials/day, GHL alone insufficient" (0-3)
- "LeadConnector iOS covers pipeline tracking, campaign management, invoicing" (1-2)
- "Hatch has native two-way integrations with AccuLynx/ServiceTitan/LeadPerfection" (0-3)
- "Twilio provides no managed token/TwiML service" (1-2 — sample servers exist; hosting is still on us)

## 7. Sources (survivors)

Primary: GHL LC Phone billing guide (help.gohighlevel.com, upd. 2026-07-20) · GHL API v2 docs
(marketplace.gohighlevel.com/docs) · GHL A2P rejection-reasons doc · gohighlevel.com/pricing (direct
fetch 2026-07-26) · App Store LeadConnector listing (id1564302502, live fetch 2026-07-26) · Twilio
Voice iOS SDK docs · twilio/voice-quickstart-ios · twilio/twilio-voice-react-native · Apple PushKit
docs · CloudTalk integrations page · usehatchapp.com/customers/home-improvement.

Full verification trail: workflow run `wf_b04f6f20-066` (104 agents, 22 sources, 25 claims verified).
