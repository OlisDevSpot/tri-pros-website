'use client'

import type { ReactElement, ReactNode } from 'react'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import { CheckIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { Popover, PopoverTrigger } from '@/shared/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { cn } from '@/shared/lib/utils'

interface ValueMenuProps<T extends string> {
  // The chip the menu hangs from.
  trigger: ReactElement
  label: string
  options: readonly { value: T, label: string }[]
  value: T | null
  onPick: (value: T) => void
  // A build's menu marks its pick in primary.
  proposed?: boolean
  // Under the choices: the wear dots, paint wear, the AC size or a blocked reason.
  extra?: ReactNode
  // Where focus goes once a pick closes the menu, the value it held included; else it goes back to the chip.
  afterPick?: () => void
}

// A popover rather than a menu: it holds a radio group and the extra controls, and Radix menus take only items. It
// portals into the stage, so the scene's keys still count it as the stage's, and it flips to stay inside the stage.
export function ValueMenu<T extends string>({ trigger, label, options, value, onPick, proposed = false, extra, afterPick }: ValueMenuProps<T>) {
  const { stageElement } = useSceneVisibleArea()
  const [open, setOpen] = useState(false)
  const labelId = useId()
  // Radix checks the radio an arrow lands on by clicking it; that click picks, as a radio does, but keeps the menu open.
  const arrowKey = useRef(false)
  const closedByPick = useRef(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverPrimitive.Portal container={stageElement}>
        <PopoverPrimitive.Content
          data-value-menu
          side="bottom"
          align="start"
          sideOffset={6}
          collisionBoundary={stageElement}
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            if (afterPick && closedByPick.current) {
              event.preventDefault()
              afterPick()
            }
            closedByPick.current = false
          }}
          className={CONTROLS_CLASSES.menu}
        >
          <div id={labelId} data-menu-header className={CONTROLS_CLASSES.menuHeader}>{label}</div>
          {/* A menu with no choices only says why: a blocked build or an upgrade nothing can take yet. */}
          {options.length > 0 && (
            <RadioGroup
              aria-labelledby={labelId}
              value={value ?? ''}
              onKeyDownCapture={(event) => {
                arrowKey.current = event.key.startsWith('Arrow')
              }}
              onKeyUpCapture={() => {
                arrowKey.current = false
              }}
              className="grid gap-px"
            >
              {options.map((option) => {
                const picked = option.value === value
                return (
                  <div
                    key={option.value}
                    className={cn(CONTROLS_CLASSES.menuItem, picked ? (proposed ? 'text-primary' : 'text-foreground') : 'text-muted-foreground')}
                  >
                    <span aria-hidden className="flex w-4 shrink-0 text-primary">{picked && <CheckIcon className="size-4" />}</span>
                    <span aria-hidden>{option.label}</span>
                    <RadioGroupItem
                      value={option.value}
                      aria-label={option.label}
                      // A radio already on reports no change, so the pick is taken from the click; the current value again
                      // only closes the menu.
                      onClick={() => {
                        if (!picked) {
                          onPick(option.value)
                        }
                        if (!arrowKey.current) {
                          closedByPick.current = true
                          setOpen(false)
                        }
                      }}
                      className={CONTROLS_CLASSES.menuRadio}
                    />
                  </div>
                )
              })}
            </RadioGroup>
          )}
          {extra && options.length > 0 && <div aria-hidden className={CONTROLS_CLASSES.menuSeparator} />}
          {extra}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </Popover>
  )
}
