# Phase 0 — CloudTalk Procurement + Dashboard Configuration

> **Parent EPIC:** [EPIC.md](./EPIC.md)
> **API foundation:** [cloudtalk-api-research.md](./cloudtalk-api-research.md)
> **Integration contract:** [../voip/INTEGRATION-SEAM.md](../voip/INTEGRATION-SEAM.md)
> **Status:** Not started
> **For agentic workers:** This phase is **mostly manual/external** — CloudTalk account signup, dashboard configuration, design iteration with the user. Small code in tasks 8-9 (env var scaffolding + webhook route skeleton). Heavy use of CloudTalk dashboard screenshots; user will walk through each section together.

**Goal:** Complete all CloudTalk-side setup (account, DIDs, AI VoiceAgent, Campaign, webhooks, API keys, dashboard configuration) so that voip-campaigns Phase 1 code can integrate against a real, configured CloudTalk environment.

**Gate to Phase 1:** All checklist items below complete + voip-in-house Phase 1 shipped (in-house DIDs + voip routing infrastructure exist as warm-transfer targets and gate sources).

---

## Why Phase 0 exists separately

CloudTalk setup is mostly dashboard work + a small amount of webhook security/networking. The user and I will walk through it together using screenshots — analogous to how the deferred Twilio Phase 0 walked through Trust Hub + 10DLC + Elastic SIP Trunk + Retell SIP origination. Some discovery happens here that informs Phase 1 (e.g., webhook IP ranges, transfer mechanics, Conversation Intelligence envelope shape).

---

## Phase 0 gate (must all be true to start Phase 1)

- ✅ CloudTalk account active + payment method on file
- ✅ API key generated + saved
- ✅ 3 campaign DIDs purchased + labeled
- ✅ At least 1 AI VoiceAgent configured + tested
- ✅ At least 1 Campaign configured + tested
- ✅ Webhook URL configured + verified + secret in env
- ✅ All Call Flow HTTP Request actions have fallback branches (**mandatory**)
- ✅ Env vars in `.env.local` + `.env.example`
- ✅ Webhook route + voip routing route skeletons in place
- ✅ End-to-end test call succeeded (AI dial, transfer, webhook receipt, voip routing endpoint hit)
- ✅ Open questions documented in `cloudtalk-api-research.md`

---

## Tasks

### Task 1: CloudTalk account setup

**Owner:** User
**Estimated effort:** 30 min

- [ ] Sign up at https://my.cloudtalk.io/
- [ ] Choose plan tier (recommend evaluating against estimated monthly volume — Phase 1 pilot is small; consider starting on the Essential or Starter tier)
- [ ] Add payment method
- [ ] Verify account email + business identity

### Task 2: API key generation

**Owner:** User
**Estimated effort:** 5 min

