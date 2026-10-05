'use client'

import type { ComponentProps } from 'react'

import type { ChartTooltipPin } from '@/shared/lib/create-chart-tooltip-pin'

import { useSyncExternalStore } from 'react'

import { ChartTooltip } from '@/shared/components/ui/chart'

interface Props extends Omit<ComponentProps<typeof ChartTooltip>, 'active'> {
  pin: ChartTooltipPin
}

// Subscribes to the pin itself so a tap or release re-renders only this tooltip, never the chart around it.
export function PinnedChartTooltip({ pin, ...props }: Props) {
  const active = useSyncExternalStore(pin.subscribe, pin.getActive, pin.getActive)
  return <ChartTooltip {...props} active={active} />
}
