# Zoho Sign — Webhook Integration Notes

Discoveries from the live integration (2026-05-04). Zoho's public docs
diverge significantly from actual payload behavior.

## Payload shape (actual vs documented)

| Field | Docs say | Actually sends |
|---|---|---|
| `requests.request_id` | string | **number** — coerce to string for DB lookup |
| `notifications` | array of objects | **single object** (not wrapped in array) |
| `notifications.performed_at` | ISO string | **epoch-ms number** (e.g. `1704067200000`) |
| `notifications.operation_type` | `RequestCompleted` | **`RequestSigningSuccess`** (see table below) |

## Operation types (observed vs documented)

| Documented name | Actual name sent | Our mapping |
|---|---|---|
| `RequestRecipientViewed` | `RequestViewed` | `viewed` → `contractViewedAt` |
| `RequestCompleted` | `RequestSigningSuccess` | `completed` (gated — see below) → `contractSignedAt` + auto-approve |
| `RequestRejected` | `RequestRejected` or `RequestDeclined` | `declined` → `contractDeclinedAt` |

Both documented and observed names are mapped in
`src/shared/entities/proposals/lib/contract-events.ts` for resilience.

**⚠️ `RequestSigningSuccess` is per-signer, not per-envelope.** It fires once
for **each** signer that signs. On a Contractor + Homeowner envelope it arrives
when the contractor signs while the homeowner is still pending — at that point
the payload's `requests.request_status` is still `inprogress`. Mapping it to
`completed` only records "a signing happened"; the sync job
(`sync-zoho-sign-status.ts`) then fetches the live envelope and requires **all**
signer roles to be `SIGNED` (`isEnvelopeFullySigned`) before writing the
terminal `contractSignedAt` / auto-approving. Single-signer (Homeowner-only)
envelopes complete on the first signing because the envelope has only one
required action. The original 2026-05-04 single-signer test couldn't catch this.

## HMAC signature verification

- **Algorithm:** HMAC-SHA256, base64-encoded
- **Header:** `X-ZS-WEBHOOK-SIGNATURE` (configured in Zoho Developer Settings)
- **Secret:** generated via Zoho's UI (Developer Settings → Webhooks → Secret key)
- **Caveat:** the signature header is **not sent** to ngrok/dev tunnel URLs.
  Only arrives on production HTTPS endpoints. Our route accepts payloads
  without the header in dev mode and rejects in production.
- **Timestamp header:** optional (`X-ZS-WEBHOOK-TIMESTAMP`), controlled by
  "Enable timestamp" checkbox in Zoho. Not currently used.

## "Test URL" button

Zoho's admin panel has a "Test URL" button that sends a fake payload with:
- `request_id: 1000000102049` (dummy)
- `operation_type: "RequestSigningSuccess"`
- `request_status: "completed"`

This walks the full path (verify → parse → dispatch QStash → DAL lookup →
no matching proposal → clean exit). Useful for confirming wiring.

## Retry policy

Zoho retries on **5xx** but not **4xx**. Our route returns:
- `401` for bad/missing signatures (in prod) — stops retries
- `400` for malformed JSON — stops retries
- `200` for schema validation failures — stops retries (Zoho thinks success)
- `200` for valid payloads — normal
