# Per-Lead-Source Content — SMS / VM / Agent Script Library

> **What this doc is:** trust-maintenance content library for outbound voip-campaigns Campaigns. Every CloudTalk Campaign sends SMS + drops voicemail + runs an agent-opener script. Each lead source has its own voice/persona that MUST stay consistent with the upstream funnel (ad creative → PII form → thank-you page) — otherwise the lead loses trust and won't pick up or call back.
>
> **Why this lives in-app-docs (not CT Knowledgebase):** content is owned + maintained by Tri Pros leadership; CT is just the delivery mechanism. CT-side Knowledgebase activation is deferred to [issue #238](https://github.com/OlisDevSpot/tri-pros-website/issues/238). This doc is the canonical source for the human-curated content that will eventually seed CT after #238's activation trigger fires.
>
> **Parent EPIC:** [EPIC.md](./EPIC.md) — locked decisions log entry 2026-05-28 Q9.A.2 (content + trust-maintenance).

---

## Foundational rule (LOCKED 2026-05-28)

**Trust = consistency from the very first impression.** Every touchpoint (ad → form → thank-you page → SMS → VM → agent intro) MUST maintain the same voice/persona. The lead's mental model of "who is contacting me and why" was set by the upstream funnel — breaking that model at SMS/call time evaporates trust.

- **Trust lost** = no answer, no callback, lead exhausts the cadence to no avail.
- **Trust maintained + hook** = many appointments (the ultimate goal of voip-campaigns).

This rule applies to **every lead source we ever onboard**. No exceptions.

**Pre-our-touchpoints (ad creative, PII form, thank-you page) are NOT our responsibility** — Bina (or future provider) owns those. Our responsibility starts at the SMS / VM / call layer. But we MUST receive enough context from the upstream funnel to maintain consistency on our side.

### The Program ↔ Tri Pros bridge — when company identity reveals

The lead's first impression is the Program (e.g., "Palmdale Windows Residential Assistance Program") — that's what they remember from the form they filled. Tri Pros Remodeling is the company delivering the Program; this identity reveals **naturally and progressively** through the touchpoint sequence — never abruptly.

**The reveal staircase** (LOCKED 2026-05-29):

| Touchpoint | Identity used | Reveal posture |
|---|---|---|
| Opener SMS | Program voice only | Program-framing maximally maintained |
| Outbound VM drop | Program voice only | Lead may listen multiple times; stay Program-only |
| Mid-cadence nudge SMS | Program voice only | Maintain trust momentum |
| Inbound VM greeting (lead calls us) | **"Residential Programs line by Tri Pros"** ← THE BRIDGE | Lead initiated contact = warm moment to bridge Program → Company |
| Agent opener (connected call, first 30s) | Program voice ("...the {{city}} {{primary_trade_label}} Residential Assistance Program") | Program-framing maintained for opener |
| Agent body (post-opener) | **Tri Pros revealed naturally** ("...and the Program is delivered by Tri Pros Remodeling, a licensed local contractor") | Body-of-conversation reveal once rapport established |
| Final SMS (Day 10 terminal) | Program voice only | No reveal needed for closeout |

**Why this works:** the Inbound VM greeting is the FIRST moment the lead hears "Tri Pros" — and it's at a moment where THEY chose to call US (warm intent). The bridge happens at a trust-positive moment, not a defensive moment.

**What this prevents:** the cold-reveal failure mode where SMS or outbound-VM leads with "Hi, I'm calling from Tri Pros Remodeling" — the lead's mental model says "I filled out a Program form, who is Tri Pros, why are they calling me?" Trust evaporates.

---

## Bina (Meta Ads) — "The Program" framing

### Persona

`{{city}} {{primary_trade_label}} Residential Assistance Program` — local, government-program-adjacent framing. **NOT "Tri Pros Remodeling" directly to the lead** in initial touchpoints.

**Examples:**
- `Palmdale Windows Residential Assistance Program`
- `Lancaster Roofing Residential Assistance Program`
- `Bakersfield Landscape Residential Assistance Program`

### Upstream funnel context (Bina-owned)

- Meta Ads creative positions the offer as a local-area residential assistance program for trade X
- Form captures: PII (name, phone, address, zip) + trades interested (multi-select) + sometimes preferred appointment time
- Thank-you page sets the expectation: "we'll reach out shortly"

### Our touchpoints (where trust-maintenance is enforced)

#### Opener SMS (sticky DID A, on enrollment)

> Hi {{first_name}}, this is Oliver with the {{city}} {{primary_trade_label}} Residential Assistance Program. We received your inquiry about {{primary_trade_label}}. I'll be reaching out shortly — feel free to call/text back at this number if it's a good time.

#### Outbound voicemail drop (DID A, attempts 1 + 3 only — pre-recorded, we drop on no-answer)

> Hi {{first_name}}, this is Oliver with the {{city}} {{primary_trade_label}} Residential Assistance Program. We got your inquiry about {{primary_trade_label}}. Give me a call back when you have a minute — same number. Thanks!

**Note:** outbound VM stays in Program voice (no Tri Pros reveal). The Tri Pros bridge happens on inbound VM greeting (when lead calls us back) — see Foundational rule → "The Program ↔ Tri Pros bridge" above.

#### Agent opener — Oliver / Sean's first words on connected call

> Hi, is this {{first_name}}? Hey, this is Oliver with the {{city}} {{primary_trade_label}} Residential Assistance Program — just calling to follow up on the inquiry you submitted about {{primary_trade_label}}.

#### Mid-cadence nudge SMS (DID A, ~Day 1)

> Hi {{first_name}}, just following up on your {{primary_trade_label}} inquiry from the {{city}} Residential Assistance Program. Best time to chat?

#### Final SMS (DID A, Day 10 terminal)

> Hi {{first_name}}, last note from the {{city}} {{primary_trade_label}} Residential Assistance Program — feel free to reach back out anytime if you'd still like to discuss your project. Thanks!

### Key trust-maintenance rules — Bina

- **NEVER lead with "Tri Pros Remodeling"** in the first 30 seconds of any touchpoint. The lead doesn't know that name yet; introducing it cold breaks consistency with the form they filled.
- **Tri Pros Remodeling identity is introduced naturally** once the conversation is going (e.g., "...and the Program is delivered by Tri Pros Remodeling, a licensed local contractor").
- **City + Trade are templated per-lead** based on the lead's `zip` (via city lookup) + `primary_trade_label` fields synced to CT.
- **Voice = warm, professional, and confident.** Lead is responding to a passive-interest form fill. Stay personable and ally-like (not aggressive), BUT — ⚠️ **UPDATED 2026-06-11:** the earlier "no urgency / no scarcity" rule is **retired for the live human booking call.** Scarcity is now a deliberate, central lever on the connected agent call (crew-in-the-area capacity + neighbors filling spots fast + "before the window closes"). The full scarcity framing and how to deploy it without sounding pushy is canonized in [energy-bina-booking-call-script.md](./energy-bina-booking-call-script.md). Keep automated/early SMS + VM touchpoints lighter; reserve the strongest scarcity for the live conversation.
- **Multi-trade leads** (form submitted multiple trades): use the primary/highest-margin trade for `{{primary_trade_label}}` substitution. Other trades surfaced naturally during conversation.
- **Address-already-provided leads:** acknowledge it briefly in the agent opener to reinforce that the form data came through ("...and we have your address as 123 Main St, that's correct?") — builds trust the system is working.

## Inbound VM greeting — Shared across all sources / all DIDs (static, no templating)

**LOCKED 2026-05-29 (Q10.4):** the inbound VM greeting plays when a lead calls one of our CT DIDs outside business hours, on a holiday, or when no agent picks up. It's STATIC per DID (no per-lead templating — caller-lookup hasn't run yet at greeting playback time). Single greeting works across all DIDs because the trust-maintenance principle of "Residential Programs by Tri Pros" applies regardless of which Program brought the lead in.

