# Proposal PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On-demand, homeowner-safe PDF version of a proposal, opened in a new tab from a navbar kebab popover and a bottom-of-flow card.

**Architecture:** A pdfmake doc-definition (`buildProposalDocDefinition`) rendered via the existing `renderPdf` pipeline, exposed through the already-stubbed `pdfService.generateProposalPdf` and a token-gated route handler `GET /api/proposals/[proposalId]/pdf?token=` that mirrors the existing summary route. UI: a `ProposalNavbarMenu` kebab (shadcn Popover) that also absorbs the agent/homeowner view-mode toggle, plus a `PdfFallbackCard` after the Agreement section.

**Tech Stack:** Next.js 15 route handlers, pdfmake (existing), tRPC-free (route + service only), shadcn Popover, lucide-react, nuqs, CASL.

**Spec:** `docs/superpowers/specs/2026-07-09-proposal-pdf-export-design.md` — read it before starting.

## Global Constraints

- Verification is `pnpm tsc` + `pnpm lint` — **NEVER `pnpm build`**. No test framework exists in this repo; each task ends with tsc/lint plus a concrete manual/scripted check.
- Work on `main`. Stage explicitly by path — **never `git add -A`**.
- Named exports only; one component per file; no file-level constants (inline them or compute inside functions).
- All company data from `src/shared/constants/company/` — never hardcode name/phone/license.
- Customer phone formatting only via `formatPhone` from `src/shared/lib/phone.ts`.
- The PDF must NEVER read `sow[].financials.costLines` or margin data (agent-only). Final price is ALWAYS `computeFinalTcp(fundingJSON.data)` — never a stored value.
- `motion/react` (never framer-motion) if animation is touched; existing components already handle this.
- Icons: lucide-react with `Icon` suffix names (`MoreVerticalIcon`, `FileTextIcon`, …) as used in `src/shared/components/entity-actions/ui/entity-action-dropdown.tsx:5`.
- shadcn primitives over raw HTML: interactive elements use `Button` (with className overrides), never bare `<button>` — the old `ViewModeToggleMobile`'s raw `<button>` is documented drift; do not carry it forward.
- Lint rules that commonly bite here: `perfectionist/sort-imports` (type imports first, then alphabetical) and `antfu/if-newline`.
- Do NOT use `<EntityActionMenu>`/the entity action registry for the navbar kebab — that system serves dashboard CRUD surfaces; this is flow chrome, and a plain shadcn Popover is the ruled-correct primitive (convention audit).
- Commit after every task with a conventional-commit message.

---

### Task 1: Relocate `sanitizeFilename` to shared lib

The helper is generic; an API route must not import from `providers/zoho-sign/lib` (provider-boundary rule). It has exactly two importers.

**Files:**
- Create: `src/shared/lib/sanitize-filename.ts`
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/assemble-envelope.ts:6`
- Modify: `src/shared/services/zoho-sync.service.ts:6`
- Delete: `src/shared/services/providers/zoho-sign/lib/sanitize-filename.ts`

**Interfaces:**
- Produces: `sanitizeFilename(name: string): string` at `@/shared/lib/sanitize-filename` (used by Task 3).

- [ ] **Step 1: Create the shared-lib copy**

```ts
// src/shared/lib/sanitize-filename.ts
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200)
}
```

- [ ] **Step 2: Update both importers**

In `assemble-envelope.ts` replace line 6:

```ts
// before
import { sanitizeFilename } from '../sanitize-filename'
// after
import { sanitizeFilename } from '@/shared/lib/sanitize-filename'
```

In `zoho-sync.service.ts` replace line 6:

```ts
// before
import { sanitizeFilename } from './providers/zoho-sign/lib/sanitize-filename'
// after
import { sanitizeFilename } from '@/shared/lib/sanitize-filename'
```

- [ ] **Step 3: Delete the old file and confirm no stragglers**

```bash
rm src/shared/services/providers/zoho-sign/lib/sanitize-filename.ts
grep -rn "zoho-sign/lib/sanitize-filename\|'../sanitize-filename'" src   # expect: no output
```

- [ ] **Step 4: Update the convention doc that cites this file**

`docs/codebase-conventions/service-architecture.md` uses `sanitize-filename.ts` as its example of a legitimate provider `lib/` file — leaving it would make the doc's own example dangle. Two spots:

1. In the directory-shape listing (~line 105), change the parenthetical example from `` (e.g., `sanitize-filename.ts`, `access-token-cache.ts`, `config.ts` … `` to `` (e.g., `access-token-cache.ts`, `config.ts` … `` (drop only the sanitize-filename mention, keep the rest of the sentence intact).
2. In the "`lib/` is the exception, not the rule" bullet, change "a token-refresh cache used internally by the client itself, a filename sanitizer used by call sites that produce multipart bodies, a `config.ts` that hosts…" to "a token-refresh cache used internally by the client itself, a `config.ts` that hosts…".

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: both pass with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/sanitize-filename.ts src/shared/services/providers/zoho-sign/lib/documents/assemble-envelope.ts src/shared/services/zoho-sync.service.ts docs/codebase-conventions/service-architecture.md
git add -u src/shared/services/providers/zoho-sign/lib/sanitize-filename.ts
git commit -m "refactor(lib): move sanitizeFilename out of zoho-sign provider into shared lib"
```

---

