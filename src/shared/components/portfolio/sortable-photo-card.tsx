'use client'

import type { MediaFile } from '@/shared/db/schema'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Star, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'

interface Props {
  file: MediaFile
  onDelete: (id: number) => void
  onToggleHero: (id: number, currentIsHero: boolean) => void
  isDeletePending: boolean
  isHeroPending: boolean
}

export function SortablePhotoCard({ file, onDelete, onToggleHero, isDeletePending, isHeroPending }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-5/4 overflow-hidden rounded-lg"
    >
      <Image
        src={file.url}
        alt={file.name}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 50vw, 25vw"
      />
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40" />

      {/* Top-left: drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 cursor-grab opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded bg-black/60">
          <GripVertical className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      {/* Top-right: hero + delete */}
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          variant={file.isHeroImage ? 'default' : 'secondary'}
          size="icon"
          className="h-6 w-6"
          onClick={() => onToggleHero(file.id, file.isHeroImage)}
          disabled={isHeroPending}
        >
          <Star className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="h-6 w-6"
          onClick={() => onDelete(file.id)}
          disabled={isDeletePending}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Hero badge */}
      {file.isHeroImage && (
        <Badge className="absolute bottom-7 left-1 bg-yellow-500 text-xs">
          <Star className="mr-0.5 h-3 w-3" />
          Hero
        </Badge>
      )}

      <p className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-2 py-1 text-[10px] text-white">
        {file.name}
      </p>
    </div>
  )
}
