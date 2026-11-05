import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { SCOPE_IDS } from '@/shared/modules/construction/core/constants/scope-ids'

// A flat roof's insulation lies in joists closed between ceiling and deck, so only a redeck opens them; a torch down
// alone keeps the deck on. An unset roof draws pitched.
export function atticReachable(form: RoofForm | null, picks: readonly string[]): boolean {
  return form !== 'low-slope' || picks.includes(SCOPE_IDS.roofRedeck)
}
