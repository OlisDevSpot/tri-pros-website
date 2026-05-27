# Phase 0 — External Setup & Procurement (in-house Twilio VoIP)

> **Parent EPIC:** [EPIC.md](./EPIC.md)
> **Sibling EPIC:** [voip-campaigns](../voip-campaigns/EPIC.md) has its own [Phase 0](../voip-campaigns/phase-0-cloudtalk-setup.md) for CloudTalk procurement. This Phase 0 is in-house-only (Twilio + DNC + webhook subdomain).
> **Status:** Substantially complete (2026-05-22). 10DLC Campaign vetting + FCR vetting clocks still running in background; both don't block Phase 1 design work.

> **For agentic workers:** This phase is **almost entirely manual/external** — vendor account signups, business identity verification. NO code work. Tasks are checklists to track, not commits to make.

**Goal:** Complete all external dependencies for in-house VoIP (Twilio account, business identity, regulatory compliance, DIDs, webhook subdomain) so Phase 1 code can run end-to-end.

**Architecture:** N/A — procurement only.

**Tech Stack:** Web dashboards (Twilio Console, Inngest, FCC DNC); attorney consult.

---

## Why Phase 0 exists separately

Two of the tasks have **1-2 week external vetting timelines** (Twilio Trust Hub for STIR/SHAKEN, 10DLC for SMS). Without them, Phase 1 code can run in a sandbox but cannot place production-grade calls or send compliant SMS. Submitted Day 1 so they're approved by the time Phase 1 code is ready.

---

## Phase 0 gate (must all be true to start Phase 1)

- ✅ Twilio Trust Hub business profile approved
- ✅ STIR/SHAKEN A-attestation enabled on DIDs
- ⏳ 10DLC campaign approved (vetting)
- ✅ DIDs purchased (pilot: 3 DIDs; expand per-agent once 2nd agent onboards)
- ✅ **DID reputation baseline complete** — CNAM set, FreeCallerRegistry submitted, Nomorobo submitted, baseline reputation screenshots captured per DID
- ⏳ FTC DNC SAN issued (1-2 business days)
- ✅ Webhook subdomain `voip.triprosremodeling.com` verified
- ⏸ TCPA attorney consult — deferred to end-of-both-EPICs (after voip-in-house Phase 5 + voip-campaigns Phase 1 ship)

**Note on DID reputation:** STIR/SHAKEN A-attestation alone does NOT prevent carrier "Spam Likely" labeling. **For in-house DIDs (this EPIC), free-baseline registration is sufficient** — in-house DIDs are low-volume agent-mediated and won't trigger the threat models that high-volume campaign DIDs do. The aggressive 5-layer mitigation stack is voip-campaigns's concern (CloudTalk-side DIDs).

---

## Tasks

### Task 1: Twilio account setup + DIDs

**Owner:** User
**Estimated effort:** 1-2 hours (signup + DID purchase); 1-2 weeks (Trust Hub vetting in background)

- [x] **Step 1.1: Create Twilio account** — done. Payment method added.

- [x] **Step 1.2: Purchase 3 in-house DIDs (pilot)**

Purchased: `+1 213 XXX XXXX`, `+1 424 XXX XXXX`, `+1 626 XXX XXXX`. All Voice + SMS capable.

Cost: ~$1.15/month/number × 3 = ~$3.50/month baseline.

**Pool expansion is per-agent for in-house** — buy a new DID when a new agent onboards and assign it to them. NOT a high-volume rotating pool (that's voip-campaigns's concern with CloudTalk-side DIDs).

- [x] **Step 1.3: Label DIDs in Twilio Console**

Labeled each DID with intended role:
- `213` → "Tri Pros - Transfer Target" (receives CloudTalk warm-transfers + general inbound while agent count is 1)
- `424` → "Tri Pros - Agent 1 Outbound" (will become per-agent once 2nd agent onboards)
- `626` → "Tri Pros - Reserve"

SIDs + E.164 recorded; will be seeded into `voip_dids` in Phase 1.

- [x] **Step 1.4: Submit Twilio Trust Hub business profile** — **APPROVED 2026-05-22**.

After Business Profile approval, SHAKEN/STIR A-attestation is applied account-wide automatically.

- [x] **Step 1.5: Submit 10DLC Campaign Registration**

In Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC:
- Brand: **APPROVED 2026-05-22**
- Campaign: SUBMITTED 2026-05-22 — vetting 3-14 days
- Use-case: "Customer Care" (NOT "Marketing")
- Description: "Lifecycle SMS for residential remodeling customers — meeting reminders, proposal links, project status, document upload requests, manual agent-to-customer texts"
- Sample messages — 3 representative (meeting confirmation, proposal link, document upload request)

