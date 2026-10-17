'use client'

import Image from 'next/image'

import { FALLBACK_HERO_PHOTO } from '@/features/proposal-flow/constants/proposal-hero'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { firstName } from '@/features/proposal-flow/lib/rep-names'
import { useConstructionCatalog } from '@/shared/modules/construction/core/hooks/use-construction-catalog'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'

import { MeetingRepsCard } from './meeting-reps-card'

export function Hero() {
  const { proposal } = useProposalDocument()
  const catalog = useConstructionCatalog()
  const data = proposal.projectJSON.data
  const label = data.label?.trim()
  const first = proposal.customer?.name ? firstName(proposal.customer.name) : ''
  const plan = `here’s the plan for your ${label ? label.toLowerCase() : 'home'}.`
  const headline = first ? `${first}, ${plan}` : `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`
  const photo = (proposal.media ?? []).find(m => m.mimeType.startsWith('image/'))
  const tradeCover = catalog.tradesById.get(data.sow[0]?.trade.id ?? '')?.coverImageUrl ?? null
  const parts = data.sow.length

  return (
    <div className="relative grid min-h-140 items-end text-on-media @min-[700px]/proposal:min-h-155 @min-[1100px]/proposal:min-h-160">
      <div className="absolute inset-0">
        {photo
          ? <OptimizedImage file={photo} alt="" fill sizes="100vw" priority />
          : <Image src={tradeCover ?? FALLBACK_HERO_PHOTO} alt="" fill sizes="100vw" className="object-cover" priority />}
      </div>
      {/* The veil is darkest under the text and the reps card, light at the top so the photo still reads. */}
      <div aria-hidden className="absolute inset-0 z-1 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--scrim)_25%,transparent)_0%,color-mix(in_oklab,var(--scrim)_10%,transparent)_30%,color-mix(in_oklab,var(--scrim)_78%,transparent)_68%,color-mix(in_oklab,var(--scrim)_92%,transparent)_100%)]" />
      <div className="relative z-2 mx-auto grid w-full max-w-230 grid-cols-[minmax(0,1fr)] gap-4 px-4.5 pb-7 @min-[700px]/proposal:px-10 @min-[700px]/proposal:pb-10">
        <div className="grid gap-4">
          <p className="text-xs leading-snug font-bold tracking-[0.16em] text-(--presentation-accent) uppercase">{`Your proposal · ${label || 'Your home'}`}</p>
          <h1 id="overview-title" className="font-sans text-4xl leading-[1.08] font-medium tracking-[-0.01em] text-balance @min-[700px]/proposal:text-5xl @min-[1100px]/proposal:text-6xl">{headline}</h1>
          <p className="flex flex-wrap gap-x-4.5 gap-y-1.5 text-base text-on-media-muted">
            <span>
              <b className="font-bold text-on-media">{parts}</b>
              {` ${parts === 1 ? 'part' : 'parts'}`}
            </span>
            {data.timeAllocated && (
              <span>
                <b className="font-bold text-on-media">{data.timeAllocated}</b>
                {' on site'}
              </span>
            )}
          </p>
        </div>
        <MeetingRepsCard reps={proposal.meetingReps} />
      </div>
    </div>
  )
}
