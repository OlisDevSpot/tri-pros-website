import { PlusIcon } from 'lucide-react'
import { SOW_ADD_BUTTON } from '@/features/proposal-flow/constants/sow-add-button'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  onAddSection: () => void
  onAddNotes: () => void
  showNotes: boolean
  disabled?: boolean
  className?: string
}

export function SowAddRow({ onAddSection, onAddNotes, showNotes, disabled, className }: Props) {
  return (
    <div className={cn('grid flex-none grid-cols-[1fr_auto] gap-2', className)}>
      <Button type="button" variant="ghost" className={cn(SOW_ADD_BUTTON, !showNotes && 'col-span-2')} disabled={disabled} onClick={onAddSection}>
        <PlusIcon />
        Add section
      </Button>
      {showNotes && (
        <Button type="button" variant="ghost" className={SOW_ADD_BUTTON} disabled={disabled} onClick={onAddNotes}>
          <PlusIcon />
          Agreement notes
        </Button>
      )}
    </div>
  )
}
