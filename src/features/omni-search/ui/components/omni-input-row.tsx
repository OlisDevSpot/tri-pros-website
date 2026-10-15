'use client'

import type { ComponentProps } from 'react'

import { Command as CommandPrimitive } from 'cmdk'
import { SearchIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { LoadingHairline } from '@/shared/components/loading-hairline'

type Props = ComponentProps<typeof CommandPrimitive.Input> & {
  busy: boolean
  /** Names the mode the palette is in, e.g. picking a customer for a meeting. */
  chip?: string
}

export function OmniInputRow({ busy, chip, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null)
  // cmdk recomputes aria-activedescendant only on its own selection moves. When the dialog sets the value, or the
  // rows remount, it points at nothing, so a screen reader would announce no option; the selected row is the truth.
  // Watched in the DOM, not on render: a remounted row marks itself selected only after the commit that mounts it,
  // and with an unchanged highlight nothing renders again to catch that.
  useEffect(() => {
    const element = input.current
    const root = element?.closest('[cmdk-root]')
    if (!element || !root) {
      return
    }
    const sync = () => {
      const id = root.querySelector('[cmdk-item][data-selected="true"]')?.id
      // Writes only on change: the observer watches this attribute too, so an equal write would loop.
      if (id && element.getAttribute('aria-activedescendant') !== id) {
        element.setAttribute('aria-activedescendant', id)
      }
      else if (!id && element.hasAttribute('aria-activedescendant')) {
        element.removeAttribute('aria-activedescendant')
      }
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-selected', 'aria-activedescendant'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
      {busy
        ? <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary/25 border-t-primary [animation-duration:700ms] motion-reduce:[animation-duration:2s]" />
        : <SearchIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
      {chip && <span className="shrink-0 rounded-md bg-control-selected px-2 py-0.5 text-xs font-semibold text-foreground">{chip}</span>}
      {/* 16px on phones so iOS doesn't zoom the page on focus. */}
      <CommandPrimitive.Input className="h-full min-w-0 flex-1 bg-transparent text-base outline-hidden placeholder:text-muted-foreground sm:text-sm" {...props} ref={input} />
      {/* The glass sits a little above the dialog's rung in dark, so the rung's hairline all but vanishes there. */}
      <kbd className="shrink-0 rounded border border-border dark:border-border-strong px-1.5 py-0.5 font-mono text-xs text-muted-foreground pointer-coarse:hidden">{OMNI_COPY.escKey}</kbd>
      <LoadingHairline isLoading={busy} />
    </div>
  )
}
