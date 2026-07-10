import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { TiptapNode } from './tiptap-to-pdfmake'
import type { ProposalWithCustomer } from '@/shared/entities/proposals/dal/server/queries'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { companyInfo, licenses } from '@/shared/constants/company'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { formatAsDollars } from '@/shared/lib/formatters'
import { formatPhone } from '@/shared/lib/phone'
import { tiptapToPdfmake } from './tiptap-to-pdfmake'

/**
 * Builds the full customer-facing proposal PDF: a bordered cover page
 * (company + customer identity), scope-of-work sections from page 2, and
 * the investment breakdown on its own closing page. Always homeowner-safe
 * — never reads cost lines or margin data, and the final price is derived
 * via computeFinalTcp.
 * see @/shared/entities/proposals/DOCS.md#final-tcp-derived
 * see docs/codebase-conventions/pdf-documents.md#layout-geometry
 */
export async function buildProposalDocDefinition(proposal: ProposalWithCustomer): Promise<TDocumentDefinitions> {
  const project = proposal.projectJSON.data
  const funding = proposal.fundingJSON.data
  const pricingMode = proposal.formMetaJSON.pricingMode
  const logoDataUrl = await loadLogoDataUrl()

  const content: Content[] = [
    ...buildCoverPage(proposal, logoDataUrl),
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
    // Double-rule frame on the cover page only — drawn on the background
    // layer at absolute coordinates so it never interacts with content flow.
    background: (currentPage, pageSize) => currentPage === 1
      ? {
          canvas: [
            { type: 'rect', x: 20, y: 20, w: pageSize.width - 40, h: pageSize.height - 40, lineWidth: 1.5, lineColor: '#334155' },
            { type: 'rect', x: 26, y: 26, w: pageSize.width - 52, h: pageSize.height - 52, lineWidth: 0.5, lineColor: '#334155' },
          ],
        }
      : undefined,
    // No footer on the cover — it carries the company block itself, and a
    // page-number line would sit inside the decorative frame.
    footer: (currentPage, pageCount) => currentPage === 1
      ? null
      : {
          columns: [
            { text: `${companyInfo.name}  •  ${contactValue('phone')}  •  ${contactValue('email')}`, style: 'footer' },
            { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', style: 'footer' },
          ],
          margin: [56, 16, 56, 0],
        },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.3 },
    styles: {
      coverMeta: { fontSize: 9.5, color: '#555', alignment: 'center', margin: [0, 0, 0, 2] },
      coverLabel: { fontSize: 9, bold: true, color: '#888', alignment: 'center', characterSpacing: 2, margin: [0, 0, 0, 8] },
      meta: { fontSize: 8.5, color: '#666', margin: [0, 0, 0, 1] },
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

/**
 * Ceremonial first page inside the decorative frame: centered company
 * block (logo, contact, license), proposal title + date, and the
 * prepared-for customer block. Project-overview fields (summary,
 * objectives, areas, efficiency benefits) render here too when present —
 * in practice they are usually empty, keeping the cover minimal. Ends
 * with a page break so the first SOW section always opens page 2.
 */
function buildCoverPage(proposal: ProposalWithCustomer, logoDataUrl: string | null): Content[] {
  const project = proposal.projectJSON.data
  const customer = proposal.customer
  const license = licenses[0]
  const date = new Date(proposal.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })
  const addressLine = customer?.address
    ? `${customer.address}, ${customer.city ?? ''} ${customer.state ?? 'CA'} ${customer.zip ?? ''}`.replace(/\s+/g, ' ').trim()
    : null

  const parts: Content[] = [
    logoDataUrl
      ? { image: logoDataUrl, fit: [190, 64], alignment: 'center', margin: [0, 96, 0, 14] } satisfies Content
      : { text: companyInfo.name, fontSize: 24, bold: true, alignment: 'center', margin: [0, 112, 0, 14] } satisfies Content,
    { text: contactValue('mainOffice'), style: 'coverMeta' },
    { text: `${contactValue('phone')}   •   ${contactValue('email')}`, style: 'coverMeta' },
    { text: `CA License #${license.licenseNumber} — ${license.type}`, style: 'coverMeta' },
    buildCoverOrnament(52),
    { text: 'PROJECT PROPOSAL', style: 'coverLabel' },
    { text: project.label || proposal.label || 'Proposal', fontSize: 24, bold: true, alignment: 'center', margin: [48, 0, 48, 10] },
    { text: `${date}   •   Contract timeframe: ${project.validThroughTimeframe}`, style: 'coverMeta' },
    buildCoverOrnament(52),
    { text: 'PREPARED FOR', style: 'coverLabel' },
    { text: customer?.name ?? '—', fontSize: 15, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
  ]
  if (addressLine) {
    parts.push({ text: addressLine, style: 'coverMeta' })
  }
  const contactBits = [
    customer?.phone ? formatPhone(customer.phone) : null,
    customer?.email ?? null,
  ].filter(Boolean).join('   •   ')
  if (contactBits) {
    parts.push({ text: contactBits, style: 'coverMeta' })
  }

  if (project.summary) {
    parts.push(buildCoverOrnament(36))
    parts.push({ text: project.summary, italics: true, color: '#555', alignment: 'center', lineHeight: 1.5, margin: [64, 0, 64, 0] })
  }
  const overviewLines = [
    project.projectObjectives.length > 0 ? `Objectives: ${project.projectObjectives.join('  •  ')}` : null,
    project.homeAreasUpgrades.length > 0 ? `Areas of the home: ${project.homeAreasUpgrades.join(', ')}` : null,
    project.energyBenefits ? `Efficiency benefits: ${project.energyBenefits}` : null,
  ].filter((line): line is string => line !== null)
  if (overviewLines.length > 0) {
    parts.push({ text: '', margin: [0, 14, 0, 0] })
    parts.push(...overviewLines.map(line => ({ text: line, style: 'coverMeta', margin: [64, 0, 64, 3] } satisfies Content)))
  }

  parts.push({ text: '', pageBreak: 'after' })
  return parts
}

/** Short centered divider line used to separate cover-page blocks. */
function buildCoverOrnament(verticalGap: number): Content {
  // Content width is 500 (letter 612 minus 56pt margins); a 96pt rule
  // centered on it runs from x=202 to x=298.
  return {
    canvas: [{ type: 'line', x1: 202, y1: 0, x2: 298, y2: 0, lineWidth: 0.75, lineColor: '#334155' }],
    margin: [0, verticalGap, 0, verticalGap],
  }
}

function buildScopeOfWork(
  sow: ProposalWithCustomer['projectJSON']['data']['sow'],
  pricingMode: 'total' | 'breakdown',
): Content[] {
  const parts: Content[] = []
  sow.forEach((section, i) => {
    parts.push(...buildSowSection(section, i, pricingMode))
  })
  return parts
}

/**
 * Each SOW section opens with a header "card" — a borderless single-row
 * table whose first cell is a slim brand-accent bar and whose second cell
 * holds the section metadata (number + title, trade/scopes, price) and the
 * leading description prose on a light fill. Every section opens its own
 * page (the first lands on page 2 via the cover's trailing break), so the
 * header card is never trimmed by a page split; the line items (phase
 * headings, bullet lists) flow below it as regular full-width content.
 */
function buildSowSection(
  section: ProposalWithCustomer['projectJSON']['data']['sow'][number],
  index: number,
  pricingMode: 'total' | 'breakdown',
): Content[] {
  const metaLine = [
    `Trade: ${section.trade.label}`,
    section.scopes.length > 0 ? `Scopes: ${section.scopes.map(s => s.label).join(', ')}` : null,
  ].filter(Boolean).join('   •   ')

  const inner: Content[] = [
    { text: `${index + 1}. ${section.title || 'Untitled scope'}`, style: 'itemTitle', margin: [0, 0, 0, 2] },
    { text: metaLine, style: 'meta', margin: [0, 0, 0, 6] },
  ]
  if (pricingMode === 'breakdown' && section.financials.sectionPrice) {
    inner.push({ text: `Section price: ${formatAsDollars(section.financials.sectionPrice)}`, style: 'sectionPrice' })
  }

  const doc = safeParseDoc(section.contentJSON)
  const { lead, rest } = splitLeadingProse(doc?.content ?? [])
  if (lead.length > 0) {
    inner.push(...(tiptapToPdfmake({ type: 'doc', content: lead }) as Content[]))
  }

  const parts: Content[] = [{
    // Section 1 already opens page 2 (cover breaks after itself); an
    // unconditional break here would insert a blank page before it.
    ...(index > 0 ? { pageBreak: 'before' as const } : {}),
    table: {
      widths: [4, '*'],
      body: [[
        { text: '', fillColor: '#334155', border: [false, false, false, false] },
        { stack: inner, fillColor: '#F4F6F9', border: [false, false, false, false] },
      ]],
    },
    layout: {
      defaultBorder: false,
      paddingLeft: (col: number) => col === 0 ? 0 : 14,
      paddingRight: (col: number) => col === 0 ? 0 : 14,
      paddingTop: () => 12,
      paddingBottom: () => 12,
    },
    margin: [0, 0, 0, 8],
  }]
  if (rest.length > 0) {
    parts.push(...(tiptapToPdfmake({ type: 'doc', content: rest }) as Content[]))
  }
  parts.push({ text: '', margin: [0, 0, 0, 14] })
  return parts
}

/**
 * Splits a SOW body into its opening prose (the "Description: …" block our
 * SOW editor template puts first, plus any immediately following
 * paragraphs) and the line items after it. The lead goes inside the header
 * card; the rest flows full-width below. Stops at the first list,
 * horizontal rule, or second heading — those are line-item structure, not
 * description.
 */
function splitLeadingProse(blocks: TiptapNode[]): { lead: TiptapNode[], rest: TiptapNode[] } {
  let cut = 0
  for (const [i, node] of blocks.entries()) {
    const isOpeningHeading = node.type === 'heading' && i === 0
    if (node.type === 'paragraph' || isOpeningHeading) {
      cut = i + 1
      continue
    }
    break
  }
  return { lead: blocks.slice(0, cut), rest: blocks.slice(cut) }
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
    // The investment breakdown always opens its own closing page.
    { text: 'Investment', style: 'sectionTitle', pageBreak: 'before' },
    { table: { widths: ['*', 'auto'], body: rows }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 12] },
  ]
}

function contactValue(accessor: 'mainOffice' | 'phone' | 'email'): string {
  const entry = companyInfo.contactInfo.find(c => c.accessor === accessor)
  return entry ? entry.value.replace(/\n/g, ' ') : ''
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    // "light" variant = dark lettering for light backgrounds — the PDF page is white.
    const buf = await readFile(path.join(process.cwd(), 'public/company/logo/logo-light-right.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
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
