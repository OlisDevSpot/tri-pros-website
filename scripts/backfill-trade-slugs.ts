/**
 * Backfill the Notion Trades data source's `Slug` property from each row's
 * title, with the same derivation the adapter used when slugs were derived —
 * so no public URL changes. Reads EVERY row, disabled included, so a
 * trade re-enabled later never arrives slugless.
 *
 *   npx tsx scripts/backfill-trade-slugs.ts            dry run: prints the plan, writes nothing
 *   npx tsx scripts/backfill-trade-slugs.ts --apply    writes the `write` rows only
 *
 * Never overwrites a stored slug (a differing one is a `conflict` and aborts),
 * never writes while any derived slug is blank or duplicated. Re-runnable:
 * after a successful apply every row is `same`. Run it again whenever a trade
 * is added in Notion without a slug — the adapter drops slugless rows, so
 * this is the tool that finds them.
 *
 * Reads and writes production Notion (there is only one). Imports
 * `sources/notion/*` the way `verify-notion-adapters.ts` does — scripts are
 * the one sanctioned consumer of those internals.
 */
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import process from 'node:process'
import { slugifyTradeName } from '@/shared/lib/slugify-trade-name'
import { notionDatabasesMeta } from '@/shared/modules/construction/sources/notion/databases'
import { checkbox, richText, titleText } from '@/shared/modules/construction/sources/notion/extractors'
import { queryNotionDatabase } from '@/shared/modules/construction/sources/notion/query'
import { TRADE_PROPERTIES_MAP } from '@/shared/modules/construction/sources/notion/trades/properties-map'
import { notionClient } from '@/shared/services/providers/notion/client'
import { planSlugBackfill, slugPropertyProblem } from './lib/plan-slug-backfill'
import './lib/load-env'

const SLUG = TRADE_PROPERTIES_MAP.slug.label
/** Notion allows ~3 requests/second; 28 sequential writes at this spacing take ~10s. */
const WRITE_INTERVAL_MS = 350

function toRow(page: PageObjectResponse) {
  const p = page.properties
  const title = titleText(p, TRADE_PROPERTIES_MAP.name.label)
  return {
    pageId: page.id,
    title,
    disabled: checkbox(p, TRADE_PROPERTIES_MAP.disabled.label),
    current: richText(p, SLUG).trim(),
    derived: slugifyTradeName(title),
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const dataSourceId = notionDatabasesMeta.trades.id
  console.log(`target: production Notion, Trades data source ${dataSourceId} — ${apply ? 'APPLY' : 'dry run'}`)

  const dataSource = await notionClient.dataSources.retrieve({ data_source_id: dataSourceId })
  const problem = slugPropertyProblem('properties' in dataSource ? dataSource.properties[SLUG] : undefined)
  if (problem) {
    console.error(problem)
    process.exit(2)
  }

  const pages = (await queryNotionDatabase('trades')) ?? []
  const plan = planSlugBackfill(pages.map(toRow))

  console.table(plan.rows.map(r => ({ title: r.title, disabled: r.disabled, current: r.current, derived: r.derived, action: r.action })))
  console.log(`${plan.rows.length} rows: ${plan.writes} write, ${plan.rows.length - plan.writes - plan.conflicts} same, ${plan.conflicts} conflict`)

  if (plan.unslugifiable.length > 0) {
    console.error('titles that derive an empty slug — rename them in Notion first:', plan.unslugifiable)
    process.exit(1)
  }
  if (plan.duplicates.length > 0) {
    console.error('duplicate derived slugs — rename one of each in Notion first:', plan.duplicates)
    process.exit(1)
  }
  if (plan.conflicts > 0) {
    console.error('stored slugs that differ from the derived slug — this script never overwrites; resolve them in Notion first')
    process.exit(1)
  }
  if (!apply) {
    console.log(plan.writes > 0 ? `dry run — re-run with --apply to write ${plan.writes} slug(s)` : 'nothing to write')
    return
  }

  for (const row of plan.rows) {
    if (row.action !== 'write') {
      continue
    }
    await notionClient.pages.update({
      page_id: row.pageId,
      properties: { [SLUG]: { rich_text: [{ type: 'text', text: { content: row.derived } }] } },
    })
    console.log(`wrote ${row.derived}  ← ${row.title}${row.disabled ? ' (disabled)' : ''}`)
    await new Promise(resolve => setTimeout(resolve, WRITE_INTERVAL_MS))
  }
  console.log(`✓ wrote ${plan.writes} slug(s); re-run without --apply to confirm every row is 'same'`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
