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
  'info': never
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

export interface OptionContent { label: string, icon?: string, description?: string }
export interface HeroContent { headline: string, subhead: string, scarcityLine: string, cta: string }
export interface CardSelectContent { title: string, subtitle?: string, options: Record<string, OptionContent> }

export interface LocationContent {
  title: string
  subtitle?: string
  cta?: string
  checkingLabel?: string
  qualifiesLabel?: string
}

export interface PiiFieldLabels { name?: string, phone?: string, email?: string, city?: string }
export interface PiiContent {
  title: string
  subtitle?: string
  cta?: string
  consent: string
  fields: PiiFieldLabels
}

/** kind → that kind's content shape. Extended in lockstep with new kinds. */
export interface ContentByKind {
  'info': HeroContent
  'card-select': CardSelectContent
  'location': LocationContent
  'pii-form': PiiContent
}
export type ContentOf<S extends FunnelStep> = ContentByKind[S['kind']]

// ── Steps: a discriminated union; `content` is a typed field on each variant ──

interface BaseStep<K extends string> { id: StepId, kind: K }
export interface InfoStep extends BaseStep<'info'> { content: HeroContent }
export interface CardSelectStep extends BaseStep<'card-select'> { optionIds: string[], content: CardSelectContent }
export interface LocationStep extends BaseStep<'location'> { content: LocationContent }
export interface PiiStep extends BaseStep<'pii-form'> { content: PiiContent }

export type FunnelStep = InfoStep | CardSelectStep | LocationStep | PiiStep
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
  setValue: (answer: AnswerOf<S>) => void
  answers: FunnelAnswers
  ctx: FunnelContext
  advance: () => void
  back: () => void
  isFirst: boolean
}

export type StepComponentFor<K extends StepKind> = ComponentType<StepProps<Extract<FunnelStep, { kind: K }>>>
export type StepRegistry = { [K in StepKind]: StepComponentFor<K> }

// ── FunnelSpec: ordered steps + branching + metadata. No content map. ──

export interface FunnelPixel { contentCategory: string }
export interface FunnelSpec {
  slug: FunnelSlug
  offer: string
  title: string
  theme: FunnelTheme
  pixel: FunnelPixel
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
