# Zoho Sign + QuickBooks Services Layer Design

**Date:** 2026-04-07
**Scope:** Two new domain services (`contractService`, `accountingService`) with SDK clients, parallel implementation
**Related plan:** `.claude/plans/inherited-dancing-valley.md` (Services Layer & Async Jobs Architecture)

---

## Context

The app is transitioning to a domain services layer (see plan). This spec adds the first two real domain services:

1. **Zoho Sign** replaces DocuSign for contract signing (cost savings — DocuSign is too expensive)
2. **QuickBooks Online** for bidirectional financial sync (customers, invoices, payments)

Both ship in parallel. They touch no overlapping code.

### Architecture reminder

```
tRPC procedure (thin) --> Domain Service (business logic) --> Infrastructure (SDK clients, DAL, Jobs)
```

- Domain services own business logic and coordination
- SDK client directories are infrastructure — auth, API calls, request formatting
- Services are NOT 1:1 wrappers around SDK clients. If a method would be a pass-through, it doesn't belong in a service.

---

## 1. Zoho Sign — Contract Signing Service

### 1.1 SDK Client: `src/shared/services/zoho-sign/`

```
src/shared/services/zoho-sign/
  client.ts                        <-- Zoho Sign REST client (base URL, auth headers)
  lib/
    get-access-token.ts            <-- OAuth2 self-client token flow + in-memory cache
    access-token-cache.ts          <-- In-memory token cache with expiry (same pattern as old DocuSign)
    build-signing-request.ts       <-- Map proposal data --> Zoho Sign template fields
  constants/
    index.ts                       <-- Base URLs (sandbox vs prod), template IDs (senior vs base)
```

### 1.2 Auth Model

Zoho Sign uses OAuth2 **self-client** flow (server-to-server):
1. Generate a one-time grant token in Zoho API Console
2. Exchange for a refresh token (stored as env var — long-lived)
3. App uses refresh token to get short-lived access tokens (auto-cached in memory)

Same pattern as the existing DocuSign JWT auth, just a different grant type.

### 1.3 Domain Service: `contractService`

**File:** `src/shared/services/contract.service.ts`

```ts
function createContractService(client = zohoSignClient) {
  return {
    createSigningRequest: async (proposalId: string) => {
      // 1. Fetch proposal + customer from DAL
      // 2. Select template (senior vs base) based on proposal data
      // 3. Map proposal fields to Zoho Sign template fields
      //    (SOW text, TCP, deposit, customer name/email/phone/address, dates)
      // 4. POST to Zoho Sign API to create signing request
      // 5. Store signingRequestId on proposal via DAL
      // 6. Return { requestId }
    },

    sendSigningRequest: async (requestId: string) => {
      // Transition existing request to "sent" status
      // Update contractSentAt on proposal
    },

    getSigningStatus: async (requestId: string) => {
      // GET signing request status from Zoho Sign
    },
  }
}

export type ContractService = ReturnType<typeof createContractService>
export const contractService = createContractService()
```

### 1.4 Template Field Mapping

Same fields as current DocuSign integration, mapped to Zoho Sign template merge fields:

| Field | Source | Notes |
|-------|--------|-------|
| `start-date` | Calculated: today + 3 days | |
| `completion-date` | `start-date` + `validThroughTimeframe` | |
| `sow-1` | `sowToPlaintext(sow)` first 2000 chars | |
| `sow-2` | `sowToPlaintext(sow)` chars 2001-6000 | |
| `tcp` | `funding.finalTcp` | |
| `deposit` | `funding.depositAmount` | |
| `ho-address` | `customer.address` | |
| `ho-city-state-zip` | `customer.city, state zip` | |
| `ho-phone` | `customer.phone` | |
| Customer name + email | `customer.name`, `customer.email` | Signer identity |

Template selection: `TEMPLATE_IDS.base` vs `TEMPLATE_IDS.senior` (same conditional as current DocuSign, toggled by prod vs dev environment).

### 1.5 Schema Changes

| Change | Detail |
|--------|--------|
| Rename column | `docusignEnvelopeId` --> `signingRequestId` (text, provider-agnostic) |
| Keep column | `contractSentAt` (already generic) |

### 1.6 Router Changes

