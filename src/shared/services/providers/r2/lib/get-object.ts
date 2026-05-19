import type { R2BucketName } from '../buckets'

import { Buffer } from 'node:buffer'
import { GetObjectCommand } from '@aws-sdk/client-s3'

import { r2Client } from '../client'

export async function getObject(bucket: R2BucketName, pathKey: string): Promise<Buffer> {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: pathKey,
    }),
  )

  if (!response.Body) {
    throw new Error(`Empty response for ${bucket}/${pathKey}`)
  }

  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}
