'use client'

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { MediaFile } from '@/shared/db/schema'
import type { MediaPhase } from '@/shared/types/enums/media'
import {
  AutoScrollActivator,
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightIcon, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { mediaPhases } from '@/shared/constants/enums/media'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useMediaUpload } from '@/shared/hooks/use-media-upload'
import { useGooglePicker } from '@/shared/services/google-drive/hooks/use-google-picker'
import { useTRPC } from '@/trpc/helpers'
import { SortablePhotoCard } from './sortable-photo-card'
import { UploadSourcePopover } from './upload-source-popover'

const AUTO_SCROLL_CONFIG = {
  activator: AutoScrollActivator.Pointer,
  acceleration: 100,
  interval: 5,
  threshold: { x: 0.1, y: 0.25 },
}

interface Props {
  projectId: string
  mediaFiles: MediaFile[]
  onUpdate: () => void
}

export function SortableMediaManager({ projectId, mediaFiles, onUpdate }: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const editQueryOptions = trpc.projectsRouter.crud.getForEdit.queryOptions({ id: projectId })
  const { upload, isUploading } = useMediaUpload()
  const retryOptimization = useMutation(trpc.projectsRouter.media.retryOptimization.mutationOptions({
    onSuccess: () => onUpdate(),
  }))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentAccessTokenRef = useRef<string | null>(null)
  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete file',
    message: 'This cannot be undone.',
  })
  const [BulkDeleteConfirmDialog, confirmBulkDelete] = useConfirm({
    title: 'Delete files',
    message: 'This will permanently delete all selected files.',
  })
  const [activePhase, setActivePhase] = useState<MediaPhase>('uncategorized')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [draggingId, setDraggingId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const deleteMutation = useMutation(
    trpc.projectsRouter.media.delete.mutationOptions({
      onSuccess: () => {
        onUpdate()
        toast.success('File deleted')
      },
      onError: () => toast.error('Failed to delete file'),
    }),
  )

  const bulkDeleteMutation = useMutation(
    trpc.projectsRouter.media.bulkDelete.mutationOptions({
      onSuccess: () => {
        onUpdate()
        setSelectedIds(new Set())
        toast.success('Files deleted')
      },
      onError: () => toast.error('Failed to delete files'),
    }),
  )

  const reorderMutation = useMutation(
    trpc.projectsRouter.media.reorder.mutationOptions({
      onMutate: async ({ updates }) => {
        await queryClient.cancelQueries(editQueryOptions)
        const previous = queryClient.getQueryData(editQueryOptions.queryKey)

        queryClient.setQueryData(editQueryOptions.queryKey, (old: typeof previous) => {
          if (!old) {
            return old
          }
          const orderMap = new Map(updates.map(u => [u.id, u.sortOrder]))
          return {
            ...old,
            media: old.media.map(f =>
              orderMap.has(f.id) ? { ...f, sortOrder: orderMap.get(f.id)! } : f,
            ),
          }
        })

        return { previous }
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(editQueryOptions.queryKey, context.previous)
        }
        toast.error('Failed to reorder')
      },
      onSettled: () => {
        queryClient.invalidateQueries(editQueryOptions)
      },
    }),
  )

  const toggleHeroMutation = useMutation(
    trpc.projectsRouter.media.toggleHero.mutationOptions({
      onSuccess: () => {
        onUpdate()
        toast.success('Hero image updated')
      },
      onError: () => toast.error('Failed to update hero image'),
    }),
  )

  const movePhaseMutation = useMutation(
    trpc.projectsRouter.media.movePhase.mutationOptions({
      onSuccess: () => {
        onUpdate()
        setSelectedIds(new Set())
        toast.success('Moved successfully')
      },
      onError: () => toast.error('Failed to move'),
    }),
  )

  const { refetch: fetchAccessToken } = useQuery({
    ...trpc.projectsRouter.googleDrive.getAccessToken.queryOptions(),
    enabled: false,
  })

  const uploadFromDriveMutation = useMutation(trpc.projectsRouter.googleDrive.uploadFromFile.mutationOptions())

  const { isLoading: isPickerLoading, openPicker } = useGooglePicker({
    onFilesPicked: async (files) => {
      const total = files.length
      const toastId = toast.loading(`Importing ${total} photo${total !== 1 ? 's' : ''} from Google Drive…`)

      let succeeded = 0
      let failed = 0

      for (const [index, picked] of files.entries()) {
        toast.loading(`Importing from Google Drive… (${index + 1} / ${total})`, { id: toastId })
        try {
          await uploadFromDriveMutation.mutateAsync({
            driveFileId: picked.id,
            name: picked.name,
            mimeType: picked.mimeType,
            projectId,
            phase: activePhase,
          })
          succeeded++
        }
        catch (err) {
          failed++
          const message = err instanceof Error ? err.message : 'Unknown error'
          toast.error(`Failed to import ${picked.name}: ${message}`)
        }
      }

      if (failed === 0) {
        toast.success(`Imported ${succeeded} photo${succeeded !== 1 ? 's' : ''} from Google Drive`, { id: toastId })
      }
      else if (succeeded === 0) {
        toast.error(`Failed to import all ${total} photos`, { id: toastId })
      }
      else {
        toast.warning(`Imported ${succeeded} / ${total} photos (${failed} failed)`, { id: toastId })
      }

      onUpdate()
    },
  })

  const mediaByPhase = (phase: string): MediaFile[] =>
    mediaFiles
      .filter(f => f.phase === phase && !f.mimeType.startsWith('video/'))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  function handleUploadClick(phase: MediaPhase) {
    setActivePhase(phase)
    fileInputRef.current?.click()
  }

  async function handleGoogleDriveClick(phase: MediaPhase) {
    setActivePhase(phase)
    const { data } = await fetchAccessToken()
    if (!data?.accessToken) {
      toast.error('Could not connect to Google Drive')
      return
    }
    currentAccessTokenRef.current = data.accessToken
    openPicker(data.accessToken)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) {
      return
    }

    const fileList = Array.from(files)
    e.target.value = ''

    // Upload all files in parallel — each triggers onUpdate independently so images appear as they finish
    await Promise.allSettled(
      fileList.map(async (file) => {
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
          onUpdate()
        }
        catch {
          toast.error(`Failed to upload ${file.name}`)
        }
      }),
    )
  }

  async function handleDelete(fileId: number) {
    const ok = await confirmDelete()
    if (!ok) {
      return
    }
    deleteMutation.mutate({ id: fileId })
  }

  function handleToggleHero(fileId: number, currentIsHero: boolean) {
    toggleHeroMutation.mutate({ id: fileId, isHeroImage: !currentIsHero })
  }

  function handleMovePhase(fileId: number, phase: string) {
    movePhaseMutation.mutate({ ids: [fileId], phase: phase as MediaPhase })
  }

  function handleBulkMove(phase: MediaPhase) {
    if (selectedIds.size === 0) {
      return
    }
    movePhaseMutation.mutate({ ids: [...selectedIds], phase })
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) {
      return
    }
    const ok = await confirmBulkDelete()
    if (!ok) {
      return
    }
    bulkDeleteMutation.mutate({ ids: [...selectedIds] })
  }

  const handleSelectToggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
  }, [])

  function handleSelectAllInPhase(phase: string) {
    const phaseFileIds = mediaByPhase(phase).map(f => f.id)
    const allSelected = phaseFileIds.every(id => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        phaseFileIds.forEach(id => next.delete(id))
      }
      else {
        phaseFileIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(event.active.id as number)
  }

  function handleDragEnd(event: DragEndEvent, phase: string) {
    setDraggingId(null)

    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const phaseFiles = mediaByPhase(phase)
    const activeId = active.id as number
    const overId = over.id as number

    const oldIndex = phaseFiles.findIndex(f => f.id === activeId)
    const newIndex = phaseFiles.findIndex(f => f.id === overId)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Check if this is a group drag (dragged item is selected + others are selected too)
    const isMultiDrag = selectedIds.has(activeId) && selectedIds.size > 1

    if (!isMultiDrag) {
      // Simple single-item reorder
      const reordered = arrayMove(phaseFiles, oldIndex, newIndex)
      const updates = reordered.map((f, i) => ({ id: f.id, sortOrder: i }))
      reorderMutation.mutate({ updates })
      return
    }

    // Multi-drag: move all selected items to the drop target position
    const movingIds = new Set(
      [...selectedIds].filter(id => phaseFiles.some(f => f.id === id)),
    )
    const stationary = phaseFiles.filter(f => !movingIds.has(f.id))
    const moving = phaseFiles.filter(f => movingIds.has(f.id))

    // Find where to insert in the stationary list
    const insertIdx = stationary.findIndex(f => f.id === overId)
    const insertAt = insertIdx === -1 ? stationary.length : insertIdx + 1

    const reordered = [
      ...stationary.slice(0, insertAt),
      ...moving,
      ...stationary.slice(insertAt),
    ]
    const updates = reordered.map((f, i) => ({ id: f.id, sortOrder: i }))
    reorderMutation.mutate({ updates })
  }

  function handleDragCancel() {
    setDraggingId(null)
  }

  const selectionActive = selectedIds.size > 0
  const isGroupDrag = draggingId !== null && selectedIds.has(draggingId) && selectedIds.size > 1

  return (
    <div className="space-y-4">
      <DeleteConfirmDialog />
      <BulkDeleteConfirmDialog />
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {mediaFiles.length}
          {' '}
          file(s) attached. Drag to reorder within each phase.
        </p>
      </div>

      {/* Bulk action toast — fixed near top of viewport via portal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectionActive && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-4 z-50 -translate-x-1/2"
            >
              <div className="flex items-center gap-2 rounded-xl border bg-background/95 px-4 py-2 shadow-lg backdrop-blur-sm">
                <Badge variant="secondary">
                  {selectedIds.size}
                  {' '}
                  selected
                </Badge>

                <div className="mx-1 h-4 w-px bg-border" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <ArrowRightIcon className="mr-1.5 h-3.5 w-3.5" />
                      Move to
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {mediaPhases.map(phase => (
                      <DropdownMenuItem
                        key={phase}
                        className="capitalize"
                        onClick={() => handleBulkMove(phase)}
                      >
                        {phase}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>

                <div className="mx-1 h-4 w-px bg-border" />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <Tabs defaultValue="uncategorized">
        <TabsList>
          {mediaPhases.map(phase => (
            <TabsTrigger key={phase} value={phase} className="capitalize">
              {phase}
              {' ('}
              {mediaByPhase(phase).length}
              )
            </TabsTrigger>
          ))}
        </TabsList>

        {mediaPhases.map((phase) => {
          const phaseFiles = mediaByPhase(phase)

          return (
            <TabsContent key={phase} value={phase} className="space-y-3">
              <div className="flex items-center justify-between">
                {phaseFiles.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSelectAllInPhase(phase)}
                  >
                    {phaseFiles.every(f => selectedIds.has(f.id)) ? 'Deselect all' : 'Select all'}
                  </Button>
                )}
                <div className="ml-auto">
                  <UploadSourcePopover
                    onLocalUpload={() => handleUploadClick(phase)}
                    onGoogleDriveUpload={() => handleGoogleDriveClick(phase)}
                    isUploading={isUploading}
                    isPickerLoading={isPickerLoading}
                  />
                </div>
              </div>

              {phaseFiles.length === 0
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
                      onDragStart={handleDragStart}
                      onDragEnd={e => handleDragEnd(e, phase)}
                      onDragCancel={handleDragCancel}
                      autoScroll={AUTO_SCROLL_CONFIG}
                    >
                      <SortableContext
                        items={phaseFiles.map(f => f.id)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid gap-3 overflow-x-clip" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                          {phaseFiles.map(file => (
                            <SortablePhotoCard
                              key={file.id}
                              file={file}
                              onDelete={handleDelete}
                              onToggleHero={handleToggleHero}
                              onMovePhase={handleMovePhase}
                              onNameUpdated={onUpdate}
                              onRetryOptimization={id => retryOptimization.mutate({ mediaFileId: id })}
                              isDeletePending={deleteMutation.isPending}
                              isHeroPending={toggleHeroMutation.isPending}
                              isSelected={selectedIds.has(file.id)}
                              onSelectToggle={handleSelectToggle}
                              selectionActive={selectionActive}
                              isGroupDragged={isGroupDrag && selectedIds.has(file.id) && file.id !== draggingId}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
