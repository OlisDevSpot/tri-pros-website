# JustCall API — Verified Research

Canonical record of the JustCall Sales Dialer API facts the migration relies on.
**Verified against developer.justcall.io on 2026-08-19** (auth, dynamic-webhook-
signatures, call-events, sms-events, and the Sales Dialer endpoint references) —
the earlier "CONFIRM AT BUILD/GO-LIVE" flags are now resolved and folded in.

Related: [design spec](../../superpowers/specs/2026-08-19-justcall-dialer-migration-design.md) ·
[setup runbook](./justcall-setup-runbook.md) ·
[provider DOCS](../../../src/shared/services/providers/justcall/DOCS.md)

Sources: [Authentication](https://developer.justcall.io/reference/authentication) ·
[Dynamic Webhook Signatures](https://developer.justcall.io/docs/dynamic-webhook-signatures) ·
[Call Events](https://developer.justcall.io/docs/call-events) ·
[SMS Events](https://developer.justcall.io/docs/sms-events) ·
[Add contact](https://developer.justcall.io/reference/sales_dialer_add_contact_to_campaign_v21) ·
[Remove contact](https://developer.justcall.io/reference/sales_dialer_remove_contact_from_campaign_v21) ·
[List custom fields](https://developer.justcall.io/reference/sd_list_contact_custom_fields)

## Base + auth

- **Base URL:** `https://api.justcall.io/v2.1`
- **Auth header:** `Authorization: api_key:api_secret` — **raw colon-joined, NOT
  base64 Basic** (verified against the official v2.1 auth docs). `Accept:
  application/json`. The client's `buildAuthHeader` sends the raw form.
- **Plan:** API access needs **Team or higher**. Dialer availability differs by
  plan — see the tier matrix below.

## Sales Dialer endpoints used (verified paths + methods)

| Purpose | Method + path | Notes |
|---|---|---|
| Enroll (upsert contact into a campaign) | `POST /sales_dialer/campaigns/contact` | Body: `campaign_id` (number), `phone_number` (E.164), `name?`, `email?`, `custom_fields:[{id,value}]`. Returns `{ status, data:{ id, phone_number, … } }`; **`data.id`** = contact id. Upsert-on-phone. |
| Unenroll (remove contact) | **`DELETE /sales_dialer/campaigns/contact`** | **QUERY params** `campaign_id` + `contact_id` (not a body, not a `/remove` path). Returns `{ status:'success' }`. |
| Send SMS | `POST /texts/new` | Body: `justcall_number` (from), `contact_number` (to), `body`. Returns `{ status, data:{ id } }`. |
| List campaigns | `GET /sales_dialer/campaigns` | Paginated (`page`, `per_page`). Row: `{ id, name, type, status? }`, `type` ∈ `Autodial | Dynamic | Predictive`. |
| List custom fields | **`GET /sales_dialer/contacts/custom-fields`** | Returns `{ status, total, data:[{ key, label, type }] }`. **`key`** is the numeric id used in `custom_fields:[{id,value}]`; **`label`** is what the resync maps to our app_key. |

## Dialer modes / tier matrix

- **Power Dialer** (dashboard label) / **Autodial** (API `type`) — single-agent
  power dialer. **Unlimited on Pro / Pro Plus / Business.** Our default.
- **Dynamic** — multi-agent shared lead pool. **Unlimited only on SalesPro**; on
  Pro/Business creatable only while a limited **balance** lasts.
- **Predictive** — multi-agent predictive. **SalesPro only.** Not used.

Bina runs a **Dynamic** campaign (multi-agent dispatcher pool); every other
source runs **Autodial**. The design is mode-agnostic: each campaign carries a
`dialer_mode` column; falling Bina back to Autodial is a config change, not code.

⚠️ **Open commercial question — ASK JUSTCALL AT SIGNUP.** Once the Pro/Business
Dynamic *balance* is exhausted, the docs say you can't *create* more Dynamic
campaigns — but are silent on whether an **already-running** one keeps dialing.
Bina's model depends on the answer. If it stops (or SalesPro is too costly), run
Bina as `dialer_mode='autodial'` — a per-campaign config change, no code.

## Webhooks (verified)

- **Events consumed:** `sd.call_completed`, `sd.call_updated`, `sms.received`
  (exact `type` strings, verified).
- **Envelope:** every webhook is `{ request_id, webhook_url, url_id, type, data:{…} }`.
  `type` + `webhook_url` sit at the root; all payload fields live under `data`.
  - **Call events** (`data`): `call_sid`, `contact_id`, `contact_number`,
    `sales_dialer_number` (the dialed DID → becomes the SMS `from`),
    `call_info.{ disposition, direction, notes }`, `campaign{…}`.
    The app dedups on `call_sid` (mapped to the canonical `callUuid`).
  - **SMS** (`data`): `contact_number` (sender), `justcall_number` (our DID),
    `sms_info.body`, `direction` (`"Incoming"`).
- **Disposition split:** the final disposition may arrive on `sd.call_updated`
  rather than `sd.call_completed`. The adapter emits canonical
  `call.disposition_set` only when a disposition is present on an update, and
  `call.ended` (which drives SMS cadence) off `sd.call_completed`.
- **Signature:** HMAC-SHA256 (hex), keyed with the **API secret**, over
  `{secret}|{encodeURIComponent(webhook_url)}|{type}|{timestamp}`. The secret is
  **both** the HMAC key and the first pipe field. `webhook_url` + `type` come
  from the **body**; `timestamp` from the `x-justcall-request-timestamp` header.
  Signature in `x-justcall-signature` (version `v1` in `x-justcall-signature-version`).
  Timestamp format: `"2024-03-21 17:08:22"`. No separate webhook secret.

## Rate limits

- Tiered by plan. The client retries HTTP 429 up to `JUSTCALL_MAX_RETRIES` (3),
  honoring `Retry-After`. (Confirm the exact per-minute ceiling against live
  headers during the go-live smoke if throttling shows up — not load-bearing.)

## Known gaps vs. CloudTalk

- **No contact-note API.** CloudTalk's per-contact "Notes" push is **dropped** —
  JustCall has no equivalent endpoint. The same data still rides as custom fields.
- **Custom fields are numeric, pre-created in the dashboard.** JustCall field
  `key`s are assigned when you create the field in the UI. They are synced into
  `voip_contact_fields` (app_key → provider_field_id) and resolved at enroll time.
- **No membership-tag idiom.** CloudTalk enrolled by applying a tag; JustCall
  enrolls with an explicit `campaigns/contact` upsert and unenrolls with a
  `DELETE`. The `ct_membership_tag` / `ct_tag_id` columns were dropped.
- **Mid-call routing mocks dropped.** The Phase-0 `/api/voip/routing/*` mocks
  (CloudTalk Call Flow Designer) are removed — not part of the JustCall integration.
