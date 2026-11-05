import type { HomeSystemId } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'

import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'

// A shared system part belongs to no one system, so it answers null rather than its first.
export function systemOfPart(assembly: AssemblyId, part: string): HomeSystemId | null {
  const entry = SYSTEM_PARTS.find(candidate => candidate.assembly === assembly && candidate.part === part)
  return entry === undefined || entry.systems.length > 1 ? null : entry.systems[0]
}
