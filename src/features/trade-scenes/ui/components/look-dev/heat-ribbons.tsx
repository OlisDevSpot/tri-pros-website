'use client'

import type { LookDevOptions } from '@/features/trade-scenes/types'

import { FLOW_COLORS, LOOK_DEV_FLOWS, LOOK_DEV_REFLECTED_FLOW } from '@/features/trade-scenes/constants/look-dev-flows'
import { FlowRibbon } from '@/shared/components/scene/ui/flow-ribbon'

export function HeatRibbons({ options }: { options: LookDevOptions }) {
  const flow = LOOK_DEV_FLOWS[options.season]
  return (
    <>
      <FlowRibbon points={flow.points} widths={flow.widths[options.view]} color={FLOW_COLORS[options.season]} style={options.ribbonStyle} />
      {options.season === 'summer' && options.view === 'proposed' && (
        <FlowRibbon points={LOOK_DEV_REFLECTED_FLOW.points} widths={LOOK_DEV_REFLECTED_FLOW.widths} color={FLOW_COLORS.summer} style={options.ribbonStyle} intensity={1.6} />
      )}
    </>
  )
}
