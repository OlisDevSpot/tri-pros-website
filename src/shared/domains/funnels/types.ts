import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { AddressFields } from '@/shared/lib/google-maps-helpers'

/** A step's stable identifier, unique within a funnel. Doubles as its answer key. */
export type StepId = string

// ── Answers: one typed slot per step id (composites become objects in 2b) ──

export interface ZipAnswer { zip: string, city: string, state: string, county: string | null }
export interface PiiAnswer { leadId: string }

/**
 * kind → that kind's answer shape. `never` = the step takes no input. New kinds
 * (zip, pii-form, …) extend this in lockstep with FunnelStep + STEP_REGISTRY.
 */
export interface AnswerByKind {
  'address': AddressFields
  'card-select': string
  'confirmation': never
  'pii-form': PiiAnswer
  'zip': ZipAnswer
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
  /** Label for the hero CTA that scrolls down to the first question. Defaults to "See if you qualify". */
  ctaLabel?: string
  media?: HeroMedia
  /** Phrases within `headline` rendered in primary color (≤2 recommended). */
  highlightWords?: string[]
}
export interface CardSelectContent { title: string, subtitle?: string, options: Record<string, OptionContent> }

export interface ZipContent {
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
  /** Shown when the ZIP is in-area-format but the lookup can't find it (404). */
  notFoundLabel?: string
}

export interface PiiFieldLabels { firstName?: string, lastName?: string, phone?: string }
export interface PiiContent {
  title: string
  subtitle?: string
  cta?: string
  consent: string
  fields: PiiFieldLabels
}

export interface AddressContent { title: string, subtitle?: string }

export interface ConfirmationContent {
  title: string
  subtitle?: string
  /** Ordered "what happens next" lines. */
  whatNext?: string[]
  scarcityLine?: string
}

/** kind → that kind's content shape. Extended in lockstep with new kinds. */
export interface ContentByKind {
  'address': AddressContent
  'card-select': CardSelectContent
  'confirmation': ConfirmationContent
  'pii-form': PiiContent
  'zip': ZipContent
}
export type ContentOf<S extends FunnelStep> = ContentByKind[S['kind']]

// ── Steps: a discriminated union; `content` is a typed field on each variant ──

interface BaseStep<K extends string> { id: StepId, kind: K }
export interface AddressStep extends BaseStep<'address'> { content: AddressContent }
export interface CardSelectStep extends BaseStep<'card-select'> { optionIds: string[], content: CardSelectContent }
export interface ConfirmationStep extends BaseStep<'confirmation'> { content: ConfirmationContent }
export interface PiiStep extends BaseStep<'pii-form'> { content: PiiContent }
export interface ZipStep extends BaseStep<'zip'> { content: ZipContent }

export type FunnelStep = AddressStep | CardSelectStep | ConfirmationStep | PiiStep | ZipStep
export type StepKind = FunnelStep['kind']

// ── Funnel-level context every step reads (this is what removes the need to
//    special-case lead/composite steps in the engine) ──

export interface FunnelTheme { accent: string }

export interface FunnelUtm {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  fbclid: string | null
  gclid: string | null
}

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
export interface ProblemBlockContent {
  headline: string
  body?: string
  /**
   * Each reason. An optional `image` — a portrait poster whose headline is baked
   * into the art — upgrades the block to an editorial gallery: the poster carries
   * the title, `body` becomes its caption, and `alt` (falling back to `title`)
   * labels it for assistive tech. Points without `image` render as text cards.
   */
  points: { title: string, body: string, image?: string, alt?: string }[]
  standardLine?: string
}
export interface ValueBlockContent {
  headline: string
  intro?: string
  roiStat?: { value: string, label: string }
  /** Real before/after photo pairs rendered as a comparison gallery. */
  beforeAfter?: { before: string, after: string }[]
  items: { before: string, after: string }[]
}
export interface ProcessBlockContent {
  title?: string
  steps: { title: string, body: string, image?: string, duration?: string }[]
}
export interface FaqBlockContent {
  title?: string
  items: { q: string, a: string }[]
}
export interface CalloutBlockContent {
  headline: string
  body: string
  points?: string[]
  eyebrow?: string
  ctaLabel?: string
}
export interface CtaBlockContent {
  label: string
}

export type MarketingBlock
  = | { kind: 'reviews', content: ReviewsBlockContent }
    | { kind: 'testimonials', content: TestimonialsBlockContent }
    | { kind: 'portfolio', content: PortfolioBlockContent }
    | { kind: 'licensing', content: LicensingBlockContent }
    | { kind: 'guarantee', content: GuaranteeBlockContent }
    | { kind: 'problem', content: ProblemBlockContent }
    | { kind: 'value', content: ValueBlockContent }
    | { kind: 'process', content: ProcessBlockContent }
    | { kind: 'faq', content: FaqBlockContent }
    | { kind: 'callout', content: CalloutBlockContent }
    | { kind: 'cta', content: CtaBlockContent }

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
