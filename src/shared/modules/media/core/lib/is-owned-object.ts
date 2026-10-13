interface StoredObject {
  bucket?: string | null
  pathKey?: string | null
}

/**
 * Deleting a media row deletes the object it names, so a row may only name an object under its own
 * owner's key. A row with no object at all (a Stream video) names nothing.
 */
export function isOwnedObject(row: StoredObject, owner: { bucket: string, pathKeyPrefix: string }): boolean {
  if (row.bucket == null && row.pathKey == null) {
    return true
  }
  return row.bucket === owner.bucket && row.pathKey != null && row.pathKey.startsWith(owner.pathKeyPrefix)
}
