// The media module's ONE contract with an owner. `modules/media` imports no owner
// table, CRUD or owner-kind union — an owner hands its store in (MD2, C24).
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { CrudHandlers } from '@/shared/dal/server/types'
import type { VariantSuffix } from '@/shared/modules/media/core/lib/image-variants'
import type { R2BucketName } from '@/shared/services/providers/r2/types'

export interface MediaStore {
  /** Free-form owner label. Carried in the optimize job payload; the media module never branches on it. */
  ownerKind: string
  /** A base-media table. Contained generic, as before (the `any` rule is off repo-wide). */
  table: any
  /** table.projectId | table.proposalId */
  ownerColumn: PgColumn
  bucket: R2BucketName
  /**
   * The owner unit's scoped CRUD DAL. Declared as a GETTER on every store (D6):
   * the unit's CRUD imports the optimize job, the job imports the stores, and the
   * stores import the CRUD. A plain property would be read during module
   * initialisation and throw a TDZ ReferenceError on one of the two entry orders.
   */
  readonly crud: CrudHandlers<any, number>
  /** Builds the R2 object key for a new upload. */
  buildPathKey: (ownerId: string, fileId: string, ext: string, extra?: Record<string, string>) => string
  /** Which variants THIS owner's optimizer writes — drives both the write and the delete (MD3, MD8). */
  variants: readonly VariantSuffix[]
}
