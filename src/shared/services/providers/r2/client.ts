import type { R2BucketName } from './types'

import { Buffer } from 'node:buffer'

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { lazyProxy } from '@/shared/config/lazy-proxy'

import { getR2Config } from './lib/config'

// ---------------------------------------------------------------------------
// r2Client — the single, uniform entry point for every Cloudflare R2 (S3-
// compatible) interaction. Pattern matches `twilioClient`/`cloudtalkClient`:
// ONE factory → ONE singleton → ALL methods hanging off it. Callers do:
//
//   import { r2Client } from '@/shared/services/providers/r2/client'
//   await r2Client.putObject(bucket, key, buffer, 'image/webp')
//   const url = await r2Client.getPresignedUploadUrl({ bucket, pathKey, mimeType })
//
// Never `import { putObject } from '.../r2/put-object'`. The provider is a
// leaf: methods accept primitives + the `R2BucketName` union and return
// primitives — NO domain types, NO DB writes, NO app logic. Image-variant
// generation is app logic and lives in `entities/media-files/lib`, not here.
// ---------------------------------------------------------------------------

/**
 * Raw S3 client, lazy-constructed via `lazyProxy` so missing R2 credentials
 * don't crash app boot — the first object op throws `NotConfiguredError` if
 * any of R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY is unset.
 *
 * see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional
 */
const s3 = lazyProxy(() => {
  const config = getR2Config()
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
})

interface PresignedUploadInput {
  bucket: R2BucketName
  pathKey: string
  mimeType: string
  expiresIn?: number
}

interface PresignedDownloadInput {
  bucket: R2BucketName
  pathKey: string
  expiresIn?: number
}

// Variant suffixes written alongside an original by the media-optimization
// pipeline. Kept here (not in app logic) because `deleteMediaWithVariants`
// must know every key the storage layer may hold for a given media file.
const VARIANT_SUFFIXES = ['sm', 'md', 'lg'] as const

export const r2Client = {
  /** Upload a buffer to `bucket/pathKey` with the given content type. */
  putObject: async (bucket: R2BucketName, pathKey: string, body: Buffer, mimeType: string): Promise<void> => {
    await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: pathKey, Body: body, ContentType: mimeType }),
    )
  },

  /** Download `bucket/pathKey` into a Buffer. Throws if the object is empty. */
  getObject: async (bucket: R2BucketName, pathKey: string): Promise<Buffer> => {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: pathKey }))

    if (!response.Body) {
      throw new Error(`Empty response for ${bucket}/${pathKey}`)
    }

    const bytes = await response.Body.transformToByteArray()
    return Buffer.from(bytes)
  },

  /** Delete a single object at `bucket/pathKey`. */
  deleteObject: async (bucket: R2BucketName, pathKey: string): Promise<void> => {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: pathKey }))
  },

  /**
   * Delete a media file's original + all optimized variants. Variant
   * deletions are best-effort — they won't throw if a variant doesn't exist.
   */
  deleteMediaWithVariants: async (bucket: R2BucketName, pathKey: string): Promise<void> => {
    const basePath = pathKey.replace(/\.[^.]+$/, '')
    await Promise.all([
      r2Client.deleteObject(bucket, pathKey),
      ...VARIANT_SUFFIXES.map(suffix =>
        r2Client.deleteObject(bucket, `${basePath}-${suffix}.webp`).catch(() => {}),
      ),
    ])
  },

  /** Presigned PUT URL for a direct browser upload. Default TTL 15 min. */
  getPresignedUploadUrl: ({ bucket, pathKey, mimeType, expiresIn = 900 }: PresignedUploadInput): Promise<string> => {
    const command = new PutObjectCommand({ Bucket: bucket, Key: pathKey, ContentType: mimeType })
    return getSignedUrl(s3, command, { expiresIn })
  },

  /** Presigned GET URL for a direct browser download. Default TTL 1 hour. */
  getPresignedDownloadUrl: ({ bucket, pathKey, expiresIn = 3600 }: PresignedDownloadInput): Promise<string> => {
    const command = new GetObjectCommand({ Bucket: bucket, Key: pathKey })
    return getSignedUrl(s3, command, { expiresIn })
  },
}
