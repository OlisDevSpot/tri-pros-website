import type { ProfileFieldConfig } from '@/shared/entities/customers/types'

import { creditScoreRanges } from '@/shared/constants/enums/customers'

export const FINANCIAL_PROFILE_FIELDS: ProfileFieldConfig[] = [
  { id: 'creditScore', label: 'Credit Score', type: 'select', options: creditScoreRanges },
  { id: 'numQuotesReceived', label: 'Quotes Received', type: 'number', min: 0 },
]
