'use client'

import type { RefObject } from 'react'
import type { RainRibbonPath } from '@/features/trade-scenes/lib/ribbon-paths'
import type { SceneBurst } from '@/shared/components/scene/types'

import { KIT_FLOW, KIT_FLOW_COLORS } from '@/features/trade-scenes/constants/roof-attic-flows'
import { ribbonWidths } from '@/features/trade-scenes/lib/ribbon-paths'
import { KitPart } from '@/features/trade-scenes/ui/components/assembly-kits/kit-part'
import { LeakDrip } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/leak-drip'
import { RIBBON_SEGMENTS } from '@/shared/components/scene/lib/build-unit-tube'
import { FlowRibbon } from '@/shared/components/scene/ui/flow-ribbon'

interface RainRibbonsProps {
  rain: RainRibbonPath
  burst: SceneBurst
  fade: RefObject<number>
}

const AT_REST = [0, 0, 0] as const

// The storm through the roof: either down through the worn parts, thinning where each soaks some up, to a drip under the
// ceiling; or stopped by a sound roof and run off along it into the gutter.
export function RainRibbons({ rain, burst, fade }: RainRibbonsProps) {
  return (
    <>
      <FlowRibbon
        points={rain.path.points}
        widths={ribbonWidths(rain.path, RIBBON_SEGMENTS + 1)}
        color={KIT_FLOW_COLORS.rain}
        intensity={KIT_FLOW.intensity.main}
        speed={KIT_FLOW.speed}
        running={burst.running}
        fade={fade}
      />
      {rain.drip && (
        // Fades with the kit like its parts; it is not a part, so no tap emphasises it.
        <KitPart partId={null} peelOffset={AT_REST} peel={0} dimmed={false} drop={false} pin={null}>
          <LeakDrip at={rain.drip} burst={burst} />
        </KitPart>
      )}
    </>
  )
}
