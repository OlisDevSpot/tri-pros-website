import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection, ReturnWaterfall, ReturnWaterfallRow } from '@/features/calculators/remodel-roi-calculator/types'

import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'

export function buildReturnWaterfall(projection: RemodelRoiProjection, lookAhead: LookAheadYears): ReturnWaterfall {
  const parts = projection.years[lookAhead].returnParts
  const entries = [
    { label: 'Lower bills', value: parts.billsSaved, detail: `${formatYears(lookAhead)} of smaller bills` },
    { label: 'Repairs you skip', value: parts.repairsSkipped, detail: 'repairs on the aging ones' },
    { label: 'Replacements you skip', value: parts.replacementsSkipped, detail: 'the like-for-like price each time it gives out' },
    { label: 'Interest you skip', value: parts.interestSkipped, detail: 'interest on the replacement loans' },
    { label: 'Home\'s added value', value: parts.valueGain, detail: 'upgrade value minus replacement value' },
    { label: 'Project price', value: parts.projectPrice, detail: 'what you pay for the project' },
    { label: 'Interest on your loan', value: parts.projectInterest, detail: `interest paid and owed by year ${lookAhead}` },
  ].filter(row => Math.abs(row.value) > 0.5)
  let running = 0
  const rows: ReturnWaterfallRow[] = entries.map((row) => {
    const from = running
    running += row.value
    const to = running
    return { label: row.label, detail: row.detail, value: row.value, to, range: [Math.min(from, to), Math.max(from, to)], kind: row.value >= 0 ? 'gain' : 'cost' }
  })
  rows.push({ label: `Where you stand in year ${lookAhead}`, detail: 'All the parts above', value: running, to: running, range: [Math.min(0, running), Math.max(0, running)], kind: 'total' })
  const low = Math.min(0, ...rows.map(row => row.range[0]))
  const high = Math.max(0, ...rows.map(row => row.range[1]))
  return { rows, low, high }
}
