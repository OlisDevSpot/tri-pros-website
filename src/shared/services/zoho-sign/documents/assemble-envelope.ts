import type { Buffer } from 'node:buffer'
import type { EnvelopeDocument, ProposalContext } from './types'
import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { SOW_INLINE_MAX_CHARS, ZOHO_SIGN_BASE_URL } from '../constants'
import { getZohoAccessToken } from '../lib/get-access-token'
import { evaluateDocuments } from './evaluate'
import { ENVELOPE_DOCUMENTS } from './registry'

interface ZohoMergeSendResponse {
  code?: number
  status?: string
  requests?: {
    request_id: string
    request_status: string
  }
}

interface AttachFile {
  name: string
  buffer: Buffer
  mime: string
}

interface AssembleResult {
  requestId: string
  status: string
  documentIds: EnvelopeDocumentId[]
}

/**
 * Builds and submits a Zoho Sign envelope from the agent-selected
 * documents. Each selected zoho-template document contributes its
 * fields + signer action_ids; each generated-pdf document is rendered
 * to a buffer and attached after the envelope is created.
 *
 * Recipient unification is automatic — listing the same email under
 * multiple template-level action_ids collapses to one envelope-level
 * recipient (verified in Phase 1's smoke tests). Field data is global
 * per envelope: identical labels across templates fill once.
 *
 * Self-heals against context drift: required docs are determined by
 * registry rules at assembly time (not by saved selection), so a SOW
 * that grew past the inline threshold, a threshold change, or any other
 * predicate flip after the agent saved auto-includes the now-required
 * docs. The saved selection is treated as the agent's *optional*
 * preferences — it's intersected with currently-optional docs and
 * unioned with currently-required docs.
 *
 * On Zoho API failure, attempts cleanup via deleteRequest before
 * rethrowing so the QStash retry isn't stuck with a half-built envelope.
 */
