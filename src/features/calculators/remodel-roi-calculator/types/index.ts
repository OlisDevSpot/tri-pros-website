import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import type { ChapterId, DetailChapterId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import type { LiabilityKind, PaymentMode, TermYears } from '@/features/calculators/remodel-roi-calculator/constants/form-options'
import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { PanelSectionKey } from '@/features/calculators/remodel-roi-calculator/constants/panel-sections'
import type { AgingTradeKey, CutSource, TradeKey } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'

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
  hasLoan: boolean
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
  outlasting: AgingTradeKey[]
  project: ProjectTerms
  valueAddedToday: number
  homeValue: number
  liabilities: LiabilityProjection[]
  liabilitiesMonthly: number
  milestones: Milestones
  assumptions: ResolvedAssumptions
}

export type SourceTag = 'yours' | 'assumption' | 'calc'
export type PathTone = 'now' | 'wait'

export interface ReceiptLine {
  kind: 'line'
  op?: '+' | '−' | '×' | '='
  label: string
  value: string
  tag: SourceTag
  note?: string
  strong?: PathTone
}

export interface ReceiptHeading {
  kind: 'heading'
  label: string
}

export type ReceiptRow = ReceiptLine | ReceiptHeading

export interface UsesRow {
  label: string
  value: string
  tag: SourceTag
  edit?: PanelSectionKey | 'assumptions'
}

export interface AnswerPart {
  text: string
  tone?: PathTone | 'strong'
}

export interface ChapterContent {
  id: DetailChapterId
  question: string
  answer: AnswerPart[]
  guide: string
  equation: string
  receipt: ReceiptRow[]
  uses: UsesRow[]
  method: string
}

export interface IntroContent {
  question: string
  title: string
  body: string
  now: string
  wait: string
}

export interface AnswerStat {
  label: string
  value: string
  sub: string
  target: ChapterId
}

export interface AnswerContent {
  question: string
  stats: AnswerStat[]
  note: string | null
  method: string
}

export interface BasisContent {
  question: string
  answer: string
  guide: string
  receipt: ReceiptRow[]
}

export interface StoryContent {
  intro: IntroContent
  answer: AnswerContent
  today: ChapterContent
  monthly: ChapterContent
  waiting: ChapterContent
  value: ChapterContent
  total: ChapterContent
  basis: BasisContent
}

export interface StoryInputs {
  projection: RemodelRoiProjection
  config: RemodelRoiConfig
  lookAhead: LookAheadYears
}

export type StorySheet = { kind: 'info', chapter: ChapterId } | { kind: 'assumptions' } | { kind: 'inputs' } | null
