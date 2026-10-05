import type { R2BucketName } from './types'

import { Buffer } from 'node:buffer'

import { lazyAsync } from '@/shared/config/lazy-async'

import { getR2Config } from './lib/config'

// ---------------------------------------------------------------------------
// r2Client — the single, uniform entry point for every Cloudflare R2 (S3-
// compatible) interaction. Pattern matches `twilioClient`/`justcallClient`:
// ONE factory → ONE singleton → ALL methods hanging off it. Callers do:
//
//   import { r2Client } from '@/shared/services/providers/r2/client'
//   await r2Client.putObject(bucket, key, buffer, 'image/webp')
//   const url = await r2Client.getPresignedUploadUrl({ bucket, pathKey, mimeType })
//
// Never `import { putObject } from '.../r2/put-object'`. The provider is a
// leaf: methods accept primitives + the `R2BucketName` union and return
// primitives — NO domain types, NO DB writes, NO app logic. Image-variant
// generation is app logic and lives in `@/shared/modules/media/core/lib/image-variants`, not here.
// ---------------------------------------------------------------------------

/**
 * The S3 SDK and its client load on the first object operation, not at boot.
 * `@aws-sdk/client-s3` is a Next server external, required from node_modules,
 * so a static import would require it on every cold start of every route that
 * imports the app router. Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY reject that first operation with `NotConfiguredError`.
 */
const loadS3 = lazyAsync(async () => {
  const sdk = await import('@aws-sdk/client-s3')
  const config = getR2Config()
  const client = new sdk.S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return { sdk, client }
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

export const r2Client = {
  /** Upload a buffer to `bucket/pathKey` with the given content type. */
  putObject: async (bucket: R2BucketName, pathKey: string, body: Buffer, mimeType: string): Promise<void> => {
    const { sdk, client } = await loadS3()
    await client.send(
      new sdk.PutObjectCommand({ Bucket: bucket, Key: pathKey, Body: body, ContentType: mimeType }),
    )
  },

  /** Download `bucket/pathKey` into a Buffer. Throws if the object is empty. */
  getObject: async (bucket: R2BucketName, pathKey: string): Promise<Buffer> => {
    const { sdk, client } = await loadS3()
    const response = await client.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: pathKey }))

    if (!response.Body) {
      throw new Error(`Empty response for ${bucket}/${pathKey}`)
    }

    const bytes = await response.Body.transformToByteArray()
    return Buffer.from(bytes)
  },

  /** List every object key in a bucket (optionally under a prefix), paginated. */
  listAllKeys: async (bucket: R2BucketName, prefix?: string): Promise<string[]> => {
    const { sdk, client } = await loadS3()
    const keys: string[] = []
    let continuationToken: string | undefined
    do {
      const res = await client.send(new sdk.ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }))
      for (const obj of res.Contents ?? []) {
        if (obj.Key) {
          keys.push(obj.Key)
        }
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (continuationToken)
    return keys
  },

  /** Delete a single object at `bucket/pathKey`. */
  deleteObject: async (bucket: R2BucketName, pathKey: string): Promise<void> => {
    const { sdk, client } = await loadS3()
    await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: pathKey }))
  },

  /**
   * Delete a media file's original + the given optimized variants. Variant
   * deletions are best-effort — they won't throw if a variant doesn't exist.
   * The suffix list is supplied by the caller: this provider is a leaf and must
   * not import an app-level variant registry (MD8).
   */
  deleteMediaWithVariants: async (bucket: R2BucketName, pathKey: string, suffixes: readonly string[]): Promise<void> => {
    const basePath = pathKey.replace(/\.[^.]+$/, '')
    await Promise.all([
      r2Client.deleteObject(bucket, pathKey),
      ...suffixes.map(suffix =>
        r2Client.deleteObject(bucket, `${basePath}-${suffix}.webp`).catch(() => {}),
      ),
    ])
  },

  /**
   * Copy an object from one bucket/key to another (supports cross-bucket).
   * Used to promote a private homeowner file into the public portfolio bucket.
   */
  copyObject: async ({ sourceBucket, sourceKey, destBucket, destKey }: {
    sourceBucket: R2BucketName
    sourceKey: string
    destBucket: R2BucketName
    destKey: string
  }): Promise<void> => {
    const { sdk, client } = await loadS3()
    await client.send(new sdk.CopyObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      // CopySource is `${bucket}/${key}`; the key segment must be URL-encoded
      // so paths containing spaces/slashes/unicode resolve correctly.
      CopySource: `${sourceBucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
    }))
  },

  /** Presigned PUT URL for a direct browser upload. Default TTL 15 min. */
  getPresignedUploadUrl: async ({ bucket, pathKey, mimeType, expiresIn = 900 }: PresignedUploadInput): Promise<string> => {
    const [{ sdk, client }, { getSignedUrl }] = await Promise.all([loadS3(), import('@aws-sdk/s3-request-presigner')])
    const command = new sdk.PutObjectCommand({ Bucket: bucket, Key: pathKey, ContentType: mimeType })
    return getSignedUrl(client, command, { expiresIn })
  },

  /** Presigned GET URL for a direct browser download. Default TTL 1 hour. */
  getPresignedDownloadUrl: async ({ bucket, pathKey, expiresIn = 3600 }: PresignedDownloadInput): Promise<string> => {
    const [{ sdk, client }, { getSignedUrl }] = await Promise.all([loadS3(), import('@aws-sdk/s3-request-presigner')])
    const command = new sdk.GetObjectCommand({ Bucket: bucket, Key: pathKey })
    return getSignedUrl(client, command, { expiresIn })
  },
}
