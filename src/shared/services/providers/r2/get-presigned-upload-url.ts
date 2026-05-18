import type { R2BucketName } from './buckets'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client } from './client'

interface Input {
  bucket: R2BucketName
  pathKey: string
  mimeType: string
  expiresIn?: number
}

export async function getPresignedUploadUrl({ bucket, pathKey, mimeType, expiresIn = 900 }: Input): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: pathKey,
    ContentType: mimeType,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}