Cost: $10/campaign + $4 brand vetting + $2/month per campaign + per-message carrier surcharges.

- [ ] **Step 1.6: Watch for Campaign approval email** — once approved, capture `TWILIO_10DLC_CAMPAIGN_SID` env var.

### Task 1.5: DID Reputation Baseline

**Owner:** User
**Estimated effort:** ~1 hour active + 2-4 weeks background processing

- [x] **Step 1.5.1: Set CNAM** — done 2026-05-22; set to "TRI PROS REMODEL" on all 3 DIDs.

- [x] **Step 1.5.2: Submit DIDs to FreeCallerRegistry** — done 2026-05-22; vetting 1-4 weeks per engine (Hiya, TNS, First Orion).

- [x] **Step 1.5.3: Submit to Nomorobo good-caller list** — done 2026-05-22.

- [ ] **Step 1.5.4: Reputation baseline check** — scheduled 2026-05-28. Capture starting-point screenshots via BatchDialer + Numeracle + CIDR attestation tester.

- [ ] **Step 1.5.5: Per-agent DID expansion** — buy a new DID when a 2nd agent onboards. Not a high-volume pool. (Burnable campaign DIDs are voip-campaigns's responsibility.)

- [ ] **Step 1.5.6: (Optional, paid) Twilio Voice Integrity** — only enable if FCR alone doesn't clear "Spam Likely" on in-house DIDs within 4 weeks. Unlikely given in-house DIDs' low volume + human-shaped behavior.

---

### ~~Task 2: Retell account~~ — **DROPPED 2026-05-23**

**Status:** Entirely out of scope for this EPIC per 2026-05-23 pivot. AI calling is delegated to CloudTalk's VoiceAgent — see [voip-campaigns EPIC](../voip-campaigns/EPIC.md). Retell account work, BYO Twilio import, agent configuration, SIP trunk origination, webhook signing secrets — all obsolete.

The Retell account from the pre-pivot Phase 0 work can be canceled; the existing test agent and SIP trunk are not used.

---

### ~~Task 3: Sendblue account~~ — **DROPPED 2026-05-23**

**Status:** Entirely out of scope. iMessage premium UX is not a sufficient conversion lever to justify integration cost. Twilio SMS is the sole messaging channel indefinitely.

---

### Task 4: FTC DNC list access

**Owner:** User
**Estimated effort:** 15-30 min

- [x] **Step 4.1: Register at telemarketing.donotcall.gov** — done. Registered as telemarketer (qualifies even for opt-in leads; required for compliance scrubbing).

- [x] **Step 4.2: Subscribe to DNC list** — done; 5-area-code free tier (well under limit).

- [ ] **Step 4.3: Note credentials** — awaiting SAN issuance (1-2 business days). Will become `FTC_DNC_SAN` env var.

The DNC list is consulted by both this EPIC's compliance gate AND voip-campaigns (which propagates DNC to CloudTalk). See [INTEGRATION-SEAM.md §5](../voip/INTEGRATION-SEAM.md).

---

### Task 5: Inngest account

**Owner:** User
**Estimated effort:** 15 min

- [x] **Step 5.1: Sign up for Inngest** — done; tri-pros-owned, Olis Solutions invited as admin. Free tier sufficient for pilot scale.

- [x] **Step 5.2: Save keys** — `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` saved.

Phase 1 ships on existing QStash. Inngest integration is set up so it's ready when migration is invoked (`@migration: → Inngest`).

---

### Task 6: Webhook subdomain

**Owner:** User
**Estimated effort:** 15 min

- [x] **Step 6.1: Create `voip.triprosremodeling.com` DNS record** — done 2026-05-22 (originally created as `dialer.triprosremodeling.com`; renamed to `voip.` 2026-05-23 per pivot to cover both Twilio + CloudTalk webhooks under one umbrella).

CNAME → `cname.vercel-dns.com`.

- [x] **Step 6.2: Add custom domain in Vercel project** — done; DNS propagation verified.

This subdomain hosts ALL VoIP-related webhooks + voip routing endpoints:
- Twilio voice + messaging webhooks: `voip.triprosremodeling.com/api/twilio/...`
- CloudTalk webhooks (voip-campaigns EPIC): `voip.triprosremodeling.com/api/cloudtalk/...`
- voip routing (mid-call enrichment) endpoints (implemented here, called by CloudTalk): `voip.triprosremodeling.com/api/voip/routing/...`

---

### Task 7: TCPA attorney consult — **DEFERRED to end-of-both-EPICs**

**Status:** Defer until after voip-in-house Phase 5 + voip-campaigns Phase 1 both shipped with 30+ days of production data. Consult once with concrete operational evidence rather than hypotheticals.

**Owner:** User
**Estimated effort:** 1-2 hour billable consult; cost $400-800

**To resume when ready, bring these questions:**
1. Does opt-in language on Meta lead ads + web forms cover AI prerecorded voice + SMS marketing? (Provide screenshots)
2. Do we need to update opt-in language for explicit AI/automated disclosure?
3. CA AB 2013 disclosure obligations — is "AI assistant" identification sufficient?
4. Recording disclosure obligations — must we explicitly state "this call may be recorded"?
5. Opt-out timing — confirm 24h is the legal max; our 5-min processing exceeds requirement
6. Reassigned Numbers Database — needed given opt-in vintage <12 months?

---

## Phase 0 completion checklist

- [x] Twilio Trust Hub: business profile approved
- [x] Twilio Trust Hub: STIR/SHAKEN A-attestation enabled (account-wide)
- [x] Twilio: 3 DIDs purchased + labeled
- [x] Twilio: CNAM set on every DID ("TRI PROS REMODEL")
- [x] DID reputation: FreeCallerRegistry submitted for all DIDs
- [x] DID reputation: Nomorobo good-caller list submitted for all DIDs
- [ ] DID reputation: baseline screenshots captured (scheduled 2026-05-28)
- [ ] Twilio: 10DLC campaign approved + active (Brand approved 2026-05-22; Campaign vetting)
- [ ] FTC DNC: SAN issued + saved
- [x] Inngest: account active, project connected
- [x] Webhook subdomain `voip.triprosremodeling.com` resolving to Vercel
- [ ] (Optional) Twilio Voice Integrity enabled (only if FCR alone doesn't clear "Spam Likely" within 4 weeks)
- [ ] ~~(Recommended) TCPA attorney consult~~ **DEFERRED to end-of-both-EPICs**

---

## Secrets assembled for Phase 1 handoff

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TRUST_PROFILE_SID=BUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_10DLC_CAMPAIGN_SID=CMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # pending campaign approval

# Pilot DIDs
TWILIO_TRANSFER_TARGET_DID_E164=+1213XXXXXXX
TWILIO_TRANSFER_TARGET_DID_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_DID_424_E164=+1424XXXXXXX
TWILIO_DID_424_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_DID_626_E164=+1626XXXXXXX
TWILIO_DID_626_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# FCC DNC (SAN pending)
FTC_DNC_SAN=  # pending 1-2 business days
FTC_DNC_USERNAME=tri-pros-remodeling
FTC_DNC_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Inngest
INNGEST_EVENT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
INNGEST_SIGNING_KEY=signkey-prod-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Shared VoIP base URL — covers Twilio webhooks + CloudTalk webhooks (voip-campaigns) + voip routing endpoints
VOIP_WEBHOOK_BASE_URL=https://voip.triprosremodeling.com

# Dev safety (Phase 1 will enforce; redirects all outbound voice/SMS to a single test number in dev)
VOIP_DEV_OVERRIDE_NUMBER=  # set in dev/preview only; CI gate prevents production
```

**Dropped env vars** (per 2026-05-23 pivot): `RETELL_API_KEY`, `RETELL_TEST_AGENT_ID`, `RETELL_WEBHOOK_SIGNING_SECRET`, `TWILIO_SIP_TRUNK_DOMAIN`, `TWILIO_SIP_TRUNK_USERNAME`, `TWILIO_SIP_TRUNK_PASSWORD`, `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET`, `DIALER_WEBHOOK_BASE_URL` (renamed to `VOIP_WEBHOOK_BASE_URL`), `DIALER_DEV_OVERRIDE_NUMBER` (renamed to `VOIP_DEV_OVERRIDE_NUMBER`).

---

## When Phase 0 is complete

Update [EPIC.md](./EPIC.md) phase status table: Phase 0 → "Done." Phase 1 is unblocked.

Move to [phase-1-mvp.md](./phase-1-mvp.md) for implementation — **note: phase-1-mvp.md is pending descope rewrite** (currently shows the OLD combined AI-dialer plan with Retell/dispatcher/cadence content; will be rewritten to reflect in-house-only scope before implementation kicks off).
