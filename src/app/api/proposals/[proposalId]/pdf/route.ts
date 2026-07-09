import { companyInfo } from '@/shared/constants/company'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
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
