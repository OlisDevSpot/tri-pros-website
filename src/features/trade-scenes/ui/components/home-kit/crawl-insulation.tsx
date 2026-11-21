'use client'

import type { SurfaceTexture } from '@/features/trade-scenes/types'

import { useMemo } from 'react'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { useSystemOpened } from '@/features/trade-scenes/hooks/use-system-opened'
import { crawlBattBoxes } from '@/features/trade-scenes/lib/crawl-batt-boxes'
import { MergedBoxes } from '@/features/trade-scenes/ui/components/home-kit/merged-boxes'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'

interface CrawlInsulationProps {
  wear: number
}

export function CrawlInsulation({ wear }: CrawlInsulationProps) {
  const batts = useMemo(() => crawlBattBoxes(wear), [wear])
  const loadWhen = useSystemOpened('foundation')
  const texture = useMemo((): SurfaceTexture => ({ set: 'fiber-batt', map: 'own', mapTint: wornColor('#ffffff', HOME_PALETTE.insulationWorn, wear), loadWhen }), [wear, loadWhen])
  return <MergedBoxes boxes={batts} color={wornColor(HOME_PALETTE.insulationNew, HOME_PALETTE.insulationWorn, wear)} texture={texture} radius={0.02} roughness={1} />
}
