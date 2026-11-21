'use client'

import type { BufferGeometry, CanvasTexture } from 'three'
import type { GroundDraw } from '@/features/trade-scenes/lib/ground-draw'
import type { GroundStripKey } from '@/features/trade-scenes/lib/shown-ground'
import type { GroundLayer, GroundMaterialId, LotLayout, ResolvedLayout, WeatherSky, WornStep } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { Fragment, useEffect, useMemo } from 'react'
import { Color } from 'three'

import { GROUND_MATERIAL_INDEX, GROUND_MATERIALS, GROUND_WEAR_INDEX } from '@/features/trade-scenes/constants/ground-materials'
import { GROUND_WEAR_LOOKS, WORN_LAWN_RAISE } from '@/features/trade-scenes/constants/ground-wear-looks'
import { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'
import { WEAR_AMOUNT } from '@/features/trade-scenes/constants/wear-looks'
import { groundDraw, isWornStep } from '@/features/trade-scenes/lib/ground-draw'
import { drawnAppearance, drawnWear, groundStripKeys, shownGround } from '@/features/trade-scenes/lib/shown-ground'
import { wearShift } from '@/features/trade-scenes/lib/wear-shift'
import { TexturedMaterial } from '@/features/trade-scenes/ui/components/home-kit/textured-material'
import { createWearMarksTexture } from '@/features/trade-scenes/ui/lib/create-wear-marks-texture'
import { regionStripGeometry } from '@/features/trade-scenes/ui/lib/region-strip-geometry'
import { wornColor } from '@/features/trade-scenes/ui/lib/worn-color'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'

interface LayoutRegionsProps {
  lot: LotLayout
  resolved: ResolvedLayout
  layer: GroundLayer
  ground: WeatherSky['ground']
}

interface RegionStrip extends GroundStripKey {
  key: string
  geometry: BufferGeometry
  draw: GroundDraw | null
}

const multiplied = (a: string, b: string) => `#${new Color(a).multiply(new Color(b)).getHexString()}`

function marksKey({ draw, wear }: RegionStrip): string | null {
  return draw?.marks && isWornStep(wear) ? `${draw.marks}/${wear}` : null
}

// Ground with no texture keeps today's flat look: its own colour, or a loose step's worn colour.
function flatLook(material: GroundMaterialId, wear: Wear | null) {
  const { wearLook, look } = GROUND_MATERIALS[material]
  if (wearLook !== 'loose' || !isWornStep(wear)) {
    return { color: look.color, roughness: look.roughness }
  }
  const { tint, mix } = GROUND_WEAR_LOOKS.loose[wear]
  return { color: wornColor(look.color, LOT_PALETTE[tint], mix * WEAR_AMOUNT.worn), roughness: look.roughness }
}

// `color` is what shows until the map arrives, so it is never a bare multiplier. A tinted region takes the wear shift on its
// tint; one in the texture's own colours takes it as a factor that lands today's flat shift at the material's mean colour.
// Sod lies under the weather's tint, as the lawn around it does.
function texturedLook(material: GroundMaterialId, wear: Wear | null, ground: WeatherSky['ground'], draw: GroundDraw) {
  const { look, wearLook } = GROUND_MATERIALS[material]
  const shaded = (from: string) => draw.shade === null ? from : wornColor(from, LOT_PALETTE[draw.shade.tint], draw.shade.amount)
  const { set, map } = draw
  if (draw.mapTint !== null) {
    const tint = shaded(draw.mapTint)
    return { set, map, color: tint, mapTint: tint, roughness: look.roughness }
  }
  const shift = draw.shade === null ? null : new Color().setRGB(...wearShift(look.color, shaded(look.color)))
  if (wearLook === 'lawn') {
    return { set, map, color: multiplied(look.color, ground.color), mapTint: shift === null ? ground.color : new Color(ground.color).multiply(shift), roughness: ground.roughness }
  }
  return { set, map, color: flatLook(material, wear).color, mapTint: shift ?? undefined, roughness: look.roughness }
}

// Sod at Good is the ground strip itself, so only the other ground lies on it. A double-tap passes through the strips to
// the ground.
export function LayoutRegions({ lot, resolved, layer, ground }: LayoutRegionsProps) {
  const strips = useMemo<RegionStrip[]>(() => {
    const { origin, heightAt, mask } = resolved
    return groundStripKeys(lot, layer, mask).map(({ material, wear, appearance }) => {
      const value = GROUND_MATERIAL_INDEX[material]
      const wearValue = wear === null ? 0 : GROUND_WEAR_INDEX[wear]
      const picks = (i: number) => {
        const shown = shownGround(lot, layer, i)
        return shown.material === value && drawnWear(material, shown.wear) === wearValue && drawnAppearance(material, wear, shown.appearance) === appearance
      }
      const raise = GROUND_MATERIALS[material].wearLook === 'lawn' ? WORN_LAWN_RAISE : GROUND_MATERIALS[material].look.raise
      return { key: `${material}:${wear}:${appearance}`, material, wear, appearance, geometry: regionStripGeometry(lot, origin, heightAt, mask, picks, raise), draw: groundDraw(material, wear, appearance) }
    })
  }, [lot, resolved, layer])
  // R3F leaves a geometry passed as a prop alone, so every strip of a superseded set is disposed here.
  useEffect(() => () => strips.forEach(strip => strip.geometry.dispose()), [strips])

  // Made once per strip set and weather, so a render hands each material the same tint and its tint effect stays still.
  const { color: groundColor, roughness: groundRoughness } = ground
  const looks = useMemo(() => new Map(strips.map(({ key, material, wear, draw }) => [
    key,
    draw === null ? null : texturedLook(material, wear, { color: groundColor, roughness: groundRoughness }, draw),
  ])), [strips, groundColor, groundRoughness])

  // Keyed on the set of overlays the strips need, so a stroke that keeps the same wear steps redraws no canvas.
  const wanted = [...new Set(strips.map(marksKey).filter(key => key !== null))].join('|')
  const overlays = useMemo(() => {
    const made = new Map<string, CanvasTexture>()
    for (const key of wanted === '' ? [] : wanted.split('|')) {
      const [look, wear] = key.split('/') as ['lawn' | 'paving', WornStep]
      const texture = createWearMarksTexture(look, wear)
      if (texture !== null) {
        made.set(key, texture)
      }
    }
    return made
  }, [wanted])
  useEffect(() => () => overlays.forEach(texture => texture.dispose()), [overlays])

  return (
    <group>
      {strips.map((strip) => {
        const { key, material, wear, geometry, draw } = strip
        const textured = looks.get(key)
        const marks = overlays.get(marksKey(strip) ?? '')
        const lawn = draw?.marks === 'lawn'
        return (
          <Fragment key={key}>
            <mesh geometry={geometry} receiveShadow raycast={ignoreRaycast}>
              {textured
                ? <TexturedMaterial {...textured} />
                : <meshStandardMaterial {...flatLook(material, wear)} />}
            </mesh>
            {marks !== undefined && (
              <mesh geometry={geometry} receiveShadow raycast={ignoreRaycast}>
                <meshStandardMaterial
                  map={marks}
                  color={lawn ? ground.color : '#ffffff'}
                  roughness={lawn ? ground.roughness : GROUND_MATERIALS[material].look.roughness}
                  transparent
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>
            )}
          </Fragment>
        )
      })}
    </group>
  )
}
