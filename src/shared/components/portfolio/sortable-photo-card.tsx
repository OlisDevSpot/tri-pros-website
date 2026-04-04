'use client'

import type { MediaFile } from '@/shared/db/schema'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation } from '@tanstack/react-query'
import { ArrowRightIcon, FileTextIcon, GripVertical, MoreVertical, Star, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { mediaPhases } from '@/shared/constants/enums/media'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'
import { PhotoDetailDialog } from './photo-detail-dialog'

interface Props {
  file: MediaFile
  onDelete: (id: number) => void
  onToggleHero: (id: number, currentIsHero: boolean) => void
  onMovePhase: (id: number, phase: string) => void
  onNameUpdated: () => void
  isDeletePending: boolean
  isHeroPending: boolean
  isSelected: boolean
  onSelectToggle: (id: number) => void
  selectionActive: boolean
  isGroupDragged: boolean
}

export function SortablePhotoCard({
  file,
  onDelete,
  onToggleHero,
  onMovePhase,
  onNameUpdated,
  isDeletePending,
  isHeroPending,
  isSelected,
  onSelectToggle,
  selectionActive,
  isGroupDragged,
}: Props) {
  const trpc = useTRPC()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id })

  const [name, setName] = useState(file.name)
  const [detailOpen, setDetailOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setName(file.name)
  }, [file.name])

  const renameMutation = useMutation(
    trpc.projectsRouter.renameMediaFile.mutationOptions({
      onSuccess: () => onNameUpdated(),
      onError: () => toast.error('Failed to rename file'),
    }),
  )

  const handleNameChange = useCallback((value: string) => {
    setName(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      if (value.trim() && value !== file.name) {
        renameMutation.mutate({ id: file.id, name: value.trim() })
      }
    }, 800)
  }, [file.id, file.name, renameMutation])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isGroupDragged ? 0.4 : 1,
  }

  const otherPhases = mediaPhases.filter(p => p !== file.phase)

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group relative overflow-hidden rounded-lg',
          isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        )}
      >
        {/* Image */}
        <div className="relative aspect-5/4">
          <Image
            src={file.url}
            alt={file.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
          <div className={cn('absolute inset-0 transition-colors group-hover:bg-background/40', (menuOpen || isSelected) && 'bg-background/40')} />

          {/* Top-left: checkbox + drag handle */}
          <div className="absolute left-1 top-1 flex items-center gap-1">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded bg-background/60 transition-opacity',
                selectionActive || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelectToggle(file.id)}
                className="border-foreground/70 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            </div>
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded bg-background/60">
                <GripVertical className="h-3.5 w-3.5 text-foreground" />
              </div>
            </div>
          </div>

          {/* Top-right: hero + more menu */}
          <div className="absolute right-1 top-1 flex items-center gap-1">
            {file.isHeroImage && (
              <Badge className="bg-yellow-500/90 text-yellow-950 text-[10px] py-0 px-1.5">
                Hero
              </Badge>
            )}

            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={
                file.isHeroImage
                  ? 'h-6 w-6 bg-yellow-500 hover:bg-yellow-600 text-yellow-950'
                  : cn('h-6 w-6 bg-primary hover:bg-primary/80 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100', menuOpen && 'opacity-100')
              }
              onClick={() => onToggleHero(file.id, file.isHeroImage)}
              disabled={isHeroPending}
            >
              <Star className={file.isHeroImage ? 'h-3 w-3 fill-current' : 'h-3 w-3'} />
            </Button>

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
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRightIcon className="mr-2 h-3.5 w-3.5" />
                    Move to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {otherPhases.map(phase => (
                      <DropdownMenuItem
                        key={phase}
                        className="capitalize"
                        onClick={() => onMovePhase(file.id, phase)}
                      >
                        {phase}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(file.id)}
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

      <PhotoDetailDialog file={file} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  )
}
