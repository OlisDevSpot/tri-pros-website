import type { StepKind } from '@/shared/domains/funnels/types'

/**
 * Convention: which browser-only Pixel event a step KIND implies on completion.
 * Binding to kind (not step id) is what makes the suite scale to N funnels with
 * zero per-funnel wiring. `pii-form` (Lead) and `datetime` (Schedule) are NOT
 * here — they are dual-fire (need a server twin with a threaded event_id) and
 * are fired at their own submit sites, not from this lifecycle emitter.
 */
export const STEP_KIND_BROWSER_EVENT: Partial<Record<StepKind, string>> = {
  confirmation: 'CompleteRegistration',
}
