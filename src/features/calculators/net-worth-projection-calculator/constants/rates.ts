import type { RateKey } from '@/features/calculators/net-worth-projection-calculator/schemas/config'

export const RATE_KEYS = ['homeAppreciation', 'electric', 'gas', 'water', 'gardening', 'misc'] as const satisfies readonly RateKey[]

export const RATE_LABELS = {
  homeAppreciation: 'Home appreciation',
  electric: 'Electric rate increase',
  gas: 'Gas rate increase',
  water: 'Water rate increase',
  gardening: 'Gardening price increase',
  misc: 'Misc increase (0 keeps it flat)',
} as const satisfies Record<RateKey, string>
