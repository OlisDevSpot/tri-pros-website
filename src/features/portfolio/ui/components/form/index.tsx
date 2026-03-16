'use client'

import type { MediaFile } from '@/shared/db/schema'
import type { ProjectFormData } from '@/shared/entities/projects/schemas'
import { ImageIcon, Loader2, Settings2Icon } from 'lucide-react'
import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { MetadataTabContent } from './metadata-tab-content'
import { PhotosTabContent } from './photos-tab-content'

interface Props {
  isLoading: boolean
  initialValues?: Partial<ProjectFormData>
  onSubmit: (data: ProjectFormData) => void
  projectId?: string
  mediaFiles?: MediaFile[]
  onMediaUpdate?: () => void
}

export function ProjectForm({ isLoading, initialValues, onSubmit, projectId, mediaFiles, onMediaUpdate }: Props) {
  const form = useFormContext<ProjectFormData>()

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues)
    }
  }, [initialValues]) // eslint-disable-line react-hooks/exhaustive-deps

  const isEditMode = !!projectId
  const hasMedia = isEditMode && mediaFiles && onMediaUpdate

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
      {hasMedia
        ? (
            <>
              {/* Desktop: side-by-side */}
              <div className="hidden min-h-0 flex-1 gap-6 lg:flex">
                <div className="flex-2 min-w-0 overflow-y-auto">
                  <PhotosTabContent
                    projectId={projectId}
                    mediaFiles={mediaFiles}
                    onUpdate={onMediaUpdate}
                  />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <MetadataTabContent />
                </div>
              </div>

              {/* Mobile: tabs */}
              <div className="lg:hidden">
                <Tabs defaultValue="photos">
                  <TabsList className="mb-6">
                    <TabsTrigger value="photos">
                      <ImageIcon className="mr-1.5 h-4 w-4" />
                      Photos
                      {` (${mediaFiles.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="metadata">
                      <Settings2Icon className="mr-1.5 h-4 w-4" />
                      Metadata
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="photos">
                    <PhotosTabContent
                      projectId={projectId}
                      mediaFiles={mediaFiles}
                      onUpdate={onMediaUpdate}
                    />
                  </TabsContent>

                  <TabsContent value="metadata">
                    <MetadataTabContent />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Submit — always outside the columns */}
              <div className="flex shrink-0 justify-end border-t pt-4 mt-4">
                <Button type="submit" disabled={isLoading} size="lg">
                  {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Update Project
                </Button>
              </div>
            </>
          )
        : (
            <>
              <MetadataTabContent />
              <div className="flex justify-end pt-6">
                <Button type="submit" disabled={isLoading} size="lg">
                  {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create Project
                </Button>
              </div>
            </>
          )}
    </form>
  )
}
