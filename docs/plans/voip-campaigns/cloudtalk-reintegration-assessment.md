# CloudTalk Reintegration — Assessment & Direction

Status: **assessment complete, decisions locked, no code yet** (2026-09-06).
Supersedes the "migrate to JustCall now" plan: we are **holding JustCall** and
running **CloudTalk** as the live dialer, behind the neutral seam the migration
built. The standardization epic is NOT dead — it is the mechanism that makes this
provider swap cheap.

Related: [migration spec](../../superpowers/specs/2026-08-19-justcall-dialer-migration-design.md) ·
[migration plan](../../superpowers/plans/2026-08-19-justcall-dialer-migration.md) ·
[JustCall API research](./justcall-api-research.md) · [EPIC.md](./EPIC.md) ·
pristine CloudTalk code at git ref `0c235beb` (parent of migration commit `26c54190`).

## Where the epic stands

- The migration is **committed on `main`** (`26c54190`). It delivered a working
  provider-neutral seam and shipped JustCall through it.
- **The seam is the reusable asset:** `services/voip/dialer/types.ts`
  (`DialerProvider` interface + `CanonicalDialerEvent` union) + a one-line binding
  in `services/voip/dialer/index.ts`.
- **CloudTalk was deleted but fully recoverable** at `0c235beb` (client ~726 LOC,
  schemas, webhooks/events, config, DOCS — 13 files).
- **Coupling to JustCall is thin and concentrated** — everything reachable from
  the campaigns tab (setup / resync / enrollment / cadence / leads) already flows
  through the neutral seam. Hard JustCall points: (1) the binding line, (2) the
  `/api/webhooks/justcall` route + its 2 direct imports, (3) env config fragment,
  (4) the disposition→exit-reason map, (5) 4 cosmetic UI strings + a leaked
  `JustcallContactFieldAppKey` type in otherwise-neutral service libs.

## Decisions (locked 2026-09-06)

1. **Approach: SWAP now, DUAL-ready schema.** Bind CloudTalk as the *sole* live
   dialer; keep JustCall's code dormant. BUT land the dual-provider schema bits
   now (provider discriminator + tag column) so swapping back to JustCall later is
   a one-line binding flip, not another migration.
2. **Capability scope (refined 2026-09-06):**
   - **Bulk upsert = first-class, CROSS-PROVIDER** — not a CloudTalk extra. It is
     the *customer-migration* mechanism (mass-upsert our people into whichever
     dialer), so BOTH providers implement it (CloudTalk `/bulk/contacts.json`
     ≤10/req; JustCall bulk import ≤250, upsert-on-phone).
   - **Customer↔provider-contact linkage + context push = essential.** Auto-dialing
     runs in the provider's system, so the customer's context must live on the
     provider's contact: CloudTalk via its Notes surface + attributes, JustCall via
     custom fields (no notes API). The load-bearing part is a reliable
     `provider_contact_id` link.
   - **Campaign pause/resume = DROPPED for now.**

## Data model — what changes (the crux for a smooth swap)

The migration dropped exactly two columns from `voip_campaigns`, both CloudTalk
enrollment machinery:
- `ct_membership_tag` (text, NOT NULL, UNIQUE) — **load-bearing**: CloudTalk
  enrolls by applying this per-campaign tag (`addTags`) and unenrolls with
  `removeTags`. There is no "add to campaign" endpoint.
- `ct_tag_id` — non-essential (tags referenced by name). Do NOT re-add.

CloudTalk uniquely carries **two** campaign identifiers (a dashboard/sync campaign
id AND a membership tag); JustCall collapses to one. A single `provider_campaign_id`
can't hold both. Decision:

- **Re-add one provider-neutral, nullable `membership_tag`** (a.k.a. `enroll_tag`)
  column on `voip_campaigns` — null for JustCall, populated for CloudTalk. It is
  load-bearing + unique + queried at enroll time, so it belongs in a real column,
  not JSONB (per ADR-0005 / `jsonb-columns.md`).
- **Add a `provider` enum discriminator** (`cloudtalk | justcall`) on
  `voip_campaigns` (and likely `voip_campaign_contacts`) so the opaque
  `provider_campaign_id` / `provider_contact_id` handles are self-describing and a
  later swap (or transitional dual state) is unambiguous.
