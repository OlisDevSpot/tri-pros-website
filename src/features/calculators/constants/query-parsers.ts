import { parseAsStringLiteral } from 'nuqs'

export const CALCULATOR_TABS = ['scope-pricing', 'savings-projection'] as const

export type CalculatorTab = typeof CALCULATOR_TABS[number]

export const calculatorTabParser = parseAsStringLiteral(CALCULATOR_TABS).withDefault('scope-pricing')
