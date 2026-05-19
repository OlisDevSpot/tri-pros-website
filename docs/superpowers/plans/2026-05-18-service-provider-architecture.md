# Service & Provider Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `src/shared/services/` into a two-tier architecture (services + providers) and decompose `contracts.service.ts` by extracting Zoho Sign HTTP plumbing into a client + sync service.

**Architecture:** Flat `*.service.ts` files at services root (domain facades) + `providers/` subdirectory (external API clients + translators). `zoho-sync.service.ts` is the ACL facade between `contracts.service.ts` and the Zoho Sign provider. `assemble-envelope.ts` is refactored to use `client.ts` instead of raw `fetch()`.

**Tech Stack:** TypeScript, tRPC, Zoho Sign REST API, FormData multipart uploads

**Spec:** `docs/superpowers/specs/2026-05-18-service-provider-architecture-design.md`

---

## File Map

### Phase 1: Provider Directory Restructure (move-only)

| Action | Path |
|--------|------|
| Move | `services/zoho-sign/` → `services/providers/zoho-sign/` |
| Move | `services/google-calendar/` → `services/providers/google-calendar/` |
| Move | `services/google-drive/` → `services/providers/google-drive/` |
| Move | `services/google-maps/` → `services/providers/google-maps/` |
| Move | `services/quickbooks/` → `services/providers/quickbooks/` |
| Move | `services/r2/` → `services/providers/r2/` |
| Move | `services/resend/` → `services/providers/resend/` |
| Move | `services/notion/` → `services/providers/notion/` |
| Move | `services/push/` → `services/providers/push/` |
| Move | `services/upstash/` → `services/providers/upstash/` |
| Move | `services/gohighlevel/` → `services/providers/gohighlevel/` |
| Move | `services/pipedrive/` → `services/providers/pipedrive/` |
| Move | `services/ai/` → `services/providers/ai/` (wraps OpenAI via Vercel AI SDK — external API) |
| Move | `services/pdf/` → `shared/lib/pdf/` (local utility — pdfmake/pdf-lib, no external HTTP) |
| Rewrite | ~130 import paths across the codebase |

### Phase 2: Zoho Sign Decomposition

| Action | Path |
|--------|------|
| Create | `services/providers/zoho-sign/client.ts` — raw HTTP adapter |
| Create | `services/zoho-sync.service.ts` — ACL sync facade |
| Move | `providers/zoho-sign/documents/` → `providers/zoho-sign/lib/documents/` |
| Refactor | `providers/zoho-sign/lib/documents/assemble-envelope.ts` — use client instead of fetch |
| Refactor | `services/contracts.service.ts` — replace HTTP calls with zohoSyncService |
| Delete duplicates | `addFilesToRequest`, `sanitizeFilename`, `deleteRequest` from assemble-envelope.ts |

---

## Phase 1 Tasks

### Task 1: Create providers directory and move all provider directories

**Files:**
- Create: `src/shared/services/providers/` (directory)
- Move: 12 directories from `services/<name>/` to `services/providers/<name>/`

- [ ] **Step 1: Create providers directory and move all 13 provider dirs**

```bash
cd src/shared/services
mkdir -p providers
git mv zoho-sign providers/zoho-sign
git mv google-calendar providers/google-calendar
git mv google-drive providers/google-drive
git mv google-maps providers/google-maps
git mv quickbooks providers/quickbooks
git mv r2 providers/r2
git mv resend providers/resend
git mv notion providers/notion
git mv push providers/push
git mv upstash providers/upstash
git mv gohighlevel providers/gohighlevel
git mv pipedrive providers/pipedrive
git mv ai providers/ai
```

- [ ] **Step 2: Move `pdf/` to `shared/lib/pdf/` (local utility, not a provider)**

