import type { ComparisonRow } from '@/features/meeting-flow/types'
import { WHO_WE_ARE_SLIDES } from '@/features/meeting-flow/constants/who-we-are-slides'
import { COMPARISON_SLIDE_IDS } from '@/features/proposal-flow/constants/comparison-slides'

export function getComparisonRows(): ComparisonRow[] {
  return COMPARISON_SLIDE_IDS.flatMap((id) => {
    const slide = WHO_WE_ARE_SLIDES.find(s => s.id === id)
    return slide?.content.kind === 'comparison' ? slide.content.rows : []
  })
}