### Task 2: Proposal doc-definition + service implementation

**Files:**
- Create: `src/shared/lib/pdf/proposal-doc-definition.ts`
- Modify: `src/shared/services/pdf.service.ts:14-16` (replace the throwing stub)

**Interfaces:**
- Consumes: `renderPdf(def)` (`src/shared/lib/pdf/render-pdf.ts`), `tiptapToPdfmake(doc)` + `TiptapNode` (`src/shared/lib/pdf/tiptap-to-pdfmake.ts`), `ProposalWithCustomer` (`src/shared/entities/proposals/dal/server/queries.ts:42`), `computeFinalTcp` (`src/shared/entities/proposals/lib/compute-final-tcp.ts:13`), `companyInfo`/`licenses` (`@/shared/constants/company`), `formatAsDollars` (`@/shared/lib/formatters`), `formatPhone` (`@/shared/lib/phone`).
- Produces: `buildProposalDocDefinition(proposal: ProposalWithCustomer): Promise<TDocumentDefinitions>` and a working `pdfService.generateProposalPdf(ctx, { proposalId }): Promise<Buffer>` (used by Task 3).

- [ ] **Step 1: Create `src/shared/lib/pdf/proposal-doc-definition.ts`**

Notes baked into this code:
- Async (unlike `buildSowDocDefinition`) because it reads the logo file. Logo is `public/company/logo/logo-dark-right.jpg` (dark lockup for a white page — `companyInfo.logo` points at a nonexistent `/logo.png`, do not use it). A missing logo logs and degrades to text-only header; it must not fail the render.
- Content width is 483pt (A4 595 − 2×56 margins) — used for the divider line.
- Uses ASCII hyphen (not unicode minus) in discount amounts — Helvetica/WinAnsi safety.
- Never touches `financials.costLines`.

```ts
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { TiptapNode } from './tiptap-to-pdfmake'
import type { ProposalWithCustomer } from '@/shared/entities/proposals/dal/server/queries'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { companyInfo, licenses } from '@/shared/constants/company'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { formatAsDollars } from '@/shared/lib/formatters'
import { formatPhone } from '@/shared/lib/phone'
import { tiptapToPdfmake } from './tiptap-to-pdfmake'

/**
 * Builds the full customer-facing proposal PDF: branded header, prepared-for
 * block, project overview, scope of work (trades/scopes/rich text), investment
 * table, agreement notes. Always homeowner-safe — never reads cost lines or
 * margin data, and the final price is derived via computeFinalTcp.
 * see @/shared/entities/proposals/DOCS.md#final-tcp-derived
 */
export async function buildProposalDocDefinition(proposal: ProposalWithCustomer): Promise<TDocumentDefinitions> {
  const project = proposal.projectJSON.data
  const funding = proposal.fundingJSON.data
  const pricingMode = proposal.formMetaJSON.pricingMode
  const customer = proposal.customer
  const logoDataUrl = await loadLogoDataUrl()

  const content: Content[] = [
    buildBrandedHeader(logoDataUrl),
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 1, lineColor: '#334155' }],
      margin: [0, 0, 0, 20],
    },
    { text: 'Project Proposal', style: 'docTitle' },
    { text: project.label || proposal.label || 'Proposal', style: 'subtitle' },
    buildPreparedForBlock(proposal),
    ...buildProjectOverview(project),
    ...buildScopeOfWork(project.sow, pricingMode),
    ...buildInvestment(project.sow, funding, pricingMode),
    ...(project.agreementNotes
      ? [
          { text: 'Agreement Notes', style: 'sectionTitle' } satisfies Content,
          { text: project.agreementNotes, margin: [0, 0, 0, 12] } satisfies Content,
        ]
      : []),
  ]

  return {
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `${companyInfo.name}  •  ${contactValue('phone')}  •  ${contactValue('email')}`, style: 'footer' },
        { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', style: 'footer' },
      ],
      margin: [56, 16, 56, 0],
    }),
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.3 },
    styles: {
      docTitle: { fontSize: 20, bold: true, margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 11, color: '#666', margin: [0, 0, 0, 20] },
      companyName: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
      meta: { fontSize: 8.5, color: '#666', margin: [0, 0, 0, 1] },
      sectionLabel: { fontSize: 8, bold: true, color: '#888', margin: [0, 0, 0, 4] },
      sectionTitle: { fontSize: 14, bold: true, margin: [0, 20, 0, 8] },
      itemTitle: { fontSize: 12, bold: true, margin: [0, 12, 0, 2] },
      sectionPrice: { fontSize: 10, bold: true, color: '#334155', margin: [0, 0, 0, 4] },
      footer: { fontSize: 8, color: '#999' },
      h1: { fontSize: 14, bold: true },
      h2: { fontSize: 12, bold: true },
      h3: { fontSize: 11, bold: true },
      quote: { italics: true, color: '#555' },
    },
    pageMargins: [56, 56, 56, 72],
  }
}

function buildBrandedHeader(logoDataUrl: string | null): Content {
  const license = licenses[0]
  const left: Content = {
    width: '*',
    stack: [
      { text: companyInfo.name, style: 'companyName' },
      { text: contactValue('mainOffice'), style: 'meta' },
      { text: `${contactValue('phone')}  •  ${contactValue('email')}`, style: 'meta' },
      { text: `CA License #${license.licenseNumber} — ${license.type}`, style: 'meta' },
    ],
  }
  if (!logoDataUrl) {
    return { columns: [left], margin: [0, 0, 0, 12] }
  }
  return {
    columns: [left, { width: 140, image: logoDataUrl, fit: [140, 48], alignment: 'right' }],
    margin: [0, 0, 0, 12],
  }
}