`pdf/` uses pdfmake + pdf-lib — purely local in-process generation with no external HTTP calls. It belongs in `shared/lib/`, not in services or providers.

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-193
mkdir -p src/shared/lib/pdf
git mv src/shared/services/pdf/* src/shared/lib/pdf/
rmdir src/shared/services/pdf
```

- [ ] **Step 3: Commit the directory moves**

```bash
git add -A src/shared/services/providers/ src/shared/services/
git commit -m "refactor: move provider directories into services/providers/"
```

### Task 2: Rewrite all imports — alias imports (`@/shared/services/<provider>`)

**Files:**
- Modify: ~125 files across `src/` and `scripts/` (every file that imports from a moved provider)

The import rewrite is mechanical: replace `@/shared/services/<provider>/` with `@/shared/services/providers/<provider>/` for all 12 provider names.

- [ ] **Step 1: Run sed to rewrite alias imports for each provider**

Run one sed command per provider. Order doesn't matter — no overlapping paths.

```bash
# From project root:

# zoho-sign (20 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/zoho-sign/|@/shared/services/providers/zoho-sign/|g"

# google-calendar (1 file)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/google-calendar/|@/shared/services/providers/google-calendar/|g"

# google-drive (6 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/google-drive/|@/shared/services/providers/google-drive/|g"

# google-maps (3 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/google-maps/|@/shared/services/providers/google-maps/|g"

# quickbooks (3 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/quickbooks/|@/shared/services/providers/quickbooks/|g"

# r2 (16 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/r2/|@/shared/services/providers/r2/|g"

# resend (5 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/resend/|@/shared/services/providers/resend/|g"

# notion (34 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/notion/|@/shared/services/providers/notion/|g"

# push (2 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/push/|@/shared/services/providers/push/|g"

# upstash (13 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/upstash/|@/shared/services/providers/upstash/|g"

# gohighlevel (1 file)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/gohighlevel/|@/shared/services/providers/gohighlevel/|g"

# pipedrive (1 file)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/pipedrive/|@/shared/services/providers/pipedrive/|g"

# ai (2 files)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/ai/|@/shared/services/providers/ai/|g"

# pdf → shared/lib/pdf (7 files — different target path!)
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/pdf/|@/shared/lib/pdf/|g"
```

- [ ] **Step 2: Fix relative imports within provider directories**

Some provider files import from sibling files using relative paths (`../constants`, `./types`, etc.). These still work because the entire directory moved together. But check for cross-provider relative imports that would now be broken:

```bash
# Check for any relative imports from one provider to another (should be zero)
grep -rn "from '\.\./\.\." src/shared/services/providers/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v "from '\.\./\.\./\.\." | head -20

# Check for relative imports that go UP past providers/ to services/
grep -rn "from '\.\./\.\." src/shared/services/providers/ --include='*.ts' --include='*.tsx' | grep -v node_modules | head -20
```

Any relative imports that go `../../` from within a provider dir and land on a service file (like `../../contracts.service`) would be a provider→service dependency violation. Fix by converting to alias imports.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. If there are errors, they'll be unresolved import paths — fix each one.

- [ ] **Step 4: Verify lint passes**

```bash
pnpm lint
```

Expected: 0 errors (import sort rules may flag reordered imports — fix if needed).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rewrite all imports for providers/ directory restructure

Mechanical import path update: @/shared/services/<provider>/
→ @/shared/services/providers/<provider>/ for all 12 providers.
No logic changes."
```

---

## Phase 2 Tasks

### Task 3: Move `documents/` under `lib/` in zoho-sign provider

**Files:**
- Move: `providers/zoho-sign/documents/` → `providers/zoho-sign/lib/documents/`
- Modify: All files importing from `providers/zoho-sign/documents/` (~8 files)

- [ ] **Step 1: Move the documents directory**

```bash
cd src/shared/services/providers/zoho-sign
git mv documents lib/documents
```

- [ ] **Step 2: Fix imports**

Rewrite alias imports:

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-193
find src scripts -name '*.ts' -o -name '*.tsx' | xargs sed -i "s|@/shared/services/providers/zoho-sign/documents/|@/shared/services/providers/zoho-sign/lib/documents/|g"
```

Also fix relative imports within the documents dir itself (they reference `../constants`, `../lib/` etc. — the depth changed by one level now):

Check each file in `lib/documents/` for relative imports and fix paths. The files are:
- `assemble-envelope.ts` — imports `../constants`, `../lib/get-access-token`, `./evaluate`, `./registry`
- `evaluate.ts` — imports `./types`, `./registry`
- `registry.ts` — imports `../../pdf.service` (now goes further up), `../constants`, `./types`
- `proposal-context.ts` — imports from entities, no relative provider imports
- `types.ts` — imports from entities, no relative provider imports
- `labels.ts` — imports `./types`

After the move, relative imports inside `lib/documents/` that go to siblings in `lib/` (like `../get-access-token`) still work since they moved together. But imports that go up to `constants/` need an extra `../`:

```bash
# Fix assemble-envelope.ts: '../constants' → '../../constants'
# (it's now at lib/documents/ instead of documents/, so one more ../ to reach constants/)
cd src/shared/services/providers/zoho-sign
grep -rn "from '\.\." lib/documents/ --include='*.ts'
```

Inspect each result and fix relative paths that go up past `lib/`.

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move zoho-sign documents/ under lib/

Documents (registry, evaluation, assembly) are translation logic —
they map our proposal domain to Zoho's envelope domain."
```

### Task 4: Create `providers/zoho-sign/client.ts` — raw HTTP adapter

**Files:**
- Create: `src/shared/services/providers/zoho-sign/client.ts`
- Reference: `src/shared/services/contracts.service.ts` (extract from here)
- Reference: `src/shared/services/providers/zoho-sign/lib/documents/assemble-envelope.ts` (consolidate duplicates)

- [ ] **Step 1: Create the Zoho Sign client**

Create `src/shared/services/providers/zoho-sign/client.ts`:

```ts
import type { Buffer } from 'node:buffer'
import { ZOHO_SIGN_BASE_URL } from './constants'
import { getZohoAccessToken } from './lib/get-access-token'

// ── Zoho-native response types (provider-internal) ─────────────

interface ZohoCreateDocResponse {
  requests: {
    request_id: string
    request_status: string
  }
}

interface ZohoMergeSendResponse {
  code?: number
  status?: string
  requests?: {
    request_id: string
    request_status: string
  }
}

interface ZohoGetResponse {
  requests?: {
    request_id: string
    request_status: string
    template_ids?: string[]
    document_ids?: { document_id: string, document_order: string, document_name: string }[]
    actions?: {
      role: string
      action_status: string
    }[]
  }
}

export interface DocumentOrder {
  document_id: string
  document_order: string
}

export interface AttachFile {
  name: string
  buffer: Buffer
  mime: string
}

// ── Client factory ──────────────────────────────────────────────

function createZohoSignClient() {
  async function getAuthHeader() {
    const token = await getZohoAccessToken()
    return { Authorization: `Zoho-oauthtoken ${token}` }
  }

  async function getToken() {
    return getZohoAccessToken()
  }

  /** Standard JSON request for non-template endpoints */
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
    /** POST /templates/mergesend — multi-template envelope creation */
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

    /** POST /templates/{id}/createdocument — single-template creation */
    async createFromTemplate(templateId: string, body: object, quickSend: boolean): Promise<{ requestId: string, status: string }> {
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

    /** PUT /requests/{id} — multipart file attachment */
    async attachFiles(requestId: string, files: AttachFile[]): Promise<void> {
      if (files.length === 0) return
      const auth = await getAuthHeader()
      const form = new FormData()
      form.append('data', JSON.stringify({ requests: {} }))
      for (const f of files) {
        form.append('file', new Blob([new Uint8Array(f.buffer)], { type: f.mime }), f.name)
      }
      const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
        method: 'PUT',
        headers: auth,
        body: form,
      })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho attachFiles failed (${res.status}): ${errorText}`)
      }
    },

    /** PUT /requests/{id} — reorder documents via document_ids array */
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

    /** GET /requests/{id} — get request details */
    async getRequest(requestId: string): Promise<ZohoGetResponse> {
      const token = await getToken()
      const res = await fetch(`${ZOHO_SIGN_BASE_URL}/api/v1/requests/${requestId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      })
      if (!res.ok) {
        throw new Error(`Zoho GET request failed (${res.status}): ${await res.text()}`)
      }
      return res.json() as Promise<ZohoGetResponse>
    },

    /** POST /requests/{id}/submit — send for signing */
    async submit(requestId: string): Promise<void> {
      const res = await jsonRequest(`/requests/${requestId}/submit`, { method: 'POST' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign submit failed: ${errorText}`)
      }
    },

    /** POST /requests/{id}/recall — cancel signing */
    async recall(requestId: string): Promise<void> {
      const res = await jsonRequest(`/requests/${requestId}/recall`, { method: 'POST' })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign recall failed: ${errorText}`)
      }
    },

    /** PUT /requests/{id}/delete — delete draft or recall+delete */
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
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/providers/zoho-sign/client.ts
git commit -m "refactor: create zoho-sign client.ts — raw HTTP adapter

