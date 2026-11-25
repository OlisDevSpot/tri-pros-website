// The contract's progress payments split (contract price − deposit); the last row takes the remainder.
export const STANDARD_PAYMENT_SCHEDULE = [
  { key: 'site-inspection', label: 'Measurements / Site inspection', percent: 20 },
  { key: 'material-order', label: 'Material order / Delivery', percent: 35 },
  { key: 'installation', label: 'Installation commencement', percent: 35 },
  { key: 'completion', label: 'Completion', percent: null },
] as const satisfies readonly { key: string, label: string, percent: number | null }[]

// Cal. Bus. & Prof. Code §7159 requires a schedule of progress payments in every home improvement contract.
export const PAYMENT_SCHEDULE_LAW_NOTE = 'California law requires a payment schedule in every home improvement contract, even when the project is financed. Yours is in your agreement.'
