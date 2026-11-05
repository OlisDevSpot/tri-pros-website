'use client'

import type { ThreeEvent } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Group, Object3D } from 'three'
import type { HomeFade, HomeKitInputs, HomeSpotId, SceneTargets, SystemLit, SystemPartId, SystemPartTagData } from '@/features/trade-scenes/types'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'
import { AC_SCALE } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { HOME_FADES_SHOWN, HOME_GHOST_TAG } from '@/features/trade-scenes/constants/home-fades'
import { HOME_FLOOR_Y, HOME_OPENING_RISE } from '@/features/trade-scenes/constants/home-geometry'
import { LEAK } from '@/features/trade-scenes/constants/home-life'
import { RAIN_PRESET_WEATHER } from '@/features/trade-scenes/constants/home-temperatures'
import { OWN_PAINT } from '@/features/trade-scenes/constants/home-thermal-zones'
import { LOOK_INSIDE } from '@/features/trade-scenes/constants/look-inside'
import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { WEATHER_SKIES } from '@/features/trade-scenes/constants/weather-skies'
import { useEmphasizePart } from '@/features/trade-scenes/hooks/use-emphasize-part'
import { useSceneScan } from '@/features/trade-scenes/hooks/use-scene-scan'
import { useSceneTapClaim } from '@/features/trade-scenes/hooks/use-scene-tap-claim'
import { atticInsulationTop } from '@/features/trade-scenes/lib/attic-insulation-boxes'
import { ceilingOpenings } from '@/features/trade-scenes/lib/ceiling-openings'
import { hasOutdoorUnit } from '@/features/trade-scenes/lib/has-outdoor-unit'
import { homeFadeNeeded } from '@/features/trade-scenes/lib/home-fade-needed'
import { homeFloorY } from '@/features/trade-scenes/lib/home-floor-y'
import { homeHeatLanes } from '@/features/trade-scenes/lib/home-heat-lanes'
import { homePaintTemperatures } from '@/features/trade-scenes/lib/home-paint-temperatures'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { indoorSide } from '@/features/trade-scenes/lib/indoor-side'
import { installedShingleTone } from '@/features/trade-scenes/lib/installed-shingle-tone'
import { paintWearInForce } from '@/features/trade-scenes/lib/paint-wear-in-force'
import { partState } from '@/features/trade-scenes/lib/part-state'
import { residentAct } from '@/features/trade-scenes/lib/resident-act'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { HeatArrows } from '@/features/trade-scenes/ui/components/heat-arrows'
import { CeilingLeak } from '@/features/trade-scenes/ui/components/home-kit/ceiling-leak'
import { ComfortProps } from '@/features/trade-scenes/ui/components/home-kit/comfort-props'
import { CondenserUnit } from '@/features/trade-scenes/ui/components/home-kit/condenser-unit'
import { Foundation } from '@/features/trade-scenes/ui/components/home-kit/foundation'
import { Garage } from '@/features/trade-scenes/ui/components/home-kit/garage'
import { HomeEquipment } from '@/features/trade-scenes/ui/components/home-kit/home-equipment'
import { HomeRain } from '@/features/trade-scenes/ui/components/home-kit/home-rain'
import { HomeThermalPaint } from '@/features/trade-scenes/ui/components/home-kit/home-thermal-paint'
import { HouseRoof } from '@/features/trade-scenes/ui/components/home-kit/house-roof'
import { HouseShell } from '@/features/trade-scenes/ui/components/home-kit/house-shell'
import { Lot } from '@/features/trade-scenes/ui/components/home-kit/lot'
import { PartAnchorsLayer } from '@/features/trade-scenes/ui/components/home-kit/part-anchors-layer'
import { ReadingLabels } from '@/features/trade-scenes/ui/components/home-kit/reading-labels'
import { Residents } from '@/features/trade-scenes/ui/components/home-kit/residents'
import { Rooms } from '@/features/trade-scenes/ui/components/home-kit/rooms'
import { SpotPinsLayer } from '@/features/trade-scenes/ui/components/home-kit/spot-pins-layer'
import { WeatherSky } from '@/features/trade-scenes/ui/components/home-kit/weather-sky'
import { applyGhost } from '@/features/trade-scenes/ui/lib/apply-ghost'
import { applyHomeFloor } from '@/features/trade-scenes/ui/lib/apply-home-floor'
import { coveringTone } from '@/features/trade-scenes/ui/lib/covering-tone'
import { createFadeSheets, settleFadeSheets } from '@/features/trade-scenes/ui/lib/fade-sheets'
import { paintLook } from '@/features/trade-scenes/ui/lib/paint-look'
import { riseFadeGroup } from '@/features/trade-scenes/ui/lib/rise-fade-group'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { useEased } from '@/shared/components/scene/hooks/use-eased'
import { useSceneBurst } from '@/shared/components/scene/hooks/use-scene-burst'
import { normalizeOnScale } from '@/shared/components/scene/lib/normalize-on-scale'
import { CLIMATE_PRESETS } from '@/shared/modules/construction/core/constants/climate-presets'
import { seasonOf } from '@/shared/modules/construction/core/lib/season-of'

