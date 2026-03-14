'use client'

import type { MediaFile } from '@/shared/db/schema'
import type { ProjectFormData } from '@/shared/entities/projects/schemas'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { BasicInfoFields } from './basic-info-fields'
import { HomeownerFields } from './homeowner-fields'
import { MediaManagerFields } from './media-manager-fields'
import { ScopePickerFields } from './scope-picker-fields'
import { StoryContentFields } from './story-content-fields'

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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Project title, location, and visibility settings</CardDescription>
        </CardHeader>
        <CardContent>
          <BasicInfoFields />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Story Content</CardTitle>
          <CardDescription>Tell the story of this project from start to finish</CardDescription>
        </CardHeader>
        <CardContent>
          <StoryContentFields />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Homeowner</CardTitle>
          <CardDescription>Homeowner details and testimonial</CardDescription>
        </CardHeader>
        <CardContent>
          <HomeownerFields />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scopes</CardTitle>
          <CardDescription>Select the scopes of work included in this project</CardDescription>
        </CardHeader>
        <CardContent>
          <ScopePickerFields />
        </CardContent>
      </Card>

      {projectId && mediaFiles && onMediaUpdate && (
        <Card>
          <CardHeader>
            <CardTitle>Media</CardTitle>
            <CardDescription>Manage project photos and videos</CardDescription>
          </CardHeader>
          <CardContent>
            <MediaManagerFields
              projectId={projectId}
              mediaFiles={mediaFiles}
              onUpdate={onMediaUpdate}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading} size="lg">
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {projectId ? 'Update Project' : 'Create Project'}
        </Button>
      </div>
    </form>
  )
}
