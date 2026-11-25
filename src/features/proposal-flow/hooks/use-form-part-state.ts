import type { FormPartId } from '@/features/proposal-flow/constants/form-parts'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useQuery } from '@tanstack/react-query'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { FORM_PART_IDS } from '@/features/proposal-flow/constants/form-parts'
import { dirtyParts, firstErrorPart, summarizeParts } from '@/features/proposal-flow/lib/form-parts'
import { useTRPC } from '@/trpc/helpers'

interface PartState {
  summary: string
  listSummary: string
  dirty: boolean
  error: boolean
}

export function useFormPartState(proposalId: string): Record<FormPartId, PartState> {
  const form = useFormContext<ProposalFormSchema>()
  const trpc = useTRPC()
  const values = useWatch({ control: form.control }) as ProposalFormSchema
  const { dirtyFields, errors } = useFormState({ control: form.control })
  // Same query key as the media manager, so this is not a second request.
  const { data: media } = useQuery(trpc.proposalsRouter.media.list.queryOptions({ proposalId }))

  const summaries = summarizeParts(values, media?.length)
  const dirty = dirtyParts(dirtyFields)
  const errorPart = firstErrorPart(errors)

  return Object.fromEntries(
    FORM_PART_IDS.map(id => [id, {
      summary: summaries[id].rail,
      listSummary: summaries[id].list,
      dirty: dirty.has(id),
      error: errorPart === id,
    }]),
  ) as Record<FormPartId, PartState>
}
