import type { OfferKind, PartDefinition } from '@/shared/modules/construction/core/types'

export function installKind(part: PartDefinition, existing: string | null, installed: string): OfferKind {
  const installedRank = part.materials[installed]?.energyRank
  if (installedRank === undefined) {
    return 'like-for-like'
  }
  const existingRank = existing === null ? undefined : part.materials[existing]?.energyRank
  return existingRank === undefined || existingRank < installedRank ? 'saves-energy' : 'like-for-like'
}
