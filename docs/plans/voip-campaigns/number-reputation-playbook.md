# Number Reputation Playbook — Keeping CloudTalk DIDs Clean

> Research date: 2026-06-11. Adversarially-verified deep research (24 sources, 116 claims → 9 surviving findings) + detection-engine API research. Engine/carrier partnerships and portal URLs current as of June 2026 — these change; re-verify before relying on a URL.

## 1. How "Spam Likely" actually works

**Labels are NOT applied by carriers, and there is no single database.** Three independent analytics engines score every number, with **no data sharing between them**:

| Terminating network | Analytics engine | Label delivery |
|---|---|---|
| AT&T, Cricket, Samsung native dialer | **Hiya** | Device/app layer (ActiveArmor) |
| T-Mobile, Metro, Boost | **First Orion** | **Network-injected** — "Scam Likely" replaces caller name, shows even on flip phones / MVNOs |
| Verizon, US Cellular | **TNS Call Guardian** | Device/app layer (Call Filter) |

A number can be clean on two engines and flagged on the third. "Our 818s are spam likely" really means "flagged on at least one engine as seen on whoever's phone we checked" — diagnose per-engine.

**What triggers a flag (verified, incl. CloudTalk's own published thresholds):**
- Volume spikes on **new** numbers (a fresh number making hundreds of calls immediately is the classic signature)
- **Low answer rate** — "a very strong indicator of sales and telemarketing traffic"
- **Average call duration < ~45 seconds**
- High abandonment
- **Repeated unanswered reattempts to the same contacts** — CloudTalk says space reattempts **≥4 hours apart, max 2–3×/week per contact**
- Crowd complaint reports (call-blocking apps, carrier "report spam" buttons)
- STIR/SHAKEN attestation is a *layer underneath*: B-attestation makes engines warier, but **A-attestation does not prevent labels** — behavior dominates.

**Number reputation is inherited.** Recycled numbers carry the previous owner's complaint history per-engine.

## 2. Why 818 flagged and 661 not

**It is not attestation** — attestation level is uniform across a CloudTalk account (verified). The divergence is per-number reputation:
1. Most plausible: the 818s are **recycled with prior spam history** (818 = dense, heavily-churned LA inventory) — checkable per number via the engines' lookup/appeal channels.
2. And/or engine-specific behavioral scoring on whichever DIDs carried early volume.
3. "Area-code-level spam density" as a labeling input did **not** survive verification — don't over-index on choosing area codes; cleanliness of the specific number matters, not its prefix.

## 3. Our current state (audited 2026-06-11)

| Aspect | State |
|---|---|
| STIR/SHAKEN Verified Calling enrollment | **NOT done** → calls go out at default (B-level possible) |
| CNAM registration | **NOT done** for CloudTalk DIDs |
| Business-identity registration with the 3 engines (FCR) | **NOT done** — CloudTalk registers *its* ranges platform-wide, which is NOT the same as Tri Pros' identity on our DIDs |
| Cadence (`voip_campaigns.attemptsPerContact` / `hoursBetweenAttempts`) | **10 attempts @ 3 hours** — violates the ≥4h / 2–3×-week guidance; near-textbook spam signature on new numbers |
| Per-DID spam monitoring | **None** — EPIC.md C2 trigger ("spam-label rate climbs → new DID") exists on paper, nothing wired |
| DNC | Solid (`customers.dncOptedOutAt`, STOP handling) — keep as is |
| DID isolation (campaigns vs in-house Twilio) | Good — keep |
| Sticky DID per lead | Good — keep |

## 4. Remediation — flagged 818s (do once, now)

1. **Enroll CloudTalk STIR/SHAKEN Verified Calling** → ensured A-attestation + CNAM. Email CloudTalk numbering support with: legal business name, address, EIN, website, representative, call volume + use case. (help.cloudtalk.io article 10629456)
2. **Free Caller Registry** — freecallerregistry.com. One free submission (≤20 numbers individually) registers business identity with all three engines AND triggers re-evaluation of existing labels. Engines respond ~2 business days; re-evaluation takes longer. **Never pay a vendor just to register.** Also register at First Orion's calltransparency.com and Hiya Connect free registration (or via CloudTalk's free Hiya integration — gives a free Hiya reputation dashboard).
3. **Per-engine appeals for the flagged 818s:**
   - AT&T/Hiya: hiyahelp.zendesk.com/hc/en-us/requests/new (~1 week — the only verified timeline)
   - T-Mobile/First Orion: callreporting.t-mobile.com
   - Verizon/TNS: via FCR only. (The commonly-cited voicespamfeedback.com route was **refuted** — don't use.)
4. **Swap-don't-fight rule:** adds/removes are free. Any 818 still labeled ~2 weeks after appeal → release it, buy a replacement, register the replacement (FCR + Hiya + First Orion) **before its first dial**, then warm it up. Re-submitting the same number to FCR repeatedly does nothing (verified — Hiya says so explicitly).
5. Don't promise fixed remediation dates — beyond Hiya's ~1 week, all timeline claims were refuted or unverifiable. Confirm clearance empirically via monitoring (§6).

## 5. Prevention — operating rules

**Cadence (CloudTalk dashboard + `voip_campaigns` mirror):**
- Reattempt spacing ≥4h; effectively **2–3 attempts/week per contact**, not 10 in 30 hours. Lower `attemptsPerContact` and stretch the window (e.g., 6–8 attempts over 2–3 weeks).
- **Per-DID daily cap ~50 calls** sustained (industry folklore — no engine publishes a number — but consistent across practitioners and matches EPIC.md's C1 trigger). Spread volume across the pool.
- **Warm-up new DIDs:** ramp over ~2 weeks (e.g., 5–10/day → 20 → 50). Never let a fresh number do a full campaign day 1.
- Keep **avg call duration > 45s** on connects — script/VoiceAgent design matters; a connect that hangs up in 15s is a negative signal.
- Keep sticky-DID-per-lead (callbacks to a recognized number improve answer rate → improves reputation).
- Don't dial dead lists: lists with terrible answer rates poison whichever DID dials them.
- Calling hours discipline + DNC (already enforced).

## 6. Detection engine — "tell me immediately when a line is dirty"

There is **no free programmatic read-back of carrier labels** (verified). Twilio can't do it: Lookup v2 has no spam package; the v1 Nomorobo add-on is Nomorobo's own blocklist (wrong signal); Voice Integrity is remediation-only, monitoring "coming soon". Crowd-DB APIs (IPQS, TrueCNAM, RoboKiller, etc.) don't see Hiya/FO/TNS verdicts — weak proxies.

**Layered architecture (cheapest-fastest signal first):**

| Layer | Signal | Latency | Cost | Fidelity |
|---|---|---|---|---|
| **1. Behavioral monitor (build)** | Per-DID rolling answer rate + avg duration vs pool baseline, from our own CloudTalk `call.ended` webhooks | **Hours** | $0 | Proxy — detects the *effect* of a label on any carrier |
| **2. Telnyx Number Reputation API** | Hiya-powered `spam_risk` (low/med/high) + 4 sub-scores; `business_daily` auto re-check; programmatic remediation API. ⚠️ **CORRECTED 2026-06-11: only works on numbers in your own Telnyx inventory** (per `POST /v2/enterprises/{id}/reputation/numbers` in Telnyx's OpenAPI spec — the earlier "any US number" claim was wrong). To use with CloudTalk campaigns: own DIDs at Telnyx + present them via **CloudTalk Virtual Caller ID** (help.cloudtalk.io article 5726652 — verified external-number caller ID, no porting; inbound rings Telnyx → forward to CloudTalk) | ~1 day | Portal-priced (cheap per-number) | High for Hiya/AT&T; indirect for T-Mo/VZ |
| **3. Device-cloud audit** | Caller ID Reputation (calleridreputation.com) — real devices on all 3 carriers + blocking apps, JSON API, real-time alerts; ~$64/mo per 10 numbers (3rd-party figure, get a quote). Free spot-check: QVD caller-ID test (qualityvoicedata.com/caller-id-testing) | Near-real-time | ~$64/mo | **Ground truth, all 3 engines** |
| 4. (Optional) Numeracle add-on via CloudTalk | Engine-direct registration + monitoring console + auto-remediation; onboarding 15–21 days | Console | Quote | Highest, but heaviest |

**Layer-1 quarantine rule (synthesized default — tune with data):** over the last 30–50 dials, quarantine a DID when its answer rate falls below **~50–60% of the pool's same-day average** AND its avg connect duration also drops. Practitioner data: a freshly-flagged number's answer rate drops 20–50% overnight; ~95% of labeled calls go unanswered.

**Quarantine action (wires EPIC.md's C2 trigger):** pull DID from campaign rotation → run Telnyx + device-cloud check → if confirmed dirty: appeal (per §4), swap in a pre-warmed registered spare, release the dirty DID if it doesn't clear in ~2 weeks. Keep 1–2 registered, warmed **spare DIDs** on the shelf at all times.

**On the "list of numbers that never pick up" canary idea — inverted, it's better:** dialing numbers that never answer *generates the exact signal that causes labels* (short/unanswered calls). The correct canary design is the opposite:
- **T-Mobile SIM canary is the one DIY worth prototyping**: First Orion's label is network-injected as the caller-name string, so a custom default-dialer app on a cheap T-Mobile prepaid Android can read "Scam Likely" directly from `Call.Details` on an incoming call. No documented prior art — prototype, not established practice. (~$10–15/mo SIM.)
- AT&T/Verizon labels live in the preinstalled apps → only readable via screen-scrape/OCR — brittle, skip; that's what the device-cloud vendor is for.
- Canary calls must be few (1–2/day/DID) and should be **answered for >45s** (auto-answer app) so the canary traffic *helps* reputation instead of hurting it.

## 7. Concrete thresholds (quick reference)

| Metric | Target |
|---|---|
| Avg connect duration | > 45 s |
| Reattempt spacing | ≥ 4 h; 2–3×/week per contact |
| Attempts per lead | 6–8 over 2–3 weeks (not 10 over 30 h) |
| Per-DID daily dials | ≤ ~50 sustained (folklore; matches C1) |
| New-DID warm-up | ~2-week ramp: 5–10 → 20 → 50/day |
| Quarantine trigger | DID answer rate < 50–60% of pool avg over last 30–50 dials + duration drop |
| Spare DIDs | 1–2 registered + warmed, always |
| Pre-first-dial checklist (every new DID) | FCR + First Orion + Hiya registration, CNAM via Verified Calling, warm-up plan, baseline reputation check |

## 7.5 Telnyx Number Reputation — verified API surface (OpenAPI spec, 2026-06-11)

All under `https://api.telnyx.com`. Requires a **verified or enterprise-level** Telnyx account (trial/standard cannot access). Order:

1. `POST /v2/terms_of_service/number_reputation/agree` (idempotent, prerequisite for all reputation endpoints)
2. `POST /v2/enterprises` — legal_name, organization_type, country_code, fein (`XX-XXXXXXX`), industry, number_of_employees, organization_legal_type, jurisdiction_of_incorporation, organization_contact, billing_contact, both addresses → `enterprise_id`
3. `POST /v2/enterprises/{id}/reputation/loa` — renders LOA PDF (free; can embed `signature.image_base64` + `signer_name` at render time)
4. `POST /v2/documents` (multipart file upload of signed PDF) → `loa_document_id`
5. `POST /v2/enterprises/{id}/reputation` — `{loa_document_id, check_frequency}` (billable). `check_frequency`: business_daily | daily | weekly | biweekly | monthly | never
6. `GET /v2/enterprises/{id}/reputation` — poll until `status` AND `loa_status` = approved
7. `POST /v2/enterprises/{id}/reputation/numbers` — `{phone_numbers: [...]}`, ≤100, atomic, E.164, **must be in your Telnyx inventory** (billable)
8. Read: `GET /v2/reputation/numbers` (cross-enterprise alias, cached = free) → `spam_risk` (low/medium/high), `spam_category`, maturity/connection/engagement/sentiment scores (0–100), `last_refreshed_at`
9. `POST /v2/enterprises/{id}/reputation/numbers/refresh` — forced live lookup, ≤100, billable
10. **Remediation API**: `POST /v2/enterprises/{id}/reputation/remediation` — `{phone_numbers, call_purpose, contact_email, webhook_url}` → 202 async, poll `GET .../remediation/{id}` or receive webhook. Programmatic dispute submission.

**Architecture implication**: a fully-programmatic monitor+remediate engine requires the DIDs to live at Telnyx. Hybrid: Telnyx-owned DIDs presented through CloudTalk Virtual Caller ID (ownership verified, no porting; outbound billed per-minute/package; inbound + callbacks ring at Telnyx → set up Telnyx forwarding to CloudTalk). Open question: does CloudTalk Verified Calling A-attestation extend to Virtual Caller IDs? Ask CloudTalk before committing.

## 8. Open questions

- Are the specific 818s recycled with prior history? (Per-number lookups against each engine will tell.)
- Does CloudTalk's Verified Calling attach *Tri Pros'* identity per-DID, or only CloudTalk's ranges? (Ask CloudTalk support; this determines whether the Numeracle add-on is needed for true branded treatment.)
- Telnyx Number Reputation + Caller ID Reputation actual pricing (both quote/portal-gated).
- Direct TNS/Verizon dispute channel beyond FCR — none verified.

## Key sources

- CloudTalk: help articles 8001383 (why labeled), 10872226 (how CT protects), 10629456 (STIR/SHAKEN enrollment), 11461699 (Numeracle add-on), 10558452 (Hiya Connect)
- freecallerregistry.com · calltransparency.com · hiya.com/products/connect/number-registration
- Appeals: hiyahelp.zendesk.com · callreporting.t-mobile.com
- Detection: developers.telnyx.com/docs/branded-calling/number-reputation · calleridreputation.com · qualityvoicedata.com/caller-id-testing
- Android: developer.android.com CallScreeningService / getCallerNumberVerificationStatus (STIR verdict only — no spam-label API)
