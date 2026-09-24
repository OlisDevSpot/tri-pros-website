'use client'

import type { FocusPoint, PresentationDocument, WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { useState } from 'react'
import { CredentialDocuments } from '@/features/meeting-flow/ui/components/steps/who-we-are/credential-documents'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofRail } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-rail'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type CredentialsSectionProps = SlideProps<WhoWeAreContentOf<'credentials'>>

/**
 * Point 1: the license and the certificate of insurance on the desk, then what protects the
 * homeowner. A document opens whole; a License or Insurance tile opens its document at the line
 * the tile cites. One dialog serves both, so only one document is ever open.
 */
export function CredentialsSection({ content, ...slide }: CredentialsSectionProps) {
  const [open, setOpen] = useState<{ document: PresentationDocument, focus: FocusPoint | null } | null>(null)

  return (
    <Slide {...slide}>
      <PointLayout
        media={(
          <CredentialDocuments
            documents={content.documents}
            openLabel={content.openLabel}
            onOpen={document => setOpen({ document, focus: null })}
          />
        )}
      >
        <Reveal order={2}>
          <ProofRail rail={content.rail} onOpen={({ document, focus }) => setOpen({ document: content.documents[document], focus })} />
        </Reveal>
      </PointLayout>
      <DocumentDialog document={open?.document ?? null} focus={open?.focus ?? null} onClose={() => setOpen(null)} />
    </Slide>
  )
}
