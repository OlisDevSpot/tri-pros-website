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
- ✅ Sendblue account active + verified test iMessage
- ✅ 5 dial DIDs + 1 reserved transfer-target DID purchased and visible in Twilio Console
- ✅ FTC DNC list access credentials obtained
- ✅ (Recommended) TCPA attorney consult complete with documented opinion

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

### Task 3: Sendblue account + verification

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

### Task 7: TCPA attorney consult (recommended)

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
- [ ] Twilio: 5 dial DIDs purchased + 1 transfer-target DID purchased (6 total)
- [ ] Twilio: 10DLC campaign approved + active
- [ ] Retell: account active, BYO Twilio import verified, test outbound call successful
- [ ] Sendblue: account active, test iMessage + SMS fallback verified
- [ ] FTC DNC: telemarketer registration approved, 5-area-code subscription active
- [ ] Inngest: account active, project connected (preparatory; doesn't block Phase 1)
- [ ] (Optional) Webhook subdomain `dialer.triprosremodeling.com` resolving to Vercel
- [ ] (Recommended) TCPA attorney consult complete, opinion documented

---

## Secrets to assemble for Phase 1 handoff

Once Phase 0 is complete, the implementing session will need these secrets (collect into a `.env.local` or your secret manager, do NOT commit):

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TRUST_PROFILE_SID=BUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TRANSFER_TARGET_DID_SID=PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TRANSFER_TARGET_DID_E164=+1XXXXXXXXXX

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
