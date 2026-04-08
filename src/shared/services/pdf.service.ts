import type { Buffer } from 'node:buffer'

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
