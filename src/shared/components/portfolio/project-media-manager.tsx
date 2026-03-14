'use client'

import type { MediaFile } from '@/shared/db/schema'
import { useMutation } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Loader2, Plus, Star, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useMediaUpload } from '@/shared/hooks/use-media-upload'
import { useTRPC } from '@/trpc/helpers'

const PHASES = ['before', 'during', 'after', 'main'] as const

interface Props {
  projectId: string
  mediaFiles: MediaFile[]
  onUpdate: () => void
}

export function ProjectMediaManager({ projectId, mediaFiles, onUpdate }: Props) {
  const trpc = useTRPC()
  const { upload, isUploading } = useMediaUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activePhaseRef = useRef<(typeof PHASES)[number]>('main')

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

  const mediaByPhase = (phase: string) =>
    mediaFiles
      .filter(f => f.phase === phase && !f.mimeType.startsWith('video/'))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  function handleUploadClick(phase: (typeof PHASES)[number]) {
    activePhaseRef.current = phase
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) {
      return
    }

    const phase = activePhaseRef.current

    for (const file of Array.from(files)) {
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
      try {
        await upload({
          file,
          projectId,
          phase,
          meta: {
            name: file.name.replace(/\.[^/.]+$/, ''),
            mimeType: file.type,
            fileExtension: ext,
            phase,
            projectId,
          },
        })
      }
      catch {
        toast.error(`Failed to upload ${file.name}`)
      }
    }

    onUpdate()
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function handleDelete(fileId: number) {
    // eslint-disable-next-line no-alert
    if (window.confirm('Delete this file? This cannot be undone.')) {
      deleteMutation.mutate({ id: fileId })
    }
  }

  function handleReorder(phase: string, fileId: number, direction: 'up' | 'down') {
    const phaseFiles = mediaByPhase(phase)
    const idx = phaseFiles.findIndex(f => f.id === fileId)
    if (idx === -1) {
      return
    }

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= phaseFiles.length) {
      return
    }

    const updates = phaseFiles.map((f, i) => {
      if (i === idx) {
        return { id: f.id, sortOrder: swapIdx }
      }
      if (i === swapIdx) {
        return { id: f.id, sortOrder: idx }
      }
      return { id: f.id, sortOrder: i }
    })

    reorderMutation.mutate({ updates })
  }

  function handleToggleHero(fileId: number, currentIsHero: boolean) {
    toggleHeroMutation.mutate({ id: fileId, isHeroImage: !currentIsHero })
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-foreground">Media</legend>
      <p className="text-sm text-muted-foreground">
        {mediaFiles.length}
        {' '}
        file(s) attached. Upload images to each phase.
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
          {PHASES.map(phase => (
            <TabsTrigger key={phase} value={phase} className="capitalize">
              {phase}
              {' ('}
              {mediaByPhase(phase).length}
              )
            </TabsTrigger>
          ))}
        </TabsList>

        {PHASES.map(phase => (
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {mediaByPhase(phase).map((file, idx) => (
                      <div key={file.id} className="group relative aspect-square overflow-hidden rounded-lg">
                        <Image
                          src={file.url}
                          alt={file.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40" />

                        {/* Top-right: hero badge + delete */}
                        <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant={file.isHeroImage ? 'default' : 'secondary'}
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleToggleHero(file.id, file.isHeroImage)}
                            disabled={toggleHeroMutation.isPending}
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDelete(file.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Top-left: reorder arrows */}
                        <div className="absolute left-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === 0 || reorderMutation.isPending}
                            onClick={() => handleReorder(phase, file.id, 'up')}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === mediaByPhase(phase).length - 1 || reorderMutation.isPending}
                            onClick={() => handleReorder(phase, file.id, 'down')}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Hero badge always visible */}
                        {file.isHeroImage && (
                          <Badge className="absolute left-1 bottom-7 bg-yellow-500 text-xs">
                            <Star className="mr-0.5 h-3 w-3" />
                            Hero
                          </Badge>
                        )}

                        <p className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-2 py-1 text-[10px] text-white">
                          {file.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
          </TabsContent>
        ))}
      </Tabs>
    </fieldset>
  )
}
