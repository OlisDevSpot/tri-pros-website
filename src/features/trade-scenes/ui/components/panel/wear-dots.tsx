'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { HOME_MATERIALS_COPY, WEAR_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { WEAR_TONES } from '@/features/trade-scenes/constants/wear-tones'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'
import { wears } from '@/shared/modules/construction/core/constants/enums'
import { ageBandOf } from '@/shared/modules/construction/core/lib/age-band-of'
import { bandsOf } from '@/shared/modules/construction/core/lib/resolve-home-materials'

const ARROW_STEPS: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 }

interface WearDotsProps {
  material: ResolvedHomeMaterial
  // The material's name, which every dot's label starts with.
  label: string
}

// The radios are transparent 40 px targets over the drawn dots, as the scale field's stops are, so arrow keys and the focus
// ring come from Radix while the dots stay plain elements.
export function WearDots({ material, label }: WearDotsProps) {
  const property = useSceneInputs((state: TradeSceneInputs) => state.property)
  const applyChange = useApplySceneChange()
  const bands = bandsOf(material.id, property)

  return (
    <RadioGroup
      orientation="horizontal"
      aria-label={label}
      value={material.wear ?? ''}
      disabled={material.absent}
      // Radix would check the radio an arrow lands on by clicking it, but its keydown listener runs after the focus has moved
      // and sees no arrow, so the group records the step itself, from the radio the arrow leaves.
      onKeyDownCapture={(event) => {
        const step = ARROW_STEPS[event.key]
        const from = wears.findIndex(wear => wear === (event.target as HTMLElement).dataset.wear)
        if (step !== undefined && from >= 0) {
          applyChange({ kind: 'wear', id: material.id, wear: wears[(from + step + wears.length) % wears.length] })
        }
      }}
      className={cn('mb-2.5 grid w-full min-w-50 grid-cols-5 gap-0 @min-[309px]:mb-0 @min-[309px]:w-50', material.absent && 'opacity-40')}
    >
      {wears.map((wear) => {
        const [from, to] = ageBandOf(bands, wear)
        const years = to === null ? HOME_MATERIALS_COPY.yearsFrom(String(from)) : HOME_MATERIALS_COPY.years(String(from), String(to))
        const picked = material.wear === wear
        const guessed = picked && material.wearBasis !== 'recorded'
        return (
          <span key={wear} className="relative size-10 justify-self-center">
            <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className={cn('relative size-5 rounded-full', toneClasses(WEAR_TONES[wear]).dot)}>
                {!picked && <span className="absolute inset-0.5 rounded-full bg-(--card)" />}
                {picked && <span className={cn('absolute -inset-1 rounded-full border-2 border-foreground', guessed && 'border-dashed')} />}
              </span>
            </span>
            <RadioGroupItem
              value={wear}
              aria-label={HOME_MATERIALS_COPY.dotLabel(label, WEAR_LABELS[wear], years)}
              // A radio that is already on does not report a change, and the era's guess is on without being recorded.
              onClick={() => applyChange({ kind: 'wear', id: material.id, wear })}
              data-wear={wear}
              className="absolute inset-0 size-10 cursor-pointer rounded-full border-0 bg-transparent shadow-none hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent focus-visible:ring-(--presentation-accent)/50 *:data-[slot=radio-group-indicator]:hidden"
            />
          </span>
        )
      })}
    </RadioGroup>
  )
}
