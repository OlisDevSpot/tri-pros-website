import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import type { LiabilityKind, PaymentMode, TermYears } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import type { AgingTradeKey, CutSource, TradeKey } from '@/features/calculators/remodel-roi-calculator/constants/trades'

export type ValueSource = 'input' | 'working'

export interface Resolved {
  value: number
  source: ValueSource
}

export type ByCategory = Record<BillCategory, number>

export interface CutPart {
  source: CutSource
  percent: number
}

export interface BillCut {
  bill: number
  parts: CutPart[]
  combined: number
  after: number
  typed: boolean
}

export interface ReturnParts {
  billsSaved: number
  repairsSkipped: number
  replacementsSkipped: number
  interestSkipped: number
  valueGain: number
  projectPrice: number
  projectInterest: number
}

export interface NetWorth {
  now: number
  wait: number
  home: number
  owed: number
}

export interface ProjectionYear {
  t: number
  billsNowByCategory: ByCategory
  billsAfterByCategory: ByCategory
  billsNow: number
  billsAfter: number
  repairsMonthly: number
  projectPayment: number
  replacementPayments: number
  monthlyNow: number
  monthlyWait: number
  cumNow: number
  cumWait: number
  debtNow: number
  debtWait: number
  valueNow: number
  valueWait: number
  benefit: number
  returnParts: ReturnParts
  netWorth: NetWorth | null
}

export interface Install {
  year: number
  price: number
}

export interface ReplacementProjection {
  trade: AgingTradeKey
  ageYears: number
  standardLifeYears: number
  likeForLikePrice: Resolved
  repairsPerYear: Resolved
  installs: Install[]
  repairsUntil: number
  extra: number
}

export interface ProjectTerms {
  price: number
  incentives: number
  netPrice: number
  paymentMode: PaymentMode
  aprPercent: Resolved
  termYears: TermYears
  upfront: number
  principal: number
  payment: number
}

export interface LiabilityProjection {
  index: number
  label: string
  balance: number
  monthlyPayment: number
  aprPercent: number | null
  kind: LiabilityKind
  heldFlat: boolean
}

export interface Milestones {
  paysForItselfYear: number | null
  costsLessMonthlyYear: number | null
  payoffYear: number | null
}

export interface ResolvedAssumptions {
  ratesPercent: Record<BillCategory, Resolved>
  constructionPercent: Resolved
  homeAppreciationPercent: Resolved
  valueAddedPercent: Resolved
}

export interface RemodelRoiProjection {
  ready: boolean
  trades: TradeKey[]
  ducts: boolean
  years: ProjectionYear[]
  cuts: Record<BillCategory, BillCut>
  replacements: ReplacementProjection[]
  project: ProjectTerms
  valueAddedToday: number
  homeValue: number
  liabilities: LiabilityProjection[]
  liabilitiesMonthly: number
  milestones: Milestones
  assumptions: ResolvedAssumptions
}
