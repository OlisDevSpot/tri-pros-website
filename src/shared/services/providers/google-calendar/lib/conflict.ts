/**
 * Last-write-wins conflict resolution.
 * Compares local `updatedAt` against GCal `updated` timestamp.
 * Returns 'local' if local record is newer, 'remote' if GCal is newer.
 * If timestamps are identical, prefer local (our data is richer).
 */
export function resolveConflict(
  localUpdatedAt: string,
  gcalUpdatedAt: string,
): 'local' | 'remote' {
  const localTime = new Date(localUpdatedAt).getTime()
  const remoteTime = new Date(gcalUpdatedAt).getTime()

  return localTime >= remoteTime ? 'local' : 'remote'
}

/**
 * Check if a GCal event has changed since we last synced.
 * Compares the etag from GCal against our stored etag.
 */
export function hasRemoteChanged(storedEtag: string | null, remoteEtag: string): boolean {
  return storedEtag !== remoteEtag
}
