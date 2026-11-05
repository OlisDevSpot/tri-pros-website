'use client'

import type { BenefitsFigures } from '@/features/trade-scenes/contexts/benefits-figures-context'

import { use } from 'react'

import { BenefitsFiguresContext } from '@/features/trade-scenes/contexts/benefits-figures-context'

export function useBenefitsFigures(): BenefitsFigures {
  const figures = use(BenefitsFiguresContext)
  if (!figures) {
    throw new Error('useBenefitsFigures must be used inside a BenefitsFiguresProvider')
  }
  return figures
}
