import type { FormPartId } from '@/features/proposal-flow/constants/form-parts'
import { FORM_PARTS } from '@/features/proposal-flow/constants/form-parts'
import { useFormPartState } from '@/features/proposal-flow/hooks/use-form-part-state'
import { cn } from '@/shared/lib/utils'
import { PartDot } from './part-dot'

interface Props {
  proposalId: string
  active: FormPartId
  onSelect: (part: FormPartId) => void
}

export function PartRail({ proposalId, active, onSelect }: Props) {
  const state = useFormPartState(proposalId)

  return (
    <nav aria-label="Proposal parts" className="surface hidden rounded-xl border p-1 lg:block lg:self-start">
      <div className="flex flex-col gap-0.5">
        {FORM_PARTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={id === active ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={cn(
              'grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg px-2.5 py-2 text-left transition-colors',
              id === active ? 'bg-row-selected' : 'hover:bg-row-hover',
            )}
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{label}</span>
              <span className="truncate text-xs text-muted-foreground">{state[id].summary}</span>
            </span>
            <PartDot dirty={state[id].dirty} error={state[id].error} />
          </button>
        ))}
      </div>
    </nav>
  )
}
