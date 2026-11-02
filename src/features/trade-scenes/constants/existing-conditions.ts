import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { ExistingConditions, HomeFacts, ResolvedHomeMaterials } from '@/shared/modules/construction/core/types'

import { inferCrawlSpaceExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/crawl-space/infer-existing-conditions'
import { inferExteriorWallExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/exterior-wall/infer-existing-conditions'
import { inferHvacAtticExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/hvac-attic/infer-existing-conditions'
import { inferRoofAtticExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/roof-attic/infer-existing-conditions'
import { inferWindowsExistingConditions } from '@/shared/modules/construction/core/lib/assemblies/windows/infer-existing-conditions'

export type InferExisting = (facts: HomeFacts, home: ResolvedHomeMaterials) => ExistingConditions

// The yard has no home material to read, so it infers nothing.
export const INFER_EXISTING_CONDITIONS: Record<Exclude<AssemblyId, 'yard-ground'>, InferExisting> = {
  'roof-attic': inferRoofAtticExistingConditions,
  'crawl-space': inferCrawlSpaceExistingConditions,
  'exterior-wall': inferExteriorWallExistingConditions,
  'windows': inferWindowsExistingConditions,
  'hvac-attic': inferHvacAtticExistingConditions,
}
