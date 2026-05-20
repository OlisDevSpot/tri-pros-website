// Share token for homeowner proposal access. see ../DOCS.md#share-token-generated-at-insert

import { randomBytes } from 'node:crypto'

/** Generate a unique `tpr-` prefixed share token for proposal links. */
export function generateShareToken(): string {
  return `tpr-${randomBytes(8).toString('hex')}`
}
