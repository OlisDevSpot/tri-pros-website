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
- **Status:** existing — needs trim in Zoho UI (drop sow-1 / sow-2 fields once the registry-driven assembler ships in Phase 4)
- **Fields (current; sow-1/sow-2 will be removed at trim time):**

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
  | sow-1 | text (max 2000) | _legacy — removed at trim_ |
  | sow-2 | text (max 2000) | _legacy — removed at trim_ |

---

## main-hi-senior — Main HI agreement (senior)

- **Source:** zoho-template
- **Zoho template ID:** `563034000000055081`
- **Applicable scenarios:** initial
- **Rule:** required when `isSenior` (customer age ≥ 65)
- **Action IDs:**
  - contractor: `563034000000055125`
  - homeowner: `563034000000055136`
- **Status:** existing — needs trim in Zoho UI (same as main-hi-base)
- **Fields:** same shape as `main-hi-base`.

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
- **Zoho template ID:** TBD — user authoring
- **Applicable scenarios:** upsell
- **Rule:** required (every upsell)
- **Action IDs:** TBD
- **Status:** pending. Once authored, this entry gets concrete IDs and the registry's commented-out AWD block is uncommented.
- **Expected fields (pending confirmation):**

  | Field name | Type | Source |
  |---|---|---|
  | ho-name | text | `customer.name` |
  | original-project-ref | text | TBD (project name, original contract date, etc.) |
  | new-tcp | text | `computeFinalTcp(funding)` |
  | new-deposit | text | `funding.depositAmount` |
  | start-date | text | today + 3 days |
  | completion-date | text | start-date + `validThroughTimeframe` |
  | sow-1 | text (max 2000) | inline SOW first half (only when `!isLongSow`) |
  | sow-2 | text (max 2000) | inline SOW second half (only when `!isLongSow`) |

---

## senior-ack — Senior citizen acknowledgement

- **Source:** zoho-template
- **Zoho template ID:** `563034000000079147`
- **Template name in Zoho:** `tpr-senior-ack-standalone.pdf`
- **Applicable scenarios:** initial
- **Rule:** required when `isSenior`
- **Action IDs:**
  - homeowner: `563034000000079160` (Homeowner-only — no Contractor signer)
- **Last verified against Zoho:** 2026-04-28
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
  - homeowner: `563034000000079195` (Homeowner-only)
- **Last verified against Zoho:** 2026-04-28
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
  - homeowner: `563034000000079229` (Homeowner-only)
- **Last verified against Zoho:** 2026-04-28
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
| awd | * | TBD (post-author) |
