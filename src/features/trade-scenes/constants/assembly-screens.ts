import type { AssemblyScreenBlock } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'

// Peel first: it is what the close-up opens on, and the parts list answers it.
export const ASSEMBLY_SCREENS: Partial<Record<AssemblyId, readonly AssemblyScreenBlock[]>> = {
  'roof-attic': [{ kind: 'peel' }, { kind: 'parts' }],
}
