import { getProposal } from '@/shared/dal/server/proposals/api'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { formatAsDollars } from '@/shared/lib/formatters'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const { proposalId } = await params
  const token = new URL(req.url).searchParams.get('token')

  if (!token) {
    return Response.json({ error: 'Missing token' }, { status: 401 })
  }

  const proposal = await getProposal(proposalId)

  if (!proposal) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (proposal.token !== token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customer = proposal.customer
  const proj = proposal.projectJSON.data
  const fund = proposal.fundingJSON.data
  const pricingMode = proposal.formMetaJSON.pricingMode

  const lines: string[] = []

  lines.push(`# Proposal: ${proposal.label}`)
  lines.push(`**Status:** ${proposal.status}  **Created:** ${proposal.createdAt}`)
  lines.push('')

  lines.push('## Customer')
  lines.push(`- **Name:** ${customer?.name ?? '—'}`)
  lines.push(`- **Email:** ${customer?.email ?? '—'}`)
  lines.push(`- **Phone:** ${customer?.phone ?? '—'}`)
  if (customer?.address) {
    lines.push(`- **Address:** ${customer.address}, ${customer.city}, ${customer.state ?? 'CA'} ${customer.zip}`)
  }
  lines.push('')

  lines.push('## Project')
  lines.push(`- **Type:** ${proj.type}`)
  lines.push(`- **Label:** ${proj.label}`)
  lines.push(`- **Time Allocated:** ${proj.timeAllocated}`)
  lines.push(`- **Valid Through:** ${proj.validThroughTimeframe}`)
  if (proj.homeAreasUpgrades.length > 0) {
    lines.push(`- **Areas:** ${proj.homeAreasUpgrades.join(', ')}`)
  }
  if (proj.projectObjectives.length > 0) {
    lines.push(`- **Objectives:** ${proj.projectObjectives.join(', ')}`)
  }
  if (proj.summary) {
    lines.push(`- **Summary:** ${proj.summary}`)
  }
  if (proj.energyBenefits) {
    lines.push(`- **Efficiency Benefits:** ${proj.energyBenefits}`)
  }
  if (proj.agreementNotes) {
    lines.push(`- **Agreement Notes:** ${proj.agreementNotes}`)
  }
  lines.push('')

  lines.push('## Scope of Work')
  for (const section of proj.sow) {
    lines.push(`### ${section.title} (${section.trade.label})`)
    if (section.scopes.length > 0) {
      lines.push(`**Scopes:** ${section.scopes.map(s => s.label).join(', ')}`)
    }
    if (pricingMode === 'breakdown' && section.price) {
      lines.push(`**Section Price:** ${formatAsDollars(section.price)}`)
    }
    if (section.html) {
      lines.push(stripHtml(section.html))
    }
    lines.push('')
  }

  lines.push('## Pricing')
  if (pricingMode === 'breakdown') {
    for (const section of proj.sow) {
      if ((section.price ?? 0) > 0) {
        lines.push(`- ${section.title}: ${formatAsDollars(section.price!)}`)
      }
    }
    if ((fund.miscPrice ?? 0) > 0) {
      lines.push(`- Misc: ${formatAsDollars(fund.miscPrice!)}`)
    }
    lines.push(`- **Subtotal:** ${formatAsDollars(fund.startingTcp)}`)
  }
  else {
    lines.push(`- **Contract Price:** ${formatAsDollars(fund.startingTcp)}`)
  }

  if (fund.incentives.length > 0) {
    lines.push('\n**Incentives:**')
    for (const inc of fund.incentives) {
      if (inc.type === 'discount') {
        lines.push(`- Discount: -${formatAsDollars(inc.amount)}${inc.notes ? ` (${inc.notes})` : ''}`)
      }
      else {
        lines.push(`- Exclusive Offer: ${inc.offer}${inc.notes ? ` — ${inc.notes}` : ''}`)
      }
    }
  }

  lines.push(`\n**Final Contract Price:** ${formatAsDollars(computeFinalTcp(fund))}`)
  lines.push(`**Deposit:** ${formatAsDollars(fund.depositAmount)}`)
  lines.push(`**Cash in Deal:** ${formatAsDollars(fund.cashInDeal)}`)

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
