import type { BinaContactPayload } from '../types'

import type { LeadMeta } from '@/shared/entities/customers/schemas'

import { buildLeadNote } from '@/shared/entities/customers/lib/build-lead-note'

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

  // Energy campaign carries a comma-separated `trades` list. The kitchen/bath
  // campaign leaves `trades` empty and fills kitchen*/bathroom* instead — so
  // derive a trade from those fields' presence. De-duped, derived appended last.
  const baseTrades = ghlString(a.trades)?.split(',').map(s => s.trim()).filter(Boolean) ?? []
  const derivedTrades: string[] = []
  if (ghlString(a.kitchenSize) || ghlString(a.kitchenScope) || ghlString(a.kitchenAge)) {
    derivedTrades.push('Kitchen Renovation')
  }
  if (ghlString(a.bathroomSize) || ghlString(a.bathroomScope) || ghlString(a.bathroomAge)) {
    derivedTrades.push('Bathroom Renovation')
  }
  const interestedTradesRaw = [...new Set([...baseTrades, ...derivedTrades])]

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

  return { core, leadMeta, note: buildLeadNote(leadMeta) }
}