function buildPreparedForBlock(proposal: ProposalWithCustomer): Content {
  const customer = proposal.customer
  const addressLine = customer?.address
    ? `${customer.address}, ${customer.city ?? ''} ${customer.state ?? 'CA'} ${customer.zip ?? ''}`.replace(/\s+/g, ' ').trim()
    : null
  const customerLines: Content[] = [
    { text: 'PREPARED FOR', style: 'sectionLabel' },
    { text: customer?.name ?? '—', bold: true },
  ]
  if (addressLine) {
    customerLines.push({ text: addressLine })
  }
  if (customer?.phone) {
    customerLines.push({ text: formatPhone(customer.phone) })
  }
  if (customer?.email) {
    customerLines.push({ text: customer.email })
  }

  const date = new Date(proposal.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return {
    columns: [
      { width: '*', stack: customerLines },
      {
        width: 180,
        stack: [
          { text: 'PROPOSAL', style: 'sectionLabel' },
          { text: `Date: ${date}` },
          { text: `Valid for: ${proposal.projectJSON.data.validThroughTimeframe}` },
        ],
      },
    ],
    margin: [0, 0, 0, 8],
  }
}

function buildProjectOverview(project: ProposalWithCustomer['projectJSON']['data']): Content[] {
  const parts: Content[] = []
  if (project.summary) {
    parts.push({ text: project.summary, margin: [0, 0, 0, 8] })
  }
  if (project.projectObjectives.length > 0) {
    parts.push({ text: 'Project objectives', bold: true, margin: [0, 4, 0, 2] })
    parts.push({ ul: [...project.projectObjectives], margin: [0, 0, 0, 8] })
  }
  if (project.homeAreasUpgrades.length > 0) {
    parts.push({ text: `Areas of the home: ${project.homeAreasUpgrades.join(', ')}`, margin: [0, 0, 0, 4] })
  }
  if (project.energyBenefits) {
    parts.push({ text: `Efficiency benefits: ${project.energyBenefits}`, margin: [0, 0, 0, 4] })
  }
  if (parts.length === 0) {
    return []
  }
  return [{ text: 'Project Overview', style: 'sectionTitle' }, ...parts]
}

function buildScopeOfWork(
  sow: ProposalWithCustomer['projectJSON']['data']['sow'],
  pricingMode: 'total' | 'breakdown',
): Content[] {
  const parts: Content[] = [{ text: 'Scope of Work', style: 'sectionTitle' }]
  sow.forEach((section, i) => {
    parts.push({ text: `${i + 1}. ${section.title || 'Untitled scope'}`, style: 'itemTitle' })
    const metaLine = [
      `Trade: ${section.trade.label}`,
      section.scopes.length > 0 ? `Scopes: ${section.scopes.map(s => s.label).join(', ')}` : null,
    ].filter(Boolean).join('   •   ')
    parts.push({ text: metaLine, style: 'meta', margin: [0, 0, 0, 6] })
    if (pricingMode === 'breakdown' && section.financials.sectionPrice) {
      parts.push({ text: `Section price: ${formatAsDollars(section.financials.sectionPrice)}`, style: 'sectionPrice' })
    }
    const doc = safeParseDoc(section.contentJSON)
    if (doc) {
      parts.push(...(tiptapToPdfmake(doc) as Content[]))
    }
  })
  return parts
}

function buildInvestment(
  sow: ProposalWithCustomer['projectJSON']['data']['sow'],
  funding: ProposalWithCustomer['fundingJSON']['data'],
  pricingMode: 'total' | 'breakdown',
): Content[] {
  const rows: TableCell[][] = []
  if (pricingMode === 'breakdown') {
    for (const section of sow) {
      if ((section.financials.sectionPrice ?? 0) > 0) {
        rows.push([{ text: section.title }, { text: formatAsDollars(section.financials.sectionPrice!), alignment: 'right' }])
      }
    }
    if ((funding.miscPrice ?? 0) > 0) {
      rows.push([{ text: 'Additional items' }, { text: formatAsDollars(funding.miscPrice!), alignment: 'right' }])
    }
    rows.push([{ text: 'Subtotal', bold: true }, { text: formatAsDollars(funding.startingTcp), bold: true, alignment: 'right' }])
  }
  else {
    rows.push([{ text: 'Contract price' }, { text: formatAsDollars(funding.startingTcp), alignment: 'right' }])
  }
  for (const inc of funding.incentives) {
    if (inc.type === 'discount') {
      rows.push([
        { text: `Discount${inc.notes ? ` — ${inc.notes}` : ''}`, color: '#166534' },
        { text: `-${formatAsDollars(inc.amount)}`, alignment: 'right', color: '#166534' },
      ])
    }
    else {
      rows.push([
        { text: `Exclusive offer — ${inc.offer}${inc.notes ? ` (${inc.notes})` : ''}`, color: '#166534' },
        { text: 'Included', alignment: 'right', color: '#166534' },
      ])
    }
  }
  rows.push([
    { text: 'Final contract price', bold: true, fontSize: 12 },
    { text: formatAsDollars(computeFinalTcp(funding)), bold: true, fontSize: 12, alignment: 'right' },
  ])
  rows.push([{ text: 'Deposit due at signing' }, { text: formatAsDollars(funding.depositAmount), alignment: 'right' }])

  return [
    { text: 'Investment', style: 'sectionTitle' },
    { table: { widths: ['*', 'auto'], body: rows }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 12] },
  ]
}

