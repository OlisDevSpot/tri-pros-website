import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { ChevronDownIcon, CopyIcon, MoreHorizontalIcon, TrashIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { sectionPriceDisplay } from '@/features/proposal-flow/lib/section-price'
import { LoadingValue } from '@/features/proposal-flow/ui/components/edit-page/loading-value'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'
import { SectionPrice } from './section-price'

interface Props {
  disabled?: boolean
  isOpen: boolean
  onDelete: (e: React.MouseEvent) => void
  onDuplicate: (e: React.MouseEvent) => void
  onTitleChange: (title: string) => void
  priceDisplayMode: PriceDisplayMode
  sow: ProposalFormSchema['project']['data']['sow'][0]
}

export function SOWCollapsibleHeader({
  disabled = false,
  isOpen,
  onDelete,
  onDuplicate,
  onTitleChange,
  priceDisplayMode,
  sow,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const loading = useEditLoading()

  const hasTitle = sow.title.trim().length > 0
  const hasTrade = sow.trade.label.trim().length > 0
  const scopeCount = sow.scopes.length
  const price = sectionPriceDisplay(sow.financials, priceDisplayMode)
  const hasBadges = loading || hasTrade || scopeCount > 0
  const priceCellClassName = 'max-md:col-span-2 max-md:col-start-2 max-md:row-start-2 max-md:justify-self-end md:col-start-2 md:row-start-1'

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
    <div className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-row-hover pressed:bg-row-press lg:px-4 lg:py-3">
      {isEditing && !disabled
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
        : disabled
          ? (
              <span className="min-w-0 truncate px-1 py-0.5 text-sm font-medium lg:text-base">
                <LoadingValue width={300}>{sow.title}</LoadingValue>
              </span>
            )
          : (
              <span
                role="button"
                tabIndex={0}
                className={cn(
                  'min-w-0 truncate rounded px-1 py-0.5 text-sm font-medium transition-colors hover:bg-hover lg:text-base',
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
      <LoadingValue width={124} className={cn('text-sm', priceCellClassName)}>
        <SectionPrice {...price} className={priceCellClassName} />
      </LoadingValue>
      <div className="col-start-3 row-start-1 flex shrink-0 items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={e => e.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem disabled={disabled} onClick={onDuplicate}>
              <CopyIcon className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem disabled={disabled} onClick={onDelete} className="text-destructive-text focus:text-destructive-text">
              <TrashIcon className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChevronDownIcon
          className={cn(
            'size-5 text-muted-foreground transition-transform duration-200',
            !isOpen && '-rotate-90',
          )}
        />
      </div>
      {hasBadges && (
        <div className="col-start-1 row-start-2 flex min-w-0 items-center gap-2">
          <LoadingValue width={54} className="text-xs">
            {hasTrade && (
              <Badge variant="secondary" className="text-xs">
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
          </LoadingValue>
        </div>
      )}
    </div>
  )
}
