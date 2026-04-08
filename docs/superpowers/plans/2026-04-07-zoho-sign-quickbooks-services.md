# Full Services Layer Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire codebase to a domain services layer architecture. Replace DocuSign with Zoho Sign, add QuickBooks integration, extract email/notification/media business logic from routers into proper domain services, and create typed stubs for all future services.

**Architecture:** Domain services own all business logic. tRPC routers become thin (validate → authorize → delegate → return). QStash jobs call services, not SDK clients. Infrastructure modules (R2, Resend, Notion) are called by services directly — no pass-through wrappers.

**Tech Stack:** Zoho Sign REST API v1, QuickBooks Online Accounting API v3, Resend, R2, QStash, Drizzle ORM, factory function pattern (`createService()`)

**Spec:** `docs/superpowers/specs/2026-04-07-zoho-sign-quickbooks-services-design.md`
**Services Layer Plan:** `.claude/plans/inherited-dancing-valley.md`

---

## Dependency Graph

```
Phase 1 (Foundation — no dependencies, all parallel):
  A1: Zoho Sign SDK client
  A2: Zoho Sign build signing request
  A3: Env vars — remove DocuSign, add Zoho Sign
  B1: QB SDK client + token storage schema
  B2: QB OAuth callback route
  B3: Env vars — add QuickBooks
  B4: Schema — add QB reference columns + rename docusignEnvelopeId

Phase 2 (Domain services — depend on Phase 1):
  A4: contractService (depends on A1, A2, A3)
  B5: accountingService (depends on B1, B3, B4)
  D1: emailService (no dependencies)
  D2: notificationService (no dependencies)
  E1: mediaService (no dependencies)

Phase 3 (Jobs + webhooks + router refactoring — depend on Phase 2):
  B6: QStash jobs for QB (depends on B5)
  B7: QB webhook handler (depends on B6)
  D3: send-view-notification QStash job (depends on D2)
  A6: Delete DocuSign + refactor proposals.router.tsx (depends on A4, D1, D2, D3)
  D4: Refactor landing.router — use emailService (depends on D1)
  E2: Refactor optimizeImageJob — use mediaService (depends on E1)

Phase 4 (Stubs + cleanup):
  F1: Phase 5 service stubs (all 6)
  C1: Final verification
  C2: Update services layer plan
```

---

## Phase 1: Foundation

### Task A1: Zoho Sign SDK Client — Auth + Token Cache

**Files:**
- Create: `src/shared/services/zoho-sign/constants/index.ts`
- Create: `src/shared/services/zoho-sign/lib/access-token-cache.ts`
- Create: `src/shared/services/zoho-sign/lib/get-access-token.ts`

- [ ] **Step 1: Create constants file**

```ts
// src/shared/services/zoho-sign/constants/index.ts
import env from '@/shared/config/server-env'

export const ZOHO_SIGN_BASE_URL = env.NODE_ENV === 'production'
  ? 'https://sign.zoho.com'
  : 'https://sign.zoho.com'

export const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com'

export const ZOHO_SIGN_SCOPES = 'ZohoSign.documents.CREATE,ZohoSign.templates.READ'
```

- [ ] **Step 2: Create access token cache**

```ts
// src/shared/services/zoho-sign/lib/access-token-cache.ts
let cachedToken: {
  accessToken: string
  expiresAt: number
} | null = null

export function getCachedAccessToken() {
  if (!cachedToken)
    return null
  if (Date.now() > cachedToken.expiresAt)
    return null
  return cachedToken.accessToken
}

export function setCachedAccessToken(accessToken: string, expiresInMs: number) {
  cachedToken = {
    accessToken,
    expiresAt: Date.now() + expiresInMs - 300_000,
  }
}
```

- [ ] **Step 3: Create get-access-token using OAuth2 refresh flow**

```ts
// src/shared/services/zoho-sign/lib/get-access-token.ts
import env from '@/shared/config/server-env'
import { ZOHO_ACCOUNTS_URL } from '../constants'
import { getCachedAccessToken, setCachedAccessToken } from './access-token-cache'

export async function getZohoAccessToken(): Promise<string> {
  const cached = getCachedAccessToken()
  if (cached)
    return cached

  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ZOHO_SIGN_CLIENT_ID,
      client_secret: env.ZOHO_SIGN_CLIENT_SECRET,
      refresh_token: env.ZOHO_SIGN_REFRESH_TOKEN,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Zoho Sign token refresh failed: ${error}`)
  }

  const data = await res.json() as { access_token: string, expires_in: number }
  setCachedAccessToken(data.access_token, data.expires_in * 1000)
  return data.access_token
}
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/zoho-sign/
git commit -m "feat(zoho-sign): add SDK client with OAuth2 refresh token auth"
```

---

### Task A2: Zoho Sign SDK Client — Build Signing Request

**Files:**
- Create: `src/shared/services/zoho-sign/lib/build-signing-request.ts`

- [ ] **Step 1: Create the signing request builder**

This replaces `src/shared/services/docusign/lib/build-envelope-body.ts`. Same data mapping, Zoho Sign API shape.

```ts
// src/shared/services/zoho-sign/lib/build-signing-request.ts
import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import env from '@/shared/config/server-env'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'

const TEMPLATE_IDS = {
  base: env.NODE_ENV === 'production'
    ? 'ZOHO_PROD_BASE_TEMPLATE_ID'
    : 'ZOHO_DEV_BASE_TEMPLATE_ID',
  senior: env.NODE_ENV === 'production'
    ? 'ZOHO_PROD_SENIOR_TEMPLATE_ID'
    : 'ZOHO_DEV_SENIOR_TEMPLATE_ID',
}

