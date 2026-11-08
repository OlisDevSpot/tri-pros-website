import type { ResolvedPart, ShingleColorId } from '@/shared/modules/construction/core/types'

import { OWENS_CORNING_SHINGLES } from '@/shared/modules/construction/core/constants/owens-corning-shingles'
import { STANDARD_SHINGLES } from '@/shared/modules/construction/core/constants/standard-shingles'

// The picked colour is the new tone of a shingle the build installs, from the list of the line it installs. The home's
// existing roof and a build with no colour picked keep the palette's tones.
export function installedShingleTone(parts: readonly ResolvedPart[], colorId: ShingleColorId | null): string | null {
  const covering = parts.find(part => part.id === 'covering')
  if (colorId === null || covering?.condition !== 'installed') {
    return null
  }
  if (covering.material === 'cool-shingle') {
    return OWENS_CORNING_SHINGLES.find(color => color.id === colorId)?.hex ?? null
  }
  if (covering.material === 'shingle') {
    return STANDARD_SHINGLES.find(color => color.id === colorId)?.hex ?? null
  }
  return null
}
