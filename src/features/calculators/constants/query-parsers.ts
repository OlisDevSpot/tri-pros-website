import { parseAsStringLiteral } from 'nuqs'

export const CALCULATOR_TABS = ['net-worth-projection', 'scope-pricing'] as const

export type CalculatorTab = typeof CALCULATOR_TABS[number]

export const calculatorTabParser = parseAsStringLiteral(CALCULATOR_TABS).withDefault('net-worth-projection')
