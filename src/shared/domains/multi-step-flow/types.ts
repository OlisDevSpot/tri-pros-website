import type { ComponentType } from 'react'

/** A step's stable identifier. Doubles as the key for that step's answer slot. */
export type StepId = string

/** One answer slot per step id. Answer shapes are owned by each consumer engine. */
export type StepAnswers = Partial<Record<StepId, unknown>>

/** The minimal shape every step shares. Consumers extend this per kind (usually adding `content`). */
export interface BaseStep<K extends string> {
  id: StepId
  kind: K
}

/**
 * Uniform props every step component receives. Generic over the consumer's
 * content, answer, and context types — the core never names them.
 */
export interface StepProps<Content, Answer, Ctx> {
  step: BaseStep<string>
  content: Content
  value: Answer | null
  isAnswered: boolean
  setValue: (answer: Answer) => void
  answers: StepAnswers
  ctx: Ctx
  advance: () => void
  back: () => void
  isFirst: boolean
}

/**
 * A consumer builds its own registry from its own `kind -> component` map.
 * The `any` triple is the single documented widening at the dispatch seam
 * (each component is authored against its own narrow `StepProps`).
 */
export type StepRegistry<Kinds extends string> = Record<
  Kinds,
  ComponentType<StepProps<any, any, any>>
>

/** The declarative flow definition: ordered steps + optional branching + view hints. */
export interface FlowConfig<Step extends BaseStep<string>, Ctx> {
  steps: Step[]
  /** Optional branching. Falls back to linear progression when absent. */
  next?: (answers: StepAnswers, currentStepId: StepId) => StepId | null
  /** Which step renders as the landing view. Defaults to the first step. */
  landingStepId?: StepId
  /** Step kinds that render as the terminal view (no nav/progress). */
  terminalKinds?: readonly string[]
  /** Marker so `Ctx` is used and inferable at the config site. */
  __ctx?: Ctx
}

/** The engine's serialisable state. Persisted verbatim by the adapter. */
export interface EngineState {
  currentStepId: StepId
  history: StepId[]
  answers: StepAnswers
}

/**
 * The single seam that differs between engines.
 * localStorage: `load` reads synchronously, no `useHydration`.
 * DB: `load` returns the adapter's cached snapshot; `useHydration` reports
 * whether the async load has resolved.
 */
export interface StepPersistenceAdapter<State> {
  load: () => State | null
  persist: (next: State) => void
  useHydration?: () => boolean
}

/** Presentational option asset for card-style steps. */
export type OptionAsset
  = { kind: 'icon', name: string }
    | { kind: 'image', src: string, alt: string }

/** A selectable card option. */
export interface CardOption {
  id: string
  label: string
  description?: string
  asset?: OptionAsset
}
