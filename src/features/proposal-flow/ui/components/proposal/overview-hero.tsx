'use client'

import Image from 'next/image'

import { FALLBACK_HERO_PHOTO } from '@/features/proposal-flow/constants/proposal-hero'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { companyInfo } from '@/shared/constants/company'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'

export function OverviewHero() {
  const { proposal } = useProposalDocument()
  const data = proposal.projectJSON.data
  const firstName = proposal.customer?.name?.trim().split(/\s+/)[0]
  const plan = `here’s the plan for your ${data.label?.trim() || 'home'}.`
  const headline = firstName ? `${firstName}, ${plan}` : `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`
  const photo = (proposal.media ?? []).find(m => m.mimeType.startsWith('image/'))
  const parts = data.sow.length

  return (
    <div className="bg-(--presentation-ground) text-on-media">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-8 @min-[700px]/proposal:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @min-[700px]/proposal:items-center">
        <div className="grid gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">{`Your proposal · ${data.label || companyInfo.name}`}</p>
          <h1 id="project-overview-title" className="text-4xl font-semibold leading-tight text-balance">{headline}</h1>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-media-muted">
            <span>
              <b className="text-on-media">{parts}</b>
              {` ${parts === 1 ? 'part' : 'parts'}`}
            </span>
            {data.timeAllocated && (
              <span>
                <b className="text-on-media">{data.timeAllocated}</b>
                {' on site'}
              </span>
            )}
            <span>
              {'Prepared by '}
              <b className="text-on-media">{companyInfo.name}</b>
            </span>
          </p>
        </div>
        <div className="relative aspect-4/3 overflow-hidden rounded-lg">
          {photo
            ? <OptimizedImage file={photo} alt="" fill sizes="(max-width: 700px) 100vw, 40vw" priority />
            : <Image src={FALLBACK_HERO_PHOTO} alt="" fill sizes="(max-width: 700px) 100vw, 40vw" className="object-cover" priority />}
        </div>
      </div>
    </div>
  )
}