- [x] In dashboard → **Account → Settings → API keys**
- [x] Generate a key with full access (CloudTalk only has account-wide keys; no scoping)
- [x] **Record the Access Key ID + Secret** — these are wired to `CLOUDTALK_ACCESS_KEY_ID` + `CLOUDTALK_ACCESS_KEY_SECRET` env vars (matches CloudTalk's dashboard labels + AWS S3 pattern)
- [x] Treat as high-privilege secret — store in `.env`, NEVER commit (`.env*` is gitignored; `.env.voip.example` documents the keys with placeholders)

### Task 3: DID procurement (campaign pool)

**Owner:** User + agent (recommend area codes)
**Estimated effort:** 30 min — 1 hour

Purchase a small starter pool of DIDs in CloudTalk dashboard. These are **burnable** — they will get spam-labeled over time as campaign volume ramps; we rotate as needed. Keep them isolated from in-house DIDs (which live in Twilio + are reputation-protected).

- [ ] Purchase **3 starter DIDs** (expand to 7-10 once campaign launches at scale)
- [ ] Area codes: SoCal-aligned (310, 213, 818, 949, 626) — **must be different from voip-in-house pool** to avoid pool contamination
- [ ] Capabilities: Voice + SMS
- [ ] Cost: per CloudTalk's number pricing (verify during signup)
- [ ] Tag/label each DID in CloudTalk as `campaign-pool-{n}`

### Task 4: AI VoiceAgent configuration

**Owner:** User + agent (collaborative — we'll walk through together using dashboard screenshots)
**Estimated effort:** 2-4 hours (significant design work — iterate on prompts)

CloudTalk's VoiceAgent uses a different host (`platform-api.cloudtalk.io`). Configure via dashboard.

- [ ] Create one VoiceAgent per lead source (start with the highest-volume source; expand as more sources onboard)
- [ ] Per agent, configure:
  - **Greeting** — owner-managed; we'll draft together based on per-source consent context
  - **System prompt** — interest-confirmation + warm-transfer flow per [INTEGRATION-SEAM.md §1](../voip/INTEGRATION-SEAM.md)
  - **Voice selection** — pick a natural-sounding voice; we'll test
  - **Voicemail detection + drop message** — drop short opt-out-friendly message
  - **Disposition vocabulary** — `live_transferred`, `live_callback_scheduled`, `live_not_interested`, `opt_out`, `wrong_number`, `voicemail`, `no_answer`
- [ ] Test each agent with a test call to your own cell

### Task 5: Campaign configuration

**Owner:** User + agent
**Estimated effort:** 1-2 hours per lead source

For each lead source we want to convert via CloudTalk:

- [ ] Create a Campaign in dashboard
- [ ] Configure contact list source: **manual API enrollment** (our app pushes contacts)
- [ ] Cadence: per-lead-source design (e.g., Day 1 → 3 attempts; Day 2 → 2 attempts; Day 3 → 1 attempt + final SMS; archive after Day 4)
- [ ] Calling hours: per lead's local TZ (CloudTalk handles via DID area-code matching OR via our pushed `local_tz` contact attribute — test which CloudTalk supports)
- [ ] Calling days: Mon-Sat (no Sunday in pilot)
- [ ] DID pool: assign the campaign pool from Task 3
- [ ] AI VoiceAgent: link to the agent from Task 4
- [ ] SMS templates with merge fields (`{{first_name}}`, `{{zip}}`, `{{primary_trade}}`, `{{lead_source_label}}`)
- [ ] Disposition outcome routing — link `live_transferred` disposition to fire HTTP Request → voip routing transfer-target endpoint
- [ ] Test with a manually-added test contact

### Task 6: Webhook configuration

**Owner:** User + agent
**Estimated effort:** 30 min + back-and-forth with CloudTalk support

- [ ] In dashboard → **Account → Integrations → Webhooks**
- [ ] Configure single webhook URL: `https://voip.triprosremodeling.com/api/webhooks/cloudtalk?secret=<long-random>` — matches the `api/webhooks/<provider>/` convention used by `bina/`, `quickbooks/`, `zoho-sign/`. Per `docs/codebase-conventions/webhook-routes.md`, this is **the only URL CloudTalk fires to**; the route handler switches on event-type internally.
- [ ] Generate a `CLOUDTALK_WEBHOOK_SECRET` env var (long-random; rotate quarterly)
- [ ] Subscribe to all 6 documented events: `call.started`, `call.answered`, `call.ended`, `call.missed`, `voicemail.received`, `sms.received`
- [ ] **Confirm with CloudTalk support: do they publish static webhook IPs?** If yes, add IP allowlist at Vercel edge (env var `CLOUDTALK_WEBHOOK_IP_ALLOWLIST`)
- [ ] **Confirm with CloudTalk support: do they support custom request headers on webhooks?** If yes, switch from query-string secret to header secret (less log leakage)
- [ ] Test webhook delivery by triggering a test call

### Task 7: Call Flow Designer — voip routing endpoints + fallback branches (MANDATORY)

**Owner:** User + agent
**Estimated effort:** 1-2 hours

**This is a MANDATORY checklist item.** Every Call Flow that uses HTTP Request must have a configured fallback branch. Document the configurations as screenshots in this Phase 0 doc.

For each VoiceAgent's Call Flow that uses HTTP Request actions:

- [ ] **Caller-ID lookup** HTTP Request → `https://voip.triprosremodeling.com/api/voip/routing/caller-lookup`
  - Method: POST; payload: `{ caller_e164 }`
  - Timeout: 5 seconds (within CloudTalk dashboard default)
  - **Fallback branch: if HTTP fails or times out → play generic greeting, no screen-pop**
- [ ] **Warm-transfer target lookup** HTTP Request → `https://voip.triprosremodeling.com/api/voip/routing/transfer-target`
  - Method: POST; payload: `{ caller_e164, customer_id }`
  - Timeout: 5 seconds
  - **Fallback branch: if HTTP fails or returns `target_e164: null` → AI says "I'll have someone call you back", logs a callback request via webhook event**
- [ ] **Compliance double-gate** (optional belt-and-suspenders) HTTP Request → `https://voip.triprosremodeling.com/api/voip/routing/compliance-check`
  - Method: POST; payload: `{ customer_id, phone_e164 }`
  - **Fallback branch: if HTTP fails, treat as allowed (app-side gate is canonical; this is defense-in-depth only)**

### Task 8: env var scaffolding + webhook route skeleton (code)

**Owner:** Agent
**Estimated effort:** 30-60 min

- [x] Add to `.env`:
  ```
  CLOUDTALK_ACCESS_KEY_ID=...
  CLOUDTALK_ACCESS_KEY_SECRET=...
  CLOUDTALK_WEBHOOK_SECRET=...
  CLOUDTALK_WEBHOOK_IP_ALLOWLIST=...                # if applicable
  VOIP_WEBHOOK_BASE_URL=https://voip.triprosremodeling.com
  CLOUDTALK_PHASE0_TRANSFER_TARGET_E164=            # smoke-test mock target (Oliver's cell for Phase 0)
  ```
- [x] Create `.env.voip.example` (committed past the `.env*` gitignore via force-add, mirrors `.env.meta.example` convention) with placeholder keys
- [ ] Create `src/app/api/webhooks/cloudtalk/route.ts` — **the route handler IS the orchestrator** (per `docs/codebase-conventions/webhook-routes.md`): secret-verify → parse event-type → switch → call into existing `services/voip/*` services → 200 OK. Phase 0 scaffolds with logging-only switch arms; real per-event orchestration lands in Phase 1.
- [ ] Create the 3 voip routing route skeletons under `src/app/api/voip/routing/{caller-lookup,transfer-target,compliance-check}/route.ts` returning **mocked** responses (per Task 9 note). Real impls land in voip-in-house Phase 1. `transfer-target` returns `{ target_e164: process.env.CLOUDTALK_PHASE0_TRANSFER_TARGET_E164, warm_intro: "..." }`.
- [ ] Verify webhook deliverability by triggering a CloudTalk test call + checking logs

### Task 9: End-to-end smoke test

**Owner:** User + agent
**Estimated effort:** 1 hour

**Mock transfer target for Phase 0:** Oliver's cell (the dev). Wire as `CLOUDTALK_PHASE0_TRANSFER_TARGET_E164` in `.env`. The mocked `/api/voip/routing/transfer-target` returns that E.164 so the AI's transfer actually dials a real phone — this validates CloudTalk's transfer mechanic (open question: SIP REFER vs DID re-dial) + caller-ID behavior during transfer (does the lead see the campaign DID throughout, or briefly Oliver's number?). In Phase 1 the mock is replaced with the real Twilio in-house DID lookup.

- [ ] Manually add a test contact in CloudTalk dashboard (Ophir Test already created — reuse) with a controllable phone as `phone`
- [ ] Confirm the contact has the `Lead` tag so the Campaign's tag rule picks it up (Campaign already configured to enroll on `Lead` tag)
- [ ] Wait for AI to call the test contact
- [ ] Verify: AI speaks, voicemail detection works, the test contact can interact with the AI
- [ ] Test warm-transfer — AI transfers to Oliver's cell (via the mocked voip routing `transfer-target` endpoint)
- [ ] **Observe and record** (these feed Task 10):
  - How does CloudTalk execute the transfer? SIP REFER (one continuous leg) or DID re-dial (two legs, brief tone)?
  - What caller-ID does the lead see during the transfer? Campaign DID throughout (good) or briefly Oliver's number (bad — privacy goal violated)?
  - Are both call legs in CloudTalk's recording, or only the AI portion?
- [ ] Verify webhook events fire to `https://voip.triprosremodeling.com/api/webhooks/cloudtalk?secret=...` (check logs for `call.started`, `call.answered`, `call.ended`)
- [ ] Verify voip routing endpoints get called (check logs for `/api/voip/routing/caller-lookup` + `/api/voip/routing/transfer-target` POST) — **note: voip routing endpoint impls land in voip-in-house Phase 1; for Phase 0 smoke test, route skeletons return mocked responses**
- [ ] Test STOP reply → CloudTalk auto-honors + fires `sms.received` webhook

### Task 10: Document open questions resolved during Phase 0

- [ ] CloudTalk webhook IP ranges — write findings into [cloudtalk-api-research.md](./cloudtalk-api-research.md)
- [ ] Conversation Intelligence webhook envelope shape — write findings into `cloudtalk-api-research.md`
- [ ] AI VoiceAgent transfer mechanics (SIP REFER vs DID re-dial) — write findings into `cloudtalk-api-research.md`
- [ ] Recording retention policy — write findings into [EPIC.md](./EPIC.md) "Open questions"

---

## Secrets to assemble for Phase 1 handoff

Once Phase 0 is complete, the implementing session will need these secrets:

```bash
# CloudTalk (HTTP Basic auth — ID is username, Secret is password)
CLOUDTALK_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLOUDTALK_ACCESS_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLOUDTALK_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLOUDTALK_WEBHOOK_IP_ALLOWLIST=...                # if applicable

# Shared VoIP base URL
VOIP_WEBHOOK_BASE_URL=https://voip.triprosremodeling.com

# Phase 0 only — mocked transfer-target endpoint returns this E.164 for the smoke test
CLOUDTALK_PHASE0_TRANSFER_TARGET_E164=+1XXXXXXXXXX  # Oliver's cell during Phase 0
```

---

## When Phase 0 is complete

Update [EPIC.md](./EPIC.md) phase status table → Phase 0 "Done". Phase 1 (app-side integration MVP) can begin once **voip-in-house Phase 1 is also complete** (voip routing endpoint impls are voip-in-house's responsibility).

Then move to phase-1-mvp.md (to be written) for implementation.
