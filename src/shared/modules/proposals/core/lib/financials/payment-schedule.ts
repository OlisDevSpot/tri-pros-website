import { STANDARD_PAYMENT_SCHEDULE } from '@/shared/modules/proposals/core/constants/payment-schedule'

export interface PaymentScheduleRow {
  key: string
  label: string
  /** Share of (price − deposit); null for the deposit itself. */
  percent: number | null
  amount: number
  due: 'signing' | 'stage' | 'completion'
}

export function computePaymentSchedule(finalTcp: number, deposit: number): PaymentScheduleRow[] {
  const baseCents = Math.max(0, Math.round(finalTcp * 100) - Math.round(deposit * 100))
  const fixedPercent = STANDARD_PAYMENT_SCHEDULE.reduce((sum, step) => sum + (step.percent ?? 0), 0)
  let usedCents = 0
  const progress = STANDARD_PAYMENT_SCHEDULE.map((step): PaymentScheduleRow => {
    if (step.percent === null) {
      return { key: step.key, label: step.label, percent: 100 - fixedPercent, amount: (baseCents - usedCents) / 100, due: 'completion' }
    }
    const amountCents = Math.round(baseCents * step.percent / 100)
    usedCents += amountCents
    return { key: step.key, label: step.label, percent: step.percent, amount: amountCents / 100, due: 'stage' }
  })
  return [{ key: 'deposit', label: 'Deposit', percent: null, amount: Math.round(deposit * 100) / 100, due: 'signing' }, ...progress]
}
