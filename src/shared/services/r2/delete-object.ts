import type { R2BucketName } from './buckets'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2Client } from './client'

export async function deleteObject(bucket: R2BucketName, pathKey: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: pathKey,
    }),
  )
}
