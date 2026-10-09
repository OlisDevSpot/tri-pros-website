'use client'

import type { ReactNode } from 'react'

import { createContext, use, useMemo } from 'react'

import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'

interface CustomerActionsHostValue {
  actions: ReturnType<typeof useCustomerActionConfigs>['actions']
}

const CustomerActionsHostContext = createContext<CustomerActionsHostValue | null>(null)

interface CustomerActionsHostProps {
  /** View-level handlers. Each takes the entity, so one `actions` array serves every card below the host. */
  overrides?: Parameters<typeof useCustomerActionConfigs>[0]
  children: ReactNode
}

export function CustomerActionsHost({ overrides, children }: CustomerActionsHostProps) {
  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs(overrides)
  // `actions` keeps its identity while its loading flag does, so the cards below only re-render for that.
  const value = useMemo<CustomerActionsHostValue>(() => ({ actions }), [actions])

  return (
    <CustomerActionsHostContext value={value}>
      <DeleteConfirmDialog />
      {children}
    </CustomerActionsHostContext>
  )
}

export function useCustomerActionsHost(consumer: string): CustomerActionsHostValue {
  const value = use(CustomerActionsHostContext)
  if (!value) {
    throw new Error(`${consumer} needs a <CustomerActionsHost> above it`)
  }
  return value
}
