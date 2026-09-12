'use client'

import type { PresentationDocument, WhoWeAreSection } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { DocumentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-card'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { PlaceholderSlot } from '@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot'

interface CredentialsSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'credentials' }>
}

/**
 * Beat 2: the license and the certificate of insurance laid like paper on the desk,
 * with the derived proof strip along the bottom. Zones are fixed so nothing overlaps:
 * heading (top), documents (middle), strip (bottom).
 */
export function CredentialsSection({ index, section }: CredentialsSectionProps) {
  const [openDocument, setOpenDocument] = useState<PresentationDocument | null>(null)
  const headingId = `${section.id}-title`

  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(oklch(1 0 0 / 0.045) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.045) 1px, transparent 1px)',
          backgroundSize: '6cqw 6cqw',
          maskImage: 'radial-gradient(80% 70% at 60% 40%, #000, transparent)',
        }}
      />

      <div className="absolute inset-x-[6cqw] top-[5cqh]">
        <Reveal order={0}>
          <h2
            className="max-w-[14ch] font-sans text-[6cqw] leading-[1.04] font-semibold tracking-tight text-balance lg:max-w-none lg:text-[3.8cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
      </div>

      <div className="absolute inset-x-[6cqw] top-[24cqh] bottom-[30cqh] lg:top-[24cqh] lg:right-[6cqw] lg:bottom-[26cqh] lg:left-auto lg:w-[50cqw]">
        {section.documents.length === 0
          ? <PlaceholderSlot className="inset-0" label="License and certificate of insurance" />
          : section.documents.map((document, position) => (
              <Reveal
                key={document.title}
                className={position === 0
                  ? 'absolute top-[4%] left-0 z-10 aspect-[3/2] w-[62%]'
                  : 'absolute top-[10%] right-0 h-[86%] w-[44%]'}
                order={position + 1}
              >
                <DocumentCard
                  className={position === 0 ? '-rotate-3' : 'rotate-2'}
                  document={document}
                  onOpen={() => setOpenDocument(document)}
                />
              </Reveal>
            ))}
      </div>

      <dl className="absolute inset-x-[6cqw] bottom-[5cqh] flex flex-wrap gap-x-[4cqw] gap-y-[1cqh] border-t border-white/20 pt-[2cqh]">
        {section.proof.map((item, position) => (
          <Reveal key={item.label} className="grid" order={position + 3}>
            <dt className="order-last text-[2cqw] text-white/60 lg:text-[1.2cqw]">{item.label}</dt>
            <dd className="font-sans text-[3.2cqw] font-bold tracking-tight tabular-nums lg:text-[2.4cqw]">
              {item.value}
            </dd>
          </Reveal>
        ))}
      </dl>

      <DocumentDialog document={openDocument} onClose={() => setOpenDocument(null)} />
    </SnapSection>
  )
}
