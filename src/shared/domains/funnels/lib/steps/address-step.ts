import type { AddressStep } from '@/shared/domains/funnels/types'

/** Importable prebuilt step (Seam A). Spread + override `content` per funnel. */
export const ADDRESS_STEP: AddressStep = {
  id: 'address',
  kind: 'address',
  content: {
    title: 'What\'s the property address?',
    subtitle: 'So we can confirm your project area and prep for your consultation.',
  },
}
