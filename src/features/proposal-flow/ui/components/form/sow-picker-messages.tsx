import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useFormState } from 'react-hook-form'
import { sowPickerMessageId } from '@/features/proposal-flow/lib/sow-picker-message-id'

interface Props {
  index: number
  messageBaseId: string
}

// The trade and scopes pickers live in the header, which is the section's toggle, so their messages show here.
// Read, not a second FormField: a second controller on the same name would mark the field unmounted when it leaves.
export function SowPickerMessages({ index, messageBaseId }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const paths = [`project.data.sow.${index}.trade.id`, `project.data.sow.${index}.scopes`] as const
  const formState = useFormState({ control: form.control, name: [...paths] })
  const messages = (['trade', 'scopes'] as const).map((picker, i) => {
    const error = form.getFieldState(paths[i], formState).error
    return { picker, text: error ? String(error.message ?? '') : '' }
  }).filter(m => m.text)

  if (messages.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-1 px-3 pt-2 lg:px-4">
      {messages.map(m => (
        <p key={m.picker} id={sowPickerMessageId(messageBaseId, index, m.picker)} className="text-xs text-destructive-text">
          *
          {' '}
          {m.text}
        </p>
      ))}
    </div>
  )
}
