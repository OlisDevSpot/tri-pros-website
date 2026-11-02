'use client'

import type { ReactNode } from 'react'
import type { SectionReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { AssemblyKitProps, PartRendererProps } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { SECTION_READING_IDS } from '@/features/trade-scenes/constants/home-anchors'
import { KIT_FOCUS, KIT_PEEL, KIT_ROTATION_Y } from '@/features/trade-scenes/constants/roof-attic-kit'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { kitPaintTemperatures } from '@/features/trade-scenes/lib/kit-paint-temperatures'
import { readingPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { rotPatchSpot } from '@/features/trade-scenes/lib/ribbon-paths'
import { roofAtticPinPoint, roofAtticReadingPoint, roofAtticReadingRider } from '@/features/trade-scenes/lib/roof-attic-kit-points'
import { KitPart } from '@/features/trade-scenes/ui/components/assembly-kits/kit-part'
import { AirSealingPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/air-sealing-part'
import { CeilingPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/ceiling-part'
import { CoveringPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/covering-part'
import { DeckPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/deck-part'
import { DripEdgePart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/drip-edge-part'
import { GutterPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/gutter-part'
import { InsulationPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/insulation-part'
import { KitWalls } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/kit-walls'
import { MembranePart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/membrane-part'
import { PartThermalPaint } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/part-thermal-paint'
import { RadiantBarrierPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/radiant-barrier-part'
import { RaftersPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/rafters-part'
import { RidgeVentPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/ridge-vent-part'
import { RoofAtticFlows } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/roof-attic-flows'
import { RotPatch } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/rot-patch'
import { UnderlaymentPart } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/underlayment-part'
import { SceneAnchor } from '@/shared/components/scene/ui/scene-anchor'

const AT_REST = [0, 0, 0] as const

// One renderer per part id; a part the kit has no drawing for draws nothing rather than failing the zoom.
function drawPart(id: string, props: PartRendererProps): ReactNode {
  switch (id) {
    case 'ceiling': return <CeilingPart {...props} />
    case 'air-sealing': return <AirSealingPart />
    case 'attic-insulation': return <InsulationPart {...props} />
    case 'rafters': return <RaftersPart {...props} />
    case 'radiant-barrier': return <RadiantBarrierPart {...props} />
    case 'deck': return <DeckPart {...props} />
    case 'ice-and-water': return <MembranePart {...props} />
    case 'underlayment': return <UnderlaymentPart {...props} />
    case 'drip-edge': return <DripEdgePart {...props} />
    case 'covering': return <CoveringPart {...props} />
    case 'ridge-vent': return <RidgeVentPart />
    case 'gutter': return <GutterPart {...props} />
    default: return null
  }
}

function isDrawn(part: ResolvedPart): part is ResolvedPart & { material: string } {
  return part.material !== null
}

// The roof and attic of this home at section scale, every part drawn from the resolved parts: a gable or a flat roof, peeled
// apart on the slider, with a tapped part kept whole while the rest fade back. Each part remounts when its material or
// condition changes, which is how an installed part drops in on a change of view. The weather's flow runs through it, the
// thermal camera paints it on the home's scale, and its readings are the home's.
export function RoofAtticKit({ targets, peel, emphasizedPart, onEmphasize, weather, climate, thermalCamera, heat, pinReadings, burst }: AssemblyKitProps) {
  const form: RoofForm = homeRoofForm(targets.form)
  const drawn = targets.parts.filter(isDrawn)
  // Emphasis on a part this home does not have would fade everything to nothing in particular.
  const emphasis = drawn.some(part => part.id === emphasizedPart) ? emphasizedPart : null
  const [fx, fy, fz] = KIT_FOCUS[form]
  const paint = kitPaintTemperatures({ parts: targets.parts, water: targets.water, weather, climate, readings: heat?.readings ?? null })
  // The home pins its readings only under the thermal camera, and the section follows it.
  const pinned = thermalCamera && heat && pinReadings ? SECTION_READING_IDS : []
  const anchorsFor = (rider: string | null) => pinned
    .filter(reading => roofAtticReadingRider(form, reading) === rider)
    .map((reading: SectionReadingId) => <SceneAnchor key={reading} id={readingPinId(reading)} position={roofAtticReadingPoint(form, reading)} />)

  return (
    <group rotation={[0, KIT_ROTATION_Y, 0]}>
      <group position={[-fx, -fy, -fz]}>
        <KitPart partId={null} peelOffset={AT_REST} peel={0} dimmed={emphasis !== null} drop={false} pin={null}>
          <PartThermalPaint on={thermalCamera} paint={paint.frame}>
            <KitWalls form={form} />
          </PartThermalPaint>
        </KitPart>
        {drawn.map((part) => {
          const soaked = targets.water?.soaked[part.id] ?? 0
          const rot = soaked > 0 ? rotPatchSpot(form, part) : null
          return (
            <KitPart
              key={`${part.id}:${part.material}:${part.condition}`}
              partId={part.id}
              peelOffset={KIT_PEEL[form][part.id] ?? AT_REST}
              peel={peel}
              dimmed={emphasis !== null && emphasis !== part.id}
              drop={part.condition === 'installed'}
              pin={roofAtticPinPoint(form, part)}
              onTap={onEmphasize}
            >
              <PartThermalPaint on={thermalCamera} paint={paint.parts[part.id] ?? paint.frame}>
                {drawPart(part.id, { material: part.material, condition: part.condition, form: targets.form })}
                {rot && <RotPatch spot={rot} soaked={soaked} />}
              </PartThermalPaint>
              {anchorsFor(part.id)}
            </KitPart>
          )
        })}
        {anchorsFor(null)}
        <RoofAtticFlows form={form} targets={targets} weather={weather} heat={heat} peel={peel} thermalCamera={thermalCamera} burst={burst} />
      </group>
    </group>
  )
}