Extracts all Zoho Sign HTTP operations (mergesend, createFromTemplate,
attachFiles, reorderDocuments, getRequest, submit, recall, deleteRequest)
into a single client factory. Provider-native types in/out, auth centralized."
```

### Task 5: Refactor `assemble-envelope.ts` to use `client.ts`

**Files:**
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/assemble-envelope.ts`
- Reference: `src/shared/services/providers/zoho-sign/client.ts`

This task removes the duplicate HTTP functions from `assemble-envelope.ts` (`attachFiles`, `deleteRequest`, `sanitizeFilename`) and replaces raw `fetch()` calls with `zohoSignClient.*` calls.

- [ ] **Step 1: Rewrite assemble-envelope.ts**

Replace the file contents. Key changes:
- Import `zohoSignClient` and `AttachFile` from `../../client`
- Remove `attachFiles` function (duplicate — use `zohoSignClient.attachFiles`)
- Remove `deleteRequest` function (duplicate — use `zohoSignClient.deleteRequest`)
- Remove `sanitizeFilename` function (move to `../sanitize-filename.ts` shared helper)
- Replace direct `fetch()` in `assembleEnvelope` with `zohoSignClient.mergesend()`
- Replace direct `fetch()` in `reorderToRegistryOrder` with `zohoSignClient.getRequest()` and `zohoSignClient.reorderDocuments()`
- `assembleEnvelope` no longer calls `getZohoAccessToken()` directly — the client handles auth

