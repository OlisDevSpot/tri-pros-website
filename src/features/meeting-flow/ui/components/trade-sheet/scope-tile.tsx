'use client'

import type { TradePhoto } from '@/features/meeting-flow/types'
import { CheckIcon } from 'lucide-react'
import Image from 'next/image'
import { memo } from 'react'
import { Button } from '@/shared/components/ui/button'
import { ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

interface ScopeTileBaseProps {
  id: string
  name: string
  unit: string
  photo?: TradePhoto
  /** Highlight for the scope the sheet was opened on. Outline, never ring, inside the scroller. */
  focused?: boolean
}

interface ScopeTileToggleProps extends ScopeTileBaseProps {
  mode: 'toggle'
}

interface ScopeTileOpenProps extends ScopeTileBaseProps {
  mode: 'open'
  pressed: boolean
  onOpen: (scopeId: string) => void
}

type ScopeTileProps = ScopeTileToggleProps | ScopeTileOpenProps

function ScopeTileImpl(props: ScopeTileProps) {
  const { id, name, unit, photo, focused = false } = props
  const className = cn(
    'group h-auto min-h-11 w-full flex-col items-stretch justify-start gap-2 rounded-lg border border-input bg-card p-2 text-left whitespace-normal',
    'first:rounded-lg last:rounded-lg',
    'data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-foreground',
    'aria-pressed:border-primary aria-pressed:bg-primary/5',
    focused && 'outline-2 outline-primary -outline-offset-2',
  )

  const content = (
    <>
      <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
        {photo
          ? <Image alt={photo.alt} className="object-cover" fill sizes="(min-width: 640px) 12rem, 45vw" src={photo.src} />
          : (
              <span className="absolute inset-0 grid place-items-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {unit}
              </span>
            )}
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full border bg-background/90 text-primary opacity-0 transition-opacity group-aria-pressed:opacity-100 group-data-[state=on]:opacity-100"
        >
          <CheckIcon className="size-3" strokeWidth={3} />
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base leading-tight font-medium">{name}</span>
        {photo && <span className="text-sm text-muted-foreground">{unit}</span>}
      </span>
    </>
  )

  if (props.mode === 'toggle') {
    return (
      <ToggleGroupItem className={className} data-scope-id={id} value={id}>
        {content}
      </ToggleGroupItem>
    )
  }

  return (
    <Button aria-pressed={props.pressed} className={className} data-scope-id={id} variant="outline" onClick={() => props.onOpen(id)}>
      {content}
    </Button>
  )
}

export const ScopeTile = memo(ScopeTileImpl)
