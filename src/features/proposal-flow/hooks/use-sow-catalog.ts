'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useQuery } from '@tanstack/react-query'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTRPC } from '@/trpc/helpers'

// The trades and the chosen trade's scopes, for a section's header pickers and its Templates dialog. Both read the
// same query keys, so the header and the body share one request.
export function useSowCatalog(index: number) {
  const trpc = useTRPC()
  const form = useFormContext<ProposalFormSchema>()
  const tradeId = useWatch({ control: form.control, name: `project.data.sow.${index}.trade.id` }) || undefined

  const allTrades = useQuery(trpc.constructionRouter.trades.getAll.queryOptions())
  const scopesOfTrade = useQuery(trpc.constructionRouter.scopes.byTrade.queryOptions(
    { tradeId: tradeId ?? '' },
    { enabled: !!tradeId },
  ))

  return { tradeId, allTrades, scopesOfTrade }
}