```ts
import type { EnvelopeDocument, ProposalContext } from './types'
import type { AttachFile } from '../../client'
import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { SOW_INLINE_MAX_CHARS } from '../../constants'
import { zohoSignClient } from '../../client'
import { sanitizeFilename } from '../sanitize-filename'
import { evaluateDocuments } from './evaluate'
import { ENVELOPE_DOCUMENTS } from './registry'

interface AssembleResult {
  requestId: string
  status: string
  documentIds: EnvelopeDocumentId[]
}

/**
 * Builds and submits a Zoho Sign envelope from the agent-selected
 * documents. Uses zohoSignClient for all HTTP operations.
 *
 * Self-heals against context drift: required docs are determined by
 * registry rules at assembly time (not by saved selection).
 */
export async function assembleEnvelope(ctx: ProposalContext): Promise<AssembleResult> {
  const savedSelection = new Set(ctx.proposal.formMetaJSON.envelopeDocumentIds ?? [])
  const evaluation = evaluateDocuments(ctx)
  const optionalSet = new Set(evaluation.optional)

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

  const orderedDocs = ENVELOPE_DOCUMENTS.filter(d => effectiveIds.has(d.id))
  const templateDocs = orderedDocs.filter(d => d.source.kind === 'zoho-template')
  const pdfDocs = orderedDocs.filter(d => d.source.kind === 'generated-pdf')

  if (templateDocs.length === 0) {
    throw new Error('assembleEnvelope: at least one zoho-template document is required')
  }

  // Step 1: mergesend via client
  const mergeBody = buildMergeSendBody(ctx, templateDocs)
  logMergeSendDiagnostics(ctx, mergeBody)

  const mergeJson = await zohoSignClient.mergesend(mergeBody)
  const requestId = mergeJson.requests?.request_id
  if (!requestId) {
    throw new Error(`Zoho mergesend returned no request_id: ${JSON.stringify(mergeJson)}`)
  }

  // Step 2: attach PDFs via client
  if (pdfDocs.length > 0) {
    try {
      const files: AttachFile[] = []
      for (const doc of pdfDocs) {
        if (doc.source.kind !== 'generated-pdf') continue
        const buffer = await doc.source.generator(ctx)
        files.push({
          name: sanitizeFilename(`${doc.id}-${ctx.proposal.label || ctx.proposal.id}.pdf`),
          buffer,
          mime: 'application/pdf',
        })
      }
      await zohoSignClient.attachFiles(requestId, files)
    }
    catch (attachErr) {
      await zohoSignClient.deleteRequest(requestId).catch(() => {})
      throw attachErr
    }
  }

  // Step 3: reorder to registry order via client
  try {
    await reorderToRegistryOrder(requestId, templateDocs, pdfDocs.length)
  }
  catch (reorderErr) {
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
 */
function buildMergeSendBody(ctx: ProposalContext, templateDocs: readonly EnvelopeDocument[]): string {
  const templateIds: string[] = []
  const textData: Record<string, string> = {}
  const dateData: Record<string, string> = {}
  const actions: Record<string, unknown>[] = []

  const customerName = ctx.proposal.customer?.name ?? ''
  const customerEmail = ctx.proposal.customer?.email ?? ''

  for (const doc of templateDocs) {
    if (doc.source.kind !== 'zoho-template') continue
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

function buildEnvelopeName(ctx: ProposalContext): string {
  const customer = ctx.proposal.customer?.name?.trim() || '(Unknown Customer)'
  const kindLabel = ctx.kind === 'initial-sale'
    ? 'Initial Sale Agreement'
    : 'Additional Work Addendum'
  const proposalLabel = ctx.proposal.label?.trim()
  const suffix = proposalLabel ? ` — ${proposalLabel}` : ''
  return `${customer} — ${kindLabel}${suffix}`
}

/**
 * Reorders the envelope's documents to match the registry's template order.
 * Uses zohoSignClient for HTTP operations.
 */
async function reorderToRegistryOrder(
  requestId: string,
  templateDocs: readonly EnvelopeDocument[],
  numPdfs: number,
): Promise<void> {
  const j = await zohoSignClient.getRequest(requestId)
  const currentDocs = (j.requests?.document_ids ?? []).slice().sort(
    (a, b) => Number(a.document_order) - Number(b.document_order),
  )
  const sentTemplateIds = j.requests?.template_ids ?? []

  const numTemplates = sentTemplateIds.length
  if (currentDocs.length !== numTemplates + numPdfs) {
    throw new Error(`Document count mismatch — expected ${numTemplates + numPdfs}, got ${currentDocs.length}`)
  }

  const tidToDocId = new Map<string, string>()
  for (let i = 0; i < numTemplates; i++) {
    tidToDocId.set(sentTemplateIds[i], currentDocs[i].document_id)
  }

  const desired: { document_id: string, document_order: string }[] = []
  let order = 0
  for (const doc of templateDocs) {
    if (doc.source.kind !== 'zoho-template') continue
    const docId = tidToDocId.get(doc.source.zohoTemplateId)
    if (!docId) {
      throw new Error(`No Zoho document found for template_id ${doc.source.zohoTemplateId}`)
    }
    desired.push({ document_id: docId, document_order: String(order++) })
  }
  for (let i = numTemplates; i < currentDocs.length; i++) {
    desired.push({ document_id: currentDocs[i].document_id, document_order: String(order++) })
  }

  const currentSerialized = currentDocs.map(d => d.document_id).join(',')
  const desiredSerialized = desired.map(d => d.document_id).join(',')
  if (currentSerialized === desiredSerialized) return

  await zohoSignClient.reorderDocuments(requestId, desired)
}

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

function logMergeSendDiagnostics(ctx: ProposalContext, mergeBody: string): void {
  const params = new URLSearchParams(mergeBody)
  const dataRaw = params.get('data')
  if (!dataRaw) return
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
```

