import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

/** Stable identifier for a step within a funnel. Plan 2 narrows this. */
export type StepId = string

/**
 * Pure copy / media / labels for a funnel. Isolated from logic so its SOURCE
 * can later move to a DB/CMS row without touching the engine or steps.
 * Plan 2 extends this (per-step copy, before/after media, disclaimers).
 */
export interface FunnelContent {
  /** Hero + document title, e.g. "Kitchen Showcase". */
  title: string
  /** Hero headline. */
  headline: string
  /** Hero subhead. */
  subhead: string
  /** Real, stated scarcity line, e.g. "We're selecting 5 kitchens in your area." */
  scarcityLine: string
}

/** Per-trade visual accent tokens. Plan 2 extends with the full theme. */
export interface FunnelTheme {
  /** Accent color token (Tailwind/CSS var name). */
  accent: string
}

/** A single funnel step. Plan 2 defines the discriminated step-type union. */
export interface FunnelStep {
  id: StepId
}

/** Transient in-memory answer bag keyed by step id. Plan 2 types per step. */
export type FunnelAnswers = Partial<Record<StepId, unknown>>

/**
 * Centralized declarative configuration for one funnel — the EntityServerSpec
 * analog. The only trade-aware object; the engine and steps are funnel-agnostic.
 */
export interface FunnelSpec {
  slug: FunnelSlug
  content: FunnelContent
  theme: FunnelTheme
  /** Ordered steps composed from the shared library. Empty until Plan 2. */
  steps: FunnelStep[]
  /** Per-funnel branching, as CODE. Returns the next step id, or null to end. */
  flow: (answers: FunnelAnswers) => StepId | null
  /** Trade parameter carried on the shared Meta Pixel/dataset. */
  pixel: { contentCategory: string }
}
