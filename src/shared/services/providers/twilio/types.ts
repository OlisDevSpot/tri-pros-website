// Re-exports of the SDK's typed resource shapes. Callers in Slug C's services
// write signatures like `Promise<CallInstance>` without ever importing from
// `twilio/lib/...` directly — the provider remains the single boundary that
// knows the SDK.
//
// For ACTIONS + RestException, import from `./client`. This file is types only.

export type {
  CallInstance,
  CallListInstanceCreateOptions,
} from 'twilio/lib/rest/api/v2010/account/call'
export type {
  IncomingPhoneNumberInstance,
  IncomingPhoneNumberListInstanceOptions,
} from 'twilio/lib/rest/api/v2010/account/incomingPhoneNumber'
export type {
  MessageInstance,
  MessageListInstanceCreateOptions,
} from 'twilio/lib/rest/api/v2010/account/message'
