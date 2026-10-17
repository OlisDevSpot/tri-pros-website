import type { PaymentScheduleRow } from '@/shared/modules/proposals/core/lib/financials'

import { formatAsDollars } from '@/shared/lib/formatters'
import { MIN_FINANCED_AMOUNT } from '@/shared/modules/proposals/core/constants/financing'

export const FUNDING_LOCKED_NOTE = 'These choices are in your agreement. Ask your consultant to change them.'

export const FINANCING_STARTS_AT = `Financing starts at ${formatAsDollars(MIN_FINANCED_AMOUNT)}`

export const PAYMENT_DUE_COPY = {
  signing: 'Due when you sign',
  stage: 'Due at this stage of the work',
  completion: 'Due when the work is complete',
} as const satisfies Record<PaymentScheduleRow['due'], string>
