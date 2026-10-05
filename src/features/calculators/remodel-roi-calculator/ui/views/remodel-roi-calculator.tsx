'use client'

import { StoryUiProvider } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { RemodelRoiWorkspace } from '@/features/calculators/remodel-roi-calculator/ui/components/remodel-roi-workspace'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'

export function RemodelRoiCalculator() {
  const isBelowLg = useIsBelowLg() ?? false
  return (
    <StoryUiProvider isBelowLg={isBelowLg}>
      <RemodelRoiWorkspace isBelowLg={isBelowLg} />
    </StoryUiProvider>
  )
}
