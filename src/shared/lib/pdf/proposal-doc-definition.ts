import type { Column, Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
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
  const left: Column = {
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

  const date = new Date(proposal.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })
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
