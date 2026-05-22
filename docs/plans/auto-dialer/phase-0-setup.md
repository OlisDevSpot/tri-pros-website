# Phase 0 — External Setup & Procurement

> **For agentic workers:** This phase is **almost entirely manual/external** — vendor account signups, business identity verification, attorney consults. NO code work. Tasks are checklists to track, not commits to make.
>
> **Parent epic:** [EPIC.md](./EPIC.md)
> **Spec section:** §9 Phase 0
> **Status:** Not started

**Goal:** Complete all external dependencies (vendor accounts, business identity verification, regulatory compliance setup, DIDs purchased) so Phase 1 code can run end-to-end.

**Architecture:** N/A — procurement only.

**Tech Stack:** Web dashboards (Twilio Console, Retell, Sendblue, Inngest, FCC DNC); attorney consult.

---

## Why Phase 0 exists separately

Two of the tasks have **1-2 week external vetting timelines** (Twilio Trust Hub for STIR/SHAKEN, 10DLC for SMS). Without them, Phase 1 code can run in a sandbox but cannot place production-grade calls or send compliant SMS. Submit these Day 1 so they're approved by the time Phase 1 code is ready.

---

## Phase 0 gate (must all be true to start Phase 1)

- ✅ Twilio Trust Hub business profile approved
- ✅ STIR/SHAKEN A-attestation enabled on dial DIDs
- ✅ 10DLC campaign approved
- ✅ Retell account active + verified outbound test call from their dashboard
- ⏸ ~~Sendblue account active + verified test iMessage~~ **DEFERRED** — Phase 1 ships with Twilio-only messaging
- ✅ Dial DIDs + 1 reserved transfer-target DID purchased and visible in Twilio Console (pilot: 3 dial; expand to 7-10 before scaling)
- ✅ **DID reputation baseline complete** — CNAM set, FreeCallerRegistry submitted, Nomorobo submitted, baseline reputation screenshots captured per DID
- ✅ FTC DNC list access credentials obtained
- ✅ (Recommended) TCPA attorney consult complete with documented opinion

**Note on DID reputation:** STIR/SHAKEN A-attestation alone does NOT prevent carrier "Spam Likely" labeling. The three carrier analytics engines (Hiya → AT&T, TNS → Verizon, First Orion → T-Mobile) run independently on top of STIR/SHAKEN with their own behavioral models. Task 1.5 below is the mandatory free baseline. See EPIC.md → "Spam mitigation strategy" for the full layered stack.

---

## Tasks

### Task 1: Twilio account setup + DIDs

**Owner:** User
**Estimated effort:** 1-2 hours (signup + DID purchase); 1-2 weeks (Trust Hub vetting in background)

- [ ] **Step 1.1: Create Twilio account** (or use existing). Sign up at https://www.twilio.com/console. Add payment method.

- [ ] **Step 1.2: Purchase 6 DIDs in SoCal area codes**

