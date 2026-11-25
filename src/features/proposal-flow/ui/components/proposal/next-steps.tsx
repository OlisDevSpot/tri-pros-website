'use client'

import Image from 'next/image'

import { FALLBACK_HERO_PHOTO } from '@/features/proposal-flow/constants/proposal-hero'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { getProposalPdfUrl } from '@/features/proposal-flow/lib/get-proposal-pdf-url'
import { firstName } from '@/features/proposal-flow/lib/rep-names'
import { companyInfo, companyPhone } from '@/shared/constants/company'
import { formatPhone, toDialString } from '@/shared/lib/phone'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'

import { ChapterHeader } from './chapter-header'
import { ChapterInner } from './chapter-inner'
import { NextStepsAction } from './next-steps-action'

export function NextSteps() {
  const { proposal, token } = useProposalDocument()
  const images = (proposal.media ?? []).filter(m => m.mimeType.startsWith('image/'))
  const photo = images[1] ?? images[0]
  const pdfToken = proposal.token ?? token
  const pdfUrl = pdfToken ? getProposalPdfUrl(proposal.id, pdfToken) : null

  // `||`, not `??`: an empty phone string must fall through to the company line.
  const ownerRep = proposal.meetingReps[0]
  const contactPhone = ownerRep?.phone || companyPhone
  const contactName = ownerRep?.phone ? firstName(ownerRep.name) : companyInfo.nickname

  return (
    <div className="relative text-on-media">
      <div className="absolute inset-0">
        {photo
          ? <OptimizedImage file={photo} alt="" fill sizes="100vw" />
          : <Image src={FALLBACK_HERO_PHOTO} alt="" fill sizes="100vw" className="object-cover" />}
      </div>
      <div aria-hidden className="absolute inset-0 z-1 bg-scrim/82" />
      <ChapterInner className="relative z-2">
        <ChapterHeader chapter="next-steps" tone="media" title="Here’s what happens next" lede="Four steps from this page to your start date." />
        <NextStepsAction reps={proposal.meetingReps} />
        <div className="flex flex-wrap gap-x-6 gap-y-2.5 text-sm opacity-90">
          {contactPhone && (
            <span>
              {`Questions? Call ${contactName} at `}
              <a href={`tel:${toDialString(contactPhone)}`} className="underline underline-offset-3">{formatPhone(contactPhone)}</a>
            </span>
          )}
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-3">View the PDF version</a>
          )}
        </div>
      </ChapterInner>
    </div>
  )
}
