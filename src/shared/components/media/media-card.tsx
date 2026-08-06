'use client'

import type { ReactNode } from 'react'
import type { MediaItem } from './types'
import { FileTextIcon, GripVertical, MoreVertical, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'
import { PhotoDetailDialog } from './photo-detail-dialog'

interface MediaCardProps {
  item: MediaItem
  /** Required — no owner-specific image-optimization or entity types imported here. Owner injects the actual thumbnail. */
  renderThumbnail: (item: MediaItem) => ReactNode
  /** Overlaid top-right controls, owner-specific (project: hero star + phase menu; proposal: visibility switch). Receives the card's internal `menuOpen` so a control can stay visible while the more-menu is open. */
  renderControls?: (item: MediaItem, state: { menuOpen: boolean }) => ReactNode
  /** Large preview for the detail dialog, owner-specific (project: public-bucket image variant with retry UI; proposal: presigned img/video/pdf). Defaults to a plain <img>. */
  renderPreview?: (item: MediaItem) => ReactNode
  /** Extra rows in the detail dialog. */
  renderDetails?: (item: MediaItem) => ReactNode
  /** Owner-specific menu items injected between "View Details" and "Delete" (project: the Move-to-phase submenu). Owner-agnostic ReactNode slot. */
  renderMenuItems?: (item: MediaItem) => ReactNode
  /** Debounced (800ms) name input calls this. */
  onRename: (id: number, name: string) => void
  onDelete: (id: number) => void
  isDeletePending?: boolean
  /** Spread onto the drag handle. Supplied by MediaReorderGrid's per-item useSortable wiring. */
  dragHandleProps?: Record<string, unknown>
  isDragging?: boolean
  isGroupDragged?: boolean
  isSelected?: boolean
  onSelectToggle?: (id: number) => void
  selectionActive?: boolean
}

export function MediaCard({
  item,
  renderThumbnail,
  renderControls,
  renderPreview,
  renderDetails,
  renderMenuItems,
  onRename,
  onDelete,
  isDeletePending = false,
  dragHandleProps,
  isDragging = false,
  isGroupDragged = false,
  isSelected = false,
  onSelectToggle,
  selectionActive = false,
}: MediaCardProps) {
  const [name, setName] = useState(item.name)
  const [detailOpen, setDetailOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setName(item.name)
  }, [item.name])

  const handleNameChange = useCallback((value: string) => {
    setName(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      if (value.trim() && value !== item.name) {
        onRename(item.id, value.trim())
      }
    }, 800)
  }, [item.id, item.name, onRename])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const style = {
    opacity: isDragging ? 0.5 : isGroupDragged ? 0.4 : 1,
  }

  return (
    <>
      <div
        style={style}
        className={cn(
          'group relative overflow-hidden rounded-lg',
          isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        )}
      >
        {/* Thumbnail */}
        <div className="relative aspect-5/4">
          {renderThumbnail(item)}
          <div className={cn('absolute inset-0 transition-colors group-hover:bg-background/40', (menuOpen || isSelected) && 'bg-background/40')} />

          {/* Top-left: checkbox + drag handle */}
          <div className="absolute left-1 top-1 flex items-center gap-1">
            {onSelectToggle && (
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded bg-background/60 transition-opacity',
                  selectionActive || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelectToggle(item.id)}
                  className="border-foreground/70 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>
            )}
            {dragHandleProps && (
              <div
                {...dragHandleProps}
                className="cursor-grab opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-background/60">
                  <GripVertical className="h-3.5 w-3.5 text-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Top-right: owner controls + more menu */}
          <div className="absolute right-1 top-1 flex items-center gap-1">
            {renderControls?.(item, { menuOpen })}

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className={cn('h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100', menuOpen && 'opacity-100')}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDetailOpen(true)}>
                  <FileTextIcon className="mr-2 h-3.5 w-3.5" />
                  View Details
                </DropdownMenuItem>
                {renderMenuItems?.(item)}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(item.id)}
                  disabled={isDeletePending}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Editable name */}
        <div className="bg-background/60 px-2 py-1">
          <input
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            className="h-5 w-full bg-transparent text-[10px] text-foreground outline-none placeholder:text-foreground/50"
            placeholder="File name"
          />
        </div>
      </div>

      <PhotoDetailDialog item={item} open={detailOpen} onOpenChange={setDetailOpen} renderPreview={renderPreview} renderDetails={renderDetails} />
    </>
  )
}
