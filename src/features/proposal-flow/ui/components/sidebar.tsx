'use client'

import { ArrowLeftIcon, HistoryIcon, PlusIcon } from 'lucide-react'

import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useEffect } from 'react'
import { myProposalsStepParser, proposalIdParser } from '@/features/proposal-flow/lib/url-parsers'
import { Logo } from '@/shared/components/logo'
import { Button } from '@/shared/components/ui/button'

export function ProposalSidebar() {
  const [proposalFlowStep, setProposalFlowStep] = useQueryState('step', myProposalsStepParser)
  const [_, setProposalId] = useQueryState('proposalId', proposalIdParser)

  useEffect(() => {
    if (proposalFlowStep === 'past-proposals') {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setProposalFlowStep(proposalFlowStep, { history: 'replace' })
    }
  }, [proposalFlowStep, setProposalFlowStep])

  return (
    <div className="h-full flex lg:flex-col gap-3 items-center shrink-0">
      <Link href="/">
        <div className="group relative w-8 h-8 shrink-0">
          <Logo variant="icon" className="group-hover:opacity-20 transition" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <ArrowLeftIcon size={20} />
          </div>
        </div>
      </Link>
      <Button
        data-active={proposalFlowStep === 'create-proposal'}
        size="icon"
        variant={proposalFlowStep === 'create-proposal' ? 'default' : 'outline'}
        className="data-[active=true]:bg-primary/80 lg:data-[active=true]:h-20"
        onClick={() => {
          setProposalFlowStep('create-proposal')
          setProposalId('')
        }}
      >
        <PlusIcon size={20} />
      </Button>
      <Button
        data-active={proposalFlowStep === 'past-proposals'}
        size="icon"
        variant={proposalFlowStep === 'past-proposals' ? 'default' : 'outline'}
        className="data-[active=true]:bg-primary/80 lg:data-[active=true]:h-20"
        onClick={() => {
          setProposalFlowStep('past-proposals')
          setProposalId('')
        }}
      >
        <HistoryIcon size={20} />
      </Button>
    </div>
  )
}