export function buildSigningRequest(
  proposal: ProposalWithCustomer,
  quickSend: boolean,
) {
  const { customer, projectJSON, fundingJSON } = proposal
  const { data: project } = projectJSON
  const { data: funding } = fundingJSON

  const customerName = customer?.name ?? ''
  const customerEmail = customer?.email ?? ''
  const customerPhone = customer?.phone ?? ''
  const customerAddress = customer?.address ?? ''
  const customerCity = customer?.city ?? ''
  const customerState = customer?.state ?? 'CA'
  const customerZip = customer?.zip ?? ''

  const templateId = TEMPLATE_IDS.base

  const sowText = sowToPlaintext(proposal.projectJSON.data.sow ?? [])
  const sow1 = sowText.slice(0, 2000)
  const sow2 = sowText.slice(2000, 6000)

  const validThroughTimeframe = Number(project.validThroughTimeframe.replace(/\D/g, ''))
  const startDate = new Date()
  const completionDate = new Date()
  const daysToAdd = 3
  startDate.setDate(startDate.getDate() + daysToAdd)
  completionDate.setDate(startDate.getDate() + validThroughTimeframe)

  return {
    templateId,
    body: {
      templates: {
        field_data: {
          field_text_data: {
            'start-date': startDate.toLocaleDateString(),
            'completion-date': completionDate.toLocaleDateString(),
            'sow-1': sow1,
            'sow-2': sow2,
            'tcp': String(funding.finalTcp),
            'deposit': String(funding.depositAmount),
            'ho-address': customerAddress,
            'ho-city-state-zip': `${customerCity}, ${customerState} ${customerZip}`,
            'ho-phone': customerPhone,
          },
          field_boolean_data: {},
          field_date_data: {},
        },
        actions: [
          {
            action_type: 'SIGN',
            recipient_name: customerName,
            recipient_email: customerEmail,
            verify_recipient: true,
            verification_type: 'EMAIL',
          },
        ],
        notes: '',
      },
      is_quicksend: quickSend,
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/zoho-sign/lib/build-signing-request.ts
git commit -m "feat(zoho-sign): add signing request builder with proposal field mapping"
```

---

### Task A3: Env Vars — Remove DocuSign, Add Zoho Sign

**Files:**
- Modify: `src/shared/config/server-env.ts`

- [ ] **Step 1: Replace DocuSign env vars with Zoho Sign vars**

In `src/shared/config/server-env.ts`, replace:

```ts
  // DOCUSIGN
  DS_DEV_USER_ID: z.string().optional(),
  DS_USER_ID: z.string(),
  DS_ACCOUNT_ID: z.string(),
  DS_INTEGRATION_KEY: z.string(),
  DS_JWT_PRIVATE_KEY_PATH: z.string(),
  DS_JWT_PRIVATE_KEY: z.string(),
```

With:

```ts
  // ZOHO SIGN
  ZOHO_SIGN_CLIENT_ID: z.string(),
  ZOHO_SIGN_CLIENT_SECRET: z.string(),
  ZOHO_SIGN_REFRESH_TOKEN: z.string(),
```

- [ ] **Step 2: Add Zoho Sign values to `.env`, remove DS_* values**

- [ ] **Step 3: Commit**

```bash
git add src/shared/config/server-env.ts
git commit -m "chore(env): replace DocuSign env vars with Zoho Sign"
```

---

### Task B1: QuickBooks SDK Client — Auth + Token Storage

**Files:**
- Create: `src/shared/services/quickbooks/constants/index.ts`
- Create: `src/shared/services/quickbooks/types.ts`
- Create: `src/shared/db/schema/qb-auth-tokens.ts`
- Modify: `src/shared/db/schema/index.ts`
- Create: `src/shared/services/quickbooks/lib/access-token-cache.ts`
- Create: `src/shared/services/quickbooks/lib/get-access-token.ts`
- Create: `src/shared/services/quickbooks/client.ts`

- [ ] **Step 1: Create constants**

```ts
// src/shared/services/quickbooks/constants/index.ts
import env from '@/shared/config/server-env'

export const QB_BASE_URL = env.NODE_ENV === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com'

export const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
export const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
export const QB_API_MINOR_VERSION = '75'
```

- [ ] **Step 2: Create QB entity types**

```ts
// src/shared/services/quickbooks/types.ts

export interface QBCustomer {
  Id: string
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
  PrimaryPhone?: { FreeFormNumber: string }
  BillAddr?: {
    Line1?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
  }
  ParentRef?: { value: string }
  BillWithParent?: boolean
  SyncToken: string
}

export interface QBInvoice {
  Id: string
  DocNumber?: string
  TxnDate?: string
  DueDate?: string
  TotalAmt: number
  Balance: number
  CustomerRef: { value: string, name?: string }
  Line: QBInvoiceLine[]
  SyncToken: string
}

export interface QBInvoiceLine {
  Amount: number
  DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail'
  Description?: string
  SalesItemLineDetail?: {
    ItemRef: { value: string, name?: string }
    UnitPrice?: number
    Qty?: number
  }
}

export interface QBPayment {
  Id: string
  TotalAmt: number
  TxnDate: string
  CustomerRef: { value: string, name?: string }
  Line: {
    Amount: number
    LinkedTxn: { TxnId: string, TxnType: string }[]
  }[]
  SyncToken: string
}

export interface QBQueryResponse<T> {
  QueryResponse: Record<string, T[]> & {
    startPosition: number
    maxResults: number
  }
}
```

- [ ] **Step 3: Create qb-auth-tokens schema**

```ts
// src/shared/db/schema/qb-auth-tokens.ts
import type z from 'zod'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { id, updatedAt } from '../lib/schema-helpers'

export const qbAuthTokens = pgTable('qb_auth_tokens', {
  id,
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  realmId: text('realm_id').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt,
})

export const selectQbAuthTokenSchema = createSelectSchema(qbAuthTokens)
export type QbAuthToken = z.infer<typeof selectQbAuthTokenSchema>
```

- [ ] **Step 4: Export from schema index**

Add to `src/shared/db/schema/index.ts`:

```ts
export * from './qb-auth-tokens'
```

- [ ] **Step 5: Push schema**

Run: `pnpm db:push:dev`

- [ ] **Step 6: Create DB-backed token management**

```ts
// src/shared/services/quickbooks/lib/access-token-cache.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { qbAuthTokens } from '@/shared/db/schema/qb-auth-tokens'

export async function getStoredTokens() {
  const [row] = await db.select().from(qbAuthTokens).limit(1)
  return row ?? null
}

export async function upsertTokens(params: {
  accessToken: string
  refreshToken: string
  realmId: string
  expiresAt: string
}) {
  const existing = await getStoredTokens()

  if (existing) {
    await db.update(qbAuthTokens)
      .set({
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        realmId: params.realmId,
        expiresAt: params.expiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(qbAuthTokens.id, existing.id))
  }
  else {
    await db.insert(qbAuthTokens).values(params)
  }
}
```

- [ ] **Step 7: Create get-access-token with auto-refresh**

```ts
// src/shared/services/quickbooks/lib/get-access-token.ts
import env from '@/shared/config/server-env'
import { QB_TOKEN_URL } from '../constants'
import { getStoredTokens, upsertTokens } from './access-token-cache'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export async function getQBAccessToken(): Promise<{ accessToken: string, realmId: string }> {
  const stored = await getStoredTokens()

  if (!stored) {
    throw new Error('No QuickBooks tokens found. Complete OAuth setup at /api/quickbooks/callback first.')
  }

  const expiresAt = new Date(stored.expiresAt).getTime()
  const isExpired = Date.now() > expiresAt - 300_000

  if (!isExpired) {
    return { accessToken: stored.accessToken, realmId: stored.realmId }
  }

  const credentials = Buffer.from(`${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`).toString('base64')

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`QuickBooks token refresh failed: ${error}`)
  }

  const data = await res.json() as TokenResponse
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await upsertTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId: stored.realmId,
    expiresAt: newExpiresAt,
  })

  return { accessToken: data.access_token, realmId: stored.realmId }
}
```

- [ ] **Step 8: Create QB REST client wrapper**

```ts
// src/shared/services/quickbooks/client.ts
import { QB_API_MINOR_VERSION, QB_BASE_URL } from './constants'
import { getQBAccessToken } from './lib/get-access-token'

