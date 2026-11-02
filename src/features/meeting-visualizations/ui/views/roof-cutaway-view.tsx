'use client'

import type { BuildState, CutawayProfile, CutawayScope, LayerId, PinRegistry } from '@/features/meeting-visualizations/types'
import type { YearBuiltRange } from '@/shared/constants/enums/customers'
import { useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import { resolveRoofAssembly } from '@/features/meeting-visualizations/lib/resolve-roof-assembly'
import { BuildToggle, ExplodeControl } from '@/features/meeting-visualizations/ui/components/roof-cutaway/cutaway-controls'
import { LayerList } from '@/features/meeting-visualizations/ui/components/roof-cutaway/layer-list'
import { LayerPins } from '@/features/meeting-visualizations/ui/components/roof-cutaway/layer-pins'
import { ProfileControls } from '@/features/meeting-visualizations/ui/components/roof-cutaway/profile-controls'

// three.js is ~600 kB before gzip; only the step that shows the cutaway should pay for it.
const CutawayCanvas = dynamic(() => import('@/features/meeting-visualizations/ui/components/roof-cutaway/cutaway-canvas'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-white/50">Loading the cutaway…</div>,
})

const ERA_PHRASE: Record<YearBuiltRange, string> = {
  'Pre-1950': 'before 1950',
  '1950-1978': 'between 1950 and 1978',
  '1978-1998': 'between 1978 and 1998',
  '1998-2014': 'between 1998 and 2014',
  'Post-2014': 'after 2014',
}

const DEMO_PROFILE: CutawayProfile = { roofType: 'shingle', yearBuilt: '1950-1978', insulationLevel: 'low' }

interface RoofCutawayViewProps {
  initialProfile?: CutawayProfile
  initialScope?: CutawayScope
}

export function RoofCutawayView({ initialProfile = DEMO_PROFILE, initialScope = { roof: true, attic: true } }: RoofCutawayViewProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [scope, setScope] = useState(initialScope)
  const [build, setBuild] = useState<BuildState>('today')
  const [explode, setExplode] = useState(0)
  const [selected, setSelected] = useState<LayerId | null>(null)
  const reducedMotion = useReducedMotion() ?? false
  const [pins] = useState<PinRegistry>(() => ({ anchors: new Map(), elements: new Map() }))

  const assembly = useMemo(() => resolveRoofAssembly(profile, scope, build), [profile, scope, build])

  const toggleSelected = useCallback((id: LayerId) => setSelected(current => (current === id ? null : id)), [])

  const lead = build === 'tri-pros'
    ? 'Every layer rebuilt, from the deck to the ridge.'
    : assembly.isTypical
      ? `Homes built ${ERA_PHRASE[profile.yearBuilt ?? '1950-1978']} usually hide this above the ceiling.`
      : `Built ${ERA_PHRASE[profile.yearBuilt ?? '1950-1978']}. This is what is above your ceiling.`

  return (
    <div data-stage className="@container/cutaway relative h-dvh overflow-hidden bg-(--presentation-ground) text-white">
      <div className="absolute inset-x-0 top-0 h-[54%] @[60rem]/cutaway:inset-y-0 @[60rem]/cutaway:right-0 @[60rem]/cutaway:left-[min(30rem,38%)] @[60rem]/cutaway:h-auto">
        <CutawayCanvas
          assembly={assembly}
          explode={explode}
          selected={selected}
          reducedMotion={reducedMotion}
          pins={pins}
          onSelect={toggleSelected}
        />
        <LayerPins layers={assembly.layers} registry={pins} selected={selected} showAll={explode > 0.2} onSelect={toggleSelected} />
      </div>

      <aside className="absolute inset-x-0 bottom-0 flex h-[46%] flex-col gap-5 overflow-y-auto border-t border-white/10 px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] @[60rem]/cutaway:inset-y-0 @[60rem]/cutaway:left-0 @[60rem]/cutaway:h-auto @[60rem]/cutaway:w-[min(30rem,38%)] @[60rem]/cutaway:border-t-0 @[60rem]/cutaway:border-r @[60rem]/cutaway:px-8 @[60rem]/cutaway:py-10">
        <header className="grid gap-2">
          <p className="text-xs font-bold tracking-[0.2em] text-(--presentation-accent) uppercase">Roof & attic, x-rayed</p>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">What is really over your head</h1>
          <p className="text-base text-pretty text-white/70">{lead}</p>
        </header>

        <BuildToggle build={build} todayLabel={assembly.isTypical ? 'A typical roof today' : 'Your roof today'} onChange={setBuild} />
        <ExplodeControl value={explode} onChange={setExplode} />
        <LayerList layers={assembly.layers} selected={selected} onSelect={toggleSelected} />
      </aside>

      <div className="absolute top-4 right-4">
        <ProfileControls profile={profile} scope={scope} onProfileChange={setProfile} onScopeChange={setScope} />
      </div>
    </div>
  )
}