interface HomeKitProps {
  targets: SceneTargets
  inputs: HomeKitInputs
  // Changes whenever the home has something new to live through; each change wakes it for one burst.
  burstKey: string
  // The system up close: its parts stay solid while the rest of the house ghosts.
  lit: SystemLit | null
  // Partly open: the Complete house's cut-away parts rise and fade off in front of the homeowner, camera still.
  open: boolean
  thermal: boolean
  // A tap on the roof, a window or the outdoor unit; up close the house's taps go to its parts instead.
  onSpotTap: (spot: HomeSpotId) => void
}

const NO_PARTS: readonly ResolvedPart[] = []
const RAISED_SHARE = { min: HOME_FLOOR_Y.slab, max: HOME_FLOOR_Y.raised } as const
const HOUSE_TAG = Object.freeze({ ...thermalTag('exterior'), ...HOME_GHOST_TAG })

// The system part a mesh draws, from the nearest group tagged with one.
function scenePartOf(object: Object3D): SystemPartId | null {
  for (let node: Object3D | null = object; node !== null; node = node.parent) {
    const part = (node.userData as SystemPartTagData).scenePart
    if (part !== undefined) {
      return part
    }
  }
  return null
}

// The whole home, drawn once from the profile and the resolved roof; up close is this same house, faded by system.
export function HomeKit({ targets, inputs, burstKey, lit, open, thermal, onSpotTap }: HomeKitProps) {
  const lift = useRef<Group>(null)
  const house = useRef<Group>(null)
  const ground = useRef<Group>(null)
  const groundLevel = useRef<Group>(null)
  const attic = useRef<Group>(null)
  const ducts = useRef<Group>(null)
  const rooms = useRef<Group>(null)
  const roomLife = useRef<Group>(null)
  // Settled Complete, at full strength and with the floor at rest.
  const sealed = useRef(false)
  const lastOpened = useRef<number | null>(null)
  const ghost = useRef(1)
  const levels = useRef<Record<HomeFade, number>>({ ...HOME_FADES_SHOWN })
  const [sheets] = useState(createFadeSheets)
  // How far the house has opened, 0..1, for each house's arrows to follow.
  const openShare: RefObject<number> = useRef(open ? 1 : 0)
  const completeArrowFade: RefObject<number> = useRef(open ? 0 : 1)
  const burst = useSceneBurst(burstKey)
  const invalidate = useThree(state => state.invalidate)
  const emphasize = useEmphasizePart()
  const { claimTap } = useSceneTapClaim()
  const { weather, climate, property, homeMaterials } = inputs
  const floorY = homeFloorY(property.foundationType)
  // The lit system the fades draw. A new one takes over at once; a leaving one holds until the ghost has eased home, or its
  // parts would drop to the ghost and climb back with everything else. It holds whole: an emphasis it left with would keep
  // the rest of the system dimmed through the ease and snap it back once settled.
  const shownLit = useRef<SystemLit | null>(lit)
  useLayoutEffect(() => {
    if (lit !== null) {
      shownLit.current = lit
    }
    else if (shownLit.current !== null) {
      shownLit.current = { ...shownLit.current, emphasized: null }
    }
  }, [lit])

  const fadeHome = useCallback(() => {
    if (house.current) {
      applyGhost(house.current, ghost.current, levels.current, sheets, shownLit.current)
    }
    if (groundLevel.current) {
      applyGhost(groundLevel.current, ghost.current, levels.current, sheets, shownLit.current)
    }
    settleFadeSheets(sheets)
  }, [sheets])

  // A settled Complete house draws nothing it cannot show: no window looks into the attic, and under the thermal camera the
  // paint turns the glass solid, so the rooms and everyone in them go out of sight too. Group flags, so they never fight
  // the ghost's per-mesh ones; the paint and the fades still reach what they hide, so it is right the frame it shows again.
  // Up close on the attic or on heating & cooling, their parts show even through a sealed house.
  const hideUnseen = useCallback((thermalOn: boolean) => {
    const roomsShown = !(sealed.current && thermalOn)
    const system = shownLit.current?.system
    if (attic.current) {
      attic.current.visible = !sealed.current || system === 'attic'
    }
    if (ducts.current) {
      ducts.current.visible = !sealed.current || system === 'heating-cooling'
    }
    if (rooms.current) {
      rooms.current.visible = roomsShown
    }
    if (roomLife.current) {
      roomLife.current.visible = roomsShown
    }
  }, [])

  useEased([lit !== null ? LOOK_INSIDE.ghostOpacity : 1, floorY, open ? 1 : 0], ([opacity, easedFloorY, opened]) => {
    ghost.current = opacity
    if (lit === null && opacity === 1) {
      shownLit.current = null
    }
    if (lift.current && ground.current) {
      applyHomeFloor(lift.current, ground.current, easedFloorY)
    }
    const share = normalizeOnScale(easedFloorY, RAISED_SHARE)
    levels.current.raised = share
    levels.current.slab = 1 - share
    openShare.current = opened
    completeArrowFade.current = 1 - opened
    levels.current.complete = 1 - opened
    if (opened !== lastOpened.current) {
      lastOpened.current = opened
      if (house.current) {
        riseFadeGroup(house.current, 'complete', HOME_OPENING_RISE * opened)
      }
      // The arrows read their fade in their own frame, which may run before this one; the ease asks for no frame once it
      // settles (under reduced motion, its first), so this one lets them draw the final fade.
      invalidate()
    }
    // The inside shows again on the first frame the house starts to open, the ghost comes in, or the floor moves.
    sealed.current = opacity === 1 && opened === 0 && easedFloorY === floorY
    hideUnseen(thermal)
    fadeHome()
  })
  // A part that mounts under a fade (a model finishing its load, a new covering, a condenser while up close) takes it on its
  // first frame. One foundation is always faded out, so this runs at rest too.
  const scanHome = (root: Object3D) => {
    if (homeFadeNeeded(ghost.current, levels.current)) {
      applyGhost(root, ghost.current, levels.current, sheets, shownLit.current)
    }
    return false
  }
  const wakeHouse = useSceneScan(house, scanHome)
  const wakeGround = useSceneScan(groundLevel, scanHome)
  const wakeGhost = useCallback(() => {
    wakeHouse()
    wakeGround()
  }, [wakeHouse, wakeGround])
  // The thermal camera swaps materials in and out under the fades: whichever it hands the meshes takes the current fade at
  // once, including originals put back after the fade has moved on without them. A new lit system needs no ease to show.
  useEffect(() => {
    hideUnseen(thermal)
    fadeHome()
    invalidate()
  }, [thermal, lit, hideUnseen, fadeHome, invalidate])

  const roof = targets.assemblies[HOME_PRIMARY_ASSEMBLY]
  const parts = roof?.parts ?? NO_PARTS
  const form = roof?.form ?? null
  const lowSlope = form === 'low-slope'
  const sky = WEATHER_SKIES[weather]
  const setpoint = CLIMATE_PRESETS[climate][weather === 'rain' ? RAIN_PRESET_WEATHER : weather].setpoint
  const leaking = targets.leak.reachesInside > 0
  const act = residentAct(weather, targets.comfort, targets.leak.reachesInside)
  const roofForm = homeRoofForm(form)
  const season = seasonOf(weather)
  const heat = targets.heat
  const coveringPart = partState(parts, 'covering')
  const covering = coveringPart.material
  const windowParts = targets.assemblies.windows?.parts ?? NO_PARTS
  const wallParts = targets.assemblies['exterior-wall']?.parts ?? NO_PARTS
  const paint = paintLook(partState(wallParts, 'paint'), paintWearInForce(targets.home['exterior-paint'], homeMaterials.paintWear), wallParts.find(part => part.id === 'paint')?.condition === 'installed')
  const garageRoofTone = coveringTone(covering, roofForm === 'low-slope' ? 'membrane' : 'shingle', coveringPart.wear, installedShingleTone(parts, homeMaterials.shingleColor))
  // The resolver leaves the attic's ducts out for a home whose system has none.
  const ducted = targets.assemblies['hvac-attic'] !== undefined
  const hvacParts = targets.assemblies['hvac-attic']?.parts ?? NO_PARTS
  const floorInsulation = partState(targets.assemblies['crawl-space']?.parts ?? NO_PARTS, 'floor-insulation')
  const glazing = partState(windowParts, 'glazing').material
  const acScale = homeMaterials.acTons === null ? 1 : AC_SCALE[homeMaterials.acTons]
  const airSealed = partState(parts, 'air-sealing').material !== null
  const leaks = useMemo(() => airSealed ? [] : ceilingOpenings(ducted), [airSealed, ducted])
  const openHeatLanes = useMemo(() => heat !== null && season !== null ? homeHeatLanes(roofForm, heat, season, 'partly-open', covering, leaks) : [], [roofForm, heat, season, covering, leaks])
  const completeHeatLanes = useMemo(() => heat !== null && season !== null ? homeHeatLanes(roofForm, heat, season, 'complete', covering, leaks) : [], [roofForm, heat, season, covering, leaks])
  const side = indoorSide(weather, property.hvacType, property.hvacComponents)
  // The condenser cools; on a winter night the furnace or the unit's heater carries the load instead.
  const coolingLoad = side === 'cooling' ? targets.equipmentLoad : 0

  const spotTap = (spot: HomeSpotId) => (event: ThreeEvent<MouseEvent>) => {
    if (lit !== null || event.delta > SCENE_MOTION.tapSlopPx) {
      return
    }
    event.stopPropagation()
    onSpotTap(spot)
  }
  // The package unit is drawn among the ducts and the rest of the equipment, and only the unit is a spot.
  const packageUnitTap = (event: ThreeEvent<MouseEvent>) => {
    if (scenePartOf(event.object) === 'package-unit') {
      spotTap('equipment')(event)
    }
  }
  // Up close a tap on a shown system part emphasises it, as its pin and its row in the card do. R3F hands the tap to every
  // mesh under the pointer, nearest first, so a ghosted part in front lets it through to the lit one behind.
  const partTap = (event: ThreeEvent<MouseEvent>) => {
    const part = scenePartOf(event.object)
    if (lit === null || event.delta > SCENE_MOTION.tapSlopPx || part === null || !lit.shown.has(part)) {
      return
    }
    event.stopPropagation()
    claimTap()
    emphasize(part)
  }

  return (
    <>
      <WeatherSky weather={weather} thermal={thermal} />
      <primitive object={sheets.layer} />
      <group userData={thermalTag('exterior')}>
        <Lot ground={sky.ground} />
        <Garage form={roofForm} wallColor={paint.color} roofTone={garageRoofTone} />
      </group>
      {/* On the ground whatever the foundation, ghosted with the house. */}
      <group ref={groundLevel} onClick={partTap} userData={HOME_GHOST_TAG}>
        {hasOutdoorUnit(property.hvacType, property.hvacComponents) && (
          <group userData={thermalTag(side ?? 'interior')}>
            <CondenserUnit load={coolingLoad} burst={burst} wear={partState(hvacParts, 'condenser').wear} scale={acScale} onTap={spotTap('equipment')} />
          </group>
        )}
      </group>
      {/* Under the thermal camera the streaks keep their own see-through look: painted, they would turn into solid sticks. */}
      {weather === 'rain' && (
        <group userData={thermalTag(OWN_PAINT)}>
          <HomeRain running={burst.running} gutters={partState(parts, 'gutter').material !== null} lowSlope={lowSlope} />
        </group>
      )}
      {/* Untagged, so the thermal paint reaches only the house group in it, never the arrows or the anchors. */}
      <group ref={lift} onClick={partTap}>
        {/* Outside air is the thermal camera's reading for any part of the house no group below names otherwise. */}
        <group ref={house} userData={HOUSE_TAG}>
          <Foundation ground={ground} floorInsulation={floorInsulation} paint={paint} thermal={thermal} />
          <HouseShell
            windowsType={glazing === 'double-pane' ? 'double' : 'single'}
            frameWear={partState(windowParts, 'frame').wear}
            glassWear={partState(windowParts, 'glazing').wear}
            paint={paint}
            roofForm={roofForm}
            windowGlow={sky.windowGlow}
            thermal={thermal}
            onWindowTap={spotTap('window')}
          />
          <group ref={rooms}>
            <Rooms roomLight={sky.roomLight} />
          </group>
          <HouseRoof form={form} parts={parts} onTap={spotTap('roof')} attic={attic} shingleColor={homeMaterials.shingleColor} paint={paint} thermal={thermal} atticFanRunning={heat?.atticFanRunning ?? false} burst={burst} ducted={ducted} />
          <group onClick={packageUnitTap}>
            <HomeEquipment
              hvacType={property.hvacType}
              hvacComponents={property.hvacComponents}
              lowSlope={lowSlope}
              weather={weather}
              load={targets.equipmentLoad}
              meterSpeed={targets.meterSpeed}
              setpoint={setpoint}
              burst={burst}
              ducts={ducts}
              ductRuns={partState(hvacParts, 'duct-runs')}
              packageUnit={partState(hvacParts, 'package-unit')}
              acScale={acScale}
              ducted={ducted}
            />
          </group>
          <group ref={roomLife}>
            <Residents residents={targets.residents} act={act} burst={burst} thermal={thermal} />
            <group userData={thermalTag('interior')}>
              <ComfortProps fanning={season === 'summer' && targets.comfort === 'strained'} burst={burst} />
            </group>
            {leaking && (
              <group userData={thermalTag('interior')}>
                <CeilingLeak
                  reachesInside={targets.leak.reachesInside}
                  topY={atticInsulationTop(partState(parts, 'attic-insulation').material, lowSlope, LEAK.spot[1])}
                  burst={burst}
                />
              </group>
            )}
          </group>
        </group>
        <PartAnchorsLayer form={form} lit={lit} />
        <SpotPinsLayer form={form} hvacType={property.hvacType} />
        {thermal && targets.heat !== null && <ReadingLabels form={form} />}
        {/* Unmounted whenever the arrows leave, so a hidden arrow never keeps the canvas drawing. While they show, the
            Complete and the open house's sets both stay mounted and cross-fade as the house opens: a set faded to 0 stops
            asking for frames and stops drawing. The Complete set hides behind the house's own walls and roof, so the back
            windows' arrows show only through the open house. Outside the house group, so neither the ghost nor the thermal
            paint touches them. Up close they would cross the system the rep is showing. */}
        {thermal && lit === null && weather !== 'rain' && heat !== null && (
          <>
            <HeatArrows lanes={completeHeatLanes} size={HEAT_ARROW_LOOK.size.home} fade={completeArrowFade} depthTest />
            <HeatArrows lanes={openHeatLanes} size={HEAT_ARROW_LOOK.size.home} fade={openShare} />
          </>
        )}
      </group>
      {thermal && (
        <HomeThermalPaint
          temperatures={homePaintTemperatures({ readings: targets.heat?.readings ?? null, equipmentLoad: targets.equipmentLoad, weather, climate, crawlInsulated: floorInsulation.material !== null })}
          soakedPartIds={targets.leak.soakedPartIds}
          onRepaint={wakeGhost}
        />
      )}
    </>
  )
}