function contactValue(accessor: 'mainOffice' | 'phone' | 'email'): string {
  const entry = companyInfo.contactInfo.find(c => c.accessor === accessor)
  return entry ? entry.value.replace(/\n/g, ' ') : ''
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), 'public/company/logo/logo-dark-right.jpg'))
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  }
  catch (error) {
    console.error('[proposal-pdf] logo load failed — rendering text-only header', error)
    return null
  }
}

function safeParseDoc(json: string): TiptapNode | null {
  try {
    const parsed = JSON.parse(json) as TiptapNode
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      return parsed
    }
    return null
  }
  catch {
    return null
  }
}
```

- [ ] **Step 2: Implement the service stub**

In `src/shared/services/pdf.service.ts`, add the import and replace the stub (keep `generateFinanceForm` throwing):

```ts
import { buildProposalDocDefinition } from '@/shared/lib/pdf/proposal-doc-definition'
```

```ts
    /**
     * Full customer-facing proposal PDF (branding, customer block, SOW,
     * homeowner-safe pricing). Served by /api/proposals/[proposalId]/pdf.
     */
    generateProposalPdf: async (ctx: ScopedContext, { proposalId }: { proposalId: string }): Promise<Buffer> => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
      if (!proposal) {
        throw new Error(`pdfService.generateProposalPdf: proposal ${proposalId} not found`)
      }
      const docDef = await buildProposalDocDefinition(proposal)
      return renderPdf(docDef)
    },
```

- [ ] **Step 3: Verify types**

Run: `pnpm tsc && pnpm lint`
Expected: pass. If pdfmake `Content` unions complain about the `satisfies Content` entries or column stacks, fix the shapes — do not `as any`.

- [ ] **Step 4: Fixture render — eyeball the output**

Write a THROWAWAY script at `scripts/tmp-render-proposal-pdf-fixture.ts` — it must live inside the repo so tsx resolves the `@/` path aliases used by the module under test. **Delete it in the last step of this task; never commit it.** No env/DB needed (pure fixture). It builds a fixture `ProposalWithCustomer`-shaped object covering: breakdown pricing, 2 SOW sections with tiptap content, a discount + an exclusive-offer incentive, miscPrice, agreement notes, full customer block:

```ts
import { writeFile } from 'node:fs/promises'
import { buildProposalDocDefinition } from '@/shared/lib/pdf/proposal-doc-definition'
import { renderPdf } from '@/shared/lib/pdf/render-pdf'

const tiptap = JSON.stringify({ type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Demolish existing surfaces and haul away debris. ' }, { type: 'text', text: 'Per plan.', marks: [{ type: 'bold' }] }] },
  { type: 'bulletList', content: [
    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Install new fixtures' }] }] },
    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Patch and paint' }] }] },
  ] },
] })

const proposal = {
  id: 'fixture', label: 'Kitchen & Bath Remodel', createdAt: '2026-07-09T00:00:00.000Z', token: 'tpr-fixture',
  customer: { id: 'c1', name: 'Jane Homeowner', phone: '8185551234', email: 'jane@example.com', address: '123 Main St', city: 'Los Angeles', state: 'CA', zip: '90001', customerAge: null },
  formMetaJSON: { pricingMode: 'breakdown', envelopeDocumentIds: null },
  projectJSON: { meta: { enabled: true }, data: {
    label: 'Kitchen & Bath Remodel', type: 'general-remodeling', summary: 'Complete kitchen and hall bath renovation.',
    timeAllocated: '6 weeks', validThroughTimeframe: '60 days', energyBenefits: 'LED lighting throughout',
    projectObjectives: ['Modernize kitchen', 'Improve storage'], homeAreasUpgrades: ['kitchen', 'bathroom'],
    agreementNotes: 'Permits pulled by contractor. Appliances by owner.',
    sow: [
      { title: 'Kitchen', trade: { id: 't1', label: 'Kitchen Remodeling' }, scopes: [{ id: 's1', label: 'Cabinets' }, { id: 's2', label: 'Countertops' }], contentJSON: tiptap, html: '', financials: { sectionPrice: 42000, costLines: [{ id: 'x', label: 'SHOULD NEVER APPEAR', amount: 999, relatedScopeId: 's1' }], incentives: [] } },
      { title: 'Hall Bathroom', trade: { id: 't2', label: 'Bathroom Remodeling' }, scopes: [{ id: 's3', label: 'Shower' }], contentJSON: tiptap, html: '', financials: { sectionPrice: 18000, costLines: [], incentives: [] } },
    ],
  } },
  fundingJSON: { meta: { enabled: true, showPricingBreakdown: true }, data: {
    cashInDeal: 0, depositAmount: 1000, miscPrice: 2000, startingTcp: 62000,
    incentives: [{ type: 'discount', amount: 3000, notes: 'Showcase program' }, { type: 'exclusive-offer', offer: 'Free sink upgrade' }],
  } },
} as never

