import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import type { TiptapNode } from './tiptap-to-pdfmake'
import { tiptapToPdfmake } from './tiptap-to-pdfmake'

/**
 * Builds a SOW-focused pdfmake document definition for a proposal.
 * Deliberately excludes branding, customer block, pricing breakdown,
 * agreement notes — all covered on the main contract template pages.
 */
export function buildSowDocDefinition(proposal: ProposalWithCustomer): TDocumentDefinitions {
  const sow = proposal.projectJSON.data.sow ?? []
  const customerName = proposal.customer?.name ?? 'Customer'
  const label = proposal.label ?? 'Proposal'

  const content: Content[] = [
    { text: 'Scope of Work', style: 'docTitle' },
    { text: `${label} — Prepared for ${customerName}`, style: 'subtitle', margin: [0, 0, 0, 16] },
  ]

  sow.forEach((item, i) => {
    content.push({
      text: `${i + 1}. ${item.title || 'Untitled scope'}`,
      style: 'itemTitle',
      pageBreak: i > 0 ? 'before' : undefined,
    })
    if (item.trade?.label) {
      content.push({ text: item.trade.label, style: 'itemTrade', margin: [0, 0, 0, 4] })
    }
    if (item.scopes?.length) {
      content.push({
        text: item.scopes.map(s => s.label).join(' · '),
        style: 'scopeChips',
        margin: [0, 0, 0, 12],
      })
    }
    const doc = safeParseDoc(item.contentJSON)
    if (doc) {
      content.push(...(tiptapToPdfmake(doc) as Content[]))
    }
  })

  return {
    content,
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.3 },
    styles: {
      docTitle: { fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 10, color: '#666', margin: [0, 0, 0, 16] },
      itemTitle: { fontSize: 14, bold: true, margin: [0, 0, 0, 2] },
      itemTrade: { fontSize: 10, color: '#666', italics: true },
      scopeChips: { fontSize: 9, color: '#444' },
      h1: { fontSize: 14, bold: true },
      h2: { fontSize: 12, bold: true },
      h3: { fontSize: 11, bold: true },
      quote: { italics: true, color: '#555' },
    },
    pageMargins: [56, 56, 56, 56],
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
