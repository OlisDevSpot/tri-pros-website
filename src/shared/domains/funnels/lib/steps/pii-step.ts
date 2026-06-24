import type { PiiStep } from '@/shared/domains/funnels/types'

/**
 * Importable prebuilt step (Seam A). Spread + override `content` per funnel.
 *
 * Prebuilt step CONFIGS live here in `lib/steps/` — deliberately separate from
 * their `ui/steps/` components. Co-locating a config with its component means
 * importing the config (from a funnel spec) drags the component's entire import
 * graph along. For the PII step that graph reaches `build-lead-input → registry`,
 * which closes a `registry → spec → PII_STEP → build-lead-input → registry`
 * cycle and triggers a "Cannot access 'PII_STEP' before initialization" TDZ at
 * module init. Keeping configs component-free here prevents that whole class of
 * cycle for every prebuilt step.
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
