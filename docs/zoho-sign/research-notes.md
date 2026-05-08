# Zoho Sign — Multi-Template Envelope Research Notes

Phase 1 research spike for the composable-templating migration. Confirms the API endpoint, recipient unification behavior, and field-data scoping that the codebase will rely on. See [the design plan](../../../.claude/plans/i-just-confirmed-harmonic-pinwheel.md) for context.

Smoke tests landed two real drafts in production Zoho (left in place for visual inspection):
- `563034000000084112` — 2-template merge (senior-ack + esign-waiver)
- `563034000000083029` — 3-template merge (HI-senior + senior-ack + esign-waiver)

Reproduce: `pnpm tsx scripts/verify-multi-template-envelope.ts <recipient-email>`.

## Endpoint

```
POST https://sign.zoho.com/api/v1/templates/mergesend
Authorization: Zoho-oauthtoken <token>
Content-Type: application/x-www-form-urlencoded

template_ids=["<id1>","<id2>",...]&data=<json>&is_quicksend=false
```

- `template_ids` — JSON-encoded array of template IDs, in the order they should appear as documents in the envelope.
- `data` — JSON-encoded object containing `templates.field_data` and `templates.actions` (see below).
- `is_quicksend=false` — creates a draft. `true` would send the envelope immediately.

Response shape mirrors the single-template `createdocument` call: `{ code, requests: { request_id, ... }, status, message }`.

## Field data is GLOBAL, not per-template

`field_text_data`, `field_date_data`, etc. are flat objects keyed by field label. Zoho applies the same value to every occurrence of a field with that label across all merged templates — so identical fields across templates (`ho-name`, `ho-email`, `ho-address`, etc.) get filled once. This is what we want.

If two templates accidentally use the same label for different concepts, the second template's instance wins / inherits the same value. Convention: keep field labels unique per concept, share labels intentionally for cross-template prefill.

## Recipient unification is automatic

We send **N** action entries (one per template's signer). Zoho merges them into **K** unique recipients by email, returning K envelope-level action_ids. Signature/date fields across all merged documents get remapped to point at the new envelope-level action_ids.

| Test | Input actions sent | Templates merged | Output actions in envelope |
|---|---|---|---|
| 2-template, 1-recipient | 2 (both Homeowner, same email) | senior-ack + esign-waiver | **1** Homeowner |
| 3-template, 2-recipient | 4 (1 Contractor + 3 Homeowner) | HI-senior + senior-ack + esign-waiver | **2** (1 Contractor + 1 Homeowner) |

The homeowner sees ONE signing email and ONE signing session covering every document in the envelope.

**Implication for the codebase:** The registry's `signerActions: { contractor, homeowner }` field carries the per-template action_ids that we send IN. The envelope-level action_ids returned by Zoho are different — assigned at merge time. We don't currently need to track those for our flow (we don't manipulate fields after submit), but we'd capture them if a future feature needs to reference specific signers post-creation.

## Action listing format

Each entry in the `actions` array:

```json
{
  "recipient_name": "Test Recipient",
  "recipient_email": "homeowner@example.com",
  "action_id": "<template-level-action-id>",
  "action_type": "SIGN",
  "signing_order": 2,
  "role": "Homeowner",
  "verify_recipient": false,
  "private_notes": ""
}
```

- One entry per template-level action_id, even when the same email signs across multiple templates.
- `signing_order` — Zoho honors this at the merged level; entries pointing to the same recipient with the same order get unified. Use signing_order=1 for Contractor, 2 for Homeowner (matching today's `tpr-HI` template's order).
- `verify_recipient: true` + `verification_type: "EMAIL"` for the homeowner in production envelopes (matches today's `build-signing-request.ts` behavior).

## Template-level action IDs (current inventory)

```
tpr-HI                (563034000000046241)  Contractor=...46252 (order=1)  Homeowner=...46258 (order=2)
tpr-HI-senior         (563034000000055081)  Contractor=...55125 (order=1)  Homeowner=...55136 (order=2)
tpr-senior-ack        (563034000000079147)  Homeowner=...79160 (order=2)   (no Contractor)
tpr-esign-waiver      (563034000000079183)  Homeowner=...79195 (order=2)   (no Contractor)
tpr-material-order    (563034000000079219)  Homeowner=...79229 (order=2)   (no Contractor)
tpr-additional-work   (563034000000079284)  Homeowner=...79297 (order=2)   (no Contractor)
```

Ancillary templates (senior-ack, esign-waiver, material-order, awd) are homeowner-signed only — no contractor signer placement. The contractor only signs the main HI agreement.

**Why every Homeowner placeholder sits at signing_order=2** (even on single-signer templates): mergesend binds Signature/Initial/Sign-date fields to recipients by the FIELD's template-stored signing_order, NOT by action_id. With Contractor at order=1 on `tpr-HI` and `tpr-HI-senior`, any other template's Homeowner field stored at order=1 would bind to `info@triprosremodeling.com` instead of the customer when merged. See `docs/zoho-sign/template-inventory.md#signer-binding-note` for details and verification steps.

## Field caps and types — known gaps

- `max_chars` not exposed in the `templates/{id}` response for the new templates (came back as `?` for every field). Zoho UI shows max_chars in the field properties dialog. We'll capture these manually in the inventory artifact after the user confirms in the Zoho UI.
- `sent-date` is `CustomDate` type → fills via `field_date_data`, not `field_text_data`. Format: see Zoho's `date_format` field metadata (templates use `MM/dd/yyyy HH:mm` or `MMM dd yyyy HH:mm z` — varies by template).

## Constraints not yet probed

- Maximum templates per merge call — not documented; haven't tested past 3.
- Behavior when two merged templates have a shared field label but different `text_property.max_field_length` — likely the more restrictive cap wins; not tested.
- `is_sequential` — defaults to `true` in our test responses. Means the contractor (signing_order=1) signs before the homeowner (order=2). Default behavior is correct for our flow.

## Codebase implications (Phase 2+ work)

- New `assemble-envelope.ts` module wraps `POST /templates/mergesend` instead of `POST /templates/{id}/createdocument`.
- The existing `addFilesToRequest()` (`PUT /requests/{id}` multipart) still works for appending the generated SOW PDF post-merge.
- Envelope name defaults to the first merged template's name. We may want to override `request_name` in the merge payload to match the customer (e.g. `"Smith Project — Tri Pros Agreement"`).
- `field_date_data` needs date-format-aware filling for `sent-date`. Add a date-source helper in the field-source registry.
