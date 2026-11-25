import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'
import { useFormPart } from '@/features/proposal-flow/hooks/use-form-part'
import { firstErrorPart } from '@/features/proposal-flow/lib/form-parts'
import { InternalFinancialsModal } from '@/features/proposal-flow/ui/components/internal-financials-modal'
import { openModal } from '@/shared/lib/open-modal'

export interface ProposalFormActions {
  saveOnly: () => void
  saveAndPreview: () => void
  openInternalFinancials: () => void
}

interface Options {
  onSubmit: (data: ProposalFormSchema) => void
  onSave?: (data: ProposalFormSchema) => void
}

export function useProposalFormActions({ onSubmit, onSave }: Options): ProposalFormActions {
  const form = useFormContext<ProposalFormSchema>()
  const { setPart } = useFormPart()

  function onInvalid(errors: unknown) {
    // eslint-disable-next-line no-console
    console.log(form.getValues())
    // eslint-disable-next-line no-console
    console.log('INVALID SUBMIT', errors)
    toast.error('Form is invalid (check console)')
    const part = firstErrorPart(errors)
    if (part) {
      setPart(part)
    }
  }

  function saveAndPreview() {
    form.handleSubmit(onSubmit, onInvalid)()
  }

  function saveOnly() {
    form.handleSubmit(onSave ?? onSubmit, onInvalid)()
  }

  function openInternalFinancials() {
    const v = form.getValues()
    openModal({
      accessor: 'InternalFinancials',
      Component: InternalFinancialsModal,
      props: {
        funding: v.funding,
        sow: v.project.data.sow,
        priceDisplayMode: v.priceDisplayMode,
      },
    })
  }

  return { saveOnly, saveAndPreview, openInternalFinancials }
}
