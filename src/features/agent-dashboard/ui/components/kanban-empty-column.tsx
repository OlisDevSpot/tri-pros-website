'use client'

interface Props {
  label: string
}

export function KanbanEmptyColumn({ label }: Props) {
  return (
    <div className="flex items-center justify-center h-24 border-2 border-dashed border-muted rounded-lg">
      <p className="text-xs text-muted-foreground">
        No
        {' '}
        {label.toLowerCase()}
      </p>
    </div>
  )
}
