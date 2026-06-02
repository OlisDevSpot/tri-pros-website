import type {
  IncomingPhoneNumberInstance,
  IncomingPhoneNumberListInstanceOptions,
} from 'twilio/lib/rest/api/v2010/account/incomingPhoneNumber'

import { twilioClient } from '../client'

// Thin typed wrappers over `client.incomingPhoneNumbers.*`. Admin observability
// only in Phase 1 — Slug C's voip-dids service reads these to seed the
// `voip_dids` table from the live Twilio account, NOT vice versa. Numbers are
// purchased via the Twilio console; the app does not buy them programmatically.

// List all DIDs owned by the account. Used by the admin "Resync DIDs"
// mutation to populate / reconcile the voip_dids table.
export async function listIncomingPhoneNumbers(
  params?: IncomingPhoneNumberListInstanceOptions,
): Promise<IncomingPhoneNumberInstance[]> {
  // The SDK overloads list() with a no-arg form for "list everything" and a
  // params form. Branching here keeps the caller API ergonomic without
  // poisoning the overload selection.
  if (params === undefined) {
    return twilioClient().incomingPhoneNumbers.list()
  }
  return twilioClient().incomingPhoneNumbers.list(params)
}

// Fetch a single DID by SID. Used when reconciling drift between voip_dids
// and the live Twilio account for a specific number.
export async function fetchIncomingPhoneNumber(sid: string): Promise<IncomingPhoneNumberInstance> {
  return twilioClient().incomingPhoneNumbers(sid).fetch()
}
