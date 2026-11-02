import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { Assembly } from '@/shared/modules/construction/core/types'

import { CRAWL_SPACE } from '@/shared/modules/construction/core/constants/assemblies/crawl-space'
import { EXTERIOR_WALL } from '@/shared/modules/construction/core/constants/assemblies/exterior-wall'
import { HVAC_ATTIC } from '@/shared/modules/construction/core/constants/assemblies/hvac-attic'
import { ROOF_ATTIC } from '@/shared/modules/construction/core/constants/assemblies/roof-attic'
import { WINDOWS } from '@/shared/modules/construction/core/constants/assemblies/windows'
import { YARD_GROUND } from '@/shared/modules/construction/core/constants/assemblies/yard-ground'

// Registry order is the tie-break when a trade's selected scopes install into two assemblies equally.
export const ASSEMBLIES: Record<AssemblyId, Assembly> = {
  'roof-attic': ROOF_ATTIC,
  'crawl-space': CRAWL_SPACE,
  'exterior-wall': EXTERIOR_WALL,
  'windows': WINDOWS,
  'yard-ground': YARD_GROUND,
  'hvac-attic': HVAC_ATTIC,
}
