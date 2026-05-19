import type { Buffer } from 'node:buffer'
import type { R2BucketName } from './buckets'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client } from './client'

export async function putObject(bucket: R2BucketName, pathKey: string, body: Buffer, mimeType: string): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: pathKey,
      Body: body,
      ContentType: mimeType,
    }),
  )
}