In the Twilio Console → Phone Numbers → Buy a Number, purchase:
- 5 dial DIDs: one each in area codes **310, 213, 818, 949, 626** (or substitute closest available in same metro)
- 1 reserved transfer-target DID: any area code (won't be used for outbound dials)

Make all phones support **Voice + SMS** capabilities (this is the default for US local numbers; verify the checkboxes are checked at purchase).

Cost: ~$1.15/month/number × 6 = ~$7/month baseline.

- [ ] **Step 1.3: Tag the transfer-target DID**

In the Twilio Console, navigate to the 6th DID (transfer-target). Add a label/tag: "Tri Pros Transfers" or use Twilio's friendly name field. This DID will be referenced by SID in Phase 1 code — record its SID and E.164 number in a secrets file you'll share with the implementation session.

Record the SID + E.164 of all 6 DIDs into a temporary file (will be migrated into Postgres in Phase 1):

```
DIAL DIDs (5):
1. +1310555XXXX  PNxxxxxxxxxxxx
2. +1213555XXXX  PNxxxxxxxxxxxx
3. +1818555XXXX  PNxxxxxxxxxxxx
4. +1949555XXXX  PNxxxxxxxxxxxx
5. +1626555XXXX  PNxxxxxxxxxxxx

TRANSFER-TARGET DID (1):
6. +1XXX555XXXX  PNxxxxxxxxxxxx  ← "Tri Pros Transfers"
```

- [ ] **Step 1.4: Submit Twilio Trust Hub business profile**

This is the **long pole** — submit Day 1, takes 1-2 weeks for Twilio to vet.

In the Twilio Console → Trust Hub → Business Profile, fill out:
- Business name: Tri Pros Remodeling
- Business type: LLC / S-Corp / etc. (your actual structure)
- Business address, EIN, website URL
- Authorized representative details
- Upload supporting documents (articles of incorporation, EIN letter)

After business profile is approved, submit the **SHAKEN/STIR Trust Product** application (sub-application of Trust Hub). This is what gives you A-attestation on outbound calls.

Cost: Free once approved.

- [ ] **Step 1.5: Submit 10DLC Campaign Registration**

This runs in parallel with STIR/SHAKEN — both reuse the same approved Business Profile.

In the Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC:
- Register your Brand (reuses Business Profile, ~$4 one-time vetting fee)
- Register Campaign with use-case: "Customer Care" (NOT "Marketing" — we're following up on opted-in leads, not cold marketing)
- Campaign description: "Lead followup messages for residential remodeling customers who opted in via website / Meta lead ads"
- Sample messages — provide 3 representative messages (callback reminder, voicemail followup, opt-out confirmation)
- Submit for vetting

Cost: $10/campaign + $4 brand vetting + $2/month per campaign + per-message carrier surcharges.

Approval typically 1-2 weeks.

- [ ] **Step 1.6: Wait + verify**

Watch Twilio Console for approval emails. Once approved:
- Trust Hub: shows "Approved" status; SHAKEN/STIR badge visible on all owned DIDs
- 10DLC: shows "Active" campaign, throughput limit enabled

**This task is complete when all approval indicators show green.**

---

### Task 1.5: DID Reputation Baseline (do TODAY, immediately after DID purchase)

**Owner:** User
**Estimated effort:** ~1 hour active + 2-4 weeks background processing
**Why this exists:** Your first test call from a fresh Twilio DID with STIR/SHAKEN A-attestation approved showed **"Spam Likely"** on iPhone. That's because A-attestation proves you didn't spoof, but says nothing about whether you're spam. The actual verdict comes from Hiya (used by AT&T + Samsung), TNS (Verizon), and First Orion (T-Mobile) running independent reputation analytics layered on top of STIR/SHAKEN. Brand-new DIDs with zero call history default to skeptical treatment. This task registers your DIDs with each engine proactively so the spam-likely flag clears within 2-4 weeks.

⚠️ **Do all steps below within the same day** — vetting clocks start at submission and you want them running in parallel with Trust Hub + 10DLC vetting (Tasks 1.4-1.5 above).

- [ ] **Step 1.5.1: Set CNAM on every DID** (free, ~5 min/number)

In Twilio Console → Phone Numbers → click each DID → Voice section → Caller Name Display → set to **"TRI PROS REMODEL"** (15-char max on most carriers; exact match to registered business name).

CNAM is primarily honored by landlines and a small fraction of mobile flows. **It will NOT directly fix the iPhone "Spam Likely" issue** (mobile carriers ignore CNAM in favor of their analytics engines). But it's free, helps landlines, and signals "legitimate registered business" to engine vetters reviewing your FCR submission.

- [ ] **Step 1.5.2: Submit all DIDs to FreeCallerRegistry** (free, ~15 min total)

Go to https://freecallerregistry.com/fcr/public/html/home.html. One form submits to Hiya + TNS + First Orion simultaneously — the three engines behind AT&T, Verizon, and T-Mobile. Run by those companies directly, not a third party.

Required info: business name (must match Trust Hub exactly), EIN, call type (B2C lead callback), industry (Home Improvement / Construction Services), expected call volume, brief description of why you call (following up on opted-in remodeling leads).

**Processing time:** 1-4 weeks per engine (each vets independently). They may email for clarifications — respond within 24 hours to keep your submission active.

**This will not retroactively remove the "Spam Likely" label from your existing test calls** — it tells engines "this is a legit business" so future calls get scored fairly.

- [ ] **Step 1.5.3: Submit to Nomorobo good-caller list** (free, ~10 min)

Separate ecosystem from FCR — Nomorobo's database is used by many third-party caller ID apps and feeds into iPhone's Live Caller ID feature. Go to https://www.nomorobo.com/contact-us, select "good caller registration", submit business details + all 3 DIDs.

- [ ] **Step 1.5.4: Establish reputation baseline** (free, ~10 min)

Run free reputation checks against each DID. Screenshot results — you'll re-check weekly during warm-up to confirm vetting is processing.

- https://batchdialer.com/reputation-check (up to 3 numbers, no signup, shows current label per carrier)
- https://www.numeracle.com/number-check (up to 15 numbers, emails detailed cross-carrier report)
- https://calleridreputation.com/attestation-tester/ (verifies STIR attestation is being applied correctly)

**Expected baseline (today):** "Unrated" or "Spam Likely" on most carriers. **Expected after 2-4 weeks** of FCR + Nomorobo + low-volume warm calling: cleared to "Allowed" / "No label" on at least 2 of 3 engines.

- [ ] **Step 1.5.5: Plan DID pool expansion** (do NOT buy today — defer to ~1 week before Phase 2 scaling)

Industry rule of thumb: **maximum 75 dial attempts per DID per day** (50/day safe target). For target ~500 attempts/day at scale, you need **7-10 DIDs in rotation**. You currently have 3 (213, 424, 626). Plan to buy 4-7 more before going above ~150 attempts/day. SoCal area codes to add when ready:

- 619 (San Diego)
- 760 (Inland Empire)
- 909 (San Bernardino / Riverside)
- 562 (Long Beach)
- 951 (Riverside)

**Don't buy today** — fresh DIDs need 2-4 weeks of warming before they're spam-safe. Buying now means starting their clock for volume you won't hit for 8+ weeks. Buy them 1-2 weeks before the planned ramp instead.

- [ ] **Step 1.5.6: (Optional, paid) Enable Twilio Voice Integrity**

Twilio Console → Trust Hub → Voice Integrity. This is Twilio's productized "managed registration with all 3 engines + ongoing reputation monitoring." Pricing not public (likely ~$5-15/DID/month). Easiest "paid version of FCR" path if you don't want to maintain registrations manually.

**Recommendation:** wait until after FCR results come in (2-4 weeks). If FCR alone clears the "Spam Likely" flag on 2 of 3 engines, skip Voice Integrity. If it doesn't, enable it as the next escalation.

---

### Task 2: Retell account + integration verification

**Owner:** User
**Estimated effort:** 30 min

- [ ] **Step 2.1: Sign up for Retell**

Go to https://www.retellai.com/, sign up, add payment method. Start with pay-as-you-go pricing (no commitment).

- [ ] **Step 2.2: Import Twilio numbers (BYO Twilio)**

In the Retell dashboard → Phone Numbers → Import from Twilio:
- Connect your Twilio account (OAuth or API credentials)
- Import all 5 dial DIDs from Task 1 (NOT the transfer-target DID — that one is only used for the outbound leg to the human, doesn't need Retell)

- [ ] **Step 2.3: Verify outbound test call from Retell dashboard**

Use Retell's built-in test-call feature:
- Create a basic test agent (any quick template)
- Initiate outbound call to your own cell phone using one of the imported DIDs
- Confirm your phone rings, the AI speaks, you can hear and respond

If this fails: do NOT proceed to Phase 1. Debug with Retell support first.

- [ ] **Step 2.4: Note API credentials**

In Retell → Settings → API Keys, generate an API key for the Tri Pros app to use. Save securely — will be needed as `RETELL_API_KEY` env var in Phase 1.

---

### Task 3: Sendblue account + verification — **⏸ DEFERRED (2026-05-21)**

**Status:** Deferred ~1-2 weeks post Phase 1 launch. Phase 1 ships with Twilio-only messaging. Sendblue (iMessage premium UX) becomes a swap-in via the existing `services/messaging/` vendor abstraction when user re-engages. See EPIC.md decisions log entry "Sendblue (iMessage) deferred" for full rationale.

**To resume:** Pick up the steps below from where deferred — no setup prerequisite has been done yet beyond reading.

**Owner:** User
**Estimated effort:** 30-60 min

- [ ] **Step 3.1: Sign up for Sendblue**

Go to https://sendblue.com/, sign up, complete business verification (they require legitimate business info — your already-prepared Trust Hub paperwork covers this).

- [ ] **Step 3.2: Choose iMessage sending number**

Sendblue assigns you a dedicated iMessage sender number. Choose / accept it during onboarding.

- [ ] **Step 3.3: Send a test iMessage**

From Sendblue dashboard, send a test message to your own iPhone (and an Android phone if you have access — to verify the SMS fallback path):
- iPhone: should arrive as a blue bubble iMessage
- Android: should arrive as a green-bubble SMS via fallback

- [ ] **Step 3.4: Note API credentials**

In Sendblue → API → Keys, generate API key. Save — will be `SENDBLUE_API_KEY` env var in Phase 1.

---

### Task 4: FTC DNC list access

**Owner:** User
**Estimated effort:** 15-30 min

- [ ] **Step 4.1: Register for telemarketer access at telemarketing.donotcall.gov**

Go to https://telemarketing.donotcall.gov. Register your business as a telemarketer (you DO qualify even though leads are opted in — having DNC list access is required compliance and lets us scrub).

You'll need: business EIN, address, contact person, sworn affidavit that you'll honor the list.

- [ ] **Step 4.2: Subscribe to DNC list (free for ≤5 area codes)**

Subscribe to your operating area codes. For us, the 5 SoCal area codes from Task 1.2 are well within the free tier (≤5 area codes = free; full national subscription is $20K/year).

Free subscription = up to 5 area codes; we're well under.

- [ ] **Step 4.3: Note credentials**

Save your DNC API access credentials. Will be `FTC_DNC_API_KEY` env var in Phase 1.

---

### Task 5: Inngest account (for `@migration: → Inngest` future)

**Owner:** User
**Estimated effort:** 15 min (does not block Phase 1)

- [ ] **Step 5.1: Sign up for Inngest**

Go to https://www.inngest.com/, create an account. Free tier sufficient for pilot scale.

- [ ] **Step 5.2: Connect to your Next.js project**

Follow Inngest's Next.js quickstart guide. Add `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` env vars to Vercel preview + production.

Phase 1 ships on QStash. Inngest integration is set up now so it's ready when migration is invoked.

---

### Task 6: Webhook subdomain (optional but recommended)

**Owner:** User
**Estimated effort:** 15 min

- [ ] **Step 6.1: Create `dialer.triprosremodeling.com` DNS record**

In your DNS provider, add a CNAME from `dialer.triprosremodeling.com` to `cname.vercel-dns.com` (or whatever Vercel custom domain pattern you use).

- [ ] **Step 6.2: Add custom domain in Vercel project**

In Vercel project → Settings → Domains, add `dialer.triprosremodeling.com`. Verify DNS propagation.

This subdomain is what Twilio + Retell + Sendblue webhook URLs will point to. Optional — long Vercel URLs work too — but cleaner and lets you swap deployments without re-registering webhooks.

---

### Task 7: TCPA attorney consult (recommended) — **⏸ DEFERRED to end of epic (2026-05-22)**

**Status:** User decision (2026-05-22): defer all real-world professional/legal consultations to the absolute last task of the auto-dialer epic, after the system has been validated in production with real lead volume. Rationale: opt-in language is already in place via existing web forms; risk surface is low at pilot scale; cheaper to consult once with concrete real-world evidence than upfront on hypotheticals.

**To resume:** Run after Phase 5 (customer-side integration + observability) is in place and the dialer has accumulated 30+ days of real lead engagement data. The questions below are still the right ones to bring — just with operational evidence attached.

**Owner:** User
**Estimated effort:** 1-2 hour billable consult; cost $400-800

- [ ] **Step 7.1: Find a TCPA-specialist attorney**

Recommended sources:
- Your business's existing legal counsel + ask for TCPA referral
- TCPA Defense Force (https://www.tcpadefenseforce.com/) — TCPA-specialist firm
- Local SoCal firms with TCPA practice

- [ ] **Step 7.2: Bring these specific questions to the consult**

1. Does the consent language on our Meta lead ads + web forms cover **AI prerecorded voice** calls + **SMS marketing**? Provide them screenshots of the actual opt-in checkboxes + privacy policy.
2. Do we need to update opt-in language to be more explicit about AI / automated calls + SMS?
3. CA-specific requirements: AB 2013 disclosure obligations for our use case — is our planned "AI assistant" identification sufficient?
4. Recording disclosure obligations — must we say "this call may be recorded" or is the AI's identification sufficient?
5. Opt-out timing: confirm 24h is the legal max, and our same-request 5-min processing exceeds requirement.
6. Reassigned Numbers Database — do we need to check before each call given our opt-in vintage (most leads <12 months)?

- [ ] **Step 7.3: Document the attorney's opinion**

Save the consult notes in a private business file. Attach to your insurance policy if you have professional liability coverage. Should the legal landscape change or a complaint arise, this is your good-faith evidence.

---

## Phase 0 completion checklist

When ALL of these are checked, Phase 1 can begin:

- [ ] Twilio Trust Hub: business profile approved
- [ ] Twilio Trust Hub: SHAKEN/STIR Trust Product approved (A-attestation enabled)
- [ ] Twilio: dial DIDs purchased + 1 transfer-target DID purchased (pilot: 3 dial + 0 reserved transfer — using 213 as transfer; expand pool to 7-10 before scaling >150/day)
- [ ] Twilio: CNAM set on every DID ("TRI PROS REMODEL")
- [ ] DID reputation: FreeCallerRegistry submitted for all DIDs
- [ ] DID reputation: Nomorobo good-caller list submitted for all DIDs
- [ ] DID reputation: baseline screenshots captured (BatchDialer + Numeracle + CIDR attestation tester)
- [ ] Twilio: 10DLC campaign approved + active
- [ ] Retell: account active, BYO Twilio import verified, test outbound call successful
- [ ] ~~Sendblue: account active, test iMessage + SMS fallback verified~~ **DEFERRED**
- [ ] FTC DNC: telemarketer registration approved, 5-area-code subscription active
- [ ] Inngest: account active, project connected (preparatory; doesn't block Phase 1)
- [ ] (Optional) Webhook subdomain `dialer.triprosremodeling.com` resolving to Vercel
- [ ] (Optional) Twilio Voice Integrity enabled (only if FCR alone doesn't clear "Spam Likely" within 4 weeks)
- [ ] ~~(Recommended) TCPA attorney consult complete, opinion documented~~ **DEFERRED to end of epic** (after Phase 5 with real production data)

---

## Secrets to assemble for Phase 1 handoff

Once Phase 0 is complete, the implementing session will need these secrets (collect into a `.env.local` or your secret manager, do NOT commit):

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TRUST_PROFILE_SID=BUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_SHAKEN_STIR_SID=BUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_10DLC_CAMPAIGN_SID=CMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Pilot DIDs (E.164 + SID per number). Role lives in dialer_dids.role once seeded.
TWILIO_DID_213_E164=+1213XXXXXXX
TWILIO_DID_213_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_DID_424_E164=+1424XXXXXXX
TWILIO_DID_424_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_DID_626_E164=+1626XXXXXXX
TWILIO_DID_626_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Transfer-target role pointer (mirrors 213 in the pilot)
TWILIO_TRANSFER_TARGET_DID_E164=+1213XXXXXXX

# Twilio SIP Trunking (Retell origination)
TWILIO_SIP_TRUNK_DOMAIN=tripros.pstn.twilio.com
TWILIO_SIP_TRUNK_USERNAME=retell
TWILIO_SIP_TRUNK_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Retell
RETELL_API_KEY=key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Sendblue
SENDBLUE_API_KEY_ID=xxxxxxxxxxxxxxxx
SENDBLUE_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# FTC DNC
FTC_DNC_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Inngest (already set up if previously configured)
INNGEST_EVENT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
INNGEST_SIGNING_KEY=signkey_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook public URL (Vercel deployment URL OR custom subdomain)
DIALER_WEBHOOK_BASE_URL=https://dialer.triprosremodeling.com
```

---

## When Phase 0 is complete

Update [EPIC.md](./EPIC.md) phase status table: Phase 0 → "Done." Phase 1 is unblocked.

Move to [phase-1-mvp.md](./phase-1-mvp.md) for implementation.
