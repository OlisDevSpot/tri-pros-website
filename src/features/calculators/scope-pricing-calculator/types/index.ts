import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import type { PricingTrade, ScopePricingConfig, UnitCostsOf } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ProjectContext } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { MultiplierTier } from '@/shared/modules/proposals/core/lib/financials/tiers'

export type VariableUnit = 'BSQ' | 'count' | 'tons' | 'sqft' | null
export type SelectOption = number | string

interface VariableDefBase {
  trade: PricingTrade
  label: string
  unit: VariableUnit
}

export interface NumberVariableDef extends VariableDefBase {
  kind: 'number'
  min: number
  max: number
  default?: number
}

export interface SelectVariableDef extends VariableDefBase {
  kind: 'select'
  options: readonly SelectOption[]
  optionLabels?: Readonly<Record<string, string>>
  default?: SelectOption
}

export interface BooleanVariableDef extends VariableDefBase {
  kind: 'boolean'
  default?: boolean
}

export type VariableDef = NumberVariableDef | SelectVariableDef | BooleanVariableDef

export type VariableKey = keyof typeof VARIABLES

type DefOf<K extends VariableKey> = (typeof VARIABLES)[K]

export type VariableValue<K extends VariableKey>
  = DefOf<K> extends { kind: 'number' } ? number
    : DefOf<K> extends { kind: 'boolean' } ? boolean
      : DefOf<K> extends { options: readonly (infer O)[] } ? O
        : never

export type VariableValues<Keys extends readonly VariableKey[]> = { [K in Keys[number]]: VariableValue<K> }

/** What the rep has entered on one line: any declared Variable may still be empty. */
export type VariableInputs = Partial<Record<VariableKey, SelectOption | boolean | null>>

export type FormulaConfig = Pick<ScopePricingConfig, 'exteriorPaintTiers'>

// The method shorthand inside this helper (never called directly) makes TS check `compute` bivariantly,
// which is what lets the registry hold Formulas with different Variable sets under one `Formula` type;
// `ts/method-signature-style` forces `compute` itself to stay a property, so the shorthand has to live here.
type ComputeFn<T extends PricingTrade, Keys extends readonly VariableKey[]> = {
  // eslint-disable-next-line ts/method-signature-style -- method shorthand needed for bivariant parameter checking, see comment above
  bivarianceHack(vars: VariableValues<Keys>, context: ProjectContext, unitCosts: UnitCostsOf<T>, config: FormulaConfig): number
}['bivarianceHack']

export interface FormulaDef<T extends PricingTrade, Keys extends readonly VariableKey[]> {
  key: PricingKey
  trade: T
  label: string
  outcome: string
  variables: Keys
  defaults?: Partial<VariableValues<Keys>>
  compute: ComputeFn<T, Keys>
}

export type Formula = FormulaDef<PricingTrade, readonly VariableKey[]>

export type QuoteLineInput
  = | { id: string, kind: 'formula', pricingKey: PricingKey, variables: VariableInputs }
    | { id: string, kind: 'manual', label: string, price: number | null }

export interface QuoteOverrides {
  multiplier?: number | null
}

export interface PriceQuoteInput {
  lines: readonly QuoteLineInput[]
  context: ProjectContext
  config: ScopePricingConfig
  overrides?: QuoteOverrides
}

export interface PricedLine {
  id: string
  kind: 'formula' | 'manual' | 'permit'
  status: 'priced'
  label: string
  trade: PricingTrade | null
  cost: number | null
  price: number
  tax: number
  base: number
}

export interface IncompleteLine {
  id: string
  kind: 'formula' | 'manual'
  status: 'incomplete'
  label: string
  trade: PricingTrade | null
  needs: VariableKey[]
}

export type QuoteLineResult = PricedLine | IncompleteLine

export interface QuoteResult {
  lines: QuoteLineResult[]
  multiplier: number
  totalPrice: number
  totalTax: number
  totalBase: number
  totalCost: number
  costedPrice: number
  uncostedPrice: number
  margin: number
  effectiveMultiplier: number | null
  tier: MultiplierTier
  hasUncostedLines: boolean
}

export type SolveMultiplierResult
  = | { status: 'reached' | 'below-floor', multiplier: number, achievedTotal: number }
    | { status: 'no-cost' }
