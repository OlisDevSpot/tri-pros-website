import { energyEfficientTradeAccessors } from '@/shared/constants/enums'

export function isEnergyEfficientTrade(tradeId: string): boolean {
  return (energyEfficientTradeAccessors as readonly string[]).includes(tradeId)
}