const def = await buildProposalDocDefinition(proposal)
const buf = await renderPdf(def)
await writeFile('/mnt/c/Users/porat/Downloads/proposal-pdf-fixture.pdf', buf)
console.log('wrote /mnt/c/Users/porat/Downloads/proposal-pdf-fixture.pdf')
```

Run from the repo root: `pnpm tsx scripts/tmp-render-proposal-pdf-fixture.ts`
Expected: script prints the output path; open the PDF (Windows Downloads) and confirm: header w/ logo + license, prepared-for block, overview, 2 SOW sections with section prices, Investment table with subtotal 62,000 / discount -3,000 / final 59,000 / deposit 1,000, agreement notes, footer page numbers, and **the string "SHOULD NEVER APPEAR" is absent** (`pdftotext` or visual check).

- [ ] **Step 5: Delete the throwaway script and commit**

```bash
rm scripts/tmp-render-proposal-pdf-fixture.ts
git add src/shared/lib/pdf/proposal-doc-definition.ts src/shared/services/pdf.service.ts
git commit -m "feat(pdf): full proposal PDF doc-definition + implement pdfService.generateProposalPdf"
```

---

### Task 3: Token-gated PDF route + Vercel tracing

**Files:**
- Create: `src/app/api/proposals/[proposalId]/pdf/route.ts`
- Modify: `next.config.ts:42-55` (`outputFileTracingIncludes`)

**Interfaces:**
- Consumes: `pdfService.generateProposalPdf` (Task 2), `sanitizeFilename` (Task 1), `getFullView` + `SYSTEM_CONTEXT` (existing), `companyInfo` (existing).
- Produces: `GET /api/proposals/{id}/pdf?token=tpr-…` → `application/pdf` inline (used by Tasks 4–5 via `getProposalPdfUrl`).

- [ ] **Step 1: Create the route handler**

Auth mirrors `src/app/api/proposals/[proposalId]/summary/route.ts:14-34` exactly (token IS the authorization on the shareable path — see `src/shared/entities/proposals/DOCS.md#shareable-via-token`; never add CASL here). The double `getFullView` (route auth + service) is deliberate — the service keeps its self-contained signature.

```ts
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { companyInfo } from '@/shared/constants/company'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { sanitizeFilename } from '@/shared/lib/sanitize-filename'
import { pdfService } from '@/shared/services/pdf.service'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params
  const token = new URL(req.url).searchParams.get('token')

  if (!token) {
    return Response.json({ error: 'Missing token' }, { status: 401 })
  }

  const result = await getFullView(SYSTEM_CONTEXT, { id: proposalId })
  if (!result.success || !result.data) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  const proposal = result.data

  if (proposal.token !== token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const buffer = await pdfService.generateProposalPdf(SYSTEM_CONTEXT, { proposalId })
    const baseName = sanitizeFilename(`${companyInfo.nickname} Proposal - ${proposal.customer?.name ?? proposal.label ?? proposalId}`).replace(/"/g, '')
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${baseName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  catch (error) {
    console.error(`[proposal-pdf] render failed for proposal ${proposalId}`, error)
    return Response.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Add tracing entry to `next.config.ts`**

Inside the existing `outputFileTracingIncludes` object, after the `/api/qstash-jobs` entry:

```ts
    // The proposal PDF route renders via pdfmake→pdfkit (same AFM/ICC
    // runtime reads as qstash-jobs — see comment above) and fs-reads the
    // logo from public/ for the branded header.
    '/api/proposals/[proposalId]/pdf': [
      './node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*',
      './public/company/logo/logo-dark-right.jpg',
    ],
```

- [ ] **Step 3: Verify types**

Run: `pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 4: Manual route verification against a real dev proposal**

1. Start dev: `pnpm dev` (honor `.env.local` PORT if set).
2. Get a real `proposalId` + `token`: open `http://localhost:3000/dashboard/proposals`, open any proposal, copy its share/view link — it has the shape `/proposal-flow/proposal/{id}?token=tpr-…`.
3. Checks (replace ID/TOKEN):

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "http://localhost:3000/api/proposals/ID/pdf?token=TOKEN"   # expect: 200 application/pdf
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/proposals/ID/pdf?token=tpr-wrong"              # expect: 401
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/proposals/ID/pdf"                              # expect: 401
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/proposals/00000000-0000-0000-0000-000000000000/pdf?token=TOKEN"  # expect: 404
```

4. Open the 200 URL in a browser — PDF renders inline with all sections.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/proposals/[proposalId]/pdf/route.ts next.config.ts
git commit -m "feat(proposals): token-gated PDF export route + pdfkit tracing entry"
```

---

### Task 4: Navbar kebab menu (Popover) — absorbs view-mode toggle

**Files:**
- Modify: `src/shared/components/ui/popover.tsx` (add `PopoverClose` export)
- Create: `src/features/proposal-flow/hooks/use-view-mode-toggle.ts`
- Create: `src/features/proposal-flow/lib/get-proposal-pdf-url.ts`
- Create: `src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx`
- Modify: `src/features/proposal-flow/ui/components/navbar/navbar.tsx` (both branches)
- Modify: `src/features/proposal-flow/ui/components/proposal-flow-shell.tsx` (remove pill)
- Delete: `src/features/proposal-flow/ui/components/proposal/view-mode-toggle.tsx`

