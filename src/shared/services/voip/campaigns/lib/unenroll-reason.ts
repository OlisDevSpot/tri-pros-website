// Pure rule (EPIC decision #16 + #18): map a CloudTalk disposition to the
// unenroll reason it should trigger — or null when the disposition is
// non-terminal (keep dialing). Composed by the cloudtalk webhook handler.
// No I/O.
//
// Terminal dispositions (exit the campaign):
//   - meeting_booked         → 'graduated'    (positive exit; CT hands off to app flow)
//   - opt_out / sms_stop     → 'opted_out'    (compliance; handler ALSO writes DNC)
//   - not_interested         → 'disqualified' (bad lead, no meeting)
//   - wrong_number           → 'disqualified' (unreachable; stop calling)
//   - cadence_exhausted      → // @migration: ring-2 (we don't count attempts yet)
// Everything else (callback_scheduled, no_answer, busy, voicemail) → null (keep dialing).

import type { VoipUnenrollReason } from '@/shared/constants/enums/voip'
import type { CloudtalkDisposition } from '@/shared/services/providers/cloudtalk/constants'

export function ctDispositionToUnenrollReason(
  disposition: CloudtalkDisposition,
): VoipUnenrollReason | null {
  switch (disposition) {
    case 'meeting_booked':
      return 'graduated'
    case 'opt_out':
    case 'sms_stop_received':
      return 'opted_out'
    case 'not_interested':
    case 'wrong_number':
      return 'disqualified'
    // Non-terminal — keep dialing.
    case 'callback_scheduled':
    case 'no_answer':
    case 'busy':
    case 'voicemail':
      return null
    // @migration: cadence_exhausted → ring-2 (attempt counter not built yet).
    case 'cadence_exhausted':
      return null
    default:
      return null
  }
}
