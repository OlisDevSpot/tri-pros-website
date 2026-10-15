'use client'

import { PanelRightIcon } from 'lucide-react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { AgentViewBadge } from '@/features/proposal-flow/ui/components/navbar/agent-view-badge'
import { ProposalNavbarMenu } from '@/features/proposal-flow/ui/components/navbar/navbar-menu'
import { Button } from '@/shared/components/ui/button'
import { ProposalTopBarFrame } from './top-bar-frame'

interface Props {
  onOpenCockpit?: () => void
}

export function ProposalTopBar({ onOpenCockpit }: Props) {
  const { proposal, isAgent } = useProposalDocument()
  const title = [proposal.label, proposal.customer?.name].filter(Boolean).join(' · ')

  return (
    <ProposalTopBarFrame>
      <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
      <div className="ml-auto flex items-center gap-2">
        <AgentViewBadge />
        {isAgent && onOpenCockpit && (
          <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={onOpenCockpit}>
            <PanelRightIcon className="size-4" />
            Cockpit
          </Button>
        )}
        <ProposalNavbarMenu />
      </div>
    </ProposalTopBarFrame>
  )
}
