'use client'

import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import type { StatusTone } from '@/shared/constants/status-tones'

import { ChevronDownIcon } from 'lucide-react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { Button } from '@/shared/components/ui/button'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

interface ControlsChipProps extends ComponentProps<'button'> {
  // value: a current value; on: a picked build; add: a build still to add; miss: a missing fact.
  variant: 'value' | 'on' | 'add' | 'miss'
  tone?: StatusTone
  icon?: LucideIcon
  // The name ahead of the value, quieter than it.
  keyLabel?: string
  // Says the chip opens a menu.
  caret?: boolean
  // For a chip whose menu is not a popover it triggers; a popover trigger is marked open by Radix.
  open?: boolean
}

// Takes `ref` and every button prop, so a popover trigger can slot onto it.
export function ControlsChip({ variant, tone, icon: Icon, keyLabel, caret = false, open = false, className, children, ...props }: ControlsChipProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-state={open ? 'open' : undefined}
      {...props}
      className={cn(
        CONTROLS_CLASSES.chip,
        variant === 'on' && CONTROLS_CLASSES.chipOn,
        variant === 'add' && CONTROLS_CLASSES.chipAdd,
        variant === 'miss' && CONTROLS_CLASSES.chipMiss,
        CONTROLS_CLASSES.chipOpen,
        className,
      )}
    >
      {tone && <span aria-hidden className={cn('size-1.75 shrink-0 rounded-full', toneClasses(tone).dot)} />}
      {Icon && <Icon aria-hidden className={cn('size-3.25 shrink-0', variant === 'on' && 'text-primary')} />}
      {keyLabel && <span className={variant === 'miss' ? toneClasses('attention').text : 'text-muted-foreground'}>{keyLabel}</span>}
      {children}
      {caret && <ChevronDownIcon aria-hidden className="-mr-0.75 size-3.25 shrink-0 opacity-70" />}
    </Button>
  )
}
