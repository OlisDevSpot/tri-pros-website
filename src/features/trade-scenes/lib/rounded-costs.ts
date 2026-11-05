import type { MonthlyCosts } from '@/features/trade-scenes/types'

// Each part rounded on its own and the total their sum, so a total shown beside its parts always adds up.
export function roundedCosts({ electric, gas, repairs }: Omit<MonthlyCosts, 'total'>): MonthlyCosts {
  const shown = { electric: Math.round(electric), gas: Math.round(gas), repairs: Math.round(repairs) }
  return { ...shown, total: shown.electric + shown.gas + shown.repairs }
}
