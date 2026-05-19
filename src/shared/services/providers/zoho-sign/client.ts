import type { Buffer } from 'node:buffer'
import { ZOHO_SIGN_BASE_URL } from './constants'
import { getZohoAccessToken } from './lib/get-access-token'

// ---------------------------------------------------------------------------
// Types — Zoho-native, not shared outside provider
// ---------------------------------------------------------------------------

export interface AttachFile {
  name: string
  buffer: Buffer
  mime: string
}

export interface DocumentOrder {
  document_id: string
  document_order: string
}

interface ZohoCreateDocResponse {
  requests: {
    request_id: string
    request_status: string
  }
}

export interface ZohoMergeSendResponse {
  code?: number
  status?: string
  requests?: {
    request_id: string
    request_status: string
  }
}

export interface ZohoGetResponse {
  requests?: {
    request_id: string
    request_status: string
    template_ids?: string[]
    document_ids?: { document_id: string, document_order: string, document_name: string }[]
    actions?: { role: string, action_status: string }[]
  }
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function createZohoSignClient() {
  async function getAuthHeader() {
    const token = await getZohoAccessToken()
    return { Authorization: `Zoho-oauthtoken ${token}` }
  }

  /** Standard JSON request for non-template endpoints (recall, submit, get status, delete) */
  async function jsonRequest(path: string, options: RequestInit = {}) {
    const auth = await getAuthHeader()
    return fetch(`${ZOHO_SIGN_BASE_URL}/api/v1${path}`, {
      ...options,
      headers: {
        ...auth,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  return {
    /**
     * POST /templates/mergesend — creates a multi-template envelope.
     * Body is a pre-built URLSearchParams string (template_ids + data + is_quicksend).
     */
    async mergesend(body: string): Promise<ZohoMergeSendResponse> {
      const auth = await getAuthHeader()
      const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/templates/mergesend`, {
        method: 'POST',
        headers: {
          ...auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      if (!res.ok) {
        const responseText = await res.text()
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
        throw new Error(`Zoho mergesend failed (${res.status}): ${detail}`)
      }
      return res.json() as Promise<ZohoMergeSendResponse>
    },

    /**
     * POST /templates/{id}/createdocument — creates a draft from a single template.
     * Template endpoint uses form-encoded data={json} with is_quicksend as query param.
     */
    async createFromTemplate(
      templateId: string,
      body: object,
      quickSend: boolean,
    ): Promise<{ requestId: string, status: string }> {
      const auth = await getAuthHeader()
      const qs = `is_quicksend=${quickSend}`
      const res = await fetch(
        `${ZOHO_SIGN_BASE_URL}/api/v1/templates/${templateId}/createdocument?${qs}`,
        {
          method: 'POST',
          headers: {
            ...auth,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(JSON.stringify(body))}`,
        },
      )
      if (!res.ok) {
        throw new Error(`Zoho Sign create draft failed: ${await res.text()}`)
      }
      const data = await res.json() as ZohoCreateDocResponse
      const requestId = data.requests.request_id
      if (!requestId) {
        throw new Error('Zoho Sign returned no request_id')
      }
      return { requestId, status: data.requests.request_status }
    },

    /**
     * PUT /requests/{id} — multipart attach files to an existing draft.
     * Zoho requires the `requests` wrapper in the multipart `data` field;
     * an empty inner object means "keep the existing request metadata as-is,
     * just add the file(s)".
     */
    async attachFiles(requestId: string, files: AttachFile[]): Promise<void> {
      if (files.length === 0) {
        return
      }
      const auth = await getAuthHeader()
      const form = new FormData()
      form.append('data', JSON.stringify({ requests: {} }))
      for (const f of files) {
        form.append('file', new Blob([new Uint8Array(f.buffer)], { type: f.mime }), f.name)
      }
      const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
        method: 'PUT',
        headers: auth, // no explicit Content-Type; FormData sets multipart boundary
        body: form,
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho addFilesToRequest failed (${res.status}): ${errorText}`)
      }
    },

    /**
     * PUT /requests/{id} — reorder documents via form-urlencoded data.requests.document_ids.
     * Undocumented but verified working (probe-reorder-thorough.ts shapes P3/P4/P8).
     */
    async reorderDocuments(requestId: string, documentIds: DocumentOrder[]): Promise<void> {
      const auth = await getAuthHeader()
      const body = new URLSearchParams()
      body.set('data', JSON.stringify({ requests: { document_ids: documentIds } }))
      const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          ...auth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      if (!res.ok) {
        throw new Error(`Zoho reorder PUT failed (${res.status}): ${await res.text()}`)
      }
    },

    /** GET /requests/{id} — fetch current request state (documents, actions, status). */
    async getRequest(requestId: string): Promise<ZohoGetResponse> {
      const res = await jsonRequest(`/requests/${requestId}`, { method: 'GET' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho GET request failed (${res.status}): ${errorText}`)
      }
      return res.json() as Promise<ZohoGetResponse>
    },

    /** POST /requests/{id}/submit — submit a draft for signing. */
    async submit(requestId: string): Promise<void> {
      const res = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }
    },

    /** POST /requests/{id}/recall — cancel an in-progress signing request. */
    async recall(requestId: string): Promise<void> {
      const res = await jsonRequest(`/requests/${requestId}/recall`, { method: 'POST' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign recall failed: ${errorText}`)
      }
    },

    /** PUT /requests/{id}/delete — deletes a draft or recalls+deletes an in-progress request. */
    async deleteRequest(requestId: string): Promise<boolean> {
      const res = await jsonRequest(`/requests/${requestId}/delete`, {
        method: 'PUT',
        body: JSON.stringify({ recall_inprogress: true }),
      })
      return res.ok
    },
  }
}

export type ZohoSignClient = ReturnType<typeof createZohoSignClient>
export const zohoSignClient = createZohoSignClient()
