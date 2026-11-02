'use client'

import type { AssemblyScreenBlock as AssemblyScreenBlockData } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'

import { PartsBlock } from '@/features/trade-scenes/ui/components/panel/parts-block'
import { PeelControl } from '@/features/trade-scenes/ui/components/panel/peel-control'

interface AssemblyScreenBlockProps {
  block: AssemblyScreenBlockData
  zoom: AssemblyId
}

export function AssemblyScreenBlock({ block, zoom }: AssemblyScreenBlockProps) {
  switch (block.kind) {
    case 'peel':
      return <PeelControl />
    case 'parts':
      return <PartsBlock zoom={zoom} />
  }
}