export async function qbRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken, realmId } = await getQBAccessToken()
  const separator = path.includes('?') ? '&' : '?'
  const url = `${QB_BASE_URL}/v3/company/${realmId}${path}${separator}minorversion=${QB_API_MINOR_VERSION}`

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`QuickBooks API error (${res.status}): ${error}`)
  }

  return res.json() as Promise<T>
}
```

- [ ] **Step 9: Commit**

```bash
git add src/shared/services/quickbooks/ src/shared/db/schema/qb-auth-tokens.ts src/shared/db/schema/index.ts
git commit -m "feat(quickbooks): add SDK client with OAuth2 token refresh and DB storage"
```

---

### Task B2: QuickBooks OAuth Callback Route

**Files:**
- Create: `src/app/api/quickbooks/callback/route.ts`

- [ ] **Step 1: Create the OAuth callback handler**

```ts
// src/app/api/quickbooks/callback/route.ts
import { NextResponse } from 'next/server'
import env from '@/shared/config/server-env'
import { QB_TOKEN_URL } from '@/shared/services/quickbooks/constants'
import { upsertTokens } from '@/shared/services/quickbooks/lib/access-token-cache'

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const realmId = url.searchParams.get('realmId')

  if (!code || !realmId) {
    return NextResponse.json(
      { error: 'Missing code or realmId query parameters' },
      { status: 400 },
    )
  }

  const credentials = Buffer.from(
    `${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`,
  ).toString('base64')

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.QB_REDIRECT_URI,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    return NextResponse.json(
      { error: `Token exchange failed: ${error}` },
      { status: 500 },
    )
  }

  const data = await res.json() as TokenResponse
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await upsertTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    realmId,
    expiresAt,
  })

  return NextResponse.json({
    success: true,
    message: 'QuickBooks connected successfully',
    realmId,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/quickbooks/callback/
git commit -m "feat(quickbooks): add OAuth callback route for initial token exchange"
```

---

### Task B3: Env Vars — Add QuickBooks

**Files:**
- Modify: `src/shared/config/server-env.ts`

- [ ] **Step 1: Add QB env vars**

In `src/shared/config/server-env.ts`, add after the ZOHO SIGN block:

```ts
  // QUICKBOOKS
  QB_CLIENT_ID: z.string(),
  QB_CLIENT_SECRET: z.string(),
  QB_REDIRECT_URI: z.string(),
  QB_WEBHOOK_VERIFIER_TOKEN: z.string(),
```

- [ ] **Step 2: Add values to `.env`**

- [ ] **Step 3: Commit**

```bash
git add src/shared/config/server-env.ts
git commit -m "chore(env): add QuickBooks OAuth env vars"
```

---

### Task B4: Schema — Add QB Reference Columns + Rename docusignEnvelopeId

**Files:**
- Modify: `src/shared/db/schema/proposals.ts`
- Modify: `src/shared/db/schema/customers.ts`
- Modify: `src/shared/db/schema/projects.ts`

- [ ] **Step 1: Rename column + add QB columns on proposals**

In `src/shared/db/schema/proposals.ts`, replace:

```ts
  docusignEnvelopeId: text('docusign_envelope_id'),
```

With:

```ts
  signingRequestId: text('signing_request_id'),
  qbInvoiceId: text('qb_invoice_id'),
  qbPaymentStatus: text('qb_payment_status'),
```

- [ ] **Step 2: Add qbCustomerId to customers**

In `src/shared/db/schema/customers.ts`, add after `notionContactId`:

```ts
  qbCustomerId: text('qb_customer_id'),
```

- [ ] **Step 3: Add qbSubCustomerId to projects**

In `src/shared/db/schema/projects.ts`, add after `status`:

```ts
  qbSubCustomerId: text('qb_sub_customer_id'),
```

- [ ] **Step 4: Push schema**

Run: `pnpm db:push:dev`

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema/proposals.ts src/shared/db/schema/customers.ts src/shared/db/schema/projects.ts
git commit -m "feat(schema): rename docusignEnvelopeId to signingRequestId, add QB reference columns"
```

---

## Phase 2: Domain Services

### Task A4: Contract Service

**Files:**
- Create: `src/shared/services/contract.service.ts`

- [ ] **Step 1: Create the contract service**

```ts
// src/shared/services/contract.service.ts
import { getProposal, updateProposal } from '@/shared/dal/server/proposals/api'
import { ZOHO_SIGN_BASE_URL } from '@/shared/services/zoho-sign/constants'
import { buildSigningRequest } from '@/shared/services/zoho-sign/lib/build-signing-request'
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

interface ZohoCreateDocResponse {
  requests: {
    request_id: string
    request_status: string
  }
}

function createContractService() {
  async function makeRequest(path: string, options: RequestInit) {
    const token = await getZohoAccessToken()
    return fetch(`${ZOHO_SIGN_BASE_URL}/api/v1${path}`, {
      ...options,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  return {
    createSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      if (proposal.signingRequestId) {
        return { requestId: proposal.signingRequestId }
      }

      const { templateId, body } = buildSigningRequest(proposal, false)

      const res = await makeRequest(
        `/templates/${templateId}/createdocument`,
        { method: 'POST', body: JSON.stringify(body) },
      )

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Zoho Sign create document failed: ${errorText}`)
      }

      const data = await res.json() as ZohoCreateDocResponse
      const requestId = data.requests.request_id

      if (!requestId) {
        throw new Error('Zoho Sign returned no request_id')
      }

      await updateProposal(ownerKey, proposalId, { signingRequestId: requestId })
      return { requestId }
    },

    sendSigningRequest: async (proposalId: string, ownerKey: string | null) => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`Proposal ${proposalId} not found`)
      }

      let requestId = proposal.signingRequestId

      if (requestId) {
        const res = await makeRequest(`/requests/${requestId}/submit`, { method: 'POST' })
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Zoho Sign submit failed: ${errorText}`)
        }
      }
      else {
        const { templateId, body } = buildSigningRequest(proposal, true)
        const res = await makeRequest(
          `/templates/${templateId}/createdocument`,
          { method: 'POST', body: JSON.stringify(body) },
        )
        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Zoho Sign create+send failed: ${errorText}`)
        }
        const data = await res.json() as ZohoCreateDocResponse
        requestId = data.requests.request_id
      }

      await updateProposal(ownerKey, proposalId, {
        signingRequestId: requestId,
        contractSentAt: new Date().toISOString(),
      })

      return { requestId }
    },

    getSigningStatus: async (requestId: string) => {
      const res = await makeRequest(`/requests/${requestId}`, { method: 'GET' })
      if (!res.ok) {
        throw new Error(`Zoho Sign status check failed for ${requestId}`)
      }
      const data = await res.json() as { requests: { request_status: string } }
      return { status: data.requests.request_status }
    },
  }
}

