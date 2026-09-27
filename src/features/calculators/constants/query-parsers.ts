import { parseAsStringLiteral } from 'nuqs'

export const CALCULATOR_TABS = ['remodel-roi', 'scope-pricing'] as const

export type CalculatorTab = typeof CALCULATOR_TABS[number]

export const calculatorTabParser = parseAsStringLiteral(CALCULATOR_TABS).withDefault('remodel-roi')
