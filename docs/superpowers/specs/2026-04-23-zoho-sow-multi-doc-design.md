# Zoho Sign — SOW overflow fix via conditional multi-doc envelope

**Issue:** [#135](https://github.com/OlisDevSpot/tri-pros-website/issues/135)
**Branch:** `fix/135-zoho-sow-overflow` (forked from `refactor/lead-sources-mobile-responsive`)
**Status:** Design approved. Spec authored 2026-04-23, pending user review before plan.
**Related:** [#134](https://github.com/OlisDevSpot/tri-pros-website/issues/134) — QStash observability (follow-up, not in this spec)

---

## 1. Context

On 2026-04-23 20:06:45 UTC, proposal `baaf55ef-31b1-4393-b721-cdba21610021` (Monte & Lorry Markowitz) was sent but never produced a Zoho Sign draft. Agent UI stuck on "Creating draft agreement…" indefinitely. `signing_request_id` remained NULL.

### Root cause

Confirmed via live replay against Zoho Sign API:

```
HTTP 400 {"code":9011,"error_param":"sow-2","message":"You have entered too many characters","status":"failure"}
```

- Zoho templates `tpr-HI` and `tpr-HI-senior` both define `sow-1` and `sow-2` with `text_property.max_field_length = 2048` each. Combined template capacity is **4,096 chars**.
- [`build-signing-request.ts:27-28`](../../../src/shared/services/zoho-sign/lib/build-signing-request.ts) slices:
  ```ts
  const sow1 = sowText.slice(0, 2000)        // under cap, OK
  const sow2 = sowText.slice(2000, 6000)     // up to 4,000 chars, overflows 2,048 cap
  ```
- This proposal's SOW plaintext is 6,504 chars (2 items: Sod Installation 2,916 chars + Cabinet Refinish 3,586 chars, joined with `\n\n`).
- The 400 response is swallowed inside the QStash retry loop (see #134) and never surfaces.

### Secondary findings

- Current slicer is blind: `.slice(0, 2000)` cuts mid-word, mid-bullet, mid-section-header. Even short SOWs that fit under the cap render visibly broken in Zoho. Fixing the packer alone is worthwhile independent of the overflow case.
- Templates themselves are intact (confirmed). This is a pure code-side defect.

## 2. Goals

- Restore reliable draft creation for all proposals, regardless of SOW length.
- Preserve the full SOW content in the signed legal artifact (CSLB §7159 requires the scope of work to be *in* the signed contract, not merely referenced externally; attaching it as an additional document in the same envelope satisfies this).
- Fix the mid-word truncation bug on short SOWs as a side benefit.
- Avoid modifying the Zoho templates themselves (prior template-deletion incident, commit `7e4b67a`, cost real downtime).

## 3. Non-goals

- QStash job error observability — tracked in [#134](https://github.com/OlisDevSpot/tri-pros-website/issues/134).
- Admin UI for inspecting which path a proposal took.
- Threshold calibration based on usage telemetry.
- Generating other PDF types (proposal PDF, finance form) — those stubs remain stubs.

## 4. Architecture

### 4.1 Flow

```
sendProposalEmail mutation
  ├─ email sent (unchanged)
  ├─ proposal.status = 'sent' (unchanged)
  └─ QStash dispatch: syncContractDraftJob
         │
         ▼
  contractService.ensureDraftSynced(proposalId, ownerKey)
         │
         ├─ sowText = sowToPlaintext(proposal.projectJSON.data.sow)
         │
         ├─ isLongSow(sowText)? ────────┐
         │                              │
         ▼                              ▼
   SHORT path                      LONG path
         │                              │
         │ buildSigningRequest         │ generateSowPdf(proposal)
         │   (packSowText → sow1/sow2) │ countPdfPages(buffer)
         │                              │ buildSigningRequest(..mode='long')
         │ createFromTemplate          │   sow1 = "See attached SOW (N pages)"
         │                              │   sow2 = ""
         │ updateProposal              │ createFromTemplate
         │                              │ addFilesToRequest(requestId, [pdf])
         │                              │ updateProposal
         │                              │
         └──────────────┬───────────────┘
                        ▼
          Agent UI polls → signingRequestId present → "draft ready"
```

### 4.2 Module layout

| Path | Change | Purpose |
|---|---|---|
| `src/shared/services/zoho-sign/lib/is-long-sow.ts` | **NEW** | Single-purpose predicate; exports `SOW_INLINE_MAX_CHARS = 3600`, `isLongSow(text)` |
| `src/shared/services/zoho-sign/lib/pack-sow-text.ts` | **NEW** | Paragraph-aware packer for the short path |
| `src/shared/services/zoho-sign/lib/build-signing-request.ts` | **EDIT** | Branch on `isLongSow`; use `packSowText` on short path; accept `mode: 'short' \| 'long'` + optional `sowPages` |
| `src/shared/services/zoho-sign/constants/index.ts` | **EDIT** | Add `SOW_FIELD_MAX_CHARS = 2000` (code-side safety margin under Zoho's 2048 cap) |
| `src/shared/services/pdf/sow-doc-definition.ts` | **NEW** | Pure function: `proposal → pdfmake doc definition`; no I/O |
| `src/shared/services/pdf/tiptap-to-pdfmake.ts` | **NEW** | Recursive Tiptap → pdfmake content mapper; parallel to `tiptap-to-text.ts` |
| `src/shared/services/pdf/count-pdf-pages.ts` | **NEW** | Tiny wrapper around `pdf-lib` (or equivalent) to count pages of a Buffer |
| `src/shared/services/pdf.service.ts` | **EDIT** | Flesh out `generateSowPdf({ proposalId })`; remove not-implemented stub |
| `src/shared/services/contract.service.ts` | **EDIT** | Add `addFilesToRequest`; split `createDraft` into short/long branches; route from `ensureDraftSynced` / `createSigningRequest` / `resendSigningRequest` |
| `package.json` | **EDIT** | Add `pdfmake` and `pdf-lib` (or equivalent lightweight page counter) |

### 4.3 Key constants

```ts
// src/shared/services/zoho-sign/constants/index.ts
export const SOW_FIELD_MAX_CHARS = 2000           // code-side cap; Zoho hard cap is 2048
export const SOW_INLINE_MAX_CHARS = 3600          // threshold below which short path is used
```

Rationale:
- `SOW_FIELD_MAX_CHARS = 2000`: 48-char safety margin under Zoho's documented `max_field_length = 2048`, room for encoding/whitespace quirks.
- `SOW_INLINE_MAX_CHARS = 3600`: 2 × 2000 = 4000 theoretical short-path capacity, minus ~10% headroom so a paragraph-boundary break doesn't fall outside the cap.

## 5. Short-path packer

### 5.1 Algorithm

```
packSowText(fullText: string) → { sow1, sow2, overflow }

MAX = SOW_FIELD_MAX_CHARS (2000)
MIN_FILL_RATIO = 0.5

findSplit(text, maxLen):
  if text.length <= maxLen: return text.length
  window = text.slice(0, maxLen)
  for sep in ['\n\n', '\n', '. ', ' ']:
    idx = window.lastIndexOf(sep)
    if idx >= maxLen * MIN_FILL_RATIO:
      return idx + sep.length
  return maxLen   // pathological: hard-break at the cap

split1 = findSplit(fullText, MAX)
sow1 = fullText.slice(0, split1).trim()
remaining = fullText.slice(split1).trimStart()
split2 = findSplit(remaining, MAX)
sow2 = remaining.slice(0, split2).trim()
overflow = remaining.length - split2
```

### 5.2 Invariants

- `sow1.length ≤ SOW_FIELD_MAX_CHARS` AND `sow2.length ≤ SOW_FIELD_MAX_CHARS` (both safely under Zoho's hard cap).
- On the short path (caller already guaranteed `sowText.length ≤ SOW_INLINE_MAX_CHARS`), `overflow` MUST be 0.
- If `overflow > 0` on short path, throw `Error('packSowText: unexpected overflow on short path — route to long path')`. This is a defense-in-depth check; if threshold calibration ever drifts, failure is loud rather than silent.

### 5.3 Unit test cases

1. Input < 2000 chars → `sow1 = full`, `sow2 = ''`, `overflow = 0`.
2. Input exactly 2000 chars (single paragraph) → `sow1 = full`, `sow2 = ''`, `overflow = 0`.
3. Input 3000 chars, two paragraphs joined by `\n\n` of sizes ~1500 each → splits cleanly at paragraph boundary.
4. Input 3500 chars, single paragraph → falls through `\n\n` → `\n` → `. ` → space break.
5. Pathological: 3500-char single unbroken word → hard-break at 2000.
6. Boundary at exactly `MIN_FILL_RATIO * MAX` → boundary still selected.
7. Input with trailing whitespace → trimmed correctly, no double newline preserved.

## 6. Long-path PDF generation + attach

### 6.1 PDF structure (SOW-focused)

- **No page headers, branding, customer block, pricing breakdown, or agreement notes** — all already rendered on the main template pages.
- First page: `"Scope of Work"` title + `"{proposal.label} — Prepared for {customerName}"` subtitle.
- For each SOW item: `pageBreak: 'before'` (except first), then:
  - `"{n}. {title}"` heading
  - `trade.label` subtitle
  - Scope chips as an inline row (text-only rendering)
  - Body content: Tiptap JSON walked via `tiptapToPdfmake` (see 6.2)

### 6.2 Tiptap → pdfmake mapping

Parallel to `src/shared/lib/tiptap-to-text.ts`, but emits structured content arrays instead of plaintext:

| Tiptap node | pdfmake output |
|---|---|
| `doc` | flatten children |
| `heading` | `{ text, style: 'h2', margin: [0, 8, 0, 4] }` (level determines style) |
| `paragraph` | `{ text: extractInline(node), margin: [0, 0, 0, 4] }` |
| `bulletList` | `{ ul: children.map(itemToContent) }` |
| `orderedList` | `{ ol: children.map(itemToContent) }` |
| `listItem` | flatten child block content for the `ul`/`ol` item |
| `blockquote` | `{ text, style: 'quote' }` |
| `horizontalRule` | thin hr line via pdfmake canvas |
| `text` + marks (bold, italic, underline) | apply via pdfmake text styling |
| unknown | recurse children (same pattern as `tiptap-to-text.ts`) |

### 6.3 Engine choice: pdfmake

- Lightweight (~800 KB deps), pure JS, works on any serverless runtime.
- Declarative doc definition matches the highly-structured SOW shape well.
- `pdf-lib` for counting pages of the resulting buffer.

`@react-pdf/renderer` considered and deferred — larger bundle, no immediate benefit for this shape of content. Revisit if future doc types (invoices, change orders) want React composition.

### 6.4 sow-1 pointer text

```ts
`See attached Scope of Work document (${pageCount} ${pageCount === 1 ? 'page' : 'pages'}) — full details of the Proposed Scope of Work.`
```

sow-2 = empty string.

Signature blocks on the template's sow-1/sow-2 pages are **unaffected** — we only change the text field values, not the template itself.

### 6.5 Attaching the PDF

**Hypothesized endpoint** (confirmed at impl time, see §9):
```
POST https://sign.zoho.com/api/v1/requests/{request_id}
Content-Type: multipart/form-data
Body:
  data={JSON, typically empty object}
  file=<PDF binary, filename: scope-of-work-{proposal.label}.pdf>
```

Based on Zoho's `/requests` creation pattern (documented multipart shape) and the `addFilesToRequest` SDK method which wraps an underlying REST call. The exact path will be validated via live test before code lands (§9).

**New contractService method:**

```ts
addFilesToRequest: async (
  requestId: string,
  files: Array<{ name: string; buffer: Buffer; mime: string }>,
) => Promise<void>
```

**Reference-only attached file:** the PDF has no signer action fields of its own. Per Zoho's model, actions are per-envelope not per-file; signatures render only where fields exist. Files without fields become static reference pages in the signed packet. Also validated via live test in §9.

## 7. Error handling

| Failure point | Behavior | Recovery |
|---|---|---|
| `buildSowDocDefinition` throws (corrupt Tiptap JSON) | Throws from QStash job → Upstash retries | No draft exists; retry or manual fix |
| `pdfService.generateSowPdf` throws | Same as above | Same |
| `createFromTemplate` 4xx (like today's overflow) | Throws with response body | Upstash retries; observability via #134 |
| `addFilesToRequest` fails **after** draft was created | Draft exists with pointer text but no attachment — unsafe state | Call `deleteRequest(requestId)` to clean up, then re-throw. Next retry creates fresh draft. Follows existing `ensureDraftSynced` delete-then-recreate pattern |
| `updateProposal` succeeds after both Zoho calls succeeded | Normal success path | None needed |
| `updateProposal` fails at end | Zoho draft exists but local `signingRequestId` not saved; next retry creates duplicate | Log as P0 inconsistency (pre-existing risk on short path too, not new here). Manual cleanup: look up request by customer email, save ID |

Wrap the long-path orchestration in a single try/catch so the cleanup branch fires exactly once:

```ts
async function createDraftLong(proposalId, ownerKey) {
  const pdfBuffer = await pdfService.generateSowPdf({ proposalId })
  const pageCount = await countPdfPages(pdfBuffer)
  const { templateId, body } = buildSigningRequest(proposal, { mode: 'long', sowPages: pageCount })

  const draftRes = await createFromTemplate(templateId, body, false)
  const { request_id: requestId } = parseDraft(draftRes)

  try {
    await addFilesToRequest(requestId, [{
      name: `scope-of-work-${proposal.label || proposalId}.pdf`,
      buffer: pdfBuffer,
      mime: 'application/pdf',
    }])
  } catch (err) {
    await deleteRequest(requestId).catch(() => {})   // best-effort cleanup
    throw err
  }

  await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
  return { requestId }
}
```

## 8. Testing

### 8.1 Unit tests

- `packSowText` — the 7 cases in §5.3.
- `isLongSow(text)` — boundaries at 3599, 3600, 3601.
- `buildSowDocDefinition(proposal)` — snapshot tests with 3 fixtures: today's failing proposal, a short-path proposal, a single-item long proposal. Fixtures redact PII.
- `tiptapToPdfmake` — one test per node type listed in §6.2, plus unknown-type fallthrough.
- `countPdfPages(buffer)` — sanity test with a known-size generated PDF.

### 8.2 Integration tests (require Zoho sandbox / test creds)

- `contractService.createDraft` short path → draft has populated sow-1/sow-2, `signingRequestId` saved, sow-1 ≤ 2000 chars, sow-2 ≤ 2000 chars.
- `contractService.createDraft` long path → draft has pointer in sow-1, empty sow-2, attached PDF is present, `signingRequestId` saved.
- `ensureDraftSynced` with an existing stale `signingRequestId` → deletes + recreates correctly on both paths.
- Simulated `addFilesToRequest` failure → old draft is deleted, error re-thrown.

### 8.3 Manual smoke test (pre-merge gate)

1. Create a test proposal in staging with a 7,000-char SOW (copy from today's failed proposal).
2. Send to a test customer email address we control.
3. Verify email received, envelope has main contract + attached SOW PDF.
4. Verify SOW PDF renders all content, per-item on new pages, no pricing/customer block.
5. Sign from the customer side; verify signatures apply only to main contract pages.
6. Verify `signingRequestId` saved on proposal row.

## 9. Pre-flight verifications (first implementation step)

Before any production code lands, validate the two impl-time unknowns with a throwaway test draft (same pattern as `scripts/replay-zoho-draft.ts`):

1. Create a draft via `createFromTemplate` on the base template.
2. Attach a 1-page dummy PDF via `POST /api/v1/requests/{id}` multipart. If 404, try `/requests/{id}/addfiles`, `/requests/{id}/documents`, inspect error bodies.
3. Record the confirmed endpoint + required multipart field names.
4. Fetch the draft details; verify two files listed, verify no actions attached to the uploaded file.
5. Submit the draft to a test email; verify both files render in the signed packet, signatures only on the first file.
6. Delete the draft.
7. Update this spec's §6.5 with the confirmed endpoint and delete any fallback branches from the implementation.

## 10. Rollout

### Phase 1 — Ship dark (no visible behavior change for existing proposals)

- Merge the fix. All current proposals (SOW < 3600 chars, overwhelmingly common) continue on the short path; only change they see is smarter packing (no mid-word breaks).
- Long path is available but unused until a proposal actually needs it.

### Phase 2 — Un-stick `baaf55ef…`

- Run a one-off: `contractService.ensureDraftSynced('baaf55ef-31b1-4393-b721-cdba21610021', null)`. No existing `signingRequestId`, so it follows the fresh-draft branch → long path → creates draft + attachment.
- Verify via Zoho console that the envelope is correct.
- Resend the signing email to the customer (existing UI action).

### Phase 3 — Observability

- Add a single log line per path: `log.info('zoho sign draft created', { proposalId, path: 'short'|'long', sowChars, pdfPages? })`.
- Monitor Upstash QStash console for a week. Count long-path hits; if frequent (>5% of sends), calibrate threshold or bump `SOW_FIELD_MAX_CHARS` toward 2040.

## 11. Backward compatibility

- No DB migrations. `signingRequestId` column already works the same for both paths.
- In-flight drafts created under old slicing logic are unaffected — once signed, they stay signed. If recalled and resent (existing UI), they go through the new flow.
- The Zoho template is unchanged; no risk of the tpr-HI-senior deletion-class incident recurring from this change.

## 12. Open questions / Impl-time TODOs

- [ ] Confirm `addFilesToRequest` endpoint path (§9, pre-flight step).
- [ ] Confirm reference-only file behavior — attached PDF with no fields renders correctly in signed packet (§9, pre-flight step).
- [ ] Decide `pdfmake` font loading strategy (bundled vs fonts.json) — depends on final runtime bundle size budget.
- [ ] Sanitize customer name for filename (`scope-of-work-{label}.pdf`) — replace `/`, `\`, unicode control chars.

## 13. Follow-ups tracked elsewhere

- [#134](https://github.com/OlisDevSpot/tri-pros-website/issues/134) — QStash job error observability. When landed, the overflow-throw guardrail in §5.2 will surface to agent UI automatically.
- Admin inspection of "which path this proposal took" — defer; add if needed after Phase 3 monitoring.
- Long-SOW threshold recalibration — Phase 3 telemetry-driven.
