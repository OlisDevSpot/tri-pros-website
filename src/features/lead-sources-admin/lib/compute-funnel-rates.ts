export interface FunnelCounts {
  leads: number
  meetingsBooked: number
  proposalsSent: number
  signed: number
}

export interface FunnelRates {
  /** Fraction of leads that booked a meeting (0..1). */
  meetingsRate: number
  /** Fraction of meetings that received a proposal (0..1). */
  proposalsRate: number
  /** Fraction of proposals that signed (0..1). */
  signedRate: number
}

/**
 * Computes step-to-step conversion rates for the funnel. Returns 0 for any
 * step whose denominator is zero (avoids divide-by-zero in display).
 */
export function computeFunnelRates(funnel: FunnelCounts): FunnelRates {
  return {
    meetingsRate: funnel.leads > 0 ? funnel.meetingsBooked / funnel.leads : 0,
    proposalsRate: funnel.meetingsBooked > 0 ? funnel.proposalsSent / funnel.meetingsBooked : 0,
    signedRate: funnel.proposalsSent > 0 ? funnel.signed / funnel.proposalsSent : 0,
  }
}
