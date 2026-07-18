import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { getFullView } from '@/shared/entities/proposals/dal/server/queries'
import { buildPricingBreakdown } from '@/shared/entities/proposals/lib/financials'
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

  // TODO: Rebuild as procedure → QStash job → ai.service → DAL update (see spec)
  const result = await getFullView(SYSTEM_CONTEXT, { id: proposalId })
  if (!result.success) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  const proposal = result.data

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
    if (pricingMode === 'breakdown' && section.financials.sectionPrice) {
      lines.push(`**Section Price:** ${formatAsDollars(section.financials.sectionPrice)}`)
    }
    if (section.html) {
      lines.push(stripHtml(section.html))
    }
    lines.push('')
  }

  lines.push('## Pricing')
  // relies on getFullView incentive hydration (Wave 2 bridge)
  const breakdown = buildPricingBreakdown({ funding: fund, sow: proj.sow, pricingMode })
  if (breakdown.pricingMode === 'breakdown') {
    for (const section of breakdown.sections) {
      lines.push(`- ${section.title}: ${formatAsDollars(section.price)}`)
    }
    if (breakdown.miscPrice != null) {
      lines.push(`- Misc: ${formatAsDollars(breakdown.miscPrice)}`)
    }
    lines.push(`- **Subtotal:** ${formatAsDollars(breakdown.subtotal)}`)
  }
  else {
    lines.push(`- **Contract Price:** ${formatAsDollars(breakdown.subtotal)}`)
  }

  const incentiveLines = [...breakdown.globalLines, ...breakdown.sectionIncentiveLines]
  if (incentiveLines.length > 0) {
    lines.push('\n**Incentives:**')
    for (const line of incentiveLines) {
      if (line.amount != null) {
        lines.push(`- Discount: -${formatAsDollars(line.amount)}${line.label === 'Discount' ? '' : ` (${line.label})`}`)
      }
      else {
        lines.push(`- Exclusive Offer: ${line.label}${line.notes ? ` — ${line.notes}` : ''}`)
      }
    }
  }

  lines.push(`\n**Final Contract Price:** ${formatAsDollars(breakdown.finalTcp)}`)
  lines.push(`**Deposit:** ${formatAsDollars(breakdown.deposit)}`)
  lines.push(`**Cash in Deal:** ${formatAsDollars(breakdown.cashInDeal)}`)

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
