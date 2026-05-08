# Zoho Sign Template Inventory

Single source of truth for every document that can appear in a Tri Pros agreement envelope. Each entry mirrors a row in [`src/shared/services/zoho-sign/documents/registry.ts`](../../src/shared/services/zoho-sign/documents/registry.ts) — keep them in sync.

**Workflow when adding/changing a template** (per the [composable-templating plan](../../.claude/plans/i-just-confirmed-harmonic-pinwheel.md)):

1. User authors / edits the template in the Zoho Sign UI.
2. User shares the template ID.
3. `pnpm tsx scripts/zoho-template-fields.ts <template-id>` to dump field metadata.
4. `pnpm tsx scripts/zoho-template-actions.ts <template-id>` to dump signer action IDs.
5. Update this file AND `registry.ts` together. PR includes both.
6. (Eventually, post-Phase 4) Smoke-test envelope creation using the new doc.

API capabilities + recipient unification: see [research-notes.md](./research-notes.md).

---

## main-hi-base — Main HI agreement (non-senior)

- **Source:** zoho-template
- **Zoho template ID:** `563034000000046241`
- **Applicable scenarios:** initial
- **Rule:** required when `!isSenior`
- **Action IDs:**
  - contractor: `563034000000046252`
  - homeowner: `563034000000046258`
- **Status:** trimmed (sow-1/sow-2 removed)
- **Last verified against Zoho:** 2026-04-28
- **Fields:**

  | Field name | Type | Source |
  |---|---|---|
  | ho-name | text | `customer.name` |
  | ho-email | text | `customer.email` |
  | ho-phone | text | `customer.phone` |
  | ho-address | text | `customer.address` |
  | ho-city-state-zip | text | `${city}, ${state} ${zip}` |
  | ho-age | text | `customer.customerAge` |
  | start-date | text | today + 3 days |
  | completion-date | text | start-date + `validThroughTimeframe` |
  | tcp | text | `computeFinalTcp(funding)` |
  | deposit | text | `funding.depositAmount` |
  | finance-charge | text | _legacy — not filled by codebase_ |
  | sp-1, sp-2, sp-3, sp-4 | Formula | _Zoho-computed from `tcp`; do not fill_ |

---

## main-hi-senior — Main HI agreement (senior)

- **Source:** zoho-template
- **Zoho template ID:** `563034000000055081`
- **Applicable scenarios:** initial
- **Rule:** required when `isSenior` (customer age ≥ 65)
- **Action IDs:**
  - contractor: `563034000000055125`
  - homeowner: `563034000000055136`
- **Status:** trimmed (sow-1/sow-2 + Text-3/4/5 placeholders removed)
- **Last verified against Zoho:** 2026-04-28
- **Fields:** same shape as `main-hi-base` (15 unique field labels, including `finance-charge` legacy + `sp-1..sp-4` formulas).

---

## sow-pdf — Scope of Work

