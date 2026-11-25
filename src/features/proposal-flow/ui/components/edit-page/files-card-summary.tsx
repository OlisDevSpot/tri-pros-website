'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useQuery } from '@tanstack/react-query'
import { useFormContext } from 'react-hook-form'
import { EditLoadingProvider, useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { summarizeParts } from '@/features/proposal-flow/lib/form-parts'
import { useTRPC } from '@/trpc/helpers'
import { LoadingValue } from './loading-value'

interface Props {
  proposalId: string
}

export function FilesCardSummary({ proposalId }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const trpc = useTRPC()
  const loading = useEditLoading()
  // Same query key as the rail and the media manager. Form values are read once, not watched: the file
  // count does not depend on them, and watching would re-render this on every keystroke.
  const { data: media, isPending } = useQuery(trpc.proposalsRouter.media.list.queryOptions({ proposalId }))

  // The count has its own read: until it lands the line keeps its bar instead of collapsing to nothing.
  return (
    <EditLoadingProvider loading={loading || isPending}>
      <LoadingValue width={44}>{summarizeParts(form.getValues(), media?.length).files.list}</LoadingValue>
    </EditLoadingProvider>
  )
}
