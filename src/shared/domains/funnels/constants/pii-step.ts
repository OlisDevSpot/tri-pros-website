import type { PiiStep } from '@/shared/domains/funnels/types'

/**
 * Importable prebuilt PII step (Seam A). Spread + override `content` per funnel.
 *
 * Lives here — NOT in `ui/steps/pii-form-step.tsx` — on purpose: the component
 * file imports `build-lead-input`, which resolves the funnel registry. If this
 * config const were co-located in the component, importing it from a funnel
 * spec would drag the whole component module (and its registry edge) into the
 * spec's import graph, closing a registry → spec → PII_STEP → build-lead-input
 * → registry cycle and triggering a "Cannot access 'PII_STEP' before
 * initialization" TDZ error at module init. Keeping the config pure-data and
 * component-free breaks that cycle.
 */
export const PII_STEP: PiiStep = {
  id: 'pii',
  kind: 'pii-form',
  content: {
    title: 'Where should we send your Showcase details?',
    cta: 'See if I qualify',
    consent: 'By submitting, I agree Tri Pros Remodeling may contact me by call, text, and email about my project. Consent isn\'t a condition of purchase. Msg/data rates may apply. See our Privacy Policy.',
    fields: { firstName: 'First name', lastName: 'Last name', phone: 'Phone' },
  },
}
