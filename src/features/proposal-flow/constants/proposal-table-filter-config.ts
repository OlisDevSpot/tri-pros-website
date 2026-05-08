import type { FilterDefinition } from '@/shared/dal/client/query/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'
import { proposalStatuses } from '@/shared/constants/enums'
import { formatAsDollars } from '@/shared/lib/formatters'

/**
 * Slider bounds for the proposal price filter. Covers the realistic residential
 * remodeling range (kitchens / baths through whole-home remodels). Step is $1k —
 * fine-grained enough for dragging, coarse enough to keep the URL state tidy.
 */
const PROPOSAL_PRICE_MIN = 0
const PROPOSAL_PRICE_MAX = 300_000
const PROPOSAL_PRICE_STEP = 1_000

/**
 * Filter config for the proposals table. Ids match `proposalsRouter.crud.list`'s
 * `filters` shape on the server.
 */
export const PROPOSAL_FILTER_CONFIG = [
  {
    id: 'status',
    type: 'multi-select',
    label: 'Status',
    options: proposalStatuses.map(s => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: s,
    })),
  },
  {
    id: 'kind',
    type: 'multi-select',
    label: 'Kind',
    options: [
      { label: 'Initial sale', value: 'initial-sale' },
      { label: 'Additional work', value: 'additional-work' },
    ],
  },
  {
    id: 'createdAt',
    type: 'date-range',
    label: 'Created',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'sentAt',
    type: 'date-range',
    label: 'Sent',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'pipeline',
    type: 'select',
    label: 'Pipeline',
    options: [
      { label: 'Projects', value: 'projects' },
      { label: 'Fresh', value: 'fresh' },
      { label: 'Rehash', value: 'rehash' },
      { label: 'Dead', value: 'dead' },
    ],
  },
  {
    id: 'price',
    type: 'number-range',
    label: 'Price',
    min: PROPOSAL_PRICE_MIN,
    max: PROPOSAL_PRICE_MAX,
    step: PROPOSAL_PRICE_STEP,
    formatValue: formatAsDollars,
  },
] as const satisfies readonly FilterDefinition[]
