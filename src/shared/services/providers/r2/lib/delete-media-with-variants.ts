import type { R2BucketName } from '../buckets'

import { deleteObject } from '../delete-object'

const VARIANT_SUFFIXES = ['sm', 'md', 'lg'] as const

/**
 * Deletes a media file's original + all optimized variants from R2.
 * Variant deletions are best-effort — won't throw if variants don't exist.
 */
export async function deleteMediaWithVariants(bucket: R2BucketName, pathKey: string): Promise<void> {
  const basePath = pathKey.replace(/\.[^.]+$/, '')

  await Promise.all([
    deleteObject(bucket, pathKey),
    ...VARIANT_SUFFIXES.map(suffix =>
      deleteObject(bucket, `${basePath}-${suffix}.webp`).catch(() => {}),
    ),
  ])
}
