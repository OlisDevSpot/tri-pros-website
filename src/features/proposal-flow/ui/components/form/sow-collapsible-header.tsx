import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ChevronDownIcon, TrashIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

interface Props {
  isOpen: boolean
  onDelete: (e: React.MouseEvent) => void
  onTitleChange: (title: string) => void
  pricingMode: 'total' | 'breakdown'
  sow: ProposalFormSchema['project']['data']['sow'][0]
}

export function SOWCollapsibleHeader({
  isOpen,
  onDelete,
  onTitleChange,
  pricingMode,
  sow,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasTitle = sow.title.trim().length > 0
  const hasTrade = sow.trade.label.trim().length > 0
  const scopeCount = sow.scopes.length
  const showPrice = pricingMode === 'breakdown' && sow.price != null && sow.price > 0
  const hasBadges = hasTrade || scopeCount > 0 || showPrice

  function handleTitleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setIsEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function handleTitleBlur() {
    setIsEditing(false)
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      setIsEditing(false)
    }
  }

  return (
    <div className="flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-muted/50 lg:px-4 lg:py-3">
      <div className="flex items-center justify-between gap-3">
        {isEditing
          ? (
              <Input
                ref={inputRef}
                value={sow.title}
                placeholder="Section title..."
                className="h-7 min-w-0 flex-1 text-sm font-medium lg:text-base"
                onClick={e => e.stopPropagation()}
                onBlur={handleTitleBlur}
                onChange={e => onTitleChange(e.target.value)}
                onKeyDown={handleTitleKeyDown}
              />
            )
          : (
              <span
                role="button"
                tabIndex={0}
                className={cn(
                  'min-w-0 truncate rounded px-1 py-0.5 text-sm font-medium transition-colors hover:bg-muted lg:text-base',
                  !hasTitle && 'text-muted-foreground italic',
                )}
                onClick={handleTitleClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    handleTitleClick(e as unknown as React.MouseEvent)
                }}
              >
                {hasTitle ? sow.title : 'Click to add title...'}
              </span>
            )}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <TrashIcon className="size-4" />
          </Button>
          <ChevronDownIcon
            className={cn(
              'size-5 text-muted-foreground transition-transform duration-200',
              !isOpen && '-rotate-90',
            )}
          />
        </div>
      </div>
      {hasBadges && (
        <div className="flex items-center gap-2">
          {hasTrade && (
            <Badge variant="secondary" className="bg-primary/10 text-xs text-primary">
              {sow.trade.label}
            </Badge>
          )}
          {scopeCount > 0 && (
            <Badge variant="secondary" className="bg-muted text-xs text-muted-foreground">
              {scopeCount}
              {' '}
              {scopeCount === 1 ? 'scope' : 'scopes'}
            </Badge>
          )}
          {showPrice && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              $
              {sow.price!.toLocaleString()}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
