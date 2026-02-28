import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { BUCKET, r2Client } from './client'

export async function deleteObject(pathKey: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: pathKey,
    }),
  )
}
