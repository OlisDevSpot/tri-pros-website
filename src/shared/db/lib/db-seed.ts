import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import env from '@/shared/config/server-env'
import * as schema from '@/shared/db/schema'
import * as seedFns from '@/shared/db/seeds'

// Unset never silently means prod: only explicit DRIZZLE_TARGET=prod reaches
// DATABASE_URL. see docs/codebase-conventions/environment.md#environment-axes
// eslint-disable-next-line node/prefer-global/process
const dbUrl = process.env.DRIZZLE_TARGET === 'prod' ? env.DATABASE_URL : env.DATABASE_DEV_URL!
const db = drizzle(new Pool({ connectionString: dbUrl }), { schema })

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