export async function assembleEnvelope(ctx: ProposalContext): Promise<AssembleResult> {
  const savedSelection = new Set(ctx.proposal.formMetaJSON.envelopeDocumentIds ?? [])
  const evaluation = evaluateDocuments(ctx)
  const optionalSet = new Set(evaluation.optional)

  // Effective envelope: all currently-required + saved-optionals that are
  // still applicable. Anything saved that's now forbidden is silently
  // dropped; anything required but not previously saved is silently added.
  const effectiveIds = new Set<EnvelopeDocumentId>([
    ...evaluation.required,
    ...[...savedSelection].filter(id => optionalSet.has(id)),
  ])

  const drift = computeDrift(savedSelection, effectiveIds, evaluation)
  if (drift.added.length > 0 || drift.dropped.length > 0) {
    console.warn('[zoho-sign] envelope selection drifted from saved — self-healing', {
      proposalId: ctx.proposal.id,
      kind: ctx.kind,
      saved: [...savedSelection],
      effective: [...effectiveIds],
      added: drift.added,
      dropped: drift.dropped,
    })
  }

  // Canonicalize order against the registry — agent-submitted order is
  // ignored; envelope documents render in the registry's declared order.
  const orderedDocs = ENVELOPE_DOCUMENTS.filter(d => effectiveIds.has(d.id))
  const templateDocs = orderedDocs.filter(d => d.source.kind === 'zoho-template')
  const pdfDocs = orderedDocs.filter(d => d.source.kind === 'generated-pdf')

  if (templateDocs.length === 0) {
    throw new Error('assembleEnvelope: at least one zoho-template document is required (cannot build an envelope from PDFs alone)')
  }

  const token = await getZohoAccessToken()

  // Step 1: mergesend creates a multi-template envelope and returns one
  // request_id. POST /api/v1/templates/mergesend (form-urlencoded):
  // template_ids=[...]&data={...}&is_quicksend=false. See
  // docs/zoho-sign/research-notes.md for the full API shape.
  const mergeBody = buildMergeSendBody(ctx, templateDocs)
  // Pre-flight diagnostics: prints field lengths + threshold so a stale
  // dev server (or unexpected text field bloat) is immediately visible
  // without waiting for Zoho to fail.
  logMergeSendDiagnostics(ctx, mergeBody)
  const mergeRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/templates/mergesend`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: mergeBody,
  })
  if (!mergeRes.ok) {
    const responseText = await mergeRes.text()
    // Log the full request payload alongside the response so we can diagnose
    // field-validation / action-id / template-id mismatches without re-running.
    console.error('[zoho-sign] mergesend failed', {
      status: mergeRes.status,
      response: responseText,
      proposalId: ctx.proposal.id,
      kind: ctx.kind,
      templateIds: templateDocs.flatMap(d => d.source.kind === 'zoho-template' ? [d.source.zohoTemplateId] : []),
      requestBody: mergeBody,
    })
    let zohoCode: number | undefined
    let zohoMessage: string | undefined
    try {
      const parsed = JSON.parse(responseText) as { code?: number, message?: string }
      zohoCode = parsed.code
      zohoMessage = parsed.message
    }
    catch {}
    const detail = zohoCode != null
      ? `code ${zohoCode} — ${zohoMessage ?? responseText}`
      : responseText
    throw new Error(`Zoho mergesend failed (${mergeRes.status}): ${detail}`)
  }
  const mergeJson = (await mergeRes.json()) as ZohoMergeSendResponse
  const requestId = mergeJson.requests?.request_id
  if (!requestId) {
    throw new Error(`Zoho mergesend returned no request_id: ${JSON.stringify(mergeJson)}`)
  }

  // Step 2: attach each generated PDF. Failure here leaves the envelope
  // half-built — delete and let the next QStash retry create fresh.
  if (pdfDocs.length > 0) {
    try {
      const files: AttachFile[] = []
      for (const doc of pdfDocs) {
        if (doc.source.kind !== 'generated-pdf') {
          continue
        }
        const buffer = await doc.source.generator(ctx)
        files.push({
          name: sanitizeFilename(`${doc.id}-${ctx.proposal.label || ctx.proposal.id}.pdf`),
          buffer,
          mime: 'application/pdf',
        })
      }
      await attachFiles(token, requestId, files)
    }
    catch (attachErr) {
      await deleteRequest(token, requestId).catch(() => {})
      throw attachErr
    }
  }

  // Step 3: enforce registry order across templates. mergesend re-sorts
  // template_ids by template_id ASC (verified via probe-mergesend-order.ts:
  // sending [awd, materialOrder] OR [materialOrder, awd] both produce
  // [materialOrder, awd] because materialOrder's id < awd's id). For
  // additional-work envelopes that include material-order, this lands
  // material-order at document_order=0 instead of awd. Reorder via the
  // existing PUT /requests/{id} endpoint with a `requests.document_ids`
  // array — undocumented but verified working (probe-reorder-thorough.ts
  // shapes P3/P4/P8). No-op when current order already matches registry.
  try {
    await reorderToRegistryOrder(token, requestId, templateDocs, pdfDocs.length)
  }
  catch (reorderErr) {
    // Don't tear down the envelope for a reorder failure — log and continue;
    // the envelope is still legally valid even if doc order is off.
    console.warn('[zoho-sign] reorder failed (envelope still valid)', {
      proposalId: ctx.proposal.id,
      requestId,
      error: reorderErr instanceof Error ? reorderErr.message : String(reorderErr),
    })
  }

  return {
    requestId,
    status: mergeJson.requests?.request_status ?? 'draft',
    documentIds: orderedDocs.map(d => d.id),
  }
}

/**
 * Builds the form-urlencoded body for POST /templates/mergesend.
 * Field data is global per envelope (flat field_text_data /
 * field_date_data), so identical labels across templates fill once.
 */
function buildMergeSendBody(ctx: ProposalContext, templateDocs: readonly EnvelopeDocument[]): string {
  const templateIds: string[] = []
  const textData: Record<string, string> = {}
  const dateData: Record<string, string> = {}
  const actions: Record<string, unknown>[] = []

  const customerName = ctx.proposal.customer?.name ?? ''
  const customerEmail = ctx.proposal.customer?.email ?? ''

  for (const doc of templateDocs) {
    if (doc.source.kind !== 'zoho-template') {
      continue
    }
    templateIds.push(doc.source.zohoTemplateId)

    if (doc.fieldMappings) {
      for (const [field, source] of Object.entries(doc.fieldMappings)) {
        textData[field] = source(ctx)
      }
    }
    if (doc.dateFieldMappings) {
      for (const [field, source] of Object.entries(doc.dateFieldMappings)) {
        dateData[field] = source(ctx)
      }
    }

    if (doc.signerActions?.contractor) {
      actions.push({
        recipient_name: 'Tri Pros Remodeling',
        recipient_email: 'info@triprosremodeling.com',
        action_id: doc.signerActions.contractor,
        action_type: 'SIGN',
        signing_order: 1,
        role: 'Contractor',
        verify_recipient: false,
        private_notes: '',
      })
    }
    if (doc.signerActions?.homeowner) {
      actions.push({
        recipient_name: customerName,
        recipient_email: customerEmail,
        action_id: doc.signerActions.homeowner,
        action_type: 'SIGN',
        signing_order: 2,
        role: 'Homeowner',
        verify_recipient: true,
        verification_type: 'EMAIL',
        private_notes: '',
      })
    }
  }

  const data = {
    templates: {
      request_name: buildEnvelopeName(ctx),
      field_data: {
        field_text_data: textData,
        field_boolean_data: {},
        field_date_data: dateData,
        field_radio_data: {},
      },
      actions,
      notes: '',
    },
  }

  const body = new URLSearchParams()
  body.set('template_ids', JSON.stringify(templateIds))
  body.set('data', JSON.stringify(data))
  body.set('is_quicksend', 'false')
  return body.toString()
}

/**
 * Builds a human-readable envelope name for office agents browsing
 * the Zoho Sign dashboard. Default (no override) would be the first
 * merged template's name ("tpr-HI"), which is unhelpful when scanning
 * dozens of customer agreements at once.
 *
 * Format: "{customer} — {kind label}[ — {proposal label}]"
 *  - "Patricia Zanders — Initial Sale Agreement"
 *  - "Patricia Zanders — Additional Work Addendum — Bathroom Add-on"
 */
function buildEnvelopeName(ctx: ProposalContext): string {
  const customer = ctx.proposal.customer?.name?.trim() || '(Unknown Customer)'
  const kindLabel = ctx.kind === 'initial-sale'
    ? 'Initial Sale Agreement'
    : 'Additional Work Addendum'
  const proposalLabel = ctx.proposal.label?.trim()
  const suffix = proposalLabel ? ` — ${proposalLabel}` : ''
  return `${customer} — ${kindLabel}${suffix}`
}

interface ZohoGetResponse {
  requests?: {
    template_ids?: string[]
    document_ids?: { document_id: string, document_order: string, document_name: string }[]
  }
}

/**
 * Reorders the envelope's documents to match the registry's template
 * order, leaving any attached PDFs at the end in attach order. No-op when
 * current order already matches.
 *
 * Mapping strategy (no name-matching needed):
 *  - Zoho's mergesend places templates at positions [0..N-1] in
 *    template_id ASC order. The GET response's `template_ids` array
 *    is also in template_id ASC, so `template_ids[i]` corresponds to
 *    `currentDocs[i].document_id` for i < N (verified via
 *    probe-templates-used.ts).
 *  - PDFs occupy positions [N..N+M-1] in attach order — the same order
 *    they appeared in our addFilesToRequest call, which mirrors the
 *    registry's filtered pdfDocs order.
 *
 * The PUT body wraps `document_ids` in `data.requests` (form-urlencoded
 * multipart `data` field). The endpoint accepts undocumented
 * `document_ids: [{ document_id, document_order }, ...]` shape that
 * also accepts other request fields without re-validating them — verified
 * via probe-reorder-thorough.ts shapes P3/P4/P8.
 */
async function reorderToRegistryOrder(
  token: string,
  requestId: string,
  templateDocs: readonly EnvelopeDocument[],
  numPdfs: number,
): Promise<void> {
  // GET current state
  const getRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  })
  if (!getRes.ok) {
    throw new Error(`Zoho GET request failed (${getRes.status}): ${await getRes.text()}`)
  }
  const j = (await getRes.json()) as ZohoGetResponse
  const currentDocs = (j.requests?.document_ids ?? []).slice().sort(
    (a, b) => Number(a.document_order) - Number(b.document_order),
  )
  const sentTemplateIds = j.requests?.template_ids ?? []

  // Sanity: number of templates returned must match what we sent
  const numTemplates = sentTemplateIds.length
  if (currentDocs.length !== numTemplates + numPdfs) {
    throw new Error(`Document count mismatch — expected ${numTemplates + numPdfs} (${numTemplates} templates + ${numPdfs} PDFs), got ${currentDocs.length}`)
  }

  // template_id → document_id for templates in their natural (Zoho-sorted) positions
  const tidToDocId = new Map<string, string>()
  for (let i = 0; i < numTemplates; i++) {
    tidToDocId.set(sentTemplateIds[i], currentDocs[i].document_id)
  }

  // Build desired order: registry-order templates first, then PDFs in their current attach order
  const desired: { document_id: string, document_order: string }[] = []
  let order = 0
  for (const doc of templateDocs) {
    if (doc.source.kind !== 'zoho-template') {
      continue
    }
    const docId = tidToDocId.get(doc.source.zohoTemplateId)
    if (!docId) {
      throw new Error(`No Zoho document found for template_id ${doc.source.zohoTemplateId}`)
    }
    desired.push({ document_id: docId, document_order: String(order++) })
  }
  for (let i = numTemplates; i < currentDocs.length; i++) {
    desired.push({ document_id: currentDocs[i].document_id, document_order: String(order++) })
  }

  // No-op when registry order already matches Zoho's natural sort
  const currentSerialized = currentDocs.map(d => d.document_id).join(',')
  const desiredSerialized = desired.map(d => d.document_id).join(',')
  if (currentSerialized === desiredSerialized) {
    return
  }

  const body = new URLSearchParams()
  body.set('data', JSON.stringify({ requests: { document_ids: desired } }))
  const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Zoho reorder PUT failed (${res.status}): ${await res.text()}`)
  }
}

