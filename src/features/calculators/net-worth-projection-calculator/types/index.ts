export interface ProjectionYear {
  t: number
  homeValueBefore: number
  homeValueAfter: number
  cumulativeCostBefore: number
  cumulativeCostAfter: number
  netWorthBefore: number
  netWorthAfter: number
  netBenefit: number
}

export interface ProjectionSummary {
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

export interface NetWorthProjection {
  years: ProjectionYear[]
  summary: ProjectionSummary
}
