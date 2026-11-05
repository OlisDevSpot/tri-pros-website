'use client'

import type { ComponentProps } from 'react'
import type { Weather } from '@/shared/modules/construction/core/types'

import Image from 'next/image'

import { WEATHER_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SCENE_STILLS } from '@/features/trade-scenes/constants/home-scene-stills'
import { DOCK_BUTTON_CLASS, DOCK_SIZES, DOCK_THUMB_CROP, DOCK_THUMB_SIZE } from '@/features/trade-scenes/constants/scene-dock'
import { Keycap } from '@/features/trade-scenes/ui/components/keycap'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface WeatherTileProps extends Omit<ComponentProps<'button'>, 'children'> {
  weather: Weather
  keyLabel: string
  // The folded opener shows the weather in force under its own name.
  label?: string
}

export function WeatherTile({ weather, keyLabel, label, className, ...props }: WeatherTileProps) {
  return (
    <Button type="button" variant="ghost" size="icon" style={DOCK_SIZES.tile} className={cn(DOCK_BUTTON_CLASS, className)} {...props}>
      {/* The label beside it names the weather, so the picture is decoration. */}
      <span className="relative h-7.5 w-11 overflow-hidden rounded-[6px] ring-[1.5px] ring-control-border group-aria-pressed/dock:ring-2 group-aria-pressed/dock:ring-(--presentation-accent)">
        <Image alt="" src={HOME_SCENE_STILLS[weather]} width={DOCK_THUMB_SIZE.width} height={DOCK_THUMB_SIZE.height} sizes={`${DOCK_THUMB_SIZE.width}px`} className={DOCK_THUMB_CROP} />
      </span>
      {label ?? WEATHER_LABELS[weather]}
      <Keycap keyLabel={keyLabel} />
    </Button>
  )
}
