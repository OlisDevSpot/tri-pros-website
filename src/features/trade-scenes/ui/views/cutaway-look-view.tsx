'use client'

import type { LookDevOptions } from '@/features/trade-scenes/types'

import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'

import { LOOK_DEV_DEFAULTS } from '@/features/trade-scenes/constants/look-dev-options'
import { LookDevControls } from '@/features/trade-scenes/ui/components/look-dev/look-dev-controls'

// three.js loads only when this page is open.
const LookDevScene = dynamic(() => import('@/features/trade-scenes/ui/components/look-dev/look-dev-scene').then(m => m.LookDevScene), { ssr: false })

// A lab page: its choices live in component state on purpose; trade scenes keep theirs in scene inputs.
export function CutawayLookView() {
  const [options, setOptions] = useState<LookDevOptions>(LOOK_DEV_DEFAULTS)
  const update = useCallback((patch: Partial<LookDevOptions>) => setOptions(current => ({ ...current, ...patch })), [])
  const emphasize = useCallback((emphasized: string | null) => setOptions(current => ({ ...current, emphasized })), [])

  return (
    // Scoped dark so the controls resolve their dark tokens on the presentation ground in either scheme.
    <div className="dark flex h-full flex-col gap-4 bg-(--presentation-ground) p-4 text-foreground">
      <LookDevControls options={options} onChange={update} />
      {options.renderer === 'webgpu' && <p className="text-xs text-muted-foreground">WebGPU draws the materials only: thermal paint, heat flow, glow and the studio contact shadow are WebGL paths today.</p>}
      <div className="min-h-[60vh] flex-1 overflow-hidden rounded-xl">
        <LookDevScene options={options} onEmphasize={emphasize} />
      </div>
    </div>
  )
}