/** Multipart attach via PUT /requests/{id}. Mirrors contract.service.ts addFilesToRequest. */
async function attachFiles(token: string, requestId: string, files: AttachFile[]): Promise<void> {
  if (files.length === 0) {
    return
  }
  const form = new FormData()
  form.append('data', JSON.stringify({ requests: {} }))
  for (const f of files) {
    form.append('file', new Blob([new Uint8Array(f.buffer)], { type: f.mime }), f.name)
  }
  const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
    method: 'PUT',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    body: form,
  })
  if (!res.ok) {
    throw new Error(`Zoho addFilesToRequest failed (${res.status}): ${await res.text()}`)
  }
}

/** Recall + delete. Best-effort cleanup on attach failure. */
async function deleteRequest(token: string, requestId: string): Promise<void> {
  await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}/delete`, {
    method: 'PUT',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recall_inprogress: true }),
  })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/]/g, '_').replace(/\s+/g, '_').slice(0, 200)
}

/**
 * Reports what the assembler self-healed: `added` are docs the rules now
 * require that the agent's saved selection didn't include; `dropped` are
 * docs the agent had saved that are no longer applicable (forbidden or
 * required-when-false). Used purely for warn-logging — the assembler
 * doesn't act on it; effectiveIds is already correct.
 */
function computeDrift(
  saved: Set<EnvelopeDocumentId>,
  effective: Set<EnvelopeDocumentId>,
  evaluation: ReturnType<typeof evaluateDocuments>,
): { added: EnvelopeDocumentId[], dropped: EnvelopeDocumentId[] } {
  const added = [...effective].filter(id => !saved.has(id))
  const forbiddenSet = new Set(evaluation.forbidden)
  const optionalSet = new Set(evaluation.optional)
  const dropped = [...saved].filter(id => forbiddenSet.has(id) || (!effective.has(id) && !optionalSet.has(id)))
  return { added, dropped }
}

/**
 * Pre-flight pretty-print of the merge body. Surfaces stale-bundle
 * issues (threshold mismatch) and unexpected field lengths before Zoho
 * has a chance to reject them with cryptic codes.
 */
function logMergeSendDiagnostics(ctx: ProposalContext, mergeBody: string): void {
  const params = new URLSearchParams(mergeBody)
  const dataRaw = params.get('data')
  if (!dataRaw) {
    return
  }
  try {
    const parsed = JSON.parse(dataRaw) as {
      templates?: { field_data?: { field_text_data?: Record<string, string>, field_date_data?: Record<string, string> } }
    }
    const textData = parsed.templates?.field_data?.field_text_data ?? {}
    const dateData = parsed.templates?.field_data?.field_date_data ?? {}
    const fieldLengths = Object.fromEntries(
      Object.entries(textData).map(([k, v]) => [k, v.length]),
    )
    console.warn('[zoho-sign] mergesend pre-flight', {
      proposalId: ctx.proposal.id,
      kind: ctx.kind,
      sowTextLength: ctx.sowText.length,
      isLongSow: ctx.isLongSow,
      sowInlineMaxChars: SOW_INLINE_MAX_CHARS,
      textFieldLengths: fieldLengths,
      dateFields: dateData,
      templateIds: params.get('template_ids'),
    })
  }
  catch (err) {
    console.warn('[zoho-sign] diagnostics parse failed', err)
  }
}
