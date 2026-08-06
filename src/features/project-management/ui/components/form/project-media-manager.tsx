'use client'

import type { MediaItem } from '@/shared/components/media/types'
import type { MediaPhase } from '@/shared/constants/enums/media'
import type { MediaFile } from '@/shared/db/schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightIcon, Star, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { MediaCard } from '@/shared/components/media/media-card'
import { MediaReorderGrid } from '@/shared/components/media/media-reorder-grid'
import { MediaUploadButton } from '@/shared/components/media/media-upload-button'
import { useMediaUpload } from '@/shared/components/media/use-media-upload'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { mediaPhases } from '@/shared/constants/enums/media'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { cn } from '@/shared/lib/utils'
import { useGooglePicker } from '@/shared/services/providers/google-drive/hooks/use-google-picker'
import { useTRPC } from '@/trpc/helpers'
import { ImportFromProposalDialog } from './import-from-proposal-dialog'

interface Props {
  projectId: string
  mediaFiles: MediaFile[]
  onUpdate: () => void
}

export function ProjectMediaManager({ projectId, mediaFiles, onUpdate }: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { invalidateProject } = useInvalidation()
  const editQueryOptions = trpc.projectsRouter.crud.getForEdit.queryOptions({ id: projectId })

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

  const getUploadUrlMut = useMutation(trpc.projectsRouter.media.getUploadUrl.mutationOptions())
  const createMut = useMutation(trpc.projectsRouter.media.create.mutationOptions())
  const { upload, isUploading } = useMediaUpload({
    getUploadUrl: file => getUploadUrlMut.mutateAsync({
      projectId,
      phase: activePhase,
      filename: file.name,
      mimeType: file.type,
    }),
    createRecord: ({ file, pathKey, publicUrl }) => createMut.mutateAsync({
      projectId,
      phase: activePhase,
      pathKey,
      url: publicUrl!,
      mimeType: file.type,
      name: file.name.replace(/\.[^/.]+$/, ''),
      fileExtension: file.name.includes('.') ? `.${file.name.split('.').pop()}` : '',
    }),
  })

  const retryOptimization = useMutation(trpc.projectsRouter.media.retryOptimization.mutationOptions({
    onSuccess: () => onUpdate(),
  }))

  const renameMutation = useMutation(
    trpc.projectsRouter.media.rename.mutationOptions({
      onSuccess: () => onUpdate(),
      onError: () => toast.error('Failed to rename file'),
    }),
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
        invalidateProject()
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

  const fileById = new Map(mediaFiles.map(f => [f.id, f]))

  const mediaByPhase = (phase: string): MediaFile[] =>
    mediaFiles
      .filter(f => f.phase === phase && !f.mimeType.startsWith('video/'))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const toMediaItem = (f: MediaFile): MediaItem => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    url: f.url,
    blurDataUrl: f.blurDataUrl,
    optimizationStatus: f.optimizationStatus,
    sortOrder: f.sortOrder,
  })

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
        try {
          await upload(file)
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

  const selectionActive = selectedIds.size > 0

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
        <ImportFromProposalDialog projectId={projectId} onImported={onUpdate} />
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
          const phaseItems = phaseFiles.map(toMediaItem)

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
                  <MediaUploadButton
                    onLocalUpload={() => handleUploadClick(phase)}
                    onExtraUpload={() => handleGoogleDriveClick(phase)}
                    extraUploadLabel="From Google Drive"
                    isUploading={isUploading}
                    isExtraUploadLoading={isPickerLoading}
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
                    <MediaReorderGrid
                      items={phaseItems}
                      selectedIds={selectedIds}
                      onReorder={updates => reorderMutation.mutate({ updates })}
                      renderItem={(item, dnd) => (
                        <MediaCard
                          item={item}
                          isSelected={selectedIds.has(item.id)}
                          onSelectToggle={handleSelectToggle}
                          selectionActive={selectionActive}
                          dragHandleProps={dnd.dragHandleProps}
                          isDragging={dnd.isDragging}
                          isGroupDragged={dnd.isGroupDragged}
                          onRename={(id, name) => renameMutation.mutate({ id, name })}
                          onDelete={handleDelete}
                          isDeletePending={deleteMutation.isPending}
                          renderThumbnail={mediaItem => (
                            <OptimizedImage
                              file={fileById.get(mediaItem.id)!}
                              alt={mediaItem.name}
                              fill
                              sizes="(max-width: 640px) 50vw, 25vw"
                              onRetryOptimization={id => retryOptimization.mutate({ mediaFileId: id })}
                            />
                          )}
                          renderPreview={mediaItem => (
                            <OptimizedImage
                              file={fileById.get(mediaItem.id)!}
                              alt={mediaItem.name}
                              fill
                              className="object-contain bg-muted"
                              sizes="500px"
                            />
                          )}
                          renderControls={(mediaItem, { menuOpen }) => {
                            const f = fileById.get(mediaItem.id)!
                            return (
                              <>
                                {f.isHeroImage && (
                                  <Badge className="bg-yellow-500/90 text-yellow-950 text-[10px] py-0 px-1.5">
                                    Hero
                                  </Badge>
                                )}
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="icon"
                                  className={
                                    f.isHeroImage
                                      ? 'h-6 w-6 bg-yellow-500 hover:bg-yellow-600 text-yellow-950'
                                      : cn('h-6 w-6 bg-primary hover:bg-primary/80 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100', menuOpen && 'opacity-100')
                                  }
                                  onClick={() => handleToggleHero(f.id, f.isHeroImage)}
                                  disabled={toggleHeroMutation.isPending}
                                >
                                  <Star className={f.isHeroImage ? 'h-3 w-3 fill-current' : 'h-3 w-3'} />
                                </Button>
                              </>
                            )
                          }}
                          renderMenuItems={(mediaItem) => {
                            const f = fileById.get(mediaItem.id)!
                            const otherPhases = mediaPhases.filter(p => p !== f.phase)
                            return (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <ArrowRightIcon className="mr-2 h-3.5 w-3.5" />
                                  Move to
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {otherPhases.map(p => (
                                    <DropdownMenuItem
                                      key={p}
                                      className="capitalize"
                                      onClick={() => handleMovePhase(f.id, p)}
                                    >
                                      {p}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            )
                          }}
                          renderDetails={(mediaItem) => {
                            const f = fileById.get(mediaItem.id)!
                            return (
                              <>
                                <dt className="text-muted-foreground">MIME Type</dt>
                                <dd className="text-foreground">{f.mimeType}</dd>

                                <dt className="text-muted-foreground">Extension</dt>
                                <dd className="text-foreground">{f.fileExtension}</dd>

                                <dt className="text-muted-foreground">Phase</dt>
                                <dd className="capitalize text-foreground">{f.phase}</dd>

                                <dt className="text-muted-foreground">Sort Order</dt>
                                <dd className="text-foreground">{f.sortOrder}</dd>

                                <dt className="text-muted-foreground">Hero Image</dt>
                                <dd className="text-foreground">{f.isHeroImage ? 'Yes' : 'No'}</dd>

                                <dt className="text-muted-foreground">Path Key</dt>
                                <dd className="truncate text-foreground text-xs" title={f.pathKey ?? undefined}>{f.pathKey ?? '—'}</dd>

                                <dt className="text-muted-foreground">Created</dt>
                                <dd className="text-foreground">
                                  {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                </dd>
                              </>
                            )
                          }}
                        />
                      )}
                    />
                  )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
