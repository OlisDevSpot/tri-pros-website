import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'

export function formatCuts(percents: Partial<Record<BillCategory, number>>): string {
  return BILL_CATEGORIES.filter(category => percents[category]).map(category => `${BILL_CATEGORY_LABELS[category]} −${percents[category]}%`).join(' · ') || 'no bill cut'
}
