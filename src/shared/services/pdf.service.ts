import type { Buffer } from 'node:buffer'
import { getProposal } from '@/shared/dal/server/proposals/api'
import { renderPdf } from './pdf/render-pdf'
import { buildSowDocDefinition } from './pdf/sow-doc-definition'

/** Proposal PDFs, finance forms, printable documents */
function createPDFService() {
  return {
    generateProposalPdf: async (_params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateProposalPdf not implemented')
    },

    generateFinanceForm: async (_params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateFinanceForm not implemented')
    },

    /**
     * Generates a SOW-focused PDF for attachment to the Zoho Sign envelope
     * on the long-SOW path. Excludes branding/pricing/customer block (those
     * live on the main contract template pages).
     */
    generateSowPdf: async ({ proposalId }: { proposalId: string }): Promise<Buffer> => {
      const proposal = await getProposal(proposalId)
      if (!proposal) {
        throw new Error(`pdfService.generateSowPdf: proposal ${proposalId} not found`)
      }
      const docDef = buildSowDocDefinition(proposal)
      return renderPdf(docDef)
    },
  }
}

export type PDFService = ReturnType<typeof createPDFService>
export const pdfService = createPDFService()
