import type { Buffer } from 'node:buffer'

import type { ScopedContext } from '@/shared/dal/server/lib/types'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'

import { renderPdf } from './pdf/render-pdf'
import { buildSowDocDefinition } from './pdf/sow-doc-definition'

/** Proposal PDFs, finance forms, printable documents */
function createPDFService() {
  return {
    generateProposalPdf: async (_ctx: ScopedContext, _params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateProposalPdf not implemented')
    },

    generateFinanceForm: async (_ctx: ScopedContext, _params: { proposalId: string }): Promise<Buffer> => {
      throw new Error('pdfService.generateFinanceForm not implemented')
    },

    /**
     * Generates a SOW-focused PDF for attachment to the Zoho Sign envelope
     * on the long-SOW path. Excludes branding/pricing/customer block (those
     * live on the main contract template pages).
     */
    generateSowPdf: async (ctx: ScopedContext, { proposalId }: { proposalId: string }): Promise<Buffer> => {
      const proposal = dalVerifySuccess(await getFullView(ctx, { id: proposalId }))
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
