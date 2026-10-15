'use client'

import { useMutation } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { customizableSections, generateProposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { ProposalDocumentProvider } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { useViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import { getProposalPdfUrl } from '@/features/proposal-flow/lib/get-proposal-pdf-url'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useAbility } from '@/shared/domains/permissions/client'
import { useTRPC } from '@/trpc/helpers'

import { ChapterNav } from './chapter-nav'
import { PdfFallbackCard } from './pdf-fallback-card'
import { ProposalTopBar } from './top-bar'
import { ProposalTopBarFrame } from './top-bar-frame'

export function Proposal() {
  const params = useParams() as { proposalId: string }
  const searchParams = useSearchParams()
  const proposal = useCurrentProposal()
  const { setRootEl } = useScrollRoot()
  const trpc = useTRPC()
  const recordView = useMutation(trpc.proposalsRouter.views.recordView.mutationOptions())
  const ability = useAbility()
  const viewMode = useViewMode()
  const hasRecorded = useRef(false)
  const [, setCockpitOpen] = useState(false)

  useEffect(() => {
    if (hasRecorded.current || !proposal.data) {
      return
    }
    hasRecorded.current = true

    const token = searchParams.get('token')
    // An agent previewing the page is not a homeowner view, and the server rejects a missing token anyway.
    if (viewMode === 'agent' || !token) {
      return
    }

    const utmSource = searchParams.get('utm_source')
    const source = utmSource === 'email' ? 'email' : utmSource === 'sms' ? 'sms' : 'direct'

    recordView.mutate({
      proposalId: params.proposalId,
      token,
      source,
      referer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.data])

  if (proposal.isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ProposalTopBarFrame />
        <LoadingState title="Loading Proposal" description="This may take a few seconds" />
      </div>
    )
  }

  if (!proposal.data) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ProposalTopBarFrame />
        <ErrorState title="Error: Could not load proposal" description={proposal.error?.message ?? 'Please try again'} />
      </div>
    )
  }

  const proposalData = proposal.data
  const { token, customer } = proposalData
  const urlToken = searchParams.get('token') ?? undefined
  const customerEmail = customer?.email ?? null

  const viewerRole = ability.can('update', 'Proposal') ? 'agent' : 'homeowner'
  const proposalSteps = generateProposalSteps(viewerRole)

  return (
    <ProposalDocumentProvider proposal={proposalData} viewMode={viewMode} token={urlToken}>
      <div className="flex h-full min-h-0 flex-col">
        <ProposalTopBar onOpenCockpit={() => setCockpitOpen(true)} />
        <div ref={setRootEl} id="proposal-container" className="min-h-0 flex-1 overflow-y-auto">
          <div className="@container/proposal">
            <div className="grid @min-[1100px]/proposal:grid-cols-[220px_minmax(0,1fr)]">
              <div className="hidden @min-[1100px]/proposal:block"><ChapterNav variant="rail" /></div>
              <div className="min-w-0">
                <div className="contents @min-[1100px]/proposal:hidden"><ChapterNav variant="tabs" /></div>
                {proposalSteps.map(step => (
                  <section
                    key={step.accessor}
                    id={step.accessor}
                    aria-labelledby={`${step.accessor}-title`}
                    className="scroll-mt-12 @min-[1100px]/proposal:scroll-mt-0"
                  >
                    {customizableSections.includes(step.accessor) && step.accessor === 'agreement' && (
                      <step.Component
                        proposalId={params.proposalId}
                        token={token ?? undefined}
                        isAgent={viewMode === 'agent'}
                        customerAge={customer?.customerAge ?? null}
                        envelopeDocumentIds={proposalData.envelopeDocumentIds ?? null}
                        proposalKind={proposalData.kind}
                        customerName={customer?.name ?? null}
                        customerEmail={customerEmail}
                        proposalStatus={proposalData.status}
                        proposalSentAt={proposalData.sentAt}
                      />
                    )}
                    {!customizableSections.includes(step.accessor) && (
                      <step.Component />
                    )}
                  </section>
                ))}
                {token && (
                  <PdfFallbackCard pdfUrl={getProposalPdfUrl(params.proposalId, token)} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProposalDocumentProvider>
  )
}
