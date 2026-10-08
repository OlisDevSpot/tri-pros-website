'use client'

import type { ReactNode } from 'react'

import { createContext, use, useMemo } from 'react'

import { useProposalActionConfigs } from '@/shared/modules/proposals/core/hooks/use-proposal-action-configs'

interface ProposalActionsHostValue {
  actions: ReturnType<typeof useProposalActionConfigs>['actions']
}

const ProposalActionsHostContext = createContext<ProposalActionsHostValue | null>(null)

interface ProposalActionsHostProps {
  /** View-level handlers. Each takes the entity, so one `actions` array serves every card below the host. */
  overrides?: Parameters<typeof useProposalActionConfigs>[0]
  children: ReactNode
}

export function ProposalActionsHost({ overrides, children }: ProposalActionsHostProps) {
  const { actions, DeleteConfirmDialog } = useProposalActionConfigs(overrides)
  // `actions` keeps its identity while its loading flags do, so the cards below only re-render for those.
  const value = useMemo<ProposalActionsHostValue>(() => ({ actions }), [actions])

  return (
    <ProposalActionsHostContext value={value}>
      <DeleteConfirmDialog />
      {children}
    </ProposalActionsHostContext>
  )
}

export function useProposalActionsHost(consumer: string): ProposalActionsHostValue {
  const value = use(ProposalActionsHostContext)
  if (!value) {
    throw new Error(`${consumer} needs a <ProposalActionsHost> above it`)
  }
  return value
}
