'use client'

import type { InsertMediaFilesSchema } from '@/shared/db/schema'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTRPC } from '@/trpc/helpers'

type UploadMeta = Omit<InsertMediaFilesSchema, 'bucket' | 'pathKey' | 'url'>

interface UploadInput {
  file: File
  projectId: string
  phase: 'before' | 'during' | 'after' | 'main'
  meta: UploadMeta
}

export function useMediaUpload() {
  const trpc = useTRPC()
  const [isUploading, setIsUploading] = useState(false)

  const getUploadUrl = useMutation(trpc.mediaRouter.getUploadUrl.mutationOptions())
  const createMediaFile = useMutation(trpc.mediaRouter.createMediaFile.mutationOptions())

  async function upload({ file, projectId, phase, meta }: UploadInput) {
    setIsUploading(true)
    try {
      const { uploadUrl, pathKey, publicUrl } = await getUploadUrl.mutateAsync({
        projectId,
        phase,
        filename: file.name,
        mimeType: file.type,
      })

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      return await createMediaFile.mutateAsync({
        ...meta,
        projectId,
        phase,
        pathKey,
        url: publicUrl,
        mimeType: file.type,
      })
    }
    finally {
      setIsUploading(false)
    }
  }

  return { upload, isUploading }
}
