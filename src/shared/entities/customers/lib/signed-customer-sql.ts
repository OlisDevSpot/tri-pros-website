import { sql } from 'drizzle-orm'

import { EXISTS_PROJECT } from './derived-pipeline-sql'

/**
 * "Signed" here is the pipeline's has-a-project bucket, not a sale: analytics
 * counts sales from approved proposals, and a project can be created without one.
 */
export function isSignedCustomerSql() {
  return sql<boolean>`${EXISTS_PROJECT}`
}
