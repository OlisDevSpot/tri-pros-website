export interface PricingRowsWithErrors {
  incentives: boolean
  costLines: boolean
}

interface FinancialsErrors {
  incentives?: unknown
  costLines?: unknown
  [field: string]: unknown
}

// react-hook-form leaves holes (undefined) in an array for rows that have no error.
function hasRowError(rows: unknown): boolean {
  return Array.isArray(rows) && rows.some(row => row != null)
}

export function pricingRowsWithErrors(errors: FinancialsErrors | undefined): PricingRowsWithErrors {
  return {
    incentives: hasRowError(errors?.incentives),
    costLines: hasRowError(errors?.costLines),
  }
}