**Interfaces:**
- Consumes: route URL shape from Task 3; `useCurrentProposal` (`@/features/proposal-flow/hooks/use-current-proposal`); `useViewMode`; `Popover/PopoverTrigger/PopoverContent/PopoverClose`.
- Produces: `getProposalPdfUrl(proposalId: string, token: string): string`; `useViewModeToggle(): { isAgent: boolean, toggle: () => void }`; `<ProposalNavbarMenu variant="desktop" | "mobile" />` (Task 5 reuses `getProposalPdfUrl`).

- [ ] **Step 1: Add `PopoverClose` to the shadcn wrapper**

In `src/shared/components/ui/popover.tsx`, add before the export line and extend the export:

```tsx
function PopoverClose({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />
}
```

```tsx
export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger }
```

- [ ] **Step 2: Extract the toggle hook**

`useToggle` currently lives privately in `view-mode-toggle.tsx:13-23` (a file this task deletes). Recreate it as a feature hook:

```ts
// src/features/proposal-flow/hooks/use-view-mode-toggle.ts
'use client'

import { useQueryState } from 'nuqs'

import { useViewMode } from './use-view-mode'

/**
 * Agent-side toggle between customer and agent view. Writes the nuqs
 * `view` param; useViewMode (CASL-gated) remains the single source of truth.
 * see ../DOCS.md#view-mode-defaults-to-customer-casl-gates-agent
 */
export function useViewModeToggle() {
  const viewMode = useViewMode()
  const [, setView] = useQueryState('view')
  const isAgent = viewMode === 'agent'

  function toggle() {
    setView(isAgent ? null : 'agent')
  }

  return { isAgent, toggle }
}
```

- [ ] **Step 3: PDF URL helper**

```ts
// src/features/proposal-flow/lib/get-proposal-pdf-url.ts
/** Relative URL for the token-gated proposal PDF route (same-origin). */
export function getProposalPdfUrl(proposalId: string, token: string): string {
  return `/api/proposals/${proposalId}/pdf?token=${encodeURIComponent(token)}`
}
```

- [ ] **Step 4: Create `ProposalNavbarMenu`**

Design per the approved UI spec: desktop trigger reads as a tab-strip square (`hover:bg-foreground/40`, Radix stamps `data-state=open`); mobile trigger matches the old toggle's `rounded-lg` family; PDF row closes the popover, mode toggle keeps it open (the shell gradient re-tints live); segmented radio-group keeps the learned blue-eye/red-shield vocabulary; gradient hairline divider; all targets ≥44px; only the CASL section defers to post-mount (whole-menu deferral would CLS the mobile Select). Per convention (Rule 17), every interactive element is a shadcn `Button` with className overrides — no raw `<button>`. Note the nested `asChild` chain on the PDF row: `PopoverClose asChild → Button asChild → <a>` collapses onto the single anchor.

