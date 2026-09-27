import { deriveProjectStatusBucket } from '@/shared/constants/enums/pipelines'

export type ProjectBankability = 'net' | 'at_risk' | 'cancelled'

/** On hold is paused, not lost: it stays in net and is flagged at risk; only a cancellation leaves net. */
export function projectBankability(stage: string | null | undefined): ProjectBankability {
  switch (deriveProjectStatusBucket(stage)) {
    case 'cancelled':
      return 'cancelled'
    case 'on_hold':
      return 'at_risk'
    default:
      return 'net'
  }
}