export type ContractService = ReturnType<typeof createContractService>
export const contractService = createContractService()
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/contract.service.ts
git commit -m "feat(services): add contractService domain service wrapping Zoho Sign"
```

---

### Task D1: Email Service

**Files:**
- Create: `src/shared/services/email.service.ts`

This extracts all user-facing email sends from routers into a single domain service. Currently `resendClient.emails.send()` is called directly in `proposals.router.tsx` (sendProposalEmail) and `landing.router/index.tsx` (scheduleConsultation, generalInquiry).

- [ ] **Step 1: Create the email service**

```ts
// src/shared/services/email.service.ts
import type { GeneralInquiryFormValues } from '@/features/landing/schemas/general-inquiry-form'
import type { ScheduleConsultationFormValues } from '@/features/landing/schemas/schedule-consultation-form'
import { ROOTS } from '@/shared/config/roots'
import { resendClient } from '@/shared/services/resend/client'
import { GeneralInquiryEmail } from '@/shared/services/resend/emails/general-inquiry-email'
import { ProjectEmailTemplate } from '@/shared/services/resend/emails/project-inquiry-email'
import ProposalEmail from '@/shared/services/resend/emails/proposal-email'

function createEmailService() {
  return {
    sendProposalEmail: async (params: {
      proposalId: string
      token: string
      customerName: string
      email: string
      message?: string
    }) => {
      const proposalUrl = `${ROOTS.public.proposals({ absolute: true, isProduction: true })}/proposal/${params.proposalId}?token=${params.token}&utm_source=email`

      const { data, error } = await resendClient.emails.send({
        from: 'Tri Pros <info@triprosremodeling.com>',
        to: params.email,
        bcc: 'info@triprosremodeling.com',
        subject: 'Your Proposal From Tri Pros Remodeling',
        react: (
          <ProposalEmail
            proposalUrl={proposalUrl}
            customerName={params.customerName}
            repMessage={params.message}
          />
        ),
      })

      if (error) {
        throw new Error(`Failed to send proposal email: ${JSON.stringify(error)}`)
      }

      return { data }
    },

    sendScheduleConsultationEmail: async (data: ScheduleConsultationFormValues) => {
      const { data: result, error } = await resendClient.emails.send({
        to: 'Tri Pros <test@triprosremodeling.com>',
        from: 'info@triprosremodeling.com',
        subject: 'Consultation scheduled!',
        react: <ProjectEmailTemplate data={data} />,
      })

      if (error) {
        throw new Error(`Failed to send consultation email: ${JSON.stringify(error)}`)
      }

      return { data: result }
    },

    sendGeneralInquiryEmail: async (data: GeneralInquiryFormValues) => {
      const { data: result, error } = await resendClient.emails.send({
        to: 'Tri Pros <test@triprosremodeling.com>',
        from: 'info@triprosremodeling.com',
        subject: 'General Inquiry',
        react: <GeneralInquiryEmail data={data} />,
      })

      if (error) {
        throw new Error(`Failed to send general inquiry email: ${JSON.stringify(error)}`)
      }

      return { data: result }
    },
  }
}

export type EmailService = ReturnType<typeof createEmailService>
export const emailService = createEmailService()
```

- [ ] **Step 2: Verify the import types exist**

Run: `grep -rn "export.*GeneralInquiryFormValues\|export.*ScheduleConsultationFormValues" src/features/landing/schemas/`

If the types are not exported by those names, check the actual schema files and adjust the imports.

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/email.service.ts
git commit -m "feat(services): add emailService for user-facing transactional emails"
```

---

### Task D2: Notification Service

**Files:**
- Create: `src/shared/services/notification.service.ts`

This extracts the fire-and-forget "proposal viewed" notification from `proposals.router.tsx` `recordView` into a proper service.

- [ ] **Step 1: Create the notification service**

```ts
// src/shared/services/notification.service.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { resendClient } from '@/shared/services/resend/client'
import ProposalViewedEmail from '@/shared/services/resend/emails/proposal-viewed-email'

function createNotificationService() {
  return {
    notifyProposalViewed: async (params: {
      proposalOwnerId: string
      proposalLabel: string
      proposalId: string
      customerName: string
      viewedAt: string
      source: string
    }) => {
      const [owner] = await db.select().from(user).where(eq(user.id, params.proposalOwnerId))
      if (!owner?.email) {
        return
      }

      const sourceLabels: Record<string, string> = {
        email: 'Opened from email link',
        sms: 'Opened from SMS link',
        direct: 'Opened directly',
        unknown: 'Opened directly',
      }
      const sourceLabel = sourceLabels[params.source] ?? 'Opened directly'

      await resendClient.emails.send({
        from: 'Tri Pros System <info@triprosremodeling.com>',
        to: owner.email,
        subject: `🔔 ${params.customerName} just opened their proposal`,
        react: (
          <ProposalViewedEmail
            customerName={params.customerName}
            proposalLabel={params.proposalLabel}
            viewedAt={params.viewedAt}
            sourceLabel={sourceLabel}
            proposalId={params.proposalId}
          />
        ),
      })
    },
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>
export const notificationService = createNotificationService()
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/notification.service.ts
git commit -m "feat(services): add notificationService for agent notifications"
```

---

### Task E1: Media Service

**Files:**
- Create: `src/shared/services/media.service.ts`

This extracts the business logic from `optimizeImageJob` into a service. The job becomes thin (receives payload → calls service).

- [ ] **Step 1: Create the media service**

```ts
// src/shared/services/media.service.ts
import type { R2BucketName } from '@/shared/services/r2/buckets'
import {
  getMediaFileById,
  setOptimizationComplete,
  setOptimizationFailed,
  setOptimizationProcessing,
} from '@/shared/dal/server/media-files/api'
import { getObject } from '@/shared/services/r2/lib/get-object'
import { processImageVariants } from '@/shared/services/r2/lib/process-image-variants'
import { putObject } from '@/shared/services/r2/put-object'

function createMediaService() {
  return {
    optimizeImage: async (mediaFileId: number) => {
      const file = await getMediaFileById(mediaFileId)

      if (!file) {
        console.error(`[mediaService] Media file ${mediaFileId} not found`)
        return
      }

      if (file.optimizationStatus === 'optimized') {
        return
      }

      await setOptimizationProcessing(mediaFileId)

      try {
        const bucket = file.bucket as R2BucketName
        const originalBuffer = await getObject(bucket, file.pathKey)
        const { variants, blurDataUrl, variantSuffixes } = await processImageVariants(originalBuffer)

        const basePath = file.pathKey.replace(/\.[^.]+$/, '')
        await Promise.all(
          variants.map(v =>
            putObject(bucket, `${basePath}-${v.suffix}.webp`, v.buffer, 'image/webp'),
          ),
        )

        await setOptimizationComplete(mediaFileId, { variantSuffixes, blurDataUrl })
      }
      catch (error) {
        console.error(`[mediaService] Optimization failed for ${mediaFileId}:`, error)
        await setOptimizationFailed(mediaFileId)
      }
    },
  }
}

export type MediaService = ReturnType<typeof createMediaService>
export const mediaService = createMediaService()
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/media.service.ts
git commit -m "feat(services): add mediaService for business-level media operations"
```

