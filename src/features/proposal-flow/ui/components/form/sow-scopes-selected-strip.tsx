import { XIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'

interface Props {
  scopes: { id: string, label: string }[]
  onRemove: (id: string) => void
}

// The option list only checks its rows, which scroll out of sight in a long list; the picks stay pinned in view here.
// Pinned to the list's bottom, not its top: cmdk scrolls its first row into view while the popover is still off
// screen, and a strip above that row makes Chrome scroll the list past it.
export function SowScopesSelectedStrip({ scopes, onRemove }: Props) {
  if (scopes.length === 0) {
    return null
  }
  return (
    <div
      role="group"
      aria-label="Selected scopes"
      // The command list's own fill, so rows slide under it; bg-(--popover), not bg-popover, which is a surface class.
      className="sticky bottom-0 z-10 flex flex-wrap items-center gap-1 border-t bg-(--popover) p-2"
      // cmdk takes Enter for the highlighted option; a focused remove button keeps it.
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation()
        }
      }}
    >
      <span className="mr-1 text-xs text-muted-foreground">Selected</span>
      {scopes.map(scope => (
        <Badge key={scope.id} variant="secondary" asChild>
          <button
            type="button"
            aria-label={`Remove ${scope.label}`}
            className="cursor-pointer hover:bg-secondary-hover pressed:bg-press"
            onClick={() => onRemove(scope.id)}
          >
            {scope.label}
            <XIcon className="text-muted-foreground" />
          </button>
        </Badge>
      ))}
    </div>
  )
}
