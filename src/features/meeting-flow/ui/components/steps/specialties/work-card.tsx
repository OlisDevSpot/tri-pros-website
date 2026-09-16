'use client'

import type { ShowcaseMedia } from '@/features/meeting-flow/types'
import { CheckIcon, PlusIcon } from 'lucide-react'
import Image from 'next/image'
import { memo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { Decor } from '@/shared/components/decor/decor'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface WorkCardProps {
  scopeId: string
  name: string
  media: ShowcaseMedia | null
}

/**
 * One kind of work. Pressed state is Radix `data-state` and pure CSS, so this component never re-renders
 * on a toggle. Selected = primary outline + check badge + "On your project"; never color alone, no shadow on
 * the clipping element. No pricing unit, no caption.
 */
function WorkCardImpl({ scopeId, name, media }: WorkCardProps) {
  return (
    <ToggleGroupItem
      className="group relative h-auto w-full flex-none flex-col items-stretch justify-start gap-0 overflow-hidden rounded-md border border-border bg-card p-0 text-left whitespace-normal transition-[border-color,outline-color] duration-200 first:rounded-md last:rounded-md hover:bg-card hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-card data-[state=on]:outline-2 data-[state=on]:outline-solid data-[state=on]:-outline-offset-2 data-[state=on]:outline-primary"
      data-scope-id={scopeId}
      value={scopeId}
    >
      <span className="relative isolate block aspect-[4/3] w-full overflow-hidden bg-muted">
        {media?.kind === 'project' && <OptimizedImage alt="" fill file={media.file} sizes="(min-width: 1024px) 20vw, 50vw" />}
        {media?.kind === 'curated' && <Image alt="" className="object-cover" fill sizes="(min-width: 1024px) 20vw, 50vw" src={media.photo.src} />}
        {!media && <Decor className="z-0 [--decor-gradient-alpha:0.2] [--decor-stroke:#03afed]" rings={6} shape="arc" />}
        <span aria-hidden className="absolute top-2 right-2 z-10 grid size-7 scale-60 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 transition-[opacity,scale] duration-200 group-data-[state=on]:scale-100 group-data-[state=on]:opacity-100">
          <CheckIcon className="size-4" />
        </span>
      </span>
      <span className="flex flex-col gap-1.5 p-3">
        <span className="text-base leading-snug font-semibold">{name}</span>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground group-data-[state=on]:text-foreground">
          <PlusIcon aria-hidden className="size-3.5 group-data-[state=on]:hidden" />
          <CheckIcon aria-hidden className="hidden size-3.5 text-primary group-data-[state=on]:block" />
          <span className="group-data-[state=on]:hidden">{SPECIALTIES_COPY.work.add}</span>
          <span className="hidden group-data-[state=on]:inline">{SPECIALTIES_COPY.work.onYourProject}</span>
        </span>
      </span>
    </ToggleGroupItem>
  )
}

export const WorkCard = memo(WorkCardImpl)