---

### Task B5: Accounting Service

**Files:**
- Create: `src/shared/services/accounting.service.ts`

- [ ] **Step 1: Create the accounting service**

```ts
// src/shared/services/accounting.service.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { projects } from '@/shared/db/schema/projects'
import { proposals } from '@/shared/db/schema/proposals'
import { qbRequest } from '@/shared/services/quickbooks/client'
import type { QBCustomer, QBInvoice, QBInvoiceLine, QBPayment, QBQueryResponse } from '@/shared/services/quickbooks/types'

function createAccountingService() {
  return {
    ensureCustomer: async (customerId: string): Promise<string> => {
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId))

      if (!customer) {
        throw new Error(`Customer ${customerId} not found`)
      }

      if (customer.qbCustomerId) {
        return customer.qbCustomerId
      }

      let existingQBCustomer: QBCustomer | undefined

      if (customer.email) {
        const emailQuery = await qbRequest<QBQueryResponse<QBCustomer>>(
          `/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${customer.email}'`)}`,
        )
        existingQBCustomer = emailQuery.QueryResponse.Customer?.[0]
      }

      if (!existingQBCustomer && customer.name) {
        const nameQuery = await qbRequest<QBQueryResponse<QBCustomer>>(
          `/query?query=${encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${customer.name}'`)}`,
        )
        existingQBCustomer = nameQuery.QueryResponse.Customer?.[0]
      }

      let qbCustomerId: string

      if (existingQBCustomer) {
        qbCustomerId = existingQBCustomer.Id
      }
      else {
        const newCustomer = await qbRequest<{ Customer: QBCustomer }>(
          '/customer',
          {
            method: 'POST',
            body: JSON.stringify({
              DisplayName: customer.name,
              PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
              PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
              BillAddr: {
                Line1: customer.address ?? '',
                City: customer.city,
                CountrySubDivisionCode: customer.state ?? 'CA',
                PostalCode: customer.zip,
              },
            }),
          },
        )
        qbCustomerId = newCustomer.Customer.Id
      }

      await db.update(customers).set({ qbCustomerId }).where(eq(customers.id, customerId))
      return qbCustomerId
    },

    ensureProjectSubCustomer: async (projectId: string, qbParentCustomerId: string): Promise<string> => {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      if (project.qbSubCustomerId) {
        return project.qbSubCustomerId
      }

      const displayName = `${project.homeownerName ?? project.title} - ${project.title}`

      const newSubCustomer = await qbRequest<{ Customer: QBCustomer }>(
        '/customer',
        {
          method: 'POST',
          body: JSON.stringify({
            DisplayName: displayName.slice(0, 100),
            ParentRef: { value: qbParentCustomerId },
            BillWithParent: true,
            BillAddr: {
              Line1: project.address ?? '',
              City: project.city,
              CountrySubDivisionCode: project.state ?? 'CA',
              PostalCode: project.zip ?? '',
            },
          }),
        },
      )

      const qbSubCustomerId = newSubCustomer.Customer.Id
      await db.update(projects).set({ qbSubCustomerId }).where(eq(projects.id, projectId))
      return qbSubCustomerId
    },

    createInvoice: async (projectId: string, proposalIds: string[]): Promise<string> => {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

      if (!project?.qbSubCustomerId) {
        throw new Error(`Project ${projectId} has no QB sub-customer`)
      }

      const proposalRows = await Promise.all(
        proposalIds.map(async (pid) => {
          const [row] = await db.select().from(proposals).where(eq(proposals.id, pid))
          return row
        }),
      )

      const lineItems: QBInvoiceLine[] = proposalRows
        .filter(Boolean)
        .map((proposal) => {
          const funding = proposal.fundingJSON?.data
          return {
            Amount: funding?.finalTcp ?? 0,
            DetailType: 'SalesItemLineDetail' as const,
            Description: `Proposal: ${proposal.label}`,
            SalesItemLineDetail: {
              ItemRef: { value: '1', name: 'Services' },
              UnitPrice: funding?.finalTcp ?? 0,
              Qty: 1,
            },
          }
        })

      if (lineItems.length === 0) {
        throw new Error('No proposal line items to invoice')
      }

      const newInvoice = await qbRequest<{ Invoice: QBInvoice }>(
        '/invoice',
        {
          method: 'POST',
          body: JSON.stringify({
            CustomerRef: { value: project.qbSubCustomerId },
            Line: lineItems,
          }),
        },
      )

      const qbInvoiceId = newInvoice.Invoice.Id

      if (proposalIds[0]) {
        await db
          .update(proposals)
          .set({ qbInvoiceId, qbPaymentStatus: 'unpaid' })
          .where(eq(proposals.id, proposalIds[0]))
      }

      return qbInvoiceId
    },

    syncPaymentStatus: async (paymentId: string, _realmId: string): Promise<void> => {
      const paymentData = await qbRequest<{ Payment: QBPayment }>(`/payment/${paymentId}`)
      const payment = paymentData.Payment

      for (const line of payment.Line) {
        for (const linked of line.LinkedTxn) {
          if (linked.TxnType !== 'Invoice')
            continue

          const [proposal] = await db
            .select()
            .from(proposals)
            .where(eq(proposals.qbInvoiceId, linked.TxnId))

          if (!proposal)
            continue

          const invoiceData = await qbRequest<{ Invoice: QBInvoice }>(`/invoice/${linked.TxnId}`)
          const balance = invoiceData.Invoice.Balance
          const total = invoiceData.Invoice.TotalAmt

          let status: string
          if (balance <= 0)
            status = 'paid'
          else if (balance < total)
            status = 'partial'
          else
            status = 'unpaid'

          await db.update(proposals).set({ qbPaymentStatus: status }).where(eq(proposals.id, proposal.id))
        }
      }
    },

    syncInvoiceStatus: async (invoiceId: string, _realmId: string): Promise<void> => {
      const invoiceData = await qbRequest<{ Invoice: QBInvoice }>(`/invoice/${invoiceId}`)
      const invoice = invoiceData.Invoice

      const [proposal] = await db
        .select()
        .from(proposals)
        .where(eq(proposals.qbInvoiceId, invoiceId))

      if (!proposal)
        return

      const balance = invoice.Balance
      const total = invoice.TotalAmt

      let status: string
      if (balance <= 0)
        status = 'paid'
      else if (balance < total)
        status = 'partial'
      else
        status = 'unpaid'

      await db.update(proposals).set({ qbPaymentStatus: status }).where(eq(proposals.id, proposal.id))
    },
  }
}

export type AccountingService = ReturnType<typeof createAccountingService>
export const accountingService = createAccountingService()
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/services/accounting.service.ts
git commit -m "feat(services): add accountingService for QB customer/invoice/payment sync"
```

