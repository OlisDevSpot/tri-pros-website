'use client'

import { useMemo } from 'react'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { crawlBattBoxes } from '@/features/trade-scenes/lib/crawl-batt-boxes'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface CrawlInsulationProps {
  wear: number
}

export function CrawlInsulation({ wear }: CrawlInsulationProps) {
  const batts = useMemo(() => crawlBattBoxes(wear), [wear])
  return <MergedBoxes boxes={batts} color={wornColor(HOME_PALETTE.insulationNew, HOME_PALETTE.insulationWorn, wear)} radius={0.02} roughness={1} />
}
