import type { PaymentMode } from '@/features/proposal-flow/lib/get-cash-down-bounds'

export const PAYMENT_MODES: { value: PaymentMode, label: string }[] = [
  { value: 'all-cash', label: 'All cash' },
  { value: 'some-cash', label: 'Some cash' },
  { value: 'all-finance', label: 'All finance' },
  { value: 'scheduled', label: 'Scheduled payments' },
]
