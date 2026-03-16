'use client'

import type { DragEndEvent } from '@dnd-kit/core'
import type { MediaPhase } from '@/features/portfolio/constants/media-phases'
import type { MediaFile } from '@/shared/db/schema'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { MEDIA_PHASES } from '@/features/portfolio/constants/media-phases'
import { Button } from '@/shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useMediaUpload } from '@/shared/hooks/use-media-upload'
import { useTRPC } from '@/trpc/helpers'
import { SortablePhotoCard } from './sortable-photo-card'

interface Props {
  projectId: string
  mediaFiles: MediaFile[]
  onUpdate: () => void
}

export function SortableMediaManager({ projectId, mediaFiles, onUpdate }: Props) {
  const trpc = useTRPC()
  const { upload, isUploading } = useMediaUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activePhase, setActivePhase] = useState<MediaPhase>('main')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const deleteMutation = useMutation(
    trpc.showroomRouter.deleteMediaFile.mutationOptions({
      onSuccess: () => {
        onUpdate()
        toast.success('File deleted')
      },
      onError: () => toast.error('Failed to delete file'),
    }),
  )

  const reorderMutation = useMutation(
    trpc.showroomRouter.reorderMediaFiles.mutationOptions({
      onSuccess: onUpdate,
      onError: () => toast.error('Failed to reorder'),
    }),
  )

  const toggleHeroMutation = useMutation(
    trpc.showroomRouter.toggleHeroImage.mutationOptions({
      onSuccess: () => {
        onUpdate()
        toast.success('Hero image updated')
      },
      onError: () => toast.error('Failed to update hero image'),
    }),
  )

  const mediaByPhase = (phase: string): MediaFile[] =>
    mediaFiles
      .filter(f => f.phase === phase && !f.mimeType.startsWith('video/'))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  function handleUploadClick(phase: MediaPhase) {
    setActivePhase(phase)
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) {
      return
    }

    for (const file of Array.from(files)) {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
      try {
        await upload({
          file,
          projectId,
          phase: activePhase,
          meta: {
            name: file.name.replace(/\.[^/.]+$/, ''),
            mimeType: file.type,
            fileExtension: ext,
            phase: activePhase,
            projectId,
          },
        })
      }
      catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    onUpdate()
    e.target.value = ''
  }

  function handleDelete(fileId: number) {
    // eslint-disable-next-line no-alert
    if (window.confirm('Delete this file? This cannot be undone.')) {
      deleteMutation.mutate({ id: fileId })
    }
  }

  function handleToggleHero(fileId: number, currentIsHero: boolean) {
    toggleHeroMutation.mutate({ id: fileId, isHeroImage: !currentIsHero })
  }

  function handleDragEnd(event: DragEndEvent, phase: string) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const phaseFiles = mediaByPhase(phase)
    const oldIndex = phaseFiles.findIndex(f => f.id === active.id)
    const newIndex = phaseFiles.findIndex(f => f.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const reordered = arrayMove(phaseFiles, oldIndex, newIndex)
    const updates = reordered.map((f, i) => ({ id: f.id, sortOrder: i }))
    reorderMutation.mutate({ updates })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {mediaFiles.length}
        {' '}
        file(s) attached. Drag to reorder within each phase.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <Tabs defaultValue="main">
        <TabsList>
          {MEDIA_PHASES.map(phase => (
            <TabsTrigger key={phase} value={phase} className="capitalize">
              {phase}
              {' ('}
              {mediaByPhase(phase).length}
              )
            </TabsTrigger>
          ))}
        </TabsList>

        {MEDIA_PHASES.map(phase => (
          <TabsContent key={phase} value={phase} className="space-y-3">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => handleUploadClick(phase)}
              >
                {isUploading
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                Upload
              </Button>
            </div>

            {mediaByPhase(phase).length === 0
              ? (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    No
                    {' '}
                    {phase}
                    {' '}
                    photos yet
                  </div>
                )
              : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={e => handleDragEnd(e, phase)}
                  >
                    <SortableContext
                      items={mediaByPhase(phase).map(f => f.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                        {mediaByPhase(phase).map(file => (
                          <SortablePhotoCard
                            key={file.id}
                            file={file}
                            onDelete={handleDelete}
                            onToggleHero={handleToggleHero}
                            isDeletePending={deleteMutation.isPending}
                            isHeroPending={toggleHeroMutation.isPending}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