**Script:**

> Hi, you've reached the Residential Programs line by Tri Pros. We're not available right now — please leave your name and the best time to reach you, and we'll call you back as soon as possible. Thanks!

**Why this script works:**
- Establishes the **Program ↔ Tri Pros bridge** in a lead-initiated (warm) moment
- Lead recognizes "Residential Programs" from their form-fill memory → confirms they reached the right place
- "by Tri Pros" reveals the operating company without ambush — natural, professional, factual
- Short (≤8 seconds spoken at conversational pace) — respects the lead's time
- Action-oriented: tells lead exactly what to leave + sets callback expectation

**Phase 0 verification items:**
- CT supports per-account or per-Campaign inbound VM greeting upload? Per-DID custom greetings if needed for future per-source variants?
- VM length limit? (Some VoIP providers cap at 30s for inbound greetings.)
- Audio format requirements (MP3, WAV)?

**Future enhancements (deferred):**
- Per-DID greeting variants if we observe greeting genericness hurting callback conversion
- Multilingual variants (Spanish-language version for SoCal Hispanic market — voip-campaigns Phase 2+)
- Holiday-specific greeting auto-rotated by CT on calendar days (e.g., "Happy holidays from Tri Pros — we'll be back Monday")

---

### Required CT contact attributes for Bina (corrected 2026-05-31)

