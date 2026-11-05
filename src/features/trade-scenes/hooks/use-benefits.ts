'use client'

import type { BenefitsValue } from '@/features/trade-scenes/contexts/benefits-context'

import { use } from 'react'

import { BenefitsContext } from '@/features/trade-scenes/contexts/benefits-context'

export function useBenefits(): BenefitsValue {
  const value = use(BenefitsContext)
  if (!value) {
    throw new Error('useBenefits must be used inside a BenefitsProvider')
  }
  return value
}