- [ ] **Step 2: Create shared `sanitize-filename.ts` helper**

Create `src/shared/services/providers/zoho-sign/lib/sanitize-filename.ts`:

```ts
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200)
}
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: wire assemble-envelope.ts through zohoSignClient

Replace raw fetch() calls with zohoSignClient.mergesend(),
zohoSignClient.attachFiles(), zohoSignClient.getRequest(),
zohoSignClient.reorderDocuments(). Remove duplicate attachFiles,
deleteRequest, sanitizeFilename functions."
```

### Task 6: Create `zoho-sync.service.ts` — ACL facade

**Files:**
- Create: `src/shared/services/zoho-sync.service.ts`
- Reference: `src/shared/services/providers/zoho-sign/client.ts`
- Reference: `src/shared/services/providers/zoho-sign/lib/documents/assemble-envelope.ts`

- [ ] **Step 1: Create the sync service**

Create `src/shared/services/zoho-sync.service.ts`:

```ts
import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import type { ZohoContractStatus, ZohoRequestStatus } from './providers/zoho-sign/types'
import type { ProposalContext } from './providers/zoho-sign/lib/documents/types'
import type { AttachFile } from './providers/zoho-sign/client'
import { zohoSignClient } from './providers/zoho-sign/client'
import { assembleEnvelope } from './providers/zoho-sign/lib/documents/assemble-envelope'
import { dedupeSignerStatuses } from './providers/zoho-sign/lib/dedupe-signer-statuses'
import { sanitizeFilename } from './providers/zoho-sign/lib/sanitize-filename'

interface CreateEnvelopeResult {
  requestId: string
  status: string
  documentIds: EnvelopeDocumentId[]
}

interface DraftResult {
  requestId: string
  status: string
}

function createZohoSyncService() {
  return {
    /**
     * Create a multi-template envelope from a proposal context.
     * Handles evaluation, mergesend, PDF attachment, and reorder.
     * This is the registry path (Phase-5+ proposals).
     */
    async createEnvelope(ctx: ProposalContext): Promise<CreateEnvelopeResult> {
      return assembleEnvelope(ctx)
    },

    /**
     * Create a single-template draft (legacy path for pre-Phase-5 proposals).
     * Template creation + optional file attachment with cleanup on failure.
     */
    async createLegacyDraft(templateId: string, body: object, files: AttachFile[]): Promise<DraftResult> {
      const { requestId, status } = await zohoSignClient.createFromTemplate(templateId, body, false)

      if (files.length > 0) {
        try {
          await zohoSignClient.attachFiles(requestId, files)
        }
        catch (attachErr) {
          await zohoSignClient.deleteRequest(requestId).catch(() => {})
          throw attachErr
        }
      }

      return { requestId, status }
    },

    /** Submit an existing draft for signing (costs credits). */
    async submitForSigning(requestId: string): Promise<void> {
      await zohoSignClient.submit(requestId)
    },

    /** Recall (cancel) an in-progress signing request. Best-effort — ignores errors. */
    async recallRequest(requestId: string): Promise<void> {
      await zohoSignClient.recall(requestId)
    },

    /** Recall (cancel) silently — for cases where failure is acceptable. */
    async recallRequestSilent(requestId: string): Promise<void> {
      await zohoSignClient.recall(requestId).catch(() => {})
    },

    /** Delete a draft or recall+delete an in-progress request. */
    async deleteRequest(requestId: string): Promise<boolean> {
      return zohoSignClient.deleteRequest(requestId)
    },

    /** Delete silently — for cleanup where failure is acceptable. */
    async deleteRequestSilent(requestId: string): Promise<void> {
      await zohoSignClient.deleteRequest(requestId).catch(() => {})
    },

    /** Get current signing status + deduplicated signer details. */
    async getRequestStatus(requestId: string): Promise<ZohoContractStatus> {
      const data = await zohoSignClient.getRequest(requestId)
      const req = data.requests
      if (!req) {
        throw new Error(`Zoho Sign status check returned no request data for ${requestId}`)
      }
      return {
        requestId: req.request_id,
        requestStatus: req.request_status as ZohoRequestStatus,
        signerStatuses: dedupeSignerStatuses(req.actions ?? []),
      }
    },

    /** Sanitize a filename for Zoho attachment. Exposed for legacy path in contracts.service. */
    sanitizeFilename,
  }
}

export type ZohoSyncService = ReturnType<typeof createZohoSyncService>
export const zohoSyncService = createZohoSyncService()
```