**Delete:** `src/trpc/routers/docusign.router.ts` and its registration in `app.ts`

**Move procedures to `proposals.router.tsx`:**

```ts
// proposals.router.tsx (after refactor)
createContractDraft: agentProcedure
  .input(z.object({ proposalId: z.string() }))
  .mutation(async ({ input }) => {
    return contractService.createSigningRequest(input.proposalId)
  }),

sendContractForSigning: baseProcedure
  .input(z.object({ proposalId: z.string(), token: z.string() }))
  .mutation(async ({ input }) => {
    // Validate token against proposal
    // Call contractService.sendSigningRequest() or createSigningRequest() + send
  }),
```

### 1.7 Env Var Changes

**Remove:**
- `DS_INTEGRATION_KEY`
- `DS_JWT_PRIVATE_KEY`
- `DS_JWT_PRIVATE_KEY_PATH`
- `DS_USER_ID`
- `DS_DEV_USER_ID`
- `DS_ACCOUNT_ID`

**Add:**
- `ZOHO_SIGN_CLIENT_ID`
- `ZOHO_SIGN_CLIENT_SECRET`
- `ZOHO_SIGN_REFRESH_TOKEN`

### 1.8 Deletions

| Target | Action |
|--------|--------|
| `src/shared/services/docusign/` | Delete entire directory |
| `src/trpc/routers/docusign.router.ts` | Delete |
| `docusignRouter` in `app.ts` | Remove registration |
| `DS_*` vars in `server-env.ts` | Remove |
| `jsonwebtoken` package | Remove if no other usage (DocuSign JWT was the only consumer) |

### 1.9 Zoho Sign Webhooks

