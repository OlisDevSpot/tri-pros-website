'use client'

import type { GroundMaterialId } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { GROUND_APPEARANCE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { appearanceOptions, canonicalAppearance, packAppearance } from '@/features/trade-scenes/lib/ground-appearance'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { ColorSwatches } from '@/features/trade-scenes/ui/components/panel/color-swatches'

interface GroundAppearancePicksProps {
  material: GroundMaterialId
  wear: Wear | null
  // Mixed where one chip covers regions of several appearances; no pattern reads as picked until one is.
  value: number | 'mixed'
  onPick: (appearance: number) => void
}

// A ground material's patterns and colours, as the rows of its chip's menu. A Courtyard colour is a blend of stones, so a
// colour index carries over to another pattern only between plain tints.
export function GroundAppearancePicks({ material, wear, value, onPick }: GroundAppearancePicksProps) {
  const patterns = appearanceOptions(material, wear)
  if (patterns === null) {
    return null
  }
  const canonical = value === 'mixed' ? null : canonicalAppearance(material, value)
  const pattern = canonical === null ? null : patterns[canonical >> 4]
  const colorIndex = canonical === null ? 0 : canonical & 15
  const pickPattern = (id: string) => {
    const index = patterns.findIndex(each => each.id === id)
    const next = patterns[index]
    const carried = pattern !== null && next.colors[colorIndex] !== undefined && !pattern.colors[colorIndex].blend && !next.colors[colorIndex].blend
    onPick(packAppearance(index, carried ? colorIndex : 0))
  }

  return (
    <>
      {patterns.length > 1 && (
        <>
          <div data-menu-header className={CONTROLS_CLASSES.menuHeader}>{GROUND_APPEARANCE_COPY.pattern}</div>
          <div className={CONTROLS_CLASSES.menuRow}>
            <ChoicePill
              label={GROUND_APPEARANCE_COPY.pattern}
              value={pattern?.id ?? null}
              options={patterns.map(each => each.id)}
              labels={Object.fromEntries(patterns.map(each => [each.id, each.name]))}
              onChange={pickPattern}
            />
          </div>
        </>
      )}
      {pattern !== null && (
        <>
          <div data-menu-header className={CONTROLS_CLASSES.menuHeader}>{GROUND_APPEARANCE_COPY.color}</div>
          <div className={CONTROLS_CLASSES.menuRow}>
            <ColorSwatches
              label={GROUND_APPEARANCE_COPY.color}
              colors={pattern.colors}
              value={pattern.colors[colorIndex].id}
              onPick={id => onPick(packAppearance(patterns.indexOf(pattern), pattern.colors.findIndex(each => each.id === id)))}
            />
          </div>
        </>
      )}
    </>
  )
}
