'use client'

import type { SceneTargets, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { Suspense, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { ASSEMBLY_KIT_COMPONENTS } from '@/features/trade-scenes/constants/assembly-kit-components'
import { ASSEMBLY_KITS } from '@/features/trade-scenes/constants/assembly-kits'
import { CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { HOME_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { AssemblyKitFadeContext } from '@/features/trade-scenes/contexts/assembly-kit-fade-context'
import { useEmphasizePart } from '@/features/trade-scenes/hooks/use-emphasize-part'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { useSceneBurst } from '@/shared/components/scene/hooks/use-scene-burst'

interface AssemblyKitHostProps {
  zoom: AssemblyId | null
  targets: SceneTargets
  // The home's roof form, which moves the roof anchor.
  form: RoofForm
  // The home's burst key: mounted with the canvas, the host's burst starts and ends with the home's.
  burstKey: string
}

function selectKitScene(state: TradeSceneInputs) {
  return { weather: state.weather, climate: state.climate ?? CLIMATE_FALLBACK, thermalCamera: state.thermalCamera }
}

// Mounts the zoomed assembly's kit at its anchor and crossfades it in while the home fades to a ghost; on the way back it
// fades out first and only then unmounts. Any registered kit mounts the same way, so a new kit needs no change here.
export function AssemblyKitHost({ zoom, targets, form, burstKey }: AssemblyKitHostProps) {
  const peel = useSceneInputs((state: TradeSceneInputs) => state.peel)
  const emphasizedPart = useSceneInputs((state: TradeSceneInputs) => state.emphasizedPart)
  const scene = useSceneInputs(useShallow(selectKitScene))
  const burst = useSceneBurst(burstKey)
  const onEmphasize = useEmphasizePart()
  const fade = useRef(0)
  // The kit on screen: the zoomed one, or the one fading out after Back.
  const [shown, setShown] = useState<AssemblyId | null>(zoom)
  if (zoom !== null && zoom !== shown) {
    setShown(zoom)
  }

  useEased(zoom !== null ? 1 : 0, (value) => {
    fade.current = value
    if (value === 0 && zoom === null) {
      setShown(null)
    }
  })

  const Kit = shown !== null ? ASSEMBLY_KIT_COMPONENTS[shown] : undefined
  const kit = shown !== null ? ASSEMBLY_KITS[shown] : undefined
  const kitTargets = shown !== null ? targets.assemblies[shown] : undefined
  if (!Kit || !kit || !kitTargets) {
    return null
  }

  return (
    <AssemblyKitFadeContext value={fade}>
      <group position={HOME_ANCHORS[form][kit.anchor].position}>
        <Suspense fallback={null}>
          <Kit
            targets={kitTargets}
            peel={peel}
            emphasizedPart={emphasizedPart}
            onEmphasize={onEmphasize}
            {...scene}
            // Kept while the kit fades out after Back, so its arrows and colours fade with it instead of dropping away.
            heat={targets.heat}
            // Only while zoomed: a kit fading out after Back must not take the reading pins back from the home.
            pinReadings={zoom !== null}
            burst={burst}
          />
        </Suspense>
      </group>
    </AssemblyKitFadeContext>
  )
}