---

## Phase 3: Jobs, Webhooks, Router Refactoring

### Task B6: QStash Jobs — QB Record Creation + Sync

**Files:**
- Create: `src/shared/services/upstash/jobs/create-qb-records.ts`
- Create: `src/shared/services/upstash/jobs/sync-qb-payment.ts`
- Create: `src/shared/services/upstash/jobs/sync-qb-invoice.ts`
- Modify: `src/app/api/qstash-jobs/route.ts`

- [ ] **Step 1: Create create-qb-records job**

```ts
// src/shared/services/upstash/jobs/create-qb-records.ts
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { projects } from '@/shared/db/schema/projects'
import { accountingService } from '@/shared/services/accounting.service'
import { createJob } from '../lib/create-job'

export const createQbRecordsJob = createJob(
  'create-qb-records',
  async ({ projectId }: { projectId: string }) => {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))

    if (!project?.customerId) {
      console.error(`[qstash:create-qb-records] Project ${projectId} has no customer`)
      return
    }

    const qbCustomerId = await accountingService.ensureCustomer(project.customerId)
    await accountingService.ensureProjectSubCustomer(projectId, qbCustomerId)
  },
)
```

- [ ] **Step 2: Create sync-qb-payment job**

```ts
// src/shared/services/upstash/jobs/sync-qb-payment.ts
import { accountingService } from '@/shared/services/accounting.service'
import { createJob } from '../lib/create-job'

export const syncQbPaymentJob = createJob(
  'sync-qb-payment',
  async ({ paymentId, realmId }: { paymentId: string, realmId: string }) => {
    await accountingService.syncPaymentStatus(paymentId, realmId)
  },
)
```

- [ ] **Step 3: Create sync-qb-invoice job**

```ts
// src/shared/services/upstash/jobs/sync-qb-invoice.ts
import { accountingService } from '@/shared/services/accounting.service'
import { createJob } from '../lib/create-job'

export const syncQbInvoiceJob = createJob(
  'sync-qb-invoice',
  async ({ invoiceId, realmId }: { invoiceId: string, realmId: string }) => {
    await accountingService.syncInvoiceStatus(invoiceId, realmId)
  },
)
```

- [ ] **Step 4: Register all new jobs in QStash route**

In `src/app/api/qstash-jobs/route.ts`, add imports and update jobs array:

```ts
import { createQbRecordsJob } from '@/shared/services/upstash/jobs/create-qb-records'
import { syncQbInvoiceJob } from '@/shared/services/upstash/jobs/sync-qb-invoice'
import { syncQbPaymentJob } from '@/shared/services/upstash/jobs/sync-qb-payment'
```

```ts
const jobs: Job[] = [
  generateAISummaryJob,
  syncCustomersJob,
  optimizeImageJob,
  createQbRecordsJob,
  syncQbPaymentJob,
  syncQbInvoiceJob,
]
```

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/upstash/jobs/create-qb-records.ts src/shared/services/upstash/jobs/sync-qb-payment.ts src/shared/services/upstash/jobs/sync-qb-invoice.ts src/app/api/qstash-jobs/route.ts
git commit -m "feat(jobs): add QStash jobs for QB record creation and payment/invoice sync"
```

---

### Task B7: QuickBooks Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/quickbooks/route.ts`

- [ ] **Step 1: Create the webhook route handler**

```ts
// src/app/api/webhooks/quickbooks/route.ts
import { createHmac } from 'node:crypto'
import env from '@/shared/config/server-env'
import { syncQbInvoiceJob } from '@/shared/services/upstash/jobs/sync-qb-invoice'
import { syncQbPaymentJob } from '@/shared/services/upstash/jobs/sync-qb-payment'

interface QBWebhookNotification {
  realmId: string
  dataChangeEvent: {
    entities: {
      name: string
      id: string
      operation: string
      lastUpdated: string
    }[]
  }
}

interface QBWebhookPayload {
  eventNotifications: QBWebhookNotification[]
}

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = createHmac('sha256', env.QB_WEBHOOK_VERIFIER_TOKEN)
    .update(payload)
    .digest('base64')
  return hash === signature
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('intuit-signature')

  if (!signature) {
    return new Response('Missing signature', { status: 401 })
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody) as QBWebhookPayload

  for (const notification of payload.eventNotifications) {
    const { realmId } = notification

    for (const entity of notification.dataChangeEvent.entities) {
      if (entity.name === 'Payment') {
        await syncQbPaymentJob.dispatch({ paymentId: entity.id, realmId })
      }
      else if (entity.name === 'Invoice') {
        await syncQbInvoiceJob.dispatch({ invoiceId: entity.id, realmId })
      }
    }
  }

  return new Response('OK', { status: 200 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/quickbooks/
git commit -m "feat(webhooks): add QuickBooks webhook handler with HMAC verification"
```

---

### Task D3: Send View Notification QStash Job

**Files:**
- Create: `src/shared/services/upstash/jobs/send-view-notification.ts`
- Modify: `src/app/api/qstash-jobs/route.ts`

- [ ] **Step 1: Create the job**

```ts
// src/shared/services/upstash/jobs/send-view-notification.ts
import { notificationService } from '@/shared/services/notification.service'
import { createJob } from '../lib/create-job'

export const sendViewNotificationJob = createJob(
  'send-view-notification',
  async (params: {
    proposalOwnerId: string
    proposalLabel: string
    proposalId: string
    customerName: string
    viewedAt: string
    source: string
  }) => {
    await notificationService.notifyProposalViewed(params)
  },
)
```

- [ ] **Step 2: Register in QStash route**

In `src/app/api/qstash-jobs/route.ts`, add import:

```ts
import { sendViewNotificationJob } from '@/shared/services/upstash/jobs/send-view-notification'
```

Add to jobs array:

```ts
  sendViewNotificationJob,
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/upstash/jobs/send-view-notification.ts src/app/api/qstash-jobs/route.ts
git commit -m "feat(jobs): add send-view-notification QStash job"
```

---

### Task A6: Delete DocuSign + Refactor proposals.router.tsx

**Files:**
- Delete: `src/shared/services/docusign/` (entire directory)
- Delete: `src/trpc/routers/docusign.router.ts`
- Modify: `src/trpc/routers/app.ts`
- Modify: `src/trpc/routers/proposals.router.tsx`

This is the biggest task. The proposals router goes from fat (direct SDK calls, fire-and-forget blocks) to thin (delegates to services).

- [ ] **Step 1: Delete DocuSign service directory and router**

```bash
rm -rf src/shared/services/docusign/
rm src/trpc/routers/docusign.router.ts
```

- [ ] **Step 2: Remove docusignRouter from app.ts**

