import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { BUCKET, r2Client } from './client'

interface Input {
  pathKey: string
  mimeType: string
  expiresIn?: number
}

export async function getPresignedUploadUrl({ pathKey, mimeType, expiresIn = 900 }: Input): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: pathKey,
    ContentType: mimeType,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}
