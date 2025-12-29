import type { DB } from '@/shared/db'

import type { InsertXMaterialBenefit } from '@/shared/db/schema'
import type { MaterialAccessor } from '@/shared/db/types/materials'

import { sql } from 'drizzle-orm'

import { benefits, materials, x_materialBenefits } from '@/shared/db/schema'
import { materialBenefitsData } from './data/x-material-benefits'

export default async function seed(db: DB) {
  const materialAccessors = Object.keys(materialBenefitsData) as MaterialAccessor[]

  const [allMaterials, allBenefits] = await Promise.all([
    db.select().from(materials),
    db.select().from(benefits),
  ])

  const mappedXMaterialBenefits: InsertXMaterialBenefit[] = []

  for (const materialAccessor of materialAccessors) {
    const materialEntry = allMaterials.find(dbMaterial => dbMaterial.accessor === materialAccessor)

    for (const benefit of materialBenefitsData[materialAccessor as keyof typeof materialBenefitsData]) {
      const benefitEntry = allBenefits.find(dbBenefit => dbBenefit.accessor === benefit)

      if (!materialEntry || !benefitEntry)
        continue

      mappedXMaterialBenefits.push({
        materialId: materialEntry.id,
        benefitId: benefitEntry.id,
      })
    }
  }

  await db
    .insert(x_materialBenefits)
    .values(mappedXMaterialBenefits)
    .onConflictDoUpdate({
      target: [x_materialBenefits.materialId, x_materialBenefits.benefitId],
      set: {
        materialId: sql`EXCLUDED.material_id`,
        benefitId: sql`EXCLUDED.benefit_id`,
      },
    })
}