In `src/trpc/routers/app.ts`, remove:
```ts
import { docusignRouter } from './docusign.router'
```
And remove `docusignRouter,` from the router object.

- [ ] **Step 3: Rewrite proposals.router.tsx**

Replace the entire file with the refactored version. The router becomes thin — all business logic is in services.

Key changes:
- Remove all DocuSign imports (`DS_REST_BASE_URL`, `buildEnvelopeBody`, `getAccessToken`)
- Remove `env` import (was only used for `DS_ACCOUNT_ID`)
- Remove direct `resendClient` import
- Remove `ProposalEmail` and `ProposalViewedEmail` imports
- Add `contractService`, `emailService`, `sendViewNotificationJob` imports
- Replace `sendProposalEmail` fire-and-forget with service calls
- Replace `recordView` fire-and-forget with job dispatch
- Add `createContractDraft` and `sendContractForSigning` procedures

The new `sendProposalEmail` mutation body becomes:

```ts
  sendProposalEmail: agentProcedure
    .input(z.object({
      proposalId: z.string(),
      customerName: z.string(),
      email: z.email(),
      token: z.string(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user } = ctx.session
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : user.id

      const { data } = await emailService.sendProposalEmail({
        proposalId: input.proposalId,
        token: input.token,
        customerName: input.customerName,
        email: input.email,
        message: input.message,
      })

      const proposal = await updateProposal(ownerKey, input.proposalId, {
        status: 'sent',
        sentAt: new Date().toISOString(),
      })

      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', cause: 'Proposal not found' })
      }

      // Create signing draft asynchronously (non-blocking)
      void contractService.createSigningRequest(input.proposalId, ownerKey)
        .catch(() => { /* Signing draft failure must not affect the email send */ })

      return { data, input, proposal }
    }),
```

The new `recordView` mutation body becomes:

```ts
  recordView: baseProcedure
    .input(z.object({
      proposalId: z.string(),
      token: z.string(),
      source: z.enum(['email', 'sms', 'direct', 'unknown']).default('unknown'),
      referer: z.string().optional(),
      userAgent: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)

      if (!proposal || proposal.token !== input.token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', cause: 'Invalid token' })
      }

      const view = await recordProposalView({
        proposalId: input.proposalId,
        source: input.source,
        referer: input.referer,
        userAgent: input.userAgent,
      })

      // Dispatch notification asynchronously via QStash
      void sendViewNotificationJob.dispatch({
        proposalOwnerId: proposal.ownerId,
        proposalLabel: proposal.label,
        proposalId: input.proposalId,
        customerName: proposal.customer?.name ?? 'Customer',
        viewedAt: view.viewedAt,
        source: input.source,
      }).catch(() => { /* Notification failure must not affect the customer */ })
    }),
```

Add two new procedures:

```ts
  createContractDraft: agentProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const ownerKey = isOmni ? null : ctx.session.user.id
      return contractService.createSigningRequest(input.proposalId, ownerKey)
    }),

  sendContractForSigning: baseProcedure
    .input(z.object({ proposalId: z.string(), token: z.string() }))
    .mutation(async ({ input }) => {
      const proposal = await getProposal(input.proposalId)
      if (!proposal || proposal.token !== input.token) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' })
      }
      return contractService.sendSigningRequest(input.proposalId, input.token)
    }),
```

- [ ] **Step 4: Remove jsonwebtoken dependency**

Run: `grep -rn "jsonwebtoken" src/ --include="*.ts" --include="*.tsx"` — confirm 0 results.

Then: `pnpm remove jsonwebtoken @types/jsonwebtoken`

- [ ] **Step 5: Verify compilation**

Run: `pnpm tsc --noEmit && pnpm lint`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: replace DocuSign with Zoho Sign, extract email/notification to services

- Delete src/shared/services/docusign/ entirely
- Delete docusign.router.ts, remove from app.ts
- proposals.router.tsx: use contractService, emailService, sendViewNotificationJob
- Replace fire-and-forget blocks with service calls + QStash jobs
- Add createContractDraft + sendContractForSigning procedures
- Remove jsonwebtoken dependency"
```

---

### Task D4: Refactor landing.router — Use emailService

**Files:**
- Modify: `src/trpc/routers/landing.router/index.tsx`

- [ ] **Step 1: Replace direct resendClient calls with emailService**

Remove imports:
```ts
import { resendClient } from '@/shared/services/resend/client'
import { GeneralInquiryEmail } from '@/shared/services/resend/emails/general-inquiry-email'
import { ProjectEmailTemplate } from '@/shared/services/resend/emails/project-inquiry-email'
```

Add import:
```ts
import { emailService } from '@/shared/services/email.service'
```

Replace `scheduleConsultation` mutation body:
```ts
  scheduleConsultation: baseProcedure
    .input(scheduleConsultationFormSchema)
    .mutation(async ({ input }) => {
      const { data } = await emailService.sendScheduleConsultationEmail(input)
      return { data, input }
    }),
```

Replace `generalInquiry` mutation body:
```ts
  generalInquiry: baseProcedure
    .input(generalInquiryFormSchema)
    .mutation(async ({ input }) => {
      const { data } = await emailService.sendGeneralInquiryEmail(input)

      try {
        await putPipedriveLead(input)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }

      return { data, input }
    }),
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/trpc/routers/landing.router/index.tsx
git commit -m "refactor(landing): use emailService instead of direct resendClient calls"
```

---

### Task E2: Refactor optimizeImageJob — Use mediaService

**Files:**
- Modify: `src/shared/services/upstash/jobs/optimize-image.ts`

- [ ] **Step 1: Replace job logic with mediaService call**

Replace the entire file:

```ts
// src/shared/services/upstash/jobs/optimize-image.ts
import { mediaService } from '@/shared/services/media.service'
import { createJob } from '../lib/create-job'

interface OptimizeImagePayload {
  mediaFileId: number
}

export const optimizeImageJob = createJob<OptimizeImagePayload>(
  'optimize-image',
  async ({ mediaFileId }) => {
    await mediaService.optimizeImage(mediaFileId)
  },
)
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/shared/services/upstash/jobs/optimize-image.ts
git commit -m "refactor(jobs): optimizeImageJob delegates to mediaService"
```

---

## Phase 4: Stubs + Cleanup

### Task F1: Phase 5 Service Stubs

**Files:**
- Create: `src/shared/services/scheduling.service.ts`
- Create: `src/shared/services/analytics.service.ts`
- Create: `src/shared/services/ai.service.ts`
- Create: `src/shared/services/pdf.service.ts`
- Create: `src/shared/services/webhook.service.ts`
- Create: `src/shared/services/construction-data.service.ts`

Each stub follows the same pattern: `createService()` factory with typed method signatures that throw `not implemented`.

- [ ] **Step 1: Create scheduling.service.ts**

```ts
// src/shared/services/scheduling.service.ts

