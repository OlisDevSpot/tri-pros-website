import type { FormPartId } from '@/features/proposal-flow/constants/form-parts'
import { ChevronRightIcon } from 'lucide-react'
import { FORM_PARTS } from '@/features/proposal-flow/constants/form-parts'
import { PartDot } from './part-dot'

interface Props {
  proposalId: string
  onSelect: (part: FormPartId) => void
}

export function PartList({ onSelect }: Props) {
  return (
    <nav aria-label="Proposal parts" className="surface rounded-xl border md:hidden">
      <div className="flex flex-col divide-y">
        {FORM_PARTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="grid min-h-13 grid-cols-[16px_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-row-hover"
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{label}</span>
            </span>
            <PartDot dirty={false} error={false} />
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </nav>
  )
}
