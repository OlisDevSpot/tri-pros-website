import type { R2BucketName } from './buckets'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client } from './client'

interface Input {
  bucket: R2BucketName
  pathKey: string
  expiresIn?: number
}

export async function getPresignedDownloadUrl({ bucket, pathKey, expiresIn = 3600 }: Input): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: pathKey,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}
