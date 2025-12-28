import type { DB } from '@/db'

import type { InsertXScopeMaterial } from '@/db/schema'
import { sql } from 'drizzle-orm'

import { materials, scopes, x_scopeMaterials } from '@/db/schema'

import { xScopeMaterialsData } from './data/x-scope-materials'

export default async function seed(db: DB) {
  const [allScopes, allMaterials] = await Promise.all(
    [
      db.select().from(scopes),
      db.select().from(materials),
    ],
  )

  const mappedXScopeMaterials: InsertXScopeMaterial[] = []

  for (const scopeMaterial of xScopeMaterialsData) {
    const scopeEntry = allScopes.find(dbScope => dbScope.accessor === scopeMaterial.scopeAccessor)
    const materialEntry = allMaterials.find(dbMaterial => dbMaterial.accessor === scopeMaterial.materialAccessor)

    if (!scopeEntry || !materialEntry)
      continue

    mappedXScopeMaterials.push({
      scopeId: scopeEntry.id,
      materialId: materialEntry.id,
      isMostPopular: scopeMaterial.isMostPopular,
    })
  }

  return await db
    .insert(x_scopeMaterials)
    .values(mappedXScopeMaterials)
    .onConflictDoUpdate({
      target: [x_scopeMaterials.scopeId, x_scopeMaterials.materialId],
      set: {
        isMostPopular: sql`EXCLUDED.is_most_popular`,
        scopeId: sql`EXCLUDED.scope_id`,
        materialId: sql`EXCLUDED.material_id`,
      },
    })
}
