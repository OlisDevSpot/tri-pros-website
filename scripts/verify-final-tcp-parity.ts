import './lib/load-env'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'

/**
 * Wave 0 parity check: TS canonical formula vs the SQL mirror, over every
 * proposal row. Non-zero exit on any mismatch. Seed of the W2 verify script.
 */
async function main() {
  const sqlTcp = sql<string>`GREATEST(
    0::numeric,
    COALESCE((${proposals.fundingJSON}->'data'->>'startingTcp')::numeric, 0)
    - COALESCE((
        SELECT SUM((inc->>'amount')::numeric)
        FROM jsonb_array_elements(${proposals.fundingJSON}->'data'->'incentives') AS inc
        WHERE inc->>'type' = 'discount'
      ), 0)
    - COALESCE((
        SELECT SUM((si->>'amount')::numeric)
        FROM jsonb_array_elements(${proposals.projectJSON}->'data'->'sow') AS sec,
             jsonb_array_elements(COALESCE(sec->'financials'->'incentives', '[]'::jsonb)) AS si
      ), 0)
  )`

  const rows = await db
    .select({
      id: proposals.id,
      fundingJSON: proposals.fundingJSON,
      projectJSON: proposals.projectJSON,
      sqlTcp,
    })
    .from(proposals)

  let mismatches = 0
  let errors = 0
  for (const row of rows) {
    try {
      const tsTcp = computeFinalTcp({ funding: row.fundingJSON.data, sow: row.projectJSON.data.sow })
      // pg returns numeric as string; exact equality is sound while money is whole-dollar JS numbers (W0 constraint)
      const dbTcp = Number(row.sqlTcp)
      if (tsTcp !== dbTcp) {
        mismatches++
        console.error(`MISMATCH proposal=${row.id} ts=${tsTcp} sql=${dbTcp}`)
      }
    } catch (err) {
      errors++
      console.error(`ERROR proposal=${row.id} — row failed TS computation:`, err)
    }
  }

  console.warn(`checked=${rows.length} mismatches=${mismatches} errors=${errors}`)
  if (mismatches > 0 || errors > 0) {
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
