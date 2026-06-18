import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

/** A step's stable identifier, unique within a funnel. */
export type StepId = string

/**
 * Accumulated answers, keyed by the answering step's `field` (e.g. 'layout',
 * 'ownership', 'zip', 'city'). NARROWS the foundation's Partial<Record<StepId,unknown>>.
 */
export type FunnelAnswers = Record<string, string | string[] | null>

// ── Step variants (discriminated by `kind`) — REPLACES the `{ id }` stub ──
interface BaseStep { id: StepId }

/** Informational / hero step — no input; a CTA advances. Renders funnel-level hero copy. */
export interface InfoStep extends BaseStep { kind: 'info' }

/** Single-select branded cards. `field` is the answers key; `optionIds` order the cards. */
export interface CardSelectStep extends BaseStep {
  kind: 'card-select'
  field: string
  optionIds: string[]
}

/** The step union. New kinds (location, pii-form, datetime, confirmation) added in 2b/2c. */
export type FunnelStep = InfoStep | CardSelectStep
export type StepKind = FunnelStep['kind']

// ── Per-step content (the lift-to-DB-later seam) ──
export interface OptionContent {
  label: string
  icon?: string
  description?: string
}

export interface StepContent {
  /** Step heading (input steps). The hero ignores this and uses funnel-level copy. */
  title: string
  subtitle?: string
  /** CTA label. */
  cta?: string
  /** card-select: option id → its copy. */
  options?: Record<string, OptionContent>
}

// ── EXTEND the landed FunnelContent: keep the four hero fields, ADD `steps` ──
export interface FunnelContent {
  /** Hero + document title. */
  title: string
  /** Hero headline. */
  headline: string
  /** Hero subhead. */
  subhead: string
  /** Real, stated scarcity line. */
  scarcityLine: string
  /** Per-step copy. NEW (Plan 2). */
  steps: Record<StepId, StepContent>
}

/** Per-trade visual accent tokens. Plan 5 extends with full theming. */
export interface FunnelTheme {
  /** Accent color token (Tailwind/CSS var name). */
  accent: string
}

// ── Step component contract ──
export interface StepProps<S extends FunnelStep = FunnelStep> {
  step: S
  /** Funnel-level copy — the hero step reads headline/subhead/scarcityLine from here. */
  funnelContent: FunnelContent
  /** Per-step copy (input steps). Undefined for the hero (uses funnelContent). */
  content?: StepContent
  value: string | string[] | null
  onChange: (value: string | string[]) => void
  onAdvance: () => void
  onBack: () => void
  isFirst: boolean
}

export type StepComponent<S extends FunnelStep = FunnelStep> = ComponentType<StepProps<S>>

/**
 * Centralized declarative configuration for one funnel — the EntityServerSpec
 * analog. The only trade-aware object; the engine and steps are funnel-agnostic.
 */
export interface FunnelSpec {
  slug: FunnelSlug
  content: FunnelContent
  theme: FunnelTheme
  /** Ordered steps composed from the shared library. */
  steps: FunnelStep[]
  /** Per-funnel branching, as CODE. Returns the next step id, or null to end. */
  flow: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null
  /** Trade parameter carried on the shared Meta Pixel/dataset. */
  pixel: { contentCategory: string }
}