Out of scope for this spec. Tracked in GitHub issue [#75](https://github.com/OlisDevSpot/tri-pros-website/issues/75).

---

## 2. QuickBooks Online — Accounting Service

### 2.1 SDK Client: `src/shared/services/quickbooks/`

```
src/shared/services/quickbooks/
  client.ts                        <-- QB REST client (base URL builder, auth headers, request wrapper)
  lib/
    get-access-token.ts            <-- OAuth2 token refresh from DB + cache
    access-token-cache.ts          <-- DB-backed token storage (refresh tokens last 100 days)
  constants/
    index.ts                       <-- Base URLs (sandbox vs prod), API minor version
  types.ts                         <-- QB entity shapes (Customer, Invoice, Payment — only fields we use)
```

### 2.2 Auth Model

QB uses **OAuth2 authorization code grant**:
1. One-time browser flow: admin authorizes the app at Intuit
2. Redirect to `/api/quickbooks/callback` with auth code
3. Exchange auth code for access token (1 hour) + refresh token (100 days)
4. Tokens stored in DB table (they rotate — can't be env vars)
5. SDK client auto-refreshes access token on every call using stored refresh token

Single-company setup: one set of tokens for Tri Pros' QB account.

### 2.3 Token Storage

**New table:** `qb_auth_tokens`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid PK defaultRandom` | |
| `accessToken` | `text NOT NULL` | |
| `refreshToken` | `text NOT NULL` | |
| `realmId` | `text NOT NULL` | QB company ID |
| `expiresAt` | `timestamp with timezone NOT NULL` | Access token expiry |
| `updatedAt` | `timestamp with timezone defaultNow` | |

Single row, always overwritten on refresh.

### 2.4 OAuth Setup Route (one-time use)

**File:** `src/app/api/quickbooks/callback/route.ts`

- Handles OAuth redirect after admin authorizes in browser
- Exchanges auth code for access + refresh tokens
- Stores in `qb_auth_tokens` table
- Used once during initial setup (and again only if refresh token expires after 100 days of inactivity)

### 2.5 Domain Service: `accountingService`

**File:** `src/shared/services/accounting.service.ts`

```ts
function createAccountingService(client = qbClient) {
  return {
    // ---- Customer sync ----
    ensureCustomer: async (customer: { id, name, email, phone, address, ... }) => {
      // 1. Check if customer already has qbCustomerId in our DB
      // 2. If yes, return it
      // 3. If no, query QB by email/DisplayName to find existing
      // 4. If found in QB, store qbCustomerId and return
      // 5. If not found, POST create customer in QB
      // 6. Store qbCustomerId on customer record
      // 7. Return qbCustomerId
    },

    // ---- Project <-> Sub-customer sync ----
    ensureProjectSubCustomer: async (project, qbCustomerId: string) => {
      // 1. Check if project already has qbSubCustomerId
      // 2. If yes, return it
      // 3. POST create sub-customer with:
      //    - DisplayName: "{customerName} - {projectName/address}"
      //    - ParentRef: { value: qbCustomerId }
      //    - BillWithParent: true
      // 4. Store qbSubCustomerId on project record
      // 5. Return qbSubCustomerId
    },

    // ---- Invoice management ----
    createInvoice: async (project, approvedProposals) => {
      // 1. Build line items from proposal SOW/pricing
      //    Each proposal's scope items become invoice line items
      //    Proposals are additive (stack on each other)
      // 2. POST create invoice in QB:
      //    - CustomerRef: { value: project.qbSubCustomerId }
      //    - Line: [{ Amount, DetailType: "SalesItemLineDetail", SalesItemLineDetail: { ItemRef } }]
      // 3. Store qbInvoiceId on proposal record
      // 4. Return { invoiceId }
    },

    // ---- Inbound sync (called by QStash jobs from webhooks) ----
    syncPaymentStatus: async (paymentId: string, realmId: string) => {
      // 1. GET payment from QB (1 CorePlus API call)
      // 2. Find linked invoice(s) via payment's Line[].LinkedTxn
      // 3. Find matching proposal in our DB via qbInvoiceId
      // 4. Calculate status: unpaid / partial / paid
      // 5. Update qbPaymentStatus on proposal
    },

    syncInvoiceStatus: async (invoiceId: string, realmId: string) => {
      // 1. GET invoice from QB (1 CorePlus API call)
      // 2. Find matching proposal via qbInvoiceId
      // 3. Update any relevant fields (balance, due date changes, voided status)
    },
  }
}

export type AccountingService = ReturnType<typeof createAccountingService>
export const accountingService = createAccountingService()
```

### 2.6 Sub-Customer Pattern (replaces Projects API)

QB's Projects API requires a $300/mo Premium tier. Instead, we use **sub-customers** — QB's built-in parent/child customer hierarchy, available on all tiers including free Builder API tier.

```
QB Customer: "John Smith"                       <-- your customers table
    |-- QB Sub-Customer: "John Smith - Kitchen"  <-- your projects table
    |-- QB Sub-Customer: "John Smith - Patio"    <-- another project
```

- Sub-customer = Customer with `ParentRef` pointing to parent
- Invoices assigned to sub-customer (the project), not parent
- Bills/expenses from subcontractors also assigned to sub-customer
- `BillWithParent: true` groups billing under parent for homeowner statements
- QB's "Profit & Loss by Customer" report shows per-project profitability

### 2.7 Schema Additions (existing tables)

| Table | New Column | Type | Purpose |
|-------|------------|------|---------|
| `customers` | `qbCustomerId` | `text` | QB parent customer ID |
| `projects` | `qbSubCustomerId` | `text` | QB sub-customer ID |
| `proposals` | `qbInvoiceId` | `text` | QB invoice ID |
| `proposals` | `qbPaymentStatus` | `text` | `unpaid`, `partial`, `paid` (synced from QB) |

### 2.8 Webhook Handler

**File:** `src/app/api/webhooks/quickbooks/route.ts`

```
POST /api/webhooks/quickbooks
    |
    |-- Verify HMAC-SHA256 signature (using QB_WEBHOOK_VERIFIER_TOKEN)
    |-- Parse notification payload (batch of change notifications)
    |-- For each changed entity:
    |     |-- Payment changed --> syncQbPaymentJob.dispatch({ paymentId, realmId })
    |     |-- Invoice changed --> syncQbInvoiceJob.dispatch({ invoiceId, realmId })
    |-- Return 200 OK (must respond quickly, processing is async via jobs)
```

QB webhooks send entity type + ID + operation, NOT the actual data. The QStash job then does a GET to fetch the updated entity (1 CorePlus API call per sync).

### 2.9 New QStash Jobs

| Job Key | Payload | Service Called |
|---------|---------|----------------|
| `create-qb-records` | `{ projectId }` | `accountingService.ensureCustomer()` + `ensureProjectSubCustomer()` + `createInvoice()` |
| `sync-qb-payment` | `{ paymentId, realmId }` | `accountingService.syncPaymentStatus()` |
| `sync-qb-invoice` | `{ invoiceId, realmId }` | `accountingService.syncInvoiceStatus()` |

### 2.10 Env Var Additions

- `QB_CLIENT_ID`
- `QB_CLIENT_SECRET`
- `QB_REDIRECT_URI`
- `QB_WEBHOOK_VERIFIER_TOKEN`

### 2.11 API Pricing Impact

| Operation | Classification | Cost |
|-----------|---------------|------|
| Create customer, sub-customer, invoice | **Core** (data-in) | Free, unlimited |
| Update customer, invoice | **Core** (data-in) | Free, unlimited |
| GET customer, invoice, payment (reads) | **CorePlus** (data-out) | Metered: 500K/mo free on Builder tier |
| Receive webhooks | Free | Free (but fetching changed data = 1 CorePlus read) |

For a single company with a few hundred projects, usage will be a tiny fraction of the free 500K/month limit.

---

## 3. Integration Points + Data Flow

### 3.1 Outbound: Contract Signing

```
Agent clicks "Send Contract"
    --> tRPC: proposals.sendForSigning({ proposalId })
        --> contractService.createSigningRequest(proposalId)
            --> Fetch proposal + customer from DAL
            --> Select template (senior vs base)
            --> Map fields (SOW, TCP, deposit, customer info)
            --> POST to Zoho Sign API
            --> Store signingRequestId on proposal
        --> Return { requestId }
```

### 3.2 Outbound: QB Record Creation

```
Proposal approved --> project created
    --> createQbRecordsJob.dispatch({ projectId })
        --> accountingService.ensureCustomer(customer)
            --> Query QB for existing customer by email/name
            --> If not found: POST create customer
            --> Store qbCustomerId on customer record
        --> accountingService.ensureProjectSubCustomer(project, qbCustomerId)
            --> POST create sub-customer with ParentRef + BillWithParent
            --> Store qbSubCustomerId on project
        --> accountingService.createInvoice(project, approvedProposals)
            --> Build line items from proposal SOW/pricing
            --> POST create invoice linked to sub-customer
            --> Store qbInvoiceId on proposal
```

### 3.3 Inbound: QB Payment Sync

```
QB: Payment received on Invoice #123
    --> POST /api/webhooks/quickbooks
        --> Verify HMAC signature
        --> syncQbPaymentJob.dispatch({ paymentId, realmId })
            --> accountingService.syncPaymentStatus(paymentId)
                --> GET payment from QB (1 CorePlus read)
                --> Find linked invoice --> find proposal in DB
                --> Update qbPaymentStatus (unpaid/partial/paid)
```

### 3.4 QStash Jobs Inventory (after both services ship)

| Job | Trigger | Service Called |
|-----|---------|----------------|
| `generate-ai-summary` | Proposal created | `ai/generateProjectSummary()` |
| `sync-customers` | Scheduled (transitional) | `syncAllCustomers()` |
| `optimize-image` | Media uploaded | `r2/` functions (future: `mediaService`) |
| `create-qb-records` | Project created | `accountingService.*` |
| `sync-qb-payment` | QB webhook | `accountingService.syncPaymentStatus()` |
| `sync-qb-invoice` | QB webhook | `accountingService.syncInvoiceStatus()` |

### 3.5 Services Layer (after both ship)

```
src/shared/services/
  # -- Domain Services --
  contract.service.ts              <-- NEW: Zoho Sign signing workflow
  accounting.service.ts            <-- NEW: QB customer/invoice/payment sync

  # -- SDK Clients (Infrastructure) --
  zoho-sign/                       <-- NEW: auth + API client
  quickbooks/                      <-- NEW: auth + API client + token storage
  resend/                          <-- Email templates + client
  r2/                              <-- Storage infrastructure
  notion/                          <-- Trades/scopes/SOW data
  upstash/                         <-- QStash + Ably
  ai/                              <-- OpenAI generation
  google-drive/                    <-- File picker + download

  # -- Deleted --
  docusign/                        <-- Removed

  # -- Future domain services (from plan, not in this spec) --
  # email.service.ts               <-- Phase 2: wraps resend/
  # notification.service.ts        <-- Phase 2: wraps resend/ (+ SMS/push future)
  # media.service.ts               <-- Phase 5: coordinates r2/ + DAL + jobs
  # scheduling.service.ts          <-- Phase 5: follow-up reminders
  # analytics.service.ts           <-- Phase 5: engagement scoring
  # ai.service.ts                  <-- Phase 5: expanded AI
  # pdf.service.ts                 <-- Phase 5: proposal PDFs
  # webhook.service.ts             <-- Phase 5: incoming webhook verification
  # construction-data.service.ts   <-- Phase 5: trades/scopes/SOW from Notion
```

---

## 4. Verification + Testing

### 4.1 Zoho Sign Verification

| Check | Method |
|-------|--------|
| Auth token flow | Refresh token --> access token, verify in logs |
| Template field mapping | Create signing request with test proposal --> verify fields in Zoho Sign dashboard |
| Create draft | `contractService.createSigningRequest()` returns `requestId`, stored on proposal |
| Send for signing | `contractService.sendSigningRequest()` triggers email to homeowner |
| DocuSign fully removed | `grep -r "docusign\|DS_" src/` returns 0 hits |
| Column rename | `signingRequestId` exists, `docusignEnvelopeId` does not |
| Env vars clean | No `DS_*` in `server-env.ts`, all `ZOHO_SIGN_*` validated |

### 4.2 QuickBooks Verification

| Check | Method |
|-------|--------|
| OAuth flow | `/api/quickbooks/callback` --> tokens stored in `qb_auth_tokens` |
| Token auto-refresh | Expired access token --> silent refresh from DB-stored refresh token |
| Create customer | `ensureCustomer()` --> verify in QB sandbox |
| Create sub-customer | `ensureProjectSubCustomer()` --> verify under parent in QB |
| Create invoice | `createInvoice()` --> verify in QB linked to sub-customer |
| Idempotency | `ensureCustomer()` twice, same customer --> no duplicate |
| Webhook verification | Valid HMAC POST --> job dispatched |
| Webhook rejection | Invalid HMAC POST --> 401, no job |
| Payment sync | Webhook for payment --> `qbPaymentStatus` updated on proposal |

### 4.3 Build Verification

```bash
pnpm tsc          # No type errors
pnpm lint         # No lint errors
```

### 4.4 Post-Cleanup Verification

```bash
# DocuSign fully removed
grep -r "docusign\|DS_INTEGRATION\|DS_JWT\|DS_ACCOUNT\|DS_USER\|DS_DEV_USER" src/
# Expected: 0 results

# No orphaned imports
grep -r "from.*docusign" src/
# Expected: 0 results

# jsonwebtoken still needed?
grep -r "jsonwebtoken\|from 'jsonwebtoken'" src/
# If 0 results --> remove from package.json
```

### 4.5 Sandbox Strategy

- **Zoho Sign:** Sandbox environment via separate base URL in constants, toggled by `NODE_ENV`
- **QuickBooks:** Sandbox company (auto-provisioned with developer app). Base URL: `sandbox-quickbooks.api.intuit.com` (dev) vs `quickbooks.api.intuit.com` (prod)

### 4.6 Out of Scope

- E2E browser tests (no Playwright coverage for these flows yet)
- Zoho Sign webhooks (tracked in [#75](https://github.com/OlisDevSpot/tri-pros-website/issues/75))
- Subcontractor bills in QB (needs future `subcontractors` table)
- `emailService`, `notificationService`, and other Phase 2+ domain services

---

## 5. Dependencies + Prerequisites

### Zoho Sign
- Zoho Sign account with yearly subscription (done)
- API credentials: Client ID, Client Secret, Refresh Token from Zoho API Console
- Templates created in Zoho Sign with merge fields matching the field mapping table

### QuickBooks
- QuickBooks Online Plus or Advanced subscription (for expense assignment to sub-customers)
- Developer app created in Intuit Developer Portal (Client ID + Client Secret)
- OAuth callback URL registered: `{APP_URL}/api/quickbooks/callback`
- Webhook endpoint registered in Intuit Developer Portal
- QB sandbox company for development testing
