import type { BinaContactPayload } from '../types'

import type { LeadMeta } from '@/shared/entities/customers/schemas'

// Pure translator: provider-native Bina payload → app-domain { core, leadMeta }.
// This is the ONLY place that knows Bina/GHL field names. No I/O. See
// service-architecture.md#providers-have-no-domain-types-in-signatures — domain
// translation belongs in a provider lib/, keeping client.ts a leaf.

/** GHL sends literal "null" strings for empty custom fields. */
export function ghlString(value: string | undefined): string | null {
  if (!value || value === 'null') {
    return null
  }
  return value
}

/** Core customer fields the intake service persists (channel-agnostic shape). */
export interface IntakeCore {
  address: string | null
  city: string
  email: string | null
  leadSourceSlug: string
  name: string
  phone: string
  state: string | null
  zip: string
}

export interface NormalizedBinaLead {
  core: IntakeCore
  leadMeta: LeadMeta
  note: string | null
}

export function normalizeBinaLead(payload: BinaContactPayload): NormalizedBinaLead {
  const a = payload.additionalData

  const interestedTradesRaw = ghlString(a.trades)?.split(',').map(s => s.trim()).filter(Boolean) ?? []

  const core: IntakeCore = {
    address: ghlString(payload.address),
    city: payload.city,
    email: ghlString(payload.email),
    leadSourceSlug: 'bina',
    name: `${payload.firstName} ${payload.lastName}`.trim(),
    phone: payload.phone,
    state: null, // service defaults to 'CA' when null
    zip: payload.zip,
  }

  const leadMeta: LeadMeta = {
    interestedTradesRaw,
    scheduledFor: ghlString(a.selfBookingDateTime) ?? undefined,
    source: {
      bathroomAge: ghlString(a.bathroomAge),
      bathroomScope: ghlString(a.bathroomScope),
      bathroomSize: ghlString(a.bathroomSize),
      budgetSolution: ghlString(a.budgetSolution),
      kitchenAge: ghlString(a.kitchenAge),
      kitchenScope: ghlString(a.kitchenScope),
      kitchenSize: ghlString(a.kitchenSize),
      kind: 'bina',
      rebateAmount: ghlString(a.rebateAmount),
    },
  }

  return { core, leadMeta, note: formatBinaNote(payload) }
}

/** Human-readable summary of the master payload, stored as a customer note. */
export function formatBinaNote(payload: BinaContactPayload): string | null {
  const a = payload.additionalData
  const lines: string[] = ['📋 Lead from Bina (GoHighLevel)']

  const push = (label: string, value: string | null) => {
    if (value) {
      lines.push(`${label}: ${value}`)
    }
  }

  push('Budget Solution', ghlString(a.budgetSolution))
  const rebate = ghlString(a.rebateAmount)
  if (rebate) {
    lines.push(`Rebate Amount: $${rebate}`)
  }
  push('Trades', ghlString(a.trades))
  push('Self-booking', ghlString(a.selfBookingDateTime))
  push(
    'Bathroom (age/size/scope)',
    [ghlString(a.bathroomAge), ghlString(a.bathroomSize), ghlString(a.bathroomScope)].filter(Boolean).join(' · ') || null,
  )
  push(
    'Kitchen (age/size/scope)',
    [ghlString(a.kitchenAge), ghlString(a.kitchenSize), ghlString(a.kitchenScope)].filter(Boolean).join(' · ') || null,
  )

  return lines.length > 1 ? lines.join('\n') : null
}