- [ ] **Step 2: Verify**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/zoho-sync.service.ts
git commit -m "refactor: create zoho-sync.service.ts — ACL facade

Bridge between domain services (contracts.service) and the Zoho Sign
provider. Orchestrates envelope creation, signing submission, recall,
status queries. No ScopedContext, no DAL — pure domain-to-provider bridge."
```

### Task 7: Refactor `contracts.service.ts` to use `zohoSyncService`

**Files:**
- Modify: `src/shared/services/contracts.service.ts`

This is the final refactoring. The public API stays identical — all consumers (`contracts.router.ts`, sync jobs, scripts) are unaffected.

- [ ] **Step 1: Rewrite contracts.service.ts**

Replace the full file contents:

```ts
import type { ContractEvent } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/lib/types'
import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
import { getBySigningRequestId, getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { contractEventColumn, contractEventIdempotencyPolicy, shouldAutoApproveOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'
import { pdfService } from '@/shared/services/pdf.service'
import { countPdfPages } from '@/shared/lib/pdf/count-pdf-pages'
import { buildProposalContext } from '@/shared/services/providers/zoho-sign/lib/documents/proposal-context'
import { buildSigningRequest } from '@/shared/services/providers/zoho-sign/lib/build-signing-request'
import { zohoSyncService } from '@/shared/services/zoho-sync.service'

function createContractService() {
  /**
   * Creates a Zoho Sign draft for a proposal. Two code paths:
   *
   * - **Registry path** (when `formMetaJSON.envelopeDocumentIds` is set):
   *   builds a ProposalContext and calls zohoSyncService.createEnvelope().
   *
   * - **Legacy path** (when the proposal has no `envelopeDocumentIds`):
   *   single-template creation via zohoSyncService.createLegacyDraft().
   */
  async function createDraft(ctx: ScopedContext, proposalId: string) {
    const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }

    const selection = proposal.formMetaJSON.envelopeDocumentIds ?? []
    if (selection.length > 0) {
      const proposalCtx = buildProposalContext(proposal)
      const { requestId, status } = await zohoSyncService.createEnvelope(proposalCtx)
      dalVerifySuccess(await proposalCrud.update(ctx, { id: proposalId, data: { signingRequestId: requestId } }))
      return { requestId, status }
    }

    // Legacy path: pre-Phase-5 proposals without an envelope-document selection.
    const pdfBuffer = await pdfService.generateSowPdf(ctx, { proposalId })
    const sowPages = await countPdfPages(pdfBuffer)
    const { templateId, body } = buildSigningRequest(proposal, { sowPages })

    const { requestId, status } = await zohoSyncService.createLegacyDraft(templateId, body, [{
      name: zohoSyncService.sanitizeFilename(`scope-of-work-${proposal.label || proposalId}.pdf`),
      buffer: pdfBuffer,
      mime: 'application/pdf',
    }])

    dalVerifySuccess(await proposalCrud.update(ctx, { id: proposalId, data: { signingRequestId: requestId } }))
    return { requestId, status }
  }

  return {
    /** Creates a draft signing request (not sent to signers). 0 credits if truly draft. */
    createSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (proposal.signingRequestId) {
        return { requestId: proposal.signingRequestId }
      }

      return createDraft(ctx, proposalId)
    },

    /** Submits an existing draft for signing. Creates a fresh draft first if none exists. */
    sendSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      let requestId = proposal.signingRequestId

      if (!requestId) {
        const result = await createDraft(ctx, proposalId)
        requestId = result.requestId
      }

      await zohoSyncService.submitForSigning(requestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: requestId,
          contractSentAt: new Date().toISOString(),
        },
      }))

      return { requestId }
    },

    /** Recalls (cancels) an in-progress signing request. Clears signingRequestId. */
    recallSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.signingRequestId) {
        throw new Error(`Proposal ${proposalId} has no signing request to recall`)
      }

      await zohoSyncService.recallRequest(proposal.signingRequestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: null,
          contractSentAt: null,
        },
      }))

      return { recalled: true }
    },

    /** Recalls existing request (if any), creates a fresh draft with current data, and submits it. */
    resendSigningRequest: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (proposal.signingRequestId) {
        await zohoSyncService.recallRequestSilent(proposal.signingRequestId)
      }

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: null,
          contractSentAt: null,
        },
      }))

      const { requestId } = await createDraft(ctx, proposalId)

      await zohoSyncService.submitForSigning(requestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: requestId,
          contractSentAt: new Date().toISOString(),
        },
      }))

      return { requestId }
    },

    /**
     * Ensures the Zoho Sign draft reflects current proposal data.
     * Deletes the existing request and creates a fresh draft.
     */
    ensureDraftSynced: async (ctx: ScopedContext, proposalId: string) => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (!proposal.signingRequestId) {
        return createDraft(ctx, proposalId)
      }

      await zohoSyncService.deleteRequestSilent(proposal.signingRequestId)

      dalVerifySuccess(await proposalCrud.update(ctx, {
        id: proposalId,
        data: {
          signingRequestId: null,
          contractSentAt: null,
        },
      }))

      return createDraft(ctx, proposalId)
    },

    getSigningStatus: async (requestId: string) => {
      return zohoSyncService.getRequestStatus(requestId)
    },

    /**
     * Applies a contract-signing event (from Zoho webhook) to the matching
     * proposal. Handles event->column mapping, idempotency, and auto-approve.
     */
    applyContractEvent: async (ctx: ScopedContext, input: {
      signingRequestId: string
      event: ContractEvent
      performedAt: string
    }) => {
      const { signingRequestId, event, performedAt } = input

      const proposal = dalVerifySuccess(await getBySigningRequestId(ctx, { signingRequestId }))
      if (!proposal) return undefined

      const column = contractEventColumn[event]
      const policy = contractEventIdempotencyPolicy[event]
      const existingValue = proposal[column as keyof typeof proposal] as string | null
      if (policy === 'write-once' && existingValue !== null) return undefined
      if (policy === 'earliest-wins' && existingValue !== null && existingValue <= performedAt) return undefined

      const setFields: Partial<InsertProposalSchema> = { [column]: performedAt }
      if (shouldAutoApproveOnContractEvent(event)) {
        setFields.status = 'approved'
        if (!proposal.approvedAt) {
          setFields.approvedAt = performedAt
        }
      }

      return dalVerifySuccess(await proposalCrud.update(ctx, { id: proposal.id, data: setFields }))
    },
  }
}

