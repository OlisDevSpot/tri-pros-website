import type { ResidentFigure, ResidentSpec, TradeSceneInputs } from '@/features/trade-scenes/types'

import { CAST_SIZES, CHILD_AGE, HOUSEHOLD_CAST, RELATIVES_OTHER_GENERATION, RESIDENT_AGE_BY_GROUP, SINGLE_FIGURE, UNKNOWN_HOUSEHOLD_CAST, UNKNOWN_RESIDENT_AGE } from '@/features/trade-scenes/constants/residents'

// Everyone but a single alternates figures in cast order, so a couple is a man and a woman and a family's children differ.
function figureAt(index: number): ResidentFigure {
  return index % 2 === 0 ? 'man' : 'woman'
}

export function castResidents(household: TradeSceneInputs['household']): ResidentSpec[] {
  const cast = household.type === null ? UNKNOWN_HOUSEHOLD_CAST : HOUSEHOLD_CAST[household.type]
  const age = household.ageGroup === null ? UNKNOWN_RESIDENT_AGE : RESIDENT_AGE_BY_GROUP[household.ageGroup]
  const { adults, children } = CAST_SIZES[cast]
  const single = household.type === null ? undefined : SINGLE_FIGURE[household.type]

  const residents: ResidentSpec[] = Array.from({ length: adults }, (_, index) => ({ id: `adult-${index + 1}`, role: 'adult', age, figure: single ?? figureAt(index) }))
  if (cast === 'relatives') {
    residents.push({ id: `adult-${adults + 1}`, role: 'adult', age: RELATIVES_OTHER_GENERATION[age], figure: figureAt(adults) })
  }
  for (let index = 0; index < children; index++) {
    residents.push({ id: `child-${index + 1}`, role: 'child', age: CHILD_AGE, figure: figureAt(index) })
  }
  return residents
}
