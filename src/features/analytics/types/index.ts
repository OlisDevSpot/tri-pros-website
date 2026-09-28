import type { MeetingOrder } from '@/features/analytics/constants/dimensions'
import type { AnalyticsRateKey, AnalyticsStage } from '@/features/analytics/lib/analytics-rules'
import type { MeetingOutcome, MeetingSit } from '@/shared/constants/enums/meetings'
import type { CustomerFact } from '@/shared/entities/customers/dal/server/analytics-facts'
import type { MeetingFact } from '@/shared/entities/meetings/dal/server/analytics-facts'
import type { SaleFact } from '@/shared/modules/proposals/core/dal/server/analytics-facts'
import type { SaleKind } from '@/shared/modules/proposals/core/lib/sale'

export type { AnalyticsGroupBy, AnalyticsPeriod, MeetingOrder } from '@/features/analytics/constants/dimensions'

export interface AnalyticsFacts {
  customers: CustomerFact[]
  meetings: MeetingFact[]
  sales: SaleFact[]
}

export interface LeadMeeting {
  id: string
  at: string
  outcome: MeetingOutcome
  sit: MeetingSit
  project: boolean
  order: MeetingOrder
  unresolved: boolean
  closerIds: string[]
}

export interface LeadSale {
  proposalId: string
  meetingId: string
  kind: SaleKind
  at: string | null
  valueCents: number | null
  closerIds: string[]
  hasProject: boolean
}

export interface BookedLead {
  at: string
  meetingId: string
  sat: boolean
}

export interface LeadAnchor {
  leadAt: string
  leadSourceId: string | null
  city: string | null
  zip: string | null
}

export interface LeadRecord extends LeadAnchor {
  personId: string
  customerIds: string[]
  quality: 'unknown'
  meetings: LeadMeeting[]
  bookedLead: BookedLead | null
  sales: LeadSale[]
}

export interface LeadRecordSet {
  leads: LeadRecord[]
  orphans: number
}

export interface AnalyticsFilters {
  range?: { from: string, to: string }
  leadSourceIds?: (string | null)[]
  cities?: (string | null)[]
  zips?: (string | null)[]
  closerIds?: string[]
  outcomes?: MeetingOutcome[]
  meetingOrder?: MeetingOrder[]
}

export interface AnalyticsRowHygiene {
  unresolvedMeetings: number
  salesWithoutValue: number | null
  newSalesWithoutProject: number | null
  unknownCityZip: number | null
}

export interface AnalyticsCounts {
  groupKey: string | null
  overlapsTotal: boolean
  totalLeads: number | null
  mergedRecords: number | null
  validLeads: number | null
  junkLeads: null
  bookedLeads: number
  sits: number
  meetings: number
  newSales: number | null
  totalCloses: number | null
  revenueNewCents: number | null
  revenueUpsellCents: number | null
  averageTicketCents: number | null
  rates: Record<AnalyticsRateKey, number | null>
  hygiene: AnalyticsRowHygiene
}

export interface AnalyticsResult {
  rows: AnalyticsCounts[]
  notApplicable: AnalyticsStage[]
  undatedSales: number | null
  orphans: number
}
