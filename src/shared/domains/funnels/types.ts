import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'

/** A step's stable identifier, unique within a funnel. Doubles as its answer key. */
export type StepId = string

// ── Answers: one typed slot per step id (composites become objects in 2b) ──

export interface LocationAnswer { zip: string, city: string, state: string, county: string | null }
export interface PiiAnswer { leadId: string }

/**
 * kind → that kind's answer shape. `never` = the step takes no input. New kinds
 * (location, pii-form, …) extend this in lockstep with FunnelStep + STEP_REGISTRY.
 */
export interface AnswerByKind {
  'card-select': string
  'location': LocationAnswer
  'pii-form': PiiAnswer
}
export type AnswerOf<S extends FunnelStep> = AnswerByKind[S['kind']]

/**
 * Runtime store value — the union of all answer shapes. Stays in sync with
 * AnswerByKind automatically. Strong typing happens at the component boundary
 * (AnswerOf<S>) and the opt-in AnswersOf<> author view.
 */
export type AnswerValue = AnswerByKind[keyof AnswerByKind] | null
export type FunnelAnswers = Partial<Record<StepId, AnswerValue>>

// ── Per-kind content (no shared kitchen-sink type) ──

export type OptionAsset
  = { kind: 'icon', name: string }
    | { kind: 'image', src: string, alt: string }
export interface OptionContent { label: string, description?: string, asset?: OptionAsset }
export interface HeroMedia { kind: 'image', src: string, alt: string }
export interface HeroContent {
  headline: string
  subhead: string
  scarcityLine: string
  /** Optional prompt introducing the embedded first question, e.g. "Start here ↓". */
  prompt?: string
  media?: HeroMedia
}
export interface CardSelectContent { title: string, subtitle?: string, options: Record<string, OptionContent> }

export interface LocationContent {
  title: string
  subtitle?: string
  /** Input phase button — default "Check my area" */
  inputCta?: string
  /** Checking phase ({zip} placeholder supported) */
  checkingLabel?: string
  /** Qualified headline */
  qualifiesLabel?: string
  /** Not-in-area message */
  outOfAreaLabel?: string
}

export interface PiiFieldLabels { firstName?: string, lastName?: string, phone?: string }
export interface PiiContent {
  title: string
  subtitle?: string
  cta?: string
  consent: string
  fields: PiiFieldLabels
}

/** kind → that kind's content shape. Extended in lockstep with new kinds. */
export interface ContentByKind {
  'card-select': CardSelectContent
  'location': LocationContent
  'pii-form': PiiContent
}
export type ContentOf<S extends FunnelStep> = ContentByKind[S['kind']]

// ── Steps: a discriminated union; `content` is a typed field on each variant ──

interface BaseStep<K extends string> { id: StepId, kind: K }
export interface CardSelectStep extends BaseStep<'card-select'> { optionIds: string[], content: CardSelectContent }
export interface LocationStep extends BaseStep<'location'> { content: LocationContent }
export interface PiiStep extends BaseStep<'pii-form'> { content: PiiContent }

export type FunnelStep = CardSelectStep | LocationStep | PiiStep
export type StepKind = FunnelStep['kind']

// ── Funnel-level context every step reads (this is what removes the need to
//    special-case lead/composite steps in the engine) ──

export interface FunnelTheme { accent: string }
export interface FunnelContext {
  slug: FunnelSlug
  offer: string
  theme: FunnelTheme
  utm: FunnelUtm
}

// ── Uniform step props — identical for every kind ──

export interface StepProps<S extends FunnelStep = FunnelStep> {
  step: S
  content: ContentOf<S>
  value: AnswerOf<S> | null
  isAnswered: boolean
  setValue: (answer: AnswerOf<S>) => void
  answers: FunnelAnswers
  ctx: FunnelContext
  advance: () => void
  back: () => void
  isFirst: boolean
}

export type StepComponentFor<K extends StepKind> = ComponentType<StepProps<Extract<FunnelStep, { kind: K }>>>
export type StepRegistry = { [K in StepKind]: StepComponentFor<K> }

// ── Marketing blocks: composable trust sections shown on the landing ──

export interface ReviewsBlockContent { rating: number, count: number, label?: string }
export interface TestimonialItem { name: string, location: string, text: string, rating: number, image?: string }
export interface TestimonialsBlockContent { title?: string, items?: TestimonialItem[] }
export interface PortfolioBlockContent { title?: string, subtitle?: string, maxItems?: number }
export interface LicensingBlockContent { title?: string }
export interface GuaranteeBlockContent { headline: string, body: string, scarcityLine?: string }

export type MarketingBlock
  = | { kind: 'reviews', content: ReviewsBlockContent }
    | { kind: 'testimonials', content: TestimonialsBlockContent }
    | { kind: 'portfolio', content: PortfolioBlockContent }
    | { kind: 'licensing', content: LicensingBlockContent }
    | { kind: 'guarantee', content: GuaranteeBlockContent }

export type MarketingBlockKind = MarketingBlock['kind']
export type MarketingBlockComponentFor<K extends MarketingBlockKind>
  = ComponentType<{ content: Extract<MarketingBlock, { kind: K }>['content'], ctx: FunnelContext }>
export type MarketingRegistry = { [K in MarketingBlockKind]: MarketingBlockComponentFor<K> }

// ── FunnelSpec: ordered steps + branching + metadata. No content map. ──

export interface FunnelPixel { contentCategory: string }
export interface FunnelSpec {
  slug: FunnelSlug
  offer: string
  title: string
  hero: HeroContent
  theme: FunnelTheme
  pixel: FunnelPixel
  /** Optional landing block list; falls back to DEFAULT_LANDING_BLOCKS when absent. */
  landing?: { blocks: MarketingBlock[] }
  steps: FunnelStep[]
  flow?: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null
}

/**
 * Opt-in typed view of accumulated answers, keyed by step id — for `flow` and
 * lead-building author sites only (requires `steps as const satisfies …`).
 * Engine internals stay on the loose FunnelAnswers.
 */
export type AnswersOf<Steps extends readonly FunnelStep[]> = {
  [S in Steps[number] as S['id']]?: AnswerOf<S>
}
