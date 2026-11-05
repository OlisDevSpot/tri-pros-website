import type { OwensCorningColorId } from '@/shared/modules/construction/core/constants/owens-corning-shingles'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { OWENS_CORNING_SHINGLES } from '@/shared/modules/construction/core/constants/owens-corning-shingles'

// The picked Owens Corning colour is the new tone of a cool shingle the build installs. The home's existing roof, a regular
// shingle, and a build with no colour picked keep the palette's tones.
export function installedShingleTone(parts: readonly ResolvedPart[], colorId: OwensCorningColorId | null): string | null {
  const covering = parts.find(part => part.id === 'covering')
  if (colorId === null || covering?.condition !== 'installed' || covering.material !== 'cool-shingle') {
    return null
  }
  return OWENS_CORNING_SHINGLES.find(color => color.id === colorId)?.hex ?? null
}
