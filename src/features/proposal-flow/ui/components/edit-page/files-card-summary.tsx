'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useQuery } from '@tanstack/react-query'
import { useFormContext } from 'react-hook-form'
import { summarizeParts } from '@/features/proposal-flow/lib/form-parts'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  proposalId: string
}

export function FilesCardSummary({ proposalId }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const trpc = useTRPC()
  // Same query key as the rail and the media manager. Form values are read once, not watched: the file
  // count does not depend on them, and watching would re-render this on every keystroke.
  const { data: media } = useQuery(trpc.proposalsRouter.media.list.queryOptions({ proposalId }))

  return summarizeParts(form.getValues(), media?.length).files.list
}
