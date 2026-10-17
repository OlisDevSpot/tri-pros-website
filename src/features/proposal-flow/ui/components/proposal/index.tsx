'use client'

import { useMutation } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { proposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { ActiveChapterProvider } from '@/features/proposal-flow/contexts/active-chapter-context'
import { PortfolioMatchProvider } from '@/features/proposal-flow/contexts/portfolio-match-context'
import { ProposalDocumentProvider } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useAbility } from '@/shared/domains/permissions/client'
import { useTRPC } from '@/trpc/helpers'

import { ChapterNav } from './chapter-nav'
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
  const canAct = ability.can('update', 'Proposal')
  const hasRecorded = useRef(false)

  useEffect(() => {
    if (hasRecorded.current || !proposal.data) {
      return
    }
    hasRecorded.current = true

    const token = searchParams.get('token')
    // The server already skips sessions, and rejects a missing token.
    if (!token) {
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

  const urlToken = searchParams.get('token') ?? undefined

  return (
    <ProposalDocumentProvider proposal={proposal.data} token={urlToken} canAct={canAct}>
      <PortfolioMatchProvider>
        <ActiveChapterProvider>
          <div className="@container/proposal flex h-full min-h-0 flex-col">
            <ProposalTopBar />
            <div ref={setRootEl} id="proposal-container" className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-gutter-stable">
              {/* The rail sits on the canvas and the chapters on the document plane, as the mock's `.doc` and `.paper`. */}
              <div className="min-h-full bg-background">
                <div className="grid @min-[1100px]/proposal:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="hidden @min-[1100px]/proposal:block"><ChapterNav variant="rail" /></div>
                  <main className="surface min-w-0">
                    {proposalSteps.map(step => (
                      <section key={step.accessor} id={step.accessor} aria-labelledby={`${step.accessor}-title`} className="relative scroll-mt-0">
                        <step.Component />
                      </section>
                    ))}
                  </main>
                </div>
              </div>
            </div>
          </div>
        </ActiveChapterProvider>
      </PortfolioMatchProvider>
    </ProposalDocumentProvider>
  )
}
