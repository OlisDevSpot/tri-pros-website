'use client'

import type { ComponentProps } from 'react'

import { Command as CommandPrimitive, useCommandState } from 'cmdk'
import { SearchIcon } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { LoadingHairline } from '@/shared/components/loading-hairline'

type Props = ComponentProps<typeof CommandPrimitive.Input> & {
  busy: boolean
  /** Names the mode the palette is in, e.g. picking a customer for a meeting. */
  chip?: string
}

export function OmniInputRow({ busy, chip, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null)
  // Subscribing re-renders this row on every highlight move, so the effect below runs for each one.
  useCommandState(state => state.value)
  // cmdk recomputes aria-activedescendant only on its own selection moves. When the dialog sets the value, or the
  // rows remount, it points at nothing, so a screen reader would announce no option; the selected row is the truth.
  useLayoutEffect(() => {
    const element = input.current
    const id = element?.closest('[cmdk-root]')?.querySelector('[cmdk-item][data-selected="true"]')?.id
    if (id) {
      element?.setAttribute('aria-activedescendant', id)
    }
    else {
      element?.removeAttribute('aria-activedescendant')
    }
  })

  return (
    <div className="relative flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
      {busy
        ? <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary/25 border-t-primary [animation-duration:700ms] motion-reduce:[animation-duration:2s]" />
        : <SearchIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
      {chip && <span className="shrink-0 rounded-md bg-control-selected px-2 py-0.5 text-xs font-semibold text-foreground">{chip}</span>}
      {/* 16px on phones so iOS doesn't zoom the page on focus. */}
      <CommandPrimitive.Input className="h-full min-w-0 flex-1 bg-transparent text-base outline-hidden placeholder:text-muted-foreground sm:text-sm" {...props} ref={input} />
      <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground pointer-coarse:hidden">{OMNI_COPY.escKey}</kbd>
      <LoadingHairline isLoading={busy} />
    </div>
  )
}
