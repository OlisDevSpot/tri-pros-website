'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { ReactNode } from 'react'
import type { AppRouter } from '@/trpc/routers/app'

import { createContext, use, useMemo } from 'react'

export type ProposalDocument = NonNullable<inferRouterOutputs<AppRouter>['proposalsRouter']['business']['getFullView']>

interface ProposalDocumentValue {
  proposal: ProposalDocument
  token: string | undefined
  canAct: boolean
}

const ProposalDocumentContext = createContext<ProposalDocumentValue | null>(null)

interface ProviderProps {
  proposal: ProposalDocument
  token: string | undefined
  canAct: boolean
  children: ReactNode
}

// The document never reads route params, so another host (a meeting page, the Let's build! tab) can drive it.
export function ProposalDocumentProvider({ proposal, token, canAct, children }: ProviderProps) {
  const value = useMemo<ProposalDocumentValue>(
    () => ({ proposal, token, canAct }),
    [proposal, token, canAct],
  )
  return <ProposalDocumentContext value={value}>{children}</ProposalDocumentContext>
}

export function useProposalDocument(): ProposalDocumentValue {
  const ctx = use(ProposalDocumentContext)
  if (!ctx) {
    throw new Error('useProposalDocument must be used within ProposalDocumentProvider')
  }
  return ctx
}