```tsx
// src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx
'use client'

import { ExternalLinkIcon, EyeIcon, FileTextIcon, MoreVerticalIcon, ShieldIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { useViewModeToggle } from '@/features/proposal-flow/hooks/use-view-mode-toggle'
import { getProposalPdfUrl } from '@/features/proposal-flow/lib/get-proposal-pdf-url'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { cn } from '@/shared/lib/utils'

interface Props {
  variant: 'desktop' | 'mobile'
}

/**
 * Kebab menu for auxiliary proposal-flow actions: "View as PDF" (everyone)
 * and the agent/homeowner view-mode toggle (CASL-gated). Replaces the old
 * fixed desktop pill and the mobile navbar toggle icon.
 */
export function ProposalNavbarMenu({ variant }: Props) {
  const proposal = useCurrentProposal()
  const ability = useAbility()
  const { isAgent, toggle } = useViewModeToggle()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const proposalId = proposal.data?.id
  const token = proposal.data?.token
  const pdfUrl = proposalId && token ? getProposalPdfUrl(proposalId, token) : null
  const showViewToggle = mounted && ability.can('update', 'Proposal')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Proposal options"
          className={cn(
            variant === 'desktop'
              ? 'h-full w-12 rounded-none hover:bg-foreground/40 data-[state=open]:bg-foreground/40'
              : 'size-11 rounded-lg shrink-0 bg-card/50 active:bg-card data-[state=open]:bg-card',
          )}
        >
          <MoreVerticalIcon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-64 p-1.5">
        {pdfUrl
          ? (
              <PopoverClose asChild>
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start gap-2.5 min-h-11 rounded-md px-3 py-2.5 text-sm font-medium"
                >
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    View as PDF
                    <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground/60" />
                  </a>
                </Button>
              </PopoverClose>
            )
          : (
              <Button
                type="button"
                variant="ghost"
                disabled
                className="w-full justify-start gap-2.5 min-h-11 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground/60"
              >
                <FileTextIcon className="size-4" />
                View as PDF
              </Button>
            )}

        {showViewToggle && (
          <>
            <div className="-mx-1.5 my-1.5 h-px bg-linear-to-r from-transparent via-border to-transparent" />
            <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Viewing as
            </div>
            <div role="radiogroup" aria-label="View mode" className="flex gap-1 p-1">
              <Button
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={!isAgent}
                onClick={() => isAgent && toggle()}
                className={cn(
                  'flex-1 gap-1.5 min-h-11 rounded-md text-sm font-medium',
                  !isAgent
                    ? 'bg-primary/20 text-primary hover:bg-primary/20 hover:text-primary'
                    : 'text-muted-foreground hover:bg-muted/40',
                )}
              >
                <EyeIcon className="size-4" />
                Homeowner
              </Button>
              <Button
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={isAgent}
                onClick={() => !isAgent && toggle()}
                className={cn(
                  'flex-1 gap-1.5 min-h-11 rounded-md text-sm font-medium',
                  isAgent
                    ? 'bg-destructive/20 text-destructive hover:bg-destructive/20 hover:text-destructive'
                    : 'text-muted-foreground hover:bg-muted/40',
                )}
              >
                <ShieldIcon className="size-4" />
                Agent
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 5: Integrate into the navbar, remove old toggles**

In `src/features/proposal-flow/ui/components/navbar/navbar.tsx`:

1. Replace the `ViewModeToggleMobile` import (line 9) with:

```tsx
import { ProposalNavbarMenu } from './navbar-menu'
```

2. Desktop branch — after the `proposalSteps.map(...)` expression (after line 69's closing paren of the map), add the kebab as a sibling (it sits after the last tab's `last-of-type:bg-primary` wrapper, so it doesn't inherit that background). The desktop branch becomes:

```tsx
      {!isMobile
        ? (
            <>
              {proposalSteps.map(step => (
                <div
                  key={step.accessor}
                  className="flex-1 last-of-type:bg-primary h-full"
                >
                  <Link
                    className="h-full w-full flex items-center justify-center hover:bg-foreground/40 transition data-[active=true]:bg-foreground/40"
                    href={`#${step.accessor}`}
                    data-active={activeSectionId === step.accessor}
                  >
                    {step.title}
                  </Link>
                </div>
              ))}
              <ProposalNavbarMenu variant="desktop" />
            </>
          )
        : (
```

3. Mobile branch — replace `<ViewModeToggleMobile />` (line 72) with `<ProposalNavbarMenu variant="mobile" />` (keep it before the `<Select>`).

In `src/features/proposal-flow/ui/components/proposal-flow-shell.tsx`: remove the `ViewModeToggle` import (line 6) and the `<ViewModeToggle />` element (line 33), AND update the docstring (lines 12-17) which currently says the shell "owns … the sticky desktop view-mode toggle" — replace that clause with a note that the view-mode toggle lives in the navbar kebab menu (`ProposalNavbarMenu`). Leaving the stale docstring is a ping-on-staleness violation.

- [ ] **Step 6: Delete the old toggle file**

```bash
grep -rn "view-mode-toggle" src   # expect: no remaining imports
rm src/features/proposal-flow/ui/components/proposal/view-mode-toggle.tsx
```

If grep shows other importers, update them first — do not leave dangling imports.

- [ ] **Step 7: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: pass.

Manual (dev server running, real proposal URL with token):
- Desktop: kebab renders at the right edge of the tab strip; opens frosted popover; "View as PDF" opens the PDF in a new tab and closes the popover; agent session sees the Viewing-as segmented control; clicking Agent re-tints the page red and keeps the popover open; the old top-right pill is gone.
- Mobile viewport (Chrome device mode): kebab sits left of the section Select, 44px target; same behaviors; no layout shift on hydration.
- Homeowner simulation: open the token URL in an incognito window — kebab shows ONLY "View as PDF" (no Viewing-as section), and `?view=agent` still has no effect.

- [ ] **Step 8: Commit**

```bash
git add src/shared/components/ui/popover.tsx src/features/proposal-flow/hooks/use-view-mode-toggle.ts src/features/proposal-flow/lib/get-proposal-pdf-url.ts src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx src/features/proposal-flow/ui/components/navbar/navbar.tsx src/features/proposal-flow/ui/components/proposal-flow-shell.tsx
git add -u src/features/proposal-flow/ui/components/proposal/view-mode-toggle.tsx
git commit -m "feat(proposal-flow): navbar kebab popover — View as PDF + relocated view-mode toggle"
```

---

### Task 5: Bottom "Prefer a classic PDF?" card

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/pdf-fallback-card.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`

**Interfaces:**
- Consumes: `getProposalPdfUrl` (Task 4), `useViewMode`, `Button` (`@/shared/components/ui/button`).
- Produces: `<PdfFallbackCard pdfUrl={string} />`.

- [ ] **Step 1: Create the card**

Design per the approved UI spec: a quiet coda, deliberately NOT a full Card-with-header section (must not upstage the Agreement/signing moment above it); frosted band + centered gradient hairline; accent flips blue/red with view mode via existing tokens only; single interactive target (the button); no own entrance animation (rides the parent motion fade).

```tsx
// src/features/proposal-flow/ui/components/proposal/pdf-fallback-card.tsx
'use client'

import { ExternalLinkIcon, FileTextIcon } from 'lucide-react'

import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  pdfUrl: string
}

/**
 * End-of-flow fallback for customers who prefer a classic document. A slim
 * frosted band — intentionally quieter than the proposal sections above it.
 */
export function PdfFallbackCard({ pdfUrl }: Props) {
  const isAgent = useViewMode() === 'agent'

  return (
    <section aria-labelledby="pdf-fallback-title">
      <div className="mx-auto mb-12 h-px w-2/3 bg-linear-to-r from-transparent via-border to-transparent" />

      <div
        className={cn(
          'rounded-xl border border-border/50 bg-card/60 backdrop-blur-md shadow-sm',
          'bg-linear-to-br from-card/80 to-card/40',
          'flex flex-col items-center gap-5 px-6 py-8 text-center',
          'sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-6 sm:text-left',
        )}
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-full ring-1',
              isAgent
                ? 'bg-destructive/10 text-destructive ring-destructive/20'
                : 'bg-primary/10 text-primary ring-primary/20',
            )}
          >
            <FileTextIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <p id="pdf-fallback-title" className="text-base font-semibold tracking-tight">
              Prefer a classic PDF?
            </p>
            <p className="text-sm font-light text-muted-foreground">
              View the complete proposal as a printable document.
            </p>
          </div>
        </div>

        <Button
          asChild
          size="lg"
          variant={isAgent ? 'destructive' : 'default'}
          className="w-full max-sm:h-11 sm:w-auto shrink-0"
        >
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <FileTextIcon />
            View PDF
            <ExternalLinkIcon className="size-3.5 opacity-70" />
          </a>
        </Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Render it after the steps**

In `src/features/proposal-flow/ui/components/proposal/index.tsx`:

1. Add imports:

```tsx
import { getProposalPdfUrl } from '@/features/proposal-flow/lib/get-proposal-pdf-url'
import { PdfFallbackCard } from './pdf-fallback-card'
```

2. Inside the `motion.div` (`className="space-y-20"`), immediately after the `proposalSteps.map(...)` block (after line 115's closing `)}`), add:

```tsx
            {token && (
              <PdfFallbackCard pdfUrl={getProposalPdfUrl(params.proposalId, token)} />
            )}
