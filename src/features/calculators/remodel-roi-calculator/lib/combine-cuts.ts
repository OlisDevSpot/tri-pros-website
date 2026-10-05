import type { BillCategory } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import type { TradeKey } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import type { RemodelRoiConfig } from '@/features/calculators/remodel-roi-calculator/schemas/config'
import type { CutPart } from '@/features/calculators/remodel-roi-calculator/types'

interface Picks {
  trades: readonly TradeKey[]
  ducts: boolean
}

// Each trade cuts what the previous ones left, so the combined cut can never pass 100%.
export function combineCuts({ trades, ducts }: Picks, category: BillCategory, config: RemodelRoiConfig['trades']): { parts: CutPart[], combined: number } {
  const parts: CutPart[] = trades.flatMap((trade) => {
    const percent = config[trade].cutsPercent[category]
    return percent ? [{ source: trade, percent }] : []
  })
  const ductsPercent = config.hvac.ductsCutsPercent[category]
  if (ducts && trades.includes('hvac') && ductsPercent) {
    parts.push({ source: 'ducts', percent: ductsPercent })
  }
  const combined = 1 - parts.reduce((kept, part) => kept * (1 - part.percent / 100), 1)
  return { parts, combined }
}