- **Source:** generated-pdf (`pdfService.generateSowPdf({ proposalId })`)
- **Applicable scenarios:** initial, upsell
- **Rule:**
  - initial: required (always — drops the legacy short/long branch)
  - upsell: required when `isLongSow(sowText)` (otherwise SOW lives inline in AWD's `sow-1`/`sow-2`)
- **Generator:** [`src/shared/services/pdf/render-pdf.ts`](../../src/shared/services/pdf/render-pdf.ts) + [`src/shared/services/pdf/sow-doc-definition.ts`](../../src/shared/services/pdf/sow-doc-definition.ts)
- No fields (PDF is rendered with content baked in; signature anchors only).

---

## awd — Additional Work Description (UPSELL)

- **Source:** zoho-template
- **Zoho template ID:** `563034000000079284`
- **Template name in Zoho:** `tpr-additional-work-standalone.pdf`
- **Applicable scenarios:** upsell
- **Rule:** required (every upsell)
- **Action IDs:**
  - homeowner: `563034000000079297` (Homeowner-only by design — placeholder at template signing_order=**2** so Signature binding aligns with the rest of the envelope; see [signer-binding note](#signer-binding-note) below)
- **Last verified against Zoho:** 2026-05-07
- **Fields (12 total):**

  | Field name | Type | Date format | Source |
  |---|---|---|---|
  | ho-name | text | — | `customer.name` |
  | ho-address | text | — | `customer.address` |
  | ho-city-state-zip | text | — | `${city}, ${state} ${zip}` |
  | ho-phone | text | — | `customer.phone` |
  | ho-email | text | — | `customer.email` |
  | sow | text | — | `sowText` when `!isLongSow`; empty when long (sow-pdf carries the content) |
  | price-adjustment | text | — | `computeFinalTcp(funding)` — signed amount; positive for added scope, negative for credits |
  | sent-date | CustomDate | `MM/dd/yyyy` | today |
  | start-date | CustomDate | `MMM dd yyyy` | today + 3 days |
  | completion-date | CustomDate | `MMM dd yyyy` | start-date + `validThroughTimeframe` |
  | original-contract-date | CustomDate | `MMM dd yyyy` | Best-available date for the project's first proposal: `COALESCE(MIN(contract_sent_at), MIN(approved_at), MIN(created_at))` across all proposals on all meetings of this project (joined in `getProposal` as `projectFirstContractSentAt`, surfaced as `ctx.originalContractDate`). Falls back to today + `console.warn` only when the project has zero proposals. |

> **Date format quirk:** AWD's `sent-date` accepts `MM/dd/yyyy` while its other CustomDate fields require `MMM dd yyyy`. Sending the wrong format returns HTTP 400 with `code 8033 — Date format is invalid`. The registry uses two distinct field sources (`sentDateSrc` vs `formatZohoShortDate`-based) to handle this.

---

## senior-ack — Senior citizen acknowledgement

- **Source:** zoho-template
- **Zoho template ID:** `563034000000079147`
- **Template name in Zoho:** `tpr-senior-ack-standalone.pdf`
- **Applicable scenarios:** initial
- **Rule:** required when `isSenior`
- **Action IDs:**
  - homeowner: `563034000000079160` (Homeowner-only, placeholder at template signing_order=**2** — see [signer-binding note](#signer-binding-note) below)
- **Last verified against Zoho:** 2026-05-07
- **Fields:**

  | Field name | Type | Source |
  |---|---|---|
  | ho-name | text | `customer.name` |
  | ho-address | text | `customer.address` |
  | ho-city-state-zip | text | `${city}, ${state} ${zip}` |
  | ho-phone | text | `customer.phone` |
  | ho-email | text | `customer.email` |
  | ho-age | text | `customer.customerAge` |
  | sent-date | CustomDate | today (fills via `field_date_data`, not `field_text_data`) |

---

## esign-waiver — E-sign waiver

- **Source:** zoho-template
- **Zoho template ID:** `563034000000079183`
- **Template name in Zoho:** `tpr-esign-waiver-standalone.pdf`
- **Applicable scenarios:** initial
- **Rule:** required (every initial-sale envelope)
- **Action IDs:**
  - homeowner: `563034000000079195` (Homeowner-only, placeholder at template signing_order=**2** — see [signer-binding note](#signer-binding-note) below)
- **Last verified against Zoho:** 2026-05-07
- **Fields:**

  | Field name | Type | Source |
  |---|---|---|
  | ho-name | text | `customer.name` |
  | ho-address | text | `customer.address` |
  | ho-city-state-zip | text | `${city}, ${state} ${zip}` |
  | ho-phone | text | `customer.phone` |
  | ho-email | text | `customer.email` |
  | sent-date | CustomDate | today |

---

## material-order — Material order

- **Source:** zoho-template
- **Zoho template ID:** `563034000000079219`
- **Template name in Zoho:** `tpr-material-order-standalone.pdf`
- **Applicable scenarios:** initial, upsell
- **Rule:** optional (agent toggles per-proposal at draft-config time)
- **Action IDs:**
  - homeowner: `563034000000079229` (Homeowner-only, placeholder at template signing_order=**2** — see [signer-binding note](#signer-binding-note) below)
- **Last verified against Zoho:** 2026-05-07
- **Single line-item caveat:** `order-id`, `product-label`, `product-quantity` are flat single fields — today's template supports exactly one material item per envelope. Multi-item support requires either redesigning the template (e.g. `product-label-2`, etc.) or adding multiple material-order documents to the envelope (Zoho allows duplicate templates within one envelope).
- **Fields:**

  | Field name | Type | Source |
  |---|---|---|
  | ho-name | text | `customer.name` |
  | ho-address | text | `customer.address` |
  | ho-city-state-zip | text | `${city}, ${state} ${zip}` |
  | ho-phone | text | `customer.phone` |
  | ho-email | text | `customer.email` |
  | sent-date | CustomDate | today |
  | order-id | text | not yet mapped (TBD) |
  | product-label | text | not yet mapped (TBD) |
  | product-quantity | text | not yet mapped (TBD) |

---

<a id="signer-binding-note"></a>

## Signer-binding note (signing_order=2 convention for ancillary templates)

Mergesend binds Signature/Initial/Sign-date fields to recipients by the FIELD's
template-stored `signing_order` at envelope creation, NOT by the `action_id` we
attach a recipient to. When two templates' fields share the same template-stored
order, Zoho consolidates the order slot to a single recipient (first email seen
in the action payload wins) — and any field at that slot binds to that recipient.

Because `tpr-HI` / `tpr-HI-senior` reserve order=1 for the Contractor and order=2
for the Homeowner, every ancillary template's lone Homeowner placeholder must
sit at template-stored `signing_order=2`. Otherwise the Homeowner Signature on
the ancillary template binds to whoever holds order=1 in the merged envelope,
which is `info@triprosremodeling.com` (the Contractor). Verified via probes;
the `action.signing_order` we send in the API payload does not override this.

**To verify after editing any template in Zoho UI:**

```
pnpm tsx scripts/zoho-template-actions.ts <templateId>
```

Expected output for an ancillary template:
```
=== Template <id> (...) — 1 actions ===
  action_id=... role=Homeowner type=SIGN order=2 recipient=
                                       ^^^^^^^
                            must be 2 for binding to align
```

If `order=1` shows up, the field-binding bug returns.

---

## Future templates

These appear in the [`envelopeDocumentIds`](../../src/shared/constants/enums/zoho-sign.ts) enum so the type system is aware of them, but they're not yet authored in Zoho or wired into the registry.

| ID | Scenarios | Rule (planned) | Status |
|---|---|---|---|
| credit-card-auth | initial, upsell | optional | not yet authored |
| finance-doc | initial, upsell | optional | not yet authored |
| finance-ack | initial, upsell | optional | not yet authored |

---

## Field-cap audit log

`max_chars` for the new templates was not exposed via `GET /api/v1/templates/{id}` (came back as `?` for every field). Capture from Zoho UI when you have the dialog open and update the type column above with the cap, e.g. `text (max 200)`.

| Template | Field | Max chars in Zoho UI |
|---|---|---|
| main-hi-base | sow-1 | 2000 (legacy, will be removed) |
| main-hi-base | sow-2 | 2000 (legacy, will be removed) |
| senior-ack | * | TBD |
| esign-waiver | * | TBD |
| material-order | * | TBD |
| awd | sow | 2000 (Zoho hard cap 2048; SOW_INLINE_MAX_CHARS drops 48 for margin — single field, no second field to overflow into like sow-1/sow-2) |
| awd | * (other fields) | TBD |
