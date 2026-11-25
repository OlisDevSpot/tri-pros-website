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

export function PartStrip({ proposalId, active, onSelect }: Props) {
  const state = useFormPartState(proposalId)

  return (
    <nav
      aria-label="Proposal parts"
      className="hidden shrink-0 grid-cols-4 gap-0.5 rounded-lg border border-control-border bg-tab-track p-0.5 md:grid lg:hidden"
    >
      {FORM_PARTS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-current={id === active ? 'page' : undefined}
          onClick={() => onSelect(id)}
          className={cn(
            'flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
            id === active ? 'bg-tab-active text-foreground shadow-xs' : 'text-muted-foreground hover:bg-hover hover:text-foreground',
          )}
        >
          <span className="truncate">{label}</span>
          <PartDot dirty={state[id].dirty} error={state[id].error} />
        </button>
      ))}
    </nav>
  )
}
