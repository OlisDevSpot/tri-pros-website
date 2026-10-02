'use client'

import type { NewSheetChoice, ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { NEW_SHEET_ITEMS } from '@/shared/entities/customers/constants/profile-modal'

interface Props {
  commands: ProfileCommands
  onPick: (choice: NewSheetChoice) => void
}

export function CustomerProfileNewMenu({ commands, onPick }: Props) {
  const allowed: Record<NewSheetChoice, boolean> = {
    proposal: commands.canAddProposal,
    meeting: commands.canAddMeeting,
    note: true,
  }

  return (
    <ul className="flex flex-col gap-2">
      {NEW_SHEET_ITEMS.filter(item => allowed[item.id]).map(({ description, icon: Icon, id, label }) => (
        <li key={id}>
          <button
            className="flex min-h-15 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-left transition-colors hover:bg-muted motion-reduce:transition-none"
            onClick={() => onPick(id)}
            type="button"
          >
            <Icon className="size-5 shrink-0 text-primary" />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{label}</span>
              {description && <span className="text-xs text-muted-foreground">{description}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