export type ContractService = ReturnType<typeof createContractService>
export const contractService = createContractService()
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Verify lint passes**

```bash
pnpm lint
```

- [ ] **Step 4: Verify no behavior change — check all consumers still import correctly**

```bash
# These should all still resolve:
grep -rn "contractService" src/trpc/ src/shared/services/upstash/ scripts/ --include='*.ts' | head -20
```

All 5 consumers should still work unchanged:
- `contracts.router.ts` — imports `contractService`, calls same 6 methods
- `sync-contract-draft.ts` — calls `contractService.ensureDraftSynced`
- `sync-zoho-sign-status.ts` — calls `contractService.applyContractEvent`
- `verify-short-path.ts` — calls `contractService.createSigningRequest`
- `verify-long-path.ts` — calls `contractService.createSigningRequest`

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/contracts.service.ts
git commit -m "refactor: slim contracts.service.ts — delegate HTTP to zohoSyncService

Remove all Zoho HTTP plumbing (getAuthHeader, jsonRequest,
createFromTemplate, addFilesToRequest, sanitizeFilename, parseDraftResponse).
Business logic stays: proposal reads, status writes, idempotency,
auto-approve. Public API unchanged — all consumers unaffected."
```

### Task 8: Final verification

**Files:**
- All modified files from Tasks 1-7

- [ ] **Step 1: Full TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Full lint check**

```bash
pnpm lint
```

Expected: 0 errors (or only pre-existing ones).

- [ ] **Step 3: Review the diff for unintended changes**

```bash
git diff main --stat
git diff main -- src/shared/services/contracts.service.ts
```

Verify:
- `contracts.service.ts` public API (the returned object methods) has identical signatures
- No Zoho URLs, `fetch()`, or auth headers remain in `contracts.service.ts`
- All Zoho HTTP calls are in `providers/zoho-sign/client.ts`
- `assemble-envelope.ts` has no duplicate helpers
- `zoho-sync.service.ts` has no `ScopedContext` or DAL imports

- [ ] **Step 4: Check import dependency direction**

```bash
# providers/ should NEVER import from services/*.service.ts
grep -rn "from '@/shared/services/[a-z].*\.service'" src/shared/services/providers/ --include='*.ts'
# Expected: 0 results (only exception: registry.ts imports pdf.service — this is pre-existing
# and acceptable because pdf.service is a pure internal service with no provider dependency)

# providers/ should NEVER import from DAL
grep -rn "from '@/shared/dal/" src/shared/services/providers/ --include='*.ts'
# Expected: 0 results
```

- [ ] **Step 5: Verify `assemble-envelope.ts` script still works**

The `scripts/verify-assemble-envelope.ts` imports `assembleEnvelope` directly. After the move, its import path changed in Task 2. Verify it resolves:

```bash
grep "assemble-envelope" scripts/verify-assemble-envelope.ts
# Should show: @/shared/services/providers/zoho-sign/lib/documents/assemble-envelope
```
