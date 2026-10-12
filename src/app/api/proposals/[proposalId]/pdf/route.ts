import { companyInfo } from '@/shared/constants/company'
import { sanitizeFilename } from '@/shared/lib/sanitize-filename'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { SHARE_LINK_LIMITS } from '@/shared/modules/proposals/core/lib/share-link-rate-limit'
import { shareRouteContext } from '@/shared/modules/proposals/core/lib/share-route-context'
import { pdfService } from '@/shared/services/pdf.service'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params
  const token = new URL(req.url).searchParams.get('token')

  const share = await shareRouteContext(token)
  const result = share ? await getFullView(share.ctx, { id: proposalId }) : null
  // One answer for a wrong token and a missing proposal, so nothing reveals which ids exist.
  if (!share || !result?.success || !result.data) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (share.viaShareLink && token && !(await SHARE_LINK_LIMITS.document.limit(token)).success) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }
  const proposal = result.data

  try {
    const buffer = await pdfService.generateProposalPdf(share.ctx, { proposalId })
    const baseName = sanitizeFilename(`${companyInfo.nickname} Proposal - ${proposal.customer?.name ?? proposal.label ?? proposalId}`)
      .replace(/["\\]/g, '')
      // Response headers are ByteStrings — non-Latin1 chars (emoji, most non-ASCII) throw.
      // Keep printable ASCII only; fall back if the name was entirely non-ASCII.
      .replace(/[^\x20-\x7E]/g, '')
      .trim() || 'Proposal'
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
