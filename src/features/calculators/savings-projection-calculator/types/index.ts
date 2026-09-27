export interface SavingsYear {
  t: number
  homeValueBefore: number
  homeValueAfter: number
  cumulativeCostBefore: number
  cumulativeCostAfter: number
  netWorthBefore: number
  netWorthAfter: number
  netBenefit: number
}

export interface SavingsSummary {
  monthlyBefore: number
  monthlyAfter: number
  monthlyDifference: number
  cumulativeSavings: number
  valueGained: number
  netBenefit: number
  breakEvenYear: number | null
  projectMonthlyPayment: number
  horizonYears: number
  heldFlatLiabilities: number[]
}

export interface SavingsProjection {
  years: SavingsYear[]
  summary: SavingsSummary
}