/** Follow-up reminders, meeting reminders (QStash delay/schedule) */
function createSchedulingService() {
  return {
    scheduleFollowUp: async (_params: { proposalId: string, delayMs: number }): Promise<void> => {
      throw new Error('schedulingService.scheduleFollowUp not implemented')
    },

    scheduleMeetingReminder: async (_params: { meetingId: string, reminderAt: string }): Promise<void> => {
      throw new Error('schedulingService.scheduleMeetingReminder not implemented')
    },

    cancelScheduled: async (_params: { jobId: string }): Promise<void> => {
      throw new Error('schedulingService.cancelScheduled not implemented')
    },
  }
}

export type SchedulingService = ReturnType<typeof createSchedulingService>
export const schedulingService = createSchedulingService()
```

- [ ] **Step 2: Create analytics.service.ts**

```ts
// src/shared/services/analytics.service.ts

/** Engagement scoring, agent digest, event tracking */
function createAnalyticsService() {
  return {
    computeEngagementScore: async (_params: { customerId: string }): Promise<number> => {
      throw new Error('analyticsService.computeEngagementScore not implemented')
    },

    generateAgentDigest: async (_params: { agentId: string }): Promise<string> => {
      throw new Error('analyticsService.generateAgentDigest not implemented')
    },

    trackEvent: async (_params: { event: string, metadata: Record<string, unknown> }): Promise<void> => {
      throw new Error('analyticsService.trackEvent not implemented')
    },
  }
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>
export const analyticsService = createAnalyticsService()
```

- [ ] **Step 3: Create ai.service.ts**

```ts
// src/shared/services/ai.service.ts

/** Expanded AI: meeting summaries, follow-up drafts, persona enrichment */
function createAIService() {
  return {
    generateMeetingSummary: async (_params: { meetingId: string }): Promise<string> => {
      throw new Error('aiService.generateMeetingSummary not implemented')
    },

    generateFollowUpDraft: async (_params: { proposalId: string }): Promise<string> => {
      throw new Error('aiService.generateFollowUpDraft not implemented')
    },

    enrichPersonaProfile: async (_params: { customerId: string }): Promise<void> => {
      throw new Error('aiService.enrichPersonaProfile not implemented')
    },
  }
}

export type AIService = ReturnType<typeof createAIService>
export const aiService = createAIService()
```

- [ ] **Step 4: Create pdf.service.ts**

```ts
// src/shared/services/pdf.service.ts

/** Proposal PDFs, finance forms, printable documents */
function createPDFService() {
  return {
    generateProposalPdf: async (_params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateProposalPdf not implemented')
    },

    generateFinanceForm: async (_params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateFinanceForm not implemented')
    },
  }
}

export type PDFService = ReturnType<typeof createPDFService>
export const pdfService = createPDFService()
```

- [ ] **Step 5: Create webhook.service.ts**

```ts
// src/shared/services/webhook.service.ts

/** Incoming webhook verification + routing to jobs */
function createWebhookService() {
  return {
    verifyAndRoute: async (_params: { provider: string, payload: string, signature: string }): Promise<void> => {
      throw new Error('webhookService.verifyAndRoute not implemented')
    },
  }
}

export type WebhookService = ReturnType<typeof createWebhookService>
export const webhookService = createWebhookService()
```

- [ ] **Step 6: Create construction-data.service.ts**

```ts
// src/shared/services/construction-data.service.ts

/** Trades/scopes/SOW from Notion — stable interface over existing Notion DAL */
function createConstructionDataService() {
  return {
    getTrades: async (): Promise<unknown[]> => {
      throw new Error('constructionDataService.getTrades not implemented')
    },

    getScopesByTrade: async (_params: { tradeId: string }): Promise<unknown[]> => {
      throw new Error('constructionDataService.getScopesByTrade not implemented')
    },

    getSOWTemplates: async (_params: { scopeIds: string[] }): Promise<unknown[]> => {
      throw new Error('constructionDataService.getSOWTemplates not implemented')
    },
  }
}

export type ConstructionDataService = ReturnType<typeof createConstructionDataService>
export const constructionDataService = createConstructionDataService()
```

- [ ] **Step 7: Verify all stubs compile**

Run: `pnpm tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/shared/services/scheduling.service.ts src/shared/services/analytics.service.ts src/shared/services/ai.service.ts src/shared/services/pdf.service.ts src/shared/services/webhook.service.ts src/shared/services/construction-data.service.ts
git commit -m "feat(services): add Phase 5 service stubs with typed interfaces"
```

---

### Task C1: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Type check**

Run: `pnpm tsc --noEmit`

Expected: 0 errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`

Expected: 0 errors. Run `pnpm lint --fix` if import sorting issues.

- [ ] **Step 3: Verify DocuSign fully removed**

Run: `grep -rn "docusign\|DS_INTEGRATION\|DS_JWT\|DS_ACCOUNT\|DS_USER\|DS_DEV_USER\|docusignEnvelopeId\|docusign_envelope_id" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v migrations`

Expected: 0 results.

- [ ] **Step 4: Verify no direct resendClient usage in routers**

Run: `grep -rn "resendClient" src/trpc/ --include="*.ts" --include="*.tsx"`

Expected: 0 results. All email sends should go through emailService or notificationService.

- [ ] **Step 5: Verify all service files exist**

```bash
ls src/shared/services/contract.service.ts \
   src/shared/services/email.service.ts \
   src/shared/services/notification.service.ts \
   src/shared/services/media.service.ts \
   src/shared/services/accounting.service.ts \
   src/shared/services/scheduling.service.ts \
   src/shared/services/analytics.service.ts \
   src/shared/services/ai.service.ts \
   src/shared/services/pdf.service.ts \
   src/shared/services/webhook.service.ts \
   src/shared/services/construction-data.service.ts
```

- [ ] **Step 6: Verify DocuSign directory deleted**

```bash
test ! -d src/shared/services/docusign && echo "PASS" || echo "FAIL"
test ! -f src/trpc/routers/docusign.router.ts && echo "PASS" || echo "FAIL"
```

---

### Task C2: Update Services Layer Plan

**Files:**
- Modify: `.claude/plans/inherited-dancing-valley.md`

- [ ] **Step 1: Update the plan**

Mark these as shipped:
- `contractService` (Phase 1) — shipped
- `emailService` (Phase 2) — shipped
- `notificationService` (Phase 2) — shipped
- `accountingService` — shipped (new, not in original plan)
- `mediaService` (Phase 5) — shipped (promoted from stub)

Mark Phase 5 stubs as created:
- All 6 stub services have typed interfaces

Update SDK clients:
- Remove `docusign/`, add `zoho-sign/` and `quickbooks/`

Update jobs inventory:
- Add `create-qb-records`, `sync-qb-payment`, `sync-qb-invoice`, `send-view-notification`
- Note `optimize-image` now delegates to `mediaService`

- [ ] **Step 2: Commit**

```bash
git add .claude/plans/inherited-dancing-valley.md
git commit -m "docs: update services layer plan — full migration shipped"
```
