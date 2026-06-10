import type { LeadMeta } from '@/shared/entities/customers/schemas'

// Pure: build a coherent, agent-readable lead note from the source-agnostic
// leadMeta envelope. Single source of truth for the note shown in customer_notes
// AND (Part 2) pushed to CloudTalk as a contact Activity. No I/O.
//
// Energy leads → trades + appointment. Kitchen/bath leads → the kitchen*/bathroom*
// detail, one field per line. The derived "Kitchen Renovation"/"Bathroom
// Renovation" trade tokens and the noise "other" token are dropped from the
// Trades line (their detail prints below / they carry no information).

// Trade tokens derived from kitchen*/bathroom* presence — printed as detail
// lines below, so excluded from the Trades line to avoid redundancy.
const DERIVED_TRADE_TOKENS = new Set(['Kitchen Renovation', 'Bathroom Renovation'])

function pushIf(lines: string[], label: string, value: string | null | undefined): void {
  if (value) {
    lines.push(`${label}: ${value}`)
  }
}

export function buildLeadNote(leadMeta: LeadMeta | null | undefined): string | null {
  if (!leadMeta) {
    return null
  }

  const lines = ['📋 Lead details']

  const trades = (leadMeta.interestedTradesRaw ?? [])
    .filter(t => !DERIVED_TRADE_TOKENS.has(t) && t.trim().toLowerCase() !== 'other')
  if (trades.length > 0) {
    lines.push(`Trades: ${trades.join(', ')}`)
  }

  if (leadMeta.scheduledFor) {
    lines.push(`Appointment: ${leadMeta.scheduledFor}`)
  }

  const source = leadMeta.source
  if (source?.kind === 'bina') {
    pushIf(lines, 'Kitchen size', source.kitchenSize)
    pushIf(lines, 'Kitchen scope', source.kitchenScope)
    pushIf(lines, 'Kitchen age', source.kitchenAge)
    pushIf(lines, 'Bathroom size', source.bathroomSize)
    pushIf(lines, 'Bathroom scope', source.bathroomScope)
    pushIf(lines, 'Bathroom age', source.bathroomAge)
    pushIf(lines, 'Budget solution', source.budgetSolution)
    if (source.rebateAmount) {
      lines.push(`Rebate: $${source.rebateAmount}`)
    }
  }

  return lines.length > 1 ? lines.join('\n') : null
}
