'use client'

import type { ComponentProps } from 'react'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import { InputGroup, InputGroupAddon, InputGroupText } from '@/shared/components/ui/input-group'
import { MoneyField } from '@/shared/components/ui/money-field'
import { cn } from '@/shared/lib/utils'

interface UnitMoneyFieldProps extends Omit<ComponentProps<typeof MoneyField>, 'value' | 'suffix' | 'placeholder' | 'className' | 'ref'> {
  value: number | null
  unit: string
  placeholder?: string
  className?: string
  // A fixed 40 px box for a row of small fields: the figure at the row's size, the unit pinned to the right, and the box
  // never resizing as the figure is typed.
  compact?: boolean
}

const FIGURE_TYPE = 'font-sans text-xl md:text-xl tabular-nums'

// The shared money field with its unit as an addon rather than MoneyField's inline suffix, so the unit still shows while
// the field is empty. The box hugs the figure and the unit sits right against it, so "$240/mo" reads as one amount; a
// placeholder is drawn lighter than a typed figure, so a working number never passes for one the homeowner gave.
export function UnitMoneyField({ value, unit, cents = false, placeholder = '$0', className, compact = false, ...rest }: UnitMoneyFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const mirrorRef = useRef<HTMLSpanElement>(null)
  // Written to the DOM rather than held in state, so a keystroke re-renders nothing.
  const syncMirror = useCallback(() => {
    const input = inputRef.current
    const mirror = mirrorRef.current
    if (input === null || mirror === null) {
      return
    }
    mirror.textContent = input.value || placeholder
    mirror.toggleAttribute('data-empty', input.value === '')
  }, [placeholder])

  // A new value from the store is formatted in the same commit, so it can be read before paint.
  useLayoutEffect(syncMirror, [value, syncMirror])

  // The box is sized by the text the field draws, not by the number: "185.00" is stored as 185. NumericFormat keeps that
  // text in its own state, which never re-renders this component, so it is read back once an edit has painted.
  useEffect(() => {
    const input = inputRef.current
    if (input === null) {
      return
    }
    let frame = 0
    const onEdit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncMirror)
    }
    input.addEventListener('input', onEdit)
    input.addEventListener('blur', onEdit)
    return () => {
      cancelAnimationFrame(frame)
      input.removeEventListener('input', onEdit)
      input.removeEventListener('blur', onEdit)
    }
  }, [syncMirror])

  if (compact) {
    return (
      <InputGroup className={cn('h-10 w-29.5 gap-1 rounded-[10px] px-2.5', className)}>
        <MoneyField
          {...rest}
          ref={inputRef}
          value={value}
          cents={cents}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-sm font-bold shadow-none placeholder:font-normal focus-visible:ring-0 md:text-sm dark:bg-transparent"
          data-slot="input-group-control"
        />
        <InputGroupAddon align="inline-end" className="pr-0"><InputGroupText className="text-xs font-bold">{unit}</InputGroupText></InputGroupAddon>
      </InputGroup>
    )
  }

  return (
    <InputGroup className={cn('h-11 w-auto items-baseline', className)}>
      {/* The input and an invisible copy of its text share one cell, so the cell is exactly as wide as what is drawn; the
          input adds no width of its own. It comes first so the row's baseline is its text, which the unit sits on. */}
      <span className="grid">
        <MoneyField
          {...rest}
          ref={inputRef}
          value={value}
          cents={cents}
          placeholder={placeholder}
          className={cn(FIGURE_TYPE, 'col-start-1 row-start-1 h-11 w-0 min-w-full rounded-none border-0 bg-transparent py-0 pr-0.5 pl-3 text-right font-semibold shadow-none placeholder:font-normal focus-visible:ring-0 dark:bg-transparent')}
          data-slot="input-group-control"
        />
        {/* A hair wider than the text, so the caret never pushes the figure out of view. */}
        <span ref={mirrorRef} aria-hidden className={cn(FIGURE_TYPE, 'invisible col-start-1 row-start-1 pr-1 pl-3 font-semibold whitespace-pre data-empty:font-normal')} />
      </span>
      <InputGroupAddon align="inline-end"><InputGroupText className="text-xs font-bold">{unit}</InputGroupText></InputGroupAddon>
    </InputGroup>
  )
}
