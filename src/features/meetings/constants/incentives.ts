export const incentiveValidOpts = ['Always', 'Expiration date', 'Limited slots', 'Program based', 'Scope based']

export const incentiveTypes = [
  'discount',
  'tax-credit',
  'cash-back',
  'exclusive-bonus',
  'other',
] as const

export const programIncentives = [
  {
    label: 'Energy Efficiency Prioritization Incentive',
    accessor: 'energy-efficiency-prioritization-incentive',
    validOpt: 'Program based',
    description: 'An incentive applied for multiple energy efficiency scopes',
    apply(scopes: { scopeName: string, startingPrice: number }[]) {
      const startingPrice = scopes.reduce((total, scope) => total + scope.startingPrice, 0)
      return startingPrice * 0.9
    },
  },
  {
    label: '5% [Holiday] Coupon',
    accessor: 'holiday-coupon',
    validOpt: 'Expiration date',
    description: 'An incentive applied for multiple energy efficiency scopes',
    apply(scopes: { scopeName: string, startingPrice: number }[]) {
      const startingPrice = scopes.reduce((total, scope) => total + scope.startingPrice, 0)
      return startingPrice * 0.95
    },
  },
  {
    label: 'Multi-scope Package Incentive',
    accessor: 'multi-product-package-incentive',
    description: 'An incentive that is applied when at least 2 scopes are selected, or 1 scope and 2 addons',
    validOpt: 'Always',
    apply(scopesOrAddons: { itemName: string, itemType: string, startingPrice: number }[]) {
      const startingPrice = scopesOrAddons.reduce((total, scopeOrAddon) => total + scopeOrAddon.startingPrice, 0)

      const twoScopesValid = scopesOrAddons.length === 2 && scopesOrAddons.every(scopeOrAddon => scopeOrAddon.itemType === 'scope')
      const twoAddonsValid = scopesOrAddons.length >= 2 && scopesOrAddons.some(scopeOrAddon => scopeOrAddon.itemType === 'scope')

      const isValid = twoAddonsValid || twoScopesValid

      if (!isValid)
        return startingPrice

      return startingPrice * 0.92
    },
  },
  {
    label: 'Direct-to-Source Offer',
    accessor: 'direct-to-source-offer',
    validOpt: 'Limited slots',
    description: 'Trial period! Give a select few homeowners access to heavily reduced contractor pricing via our vetted subcontractors network',
    apply(scopes: { scopeName: string, startingPrice: number }[]) {
      const startingPrice = scopes.reduce((total, scope) => total + scope.startingPrice, 0)
      return startingPrice * 0.9
    },
  },
]
