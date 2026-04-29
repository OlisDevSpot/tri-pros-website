import type { Buffer } from 'node:buffer'
import type { EnvelopeDocument, ProposalContext } from './types'
import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { ZOHO_SIGN_BASE_URL } from '../constants'
import { getZohoAccessToken } from '../lib/get-access-token'
import { validateEnvelopeSelection } from './evaluate'
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
 * Throws on invalid selection (missing required / forbidden present)
 * via validateEnvelopeSelection. On Zoho API failure, attempts cleanup
 * via deleteRequest before rethrowing so the QStash retry isn't stuck
 * with a half-built envelope.
 */
export async function assembleEnvelope(ctx: ProposalContext): Promise<AssembleResult> {
  const selection = ctx.proposal.formMetaJSON.envelopeDocumentIds ?? []
  validateEnvelopeSelection(ctx, selection)

  // Canonicalize order against the registry — agent-submitted order is
  // ignored; envelope documents render in the registry's declared order.
  const orderedDocs = ENVELOPE_DOCUMENTS.filter(d => selection.includes(d.id))
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
  const mergeRes = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/templates/mergesend`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: mergeBody,
  })
  if (!mergeRes.ok) {
    throw new Error(`Zoho mergesend failed (${mergeRes.status}): ${await mergeRes.text()}`)
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
