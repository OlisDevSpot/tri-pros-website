'use client'

import type { ComponentType } from 'react'
import type { AssemblyKitProps } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'

import dynamic from 'next/dynamic'

// The second registry, beside the three-free ASSEMBLY_KITS: each kit's drawing loads only when the rep first zooms into it.
// No loading UI: anything but null inside the canvas would be a DOM node in a three.js tree.
export const ASSEMBLY_KIT_COMPONENTS: Partial<Record<AssemblyId, ComponentType<AssemblyKitProps>>> = {
  'roof-attic': dynamic(() => import('@/features/trade-scenes/ui/components/assembly-kits/roof-attic/roof-attic-kit').then(m => m.RoofAtticKit), { ssr: false, loading: () => null }),
}
