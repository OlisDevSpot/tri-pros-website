// THE single R2 purge path for media (MD7). A leaf: it imports the R2 provider and
// nothing else, so a DAL hook can call it without a DAL ever importing a service.
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { r2Client } from '@/shared/services/providers/r2/client'

interface PurgeableRow {
  bucket: string | null
  pathKey: string | null
  optimizationVariants?: string[] | null
}

/**
 * Delete a media row's R2 original and its variants.
 *
 * Suffixes are the owner's write-time list UNIONED with whatever the row actually
 * recorded (D3): `store.variants` alone fixes new rows, and the union also covers
 * rows written when a variant list was longer. A key that doesn't exist is caught
 * and ignored by the provider, so the extra calls are harmless.
 *
 * Rows with null coordinates (a Cloudflare Stream row, Plan 1b) have no object —
 * skipped, and the caller still removes the DB row.
 */
export async function purgeMediaObject(row: PurgeableRow, variants: readonly string[]): Promise<void> {
  if (!row.bucket || !row.pathKey) {
    return
  }
  const suffixes = [...new Set([...variants, ...(row.optimizationVariants ?? [])])]
  await r2Client.deleteMediaWithVariants(row.bucket as R2BucketName, row.pathKey, suffixes)
}
