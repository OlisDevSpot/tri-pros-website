'use client'

import { useState } from 'react'

interface UploadPresign {
  uploadUrl: string
  pathKey: string
  bucket?: string
  publicUrl?: string
}

export function useMediaUpload<TCreated>(config: {
  getUploadUrl: (file: File) => Promise<UploadPresign>
  createRecord: (args: { file: File, pathKey: string, bucket?: string, publicUrl?: string }) => Promise<TCreated>
}) {
  const [isUploading, setIsUploading] = useState(false)

  async function upload(file: File): Promise<TCreated> {
    setIsUploading(true)
    try {
      const { uploadUrl, pathKey, bucket, publicUrl } = await config.getUploadUrl(file)
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      return await config.createRecord({ file, pathKey, bucket, publicUrl })
    }
    finally {
      setIsUploading(false)
    }
  }

  return { upload, isUploading }
}