`enrollment.service.ts` syncs these fields to CT contacts. **3 custom attributes + CT built-ins (name + city). Templates use `{{first_name}}`, `{{city}}`, `{{primary_trade}}` merge fields.**

| CT Title | App field | Source | Merge syntax | Purpose |
|---|---|---|---|---|
| (built-in) `name` | n/a | `customers.name` (`${firstName} ${lastName}`.trim()) | `{{first_name}}` / `{{last_name}}` (subject to V1 verification) | CT first-class field |
| (built-in) `city` | n/a | derived from `customers.zip` | `{{city}}` (subject to V1 verification) | CT first-class field |
| `Lead Source` | `lead_source` | `lead_sources.slug` (`'bina'`) | not used in templates | Analytics + segmentation |
| `Primary Trade` | `primary_trade` | First entry of `customers.tradesInterested`, mapped to human label via `trades` table | `{{primary_trade}}` | Template substitution + agent context |
| `Trades Interested` | `trades_interested` | Comma-separated trade accessors, alpha-sorted, deduped; empty string when unknown | not used in templates | Agent visibility in CT dashboard |

**Phone (`{{phone_e164}}`-equivalent)** — set via CT's built-in `phone` field on Contact, not as a custom attribute. CT's PK.

**V1 verification PENDING** (per [HANDOFF-2026-06-01.md](./HANDOFF-2026-06-01.md)): confirm CT's template engine merges `{{first_name}}` / `{{city}}` against the built-in `Contact.first_name` / `Contact.city` fields (NOT custom attributes). If verification fails, add custom `First Name` / `Last Name` / `City` attributes; update this table.

**Dropped from prior plans (2026-05-31):**
- ~~custom `first_name` / `last_name` / `city`~~ — using CT built-ins instead (subject to V1)
- ~~`program_name`, `program_offer`~~ — "Residential Assistance Program" is literal template text, not a merge field
- ~~`phone_e164` / `zip` / `lead_source_label` as custom attrs~~ — phone is CT-native; zip drives city derivation; lead_source maps to `Lead Source` attribute above

---

## Home Depot — Home Depot Pros approved-contractor framing

### Persona

**Tri Pros + Home Depot endorsement as a unit.** Unlike Bina (where Tri Pros is hidden behind the Program), HD leads KNOW a contractor is calling — they signed up for one. The trust posture differs:

- HD leads have **already accepted contractor contact** (signup signals consent + readiness)
- Home Depot's brand IS the trust anchor (we borrow credibility from HD's reputation)
- **We're 1 of 5 approved contractors** offered to the homeowner — competitive context is real
- Speed-to-first-touch is a differentiator (race to be first responder)

