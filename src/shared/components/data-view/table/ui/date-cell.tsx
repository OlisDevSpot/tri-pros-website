import { formatDateCell } from '@/shared/lib/formatters'

interface Props {
  dateString: string | null
  emptyText?: string
}

export function DateCell({ dateString, emptyText = '—' }: Props) {
  if (!dateString) {
    return <span className="text-sm text-muted-foreground">{emptyText}</span>
  }

  const { relative, dayAtTime } = formatDateCell(dateString)

  return (
    <div className="flex flex-col max-w-40">
      <span className="text-sm font-medium leading-tight">{relative}</span>
      <span className="text-xs text-muted-foreground">{dayAtTime}</span>
    </div>
  )
}
