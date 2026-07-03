// scripts/meta/sync/run.ts
// Campaign-as-code sync. DRY-RUN BY DEFAULT — prints the plan and exits.
// `--apply` executes. Never activates, never deletes; see design spec.
import process from 'node:process'
import { CAMPAIGN_SPECS } from '../campaign-specs/registry.js'
import { assertBudgetCeiling, assertUniqueSpecKeys } from '../campaign-specs/lib/guardrails.js'
import { fetchAccountState } from '../lib/marketing-api.js'
import { printError, printInfo } from '../lib/formatters.js'
import { applyPlan } from './apply.js'
import { computePlan } from './diff.js'
import { readLock } from './lock.js'

const OP_LABEL: Record<string, string> = {
  'create-campaign': '+ create campaign',
  'update-campaign': '~ update campaign',
  'create-adset': '+ create ad set',
  'update-adset': '~ update ad set',
  'create-ad': '+ create ad (PAUSED)',
  'refresh-creative': '~ refresh creative',
  'skip-ad-missing-image': '⚠ skip ad (image missing)',
  'orphan': '⏸ unmanaged (reported only)',
}

async function main() {
  const apply = process.argv.includes('--apply')

  assertUniqueSpecKeys(CAMPAIGN_SPECS) // hard guardrail — duplicate keys cause double-creates
  assertBudgetCeiling(CAMPAIGN_SPECS) // hard guardrail — throws before any API call

  printInfo(`Loaded ${CAMPAIGN_SPECS.length} campaign specs. Fetching account state…`)
  const lock = readLock()
  const state = await fetchAccountState()
  const plan = computePlan(CAMPAIGN_SPECS, lock, state)

  if (plan.length === 0) {
    printInfo('In sync — nothing to do.')
    return
  }

  console.log('\nPlan:')
  for (const op of plan) {
    const detail = 'adKey' in op
      ? `${op.campaignKey}/${op.adKey}`
      : 'campaignKey' in op
        ? op.campaignKey
        : `${op.kind} ${op.name} (${op.id})`
    console.log(`  ${OP_LABEL[op.op]}  ${detail}${'imagePath' in op ? `\n      missing: ${op.imagePath}` : ''}`)
  }

  const actionable = plan.filter(op => op.op !== 'orphan' && op.op !== 'skip-ad-missing-image')
  if (!apply) {
    printInfo(`Dry run — ${actionable.length} actionable op(s). Re-run with --apply to execute.`)
    return
  }
  if (actionable.length === 0) {
    printInfo('Nothing actionable to apply.')
    return
  }
  await applyPlan(plan, CAMPAIGN_SPECS, lock)
}

main().catch((err) => {
  printError(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