- **Leave `voip_contact_fields` and `voip_campaign_contacts` otherwise as-is** —
  CloudTalk's attribute id fits `provider_field_id`; its contact id fits
  `provider_contact_id` cleanly.

## How the tag model fits the JustCall-shaped interface

All resolvable inside the CloudTalk provider — no seam redesign:
- `enroll` must return `NOT NULL UNIQUE providerContactId` → CloudTalk **upserts
  the contact and returns its CloudTalk contact id**; the tag rides on the
  campaign row's `membership_tag`, not here.
- `unenroll({providerCampaignId, providerContactId})` → provider reads the tag off
  the campaign and does `removeTags`.
- `switchCampaign` → remove-old-tag + add-new-tag on the same contact; returns the
  same id (consumers don't require it to change).

## Interface extensions the refined scope introduces

The current seam has 6 methods (enroll/unenroll/switchCampaign/sendSms/
listCampaigns/listContactFields). The refined scope adds:
- **`bulkUpsert` — a first-class neutral method both providers implement.** It is
  the customer-migration + mass-enroll mechanism, not a provider quirk, so it
  belongs on the core interface (CloudTalk `/bulk/contacts.json` ≤10/req;
  JustCall bulk import ≤250). Providers translate to their own bulk wire shape.
- **Contact-context push** — CloudTalk gets a real note push (`notes/add`);
  JustCall carries the same customer context as custom fields (it has no notes
  API). Mechanism differs per provider; the *intent* (customer context lives on
  the provider's contact) is cross-provider. Likely a CloudTalk-implemented
  optional method that JustCall satisfies via the existing field push.
- ~~campaign pause/resume~~ — **dropped** (2026-09-06).

## Customer ↔ provider-contact linkage & backfill — EXPLORING (crux, pre-commit)

Auto-dialing runs in the provider's system, so the customer's context must live on
the provider's contact, which means a reliable `provider_contact_id` link. Our
Neon `voip_campaign_contacts` was emptied in the prior cutover (link discarded),
**but the contacts still live in CloudTalk.** So reintegration must **match-or-
upsert** each customer against existing CloudTalk contacts and re-persist the link.

⚠️ **Sharp edge:** CloudTalk's `/contacts/add.json` does NOT de-duplicate — a
naive bulk add forks a new contact for everyone already in CloudTalk. The
migration MUST match-then-write, so the **match key is the decisive choice**:
- User's proposal: match on **full contact name** (same in both systems).
- Existing/robust key: **phone** (CloudTalk's own model is phone-centric —
  `findContactByPhone`; JustCall upserts on phone).
- Concern to resolve: name-only matching risks mis-linking two same-named
  customers → wrong dialing + wrong notes on one contact. Phone is more unique but
  can drift (formatting, multiple numbers).

**Research finding (2026-09-06) — RECOMMENDATION, pending user confirmation:**
- `customers.name` is a **single free-text, non-unique, mutable column** (no
  first/last split) → name-as-primary-key is structurally unsafe (two same-named
  leads → silent mis-link: wrong-person dials + misfiled notes on 2 records).
- `customers.phone` is the **canonical key** (bare-10 → deterministic E.164) and
  the ONLY key CloudTalk was ever built on (`findContactByPhone`; name only
  written). The ~403 existing CloudTalk contacts were **created by our own old
  enrollment via phone-upsert** → phone re-match re-finds exactly those records.
- **Recommended: phone-primary find-or-create; name only as an intra-household
  tiebreaker** when a phone hit returns multiple (households share numbers).
- Guardrails: nullable phone → skip+report; ambiguous phone → name-disambiguate
  then **flag for review, never blind `[0]`**; no match → create+link. A missed
  match self-heals (dup, cheap); a name mis-link is silent (corrupts 2 rows) —
  the asymmetry is the whole argument.
- Bulk reality: **CloudTalk bulk buys nothing for re-linkage** (≤10/req, no
  find-or-create) → per-contact find+add. **JustCall** native 250-batch
  upsert-on-phone works but needs a `bulk_import` client method that **does not
  exist yet**.
- **Durable-linkage columns to add** (beyond `provider_contact_id`): `provider`
  discriminator (+ composite unique `(provider, provider_contact_id)` — current
  `.unique()` is provider-blind), `matchedName` snapshot, `matchMethod`/confidence
  (`phone_exact|created|name_fallback|manual`), `lastLinkedAt`.

**DECISION CONFIRMED (2026-09-06): phone-primary + name tiebreaker.**

**Read-only prod audit (2026-09-06, re-run after test-lead cleanup) — sizing:**
- **710 customers; 709 clean 10-digit phone (~100%); 1 dirty (9-digit); 0 DNC;
  all have a lead source → enrollable = 709.** (Initial run showed 739/738; the
  user then deleted ~29 test leads.) voip tables = **0 rows** (clean slate).
- **Bina-dominated:** Bina 513 (72%), Telemarketing 59, Branded Meta Ads 34,
  Website 31, Home Depot 30, QuoteMe 17, Manual 10, others ≤7.
- **Name-primary quantitatively rejected:** 39 enrollable share a name (13 groups,
  max 12 identical) → pure name-match ≈ 39 silent mis-links.
- **The "placeholder number" buckets were internal TEST leads**, not real
  customers: `818-651-1445` (Oliver's own number — "Oli Test", "Oli Production",
  etc.) and `818-445-3241` (Bina team — "Team Bina", "Bina Test", junk). Mostly
  deleted; residue remains (11 on the first, 3 on the second). **Backfill must
  EXCLUDE test leads, not "flag for review".**

**Backfill handling rules (from the audit):**
- ~703 clean, unique-phone customers → straightforward phone match-or-create.
- The 2 placeholder-number buckets (~33) + the 1 dirty phone → **flag for review,
  never auto-link** (an unlinked customer re-creates cleanly on next enroll; a
  cross-link corrupts records).
- Small shared groups (~19) → name-tiebreaker (2-person households) or dedupe
  (true duplicates resolve to the same contact — fine).
- **Scale is small (~738, Bina-heavy) → per-contact find+add against CloudTalk is
  fine (~12–15 min at 60/min); CloudTalk bulk is unnecessary for re-linkage.**
  Bulk remains a real build item for the FUTURE JustCall customer migration
  (250-batch upsert-on-phone; the JustCall client has no `bulk_import` method yet).

## Work breakdown (no code yet — the shape of the reintegration)

1. **Schema migration** — add `membership_tag` (nullable) + `provider` enum to
   `voip_campaigns`; add `provider` to `voip_campaign_contacts`; enum in
   `constants/enums/voip.ts`. Dev push only until a prod cutover ceremony.
2. **Seam hygiene** — promote the app-key type out of `providers/justcall/` into
   the neutral `dialer/` layer.
3. **Interface extension** — add the optional capability methods (per the decision
   above) to `DialerProvider`.
4. **CloudTalk provider tree** (`providers/cloudtalk/`) — recover the client +
   schemas + config from `0c235beb`; write the NEW `dialer-provider.ts` (tag-based
   translation to neutral shapes) and NEW `webhooks/adapter.ts` (flat body +
   `?secret=` verify → `CanonicalDialerEvent`; note: CloudTalk has NO HMAC).
   Restore note-push / bulk / pause-resume as the optional-capability impls.
5. **Webhook route** — add `app/api/webhooks/cloudtalk/route.ts` wired to the
   CloudTalk adapter + CloudTalk disposition map (near-clone of the JustCall
   route; note the webhook binding is a SEPARATE edit from the dialer binding).
6. **Bind + config** — flip `dialer/index.ts` to `cloudtalkDialerProvider`; add
   the `cloudtalk` config fragment to `server-env.ts`.
7. **Service wiring** — re-attach note-push (enrollment), bulk (enroll-source-batch
   job), pause/resume (holiday cron) via the new capability methods.
8. **UI copy** — the 4 "JustCall" strings → "the dialer" (provider-neutral).
9. **Resync** — verify `resyncDialer` maps CloudTalk's `listCampaigns` (campaign id
   + membership tag) and `listContactAttributes` into `voip_campaigns` /
   `voip_contact_fields`, including the new `membership_tag`.

## Open items for the design session

- Env: reuse the old CloudTalk env var names (`CLOUDTALK_ACCESS_KEY_ID/SECRET`,
  `CLOUDTALK_WEBHOOK_SECRET`) — confirm they're still provisioned.
- Prod cutover ceremony for the schema change (dev push first; prod only when asked).
- Whether the `provider` discriminator's UNIQUE constraints need to be
  per-provider composite (`(provider, provider_campaign_id)`).
