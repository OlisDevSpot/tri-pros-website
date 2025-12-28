import { db } from '@/db'
import * as seedFns from '@/db/seeds'

export async function seedTable() {
  await seedFns.trades(db)
  await seedFns.scopes(db)
  await seedFns.materials(db)
  await seedFns.addons(db)
  await seedFns.benefitCategories(db)
  await seedFns.benefits(db)
  await seedFns.x_materialBenefits(db)
  await seedFns.x_scopeBenefits(db)
  await seedFns.x_scopeMaterials(db)
}

seedTable()
