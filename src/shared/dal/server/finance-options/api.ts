import { asc } from 'drizzle-orm'
import { db } from '@/shared/db'
import { financeOptions } from '@/shared/db/schema'

export async function getFinanceOptions() {
  const allFinanceOptions = await db
    .select()
    .from(financeOptions)
    .orderBy(asc(financeOptions.sortOrder))

  return allFinanceOptions
}