```

(`token` is already destructured at line 69; it inherits the container's `space-y-20` rhythm.)

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: pass.

Manual: scroll to the bottom of a proposal on desktop + mobile viewport — hairline then slim frosted band after the Agreement section; blue accent in homeowner view, red in agent view; "View PDF" opens the PDF in a new tab; mobile shows stacked/centered layout with a full-width ≥44px button.

- [ ] **Step 4: Commit**

```bash
git add src/features/proposal-flow/ui/components/proposal/pdf-fallback-card.tsx src/features/proposal-flow/ui/components/proposal/index.tsx
git commit -m "feat(proposal-flow): bottom PDF fallback card"
```

---

### Task 6: DOCS updates + final verification sweep

**Files:**
- Modify: `src/shared/entities/proposals/DOCS.md` (new slug)
- Modify: `src/features/proposal-flow/DOCS.md` (only if it describes the old toggle surfaces — check first)

- [ ] **Step 1: Document the new access surface in the entity DOCS**

Add to `src/shared/entities/proposals/DOCS.md`, near `#shareable-via-token` (match the file's existing section format — heading with slug anchor, invariant, anti-pattern):

```markdown
### PDF export is token-gated and homeowner-safe {#pdf-export-token-gated}

`GET /api/proposals/[proposalId]/pdf?token=` renders the full proposal PDF
on demand via `pdfService.generateProposalPdf` (pdfmake). Auth mirrors the
summary route: exact `proposal.token` match, no CASL — the token is the
authorization (see #shareable-via-token). The document is ALWAYS the
homeowner view: pricing respects `pricingMode`, the final price is derived
via `computeFinalTcp`, and the generator never reads
`sow[].financials.costLines`. There is no agent variant.

**Anti-pattern:** adding cost lines, margin data, or an "agent mode" to the
PDF — anyone with the share token can fetch it.
```

- [ ] **Step 2: Update the feature DOCS for the new toggle home**

```bash
grep -n "pill\|ViewModeToggle\|toggle" src/features/proposal-flow/DOCS.md
```

Update any line describing the fixed desktop pill or the mobile navbar toggle icon to describe the navbar kebab popover (`ProposalNavbarMenu`) as the toggle's home. Even if nothing matches, add a one-line note under the `#view-mode-defaults-to-customer-casl-gates-agent` section (matching the file's format): the toggle UI lives in the navbar kebab menu (`ui/components/navbar/navbar-menu.tsx`), driven by `useViewModeToggle`; `useViewMode` remains the CASL-gated source of truth. The conventions decision-tree puts feature-level UX/role-gating rules in this file.

- [ ] **Step 3: Full verification sweep**

1. `pnpm tsc && pnpm lint` — pass.
2. Content audit on a REAL proposal PDF (route URL from Task 3): compare against the live page in homeowner view — same sections, same prices, no cost lines (search the PDF text), `total`-mode proposal shows no per-section prices, `breakdown`-mode shows them.
3. `git status` — no unintended modified files.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/DOCS.md src/features/proposal-flow/DOCS.md
git commit -m "docs(proposals): document token-gated PDF export surface"
```

---

## Post-plan notes

- **Known stale ref (do NOT fix in this feature):** `companyInfo.logo = '/logo.png'` (`src/shared/constants/company/company-info.ts:13`) points at a file that doesn't exist in `public/`. This plan bypasses it by reading `public/company/logo/logo-dark-right.jpg` directly. Fix `companyInfo.logo` separately.
- Attaching this PDF to Zoho envelopes is out of scope; if wanted later it's one `generated-pdf` registry entry in `src/shared/services/providers/zoho-sign/lib/documents/registry.ts`.
