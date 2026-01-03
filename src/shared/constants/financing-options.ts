export const financingCompanies = ['360Finance', 'Figure Lending', 'Regions'] as const
export type FinancingCompany = typeof financingCompanies[number]

export interface FinancingOption {
  id: number
  term: number
  rate: number
}

export const financingOptions = {
  '360Finance': [
    { id: 1, term: 60, rate: 0.0899 },
    { id: 2, term: 120, rate: 0.0999 },
    { id: 3, term: 180, rate: 0.1099 },
  ],
} as const satisfies Partial<Record<FinancingCompany, FinancingOption[]>>