Tri Pros can therefore be revealed EARLY in HD touchpoints (the opener — not held back like Bina's reveal staircase). Home Depot's endorsement comes WITH the introduction.

### Upstream funnel context (Home Depot-owned)

- Homeowner submits a project request at Home Depot store / in-app / online → "I want a quote on [trade] for my home"
- Home Depot Pros routes the request to up to 5 approved contractors in the homeowner's area
- Tri Pros is one of those 5; gets the lead via Home Depot's referral feed
- Homeowner expects: contractor outreach within a day, comparable quotes, clear differentiation

### Our touchpoints (where trust-maintenance is enforced)

#### Opener SMS (sticky DID A, on enrollment)

> Hi {{first_name}}, this is Oliver with Tri Pros — one of the Home Depot Pros approved contractors for your {{primary_trade_label}} project. I'll be reaching out shortly. Feel free to call or text back at this number anytime.

#### Outbound voicemail drop (DID A, attempts 1 + 3 only)

> Hi {{first_name}}, this is Oliver with Tri Pros — Home Depot connected us with your {{primary_trade_label}} project request. Give me a call back when you have a minute — same number. Thanks!

#### Agent opener — Oliver / Sean's first words on connected call

> Hi, is this {{first_name}}? Hey, this is Oliver with Tri Pros — Home Depot Pros connected us with your {{primary_trade_label}} project. Wanted to give you a quick call and see how we can help you out.

#### Mid-cadence nudge SMS (DID A, ~Day 1)

> Hi {{first_name}}, Oliver from Tri Pros following up on your {{primary_trade_label}} project — we're one of Home Depot's approved contractors. Best time to chat?

#### Final SMS (DID A, Day 10 terminal)

> Hi {{first_name}}, last note from Tri Pros (your Home Depot Pros referral for {{primary_trade_label}}) — reach out anytime if you'd still like to discuss your project. Thanks!

#### Inbound VM greeting

**Same shared greeting as Bina** ("Hi, you've reached the Residential Programs line by Tri Pros..."). The reveal-staircase principle still applies: this is a moment where the lead chose to call us back, warm-intent. The greeting doesn't need HD-specific branding since the lead's mental model at callback time is "I'm calling that contractor" — Tri Pros identity is what they expect to hear.

### Key trust-maintenance rules — Home Depot

- **Lead with Tri Pros + Home Depot endorsement as a unit.** Both names in the first sentence of opener SMS / agent opener. The endorsement is the credential.
- **Acknowledge the 1-of-5 reality if it surfaces naturally** — homeowners often mention "I'm getting other quotes too." Don't pretend it's not happening. Differentiate via quality + responsiveness, NOT pricing pressure or speed-shaming the others.
- **Speed = the differentiator we can control.** Be the first responder. If we reach out within 30 min of Home Depot pushing the lead, that's the strongest signal we can send. Hence: AUTO-enroll is the right call if HD data quality holds (but per Q9.F lock, HD goes through MANUAL admin review Phase 1 — see Phase 1 ramp note below).
- **Do NOT disparage other approved contractors.** Home Depot vetted all 5; speaking poorly of them implicitly questions Home Depot's vetting → erodes the trust source we're standing on.
- **Voice = warm, confident, "your approved contractor."** Slightly more direct than Bina (HD leads expect contractor energy, not delicate-first-contact-with-cold-lead energy).
- **Don't over-invoke Home Depot.** "Home Depot Pros" in opener + "one of Home Depot's approved" once mid-conversation = enough. Repeating "Home Depot" every sentence sounds like name-dropping; weakens credibility.
- **Project-specific framing.** HD leads submitted a SPECIFIC project (not a general program inquiry). The opener references "your {{primary_trade_label}} project" — not "your interest in {{primary_trade_label}}". The lead is past interest; they're at "let's get this done." Match their energy.

### Phase 1 ramp note on HD MANUAL gate

Per Q9.F lock, HD intake goes through admin manual review before CT push. **Operational risk:** speed-to-first-touch is HD's competitive differentiator; manual review introduces hours of delay. **Recommendation: target sub-1-hour manual-review SLA on HD leads during Phase 1 launch.** If HD data quality proves reliable across the first 50-100 reviewed leads, migrate HD to AUTO-enroll in Phase 1.x. Surface this metric on admin dashboard (mean + p95 review-to-enrollment latency, broken down by lead source).

### Required CT contact attributes for Home Depot (corrected 2026-05-31)

**Same Phase 1 attribute set as Bina.** No HD-specific custom attributes for templating — "Home Depot Pros" / "Home Depot" appear as literal template text in the HD SMS / VM / agent-opener scripts above, not as merge fields.

| CT Title | App field | Source | Merge syntax | Purpose |
|---|---|---|---|---|
| (built-in) `name` | n/a | `customers.name` | `{{first_name}}` / `{{last_name}}` (V1 pending) | CT first-class field |
| (built-in) `city` | n/a | derived from `customers.zip` | `{{city}}` (V1 pending; HD templates don't actually use `{{city}}`) | CT first-class field |
| `Lead Source` | `lead_source` | `lead_sources.slug` (`'home_depot'`) | not used in templates | Analytics + segmentation |
| `Primary Trade` | `primary_trade` | First entry of `customers.tradesInterested`, mapped to human label | `{{primary_trade}}` | Template substitution + agent context |
| `Trades Interested` | `trades_interested` | Comma-separated trade accessors, alpha-sorted, deduped | not used in templates | Agent visibility in CT dashboard |

**Dropped from prior plans (2026-05-31):**
- ~~custom `hd_endorser` / `hd_project_label`~~ — endorser is literal template text; project label duplicates `primary_trade`

**HD analytics-only attributes** (`home_depot_request_id`, `home_depot_referral_date`, `home_depot_competitor_count`) — **DEFERRED Phase 2.** Capture from HD webhook payload into the HD intake normalizer, persist in our DB / Notion CRM mirror, but do not sync to CT custom attributes until Phase 2 (when HD-specific analytics dashboards are designed).

---

## Future sources

When new lead sources come on (Thumbtack, Google, organic referral, etc.), add a new section here following the same structure:

1. **Persona / framing** — what voice does the lead expect?
2. **Upstream funnel context** — what did the lead see/do before our touchpoints fire?
3. **Our touchpoints content** — opener SMS / VM script / agent opener / mid-cadence nudge SMS / final SMS
4. **Key trust-maintenance rules** — source-specific do's and don'ts
5. **Required CT contact attributes** — fields we must sync to support templating

Each new source = new section here = new CT Campaign on the operational side.

---

## Operational responsibility matrix

| Touchpoint | Owner | Where it's authored / maintained |
|---|---|---|
| Ad creative | Bina / Meta Ads / future ad provider | External — out of our scope |
| PII form | Bina / lead provider | External — out of our scope |
| Thank-you page | Bina / lead provider | External — out of our scope |
| **Opener SMS** | Tri Pros leadership (Oliver) | **This doc**; deployed to CT Campaign SMS template |
| **Voicemail recording** | Tri Pros leadership (Oliver records audio) | **This doc** specifies script; audio file uploaded to CT |
| **Agent script (Oliver / Sean opener)** | Tri Pros leadership | **This doc**; reinforced in agent training (no formal Knowledgebase until #238 activates) |
| **Mid-cadence + final SMS** | Tri Pros leadership | **This doc**; deployed to CT Campaign SMS template |
| **Disposition handling on connected call** | Oliver / Sean per call | CT softphone disposition UI (10 outcomes per Q5) |

---

## Per-lead variable substitution

**Final merge field set (corrected 2026-05-31):** templates reference `{{first_name}}`, `{{city}}`, `{{primary_trade}}`. Two of these (`first_name`, `city`) resolve to CT built-in fields; one (`primary_trade`) resolves to a custom attribute.

**V1 verification PENDING** (per HANDOFF-2026-06-01.md):
- Confirm CT's template engine merges `{{first_name}}` / `{{city}}` against CT's built-in `Contact.first_name` / `Contact.city`.
- Confirm CT's template engine merges `{{primary_trade}}` (or the actual CT syntax — possibly `{{custom.primary_trade}}` or via property-picker UI) against our custom `Primary Trade` attribute.
- If verification fails for either, update templates above + attribute table accordingly.

`{{city}}` is NOT directly a CT contact attribute on input — it's derived in our app from `customers.zip` at sync time via a zip→city lookup table (lives in `entities/customers/lib/zip-to-city.ts` or similar; lookup table TBD Phase 1) and pushed into CT's built-in `Contact.city` field.

`{{primary_trade}}` is derived from `customers.tradesInterested[0]` (first multi-select entry) mapped through the `trades` table to its human label (e.g., `'kitchen_remodel'` → `'Kitchen Remodel'`), pushed into our custom `Primary Trade` attribute on the CT contact.

**Templates above retained as PRINCIPLE wording.** If V1 reveals a syntax mismatch (e.g., CT uses `[first_name]` brackets, or requires `{{contact.first_name}}`), update the exact merge syntax inline; the human-language wording stays.

---

## A/B testing future

When this doc has been live for a quarter and we have conversion baseline data, A/B test candidates:

- "Hi" vs "Hey" vs "Hello" opener wording
- "I'll reach out shortly" vs "calling you back today" (vague vs specific commitment)
- "Residential Assistance Program" vs alternative framings ("Energy Improvement Program", "Home Upgrade Program") — note: cannot test against ad creative consistency (must match upstream)
- VM length (short 10s vs detailed 25s)
- Mid-cadence nudge wording
- Per-trade SMS variants ("your roofing inquiry" vs generic)
- Including / omitting the address-acknowledgment in agent opener

Track via CT's A/B testing primitives (if supported — Phase 0 verify) or by splitting Campaigns by hypothesis.

---

## Maintenance + change log

- **2026-05-28:** doc created; Bina/"The Program" framing locked from user (grill-me session Q9.A.2); Home Depot placeholder added pending content.
- **2026-05-29:** Reveal Staircase principle added (Q10.4 lock); inbound VM greeting section added ("Residential Programs line by Tri Pros"); HD content filled in with "Home Depot Pros approved-contractor" framing (Tri Pros revealed EARLY per HD trust dynamics — homeowner already knows a contractor is calling, Home Depot endorsement is the credential).
- **2026-05-31:** Attribute tables corrected (3 custom + CT built-ins). Dropped `hd_endorser` / `hd_project_label` / `program_name` / `program_offer` — all are literal template text, not merge fields. V1 verification flagged for `{{first_name}}` / `{{city}}` / `{{primary_trade}}` template engine confirmation. Templates retained as principle wording; exact merge syntax adjusts post-V1.
