import type { Table } from 'drizzle-orm'

import { getTableName, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import env from '@/shared/config/server-env'
import * as schema from '@/shared/db/schema'

// eslint-disable-next-line node/prefer-global/process
const dbUrl = process.env.DRIZZLE_TARGET === 'dev' ? env.DATABASE_DEV_URL! : env.DATABASE_URL
const db = drizzle(new Pool({ connectionString: dbUrl }), { schema })

async function _truncateTable(table: Table) {
  return db.execute(sql.raw(`TRUNCATE TABLE "${getTableName(table)}" RESTART IDENTITY CASCADE;`))
}

async function deleteTable(table: Table) {
  await db.execute(sql.raw(`DROP TABLE IF EXISTS "${getTableName(table)}" CASCADE;`))
}

export async function resetDb() {
  await deleteTable(schema.addons)
  await deleteTable(schema.scopes)
  await deleteTable(schema.trades)
  await deleteTable(schema.materials)
  await deleteTable(schema.benefits)
  await deleteTable(schema.benefitCategories)
  await deleteTable(schema.tags)
  await deleteTable(schema.variables)
  await deleteTable(schema.projects)
  await deleteTable(schema.mediaFiles)
  await deleteTable(schema.x_scopeMaterials)
  await deleteTable(schema.x_materialBenefits)
  await deleteTable(schema.x_projectMediaFiles)
  await deleteTable(schema.x_projectScopes)
  await deleteTable(schema.x_scopeBenefits)
  await deleteTable(schema.x_scopeVariables)
  await deleteTable(schema.x_scopeVariables)
  await deleteTable(schema.x_tradeBenefits)
}

resetDb()
