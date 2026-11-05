import type { ResidentAge, ResidentFigure } from '@/features/trade-scenes/types'
import type { CustomerAgeGroup, HouseholdType } from '@/shared/constants/enums/customers'

export type HouseholdCast = 'single' | 'couple' | 'family' | 'relatives'

export const HOUSEHOLD_CAST = {
  'Single man': 'single',
  'Single woman': 'single',
  'Couple': 'couple',
  'Family': 'family',
  'Relatives': 'relatives',
} as const satisfies Record<HouseholdType, HouseholdCast>

export const RESIDENT_AGE_BY_GROUP = {
  'under-25': 'young',
  '25-45': 'young',
  '45-65': 'middle',
  '65-75': 'senior',
  '75-or-older': 'senior',
} as const satisfies Record<CustomerAgeGroup, ResidentAge>

export const SINGLE_FIGURE: Readonly<Partial<Record<HouseholdType, ResidentFigure>>> = {
  'Single man': 'man',
  'Single woman': 'woman',
}

// Unknown household: a neutral couple of middle age, so the home never reads as anyone in particular.
export const UNKNOWN_HOUSEHOLD_CAST: HouseholdCast = 'couple'
export const UNKNOWN_RESIDENT_AGE: ResidentAge = 'middle'

export const CAST_SIZES = {
  single: { adults: 1, children: 0 },
  couple: { adults: 2, children: 0 },
  family: { adults: 2, children: 2 },
  relatives: { adults: 2, children: 0 },
} as const satisfies Record<HouseholdCast, { adults: number, children: number }>

// Relatives span two generations: one elder beside the household's adults, or one middle-aged relative when they are the elders.
export const RELATIVES_OTHER_GENERATION = {
  young: 'senior',
  middle: 'senior',
  senior: 'middle',
} as const satisfies Record<ResidentAge, ResidentAge>

// The household's age group describes its adults, so a child has none of its own.
export const CHILD_AGE: ResidentAge = 'young'
